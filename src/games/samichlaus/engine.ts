/**
 * Game lifecycle controller: owns the canvas, the fixed-timestep loop and the
 * world. Frame-by-frame physics deliberately lives outside React — React only
 * receives a small summary when something changes (checkpoint, fall, victory).
 *
 * Timing rules:
 *   - fixed simulation step of 1/120 s,
 *   - frame deltas capped so a long stall cannot teleport the player,
 *   - a bounded number of catch-up steps per frame,
 *   - the clock is reset on resume, so returning to a backgrounded tab never
 *     fast-forwards the simulation.
 */
import { createCamera, updateCamera, viewSize, type Camera } from './camera.ts';
import { createInput, type InputController } from './input.ts';
import { sectionNameAt } from './level.ts';
import { Renderer } from './renderer.ts';
import { World, type WorldEvent } from './world.ts';

const STEP = 1 / 120;
const MAX_FRAME_DELTA = 0.1;
const MAX_STEPS = 12;

export interface GameSummary {
  phase: World['phase'];
  presents: number;
  checkpointLabel: string | null;
  checkpointId: string | null;
  falls: number;
  progress: number;
  section: string;
  assist: boolean;
  paused: boolean;
}

export interface EngineOptions {
  canvas: HTMLCanvasElement;
  assist: boolean;
  reducedMotion: boolean;
  startCheckpointId: string | null;
  onEvent: (event: WorldEvent) => void;
  onSummary: (summary: GameSummary) => void;
  /** The shell shows its pause menu when the engine pauses itself. */
  onPauseRequested: () => void;
}

export interface Engine {
  readonly input: InputController;
  readonly world: World;
  start(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  restartFromCheckpoint(): void;
  setAssist(assist: boolean): void;
  setReducedMotion(reduced: boolean): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export function createEngine(options: EngineOptions): Engine {
  const renderer = new Renderer(options.canvas);
  const world = new World({ assist: options.assist, startCheckpointId: options.startCheckpointId });
  const camera: Camera = createCamera(world.player);
  let reducedMotion = options.reducedMotion;
  let paused = true;
  let destroyed = false;
  let frame = 0;
  let lastTime = 0;
  let accumulator = 0;

  const input = createInput({ enabled: () => !paused && !destroyed });

  const summary = (): GameSummary => ({
    phase: world.phase,
    presents: world.presents.size,
    checkpointLabel: world.checkpoint?.label ?? null,
    checkpointId: world.checkpoint?.id ?? null,
    falls: world.falls,
    progress: world.progress,
    section: sectionNameAt(world.player.x),
    assist: world.assistEnabled,
    paused,
  });

  const emitSummary = () => options.onSummary(summary());

  const syncCameraSize = () => {
    const view = renderer.view();
    camera.w = view.w;
    camera.h = view.h;
  };

  const render = () => {
    syncCameraSize();
    renderer.draw(world, camera, { reducedMotion });
  };

  const loop = (now: number) => {
    if (destroyed || paused) return;
    frame = requestAnimationFrame(loop);

    let delta = (now - lastTime) / 1000;
    lastTime = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    delta = Math.min(delta, MAX_FRAME_DELTA);
    accumulator += delta;

    let steps = 0;
    let changed = false;
    while (accumulator >= STEP && steps < MAX_STEPS) {
      const snapshot = input.consume();
      const events = world.step(snapshot, STEP);
      for (const event of events) {
        options.onEvent(event);
        if (event.type !== 'jump' && event.type !== 'land') changed = true;
        if (event.type === 'fall') input.releaseAll();
      }
      updateCamera(camera, world.player, STEP);
      accumulator -= STEP;
      steps += 1;
    }
    // Drop any remaining backlog instead of accumulating debt.
    if (steps === MAX_STEPS) accumulator = 0;

    if (input.consumePauseRequest()) {
      pause();
      options.onPauseRequested();
      return;
    }

    render();
    if (changed) emitSummary();
  };

  const start = () => {
    if (destroyed) return;
    paused = false;
    lastTime = performance.now();
    accumulator = 0;
    syncCameraSize();
    updateCamera(camera, world.player, 0, true);
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(loop);
    emitSummary();
  };

  const pause = () => {
    if (paused) return;
    paused = true;
    cancelAnimationFrame(frame);
    input.releaseAll();
    emitSummary();
    render();
  };

  const resume = () => {
    if (!paused || destroyed) return;
    start();
  };

  const onVisibility = () => {
    if (document.hidden && !paused) {
      pause();
      options.onPauseRequested();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    input,
    world,
    start,
    pause,
    resume,
    isPaused: () => paused,
    restartFromCheckpoint() {
      world.restart();
      input.releaseAll();
      accumulator = 0;
      lastTime = performance.now();
      updateCamera(camera, world.player, 0, true);
      render();
      emitSummary();
    },
    setAssist(assist) {
      world.setAssist(assist);
      render();
      emitSummary();
    },
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      render();
    },
    resize(width, height) {
      renderer.resize(width, height);
      syncCameraSize();
      // Physics never depends on the view size; only the camera does.
      updateCamera(camera, world.player, 0, true);
      render();
    },
    destroy() {
      destroyed = true;
      paused = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      input.destroy();
    },
  };
}

export { viewSize };
