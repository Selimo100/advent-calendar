/**
 * Calendar use cases. Every function takes the recipient id from a verified
 * session (never from the client) and the calendar id from server config.
 */
import type { CalendarOverview, DoorContent, DoorSummary, OpenDoorResult } from '../../shared/api.ts';
import { isValidDoorDay, toIsoDate, zurichLocalDate, decemberDate } from '../../shared/calendar/time.ts';
import {
  calendarSettings,
  storedDoor,
  type CalendarSettings,
  type DeliveredBlock,
  type StoredBlock,
  type StoredDoor,
} from '../../shared/content/schema.ts';
import type { Db } from '../db/types.ts';
import { ApiError } from '../http/responses.ts';
import { SIGNED_URL_TTL_SECONDS, type MediaStorage } from '../storage/types.ts';
import type { Clock } from './clock.ts';
import {
  ALL_DOOR_DAYS,
  calendarPhase,
  calendarStartsAt,
  deriveDoorState,
  doorDayForDate,
  evaluateFirstOpening,
  nextTransitionAt,
  type OpeningPolicyName,
} from './openingPolicy.ts';

interface CalendarRow {
  id: string;
  recipientId: string;
  year: number;
  policy: OpeningPolicyName;
  settings: CalendarSettings;
}

interface OpeningRow {
  day: number;
  opened_at: Date;
  local_date: string;
}

interface MediaRow {
  id: string;
  media_key: string;
  mime_type: string;
  width: number | null;
  height: number | null;
}

async function loadCalendar(db: Db, calendarId: string, recipientId: string): Promise<CalendarRow> {
  const rows = await db.query<{
    id: string;
    recipient_id: string;
    year: number;
    opening_policy: OpeningPolicyName;
    settings: unknown;
  }>('select id, recipient_id, year, opening_policy, settings from advent.calendars where id = $1', [calendarId]);
  const row = rows[0];
  if (!row) throw new ApiError(503, 'CALENDAR_NOT_CONFIGURED');
  // A session always belongs to the calendar's recipient; anything else is treated as signed out.
  if (row.recipient_id !== recipientId) throw new ApiError(401, 'UNAUTHENTICATED');
  const settings = calendarSettings.safeParse(row.settings);
  if (!settings.success) throw new ApiError(503, 'CALENDAR_NOT_CONFIGURED');
  return {
    id: row.id,
    recipientId: row.recipient_id,
    year: Number(row.year),
    policy: row.opening_policy,
    settings: settings.data,
  };
}

