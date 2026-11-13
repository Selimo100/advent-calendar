import { describe, expect, it } from 'vitest';
import { addDays, formatGermanDate, parseIsoDate, toIsoDate, zurichLocalDate, zurichStartOfDay } from '../../shared/calendar/time.ts';

describe('Europe/Zurich calendar dates', () => {
  it('uses the Zurich date when UTC is still on the previous day', () => {
    expect(toIsoDate(zurichLocalDate(new Date('2026-12-04T22:59:59Z')))).toBe('2026-12-04');
    expect(toIsoDate(zurichLocalDate(new Date('2026-12-04T23:00:00Z')))).toBe('2026-12-05');
  });

  it('finds the start of a Zurich day in winter (UTC+1)', () => {
    expect(zurichStartOfDay({ year: 2026, month: 12, day: 1 }).toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });

  it('handles daylight saving time correctly', () => {
    expect(zurichStartOfDay({ year: 2026, month: 7, day: 1 }).toISOString()).toBe('2026-06-30T22:00:00.000Z');
    // DST starts 29.03.2026, ends 25.10.2026
    expect(zurichStartOfDay({ year: 2026, month: 3, day: 29 }).toISOString()).toBe('2026-03-28T23:00:00.000Z');
    expect(zurichStartOfDay({ year: 2026, month: 10, day: 26 }).toISOString()).toBe('2026-10-25T23:00:00.000Z');
  });

  it('formats German dates and parses ISO dates strictly', () => {
    expect(formatGermanDate({ year: 2026, month: 12, day: 5 })).toBe('05.12.2026');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-12-24')).toEqual({ year: 2026, month: 12, day: 24 });
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
  });
});
