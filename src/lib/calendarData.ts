/**
 * Access to the bundled calendar content. The content file is validated once
 * at startup; `npm run content:validate` (part of the build) runs the same
 * schema plus media checks ahead of time.
 */
import rawCalendar from '../content/calendar.ts';
import { calendarSchema, GAME_DAY, type Block, type Calendar, type Door, type GameContent } from '../content/schema.ts';
import { decemberDate, toIsoDate } from './time.ts';

export const CALENDAR: Calendar = calendarSchema.parse(rawCalendar);

export { GAME_DAY };

const byDay = new Map<number, Door>(CALENDAR.doors.map((door) => [door.day, door]));

export function getDoor(day: number): Door | undefined {
  return byDay.get(day);
}

/** What the surprise dialog shows for one door. */
export interface DoorContent {
  day: number;
  title: string;
  /** ISO date of the door (YYYY-MM-DD). */
  date: string;
  layout: 'standard' | 'final';
  blocks: Block[];
  /** Present only on the game door (day 6). */
  game?: GameContent;
}

export function doorContent(day: number): DoorContent | null {
  const door = byDay.get(day);
  if (!door) return null;
  return {
    day,
    title: door.title,
    date: toIsoDate(decemberDate(CALENDAR.year, day)),
    layout: day === 24 ? 'final' : 'standard',
    blocks: door.blocks,
    game: door.game,
  };
}
