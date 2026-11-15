import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { guildOnly } from '../../lib/discord/slash.js';
import { buildRecap } from '../../lib/music/recap/aggregate.js';
import {
  currentPeriods,
  monthPeriod,
  yearPeriod,
  type Period,
} from '../../lib/music/recap/periods.js';
import { renderRecap } from '../../lib/music/recap/render.js';
import { getRecapSettings } from '../../lib/music/recap/settings.js';

/**
 * Your own music recap, shown only to you: the tracks you asked for, counted the way the
 * channel recap counts everyone's. Nobody else's plays are in it.
 */

const CHOICES = [
  { name: 'This month', value: 'month' },
  { name: 'Last month', value: 'last-month' },
  { name: 'This year', value: 'year' },
  { name: 'Last year', value: 'last-year' },
] as const;

function periodFor(choice: string, timeZone: string): Period {
  const now = currentPeriods(new Date(), timeZone);
  switch (choice) {
    case 'last-month':
      return monthPeriod(now.month.year, now.month.month! - 1);
    case 'year':
      return now.year;
    case 'last-year':
      return yearPeriod(now.year.year - 1);
    default:
      return now.month;
  }
}

@ApplyOptions<Command.Options>({
  description: 'Show your own music recap (only you see it)',
})
export class UserCommand extends Command {
  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand((builder) =>
      guildOnly(
        builder
          .setName(this.name)
          .setDescription(this.description)
          .addStringOption((option) =>
            option
              .setName('period')
              .setDescription('Which period (this month by default)')
              .addChoices(...CHOICES),
          ),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!interaction.guildId) {
      await interaction.editReply('Use this in the server.');
      return;
    }

    const { timeZone, topN } = getRecapSettings();
    const period = periodFor(interaction.options.getString('period') ?? 'month', timeZone);
    try {
      const summary = await buildRecap({
        guildId: interaction.guildId,
        period,
        timeZone,
        topN,
        personId: interaction.user.id,
      });
      await interaction.editReply({ embeds: [renderRecap(summary, { personal: true })] });
    } catch (error) {
      this.container.logger.warn('[recap] could not build a personal recap:', error);
      await interaction.editReply('Your recap could not be built right now.');
    }
  }
}
