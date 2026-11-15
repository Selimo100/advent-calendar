import { lazy, Suspense } from 'react';
import { CalendarPage } from './components/CalendarPage.tsx';

// Development-only tooling. `import.meta.env.DEV` is false in production
// builds, so this import (and the whole panel) is removed from the bundle.
const DevPanel = import.meta.env.DEV ? lazy(() => import('./dev/DevPanel.tsx')) : null;

export function App() {
  return (
    <>
      <CalendarPage />
      {DevPanel && (
        <Suspense fallback={null}>
          <DevPanel />
        </Suspense>
      )}
    </>
  );
}
