import { useState } from 'react';
import type { DeliveredAudio, DeliveredPhoto } from '../../../shared/content/schema.ts';
import { Inline } from './Text.tsx';

/**
 * Protected image. `src` points to /api/media/<id>, which checks the session
 * and the opening, then redirects to a short-lived signed URL. On failure (for
 * example an expired link), "Erneut laden" requests a fresh URL.
 */
export function ProtectedImage({ photo, className = '', framed = true }: { photo: DeliveredPhoto; className?: string; framed?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = attempt ? `${photo.src}?retry=${attempt}` : photo.src;

  return (
    <figure className={`${framed ? 'polaroid' : ''} ${className}`}>
      <div className="relative overflow-hidden bg-[#e9dfcf]" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
        {!failed ? (
          <img
            key={src}
            src={src}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-ink-soft">
            <div>
              <p>Das Bild konnte gerade nicht geladen werden.</p>
              <button
                type="button"
                className="mt-2 min-h-11 rounded-full border border-burgundy/40 px-4 font-semibold text-burgundy"
                onClick={() => {
                  setFailed(false);
                  setLoaded(false);
                  setAttempt((a) => a + 1);
                }}
              >
                Erneut laden
              </button>
            </div>
          </div>
        )}
      </div>
      {photo.caption && (
        <figcaption className="font-serif-display mt-2 text-center text-[0.95rem] italic text-ink-soft">
          <Inline text={photo.caption} />
        </figcaption>
      )}
    </figure>
  );
}

/** Voice message: explicit controls only, never autoplay, nothing preloaded. */
export function ProtectedAudio({ audio, label }: { audio: DeliveredAudio; label: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = attempt ? `${audio.src}?retry=${attempt}` : audio.src;
  return (
    <div>
      <audio key={src} controls preload="none" className="w-full" aria-label={label} onError={() => setFailed(true)}>
        <source src={src} type={audio.mimeType} />
      </audio>
      {failed && (
        <p className="mt-2 text-sm text-ink-soft" role="status">
          Die Aufnahme konnte gerade nicht geladen werden.{' '}
          <button
            type="button"
            className="min-h-11 font-semibold text-burgundy underline underline-offset-4"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            Erneut laden
          </button>
        </p>
      )}
    </div>
  );
}
