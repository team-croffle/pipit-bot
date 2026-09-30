import { escapeMarkdown, type APIEmbed } from 'discord.js';

import { renderEmbedTemplate, type EmbedTemplate } from './embed-template.js';
import { resolveGithubMentions, resolveTeamMentions } from './mentions.js';
import type { GithubNotification } from './normalize-event.js';
import type { GithubAccountMapping } from './settings.js';
import type { GithubTeamMapping } from './team-mappings.js';
import type { TemplateValues } from './template.js';

const MAX_TITLE_LENGTH = 200;
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
  embed: APIEmbed | undefined;
  userIds: string[];
  /** The roles standing for the teams the message is about — `allowedMentions.roles`. */
  roleIds: string[];
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
 * that came from the saved account and team mappings ever reach `userIds` and
 * `roleIds`.
 */
export function formatGithubNotification(
  notification: GithubNotification,
  accounts: GithubAccountMapping[],
  template: EmbedTemplate,
  teams: GithubTeamMapping[] = [],
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

  const teamMentions = resolveTeamMentions(notification.teams, teams);
  // A team review request names the team as its subject (`team/<slug>`), and
  // `{assignee}` reads as that team — its role when one is mapped, the inert
  // `team/<slug>` otherwise. The same text serves both places.
  const subjectIsTeam = notification.assignee?.startsWith('team/') === true;

  const values: TemplateValues = {
    repo: sanitizeGithubText(notification.repo),
    pr_number: String(notification.number),
    pr_url: buildGithubIssueUrl(notification.repo, notification.number, notification.isPullRequest),
    pr_title: sanitizeGithubText(notification.title),
    event: notification.label,
    actor: mention([notification.actor]),
    author: mention(notification.author ? [notification.author] : []),
    assignee: subjectIsTeam
      ? teamMentions.text
      : mention(notification.assignee ? [notification.assignee] : []),
    assignees: mention(notification.assignees),
    reviewers: mention(notification.reviewers),
    // People first, then the teams asked alongside them.
    mentions: [mention(notification.targets), teamMentions.text].filter(Boolean).join(' '),
  };

  const rendered = renderEmbedTemplate(template, values);

  return {
    content: rendered.content,
    embed: rendered.embed,
    userIds,
    roleIds: teamMentions.roleIds,
  };
}
