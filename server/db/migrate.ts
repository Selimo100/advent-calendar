/**
 * Applies supabase/migrations/*.sql in order and records them in
 * advent.schema_migrations. Used by `npm run db:migrate`, the tests and the
 * local demo. Not bundled into Netlify Functions.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './types.ts';

export const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../supabase/migrations',
);

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

export async function runMigrations(
  db: Db,
  options: { dir?: string; exec?: (sql: string) => Promise<void> } = {},
): Promise<MigrationResult> {
  const dir = options.dir ?? MIGRATIONS_DIR;
  const exec = options.exec ?? (async (sql: string) => void (await db.query(sql)));
  await exec(`
    create schema if not exists advent;
    create table if not exists advent.schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
    alter table advent.schema_migrations enable row level security;
    revoke all on advent.schema_migrations from public;
  `);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const done = new Set(
    (await db.query<{ name: string }>('select name from advent.schema_migrations')).map((r) => r.name),
  );
  const result: MigrationResult = { applied: [], skipped: [] };
  for (const file of files) {
    if (done.has(file)) {
      result.skipped.push(file);
      continue;
    }
    const sql = await readFile(path.join(dir, file), 'utf8');
    await exec(`begin;\n${sql}\ninsert into advent.schema_migrations (name) values ('${file.replace(/'/g, "''")}');\ncommit;`);
    result.applied.push(file);
  }
  return result;
}
