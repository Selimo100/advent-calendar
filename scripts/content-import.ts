/**
 * npm run content:import -- --source private [--dry-run] [--prune] [--allow-placeholders]
 *
 * Reads DATABASE_URL, SUPABASE_URL and SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY
 * from the environment (or .env.local). Never prints content text.
 *
 *   --dry-run             show the planned changes; write nothing
 *   --prune               DESTRUCTIVE: delete media no longer referenced by the content file
 *   --allow-placeholders  publish doors that still contain [PLACEHOLDERS]
 *                         (only for fictional preview content)
 */
import '../tools/cli.ts';
import { createPostgresDb } from '../server/db/postgresDb.ts';
import { createSupabaseStorage, DEFAULT_MEDIA_BUCKET } from '../server/storage/supabaseStorage.ts';
import { applyImport, formatPlan, planImport, prepareImport } from '../tools/content/importer.ts';
import { formatReport } from '../tools/content/readiness.ts';
import { loadContent, loadLocalEnv, parseArgs, resolveContentSource } from '../tools/content/source.ts';

loadLocalEnv();
const args = parseArgs(process.argv.slice(2));
if (!args.source) {
  console.error('Please pass --source private (or --source example for fictional preview content).');
  process.exit(1);
}
const source = resolveContentSource(String(args.source));
const options = { allowPlaceholders: args['allow-placeholders'] === true, prune: args.prune === true };
const dryRun = args['dry-run'] === true;

const env = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
};

const prepared = await prepareImport(await loadContent(source), source.mediaDir, options);
console.log(formatReport(prepared.report, source.label), '\n');

const { db, close } = createPostgresDb(env('DATABASE_URL'), { max: 1 });
try {
  const plan = await planImport(db, prepared);
  console.log(`Planned changes for calendar "${prepared.calendar.calendarId}":`);
  console.log(formatPlan(plan, options));
  if (dryRun) {
    console.log('\nDry run: nothing was written.');
  } else {
    const storage = createSupabaseStorage(
      env('SUPABASE_URL'),
      process.env.SUPABASE_SECRET_KEY?.trim() || env('SUPABASE_SERVICE_ROLE_KEY'),
      process.env.ADVENT_MEDIA_BUCKET?.trim() || DEFAULT_MEDIA_BUCKET,
    );
    await applyImport(db, storage, prepared, plan, options);
    console.log('\nImport complete.');
    if (process.env.ADVENT_CALENDAR_ID && process.env.ADVENT_CALENDAR_ID !== prepared.calendar.calendarId) {
      console.log(`Note: ADVENT_CALENDAR_ID is "${process.env.ADVENT_CALENDAR_ID}", the imported calendar is "${prepared.calendar.calendarId}".`);
    }
  }
} finally {
  await close();
}
