/**
 * Visual design of the village. Purely decorative, contains no content.
 *
 * VILLAGE_ORDER is a fixed (never random) arrangement of doors 1–23. Door 24
 * is always the large house at the end. Keyboard / screen-reader order follows
 * the visual order, and every door is labelled with its number.
 */
export const VILLAGE_ORDER: readonly number[] = [
  7, 13, 2, 18, 10, 5, 21, 1, 15, 9, 20, 3, 12, 17, 6, 22, 11, 4, 16, 8, 19, 14, 23,
];
export const GRAND_DOOR = 24;

export type Roof = 'gable' | 'steep' | 'dome' | 'stepped' | 'hip';

export interface HouseDesign {
  roof: Roof;
  tall: boolean;
  wall: string;
  roofColor: string;
  chimney: boolean;
  tree: 'left' | 'right' | null;
  sideWindows: boolean;
}

const ROOFS: Roof[] = ['gable', 'steep', 'dome', 'stepped', 'hip'];
const WALLS = ['#2c4a42', '#5a3a33', '#36495a', '#6b5a49', '#4a3b4f', '#3f5a4c'];
const ROOF_COLORS = ['#2a2f35', '#5e2430', '#3d3128', '#283c3a'];

export function houseDesign(day: number): HouseDesign {
  return {
    roof: ROOFS[(day * 7 + 3) % ROOFS.length]!,
    tall: (day * 5) % 3 !== 0,
    wall: WALLS[(day * 11) % WALLS.length]!,
    roofColor: ROOF_COLORS[(day * 3) % ROOF_COLORS.length]!,
    chimney: day % 3 === 1,
    tree: day % 4 === 0 ? 'left' : day % 5 === 2 ? 'right' : null,
    sideWindows: day % 2 === 0,
  };
}

/** Door rectangle inside the 100×140 house viewBox, as CSS percentages. */
export const HOUSE_DOOR = { left: '34%', top: '62.86%', width: '32%', height: '25.71%' } as const;
/** Door rectangle inside the 300×160 grand-house viewBox. */
export const GRAND_DOOR_RECT = { left: '43.33%', top: '63.75%', width: '13.33%', height: '27.5%' } as const;
