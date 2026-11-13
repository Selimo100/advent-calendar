import { useEffect, useState } from 'react';
import { usePageHidden, useReducedMotion } from '../lib/motion.ts';

const FLAKES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  size: 2 + ((i * 7) % 4),
  duration: 11 + ((i * 13) % 12),
  delay: -((i * 29) % 23),
  sway: `${((i * 17) % 40) - 20}px`,
  opacity: 0.35 + ((i * 11) % 5) / 10,
}));

const SNOW_KEY = 'advent:snow';

export function useSnowPreference(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(SNOW_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const set = (value: boolean) => {
    setOn(value);
    try {
      localStorage.setItem(SNOW_KEY, value ? 'on' : 'off');
    } catch {
      /* storage unavailable: preference lasts for this visit */
    }
  };
  return [on, set];
}

/** Sky, moon and a small amount of drifting snow (paused when hidden, off for reduced motion). */
export function Decor({ snow }: { snow: boolean }) {
  const reduced = useReducedMotion();
  const hidden = usePageHidden();
  useEffect(() => {
    document.documentElement.classList.toggle('page-hidden', hidden);
  }, [hidden]);

  return (
    <>
      <div className="sky" aria-hidden="true">
        <div className="moon" />
      </div>
      {snow && !reduced && (
        <div className="snowfall" aria-hidden="true">
          {FLAKES.map((f, i) => (
            <span
              key={i}
              className="snowflake"
              style={{
                left: f.left,
                width: f.size,
                height: f.size,
                opacity: f.opacity,
                animationDuration: `${f.duration}s`,
                animationDelay: `${f.delay}s`,
                ['--sway' as string]: f.sway,
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}

export function Hills() {
  return (
    <svg viewBox="0 0 400 60" preserveAspectRatio="none" className="block h-10 w-full" aria-hidden="true">
      <path d="M0 40 Q60 10 130 30 T260 22 T400 30 V60 H0Z" fill="#1d3b3a" opacity="0.7" />
      <path d="M0 50 Q90 30 180 46 T400 42 V60 H0Z" fill="#f4f7fa" opacity="0.92" />
    </svg>
  );
}
