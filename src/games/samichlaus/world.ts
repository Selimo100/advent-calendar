/**
 * The simulated world: platforms, the moving snow raft, hazards, checkpoints,
 * presents and the finish. Pure simulation — no canvas, no DOM, no React — so
 * the whole level can be played through in a test.
 *
 * `World.step(input, dt)` advances exactly one fixed timestep.
 */
import {
  LEVEL,
  type Hazard,
  type MovingPlatform,
  type Platform,
} from './level.ts';
import { createPlayer, overlaps, playerBox, resetPlayer, stepPlayer, type Input, type Player, type Rect, type Solid } from './physics.ts';
import { tuningFor, type Tuning, PLAYER_H, PLAYER_W } from './tuning.ts';

export type Phase = 'playing' | 'respawning' | 'delivering' | 'won';

export interface WorldEvent {
  type: 'checkpoint' | 'present' | 'fall' | 'victory' | 'jump' | 'land';
  checkpoint?: { id: string; rank: number; label: string };
  presentId?: string;
}

interface MovingState {
  platform: MovingPlatform;
  pos: number;
  dir: 1 | -1;
  dx: number;
}

interface HazardState {
  hazard: Hazard;
  /** Current left edge (patrolling hazards move). */
  pos: number;
  dir: 1 | -1;
}

const RESPAWN_TIME = 0.45;
const DELIVERY_TIME = 1.9;
/** Collision forgiveness: hazards are slightly smaller than they look. */
const HAZARD_INSET = 5;

export interface WorldOptions {
  assist: boolean;
  /** Checkpoint to start from, if one was already reached. */
  startCheckpointId?: string | null;
}

export class World {
  readonly player: Player;
  phase: Phase = 'playing';
  /** Seconds remaining in the current respawn / delivery animation. */
  timer = 0;
  /** Collected present ids. */
  readonly presents = new Set<string>();
  checkpoint: { id: string; rank: number; label: string } | null = null;
  /** Falls since the world was created; the shell uses it to offer assist. */
  falls = 0;
  /** Total simulated time, used for animation phases in the renderer. */
  time = 0;

  private tuning: Tuning;
  private assist: boolean;
  private readonly moving: MovingState[];
  private readonly hazards: HazardState[];
  private deliveryFrom = 0;

  constructor(options: WorldOptions) {
    this.assist = options.assist;
    this.tuning = tuningFor(options.assist);
    this.moving = LEVEL.moving.map((platform) => ({ platform, pos: platform.x, dir: 1 as const, dx: 0 }));
    this.hazards = LEVEL.hazards.map((hazard) => ({ hazard, pos: hazard.patrol ? hazard.patrol.from : hazard.x, dir: 1 as const }));

    const start = options.startCheckpointId
      ? LEVEL.checkpoints.find((c) => c.id === options.startCheckpointId && (!c.assistOnly || options.assist))
      : undefined;
    if (start) this.checkpoint = { id: start.id, rank: start.rank, label: start.label };
    this.player = start
      ? createPlayer(start.spawnX, start.spawnY)
      : createPlayer(LEVEL.spawn.x, LEVEL.spawn.y);
  }

  setAssist(assist: boolean): void {
    this.assist = assist;
    this.tuning = tuningFor(assist);
  }

  get assistEnabled(): boolean {
    return this.assist;
  }

  /** Static solids for the current mode (assist widens a few landing ledges). */
  get solidPlatforms(): readonly Rect[] {
    return LEVEL.platforms.map((platform) => platformRect(platform, this.tuning.widenPlatforms));
  }

  /** Current rectangle of each moving platform (for the renderer). */
  get movingRects(): readonly (Rect & { id: string })[] {
    return this.moving.map((state) => ({ id: state.platform.id, x: state.pos, y: state.platform.y, w: state.platform.w, h: state.platform.h }));
  }

  /** Current rectangle of each hazard (for the renderer). */
  get hazardRects(): readonly (Rect & { id: string; kind: Hazard['kind'] })[] {
    return this.hazards.map((state) => ({
      id: state.hazard.id,
      kind: state.hazard.kind,
      x: state.pos,
      y: state.hazard.y,
      w: state.hazard.w,
      h: state.hazard.h,
    }));
  }

  get activeCheckpoints() {
    return LEVEL.checkpoints.filter((c) => !c.assistOnly || this.tuning.extraCheckpoint);
  }

