import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { publicSite } from '../config/site.ts';
import { api, ApiFailure } from '../lib/api.ts';
import { Decor, Hills } from './Decor.tsx';
import { EyeIcon, EyeOffIcon } from './icons.tsx';
import { GrandHouseArt } from './village/HouseArt.tsx';

export function LoginScreen({ onSuccess, expired, demoHint }: { onSuccess: () => Promise<void>; expired?: boolean; demoHint?: string | null }) {
  const [passphrase, setPassphrase] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  useEffect(() => {
    if (error) inputRef.current?.focus();
  }, [error]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!passphrase.trim()) {
      setError('Bitte gib deinen Zugangscode ein.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.login(passphrase);
      setPassphrase('');
      await onSuccess();
    } catch (e) {
      const f = e instanceof ApiFailure ? e : null;
      if (f?.code === 'INVALID_CREDENTIALS') setError('Dieser Zugangscode passt leider nicht. Versuch es noch einmal.');
      else if (f?.code === 'RATE_LIMITED')
        setError(`Zu viele Versuche. Bitte warte ${Math.ceil((f.retryAfterSeconds ?? 600) / 60)} Minuten und versuch es dann noch einmal.`);
      else if (f?.isNetwork) setError('Keine Verbindung. Bitte prüf dein Internet und versuch es noch einmal.');
      else setError('Der Kalender ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Decor snow />
      <main className="relative z-[2] mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[19rem]" aria-hidden="true">
          <div className="relative">
            <GrandHouseArt />
          </div>
        </div>
        <Hills />
        <div className="paper deckle -mt-2 rounded-2xl px-5 py-6 sm:px-7">
          <p className="text-[0.8rem] font-semibold tracking-[0.16em] text-burgundy uppercase">{publicSite.loginKicker}</p>
          <h1 className="font-serif-display mt-1 text-[1.65rem] leading-tight font-semibold text-ink">{publicSite.loginTitle}</h1>
          {expired && (
            <p className="mt-3 rounded-lg bg-burgundy/10 px-3 py-2 text-[0.95rem] text-ink" role="status">
              Deine Anmeldung ist abgelaufen. Bitte gib deinen Zugangscode noch einmal ein.
            </p>
          )}
          <p className="mt-3 text-ink-soft">{publicSite.loginText}</p>
          <form className="mt-5" onSubmit={submit} noValidate>
            <label htmlFor="passphrase" className="block font-semibold text-ink">
              Zugangscode
            </label>
            <div className="relative mt-1.5">
              <input
                ref={inputRef}
                id="passphrase"
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className="block min-h-12 w-full rounded-xl border-2 border-ink/20 bg-white/80 px-4 pr-12 text-[1.05rem] text-ink placeholder:text-ink-soft/70 focus:border-burgundy focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-ink-soft"
                aria-label={visible ? 'Zugangscode verbergen' : 'Zugangscode anzeigen'}
                aria-pressed={visible}
              >
                {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
            </div>
            <div aria-live="assertive">
              {error && (
                <p id={errorId} className="mt-2 text-[0.95rem] font-semibold text-burgundy">
                  {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-burgundy px-6 text-[1.05rem] font-semibold text-ivory shadow-md transition active:scale-[0.99] disabled:opacity-70"
            >
              {busy ? 'Einen Moment …' : publicSite.loginButton}
            </button>
          </form>
          {demoHint && (
            <p className="mt-4 rounded-lg bg-evergreen/10 px-3 py-2 text-[0.9rem] text-ink-soft">
              Lokaler Demo-Modus. Zugangscode: <code className="font-semibold text-ink">{demoHint}</code>
            </p>
          )}
        </div>
      </main>
    </>
  );
}
