/**
 * Starts a real PostgreSQL server (embedded-postgres binaries) for the
 * integration tests. Transactions and concurrency are therefore exercised
 * against actual Postgres, not mocks.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    pgBaseUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const dir = await mkdtemp(path.join(tmpdir(), 'advent-pg-'));
  const port = 55_000 + Math.floor(Math.random() * 5000);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  project.provide('pgBaseUrl', `postgres://postgres:postgres@127.0.0.1:${port}`);
  return async () => {
    await pg.stop();
    await rm(dir, { recursive: true, force: true });
  };
}
