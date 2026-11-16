/**
 * DEVELOPMENT ONLY. Loaded behind `import.meta.env.DEV`, so it is not part of
 * a production build. It writes to the same dev-namespaced localStorage keys
 * the app uses in development (`advent:dev:…`), so these previews never touch
 * real progress.
 *
 * There is deliberately no production query parameter or date override: this
 * panel exists to keep the recipient's experience clean while developing, not
 * to claim the calendar is tamper-proof.
 */
import { useEffect, useState } from 'react';
import { CALENDAR, GAME_DAY } from '../lib/calendarData.ts';
import { createProgressStore, emptyProgress, type Progress } from '../lib/calendarStorage.ts';
import { DEV_CHANGE_EVENT, devSimulatedInstant, setDevSimulatedInstant } from '../lib/clock.ts';
import { LEVEL } from '../games/samichlaus/level.ts';
import { zurichStartOfDay } from '../lib/time.ts';

const zurich = (year: number, month: number, day: number, hour = 9, minute = 0) =>
  new Date(zurichStartOfDay({ year, month, day }).getTime() + (hour * 60 + minute) * 60_000);

const YEAR = CALENDAR.year;

const DATE_PRESETS: { label: string; at: Date | null }[] = [
  { label: 'Echte Zeit', at: null },
  { label: `15.11. (vorher)`, at: zurich(YEAR, 11, 15, 10) },
  { label: '01.12. 00:00', at: zurich(YEAR, 12, 1, 0, 1) },
  { label: '05.12.', at: zurich(YEAR, 12, 5) },
  { label: '06.12. (Spiel)', at: zurich(YEAR, 12, 6) },
  { label: '10.12.', at: zurich(YEAR, 12, 10) },
  { label: '24.12.', at: zurich(YEAR, 12, 24, 8) },
  { label: '25.12. (danach)', at: zurich(YEAR, 12, 25, 10) },
  { label: `01.12.${YEAR + 1}`, at: zurich(YEAR + 1, 12, 1, 10) },
];

const ALL_DAYS = Array.from({ length: 24 }, (_, i) => i + 1);

