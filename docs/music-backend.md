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
Body: { "error": "..." }
```

## Volume

| Environment | Path |
| --- | --- |
| Development | workspace `shared/` mounted at `/streams` |
| Production | Docker volume `music-files` at `/streams` |

Write atomically: `{file}.pcm.tmp` → rename to `{file}.pcm`.
