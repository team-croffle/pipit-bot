import { container } from '@sapphire/framework';

import { retiredAuthVariables } from '../env-auth.js';
import type { EnvConfig } from '../env.js';
import { createPasswordUser, hasPasswordAccounts } from '../users/passwords.js';
import { getUsers } from '../users/store.js';
import { isMethodActive, loadAuthMethods } from './methods.js';

/**
 * Sign-in at start: the method switches, the first admin, the development accounts.
 *
 * The first admin (`DASHBOARD_BOOTSTRAP_USERNAME` / `_PASSWORD`) is made once, when no
 * password account exists, in the first admin group — and never touched again, so the
 * environment cannot reset a password that was changed on the dashboard.
 *
 * The development accounts exist only where NODE_ENV is development (2026-11-18, the
 * team: production has none). A production start that finds one — a development
 * database brought over — refuses to run rather than leave a known password open.
 */

export const DEV_ACCOUNTS = [
  { username: 'admin', password: 'admin1234!', admin: true },
  { username: 'member', password: 'member1234!', admin: false },
] as const;

function adminGroup(config: EnvConfig): string {
  return config.dashboardAdminGroups[0] ?? 'pipit-admins';
}

async function seedDevelopmentAccounts(config: EnvConfig): Promise<void> {
  for (const account of DEV_ACCOUNTS) {
    if (!getUsers().some((user) => user.username === account.username)) {
      await createPasswordUser(config, {
        username: account.username,
        password: account.password,
        groups: account.admin ? [adminGroup(config)] : [],
        devSeed: true,
      });
      container.logger.info(`[auth] created the development account ${account.username}`);
    }
  }
}

export async function startAuth(config: EnvConfig): Promise<void> {
  for (const name of retiredAuthVariables()) {
    container.logger.warn(
      name === 'OIDC_REDIRECT_URI' && !process.env.DASHBOARD_URL?.trim()
        ? '[auth] OIDC_REDIRECT_URI is no longer used for sign-in; its origin stands in for DASHBOARD_URL — set DASHBOARD_URL'
        : `[auth] ${name} is no longer used and is ignored`,
    );
  }

  await loadAuthMethods(config.auth);

  if (config.nodeEnv === 'production') {
    const seeded = getUsers().filter((user) => user.devSeed);
    if (seeded.length > 0) {
      throw new Error(
        `The database holds development accounts (${seeded.map((user) => user.username).join(', ')}); delete them before running in production.`,
      );
    }
  } else if (config.nodeEnv === 'development') {
    await seedDevelopmentAccounts(config);
  }

  const bootstrap = config.auth.bootstrap;
  if (bootstrap && !(await hasPasswordAccounts())) {
    const user = await createPasswordUser(config, { ...bootstrap, groups: [adminGroup(config)] });
    container.logger.info(`[auth] created the first admin ${user.username}`);
  }

  if (isMethodActive('password') && !(await hasPasswordAccounts())) {
    container.logger.warn(
      '[auth] password sign-in is on but there is no password account — set DASHBOARD_BOOTSTRAP_USERNAME and DASHBOARD_BOOTSTRAP_PASSWORD to create the first admin',
    );
  }
}
