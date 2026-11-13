import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export interface ContentSource {
  label: string;
  file: string;
  mediaDir: string;
  isExample: boolean;
}

/** `example` (committed, fictional), `private` (gitignored) or a directory path. */
export function resolveContentSource(source: string): ContentSource {
  const dir =
    source === 'example' || source === 'private' ? path.join(REPO_ROOT, 'content', source) : path.resolve(source);
  const file = path.join(dir, 'calendar.ts');
  if (!existsSync(file)) {
    const hint = source === 'private' ? ' Run `npm run content:init-private` to create it.' : '';
    throw new Error(`No calendar.ts found in ${path.relative(REPO_ROOT, dir) || dir}.${hint}`);
  }
  return {
    label: source,
    file,
    mediaDir: path.join(dir, 'media'),
    isExample: path.resolve(dir) === path.join(REPO_ROOT, 'content', 'example'),
  };
}

export async function loadContent(source: ContentSource): Promise<unknown> {
  const mod = (await import(/* @vite-ignore */ pathToFileURL(source.file).href)) as { default?: unknown };
  if (!mod.default) throw new Error(`${source.file} must have a default export (defineCalendar({...}))`);
  return mod.default;
}

/** Parses `--flag` and `--key value` / `--key=value` arguments. */
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) continue;
    const [key, inline] = arg.slice(2).split('=', 2) as [string, string | undefined];
    if (inline !== undefined) args[key] = inline;
    else if (argv[i + 1] && !argv[i + 1]!.startsWith('--')) args[key] = argv[++i]!;
    else args[key] = true;
  }
  return args;
}

export function loadLocalEnv(): void {
  for (const name of ['.env.local', '.env']) {
    const file = path.join(REPO_ROOT, name);
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
