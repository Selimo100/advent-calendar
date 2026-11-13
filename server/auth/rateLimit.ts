/**
 * Durable login rate limiting, stored in Postgres (advent.login_failures), so
 * it holds across function instances and cold starts.
 *
 * - Per client (hashed IP): at most 8 failures per 15 minutes.
 * - Global: at most 100 failures per hour. This bounds distributed guessing;
 *   with a long passphrase, guessing is infeasible well within this budget.
 */
import { createHash } from 'node:crypto';
import type { Db } from '../db/types.ts';

export const RATE_LIMITS = {
  client: { max: 8, windowSeconds: 15 * 60 },
  global: { max: 100, windowSeconds: 60 * 60 },
} as const;

export function clientBucket(ip: string | null | undefined): string {
  const normalised = (ip ?? 'unknown').trim().toLowerCase() || 'unknown';
  return `ip:${createHash('sha256').update(`advent-login:${normalised}`).digest('hex')}`;
}

export interface RateLimitStatus {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkLoginRateLimit(db: Db, bucket: string, now: Date): Promise<RateLimitStatus> {
  const rows = await db.query<{ scope: string; failures: number; oldest: Date | null }>(
    `select 'client' as scope, count(*)::int as failures, min(attempted_at) as oldest
       from advent.login_failures
      where bucket = $1 and attempted_at > $2
     union all
     select 'global', count(*)::int, min(attempted_at)
       from advent.login_failures
      where attempted_at > $3`,
    [
      bucket,
      new Date(now.getTime() - RATE_LIMITS.client.windowSeconds * 1000),
      new Date(now.getTime() - RATE_LIMITS.global.windowSeconds * 1000),
    ],
  );
  for (const row of rows) {
    const limit = row.scope === 'client' ? RATE_LIMITS.client : RATE_LIMITS.global;
    if (row.failures >= limit.max) {
      const oldest = row.oldest ? new Date(row.oldest).getTime() : now.getTime();
      const retry = Math.max(1, Math.ceil((oldest + limit.windowSeconds * 1000 - now.getTime()) / 1000));
      return { allowed: false, retryAfterSeconds: retry };
    }
  }
  return { allowed: true };
}

export async function recordLoginFailure(db: Db, bucket: string, now: Date): Promise<void> {
  await db.query('insert into advent.login_failures (bucket, attempted_at) values ($1, $2)', [bucket, now]);
  // Opportunistic cleanup of old rows.
  await db.query('delete from advent.login_failures where attempted_at < $1', [
    new Date(now.getTime() - 2 * 86_400_000),
  ]);
}

export async function clearLoginFailures(db: Db, bucket: string): Promise<void> {
  await db.query('delete from advent.login_failures where bucket = $1', [bucket]);
}
