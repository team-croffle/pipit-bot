# pipit-hub (pipit-bot)

<div align="center">
  <img height="150" width="150" src="./img/bot-icon-wt.png" alt="bot-icon"/>
</div>

**Pipit** is a Discord bot built with Sapphire and discord-player.

Music is provided by a **pluggable worker** that writes audio to a shared volume; the bot only streams local files. See [music-backend.md](./music-backend.md).

## Environment

```ini
BOT_TOKEN=
COMMAND_CHANNEL_ID=
STREAM_ROOT=/streams
API_PORT=3000
INTERNAL_TOKEN=
MUSIC_WORKER_URL=http://music-worker:8080
PIPIT_API_URL=http://127.0.0.1:3000
DASHBOARD_ADMIN_GROUPS=pipit-admins
DASHBOARD_DEV_USER=dev
DASHBOARD_DEV_ROLE=admin
GUILD_ID=
```

Dashboard login is Authentik forward-auth on `/` and `/api`. Keep `/internal/*` on the Docker network. Local `/api/me` uses `DASHBOARD_DEV_ROLE` when Authentik headers are missing.

Enable **Server Members Intent**. Join/leave and reaction-role settings live in `data/guild-events.json` (`GET`/`PUT /api/guild-events`).

## Commands

- `!p <query>` — opaque query sent to the music worker
- Standard queue commands (`!skip`, `!pause`, `!queue`, …)

English README for the legacy monolith layout is deprecated; use the root [README.md](../README.md).
