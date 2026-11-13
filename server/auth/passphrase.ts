/**
 * Passphrase hashing with Node's built-in scrypt (RFC 7914).
 *
 * Encoded format:  scrypt$v1$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 * Only the encoded hash is stored (as the ADVENT_PASSPHRASE_HASH env var).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );

const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 32;
export const MIN_PASSPHRASE_LENGTH = 16;
export const MAX_PASSPHRASE_LENGTH = 256;

/** Normalise so that composed/decomposed umlauts and stray spaces still match. */
export function normalisePassphrase(input: string): string {
  return input.normalize('NFC').trim();
}

export async function hashPassphrase(
  passphrase: string,
  params: { N: number; r: number; p: number } = DEFAULT_PARAMS,
): Promise<string> {
  const normalised = normalisePassphrase(passphrase);
  if (normalised.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters long`);
  }
  if (normalised.length > MAX_PASSPHRASE_LENGTH) throw new Error('Passphrase is too long');
  const salt = randomBytes(16);
  const key = await scrypt(normalised, salt, KEY_LENGTH, { ...params, maxmem: 128 * params.N * params.r * 2 });
  return ['scrypt', 'v1', params.N, params.r, params.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export function isValidPassphraseHash(encoded: string): boolean {
  return /^scrypt\$v1\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{40,}$/.test(encoded);
}

export async function verifyPassphrase(passphrase: string, encoded: string): Promise<boolean> {
  if (!isValidPassphraseHash(encoded)) throw new Error('Invalid passphrase hash format');
  const [, , n, r, p, saltB64, hashB64] = encoded.split('$');
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (N < 2 ** 14 || N > 2 ** 20 || R < 1 || R > 32 || P < 1 || P > 16) {
    throw new Error('Unsupported scrypt parameters');
  }
  const expected = Buffer.from(hashB64!, 'base64url');
  const normalised = normalisePassphrase(passphrase);
  if (normalised.length === 0 || normalised.length > MAX_PASSPHRASE_LENGTH) return false;
  const actual = await scrypt(normalised, Buffer.from(saltB64!, 'base64url'), expected.length, {
    N,
    r: R,
    p: P,
    maxmem: 128 * N * R * 2,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
