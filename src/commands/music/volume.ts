import { ApplyOptions } from '@sapphire/decorators';
import { type Args, Command } from '@sapphire/framework';
import type { Message } from 'discord.js';

import { getVolumeLevel } from '../../lib/music/pcm-volume.js';
import { setVolumeLevel } from '../../lib/music/queue-actions.js';
import { isVolumeLevel, VOLUME_LEVELS } from '../../lib/music/volume-levels.js';

@ApplyOptions<Command.Options>({
  description: 'Set volume: low (30), mid (50), high (100)',
  aliases: ['vol', '볼륨'],
  preconditions: ['MusicChannel'],
})
export class UserCommand extends Command {
  public override async messageRun(message: Message, args: Args): Promise<void> {
    const result = await this.doVolume(message.guildId, args);

    if (message.channel.isSendable()) {
      await message.channel.send(result);
    }
  }

  private async doVolume(guildId: string | null, args: Args): Promise<string> {
    if (!guildId) {
      return 'No guild ID provided';
    }

    const input = await args.pick('string').catch(() => null);

    if (!input) {
      return `Current volume: **${getVolumeLevel()}** (${VOLUME_LEVELS[getVolumeLevel()]})\nUsage: \`!volume low\` / \`!volume mid\` / \`!volume high\``;
    }

    const level = input.toLowerCase();
    if (!isVolumeLevel(level)) {
      return `Invalid level. Use: \`!volume low\` / \`!volume mid\` / \`!volume high\``;
    }

    const result = setVolumeLevel(level, guildId);
    return result.ok ? `Volume set to **${level}** (${VOLUME_LEVELS[level]}).` : result.message;
  }
}
