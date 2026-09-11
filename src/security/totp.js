import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let encoded = '';
  for (let index = 0; index < bits.length; index += 5) {
    encoded += BASE32_ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return encoded;
}

function base32Decode(value) {
  const normalized = String(value).toUpperCase().replace(/=+$/g, '').replace(/\s/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function encryptionKey() {
  const material = process.env.MFA_ENCRYPTION_KEY
    ?? process.env.DATA_ENCRYPTION_KEY
    ?? process.env.JWT_SECRET;
  if (!material && process.env.NODE_ENV === 'production') {
    throw new Error('MFA_ENCRYPTION_KEY is required in production.');
  }
  return createHash('sha256').update(material ?? 'eduplateforme-development-mfa-key').digest();
}

export function createTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function createTotpCode(secret, { at = Date.now(), stepSeconds = 30, digits = 6 } = {}) {
  const counter = Math.floor(at / 1000 / stepSeconds);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (digest.readUInt32BE(offset) & 0x7fffffff) % (10 ** digits);
  return String(binary).padStart(digits, '0');
}

export function verifyTotp(secret, code, { at = Date.now(), window = 1 } = {}) {
  if (!/^\d{6}$/.test(String(code))) return false;
  const supplied = Buffer.from(String(code));
  for (let drift = -window; drift <= window; drift += 1) {
    const expected = Buffer.from(createTotpCode(secret, { at: at + (drift * 30_000) }));
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return true;
  }
  return false;
}

export function encryptMfaSecret(secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((value) => value.toString('base64url')).join('.');
}

export function decryptMfaSecret(value) {
  const [iv, tag, encrypted] = String(value).split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function createRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => randomBytes(6).toString('hex').toUpperCase());
}

export function hashRecoveryCode(code) {
  return createHash('sha256').update(String(code).replace(/[\s-]/g, '').toUpperCase()).digest('hex');
}
