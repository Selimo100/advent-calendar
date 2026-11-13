import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { DoorContent } from '../../shared/api.ts';
import { dayLabel, isoToGerman } from '../lib/format.ts';
import { lockScroll } from '../lib/scrollLock.ts';
import { BlockView } from './blocks/Blocks.tsx';
import { ChevronLeft, ChevronRight, CloseIcon } from './icons.tsx';

export interface SurpriseDialogProps {
  /** Day being shown; null = closed. */
  day: number | null;
  content: DoorContent | null;
  loading: boolean;
  error: string | null;
  signature: string;
  /** Opened days only — navigation can never reach unopened doors. */
  openedDays: number[];
  onNavigate: (day: number) => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * Full-screen (phone) / centred (larger screens) modal built on <dialog>.
 * showModal() makes the rest of the page inert and traps focus; Escape is
 * routed through onClose so that state and history stay in sync.
 */
export function SurpriseDialog({ day, content, loading, error, signature, openedDays, onNavigate, onRetry, onClose }: SurpriseDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const open = day !== null;

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const release = lockScroll();
      dialog.showModal();
      return () => {
        if (dialog.open) dialog.close();
        release();
      };
    }
  }, [open]);

  // Focus the heading so screen readers announce the new card.
  useEffect(() => {
    if (open && content) {
      headingRef.current?.focus({ preventScroll: true });
      scrollRef.current?.scrollTo({ top: 0 });
    }
  }, [open, content]);

  const index = day === null ? -1 : openedDays.indexOf(day);
  const prev = index > 0 ? openedDays[index - 1] : undefined;
  const next = index >= 0 && index < openedDays.length - 1 ? openedDays[index + 1] : undefined;
  const isFinal = content?.layout === 'final';

  return (
    <dialog
      ref={ref}
      className="surprise-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // Click on the backdrop (outside the card) closes on larger screens.
        if (event.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="surprise-scroll" ref={scrollRef}>
          <article className={`paper deckle relative mx-auto min-h-full max-w-2xl px-5 pt-3 pb-8 sm:min-h-0 sm:px-10 sm:pb-10 ${isFinal ? 'final-card' : ''}`}>
            <header className="sticky top-0 z-10 -mx-5 mb-2 flex items-center justify-between bg-gradient-to-b from-ivory from-70% to-transparent px-5 pt-1 pb-3 sm:-mx-10 sm:px-10">
              <p className="text-[0.85rem] font-semibold tracking-[0.14em] text-burgundy uppercase">
                Türchen {day}
                {content && <span className="font-normal text-ink-soft normal-case tracking-normal"> · {isoToGerman(content.date)}</span>}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="-mr-2 inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 text-ink hover:bg-black/5"
              >
                <CloseIcon className="h-5 w-5" />
                <span className="text-[0.95rem] font-semibold">Schliessen</span>
              </button>
            </header>

            {content ? (
              <>
                <h2
                  id={titleId}
                  ref={headingRef}
                  tabIndex={-1}
                  className="font-serif-display mb-6 text-[2rem] leading-[1.1] font-semibold text-ink focus:outline-none sm:text-[2.4rem]"
                >
                  {content.title}
                </h2>
                <div className="space-y-9">
                  {content.blocks.map((block, i) => (
                    <BlockView key={i} block={block} />
                  ))}
                </div>
                {!isFinal && (
                  <p className="font-serif-display mt-10 border-t border-ink/10 pt-5 text-right italic text-ink-soft">{signature}</p>
                )}
              </>
            ) : (
              <div className="py-16 text-center" aria-live="polite">
                <h2 id={titleId} className="font-serif-display text-2xl font-semibold">
                  {day ? dayLabel(day) : ''}
                </h2>
                {loading && <p className="mt-3 text-ink-soft">Einen Moment …</p>}
                {error && (
                  <>
                    <p className="mt-3 text-ink-soft">{error}</p>
                    <button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-full bg-burgundy px-5 font-semibold text-ivory">
                      Noch einmal versuchen
                    </button>
                  </>
                )}
              </div>
            )}

            {openedDays.length > 1 && (
              <nav aria-label="Geöffnete Türchen" className="mt-10 flex items-center justify-between gap-3">
                {prev !== undefined ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(prev)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 px-4 font-semibold text-ink"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Türchen {prev}
                  </button>
                ) : (
                  <span />
                )}
                {next !== undefined ? (
                  <button
                    type="button"
                    onClick={() => onNavigate(next)}
                    className="inline-flex min-h-11 items-center gap-1 rounded-full border border-ink/15 px-4 font-semibold text-ink"
                  >
                    Türchen {next}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </article>
        </div>
      )}
    </dialog>
  );
}
