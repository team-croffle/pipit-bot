import type { DiscordChannel } from './types';

export interface ChannelGroup {
  category: string;
  channels: DiscordChannel[];
}

const UNCATEGORIZED = 'No category';

/**
 * Groups channels under their category for `<optgroup>`.
 *
 * WHY: channel names only have to be unique within a category, so a picker listing
 * bare names can show the same label twice with no way to tell them apart. The
 * server already returns them in Discord's own order, so the groups are built by
 * walking that order rather than sorting again.
 */
export function groupChannels(channels: DiscordChannel[]): ChannelGroup[] {
  const groups: ChannelGroup[] = [];
  for (const channel of channels) {
    const category = channel.category ?? UNCATEGORIZED;
    const last = groups.at(-1);
    if (last?.category === category) {
      last.channels.push(channel);
      continue;
    }

    groups.push({ category, channels: [channel] });
  }

  return groups;
}
