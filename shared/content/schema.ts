/**
 * Content model for calendar doors.
 *
 * One door holds one or more typed blocks. The same block shapes exist in three
 * stages that differ only in how media is referenced:
 *   - authoring  (content files):   { file: "photos/x.jpg", alt }
 *   - stored     (database jsonb):  { media: "<media key>", alt }
 *   - delivered  (API response):    { mediaId, src: "/api/media/<id>", width, height, alt }
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
// Media references per stage
// ---------------------------------------------------------------------------

const safeRelativeFile = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^(?!\/)(?!.*\.\.)[A-Za-z0-9._\-/ ]+$/, 'Use a relative path inside the media folder');

export const authoringPhoto = z.strictObject({
  file: safeRelativeFile,
  alt: text(300),
  caption: text(200).optional(),
});
export const authoringAudio = z.strictObject({ file: safeRelativeFile });

const mediaKey = z.string().regex(/^[a-f0-9]{32}$/);
export const storedPhoto = z.strictObject({ media: mediaKey, alt: text(300), caption: text(200).optional() });
export const storedAudio = z.strictObject({ media: mediaKey });

export const deliveredPhoto = z.strictObject({
  mediaId: z.uuid(),
  src: z.string().startsWith('/api/media/'),
  alt: text(300),
  caption: text(200).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export const deliveredAudio = z.strictObject({
  mediaId: z.uuid(),
  src: z.string().startsWith('/api/media/'),
  mimeType: z.string(),
});

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function blockSchemas<P extends z.ZodType, A extends z.ZodType>(photo: P, audio: A) {
  const letter = z.strictObject({
    type: z.literal('letter'),
    title: text(160).optional(),
    paragraphs,
    signature: text(160).optional(),
  });
  const memory = z.strictObject({
    type: z.literal('memory'),
    title: text(160).optional(),
    photos: z.array(photo).min(1).max(6),
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
    artwork: photo.optional(),
    intro: paragraphs.optional(),
    whyItRemindsUs: paragraphs,
  });
  const playlist = z.strictObject({
    type: z.literal('playlist'),
    title: text(160),
    spotifyUrl: spotifyLink('playlist'),
    intro: paragraphs,
    highlights: z.array(z.strictObject({ trackTitle: text(160), artist: text(160), note: text(300).optional() })).max(20).optional(),
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
    audio,
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
    photo: photo.optional(),
    finalSurprise: z.strictObject({ title: text(160), paragraphs }).optional(),
    signature: text(160).optional(),
  });
  return z.discriminatedUnion('type', [letter, memory, song, playlist, voucher, voice, activity, reasons, finalLetter]);
}

export const authoringBlock = blockSchemas(authoringPhoto, authoringAudio);
export const storedBlock = blockSchemas(storedPhoto, storedAudio);
export const deliveredBlock = blockSchemas(deliveredPhoto, deliveredAudio);

export type AuthoringBlock = z.infer<typeof authoringBlock>;
export type StoredBlock = z.infer<typeof storedBlock>;
export type DeliveredBlock = z.infer<typeof deliveredBlock>;
export type BlockType = DeliveredBlock['type'];
export type DeliveredPhoto = z.infer<typeof deliveredPhoto>;
export type DeliveredAudio = z.infer<typeof deliveredAudio>;

// ---------------------------------------------------------------------------
// Doors and calendar
// ---------------------------------------------------------------------------

const doorFields = { day: z.number().int().min(1).max(24), title: text(160) };

export const authoringDoor = z.strictObject({ ...doorFields, blocks: z.array(authoringBlock).min(1).max(8) });
export const storedDoor = z.strictObject({ ...doorFields, blocks: z.array(storedBlock).min(1).max(8) });

export type AuthoringDoor = z.infer<typeof authoringDoor>;
export type StoredDoor = z.infer<typeof storedDoor>;

/** Personal settings. Stored server-side; only sent to a signed-in recipient. */
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

export const authoringCalendar = z
  .strictObject({
    calendarId: z.string().regex(/^[a-z0-9-]{3,64}$/, 'Use lowercase letters, digits and dashes'),
    year: z.number().int().min(2024).max(2100),
    recipientSlug: z.string().regex(/^[a-z0-9-]{1,40}$/),
    settings: calendarSettings,
    doors: z.array(authoringDoor).length(24, 'Exactly 24 doors are required'),
  })
  .superRefine((calendar, ctx) => {
    const seen = new Set<number>();
    for (const door of calendar.doors) {
      if (seen.has(door.day)) {
        ctx.addIssue({ code: 'custom', path: ['doors'], message: `Day ${door.day} appears more than once` });
      }
      seen.add(door.day);
    }
    for (let day = 1; day <= 24; day++) {
      if (!seen.has(day)) ctx.addIssue({ code: 'custom', path: ['doors'], message: `Day ${day} is missing` });
    }
  });
export type AuthoringCalendar = z.infer<typeof authoringCalendar>;

/** Identity helper for typed content files. */
export function defineCalendar(calendar: AuthoringCalendar): AuthoringCalendar {
  return calendar;
}
