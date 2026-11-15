/**
 * Canvas 2D renderer. Everything is drawn procedurally in one cohesive
 * illustrated style with the calendar's palette — no external images, no
 * shaders, no particle systems beyond a handful of snowflakes.
 *
 * Reduced motion disables the decorative snow and the parallax (background
 * layers become a static backdrop). Essential gameplay motion stays.
 */
import { viewSize, type Camera } from './camera.ts';
import { LEVEL, type Decoration } from './level.ts';
import type { Player } from './physics.ts';
import { PLAYER_H, PLAYER_W } from './tuning.ts';
import type { World } from './world.ts';

const SNOW = '#f4f7fa';
const SNOW_SHADE = '#d7e3ec';
const ROCK = '#2d3b42';
const ROCK_DARK = '#1b272d';
const WOOD = '#4b3a32';
const TREE = '#1f4a3f';
const TREE_DARK = '#163429';
const COAT = '#b8323f';
const COAT_DARK = '#8f3442';
const GOLD = '#d5b477';
const WINDOW = '#ffcf7a';
const ICE = '#a8d8ec';
const INK = '#101f25';

export interface RenderOptions {
  reducedMotion: boolean;
}

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: ((i * 97) % 1000) / 1000,
  y: ((i * 53) % 420) / 1000,
  r: 0.6 + ((i * 7) % 10) / 12,
  phase: (i % 9) / 9,
}));

