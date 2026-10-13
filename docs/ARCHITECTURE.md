# Architecture

<p align="center"><a href="./ARCHITECTURE.ko.md">한국어</a></p>

## The idea

A small development team already lives in Discord. Pipit brings the rest of its day-to-day work there: pull requests and
issues that need someone, roles and onboarding, invites, and shared music in the voice channel — each configured from one
web dashboard instead of scattered bots and config files.

Three ideas shape the design:

- **One deployment per team.** The bot, its API and the dashboard are one process and one image; only music preparation
  runs separately. ([decision 002](./decisions/002_v0.5.0_one-process.md))
- **The bot knows Discord; other work sits behind contracts.** GitHub reaches it through a GitHub App, music through a
  **music worker** that prepares audio files. The bot never fetches or decodes audio and assumes nothing about where it
  comes from. ([001](./decisions/001_v0.5.0_music-worker.md), [007](./decisions/007_v0.6.0_github-app-and-webhook.md))
- **Everything a person changes, they change on the dashboard.** Settings are data, not code
  ([003](./decisions/003_v0.5.0_settings-in-json-files.md)), and the dashboard can do what the commands can
  ([014](./decisions/014_v0.7.0_music-controls-on-the-dashboard.md)).

## The system

![System overview](./img/architecture/01-system-overview.png)

| Part | Runs as | Talks to |
| --- | --- | --- |
| **pipit-bot** — Discord bot, HTTP API, dashboard | one Node.js process, one container | Discord gateway and REST, GitHub API, the music worker, the OIDC provider |
| **music worker** | a separate container, any implementation of [the contract](./music-backend.md) | receives jobs from the bot, writes files to the shared volume, calls the bot back |
| **shared volume** (`STREAM_ROOT`) | a Docker volume mounted in both | prepared PCM files, written by the worker, read by the bot |
| **`data/`** | a volume on the bot | settings and tracked state as JSON files |
| **OIDC provider** | the team's own | dashboard sign-in, groups for write access |
| **GitHub App** | installed on the organisation | sends webhooks; lets the bot read pull requests, issues, members |

Exposed through the reverse proxy: the dashboard (`/`), its API (`/api/*`) and the GitHub webhook (`/webhooks/github`).
`/internal/*` — the music worker's callbacks — shares the port but must stay on the internal network.

## Inside pipit-bot

```
src/
  index.ts            start-up: load settings files, start the HTTP server, log the client in
  commands/           slash commands (Sapphire) — music/, /remind, /help, …
  listeners/          gateway events — member join/leave, invites, reactions, music-channel lines, ready
  interaction-handlers/  the music banner's buttons and play dialog
  preconditions/      command guards (music channel only, …)
  api/                the embedded HTTP API (Hono)
    app.ts            builds the app: auth, /api/*, route modules, dashboard static files
    audit-middleware.ts  records every change made from the dashboard
    routes/           audit, auth, github-notify, github-webhook, invites, music, music-jobs, reaction-roles
    auth/             OIDC session, viewer / writer guards, internal-token guard
    jobs/             the music job registry
  lib/                everything the commands and the API share
    audit/            the audit log: append, query, retention, the Discord recorder
    music/            playback state and actions, voice connection, job submission, local-file extractor, volume
    github/           webhook normalisation, dispatch, templates, message tracking, App client, reminders
    reaction-roles/   panels and their settings
    embed/            the embed model shared by GitHub templates and reaction-role panels
dashboard/            the Vue SPA, built to dashboard/dist and served at /
```

One rule holds the parts together: **commands and API routes are thin and call the same `lib/` functions.** `/skip`, the
banner's next button and the dashboard's skip button run `skipPlayback()`; `/remind` and the reminder card run the same reminder. Behaviour lives in
`lib/`, once.

Inside the process:

- **Discord client** — a Sapphire client with slash commands, button and dialog handlers, and gateway listeners, and a `discord-player` `Player`
  whose only extractor reads local files. Its own audio processing chain is off — the files are already in the output
  format — and the bot applies the volume itself as it streams them
  ([015](./decisions/015_v0.7.0_bot-side-volume.md)).
- **HTTP API** — a Hono app on the Node HTTP server, started before the client logs in. Dashboard routes require a
  signed-in session; changing settings also requires an admin group. Worker callbacks require the internal token.
- **In memory** — the music job registry, the player's queue and history, short-lived caches of GitHub lists. All of it
  is rebuilt or forgotten on restart.
