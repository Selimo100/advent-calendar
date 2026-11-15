import { describe, expect, it } from 'vitest';
import { LEVEL, MANDATORY_JUMPS, platformById, sectionNameAt } from '../../src/games/samichlaus/level.ts';
import { jumpReach, type Input } from '../../src/games/samichlaus/physics.ts';
import { ASSIST_TUNING, BASE_TUNING, PLAYER_H, PLAYER_W } from '../../src/games/samichlaus/tuning.ts';
import { World } from '../../src/games/samichlaus/world.ts';

const STEP = 1 / 120;

describe('level geometry', () => {
  it('declares every mandatory jump with the gap and height the level actually has', () => {
    for (const jump of MANDATORY_JUMPS) {
      const from = platformById(jump.from)!;
      const to = platformById(jump.to)!;
      expect(from, jump.from).toBeDefined();
      expect(to, jump.to).toBeDefined();
      // A jump off the moving platform happens at its far end; a jump onto it
      // happens at its near end.
      const fromRight = 'toX' in from ? from.toX + from.w : from.x + from.w;
      const toLeft = to.x;
      expect(toLeft - fromRight, `${jump.from} -> ${jump.to} gap`).toBe(jump.gap);
      expect(to.y - from.y, `${jump.from} -> ${jump.to} height`).toBe(jump.dy);
    }
  });

  it('keeps every mandatory jump comfortably within reach', () => {
    for (const jump of MANDATORY_JUMPS) {
      // Needed: cross the gap and get the whole collision box onto the ledge.
      const needed = jump.gap + PLAYER_W;
      const reach = jumpReach(BASE_TUNING, jump.dy);
      expect(reach, `${jump.from} -> ${jump.to} (${jump.note})`).toBeGreaterThan(needed + 24);
      expect(jumpReach(ASSIST_TUNING, jump.dy)).toBeGreaterThan(reach);
    }
  });

  it('has three sections, one handcrafted level and no duplicate platform ids', () => {
    expect(LEVEL.sections).toHaveLength(3);
    const ids = [...LEVEL.platforms, ...LEVEL.moving].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(sectionNameAt(0)).toBe(LEVEL.sections[0]!.name);
    expect(sectionNameAt(LEVEL.width)).toBe(LEVEL.sections[2]!.name);
  });

  it('has one or two normal checkpoints plus an assist-only one, in order', () => {
    const normal = LEVEL.checkpoints.filter((c) => !c.assistOnly);
    expect(normal.length).toBeGreaterThanOrEqual(1);
    expect(normal.length).toBeLessThanOrEqual(2);
    expect(LEVEL.checkpoints.filter((c) => c.assistOnly)).toHaveLength(1);
    const ranks = LEVEL.checkpoints.map((c) => c.rank);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    // Every checkpoint spawn must stand on something solid.
    for (const checkpoint of LEVEL.checkpoints) {
      const support = LEVEL.platforms.find(
        (p) => checkpoint.spawnX + PLAYER_W > p.x && checkpoint.spawnX < p.x + p.w && p.y >= checkpoint.spawnY,
      );
      expect(support, `checkpoint ${checkpoint.id} has no ground below its spawn`).toBeDefined();
    }
  });

  it('places the finish on the last platform and presents outside the required path', () => {
    const goalPlatform = LEVEL.platforms.find((p) => LEVEL.goal.x > p.x && LEVEL.goal.x < p.x + p.w);
    expect(goalPlatform).toBeDefined();
    expect(LEVEL.presents.length).toBeGreaterThan(0);
    // Presents hover above the ground, so they are collected by choice.
    for (const present of LEVEL.presents) expect(present.y).toBeLessThan(500);
  });

  it('never puts a hazard where the player respawns', () => {
    for (const checkpoint of LEVEL.checkpoints) {
      for (const hazard of LEVEL.hazards) {
        const left = hazard.patrol ? hazard.patrol.from : hazard.x;
        const right = (hazard.patrol ? hazard.patrol.to : hazard.x) + hazard.w;
        const overlapping = checkpoint.spawnX + PLAYER_W > left - 40 && checkpoint.spawnX < right + 40;
        const sameHeight = Math.abs(hazard.y - checkpoint.spawnY) < PLAYER_H + 20;
        expect(overlapping && sameHeight, `${checkpoint.id} spawns into ${hazard.id}`).toBe(false);
      }
    }
  });
});

