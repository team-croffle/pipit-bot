# pipit-hub (pipit-bot)

<div align="center">
  <img height="150" width="150" src="./docs/img/bot-icon-wt.png" alt="bot-icon"/>
</div>

Discord bot **Pipit** built with Sapphire and discord-player.

Music sources are **pluggable**: pipit-bot requests a separate music worker and streams prepared files from a shared volume. See [docs/music-backend.md](./docs/music-backend.md).

## Stack

- Node.js 18+, TypeScript, Sapphire
- discord.js v14, discord-player v7
- Embedded **pipit-api** (job registry, internal callbacks, dashboard API)
- Yarn 4, Docker Compose

## Environment

Copy `.env.example` to `.env` (and optionally `.env.development.local` for `yarn start:dev`).

```ini
BOT_TOKEN=
COMMAND_CHANNEL_ID=
STREAM_ROOT=/streams
API_PORT=3000
INTERNAL_TOKEN=
MUSIC_WORKER_URL=http://music-worker:8080
PIPIT_API_URL=http://127.0.0.1:3000
```

## Development

From `pipit-bot/`:

```sh
yarn install
yarn watch:start
```

With the full stack (bot + music worker), use the workspace compose at the repo root:

```sh
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up --build
```

Dev streams are stored in `../shared/`.

## Music commands

- `!p <query>` / `!play <query>` — opaque query forwarded to the music worker
- Queue controls: `!skip`, `!pause`, `!resume`, `!queue`, etc.

The bot does not validate or parse the query string.

## License

MIT — see [LICENSE](./LICENSE).
