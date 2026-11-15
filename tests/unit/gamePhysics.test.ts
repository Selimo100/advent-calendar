import { describe, expect, it } from 'vitest';
import { createPlayer, jumpReach, resetPlayer, stepPlayer, type Input, type Solid } from '../../src/games/samichlaus/physics.ts';
import { ASSIST_TUNING, BASE_TUNING, PLAYER_H, PLAYER_W } from '../../src/games/samichlaus/tuning.ts';

const STEP = 1 / 120;
const GROUND_Y = 400;
const ground: Solid[] = [{ id: 'ground', x: -500, y: GROUND_Y, w: 3000, h: 200 }];

const none: Input = { left: false, right: false, jumpPressed: false, jumpHeld: false };
const right: Input = { ...none, right: true };
const jump: Input = { ...none, jumpPressed: true, jumpHeld: true };

function onGround(x = 0) {
  const player = createPlayer(x, GROUND_Y - PLAYER_H);
  // One step to establish grounded contact.
  stepPlayer(player, none, ground, BASE_TUNING, STEP);
  return player;
}

function run(player: ReturnType<typeof createPlayer>, input: Input, seconds: number, solids = ground, tuning = BASE_TUNING) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) stepPlayer(player, input, solids, tuning, STEP);
  return player;
}

describe('horizontal movement', () => {
  it('accelerates to a stable maximum speed and no further', () => {
    const player = onGround();
    run(player, right, 0.5);
    expect(player.vx).toBeCloseTo(BASE_TUNING.maxSpeed, 1);
    run(player, right, 2);
    expect(player.vx).toBeCloseTo(BASE_TUNING.maxSpeed, 1);
  });

  it('decelerates to a standstill without sliding on ordinary snow', () => {
    const player = onGround();
    run(player, right, 1);
    run(player, none, 0.4);
    expect(player.vx).toBe(0);
    const x = player.x;
    run(player, none, 1);
    expect(player.x).toBe(x);
  });

  it('faces the direction of travel', () => {
    const player = onGround();
    run(player, right, 0.2);
    expect(player.facing).toBe(1);
    run(player, { ...none, left: true }, 0.4);
    expect(player.facing).toBe(-1);
  });
});

describe('jumping', () => {
  it('reaches a useful height and comes back down', () => {
    const player = onGround();
    const startY = player.y;
    stepPlayer(player, jump, ground, BASE_TUNING, STEP);
    let highest = player.y;
    for (let i = 0; i < 200; i++) {
      stepPlayer(player, { ...none, jumpHeld: true }, ground, BASE_TUNING, STEP);
      highest = Math.min(highest, player.y);
    }
    expect(startY - highest).toBeGreaterThan(95);
    expect(startY - highest).toBeLessThan(130);
    expect(player.grounded).toBe(true);
    expect(player.y).toBeCloseTo(startY, 5);
  });

  it('gives a lower jump when the button is released early (variable height)', () => {
    const peak = (holdSeconds: number) => {
      const player = onGround();
      const startY = player.y;
      stepPlayer(player, jump, ground, BASE_TUNING, STEP);
      let highest = player.y;
      const holdSteps = Math.round(holdSeconds / STEP);
      for (let i = 0; i < 200; i++) {
        stepPlayer(player, { ...none, jumpHeld: i < holdSteps }, ground, BASE_TUNING, STEP);
        highest = Math.min(highest, player.y);
      }
      return startY - highest;
    };
    const short = peak(0.06);
    const full = peak(1);
    expect(short).toBeLessThan(full * 0.65);
    expect(short).toBeGreaterThan(18);
  });

  it('cannot jump twice in the air', () => {
    const player = onGround();
    stepPlayer(player, jump, ground, BASE_TUNING, STEP);
    run(player, { ...none, jumpHeld: true }, 0.2);
    const vyBefore = player.vy;
    stepPlayer(player, jump, ground, BASE_TUNING, STEP);
    expect(player.vy).toBeGreaterThan(vyBefore - 1);
  });

  it('respects terminal falling speed', () => {
    const player = createPlayer(0, 0);
    run(player, none, 4, []);
    expect(player.vy).toBeCloseTo(BASE_TUNING.terminalVelocity, 1);
  });
});

describe('coyote time', () => {
  const platform: Solid[] = [{ id: 'edge', x: 0, y: GROUND_Y, w: 200, h: 100 }];

  /** Walks off the right edge, waits, then presses jump. */
  function jumpAfterLeavingEdge(delay: number, tuning = BASE_TUNING) {
    const player = createPlayer(150, GROUND_Y - PLAYER_H);
    stepPlayer(player, none, platform, tuning, STEP);
    // Walk right until the ground runs out from under him.
    for (let i = 0; i < 600 && player.grounded; i++) {
      stepPlayer(player, right, platform, tuning, STEP);
    }
    expect(player.grounded).toBe(false);
    const steps = Math.round(delay / STEP);
    for (let i = 0; i < steps; i++) stepPlayer(player, right, platform, tuning, STEP);
    const vyBefore = player.vy;
    stepPlayer(player, { ...right, jumpPressed: true, jumpHeld: true }, platform, tuning, STEP);
    return { jumped: player.vy < vyBefore && player.vy < 0, vy: player.vy };
  }

  it('allows a jump shortly after walking off an edge', () => {
    expect(jumpAfterLeavingEdge(0.05).jumped).toBe(true);
    expect(jumpAfterLeavingEdge(0.1).jumped).toBe(true);
  });

  it('does not allow a jump long after leaving the edge', () => {
    expect(jumpAfterLeavingEdge(0.25).jumped).toBe(false);
  });

  it('is more forgiving in assist mode', () => {
    expect(jumpAfterLeavingEdge(0.18, BASE_TUNING).jumped).toBe(false);
    expect(jumpAfterLeavingEdge(0.18, ASSIST_TUNING).jumped).toBe(true);
  });
});

