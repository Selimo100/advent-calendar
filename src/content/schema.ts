/**
 * Content model for calendar doors.
 *
 * One door holds one or more typed blocks. Media is referenced as ordinary
 * static paths under public/, e.g. { src: '/media/photos/winter.jpg', alt }.
 * Everything in this model ships in the public bundle — see the README for
 * what that means.
 *
 * All text is plain text. Paragraphs may use a tiny inline subset
 * (**bold**, *italic*), rendered without HTML (see inlineText.ts).
 */
import { z } from 'zod';
import { isPlaceholder } from './placeholders.ts';
import { parseSpotifyUrl } from './spotify.ts';

const text = (max: number) => z.string().trim().min(1).max(max);
const paragraphs = z.array(text(4000)).min(1).max(30);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

/** A Spotify link, or a visible placeholder such as "[SPOTIFY TRACK URL]". */
const spotifyLink = (kind: 'track' | 'playlist') =>
  z
    .string()
    .trim()
    .refine((value) => isPlaceholder(value) || parseSpotifyUrl(value, kind) !== null, {
      message: `Must be an https://open.spotify.com/${kind}/<id> link (or a [PLACEHOLDER])`,
    });

// ---------------------------------------------------------------------------
// Media references: static files under public/media/
// ---------------------------------------------------------------------------

const mediaPath = (folder: string, extensions: string) =>
  z
    .string()
    .trim()
    .regex(
      new RegExp(`^/media/${folder}/(?!.*\\.\\.)[A-Za-z0-9._\\- ]+\\.(${extensions})$`, 'i'),
      `Use a path like /media/${folder}/name.ext inside public/media/${folder}/`,
    );

export const photoSchema = z.strictObject({
  src: mediaPath('photos', 'jpg|jpeg|png|webp|avif|gif|svg'),
  alt: text(300),
  caption: text(200).optional(),
  /** Optional intrinsic size; keeps layout stable while the photo loads. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export const audioSchema = z.strictObject({
  src: mediaPath('audio', 'mp3|m4a|aac|wav|ogg|opus|webm'),
});

export type Photo = z.infer<typeof photoSchema>;
export type Audio = z.infer<typeof audioSchema>;

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const letter = z.strictObject({
  type: z.literal('letter'),
  title: text(160).optional(),
  paragraphs,
  signature: text(160).optional(),
});
const memory = z.strictObject({
  type: z.literal('memory'),
  title: text(160).optional(),
  photos: z.array(photoSchema).min(1).max(6),
  date: isoDate.optional(),
  dateLabel: text(80).optional(),
  location: text(120).optional(),
  story: paragraphs,
});
const song = z.strictObject({
  type: z.literal('song'),
  trackTitle: text(160),
  artist: text(160),
  spotifyUrl: spotifyLink('track'),
  artwork: photoSchema.optional(),
  intro: paragraphs.optional(),
  whyItRemindsUs: paragraphs,
});
const playlist = z.strictObject({
  type: z.literal('playlist'),
  title: text(160),
  spotifyUrl: spotifyLink('playlist'),
  intro: paragraphs,
  highlights: z
    .array(z.strictObject({ trackTitle: text(160), artist: text(160), note: text(300).optional() }))
    .max(20)
    .optional(),
});
const voucher = z.strictObject({
  type: z.literal('voucher'),
  title: text(160),
  description: text(1000),
  conditions: z.array(text(300)).max(8).optional(),
  note: text(1000).optional(),
});
const voice = z.strictObject({
  type: z.literal('voice'),
  title: text(160).optional(),
  intro: paragraphs.optional(),
  audio: audioSchema,
  durationLabel: text(20).optional(),
  transcript: paragraphs.optional(),
});
const activity = z.strictObject({
  type: z.literal('activity'),
  title: text(160),
  invitation: paragraphs,
  ideas: z.array(text(300)).max(10).optional(),
  note: text(600).optional(),
});
const reasons = z.strictObject({
  type: z.literal('reasons'),
  title: text(160).optional(),
  intro: text(1000).optional(),
  reasons: z.array(text(600)).min(1).max(30),
});
const finalLetter = z.strictObject({
  type: z.literal('finalLetter'),
  title: text(160),
  paragraphs,
  photo: photoSchema.optional(),
  finalSurprise: z.strictObject({ title: text(160), paragraphs }).optional(),
  signature: text(160).optional(),
});

export const blockSchema = z.discriminatedUnion('type', [
  letter,
  memory,
  song,
  playlist,
  voucher,
  voice,
  activity,
  reasons,
  finalLetter,
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block['type'];

// ---------------------------------------------------------------------------
// The Samichlaus game behind door 6
// ---------------------------------------------------------------------------

export const GAME_DAY = 6;

/**
 * Door 6 opens into a small platform game instead of showing its note
 * directly. The door's ordinary `blocks` are the reward: the interface shows
 * them only once the game has been finished. (This is an experience rule in
 * the frontend, not protection: the reward ships in the public bundle like
 * all other content.)
 */
export const gameSchema = z.strictObject({
  /** Shown when the door is opened, before the game starts. */
  intro: paragraphs,
  /** Label on the start button, e.g. "Mission starten". */
  startLabel: text(60),
  /** Shown on the victory screen, above the button to the personal note. */
  victoryText: text(600),
});
export type GameContent = z.infer<typeof gameSchema>;

// ---------------------------------------------------------------------------
// Doors and calendar
// ---------------------------------------------------------------------------

export const doorSchema = z.strictObject({
  day: z.number().int().min(1).max(24),
  title: text(160),
  blocks: z.array(blockSchema).min(1).max(8),
  game: gameSchema.optional(),
});
export type Door = z.infer<typeof doorSchema>;

export const calendarSettings = z.strictObject({
  recipientName: text(80),
  senderName: text(80),
  title: text(160),
  greeting: text(200),
  intro: text(600),
  signature: text(200),
  closingMessage: text(1200),
  footerNote: text(200).optional(),
});
export type CalendarSettings = z.infer<typeof calendarSettings>;

export const calendarSchema = z
  .strictObject({
    /** Stable identifier; part of the localStorage key for saved progress. */
    calendarId: z.string().regex(/^[a-z0-9-]{3,64}$/, 'Use lowercase letters, digits and dashes'),
    year: z.number().int().min(2024).max(2100),
    settings: calendarSettings,
    doors: z.array(doorSchema).length(24, 'Exactly 24 doors are required'),
  })
  .superRefine((calendar, ctx) => {
    const seen = new Set<number>();
    for (const door of calendar.doors) {
      if (seen.has(door.day)) {
        ctx.addIssue({ code: 'custom', path: ['doors'], message: `Day ${door.day} appears more than once` });
      }
      seen.add(door.day);
      if (door.day === GAME_DAY && !door.game) {
        ctx.addIssue({ code: 'custom', path: ['doors'], message: `Day ${GAME_DAY} needs a game definition (intro + reward)` });
      }
      if (door.day !== GAME_DAY && door.game) {
        ctx.addIssue({ code: 'custom', path: ['doors'], message: `Only day ${GAME_DAY} may define a game` });
      }
    }
    for (let day = 1; day <= 24; day++) {
      if (!seen.has(day)) ctx.addIssue({ code: 'custom', path: ['doors'], message: `Day ${day} is missing` });
    }
  });
export type Calendar = z.infer<typeof calendarSchema>;

/** Identity helper for the typed content file (gives autocomplete + checking). */
export function defineCalendar(calendar: Calendar): Calendar {
  return calendar;
}
