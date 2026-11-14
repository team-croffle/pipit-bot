import { bigint, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The tables. Only data the bot produces and keeps adding to lives here — tracked
 * messages, banners, counters, logs, playlists, panels, account links. Settings a person
 * opens and edits stay JSON files under data/ (docs/decisions/024_v0.8.0_database.md).
 *
 * Generate a migration after changing this file:  yarn db:generate --name <what>
 */

/** Which data/ files have been moved in (migrate-file.ts), so none is moved twice. */
export const fileMigrations = pgTable('file_migrations', {
  name: text('name').primaryKey(),
  items: integer('items').notNull(),
  migratedAt: timestamp('migrated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** The Discord message that announced each pull request or issue (github/message-tracker.ts). */
export const trackedMessages = pgTable('tracked_messages', {
  /** Lower-cased `owner/name#number`. */
  key: text('key').primaryKey(),
  channelId: text('channel_id').notNull(),
  messageId: text('message_id').notNull(),
  toggle: text('toggle').notNull(),
  at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull(),
  mentioned: text('mentioned').array().notNull().default([]),
});

/** Which message is the remote-control banner in each music channel (music/banner/store.ts). */
export const musicBanners = pgTable('music_banners', {
  channelId: text('channel_id').primaryKey(),
  messageId: text('message_id').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** How many members each invite code brought in (invite-stats.ts). */
export const inviteStats = pgTable('invite_stats', {
  code: text('code').primaryKey(),
  joins: integer('joins').notNull(),
  inviterId: text('inviter_id'),
  lastJoinAt: text('last_join_at').notNull(),
});

/** The audit log (audit/log.ts): who did what, and how it went. Kept 90 days. */
export const auditEntries = pgTable(
  'audit_entries',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    at: timestamp('at', { withTimezone: true, mode: 'string' }).notNull(),
    category: text('category').notNull(),
    action: text('action').notNull(),
    actorId: text('actor_id'),
    actorName: text('actor_name'),
    target: text('target'),
    outcome: text('outcome').notNull(),
    detail: text('detail'),
  },
  (table) => [
    index('audit_entries_at').on(table.at),
    index('audit_entries_category_at').on(table.category, table.at),
  ],
);
