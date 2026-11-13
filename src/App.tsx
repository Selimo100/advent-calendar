import { lazy, Suspense, useEffect, useState } from 'react';
import { CalendarPage } from './components/CalendarPage.tsx';
import { Decor } from './components/Decor.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { useCalendar } from './lib/useCalendar.ts';

// Development-only tooling. `import.meta.env.DEV` is false in production
// builds, so this import (and the demo panel) is removed from the bundle.
const DemoPanel = import.meta.env.DEV ? lazy(() => import('./dev/DemoPanel.tsx')) : null;

function useDemoHint(): string | null {
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    fetch('/api/demo/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((s: { passphrase?: string } | null) => setHint(s?.passphrase ?? null))
      .catch(() => setHint(null));
  }, []);
  return hint;
}

function Splash({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Decor snow={false} />
      <main className="relative z-[2] grid min-h-dvh place-items-center px-6 text-center">{children}</main>
    </>
  );
}

export function App() {
  const { status, refresh, signOut, expire, update } = useCalendar();
  const demoHint = useDemoHint();

  let page: React.ReactNode;
  switch (status.kind) {
    case 'loading':
      page = (
        <Splash>
          <div role="status">
            <p className="font-serif-display text-2xl text-ivory">Das Dorf erwacht …</p>
            <p className="mt-2 text-ivory-dim">Einen kleinen Moment.</p>
          </div>
        </Splash>
      );
      break;
    case 'signed-out':
      page = <LoginScreen onSuccess={refresh} expired={status.reason === 'expired'} demoHint={demoHint} />;
      break;
    case 'error':
      page = (
        <Splash>
          <div className="max-w-sm" role="alert">
            <p className="font-serif-display text-2xl text-ivory">
              {status.failure.isNetwork ? 'Keine Verbindung' : 'Der Kalender ist gerade nicht erreichbar'}
            </p>
            <p className="mt-2 text-ivory-dim">
              {status.failure.isNetwork
                ? 'Bitte prüf dein Internet. Die Türchen warten geduldig auf dich.'
                : 'Bitte versuch es in einem Moment noch einmal.'}
            </p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-5 min-h-12 rounded-full bg-gold-bright px-6 font-semibold text-midnight"
            >
              Erneut versuchen
            </button>
          </div>
        </Splash>
      );
      break;
    case 'ready':
      page = (
        <CalendarPage
          overview={status.overview}
          offset={status.offset}
          stale={status.stale}
          refresh={refresh}
          update={update}
          onSessionExpired={expire}
          onSignedOut={signOut}
        />
      );
      break;
  }

  return (
    <>
      {page}
      {DemoPanel && (
        <Suspense fallback={null}>
          <DemoPanel onChange={refresh} />
        </Suspense>
      )}
    </>
  );
}
