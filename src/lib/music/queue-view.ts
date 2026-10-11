import { getPlaybackState } from './playback.js';

const SHOWN = 20;

/**
 * The queue as a short markdown list for a reply only the asker sees. Titles are the
 * player's; links are left out — a prepared track's address is a local file.
 */
export function queueText(): string {
  const state = getPlaybackState();
  if (!state.current) {
    return 'Nothing is playing.';
  }

  const lines = [
    `**Now playing:** ${state.current.title} \`${state.current.positionLabel} / ${state.current.durationLabel}\``,
  ];

  if (state.tracks.length === 0) {
    lines.push('The queue is empty.');
    return lines.join('\n');
  }

  lines.push('');
  for (const track of state.tracks.slice(0, SHOWN)) {
    lines.push(`${track.index}. ${track.title}${track.duration ? ` \`${track.duration}\`` : ''}`);
  }

  if (state.pendingCount > SHOWN) {
    lines.push(`…and ${state.pendingCount - SHOWN} more`);
  }

  lines.push('', `${state.pendingCount} queued · ${state.durationFormatted ?? ''}`.trim());
  return lines.join('\n');
}
