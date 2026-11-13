import { useCallback, useEffect, useRef, useState } from 'react';
import type { CalendarOverview, DoorContent } from '../../shared/api.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { doorDateLabel } from '../lib/format.ts';
import { prefersReducedMotion } from '../lib/motion.ts';
import { Decor, Hills, useSnowPreference } from './Decor.tsx';
import { Memories, Progress, TodayStatus } from './StatusPanels.tsx';
import { SurpriseDialog } from './SurpriseDialog.tsx';
import { Village } from './village/Village.tsx';

interface Notice {
  text: string;
  retryDay?: number;
}

export interface CalendarPageProps {
  overview: CalendarOverview;
  offset: number;
  stale: boolean;
  refresh: () => Promise<void>;
  update: (fn: (o: CalendarOverview) => CalendarOverview) => void;
  onSessionExpired: () => void;
  onSignedOut: () => void;
}

const DIALOG_STATE = 'advent-dialog';

export function CalendarPage({ overview, offset, stale, refresh, update, onSessionExpired, onSignedOut }: CalendarPageProps) {
  const { settings, year } = overview.calendar;
  const doorRefs = useRef(new Map<number, HTMLButtonElement>());
  const contentCache = useRef(new Map<number, DoorContent>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const [pendingDay, setPendingDay] = useState<number | null>(null);
  const [celebrateDay, setCelebrateDay] = useState<number | null>(null);
  const [dialogDay, setDialogDay] = useState<number | null>(null);
  const [dialogContent, setDialogContent] = useState<DoorContent | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [snow, setSnow] = useSnowPreference();

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const offline = !online || stale;
  const openedDays = overview.doors.filter((d) => d.state === 'opened').map((d) => d.day).sort((a, b) => a - b);

  const handleFailure = useCallback(
    (failure: unknown, day?: number) => {
      const f = failure instanceof ApiFailure ? failure : new ApiFailure('BACKEND_UNAVAILABLE', 0);
      if (f.code === 'UNAUTHENTICATED') return onSessionExpired();
      if (f.isNetwork) {
        setNotice({ text: 'Keine Verbindung. Neue Türchen öffnen sich nur mit Internet. Versuch es gleich noch einmal.', retryDay: day });
        return;
      }
      if (f.code === 'DOOR_LOCKED' || f.code === 'DOOR_MISSED' || f.code === 'DAILY_LIMIT_REACHED' || f.code === 'CONTENT_NOT_READY') {
        setNotice({ text: f.serverMessage ?? 'Dieses Türchen lässt sich gerade nicht öffnen.' });
        void refresh();
        return;
      }
      setNotice({ text: 'Der Kalender ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.', retryDay: day });
    },
    [onSessionExpired, refresh],
  );

  // --- dialog + history ------------------------------------------------------
  const showDialog = useCallback((day: number, content: DoorContent | null) => {
    if (history.state?.[DIALOG_STATE] === undefined) history.pushState({ [DIALOG_STATE]: true }, '');
    setDialogDay(day);
    setDialogContent(content);
    setDialogError(null);
  }, []);

  const closeDialog = useCallback(() => {
    if (history.state?.[DIALOG_STATE]) history.back();
    else setDialogDay(null);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!history.state?.[DIALOG_STATE]) setDialogDay(null);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Restore focus to the door that opened the dialog.
  useEffect(() => {
    if (dialogDay === null && returnFocus.current) {
      const el = returnFocus.current;
      returnFocus.current = null;
      requestAnimationFrame(() => el.focus({ preventScroll: false }));
    }
  }, [dialogDay]);

  const loadContent = useCallback(
    async (day: number) => {
      const cached = contentCache.current.get(day);
      if (cached) {
        setDialogContent(cached);
        return;
      }
      setDialogContent(null);
      setDialogLoading(true);
      setDialogError(null);
      try {
        const content = await api.door(day);
        contentCache.current.set(day, content);
        setDialogContent(content);
      } catch (error) {
        const f = error instanceof ApiFailure ? error : null;
        if (f?.code === 'UNAUTHENTICATED') return onSessionExpired();
        setDialogError(f?.isNetwork ? 'Keine Verbindung. Bitte versuch es noch einmal.' : (f?.serverMessage ?? 'Das hat gerade nicht geklappt.'));
      } finally {
        setDialogLoading(false);
      }
    },
    [onSessionExpired],
  );

  const viewOpened = useCallback(
    (day: number) => {
      returnFocus.current = (document.activeElement as HTMLElement) ?? null;
      showDialog(day, contentCache.current.get(day) ?? null);
      void loadContent(day);
    },
    [showDialog, loadContent],
  );

  // --- opening ---------------------------------------------------------------
  const openToday = useCallback(
    async (day: number) => {
      if (pendingDay !== null) return; // ignore repeated taps
      setNotice(null);
      setPendingDay(day);
      returnFocus.current = doorRefs.current.get(day) ?? null;
      try {
        const result = await api.openDoor(day);
        contentCache.current.set(day, result.door);
        setPendingDay(null);
        // Authorised: now (and only now) swing the door open.
        update((o) => ({
          ...o,
          doors: o.doors.map((d) => (d.day === day ? { day, state: 'opened', openedAt: result.door.openedAt, title: result.door.title } : d)),
          progress: result.firstOpen ? { ...o.progress, opened: o.progress.opened + 1 } : o.progress,
        }));
        setAnnouncement(`Türchen ${day} ist offen.`);
        if (day === 24) setCelebrateDay(24);
        const delay = prefersReducedMotion() ? 120 : day === 24 ? 1100 : 780;
        window.setTimeout(() => {
          showDialog(day, result.door);
          void refresh();
        }, delay);
      } catch (error) {
        setPendingDay(null);
        handleFailure(error, day);
      }
    },
    [pendingDay, update, showDialog, refresh, handleFailure],
  );

  const onActivate = useCallback(
    (day: number) => {
      const door = overview.doors.find((d) => d.day === day);
      if (!door) return;
      if (door.state === 'opened') return viewOpened(day);
      if (offline) {
        setNotice({ text: 'Du bist gerade offline. Neue Türchen öffnen sich erst wieder mit Verbindung.', retryDay: door.state === 'available' ? day : undefined });
        return;
      }
      switch (door.state) {
        case 'available':
          void openToday(day);
          return;
        case 'not_ready':
          setNotice({ text: `Türchen ${day} wird gerade noch liebevoll vorbereitet. Schau etwas später noch einmal vorbei.` });
          return;
        case 'missed':
          setNotice({
            text: `Türchen ${day} hatte seinen Tag am ${doorDateLabel(year, day)}. Damit jedes Türchen seinen eigenen Tag behält, bleibt es jetzt eingeschneit.`,
          });
          return;
        case 'locked':
        default:
          setNotice({
            text:
              overview.phase === 'before'
                ? `Noch ein bisschen Geduld: Türchen ${day} öffnet sich am ${doorDateLabel(year, day)}.`
                : `Türchen ${day} öffnet sich am ${doorDateLabel(year, day)}.`,
          });
      }
    },
    [overview, offline, year, viewOpened, openToday],
  );

  const goToToday = () => {
    const day = overview.todayDoor;
    const el = day ? doorRefs.current.get(day) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* the cookie is cleared server-side when reachable; show sign-in either way */
    }
    contentCache.current.clear();
    onSignedOut();
  };

  return (
    <>
      <Decor snow={snow} />
      <div className="relative z-[2] mx-auto max-w-5xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="mx-auto max-w-xl pt-2 pr-14 sm:pr-0 sm:text-center">
          <p className="text-[0.8rem] font-semibold tracking-[0.18em] text-gold uppercase">Advent {year}</p>
          <h1 className="font-serif-display mt-1 text-[1.75rem] leading-[1.15] font-semibold text-ivory sm:text-[2.3rem]">{settings.title}</h1>
          <p className="mt-3 text-[1.05rem] font-semibold text-ivory">{settings.greeting},</p>
          <p className="mt-1 text-[1.02rem] text-ivory-dim">{settings.intro}</p>
        </header>

        {offline && (
          <p role="status" className="mx-auto mt-4 max-w-xl rounded-xl border border-gold/30 bg-midnight/80 px-4 py-3 text-[0.95rem] text-ivory-dim">
            Gerade besteht keine Verbindung zum Kalender. Neue Türchen bleiben bis dahin geschlossen.{' '}
            <button type="button" className="min-h-11 font-semibold text-gold-bright underline underline-offset-4" onClick={() => void refresh()}>
              Erneut verbinden
            </button>
          </p>
        )}

        <div className="mx-auto mt-5 max-w-xl">
          <TodayStatus overview={overview} offset={offset} onGoToToday={goToToday} onRevalidate={() => void refresh()} />
        </div>

        <div className="mt-6">
          <Hills />
          <div className="-mt-1 rounded-b-3xl bg-gradient-to-b from-[#1d3b3a]/60 to-transparent px-1 pt-3 pb-4 sm:px-4">
            <Village
              year={year}
              doors={overview.doors}
              todayDoor={overview.todayDoor}
              pendingDay={pendingDay}
              celebrateDay={celebrateDay}
              offline={offline}
              registerDoor={(day, el) => {
                if (el) doorRefs.current.set(day, el);
                else doorRefs.current.delete(day);
              }}
              onActivate={onActivate}
            />
          </div>
        </div>

        <div className="mx-auto max-w-3xl">
          <Progress overview={overview} />
          <Memories overview={overview} onOpen={viewOpened} />
        </div>

        <footer className="mx-auto mt-14 max-w-xl border-t border-ivory/10 pt-6 text-center">
          <p className="font-serif-display text-[1.2rem] italic text-ivory">{settings.signature}</p>
          {settings.footerNote && <p className="mt-1 text-[0.92rem] text-ivory-dim">{settings.footerNote}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[0.92rem] text-ivory-dim">
            <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => setSnow(!snow)}>
              Schneefall {snow ? 'ausschalten' : 'einschalten'}
            </button>
            <button type="button" className="min-h-11 underline underline-offset-4" onClick={() => void logout()}>
              Abmelden
            </button>
          </div>
        </footer>
      </div>

      {/* Calm, dismissible notices for locked / missed doors and errors. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div role="status" aria-live="polite" className="w-full max-w-md">
          {notice && (
            <div className="notice-enter pointer-events-auto flex items-start gap-3 rounded-2xl border border-gold/30 bg-midnight/95 px-4 py-3 text-[0.98rem] text-ivory shadow-2xl">
              <p className="flex-1 pt-1.5">{notice.text}</p>
              <div className="flex shrink-0 flex-col items-end">
                {notice.retryDay !== undefined && (
                  <button
                    type="button"
                    className="min-h-11 px-2 font-semibold text-gold-bright"
                    onClick={() => {
                      const day = notice.retryDay!;
                      setNotice(null);
                      void refresh().then(() => openToday(day));
                    }}
                  >
                    Erneut versuchen
                  </button>
                )}
                <button type="button" className="min-h-11 min-w-11 px-2 text-ivory-dim" onClick={() => setNotice(null)} aria-label="Hinweis schliessen">
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <SurpriseDialog
        day={dialogDay}
        content={dialogContent}
        loading={dialogLoading}
        error={dialogError}
        signature={settings.signature}
        openedDays={openedDays}
        onNavigate={(day) => {
          setDialogDay(day);
          void loadContent(day);
        }}
        onRetry={() => dialogDay !== null && void loadContent(dialogDay)}
        onClose={closeDialog}
      />
    </>
  );
}