- **On disk** — settings, tracked GitHub messages and invite counts under `data/`, each loaded at start-up and written
  whole when it changes; the audit log, appended a line at a time to one file per day under `data/audit/`.

The **audit log** is written from four places, so no feature has to remember to: a middleware after every dashboard
change, `replyNotice` (which answers every slash command, button and dialog), `recordDelivery` for GitHub, and the member
listeners. Music lines say only that someone used a feature — never the track or what was asked for
([018](./decisions/018_v0.7.2_audit-log.md)).

## Playing music

![Playing music: request, job, worker, callback, playback](./img/architecture/03-music-flow.png)

![Music job states](./img/architecture/04-music-job-states.png)

1. A user asks for a track — `/play`, a line typed into a music channel, the banner's play dialog, or the dashboard's play box. The query is an **opaque
   string**; the bot does not parse it.
2. The bot registers a **job** and sends it to the music worker (`POST /v1/jobs`).
3. The worker prepares the audio and writes `{file}.pcm` to the shared volume, then calls back `ready` with the title,
   duration and file name — or `failed` with an error and, optionally, a code.
4. The bot plays the local file in its voice channel: at the end of the queue, or at the front for "play next".

**Search** is a step before step 1: `/search`, the banner's search button or the dashboard's search dialog ask the worker
for up to five results (`POST /v1/search`). The results are kept on the bot for whoever searched; Discord and the browser
see only titles, lengths and an index, and a pick sends the worker's own value back as the job's query
([019](./decisions/019_v0.7.3_track-search.md)).

A job always ends — ready, failed, timed out or cancelled — and the dashboard lists recent jobs with their outcome
([016](./decisions/016_v0.7.1_music-job-lifecycle.md)). The queue, voice connection and volume are the bot's; the worker
never sees them.

**Playlists** ([020](./decisions/020_v0.7.4_playlists.md)) are kept in `data/playlists.json` with the request behind each
track — learnt when a job is ready, per prepared file — and shown by title only. Playing one is not a burst of jobs: a
feeder keeps two tracks prepared-but-not-started and asks for the next as the queue moves, putting tracks in playlist
order even when they finish preparing out of turn. Importing asks the worker to expand one request (`POST /v1/expand`);
the worker's optional `capabilities` decide which of search and import the bot shows.

## GitHub notifications

![GitHub notifications: the webhook path and the remind path](./img/architecture/05-github-flow.png)

1. The GitHub App delivers an event to `/webhooks/github`; the signature is verified.
2. The event is **normalised** into one shape (item, actor, people waiting on it) and **routed**: the repository's
   channel and enabled events, or the defaults it inherits.
3. The event's **template** renders an embed and a plain line; mentions go in the plain line, since a mention inside an
   embed notifies no one ([008](./decisions/008_v0.6.4_embed-notifications.md)).
4. Opening events post a message that is **tracked**; later changes to the same item edit it instead of posting again
   ([009](./decisions/009_v0.6.4_one-message-per-item.md)).
5. Every delivery and its outcome goes to a short log the dashboard shows.

Reminders go the other way: `/remind` reads the item from GitHub at that moment and calls whoever it is still waiting on
([012](./decisions/012_v0.6.6_reminders-read-github-on-demand.md)).

## The dashboard

A Vue 3 single-page app (Vite, shadcn-vue on reka-ui, Tailwind), built into `dashboard/dist` and served by the bot. It
signs in through the bot's OIDC client ([004](./decisions/004_v0.5.0_dashboard-sign-in-with-oidc.md)) and talks only to
`/api/*`. Live views poll; there is no WebSocket. Pages share one design system and the same picker convention
([011](./decisions/011_v0.6.4_dashboard-design-system.md), [013](./decisions/013_v0.6.8_lists-are-not-authoritative.md)).

## Deployment

- One image per release, built by the release workflow and published to the container registry
  ([005](./decisions/005_v0.5.0_releases-by-workflow.md)).
- A compose file runs the bot and a music worker with the shared volume between them; `data/` is a volume on the bot.
- Configuration is environment variables for deployment facts and secrets (Discord token, OIDC, GitHub App,
  `INTERNAL_TOKEN`, `MUSIC_WORKER_URL`, `STREAM_ROOT`); everything else is set on the dashboard.

## Where it is going

The [roadmap](./ROADMAP.md) has the direction. The next change to this picture is a database (v0.8): it replaces the JSON
files for data that grows — tracked GitHub messages first — and takes over the audit log's day files.
