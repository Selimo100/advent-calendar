import path from 'node:path';
import postgres from 'postgres';
import { inject } from 'vitest';
import example from '../../content/example/calendar.ts';
import { handleApiRequest, type AppDeps } from '../../server/app.ts';
import { hashPassphrase } from '../../server/auth/passphrase.ts';
import { fixedClock } from '../../server/calendar/clock.ts';
import { runMigrations } from '../../server/db/migrate.ts';
import { createPostgresDb } from '../../server/db/postgresDb.ts';
import type { Db } from '../../server/db/types.ts';
import type { MediaStorageWriter } from '../../server/storage/types.ts';
import { applyImport, planImport, prepareImport, type PreparedImport } from '../../tools/content/importer.ts';

export const PASSPHRASE = 'zimtsterne und tannenduft';
export const MEDIA_DIR = path.resolve(import.meta.dirname, '../../content/example/media');

export function memoryStorage() {
  const objects = new Map<string, { bytes: Uint8Array; type: string }>();
  const signed: string[] = [];
  const storage: MediaStorageWriter = {
    async createSignedUrl(p, ttl) {
      signed.push(p);
      return `https://storage.test/signed/${encodeURIComponent(p)}?ttl=${ttl}&token=sig`;
    },
    async upload(p, bytes, type) {
      objects.set(p, { bytes, type });
    },
    async remove(paths) {
      paths.forEach((p) => objects.delete(p));
    },
    async exists(p) {
      return objects.has(p);
    },
  };
  return { storage, objects, signed };
}

let preparedCache: PreparedImport | null = null;
export async function preparedExample() {
  preparedCache ??= await prepareImport(example, MEDIA_DIR, { allowPlaceholders: true, prune: false });
  return preparedCache;
}

export async function createTestEnv(name: string) {
  const base = inject('pgBaseUrl');
  const dbName = `t_${name}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = postgres(`${base}/postgres`, { max: 1, onnotice: () => {} });
  await admin.unsafe(`create database ${dbName}`);
  // Supabase API roles, so the migration's revokes can be verified.
  await admin.unsafe(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$;`);
  await admin.end();

  const url = `${base}/${dbName}`;
  const { db, close } = createPostgresDb(url, { max: 20 });
  await runMigrations(db);
  const media = memoryStorage();
  const prepared = await preparedExample();
  await applyImport(db, media.storage, prepared, await planImport(db, prepared), { allowPlaceholders: true, prune: false });

  let now = new Date('2026-12-05T09:00:00Z');
  const deps: AppDeps = {
    db,
    clock: fixedClock(() => now),
    storage: media.storage,
    calendarId: example.calendarId,
    passphraseHash: await hashPassphrase(PASSPHRASE, { N: 2 ** 14, r: 8, p: 1 }),
    cookie: { secure: true, maxAgeSeconds: 60 * 86_400 },
  };

  async function call(method: string, pathname: string, opts: { cookie?: string; body?: unknown; headers?: Record<string, string>; ip?: string } = {}) {
    const headers = new Headers(opts.headers);
    if (method !== 'GET') headers.set('x-advent-request', '1');
    if (opts.cookie) headers.set('cookie', opts.cookie);
    if (opts.body !== undefined) headers.set('content-type', 'application/json');
    const response = await handleApiRequest(
      new Request(`https://cal.test${pathname}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
      () => deps,
      { clientIp: opts.ip ?? '203.0.113.7' },
    );
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, json: text ? (JSON.parse(text) as any) : null };
  }

  async function login(ip?: string) {
    const res = await call('POST', '/api/session', { body: { passphrase: PASSPHRASE }, ip });
    if (res.status !== 200) throw new Error(`login failed: ${res.text}`);
    const cookie = res.headers.get('set-cookie')!.split(';')[0]!;
    return cookie;
  }

  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params))[0]!).n);

  return {
    db: db as Db,
    url,
    deps,
    media,
    call,
    login,
    count,
    setNow: (iso: string) => void (now = new Date(iso)),
    close,
  };
}
