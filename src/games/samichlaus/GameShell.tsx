/**
 * React shell around the game: menus, overlays and the touch controls.
 * React never touches the simulation per frame — it starts, pauses and
 * restarts the engine and receives a small summary when something happens.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../lib/motion.ts';
import type { GameState, Prefs } from '../../lib/calendarStorage.ts';
import { createEngine, type Engine, type GameSummary } from './engine.ts';
import { createSoundPlayer, type SoundPlayer } from './audio.ts';
import type { Control } from './input.ts';
import { LEVEL } from './level.ts';

export interface GameShellProps {
  victoryText: string;
  game: GameState;
  prefs: Prefs;
  updateGame: (fn: (game: GameState) => GameState) => void;
  updatePrefs: (fn: (prefs: Prefs) => Prefs) => void;
  onExit: () => void;
  onShowReward: () => void;
}

type Screen = 'start' | 'playing' | 'paused' | 'won';

/** Falls between two offers of assist mode. */
const ASSIST_OFFER_AFTER = 4;

export default function GameShell({ victoryText, game, prefs, updateGame, updatePrefs, onExit, onShowReward }: GameShellProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const soundRef = useRef<SoundPlayer | null>(null);
  const reducedMotion = useReducedMotion();

  const [screen, setScreen] = useState<Screen>(game.completed ? 'start' : 'start');
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [assist, setAssist] = useState(prefs.assist);
  const [sound, setSound] = useState(prefs.sound);
  const [falls, setFalls] = useState(0);
  const [assistOffer, setAssistOffer] = useState(false);
  const offeredAt = useRef(0);
  /** Checkpoint to resume from when the mission is started. */
  const resumeCheckpoint = useRef<string | null>(game.checkpoint?.id ?? null);

  const playSound = useCallback((name: Parameters<SoundPlayer['play']>[0]) => {
    soundRef.current?.play(name);
  }, []);

  // --- engine lifecycle ------------------------------------------------------
  const buildEngine = useCallback(
    (startCheckpointId: string | null) => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!canvas || !stage) return null;
      engineRef.current?.destroy();
      const engine = createEngine({
        canvas,
        assist,
        reducedMotion,
        startCheckpointId,
        onEvent: (event) => {
          switch (event.type) {
            case 'jump':
              playSound('jump');
              break;
            case 'land':
              playSound('land');
              break;
            case 'present':
              playSound('present');
              break;
            case 'checkpoint':
              playSound('checkpoint');
              if (event.checkpoint) {
                const reached = event.checkpoint;
                resumeCheckpoint.current = reached.id;
                updateGame((current) => ({
                  ...current,
                  started: true,
                  checkpoint:
                    current.checkpoint && current.checkpoint.rank >= reached.rank
                      ? current.checkpoint
                      : { id: reached.id, rank: reached.rank },
                }));
              }
              break;
            case 'fall':
              playSound('fall');
              setFalls((count) => count + 1);
              break;
            case 'victory':
              playSound('victory');
              updateGame((current) => ({
                ...current,
                started: true,
                completed: true,
                completedAt: current.completedAt ?? new Date().toISOString(),
              }));
              setScreen('won');
              break;
          }
        },
        onSummary: setSummary,
        onPauseRequested: () => setScreen((current) => (current === 'playing' ? 'paused' : current)),
      });
      engineRef.current = engine;
      engine.resize(stage.clientWidth, stage.clientHeight);
      return engine;
    },
    // `assist` and `reducedMotion` are pushed into the live engine separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playSound, updateGame],
  );

  useEffect(
    () => () => {
      engineRef.current?.destroy();
      engineRef.current = null;
      soundRef.current?.destroy();
      soundRef.current = null;
    },
    [],
  );

  // Canvas size follows the stage; physics is unaffected by the view size.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const apply = () => engineRef.current?.resize(stage.clientWidth, stage.clientHeight);
    const observer = new ResizeObserver(apply);
    observer.observe(stage);
    window.addEventListener('orientationchange', apply);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', apply);
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  // Escape while paused resumes; while playing the engine handles it.
  useEffect(() => {
    if (screen !== 'paused') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // --- actions ---------------------------------------------------------------
  const startMission = (fromCheckpoint: boolean) => {
    const engine = buildEngine(fromCheckpoint ? resumeCheckpoint.current : null);
    if (!engine) return;
    if (!fromCheckpoint) resumeCheckpoint.current = null;
    updateGame((current) => ({ ...current, started: true }));
    setFalls(0);
    offeredAt.current = 0;
    setAssistOffer(false);
    engine.start();
    setScreen('playing');
  };

  const resume = () => {
    engineRef.current?.resume();
    setScreen('playing');
  };

  const pause = () => {
    engineRef.current?.pause();
    setScreen('paused');
  };

  const restartCheckpoint = () => {
    engineRef.current?.restartFromCheckpoint();
    engineRef.current?.resume();
    setScreen('playing');
  };

  const toggleAssist = (value: boolean) => {
    setAssist(value);
    engineRef.current?.setAssist(value);
    updatePrefs((current) => ({ ...current, assist: value }));
    setAssistOffer(false);
    offeredAt.current = falls;
  };

  const toggleSound = (value: boolean) => {
    setSound(value);
    updatePrefs((current) => ({ ...current, sound: value }));
    if (value) {
      soundRef.current ??= createSoundPlayer();
      soundRef.current.play('present');
    } else {
      soundRef.current?.destroy();
      soundRef.current = null;
    }
  };

  // Offer assist gently after repeated falls.
  useEffect(() => {
    if (assist || screen !== 'playing') return;
    if (falls > 0 && falls - offeredAt.current >= ASSIST_OFFER_AFTER) {
      offeredAt.current = falls;
      setAssistOffer(true);
    }
  }, [falls, assist, screen]);

  const exit = () => {
    engineRef.current?.pause();
    onExit();
  };

  // --- touch controls --------------------------------------------------------
  const controlHandlers = (control: Control) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      // Capturing means a finger sliding off the button still releases it.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* capture is best-effort */
      }
      engineRef.current?.input.press(control, event.pointerId);
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      engineRef.current?.input.releaseByPointer(event.pointerId);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => {
      engineRef.current?.input.releaseByPointer(event.pointerId);
    },
    onLostPointerCapture: (event: React.PointerEvent<HTMLButtonElement>) => {
      engineRef.current?.input.releaseByPointer(event.pointerId);
    },
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
    // Keyboard users have A/D and Space; these buttons must not double-fire.
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter') event.preventDefault();
    },
  });

  const playing = screen === 'playing';

  return (
    <div className="game-root" role="group" aria-label="Samichlaus-Mission">
      <div className="game-bar">
        <button type="button" onClick={playing ? pause : exit} className="game-chip" aria-label={playing ? 'Spiel pausieren' : 'Zurück zum Kalender'}>
          {playing ? 'Pause' : 'Zurück'}
        </button>
        <p className="game-section" aria-live="polite">
          {summary?.section ?? LEVEL.sections[0]!.name}
        </p>
        <p className="game-chip game-chip-static" aria-label={`${summary?.presents ?? 0} von ${LEVEL.presents.length} Geschenken gefunden`}>
          <span aria-hidden="true">🎁</span> {summary?.presents ?? 0}/{LEVEL.presents.length}
        </p>
      </div>

      <div className="game-progress" aria-hidden="true">
        <span style={{ width: `${Math.round((summary?.progress ?? 0) * 100)}%` }} />
      </div>

      <div className="game-stage" ref={stageRef}>
        <canvas ref={canvasRef} className="game-canvas" aria-label="Der Samichlaus im Winterwald" role="img" />

        {assistOffer && playing && (
          <div className="game-offer" role="status">
            <p>Möchtest du ein bisschen Unterstützung?</p>
            <div className="game-offer-actions">
              <button type="button" onClick={() => toggleAssist(true)} className="game-button game-button-primary">
                Ja, bitte
              </button>
              <button type="button" onClick={() => setAssistOffer(false)} className="game-button">
                Weiter so
              </button>
            </div>
          </div>
        )}

        {screen === 'start' && (
          <Overlay title="Die Mission">
            <p>Hilf dem Samichlaus über die verschneiten Plattformen bis zur warm erleuchteten Hütte. Dort gibt er seinen Sack ab.</p>
            <ul className="game-list">
              <li>Am Handy: links und rechts die Pfeiltasten, rechts unten der grosse Sprungknopf.</li>
              <li>Am Computer: A und D oder die Pfeiltasten, springen mit Leertaste, Pause mit Escape.</li>
              <li>Den Sprungknopf länger halten, um höher zu springen.</li>
              <li>Unbegrenzte Versuche. Nach einem Sturz geht es beim letzten Laternen-Zwischenstand weiter.</li>
            </ul>
            <div className="game-actions">
              {resumeCheckpoint.current && (
                <button type="button" onClick={() => startMission(true)} className="game-button game-button-primary" autoFocus>
                  Beim Zwischenstand weiter
                </button>
              )}
              <button
                type="button"
                onClick={() => startMission(false)}
                className={`game-button ${resumeCheckpoint.current ? '' : 'game-button-primary'}`}
                autoFocus={!resumeCheckpoint.current}
              >
                {resumeCheckpoint.current ? 'Von vorne beginnen' : 'Los geht es'}
              </button>
              <button type="button" onClick={exit} className="game-button game-button-quiet">
                Zurück zum Kalender
              </button>
            </div>
            <AssistToggle assist={assist} sound={sound} onAssist={toggleAssist} onSound={toggleSound} />
          </Overlay>
        )}

        {screen === 'paused' && (
          <Overlay title="Pause">
            <p>
              {summary?.checkpointLabel
                ? `Letzter Zwischenstand: ${summary.checkpointLabel}.`
                : 'Noch kein Zwischenstand erreicht. Die erste Laterne ist nicht weit.'}
            </p>
            <div className="game-actions">
              <button type="button" onClick={resume} className="game-button game-button-primary" autoFocus>
                Weiterspielen
              </button>
              <button type="button" onClick={restartCheckpoint} className="game-button">
                Beim Zwischenstand neu starten
              </button>
              <button type="button" onClick={exit} className="game-button game-button-quiet">
                Zurück zum Kalender
              </button>
            </div>
            <AssistToggle assist={assist} sound={sound} onAssist={toggleAssist} onSound={toggleSound} />
          </Overlay>
        )}

        {screen === 'won' && (
          <Overlay title="Angekommen">
            <p className="game-victory">{victoryText}</p>
            {summary && summary.presents > 0 && (
              <p className="game-note">
                Gefundene Geschenke: {summary.presents} von {LEVEL.presents.length}.
              </p>
            )}
            <div className="game-actions">
              <button type="button" onClick={onShowReward} className="game-button game-button-primary" autoFocus>
                Deine Nachricht öffnen
              </button>
              <button type="button" onClick={() => startMission(false)} className="game-button">
                Noch einmal spielen
              </button>
              <button type="button" onClick={exit} className="game-button game-button-quiet">
                Zurück zum Kalender
              </button>
            </div>
          </Overlay>
        )}
      </div>

      <div className="game-controls" aria-hidden={!playing}>
        <div className="game-controls-move">
          <button type="button" className="game-pad" {...controlHandlers('left')} aria-label="Nach links" tabIndex={playing ? 0 : -1}>
            <Arrow direction="left" />
          </button>
          <button type="button" className="game-pad" {...controlHandlers('right')} aria-label="Nach rechts" tabIndex={playing ? 0 : -1}>
            <Arrow direction="right" />
          </button>
        </div>
        <button type="button" className="game-pad game-pad-jump" {...controlHandlers('jump')} aria-label="Springen" tabIndex={playing ? 0 : -1}>
          Sprung
        </button>
      </div>
    </div>
  );
}

function Overlay({ title, children }: { title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="game-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="game-overlay-card">
        <h2 ref={ref} tabIndex={-1} className="game-overlay-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

function AssistToggle({
  assist,
  sound,
  onAssist,
  onSound,
}: {
  assist: boolean;
  sound: boolean;
  onAssist: (value: boolean) => void;
  onSound: (value: boolean) => void;
}) {
  return (
    <div className="game-toggles">
      <label className="game-toggle">
        <input type="checkbox" checked={assist} onChange={(event) => onAssist(event.target.checked)} />
        <span>
          Unterstützung
          <small>Längere Sprungzeit, langsamere Hindernisse, breitere Plattformen und ein zusätzlicher Zwischenstand.</small>
        </span>
      </label>
      <label className="game-toggle">
        <input type="checkbox" checked={sound} onChange={(event) => onSound(event.target.checked)} />
        <span>
          Töne
          <small>Kleine Geräusche beim Springen und Ankommen. Standardmässig aus.</small>
        </span>
      </label>
    </div>
  );
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="game-arrow">
      <path
        d={direction === 'left' ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
