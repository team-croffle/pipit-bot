import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { Events, type GuildMember } from 'discord.js';

import {
  formatTemplate,
  getGuildEventSettings,
  pickRandomMessage,
} from '../lib/guild-event-settings.js';
import { consumeUsedInvite } from '../lib/invite-cache.js';

@ApplyOptions<Listener.Options>({ event: Events.GuildMemberAdd })
export class UserEvent extends Listener {
  public override async run(member: GuildMember) {
    if (member.user.bot) {
      return;
    }

    const settings = getGuildEventSettings();
    const invite = await consumeUsedInvite(member.guild);
    const inviter =
      invite?.inviterId === null || invite?.inviterId === undefined
        ? 'Unknown'
        : `<@${invite.inviterId}>`;

    const template = pickRandomMessage(settings.joinMessages);
    if (template && settings.logChannelId) {
      const channel = member.guild.channels.cache.get(settings.logChannelId);
      if (channel?.isTextBased() && 'send' in channel) {
        const content = formatTemplate(template, {
          user: `<@${member.id}>`,
          username: member.displayName,
          inviter,
          invite: invite?.code ?? 'Unknown',
        });
        try {
          await channel.send({
            content,
            allowedMentions: {
              users: invite?.inviterId ? [member.id, invite.inviterId] : [member.id],
            },
          });
        } catch (error) {
          this.container.logger.error('Failed to send join message:', error);
        }
      }
    }

    if (settings.joinRoleIds.length === 0) {
      return;
    }

    try {
      await member.roles.add(settings.joinRoleIds);
    } catch (error) {
      this.container.logger.error('Failed to assign join roles:', error);
    }
  }
}
