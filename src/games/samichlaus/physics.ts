/**
 * Player physics and collision. Pure functions on a plain state object, with
 * no canvas, DOM or React involved, so the whole feel of the game can be
 * tested headlessly (see tests/unit/gamePhysics.test.ts).
 *
 * One call to `stepPlayer` advances exactly one fixed timestep.
 */
import { PLAYER_H, PLAYER_W, type Tuning } from './tuning.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A solid surface for this step, including how far it moved during it. */
export interface Solid extends Rect {
  id: string;
  dx?: number;
  dy?: number;
}

export type PlayerAnim = 'idle' | 'run' | 'jump' | 'fall' | 'land';

export interface Player {
  /** Top-left corner of the collision box. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  /** Remaining coyote time (seconds). */
  coyote: number;
  /** Remaining buffered jump (seconds). */
  buffer: number;
  jumpHeld: boolean;
  /** Platform the player is standing on, for carrying. */
  ridingId: string | null;
  anim: PlayerAnim;
  animTime: number;
  /** Counts down the short landing squash. */
  landTimer: number;
}

export interface Input {
  left: boolean;
  right: boolean;
  /** True on the step where jump was newly pressed (consumed by the caller). */
  jumpPressed: boolean;
  jumpHeld: boolean;
}

export interface StepEvents {
  jumped: boolean;
  landed: boolean;
  /** Impact speed of a landing, for the squash animation. */
  landingSpeed: number;
}

export function createPlayer(x: number, y: number): Player {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: false,
    coyote: 0,
    buffer: 0,
    jumpHeld: false,
    ridingId: null,
    anim: 'fall',
    animTime: 0,
    landTimer: 0,
  };
}

/** Puts the player at a spawn point with all motion and input state cleared. */
export function resetPlayer(player: Player, x: number, y: number): void {
  player.x = x;
  player.y = y;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.grounded = false;
  player.coyote = 0;
  player.buffer = 0;
  player.jumpHeld = false;
  player.ridingId = null;
  player.anim = 'fall';
  player.animTime = 0;
  player.landTimer = 0;
}

export function playerBox(player: Player): Rect {
  return { x: player.x, y: player.y, w: PLAYER_W, h: PLAYER_H };
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return current;
}

export function stepPlayer(player: Player, input: Input, solids: readonly Solid[], tuning: Tuning, dt: number): StepEvents {
  const events: StepEvents = { jumped: false, landed: false, landingSpeed: 0 };

  // --- timers --------------------------------------------------------------
  player.coyote = player.grounded ? tuning.coyoteTime : Math.max(0, player.coyote - dt);
  player.buffer = input.jumpPressed ? tuning.jumpBufferTime : Math.max(0, player.buffer - dt);
  player.jumpHeld = input.jumpHeld;
  player.landTimer = Math.max(0, player.landTimer - dt);

  // --- carried by a moving platform ---------------------------------------
  if (player.ridingId) {
    const carrier = solids.find((s) => s.id === player.ridingId);
    if (carrier) {
      player.x += carrier.dx ?? 0;
      player.y += carrier.dy ?? 0;
    }
  }

  // --- horizontal ----------------------------------------------------------
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    player.facing = dir > 0 ? 1 : -1;
    const accel = player.grounded ? tuning.groundAccel : tuning.airAccel;
    player.vx = moveTowards(player.vx, dir * tuning.maxSpeed, accel * dt);
  } else {
    const decel = player.grounded ? tuning.groundFriction : tuning.airDrag;
    player.vx = moveTowards(player.vx, 0, decel * dt);
  }

  player.x += player.vx * dt;
  resolveHorizontal(player, solids);

  // --- jump ----------------------------------------------------------------
  if (player.buffer > 0 && (player.grounded || player.coyote > 0)) {
    player.vy = tuning.jumpVelocity;
    player.grounded = false;
    player.coyote = 0;
    player.buffer = 0;
    player.ridingId = null;
    player.anim = 'jump';
    player.animTime = 0;
    events.jumped = true;
  }

  // --- vertical ------------------------------------------------------------
  const gravity =
    player.vy < 0 ? (player.jumpHeld ? tuning.gravity : tuning.lowJumpGravity) : tuning.fallGravity;
  player.vy = Math.min(player.vy + gravity * dt, tuning.terminalVelocity);

  const wasGrounded = player.grounded;
  player.grounded = false;
  player.ridingId = null;
  player.y += player.vy * dt;
  const impact = player.vy;
  resolveVertical(player, solids);

  if (player.grounded && !wasGrounded) {
    events.landed = true;
    events.landingSpeed = impact;
    player.landTimer = 0.14;
  }

  // --- animation state -----------------------------------------------------
  const previous = player.anim;
  if (!player.grounded) player.anim = player.vy < 0 ? 'jump' : 'fall';
  else if (player.landTimer > 0) player.anim = 'land';
  else player.anim = Math.abs(player.vx) > 12 ? 'run' : 'idle';
  player.animTime = player.anim === previous ? player.animTime + dt : 0;

  return events;
}

function resolveHorizontal(player: Player, solids: readonly Solid[]): void {
  const box = playerBox(player);
  for (const solid of solids) {
    if (!overlaps(box, solid)) continue;
    const fromLeft = box.x + box.w - solid.x;
    const fromRight = solid.x + solid.w - box.x;
    if (fromLeft < fromRight) player.x = solid.x - PLAYER_W;
    else player.x = solid.x + solid.w;
    player.vx = 0;
    box.x = player.x;
  }
}

function resolveVertical(player: Player, solids: readonly Solid[]): void {
  const box = playerBox(player);
  for (const solid of solids) {
    if (!overlaps(box, solid)) continue;
    const fromTop = box.y + box.h - solid.y;
    const fromBottom = solid.y + solid.h - box.y;
    if (fromTop <= fromBottom) {
      // Landing on the surface.
      player.y = solid.y - PLAYER_H;
      player.vy = 0;
      player.grounded = true;
      player.ridingId = solid.id;
    } else {
      // Bumping the underside.
      player.y = solid.y + solid.h;
      player.vy = 0;
    }
    box.y = player.y;
  }
}

/**
 * Maximum horizontal distance the player can cover in a single jump while
 * staying at or above `dy` pixels relative to the take-off height (negative
 * dy = landing higher). Simulates the real step function, so it reflects
 * whatever the tuning currently is. Used by the reachability tests.
 */
export function jumpReach(tuning: Tuning, dy: number, dt = 1 / 120): number {
  // A flat take-off platform the player can accelerate along.
  const ground: Solid[] = [{ id: 'sim', x: -2000, y: 400, w: 2400, h: 100 }];
  const player = createPlayer(0, 400 - PLAYER_H);
  // Accelerate to top speed on the ground first.
  for (let i = 0; i < 240; i++) {
    stepPlayer(player, { left: false, right: true, jumpPressed: false, jumpHeld: false }, ground, tuning, dt);
  }
  const takeoffX = player.x;
  const takeoffY = player.y;
  stepPlayer(player, { left: false, right: true, jumpPressed: true, jumpHeld: true }, [], tuning, dt);
  let reach = 0;
  for (let i = 0; i < 600; i++) {
    stepPlayer(player, { left: false, right: true, jumpPressed: false, jumpHeld: true }, [], tuning, dt);
    // Feet at or above the target height (y smaller = higher).
    if (player.y - takeoffY <= dy) reach = player.x - takeoffX;
    else if (reach > 0) break;
  }
  return reach;
}
