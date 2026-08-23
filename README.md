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
STREAM_ROOT=/streams
API_PORT=3000
INTERNAL_TOKEN=
MUSIC_WORKER_URL=http://music-worker:8080
PIPIT_API_URL=http://127.0.0.1:3000
DASHBOARD_ADMIN_GROUPS=pipit-admins
DASHBOARD_DEV_USER=dev
DASHBOARD_DEV_ROLE=admin
```

Production dashboard auth is **Authentik forward-auth** on the public vhost (`/` and `/api` only). Do not expose `/internal/*` through that host. The API should listen on localhost or the Docker network.

`DASHBOARD_ADMIN_GROUPS` maps Authentik `X-Authentik-Groups` to write access (settings and future playback controls). Viewers still see every page; mutating controls stay disabled. `DASHBOARD_DEV_USER` / `DASHBOARD_DEV_ROLE` mock `/api/me` when Authentik headers are absent outside production. Dashboard guild data comes from the bot's Discord cache.

Guild join/leave logs, join roles, and reaction roles persist in `data/guild-events.json` (gitignored). Mount `data/` in production. Prefix, command channel, and RSS are a separate bot-config surface and must not use `/api/guild-events`.

In the Discord Developer Portal enable **Server Members Intent**. The bot needs `Manage Roles`, `Send Messages`, `Add Reactions`, `View Channel`, `Read Message History`, and `Manage Guild` (invite uses). The bot role must sit above roles it assigns.

## Development

From `pipit-bot/`:

```sh
yarn install
yarn watch:start
```

Dashboard (Vite + Vue) in `dashboard/`:

```sh
yarn dashboard:dev
```

Opens `http://127.0.0.1:5173/` and proxies `/api` to the bot. For production, `yarn dashboard:build` then the bot serves `dashboard/dist` at `GET /`.

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
