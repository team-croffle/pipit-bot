import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import { Events, type Invite } from 'discord.js';

import { getEnv } from '../lib/env.js';
import { refreshGuildInvites } from '../lib/invite-cache.js';

@ApplyOptions<Listener.Options>({ event: Events.InviteDelete })
export class UserEvent extends Listener {
  public override async run(invite: Invite) {
    const guildId = invite.guild?.id;
    if (!getEnv().isMain || !guildId) {
      return;
    }

    const guild = this.container.client.guilds.cache.get(guildId);
    if (guild) {
      await refreshGuildInvites(guild);
    }
  }
}
