/**
 * Validates src/content/calendar.ts before a build:
 *   - the Zod schema (24 doors, every day once, valid block types, required
 *     text, Spotify track / playlist URLs, a game definition for day 6),
 *   - every referenced photo and audio file actually exists in public/media/,
 *   - every image has alt text,
 *   - a readiness report: which doors still contain [PLACEHOLDERS].
 *
 * It never prints content text — only paths, days and placeholder tokens — so
 * the output is safe to paste anywhere.
 *
 * Usage: npm run content:validate  [--strict]
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import calendar from '../src/content/calendar.ts';
import { findPlaceholders } from '../src/content/placeholders.ts';
import { calendarSchema, GAME_DAY, type Block } from '../src/content/schema.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const strict = process.argv.includes('--strict');

const errors: string[] = [];
const warnings: string[] = [];

// --- 1. schema -------------------------------------------------------------
const parsed = calendarSchema.safeParse(calendar);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    errors.push(`schema ${issue.path.join('.') || '(root)'}: ${issue.message}`);
  }
}

// --- 2. media references ---------------------------------------------------
function mediaOf(block: Block): string[] {
  switch (block.type) {
    case 'memory':
      return [
        ...(block.photos ?? []).map((photo) => photo.src),
        ...(block.videos ?? []).flatMap((video) => (video.poster ? [video.src, video.poster] : [video.src])),
      ];
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

const referenced = new Set<string>();
for (const door of calendar.doors) {
  for (const block of door.blocks) {
    for (const src of mediaOf(block)) {
      referenced.add(src);
      const file = path.join(PUBLIC_DIR, src);
      if (!file.startsWith(PUBLIC_DIR) || !existsSync(file)) {
        errors.push(`door ${door.day}: media file is missing: public${src}`);
      }
    }
  }
}

// --- 3. the day 6 game -----------------------------------------------------
const gameDoor = calendar.doors.find((door) => door.day === GAME_DAY);
if (!gameDoor?.game) {
  errors.push(`door ${GAME_DAY}: needs a game definition (intro, startLabel, victoryText)`);
} else if (gameDoor.blocks.length === 0) {
  errors.push(`door ${GAME_DAY}: needs reward blocks (the note unlocked by finishing the game)`);
}

// --- 4. readiness report ---------------------------------------------------
interface DoorReport {
  day: number;
  tokens: string[];
  mediaPlaceholders: string[];
}

const reports: DoorReport[] = calendar.doors.map((door) => {
  const tokens = [...new Set(findPlaceholders(door).map((hit) => hit.token))];
  const mediaPlaceholders = door.blocks
    .flatMap(mediaOf)
    .filter((src) => /placeholder-/.test(path.basename(src)))
    .map((src) => path.basename(src));
  return { day: door.day, tokens, mediaPlaceholders };
});

const settingsTokens = [...new Set(findPlaceholders(calendar.settings).map((hit) => hit.token))];
const ready = reports.filter((report) => report.tokens.length === 0 && report.mediaPlaceholders.length === 0);

// --- output ----------------------------------------------------------------
console.log(`Calendar "${calendar.calendarId}" (${calendar.year}) — ${calendar.doors.length} doors`);
console.log(`Media referenced: ${referenced.size} file(s) under public/media/`);
console.log('');

if (settingsTokens.length) {
  warnings.push(`settings still contain placeholders: ${settingsTokens.join(' ')}`);
}
for (const report of reports) {
  const parts: string[] = [];
  if (report.tokens.length) parts.push(report.tokens.join(' '));
  if (report.mediaPlaceholders.length) parts.push(`example media: ${report.mediaPlaceholders.join(', ')}`);
  if (parts.length) warnings.push(`door ${String(report.day).padStart(2, ' ')}: ${parts.join(' · ')}`);
}

console.log(`Personalised doors: ${ready.length} of 24${ready.length ? ` (${ready.map((r) => r.day).join(', ')})` : ''}`);

if (warnings.length) {
  console.log('\nStill to personalise:');
  for (const warning of warnings) console.log(`  · ${warning}`);
}

if (errors.length) {
  console.error('\nContent validation FAILED:');
  for (const error of errors) console.error(`  ✗ ${error}`);
  process.exit(1);
}

if (strict && warnings.length) {
  console.error('\n--strict: every door and the settings must be personalised.');
  process.exit(1);
}

console.log('\nContent validation passed.');
