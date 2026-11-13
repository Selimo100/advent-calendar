import { describe, expect, it } from 'vitest';
import { hashPassphrase, isValidPassphraseHash, verifyPassphrase } from '../../server/auth/passphrase.ts';
import { hashSessionToken, newSessionToken } from '../../server/auth/sessions.ts';
import { readCookie, serializeSessionCookie } from '../../server/http/cookies.ts';
import { isCsrfSafe } from '../../server/http/csrf.ts';

describe('passphrase hashing', () => {
  it('hashes with scrypt and verifies', async () => {
    const hash = await hashPassphrase('tannenzweig kerzenlicht', { N: 2 ** 14, r: 8, p: 1 });
    expect(isValidPassphraseHash(hash)).toBe(true);
    expect(hash).not.toContain('tannenzweig');
    expect(await verifyPassphrase('tannenzweig kerzenlicht', hash)).toBe(true);
    expect(await verifyPassphrase('  tannenzweig kerzenlicht ', hash)).toBe(true);
    expect(await verifyPassphrase('tannenzweig kerzenlich', hash)).toBe(false);
    expect(await verifyPassphrase('', hash)).toBe(false);
  });

  it('refuses short passphrases', async () => {
    await expect(hashPassphrase('kurz')).rejects.toThrow(/at least 16/);
  });

  it('normalises composed and decomposed umlauts', async () => {
    const hash = await hashPassphrase('schöne grüsse aus zürich', { N: 2 ** 14, r: 8, p: 1 });
    expect(await verifyPassphrase('schöne grüsse aus zürich', hash)).toBe(true);
  });
});

describe('session tokens and cookies', () => {
  it('creates opaque 256-bit tokens and stores only hashes', () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(newSessionToken());
    expect(hashSessionToken(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('uses a secure, HttpOnly, SameSite cookie in production', () => {
    const cookie = serializeSessionCookie('t', { secure: true, maxAgeSeconds: 100 });
    expect(cookie).toMatch(/^__Host-advent_session=t;/);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).not.toContain('Domain');
  });

  it('reads cookies by exact name', () => {
    const req = new Request('https://x.test', { headers: { cookie: 'a=1; advent_session=abc; b=2' } });
    expect(readCookie(req, 'advent_session')).toBe('abc');
    expect(readCookie(req, 'session')).toBeNull();
  });
});

describe('CSRF protection', () => {
  const req = (headers: Record<string, string>, method = 'POST') => new Request('https://cal.test/api/doors/5/open', { method, headers });
  it('requires the custom header for mutations', () => {
    expect(isCsrfSafe(req({}))).toBe(false);
    expect(isCsrfSafe(req({ 'x-advent-request': '1' }))).toBe(true);
    expect(isCsrfSafe(req({}, 'GET'))).toBe(true);
  });
  it('rejects cross-site origins', () => {
    expect(isCsrfSafe(req({ 'x-advent-request': '1', origin: 'https://evil.test' }))).toBe(false);
    expect(isCsrfSafe(req({ 'x-advent-request': '1', 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isCsrfSafe(req({ 'x-advent-request': '1', origin: 'https://cal.test', 'sec-fetch-site': 'same-origin' }))).toBe(true);
  });
});
