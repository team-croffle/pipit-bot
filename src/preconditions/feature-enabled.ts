import { ApplyOptions } from '@sapphire/decorators';
import {
  AllFlowsPrecondition,
  type ChatInputCommand,
  type ContextMenuCommand,
} from '@sapphire/framework';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction } from 'discord.js';

import { isCommandEnabled } from '../lib/discord/command-features.js';

/**
 * Runs before every command: one of a switched-off feature answers that it is off.
 * Discord takes a moment to drop a removed command from its menus, so someone can still
 * send one in that gap.
 */
@ApplyOptions<AllFlowsPrecondition.Options>({
  name: 'FeatureEnabled',
  position: 10,
})
export class UserPrecondition extends AllFlowsPrecondition {
  public override messageRun() {
    return this.ok();
  }

  public override chatInputRun(
    _interaction: ChatInputCommandInteraction,
    command: ChatInputCommand,
  ) {
    return this.check(command);
  }

  public override contextMenuRun(
    _interaction: ContextMenuCommandInteraction,
    command: ContextMenuCommand,
  ) {
    return this.check(command);
  }

  private check(command: { name: string; category?: string | null } | undefined) {
    return !command || isCommandEnabled(command)
      ? this.ok()
      : this.error({ message: 'This feature is switched off on this server.' });
  }
}
