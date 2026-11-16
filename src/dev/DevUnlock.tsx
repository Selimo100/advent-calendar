import { useEffect, useRef, useState, type FormEvent } from 'react';
import { enterDevMode } from '../lib/devMode.ts';
import { passwordHash } from '../lib/sha256.ts';
import { DEV_PASSWORD } from './devPassword.ts';

/** Password prompt for dev mode. Loaded only after the corner has been tapped five times. */
export default function DevUnlock({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = DEV_PASSWORD.hash !== '';

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const value = String(new FormData(event.currentTarget).get('password') ?? '');
    setBusy(true);
    // A short pause makes guessing by hand tedious.
    window.setTimeout(() => {
      if (configured && passwordHash(DEV_PASSWORD.salt, value) === DEV_PASSWORD.hash) {
        enterDevMode();
        return;
      }
      setBusy(false);
      setError('Falsches Passwort.');
    }, 600);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="dev-unlock-title"
      className="dev-unlock paper deckle m-auto w-[min(22rem,calc(100%-2rem))] p-5 text-ink backdrop:bg-black/60"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id="dev-unlock-title" className="font-serif-display text-[1.3rem] font-semibold">
        Dev-Modus
      </h2>
      {configured ? (
        <form onSubmit={submit} className="mt-3">
          <label className="block text-[0.95rem] font-semibold" htmlFor="dev-password">
            Passwort
          </label>
          <input
            id="dev-password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            className="mt-1 block min-h-11 w-full rounded-lg border border-ink/25 bg-white px-3 text-[1rem]"
            onInput={() => setError(null)}
          />
          {error && (
            <p role="alert" className="mt-2 text-[0.95rem] text-burgundy">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="min-h-11 rounded-full px-4 font-semibold text-ink-soft">
              Abbrechen
            </button>
            <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-burgundy px-5 font-semibold text-ivory disabled:opacity-60">
              {busy ? 'Prüfe …' : 'Entsperren'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mt-2 text-[0.95rem] text-ink-soft">
            Es ist noch kein Passwort gesetzt. Im Projekt <code>npm run dev:password</code> ausführen, committen und neu deployen.
          </p>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-full px-4 font-semibold text-ink">
              Schliessen
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
