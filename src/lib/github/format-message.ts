import { escapeMarkdown } from 'discord.js';

import { resolveGithubMentions } from './mentions.js';
import type { GithubNotification } from './normalize-event.js';
import type { GithubAccountMapping } from './settings.js';
import { renderTemplate, type TemplateValues } from './template.js';

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 1900;
const ZERO_WIDTH_SPACE = '​';

// WHY: maskedLink, heading and the list options are off by default, which would
// leave `[text](https://evil.test)` in a pull request title clickable.
const ESCAPE_OPTIONS = {
  heading: true,
  bulletedList: true,
  numberedList: true,
  maskedLink: true,
} as const;

export interface RenderedMessage {
  content: string;
  userIds: string[];
}

/**
 * Neutralizes attacker-controlled text — anyone able to open a pull request picks
 * its title. Collapsing whitespace stops forged extra lines; the `@` substitution
 * stops `@everyone` and `<@id>` from rendering as mentions at all.
 */
export function sanitizeGithubText(value: string, maxLength = MAX_TITLE_LENGTH): string {
  const collapsed = value.replaceAll(/\s+/g, ' ').trim();
  const clipped = collapsed.length > maxLength ? `${collapsed.slice(0, maxLength)}…` : collapsed;
  return escapeMarkdown(clipped, ESCAPE_OPTIONS).replaceAll('@', `@${ZERO_WIDTH_SPACE}`);
}

/**
 * Rebuilds the link from values the operator already vetted instead of trusting
 * `html_url` from the payload, which removes masked-link phishing as a class.
 */
export function buildGithubIssueUrl(
  repo: string,
  issueNumber: number,
  isPullRequest: boolean,
): string {
  return `https://github.com/${repo}/${isPullRequest ? 'pull' : 'issues'}/${issueNumber}`;
}

/**
 * Fills the operator's template.
 *
 * The template is trusted — an admin wrote it in the dashboard, so its markdown is
 * kept. Every value put into it is not: each one is sanitized here, and only ids
 * that came from the saved account mapping ever reach `userIds`.
 */
export function formatGithubNotification(
  notification: GithubNotification,
  accounts: GithubAccountMapping[],
  template: string,
): RenderedMessage {
  const userIds: string[] = [];
  const mention = (logins: string[]): string => {
    const resolved = resolveGithubMentions(logins, accounts);
    for (const id of resolved.userIds) {
      if (!userIds.includes(id)) {
        userIds.push(id);
      }
    }

    return resolved.text;
  };

  const values: TemplateValues = {
    repo: sanitizeGithubText(notification.repo),
    pr_number: String(notification.number),
    pr_url: buildGithubIssueUrl(notification.repo, notification.number, notification.isPullRequest),
    pr_title: sanitizeGithubText(notification.title),
    event: notification.label,
    actor: mention([notification.actor]),
    author: mention(notification.author ? [notification.author] : []),
    assignees: mention(notification.assignees),
    reviewers: mention(notification.reviewers),
    mentions: mention(notification.targets),
  };

  const content = renderTemplate(template, values);

  return {
    content: content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) : content,
    userIds,
  };
}
