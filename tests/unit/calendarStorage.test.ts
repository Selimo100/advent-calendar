import { describe, expect, it, vi } from 'vitest';
import {
  createProgressStore,
  emptyProgress,
  mergeProgress,
  parseProgress,
  progressKey,
  type Progress,
} from '../../src/lib/calendarStorage.ts';

/** Minimal in-memory Storage, optionally failing on write. */
function memoryStorage(options: { failWrites?: boolean; initial?: Record<string, string> } = {}): Storage {
  const map = new Map(Object.entries(options.initial ?? {}));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => {
      if (options.failWrites) throw new DOMException('QuotaExceededError');
      map.set(key, value);
    },
  } as Storage;
}

const opened = (day: number, date: string) => ({ [String(day)]: { openedAt: `${date}T08:00:00.000Z`, date } });

describe('progress parsing', () => {
  it('returns empty progress for missing, corrupted and non-object data', () => {
    for (const raw of [null, '', 'not json', '[1,2,3]', '"text"', '42']) {
      expect(parseProgress(raw)).toEqual(emptyProgress());
    }
  });

  it('keeps valid fields and drops invalid ones', () => {
    const progress = parseProgress(
      JSON.stringify({
        version: 1,
        opened: {
          '5': { openedAt: '2026-12-05T08:00:00.000Z', date: '2026-12-05' },
          '6': { openedAt: 'not a date', date: '2026-12-06' },
          '7': { openedAt: '2026-12-07T08:00:00.000Z', date: '07.12.2026' },
          '99': { openedAt: '2026-12-05T08:00:00.000Z', date: '2026-12-05' },
          abc: { openedAt: '2026-12-05T08:00:00.000Z', date: '2026-12-05' },
        },
        game: { started: true, completed: 'yes', checkpoint: { id: 'cp1', rank: 1 }, failures: -3 },
        prefs: { assist: true, sound: 'loud' },
      }),
    );
    expect(Object.keys(progress.opened)).toEqual(['5']);
    expect(progress.game.started).toBe(true);
    // 'yes' is not true, so completion is not granted.
    expect(progress.game.completed).toBe(false);
    expect(progress.game.checkpoint).toEqual({ id: 'cp1', rank: 1 });
    expect(progress.game.failures).toBe(0);
    expect(progress.prefs).toEqual({ assist: true, sound: false });
  });

  it('falls back to defaults for an unknown schema version without crashing', () => {
    const progress = parseProgress(JSON.stringify({ version: 99, opened: opened(3, '2026-12-03'), game: 'gone' }));
    expect(progress.opened['3']).toBeDefined();
    expect(progress.game).toEqual(emptyProgress().game);
  });
});

describe('merging progress (multiple tabs)', () => {
  const base = (): Progress => emptyProgress();

  it('unions opened doors and keeps the earliest opening', () => {
    const a = { ...base(), opened: { ...opened(1, '2026-12-01'), ...opened(2, '2026-12-02') } };
    const b = {
      ...base(),
      opened: { ...opened(3, '2026-12-03'), '2': { openedAt: '2026-12-02T20:00:00.000Z', date: '2026-12-02' } },
    };
    const merged = mergeProgress(a, b);
    expect(Object.keys(merged.opened).sort()).toEqual(['1', '2', '3']);
    expect(merged.opened['2']!.openedAt).toBe('2026-12-02T08:00:00.000Z');
  });

  it('never loses game completion or a later checkpoint', () => {
    const won = { ...base(), game: { ...base().game, completed: true, completedAt: '2026-12-06T10:00:00.000Z', checkpoint: { id: 'cp2', rank: 2 } } };
    const stale = { ...base(), game: { ...base().game, checkpoint: { id: 'cp1', rank: 1 } } };
    expect(mergeProgress(won, stale).game.completed).toBe(true);
    expect(mergeProgress(stale, won).game.completed).toBe(true);
    expect(mergeProgress(won, stale).game.checkpoint).toEqual({ id: 'cp2', rank: 2 });
    expect(mergeProgress(stale, won).game.checkpoint).toEqual({ id: 'cp2', rank: 2 });
  });

  it('takes the newer preferences', () => {
    const before = { ...base(), prefs: { assist: false, sound: false } };
    const after = { ...base(), prefs: { assist: true, sound: true } };
    expect(mergeProgress(before, after).prefs).toEqual({ assist: true, sound: true });
  });
});

describe('progress store', () => {
  it('keys progress by calendar identity and year', () => {
    expect(progressKey('advent-2026', 2026)).not.toBe(progressKey('advent-2026', 2027));
    expect(progressKey('advent-2026', 2026)).not.toBe(progressKey('other-calendar', 2026));
  });

  it('separates calendars and years, so a second year starts fresh', () => {
    const storage = memoryStorage();
    const first = createProgressStore('advent-2026', 2026, storage);
    first.mutate((p) => ({ ...p, opened: opened(1, '2026-12-01') }));
    const second = createProgressStore('advent-2026', 2027, storage);
    expect(second.read().opened).toEqual({});
    expect(createProgressStore('advent-2026', 2026, storage).read().opened['1']).toBeDefined();
  });

  it('re-reads the latest stored value before applying a mutation', () => {
    const storage = memoryStorage();
    const store = createProgressStore('advent-2026', 2026, storage);
    store.mutate((p) => ({ ...p, opened: opened(1, '2026-12-01') }));
    // Another tab opens door 2 behind our back.
    const key = store.key;
    const other = parseProgress(storage.getItem(key));
    storage.setItem(key, JSON.stringify({ ...other, opened: { ...other.opened, ...opened(2, '2026-12-02') } }));
    // Our mutation starts from a stale snapshot but must not lose door 2.
    const result = store.mutate((latest) => ({ ...latest, opened: { ...latest.opened, ...opened(3, '2026-12-03') } }));
    expect(Object.keys(result.progress.opened).sort()).toEqual(['1', '2', '3']);
  });

  it('reports unavailable storage and still works in memory', () => {
    const store = createProgressStore('advent-2026', 2026, undefined);
    expect(store.available).toBe(false);
    const result = store.mutate((p) => ({ ...p, opened: opened(4, '2026-12-04') }));
    expect(result.saved).toBe(false);
    expect(result.progress.opened['4']).toBeDefined();
    // The in-memory value is readable for the rest of the session.
    expect(store.read().opened['4']).toBeDefined();
  });

  it('reports a failed write honestly instead of claiming success', () => {
    const store = createProgressStore('advent-2026', 2026, memoryStorage({ failWrites: true }));
    const result = store.mutate((p) => ({ ...p, opened: opened(5, '2026-12-05') }));
    expect(result.saved).toBe(false);
    expect(result.progress.opened['5']).toBeDefined();
  });

  it('notifies subscribers when another tab writes the same key', () => {
    const listeners = new Map<string, EventListener[]>();
    const addEventListener = vi.fn((type: string, listener: EventListener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    });
    vi.stubGlobal('window', { addEventListener, removeEventListener: vi.fn() });

    const store = createProgressStore('advent-2026', 2026, memoryStorage());
    const onChange = vi.fn();
    store.subscribe(onChange);

    const fire = (key: string | null) => {
      for (const listener of listeners.get('storage') ?? []) listener({ key } as unknown as Event);
    };
    fire(store.key);
    expect(onChange).toHaveBeenCalledTimes(1);
    fire('some:other:key');
    expect(onChange).toHaveBeenCalledTimes(1);
    // A cleared storage reports key === null and must also trigger a re-read.
    fire(null);
    expect(onChange).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });
});
