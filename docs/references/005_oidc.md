# 005 — OIDC sign-in

- **OpenID Connect Core** — https://openid.net/specs/openid-connect-core-1_0.html
- **OAuth 2.0 PKCE** (RFC 7636) — https://datatracker.ietf.org/doc/html/rfc7636
- **openid-client** v6 — https://github.com/panva/openid-client

## How Pipit uses it

- The app is the OIDC client: Authorization Code with PKCE, discovery from `OIDC_ISSUER`, a signed session
  (`DASHBOARD_SESSION_SECRET`).
- Scopes come from `OIDC_SCOPES` (default `openid profile email groups`; must contain `openid`).
- Write access: the `groups` claim intersected with `DASHBOARD_ADMIN_GROUPS`.
- Without `OIDC_ISSUER`, a development identity (`DASHBOARD_DEV_USER`, `DASHBOARD_DEV_ROLE`) applies.

## Worth knowing

- Some providers only include `groups` when the scope is requested — the reason scopes are configurable.
- Behind a reverse proxy the callback URL must be the public one.
- An unreachable provider answers `502` with its cause.
- Providers known to work: Authentik, and Dex in front of GitHub.
