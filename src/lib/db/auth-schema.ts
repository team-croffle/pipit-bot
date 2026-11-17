import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The dashboard's users and their sign-ins (lib/auth/). Better Auth reads and writes these
 * through its drizzle adapter; the property names are its field names.
 *
 * A user is a person on the team, whether or not they can sign in: the GitHub ↔ Discord
 * account links moved here (v0.8.2), so mentions, personal playlists and personal recaps
 * all ask this table. `email` is required by Better Auth but never shown or mailed — every
 * user gets a placeholder `…@users.invalid` (docs/decisions/026_v0.8.2_dashboard-login.md).
 */

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** The password sign-in name, lower-cased (Better Auth `username` plugin). */
  username: text('username').unique(),
  displayUsername: text('display_username'),
  /** Groups given on the dashboard. Admin is a group (DASHBOARD_ADMIN_GROUPS), not a role. */
  groups: text('groups').array().notNull().default([]),
  /** Groups the identity provider sent at the last OIDC sign-in; the provider owns them. */
  idpGroups: text('idp_groups').array().notNull().default([]),
  /** Lower-cased. Mentions and GitHub sign-in find the person by it. */
  githubLogin: text('github_login').unique(),
  discordUserId: text('discord_user_id').unique(),
  /** One of the fixed development accounts — a production start refuses to run with one. */
  devSeed: boolean('dev_seed').notNull().default(false),
});

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => [index('sessions_user_id').on(table.userId)],
);

/** How a user signs in: `credential` (password), `oidc`, `discord`, `github`. */
export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('accounts_user_id').on(table.userId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('verifications_identifier').on(table.identifier)],
);
