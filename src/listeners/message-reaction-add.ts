import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js';

import { applyReactionAdded, resolvePanelReaction } from '../lib/reaction-roles/apply.js';

@ApplyOptions<Listener.Options>({ event: Events.MessageReactionAdd })
export class UserEvent extends Listener {
  public override async run(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
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
