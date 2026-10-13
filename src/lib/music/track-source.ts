/**
 * What each prepared file was asked for, so a track in the queue, playing now or in
 * the recent list can be saved to a playlist and asked for again later.
 *
 * WHY: the player only knows local files (`local:{file}`); the request that produced a
 * file lives on the job, and finished jobs are dropped after a while. This keeps the
 * request per file instead. In memory: a track from before a restart cannot be saved.
 *
 * The query is the music worker's business (it may be a value the bot never shows) —
 * it is kept here and in playlist files, never sent to a browser or written to a log.
 */

export interface TrackSource {
  query: string;
  title: string;
  durationSec?: number;
}

const KEEP = 500;
const LOCAL_PREFIX = 'local:';

const sources = new Map<string, TrackSource>();

export function rememberSource(file: string, source: TrackSource): void {
  sources.delete(file);
  sources.set(file, source);
  while (sources.size > KEEP) {
    const oldest = sources.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    sources.delete(oldest);
  }
}

/** The file a player track plays, from its `local:` url. */
export function fileOfTrack(track: { url: string }): string | null {
  return track.url.startsWith(LOCAL_PREFIX) ? track.url.slice(LOCAL_PREFIX.length) : null;
}

export function sourceOf(track: { url: string }): TrackSource | undefined {
  const file = fileOfTrack(track);
  return file ? sources.get(file) : undefined;
}
