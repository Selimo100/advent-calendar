import path from 'node:path';
import { describe, expect, it } from 'vitest';
import example from '../../content/example/calendar.ts';
import { parseInline } from '../../shared/content/inlineText.ts';
import { findPlaceholders } from '../../shared/content/placeholders.ts';
import { authoringBlock, authoringCalendar } from '../../shared/content/schema.ts';
import { parseSpotifyUrl } from '../../shared/content/spotify.ts';
import { formatReport, validateCalendar } from '../../tools/content/readiness.ts';

const mediaDir = path.resolve(import.meta.dirname, '../../content/example/media');

describe('content schema', () => {
  it('accepts the fictional example calendar with all 24 doors', () => {
    const result = authoringCalendar.safeParse(example);
    expect(result.success).toBe(true);
  });

  it('covers every supported block type in the example', () => {
    const types = new Set(example.doors.flatMap((d) => d.blocks.map((b) => b.type)));
    expect([...types].sort()).toEqual(['activity', 'finalLetter', 'letter', 'memory', 'playlist', 'reasons', 'song', 'voice', 'voucher']);
  });

  it('rejects missing and duplicated days', () => {
    const doors = [...example.doors];
    doors[3] = { ...doors[3]!, day: 3 };
    const result = authoringCalendar.safeParse({ ...example, doors });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/Day 3 appears more than once/);
    expect(JSON.stringify(result.error?.issues)).toMatch(/Day 4 is missing/);
  });

  it('rejects unknown fields and unsafe media paths', () => {
    expect(authoringBlock.safeParse({ type: 'letter', paragraphs: ['x'], html: '<b>x</b>' }).success).toBe(false);
    expect(
      authoringBlock.safeParse({ type: 'memory', photos: [{ file: '../../.env', alt: 'x' }], story: ['x'] }).success,
    ).toBe(false);
  });

  it('validates Spotify links specifically', () => {
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
      expect(parseSpotifyUrl(bad, 'track')).toBeNull();
    }
    const song = { type: 'song', trackTitle: 'a', artist: 'b', whyItRemindsUs: ['c'] };
    expect(authoringBlock.safeParse({ ...song, spotifyUrl: 'https://evil.example/x' }).success).toBe(false);
    expect(authoringBlock.safeParse({ ...song, spotifyUrl: '[SPOTIFY TRACK URL]' }).success).toBe(true);
  });
});

describe('readiness report', () => {
  it('flags placeholders and placeholder media in the example', () => {
    const report = validateCalendar(example, mediaDir);
    expect(report.valid).toBe(true);
    // Only the two generic activities (no personal facts) are complete as written.
    expect(report.doors.filter((d) => d.ready).map((d) => d.day)).toEqual([8, 19]);
    expect(report.doors.find((d) => d.day === 4)!.problems.join('\n')).toMatch(/placeholder media placeholder-winter-walk\.svg/);
    expect(report.settingsProblems.join()).toMatch(/\[NAME\]/);
  });

  it('never prints content text, only paths and tokens', () => {
    const output = formatReport(validateCalendar(example, mediaDir), 'example');
    expect(output).not.toContain('Ich kümmere mich um den Rest');
    expect(output).not.toContain('Willkommen im Dorf');
  });

  it('reports a fully personalised door as ready', () => {
    const door = { day: 2, title: 'Ein Titel', blocks: [{ type: 'letter' as const, paragraphs: ['Ein echter Text.'] }] };
    const report = validateCalendar({ ...example, doors: example.doors.map((d) => (d.day === 2 ? door : d)) }, mediaDir);
    expect(report.doors.find((d) => d.day === 2)!.ready).toBe(true);
  });

  it('finds placeholders by path', () => {
    expect(findPlaceholders({ a: ['x [NAME] y'] })).toEqual([{ path: 'a[0]', token: '[NAME]' }]);
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
});
