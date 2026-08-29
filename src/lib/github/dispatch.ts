import { container } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { getConfiguredGuild } from '../discord-guild.js';
import { recordDelivery } from './delivery-log.js';
import { formatGithubNotification } from './format-message.js';
import type { GithubNotification } from './normalize-event.js';
import { getGithubNotifySettings, resolveRepoRule, resolveTemplate } from './settings.js';

export async function dispatchGithubNotification(notification: GithubNotification): Promise<void> {
  const settings = getGithubNotifySettings();
  // WHY: re-checked here because dispatch is fire-and-forget and could otherwise
  // run after a settings update turned the feature off.
  if (!settings.enabled) {
    return;
  }

  const skip = (detail: string): void => {
    recordDelivery(notification.repo, notification.label, 'skipped', detail);
  };

  const rule = resolveRepoRule(settings, notification.repo);
  if (!rule) {
    skip('No channel is set for this repository or as the default.');
    return;
  }

  if (!rule.events[notification.toggle]) {
    skip(`The ${notification.toggle} event is switched off for this repository.`);
    return;
  }

  const guild = getConfiguredGuild();
  if (!guild) {
    skip('Discord is not connected yet.');
    return;
  }

  const channel = guild.channels.cache.get(rule.channelId);
  if (!channel?.isTextBased() || !('send' in channel)) {
    skip('The configured channel no longer exists, or is not one the bot can post in.');
    return;
  }

  const message = formatGithubNotification(
    notification,
    settings.accounts,
    resolveTemplate(settings, notification.toggle),
  );
  if (!message.content) {
    skip('The template rendered an empty message.');
    return;
  }

  try {
    await channel.send({
      content: message.content,
      // WHY: the body carries attacker-controlled text, so nothing may be parsed
      // out of it. Only ids that passed snowflake validation on save can ping.
      allowedMentions: { parse: [], users: message.userIds, roles: [] },
      // WHY: the link is there to be clicked, not to unfurl a preview card that
      // buries the next notification.
      flags: MessageFlags.SuppressEmbeds,
    });
    recordDelivery(notification.repo, notification.label, 'sent');
  } catch (error) {
    // WHY both: the log keeps the stack for a maintainer, the record gives the
    // operator the one line that explains the silence.
    container.logger.error('[github]', error);
    recordDelivery(
      notification.repo,
      notification.label,
      'failed',
      error instanceof Error ? error.message : 'Discord rejected the message.',
    );
  }
}
