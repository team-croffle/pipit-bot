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
      return { error: '모든 팀 매핑에는 GitHub 팀과 디스코드 역할이 필요합니다.' };
    }

    if (!teamPattern.test(row.githubTeam)) {
      return { error: `"${row.githubTeam}" 은(는) org/team-slug 형식이 아닙니다.` };
    }

    if (seen.has(row.githubTeam)) {
      return { error: `"${row.githubTeam}" 팀이 두 번 매핑되어 있습니다.` };
    }

    if (!snowflake.test(row.discordRoleId)) {
      return { error: `"${row.discordRoleId}" 은(는) 올바른 역할 ID가 아닙니다.` };
    }

    seen.add(row.githubTeam);
  }

  return { teams };
}
