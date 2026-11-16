import { lazy, Suspense, useRef, useState } from 'react';
import { isDevMode } from '../lib/devMode.ts';

// Both are loaded only when needed, so the normal page carries none of it.
const DevPanel = lazy(() => import('./DevPanel.tsx'));
const DevUnlock = lazy(() => import('./DevUnlock.tsx'));

const TAPS_NEEDED = 5;
/** Longest pause between two taps that still counts as one sequence. */
const MAX_GAP_MS = 800;

/**
 * Hidden entry to dev mode: tap the top-left corner five times in quick
 * succession, then enter the password. Invisible and not focusable, so the
 * recipient's experience (including screen readers) is unchanged.
 */
export function DevGate() {
  const [active] = useState(isDevMode);
  const [prompt, setPrompt] = useState(false);
  const taps = useRef({ count: 0, last: 0 });

  if (active) {
    return (
      <Suspense fallback={null}>
        <DevPanel />
      </Suspense>
    );
  }

  const onTap = () => {
    const now = Date.now();
    const state = taps.current;
    state.count = now - state.last <= MAX_GAP_MS ? state.count + 1 : 1;
    state.last = now;
    if (state.count >= TAPS_NEEDED) {
      state.count = 0;
      setPrompt(true);
    }
  };

  return (
    <>
      <div aria-hidden="true" className="dev-corner" data-testid="dev-corner" onPointerUp={onTap} />
      {prompt && (
        <Suspense fallback={null}>
          <DevUnlock onClose={() => setPrompt(false)} />
        </Suspense>
      )}
    </>
  );
}
