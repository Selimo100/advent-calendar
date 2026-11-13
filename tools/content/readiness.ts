/**
 * Validation + readiness report. Output never contains content text; only
 * field paths, placeholder tokens and file references.
 */
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { authoringCalendar, type AuthoringCalendar, type AuthoringDoor } from '../../shared/content/schema.ts';
import { findPlaceholders } from '../../shared/content/placeholders.ts';
import { IMAGE_EXTENSIONS, AUDIO_EXTENSIONS, MAX_MEDIA_BYTES } from './media.ts';

export interface DoorReadiness {
  day: number;
  ready: boolean;
  problems: string[];
  warnings: string[];
  blockTypes: string[];
}

export interface ValidationReport {
  valid: boolean;
  /** Schema errors (path + message). */
  errors: string[];
  calendar: AuthoringCalendar | null;
  settingsProblems: string[];
  doors: DoorReadiness[];
}

/** Every media file referenced by a door, with the kind it must be. */
export function mediaReferences(door: AuthoringDoor): { file: string; kind: 'image' | 'audio' }[] {
  const refs: { file: string; kind: 'image' | 'audio' }[] = [];
  for (const block of door.blocks) {
    switch (block.type) {
      case 'memory':
        block.photos.forEach((p) => refs.push({ file: p.file, kind: 'image' }));
        break;
      case 'song':
        if (block.artwork) refs.push({ file: block.artwork.file, kind: 'image' });
        break;
      case 'voice':
        refs.push({ file: block.audio.file, kind: 'audio' });
        break;
      case 'finalLetter':
        if (block.photo) refs.push({ file: block.photo.file, kind: 'image' });
        break;
      default:
        break;
    }
  }
  return refs;
}

export function checkDoor(door: AuthoringDoor, mediaDir: string): DoorReadiness {
  const problems: string[] = [];
  const warnings: string[] = [];
  for (const hit of findPlaceholders(door)) problems.push(`placeholder ${hit.token} at ${hit.path}`);
  for (const ref of mediaReferences(door)) {
    const full = path.resolve(mediaDir, ref.file);
    if (!full.startsWith(path.resolve(mediaDir) + path.sep)) {
      problems.push(`media path escapes the media folder: ${ref.file}`);
      continue;
    }
    const ext = path.extname(ref.file).toLowerCase();
    const allowed = ref.kind === 'image' ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
    if (!allowed.includes(ext)) problems.push(`unsupported ${ref.kind} type ${ext} (${ref.file})`);
    if (!existsSync(full)) problems.push(`missing media file ${ref.file}`);
    else if (statSync(full).size > MAX_MEDIA_BYTES) problems.push(`media file too large: ${ref.file}`);
    if (path.basename(ref.file).startsWith('placeholder-')) problems.push(`placeholder media ${ref.file}`);
  }
  if (JSON.stringify(door).includes('ß')) warnings.push('uses the German sharp s; the style guide asks for "ss"');
  return {
    day: door.day,
    ready: problems.length === 0,
    problems,
    warnings,
    blockTypes: door.blocks.map((b) => b.type),
  };
}

export function validateCalendar(raw: unknown, mediaDir: string): ValidationReport {
  const parsed = authoringCalendar.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      calendar: null,
      settingsProblems: [],
      doors: [],
    };
  }
  const calendar = parsed.data;
  const settingsProblems = findPlaceholders(calendar.settings).map((h) => `placeholder ${h.token} at settings.${h.path}`);
  if (JSON.stringify(calendar.settings).includes('ß')) settingsProblems.push('settings use the German sharp s');
  const doors = [...calendar.doors].sort((a, b) => a.day - b.day).map((d) => checkDoor(d, mediaDir));
  return { valid: true, errors: [], calendar, settingsProblems, doors };
}

export function formatReport(report: ValidationReport, sourceLabel: string): string {
  const lines: string[] = [`Content source: ${sourceLabel}`];
  if (!report.valid) {
    lines.push('', 'INVALID — fix these schema errors first:');
    report.errors.forEach((e) => lines.push(`  ✗ ${e}`));
    return lines.join('\n');
  }
  const c = report.calendar!;
  lines.push(`Calendar: ${c.calendarId} (year ${c.year}), 24 doors, schema valid.`, '');
  if (report.settingsProblems.length) {
    lines.push('Settings need personalisation:');
    report.settingsProblems.forEach((p) => lines.push(`  • ${p}`));
    lines.push('');
  }
  for (const door of report.doors) {
    const mark = door.ready ? '✓ ready' : '… needs work';
    lines.push(`Day ${String(door.day).padStart(2)}  ${mark.padEnd(13)} [${door.blockTypes.join(', ')}]`);
    door.problems.forEach((p) => lines.push(`          - ${p}`));
    door.warnings.forEach((w) => lines.push(`          ! ${w}`));
  }
  const ready = report.doors.filter((d) => d.ready).length;
  lines.push('', `Ready: ${ready}/24 doors${report.settingsProblems.length ? ', settings need work' : ''}.`);
  return lines.join('\n');
}
