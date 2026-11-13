/**
 * Opaque session tokens. The browser holds a random 256-bit token in an
 * HttpOnly cookie; the database stores only its SHA-256 hash. A token is
 * high-entropy, so a fast hash is appropriate here (unlike passphrases).
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/types.ts';

export const SESSION_TTL_DAYS = 60;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface SessionInfo {
  sessionId: string;
  recipientId: string;
  expiresAt: Date;
}

export async function createSession(
  db: Db,
  recipientId: string,
  now: Date,
  ttlDays = SESSION_TTL_DAYS,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken();
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000);
  await db.query(
    `insert into advent.sessions (recipient_id, token_hash, created_at, expires_at, last_seen_at)
     values ($1, $2, $3, $4, $3)`,
    [recipientId, hashSessionToken(token), now, expiresAt],
  );
  return { token, expiresAt };
}

export async function resolveSession(db: Db, token: string | null, now: Date): Promise<SessionInfo | null> {
  if (!token || !TOKEN_RE.test(token)) return null;
  const rows = await db.query<{ id: string; recipient_id: string; expires_at: Date; last_seen_at: Date }>(
    `select id, recipient_id, expires_at, last_seen_at
       from advent.sessions
      where token_hash = $1 and revoked_at is null and expires_at > $2`,
    [hashSessionToken(token), now],
  );
  const row = rows[0];
  if (!row) return null;
  // Cheap activity marker, at most once per hour.
  if (now.getTime() - new Date(row.last_seen_at).getTime() > 3_600_000) {
    await db.query('update advent.sessions set last_seen_at = $2 where id = $1', [row.id, now]);
  }
  return { sessionId: row.id, recipientId: row.recipient_id, expiresAt: new Date(row.expires_at) };
}

export async function revokeSessionByToken(db: Db, token: string | null, now: Date): Promise<void> {
  if (!token || !TOKEN_RE.test(token)) return;
  await db.query('update advent.sessions set revoked_at = $2 where token_hash = $1 and revoked_at is null', [
    hashSessionToken(token),
    now,
  ]);
}

/** Revokes every session (used by `npm run sessions:revoke`). */
export async function revokeAllSessions(db: Db, now: Date, recipientId?: string): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `update advent.sessions set revoked_at = $1
      where revoked_at is null and ($2::uuid is null or recipient_id = $2::uuid)
      returning id`,
    [now, recipientId ?? null],
  );
  return rows.length;
}
