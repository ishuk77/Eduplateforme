import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (!globalThis.__eduplateformeVolatileJwtSecret) {
    globalThis.__eduplateformeVolatileJwtSecret = randomBytes(32).toString('hex');
  }

  return globalThis.__eduplateformeVolatileJwtSecret;
}

export function createRefreshToken() {
  return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

export function signJwt(payload, { expiresInSeconds = 60 * 60 * 24 } = {}) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const issuedAt = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: issuedAt,
    exp: issuedAt + expiresInSeconds
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', getSecret()).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

export function verifyJwt(token) {
  const [encodedHeader, encodedPayload, signature] = String(token ?? '').split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', getSecret()).update(signingInput).digest();
  const providedSignature = Buffer.from(signature, 'base64url');
  if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(expectedSignature, providedSignature)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return null;
  }

  return payload;
}
