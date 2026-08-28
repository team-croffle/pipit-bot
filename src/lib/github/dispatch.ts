import { container } from '@sapphire/framework';

import { getConfiguredGuild } from '../discord-guild.js';
import { formatGithubNotification } from './format-message.js';
import { resolveGithubMentions } from './mentions.js';
import type { GithubNotification } from './normalize-event.js';
import { getGithubNotifySettings, resolveRepoRule } from './settings.js';

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

  const mentions = resolveGithubMentions(notification.targets, settings.accounts);
  try {
    await channel.send({
      content: formatGithubNotification(notification, mentions),
      // WHY: the body carries attacker-controlled text, so nothing may be parsed
      // out of it. Only ids that passed snowflake validation on save can ping.
      allowedMentions: { parse: [], users: mentions.userIds, roles: [] },
    });
  } catch (error) {
    container.logger.error('[github]', error);
  }
}
