/**
 * GitHub team → Discord role mappings.
 *
 * A review request can name a team instead of a person (`requested_team`), and the
 * team's members are not in the payload. Rather than listing them (which would need
 * an extra App permission and a lookup on every event), the operator maps each team
 * to one Discord role, and that role is what gets mentioned.
 *
 * Kept apart from settings.ts, which is already at its size limit.
 */

export interface GithubTeamMapping {
  /** `org/slug`, lower-case — the organisation is the repository owner. */
  githubTeam: string;
  discordRoleId: string;
}

/** Bounded like the account mappings: a team has few teams. */
export const MAX_TEAM_MAPPINGS = 100;

const snowflake = /^\d{17,20}$/;
// WHY: the organisation follows the login grammar; a team slug is what GitHub makes
// of a team name — lower-case letters, digits and hyphens. Same security purpose as
// the login check — nothing that could read as markdown or a mention persists.
const orgName = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/;
const teamSlug = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,99}$/;

/** Normalises what the dashboard or a payload gives into the stored key. */
export function normalizeTeamKey(org: string, slug: string): string {
  return `${org.trim().toLowerCase()}/${slug.trim().toLowerCase()}`;
}

export function isValidTeamKey(value: string): boolean {
  const parts = value.split('/');
  return parts.length === 2 && orgName.test(parts[0]!) && teamSlug.test(parts[1]!);
}

export function asTeamMappings(value: unknown): GithubTeamMapping[] {
  if (!Array.isArray(value)) {
    throw new Error('teams must be an array');
  }

  const teams: GithubTeamMapping[] = [];
  const seen = new Set<string>();
  for (const item of value.slice(0, MAX_TEAM_MAPPINGS)) {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid team mapping');
    }

    const row = item as Record<string, unknown>;
    const key = typeof row.githubTeam === 'string' ? row.githubTeam.trim().toLowerCase() : '';
    if (!isValidTeamKey(key)) {
      throw new Error('Each team needs the form org/team-slug');
    }

    if (seen.has(key)) {
      throw new Error(`Duplicate team: ${key}`);
    }

    if (typeof row.discordRoleId !== 'string' || !snowflake.test(row.discordRoleId)) {
      throw new Error('Each team needs a Discord role id');
    }

    seen.add(key);
    teams.push({ githubTeam: key, discordRoleId: row.discordRoleId });
  }

  return teams;
}
