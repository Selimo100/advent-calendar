import { useState } from 'react';
import type { Audio, Photo, Video } from '../../content/schema.ts';
import { Inline } from './Text.tsx';

/**
 * Photo from public/media/photos/. Static file; a failed load (offline,
 * renamed file) offers a retry instead of a broken image.
 */
export function StaticImage({ photo, className = '', framed = true }: { photo: Photo; className?: string; framed?: boolean }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = attempt ? `${photo.src}?retry=${attempt}` : photo.src;
  const ratio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : undefined;

  return (
    <figure className={`${framed ? 'polaroid' : ''} ${className}`}>
      <div className={`relative overflow-hidden bg-[#e9dfcf] ${ratio ? '' : 'min-h-24'}`} style={ratio ? { aspectRatio: ratio } : undefined}>
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
            className={
              ratio
                ? `absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`
                : 'block h-auto w-full'
            }
          />
        ) : (
          <div className="grid min-h-24 place-items-center p-4 text-center text-sm text-ink-soft">
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

const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

/** Video from public/media/videos/: explicit controls, never autoplay, metadata only preloaded. */
export function StaticVideo({ video, className = '' }: { video: Video; className?: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = attempt ? `${video.src}?retry=${attempt}` : video.src;
  const extension = /\.([a-z0-9]+)$/i.exec(video.src)?.[1]?.toLowerCase();
  const ratio = video.width && video.height ? `${video.width} / ${video.height}` : undefined;

  return (
    <figure className={`polaroid ${className}`}>
      <div className="relative overflow-hidden bg-[#e9dfcf]" style={ratio ? { aspectRatio: ratio } : undefined}>
        {!failed ? (
          <video
            key={src}
            controls
            playsInline
            preload="metadata"
            poster={video.poster}
            aria-label={video.alt}
            onError={() => setFailed(true)}
            className={ratio ? 'absolute inset-0 h-full w-full object-cover' : 'block h-auto w-full'}
          >
            <source src={src} type={extension ? VIDEO_TYPES[extension] : undefined} onError={() => setFailed(true)} />
          </video>
        ) : (
          <div className="grid min-h-24 place-items-center p-4 text-center text-sm text-ink-soft">
            <div>
              <p>Das Video konnte gerade nicht geladen werden.</p>
              <button
                type="button"
                className="mt-2 min-h-11 rounded-full border border-burgundy/40 px-4 font-semibold text-burgundy"
                onClick={() => {
                  setFailed(false);
                  setAttempt((a) => a + 1);
                }}
              >
                Erneut laden
              </button>
            </div>
          </div>
        )}
      </div>
      {video.caption && (
        <figcaption className="font-serif-display mt-2 text-center text-[0.95rem] italic text-ink-soft">
          <Inline text={video.caption} />
        </figcaption>
      )}
    </figure>
  );
}

const AUDIO_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
};

function audioMimeType(src: string): string | undefined {
  const extension = /\.([a-z0-9]+)$/i.exec(src)?.[1]?.toLowerCase();
  return extension ? AUDIO_TYPES[extension] : undefined;
}

/** Voice message: explicit controls only, never autoplay, nothing preloaded. */
export function StaticAudio({ audio, label }: { audio: Audio; label: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = attempt ? `${audio.src}?retry=${attempt}` : audio.src;
  return (
    <div>
      <audio key={src} controls preload="none" className="w-full" aria-label={label} onError={() => setFailed(true)}>
        <source src={src} type={audioMimeType(audio.src)} />
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