/**
 * A simple bot that finishes the level: it runs right, jumps when the ground
 * ahead runs out or an obstacle is in the way, and waits at the chasm for the
 * snow raft. If this ever stops reaching the cottage, the level became
 * unfinishable — which is exactly what the test is for.
 */
function playThrough(options: { assist: boolean; startCheckpointId?: string | null; maxSeconds?: number }) {
  const world = new World({ assist: options.assist, startCheckpointId: options.startCheckpointId ?? null });
  const maxSteps = Math.round((options.maxSeconds ?? 180) / STEP);
  let holdJump = 0;
  const visitedCheckpoints: string[] = [];
  let falls = 0;

  for (let i = 0; i < maxSteps; i++) {
    const player = world.player;
    const feet = player.y + PLAYER_H;
    const solids = [...world.solidPlatforms, ...world.movingRects];

    /** Is there solid ground under this x, at roughly the player's level? */
    const groundAt = (x: number) =>
      solids.some((s) => x > s.x && x < s.x + s.w && s.y >= feet - 6 && s.y < feet + 90);
    /** Something to climb over directly ahead. */
    const wallAhead = solids.some(
      (s) =>
        s.y < feet - 6 &&
        s.y > feet - 60 &&
        player.x + PLAYER_W + 14 > s.x &&
        player.x + PLAYER_W < s.x + s.w,
    );
    /** A hazard close ahead at this height. */
    const hazardAhead = world.hazardRects.some(
      (h) => h.x > player.x && h.x - player.x < 70 && Math.abs(h.y + h.h - feet) < 46,
    );

    const edgeAhead = !groundAt(player.x + PLAYER_W + 16);
    let wantJump = false;
    let moveRight = true;

    if (player.grounded || player.coyote > 0) {
      if (wallAhead || hazardAhead) wantJump = true;
      else if (edgeAhead) {
        // Only commit to the jump once there is a landing spot within reach.
        const landing = solids.find((s) => s.x > player.x + PLAYER_W && s.x - (player.x + PLAYER_W) < 120 && s.y <= feet + 60);
        if (landing) wantJump = true;
        else {
          // Nothing reachable yet (the raft is still away): hold position.
          moveRight = false;
        }
      }
    }

    if (wantJump) holdJump = Math.round(0.32 / STEP);
    const input: Input = {
      left: false,
      right: moveRight,
      jumpPressed: wantJump,
      jumpHeld: holdJump > 0,
    };
    if (holdJump > 0) holdJump -= 1;

    for (const event of world.step(input, STEP)) {
      if (event.type === 'checkpoint' && event.checkpoint) visitedCheckpoints.push(event.checkpoint.id);
      if (event.type === 'fall') falls += 1;
    }
    if (world.phase === 'won') {
      return { won: true, seconds: i * STEP, visitedCheckpoints, falls, world };
    }
  }
  return { won: false, seconds: maxSteps * STEP, visitedCheckpoints, falls, world };
}

describe('playing the level through', () => {
  it('can be finished in normal mode, reaching both normal checkpoints', () => {
    const result = playThrough({ assist: false });
    expect(result.won, `bot stopped at x=${Math.round(result.world.player.x)} of ${LEVEL.goal.x}`).toBe(true);
    expect(result.visitedCheckpoints).toContain('cp1');
    expect(result.visitedCheckpoints).toContain('cp2');
  });

  it('can be finished in assist mode as well (assist never skips the finish)', () => {
    const result = playThrough({ assist: true });
    expect(result.won).toBe(true);
    expect(result.world.phase).toBe('won');
  });

  it('takes a plausible amount of time for an uninterrupted run', () => {
    const result = playThrough({ assist: false });
    // The target is roughly 2–4 minutes for a person; a bot that never
    // hesitates should be well under that but not trivially short.
    expect(result.seconds).toBeGreaterThan(40);
    expect(result.seconds).toBeLessThan(180);
  });

  it('can be finished starting from the second checkpoint', () => {
    const result = playThrough({ assist: false, startCheckpointId: 'cp2' });
    expect(result.won).toBe(true);
    expect(result.world.player.x).toBeGreaterThan(LEVEL.goal.x - 120);
  });
});

