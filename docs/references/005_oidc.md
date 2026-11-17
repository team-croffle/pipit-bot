# 005 — Dashboard sign-in (Better Auth, OIDC)

- **Better Auth** — https://www.better-auth.com/docs (username plugin, generic OAuth plugin, database hooks)
- **OpenID Connect Core** — https://openid.net/specs/openid-connect-core-1_0.html
- **OAuth 2.0 PKCE** (RFC 7636) — https://datatracker.ietf.org/doc/html/rfc7636

## How Pipit uses it

- Since v0.8.2 the bot signs people in with Better Auth (`src/lib/auth/`), mounted under `/api/auth/*`; only the
  endpoints the dashboard needs are reachable (`src/api/routes/auth.ts`). Sessions are database rows, seven days,
  signed with `DASHBOARD_SESSION_SECRET`.
- Methods: password accounts (username plugin; sign-up closed) and OIDC (generic OAuth plugin: Authorization Code with
  PKCE, discovery from `OIDC_ISSUER`, callback `/api/auth/callback/oidc`). `data/auth-settings.json` switches them.
- Scopes come from `OIDC_SCOPES` (default `openid profile email groups`; must contain `openid`).
- Write access: a person's groups — the `groups` claim of their last OIDC sign-in plus groups given on the dashboard —
  intersected with `DASHBOARD_ADMIN_GROUPS`.
- `NODE_ENV=development` seeds the fixed `admin` and `member` accounts; production never does.

## Worth knowing

- Some providers only include `groups` when the scope is requested — the reason scopes are configurable.
- Better Auth discovers a generic OAuth provider once, when its instance is built, and skips it if that fails. The bot
  discovers first (`oidc-discovery.ts`), so an unreachable provider answers `502` with its cause and a later sign-in
  works without a restart.
- Better Auth finds the user of an OAuth sign-in by the provider account, then by e-mail. Every Pipit user has a
  placeholder address, and `profiles.ts` replaces the provider's address with the address of the user the person
  already is — linking by identifier, never by a provider's e-mail.
- Behind a reverse proxy, set `DASHBOARD_URL` so the callback URL is the public one.
- Providers known to work: Authentik, and Dex in front of GitHub.
