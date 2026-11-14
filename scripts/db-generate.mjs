// yarn db:generate --name <what>: drizzle-kit generate, then the fix below.
//
// WHY the fix: drizzle-kit writes foreign keys as REFERENCES "public"."table". Every other
// statement names tables bare, so they follow the connection's search_path; the hard-coded
// "public" breaks a database that keeps the bot's tables in another schema. Dropping the
// prefix changes nothing where the schema is public.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execFileSync('drizzle-kit', ['generate', ...process.argv.slice(2)], { stdio: 'inherit' });

const folder = new URL('../drizzle/', import.meta.url).pathname;
for (const name of readdirSync(folder).filter((file) => file.endsWith('.sql'))) {
  const path = join(folder, name);
  const text = readFileSync(path, 'utf8');
  const fixed = text.replaceAll('"public".', '');
  if (fixed !== text) {
    writeFileSync(path, fixed);
    process.stdout.write(`db: dropped the "public" schema prefix in ${name}\n`);
  }
}
