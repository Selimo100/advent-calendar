/**
 * The handcrafted level: "Durch den verschneiten Winterwald".
 *
 * Coordinates are world pixels, y grows downwards, and a platform's `y` is its
 * top (landing) surface. Three sections:
 *
 *   1. x      0 – 2520   Introduction: movement, jumping, a longer jump and two
 *                        visible obstacles. Forgiving platforms, short prompts.
 *   2. x 2520 – 5060     Main challenge: wider gaps, a climb, a chasm crossed
 *                        by one predictable snow raft, a timed jump off it, a
 *                        patrolling snowball, and a checkpoint afterwards.
 *   3. x 5060 – 8460     Final delivery: everything combined — icicles, a
 *                        second raft, another climb and snowball — then the
 *                        warmly lit cottage.
 *
 * Every mandatory jump is listed in MANDATORY_JUMPS and verified against the
 * real physics in tests/unit/gameLevel.test.ts, which also checks that the
 * listed jumps still match actual platform edges. The same test plays the
 * whole level through with a bot, so an unfinishable level fails the suite.
 *
 * Tuning the difficulty: widen or narrow the gaps here, or change the
 * movement values in tuning.ts. Keep mandatory gaps at or below about 100 px
 * when landing higher, and 110 px when landing lower.
 */

export interface Platform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Wider variant used in assist mode (grows symmetrically). */
  assistWidth?: number;
  /** 'ground' reaches below the view, 'ledge' is a floating snow shelf. */
  kind: 'ground' | 'ledge' | 'block';
}

export interface MovingPlatform {
  id: string;
  /** Left end of the travel range (also the starting position). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Right end of the travel range (the platform's left edge at that end). */
  toX: number;
  /** Pixels per second. */
  speed: number;
}

export interface Hazard {
  id: string;
  kind: 'icicles' | 'snowball';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Patrol range for 'snowball' (left and right bound of its left edge). */
  patrol?: { from: number; to: number; speed: number };
}

export interface Checkpoint {
  id: string;
  /** Human-readable name, used in the pause menu. */
  label: string;
  /** Order; a higher rank is later in the level. */
  rank: number;
  /** Trigger position (the lantern) and the spawn it grants. */
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  /** Only active in assist mode. */
  assistOnly?: boolean;
}

export interface Present {
  id: string;
  x: number;
  y: number;
}

export interface Prompt {
  x: number;
  y: number;
  text: string;
}

export interface Decoration {
  kind: 'tree' | 'lantern' | 'stump' | 'bush';
  x: number;
  /** Ground line the decoration stands on. */
  y: number;
  scale: number;
}

export interface Level {
  width: number;
  /** Falling below this line counts as a fall. */
  deathY: number;
  spawn: { x: number; y: number };
  platforms: Platform[];
  moving: MovingPlatform[];
  hazards: Hazard[];
  checkpoints: Checkpoint[];
  presents: Present[];
  prompts: Prompt[];
  decorations: Decoration[];
  /** The cottage and the zone that triggers the delivery. */
  goal: { x: number; y: number; zone: { x: number; y: number; w: number; h: number } };
  sections: { name: string; from: number }[];
}

