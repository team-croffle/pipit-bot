# 002 — Sapphire framework

- **@sapphire/framework** v5 — https://sapphirejs.dev/docs/General/Welcome
- **@sapphire/decorators**, **@sapphire/plugin-logger**, **@sapphire/utilities**, **@sapphire/discord.js-utilities**

## How Pipit uses it

- `SapphireClient` subclass (`src/lib/client.ts`) with the prefix read from runtime settings on every message.
- Pieces are loaded from folders: `src/commands` (message commands, including `music/`), `src/listeners` (gateway
  events and command outcome logging), `src/preconditions` (e.g. `MusicChannel`).
- Commands use `@ApplyOptions` for description, aliases and preconditions; `!help` lists them from that metadata.
- Logging goes through `container.logger` / `this.container.logger` — `console.*` is not used in the bot.

## Worth knowing

- A command's file name is its name; aliases are declared in the options.
- Arguments (`args.pick`, `args.rest`) are parsed lazily; `!p` takes the rest of the message as one opaque string.
- Preconditions run before `messageRun`; a denied command is reported by the `denied` listeners.
