import { ApplyOptions } from '@sapphire/decorators';
import { AllFlowsPrecondition } from '@sapphire/framework';
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  Message,
} from 'discord.js';

import { getRuntimeConfig } from '../lib/runtime-config.js';

@ApplyOptions<AllFlowsPrecondition.Options>({
  name: 'MusicChannel',
})
export class UserPrecondition extends AllFlowsPrecondition {
  public override messageRun(message: Message) {
    const channelIds = getRuntimeConfig().musicChannelIds;
    if (channelIds.length === 0) {
      return this.ok();
    }

    if (channelIds.includes(message.channelId)) {
      return this.ok();
    }

    return this.error({
      identifier: 'MusicChannel',
      message: 'Music commands can only be used in a designated music channel.',
    });
  }

  public override chatInputRun(_interaction: ChatInputCommandInteraction) {
    return this.ok();
  }

  public override contextMenuRun(_interaction: ContextMenuCommandInteraction) {
    return this.ok();
  }
}

declare module '@sapphire/framework' {
  interface Preconditions {
    MusicChannel: never;
  }
}
