import type { GithubAccountMapping } from './settings.js';
import type { GithubTeamMapping } from './team-mappings.js';

export interface ResolvedMentions {
  text: string;
  userIds: string[];
}

export interface ResolvedTeamMentions {
  text: string;
  roleIds: string[];
}

const ZERO_WIDTH_SPACE = '​';

/** Inline code with the `@` broken — never scanned by Discord's mention parser. */
function inert(name: string): string {
  // WHY: the code span already stops Discord parsing this, but a login is
  // legitimately allowed to be "everyone" — so break the `@` as well.
  return `\`@${ZERO_WIDTH_SPACE}${name.replaceAll('`', '')}\``;
}

/**
 * Maps GitHub logins to Discord mentions.
 *
 * Unmapped logins render inside inline code: they arrive from the webhook payload
 * rather than the operator's settings, and a code span is never scanned by
 * Discord's mention parser. Only mapped ids reach `userIds`, which is the sole
 * source for `allowedMentions.users`.
 */
export function resolveGithubMentions(
  logins: string[],
  accounts: GithubAccountMapping[],
): ResolvedMentions {
  const byLogin = new Map(accounts.map((account) => [account.githubLogin, account.discordUserId]));
  const userIds: string[] = [];
  const parts: string[] = [];

  for (const login of logins) {
    const discordUserId = byLogin.get(login.toLowerCase());
    if (discordUserId) {
      if (!userIds.includes(discordUserId)) {
        userIds.push(discordUserId);
      }

      parts.push(`<@${discordUserId}>`);
      continue;
    }

    parts.push(inert(login));
  }

  return { text: parts.join(' '), userIds };
}

/** The teams (`org/slug` keys) that no mapping names — they can only be spelled out. */
export function unmappedTeams(teams: string[], mappings: GithubTeamMapping[]): string[] {
  const mapped = new Set(mappings.map((mapping) => mapping.githubTeam));
  return teams.filter((team) => !mapped.has(team.toLowerCase()));
}

/**
 * Maps GitHub teams (`org/slug` keys) to Discord role mentions.
 *
 * A mapped team renders as its role; only those ids reach `roleIds`, the sole
 * source for `allowedMentions.roles`. An unmapped team renders the way an unmapped
 * login does — as `team/<slug>` in inert inline code, the form the announcement
 * showed before teams could be mapped at all, so nothing changes for an operator
 * who has mapped none.
 */
export function resolveTeamMentions(
  teams: string[],
  mappings: GithubTeamMapping[],
): ResolvedTeamMentions {
  const byTeam = new Map(mappings.map((mapping) => [mapping.githubTeam, mapping.discordRoleId]));
  const roleIds: string[] = [];
  const parts: string[] = [];

  for (const team of teams) {
    const roleId = byTeam.get(team.toLowerCase());
    if (roleId) {
      if (!roleIds.includes(roleId)) {
        roleIds.push(roleId);
      }

      parts.push(`<@&${roleId}>`);
      continue;
    }

    const slug = team.slice(team.indexOf('/') + 1);
    parts.push(inert(`team/${slug}`));
  }

  return { text: parts.join(' '), roleIds };
}
