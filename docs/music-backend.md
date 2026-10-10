# Music backend contract

pipit-bot does **not** download or resolve music sources. A separate **music worker** prepares audio files on a shared volume; pipit-bot streams local PCM files only.

## Flow

1. User: `!p <opaque query>` — the bot passes the remainder string unchanged to the worker.
2. pipit-bot registers a job and enqueues `POST /v1/jobs` on the music worker.
3. The worker writes `{fileKey}.pcm` under `STREAM_ROOT` and callbacks pipit-api:
   - `POST /internal/music/jobs/:jobId/ready`
4. pipit-bot plays `local:{file}` via discord-player.

## Music worker (minimum)

```
POST /v1/jobs
  { "jobId": "<uuid>", "query": "<opaque string>" }
  → 202 { "jobId", "status": "accepted" }

GET /v1/health → 200
```

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

## Volume

| Environment | Path |
| --- | --- |
| Development | workspace `shared/` mounted at `/streams` |
| Production | Docker volume `music-files` at `/streams` |

Write atomically: `{file}.pcm.tmp` → rename to `{file}.pcm`.

Cleaning up old files is the worker's job. A file may still be waiting in the bot's queue long after its callback, so remove files by age with a generous margin (hours, not minutes); the bot skips a queued track whose file has gone.