  step(input: Input, dt: number): WorldEvent[] {
    const events: WorldEvent[] = [];
    this.time += dt;

    this.stepMoving(dt);
    this.stepHazards(dt);

    if (this.phase === 'respawning') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.respawn();
      }
      return events;
    }

    if (this.phase === 'delivering') {
      this.timer -= dt;
      // Walk the last few pixels to the cottage door, then hand over the sack.
      const doorX = LEVEL.goal.x - PLAYER_W / 2;
      const walk: Input = {
        left: this.player.x > doorX + 2,
        right: this.player.x < doorX - 2,
        jumpPressed: false,
        jumpHeld: false,
      };
      stepPlayer(this.player, walk, this.allSolids(), this.tuning, dt);
      if (this.timer <= 0) {
        this.phase = 'won';
        this.player.vx = 0;
        events.push({ type: 'victory' });
      }
      return events;
    }

    if (this.phase === 'won') return events;

    const stepEvents = stepPlayer(this.player, input, this.allSolids(), this.tuning, dt);
    if (stepEvents.jumped) events.push({ type: 'jump' });
    if (stepEvents.landed) events.push({ type: 'land' });

    const box = playerBox(this.player);

    // Presents (optional, never required).
    for (const present of LEVEL.presents) {
      if (this.presents.has(present.id)) continue;
      if (overlaps(box, { x: present.x - 14, y: present.y - 14, w: 28, h: 28 })) {
        this.presents.add(present.id);
        events.push({ type: 'present', presentId: present.id });
      }
    }

    // Checkpoints: only ever move forward.
    for (const checkpoint of this.activeCheckpoints) {
      if (this.checkpoint && checkpoint.rank <= this.checkpoint.rank) continue;
      if (overlaps(box, { x: checkpoint.x - 34, y: checkpoint.y - 80, w: 68, h: 86 })) {
        this.checkpoint = { id: checkpoint.id, rank: checkpoint.rank, label: checkpoint.label };
        events.push({ type: 'checkpoint', checkpoint: this.checkpoint });
      }
    }

    // The finish.
    if (overlaps(box, LEVEL.goal.zone)) {
      this.phase = 'delivering';
      this.timer = DELIVERY_TIME;
      this.deliveryFrom = this.player.x;
      this.player.vy = 0;
      return events;
    }

    // Hazards and the void.
    if (this.player.y > LEVEL.deathY || this.hitHazard(box)) {
      this.fall();
      events.push({ type: 'fall' });
    }

    return events;
  }

  /** Progress along the level, 0–1, for the little progress bar. */
  get progress(): number {
    return Math.max(0, Math.min(1, this.player.x / LEVEL.goal.x));
  }

  get deliveryProgress(): number {
    if (this.phase === 'won') return 1;
    if (this.phase !== 'delivering') return 0;
    return Math.max(0, Math.min(1, 1 - this.timer / DELIVERY_TIME));
  }

  get deliveryStartX(): number {
    return this.deliveryFrom;
  }

  /** Restart from the current checkpoint (pause menu, or after a fall). */
  restart(): void {
    this.phase = 'playing';
    this.timer = 0;
    this.respawn();
  }

  private fall(): void {
    this.falls += 1;
    this.phase = 'respawning';
    this.timer = RESPAWN_TIME;
    this.player.vx = 0;
    this.player.vy = 0;
  }

  private respawn(): void {
    const checkpoint = this.checkpoint
      ? this.activeCheckpoints.find((c) => c.id === this.checkpoint!.id)
      : undefined;
    if (checkpoint) resetPlayer(this.player, checkpoint.spawnX, checkpoint.spawnY);
    else resetPlayer(this.player, LEVEL.spawn.x, LEVEL.spawn.y);
    this.phase = 'playing';
    this.timer = 0;
  }

  private hitHazard(box: Rect): boolean {
    for (const state of this.hazards) {
      const rect = {
        x: state.pos + HAZARD_INSET,
        y: state.hazard.y + HAZARD_INSET,
        w: Math.max(1, state.hazard.w - HAZARD_INSET * 2),
        h: Math.max(1, state.hazard.h - HAZARD_INSET * 2),
      };
      if (overlaps(box, rect)) return true;
    }
    return false;
  }

  private stepMoving(dt: number): void {
    for (const state of this.moving) {
      const previous = state.pos;
      state.pos += state.dir * state.platform.speed * this.tuning.platformSpeedScale * dt;
      if (state.pos >= state.platform.toX) {
        state.pos = state.platform.toX;
        state.dir = -1;
      } else if (state.pos <= state.platform.x) {
        state.pos = state.platform.x;
        state.dir = 1;
      }
      state.dx = state.pos - previous;
    }
  }

  private stepHazards(dt: number): void {
    for (const state of this.hazards) {
      const patrol = state.hazard.patrol;
      if (!patrol) continue;
      state.pos += state.dir * patrol.speed * this.tuning.hazardSpeedScale * dt;
      if (state.pos >= patrol.to) {
        state.pos = patrol.to;
        state.dir = -1;
      } else if (state.pos <= patrol.from) {
        state.pos = patrol.from;
        state.dir = 1;
      }
    }
  }

  private allSolids(): Solid[] {
    const solids: Solid[] = LEVEL.platforms.map((platform) => ({
      id: platform.id,
      ...platformRect(platform, this.tuning.widenPlatforms),
    }));
    for (const state of this.moving) {
      solids.push({
        id: state.platform.id,
        x: state.pos,
        y: state.platform.y,
        w: state.platform.w,
        h: state.platform.h,
        dx: state.dx,
        dy: 0,
      });
    }
    return solids;
  }
}

function platformRect(platform: Platform, widen: boolean): Rect {
  if (widen && platform.assistWidth) {
    const extra = platform.assistWidth - platform.w;
    return { x: platform.x - extra / 2, y: platform.y, w: platform.assistWidth, h: platform.h };
  }
  return { x: platform.x, y: platform.y, w: platform.w, h: platform.h };
}

export { PLAYER_H, PLAYER_W };