const FLAKES = Array.from({ length: 34 }, (_, i) => ({
  x: ((i * 131) % 1000) / 1000,
  y: ((i * 61) % 1000) / 1000,
  r: 1 + ((i * 5) % 7) / 4,
  speed: 14 + ((i * 11) % 20),
  sway: 8 + ((i * 13) % 14),
  phase: (i % 7) / 7,
}));

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  /** Device-pixel-ratio actually used, capped for performance. */
  private dpr = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  /** Resizes the backing store. Call on mount, resize and orientation change. */
  resize(cssWidth: number, cssHeight: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(cssWidth * dpr));
    const height = Math.max(1, Math.round(cssHeight * dpr));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.dpr = dpr;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
  }

  /** View size in world units for the current canvas. */
  view(): { w: number; h: number; scale: number } {
    return viewSize(this.cssWidth, this.cssHeight);
  }

  draw(world: World, camera: Camera, options: RenderOptions): void {
    const ctx = this.ctx;
    const { scale } = this.view();
    const w = this.cssWidth;
    const h = this.cssHeight;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.drawSky(ctx, w, h, world.time, options);
    this.drawParallax(ctx, w, h, camera, options);

    // World space: 1 unit = 1 world pixel, scaled to the canvas.
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-camera.x, -camera.y);

    this.drawDecorations(ctx, camera, 'back');
    this.drawCottage(ctx, world);
    this.drawCheckpoints(ctx, world);
    this.drawPlatforms(ctx, world);
    this.drawMovingPlatforms(ctx, world);
    this.drawHazards(ctx, world);
    this.drawPresents(ctx, world);
    this.drawDecorations(ctx, camera, 'front');
    this.drawPrompts(ctx, camera);
    this.drawPlayer(ctx, world);

    ctx.restore();

    if (!options.reducedMotion) this.drawSnow(ctx, w, h, world.time, camera);
    if (world.phase === 'respawning') this.drawRespawnFlash(ctx, w, h, world);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Background
  // -------------------------------------------------------------------------

  private drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, options: RenderOptions): void {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0e1e30');
    sky.addColorStop(0.38, '#23374d');
    sky.addColorStop(0.68, '#5d4a5c');
    sky.addColorStop(0.88, '#b07a5e');
    sky.addColorStop(1, '#d59a6c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars, brighter towards the top of the dusk sky.
    for (const star of STARS) {
      const y = star.y * h;
      const twinkle = options.reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(time * 1.6 + star.phase * Math.PI * 2);
      ctx.globalAlpha = Math.max(0, (1 - y / (h * 0.62)) * 0.85) * twinkle;
      ctx.fillStyle = '#fff5e6';
      ctx.beginPath();
      ctx.arc(star.x * w, y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon
    const mx = w * 0.82;
    const my = h * 0.16;
    const glow = ctx.createRadialGradient(mx, my, 2, mx, my, 54);
    glow.addColorStop(0, 'rgba(255, 240, 210, 0.3)');
    glow.addColorStop(1, 'rgba(255, 240, 210, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8ea';
    ctx.beginPath();
    ctx.arc(mx, my, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawParallax(ctx: CanvasRenderingContext2D, w: number, h: number, camera: Camera, options: RenderOptions): void {
    const { scale } = this.view();
    const layers: { factor: number; color: string; baseline: number; height: number; step: number }[] = [
      { factor: 0.12, color: '#2c3f52', baseline: 0.74, height: 90, step: 230 },
      { factor: 0.28, color: '#223a40', baseline: 0.82, height: 70, step: 170 },
    ];
    for (const layer of layers) {
      const offset = options.reducedMotion ? 0 : camera.x * layer.factor * scale;
      const y = h * layer.baseline;
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      let x = -((offset % layer.step) + layer.step);
      ctx.lineTo(x, y);
      while (x < w + layer.step) {
        ctx.lineTo(x + layer.step * 0.5, y - layer.height);
        ctx.lineTo(x + layer.step, y);
        x += layer.step;
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      // Snow on the ridges.
      ctx.strokeStyle = 'rgba(244, 247, 250, 0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Distant tree line
    const offset = options.reducedMotion ? 0 : camera.x * 0.45 * scale;
    ctx.fillStyle = '#17302f';
    const baseY = h * 0.9;
    let x = -((offset % 46) + 46);
    while (x < w + 46) {
      const treeHeight = 34 + ((Math.abs(Math.round(x)) % 3) * 9);
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x + 14, baseY - treeHeight);
      ctx.lineTo(x + 28, baseY);
      ctx.closePath();
      ctx.fill();
      x += 46;
    }
    ctx.fillRect(0, baseY - 1, w, h - baseY + 1);
  }

  private drawSnow(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, camera: Camera): void {
    ctx.fillStyle = 'rgba(244, 247, 250, 0.55)';
    for (const flake of FLAKES) {
      const drift = (flake.x * w - camera.x * 0.25 + Math.sin(time * 0.6 + flake.phase * 6.28) * flake.sway) % (w + 40);
      const x = drift < 0 ? drift + w + 40 : drift;
      const y = (flake.y * h + time * flake.speed) % (h + 20);
      ctx.beginPath();
      ctx.arc(x - 20, y - 10, flake.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRespawnFlash(ctx: CanvasRenderingContext2D, w: number, h: number, world: World): void {
    // A short, gentle white veil — no long failure animation.
    const t = Math.max(0, Math.min(1, world.timer / 0.45));
    ctx.fillStyle = `rgba(244, 247, 250, ${0.35 * t})`;
    ctx.fillRect(0, 0, w, h);
  }

  // -------------------------------------------------------------------------
  // Level
  // -------------------------------------------------------------------------

  private visible(camera: Camera, x: number, w: number, pad = 160): boolean {
    return x + w > camera.x - pad && x < camera.x + camera.w + pad;
  }

  private drawPlatforms(ctx: CanvasRenderingContext2D, world: World): void {
    const widened = world.assistEnabled;
    for (const platform of LEVEL.platforms) {
      const rect = widened && platform.assistWidth
        ? { x: platform.x - (platform.assistWidth - platform.w) / 2, y: platform.y, w: platform.assistWidth, h: platform.h }
        : platform;
      if (platform.kind === 'block') this.drawLogStack(ctx, rect.x, rect.y, rect.w, rect.h);
      else this.drawSnowPlatform(ctx, rect.x, rect.y, rect.w, rect.h, platform.kind === 'ledge');
    }
  }

  private drawMovingPlatforms(ctx: CanvasRenderingContext2D, world: World): void {
    for (const rect of world.movingRects) {
      // A raft of packed snow on two logs — reads as "this one moves".
      ctx.fillStyle = WOOD;
      ctx.beginPath();
      ctx.roundRect(rect.x + 8, rect.y + rect.h - 4, rect.w - 16, 9, 4);
      ctx.fill();
      this.drawSnowPlatform(ctx, rect.x, rect.y, rect.w, rect.h, true);
      // Small flags at both ends so the direction of travel is easy to read.
      ctx.fillStyle = COAT;
      for (const x of [rect.x + 10, rect.x + rect.w - 10]) {
        ctx.beginPath();
        ctx.moveTo(x, rect.y - 2);
        ctx.lineTo(x, rect.y - 18);
        ctx.lineTo(x + 9, rect.y - 13);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawSnowPlatform(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, ledge: boolean): void {
    const radius = ledge ? 7 : 4;
    // Rock / earth body
    const body = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 120));
    body.addColorStop(0, ROCK);
    body.addColorStop(1, ROCK_DARK);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x, y + 4, w, h - 4, [0, 0, radius, radius]);
    ctx.fill();

    // Snow cap: the landing surface. Deliberately bright and solid, with a
    // flat top so it never looks like decorative drift.
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(x, y + 9);
    ctx.lineTo(x, y + 2);
    ctx.quadraticCurveTo(x + w * 0.25, y - 2, x + w * 0.5, y + 1);
    ctx.quadraticCurveTo(x + w * 0.75, y + 4, x + w, y + 1);
    ctx.lineTo(x + w, y + 10);
    ctx.quadraticCurveTo(x + w * 0.6, y + 14, x, y + 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SNOW_SHADE;
    ctx.fillRect(x, y + 9, w, 2.5);

    if (ledge && w > 60) {
      // A few small icicles under the lip (decoration only).
      ctx.fillStyle = 'rgba(168, 216, 236, 0.75)';
      for (let i = 1; i < 4; i++) {
        const ix = x + (w * i) / 4;
        ctx.beginPath();
        ctx.moveTo(ix - 3, y + h);
        ctx.lineTo(ix + 3, y + h);
        ctx.lineTo(ix, y + h + 7 + (i % 2) * 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawLogStack(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
    ctx.fillStyle = WOOD;
    ctx.beginPath();
    ctx.roundRect(x, y + 6, w, h - 6, 4);
    ctx.fill();
    ctx.fillStyle = '#6a5243';
    for (let i = 0; i < 3; i++) {
      const cx = x + 10 + i * ((w - 20) / 2);
      ctx.beginPath();
      ctx.arc(cx, y + h - 8, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#3a2c25';
    for (let i = 0; i < 3; i++) {
      const cx = x + 10 + i * ((w - 20) / 2);
      ctx.beginPath();
      ctx.arc(cx, y + h - 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Snow on top
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.roundRect(x - 2, y, w + 4, 9, 4);
    ctx.fill();
  }

  private drawHazards(ctx: CanvasRenderingContext2D, world: World): void {
    for (const hazard of world.hazardRects) {
      if (hazard.kind === 'icicles') {
        // Sharp ice shards growing out of the ground: cold blue, hard edges.
        const count = Math.max(3, Math.round(hazard.w / 14));
        for (let i = 0; i < count; i++) {
          const bx = hazard.x + (hazard.w * i) / count;
          const bw = hazard.w / count;
          const tip = hazard.y + hazard.h - (i % 2 === 0 ? hazard.h : hazard.h * 0.78);
          ctx.fillStyle = ICE;
          ctx.beginPath();
          ctx.moveTo(bx, hazard.y + hazard.h);
          ctx.lineTo(bx + bw, hazard.y + hazard.h);
          ctx.lineTo(bx + bw / 2, tip);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.moveTo(bx + bw * 0.42, hazard.y + hazard.h);
          ctx.lineTo(bx + bw * 0.58, hazard.y + hazard.h);
          ctx.lineTo(bx + bw / 2, tip);
          ctx.closePath();
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(16, 31, 37, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hazard.x, hazard.y + hazard.h);
        ctx.lineTo(hazard.x + hazard.w, hazard.y + hazard.h);
        ctx.stroke();
      } else {
        // Rolling snowball: packed snow with embedded ice, rotating with the
        // distance travelled so the motion is unmistakable.
        const r = hazard.w / 2;
        const cx = hazard.x + r;
        const cy = hazard.y + r;
        ctx.fillStyle = 'rgba(16, 31, 37, 0.25)';
        ctx.beginPath();
        ctx.ellipse(cx, hazard.y + hazard.h + 3, r * 0.9, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(hazard.x / r);
        ctx.fillStyle = SNOW;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ICE;
        for (const angle of [0.4, 2.1, 3.9, 5.3]) {
          ctx.beginPath();
          ctx.arc(Math.cos(angle) * r * 0.5, Math.sin(angle) * r * 0.5, r * 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(45, 59, 66, 0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  private drawPresents(ctx: CanvasRenderingContext2D, world: World): void {
    for (const present of LEVEL.presents) {
      if (world.presents.has(present.id)) continue;
      const bob = Math.sin(world.time * 2.2 + present.x) * 3;
      const x = present.x - 11;
      const y = present.y - 11 + bob;
      ctx.fillStyle = COAT_DARK;
      ctx.beginPath();
      ctx.roundRect(x, y, 22, 22, 3);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillRect(x + 9, y, 4, 22);
      ctx.fillRect(x, y + 9, 22, 4);
      ctx.beginPath();
      ctx.arc(x + 7, y - 2, 4, 0, Math.PI * 2);
      ctx.arc(x + 15, y - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCheckpoints(ctx: CanvasRenderingContext2D, world: World): void {
    const reachedRank = world.checkpoint?.rank ?? 0;
    for (const checkpoint of world.activeCheckpoints) {
      const lit = checkpoint.rank <= reachedRank;
      const x = checkpoint.x;
      const groundY = checkpoint.y;
      // Post
      ctx.fillStyle = WOOD;
      ctx.fillRect(x - 3, groundY - 56, 6, 56);
      ctx.fillStyle = lit ? GOLD : '#5a6a6a';
      ctx.beginPath();
      ctx.roundRect(x - 11, groundY - 78, 22, 26, 4);
      ctx.fill();
      ctx.fillStyle = lit ? WINDOW : '#3c4a4a';
      ctx.beginPath();
      ctx.roundRect(x - 7, groundY - 74, 14, 18, 3);
      ctx.fill();
      if (lit) {
        const glow = ctx.createRadialGradient(x, groundY - 65, 2, x, groundY - 65, 46);
        glow.addColorStop(0, 'rgba(255, 207, 122, 0.4)');
        glow.addColorStop(1, 'rgba(255, 207, 122, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, groundY - 65, 46, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = SNOW;
      ctx.beginPath();
      ctx.roundRect(x - 12, groundY - 82, 24, 5, 2);
      ctx.fill();
    }
  }

  private drawDecorations(ctx: CanvasRenderingContext2D, camera: Camera, layer: 'back' | 'front'): void {
    for (const decoration of LEVEL.decorations) {
      const isFront = decoration.kind === 'bush' || decoration.kind === 'stump';
      if ((layer === 'front') !== isFront) continue;
      if (!this.visible(camera, decoration.x - 40, 80)) continue;
      this.drawDecoration(ctx, decoration);
    }
  }

  private drawDecoration(ctx: CanvasRenderingContext2D, decoration: Decoration): void {
    const { x, y, scale } = decoration;
    switch (decoration.kind) {
      case 'tree': {
        const h = 96 * scale;
        const w = 46 * scale;
        ctx.fillStyle = WOOD;
        ctx.fillRect(x - 3 * scale, y - 8, 6 * scale, 10);
        for (let i = 0; i < 3; i++) {
          const tierY = y - 8 - (h * i) / 3.4;
          const tierW = w * (1 - i * 0.22);
          ctx.fillStyle = i === 0 ? TREE_DARK : TREE;
          ctx.beginPath();
          ctx.moveTo(x, tierY - h * 0.42);
          ctx.lineTo(x + tierW / 2, tierY);
          ctx.lineTo(x - tierW / 2, tierY);
          ctx.closePath();
          ctx.fill();
          // Snow on the branch tips
          ctx.fillStyle = SNOW;
          ctx.beginPath();
          ctx.moveTo(x - tierW / 2, tierY);
          ctx.quadraticCurveTo(x, tierY - h * 0.1, x + tierW / 2, tierY);
          ctx.quadraticCurveTo(x, tierY - h * 0.05, x - tierW / 2, tierY);
          ctx.closePath();
          ctx.fill();
        }
        return;
      }
      case 'lantern': {
        ctx.fillStyle = WOOD;
        ctx.fillRect(x - 2.5, y - 62, 5, 62);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.roundRect(x - 9, y - 82, 18, 22, 3);
        ctx.fill();
        ctx.fillStyle = WINDOW;
        ctx.beginPath();
        ctx.roundRect(x - 6, y - 79, 12, 16, 2);
        ctx.fill();
        const glow = ctx.createRadialGradient(x, y - 70, 2, x, y - 70, 52);
        glow.addColorStop(0, 'rgba(255, 207, 122, 0.28)');
        glow.addColorStop(1, 'rgba(255, 207, 122, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y - 70, 52, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = SNOW;
        ctx.beginPath();
        ctx.roundRect(x - 10, y - 86, 20, 5, 2);
        ctx.fill();
        return;
      }
      case 'stump': {
        ctx.fillStyle = WOOD;
        ctx.beginPath();
        ctx.roundRect(x - 11 * scale, y - 17 * scale, 22 * scale, 17 * scale, 3);
        ctx.fill();
        ctx.fillStyle = '#6a5243';
        ctx.beginPath();
        ctx.ellipse(x, y - 17 * scale, 11 * scale, 4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = SNOW;
        ctx.beginPath();
        ctx.ellipse(x, y - 18 * scale, 11 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      case 'bush':
      default: {
        ctx.fillStyle = TREE_DARK;
        ctx.beginPath();
        ctx.arc(x - 8 * scale, y - 7 * scale, 9 * scale, 0, Math.PI * 2);
        ctx.arc(x + 7 * scale, y - 6 * scale, 8 * scale, 0, Math.PI * 2);
        ctx.arc(x, y - 12 * scale, 10 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = SNOW;
        ctx.beginPath();
        ctx.arc(x - 3 * scale, y - 18 * scale, 6 * scale, 0, Math.PI * 2);
        ctx.arc(x + 7 * scale, y - 13 * scale, 4.5 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawPrompts(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const prompt of LEVEL.prompts) {
      const distance = Math.abs(prompt.x - (camera.x + camera.w / 2));
      const alpha = Math.max(0, Math.min(1, (camera.w * 0.6 - distance) / (camera.w * 0.25)));
      if (alpha <= 0.02) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '600 15px "Source Sans 3 Variable", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const width = ctx.measureText(prompt.text).width + 22;
      ctx.fillStyle = 'rgba(16, 31, 37, 0.82)';
      ctx.beginPath();
      ctx.roundRect(prompt.x - width / 2, prompt.y - 15, width, 30, 15);
      ctx.fill();
      ctx.strokeStyle = 'rgba(213, 180, 119, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#fff5e6';
      ctx.fillText(prompt.text, prompt.x, prompt.y + 1);
      ctx.restore();
    }
  }

  private drawCottage(ctx: CanvasRenderingContext2D, world: World): void {
    const { x, y } = LEVEL.goal;
    const delivered = world.phase === 'won' || world.deliveryProgress > 0.55;

    // Warm pool of light on the snow
    const pool = ctx.createRadialGradient(x, y, 4, x, y, 150);
    pool.addColorStop(0, 'rgba(255, 207, 122, 0.3)');
    pool.addColorStop(1, 'rgba(255, 207, 122, 0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(x, y, 150, 0, Math.PI * 2);
    ctx.fill();

    const bodyW = 136;
    const bodyH = 86;
    const left = x - bodyW / 2;
    const top = y - bodyH;

    // Chimney and smoke
    ctx.fillStyle = '#4b3a32';
    ctx.fillRect(left + bodyW - 38, top - 52, 18, 34);
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.roundRect(left + bodyW - 40, top - 56, 22, 6, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(244, 247, 250, 0.2)';
    for (let i = 0; i < 3; i++) {
      const t = (world.time * 0.5 + i * 0.33) % 1;
      ctx.beginPath();
      ctx.arc(left + bodyW - 29 + Math.sin(t * 6) * 10, top - 60 - t * 52, 6 + t * 9, 0, Math.PI * 2);
      ctx.fill();
    }

    // Walls
    ctx.fillStyle = '#5a3f33';
    ctx.beginPath();
    ctx.roundRect(left, top, bodyW, bodyH, [4, 4, 2, 2]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 31, 37, 0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(left, top + (bodyH * i) / 5);
      ctx.lineTo(left + bodyW, top + (bodyH * i) / 5);
      ctx.stroke();
    }

    // Roof
    ctx.fillStyle = '#3c2a26';
    ctx.beginPath();
    ctx.moveTo(left - 16, top + 4);
    ctx.lineTo(x, top - 46);
    ctx.lineTo(left + bodyW + 16, top + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = SNOW;
    ctx.lineWidth = 11;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(left - 13, top + 1);
    ctx.lineTo(x, top - 42);
    ctx.lineTo(left + bodyW + 13, top + 1);
    ctx.stroke();
    ctx.lineJoin = 'miter';

    // Windows
    for (const wx of [left + 24, left + bodyW - 44]) {
      ctx.fillStyle = WINDOW;
      ctx.beginPath();
      ctx.roundRect(wx, top + 22, 20, 24, 3);
      ctx.fill();
      ctx.strokeStyle = '#3c2a26';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx + 10, top + 22);
      ctx.lineTo(wx + 10, top + 46);
      ctx.moveTo(wx, top + 34);
      ctx.lineTo(wx + 20, top + 34);
      ctx.stroke();
      ctx.fillStyle = SNOW;
      ctx.beginPath();
      ctx.roundRect(wx - 2, top + 46, 24, 4, 2);
      ctx.fill();
    }

    // Door with a wreath; it opens when the sack is handed over.
    const doorW = 30;
    const doorLeft = x - doorW / 2;
    ctx.fillStyle = '#2a1d1a';
    ctx.beginPath();
    ctx.roundRect(doorLeft, y - 48, doorW, 48, [14, 14, 0, 0]);
    ctx.fill();
    if (!delivered) {
      ctx.fillStyle = COAT_DARK;
      ctx.beginPath();
      ctx.roundRect(doorLeft + 1.5, y - 46, doorW - 3, 46, [13, 13, 0, 0]);
      ctx.fill();
      ctx.strokeStyle = TREE;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y - 30, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(x + 9, y - 24, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Light spilling out of the open door, and the delivered sack.
      ctx.fillStyle = 'rgba(255, 207, 122, 0.85)';
      ctx.beginPath();
      ctx.roundRect(doorLeft + 1.5, y - 46, doorW - 3, 46, [13, 13, 0, 0]);
      ctx.fill();
      this.drawSack(ctx, x - 26, y - 2, 1);
    }
  }

  private drawSack(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#7a4a3a';
    ctx.beginPath();
    ctx.moveTo(-13, 0);
    ctx.quadraticCurveTo(-17, -20, -6, -24);
    ctx.quadraticCurveTo(0, -26, 6, -24);
    ctx.quadraticCurveTo(17, -20, 13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.roundRect(-8, -27, 16, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = '#5e3729';
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // The Samichlaus
  // -------------------------------------------------------------------------

  private drawPlayer(ctx: CanvasRenderingContext2D, world: World): void {
    const player = world.player;
    const cx = player.x + PLAYER_W / 2;
    const feetY = player.y + PLAYER_H;

    // Soft shadow on the surface below
    ctx.fillStyle = 'rgba(16, 31, 37, 0.3)';
    ctx.beginPath();
    ctx.ellipse(cx, feetY + 2, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (world.phase === 'respawning') {
      // Fading out gently at the fall position.
      ctx.globalAlpha = Math.max(0.15, world.timer / 0.45);
    }

    ctx.save();
    ctx.translate(cx, feetY);
    if (player.facing === -1) ctx.scale(-1, 1);

    // Landing squash, and a small idle bob.
    const squash = player.anim === 'land' ? 1 - Math.min(0.16, player.landTimer) : 1;
    const bob = player.anim === 'idle' ? Math.sin(world.time * 2.6) * 0.8 : 0;
    ctx.scale(1 / squash, squash);
    ctx.translate(0, bob);

    const running = player.anim === 'run';
    const cycle = running ? Math.sin(player.animTime * 14) : 0;
    const lean = running ? 0.06 * Math.sign(player.vx || 1) : 0;
    ctx.rotate(lean);

    this.drawSamichlausBody(ctx, player, cycle);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawSamichlausBody(ctx: CanvasRenderingContext2D, player: Player, cycle: number): void {
    const airborne = player.anim === 'jump' || player.anim === 'fall';
    const tuck = player.anim === 'jump' ? 5 : 0;

    // --- gift sack on his back -------------------------------------------
    ctx.save();
    ctx.translate(-13, -22);
    ctx.rotate(-0.18 + (airborne ? -0.12 : cycle * 0.04));
    this.drawSack(ctx, 0, 0, 0.78);
    ctx.restore();

    // --- legs and boots ---------------------------------------------------
    const legSwing = airborne ? 0 : cycle * 5;
    const legs: { x: number; lift: number }[] = airborne
      ? [
          { x: -5, lift: tuck + (player.anim === 'fall' ? 0 : 3) },
          { x: 5, lift: tuck },
        ]
      : [
          { x: -4 - legSwing * 0.4, lift: Math.max(0, legSwing) },
          { x: 4 + legSwing * 0.4, lift: Math.max(0, -legSwing) },
        ];
    for (const leg of legs) {
      ctx.fillStyle = '#2e2420';
      ctx.beginPath();
      ctx.roundRect(leg.x - 4.5, -10 - leg.lift, 9, 10, 2);
      ctx.fill();
      // Boot
      ctx.fillStyle = '#1d1715';
      ctx.beginPath();
      ctx.roundRect(leg.x - 5.5, -3.5 - leg.lift, 12, 5, [2, 3, 3, 2]);
      ctx.fill();
    }

    // --- coat --------------------------------------------------------------
    const coat = ctx.createLinearGradient(0, -34, 0, -6);
    coat.addColorStop(0, COAT);
    coat.addColorStop(1, COAT_DARK);
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-8, -34);
    ctx.quadraticCurveTo(-13, -18, -12, -8);
    ctx.quadraticCurveTo(0, -4, 12, -8);
    ctx.quadraticCurveTo(13, -18, 8, -34);
    ctx.closePath();
    ctx.fill();

    // Fur hem
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.ellipse(0, -8, 12.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belt
    ctx.fillStyle = '#2e2420';
    ctx.beginPath();
    ctx.roundRect(-12, -19, 24, 5, 1.5);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.roundRect(-3.5, -20, 7, 7, 1.5);
    ctx.fill();
    ctx.fillStyle = '#2e2420';
    ctx.beginPath();
    ctx.roundRect(-1.5, -18.5, 3, 4, 1);
    ctx.fill();

    // --- arms --------------------------------------------------------------
    const armAngle = airborne ? (player.anim === 'jump' ? -1.15 : -0.5) : cycle * 0.5;
    ctx.save();
    ctx.translate(7, -30);
    ctx.rotate(armAngle);
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.roundRect(-3.5, 0, 7, 15, 3.5);
    ctx.fill();
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.arc(0, 15, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(-7, -30);
    ctx.rotate(-armAngle * 0.7);
    ctx.fillStyle = COAT_DARK;
    ctx.beginPath();
    ctx.roundRect(-3.5, 0, 7, 14, 3.5);
    ctx.fill();
    ctx.restore();

    // --- head --------------------------------------------------------------
    ctx.fillStyle = '#f2cdad';
    ctx.beginPath();
    ctx.arc(0, -40, 9, 0, Math.PI * 2);
    ctx.fill();

    // Beard: big and round, the most recognisable part.
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(-9, -41);
    ctx.quadraticCurveTo(-11, -27, 0, -25);
    ctx.quadraticCurveTo(11, -27, 9, -41);
    ctx.quadraticCurveTo(5, -36, 0, -37);
    ctx.quadraticCurveTo(-5, -36, -9, -41);
    ctx.closePath();
    ctx.fill();
    // Moustache
    ctx.beginPath();
    ctx.ellipse(-3.2, -38.5, 3.4, 2.2, 0.2, 0, Math.PI * 2);
    ctx.ellipse(3.2, -38.5, 3.4, 2.2, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eyes, cheeks, nose
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(-3.2, -43.5, 1.3, 0, Math.PI * 2);
    ctx.arc(3.2, -43.5, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(184, 50, 63, 0.4)';
    ctx.beginPath();
    ctx.arc(-6, -41, 2.4, 0, Math.PI * 2);
    ctx.arc(6, -41, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0a383';
    ctx.beginPath();
    ctx.arc(0, -41, 2.1, 0, Math.PI * 2);
    ctx.fill();

    // --- hat ---------------------------------------------------------------
    ctx.fillStyle = COAT;
    ctx.beginPath();
    ctx.moveTo(-9.5, -47);
    ctx.quadraticCurveTo(-7, -60, 4, -62);
    ctx.quadraticCurveTo(12, -62, 9.5, -47);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.roundRect(-10.5, -49.5, 21, 5.5, 2.75);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(7, -62, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
}