describe('falls and checkpoints', () => {
  it('respawns at the last checkpoint with cleared velocity, not at the start', () => {
    const world = new World({ assist: false, startCheckpointId: 'cp1' });
    const checkpoint = LEVEL.checkpoints.find((c) => c.id === 'cp1')!;
    // Walk off into the chasm.
    world.player.x = 2700;
    world.player.y = LEVEL.deathY + 10;
    world.player.vy = 400;
    world.player.vx = 200;
    const events = world.step({ left: false, right: false, jumpPressed: false, jumpHeld: false }, STEP);
    expect(events.some((e) => e.type === 'fall')).toBe(true);
    expect(world.phase).toBe('respawning');
    // Let the short respawn pause run out.
    for (let i = 0; i < 120; i++) world.step({ left: false, right: false, jumpPressed: false, jumpHeld: false }, STEP);
    expect(world.phase).toBe('playing');
    expect(world.player.x).toBe(checkpoint.spawnX);
    expect(world.player.vx).toBe(0);
    expect(world.player.vy).toBeGreaterThanOrEqual(0);
    expect(world.falls).toBe(1);
  });

  it('counts a hazard as a fall and keeps the checkpoint', () => {
    const world = new World({ assist: false, startCheckpointId: 'cp2' });
    const snowball = LEVEL.hazards.find((h) => h.kind === 'snowball')!;
    world.player.x = snowball.x;
    world.player.y = snowball.y;
    const events = world.step({ left: false, right: false, jumpPressed: false, jumpHeld: false }, STEP);
    expect(events.some((e) => e.type === 'fall')).toBe(true);
    expect(world.checkpoint?.id).toBe('cp2');
  });

  it('never moves a checkpoint backwards', () => {
    const world = new World({ assist: false, startCheckpointId: 'cp2' });
    expect(world.checkpoint?.rank).toBe(2);
    const first = LEVEL.checkpoints.find((c) => c.id === 'cp1')!;
    world.player.x = first.x;
    world.player.y = first.y - PLAYER_H;
    for (let i = 0; i < 10; i++) world.step({ left: false, right: false, jumpPressed: false, jumpHeld: false }, STEP);
    expect(world.checkpoint?.id).toBe('cp2');
  });

  it('ignores the assist-only checkpoint in normal mode', () => {
    const normal = new World({ assist: false, startCheckpointId: 'cp3' });
    expect(normal.checkpoint).toBeNull();
    expect(normal.player.x).toBe(LEVEL.spawn.x);
    const assisted = new World({ assist: true, startCheckpointId: 'cp3' });
    expect(assisted.checkpoint?.id).toBe('cp3');
  });
});

describe('victory', () => {
  it('only wins from a genuine finish, after the delivery animation', () => {
    const world = new World({ assist: false, startCheckpointId: 'cp2' });
    world.player.x = LEVEL.goal.zone.x + 10;
    world.player.y = LEVEL.goal.zone.y + 10;
    const idle: Input = { left: false, right: false, jumpPressed: false, jumpHeld: false };
    world.step(idle, STEP);
    expect(world.phase).toBe('delivering');
    // The reward is not unlocked while the delivery is still playing.
    let victories = 0;
    for (let i = 0; i < 400; i++) {
      for (const event of world.step(idle, STEP)) if (event.type === 'victory') victories += 1;
    }
    expect(victories).toBe(1);
    expect(world.phase).toBe('won');
    expect(world.deliveryProgress).toBe(1);
  });

  it('cannot be triggered by standing anywhere else', () => {
    const world = new World({ assist: false });
    for (let i = 0; i < 240; i++) world.step({ left: false, right: false, jumpPressed: false, jumpHeld: false }, STEP);
    expect(world.phase).toBe('playing');
  });
});

describe('presents', () => {
  it('are optional and collected at most once', () => {
    const world = new World({ assist: false });
    const present = LEVEL.presents[0]!;
    world.player.x = present.x - PLAYER_W / 2;
    world.player.y = present.y - PLAYER_H / 2;
    const idle: Input = { left: false, right: false, jumpPressed: false, jumpHeld: false };
    let collected = 0;
    for (let i = 0; i < 5; i++) {
      for (const event of world.step(idle, STEP)) if (event.type === 'present') collected += 1;
    }
    expect(collected).toBe(1);
    expect(world.presents.size).toBe(1);
  });

  it('are not needed to win', () => {
    const result = playThrough({ assist: false });
    expect(result.won).toBe(true);
    expect(result.world.presents.size).toBeLessThan(LEVEL.presents.length + 1);
  });
});
