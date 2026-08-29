import { container } from '@sapphire/framework';
import { MessageFlags } from 'discord.js';

import { getConfiguredGuild } from '../discord-guild.js';
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

  const rule = resolveRepoRule(settings, notification.repo);
  if (!rule?.events[notification.toggle]) {
    return;
  }

  const guild = getConfiguredGuild();
  if (!guild) {
    return;
  }

  const channel = guild.channels.cache.get(rule.channelId);
  if (!channel?.isTextBased() || !('send' in channel)) {
    return;
  }

  const message = formatGithubNotification(
    notification,
    settings.accounts,
    resolveTemplate(settings, notification.toggle),
  );
  if (!message.content) {
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
  } catch (error) {
    container.logger.error('[github]', error);
  }
}
