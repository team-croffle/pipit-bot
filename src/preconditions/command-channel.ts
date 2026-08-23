import { ApplyOptions } from '@sapphire/decorators';
import { AllFlowsPrecondition } from '@sapphire/framework';
import type {
  ChatInputCommandInteraction,
  ContextMenuCommandInteraction,
  Message,
} from 'discord.js';

import { getRuntimeConfig } from '../lib/runtime-config.js';

@ApplyOptions<AllFlowsPrecondition.Options>({
  name: 'CommandChannel',
})
export class UserPrecondition extends AllFlowsPrecondition {
  public override messageRun(message: Message) {
    const channelId = getRuntimeConfig().commandChannelId;
    if (!channelId) {
      return this.ok();
    }

    if (message.channelId === channelId) {
      return this.ok();
    }

    return this.error({
      identifier: 'CommandChannel',
      message: 'This command can only be used in the designated command channel.',
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
    CommandChannel: never;
  }
}
