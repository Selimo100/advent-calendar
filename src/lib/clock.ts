/**
 * The clock used by the calendar. In production this is simply the device
 * clock (an honest, documented limitation of a static site). In development
 * the dev panel can simulate any instant via localStorage; that code path is
 * compiled out of production builds.
 */

export const DEV_NOW_KEY = 'advent:dev:now';
export const DEV_CHANGE_EVENT = 'advent:dev-change';

/** The simulated instant, if one is set (DEV only). */
export function devSimulatedInstant(): Date | null {
  if (!import.meta.env.DEV) return null;
  try {
    const value = localStorage.getItem(DEV_NOW_KEY);
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

export function setDevSimulatedInstant(instant: Date | null): void {
  if (!import.meta.env.DEV) return;
  try {
    if (instant) localStorage.setItem(DEV_NOW_KEY, instant.toISOString());
    else localStorage.removeItem(DEV_NOW_KEY);
  } catch {
    /* storage unavailable: nothing to simulate */
  }
  window.dispatchEvent(new Event(DEV_CHANGE_EVENT));
}

/** Now, as the calendar sees it. */
export function currentInstant(): Date {
  return devSimulatedInstant() ?? new Date();
}
