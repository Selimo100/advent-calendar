/**
 * PGlite (Postgres compiled to WebAssembly) adapter for the local demo.
 * Runs the real SQL migrations; never used in production.
 */
import type { PGlite, Transaction } from '@electric-sql/pglite';
import type { Db } from './types.ts';

type Queryable = PGlite | Transaction;

function wrap(client: Queryable, root: PGlite | null): Db {
  return {
    async query<T>(text: string, params: readonly unknown[] = []) {
      const result = await client.query<T>(text, params as unknown[]);
      return result.rows;
    },
    async transaction<R>(fn: (tx: Db) => Promise<R>) {
      if (!root) return fn(wrap(client, null));
      return root.transaction((tx) => fn(wrap(tx, null)));
    },
  };
}

export function createPgliteDb(client: PGlite): Db {
  return wrap(client, client);
}
