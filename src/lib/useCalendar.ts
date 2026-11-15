import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarSettings } from '../content/schema.ts';
import { CALENDAR } from './calendarData.ts';
import {
  calendarPhase,
  deriveDoorState,
  doorDayForDate,
  evaluateFirstOpening,
  nextTransitionAt,
  calendarStartsAt,
  ALL_DOOR_DAYS,
  type CalendarPhase,
  type FirstOpeningDenial,
  type PolicyDoorState,
} from './calendarPolicy.ts';
import { createProgressStore, type GameState, type Prefs, type Progress } from './calendarStorage.ts';
import { currentInstant, DEV_CHANGE_EVENT } from './clock.ts';
import { toIsoDate, zurichLocalDate, type LocalDate } from './time.ts';

export type DoorState = PolicyDoorState;

export interface DoorSummary {
  day: number;
  state: DoorState;
  /** Only for opened doors. */
  openedAt?: string;
  /** Only for opened doors. */
  title?: string;
}

export interface Overview {
  calendar: { id: string; year: number; settings: CalendarSettings };
  today: LocalDate;
  phase: CalendarPhase;
  todayDoor: number | null;
  startsAt: Date;
  nextTransitionAt: Date | null;
  doors: DoorSummary[];
  progress: { opened: number; total: number };
}

export type OpenOutcome =
  | { ok: true; openedAt: string; firstOpen: boolean }
  | { ok: false; reason: FirstOpeningDenial };

/** Longest single timer: browsers clamp and throttle long timeouts. */
const MAX_TIMER_MS = 6 * 3_600_000;

/**
 * Derives the whole calendar state locally: bundled content + localStorage
 * progress + the device clock (Europe/Zurich). Re-derives at Zurich midnight,
 * when the page becomes visible, on focus, after progress changes, and when
 * another tab writes progress.
 */
export function useCalendar() {
  const store = useMemo(() => createProgressStore(CALENDAR.calendarId, CALENDAR.year), []);
  const [progress, setProgress] = useState<Progress>(() => store.read());
  const [now, setNow] = useState<Date>(() => currentInstant());
  // True once any write failed or storage is unusable; shows a gentle notice.
  const [storageWarning, setStorageWarning] = useState(() => !store.available);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const tick = useCallback(() => setNow(currentInstant()), []);

  // External changes: other tabs writing progress.
  useEffect(
    () =>
      store.subscribe(() => {
        setProgress(store.read());
        tick();
      }),
    [store, tick],
  );

  // Visibility / focus / bfcache restore: re-derive from the current clock.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', tick);
    window.addEventListener('pageshow', tick);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', tick);
      window.removeEventListener('pageshow', tick);
    };
  }, [tick]);

  // Dev panel changed the simulated date or progress (dev builds only).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const onDevChange = () => {
      setProgress(store.read());
      tick();
    };
    window.addEventListener(DEV_CHANGE_EVENT, onDevChange);
    return () => window.removeEventListener(DEV_CHANGE_EVENT, onDevChange);
  }, [store, tick]);

  const today = useMemo(() => zurichLocalDate(now), [now]);
  const todayIso = toIsoDate(today);
  const policyCalendar = useMemo(() => ({ year: CALENDAR.year, policy: 'STRICT_DATE' as const }), []);

  const openedDays = useMemo(() => new Set(Object.keys(progress.opened).map(Number)), [progress.opened]);
  const dayOpenedToday = useMemo(() => {
    for (const [day, record] of Object.entries(progress.opened)) {
      if (record.date === todayIso) return Number(day);
    }
    return null;
  }, [progress.opened, todayIso]);

  const overview = useMemo<Overview>(() => {
    const doors: DoorSummary[] = ALL_DOOR_DAYS.map((day) => {
      const state = deriveDoorState({ calendar: policyCalendar, day, today, openedDays, dayOpenedToday });
      const record = progress.opened[String(day)];
      return state === 'opened' && record
        ? { day, state, openedAt: record.openedAt, title: CALENDAR.doors.find((d) => d.day === day)?.title }
        : { day, state };
    });
    return {
      calendar: { id: CALENDAR.calendarId, year: CALENDAR.year, settings: CALENDAR.settings },
      today,
      phase: calendarPhase(policyCalendar, today),
      todayDoor: doorDayForDate(policyCalendar, today),
      startsAt: calendarStartsAt(policyCalendar),
      nextTransitionAt: nextTransitionAt(policyCalendar, now),
      doors,
      progress: { opened: doors.filter((d) => d.state === 'opened').length, total: doors.length },
    };
  }, [policyCalendar, today, now, openedDays, dayOpenedToday, progress.opened]);

  // Wake up just after the next Zurich midnight. Browsers clamp/throttle long
  // timers, so cap the delay and simply re-arm; reaching the target re-derives
  // door states (it never unlocks anything by itself).
  useEffect(() => {
    const target = overview.nextTransitionAt;
    if (!target) return;
    const delay = target.getTime() - currentInstant().getTime() + 1500;
    const timer = window.setTimeout(tick, Math.max(1000, Math.min(delay, MAX_TIMER_MS)));
    return () => window.clearTimeout(timer);
  }, [overview.nextTransitionAt, tick]);

  const applyMutation = useCallback(
    (fn: (latest: Progress) => Progress) => {
      const result = store.mutate(fn);
      setProgress(result.progress);
      if (!result.saved) setStorageWarning(true);
      return result;
    },
    [store],
  );

  /** First opening of a door; records local progress when the policy allows it. */
  const openDoor = useCallback(
    (day: number): OpenOutcome => {
      const instant = currentInstant();
      const date = zurichLocalDate(instant);
      const latest = store.read();
      if (latest.opened[String(day)]) {
        return { ok: true, openedAt: latest.opened[String(day)]!.openedAt, firstOpen: false };
      }
      const openedToday =
        Object.entries(latest.opened).find(([, record]) => record.date === toIsoDate(date))?.[0] ?? null;
      const decision = evaluateFirstOpening({
        calendar: policyCalendar,
        day,
        today: date,
        dayAlreadyOpenedToday: openedToday === null ? null : Number(openedToday),
      });
      if (!decision.allowed) {
        tick(); // date may have rolled over since the last render
        return { ok: false, reason: decision.reason };
      }
      const openedAt = instant.toISOString();
      applyMutation((latest2) => ({
        ...latest2,
        opened: { ...latest2.opened, [String(day)]: { openedAt, date: toIsoDate(date) } },
      }));
      tick();
      return { ok: true, openedAt, firstOpen: true };
    },
    [store, policyCalendar, applyMutation, tick],
  );

  /** Game progress updates (checkpoint, completion, failures). */
  const updateGame = useCallback(
    (fn: (game: GameState) => GameState) => applyMutation((latest) => ({ ...latest, game: fn(latest.game) })),
    [applyMutation],
  );

  const updatePrefs = useCallback(
    (fn: (prefs: Prefs) => Prefs) => applyMutation((latest) => ({ ...latest, prefs: fn(latest.prefs) })),
    [applyMutation],
  );

  return {
    overview,
    game: progress.game,
    prefs: progress.prefs,
    storageWarning,
    openDoor,
    updateGame,
    updatePrefs,
    refresh: tick,
  };
}
