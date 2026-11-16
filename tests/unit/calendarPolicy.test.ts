import { describe, expect, it } from 'vitest';
import {
  calendarDateAt,
  calendarPhase,
  deriveDoorState,
  evaluateFirstOpening,
  nextTransitionAt,
  type PolicyCalendar,
} from '../../src/lib/calendarPolicy.ts';
import type { LocalDate } from '../../src/lib/time.ts';

const cal: PolicyCalendar = { year: 2026, policy: 'STRICT_DATE' };
const d = (iso: string): LocalDate => calendarDateAt(new Date(iso));
const decide = (day: number, at: string, openedToday: number | null = null) =>
  evaluateFirstOpening({ calendar: cal, day, today: d(at), dayAlreadyOpenedToday: openedToday });

describe('STRICT_DATE opening policy', () => {
  it('denies everything before 01.12.2026 (Zurich)', () => {
    expect(decide(1, '2026-11-30T22:59:59.999Z')).toEqual({ allowed: false, reason: 'DOOR_LOCKED' });
    expect(calendarPhase(cal, d('2026-11-30T22:59:59Z'))).toBe('before');
  });

  it('keeps door 1 closed from 00:00 until 00:01 on 01.12.2026 (Zurich)', () => {
    expect(decide(1, '2026-11-30T23:00:00Z')).toEqual({ allowed: false, reason: 'DOOR_LOCKED' });
    expect(decide(1, '2026-11-30T23:00:59.999Z')).toEqual({ allowed: false, reason: 'DOOR_LOCKED' });
  });

  it('allows door 1 exactly at 00:01 on 01.12.2026 in Zurich', () => {
    expect(decide(1, '2026-11-30T23:01:00Z')).toEqual({ allowed: true });
  });

  it('keeps the previous door available until 00:01', () => {
    expect(decide(4, '2026-12-04T23:00:30Z')).toEqual({ allowed: true });
    expect(decide(5, '2026-12-04T23:00:30Z')).toEqual({ allowed: false, reason: 'DOOR_LOCKED' });
    expect(decide(24, '2026-12-24T23:00:30Z')).toEqual({ allowed: true });
  });

  it('uses Zurich midnight even when UTC is still on the previous date', () => {
    expect(decide(5, '2026-12-04T23:30:00Z')).toEqual({ allowed: true });
    expect(decide(4, '2026-12-04T23:30:00Z')).toEqual({ allowed: false, reason: 'DOOR_MISSED' });
  });

  it('allows only the door of the day; future locked, past missed', () => {
    expect(decide(5, '2026-12-05T10:00:00Z')).toEqual({ allowed: true });
    expect(decide(6, '2026-12-05T10:00:00Z')).toEqual({ allowed: false, reason: 'DOOR_LOCKED' });
    expect(decide(24, '2026-12-05T10:00:00Z')).toEqual({ allowed: false, reason: 'DOOR_LOCKED' });
    expect(decide(4, '2026-12-05T10:00:00Z')).toEqual({ allowed: false, reason: 'DOOR_MISSED' });
  });

  it('enforces one new door per date', () => {
    expect(decide(5, '2026-12-05T10:00:00Z', 5)).toEqual({ allowed: false, reason: 'DAILY_LIMIT_REACHED' });
  });

  it('handles 24 and 25 December', () => {
    expect(decide(24, '2026-12-24T07:00:00Z')).toEqual({ allowed: true });
    expect(decide(24, '2026-12-25T07:00:00Z')).toEqual({ allowed: false, reason: 'DOOR_MISSED' });
    expect(calendarPhase(cal, d('2026-12-25T07:00:00Z'))).toBe('after');
  });

  it('does not restart in another year', () => {
    expect(decide(1, '2027-11-30T23:00:00Z')).toEqual({ allowed: false, reason: 'DOOR_MISSED' });
    expect(decide(5, '2025-12-05T10:00:00Z')).toEqual({ allowed: false, reason: 'DOOR_LOCKED' });
  });

  it('rejects invalid day numbers', () => {
    for (const day of [0, 25, -1, 1.5, Number.NaN]) {
      expect(decide(day, '2026-12-05T10:00:00Z')).toEqual({ allowed: false, reason: 'INVALID_DAY' });
    }
  });

  it('derives presentation states, keeping opened doors opened forever', () => {
    const state = (day: number, at: string, opened: number[] = []) =>
      deriveDoorState({ calendar: cal, day, today: d(at), openedDays: new Set(opened), dayOpenedToday: null });
    expect(state(4, '2027-06-01T10:00:00Z', [4])).toBe('opened');
    expect(state(4, '2027-06-01T10:00:00Z')).toBe('missed');
    expect(state(9, '2026-12-05T10:00:00Z')).toBe('locked');
    expect(state(5, '2026-12-05T10:00:00Z')).toBe('available');
  });

  it('schedules the next transition at the next 00:01 Zurich time, none after the calendar', () => {
    expect(nextTransitionAt(cal, new Date('2026-12-05T10:00:00Z'))?.toISOString()).toBe('2026-12-05T23:01:00.000Z');
    expect(nextTransitionAt(cal, new Date('2026-12-24T10:00:00Z'))?.toISOString()).toBe('2026-12-24T23:01:00.000Z');
    expect(nextTransitionAt(cal, new Date('2026-12-25T10:00:00Z'))).toBeNull();
  });
});
