/**
 * Idempotent content import, keyed by (calendar id, door day).
 *
 * - Validates all 24 doors first; nothing is written if validation fails.
 * - Uploads media to private storage at content-addressed paths.
 * - Upserts recipient, calendar, doors and media rows in one transaction.
 * - Never touches opening history or sessions.
 * - Never deletes anything unless `prune` is set explicitly.
 */
import path from 'node:path';
import type { Db } from '../../server/db/types.ts';
import type { MediaStorageWriter } from '../../server/storage/types.ts';
import { storedDoor, type AuthoringCalendar, type AuthoringDoor, type StoredDoor } from '../../shared/content/schema.ts';
import { prepareMediaFile, sha256, type PreparedMedia } from './media.ts';
import { mediaReferences, validateCalendar, type ValidationReport } from './readiness.ts';

export interface ImportOptions {
  /** Mark doors with placeholders as publishable (fictional preview/demo content only). */
  allowPlaceholders: boolean;
  /** Delete media that is no longer referenced (rows and storage objects). */
  prune: boolean;
}

interface PreparedMediaItem extends PreparedMedia {
  key: string;
  day: number;
  storagePath: string;
}

export interface PreparedImport {
  calendar: AuthoringCalendar;
  report: ValidationReport;
  doors: { day: number; stored: StoredDoor; hash: string; publishable: boolean }[];
  media: PreparedMediaItem[];
}

export type Action = 'create' | 'update' | 'unchanged';

export interface ImportPlan {
  calendar: Action;
  doors: { day: number; action: Action; publishable: boolean; alreadyOpened: boolean }[];
  uploads: { day: number; key: string; bytes: number; action: 'upload' | 'unchanged' }[];
  prunable: { id: string; day: number; storagePath: string }[];
  replacedObjects: string[];
}

export function mediaKeyFor(calendarId: string, day: number, file: string): string {
  return sha256(`${calendarId}:${day}:${file}`).slice(0, 32);
}

function toStoredDoor(door: AuthoringDoor, calendarId: string): StoredDoor {
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    if (typeof record.file === 'string') {
      const { file, ...rest } = record;
      return { ...rest, media: mediaKeyFor(calendarId, door.day, file as string) };
    }
    return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, convert(v)]));
  };
  return storedDoor.parse(convert(door));
}

export async function prepareImport(raw: unknown, mediaDir: string, options: ImportOptions): Promise<PreparedImport> {
  const report = validateCalendar(raw, mediaDir);
  if (!report.valid || !report.calendar) {
    throw new Error(`Content is invalid:\n${report.errors.join('\n')}`);
  }
  const calendar = report.calendar;
  const media: PreparedMediaItem[] = [];
  const doors: PreparedImport['doors'] = [];
  for (const door of calendar.doors) {
    const readiness = report.doors.find((d) => d.day === door.day)!;
    const missingMedia = readiness.problems.some((p) => p.startsWith('missing media') || p.startsWith('unsupported') || p.includes('escapes') || p.includes('too large'));
    const publishable = !missingMedia && (readiness.ready || options.allowPlaceholders);
    if (!missingMedia) {
      const seen = new Set<string>();
      for (const ref of mediaReferences(door)) {
        const key = mediaKeyFor(calendar.calendarId, door.day, ref.file);
        if (seen.has(key)) continue;
        seen.add(key);
        const prepared = await prepareMediaFile(path.resolve(mediaDir, ref.file), ref.kind);
        const storagePath = `${calendar.calendarId}/${String(door.day).padStart(2, '0')}/${sha256(prepared.bytes).slice(0, 32)}.${prepared.extension}`;
        media.push({ ...prepared, key, day: door.day, storagePath });
      }
    }
    const stored = toStoredDoor(door, calendar.calendarId);
    doors.push({ day: door.day, stored, hash: sha256(JSON.stringify(stored)), publishable });
  }
  // Settings with placeholders are only acceptable for fictional content.
  if (report.settingsProblems.some((p) => p.startsWith('placeholder')) && !options.allowPlaceholders) {
    throw new Error('Calendar settings still contain placeholders (e.g. [NAME]). Personalise them first.');
  }
  return { calendar, report, doors: doors.sort((a, b) => a.day - b.day), media };
}

