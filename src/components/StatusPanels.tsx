import { useEffect, useState } from 'react';
import { currentInstant } from '../lib/clock.ts';
import { formatGermanDate, zurichLocalDate } from '../lib/time.ts';
import { dayLabel, formatDuration } from '../lib/format.ts';
import type { Overview } from '../lib/useCalendar.ts';
import { StarIcon } from './icons.tsx';

/** Ticking "now" for countdown display only; it never unlocks anything. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => currentInstant().getTime());
  useEffect(() => {
    setNow(currentInstant().getTime());
    const t = window.setInterval(() => setNow(currentInstant().getTime()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function TodayStatus({
  overview,
  onGoToToday,
  onReachedMidnight,
}: {
  overview: Overview;
  onGoToToday: () => void;
  onReachedMidnight: () => void;
}) {
  const now = useNow(1000);
  const todayLabel = formatGermanDate(overview.today);
  const target = overview.phase === 'before' ? overview.startsAt : overview.nextTransitionAt;
  const remaining = target ? target.getTime() - now : null;

  // Reaching zero re-derives the door states from the clock.
  const reachedZero = remaining !== null && remaining <= 0;
  useEffect(() => {
    if (reachedZero) {
      const t = window.setTimeout(onReachedMidnight, 1200);
      return () => window.clearTimeout(t);
    }
  }, [reachedZero, onReachedMidnight]);

  const todayDoor = overview.todayDoor ? overview.doors.find((d) => d.day === overview.todayDoor) : undefined;
  const opened = overview.progress.opened;

  let headline: string;
  let detail: string | null = null;
  if (overview.phase === 'before') {
    headline = `Der Kalender beginnt am ${formatGermanDate(zurichLocalDate(overview.startsAt))}.`;
    detail =
      remaining !== null && remaining > 0
        ? `Noch ${formatDuration(remaining).replace(/\.$/, '')}. Bis dahin bleiben alle Türchen verschlossen.`
        : 'Gleich geht es los …';
  } else if (overview.phase === 'after') {
    headline = overview.calendar.settings.closingMessage;
    detail =
      opened === 0
        ? null
        : opened === 1
          ? 'Ein geöffnetes Türchen ist hier für dich aufbewahrt.'
          : `${opened} geöffnete Türchen sind hier für dich aufbewahrt.`;
  } else if (todayDoor?.state === 'available') {
    headline = `Türchen ${todayDoor.day} wartet auf dich.`;
  } else if (todayDoor?.state === 'opened') {
    headline = `Heute hast du Türchen ${todayDoor.day} geöffnet.`;
    detail =
      overview.todayDoor! < 24 && remaining !== null && remaining > 0
        ? `Das nächste Türchen öffnet sich in ${formatDuration(remaining)}`.replace(/\.?$/, '.')
        : overview.todayDoor === 24
          ? 'Frohe Weihnachten.'
          : null;
  } else {
    headline = 'Schön, dass du da bist.';
  }

  return (
    <section aria-labelledby="today-heading" className="rounded-2xl border border-gold/25 bg-midnight/70 px-4 py-4 shadow-lg sm:px-5">
      <p id="today-heading" className="text-[0.8rem] font-semibold tracking-[0.14em] text-gold uppercase">
        {overview.phase === 'advent' ? `Heute · ${todayLabel}` : overview.phase === 'before' ? 'Bald ist Advent' : 'Nach dem Advent'}
      </p>
      <p className="font-serif-display mt-1 text-[1.25rem] leading-snug text-ivory">{headline}</p>
      {detail && <p className="mt-1 text-[0.98rem] text-ivory-dim">{detail}</p>}
      {overview.phase === 'advent' && overview.todayDoor && (
        <button
          type="button"
          onClick={onGoToToday}
          className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-gold-bright px-5 font-semibold text-midnight shadow-md active:scale-[0.98]"
        >
          <StarIcon className="h-4 w-4" />
          Zum heutigen Türchen
        </button>
      )}
    </section>
  );
}

export function Progress({ overview }: { overview: Overview }) {
  const { opened, total } = overview.progress;
  return (
    <section aria-label="Fortschritt" className="mt-8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[0.95rem] text-ivory-dim">
          <span className="font-semibold text-ivory">{opened}</span> von {total} Türchen geöffnet
        </p>
      </div>
      <ol className="mt-2 grid grid-cols-12 gap-1.5 sm:grid-cols-24" aria-hidden="true">
        {overview.doors.map((d) => (
          <li
            key={d.day}
            className={`h-2 rounded-full ${
              d.state === 'opened' ? 'bg-gold' : d.state === 'missed' ? 'bg-stone/40' : d.day === overview.todayDoor ? 'bg-gold/50' : 'bg-ivory/12'
            }`}
          />
        ))}
      </ol>
    </section>
  );
}

export function Memories({ overview, onOpen }: { overview: Overview; onOpen: (day: number) => void }) {
  const opened = overview.doors.filter((d) => d.state === 'opened').sort((a, b) => a.day - b.day);
  return (
    <section aria-labelledby="memories-heading" className="mt-10">
      <h2 id="memories-heading" className="font-serif-display text-[1.5rem] font-semibold text-ivory">
        Geöffnete Türchen
      </h2>
      {opened.length === 0 ? (
        <p className="mt-2 text-ivory-dim">Hier sammeln sich die Türchen, die du geöffnet hast. Du kannst sie jederzeit wieder ansehen.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {opened.map((d) => (
            <li key={d.day}>
              <button
                type="button"
                onClick={() => onOpen(d.day)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-ivory/10 bg-ivory/[0.06] px-3 py-2 text-left hover:bg-ivory/10"
              >
                <span className="font-serif-display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-burgundy text-[1.1rem] font-semibold text-gold-bright">
                  {d.day}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ivory">{d.title}</span>
                  <span className="block text-[0.88rem] text-ivory-dim">{dayLabel(d.day)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
