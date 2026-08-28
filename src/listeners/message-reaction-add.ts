import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js';

import { getGuildEventSettings } from '../lib/guild-event-settings.js';
import { reactionMatchesMapping } from '../lib/reaction-roles.js';

@ApplyOptions<Listener.Options>({ event: Events.MessageReactionAdd })
export class UserEvent extends Listener {
  public override async run(
    reaction: MessageReaction | PartialMessageReaction,
    user: User | PartialUser,
  ) {
    const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
    const fullUser = user.partial ? await user.fetch() : user;
    if (fullUser.bot) {
      return;
    }

    const mapping = getGuildEventSettings().reactionRoles.find(
      (entry) =>
        entry.messageId === fullReaction.message.id &&
        reactionMatchesMapping(fullReaction, entry.emoji),
    );
    if (!mapping || !fullReaction.message.guild) {
      return;
    }

    try {
      const member = await fullReaction.message.guild.members.fetch(fullUser.id);
      await member.roles.add(mapping.roleId);
    } catch (error) {
      this.container.logger.error('Failed to add reaction role:', error);
    }
  }
}
