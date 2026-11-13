import postgres from 'postgres';
import type { Db } from './types.ts';

type Sql = postgres.Sql;
type TransactionSql = postgres.TransactionSql;

function wrap(sql: Sql | TransactionSql, inTransaction: boolean): Db {
  return {
    async query<T>(text: string, params: readonly unknown[] = []) {
      const rows = params.length
        ? await sql.unsafe(text, params as postgres.ParameterOrJSON<never>[])
        : await sql.unsafe(text);
      return rows as unknown as T[];
    },
    async transaction<R>(fn: (tx: Db) => Promise<R>) {
      if (inTransaction) return fn(wrap(sql, true));
      return (await (sql as Sql).begin((tx) => fn(wrap(tx, true)))) as R;
    },
  };
}

export interface PostgresDbOptions {
  /** Max pool size. Serverless functions handle one request at a time. */
  max?: number;
}

/**
 * Connects with postgres.js. Works with the Supabase transaction pooler
 * (port 6543): prepared statements are disabled because the pooler does not
 * support them.
 */
export function createPostgresDb(connectionString: string, options: PostgresDbOptions = {}) {
  const sql = postgres(connectionString, {
    max: options.max ?? 2,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { application_name: 'advent-calendar' },
  });
  return { db: wrap(sql, false), close: () => sql.end({ timeout: 5 }) };
}
