import { asc, eq } from 'drizzle-orm';

import { getDb } from '../../db/client.js';
import type { Transaction } from '../../db/migrate-file.js';
import { playlistItems, playlists as playlistTable } from '../../db/schema.js';
import type { Playlist, PlaylistItem, PlaylistScope } from './types.js';

/**
 * Playlists as rows: one per playlist, one per track with its position. The rules —
 * names, limits, who may change what — are store.ts's; this only reads and writes.
 */

export async function writePlaylist(tx: Transaction, playlist: Playlist): Promise<void> {
  const row = {
    id: playlist.id,
    name: playlist.name,
    scope: playlist.scope,
    ownerId: playlist.ownerId ?? null,
    createdById: playlist.createdBy.id ?? null,
    createdByName: playlist.createdBy.name,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
  await tx
    .insert(playlistTable)
    .values(row)
    .onConflictDoUpdate({ target: playlistTable.id, set: row });
  // Small enough (300 at most) to write the order whole rather than shift positions.
  await tx.delete(playlistItems).where(eq(playlistItems.playlistId, playlist.id));
  if (playlist.items.length > 0) {
    await tx.insert(playlistItems).values(
      playlist.items.map((item, position) => ({
        playlistId: playlist.id,
        id: item.id,
        position,
        title: item.title,
        durationSec: item.durationSec ?? null,
        request: item.query,
        typed: item.typed === true,
      })),
    );
  }
}

export async function deletePlaylistRow(id: string): Promise<void> {
  await getDb().delete(playlistTable).where(eq(playlistTable.id, id));
}

/** Every playlist with its tracks in order. */
export async function readPlaylists(): Promise<Playlist[]> {
  const db = getDb();
  const items = await db
    .select()
    .from(playlistItems)
    .orderBy(asc(playlistItems.playlistId), asc(playlistItems.position));
  const byPlaylist = new Map<string, PlaylistItem[]>();
  for (const item of items) {
    const list = byPlaylist.get(item.playlistId) ?? [];
    list.push({
      id: item.id,
      title: item.title,
      ...(item.durationSec === null ? {} : { durationSec: item.durationSec }),
      query: item.request,
      ...(item.typed ? { typed: true } : {}),
    });
    byPlaylist.set(item.playlistId, list);
  }

  return (await db.select().from(playlistTable)).map((row) => ({
    id: row.id,
    name: row.name,
    scope: row.scope as PlaylistScope,
    ...(row.ownerId ? { ownerId: row.ownerId } : {}),
    createdBy: { ...(row.createdById ? { id: row.createdById } : {}), name: row.createdByName },
    items: byPlaylist.get(row.id) ?? [],
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));
}
