# 006 — GitHub App, webhooks and REST

- **GitHub Apps** — https://docs.github.com/en/apps/creating-github-apps
- **Webhook events and payloads** — https://docs.github.com/en/webhooks/webhook-events-and-payloads
- **Validating deliveries** — https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
- **REST API** — https://docs.github.com/en/rest

## How Pipit uses it

- Webhook: one route, `POST /webhooks/github`, `X-Hub-Signature-256` checked against `GITHUB_WEBHOOK_SECRET`.
- Events subscribed: Pull request, Pull request review, Pull request review comment, Issues, Issue comment.
- Permissions: repository Metadata, Pull requests and Issues read-only; organisation Members read-only (optional).
- REST through installation tokens (`GITHUB_APP_ID` + private key): installations and their repositories, a pull
  request or issue by number (reminders), open items of a repository (one page of the issues endpoint, pull requests
  marked by the `pull_request` key), organisation members or assignable users.

## Worth knowing

- `requested_reviewers` lists only reviews still outstanding — GitHub removes a reviewer once they review.
- Who `actor` is depends on the event (the merger on a merge, the reviewer on a review).
- A review can be requested from a team (`requested_teams`); Pipit maps teams to Discord roles.
- `issues` also returns pull requests; the `pull_request` key tells them apart.
- An installation token expires after an hour; lists are cached briefly to stay well inside rate limits.
