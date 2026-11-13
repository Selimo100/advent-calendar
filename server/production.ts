/**
 * Production wiring for the Netlify Function. Reads server-only environment
 * variables; there is no demo fallback and no clock override here.
 */
import { ConfigurationError, type AppDeps } from './app.ts';
import { isValidPassphraseHash } from './auth/passphrase.ts';
import { SESSION_TTL_DAYS } from './auth/sessions.ts';
import { databaseClock } from './calendar/clock.ts';
import { createPostgresDb } from './db/postgresDb.ts';
import { createSupabaseStorage, DEFAULT_MEDIA_BUCKET } from './storage/supabaseStorage.ts';

let cached: AppDeps | null = null;

function required(env: Record<string, string | undefined>, name: string, missing: string[]): string {
  const value = env[name]?.trim();
  if (!value) missing.push(name);
  return value ?? '';
}

export function productionDeps(env: Record<string, string | undefined> = process.env): AppDeps {
  if (cached) return cached;
  const missing: string[] = [];
  const databaseUrl = required(env, 'DATABASE_URL', missing);
  const supabaseUrl = required(env, 'SUPABASE_URL', missing);
  const serviceKey = env.SUPABASE_SECRET_KEY?.trim() || required(env, 'SUPABASE_SERVICE_ROLE_KEY', missing);
  const calendarId = required(env, 'ADVENT_CALENDAR_ID', missing);
  const passphraseHash = required(env, 'ADVENT_PASSPHRASE_HASH', missing);
  if (missing.length) throw new ConfigurationError(`missing environment variables: ${missing.join(', ')}`);
  if (!isValidPassphraseHash(passphraseHash)) {
    throw new ConfigurationError('ADVENT_PASSPHRASE_HASH is not a valid scrypt hash (use npm run passphrase:hash)');
  }
  if (!/^[a-z0-9-]{3,64}$/.test(calendarId)) throw new ConfigurationError('ADVENT_CALENDAR_ID is invalid');

  const { db } = createPostgresDb(databaseUrl, { max: 2 });
  cached = {
    db,
    clock: databaseClock,
    storage: createSupabaseStorage(supabaseUrl, serviceKey, env.ADVENT_MEDIA_BUCKET?.trim() || DEFAULT_MEDIA_BUCKET),
    calendarId,
    passphraseHash,
    // `netlify dev` serves over http://localhost, where Secure cookies are not reliable in every browser.
    cookie: { secure: env.NETLIFY_DEV !== 'true', maxAgeSeconds: SESSION_TTL_DAYS * 86_400 },
    log: (event, detail) => console.log(`[advent] ${event}`, detail ? JSON.stringify(detail) : ''),
  };
  return cached;
}
