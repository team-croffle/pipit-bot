import { container } from '@sapphire/framework';
import type { Guild, GuildBasedChannel, SendableChannels } from 'discord.js';

import { getConfiguredGuild } from '../discord-guild.js';
import { resolveTemplateEmojis } from '../embed/emoji.js';
import { recordDelivery } from './delivery-log.js';
import { formatGithubNotification } from './format-message.js';
import { findTrackedMessage, forgetMessage, rememberMessage } from './message-tracker.js';
import type { GithubNotification } from './normalize-event.js';
import {
  getGithubNotifySettings,
  isRepoListed,
  resolveRepoRule,
  resolveTemplate,
  type GithubEventToggles,
  type GithubNotifySettings,
} from './settings.js';
import { EVENT_LABELS } from './template.js';

/** The messages worth coming back to: the ones that announce the item. */
const ANNOUNCING_TOGGLES = new Set<keyof GithubEventToggles>(['pullRequestOpened', 'issueOpened']);

/** The events that change who the announcement lists. */
const UPDATING_TOGGLES = new Set<keyof GithubEventToggles>([
  'pullRequestAssigned',
  'pullRequestReviewRequested',
  'issueAssigned',
]);

// No pings on an edit: Discord would not deliver them anyway, and the people who
// are new to the item get their own message below.
const NO_PINGS = { parse: [], users: [], roles: [] } as const;

function sendableChannel(
  guild: Guild,
  channelId: string,
): (GuildBasedChannel & SendableChannels) | undefined {
  const channel = guild.channels.cache.get(channelId);
  return channel?.isTextBased() && channel.isSendable() ? channel : undefined;
}

/**
 * The announcement as it would read if it were sent now.
 *
 * Its actor is the author — a pull request is opened by the person who wrote it —
 * and its mentions line lists everyone currently on the item minus the author, the
 * way the opening did. Nothing about the assignment event itself survives here.
 */
function asAnnouncement(
  notification: GithubNotification,
  toggle: keyof GithubEventToggles,
): GithubNotification {
  const author = notification.author ?? notification.actor;
  const seen = new Set<string>([author.toLowerCase()]);
  const targets: string[] = [];
  for (const login of [...notification.reviewers, ...notification.assignees]) {
    if (!seen.has(login.toLowerCase())) {
      seen.add(login.toLowerCase());
      targets.push(login);
    }
  }

  return {
    ...notification,
    toggle,
    label: EVENT_LABELS[toggle],
    actor: author,
    assignee: undefined,
    targets,
    silent: false,
  };
}

/**
 * Re-renders the announcement with the people now on the item and edits it in place.
 * Returns the reason it could not, or undefined when it did.
 */
async function updateAnnouncement(
  notification: GithubNotification,
  settings: GithubNotifySettings,
  guild: Guild,
): Promise<string | undefined> {
  const tracked = findTrackedMessage(notification.repo, notification.number);
  if (!tracked) {
    return 'No earlier message is known for this item.';
  }

  const channel = sendableChannel(guild, tracked.channelId);
  if (!channel) {
    forgetMessage(notification.repo, notification.number);
    return 'The channel of the earlier message is gone.';
  }

  const rendered = formatGithubNotification(
    asAnnouncement(notification, tracked.toggle),
    settings.accounts,
    resolveTemplateEmojis(resolveTemplate(settings, tracked.toggle), guild),
  );
  if (!rendered.content && !rendered.embed) {
    return 'The announcement wording renders empty.';
  }

  try {
    const message = await channel.messages.fetch(tracked.messageId);
    await message.edit({
      content: rendered.content,
      embeds: rendered.embed ? [rendered.embed] : [],
      allowedMentions: NO_PINGS,
    });
    return undefined;
  } catch (error) {
    // Deleted by hand, or older than the bot may read: stop trying for this item.
    // Sending a fresh announcement instead would be the more surprising outcome.
    container.logger.debug('[github] could not edit the earlier message:', error);
    forgetMessage(notification.repo, notification.number);
    return 'The earlier message could not be edited — it may have been deleted.';
  }
}

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

  // Checked before the channel is resolved: with the fallback off, an unlisted
  // repository is skipped even when a default channel exists.
  if (!settings.notifyUnlistedRepos && !isRepoListed(settings, notification.repo)) {
    skip('This repository is not in the list, and unlisted repositories are switched off.');
    return;
  }

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

  // The announcement is brought up to date first, so the people it lists are right
  // whether or not anything is posted below.
  let updateProblem: string | undefined;
  let updated = false;
  if (UPDATING_TOGGLES.has(notification.toggle)) {
    updateProblem = await updateAnnouncement(notification, settings, guild);
    updated = updateProblem === undefined;
  }

  if (notification.silent) {
    if (updated) {
      recordDelivery(
        notification.repo,
        notification.label,
        'edited',
        'Nobody to mention; the announcement was brought up to date.',
      );
    } else {
      skip(
        `Nobody to mention — the actor is the only person this event is about. ${updateProblem ?? ''}`.trim(),
      );
    }
    return;
  }

  const channel = sendableChannel(guild, rule.channelId);
  if (!channel) {
    skip('The configured channel no longer exists, or is not one the bot can post in.');
    return;
  }

  const message = formatGithubNotification(
    notification,
    settings.accounts,
    // Shortcodes become real emoji here, before any payload value is substituted in.
    resolveTemplateEmojis(resolveTemplate(settings, notification.toggle), guild),
  );
  if (!message.content && !message.embed) {
    skip('The template rendered an empty message.');
    return;
  }

  try {
    const sent = await channel.send({
      content: message.content,
      embeds: message.embed ? [message.embed] : [],
      // WHY: the body carries attacker-controlled text, so nothing may be parsed
      // out of it. Only ids that passed snowflake validation on save can ping.
      allowedMentions: { parse: [], users: message.userIds, roles: [] },
      // WHY no SuppressEmbeds here, which v0.6.2 set to stop {pr_url} unfurling a
      // preview card: that flag also hides the embed the bot attaches itself. The
      // link rides on the embed title instead, where it does not unfurl.
    });

    if (ANNOUNCING_TOGGLES.has(notification.toggle)) {
      rememberMessage(notification.repo, notification.number, {
        channelId: channel.id,
        messageId: sent.id,
        toggle: notification.toggle,
      });
    }

    let detail: string | undefined;
    if (updated) {
      detail = 'The announcement was brought up to date as well.';
    } else if (updateProblem) {
      detail = `The announcement was not updated: ${updateProblem}`;
    }
    recordDelivery(notification.repo, notification.label, 'sent', detail);
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
