import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

/**
 * Hasła: scrypt (N=2^15, r=8, p=1) z losową solą. Tokeny logowania: 32 losowe bajty,
 * w bazie wyłącznie skrót SHA-256 — wyciek bazy nie daje dostępu do kont.
 */
const N = 1 << 15;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p));
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hasło sprawdzane przy niepowodzeniu wyszukania konta, żeby czas odpowiedzi nie zdradzał, czy e-mail istnieje. */
let dummy: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummy ??= hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(password, await dummy);
}

export const sha256 = (text: string | Buffer): string => createHash('sha256').update(text).digest('hex');

export function newToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: sha256(token) };
}

export const TOKEN_TTL_DAYS = 30;

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 200;
