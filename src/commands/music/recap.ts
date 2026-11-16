import { ApplyOptions } from '@sapphire/decorators';
import { Command } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { guildOnly } from '../../lib/discord/slash.js';
import { languageOfLocale, translator } from '../../lib/i18n/index.js';
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
  { name: 'This month', name_localizations: { ko: '이번 달' }, value: 'month' },
  { name: 'Last month', name_localizations: { ko: '지난달' }, value: 'last-month' },
  { name: 'This year', name_localizations: { ko: '올해' }, value: 'year' },
  { name: 'Last year', name_localizations: { ko: '작년' }, value: 'last-year' },
];

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
          .setDescriptionLocalizations({ ko: '내 음악 결산 보기 (나에게만 보입니다)' })
          .addStringOption((option) =>
            option
              .setName('period')
              .setDescription('Which period (this month by default)')
              .setDescriptionLocalizations({ ko: '기간 (기본: 이번 달)' })
              .addChoices(...CHOICES),
          ),
      ),
    );
  }

  public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const language = languageOfLocale(interaction.locale);
    const t = translator(language, 'recap');
    if (!interaction.guildId) {
      await interaction.editReply(t('serverOnly'));
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
      await interaction.editReply({
        embeds: [renderRecap(summary, { personal: true, language })],
      });
    } catch (error) {
      this.container.logger.warn('[recap] could not build a personal recap:', error);
      await interaction.editReply(t('failed'));
    }
  }
}
