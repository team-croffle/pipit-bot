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

### v0.7.5 — playback options

- Mono for one earphone, autoplay that keeps going with tracks the music worker picks, and a volume from 0 to 200 in
  steps of one
- Progress bars on the remote and the dashboard that follow the track; a polished dashboard (icons, paged logs and
  music jobs)

### v0.7.6 — switching features off

- Features switch on and off as a whole; a feature switched off takes its Discord commands with it
- A polished audit log

### v0.7.7 — the music worker's status

- When the music worker is down, the music channel's banner, command replies and the dashboard say so, and recover on their own when it is back

### v0.8.0 — a database

- The data that accumulates moves into PostgreSQL — tracked GitHub messages, the audit log, invite statistics, playlists, reaction-role panels and account links
- Settings files stay as they are, so they can still be fixed in an editor when the dashboard is out of reach
- Operators need one more database. It ships in the compose file, and it can point at a PostgreSQL you already run

### v0.8.1 — music recaps

- Monthly and yearly music summaries — play history is recorded, posted to Discord, and past and personal summaries can be browsed on the dashboard. Each year ends with a playlist of that year. Who asked for which track is never shown
- Emoji shortcodes typed by hand, such as `:tada:`, turn into the emoji
- A choice of language for the recap messages (Korean, English)

## Planned

### v0.8.2 — dashboard sign-in

- A dashboard sign-in page — username and password, OIDC, or Discord and GitHub sign-in, showing only the methods that are switched on, with at least one always on
- A users page — accounts and admin rights are managed on the dashboard. Each way of signing in leads to the same person, and admin is a group

### v0.8.3 — languages

- The dashboard's language is chosen in the settings, and each feature's Discord messages in that feature's settings (Korean, English)

### v0.9 — calendars

- Calendar integration, and reminders built on it: birthdays, meetings, release dates, team events

### v0.10 — getting ready for release, and integrations

- Feed reminders for new blog posts; a pass over every feature for fixes and polish
- Integration with the team's own tools — polls and scheduling
