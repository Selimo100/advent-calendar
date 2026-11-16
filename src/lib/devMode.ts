/**
 * Dev mode: a hidden preview mode for the calendar's author, available in
 * every build (also on the deployed site, so it can be tried on a real phone).
 *
 * It is unlocked by tapping the top-left corner five times and entering the
 * password set with `npm run dev:password`. The unlock lasts for this browser
 * tab only (sessionStorage).
 *
 * While dev mode is on, progress lives in a separate `advent:dev:…` storage
 * namespace and the clock can be simulated, so previews never touch the real
 * progress. Leaving dev mode reloads into the real calendar.
 *
 * This is a static site: the check runs in the browser and is not access
 * control. It keeps the panel out of the way, nothing more.
 */

const SESSION_KEY = 'advent:devmode';

export function isDevMode(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

/** Switches into dev mode and reloads, so every store picks up the dev namespace. */
export function enterDevMode(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch {
    return; // no sessionStorage: dev mode cannot be remembered, so stay out
  }
  window.location.reload();
}

export function exitDevMode(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* nothing stored */
  }
  window.location.reload();
}
