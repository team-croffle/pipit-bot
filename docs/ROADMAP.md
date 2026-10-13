# Roadmap

<p align="center"><a href="./ROADMAP.ko.md">한국어</a></p>

Where Pipit has been and where it is going. This is a direction, not a promise — versions and their contents move as the
team uses the bot. Every released version has [release notes](https://github.com/team-croffle/pipit-bot/releases), and
the larger decisions behind them are in [decisions](./decisions/000_README.md).

## Released

### v0.5 — one bot, one dashboard

- The Discord bot, its HTTP API and a web dashboard run as one process
- Music playback delegated to an external **music worker** over a small HTTP contract; the bot only plays prepared files
- Dashboard sign-in through OIDC; settings kept as JSON files instead of in code
- Join and leave messages, invite tracking, roles on join

### v0.6 — GitHub reminders and team tools

- A GitHub App reports pull request and issue events to the channel each repository is routed to, mentions the right
  people, and keeps one message per item up to date
- Notification wording, embeds and routing edited on the dashboard with a live preview
- Reaction-role panels published by the bot
- `!remind` calls again whoever a pull request or issue is waiting on
- GitHub teams mapped to Discord roles; every picker on the GitHub page works the same way
- A redesigned dashboard: one design system, light and dark themes, usable on a phone

### v0.7.0 — music on the dashboard

- Join, move and leave a voice channel, set the volume, act on every queued track and play a track next — from the
  dashboard as well as from Discord

### v0.7.1 — music management and a remote in Discord

- Music jobs that always end, can be cancelled or retried, and say why they failed
- Reordering and shuffling the queue, recent tracks and going back
- A remote-control banner in the music channel — an idle screen and a now-playing screen, buttons, results shown only to
  whoever pressed them; requests typed into the channel are handled and cleaned up
- All commands are slash commands

### v0.7.2 — an audit log and invite tracking

- What was done from the dashboard and in Discord, GitHub deliveries, and members joining or leaving, recorded and shown
  on the dashboard; for music, only who used which feature
- Arrivals counted per invite, and a record channel with the facts of each arrival and departure

### v0.7.3 — track search

- Search from a Discord command, the music channel's remote or the dashboard, and pick one of up to five results to play
  now or next

### v0.7.4 — playlists

- Shared playlists anyone can edit, and personal ones — saved from the current track, the queue, recent tracks, search
  results or a typed request, and played in order or shuffled
- From `/playlist` and the remote in Discord as well as the dashboard; importing several tracks from one link when the
  music worker supports it
- A music worker can state its optional features, and the bot shows only those controls

## In progress

### v0.7.x — music management

- Playback options; switching features on and off

## Planned

### v0.8 — a database

- Move what lives in JSON files today — starting with the tracked GitHub messages — and the audit log into a database
- Monthly and yearly music summaries

### v0.9 — calendars

- Calendar integration, and reminders built on it: birthdays, meetings, release dates, team events

### v0.10 — getting ready for release, and integrations

- Feed reminders for new blog posts; a pass over every feature for fixes and polish
- Integration with the team's own tools — polls and scheduling
