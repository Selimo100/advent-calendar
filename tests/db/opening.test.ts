/**
 * End-to-end API + database behaviour against a real PostgreSQL server.
 * Requests go through handleApiRequest (routing, cookies, CSRF, sessions)
 * and the real transactional opening code.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestEnv } from './helpers.ts';

type Env = Awaited<ReturnType<typeof createTestEnv>>;
let env: Env;
let cookie: string;

beforeAll(async () => {
  env = await createTestEnv('opening');
});
afterAll(async () => env.close());

beforeEach(async () => {
  await env.db.query('delete from advent.openings');
  await env.db.query('delete from advent.sessions');
  await env.db.query('delete from advent.login_failures');
  await env.db.query('update advent.doors set publishable = true');
  env.setNow('2026-12-05T09:00:00Z');
  cookie = await env.login();
});

const open = (day: number | string, c = cookie) => env.call('POST', `/api/doors/${day}/open`, { cookie: c });
const openings = () => env.count('select 1 from advent.openings');

describe('date rules (authoritative server clock, Europe/Zurich)', () => {
  it('denies door 1 before 01.12.2026 and allows it exactly at Zurich midnight', async () => {
    env.setNow('2026-11-30T22:59:59.999Z');
    expect((await open(1)).json.error.code).toBe('DOOR_LOCKED');
    env.setNow('2026-11-30T23:00:00.000Z');
    const res = await open(1);
    expect(res.status).toBe(200);
    const rows = await env.db.query<{ local_date: string }>('select local_date::text from advent.openings');
    expect(rows).toEqual([{ local_date: '2026-12-01' }]);
  });

  it('uses the Zurich date while UTC is still on the previous date', async () => {
    env.setNow('2026-12-04T23:30:00Z'); // 05.12. 00:30 in Zurich
    expect((await open(4)).json.error.code).toBe('DOOR_MISSED');
    expect((await open(5)).status).toBe(200);
  });

  it('allows only the correct door; future and missed doors are denied', async () => {
    expect((await open(6)).json.error.code).toBe('DOOR_LOCKED');
    expect((await open(24)).json.error.code).toBe('DOOR_LOCKED');
    expect((await open(4)).json.error.code).toBe('DOOR_MISSED');
    expect(await openings()).toBe(0);
    expect((await open(5)).json.door.day).toBe(5);
  });

  it('keeps opened doors readable later, including after December', async () => {
    await open(5);
    env.setNow('2027-03-01T12:00:00Z');
    cookie = await env.login(); // the 60-day session has expired by now
    const res = await env.call('GET', '/api/doors/5', { cookie });
    expect(res.status).toBe(200);
    expect(res.json.title).toBe('Ein kleiner Gutschein');
    const overview = await env.call('GET', '/api/calendar', { cookie });
    expect(overview.json.phase).toBe('after');
    expect(overview.json.doors.find((d: { day: number }) => d.day === 5).state).toBe('opened');
    expect(overview.json.doors.find((d: { day: number }) => d.day === 6).state).toBe('missed');
  });

  it('handles 24 and 25 December', async () => {
    env.setNow('2026-12-24T06:00:00Z');
    expect((await open(24)).json.door.layout).toBe('final');
    await env.db.query('delete from advent.openings');
    env.setNow('2026-12-25T06:00:00Z');
    expect((await open(24)).json.error.code).toBe('DOOR_MISSED');
  });

  it('does not restart in a later year and is locked in an earlier year', async () => {
    env.setNow('2027-12-01T10:00:00Z');
    cookie = await env.login();
    expect((await open(1)).json.error.code).toBe('DOOR_MISSED');
    env.setNow('2025-12-05T10:00:00Z');
    expect((await open(5)).json.error.code).toBe('DOOR_LOCKED');
    expect(await openings()).toBe(0);
  });

  it('rejects invalid day numbers', async () => {
    for (const day of ['0', '25', '-1', 'abc', '100', '5.5']) {
      const res = await open(day);
      expect([400, 404]).toContain(res.status);
    }
    expect(await openings()).toBe(0);
  });

  it('ignores any client-provided time, date or timezone', async () => {
    const res = await env.call('POST', '/api/doors/24/open', {
      cookie,
      body: { now: '2026-12-24T10:00:00Z', localDate: '2026-12-24', recipientId: '00000000-0000-0000-0000-000000000000' },
      headers: { date: 'Thu, 24 Dec 2026 10:00:00 GMT', 'x-timezone-offset': '-840' },
    });
    expect(res.json.error.code).toBe('DOOR_LOCKED');
    expect(await openings()).toBe(0);
  });

  it('does not open a door whose content is not publishable', async () => {
    await env.db.query('update advent.doors set publishable = false where day = 5');
    const overview = await env.call('GET', '/api/calendar', { cookie });
    expect(overview.json.doors.find((d: { day: number }) => d.day === 5).state).toBe('not_ready');
    const res = await open(5);
    expect(res.status).toBe(409);
    expect(res.json.error.code).toBe('CONTENT_NOT_READY');
    expect(await openings()).toBe(0);
  });
});

describe('sessions', () => {
  it('rejects missing, invalid, expired and revoked sessions', async () => {
    expect((await env.call('GET', '/api/calendar')).status).toBe(401);
    expect((await env.call('GET', '/api/calendar', { cookie: '__Host-advent_session=forged' })).status).toBe(401);
    env.setNow('2027-02-10T09:00:00Z'); // > 60 days later
    expect((await env.call('GET', '/api/calendar', { cookie })).status).toBe(401);
    env.setNow('2026-12-05T09:00:00Z');
    const fresh = await env.login();
    expect((await env.call('GET', '/api/calendar', { cookie: fresh })).status).toBe(200);
    expect((await env.call('DELETE', '/api/session', { cookie: fresh })).status).toBe(200);
    expect((await env.call('GET', '/api/calendar', { cookie: fresh })).status).toBe(401);
  });

  it('stores only token hashes', async () => {
    const token = cookie.split('=')[1]!;
    const rows = await env.db.query<{ token_hash: string }>('select token_hash from advent.sessions');
    expect(rows.some((r) => r.token_hash === token)).toBe(false);
    expect(rows.every((r) => /^[a-f0-9]{64}$/.test(r.token_hash))).toBe(true);
  });

  it('shares opening history between sessions (devices / private tabs)', async () => {
    const phone = cookie;
    const laptop = await env.login('198.51.100.20');
    await open(5, phone);
    const overview = await env.call('GET', '/api/calendar', { cookie: laptop });
    expect(overview.json.doors.find((d: { day: number }) => d.day === 5).state).toBe('opened');
    // A brand-new session after "clearing browser data" still sees it.
    const privateTab = await env.login('198.51.100.21');
    expect((await env.call('GET', '/api/doors/5', { cookie: privateTab })).status).toBe(200);
  });

  it('rate-limits failed logins durably and records nothing for them', async () => {
    for (let i = 0; i < 8; i++) {
      const res = await env.call('POST', '/api/session', { body: { passphrase: 'falsch falsch falsch' }, ip: '192.0.2.99' });
      expect(res.status).toBe(401);
    }
    const blocked = await env.call('POST', '/api/session', { body: { passphrase: 'zimtsterne und tannenduft' }, ip: '192.0.2.99' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    // Other clients are unaffected.
    expect((await env.call('POST', '/api/session', { body: { passphrase: 'zimtsterne und tannenduft' }, ip: '192.0.2.100' })).status).toBe(200);
    // Failures are stored as hashed buckets, never as raw IPs.
    const buckets = await env.db.query<{ bucket: string }>('select bucket from advent.login_failures');
    expect(buckets.every((b) => !b.bucket.includes('192.0.2'))).toBe(true);
  });

  it('rejects mutations without CSRF protection header', async () => {
    const res = await env.call('POST', '/api/doors/5/open', { cookie, headers: { origin: 'https://evil.test' } });
    expect(res.json.error.code).toBe('CSRF_REJECTED');
    expect(await openings()).toBe(0);
  });
});

describe('atomic, idempotent openings', () => {
  it('treats double submission as one opening', async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => open(5)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.json.firstOpen).length).toBe(1);
    expect(new Set(results.map((r) => r.json.door.openedAt)).size).toBe(1);
    expect(await openings()).toBe(1);
  });

  it('cannot be bypassed by simultaneous requests from different devices', async () => {
    const other = await env.login('198.51.100.30');
    const results = await Promise.all([...Array.from({ length: 6 }, () => open(5)), ...Array.from({ length: 6 }, () => open(5, other))]);
    expect(results.filter((r) => r.json.firstOpen).length).toBe(1);
    expect(await openings()).toBe(1);
  });

  it('recovers the same opening on retry after a committed request', async () => {
    const first = await open(5);
    env.setNow('2026-12-05T21:00:00Z');
    const retry = await open(5);
    expect(retry.json.firstOpen).toBe(false);
    expect(retry.json.door.openedAt).toBe(first.json.door.openedAt);
    expect(await openings()).toBe(1);
  });

  it('enforces one new door per date and per door in the database itself', async () => {
    await open(5);
    const { recipient_id } = (await env.db.query<{ recipient_id: string }>('select recipient_id from advent.openings'))[0]!;
    const insert = (day: number, at: string, date: string) =>
      env.db.query(
        `insert into advent.openings (recipient_id, calendar_id, day, opened_at, local_date) values ($1, 'advent-2026', $2, $3, $4::date)`,
        [recipient_id, day, at, date],
      );
    await expect(insert(6, '2026-12-05T10:00:00Z', '2026-12-05')).rejects.toMatchObject({ code: '23505' });
    await expect(insert(5, '2026-12-06T10:00:00Z', '2026-12-06')).rejects.toMatchObject({ code: '23505' });
    // local_date must be derived from opened_at in Europe/Zurich.
    await expect(insert(7, '2026-12-06T23:30:00Z', '2026-12-06')).rejects.toMatchObject({ code: '23514' });
    await expect(env.db.query("update advent.openings set day = 6")).rejects.toMatchObject({ code: '23514' });
  });

  it('serialises racing first openings of different doors on the same date at the DB level', async () => {
    // Simulates a (hypothetical) policy that allowed two doors on one date:
    // the unique (recipient, calendar, local_date) constraint must stop the second.
    const { id } = (await env.db.query<{ id: string }>('select id from advent.recipients'))[0]!;
    const attempts = await Promise.allSettled(
      [5, 6, 7, 8].map((day) =>
        env.db.query(
          `insert into advent.openings (recipient_id, calendar_id, day, opened_at, local_date) values ($1, 'advent-2026', $2, '2026-12-05T10:00:00Z', '2026-12-05')`,
          [id, day],
        ),
      ),
    );
    expect(attempts.filter((a) => a.status === 'fulfilled').length).toBe(1);
  });
});
