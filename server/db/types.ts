/**
 * Minimal database interface used by the server. Implemented with postgres.js
 * (production / owner scripts / integration tests) and PGlite (local demo).
 */
export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(text: string, params?: readonly unknown[]): Promise<T[]>;
  /** Runs `fn` in a single READ COMMITTED transaction. Nested calls reuse it. */
  transaction<R>(fn: (tx: Db) => Promise<R>): Promise<R>;
}

/** Errors that mean the database could not be reached (not a logic failure). */
export class DatabaseUnavailableError extends Error {
  override name = 'DatabaseUnavailableError';
}

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
  'CONNECTION_DESTROYED',
  'QUEUE_TIMEOUT',
  'QUERY_TIMEOUT',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '53300', // too_many_connections
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
]);

export function isConnectionError(error: unknown): boolean {
  if (error instanceof DatabaseUnavailableError) return true;
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && CONNECTION_ERROR_CODES.has(code);
}

export function pgErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}
