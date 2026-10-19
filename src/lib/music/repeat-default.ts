import { QueueRepeatMode, type Player } from 'discord-player';

import { getPlaybackOptions, type RepeatDefault } from './playback-options.js';

const MODE: Record<RepeatDefault, QueueRepeatMode> = {
  off: QueueRepeatMode.OFF,
  track: QueueRepeatMode.TRACK,
  queue: QueueRepeatMode.QUEUE,
};

/**
 * A new music session starts in the chosen repeat mode. Only new sessions: changing the
 * default leaves the queue that is playing as it is, and /loop still changes it.
 */
export function watchRepeatDefault(player: Player): void {
  player.events.on('queueCreate', (queue) => {
    queue.setRepeatMode(MODE[getPlaybackOptions().repeatDefault]);
  });
}
