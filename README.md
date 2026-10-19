# Pipit Hub

<div align="center">
  <img height="150" width="150" src="./docs/img/pipit-mark.png" alt="Pipit"/>
</div>

<p align="center"><a href="./README.ko.md">한국어</a></p>

**Pipit** is a Discord bot for small development teams that gather and work together around Discord. It folds the team's workflow into the place they already talk — one bot, configured from one dashboard.

- **Pull request and issue reminders** — a GitHub App reports opened, updated, reviewed, merged and closed items to the channel you choose, mentions the right people, and keeps the announcement current as assignees and reviewers change
- **Reaction roles** — the bot publishes a panel message and hands out roles as members react to it
- **Invite logger** — join and leave messages, arrivals counted per invite, a record channel, roles on join
- **Audit log** — who did what from the dashboard and in Discord, GitHub deliveries and member arrivals, kept for 90 days
- **Music** — shared playback for the voice channel, backed by a pluggable music worker
- **Dashboard** — every setting above, light and dark, behind your own OIDC login

Built with Sapphire and discord.js. Music sources are **pluggable**: pipit-bot requests a separate music worker and streams prepared files from a shared volume. See [docs/music-backend.md](./docs/music-backend.md).

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
# default: openid profile email groups
OIDC_SCOPES=
DASHBOARD_SESSION_SECRET=
```

Production dashboard auth is **OIDC** (Authorization Code + PKCE) — Authentik and Dex are known to work, and any provider that supports the flow should. The bot is the OIDC client — no auth proxy container in this compose. Set `OIDC_*` and `DASHBOARD_SESSION_SECRET` in production. Do not expose `/internal/*` on the public host. Music worker callbacks use `INTERNAL_TOKEN`.

When `OIDC_ISSUER` is unset, local/dev uses `DASHBOARD_DEV_USER` / `DASHBOARD_DEV_ROLE` instead of login. `DASHBOARD_ADMIN_GROUPS` maps IdP groups to write access (bot config, guild events, playback): it is matched, case-insensitively and in full, against the `groups` claim the provider releases. Some providers only release that claim when the `groups` scope is requested (Dex is one), so it is part of the default `OIDC_SCOPES`; the value is space- or comma-separated and must include `openid`. Write the group names exactly as the provider names them — Dex's GitHub connector, for instance, names them `org:team` (`org:team-slug` with `teamNameField: slug`), so an operator would set `DASHBOARD_ADMIN_GROUPS=my-org:admins`. When the provider cannot be reached, `/api/auth/login` and the callback answer `502` with `{"error":"The identity provider could not be reached."}` and the bot logs the cause.

Bot config and guild event settings persist under `data/` (`runtime-config.json`, `guild-events.json`, `github-notify.json`, `github-messages.json`, `reaction-roles.json`, `invite-stats.json`, `playlists.json`, `playback-options.json`, `features.json`, and the audit log in `audit/`; gitignored). Mount `./pipit-bot/data:/app/data` in Docker.

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

Routing lives in `data/github-notify.json`: a default channel plus per-repository overrides for the channel and which event types to report, a GitHub-login-to-Discord-user map used for mentions, and a GitHub-team-to-Discord-role map (`teams`). Unmapped logins appear as plain text. A repository with no rule of its own posts to the default channel unless `notifyUnlistedRepos` is switched off, in which case only the listed repositories report. The feature ships disabled (`enabled: false`).

A review can be requested from a **team** as well as a person. The "팀 → 역할" card on the GitHub page maps a team (`org/slug`, where the org is the repository owner) to a Discord role, and from then on a review request for that team — from the webhook or from `/remind` — mentions the role (`<@&role>`). A team without a mapping is named but not mentioned, as before. For the ping to actually reach anyone the role must allow anyone to mention it ("Allow anyone to @mention this role"), or the bot must hold **Mention Everyone** in that channel; the card warns on each row where neither holds, and the delivery record says so when a role could not be mentioned. The mappings are stored as `teams` (`[{ githubTeam, discordRoleId }]`) in `data/github-notify.json`; a file written before this key existed loads as it did.

Each event sends an **embed** composed on the same page — a plain line, a title, a description, fields, a footer, a colour and an optional timestamp. Every part is a template: `{repo}`, `{pr_number}`, `{pr_url}`, `{pr_title}`, `{event}`, `{actor}`, `{author}`, `{assignee}`, `{assignees}`, `{reviewers}` and `{mentions}` are substituted, and `{name|when set|when empty}` picks between two wordings depending on whether the value exists. A part that renders empty is left out.

A pull request or issue that has gone quiet can be **reminded about by hand** — `/remind` in Discord, or the "다시 알리기" card on the GitHub page. The card picks the repository from the installed ones and then the number from that repository's open pull requests and issues (`#12 · title`, marked PR, Issue or 초안); a closed item, or a repository whose list cannot be read, is entered by typing the number ("직접 입력…"), and without the App credentials every picker offers typed entry. The repository may be given by its name alone (`pipit-bot #12`) when exactly one installed repository has that name, and a pull request or issue link works too. The bot reads the item through the App (this is where `GITHUB_APP_ID` and the private key become necessary) and learns from GitHub which of the two the number is. A pull request gets a `PR Reminder` mentioning everyone still asked to review plus the assignees; an issue gets an `Issue Reminder` mentioning its assignees; the author is never mentioned. Teams asked to review are mentioned through their mapped role (see above) and otherwise named without a mention; the reply counts both, as "Reminded N people or teams". Drafts and items with nobody waiting are not reminded about; for a merged or closed item nothing new is posted, but its announcement is brought up to date. The reason is answered in Discord and recorded in the recent deliveries. One reminder per item per five minutes. The `PR Reminder` and `Issue Reminder` event toggles are permission switches for this — on by default, and switching one off for a repository blocks that kind of reminder there.

Which variables an event offers depends on what it can fill in — `{actor}` is the merger on a merge and the reviewer on a review, and `{reviewers}` (the outstanding request list) is not offered where GitHub has already emptied it. The editor lists the variables for the event being edited, and saving a template that names another one is rejected. Each event has its own default; an event you never edit follows it.

Mentions belong on the plain line: Discord raises no notification for a mention that only appears inside an embed. The template is the operator's own markdown, but everything substituted into it is escaped, so a pull request title cannot forge a mention or a link.

The message that announced a pull request or issue is remembered in `data/github-messages.json` (capped; oldest entries drop first). When somebody is assigned or asked to review later — or unassigned, or the title changes — that message is re-rendered with the current title, assignees and reviewers and edited in place, so it does not go stale. Reopening a pull request or issue announces it again, and that message takes over as the one being kept current. Assigning yourself only edits — no new message, nobody pinged. Assigning or requesting someone else edits and also sends that event's own message, because Discord does not notify people for a mention that appears through an edit. An item announced before the bot started tracking, or whose message was deleted, is simply not edited; recent deliveries show `edited` for an update that posted nothing new.

In the Discord Developer Portal enable **Server Members Intent**. The bot needs `Manage Roles`, `Send Messages`, `Add Reactions`, `View Channel`, `Read Message History`, and `Manage Guild` (invite uses). The bot role must sit above roles it assigns.

## Invites

The invites page sets two channels. The **welcome channel** gets the join and leave messages you write (`{user}`, `{username}`, `{inviter}`, `{invite}`; one is picked at random). The **record channel**, optional and separate, gets one line per arrival and departure with the facts only — who, which invite and who made it, how many days a leaving member stayed — and notifies nobody.

Arrivals are counted per invite code in `data/invite-stats.json`, so the count outlives the invite itself. The "초대 코드별 유입" card lists each invite with its maker, the arrivals the bot counted, Discord's own use count, the last arrival and whether it has expired or gone. Tracing an arrival to its invite needs **Manage Guild**: without it Discord may still list the invites but leaves out their use counts, so no arrival can be traced and nothing is counted — the card warns when that is the case.

## Audit log

The bot records who did what and whether it worked:

- changes made from the dashboard (settings, music controls, reaction-role panels, reminders, …) — never the request body
- slash commands, remote-control buttons and the play dialog in Discord, and requests typed into a music channel; commands that only show something (`/queue`, `/help`) are skipped
- how each music job ended (its origin, and the failure code when it failed)
- GitHub deliveries (sent, edited, skipped or failed, with the reason) and members joining (invite code, inviter) or leaving

**For music it records only who used which feature** — never the track, never what was asked for. Entries are appended to one file per day, `data/audit/YYYY-MM-DD.jsonl` (UTC), and files older than **90 days** are removed. Entries hold Discord user ids and display names and dashboard user names; keep that in mind for whoever can read `data/`. The dashboard's **로깅** page lists them by category, period and text, in numbered pages of 5, 10, 20 or 30 rows.

## Reaction roles

A **panel** is one message the bot owns. Pick a channel, compose the embed, and list which emoji hands out which role; publishing sends the message and reacts to it with each emoji. Editing the panel and publishing again edits that same message and brings its reactions back in line with the options.

A panel can be held at **one reaction** — the bot takes each member's reaction straight back off, so the message reads as a row of buttons rather than a tally, and pressing an emoji toggles its role on and off. Left off, the reaction itself is the record: adding one grants the role, taking it away gives it back.

The bot checks before it sends: it must be able to post and react in the channel, and every role must sit below its own and not be one Discord manages. Holding a panel at one reaction also needs `Manage Messages`, as does putting the emoji back in order after one is inserted in the middle — Discord fixes a reaction's place when it is first added, so the only repair is to clear them and react again. A panel that could never grant its roles is refused with the reason, rather than failing silently when a member reacts. Panels live in `data/reaction-roles.json`.

## Music

Everything the music commands do can be done from the dashboard's **Music** page, and much of it from the music channel's banner:

- **Voice** — pick a voice channel and the bot joins it; pick another while it is connected and it moves there without stopping the current track. The picker shows how many people are in each room, because the player leaves an empty one after 30 seconds. **Leave** disconnects it
- **Queue** — every queued track (up to 100 listed) with its own **up**, **down**, **skip to** and **remove** (folded into one menu on a phone), plus **shuffle**, which reorders the waiting tracks once. Rows are addressed by the player's track id, so a list that is a moment out of date never touches the wrong track. Skipping to a track drops the ones ahead of it, as `/skip to` does
- **Recent tracks** — what this session has played (the last 20), and **previous**, which goes back one track and puts the current one at the front of the queue. The history ends with the session
- **Add** — the play box sends the query to the music worker as-is; its menu has **play next**, which puts the track at the front of the queue like `/play next`
- **Search** — opens a dialog that lists up to five results from the music worker; each can be **added** or played **next**, several in a row. Searching works before the bot joins a voice channel; adding waits until it has
- **Volume** — a slider and a number box from 0 to 200 in steps of one: 100 is the track as prepared, above it is a boost (loud passages may distort). It can be set at any time, in a voice channel or not
- **Playback options** — **mono** mixes left and right into both ears, for listening with one earphone; it applies to the track that is playing and can be set even when the bot is not in a voice channel. **Autoplay** keeps the music going: when the last queued track starts, the bot asks the music worker for a fitting next track, prepares it, and queues it in the track's last ten seconds — a track anyone adds meanwhile plays first. It rests while a repeat mode is on or a playlist is playing, and needs a music worker that offers related tracks (see [docs/music-backend.md](./docs/music-backend.md)). Volume, mono and autoplay are kept in `data/playback-options.json` and survive a restart

The dashboard, the banner and the commands share one queue, so any of them can pick up where another left off.

### The music channel

A configured music channel holds one **remote-control banner**, kept by the bot as the channel's last message:

- **Idle** — "💿 Pipit Hub Music", how to request a track, a **play** button that opens a dialog for a song title or a link, and a **search** button
- **Playing** — the track, who asked for it, a progress bar, repeat / volume / queue, and buttons for pause or resume, next, stop, the queue, add a track, search, repeat, volume down and up by ten, mono, and autoplay. What a button did is shown only to the person who pressed it, for five seconds
- **Typing a song title or a link** into the channel plays it: the line is removed, and a short banner everyone can see says what happened and then removes itself. Removing the line needs the bot's **Manage Messages** permission in that channel; without it the request still runs and the line stays

**Search** — `/search` or the banner's search button — lists up to five results only to the person who searched; they pick one and play it now or next. Results stay pickable for ten minutes, and only by whoever searched. Search needs a music worker that offers it (see [docs/music-backend.md](./docs/music-backend.md)); with one that does not, the bot says so and everything else works.

The banner is posted when the bot starts or a music channel is added, re-posted if it is deleted, and removed from a channel that stops being a music channel.

### Playlists

Playlists live on the Music page's **playlists** tab and behind `/playlist`:

- **Shared** playlists are seen by the whole server and anyone can edit them; **personal** ones are seen and edited only by their owner. On the dashboard, personal playlists need your GitHub ↔ Discord link on the GitHub page (the dashboard signs in with GitHub)
- **Saving tracks** — type a song title or a link; or use "재생목록에 담기" next to the current track, a queued track, the whole queue, recent tracks and search results (on the dashboard and on Discord's search results); or **import from a link** the music worker can expand into several tracks (shown only when the worker offers it, see [docs/music-backend.md](./docs/music-backend.md))
- **Playing** — in order or shuffled, after what is already queued. The bot asks the music worker for two tracks at a time and keeps the playlist's order; tracks that cannot be prepared are skipped and counted. Stopping, clearing, leaving or playing another playlist ends it
- The music channel's remote has a **playlist** button: choose one, then play or shuffle
- Limits: 200 playlists of up to 300 tracks. Playlists are kept in `data/playlists.json`, including the requests behind their tracks; pages and answers show titles only

### Music jobs

Each request is a **job** the music worker prepares before the bot can play it. The **Music jobs** card lists them with their state, five a page:

- a job still being prepared can be **cancelled** — the bot stops waiting and never plays it, even if the file arrives later
- a failed or cancelled job can be **retried** as a new job with the same request (still at the front if it was "play next"); failures a retry cannot fix, such as nothing found, offer no retry
- a failure shows its reason — the worker may send a short code with it (see [docs/music-backend.md](./docs/music-backend.md)) — and a job that takes too long fails as a timeout instead of waiting forever
- a queued track whose prepared file has gone is skipped, and the skip is announced in the music channel and on the dashboard

## Feature switches

The **설정** page switches seven features on and off: music, GitHub notifications, the audit log, invite tracking, join and leave messages, join roles and reaction roles. A missing `data/features.json` means everything is on, as before; the GitHub switch is the same as the master switch on the GitHub page.

Off means off everywhere:

- **Commands** — a switched-off feature's slash commands leave Discord's menus (music's commands, and `/remind` for GitHub) and come back when it is switched on; Discord can take a moment to show the change. `/help` lists only what is on
- **Music** — switching it off stops playback and leaves the voice channel; the music channel's banner says music is off and messages there are left alone
- **The others** — nothing is recorded while the audit log is off (the switching itself is); invites are neither traced nor counted and the record channel stays quiet; join and leave messages and join roles are skipped; reacting to a reaction-role panel does nothing
- **Dashboard** — a page whose feature is off still opens, with a notice and a link back to the settings; its sidebar item is dimmed

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

## Commands

All commands are **slash commands** (since v0.7.1) — type `/` in Discord to see them. There is no command prefix any more. Answers are shown only to the person who used the command.

- `/remind item` — `owner/name #12`, `name #12`, or a pull request or issue link; reminds whoever it is waiting on, in the repository's notification channel. See the reminder section above
- `/help` — lists the commands · `/ping` — checks the bot answers

### Music commands

Usable in a music channel (or anywhere, when none is configured):

- `/play query [next]` — the query goes to the music worker as-is; `next` puts the track at the front of the queue
- `/search query` — up to five results, shown only to you; pick one and play it now or next
- `/playlist` — `list`, `show`, `create [personal]`, `rename`, `delete`, `add` (the current track, the whole queue, or a title or link), `remove`, `move`, `import link [into]`, `play [shuffle]`; playlist names autocomplete
- `/join`, `/leave` — join your voice channel (or move there), or leave
- Playback: `/pause`, `/resume`, `/skip [to]`, `/stop`, `/back`, `/loop mode`, `/volume [0–200]`
- Options: `/options [mono] [autoplay] [repeat]` — switch mono or autoplay, set the repeat mode new sessions start with, or show the playback options
- Queue: `/queue`, `/remove position`, `/move from to`, `/shuffle`, `/clear`

The dashboard's Music page and the music channel's banner do the same (see [Music](#music)). The bot does not validate or parse the query string.

### Upgrading from `!` commands

Slash commands need the bot invited with the **`applications.commands`** scope: in the Discord Developer Portal open the app → OAuth2 → URL Generator, tick `bot` and `applications.commands`, choose the bot's permissions, and open the URL to authorise it again for your server — the bot does not need to be removed first. For the music channel to stay clean, give the bot **Manage Messages** in that channel (Edit Channel → Permissions → the bot's role).

## License

MIT — see [LICENSE](./LICENSE).
