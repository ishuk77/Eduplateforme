import { hashSync, compareSync } from 'bcryptjs';

const DEFAULT_ROUNDS = 10;

export function hashPassword(password) {
  return hashSync(String(password), Number(process.env.BCRYPT_ROUNDS ?? DEFAULT_ROUNDS));
}

export function verifyPassword(password, passwordHash) {
  if (!passwordHash) {
    return false;
  }

  return compareSync(String(password), passwordHash);
}
