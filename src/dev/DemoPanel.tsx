/**
 * DEVELOPMENT ONLY. Loaded via `import.meta.env.DEV`, so it never ships in a
 * production build (verified by scripts/check-public-output.ts). It talks to
 * /api/demo/*, which exists only in the local Vite demo server.
 */
import { useEffect, useState } from 'react';
import { zurichStartOfDay } from '../../shared/calendar/time.ts';

interface DemoState {
  now: string;
  simulated: boolean;
  frozen: boolean;
  latencyMs: number;
  openedDays: number[];
}

const zurich = (y: number, m: number, d: number, h = 0, min = 0, s = 0) =>
  new Date(zurichStartOfDay({ year: y, month: m, day: d }).getTime() + ((h * 60 + min) * 60 + s) * 1000).toISOString();

const CLOCK_PRESETS: { label: string; at: string | null; frozen?: boolean }[] = [
  { label: 'Echte Zeit', at: null },
  { label: '15.11. (vor Beginn)', at: zurich(2026, 11, 15, 10) },
  { label: '01.12. 00:00', at: zurich(2026, 12, 1, 0, 0, 5) },
  { label: '05.12. 09:00', at: zurich(2026, 12, 5, 9) },
  { label: '05.12. 23:59:45 (läuft)', at: zurich(2026, 12, 5, 23, 59, 45), frozen: false },
  { label: '24.12. 08:00', at: zurich(2026, 12, 24, 8) },
  { label: '25.12. (danach)', at: zurich(2026, 12, 25, 10) },
  { label: '01.12.2027', at: zurich(2027, 12, 1, 10) },
];

const HISTORY_PRESETS: { label: string; days: number[] }[] = [
  { label: 'Keine geöffnet', days: [] },
  { label: '1–3 geöffnet', days: [1, 2, 3] },
  { label: '1–4, 6–23', days: [1, 2, 3, 4, ...Array.from({ length: 18 }, (_, i) => i + 6)] },
  { label: 'Alle 24 (Vorschau)', days: Array.from({ length: 24 }, (_, i) => i + 1) },
];

async function post(path: string, body: unknown = {}) {
  await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export default function DemoPanel({ onChange }: { onChange: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DemoState | null>(null);
  const [motion, setMotion] = useState<string>(() => document.documentElement.dataset.motion ?? 'system');

  const load = async () => {
    const r = await fetch('/api/demo/state');
    if (r.ok) setState((await r.json()) as DemoState);
  };
  useEffect(() => {
    void load();
  }, []);
  if (!state) return null;

  const act = async (fn: () => Promise<void>) => {
    await fn();
    await load();
    await onChange();
  };


  return (
    <div className="fixed top-2 right-2 z-50 text-[13px] text-ink">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="min-h-11 rounded-full border border-gold/50 bg-midnight/90 px-3 font-semibold text-gold-bright shadow-lg"
        aria-expanded={open}
      >
        Demo
      </button>
      {open && (
        <div className="paper mt-2 max-h-[80dvh] w-[19rem] overflow-y-auto rounded-xl p-3 shadow-2xl">
          <p className="font-semibold">Lokaler Demo-Modus</p>
          <p className="text-ink-soft">Nur in der Entwicklung. Produktion hat keine Zeitsteuerung.</p>
          <p className="mt-2">
            Simulierte Zeit: <strong>{new Date(state.now).toLocaleString('de-CH', { timeZone: 'Europe/Zurich' })}</strong>
            {state.simulated ? (state.frozen ? ' (angehalten)' : ' (läuft)') : ' (echt)'}
          </p>
          <fieldset className="mt-2">
            <legend className="font-semibold">Zeit</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {CLOCK_PRESETS.map((p) => (
                <button key={p.label} type="button" className="rounded border border-ink/20 px-2 py-1" onClick={() => act(() => post('/api/demo/clock', { at: p.at, frozen: p.frozen ?? true }))}>
                  {p.label}
                </button>
              ))}
            </div>
            <label className="mt-2 block">
              Dezembertag (09:00):{' '}
              <select
                className="rounded border border-ink/20 bg-white px-1 py-0.5"
                onChange={(e) => act(() => post('/api/demo/clock', { at: zurich(2026, 12, Number(e.target.value), 9) }))}
                defaultValue=""
              >
                <option value="" disabled>
                  wählen
                </option>
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}.12.
                  </option>
                ))}
              </select>
            </label>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="font-semibold">Geöffnete Türchen (simulierte Historie)</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {HISTORY_PRESETS.map((p) => (
                <button key={p.label} type="button" className="rounded border border-ink/20 px-2 py-1" onClick={() => act(() => post('/api/demo/history', { openedDays: p.days }))}>
                  {p.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-ink-soft">Aktuell: {state.openedDays.join(', ') || '–'}</p>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="font-semibold">Netzwerk</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {[0, 1500, 4000].map((ms) => (
                <button key={ms} type="button" aria-pressed={state.latencyMs === ms} className="rounded border border-ink/20 px-2 py-1 aria-pressed:bg-evergreen aria-pressed:text-ivory" onClick={() => act(() => post('/api/demo/latency', { ms }))}>
                  {ms ? `${ms} ms Latenz` : 'Keine Latenz'}
                </button>
              ))}
              <button type="button" className="rounded border border-ink/20 px-2 py-1" onClick={() => post('/api/demo/fail-next')}>
                Nächste Anfrage scheitert
              </button>
            </div>
          </fieldset>
          <fieldset className="mt-3">
            <legend className="font-semibold">Bewegung</legend>
            <div className="mt-1 flex flex-wrap gap-1">
              {['system', 'reduce', 'full'].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={motion === m}
                  className="rounded border border-ink/20 px-2 py-1 aria-pressed:bg-evergreen aria-pressed:text-ivory"
                  onClick={() => {
                    if (m === 'system') delete document.documentElement.dataset.motion;
                    else document.documentElement.dataset.motion = m;
                    setMotion(m);
                  }}
                >
                  {m === 'system' ? 'System' : m === 'reduce' ? 'Reduziert' : 'Voll'}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