export const LEVEL: Level = {
  width: 8460,
  deathY: 780,
  spawn: { x: 90, y: 528 },

  platforms: [
    // --- Section 1: Verschneiter Waldweg ----------------------------------
    { id: 'g1', kind: 'ground', x: 0, y: 560, w: 620, h: 220 },
    { id: 'g2', kind: 'ground', x: 676, y: 560, w: 280, h: 220 },
    { id: 'g3', kind: 'ground', x: 1028, y: 532, w: 330, h: 248 },
    { id: 'o1', kind: 'block', x: 1166, y: 498, w: 60, h: 34 },
    { id: 'g4', kind: 'ground', x: 1454, y: 560, w: 300, h: 220 },
    { id: 'g5', kind: 'ground', x: 1830, y: 532, w: 260, h: 248 },
    { id: 'o2', kind: 'block', x: 1930, y: 498, w: 60, h: 34 },
    { id: 'g6', kind: 'ground', x: 2178, y: 560, w: 340, h: 220 },

    // --- Section 2: Über die Schlucht -------------------------------------
    { id: 'p1', kind: 'ledge', x: 2598, y: 532, w: 160, h: 22, assistWidth: 200 },
    { id: 'p2', kind: 'ledge', x: 2834, y: 496, w: 150, h: 22, assistWidth: 190 },
    { id: 'p3', kind: 'ledge', x: 3060, y: 460, w: 160, h: 22 },
    { id: 'g7', kind: 'ground', x: 3736, y: 500, w: 320, h: 280 },
    { id: 'p4', kind: 'ledge', x: 4140, y: 468, w: 140, h: 22, assistWidth: 180 },
    { id: 'p5', kind: 'ledge', x: 4356, y: 436, w: 140, h: 22, assistWidth: 180 },
    { id: 'g8', kind: 'ground', x: 4596, y: 476, w: 430, h: 304 },

    // --- Section 3: Die Lieferung -----------------------------------------
    { id: 'p6', kind: 'ledge', x: 5110, y: 444, w: 150, h: 22, assistWidth: 190 },
    { id: 'g9', kind: 'ground', x: 5340, y: 476, w: 380, h: 304 },
    { id: 'p7', kind: 'ledge', x: 5804, y: 444, w: 150, h: 22, assistWidth: 190 },
    { id: 'g10', kind: 'ground', x: 6524, y: 476, w: 300, h: 304 },
    { id: 'p8', kind: 'ledge', x: 6908, y: 444, w: 140, h: 22, assistWidth: 180 },
    { id: 'p9', kind: 'ledge', x: 7132, y: 412, w: 140, h: 22, assistWidth: 180 },
    { id: 'g11', kind: 'ground', x: 7376, y: 452, w: 430, h: 328 },
    { id: 'g12', kind: 'ground', x: 7902, y: 484, w: 480, h: 296 },
  ],

  moving: [
    // Two rafts of packed snow drifting across the chasms. Both are slow and
    // fully visible from the ledge before the jump.
    { id: 'm1', x: 3244, y: 478, w: 150, h: 22, toX: 3504, speed: 52 },
    { id: 'm2', x: 6042, y: 452, w: 140, h: 22, toX: 6302, speed: 60 },
  ],

  hazards: [
    // The patrol ranges deliberately stop well before the checkpoint
    // lanterns, so a respawn can never drop the player into a snowball.
    { id: 'h1', kind: 'snowball', x: 4634, y: 444, w: 32, h: 32, patrol: { from: 4634, to: 4850, speed: 68 } },
    { id: 'i1', kind: 'icicles', x: 5444, y: 450, w: 56, h: 26 },
    { id: 'i2', kind: 'icicles', x: 6640, y: 450, w: 56, h: 26 },
    { id: 'h2', kind: 'snowball', x: 7416, y: 420, w: 32, h: 32, patrol: { from: 7416, to: 7620, speed: 72 } },
  ],

  checkpoints: [
    { id: 'cp1', label: 'Waldrand', rank: 1, x: 2440, y: 560, spawnX: 2410, spawnY: 520 },
    { id: 'cp2', label: 'Laternenweg', rank: 2, x: 4980, y: 476, spawnX: 4950, spawnY: 436 },
    { id: 'cp3', label: 'Letzte Laterne', rank: 3, x: 7760, y: 452, spawnX: 7730, spawnY: 412, assistOnly: true },
  ],

  presents: [
    { id: 'pr1', x: 1300, y: 440 },
    { id: 'pr2', x: 3140, y: 380 },
    { id: 'pr3', x: 7854, y: 400 },
  ],

  prompts: [
    { x: 150, y: 496, text: 'Lauf nach rechts' },
    { x: 470, y: 496, text: 'Jetzt springen' },
    { x: 1060, y: 468, text: 'Länger drücken = höher' },
    { x: 1500, y: 496, text: 'Etwas mehr Anlauf' },
    { x: 3140, y: 416, text: 'Warte auf das Schneefloss' },
    { x: 4660, y: 400, text: 'Dem Schneeball ausweichen' },
    { x: 5420, y: 414, text: 'Über die Eiszapfen' },
  ],

  decorations: [
    { kind: 'tree', x: 60, y: 560, scale: 1.3 },
    { kind: 'tree', x: 230, y: 560, scale: 0.95 },
    { kind: 'bush', x: 360, y: 560, scale: 1 },
    { kind: 'lantern', x: 540, y: 560, scale: 1 },
    { kind: 'tree', x: 760, y: 560, scale: 1.15 },
    { kind: 'stump', x: 880, y: 560, scale: 1 },
    { kind: 'tree', x: 1080, y: 532, scale: 1.25 },
    { kind: 'tree', x: 1330, y: 532, scale: 0.9 },
    { kind: 'lantern', x: 1700, y: 560, scale: 1 },
    { kind: 'tree', x: 1860, y: 532, scale: 1.35 },
    { kind: 'bush', x: 2050, y: 532, scale: 0.9 },
    { kind: 'tree', x: 2220, y: 560, scale: 1.1 },
    { kind: 'stump', x: 2330, y: 560, scale: 0.9 },
    { kind: 'tree', x: 3790, y: 500, scale: 1.2 },
    { kind: 'bush', x: 4020, y: 500, scale: 1 },
    { kind: 'tree', x: 4640, y: 476, scale: 1.1 },
    { kind: 'tree', x: 5400, y: 476, scale: 1.25 },
    { kind: 'bush', x: 5660, y: 476, scale: 1 },
    { kind: 'tree', x: 6580, y: 476, scale: 1.15 },
    { kind: 'stump', x: 6780, y: 476, scale: 0.9 },
    { kind: 'tree', x: 7420, y: 452, scale: 1.3 },
    { kind: 'bush', x: 7620, y: 452, scale: 1 },
    { kind: 'tree', x: 7950, y: 484, scale: 1.15 },
    { kind: 'tree', x: 8320, y: 484, scale: 0.95 },
    { kind: 'bush', x: 8200, y: 484, scale: 1 },
  ],

  goal: {
    x: 8060,
    y: 484,
    zone: { x: 8030, y: 416, w: 90, h: 70 },
  },

  sections: [
    { name: 'Verschneiter Waldweg', from: 0 },
    { name: 'Über die Schlucht', from: 2520 },
    { name: 'Die Lieferung', from: 5060 },
  ],
};

