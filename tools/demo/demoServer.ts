/**
 * LOCAL DEMO BACKEND — used only by the Vite dev server (`npm run dev`).
 *
 * Runs the real API handler and the real SQL migrations against PGlite with
 * the fictional example content. It adds a simulated clock and demo-only
 * endpoints under /api/demo/*. None of this is part of the Netlify Function
 * bundle, and production has no clock override of any kind.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { handleApiRequest, type AppDeps } from '../../server/app.ts';
import { hashPassphrase } from '../../server/auth/passphrase.ts';
import type { Clock } from '../../server/calendar/clock.ts';
import { runMigrations } from '../../server/db/migrate.ts';
import { createPgliteDb } from '../../server/db/pgliteDb.ts';
import { json } from '../../server/http/responses.ts';
import { decemberDate, isValidDoorDay, toIsoDate, zurichStartOfDay } from '../../shared/calendar/time.ts';
import { applyImport, planImport, prepareImport } from '../content/importer.ts';
import { resolveContentSource } from '../content/source.ts';
import exampleCalendar from '../../content/example/calendar.ts';
import { createLocalStorage, DEMO_MEDIA_PREFIX } from './localStorage.ts';

export const DEMO_PASSPHRASE = 'lebkuchen-im-schnee';

interface ClockState {
  /** Simulated instant (ISO) at the moment it was set; null = real time. */
  at: string | null;
  setAtRealMs: number;
  frozen: boolean;
}

export interface DemoServerOptions {
  dataDir: string;
  /** Optional initial simulated time (ISO), e.g. for end-to-end tests. */
  initialTime?: string;
}

export async function createDemoServer(options: DemoServerOptions) {
  await mkdir(options.dataDir, { recursive: true });
  const client = await PGlite.create(path.join(options.dataDir, 'pg'));
  const db = createPgliteDb(client);
  await runMigrations(db, { exec: async (sql) => void (await client.exec(sql)) });

  const { storage, serve } = createLocalStorage(path.join(options.dataDir, 'storage'));
  const calendarId = exampleCalendar.calendarId;

  const seeded = await db.query('select 1 from advent.calendars where id = $1', [calendarId]);
  if (seeded.length === 0) await importExample();

  async function importExample() {
    const source = resolveContentSource('example');
    const importOptions = { allowPlaceholders: true, prune: false };
    const prepared = await prepareImport(exampleCalendar, source.mediaDir, importOptions);
    await applyImport(db, storage, prepared, await planImport(db, prepared), importOptions);
  }

  // --- simulated clock ------------------------------------------------------
  const statePath = path.join(options.dataDir, 'demo-clock.json');
  let clockState: ClockState = { at: null, setAtRealMs: Date.now(), frozen: true };
  if (options.initialTime) clockState = { at: new Date(options.initialTime).toISOString(), setAtRealMs: Date.now(), frozen: true };
  else if (existsSync(statePath)) clockState = JSON.parse(await readFile(statePath, 'utf8')) as ClockState;
  let latencyMs = 0;
  let failNext = false;

  const simulatedNow = () =>
    clockState.at === null
      ? new Date()
      : new Date(new Date(clockState.at).getTime() + (clockState.frozen ? 0 : Date.now() - clockState.setAtRealMs));
  const clock: Clock = { now: async () => simulatedNow() };

  const deps: AppDeps = {
    db,
    clock,
    storage,
    calendarId,
    passphraseHash: await hashPassphrase(DEMO_PASSPHRASE),
    cookie: { secure: false, maxAgeSeconds: 60 * 86_400 },
  };

  async function demoRoute(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const body = request.method === 'POST' ? ((await request.json().catch(() => ({}))) as Record<string, unknown>) : {};
    switch (`${request.method} ${url.pathname}`) {
      case 'GET /api/demo/state': {
        const openings = await db.query<{ day: number }>('select day from advent.openings where calendar_id = $1 order by day', [calendarId]);
        return json(200, {
          demo: true,
          passphrase: DEMO_PASSPHRASE,
          now: simulatedNow().toISOString(),
          simulated: clockState.at !== null,
          frozen: clockState.frozen,
          latencyMs,
          openedDays: openings.map((o) => Number(o.day)),
        });
      }
      case 'POST /api/demo/clock': {
        const at = typeof body.at === 'string' ? new Date(body.at) : null;
        if (at && Number.isNaN(at.getTime())) return json(400, { error: 'invalid date' });
        clockState = { at: at ? at.toISOString() : null, setAtRealMs: Date.now(), frozen: body.frozen !== false };
        await writeFile(statePath, JSON.stringify(clockState));
        return json(200, { ok: true, now: simulatedNow().toISOString() });
      }
      case 'POST /api/demo/latency':
        latencyMs = Math.max(0, Math.min(10_000, Number(body.ms) || 0));
        return json(200, { ok: true, latencyMs });
      case 'POST /api/demo/fail-next':
        failNext = true;
        return json(200, { ok: true });
      case 'POST /api/demo/reset':
        await db.query('delete from advent.openings where calendar_id = $1', [calendarId]);
        return json(200, { ok: true });
      case 'POST /api/demo/history': {
        // Simulated history: marks doors as opened on their own date (demo only).
        const days = Array.isArray(body.openedDays) ? body.openedDays.filter(isValidDoorDay) : [];
        const recipient = await db.query<{ recipient_id: string }>('select recipient_id from advent.calendars where id = $1', [calendarId]);
        await db.query('delete from advent.openings where calendar_id = $1', [calendarId]);
        for (const day of days) {
          const date = decemberDate(exampleCalendar.year, day);
          const openedAt = new Date(zurichStartOfDay(date).getTime() + 19 * 3_600_000);
          await db.query(
            `insert into advent.openings (recipient_id, calendar_id, day, opened_at, local_date) values ($1, $2, $3, $4, $5::date)`,
            [recipient[0]!.recipient_id, calendarId, day, openedAt, toIsoDate(date)],
          );
        }
        return json(200, { ok: true, openedDays: days });
      }
      default:
        return json(404, { error: 'unknown demo route' });
    }
  }

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith(DEMO_MEDIA_PREFIX)) {
      return serve(request, async (storagePath) => {
        const rows = await db.query<{ mime_type: string }>('select mime_type from advent.media where storage_path = $1', [storagePath]);
        return rows[0]?.mime_type ?? null;
      });
    }
    if (url.pathname.startsWith('/api/demo/')) return demoRoute(request);
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
    if (failNext) {
      failNext = false;
      return json(503, { error: { code: 'BACKEND_UNAVAILABLE', message: 'Simulierter Ausfall' } });
    }
    return handleApiRequest(request, () => deps, { clientIp: '127.0.0.1' });
  }

  return { handle, close: () => client.close() };
}
