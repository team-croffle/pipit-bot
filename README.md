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
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_PRIVATE_KEY_PATH=
GITHUB_APP_INSTALLATION_ID=
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

Bot config and guild event settings persist under `data/` (`runtime-config.json`, `guild-events.json`, `github-notify.json`, `github-messages.json`, `reaction-roles.json`, gitignored). Mount `./pipit-bot/data:/app/data` in Docker.

## GitHub notifications

PR and issue activity is delivered by a **GitHub App**. Register one app, install it on the repositories you want, and every installed repository reports to the same endpoint.

| App setting              | Value                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Webhook URL              | `https://<public-host>/webhooks/github`                                               |
| Webhook secret           | same value as `GITHUB_WEBHOOK_SECRET`                                                 |
| Repository permissions   | `Metadata: Read-only`, `Pull requests: Read-only`, `Issues: Read-only`                |
| Organization permissions | `Members: Read-only` (optional — only for the account-mapping picker)                 |
| Subscribe to events      | Pull request, Pull request review, Pull request review comment, Issues, Issue comment |

`POST /webhooks/github` is the only route meant to be reachable from the internet; keep `/api/*` and `/internal/*` off the public host. Every delivery must carry a valid `X-Hub-Signature-256`, and the endpoint answers `404` while `GITHUB_WEBHOOK_SECRET` is unset.

`GITHUB_APP_ID` plus a private key let the dashboard offer the installed repositories and the organisation members instead of asking you to type them. Give the key as `GITHUB_APP_PRIVATE_KEY_PATH` (a file, which is how a mounted secret usually arrives) or as `GITHUB_APP_PRIVATE_KEY` (the PEM itself, raw or base64-encoded); the path wins when both are set. `GITHUB_APP_INSTALLATION_ID` is optional — without it the first installation is used. None of this is required: reminders work on the webhook secret alone, and the pickers fall back to plain text fields. The account list reads organisation members, which needs the App's **Organization › Members (read)** permission; without it, the assignable users of each installed repository are offered instead, and the dashboard says which list it is showing.

Routing lives in `data/github-notify.json`: a default channel plus per-repository overrides for the channel and which event types to report, and a GitHub-login-to-Discord-user map used for mentions. Unmapped logins appear as plain text. A repository with no rule of its own posts to the default channel unless `notifyUnlistedRepos` is switched off, in which case only the listed repositories report. The feature ships disabled (`enabled: false`).

Each event sends an **embed** composed on the same page — a plain line, a title, a description, fields, a footer, a colour and an optional timestamp. Every part is a template: `{repo}`, `{pr_number}`, `{pr_url}`, `{pr_title}`, `{event}`, `{actor}`, `{author}`, `{assignee}`, `{assignees}`, `{reviewers}` and `{mentions}` are substituted, and `{name|when set|when empty}` picks between two wordings depending on whether the value exists. A part that renders empty is left out.

Which variables an event offers depends on what it can fill in — `{actor}` is the merger on a merge and the reviewer on a review, and `{reviewers}` (the outstanding request list) is not offered where GitHub has already emptied it. The editor lists the variables for the event being edited, and saving a template that names another one is rejected. Each event has its own default; an event you never edit follows it.

Mentions belong on the plain line: Discord raises no notification for a mention that only appears inside an embed. The template is the operator's own markdown, but everything substituted into it is escaped, so a pull request title cannot forge a mention or a link.

The message that announced a pull request or issue is remembered in `data/github-messages.json` (capped; oldest entries drop first). When somebody is assigned or asked to review later, that message is re-rendered with the current assignees and reviewers and edited in place, so it does not go stale. Assigning yourself only edits — no new message, nobody pinged. Assigning or requesting someone else edits and also sends that event's own message, because Discord does not notify people for a mention that appears through an edit. An item announced before the bot started tracking, or whose message was deleted, is simply not edited; recent deliveries show `edited` for an update that posted nothing new.

In the Discord Developer Portal enable **Server Members Intent**. The bot needs `Manage Roles`, `Send Messages`, `Add Reactions`, `View Channel`, `Read Message History`, and `Manage Guild` (invite uses). The bot role must sit above roles it assigns.

## Reaction roles

A **panel** is one message the bot owns. Pick a channel, compose the embed, and list which emoji hands out which role; publishing sends the message and reacts to it with each emoji. Editing the panel and publishing again edits that same message and brings its reactions back in line with the options.

A panel can be held at **one reaction** — the bot takes each member's reaction straight back off, so the message reads as a row of buttons rather than a tally, and pressing an emoji toggles its role on and off. Left off, the reaction itself is the record: adding one grants the role, taking it away gives it back.

The bot checks before it sends: it must be able to post and react in the channel, and every role must sit below its own and not be one Discord manages. Holding a panel at one reaction also needs `Manage Messages`, as does putting the emoji back in order after one is inserted in the middle — Discord fixes a reaction's place when it is first added, so the only repair is to clear them and react again. A panel that could never grant its roles is refused with the reason, rather than failing silently when a member reacts. Panels live in `data/reaction-roles.json`.

## Source abstraction

This repository describes its music backend only as an external **music worker** —
never a specific source, and never the worker by name. The contract in
[docs/music-backend.md](docs/music-backend.md) is the whole interface.

`yarn check:abstraction` enforces it. A pre-commit hook runs it over the staged
files, a commit-msg hook runs it over the message, and the **Source Abstraction**
workflow runs it over every pushed range — the last one is the check that cannot be
skipped with `--no-verify`.

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