export async function planImport(db: Db, prepared: PreparedImport): Promise<ImportPlan> {
  const { calendar } = prepared;
  const calendarRows = await db.query<{ year: number; slug: string; settings: unknown }>(
    `select c.year, r.slug, c.settings from advent.calendars c join advent.recipients r on r.id = c.recipient_id where c.id = $1`,
    [calendar.calendarId],
  );
  const existingCalendar = calendarRows[0];
  if (existingCalendar && Number(existingCalendar.year) !== calendar.year) {
    throw new Error(
      `Calendar "${calendar.calendarId}" already exists for year ${existingCalendar.year}. ` +
        `Use a new calendarId (e.g. advent-${calendar.year}) instead of changing the year.`,
    );
  }
  if (existingCalendar && existingCalendar.slug !== calendar.recipientSlug) {
    throw new Error(`Calendar "${calendar.calendarId}" belongs to another recipient slug; refusing to change it.`);
  }

  const doorRows = await db.query<{ day: number; content_hash: string; publishable: boolean }>(
    'select day, content_hash, publishable from advent.doors where calendar_id = $1',
    [calendar.calendarId],
  );
  const openedRows = await db.query<{ day: number }>('select distinct day from advent.openings where calendar_id = $1', [
    calendar.calendarId,
  ]);
  const mediaRows = await db.query<{ id: string; day: number; media_key: string; source_hash: string; storage_path: string }>(
    'select id, day, media_key, source_hash, storage_path from advent.media where calendar_id = $1',
    [calendar.calendarId],
  );
  const doorByDay = new Map(doorRows.map((d) => [Number(d.day), d]));
  const opened = new Set(openedRows.map((r) => Number(r.day)));
  const mediaByKey = new Map(mediaRows.map((m) => [m.media_key, m]));
  const wantedKeys = new Set(prepared.media.map((m) => m.key));

  return {
    calendar: !existingCalendar
      ? 'create'
      : JSON.stringify(existingCalendar.settings) === JSON.stringify(calendar.settings)
        ? 'unchanged'
        : 'update',
    doors: prepared.doors.map((d) => {
      const existing = doorByDay.get(d.day);
      const action: Action = !existing
        ? 'create'
        : existing.content_hash === d.hash && existing.publishable === d.publishable
          ? 'unchanged'
          : 'update';
      return { day: d.day, action, publishable: d.publishable, alreadyOpened: opened.has(d.day) };
    }),
    uploads: prepared.media.map((m) => ({
      day: m.day,
      key: m.key,
      bytes: m.bytes.byteLength,
      action: mediaByKey.get(m.key)?.storage_path === m.storagePath ? 'unchanged' : 'upload',
    })),
    prunable: mediaRows
      .filter((m) => !wantedKeys.has(m.media_key))
      .map((m) => ({ id: m.id, day: Number(m.day), storagePath: m.storage_path })),
    replacedObjects: prepared.media
      .map((m) => mediaByKey.get(m.key))
      .filter((row, i): row is NonNullable<typeof row> => !!row && row.storage_path !== prepared.media[i]!.storagePath)
      .map((row) => row.storage_path),
  };
}

export async function applyImport(
  db: Db,
  storage: MediaStorageWriter,
  prepared: PreparedImport,
  plan: ImportPlan,
  options: ImportOptions,
): Promise<void> {
  const { calendar } = prepared;

  // 1. Upload new media first (content-addressed, safe to repeat).
  for (const item of prepared.media) {
    const planned = plan.uploads.find((u) => u.key === item.key);
    if (planned?.action === 'unchanged' && (await storage.exists(item.storagePath))) continue;
    await storage.upload(item.storagePath, item.bytes, item.mimeType);
  }

  // 2. Write database rows atomically.
  await db.transaction(async (tx) => {
    const recipient = await tx.query<{ id: string }>(
      `insert into advent.recipients (slug) values ($1)
       on conflict (slug) do update set slug = excluded.slug
       returning id`,
      [calendar.recipientSlug],
    );
    const recipientId = recipient[0]!.id;
    await tx.query(
      `insert into advent.calendars (id, recipient_id, year, settings)
       values ($1, $2, $3, $4::jsonb)
       on conflict (id) do update set settings = excluded.settings, updated_at = now()
       where advent.calendars.settings is distinct from excluded.settings`,
      [calendar.calendarId, recipientId, calendar.year, calendar.settings],
    );
    for (const door of prepared.doors) {
      await tx.query(
        `insert into advent.doors (calendar_id, day, content, content_hash, publishable)
         values ($1, $2, $3::jsonb, $4, $5)
         on conflict (calendar_id, day) do update
           set content = excluded.content, content_hash = excluded.content_hash,
               publishable = excluded.publishable, updated_at = now()
         where advent.doors.content_hash is distinct from excluded.content_hash
            or advent.doors.publishable is distinct from excluded.publishable`,
        [calendar.calendarId, door.day, door.stored, door.hash, door.publishable],
      );
    }
    for (const item of prepared.media) {
      await tx.query(
        `insert into advent.media (calendar_id, day, media_key, storage_path, mime_type, byte_size, width, height, source_hash)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (calendar_id, media_key) do update
           set storage_path = excluded.storage_path, mime_type = excluded.mime_type,
               byte_size = excluded.byte_size, width = excluded.width, height = excluded.height,
               source_hash = excluded.source_hash`,
        [calendar.calendarId, item.day, item.key, item.storagePath, item.mimeType, item.bytes.byteLength, item.width, item.height, item.sourceHash],
      );
    }
    if (options.prune && plan.prunable.length) {
      await tx.query('delete from advent.media where id = any($1::uuid[])', [plan.prunable.map((p) => p.id)]);
    }
  });

  // 3. Remove storage objects only when explicitly requested.
  if (options.prune) {
    await storage.remove([...plan.prunable.map((p) => p.storagePath), ...plan.replacedObjects]);
  }
}

export function formatPlan(plan: ImportPlan, options: ImportOptions): string {
  const lines = [`Calendar settings: ${plan.calendar}`];
  for (const d of plan.doors) {
    const flags = [d.publishable ? 'publishable' : 'NOT publishable (needs personalisation)'];
    if (d.alreadyOpened && d.action === 'update') flags.push('already opened: the change is visible immediately');
    lines.push(`Day ${String(d.day).padStart(2)}: ${d.action.padEnd(9)} ${flags.join('; ')}`);
  }
  const uploads = plan.uploads.filter((u) => u.action === 'upload');
  lines.push(`Media: ${uploads.length} to upload, ${plan.uploads.length - uploads.length} unchanged`);
  for (const u of uploads) lines.push(`  upload day ${u.day} media ${u.key.slice(0, 8)}… (${Math.round(u.bytes / 1024)} KB)`);
  if (plan.prunable.length || plan.replacedObjects.length) {
    lines.push(
      options.prune
        ? `Prune: will delete ${plan.prunable.length} unreferenced media rows and ${plan.prunable.length + plan.replacedObjects.length} storage objects`
        : `Unreferenced media: ${plan.prunable.length} rows, ${plan.replacedObjects.length} replaced objects (kept; pass --prune to delete)`,
    );
  }
  lines.push('Opening history and sessions are never modified by the import.');
  return lines.join('\n');
}
