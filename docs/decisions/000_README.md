# Decisions

<details>
<summary><b>한국어</b></summary>

Pipit을 만든 결정들 — 봇이 무엇인지, 어떻게 만들어지는지, 어떻게 작업되는지를 바꾼 것들 — 을 모았습니다. 파일마다 그때의
상황, 결정한 것, 그 결과를 적어 두어서, 나중에 무언가를 바꿀 때 이유를 다시 찾아내지 않고 기록에서 시작할 수 있게 합니다.

변경 기록이 아닙니다. 그날그날의 변화는 [릴리즈 노트](https://github.com/team-croffle/pipit-bot/releases)에 있고, 되돌리려면
프로젝트의 한 부분을 다시 생각해야 하는 결정만 여기에 씁니다.

### 파일

`NNN_vX.Y.Z_title.md` — `001`부터 이어지는 번호, 그 결정이 처음 들어간 버전, 짧은 제목. 번호는 다시 쓰지 않습니다. 나중에
다른 결정으로 대체되면 파일은 남기고 **Superseded**(대체됨)로 표시해 대체한 결정을 연결합니다. 다듬어진 결정은 다시 쓰지
않고 **Later**(이후) 절을 더합니다.

파일마다 들어가는 것:

- **버전**과 **상태**(채택 · 대체됨)
- **맥락** — 무엇이 선택을 강요했는지
- **결정** — 무엇을 골랐는지
- **결과** — 무엇이 쉬워지고 어려워졌는지, 무엇을 배제하는지

각 파일은 한국어를 접어서 위에, 영어를 아래에 둡니다. 색인은 아래 표를 보세요.

</details>

The decisions that shaped Pipit — the ones that changed what the bot is, how it is built, or how it is worked on. Each
file records the situation at the time, what was decided, and what followed from it, so a later change can start from
the reasoning instead of rediscovering it.

This is not a changelog. Day-to-day changes are in the [release notes](https://github.com/team-croffle/pipit-bot/releases);
a decision is written down here when undoing it would mean rethinking part of the project.

## Files

`NNN_vX.Y.Z_title.md` — a running number from `001`, the version the decision first shipped in, and a short title.
Numbers are never reused. A decision that is later replaced stays, marked **Superseded** with a link to the one that
replaced it; one that is refined gets a **Later** section rather than a rewrite.

Each file has:

- **Version** and **Status** (Accepted · Superseded)
- **Context** — what forced a choice
- **Decision** — what was chosen
- **Consequences** — what it made easy, what it made hard, and what it rules out

## Index

| # | Version | Decision |
| --- | --- | --- |
| [001](./001_v0.5.0_music-worker.md) | v0.5.0 | Music playback through an external music worker |
| [002](./002_v0.5.0_one-process.md) | v0.5.0 | The bot, its API and the dashboard are one process |
| [003](./003_v0.5.0_settings-in-json-files.md) | v0.5.0 | Runtime settings live in JSON files |
| [004](./004_v0.5.0_dashboard-sign-in-with-oidc.md) | v0.5.0 | The dashboard signs in with OIDC, as its own client |
| [005](./005_v0.5.0_releases-by-workflow.md) | v0.5.0 | Releases are cut by a workflow, tested as pre-releases |
| [006](./006_v0.6.0_no-role-split.md) | v0.6.0 | No main / edge split |
| [007](./007_v0.6.0_github-app-and-webhook.md) | v0.6.0 | GitHub events through a GitHub App and one webhook |
| [008](./008_v0.6.4_embed-notifications.md) | v0.6.4 | Notifications are templated embeds; mentions stay outside |
| [009](./009_v0.6.4_one-message-per-item.md) | v0.6.4 | One message per pull request or issue, kept current |
| [010](./010_v0.6.4_enforced-source-abstraction.md) | v0.6.4 | The music worker abstraction is enforced by tooling |
| [011](./011_v0.6.4_dashboard-design-system.md) | v0.6.4 | One design system for the dashboard |
| [012](./012_v0.6.6_reminders-read-github-on-demand.md) | v0.6.6 | Reminders read GitHub on demand |
| [013](./013_v0.6.8_lists-are-not-authoritative.md) | v0.6.8 | Picker lists are suggestions, never the only way in |
| [014](./014_v0.7.0_music-controls-on-the-dashboard.md) | v0.7.0 | The dashboard controls music as fully as the commands |
| [015](./015_v0.7.0_bot-side-volume.md) | v0.7.0 | The bot applies the volume itself |
| [016](./016_v0.7.1_music-job-lifecycle.md) | v0.7.1 | Music jobs always end, and can be cancelled or retried |
| [017](./017_v0.7.1_slash-commands-and-music-remote.md) | v0.7.1 | Slash commands only, and a remote control in the music channel |
| [018](./018_v0.7.2_audit-log.md) | v0.7.2 | An audit log in day files, recorded at the edges |
