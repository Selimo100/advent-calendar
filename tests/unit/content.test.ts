import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import calendar from '../../src/content/calendar.ts';
import { parseInline } from '../../src/content/inlineText.ts';
import { findPlaceholders } from '../../src/content/placeholders.ts';
import { blockSchema, calendarSchema, GAME_DAY, type Block } from '../../src/content/schema.ts';
import { parseSpotifyUrl } from '../../src/content/spotify.ts';

const PUBLIC_DIR = path.resolve(import.meta.dirname, '../../public');

function mediaOf(block: Block): string[] {
  switch (block.type) {
    case 'memory':
      return block.photos.map((photo) => photo.src);
    case 'song':
      return block.artwork ? [block.artwork.src] : [];
    case 'voice':
      return [block.audio.src];
    case 'finalLetter':
      return block.photo ? [block.photo.src] : [];
    default:
      return [];
  }
}

describe('calendar content', () => {
  it('passes the schema with exactly 24 doors, each day once', () => {
    const result = calendarSchema.safeParse(calendar);
    expect(result.success).toBe(true);
    expect(calendar.doors).toHaveLength(24);
    expect(calendar.doors.map((d) => d.day).sort((a, b) => a - b)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });

  it('rejects missing and duplicated days', () => {
    const doors = [...calendar.doors];
    doors[3] = { ...doors[3]!, day: 3 };
    const result = calendarSchema.safeParse({ ...calendar, doors });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/Day 3 appears more than once/);
    expect(JSON.stringify(result.error?.issues)).toMatch(/Day 4 is missing/);
  });

  it('covers every supported block type', () => {
    const types = new Set(calendar.doors.flatMap((d) => d.blocks.map((b) => b.type)));
    expect([...types].sort()).toEqual([
      'activity',
      'finalLetter',
      'letter',
      'memory',
      'playlist',
      'reasons',
      'song',
      'voice',
      'voucher',
    ]);
  });

  it('requires text and rejects unknown fields', () => {
    expect(blockSchema.safeParse({ type: 'letter', paragraphs: ['x'], html: '<b>x</b>' }).success).toBe(false);
    expect(blockSchema.safeParse({ type: 'letter', paragraphs: [] }).success).toBe(false);
    expect(blockSchema.safeParse({ type: 'letter', paragraphs: ['   '] }).success).toBe(false);
    expect(blockSchema.safeParse({ type: 'nonsense', paragraphs: ['x'] }).success).toBe(false);
  });

  it('only accepts media paths inside public/media with sane extensions', () => {
    const memory = (src: string) => blockSchema.safeParse({ type: 'memory', photos: [{ src, alt: 'x' }], story: ['x'] }).success;
    expect(memory('/media/photos/winter.jpg')).toBe(true);
    expect(memory('/media/photos/a-b_c 1.png')).toBe(true);
    for (const bad of [
      '/media/photos/../../.env',
      'media/photos/winter.jpg',
      '/media/audio/winter.jpg',
      '/photos/winter.jpg',
      'https://example.com/winter.jpg',
      '/media/photos/script.js',
      'javascript:alert(1)',
    ]) {
      expect(memory(bad), bad).toBe(false);
    }
    const voice = (src: string) => blockSchema.safeParse({ type: 'voice', audio: { src } }).success;
    expect(voice('/media/audio/hallo.mp3')).toBe(true);
    expect(voice('/media/photos/hallo.mp3')).toBe(false);
  });

  it('requires alt text on every image', () => {
    expect(blockSchema.safeParse({ type: 'memory', photos: [{ src: '/media/photos/a.jpg' }], story: ['x'] }).success).toBe(false);
    for (const door of calendar.doors) {
      for (const block of door.blocks) {
        if (block.type === 'memory') for (const photo of block.photos) expect(photo.alt.length).toBeGreaterThan(0);
        if (block.type === 'song' && block.artwork) expect(block.artwork.alt.length).toBeGreaterThan(0);
        if (block.type === 'finalLetter' && block.photo) expect(block.photo.alt.length).toBeGreaterThan(0);
      }
    }
  });

  it('validates Spotify track and playlist links specifically', () => {
    expect(parseSpotifyUrl('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc', 'track')).toEqual({
      id: '4uLU6hMCjMI75M1A2tKUQC',
      url: 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
    });
    expect(parseSpotifyUrl('https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC', 'track')).not.toBeNull();
    for (const bad of [
      'http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC',
      'https://evil.example/track/4uLU6hMCjMI75M1A2tKUQC',
      'javascript:alert(1)',
      'https://open.spotify.com/track/short',
      'https://open.spotify.com/playlist/4uLU6hMCjMI75M1A2tKUQC',
    ]) {
      expect(parseSpotifyUrl(bad, 'track'), bad).toBeNull();
    }
    const song = { type: 'song', trackTitle: 'a', artist: 'b', whyItRemindsUs: ['c'] };
    expect(blockSchema.safeParse({ ...song, spotifyUrl: 'https://evil.example/x' }).success).toBe(false);
    // Visible placeholders are allowed while the calendar is being written.
    expect(blockSchema.safeParse({ ...song, spotifyUrl: '[SPOTIFY TRACK URL]' }).success).toBe(true);
  });

  it('references only media files that exist in public/media', () => {
    const missing = calendar.doors
      .flatMap((door) => door.blocks.flatMap(mediaOf))
      .filter((src) => !existsSync(path.join(PUBLIC_DIR, src)));
    expect(missing).toEqual([]);
  });
});

describe('the day 6 game definition', () => {
  const door = calendar.doors.find((d) => d.day === GAME_DAY)!;

  it('exists on day 6 with an intro, a start label and victory text', () => {
    expect(door.game).toBeDefined();
    expect(door.game!.intro.length).toBeGreaterThan(0);
    expect(door.game!.startLabel.length).toBeGreaterThan(0);
    expect(door.game!.victoryText.length).toBeGreaterThan(0);
  });

  it('has reward blocks in the ordinary content model', () => {
    expect(door.blocks.length).toBeGreaterThan(0);
    for (const block of door.blocks) expect(blockSchema.safeParse(block).success).toBe(true);
  });

  it('is the only door allowed to define a game', () => {
    const doors = calendar.doors.map((d) => (d.day === 7 ? { ...d, game: door.game } : d));
    const result = calendarSchema.safeParse({ ...calendar, doors });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/Only day 6 may define a game/);
  });

  it('requires a game on day 6', () => {
    const doors = calendar.doors.map((d) => (d.day === GAME_DAY ? { ...d, game: undefined } : d));
    const result = calendarSchema.safeParse({ ...calendar, doors });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/needs a game definition/);
  });
});

describe('German text conventions', () => {
  it('never uses the sharp s in visible content', () => {
    const text = JSON.stringify(calendar);
    expect(text).not.toMatch(/ß/);
  });

  it('keeps umlauts intact', () => {
    expect(JSON.stringify(calendar)).toMatch(/[äöü]/);
  });
});

describe('inline text', () => {
  it('parses bold and italic without interpreting HTML', () => {
    expect(parseInline('a **b** *c* <script>')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' ' },
      { text: 'c', italic: true },
      { text: ' <script>' },
    ]);
  });

  it('finds placeholders by path', () => {
    expect(findPlaceholders({ a: ['x [NAME] y'] })).toEqual([{ path: 'a[0]', token: '[NAME]' }]);
  });
});
