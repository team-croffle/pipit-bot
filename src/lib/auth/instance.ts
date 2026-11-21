import { randomUUID } from 'node:crypto';

import { container } from '@sapphire/framework';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, username } from 'better-auth/plugins';

import { accounts, sessions, users, verifications } from '../db/auth-schema.js';
import { getDb } from '../db/client.js';
import type { EnvConfig } from '../env.js';
import { databaseHooks, validateUserInfo } from './hooks.js';
import { discover, discoveryUrl, getDiscovered } from './oidc-discovery.js';
import { PASSWORD_MAX, PASSWORD_MIN } from './password-policy.js';
import { mapDiscordProfile, mapGithubProfile, mapOidcProfile, readOidcClaims } from './profiles.js';

/**
 * The Better Auth instance behind /api/auth/* (docs/decisions/026_v0.8.2_dashboard-login.md).
 *
 * Built on first use, and again once OIDC discovery works if it did not at first
 * (oidc-discovery.ts). Sessions live in the database, so a rebuilt instance keeps
 * everyone signed in. Sign-up is closed: users come from the first-admin environment,
 * the users page, or a first OAuth sign-in that hooks.ts allows.
 */

export const SESSION_DAYS = 7;

function build(config: EnvConfig, withOidc: boolean) {
  const { auth } = config;
  const origin = config.dashboardUrl ? new URL(config.dashboardUrl).origin : undefined;
  const oidc = withOidc ? auth.oidc : null;
  const discovered = getDiscovered();

  return betterAuth({
    appName: 'Pipit',
    baseURL: origin,
    basePath: '/api/auth',
    secret: auth.secret,
    trustedOrigins: origin ? [origin] : undefined,
    database: drizzleAdapter(getDb(), {
      provider: 'pg',
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    user: {
      validateUserInfo,
      additionalFields: {
        groups: { type: 'string[]', required: false, input: false, defaultValue: [] },
        idpGroups: { type: 'string[]', required: false, input: false, defaultValue: [] },
        githubLogin: { type: 'string', required: false, input: true },
        discordUserId: { type: 'string', required: false, input: true },
        devSeed: { type: 'boolean', required: false, input: false, defaultValue: false },
        locale: { type: 'string', required: false, input: false },
      },
    },
    session: { expiresIn: SESSION_DAYS * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
    },
    account: {
      // Linking by address is linking by identifier here (profiles.ts).
      accountLinking: {
        enabled: true,
        trustedProviders: ['oidc', 'discord', 'github'],
        requireLocalEmailVerified: false,
      },
    },
    socialProviders: {
      ...(auth.discord && {
        discord: {
          ...auth.discord,
          disableDefaultScope: true,
          scope: ['identify'],
          mapProfileToUser: mapDiscordProfile,
        },
      }),
      ...(auth.github && {
        github: {
          ...auth.github,
          disableDefaultScope: true,
          scope: ['read:user'],
          mapProfileToUser: mapGithubProfile,
        },
      }),
    },
    plugins: [
      username(),
      genericOAuth({
        config: oidc
          ? [
              {
                providerId: 'oidc',
                name: oidc.displayName,
                discoveryUrl: discoveryUrl(oidc),
                clientId: oidc.clientId,
                clientSecret: oidc.clientSecret,
                scopes: oidc.scopes,
                pkce: true,
                getUserInfo: async (tokens) => {
                  const claims = await readOidcClaims(tokens, discovered?.userinfo_endpoint);
                  return claims ? { ...claims, id: String(claims.sub), emailVerified: true } : null;
                },
                mapProfileToUser: (profile) => mapOidcProfile(profile as Record<string, unknown>),
              },
            ]
          : [],
      }),
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 120,
      customRules: { '/sign-in/username': { window: 60, max: 5 } },
    },
    advanced: {
      cookiePrefix: 'pipit',
      useSecureCookies: config.nodeEnv === 'production',
      database: { generateId: () => randomUUID() },
    },
    onAPIError: { errorURL: '/login' },
    databaseHooks,
    logger: {
      log: (level, message) => {
        const line = `[auth] ${message}`;
        if (level === 'error') {
          container.logger.error(line);
        } else if (level === 'warn') {
          container.logger.warn(line);
        } else {
          container.logger.debug(line);
        }
      },
    },
  });
}

export type PipitAuth = ReturnType<typeof build>;

let instance: { auth: PipitAuth; withOidc: boolean } | undefined;
let lastDiscovery = 0;
// WHY a pause: every dashboard request asks for the instance; while the provider is down
// only OIDC sign-ins should wait for it, and other requests try again now and then.
const REDISCOVER_MS = 60_000;

/**
 * The instance. `needOidc` (an OIDC sign-in or callback) tries discovery first and throws
 * OidcDiscoveryError when the provider cannot be reached; anything else gets the instance
 * as it is.
 */
export async function getAuth(config: EnvConfig, needOidc = false): Promise<PipitAuth> {
  const oidc = config.auth.oidc;
  if (oidc && !instance?.withOidc && (needOidc || Date.now() - lastDiscovery > REDISCOVER_MS)) {
    lastDiscovery = Date.now();
    try {
      await discover(oidc);
      instance = { auth: build(config, true), withOidc: true };
    } catch (error) {
      if (needOidc) {
        throw error;
      }
      instance ??= { auth: build(config, false), withOidc: false };
    }
  }

  instance ??= { auth: build(config, false), withOidc: false };
  return instance.auth;
}

/** Drops the instance — for local checks that change the environment. */
export function resetAuthForChecks(): void {
  instance = undefined;
  lastDiscovery = 0;
}