export default function DevPanel() {
  const [open, setOpen] = useState(false);
  const [simulated, setSimulated] = useState<Date | null>(() => devSimulatedInstant());
  const [motion, setMotion] = useState(() => document.documentElement.dataset.motion ?? 'system');
  const [progress, setProgress] = useState<Progress>(() => createProgressStore(CALENDAR.calendarId, CALENDAR.year).read());

  const store = createProgressStore(CALENDAR.calendarId, CALENDAR.year);

  useEffect(() => {
    const sync = () => {
      setSimulated(devSimulatedInstant());
      setProgress(store.read());
    };
    window.addEventListener(DEV_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DEV_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Replaces stored progress outright (merging would keep old openings). */
  const writeProgress = (next: Progress) => {
    try {
      localStorage.setItem(store.key, JSON.stringify(next));
    } catch {
      /* ignore: dev only */
    }
    setProgress(next);
    window.dispatchEvent(new Event(DEV_CHANGE_EVENT));
  };

  const openDays = (days: number[], date = simulated ?? new Date()) => {
    const next = emptyProgress();
    next.game = progress.game;
    next.prefs = progress.prefs;
    for (const day of days) {
      const instant = zurich(YEAR, 12, day, 9).toISOString();
      next.opened[String(day)] = { openedAt: instant, date: `${YEAR}-12-${String(day).padStart(2, '0')}` };
    }
    void date;
    writeProgress(next);
  };

  const setGame = (patch: Partial<Progress['game']>) => {
    writeProgress({ ...progress, game: { ...progress.game, ...patch } });
  };

  const openedList = Object.keys(progress.opened).map(Number).sort((a, b) => a - b);

  return (
    <div className="fixed top-2 right-2 z-50 text-[13px] text-ink">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="min-h-11 rounded-full border border-gold/50 bg-midnight/90 px-3 font-semibold text-gold-bright shadow-lg"
        aria-expanded={open}
      >
        Dev
      </button>
      {open && (
        <div className="paper mt-2 max-h-[80dvh] w-[20rem] overflow-y-auto rounded-xl p-3 shadow-2xl">
          <p className="font-semibold">Entwicklungs-Vorschau</p>
          <p className="text-ink-soft">
            Nur in der Entwicklung. Eigener Speicher-Namensraum (<code>advent:dev:…</code>). In der Produktion gibt es keine
            Datumssteuerung.
          </p>

          <fieldset className="mt-3">
            <legend className="font-semibold">Datum simulieren</legend>
            <p className="text-ink-soft">
              Aktuell: <strong>{(simulated ?? new Date()).toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })}</strong>
              {simulated ? ' (simuliert)' : ' (echt)'}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className="min-h-8 rounded border border-ink/20 px-2 py-1"
                  onClick={() => setDevSimulatedInstant(preset.at)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="mt-2 block">
              Dezembertag (09:00):{' '}
              <select
                className="rounded border border-ink/20 bg-white px-1 py-0.5"
                defaultValue=""
                onChange={(event) => setDevSimulatedInstant(zurich(YEAR, 12, Number(event.target.value)))}
              >
                <option value="" disabled>
                  wählen
                </option>
                {ALL_DAYS.map((day) => (
                  <option key={day} value={day}>
                    {day}.12.
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="mt-3">
            <legend className="font-semibold">Fortschritt</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              <button type="button" className="min-h-8 rounded border border-ink/20 px-2 py-1" onClick={() => openDays([])}>
                Alles zurücksetzen
              </button>
              <button type="button" className="min-h-8 rounded border border-ink/20 px-2 py-1" onClick={() => openDays([1, 2, 3])}>
                1–3 geöffnet
              </button>
              <button type="button" className="min-h-8 rounded border border-ink/20 px-2 py-1" onClick={() => openDays([1, 2, 3, 4, 5, 6])}>
                1–6 geöffnet
              </button>
              <button type="button" className="min-h-8 rounded border border-ink/20 px-2 py-1" onClick={() => openDays(ALL_DAYS)}>
                Alle 24 (jeder Typ)
              </button>
              <button
                type="button"
                className="min-h-8 rounded border border-ink/20 px-2 py-1"
                onClick={() => openDays(ALL_DAYS.filter((day) => day % 2 === 1))}
              >
                Jeden zweiten (verpasst)
              </button>
            </div>
            <p className="mt-1 text-ink-soft">Geöffnet: {openedList.join(', ') || '–'}</p>
          </fieldset>

          <fieldset className="mt-3">
            <legend className="font-semibold">Tüürli {GAME_DAY}: Samichlaus-Spiel</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                type="button"
                className="min-h-8 rounded border border-ink/20 px-2 py-1"
                onClick={() => setGame({ started: false, checkpoint: null, completed: false, completedAt: null, failures: 0 })}
              >
                Spiel zurücksetzen
              </button>
              {LEVEL.checkpoints.map((checkpoint) => (
                <button
                  key={checkpoint.id}
                  type="button"
                  className="min-h-8 rounded border border-ink/20 px-2 py-1"
                  onClick={() => setGame({ started: true, checkpoint: { id: checkpoint.id, rank: checkpoint.rank } })}
                >
                  {checkpoint.label}
                  {checkpoint.assistOnly ? ' (Hilfe)' : ''}
                </button>
              ))}
              <button
                type="button"
                className="min-h-8 rounded border border-ink/20 px-2 py-1"
                onClick={() => setGame({ started: true, completed: true, completedAt: new Date().toISOString() })}
              >
                Sieg setzen
              </button>
            </div>
            <p className="mt-1 text-ink-soft">
              Status: {progress.game.completed ? 'gewonnen' : progress.game.started ? 'gestartet' : 'nicht gestartet'}
              {progress.game.checkpoint ? ` · Zwischenstand ${progress.game.checkpoint.id}` : ''}
            </p>
          </fieldset>

          <fieldset className="mt-3">
            <legend className="font-semibold">Einstellungen</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                type="button"
                aria-pressed={progress.prefs.assist}
                className="min-h-8 rounded border border-ink/20 px-2 py-1 aria-pressed:bg-evergreen aria-pressed:text-ivory"
                onClick={() => writeProgress({ ...progress, prefs: { ...progress.prefs, assist: !progress.prefs.assist } })}
              >
                Unterstützung
              </button>
              {['system', 'reduce', 'full'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={motion === mode}
                  className="min-h-8 rounded border border-ink/20 px-2 py-1 aria-pressed:bg-evergreen aria-pressed:text-ivory"
                  onClick={() => {
                    if (mode === 'system') delete document.documentElement.dataset.motion;
                    else document.documentElement.dataset.motion = mode;
                    setMotion(mode);
                  }}
                >
                  {mode === 'system' ? 'Bewegung: System' : mode === 'reduce' ? 'Reduziert' : 'Voll'}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
