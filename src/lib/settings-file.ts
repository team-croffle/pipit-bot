/**
 * Reads one of the JSON settings files under `data/`.
 *
 * WHY this exists: every loader used to swallow a parse failure and start from
 * defaults, with no log line and nothing on the dashboard. The feature simply looked
 * switched off. Worse, the next save from the dashboard overwrote the damaged file
 * with those defaults, and whatever had been in it was gone for good.
 *
 * A file that does not exist is a fresh install and is not an error. A file that
 * exists but cannot be read or parsed is: it is logged, a copy is kept beside it so
 * the original survives a later save, and the message travels to the dashboard.
 */

import { copyFile, readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { container } from '@sapphire/framework';

export interface LoadedSettings<T> {
  value: T;
  /** Set when the file existed but could not be used; defaults are in `value`. */
  error: string | null;
}

interface LoadOptions<T> {
  path: string;
  /** How the file is called in messages, e.g. "GitHub notification settings". */
  label: string;
  parse: (raw: unknown) => T;
  empty: () => T;
  /** Overrides the plain read, for a loader that also knows an older path. */
  read?: () => Promise<string>;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

export async function loadSettingsFile<T>(options: LoadOptions<T>): Promise<LoadedSettings<T>> {
  let text: string;
  try {
    text = await (options.read ?? (() => readFile(options.path, 'utf8')))();
  } catch (error) {
    if (isMissing(error)) {
      return { value: options.empty(), error: null };
    }

    return { value: options.empty(), error: report(options, 'could not be read', error) };
  }

  try {
    return { value: options.parse(JSON.parse(text) as unknown), error: null };
  } catch (error) {
    const backup = `${options.path}.broken-${new Date().toISOString().replaceAll(':', '-')}`;
    try {
      await copyFile(options.path, backup);
    } catch {
      // The original is still there; the log and the dashboard say what happened.
    }

    return {
      value: options.empty(),
      error: report(options, `is not valid (a copy was kept as ${basename(backup)})`, error),
    };
  }
}

function report<T>(options: LoadOptions<T>, what: string, error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  const message = `${options.label} ${what}: ${detail}. Defaults are in use until the file is fixed or saved over.`;
  container.logger.error(`[settings] ${message}`);
  return message;
}
