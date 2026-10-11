import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { replyNotice } from '../../lib/discord/notice.js';
import { guildOnly } from '../../lib/discord/slash.js';
import { joinVoiceChannel } from '../../lib/music/voice-connection.js';

@ApplyOptions<Command.Options>({
  description: 'Join your voice channel, or move there',
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(builder.setName(this.name).setDescription(this.description)),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    if (!interaction.inCachedGuild()) {
      return;
    }

    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) {
      await replyNotice(interaction, { ok: false, message: 'Join a voice channel first.' });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await replyNotice(interaction, await joinVoiceChannel(voiceChannel));
  }
}
