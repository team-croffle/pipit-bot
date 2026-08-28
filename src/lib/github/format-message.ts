import { escapeMarkdown } from 'discord.js';

import type { ResolvedMentions } from './mentions.js';
import type { GithubNotification } from './normalize-event.js';

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

export function formatGithubNotification(
  notification: GithubNotification,
  mentions: ResolvedMentions,
): string {
  const url = buildGithubIssueUrl(
    notification.repo,
    notification.number,
    notification.isPullRequest,
  );
  const title = sanitizeGithubText(notification.title);
  const headline = `**${notification.label}** · \`${notification.repo}\` [#${notification.number}](${url}) — ${title}`;
  const content = mentions.text ? `${headline}\n${mentions.text}` : headline;

  return content.length > MAX_CONTENT_LENGTH ? content.slice(0, MAX_CONTENT_LENGTH) : content;
}
