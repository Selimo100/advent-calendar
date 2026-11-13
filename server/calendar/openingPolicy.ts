/**
 * THE calendar opening policy.
 *
 * This module is the single place that decides whether a door may be opened
 * for the first time, and which state each door is presented in. Every first
 * opening goes through `evaluateFirstOpening`, which is called inside the
 * database transaction in `calendarService.openDoor` using the database's own
 * clock. No other code path grants a first opening.
 *
 * Policy: STRICT_DATE (the only policy implemented)
 *   - Door N can be opened for the first time only on N December of the
 *     calendar's configured year, as observed in Europe/Zurich.
 *   - At most one distinct new door per recipient per calendar date.
 *   - Already-opened doors stay readable forever (including after December).
 *   - Missed doors stay closed. Future doors never reveal anything.
 *
 * Adding a catch-up policy later (deliberately):
 *   1. Add a new member to `OpeningPolicyName` and to the CHECK constraint on
 *      `advent.calendars.opening_policy` in a new SQL migration.
 *   2. Add a branch to `evaluateFirstOpening` and `deriveDoorState` below.
 *      For example "CATCH_UP_ONE_PER_DAY": a missed door may be opened on a
 *      later date, still limited to one new door per day.
 *   3. Add tests to tests/unit/openingPolicy.test.ts and tests/db/opening.test.ts.
 *   4. Switch the calendar row explicitly:
 *      update advent.calendars set opening_policy = '...' where id = '...';
 *   Do not add unlock flags, query parameters or admin shortcuts elsewhere.
 */
import {
  ADVENT_FIRST_DAY,
  ADVENT_LAST_DAY,
  addDays,
  compareLocalDates,
  decemberDate,
  isValidDoorDay,
  zurichLocalDate,
  zurichStartOfDay,
  type LocalDate,
} from '../../shared/calendar/time.ts';

export type OpeningPolicyName = 'STRICT_DATE';
export const DEFAULT_OPENING_POLICY: OpeningPolicyName = 'STRICT_DATE';

export type CalendarPhase = 'before' | 'advent' | 'after';

/** Derived, policy-level door state (before content readiness is considered). */
export type PolicyDoorState = 'locked' | 'available' | 'opened' | 'missed';

export type FirstOpeningDenial = 'INVALID_DAY' | 'DOOR_LOCKED' | 'DOOR_MISSED' | 'DAILY_LIMIT_REACHED';

export type FirstOpeningDecision =
  | { allowed: true }
  | { allowed: false; reason: FirstOpeningDenial };

export interface PolicyCalendar {
  year: number;
  policy: OpeningPolicyName;
}

export function calendarPhase(calendar: PolicyCalendar, today: LocalDate): CalendarPhase {
  if (compareLocalDates(today, decemberDate(calendar.year, ADVENT_FIRST_DAY)) < 0) return 'before';
  if (compareLocalDates(today, decemberDate(calendar.year, ADVENT_LAST_DAY)) > 0) return 'after';
  return 'advent';
}

/** The door whose date is today, if any. */
export function doorDayForDate(calendar: PolicyCalendar, today: LocalDate): number | null {
  return calendarPhase(calendar, today) === 'advent' ? today.day : null;
}

/**
 * Decide whether `day` may be opened for the first time on `today`.
 * `dayAlreadyOpenedToday` is the door (if any) this recipient first-opened on
 * the same calendar date. The caller must have established that `day` itself
 * is not yet opened.
 */
export function evaluateFirstOpening(input: {
  calendar: PolicyCalendar;
  day: number;
  today: LocalDate;
  dayAlreadyOpenedToday: number | null;
}): FirstOpeningDecision {
  const { calendar, day, today, dayAlreadyOpenedToday } = input;
  if (!isValidDoorDay(day)) return { allowed: false, reason: 'INVALID_DAY' };

  switch (calendar.policy) {
    case 'STRICT_DATE': {
      const order = compareLocalDates(today, decemberDate(calendar.year, day));
      if (order < 0) return { allowed: false, reason: 'DOOR_LOCKED' };
      if (order > 0) return { allowed: false, reason: 'DOOR_MISSED' };
      if (dayAlreadyOpenedToday !== null) return { allowed: false, reason: 'DAILY_LIMIT_REACHED' };
      return { allowed: true };
    }
    default: {
      const unknownPolicy: never = calendar.policy;
      throw new Error(`Unknown opening policy: ${String(unknownPolicy)}`);
    }
  }
}

/** Presentation state for one door. Never grants access by itself. */
export function deriveDoorState(input: {
  calendar: PolicyCalendar;
  day: number;
  today: LocalDate;
  openedDays: ReadonlySet<number>;
  dayOpenedToday: number | null;
}): PolicyDoorState {
  if (input.openedDays.has(input.day)) return 'opened';
  const decision = evaluateFirstOpening({
    calendar: input.calendar,
    day: input.day,
    today: input.today,
    dayAlreadyOpenedToday: input.dayOpenedToday,
  });
  if (decision.allowed) return 'available';
  return decision.reason === 'DOOR_MISSED' ? 'missed' : 'locked';
}

/**
 * The next instant at which any door state can change on its own (the next
 * Zurich midnight up to and including 25 December). Null once the calendar is
 * over. Clients use it only to schedule a refresh, never to unlock anything.
 */
export function nextTransitionAt(calendar: PolicyCalendar, now: Date): Date | null {
  const today = zurichLocalDate(now);
  if (calendarPhase(calendar, today) === 'after') return null;
  return zurichStartOfDay(addDays(today, 1));
}

export function calendarStartsAt(calendar: PolicyCalendar): Date {
  return zurichStartOfDay(decemberDate(calendar.year, ADVENT_FIRST_DAY));
}

export const ALL_DOOR_DAYS: readonly number[] = Array.from(
  { length: ADVENT_LAST_DAY - ADVENT_FIRST_DAY + 1 },
  (_, i) => ADVENT_FIRST_DAY + i,
);
