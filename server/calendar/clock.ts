import type { Db } from '../db/types.ts';

/**
 * Source of "now". Production always uses the database clock (inside the same
 * transaction that records an opening). There is no production override.
 */
export interface Clock {
  now(db: Db): Promise<Date>;
}

export const databaseClock: Clock = {
  async now(db) {
    const rows = await db.query<{ now: Date }>('select now() as now');
    return new Date(rows[0]!.now);
  },
};

/** For tests and the local demo only. */
export function fixedClock(instant: Date | (() => Date)): Clock {
  return { now: async () => (typeof instant === 'function' ? instant() : new Date(instant)) };
}
