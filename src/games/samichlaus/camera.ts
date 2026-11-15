/**
 * Camera: follows the Samichlaus with a little look-ahead in the direction he
 * is facing, so the next landing surface is visible before the jump. The
 * look-ahead is smoothed and clamped to the level bounds, which keeps it from
 * swinging around when the player changes direction quickly.
 */
import { LEVEL } from './level.ts';
import type { Player } from './physics.ts';
import { PLAYER_H, PLAYER_W } from './tuning.ts';

export interface Camera {
  x: number;
  y: number;
  /** Visible world size. */
  w: number;
  h: number;
}

/** World units visible vertically, independent of the device. */
export const VIEW_HEIGHT = 380;
/** Never show less than this horizontally (very tall, narrow viewports). */
export const MIN_VIEW_WIDTH = 330;

export function createCamera(player: Player): Camera {
  return { x: player.x, y: player.y, w: MIN_VIEW_WIDTH, h: VIEW_HEIGHT };
}

/** View size in world units for a canvas of the given pixel size. */
export function viewSize(canvasW: number, canvasH: number): { w: number; h: number; scale: number } {
  let scale = canvasH / VIEW_HEIGHT;
  if (canvasW / scale < MIN_VIEW_WIDTH) scale = canvasW / MIN_VIEW_WIDTH;
  return { w: canvasW / scale, h: canvasH / scale, scale };
}

const LOOK_AHEAD = 70;

export function updateCamera(camera: Camera, player: Player, dt: number, instant = false): void {
  const targetX = player.x + PLAYER_W / 2 + player.facing * LOOK_AHEAD - camera.w / 2;
  // Keep the player a little below the middle so there is sky to jump into.
  const targetY = player.y + PLAYER_H / 2 - camera.h * 0.56;

  const clampedX = clamp(targetX, 0, Math.max(0, LEVEL.width - camera.w));
  const clampedY = clamp(targetY, -120, Math.max(-120, LEVEL.deathY - camera.h + 40));

  if (instant) {
    camera.x = clampedX;
    camera.y = clampedY;
    return;
  }
  // Exponential smoothing, frame-rate independent. Horizontal follows a bit
  // more slowly than vertical so the look-ahead does not feel jittery.
  camera.x += (clampedX - camera.x) * (1 - Math.exp(-6 * dt));
  camera.y += (clampedY - camera.y) * (1 - Math.exp(-9 * dt));
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
