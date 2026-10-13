/**
 * The playlist being fed into the queue, if any — kept apart from the feeder so that
 * stopping, clearing and leaving can end it without importing the feeder itself.
 */

export interface FeedStatus {
  playlistId: string;
  name: string;
  total: number;
  /** Tracks not yet in the queue: waiting, or being prepared. */
  remaining: number;
  failed: number;
}

let status: FeedStatus | null = null;
let generation = 0;

export function getFeedStatus(): FeedStatus | null {
  return status ? { ...status } : null;
}

export function setFeedStatus(next: FeedStatus | null): void {
  status = next;
}

/** Starts a new feed and returns its generation; any older feed stops at its next step. */
export function beginFeed(): number {
  generation += 1;
  return generation;
}

export function isCurrentFeed(feed: number): boolean {
  return feed === generation;
}

/** Ends whatever feed is running — stop, clear, leave and a new playlist call this. */
export function stopFeed(): void {
  generation += 1;
  status = null;
}
