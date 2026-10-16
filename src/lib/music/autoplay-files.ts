import { fileOfTrack } from './track-source.js';

/**
 * Files autoplay put in the queue, so the banner and the dashboard can say a track was
 * the bot's own pick — kept apart from autoplay.ts so the playback state can read it
 * without importing the feeder.
 */
const files = new Set<string>();

export function markAutoplayFile(file: string): void {
  files.add(file);
}

export function forgetAutoplayFiles(): void {
  files.clear();
}

/** True for a track autoplay put in the queue. */
export function isAutoplayTrack(track: { url: string }): boolean {
  const file = fileOfTrack(track);
  return file !== null && files.has(file);
}
