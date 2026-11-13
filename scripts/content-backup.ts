/**
 * npm run content:backup -- [--out backups]
 * Writes a local, gitignored JSON backup of calendars, doors, media metadata
 * and opening history, and downloads all private media objects.
 */
import '../tools/cli.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createPostgresDb } from '../server/db/postgresDb.ts';
import { DEFAULT_MEDIA_BUCKET } from '../server/storage/supabaseStorage.ts';
import { loadLocalEnv, parseArgs, REPO_ROOT } from '../tools/content/source.ts';

loadLocalEnv();
const args = parseArgs(process.argv.slice(2));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(REPO_ROOT, String(args.out ?? 'backups'), stamp);
const env = (name: string) => {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
};

const { db, close } = createPostgresDb(env('DATABASE_URL'), { max: 1 });
try {
  const tables = ['recipients', 'calendars', 'doors', 'media', 'openings'] as const;
  const data: Record<string, unknown[]> = {};
  for (const table of tables) data[table] = await db.query(`select * from advent.${table}`);
  await mkdir(path.join(outDir, 'media'), { recursive: true });
  await writeFile(path.join(outDir, 'database.json'), JSON.stringify(data, null, 2));

  const supabase = createClient(env('SUPABASE_URL'), process.env.SUPABASE_SECRET_KEY?.trim() || env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });
  const bucket = process.env.ADVENT_MEDIA_BUCKET?.trim() || DEFAULT_MEDIA_BUCKET;
  let count = 0;
  for (const row of data.media as { storage_path: string }[]) {
    const { data: blob, error } = await supabase.storage.from(bucket).download(row.storage_path);
    if (error || !blob) {
      console.warn(`Could not download one media object (${error?.message ?? 'unknown error'})`);
      continue;
    }
    const target = path.join(outDir, 'media', row.storage_path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, new Uint8Array(await blob.arrayBuffer()));
    count++;
  }
  console.log(`Backup written to ${path.relative(REPO_ROOT, outDir)} (${count} media files).`);
  console.log('Also keep a copy of content/private/ — it is the source of truth for your texts.');
} finally {
  await close();
}
