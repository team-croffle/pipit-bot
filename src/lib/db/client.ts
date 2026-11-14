import { container } from '@sapphire/framework';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { rootDir } from '../constants.js';
import { getEnv } from '../env.js';
import * as schema from './schema.js';

/**
 * The bot's one PostgreSQL connection pool.
 *
 * WHY retry at start: under compose the database container can be "started" while it
 * is still initialising, and `depends_on` cannot tell; on a server the database may be
 * restarting. The bot waits — doubling the pause up to a limit — and gives up with a
 * clear error only after a couple of minutes.
 *
 * Migrations are applied right after connecting, before anything reads a table. Their
 * bookkeeping table lives in the connection's own schema rather than drizzle's default
 * `drizzle` schema, so a database pointed at another schema (search_path) keeps its own.
 */

export type Database = PostgresJsDatabase<typeof schema>;

const timing = {
  firstRetryMs: 1000,
  maxRetryMs: 15_000,
  giveUpAfterMs: 120_000,
};

let sql: postgres.Sql | undefined;
let db: Database | undefined;

function describe(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : error instanceof Error ? error.message : String(error);
}

async function reach(client: postgres.Sql): Promise<void> {
  const started = Date.now();
  let delay = timing.firstRetryMs;
  for (;;) {
    try {
      await client`select 1`;
      return;
    } catch (error) {
      if (Date.now() - started + delay > timing.giveUpAfterMs) {
        throw new Error(`Could not reach the database (${describe(error)}).`, { cause: error });
      }

      container.logger.warn(
        `[db] not reachable yet (${describe(error)}) — trying again in ${delay / 1000}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, timing.maxRetryMs);
    }
  }
}

/** Connects (waiting for the database if it is still coming up) and applies migrations. */
export async function connectDatabase(): Promise<Database> {
  const url = getEnv().databaseUrl;
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }

  const client = postgres(url, { onnotice: () => undefined });
  try {
    await reach(client);
    const [row] = await client<{ schema: string }[]>`select current_schema() as schema`;
    const connected = drizzle(client, { schema });
    await migrate(connected, {
      migrationsFolder: `${rootDir}/drizzle`,
      migrationsSchema: row?.schema ?? 'public',
    });
    sql = client;
    db = connected;
    container.logger.info(`[db] connected, schema ${row?.schema ?? 'public'} up to date`);
    return connected;
  } catch (error) {
    await client.end({ timeout: 5 });
    throw error;
  }
}

/** The connected database; storage modules call this, never the driver. */
export function getDb(): Database {
  if (!db) {
    throw new Error('The database is not connected.');
  }

  return db;
}

export async function closeDatabase(): Promise<void> {
  const client = sql;
  sql = undefined;
  db = undefined;
  await client?.end({ timeout: 5 });
}

/** Shortens the wait for an unreachable database — for local checks only. */
export function setDatabaseTimingForChecks(overrides: Partial<typeof timing>): void {
  Object.assign(timing, overrides);
}
