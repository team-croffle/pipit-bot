import { defineConfig } from 'drizzle-kit';

// Migrations are generated into drizzle/ and committed; the bot applies them when it
// starts (src/lib/db/client.ts). Generating needs no database.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
});
