import { ApplyOptions } from '@sapphire/decorators';
import { AllFlowsPrecondition } from '@sapphire/framework';
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  Message,
} from 'discord.js';

import { getRuntimeConfig } from '../lib/runtime-config.js';

/**
 * Music commands work only in a configured music channel — or anywhere when none is
 * configured. Shared with the remote-control buttons, which have no preconditions.
 */
export function isMusicChannel(channelId: string | null): boolean {
  const channelIds = getRuntimeConfig().musicChannelIds;
  return channelIds.length === 0 || (channelId !== null && channelIds.includes(channelId));
}

const REFUSAL = 'Music commands can only be used in a designated music channel.';

@ApplyOptions<AllFlowsPrecondition.Options>({
  name: 'MusicChannel',
})
export class UserPrecondition extends AllFlowsPrecondition {
  public override messageRun(message: Message) {
    return this.check(message.channelId);
  }

  public override chatInputRun(interaction: ChatInputCommandInteraction) {
    return this.check(interaction.channelId);
  }

  public override contextMenuRun(interaction: ContextMenuCommandInteraction) {
    return this.check(interaction.channelId);
  }

  private check(channelId: string | null) {
    return isMusicChannel(channelId)
      ? this.ok()
      : this.error({ identifier: 'MusicChannel', message: REFUSAL });
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    MusicChannel: never;
  }
}