/** Recipient id for a calendar (used at login). */
export async function calendarRecipientId(db: Db, calendarId: string): Promise<string> {
  const rows = await db.query<{ recipient_id: string }>(
    'select recipient_id from advent.calendars where id = $1',
    [calendarId],
  );
  if (!rows[0]) throw new ApiError(503, 'CALENDAR_NOT_CONFIGURED');
  return rows[0].recipient_id;
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function getOverview(
  db: Db,
  clock: Clock,
  calendarId: string,
  recipientId: string,
): Promise<CalendarOverview> {
  const now = await clock.now(db);
  const calendar = await loadCalendar(db, calendarId, recipientId);
  const [openings, doors] = await Promise.all([
    db.query<OpeningRow>(
      `select day, opened_at, local_date::text as local_date
         from advent.openings where recipient_id = $1 and calendar_id = $2`,
      [recipientId, calendarId],
    ),
    db.query<{ day: number; publishable: boolean; title: string | null }>(
      `select day, publishable, content->>'title' as title from advent.doors where calendar_id = $1`,
      [calendarId],
    ),
  ]);

  const today = zurichLocalDate(now);
  const todayIso = toIsoDate(today);
  const openedByDay = new Map(openings.map((o) => [Number(o.day), o]));
  const doorByDay = new Map(doors.map((d) => [Number(d.day), d]));
  const dayOpenedToday = openings.find((o) => o.local_date === todayIso)?.day ?? null;
  const policyCalendar = { year: calendar.year, policy: calendar.policy };

  const summaries: DoorSummary[] = ALL_DOOR_DAYS.map((day) => {
    const state = deriveDoorState({
      calendar: policyCalendar,
      day,
      today,
      openedDays: new Set(openedByDay.keys()),
      dayOpenedToday: dayOpenedToday === null ? null : Number(dayOpenedToday),
    });
    if (state === 'opened') {
      const opening = openedByDay.get(day)!;
      return {
        day,
        state,
        openedAt: new Date(opening.opened_at).toISOString(),
        title: doorByDay.get(day)?.title ?? `Türchen ${day}`,
      };
    }
    if (state === 'available' && !doorByDay.get(day)?.publishable) return { day, state: 'not_ready' };
    return { day, state };
  });

  return {
    calendar: { id: calendar.id, year: calendar.year, policy: calendar.policy, settings: calendar.settings },
    serverTime: now.toISOString(),
    today: todayIso,
    phase: calendarPhase(policyCalendar, today),
    todayDoor: doorDayForDate(policyCalendar, today),
    startsAt: calendarStartsAt(policyCalendar).toISOString(),
    nextTransitionAt: nextTransitionAt(policyCalendar, now)?.toISOString() ?? null,
    doors: summaries,
    progress: { opened: openings.length, total: ALL_DOOR_DAYS.length },
  };
}

// ---------------------------------------------------------------------------
// Opening (atomic)
// ---------------------------------------------------------------------------

/**
 * First-opens a door, or safely returns the existing opening on retry.
 *
 * Runs in one transaction:
 *  1. take the authoritative time from the clock (the DB clock in production)
 *  2. lock the recipient row, serialising all openings of this recipient
 *  3. return the existing opening if the door is already open (idempotent)
 *  4. ask the opening policy whether a first opening is allowed right now
 *  5. require publishable content
 *  6. insert, guarded by the unique constraints on (recipient, calendar, day)
 *     and (recipient, calendar, local_date)
 */
export async function openDoor(
  db: Db,
  clock: Clock,
  calendarId: string,
  recipientId: string,
  day: number,
): Promise<OpenDoorResult> {
  if (!isValidDoorDay(day)) throw new ApiError(400, 'INVALID_REQUEST');

  const firstOpen = await db.transaction(async (tx) => {
    const now = await clock.now(tx);
    const calendar = await loadCalendar(tx, calendarId, recipientId);
    await tx.query('select id from advent.recipients where id = $1 for update', [recipientId]);

    const existing = await tx.query(
      'select 1 from advent.openings where recipient_id = $1 and calendar_id = $2 and day = $3',
      [recipientId, calendarId, day],
    );
    if (existing.length > 0) return false;

    const today = zurichLocalDate(now);
    const todayRows = await tx.query<{ day: number }>(
      `select day from advent.openings
        where recipient_id = $1 and calendar_id = $2 and local_date = $3::date`,
      [recipientId, calendarId, toIsoDate(today)],
    );
    const decision = evaluateFirstOpening({
      calendar: { year: calendar.year, policy: calendar.policy },
      day,
      today,
      dayAlreadyOpenedToday: todayRows[0] ? Number(todayRows[0].day) : null,
    });
    if (!decision.allowed) {
      throw new ApiError(decision.reason === 'INVALID_DAY' ? 400 : 403, decision.reason === 'INVALID_DAY' ? 'INVALID_REQUEST' : decision.reason);
    }

    const door = await loadDeliverableDoor(tx, calendarId, day);
    if (!door) throw new ApiError(409, 'CONTENT_NOT_READY');

    const inserted = await tx.query(
      `insert into advent.openings (recipient_id, calendar_id, day, opened_at, local_date)
       values ($1, $2, $3, $4, $5::date)
       on conflict do nothing
       returning id`,
      [recipientId, calendarId, day, now, toIsoDate(today)],
    );
    if (inserted.length === 1) return true;

    // A concurrent request won the race (only possible without the row lock).
    const raced = await tx.query(
      'select 1 from advent.openings where recipient_id = $1 and calendar_id = $2 and day = $3',
      [recipientId, calendarId, day],
    );
    if (raced.length > 0) return false;
    throw new ApiError(403, 'DAILY_LIMIT_REACHED');
  });

  const door = await getDoorContent(db, calendarId, recipientId, day);
  return { door, firstOpen };
}

// ---------------------------------------------------------------------------
// Reading content (requires an existing opening; never opens anything)
// ---------------------------------------------------------------------------

async function loadDeliverableDoor(
  db: Db,
  calendarId: string,
  day: number,
): Promise<{ door: StoredDoor; media: Map<string, MediaRow> } | null> {
  const rows = await db.query<{ content: unknown; publishable: boolean }>(
    'select content, publishable from advent.doors where calendar_id = $1 and day = $2',
    [calendarId, day],
  );
  const row = rows[0];
  if (!row || !row.publishable) return null;
  const parsed = storedDoor.safeParse(row.content);
  if (!parsed.success || parsed.data.day !== day) return null;
  const media = await db.query<MediaRow>(
    `select id, media_key, mime_type, width, height from advent.media where calendar_id = $1 and day = $2`,
    [calendarId, day],
  );
  const byKey = new Map(media.map((m) => [m.media_key, m]));
  // Every referenced media object must exist, otherwise the door is not deliverable.
  for (const key of referencedMediaKeys(parsed.data.blocks)) {
    if (!byKey.has(key)) return null;
  }
  return { door: parsed.data, media: byKey };
}

export function referencedMediaKeys(blocks: StoredBlock[]): string[] {
  const keys: string[] = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') {
      const media = (value as { media?: unknown }).media;
      if (typeof media === 'string') keys.push(media);
      Object.values(value).forEach(visit);
    }
  };
  visit(blocks);
  return keys;
}