describe('jump buffering', () => {
  /** Presses jump while still falling, `before` seconds ahead of landing. */
  function jumpBeforeLanding(before: number, tuning = BASE_TUNING) {
    const fallHeight = 120;
    const player = createPlayer(0, GROUND_Y - PLAYER_H - fallHeight);
    // Fall until the remaining time to landing is about `before`.
    while (true) {
      const remaining = (GROUND_Y - PLAYER_H - player.y) / Math.max(player.vy, 1);
      if (remaining <= before) break;
      stepPlayer(player, none, ground, tuning, STEP);
      if (player.grounded) break;
    }
    expect(player.grounded).toBe(false);
    stepPlayer(player, jump, ground, tuning, STEP);
    // Keep falling / landing for a moment with jump no longer pressed.
    for (let i = 0; i < 30; i++) stepPlayer(player, { ...none, jumpHeld: true }, ground, tuning, STEP);
    return player.y < GROUND_Y - PLAYER_H - 10;
  }

  it('turns a slightly early press into a jump on landing', () => {
    expect(jumpBeforeLanding(0.06)).toBe(true);
  });

  it('forgets a press made far too early', () => {
    expect(jumpBeforeLanding(0.4)).toBe(false);
  });

  it('buffers longer in assist mode', () => {
    expect(jumpBeforeLanding(0.17, BASE_TUNING)).toBe(false);
    expect(jumpBeforeLanding(0.17, ASSIST_TUNING)).toBe(true);
  });
});

describe('collision', () => {
  it('lands on top of a platform instead of passing through it', () => {
    const player = createPlayer(50, 0);
    run(player, none, 2);
    expect(player.grounded).toBe(true);
    expect(player.y + PLAYER_H).toBeCloseTo(GROUND_Y, 3);
  });

  it('does not tunnel through a thin platform at terminal speed', () => {
    const thin: Solid[] = [{ id: 'thin', x: -200, y: GROUND_Y, w: 800, h: 16 }];
    const player = createPlayer(50, -1200);
    run(player, none, 5, thin);
    expect(player.grounded).toBe(true);
    expect(player.y + PLAYER_H).toBeCloseTo(GROUND_Y, 3);
  });

  it('stops at a wall without losing vertical position', () => {
    const wall: Solid[] = [...ground, { id: 'wall', x: 300, y: GROUND_Y - 80, w: 40, h: 80 }];
    const player = onGround(100);
    run(player, right, 3, wall);
    expect(player.x + PLAYER_W).toBeCloseTo(300, 3);
    expect(player.vx).toBe(0);
    expect(player.grounded).toBe(true);
  });

  it('bumps its head on a ceiling without sticking', () => {
    const ceiling: Solid[] = [...ground, { id: 'roof', x: -100, y: GROUND_Y - 70, w: 600, h: 20 }];
    const player = onGround();
    stepPlayer(player, jump, ceiling, BASE_TUNING, STEP);
    run(player, { ...none, jumpHeld: true }, 0.5, ceiling);
    expect(player.y).toBeGreaterThanOrEqual(GROUND_Y - 70 + 20 - 0.01);
    run(player, none, 1, ceiling);
    expect(player.grounded).toBe(true);
  });

  it('is carried along by a moving platform', () => {
    const raft = (dx: number, x: number): Solid[] => [{ id: 'raft', x, y: GROUND_Y, w: 150, h: 20, dx }];
    const player = createPlayer(50, GROUND_Y - PLAYER_H);
    let x = 0;
    stepPlayer(player, none, raft(0, x), BASE_TUNING, STEP);
    expect(player.ridingId).toBe('raft');
    const startX = player.x;
    for (let i = 0; i < 120; i++) {
      const dx = 52 * STEP;
      x += dx;
      stepPlayer(player, none, raft(dx, x), BASE_TUNING, STEP);
    }
    expect(player.x - startX).toBeCloseTo(52 * 1, 0);
    expect(player.grounded).toBe(true);
  });
});

describe('respawn', () => {
  it('clears position, velocity and input state', () => {
    const player = onGround();
    run(player, right, 1);
    stepPlayer(player, jump, ground, BASE_TUNING, STEP);
    expect(player.vx).not.toBe(0);
    resetPlayer(player, 1760, 520);
    expect(player).toMatchObject({ x: 1760, y: 520, vx: 0, vy: 0, grounded: false, coyote: 0, buffer: 0, jumpHeld: false, ridingId: null });
  });

  it('does not keep a buffered jump across a respawn', () => {
    const player = onGround();
    stepPlayer(player, jump, ground, BASE_TUNING, STEP);
    resetPlayer(player, 0, GROUND_Y - PLAYER_H - 200);
    const startY = player.y;
    run(player, none, 0.1, []);
    expect(player.y).toBeGreaterThan(startY);
  });
});

describe('jump reach helper', () => {
  it('reports a shorter reach when landing higher and a longer one when landing lower', () => {
    const up = jumpReach(BASE_TUNING, -36);
    const level = jumpReach(BASE_TUNING, 0);
    const down = jumpReach(BASE_TUNING, 40);
    expect(up).toBeLessThan(level);
    expect(level).toBeLessThan(down);
  });

  it('is at least as forgiving in assist mode', () => {
    for (const dy of [-36, 0, 40]) {
      expect(jumpReach(ASSIST_TUNING, dy)).toBeGreaterThan(jumpReach(BASE_TUNING, dy));
    }
  });
});
