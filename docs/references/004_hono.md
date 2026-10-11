# 004 — Hono (the embedded API)

- **Hono** v4 — https://hono.dev/docs · **@hono/node-server** — https://hono.dev/docs/getting-started/nodejs

## How Pipit uses it

- `createApp()` (`src/api/app.ts`) builds one app; `startApiServer()` serves it on `API_PORT` before the Discord client
  logs in.
- Route modules mount onto it (`src/api/routes/*`); dashboard routes are guarded by middleware (`dashboardViewer`,
  `dashboardWrite`), worker callbacks by `internalAuth` (`X-Pipit-Internal-Token`).
- The built dashboard is served from `dashboard/dist` with an SPA fallback for every other `GET`.

## Worth knowing

- Middleware sets typed variables on the context (`config`, `identity`) — declare them in `ApiVariables`.
- A refusal from a playback action answers `400` with `{ ok: false, message }`; validation errors answer `{ error }`.
  The dashboard reads both.
- Files under `src/` stay below 300 lines; a route module that grows is split by area (`music.ts` / `music-jobs.ts`).
