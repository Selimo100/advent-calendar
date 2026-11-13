import { useState, type ReactNode } from 'react';
import type { DeliveredBlock } from '../../../shared/content/schema.ts';
import { isPlaceholder } from '../../../shared/content/placeholders.ts';
import { parseSpotifyUrl, spotifyEmbedUrl, type SpotifyKind } from '../../../shared/content/spotify.ts';
import { isoToGerman } from '../../lib/format.ts';
import { CalendarIcon, ExternalIcon, MapPinIcon, MicIcon, MusicIcon, StarIcon } from '../icons.tsx';
import { ProtectedAudio, ProtectedImage } from './Media.tsx';
import { Inline, Paragraphs } from './Text.tsx';

type Block<T extends DeliveredBlock['type']> = Extract<DeliveredBlock, { type: T }>;

function Kicker({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold tracking-[0.12em] text-burgundy uppercase">
      {icon}
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-serif-display mb-3 text-[1.45rem] leading-tight font-semibold text-ink">{children}</h3>;
}

function LetterBlock({ block }: { block: Block<'letter'> }) {
  return (
    <section className="text-[1.08rem] leading-relaxed">
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <Paragraphs items={block.paragraphs} />
      {block.signature && (
        <p className="font-serif-display mt-5 text-right text-[1.2rem] italic text-burgundy">
          <Inline text={block.signature} />
        </p>
      )}
    </section>
  );
}

function MemoryBlock({ block }: { block: Block<'memory'> }) {
  const date = block.date ? isoToGerman(block.date) : block.dateLabel;
  return (
    <section>
      <Kicker>Erinnerung</Kicker>
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      <div className={`grid gap-4 ${block.photos.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {block.photos.map((photo, i) => (
          <ProtectedImage key={photo.mediaId} photo={photo} className={i % 2 ? 'rotate-[1.2deg]' : '-rotate-[1deg]'} />
        ))}
      </div>
      {(date || block.location) && (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[0.95rem] text-ink-soft">
          {date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4" />
              {date}
            </span>
          )}
          {block.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon className="h-4 w-4" />
              {block.location}
            </span>
          )}
        </p>
      )}
      <Paragraphs items={block.story} className="mt-3 text-[1.05rem] leading-relaxed" />
    </section>
  );
}

function SpotifyLink({ url, kind, label }: { url: string; kind: SpotifyKind; label: string }) {
  const [embed, setEmbed] = useState(false);
  const parsed = isPlaceholder(url) ? null : parseSpotifyUrl(url, kind);
  if (!parsed) {
    return <p className="rounded-lg bg-black/5 px-3 py-2 text-sm text-ink-soft">Der Spotify-Link folgt noch ({url}).</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <a
          href={parsed.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-evergreen px-4 font-semibold text-ivory"
        >
          In Spotify öffnen
          <ExternalIcon className="h-4 w-4" />
          <span className="sr-only">(öffnet Spotify in einem neuen Fenster)</span>
        </a>
        {!embed && (
          <button
            type="button"
            onClick={() => setEmbed(true)}
            className="inline-flex min-h-11 items-center rounded-full border border-evergreen/40 px-4 font-semibold text-evergreen"
          >
            Player hier laden
          </button>
        )}
      </div>
      {embed && (
        <iframe
          title={`Spotify-Player: ${label}`}
          src={spotifyEmbedUrl(kind, parsed.id)}
          className="w-full rounded-xl border-0"
          height={kind === 'track' ? 152 : 352}
          loading="lazy"
          allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
      {embed && <p className="text-xs text-ink-soft">Ob das ganze Lied abgespielt wird, hängt von deinem Spotify-Konto ab.</p>}
    </div>
  );
}

function Vinyl() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="#101f25" />
      {[40, 34, 28].map((r) => (
        <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="#2a3a40" strokeWidth="1" />
      ))}
      <circle cx="50" cy="50" r="15" fill="#8f3442" />
      <circle cx="50" cy="50" r="2.5" fill="#f4f7fa" />
    </svg>
  );
}

function SongBlock({ block }: { block: Block<'song'> }) {
  return (
    <section>
      <Kicker icon={<MusicIcon className="h-4 w-4" />}>Ein Lied</Kicker>
      <div className="flex items-center gap-4 rounded-2xl bg-midnight p-3 text-ivory shadow-lg">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg sm:h-24 sm:w-24">
          {block.artwork ? <ProtectedImage photo={block.artwork} framed={false} /> : <Vinyl />}
        </div>
        <div className="min-w-0">
          <p className="font-serif-display text-[1.3rem] leading-tight font-semibold break-words">{block.trackTitle}</p>
          <p className="mt-0.5 text-ivory-dim">{block.artist}</p>
        </div>
      </div>
      {block.intro && <Paragraphs items={block.intro} className="mt-4 text-[1.05rem]" />}
      <div className="mt-4">
        <SpotifyLink url={block.spotifyUrl} kind="track" label={`${block.trackTitle} von ${block.artist}`} />
      </div>
      <h3 className="font-serif-display mt-6 mb-2 text-[1.2rem] font-semibold text-burgundy">Warum mich dieses Lied an uns erinnert</h3>
      <Paragraphs items={block.whyItRemindsUs} className="text-[1.05rem] leading-relaxed" />
    </section>
  );
}

function PlaylistBlock({ block }: { block: Block<'playlist'> }) {
  return (
    <section>
      <Kicker icon={<MusicIcon className="h-4 w-4" />}>Eine Playlist</Kicker>
      <SectionTitle>{block.title}</SectionTitle>
      <Paragraphs items={block.intro} className="text-[1.05rem]" />
      {block.highlights && (
        <ol className="mt-4 space-y-2">
          {block.highlights.map((h, i) => (
            <li key={i} className="rounded-xl bg-black/[0.04] px-3 py-2">
              <span className="font-semibold">{h.trackTitle}</span> <span className="text-ink-soft">– {h.artist}</span>
              {h.note && <p className="mt-0.5 text-[0.95rem] text-ink-soft">{h.note}</p>}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-4">
        <SpotifyLink url={block.spotifyUrl} kind="playlist" label={block.title} />
      </div>
    </section>
  );
}

function VoucherBlock({ block }: { block: Block<'voucher'> }) {
  return (
    <section className="voucher px-6 py-6 text-center sm:px-10">
      <p className="text-[0.78rem] font-bold tracking-[0.3em] text-burgundy uppercase">Gutschein</p>
      <p className="font-serif-display mt-3 text-[1.55rem] leading-snug font-semibold text-ink">{block.title}</p>
      <p className="mt-3 text-[1.05rem]">
        <Inline text={block.description} />
      </p>
      {block.conditions && (
        <ul className="mx-auto mt-4 max-w-sm space-y-1 text-left text-[0.95rem] text-ink-soft">
          {block.conditions.map((c, i) => (
            <li key={i} className="flex gap-2">
              <StarIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-burgundy" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
      {block.note && (
        <p className="font-serif-display mt-4 italic text-ink-soft">
          <Inline text={block.note} />
        </p>
      )}
    </section>
  );
}

function VoiceBlock({ block }: { block: Block<'voice'> }) {
  const title = block.title ?? 'Sprachnachricht';
  return (
    <section>
      <Kicker icon={<MicIcon className="h-4 w-4" />}>Zum Anhören</Kicker>
      <SectionTitle>{title}</SectionTitle>
      {block.intro && <Paragraphs items={block.intro} className="mb-4 text-[1.05rem]" />}
      <div className="rounded-2xl bg-evergreen/10 p-4">
        <ProtectedAudio audio={block.audio} label={title} />
        {block.durationLabel && <p className="mt-2 text-sm text-ink-soft">Dauer: {block.durationLabel}</p>}
      </div>
      {block.transcript && (
        <details className="mt-4 rounded-xl bg-black/[0.04] px-4 py-2">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-burgundy">Zum Mitlesen</summary>
          <Paragraphs items={block.transcript} className="pb-2" />
        </details>
      )}
    </section>
  );
}

function ActivityBlock({ block }: { block: Block<'activity'> }) {
  return (
    <section className="rounded-2xl border border-evergreen/25 bg-evergreen/[0.06] p-5">
      <Kicker>Eine kleine Einladung</Kicker>
      <SectionTitle>{block.title}</SectionTitle>
      <Paragraphs items={block.invitation} className="text-[1.05rem]" />
      {block.ideas && (
        <ul className="mt-4 space-y-2">
          {block.ideas.map((idea, i) => (
            <li key={i} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rotate-45 bg-gold" />
              <span>{idea}</span>
            </li>
          ))}
        </ul>
      )}
      {block.note && <p className="mt-4 text-[0.95rem] italic text-ink-soft">{block.note}</p>}
    </section>
  );
}

function ReasonsBlock({ block }: { block: Block<'reasons'> }) {
  return (
    <section>
      {block.title && <SectionTitle>{block.title}</SectionTitle>}
      {block.intro && <p className="mb-4 text-[1.05rem] text-ink-soft">{block.intro}</p>}
      <ol className="space-y-4">
        {block.reasons.map((reason, i) => (
          <li key={i} className="flex gap-4">
            <span aria-hidden="true" className="font-serif-display w-8 shrink-0 text-right text-[1.9rem] leading-none font-semibold text-burgundy">
              {i + 1}
            </span>
            <p className="pt-1 text-[1.08rem] leading-relaxed">
              <Inline text={reason} />
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FinalLetterBlock({ block }: { block: Block<'finalLetter'> }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <section className="text-[1.1rem] leading-relaxed">
      <div className="mb-4 flex justify-center gap-2 text-gold" aria-hidden="true">
        <StarIcon className="h-4 w-4" />
        <StarIcon className="h-6 w-6" />
        <StarIcon className="h-4 w-4" />
      </div>
      <h3 className="font-serif-display mb-4 text-center text-[1.8rem] leading-tight font-semibold text-ink">{block.title}</h3>
      <Paragraphs items={block.paragraphs} />
      {block.photo && <ProtectedImage photo={block.photo} className="mx-auto mt-6 max-w-md -rotate-[0.8deg]" />}
      {block.finalSurprise &&
        (revealed ? (
          <div className="mt-6 rounded-2xl bg-burgundy p-5 text-ivory" tabIndex={-1} ref={(el) => el?.focus()}>
            <p className="font-serif-display text-[1.35rem] font-semibold">{block.finalSurprise.title}</p>
            <Paragraphs items={block.finalSurprise.paragraphs} className="mt-2" />
          </div>
        ) : (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-burgundy px-6 font-semibold text-ivory shadow-md"
            >
              <StarIcon className="h-4 w-4 text-gold-bright" />
              Die letzte Überraschung öffnen
            </button>
          </div>
        ))}
      {block.signature && (
        <p className="font-serif-display mt-6 text-right text-[1.3rem] italic text-burgundy">
          <Inline text={block.signature} />
        </p>
      )}
    </section>
  );
}

export function BlockView({ block }: { block: DeliveredBlock }) {
  switch (block.type) {
    case 'letter':
      return <LetterBlock block={block} />;
    case 'memory':
      return <MemoryBlock block={block} />;
    case 'song':
      return <SongBlock block={block} />;
    case 'playlist':
      return <PlaylistBlock block={block} />;
    case 'voucher':
      return <VoucherBlock block={block} />;
    case 'voice':
      return <VoiceBlock block={block} />;
    case 'activity':
      return <ActivityBlock block={block} />;
    case 'reasons':
      return <ReasonsBlock block={block} />;
    case 'finalLetter':
      return <FinalLetterBlock block={block} />;
    default:
      return null;
  }
}
