/**
 * Calendar-date helpers. The calendar always runs in Europe/Zurich.
 *
 * These helpers are pure: they never read a clock themselves. Callers pass an
 * instant in (normally the device clock via lib/clock.ts), so the same code
 * is easy to test and the dev panel can simulate any date.
 */

export const CALENDAR_TIME_ZONE = 'Europe/Zurich';

export const ADVENT_FIRST_DAY = 1;
export const ADVENT_LAST_DAY = 24;
export const ADVENT_DAYS = ADVENT_LAST_DAY - ADVENT_FIRST_DAY + 1;

/** A civil (wall-calendar) date without a time or zone. */
export interface LocalDate {
  readonly year: number;
  readonly month: number; // 1-12
  readonly day: number; // 1-31
}

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CALENDAR_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface ZonedParts extends LocalDate {
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(instant: Date): ZonedParts {
  if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid instant');
  const parts: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
    second: parts.second!,
  };
}

/** The civil date in Europe/Zurich at the given instant. */
export function zurichLocalDate(instant: Date): LocalDate {
  const { year, month, day } = zonedParts(instant);
  return { year, month, day };
}

/** Offset of Europe/Zurich from UTC at the given instant, in milliseconds. */
function zurichOffsetMs(instant: Date): number {
  const p = zonedParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/** The instant at which the given civil date begins (00:00) in Europe/Zurich. */
export function zurichStartOfDay(date: LocalDate): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day);
  let result = guess - zurichOffsetMs(new Date(guess));
  // Re-check once in case the offset differs at the corrected instant (DST edges).
  result = guess - zurichOffsetMs(new Date(result));
  return new Date(result);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

export function sameLocalDate(a: LocalDate, b: LocalDate): boolean {
  return compareLocalDates(a, b) === 0;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Whole civil days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = Date.UTC(from.year, from.month - 1, from.day);
  const b = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((b - a) / 86_400_000);
}

export function decemberDate(year: number, day: number): LocalDate {
  return { year, month: 12, day };
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** ISO calendar date, e.g. 2026-12-05 (used on the wire and in the database). */
export function toIsoDate(date: LocalDate): string {
  return `${pad(date.year, 4)}-${pad(date.month)}-${pad(date.day)}`;
}

export function parseIsoDate(value: string): LocalDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  if (check.getUTCMonth() + 1 !== date.month || check.getUTCDate() !== date.day) return null;
  return date;
}

/** German display format DD.MM.YYYY. */
export function formatGermanDate(date: LocalDate): string {
  return `${pad(date.day)}.${pad(date.month)}.${pad(date.year, 4)}`;
}

export function isValidDoorDay(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= ADVENT_FIRST_DAY &&
    value <= ADVENT_LAST_DAY
  );
}
