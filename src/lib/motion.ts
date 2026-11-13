import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener('change', callback);
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  return () => {
    mql.removeEventListener('change', callback);
    observer.disconnect();
  };
}

export function prefersReducedMotion(): boolean {
  const forced = document.documentElement.dataset.motion;
  if (forced === 'reduce') return true;
  if (forced === 'full') return false;
  return window.matchMedia(query).matches;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}

export function usePageHidden(): boolean {
  return useSyncExternalStore(
    (cb) => {
      document.addEventListener('visibilitychange', cb);
      return () => document.removeEventListener('visibilitychange', cb);
    },
    () => document.hidden,
    () => false,
  );
}
