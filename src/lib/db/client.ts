import { container } from '@sapphire/framework';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { rootDir } from '../constants.js';
import { getEnv, type DatabaseConfig } from '../env.js';
import * as authSchema from './auth-schema.js';
import * as tables from './schema.js';

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

const schema = { ...tables, ...authSchema };

export type Database = PostgresJsDatabase<typeof schema>;

const timing = {
  firstRetryMs: 1000,
  maxRetryMs: 15_000,
  giveUpAfterMs: 120_000,
  /** Seconds an unused connection stays open; 0 keeps it. A check sets a short one to exit. */
  idleTimeoutS: 0,
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

/** Host, port and database for the log — never the password. */
function target(config: DatabaseConfig): string {
  if ('url' in config) {
    try {
      const url = new URL(config.url);
      return `${url.host}${url.pathname}`;
    } catch {
      return 'DATABASE_URL';
    }
  }

  return `${config.host}:${config.port}/${config.name ?? config.username ?? ''}`;
}

/** Connects (waiting for the database if it is still coming up) and applies migrations. */
export async function connectDatabase(): Promise<Database> {
  const config = getEnv().database;
  if (!config) {
    throw new Error(
      'Set DATABASE_HOST (with DATABASE_USERNAME, DATABASE_PASSWORD and DATABASE_NAME), or DATABASE_URL.',
    );
  }

  if ('url' in config && process.env.DATABASE_HOST?.trim()) {
    container.logger.info(
      '[db] DATABASE_URL is set, so DATABASE_HOST and the other parts are not used',
    );
  }

  const options = { onnotice: () => undefined, idle_timeout: timing.idleTimeoutS || undefined };
  const client =
    'url' in config
      ? postgres(config.url, options)
      : postgres({
          ...options,
          host: config.host,
          port: config.port,
          username: config.username,
          password: config.password,
          database: config.name,
        });
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
    container.logger.info(
      `[db] connected to ${target(config)}, schema ${row?.schema ?? 'public'} up to date`,
    );
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