export interface MandatoryJump {
  /** Platform the jump starts from (take-off at its right edge). */
  from: string;
  /** Platform the jump lands on (at its left edge). */
  to: string;
  /** Horizontal gap in pixels. */
  gap: number;
  /** Height change: negative = landing higher than take-off. */
  dy: number;
  note: string;
}

/**
 * Every jump the player must make to finish. `gap` and `dy` are checked
 * against the real platform geometry in the tests, so these numbers cannot
 * drift away from the level.
 */
export const MANDATORY_JUMPS: readonly MandatoryJump[] = [
  { from: 'g1', to: 'g2', gap: 56, dy: 0, note: 'Erster, kurzer Sprung' },
  { from: 'g2', to: 'g3', gap: 72, dy: -28, note: 'Sprung mit kleiner Stufe' },
  { from: 'g3', to: 'g4', gap: 96, dy: 28, note: 'Etwas längerer Sprung' },
  { from: 'g4', to: 'g5', gap: 76, dy: -28, note: 'Zurück auf die Anhöhe' },
  { from: 'g5', to: 'g6', gap: 88, dy: 28, note: 'Ende von Abschnitt 1' },
  { from: 'g6', to: 'p1', gap: 80, dy: -28, note: 'Erste Felskante' },
  { from: 'p1', to: 'p2', gap: 76, dy: -36, note: 'Aufstieg 1' },
  { from: 'p2', to: 'p3', gap: 76, dy: -36, note: 'Aufstieg 2' },
  { from: 'p3', to: 'm1', gap: 24, dy: 18, note: 'Auf das erste Schneefloss' },
  { from: 'm1', to: 'g7', gap: 82, dy: 22, note: 'Vom Floss herunter (Timing)' },
  { from: 'g7', to: 'p4', gap: 84, dy: -32, note: 'Laternenweg hinauf' },
  { from: 'p4', to: 'p5', gap: 76, dy: -32, note: 'Aufstieg 3' },
  { from: 'p5', to: 'g8', gap: 100, dy: 40, note: 'Weiter Sprung hinunter' },
  { from: 'g8', to: 'p6', gap: 84, dy: -32, note: 'Nach dem Schneeball' },
  { from: 'p6', to: 'g9', gap: 80, dy: 32, note: 'Hinunter zum Eiszapfenweg' },
  { from: 'g9', to: 'p7', gap: 84, dy: -32, note: 'Nach den Eiszapfen' },
  { from: 'p7', to: 'm2', gap: 88, dy: 8, note: 'Auf das zweite Schneefloss' },
  { from: 'm2', to: 'g10', gap: 82, dy: 24, note: 'Vom zweiten Floss (Timing)' },
  { from: 'g10', to: 'p8', gap: 84, dy: -32, note: 'Letzter Aufstieg 1' },
  { from: 'p8', to: 'p9', gap: 84, dy: -32, note: 'Letzter Aufstieg 2' },
  { from: 'p9', to: 'g11', gap: 104, dy: 40, note: 'Weiter Sprung zum Schneeball' },
  { from: 'g11', to: 'g12', gap: 96, dy: 32, note: 'Letzter Sprung zur Hütte' },
];

export function platformById(id: string): Platform | MovingPlatform | undefined {
  return LEVEL.platforms.find((p) => p.id === id) ?? LEVEL.moving.find((p) => p.id === id);
}

export function sectionNameAt(x: number): string {
  let name = LEVEL.sections[0]!.name;
  for (const section of LEVEL.sections) if (x >= section.from) name = section.name;
  return name;
}
