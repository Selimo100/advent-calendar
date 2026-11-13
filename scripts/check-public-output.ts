/**
 * Fails the build if the public output (dist/) contains anything it must not:
 * secrets, source maps, demo tooling, or any example / private surprise text.
 * Also checks that private files are not tracked by git.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadContent, resolveContentSource } from '../tools/content/source.ts';

const DIST = path.join(REPO_ROOT, 'dist');
const problems: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

if (!existsSync(DIST)) {
  console.error('dist/ not found; run the build first.');
  process.exit(1);
}
const files = walk(DIST);
const texts = files
  .filter((f) => /\.(js|mjs|css|html|json|txt|svg|webmanifest)$/.test(f))
  .map((f) => ({ file: path.relative(REPO_ROOT, f), text: readFileSync(f, 'utf8') }));

for (const f of files) if (f.endsWith('.map')) problems.push(`source map in public output: ${path.relative(REPO_ROOT, f)}`);

const forbidden = [
  'service_role',
  'SERVICE_ROLE',
  'sb_secret_',
  'SUPABASE_SECRET',
  'postgres://',
  'postgresql://',
  'DATABASE_URL',
  'ADVENT_PASSPHRASE_HASH',
  'scrypt$v1$',
  '/api/demo',
  'demo-media',
  'DemoPanel',
  'lebkuchen-im-schnee',
  'advent-private',
  'placeholder-',
];
for (const secretName of ['DATABASE_URL', 'DATABASE_MIGRATION_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ADVENT_PASSPHRASE_HASH']) {
  const value = process.env[secretName];
  if (value && value.length >= 8) forbidden.push(value);
}

async function contentStrings(source: 'example' | 'private'): Promise<string[]> {
  try {
    const calendar = (await loadContent(resolveContentSource(source))) as { doors: unknown[]; settings: Record<string, string> };
    const out: string[] = [];
    const visit = (v: unknown) => {
      if (typeof v === 'string') {
        if (v.length >= 16 && !v.includes('/') ) out.push(v);
      } else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') Object.values(v).forEach(visit);
    };
    visit(calendar.doors);
    // Personal settings must not be public either (the login title is public by design).
    const { title: _title, ...personal } = calendar.settings;
    visit(personal);
    return out;
  } catch {
    return [];
  }
}

const surpriseStrings = [...(await contentStrings('example')), ...(await contentStrings('private'))];

for (const { file, text } of texts) {
  for (const needle of forbidden) if (text.includes(needle)) problems.push(`${file} contains forbidden string "${needle.slice(0, 24)}"`);
  for (const s of surpriseStrings) if (text.includes(s)) problems.push(`${file} contains calendar content ("${s.slice(0, 12)}…")`);
}

// Private files must never be tracked by git.
try {
  const tracked = execFileSync('git', ['ls-files', '--', 'content/private', '.env', '.env.local', 'backups', '.demo-data'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  if (tracked) problems.push(`private files are tracked by git:\n${tracked}`);
  for (const p of ['content/private/calendar.ts', '.env.local', '.env', 'backups/x', '.demo-data/x']) {
    try {
      execFileSync('git', ['check-ignore', '-q', p], { cwd: REPO_ROOT });
    } catch {
      problems.push(`${p} is not gitignored`);
    }
  }
} catch {
  /* not a git checkout (e.g. some CI builds) */
}

if (problems.length) {
  console.error('Public output check FAILED:\n' + problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`Public output check passed (${files.length} files, ${surpriseStrings.length} content strings, ${forbidden.length} forbidden patterns).`);
