import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js';

import { isEnabled } from '../lib/features.js';
import { applyReactionAdded, resolvePanelReaction } from '../lib/reaction-roles/apply.js';

@ApplyOptions<Listener.Options>({ event: Events.MessageReactionAdd })
export class UserEvent extends Listener {
  public override async run(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
    // Switched off: panels stay where they are, reacting does nothing.
    if (!isEnabled('reactionRoles')) {
      return;
    }

    try {
      const hit = await resolvePanelReaction(reaction, user);
      if (hit) {
        await applyReactionAdded(hit);
      }
    } catch (error) {
      this.container.logger.error('Failed to apply a reaction role:', error);
    }
  }
}
