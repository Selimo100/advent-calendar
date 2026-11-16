import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { doorContent, GAME_DAY } from '../lib/calendarData.ts';
import { doorDateLabel } from '../lib/format.ts';
import { prefersReducedMotion } from '../lib/motion.ts';
import { useCalendar } from '../lib/useCalendar.ts';
import { Decor, Hills, useSnowPreference } from './Decor.tsx';
import { Memories, Progress, TodayStatus } from './StatusPanels.tsx';
import { SurpriseDialog } from './SurpriseDialog.tsx';
import { Village } from './village/Village.tsx';
import { StarIcon } from './icons.tsx';

// The game is only loaded when the mission actually starts (bundle size, not
// security: the code and the reward text are part of the public site).
const GameShell = lazy(() => import('../games/samichlaus/GameShell.tsx'));

const DIALOG_STATE = 'advent-dialog';

export function CalendarPage() {
  const { overview, game, prefs, storageWarning, openDoor, updateGame, updatePrefs, refresh } = useCalendar();
  const { settings } = overview.calendar;
  const year = overview.calendar.year;
  const doorRefs = useRef(new Map<number, HTMLButtonElement>());
  const returnFocus = useRef<HTMLElement | null>(null);
  const swinging = useRef(false);
  const [celebrateDay, setCelebrateDay] = useState<number | null>(null);
  const [dialogDay, setDialogDay] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [playing, setPlaying] = useState(false);
  const [storageNoticeDismissed, setStorageNoticeDismissed] = useState(false);
  const [snow, setSnow] = useSnowPreference();

  const openedDays = overview.doors.filter((d) => d.state === 'opened').map((d) => d.day).sort((a, b) => a - b);
  const gameDoorOpened = openedDays.includes(GAME_DAY);

  // --- dialog + history ------------------------------------------------------
  const showDialog = useCallback((day: number) => {
    if (history.state?.[DIALOG_STATE] === undefined) history.pushState({ [DIALOG_STATE]: true }, '');
    setDialogDay(day);
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

  const viewOpened = useCallback(
    (day: number) => {
      returnFocus.current = (document.activeElement as HTMLElement) ?? null;
      showDialog(day);
    },
    [showDialog],
  );

  // --- opening ---------------------------------------------------------------
  const openToday = useCallback(
    (day: number) => {
      if (swinging.current) return; // ignore repeated taps during the door swing
      setNotice(null);
      returnFocus.current = doorRefs.current.get(day) ?? null;
      const outcome = openDoor(day);
      if (!outcome.ok) {
        switch (outcome.reason) {
          case 'DOOR_LOCKED':
            setNotice(`Tüürli ${day} öffnet sich am ${doorDateLabel(year, day)}.`);
            break;
          case 'DOOR_MISSED':
            setNotice(
              `Tüürli ${day} het sind Tag am ${doorDateLabel(year, day)}. Damit jedes Tüürli sin eigene Tag bhaltet, bliibt es jetzt ahgschalte.`,
            );
            break;
          case 'DAILY_LIMIT_REACHED':
            setNotice('Hüt hesch du dis Tüürli scho ufgmacht s nächste isch denn morn drah. Du Gwundernase.');
            break;
          default:
            setNotice('Das Tüürli gaht grad nöd uf.');
        }
        return;
      }
      // The door state flips to "opened" immediately; let the 3D swing play
      // before the card appears.
      swinging.current = true;
      setAnnouncement(`Tüürli ${day} ist offen.`);
      if (day === 24) setCelebrateDay(24);
      const delay = prefersReducedMotion() ? 120 : day === 24 ? 1100 : 780;
      window.setTimeout(() => {
        swinging.current = false;
        showDialog(day);
      }, delay);
    },
    [openDoor, year, showDialog],
  );

  const onActivate = useCallback(
    (day: number) => {
      const door = overview.doors.find((d) => d.day === day);
      if (!door) return;
      switch (door.state) {
        case 'opened':
          return viewOpened(day);
        case 'available':
          return openToday(day);
        case 'missed':
          setNotice(
            `Tüürli ${day} het sin Tag am ${doorDateLabel(year, day)}. Damit jedes Tüürli sin eigene Tag bhaltet, bliibt es jetzt ahgschalte.`,
          );
          return;
        case 'locked':
        default:
          setNotice(
            overview.phase === 'before'
              ? `No es bizzeli Geduld min Schatz: Tüürli ${day} gaht am ${doorDateLabel(year, day)} uf.`
              : `Tüürli ${day} gaht am ${doorDateLabel(year, day)} uf.`,
          );
      }
    },
    [overview, year, viewOpened, openToday],
  );

  const goToToday = () => {
    const day = overview.todayDoor;
    const el = day ? doorRefs.current.get(day) : null;
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  };

  const startGame = useCallback(() => {
    if (dialogDay !== null) closeDialog();
    setPlaying(true);
  }, [dialogDay, closeDialog]);

  const dialogContent = dialogDay === null ? null : doorContent(dialogDay);

  return (
    <>
      <Decor snow={snow} />
      <div className="relative z-[2] mx-auto max-w-5xl px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6">
        <header className="mx-auto max-w-xl pt-2 sm:text-center">
          <p className="text-[0.8rem] font-semibold tracking-[0.18em] text-gold uppercase">Advent {year}</p>
          <h1 className="font-serif-display mt-1 text-[1.75rem] leading-[1.15] font-semibold text-ivory sm:text-[2.3rem]">{settings.title}</h1>
          <p className="mt-3 text-[1.05rem] font-semibold text-ivory">{settings.greeting},</p>
          <p className="mt-1 text-[1.02rem] text-ivory-dim">{settings.intro}</p>
        </header>

        {storageWarning && !storageNoticeDismissed && (
          <p role="status" className="mx-auto mt-4 flex max-w-xl items-start gap-3 rounded-xl border border-gold/30 bg-midnight/80 px-4 py-3 text-[0.95rem] text-ivory-dim">
            <span className="flex-1">
              Din Fortschritt cahn gard nöd im Browser gspeicheret werde. Alles gaht trotzde aber viellicht sind d Tüürli bim nächste mal wieder zue.
            </span>
            <button type="button" className="min-h-11 min-w-11 px-2 font-semibold text-gold-bright" onClick={() => setStorageNoticeDismissed(true)}>
              OK
            </button>
          </p>
        )}

        <div className="mx-auto mt-5 max-w-xl">
          <TodayStatus overview={overview} onGoToToday={goToToday} onReachedMidnight={refresh} />
          {gameDoorOpened && !game.completed && (
            <p className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-midnight/70 px-4 py-3 text-[0.98rem] text-ivory-dim">
              <span>De Samichaus isch no unterwegs. Dini Mission wartet.</span>
              <button
                type="button"
                onClick={startGame}
                className="min-h-11 shrink-0 rounded-full bg-burgundy px-4 font-semibold text-ivory shadow-md"
              >
                Wiiterspiele
              </button>
            </p>
          )}
        </div>

        <div className="mt-6">
          <Hills />
          <div className="-mt-1 rounded-b-3xl bg-gradient-to-b from-[#1d3b3a]/60 to-transparent px-1 pt-3 pb-4 sm:px-4">
            <Village
              year={year}
              doors={overview.doors}
              todayDoor={overview.todayDoor}
              celebrateDay={celebrateDay}
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
              Schneie {snow ? 'usstelle' : 'ihstelle'}
            </button>
          </div>
        </footer>
      </div>

      {/* Calm, dismissible notices for locked / missed doors. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div role="status" aria-live="polite" className="w-full max-w-md">
          {notice && (
            <div className="notice-enter pointer-events-auto flex items-start gap-3 rounded-2xl border border-gold/30 bg-midnight/95 px-4 py-3 text-[0.98rem] text-ivory shadow-2xl">
              <p className="flex-1 pt-1.5">{notice}</p>
              <button type="button" className="min-h-11 min-w-11 shrink-0 px-2 text-ivory-dim" onClick={() => setNotice(null)} aria-label="Hinweis Zuemache">
                OK
              </button>
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
        signature={settings.signature}
        openedDays={openedDays}
        gameArea={
          dialogContent?.game
            ? {
                showBlocks: game.completed,
                node: (
                  <GameDoorArea
                    intro={dialogContent.game.intro}
                    startLabel={dialogContent.game.startLabel}
                    started={game.started}
                    completed={game.completed}
                    onStart={startGame}
                  />
                ),
              }
            : undefined
        }
        onNavigate={(day) => setDialogDay(day)}
        onClose={closeDialog}
      />

      {playing && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-40 grid place-items-center bg-midnight-deep/95" role="status">
              <p className="font-serif-display text-xl text-ivory">Der Winterwald wird vorbereitet …</p>
            </div>
          }
        >
          <GameShell
            victoryText={doorContent(GAME_DAY)?.game?.victoryText ?? ''}
            game={game}
            prefs={prefs}
            updateGame={updateGame}
            updatePrefs={updatePrefs}
            onExit={() => setPlaying(false)}
            onShowReward={() => {
              setPlaying(false);
              showDialog(GAME_DAY);
            }}
          />
        </Suspense>
      )}
    </>
  );
}

/** Body of door 6: mission intro before victory, replay controls after. */
function GameDoorArea({
  intro,
  startLabel,
  started,
  completed,
  onStart,
}: {
  intro: string[];
  startLabel: string;
  started: boolean;
  completed: boolean;
  onStart: () => void;
}) {
  if (completed) {
    return (
      <div className="mt-8 border-t border-ink/10 pt-5 text-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-evergreen/10 px-4 py-1.5 text-[0.9rem] font-semibold text-evergreen">
          <StarIcon className="h-4 w-4" />
          Mission erfüllt
        </p>
        <div className="mt-3">
          <button type="button" onClick={onStart} className="min-h-11 rounded-full border border-evergreen/40 px-5 font-semibold text-evergreen">
            Noch einmal spielen
          </button>
        </div>
      </div>
    );
  }
  return (
    <section className="text-center">
      <div className="mx-auto max-w-md space-y-3 text-[1.08rem] leading-relaxed">
        {intro.map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      <button
        type="button"
        onClick={onStart}
        className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-burgundy px-7 text-[1.05rem] font-semibold text-ivory shadow-md"
      >
        <StarIcon className="h-4 w-4 text-gold-bright" />
        {started ? 'Wiiterspiele' : startLabel}
      </button>
      {started && <p className="mt-3 text-[0.95rem] text-ink-soft">Din Zwüschestand wird gpeicheret. Du chasch jeder Ziit wiiterpsiele.</p>}
      {!started && <p className="mt-3 text-[0.95rem] text-ink-soft">Kei Ziitdruck: Du chasch d Mission au amene andere Tag fertig mache.</p>}
    </section>
  );
}
