import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import {
  Events,
  type MessageReaction,
  type PartialMessageReaction,
  type PartialUser,
  type User,
} from 'discord.js';

import { reactionMatchesEmoji } from '../lib/reaction-roles/match.js';
import { findPanelByMessage } from '../lib/reaction-roles/settings.js';

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

    const guild = fullReaction.message.guild;
    const panel = findPanelByMessage(fullReaction.message.id);
    if (!panel || !guild) {
      return;
    }

    const option = panel.options.find((entry) => reactionMatchesEmoji(fullReaction, entry.emoji));
    if (!option) {
      return;
    }

    try {
      const member = await guild.members.fetch(fullUser.id);
      await member.roles.add(option.roleId);
    } catch (error) {
      this.container.logger.error('Failed to add reaction role:', error);
    }
  }
}
