/**
 * npm run db:migrate
 * Applies supabase/migrations/*.sql to DATABASE_URL (idempotent, tracked in
 * advent.schema_migrations). Prefer the Supabase "session" or direct
 * connection string for migrations.
 */
import '../tools/cli.ts';
import { createPostgresDb } from '../server/db/postgresDb.ts';
import { runMigrations } from '../server/db/migrate.ts';
import { loadLocalEnv } from '../tools/content/source.ts';

loadLocalEnv();
const url = (process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL)?.trim();
if (!url) throw new Error('Missing DATABASE_URL (or DATABASE_MIGRATION_URL)');
const { db, close } = createPostgresDb(url, { max: 1 });
try {
  const result = await runMigrations(db);
  console.log(`Applied: ${result.applied.join(', ') || 'none'}`);
  console.log(`Already applied: ${result.skipped.length}`);
} finally {
  await close();
}
