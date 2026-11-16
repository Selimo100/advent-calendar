/**
 * Persistent browser progress: which doors were opened and how far the
 * Samichlaus game has come. Versioned localStorage, keyed by calendar
 * identity and year, storing only state (never content).
 *
 * Multi-tab behaviour: every mutation re-reads the latest stored value first
 * and merges monotonic progress (opened doors, checkpoints, completion), and
 * other tabs are notified via the browser's `storage` event. This is
 * convenience synchronisation between tabs of the same browser, not
 * transactional storage and not a security mechanism.
 */

import { isDevMode } from './devMode.ts';

export interface OpenedRecord {
  /** Instant of the first opening (ISO). */
  openedAt: string;
  /** Europe/Zurich calendar date (YYYY-MM-DD) of the first opening. */
  date: string;
}

export interface GameState {
  started: boolean;
  /** Last checkpoint reached. `rank` orders checkpoints for merging. */
  checkpoint: { id: string; rank: number } | null;
  completed: boolean;
  completedAt: string | null;
  /** Falls since the last checkpoint change; used only to offer assist mode. */
  failures: number;
}

export interface Prefs {
  assist: boolean;
  sound: boolean;
}

export interface Progress {
  version: 1;
  opened: Record<string, OpenedRecord>;
  game: GameState;
  prefs: Prefs;
}

export function emptyProgress(): Progress {
  return {
    version: 1,
    opened: {},
    game: { started: false, checkpoint: null, completed: false, completedAt: null, failures: 0 },
    prefs: { assist: false, sound: false },
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(new Date(v).getTime());
const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Accepts whatever is in storage and salvages every valid piece of it.
 * Corrupted JSON, missing fields, wrong types and unknown schema versions all
 * degrade to defaults instead of crashing or wiping valid progress.
 */
export function parseProgress(raw: string | null): Progress {
  const progress = emptyProgress();
  if (!raw) return progress;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return progress;
  }
  if (!isRecord(data)) return progress;

  if (isRecord(data.opened)) {
    for (const [key, value] of Object.entries(data.opened)) {
      const day = Number(key);
      if (!Number.isInteger(day) || day < 1 || day > 24) continue;
      if (isRecord(value) && isIso(value.openedAt) && isIsoDate(value.date)) {
        progress.opened[key] = { openedAt: value.openedAt, date: value.date };
      }
    }
  }
  const game = data.game;
  if (isRecord(game)) {
    progress.game.started = game.started === true;
    progress.game.completed = game.completed === true;
    progress.game.completedAt = isIso(game.completedAt) ? game.completedAt : null;
    progress.game.failures = Number.isInteger(game.failures) && (game.failures as number) >= 0 ? (game.failures as number) : 0;
    const cp = game.checkpoint;
    if (isRecord(cp) && typeof cp.id === 'string' && Number.isInteger(cp.rank)) {
      progress.game.checkpoint = { id: cp.id, rank: cp.rank as number };
    }
  }
  if (isRecord(data.prefs)) {
    progress.prefs.assist = data.prefs.assist === true;
    progress.prefs.sound = data.prefs.sound === true;
  }
  return progress;
}

/**
 * Merges two progress snapshots without losing monotonic progress:
 * opened doors are unioned (earliest opening wins), game completion and
 * checkpoints only move forward. Preferences take `next`'s value, because
 * they express the latest intent.
 */
export function mergeProgress(previous: Progress, next: Progress): Progress {
  const merged = emptyProgress();
  for (const [day, record] of Object.entries(previous.opened)) merged.opened[day] = record;
  for (const [day, record] of Object.entries(next.opened)) {
    const existing = merged.opened[day];
    if (!existing || new Date(record.openedAt) < new Date(existing.openedAt)) merged.opened[day] = record;
  }
  const a = previous.game;
  const b = next.game;
  merged.game = {
    started: a.started || b.started,
    checkpoint:
      a.checkpoint && b.checkpoint
        ? a.checkpoint.rank >= b.checkpoint.rank
          ? a.checkpoint
          : b.checkpoint
        : (a.checkpoint ?? b.checkpoint),
    completed: a.completed || b.completed,
    completedAt: a.completedAt && b.completedAt ? (a.completedAt < b.completedAt ? a.completedAt : b.completedAt) : (a.completedAt ?? b.completedAt),
    failures: Math.max(a.failures, b.failures),
  };
  merged.prefs = { ...next.prefs };
  return merged;
}

export interface MutationResult {
  progress: Progress;
  /** False when the write failed (private mode, full quota, …). */
  saved: boolean;
}

export interface ProgressStore {
  /** False when localStorage cannot be used at all in this browser. */
  readonly available: boolean;
  readonly key: string;
  read(): Progress;
  /**
   * Applies a mutation on the latest stored progress (re-read immediately
   * before applying) and persists the merged result. On write failure the
   * mutation still applies in memory for this session.
   */
  mutate(fn: (latest: Progress) => Progress): MutationResult;
  /** Notifies when another tab changed this key. */
  subscribe(onExternalChange: () => void): () => void;
}

function detectStorage(storage: Storage | undefined): Storage | null {
  if (!storage) return null;
  try {
    const probe = '__advent_probe__';
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

/** Dev mode uses a separate namespace so previews never touch real progress. */
export function progressKey(calendarId: string, year: number): string {
  const namespace = isDevMode() ? 'advent:dev' : 'advent';
  return `${namespace}:v1:progress:${calendarId}:${year}`;
}

export function createProgressStore(calendarId: string, year: number, storage: Storage | undefined = defaultStorage()): ProgressStore {
  const key = progressKey(calendarId, year);
  const backing = detectStorage(storage);
  /** In-memory fallback so the app stays usable without persistence. */
  let memory: Progress = emptyProgress();

  const read = (): Progress => {
    if (!backing) return memory;
    try {
      return parseProgress(backing.getItem(key));
    } catch {
      return memory;
    }
  };

  return {
    available: backing !== null,
    key,
    read,
    mutate(fn) {
      const latest = read();
      const next = mergeProgress(latest, fn(latest));
      memory = next;
      if (!backing) return { progress: next, saved: false };
      try {
        backing.setItem(key, JSON.stringify(next));
        return { progress: next, saved: true };
      } catch {
        return { progress: next, saved: false };
      }
    },
    subscribe(onExternalChange) {
      if (typeof window === 'undefined') return () => {};
      const onStorage = (event: StorageEvent) => {
        if (event.key === null || event.key === key) onExternalChange();
      };
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    },
  };
}
