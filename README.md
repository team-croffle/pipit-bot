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
OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=
DASHBOARD_SESSION_SECRET=
```

Production dashboard auth is **Authentik OIDC** (Authorization Code + PKCE). The bot is the OIDC client — no outpost container in this compose. Set `OIDC_*` and `DASHBOARD_SESSION_SECRET` in production. Do not expose `/internal/*` on the public host. Music worker callbacks use `INTERNAL_TOKEN`.

When `OIDC_ISSUER` is unset, local/dev uses `DASHBOARD_DEV_USER` / `DASHBOARD_DEV_ROLE` instead of login. `DASHBOARD_ADMIN_GROUPS` maps IdP groups to write access (bot config, guild events, playback).

Bot config and guild event settings persist under `data/` (`runtime-config.json`, `guild-events.json`, gitignored). Mount `./pipit-bot/data:/app/data` in Docker.

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
