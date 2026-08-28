import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { Events, type GuildMember, type PartialGuildMember } from 'discord.js';

import {
  formatTemplate,
  getGuildEventSettings,
  pickRandomMessage,
} from '../lib/guild-event-settings.js';

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberRemove })
export class UserEvent extends Listener {
  public override async run(member: GuildMember | PartialGuildMember) {
    if (member.user?.bot) {
      return;
    }

    const settings = getGuildEventSettings();
    const template = pickRandomMessage(settings.leaveMessages);
    if (!template || !settings.logChannelId) {
      return;
    }

    const channel = member.guild.channels.cache.get(settings.logChannelId);
    if (!channel?.isTextBased() || !('send' in channel)) {
      return;
    }

    const username = member.displayName ?? member.user?.username ?? member.id;
    const content = formatTemplate(template, {
      user: member.id ? `<@${member.id}>` : username,
      username,
    });

    try {
      await channel.send({
        content,
        allowedMentions: { parse: [] },
      });
    } catch (error) {
      this.container.logger.error('Failed to send leave message:', error);
    }
  }
}
