/**
 * Movement and difficulty tuning for the Samichlaus mission.
 *
 * All values are in world pixels and seconds. Adjusting them here changes the
 * whole game; the mandatory jumps in the level are checked against these
 * numbers in tests/unit/gameReach.test.ts, so if you make the player slower or
 * the jump shorter, that test tells you which gap became too wide.
 */

export interface Tuning {
  /** Stable top speed on the ground and in the air. */
  maxSpeed: number;
  groundAccel: number;
  groundFriction: number;
  airAccel: number;
  /** Gentle deceleration in the air when no direction is held. */
  airDrag: number;
  /** Gravity while rising with the jump button held. */
  gravity: number;
  /** Gravity while falling (a little stronger, so landings feel snappy). */
  fallGravity: number;
  /** Gravity while rising after the jump button was released (variable height). */
  lowJumpGravity: number;
  /** Upward velocity at take-off (negative = up). */
  jumpVelocity: number;
  terminalVelocity: number;
  /** Grace period for jumping after walking off an edge. */
  coyoteTime: number;
  /** Grace period for pressing jump shortly before landing. */
  jumpBufferTime: number;
  /** Multiplier for moving platforms. */
  platformSpeedScale: number;
  /** Multiplier for moving hazards. */
  hazardSpeedScale: number;
  /** Whether platforms marked `assistWidth` use their wider variant. */
  widenPlatforms: boolean;
  /** Whether the assist-only checkpoint is active. */
  extraCheckpoint: boolean;
}

export const BASE_TUNING: Tuning = {
  maxSpeed: 220,
  groundAccel: 1500,
  groundFriction: 1900,
  airAccel: 1100,
  airDrag: 200,
  gravity: 1700,
  fallGravity: 1850,
  lowJumpGravity: 4200,
  jumpVelocity: -620,
  terminalVelocity: 900,
  coyoteTime: 0.12,
  jumpBufferTime: 0.12,
  platformSpeedScale: 1,
  hazardSpeedScale: 1,
  widenPlatforms: false,
  extraCheckpoint: false,
};

/**
 * Assist mode. It stays the same game — the finish still has to be reached —
 * but with more forgiveness: a slightly stronger jump, longer coyote time and
 * jump buffering, slower moving things, wider landing platforms at the three
 * hardest spots and one extra checkpoint.
 */
export const ASSIST_TUNING: Tuning = {
  ...BASE_TUNING,
  jumpVelocity: -660,
  coyoteTime: 0.2,
  jumpBufferTime: 0.2,
  platformSpeedScale: 0.78,
  hazardSpeedScale: 0.6,
  widenPlatforms: true,
  extraCheckpoint: true,
};

export function tuningFor(assist: boolean): Tuning {
  return assist ? ASSIST_TUNING : BASE_TUNING;
}

/** Collision box of the Samichlaus (he is drawn a little larger than this). */
export const PLAYER_W = 24;
export const PLAYER_H = 32;
