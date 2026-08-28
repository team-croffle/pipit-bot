import type { GithubAccountMapping } from './settings.js';

export interface ResolvedMentions {
  text: string;
  userIds: string[];
}

const ZERO_WIDTH_SPACE = '​';

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

    // WHY: the code span already stops Discord parsing this, but a login is
    // legitimately allowed to be "everyone" — so break the `@` as well.
    parts.push(`\`@${ZERO_WIDTH_SPACE}${login.replaceAll('`', '')}\``);
  }

  return { text: parts.join(' '), userIds };
}
