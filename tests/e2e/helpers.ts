import type { Page } from '@playwright/test';

/** Must match src/content/calendar.ts. */
export const CALENDAR_ID = 'advent-2026';
export const YEAR = 2026;
/** Production storage key (dev builds use the `advent:dev:` namespace). */
export const PROGRESS_KEY = `advent:v1:progress:${CALENDAR_ID}:${YEAR}`;

export interface SeedProgress {
  opened?: number[];
  game?: {
    started?: boolean;
    checkpoint?: { id: string; rank: number } | null;
    completed?: boolean;
  };
  prefs?: { assist?: boolean; sound?: boolean };
}

function progressValue(seed: SeedProgress) {
  const opened: Record<string, { openedAt: string; date: string }> = {};
  for (const day of seed.opened ?? []) {
    const date = `${YEAR}-12-${String(day).padStart(2, '0')}`;
    opened[String(day)] = { openedAt: `${date}T08:00:00.000Z`, date };
  }
  return {
    version: 1,
    opened,
    game: {
      started: seed.game?.started ?? false,
      checkpoint: seed.game?.checkpoint ?? null,
      completed: seed.game?.completed ?? false,
      completedAt: seed.game?.completed ? `${YEAR}-12-06T10:00:00.000Z` : null,
      failures: 0,
    },
    prefs: { assist: seed.prefs?.assist ?? false, sound: seed.prefs?.sound ?? false },
  };
}

/** An instant in Europe/Zurich (December is UTC+1). */
export function zurichInstant(year: number, month: number, day: number, hour = 9, minute = 0): Date {
  const offset = month >= 4 && month <= 9 ? '+02:00' : '+01:00';
  const pad = (value: number) => String(value).padStart(2, '0');
  return new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${offset}`);
}

/** Sets the device clock and seeds local progress, before any script runs. */
export async function visit(page: Page, options: { at: Date; progress?: SeedProgress } = { at: zurichInstant(YEAR, 12, 5) }) {
  await page.clock.install({ time: options.at });
  const key = PROGRESS_KEY;
  if (options.progress) {
    const value = JSON.stringify(progressValue(options.progress));
    await page.addInitScript(
      ([storageKey, storageValue]) => {
        window.localStorage.setItem(storageKey as string, storageValue as string);
      },
      [key, value],
    );
  } else {
    await page.addInitScript(
      ([storageKey]) => {
        window.localStorage.removeItem(storageKey as string);
      },
      [key],
    );
  }
  await page.goto('/');
}

export function door(page: Page, day: number) {
  return page.locator(`button.house[data-day="${day}"]`);
}

export async function readProgress(page: Page) {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }, PROGRESS_KEY);
}

// Door content comes straight from the calendar, so editing the texts never
// breaks these tests.
import calendar from '../../src/content/calendar.ts';

export function titleOf(day: number): string {
  const found = calendar.doors.find((d) => d.day === day);
  if (!found) throw new Error(`Door ${day} not found`);
  return found.title;
}

export function contentOf(day: number) {
  const found = calendar.doors.find((d) => d.day === day);
  if (!found) throw new Error(`Door ${day} not found`);
  return found;
}
