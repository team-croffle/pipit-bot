/**
 * How many members each invite brought in, kept across restarts.
 *
 * Discord counts an invite's uses, but the count goes with the invite: once it
 * expires or is deleted, nobody can say any more where those members came from. This
 * keeps the arrivals the bot itself has seen, per code, for as long as the file lives.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { container } from '@sapphire/framework';

import { dataDir } from './constants.js';
import { loadSettingsFile } from './settings-file.js';

export interface InviteStat {
  joins: number;
  inviterId: string | null;
  lastJoinAt: string;
}

export interface InviteStats {
  codes: Record<string, InviteStat>;
}

const statsPath = join(dataDir, 'invite-stats.json');
const CODE = /^[\w-]{1,64}$/;

let cache: InviteStats = { codes: {} };
let loadError: string | null = null;
let writing: Promise<void> = Promise.resolve();

export function parseInviteStats(raw: unknown): InviteStats {
  if (!raw || typeof raw !== 'object' || typeof (raw as InviteStats).codes !== 'object') {
    throw new Error('Expected { codes: { … } }');
  }

  const codes: Record<string, InviteStat> = {};
  for (const [code, value] of Object.entries((raw as InviteStats).codes ?? {})) {
    const stat = value as Partial<InviteStat>;
    if (!CODE.test(code) || typeof stat.joins !== 'number' || stat.joins < 0) {
      continue;
    }

    codes[code] = {
      joins: Math.floor(stat.joins),
      inviterId: typeof stat.inviterId === 'string' ? stat.inviterId : null,
      lastJoinAt: typeof stat.lastJoinAt === 'string' ? stat.lastJoinAt : '',
    };
  }

  return { codes };
}

export async function loadInviteStats(): Promise<InviteStats> {
  const loaded = await loadSettingsFile({
    path: statsPath,
    label: 'Invite statistics',
    parse: parseInviteStats,
    empty: () => ({ codes: {} }),
  });
  cache = loaded.value;
  loadError = loaded.error;
  return cache;
}

export function getInviteStats(): InviteStats {
  return cache;
}

export function getInviteStatsLoadError(): string | null {
  return loadError;
}

/** Counts one arrival through `code`. Saves in the background, one write at a time. */
export function countInviteJoin(code: string, inviterId: string | null): Promise<void> {
  const previous = cache.codes[code];
  cache.codes[code] = {
    joins: (previous?.joins ?? 0) + 1,
    inviterId: inviterId ?? previous?.inviterId ?? null,
    lastJoinAt: new Date().toISOString(),
  };

  const snapshot = `${JSON.stringify(cache, null, 2)}\n`;
  writing = writing
    .then(async () => {
      await mkdir(dataDir, { recursive: true });
      await writeFile(statsPath, snapshot, 'utf8');
      loadError = null;
    })
    .catch((error: unknown) => {
      container.logger.warn('[invites] could not save invite statistics:', error);
    });
  return writing;
}
