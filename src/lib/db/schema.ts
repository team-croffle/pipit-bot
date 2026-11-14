import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * The tables. Only data the bot produces and keeps adding to lives here — tracked
 * messages, banners, counters, logs, playlists, panels, account links. Settings a person
 * opens and edits stay JSON files under data/ (docs/decisions/024).
 *
 * Generate a migration after changing this file:  yarn db:generate --name <what>
 */

/** Which data/ files have been moved in (migrate-file.ts), so none is moved twice. */
export const fileMigrations = pgTable('file_migrations', {
  name: text('name').primaryKey(),
  items: integer('items').notNull(),
  migratedAt: timestamp('migrated_at', { withTimezone: true }).notNull().defaultNow(),
});
