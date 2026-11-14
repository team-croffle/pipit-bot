import { access, copyFile, readFile, rename } from 'node:fs/promises';
import { basename } from 'node:path';

import { container } from '@sapphire/framework';
import { eq } from 'drizzle-orm';

import { getDb, type Database } from './client.js';
import { fileMigrations } from './schema.js';

/**
 * Moves one JSON file under data/ into the database, once.
 *
 * WHY the file is renamed to `*.migrated` and not deleted: going back to an older
 * image must stay possible — renaming it back restores what that image reads.
 *
 * WHY a record table as well as the rename: the rows and the record are written in one
 * transaction, but the rename comes after it. A bot stopped in between would otherwise
 * find the file again and insert everything twice. With the record, it only finishes
 * the rename.
 *
 * A file that cannot be parsed is not moved: a copy is kept beside it (as the settings
 * loader does), the error is logged, and the next start tries again once it is fixed.
 */

export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface FileMigration<T> {
  /** The record's key — the file's name, e.g. "github-messages.json". */
  name: string;
  path: string;
  /** How the data is called in log lines, e.g. "tracked GitHub messages". */
  label: string;
  parse: (raw: unknown) => T;
  /** Turns the file's text into what `parse` takes; JSON by default (a line-per-entry file passes its own). */
  decode?: (text: string) => unknown;
  /** Writes the content inside the transaction; returns how many rows it wrote. */
  insert: (tx: Transaction, value: T) => Promise<number>;
  /**
   * Done once the rows are in. By default the file becomes `*.migrated`; a file that
   * also holds settings (and stays) rewrites itself without the moved part instead —
   * and is called again on every later start, with `undefined`, to take out anything
   * an older image put back.
   */
  finish?: (value: T | undefined) => Promise<void>;
}

export type MigrationOutcome = 'absent' | 'migrated' | 'finished' | 'broken';

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

/** Never over an earlier `*.migrated` — that one is the copy a way back depends on. */
async function renameAside(path: string): Promise<void> {
  const target = `${path}.migrated`;
  const taken = await access(target).then(
    () => true,
    () => false,
  );
  await rename(path, taken ? `${target}-${new Date().toISOString().replaceAll(':', '-')}` : target);
}

export async function migrateFile<T>(migration: FileMigration<T>): Promise<MigrationOutcome> {
  let text: string;
  try {
    text = await readFile(migration.path, 'utf8');
  } catch (error) {
    if (isMissing(error)) {
      return 'absent';
    }

    throw error;
  }

  const db = getDb();
  const finish = migration.finish ?? (() => renameAside(migration.path));
  const [done] = await db
    .select()
    .from(fileMigrations)
    .where(eq(fileMigrations.name, migration.name));
  if (done && migration.finish) {
    // A file that stays (settings): every start sees it, and the move is long done.
    await migration.finish(undefined);
    return 'finished';
  }

  if (done) {
    // Either a start stopped right after the move, or the file came back later (an older
    // image ran in between). Its content is not moved again: the database is the record.
    await finish(undefined);
    container.logger.warn(
      `[db] ${basename(migration.path)} is here again but ${migration.label} were moved in on ${done.migratedAt.toISOString().slice(0, 10)}; set it aside without moving it in`,
    );
    return 'finished';
  }

  let value: T;
  try {
    value = migration.parse((migration.decode ?? JSON.parse)(text) as unknown);
  } catch (error) {
    const backup = `${migration.path}.broken-${new Date().toISOString().replaceAll(':', '-')}`;
    await copyFile(migration.path, backup).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    container.logger.error(
      `[db] ${migration.label} were not moved in — ${basename(migration.path)} is not valid (a copy was kept as ${basename(backup)}): ${detail}`,
    );
    return 'broken';
  }

  const items = await db.transaction(async (tx) => {
    const count = await migration.insert(tx, value);
    await tx.insert(fileMigrations).values({ name: migration.name, items: count });
    return count;
  });
  await finish(value);
  container.logger.info(
    `[db] moved ${items} ${migration.label} into the database from ${basename(migration.path)}`,
  );
  return 'migrated';
}
