/**
 * npm run content:init-private
 * Creates content/private/calendar.ts (gitignored) from the fictional example
 * and an empty content/private/media/ folder. Never overwrites existing files.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../tools/content/source.ts';

const privateDir = path.join(REPO_ROOT, 'content', 'private');
const target = path.join(privateDir, 'calendar.ts');
if (existsSync(target)) {
  console.log('content/private/calendar.ts already exists — nothing changed.');
  process.exit(0);
}
await mkdir(path.join(privateDir, 'media'), { recursive: true });
const example = await readFile(path.join(REPO_ROOT, 'content', 'example', 'calendar.ts'), 'utf8');
await writeFile(
  target,
  example.replace(
    /^\/\*\*[\s\S]*?\*\//,
    '/**\n * PRIVATE CONTENT — this folder is gitignored. Do not commit it.\n * Replace every [PLACEHOLDER]; check progress with `npm run content:validate`.\n * Put photos and voice messages in content/private/media/ and reference them\n * by relative path, e.g. { file: "photos/day-04.jpg", alt: "..." }.\n */',
  ),
);
// Copy the example media so that the template validates until you replace it.
for (const file of ['placeholder-record.svg', 'placeholder-winter-walk.svg', 'placeholder-window.svg', 'placeholder-market.svg', 'placeholder-cocoa.svg', 'placeholder-stars.svg', 'placeholder-voice.wav']) {
  await copyFile(path.join(REPO_ROOT, 'content', 'example', 'media', file), path.join(privateDir, 'media', file));
}
console.log('Created content/private/calendar.ts and content/private/media/.');
console.log('Next: personalise it, then run `npm run content:validate`.');
