import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { passwordHash, sha256Hex } from '../../src/lib/sha256.ts';
import { calendarDateAt, calendarDayStartsAt } from '../../src/lib/calendarPolicy.ts';
import { toIsoDate } from '../../src/lib/time.ts';

const nodeSha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');

describe('sha256Hex', () => {
  it('matches node:crypto for short, multi-block and non-ASCII input', () => {
    for (const text of ['', 'abc', 'Schneeflocke', 'ä'.repeat(40), 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(1000)]) {
      expect(sha256Hex(text)).toBe(nodeSha(text));
    }
  });

  it('salts the password hash', () => {
    expect(passwordHash('a', 'geheim')).toBe(nodeSha('a:geheim'));
    expect(passwordHash('a', 'geheim')).not.toBe(passwordHash('b', 'geheim'));
  });
});

describe('calendar day starts at 00:01 Zurich time', () => {
  it('still counts 00:00–00:01 as the previous day', () => {
    expect(toIsoDate(calendarDateAt(new Date('2026-12-05T23:00:00Z')))).toBe('2026-12-05');
    expect(toIsoDate(calendarDateAt(new Date('2026-12-05T23:00:59Z')))).toBe('2026-12-05');
    expect(toIsoDate(calendarDateAt(new Date('2026-12-05T23:01:00Z')))).toBe('2026-12-06');
  });

  it('starts each day at 00:01', () => {
    expect(calendarDayStartsAt({ year: 2026, month: 12, day: 6 }).toISOString()).toBe('2026-12-05T23:01:00.000Z');
  });
});
