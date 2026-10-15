# Music backend contract

pipit-bot does **not** download or resolve music sources. A separate **music worker** prepares audio files on a shared volume; pipit-bot streams local PCM files only.

## Flow

1. User: `/play <opaque query>` (or a line typed into a music channel) — the bot passes the string unchanged to the worker.
2. pipit-bot registers a job and enqueues `POST /v1/jobs` on the music worker.
3. The worker writes `{fileKey}.pcm` under `STREAM_ROOT` and callbacks pipit-api:
   - `POST /internal/music/jobs/:jobId/ready`
4. pipit-bot plays `local:{file}` via discord-player.

## Music worker (minimum)

```
POST /v1/jobs
  { "jobId": "<uuid>", "query": "<opaque string>" }
  → 202 { "jobId", "status": "accepted" }

GET /v1/health → 200 { "status": "ok", "capabilities": ["search", "expand", "related"] }
```

`capabilities` is optional: it names the optional features below that the worker offers (`search`, `expand`, `related`), and the bot shows only those controls. A worker that leaves it out is treated as "may offer anything" — every control shows, and one the worker lacks answers that it is not available.

After preparing audio on the shared volume:

```
POST {PIPIT_API_URL}/internal/music/jobs/{jobId}/ready
Header: X-Pipit-Internal-Token: <shared secret>
Body: { "track": { "title": "...", "durationSec": 123, "file": "abc.pcm" } }
```

On failure:

```
POST .../failed
Body: { "error": "...", "code": "not-found" }
```

`code` is optional — a worker that sends only `error` is still valid, and the bot then shows the `error` text as it is. When present it is a short lowercase word (`[a-z][a-z0-9-]*`, up to 32 characters) that lets the bot explain the failure in its own words and decide whether a retry is worth offering:

| `code` | Meaning | Retry offered |
| --- | --- | --- |
| `not-found` | nothing matched the query | no |
| `rejected` | the worker declined the request (its own limits — length, format, …) | no |
| `unavailable` | the worker or something it depends on could not be reached | yes |
| `internal` | anything else that went wrong in the worker | yes |

The bot adds two codes of its own: `unavailable` when `POST /v1/jobs` itself fails, and `timeout` when no callback arrives in time. A code the bot does not know is kept and shown with the `error` text. A callback for a job the bot has already ended (timed out or cancelled) is accepted with `200` and only recorded.

Cancelling is the bot's own affair: the contract has no cancel request, so a worker may finish a file the bot no longer wants.

## Search (optional)

A worker may also offer search, for the bot's track picker (`/search`, the remote's search button, the dashboard's search dialog):

```
POST /v1/search
  { "query": "<opaque string>", "limit": 5 }        limit 1–5, default 5
  → 200 { "results": [ { "title": "...", "durationSec": 213, "query": "<opaque>" } ] }
```

- At most five results. Nothing found is `200` with an empty list, not an error.
- `results[].query` is opaque to the bot: it is never shown or recorded, only sent back unchanged as the `query` of `POST /v1/jobs` when someone picks that result.
- Failures answer `400` (the worker will not search for that), `503` (something it depends on is unreachable) or `500`, with `{ "error", "code" }` as in the failure table above. Answer within about ten seconds — a person is waiting in a dialog.
- A worker without search answers `404`; the bot then says search is not available, and everything else works as before.

## Expand (optional)

A worker may also expand one request into several tracks, for importing into a playlist ("링크에서 가져오기" on the dashboard, `/playlist import`):

```
POST /v1/expand
  { "query": "<opaque string>" }
  → 200 { "title": "...", "items": [ { "title": "...", "durationSec": 213, "query": "<opaque>" } ] }
```

- At most 300 items; `title` is optional and names the new playlist when the person gives none.
- The bot does not decide what kind of request it is sending: a request the worker cannot expand answers `200` with an empty `items`, and the bot says there was nothing to import.
- `items[].query` is opaque, exactly like search results: kept in the playlist on the bot's side, never shown or recorded, and sent back unchanged as a job query when the track plays.
- Failures answer like search (`400`, `503`, `500` with `{ "error", "code" }`). Answer within about thirty seconds.
- A worker without it answers `404`, or leaves `expand` out of its `capabilities`; the bot then hides importing.

## Related (optional)

A worker may also suggest what to play next, for autoplay — when autoplay is on and the last queued track starts, the bot asks for a track to follow it:

```
POST /v1/related
  { "seeds": ["<opaque>", …], "exclude": ["<opaque>", …], "limit": 5 }
  → 200 { "items": [ { "title": "...", "durationSec": 213, "query": "<opaque>" } ] }
```

- `seeds` are the requests behind the most recent tracks, newest first (1–5). `exclude` are the requests behind tracks played recently (up to 50), which the worker should not offer again. `limit` is 1–5, default 5.
- **Choosing what fits is the worker's call** — the bot sends the requests untouched and plays the first item that prepares. Nothing to suggest is `200` with an empty `items`, and autoplay simply stops there.
- `items[].query` is opaque, like search results: never shown or recorded, sent back unchanged as a job query.
- Failures answer like search (`400`, `503`, `500` with `{ "error", "code" }`). Answer within about ten seconds.
- A worker without it answers `404`, or leaves `related` out of its `capabilities`; the bot then hides autoplay.

## Volume

| Environment | Path |
| --- | --- |
| Development | workspace `shared/` mounted at `/streams` |
| Production | Docker volume `music-files` at `/streams` |

Write atomically: `{file}.pcm.tmp` → rename to `{file}.pcm`.

Cleaning up old files is the worker's job. A file may still be waiting in the bot's queue long after its callback, so remove files by age with a generous margin (hours, not minutes); the bot skips a queued track whose file has gone.
