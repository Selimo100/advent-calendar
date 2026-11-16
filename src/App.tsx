import { CalendarPage } from './components/CalendarPage.tsx';
import { DevGate } from './dev/DevGate.tsx';

export function App() {
  return (
    <>
      <CalendarPage />
      {/* Hidden dev mode: 5 taps top left + password (see src/lib/devMode.ts). */}
      <DevGate />
    </>
  );
}
