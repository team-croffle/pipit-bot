import { container } from '@sapphire/framework';
import { and, eq } from 'drizzle-orm';

import { audit } from '../audit/log.js';
import { accounts, users } from '../db/auth-schema.js';
import { getDb } from '../db/client.js';
import { getConfiguredGuild } from '../discord-guild.js';
import { reloadUser } from '../users/store.js';
import { takePendingGroups } from './profiles.js';

/**
 * Better Auth's database hooks: who may become a user, and keeping users/store.ts in step.
 *
 * Who may sign in for the first time (2026-11-18, the team): through OIDC anyone the
 * identity provider lets through; through Discord only a member of the bot's server;
 * through GitHub nobody new — only a login a user already has (profiles.ts links those
 * before a user would be created).
 */

export const NOT_ALLOWED = 'not_allowed';

/** The provider of the OAuth callback being handled, if this write comes from one. */
function callbackProvider(context: unknown): string | undefined {
  const params = (context as { params?: Record<string, string> } | null)?.params;
  return params?.id ?? params?.providerId;
}

async function isGuildMember(discordUserId: string): Promise<boolean> {
  const guild = getConfiguredGuild();
  if (!guild || !discordUserId) {
    // The bot is not connected to Discord yet; nobody can be checked, so nobody new gets in.
    return false;
  }

  try {
    await guild.members.fetch(discordUserId);
    return true;
  } catch {
    return false;
  }
}

/** Better Auth's `user.validateUserInfo`: a refusal sends the browser back with `?error=not_allowed`. */
export async function validateUserInfo(data: {
  user: Record<string, unknown>;
  source: { action: string; method: string; oauth?: { providerId: string } };
}): Promise<{ error: string } | undefined> {
  if (data.source.action !== 'create-user' || data.source.method !== 'oauth') {
    return undefined;
  }

  const provider = data.source.oauth?.providerId;
  if (provider === 'github') {
    container.logger.info(
      `[auth] sign-in refused: GitHub login ${String(data.user.githubLogin)} is not a known user`,
    );
    return { error: NOT_ALLOWED };
  }

  if (provider === 'discord') {
    const id = String(data.user.discordUserId ?? '');
    if (!(await isGuildMember(id))) {
      container.logger.info(
        `[auth] sign-in refused: Discord user ${id} is not a member of the server`,
      );
      return { error: NOT_ALLOWED };
    }
  }

  return undefined;
}

/** Writes the groups an OIDC sign-in brought onto its user. */
async function storeIdpGroups(userId: string): Promise<void> {
  const [account] = await getDb()
    .select({ accountId: accounts.accountId })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, 'oidc')));
  const groups = account ? takePendingGroups(account.accountId) : undefined;
  if (groups) {
    await getDb().update(users).set({ idpGroups: groups }).where(eq(users.id, userId));
  }
}

export const databaseHooks = {
  user: {
    create: {
      after: async (user: { id: string }) => {
        await reloadUser(user.id);
      },
    },
    update: {
      after: async (user: { id: string }) => {
        await reloadUser(user.id);
      },
    },
  },
  session: {
    create: {
      after: async (session: { userId: string }, context: unknown) => {
        const provider = callbackProvider(context);
        if (provider === 'oidc') {
          await storeIdpGroups(session.userId);
        }
        const user = await reloadUser(session.userId);
        void audit({
          category: 'dashboard',
          action: 'auth.sign-in',
          actor: { name: user?.username ?? user?.name ?? session.userId },
          outcome: 'ok',
          detail: provider ?? 'password',
        });
      },
    },
  },
};
