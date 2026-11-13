import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import example from '../../content/example/calendar.ts';
import { applyImport, planImport } from '../../tools/content/importer.ts';
import { createTestEnv, preparedExample } from './helpers.ts';

type Env = Awaited<ReturnType<typeof createTestEnv>>;
let env: Env;
let cookie: string;

beforeAll(async () => {
  env = await createTestEnv('privacy');
  env.setNow('2026-12-05T09:00:00Z');
  cookie = await env.login();
});
afterAll(async () => env.close());

/** Distinctive strings from every door except the given ones. */
function secretsOf(exceptDays: number[]): string[] {
  return example.doors
    .filter((d) => !exceptDays.includes(d.day))
    .flatMap((d) => [d.title, ...JSON.stringify(d.blocks).match(/"(?:paragraphs|story|description|title|trackTitle|reasons|invitation)":\s*(?:\[\s*)?"([^"]{12,})"/g) ?? []])
    .map((s) => s.replace(/^.*?"([^"]+)"$/, '$1'));
}

describe('information exposure', () => {
  it('overview contains no data about unopened doors', async () => {
    const res = await env.call('GET', '/api/calendar', { cookie });
    expect(res.json.doors).toHaveLength(24);
    for (const door of res.json.doors) {
      expect(Object.keys(door).sort()).toEqual(['day', 'state']);
    }
    for (const secret of secretsOf([])) expect(res.text).not.toContain(secret);
    expect(res.text).not.toMatch(/spotify|storage|\.webp|\.wav|placeholder-|media/i);
  });

  it('overview reveals only titles of opened doors', async () => {
    await env.call('POST', '/api/doors/5/open', { cookie });
    const res = await env.call('GET', '/api/calendar', { cookie });
    expect(res.json.doors.find((d: { day: number }) => d.day === 5).title).toBe('Ein kleiner Gutschein');
    for (const secret of secretsOf([5])) expect(res.text).not.toContain(secret);
  });

  it('content endpoint never opens a door and denies unopened doors', async () => {
    for (const day of [3, 4, 6, 24]) {
      const res = await env.call('GET', `/api/doors/${day}`, { cookie });
      expect(res.status).toBe(403);
      expect(res.json.error.code).toBe('DOOR_NOT_OPENED');
    }
    expect(await env.count('select 1 from advent.openings where day <> 5')).toBe(0);
  });

  it('protects media of unopened doors and never exposes storage paths', async () => {
    const mediaRows = await env.db.query<{ id: string; day: number; storage_path: string }>('select id, day, storage_path from advent.media');
    expect(mediaRows.length).toBeGreaterThan(0);
    for (const row of mediaRows) {
      const res = await env.call('GET', `/api/media/${row.id}`, { cookie });
      expect(res.status).toBe(404); // no media on door 5
      expect(res.text).not.toContain(row.storage_path);
    }
    expect(env.media.signed).toEqual([]);
    expect((await env.call('GET', '/api/media/../../etc/passwd', { cookie })).status).toBe(404);
    expect((await env.call('GET', '/api/media/advent-2026%2F04%2Fx.webp', { cookie })).status).toBe(404);
    // Without a session nothing is reachable.
    expect((await env.call('GET', `/api/media/${mediaRows[0]!.id}`)).status).toBe(401);
  });

  it('issues a short-lived signed URL only for media of an opened door', async () => {
    env.setNow('2026-12-04T09:00:00Z');
    await env.db.query('delete from advent.openings');
    await env.call('POST', '/api/doors/4/open', { cookie });
    const content = await env.call('GET', '/api/doors/4', { cookie });
    const src: string = content.json.blocks[0].photos[0].src;
    expect(src).toMatch(/^\/api\/media\/[0-9a-f-]{36}$/);
    expect(content.text).not.toMatch(/advent-2026\/|storage_path|\.svg|placeholder-winter/);
    const media = await env.call('GET', src, { cookie });
    expect(media.status).toBe(302);
    expect(media.headers.get('location')).toMatch(/^https:\/\/storage\.test\/signed\/.*ttl=600/);
    expect(media.headers.get('cache-control')).toContain('no-store');
    env.setNow('2026-12-05T09:00:00Z');
  });

  it('marks every API response as private / no-store', async () => {
    for (const res of [
      await env.call('GET', '/api/calendar', { cookie }),
      await env.call('GET', '/api/doors/4', { cookie }),
      await env.call('GET', '/api/calendar'),
    ]) {
      expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0');
      expect(res.headers.get('vary')).toContain('Cookie');
    }
  });

  it('restricts methods', async () => {
    expect((await env.call('PUT', '/api/calendar', { cookie })).status).toBe(405);
    expect((await env.call('GET', '/api/doors/5/open', { cookie })).status).toBe(405);
    expect((await env.call('GET', '/api/nope', { cookie })).status).toBe(404);
  });
});

describe('database lockdown', () => {
  it('enables RLS on every table and grants nothing to API roles', async () => {
    const tables = await env.db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'advent' and c.relkind = 'r'`,
    );
    expect(tables.length).toBeGreaterThanOrEqual(7);
    expect(tables.every((t) => t.relrowsecurity)).toBe(true);
    for (const role of ['anon', 'authenticated']) {
      const privileges = await env.db.query(
        `select 1 from information_schema.role_table_grants where table_schema = 'advent' and grantee = $1`,
        [role],
      );
      expect(privileges).toEqual([]);
      const usage = await env.db.query<{ ok: boolean }>(`select has_schema_privilege($1, 'advent', 'USAGE') as ok`, [role]);
      expect(usage[0]!.ok).toBe(false);
    }
  });

  it('fixes the search_path of database functions', async () => {
    const fns = await env.db.query<{ proname: string; proconfig: string[] | null }>(
      `select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'advent'`,
    );
    expect(fns.length).toBeGreaterThan(0);
    for (const fn of fns) expect(fn.proconfig?.join()).toContain('search_path=""');
  });
});

describe('content import', () => {
  it('is idempotent and preserves opening history', async () => {
    const before = await env.count('select 1 from advent.openings');
    const prepared = await preparedExample();
    const plan = await planImport(env.db, prepared);
    expect(plan.doors.every((d) => d.action === 'unchanged')).toBe(true);
    expect(plan.uploads.every((u) => u.action === 'unchanged')).toBe(true);
    await applyImport(env.db, env.media.storage, prepared, plan, { allowPlaceholders: true, prune: false });
    expect(await env.count('select 1 from advent.openings')).toBe(before);
  });

  it('refuses to repurpose a calendar for another year', async () => {
    const prepared = await preparedExample();
    await expect(planImport(env.db, { ...prepared, calendar: { ...prepared.calendar, year: 2027 } })).rejects.toThrow(/new calendarId/);
    await expect(env.db.query('update advent.calendars set year = 2027')).rejects.toMatchObject({ code: '23514' });
  });

  it('keeps unreferenced media unless prune is requested explicitly', async () => {
    const prepared = await preparedExample();
    const withoutDay4Media = { ...prepared, media: prepared.media.filter((m) => m.day !== 20) };
    const plan = await planImport(env.db, withoutDay4Media);
    expect(plan.prunable.length).toBeGreaterThan(0);
    const mediaBefore = await env.count('select 1 from advent.media');
    await applyImport(env.db, env.media.storage, withoutDay4Media, plan, { allowPlaceholders: true, prune: false });
    expect(await env.count('select 1 from advent.media')).toBe(mediaBefore);
  });
});
