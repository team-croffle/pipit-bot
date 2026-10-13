import type { Playlist, PlaylistViewer, PublicPlaylist } from './types.js';

/** Shared playlists are everyone's; a personal one only its owner's. */
export function canView(playlist: Playlist, viewer: PlaylistViewer): boolean {
  return (
    playlist.scope === 'shared' || (!!viewer.discordId && playlist.ownerId === viewer.discordId)
  );
}

/** Anyone may edit a shared playlist (a team decision); a personal one only its owner. */
export function canEdit(playlist: Playlist, viewer: PlaylistViewer): boolean {
  return canView(playlist, viewer);
}

export function publicPlaylist(playlist: Playlist, viewer: PlaylistViewer): PublicPlaylist {
  return {
    id: playlist.id,
    name: playlist.name,
    scope: playlist.scope,
    mine: !!viewer.discordId && playlist.ownerId === viewer.discordId,
    createdBy: playlist.createdBy.name,
    itemCount: playlist.items.length,
    totalSec: playlist.items.reduce((sum, item) => sum + (item.durationSec ?? 0), 0),
    items: playlist.items.map((item) => ({
      id: item.id,
      title: item.title,
      durationSec: item.durationSec,
      typed: item.typed === true,
      ...(item.typed ? { request: item.query } : {}),
    })),
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}
