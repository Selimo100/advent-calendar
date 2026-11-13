import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarOverview } from '../../shared/api.ts';
import { api, ApiFailure } from './api.ts';

export type CalendarStatus =
  | { kind: 'loading' }
  | { kind: 'signed-out'; reason?: 'expired' }
  | { kind: 'error'; failure: ApiFailure }
  | { kind: 'ready'; overview: CalendarOverview; offset: number; stale: boolean };

/**
 * Loads the overview and keeps it fresh: on mount, when the tab becomes
 * visible, after reconnecting, and at the server-provided next transition.
 * A countdown reaching zero only triggers revalidation; it never unlocks.
 */
export function useCalendar() {
  const [status, setStatus] = useState<CalendarStatus>({ kind: 'loading' });
  const inFlight = useRef<Promise<void> | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const refresh = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      try {
        const sentAt = Date.now();
        const overview = await api.calendar();
        const receivedAt = Date.now();
        const offset = new Date(overview.serverTime).getTime() - (sentAt + receivedAt) / 2;
        setStatus({ kind: 'ready', overview, offset, stale: false });
      } catch (error) {
        const failure = error instanceof ApiFailure ? error : new ApiFailure('BACKEND_UNAVAILABLE', 0);
        if (failure.code === 'UNAUTHENTICATED') {
          setStatus({ kind: 'signed-out', reason: statusRef.current.kind === 'ready' ? 'expired' : undefined });
        } else if (statusRef.current.kind === 'ready') {
          setStatus({ ...statusRef.current, stale: true });
        } else {
          setStatus({ kind: 'error', failure });
        }
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onOnline);
    };
  }, [refresh]);

  // Revalidate shortly after the next server-side transition (Zurich midnight).
  const next = status.kind === 'ready' ? status.overview.nextTransitionAt : null;
  const offset = status.kind === 'ready' ? status.offset : 0;
  useEffect(() => {
    if (!next) return;
    const delay = new Date(next).getTime() - (Date.now() + offset) + 1500;
    // Long timers are clamped by browsers; re-check at most every 6 hours.
    const timer = window.setTimeout(() => void refresh(), Math.max(1000, Math.min(delay, 6 * 3_600_000)));
    return () => window.clearTimeout(timer);
  }, [next, offset, refresh]);

  const signOut = useCallback(() => setStatus({ kind: 'signed-out' }), []);
  const expire = useCallback(() => setStatus({ kind: 'signed-out', reason: 'expired' }), []);
  const update = useCallback((fn: (o: CalendarOverview) => CalendarOverview) => {
    setStatus((s) => (s.kind === 'ready' ? { ...s, overview: fn(s.overview) } : s));
  }, []);

  return { status, refresh, signOut, expire, update };
}
