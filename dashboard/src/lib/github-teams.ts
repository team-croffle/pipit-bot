import { t } from '@/i18n';
import type { GithubTeamMapping } from '@/types';

/**
 * Client-side shape of the server's team-mapping check, so a wrong row is named
 * before the request goes out instead of coming back as a bare 400.
 *
 * `org/slug`: the organisation follows the login grammar (39 chars), a team slug is
 * lower-case letters, digits and single hyphens (100 chars). Both are lower-cased
 * before the check because that is how the server stores and matches them.
 */
export const teamPattern =
  /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}\/[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,99}$/;

const snowflake = /^\d{17,20}$/;

export function normalizeTeamKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalised rows ready to save, or the message for the first row that is wrong. */
export function prepareTeamMappings(
  rows: GithubTeamMapping[],
): { teams: GithubTeamMapping[]; error?: undefined } | { teams?: undefined; error: string } {
  // Blank rows are dropped the way blank account rows are; a half-filled one is reported.
  const teams = rows
    .map((row) => ({
      githubTeam: normalizeTeamKey(row.githubTeam),
      discordRoleId: row.discordRoleId.trim(),
    }))
    .filter((row) => row.githubTeam || row.discordRoleId);

  const seen = new Set<string>();
  for (const row of teams) {
    if (!row.githubTeam || !row.discordRoleId) {
      return { error: t('github.errors.teamIncomplete') };
    }

    if (!teamPattern.test(row.githubTeam)) {
      return { error: t('github.errors.teamFormat', { team: row.githubTeam }) };
    }

    if (seen.has(row.githubTeam)) {
      return { error: t('github.errors.teamDuplicate', { team: row.githubTeam }) };
    }

    if (!snowflake.test(row.discordRoleId)) {
      return { error: t('github.errors.roleIdInvalid', { role: row.discordRoleId }) };
    }

    seen.add(row.githubTeam);
  }

  return { teams };
}