function deliverMedia(value: unknown, media: Map<string, MediaRow>): unknown {
  if (Array.isArray(value)) return value.map((v) => deliverMedia(v, media));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (typeof record.media === 'string') {
    const row = media.get(record.media)!;
    const src = `/api/media/${row.id}`;
    if (row.mime_type.startsWith('audio/')) return { mediaId: row.id, src, mimeType: row.mime_type };
    const { media: _key, ...rest } = record;
    return { ...rest, mediaId: row.id, src, width: row.width ?? 4, height: row.height ?? 3 };
  }
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, deliverMedia(v, media)]));
}

export async function getDoorContent(
  db: Db,
  calendarId: string,
  recipientId: string,
  day: number,
): Promise<DoorContent> {
  if (!isValidDoorDay(day)) throw new ApiError(400, 'INVALID_REQUEST');
  const calendar = await loadCalendar(db, calendarId, recipientId);
  const openings = await db.query<OpeningRow>(
    `select day, opened_at, local_date::text as local_date from advent.openings
      where recipient_id = $1 and calendar_id = $2 and day = $3`,
    [recipientId, calendarId, day],
  );
  const opening = openings[0];
  if (!opening) throw new ApiError(403, 'DOOR_NOT_OPENED');

  const deliverable = await loadDeliverableDoor(db, calendarId, day);
  if (!deliverable) throw new ApiError(409, 'CONTENT_NOT_READY');
  const blocks = deliverMedia(deliverable.door.blocks, deliverable.media) as DeliveredBlock[];
  return {
    day,
    title: deliverable.door.title,
    date: toIsoDate(decemberDate(calendar.year, day)),
    openedAt: new Date(opening.opened_at).toISOString(),
    layout: blocks.some((b) => b.type === 'finalLetter') ? 'final' : 'standard',
    blocks,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Signed URL for media that belongs to an opened door of this recipient. */
export async function getMediaUrl(
  db: Db,
  storage: MediaStorage,
  calendarId: string,
  recipientId: string,
  mediaId: string,
): Promise<string> {
  if (!UUID_RE.test(mediaId)) throw new ApiError(404, 'MEDIA_NOT_FOUND');
  await loadCalendar(db, calendarId, recipientId);
  const rows = await db.query<{ storage_path: string }>(
    `select m.storage_path
       from advent.media m
       join advent.openings o
         on o.calendar_id = m.calendar_id and o.day = m.day and o.recipient_id = $3
       join advent.doors d
         on d.calendar_id = m.calendar_id and d.day = m.day and d.publishable
      where m.id = $1 and m.calendar_id = $2`,
    [mediaId, calendarId, recipientId],
  );
  // Same response for "does not exist" and "not yet allowed".
  if (!rows[0]) throw new ApiError(404, 'MEDIA_NOT_FOUND');
  return storage.createSignedUrl(rows[0].storage_path, SIGNED_URL_TTL_SECONDS);
}
