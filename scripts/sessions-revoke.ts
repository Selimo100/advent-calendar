/**
 * npm run sessions:revoke
 * Revokes every active session. Every device has to sign in again.
 * Use after rotating the passphrase or if a device was lost.
 */
import '../tools/cli.ts';
import { revokeAllSessions } from '../server/auth/sessions.ts';
import { createPostgresDb } from '../server/db/postgresDb.ts';
import { loadLocalEnv } from '../tools/content/source.ts';

loadLocalEnv();
const url = process.env.DATABASE_URL?.trim();
if (!url) throw new Error('Missing DATABASE_URL');
const { db, close } = createPostgresDb(url, { max: 1 });
try {
  const count = await revokeAllSessions(db, new Date());
  console.log(`Revoked ${count} session(s).`);
} finally {
  await close();
}
