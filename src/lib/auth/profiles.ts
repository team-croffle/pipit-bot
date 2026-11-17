import { decodeJwt } from 'jose';

import {
  findUserByDiscordId,
  findUserByGithubLogin,
  placeholderEmail,
  type UserRow,
} from '../users/store.js';

/**
 * Turns what a provider says about a person into the `users` row Better Auth signs in.
 *
 * WHY the address decides the user: Better Auth finds the user of an OAuth sign-in by the
 * provider's account first and, when that account is new, by e-mail. No user here has a
 * real address (users/store.ts `placeholderEmail`), so every provider's address is
 * replaced: with the address of the user the person already is — found by Discord id or
 * GitHub login (2026-11-18, the team: link by identifier) — or with a new placeholder for
 * that one account. A provider's own address can therefore never join two people.
 */

/**
 * The groups of OIDC sign-ins in progress, by subject, from reading the claims until the
 * session exists (hooks.ts writes them to the user then). WHY not as a user field of the
 * mapping: Better Auth applies a mapping to an existing user only with "override user
 * info", which would also rewrite the name and address on every sign-in.
 */
const pendingGroups = new Map<string, string[]>();

export function takePendingGroups(subject: string): string[] | undefined {
  const groups = pendingGroups.get(subject);
  pendingGroups.delete(subject);
  return groups;
}

/** The user name an OIDC provider gives, in the order providers fill them. */
export function extractUsername(claims: Record<string, unknown>): string {
  for (const key of ['preferred_username', 'nickname', 'email', 'name', 'sub']) {
    const value = claims[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return 'user';
}

export function extractGroups(claims: Record<string, unknown>): string[] {
  const raw = claims.groups ?? claims.ak_groups ?? claims.group;
  if (Array.isArray(raw)) {
    return raw.filter((group): group is string => typeof group === 'string' && group.length > 0);
  }

  if (typeof raw === 'string') {
    return raw
      .split(/[|,]/)
      .map((group) => group.trim())
      .filter((group) => group.length > 0);
  }

  return [];
}

/**
 * The id token's claims, with the userinfo response filling what it leaves out — some
 * providers put `groups` only in one of them. The token's signature is checked by Better
 * Auth before this runs; this only reads it.
 */
export async function readOidcClaims(
  tokens: { idToken?: string; accessToken?: string },
  userInfoUrl: string | undefined,
): Promise<Record<string, unknown> | null> {
  const fromToken = tokens.idToken ? (decodeJwt(tokens.idToken) as Record<string, unknown>) : {};
  let fromUserInfo: Record<string, unknown> = {};
  if (userInfoUrl && tokens.accessToken) {
    try {
      const response = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      if (response.ok) {
        fromUserInfo = (await response.json()) as Record<string, unknown>;
      }
    } catch {
      // userinfo is optional when the id token carries enough
    }
  }

  const claims = { ...fromUserInfo, ...fromToken };
  if (extractGroups(fromToken).length === 0 && extractGroups(fromUserInfo).length > 0) {
    claims.groups = extractGroups(fromUserInfo);
  }
  if (typeof claims.sub !== 'string') {
    return null;
  }

  // A sign-in abandoned before its session leaves one entry; the map stays small.
  if (pendingGroups.size > 100) {
    pendingGroups.clear();
  }
  pendingGroups.set(claims.sub, extractGroups(claims));
  return claims;
}

function addressOf(existing: UserRow | undefined, provider: string, key: string): string {
  return existing?.email ?? placeholderEmail(provider, key);
}

/** OIDC: the user name is matched against GitHub logins, as the dashboard always did. */
export function mapOidcProfile(claims: Record<string, unknown>) {
  const name = extractUsername(claims);
  const existing = findUserByGithubLogin(name);
  return {
    name: existing?.name ?? name,
    email: addressOf(existing, 'oidc', String(claims.sub)),
    emailVerified: true,
  };
}

export function mapDiscordProfile(profile: {
  id: string;
  username: string;
  global_name?: string | null;
}) {
  const existing = findUserByDiscordId(profile.id);
  return {
    name: existing?.name ?? profile.global_name ?? profile.username,
    email: addressOf(existing, 'discord', profile.id),
    emailVerified: true,
    discordUserId: profile.id,
  };
}

export function mapGithubProfile(profile: { id: number | string; login: string }) {
  const login = profile.login.toLowerCase();
  const existing = findUserByGithubLogin(login);
  return {
    name: existing?.name ?? login,
    email: addressOf(existing, 'github', String(profile.id)),
    emailVerified: true,
    githubLogin: login,
  };
}
