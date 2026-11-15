/**
 * Day 6 progression, at the level of the policy and the stored progress:
 * the four states (unopened, opened, checkpoint reached, completed) and the
 * rule that continuing the mission on a later day costs nothing.
 */
import { describe, expect, it } from 'vitest';
import { GAME_DAY } from '../../src/content/schema.ts';
import { evaluateFirstOpening, deriveDoorState, type PolicyCalendar } from '../../src/lib/calendarPolicy.ts';
import { createProgressStore, mergeProgress, type Progress } from '../../src/lib/calendarStorage.ts';
import { decemberDate, toIsoDate } from '../../src/lib/time.ts';

const calendar: PolicyCalendar = { year: 2026, policy: 'STRICT_DATE' };

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  } as Storage;
}

/** The app's opening flow, condensed: policy decision, then persistence. */
function openDoor(store: ReturnType<typeof createProgressStore>, day: number, today: { year: number; month: number; day: number }) {
  const latest = store.read();
  if (latest.opened[String(day)]) return { ok: true as const, firstOpen: false };
  const openedToday = Object.entries(latest.opened).find(([, record]) => record.date === toIsoDate(today))?.[0] ?? null;
  const decision = evaluateFirstOpening({
    calendar,
    day,
    today,
    dayAlreadyOpenedToday: openedToday === null ? null : Number(openedToday),
  });
  if (!decision.allowed) return { ok: false as const, reason: decision.reason };
  store.mutate((progress) => ({
    ...progress,
    opened: { ...progress.opened, [String(day)]: { openedAt: '2026-12-06T09:00:00.000Z', date: toIsoDate(today) } },
  }));
  return { ok: true as const, firstOpen: true };
}

describe('door 6 opening', () => {
  it('can only be opened for the first time on 6 December of the configured year', () => {
    const dec = (day: number) => decemberDate(2026, day);
    expect(openDoor(createProgressStore('c', 2026, memoryStorage()), GAME_DAY, dec(5))).toMatchObject({ reason: 'DOOR_LOCKED' });
    expect(openDoor(createProgressStore('c', 2026, memoryStorage()), GAME_DAY, dec(6))).toMatchObject({ ok: true, firstOpen: true });
    expect(openDoor(createProgressStore('c', 2026, memoryStorage()), GAME_DAY, dec(7))).toMatchObject({ reason: 'DOOR_MISSED' });
    expect(
      openDoor(createProgressStore('c', 2026, memoryStorage()), GAME_DAY, { year: 2027, month: 12, day: 6 }),
    ).toMatchObject({ reason: 'DOOR_MISSED' });
  });

  it('stays missed if 6 December passed unopened', () => {
    const state = deriveDoorState({
      calendar,
      day: GAME_DAY,
      today: decemberDate(2026, 10),
      openedDays: new Set(),
      dayOpenedToday: null,
    });
    expect(state).toBe('missed');
  });
});

describe('continuing the mission on a later day', () => {
  it('does not consume that day\'s opening', () => {
    const store = createProgressStore('c', 2026, memoryStorage());
    expect(openDoor(store, GAME_DAY, decemberDate(2026, 6))).toMatchObject({ ok: true, firstOpen: true });

    // On 10 December: play the game (checkpoint + victory are game state only).
    store.mutate((progress) => ({
      ...progress,
      game: { ...progress.game, started: true, checkpoint: { id: 'cp1', rank: 1 } },
    }));
    store.mutate((progress) => ({
      ...progress,
      game: { ...progress.game, completed: true, completedAt: '2026-12-10T19:00:00.000Z' },
    }));

    // Door 10 is still openable: no opening was used by the game.
    expect(openDoor(store, 10, decemberDate(2026, 10))).toMatchObject({ ok: true, firstOpen: true });
    // And then no second door opens on the same day.
    expect(openDoor(store, 11, decemberDate(2026, 10))).toMatchObject({ reason: 'DOOR_LOCKED' });
  });

  it('does not change the state of any other door', () => {
    const store = createProgressStore('c', 2026, memoryStorage());
    openDoor(store, GAME_DAY, decemberDate(2026, 6));
    store.mutate((progress) => ({ ...progress, game: { ...progress.game, started: true, completed: true } }));
    const progress = store.read();
    expect(Object.keys(progress.opened)).toEqual([String(GAME_DAY)]);
    for (const day of [1, 5, 7, 24]) {
      const state = deriveDoorState({
        calendar,
        day,
        today: decemberDate(2026, 10),
        openedDays: new Set([GAME_DAY]),
        dayOpenedToday: null,
      });
      expect(state).toBe(day < 10 ? 'missed' : 'locked');
    }
  });
});

describe('the four day 6 states', () => {
  const store = () => createProgressStore('c', 2026, memoryStorage());

  it('progress from unopened to completed, and never backwards', () => {
    const s = store();
    // 1. unopened
    let progress: Progress = s.read();
    expect(progress.opened[String(GAME_DAY)]).toBeUndefined();
    expect(progress.game).toMatchObject({ started: false, checkpoint: null, completed: false });

    // 2. opened, game available
    openDoor(s, GAME_DAY, decemberDate(2026, 6));
    expect(s.read().opened[String(GAME_DAY)]).toBeDefined();
    expect(s.read().game.completed).toBe(false);

    // 3. started, checkpoint reached
    s.mutate((p) => ({ ...p, game: { ...p.game, started: true, checkpoint: { id: 'cp1', rank: 1 } } }));
    progress = s.read();
    expect(progress.game).toMatchObject({ started: true, completed: false });
    expect(progress.game.checkpoint).toEqual({ id: 'cp1', rank: 1 });

    // A later checkpoint replaces it; an earlier one does not.
    s.mutate((p) => ({ ...p, game: { ...p.game, checkpoint: { id: 'cp2', rank: 2 } } }));
    expect(s.read().game.checkpoint).toEqual({ id: 'cp2', rank: 2 });
    s.mutate((p) => ({ ...p, game: { ...p.game, checkpoint: { id: 'cp1', rank: 1 } } }));
    expect(s.read().game.checkpoint).toEqual({ id: 'cp2', rank: 2 });

    // 4. completed
    s.mutate((p) => ({ ...p, game: { ...p.game, completed: true, completedAt: '2026-12-06T19:00:00.000Z' } }));
    expect(s.read().game.completed).toBe(true);

    // Replaying must not undo completion.
    s.mutate((p) => ({ ...p, game: { ...p.game, checkpoint: null, completed: false } }));
    expect(s.read().game.completed).toBe(true);
  });

  it('keeps the completion timestamp of the first victory', () => {
    const first = { completed: true, completedAt: '2026-12-06T19:00:00.000Z' };
    const second = { completed: true, completedAt: '2026-12-20T19:00:00.000Z' };
    const base = createProgressStore('c', 2026, memoryStorage()).read();
    const merged = mergeProgress({ ...base, game: { ...base.game, ...first } }, { ...base, game: { ...base.game, ...second } });
    expect(merged.game.completedAt).toBe(first.completedAt);
  });
});
