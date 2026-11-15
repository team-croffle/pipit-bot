import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

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

/** Playlists (music/playlists/store.ts); their tracks are in `playlist_items`, in order. */
export const playlists = pgTable('playlists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  scope: text('scope').notNull(),
  ownerId: text('owner_id'),
  createdById: text('created_by_id'),
  createdByName: text('created_by_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
});

/** The tracks of a playlist. `request` is what is sent to the music worker — never shown. */
export const playlistItems = pgTable(
  'playlist_items',
  {
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    position: integer('position').notNull(),
    title: text('title').notNull(),
    durationSec: integer('duration_sec'),
    request: text('request').notNull(),
    typed: boolean('typed').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.playlistId, table.id] })],
);

/** Reaction role panels (reaction-roles/settings.ts), in the order the dashboard keeps them. */
export const reactionRolePanels = pgTable('reaction_role_panels', {
  id: text('id').primaryKey(),
  position: integer('position').notNull(),
  name: text('name').notNull(),
  channelId: text('channel_id').notNull(),
  /** Null until the bot has published the panel. */
  messageId: text('message_id'),
  singleReaction: boolean('single_reaction').notNull().default(false),
  /** The embed template as the dashboard composed it. */
  embed: jsonb('embed').notNull(),
});

/** The emoji → role choices of a panel, in order. */
export const reactionRoleOptions = pgTable(
  'reaction_role_options',
  {
    panelId: text('panel_id')
      .notNull()
      .references(() => reactionRolePanels.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    emoji: text('emoji').notNull(),
    roleId: text('role_id').notNull(),
  },
  (table) => [primaryKey({ columns: [table.panelId, table.position] })],
);

/**
 * GitHub login ↔ Discord user (account-links.ts): identity, not a setting — mentions,
 * personal playlists and the dashboard's own user all ask it.
 */
export const accountLinks = pgTable('account_links', {
  /** Lower-cased. */
  githubLogin: text('github_login').primaryKey(),
  discordUserId: text('discord_user_id').notNull(),
});

/**
 * One row per track that started playing (music/recap/recorder.ts) — what the monthly and
 * yearly recaps count. Kept 400 days, long enough for a year's recap.
 *
 * WHY the requester is here but never leaves: a recap may count people, and a person may
 * see their own recap, but no screen shows who asked for which track
 * (docs/decisions/025_v0.8.1_music-recap.md).
 * What was asked for is not kept here at all.
 */
export const musicPlays = pgTable(
  'music_plays',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }).notNull(),
    guildId: text('guild_id').notNull(),
    /** The file key the music worker named; what the recap counts by. */
    fileKey: text('file_key').notNull(),
    title: text('title').notNull(),
    durationSec: integer('duration_sec'),
    playedSec: integer('played_sec').notNull().default(0),
    /** `finished` · `skipped` · `stopped` · `error`; null while it plays. */
    endReason: text('end_reason'),
    /** `request` · `playlist` · `autoplay`. */
    origin: text('origin').notNull(),
    requesterId: text('requester_id'),
  },
  (table) => [
    index('music_plays_guild_started').on(table.guildId, table.startedAt),
    index('music_plays_requester_started').on(table.requesterId, table.startedAt),
  ],
);

/**
 * File key → what to send the music worker to prepare it again (music/recap/tracks-store.ts),
 * for the year's playlist. No person in it. Swept 400 days after a key last played.
 */
export const musicTracks = pgTable('music_tracks', {
  fileKey: text('file_key').primaryKey(),
  title: text('title').notNull(),
  durationSec: integer('duration_sec'),
  /** Opaque, like a playlist item's request: never shown or logged. */
  request: text('request'),
  lastPlayedAt: timestamp('last_played_at', { withTimezone: true, mode: 'string' }).notNull(),
});

/** A recap that was built for posting (music/recap/recaps-store.ts). `summary` holds no person. */
export const musicRecaps = pgTable(
  'music_recaps',
  {
    guildId: text('guild_id').notNull(),
    /** `2026-11` for a month, `2026` for a year. */
    period: text('period').notNull(),
    kind: text('kind').notNull(),
    summary: jsonb('summary').notNull(),
    channelId: text('channel_id'),
    messageId: text('message_id'),
    postedAt: timestamp('posted_at', { withTimezone: true, mode: 'string' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.period] })],
);
