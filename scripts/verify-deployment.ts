/**
 * npm run verify:deployment -- --url https://your-site.netlify.app
 *
 * Read-only checks against a deployed site and its Supabase project:
 *   - API requires a session and is never cacheable
 *   - static output contains no secrets
 *   - private bucket objects are not publicly readable
 *   - the advent schema is not reachable with the public (anon/publishable) key
 *   - optional: sign in with ADVENT_VERIFY_PASSPHRASE and check the overview
 * Uses .env.local for DATABASE_URL / SUPABASE_URL / keys. Never prints secrets.
 */
import '../tools/cli.ts';
import { createPostgresDb } from '../server/db/postgresDb.ts';
import { DEFAULT_MEDIA_BUCKET } from '../server/storage/supabaseStorage.ts';
import { loadLocalEnv, parseArgs } from '../tools/content/source.ts';

loadLocalEnv();
const args = parseArgs(process.argv.slice(2));
const site = String(args.url ?? process.env.SITE_URL ?? '').replace(/\/$/, '');
if (!site.startsWith('https://')) throw new Error('Pass --url https://<your-site>');

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) failures++;
};

// 1. API without session
const anon = await fetch(`${site}/api/calendar`);
check(anon.status === 401, `GET /api/calendar without session → 401 (got ${anon.status})`);
check((anon.headers.get('cache-control') ?? '').includes('no-store'), 'API responses are no-store');
const csrf = await fetch(`${site}/api/doors/1/open`, { method: 'POST' });
check(csrf.status === 403, `POST without CSRF header → 403 (got ${csrf.status})`);

// 2. Static output contains no secrets
const html = await (await fetch(site)).text();
const scripts = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]!);
const bundle = (await Promise.all(scripts.map(async (s) => (await fetch(site + s)).text()))).join('\n');
const secrets = ['DATABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ADVENT_PASSPHRASE_HASH']
  .map((n) => process.env[n])
  .filter((v): v is string => !!v && v.length > 8);
check(scripts.length > 0 && secrets.every((s) => !bundle.includes(s) && !html.includes(s)), 'no server secrets in HTML/JS');
check(!/service_role|sb_secret_|postgres(ql)?:\/\//.test(bundle), 'no privileged key patterns in JS');
const map = await fetch(`${site}${scripts[0]}.map`);
check(map.status !== 200 || !(await map.text()).includes('"sources"'), 'no source maps published');

// 3. Storage privacy
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
const bucket = process.env.ADVENT_MEDIA_BUCKET || DEFAULT_MEDIA_BUCKET;
if (supabaseUrl && process.env.DATABASE_URL) {
  const { db, close } = createPostgresDb(process.env.DATABASE_URL, { max: 1 });
  try {
    const [row] = await db.query<{ storage_path: string }>('select storage_path from advent.media limit 1');
    if (row) {
      const pub = await fetch(`${supabaseUrl}/storage/v1/object/public/${bucket}/${row.storage_path}`);
      check(pub.status !== 200, `public object URL is not readable (got ${pub.status})`);
      const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
      if (anonKey) {
        const auth = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${row.storage_path}`, {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        });
        check(auth.status !== 200, `object not readable with the public key (got ${auth.status})`);
      }
    } else {
      console.log('- no media imported yet; storage check skipped');
    }
    const [bucketRow] = await db.query<{ public: boolean }>('select public from storage.buckets where id = $1', [bucket]);
    check(bucketRow?.public === false, `bucket "${bucket}" exists and is private`);
  } finally {
    await close();
  }
}
const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
if (supabaseUrl && anonKey) {
  const rest = await fetch(`${supabaseUrl}/rest/v1/doors?select=*`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Accept-Profile': 'advent' },
  });
  check(rest.status >= 400, `advent schema not reachable via Data API with public key (got ${rest.status})`);
}

// 4. Optional signed-in check
const passphrase = process.env.ADVENT_VERIFY_PASSPHRASE;
if (passphrase) {
  const login = await fetch(`${site}/api/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Advent-Request': '1', Origin: site },
    body: JSON.stringify({ passphrase }),
  });
  check(login.status === 200, `sign-in works (got ${login.status})`);
  const cookie = login.headers.get('set-cookie') ?? '';
  check(/__Host-advent_session=.*HttpOnly.*Secure/i.test(cookie) || (cookie.includes('HttpOnly') && cookie.includes('Secure')), 'session cookie is HttpOnly + Secure');
  const overview = await fetch(`${site}/api/calendar`, { headers: { cookie: cookie.split(';')[0]! } });
  const body = (await overview.json()) as { today: string; phase: string; doors: { day: number; state: string }[] };
  console.log(`  server date (Europe/Zurich): ${body.today}, phase: ${body.phase}`);
  check(body.doors.filter((d) => d.state !== 'opened').every((d) => Object.keys(d).length === 2), 'unopened doors expose only day and state');
  await fetch(`${site}/api/session`, { method: 'DELETE', headers: { cookie: cookie.split(';')[0]!, 'X-Advent-Request': '1', Origin: site } });
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
