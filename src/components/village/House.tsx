import { forwardRef, useEffect, useState } from 'react';
import type { DoorState } from '../../lib/useCalendar.ts';
import { LockIcon, SnowflakeIcon } from '../icons.tsx';
import { doorDateLabel } from '../../lib/format.ts';
import { GrandHouseArt, HouseArt } from './HouseArt.tsx';
import { GRAND_DOOR_RECT, HOUSE_DOOR, houseDesign } from './houses.ts';

export interface HouseProps {
  day: number;
  year: number;
  state: DoorState;
  title?: string;
  isToday: boolean;
  celebrate: boolean;
  onActivate: (day: number) => void;
}

function accessibleLabel({ day, year, state, title }: HouseProps): string {
  const base = `Türchen ${day}`;
  switch (state) {
    case 'available':
      return `${base}, heute: jetzt öffnen`;
    case 'opened':
      return `${base}, geöffnet${title ? `: ${title}` : ''}`;
    case 'missed':
      return `${base}, eingeschneit (sein Tag war der ${doorDateLabel(year, day)})`;
    case 'locked':
    default:
      return `${base}, öffnet sich am ${doorDateLabel(year, day)}`;
  }
}

const SPARKLES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  const r = 60 + (i % 3) * 18;
  return { dx: `${Math.round(Math.cos(angle) * r)}px`, dy: `${Math.round(Math.sin(angle) * r)}px`, delay: `${(i % 4) * 60}ms` };
});

export const House = forwardRef<HTMLButtonElement, HouseProps>(function House(props, ref) {
  const { day, state, isToday, celebrate, onActivate } = props;
  const grand = day === 24;
  const design = houseDesign(day);
  const door = grand ? GRAND_DOOR_RECT : HOUSE_DOOR;
  const [showSparkles, setShowSparkles] = useState(false);

  useEffect(() => {
    if (!celebrate) return;
    setShowSparkles(true);
    const t = window.setTimeout(() => setShowSparkles(false), 1600);
    return () => window.clearTimeout(t);
  }, [celebrate]);

  return (
    <button
      ref={ref}
      type="button"
      className="house"
      data-day={day}
      data-state={state}
      aria-label={accessibleLabel(props)}
      onClick={() => onActivate(day)}
    >
      <div className="house-art" style={grand ? { maxWidth: 360, margin: '0 auto' } : undefined}>
        {grand ? <GrandHouseArt /> : <HouseArt design={design} />}
        <div className="door-frame" style={door}>
          {state === 'available' && <span className="door-glow-pulse" />}
          <div className="door-light">
            <span className="door-light-number">{day}</span>
          </div>
          <div className="door-leaf">
            <span className="door-number">{day}</span>
            <span className="door-knob" />
          </div>
          {state === 'locked' && (
            <span className="door-badge">
              <LockIcon />
            </span>
          )}
          {state === 'missed' && (
            <span className="door-badge">
              <SnowflakeIcon />
            </span>
          )}
          {showSparkles && (
            <span className="sparkles" aria-hidden="true">
              {SPARKLES.map((s, i) => (
                <i key={i} style={{ ['--dx' as string]: s.dx, ['--dy' as string]: s.dy, animationDelay: s.delay }} />
              ))}
            </span>
          )}
        </div>
        {isToday && state === 'available' && (
          <span className="today-tag" aria-hidden="true" style={grand ? { top: '48%' } : undefined}>
            Heute
          </span>
        )}
      </div>
    </button>
  );
});
