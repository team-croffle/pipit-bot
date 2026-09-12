# Pipit Hub

<div align="center">
  <img height="150" width="150" src="./docs/img/pipit-mark.png" alt="Pipit"/>
</div>

<p align="center"><a href="./README.md">English</a></p>

**Pipit**은 디스코드를 중심으로 모여 함께 작업하는 작은 개발팀을 위한 디스코드 봇입니다. 팀이 이미 대화하는 자리에 팀의 워크플로우를 접어 넣습니다 — 봇 하나, 대시보드 하나로 전부 설정합니다.

- **PR·이슈 리마인더** — GitHub App이 등록·업데이트·리뷰·머지·닫힘을 지정한 채널로 알리고, 필요한 사람만 멘션하며, 담당자·리뷰어가 바뀌면 원래 알림 메시지를 최신 상태로 고칩니다
- **리액션 롤** — 봇이 패널 메시지를 발행하고, 멤버가 반응하면 역할을 부여합니다
- **초대 로거** — 입장·퇴장 메시지, 초대 코드 추적, 입장 시 자동 역할
- **음악** — 음성 채널에서 함께 듣는 재생. 교체 가능한 music worker가 뒤에서 처리합니다
- **대시보드** — 위 설정 전부를 라이트/다크 테마로, 자체 OIDC 로그인 뒤에서

Sapphire와 discord.js로 만들었습니다. 음악 소스는 **교체 가능**합니다: pipit-bot은 별도의 music worker에 요청하고, 공유 볼륨에 준비된 파일을 스트리밍합니다. [docs/music-backend.md](./docs/music-backend.md)를 참고하세요.

## 스택

- Node.js 18+, TypeScript, Sapphire
- discord.js v14, discord-player v7
- 내장 **pipit-api** (잡 레지스트리, 내부 콜백, 대시보드 API)
- Yarn 4, Docker Compose

## 환경 변수

`.env.example`을 `.env`로 복사합니다 (`yarn start:dev`용으로 `.env.development.local`도 선택적으로).

```ini
BOT_TOKEN=
STREAM_ROOT=/streams
API_PORT=3000
INTERNAL_TOKEN=
GITHUB_WEBHOOK_SECRET=
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_PRIVATE_KEY_PATH=
GITHUB_APP_INSTALLATION_ID=
MUSIC_WORKER_URL=http://music-worker:8080
PIPIT_API_URL=http://127.0.0.1:3000
DASHBOARD_ADMIN_GROUPS=pipit-admins
DASHBOARD_DEV_USER=dev
DASHBOARD_DEV_ROLE=admin
OIDC_ISSUER=
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_REDIRECT_URI=
DASHBOARD_SESSION_SECRET=
```

프로덕션 대시보드 인증은 **Authentik OIDC**(Authorization Code + PKCE)입니다. 봇이 OIDC 클라이언트이며, 이 compose에 outpost 컨테이너는 없습니다. 프로덕션에서는 `OIDC_*`와 `DASHBOARD_SESSION_SECRET`을 설정하세요. `/internal/*`은 공개 호스트에 노출하지 않습니다. music worker 콜백은 `INTERNAL_TOKEN`을 씁니다.

`OIDC_ISSUER`가 비어 있으면 로컬/개발 환경은 로그인 대신 `DASHBOARD_DEV_USER` / `DASHBOARD_DEV_ROLE`을 씁니다. `DASHBOARD_ADMIN_GROUPS`는 IdP 그룹을 쓰기 권한(봇 설정, 길드 이벤트, 재생)에 매핑합니다.

봇 설정과 길드 이벤트 설정은 `data/` 아래에 저장됩니다 (`runtime-config.json`, `guild-events.json`, `github-notify.json`, `github-messages.json`, `reaction-roles.json`, gitignore 대상). Docker에서는 `./pipit-bot/data:/app/data`를 마운트하세요.

## GitHub 알림

PR·이슈 활동은 **GitHub App**이 전달합니다. App 하나를 등록해 원하는 저장소에 설치하면, 설치된 모든 저장소가 같은 엔드포인트로 보고합니다.

| App 설정       | 값                                                                                    |
| -------------- | ------------------------------------------------------------------------------------- |
| Webhook URL    | `https://<public-host>/webhooks/github`                                               |
| Webhook secret | `GITHUB_WEBHOOK_SECRET`과 같은 값                                                     |
| 저장소 권한    | `Metadata: Read-only`, `Pull requests: Read-only`, `Issues: Read-only`                |
| 조직 권한      | `Members: Read-only` (선택 — 계정 매핑 피커에만 필요)                                 |
| 구독 이벤트    | Pull request, Pull request review, Pull request review comment, Issues, Issue comment |

인터넷에서 닿아야 하는 경로는 `POST /webhooks/github` 하나뿐입니다. `/api/*`와 `/internal/*`은 공개 호스트에서 막아 두세요. 모든 딜리버리는 유효한 `X-Hub-Signature-256`을 실어야 하며, `GITHUB_WEBHOOK_SECRET`이 비어 있는 동안 엔드포인트는 `404`로 응답합니다.

`GITHUB_APP_ID`와 개인 키가 있으면 대시보드가 설치된 저장소와 조직 멤버를 직접 입력하는 대신 제안합니다. 키는 `GITHUB_APP_PRIVATE_KEY_PATH`(파일 — 마운트된 시크릿이 보통 오는 형태)나 `GITHUB_APP_PRIVATE_KEY`(PEM 자체, 원문 또는 base64)로 주고, 둘 다 있으면 경로가 우선합니다. `GITHUB_APP_INSTALLATION_ID`는 선택 사항이며, 없으면 첫 번째 설치를 씁니다. 어느 것도 필수는 아닙니다: 리마인더는 webhook secret만으로 동작하고, 피커는 일반 텍스트 입력으로 되돌아갑니다. 계정 목록은 조직 멤버를 읽는데, 이는 App의 **Organization › Members (read)** 권한이 필요합니다. 없으면 설치된 각 저장소의 assignable 사용자를 대신 제안하고, 대시보드는 어느 목록을 보여주는지 표시합니다.

라우팅은 `data/github-notify.json`에 있습니다: 기본 채널, 저장소별 채널·이벤트 종류 override, 멘션에 쓰는 GitHub 로그인→디스코드 사용자 매핑. 매핑되지 않은 로그인은 일반 텍스트로 나갑니다. 자기 규칙이 없는 저장소는 기본 채널로 보내되, `notifyUnlistedRepos`를 끄면 목록에 있는 저장소만 보고합니다. 이 기능은 기본 비활성(`enabled: false`)으로 출하됩니다.

각 이벤트는 같은 페이지에서 구성하는 **임베드**를 보냅니다 — 평문 줄, 제목, 내용, 필드, 꼬리말, 색, 선택적 시간. 모든 부분이 템플릿입니다: `{repo}`, `{pr_number}`, `{pr_url}`, `{pr_title}`, `{event}`, `{actor}`, `{author}`, `{assignee}`, `{assignees}`, `{reviewers}`, `{mentions}`가 치환되고, `{name|있을 때|없을 때}`는 값 유무에 따라 문구를 고릅니다. 비어 있게 렌더되는 부분은 빠집니다.

이벤트가 제공하는 변수는 그 이벤트가 채울 수 있는 것에 따라 다릅니다 — `{actor}`는 머지에서는 머지한 사람, 리뷰에서는 리뷰어이고, `{reviewers}`(아직 남은 요청 목록)는 GitHub가 이미 비운 자리에서는 제공되지 않습니다. 편집기는 편집 중인 이벤트의 변수를 나열하고, 다른 변수를 쓴 템플릿은 저장이 거부됩니다. 이벤트마다 기본값이 있고, 편집하지 않은 이벤트는 그것을 따릅니다.

멘션은 평문 줄에 둡니다: 임베드 안에만 있는 멘션으로는 디스코드가 알림을 울리지 않습니다. 템플릿은 운영자가 쓴 마크다운 그대로지만 치환되는 값은 전부 이스케이프되므로, PR 제목으로 멘션이나 링크를 위조할 수 없습니다.

PR이나 이슈를 알린 메시지는 `data/github-messages.json`에 기억됩니다(상한 있음, 오래된 것부터 삭제). 나중에 누군가 배정되거나 리뷰 요청을 받으면 — 또는 배정이 해제되거나 제목이 바뀌면 — 그 메시지를 현재 제목·담당자·리뷰어로 다시 그려 제자리에서 수정하므로 낡지 않습니다. PR이나 이슈를 재오픈하면 다시 알리고, 그 메시지가 이후 최신 상태를 유지하는 메시지가 됩니다. 자기 자신을 배정하면 수정만 합니다 — 새 메시지도, 핑도 없습니다. 다른 사람을 배정하거나 리뷰를 요청하면 메시지를 수정하고 그 이벤트의 메시지도 보냅니다. 수정으로 생긴 멘션에는 디스코드가 알림을 주지 않기 때문입니다. 봇이 추적을 시작하기 전에 알려진 항목이나 메시지가 삭제된 항목은 수정하지 않습니다. 새로 게시한 것 없이 갱신만 한 경우 최근 발송 결과에 `edited`로 표시됩니다.

디스코드 개발자 포털에서 **Server Members Intent**를 켜세요. 봇에는 `Manage Roles`, `Send Messages`, `Add Reactions`, `View Channel`, `Read Message History`, `Manage Guild`(초대 사용 횟수)가 필요합니다. 봇 역할은 부여하는 역할보다 위에 있어야 합니다.

## 리액션 롤

**패널**은 봇이 소유한 메시지 하나입니다. 채널을 고르고, 임베드를 구성하고, 어떤 이모지가 어떤 역할을 주는지 나열합니다. 발행하면 메시지를 보내고 각 이모지로 반응을 붙입니다. 패널을 수정해 다시 발행하면 같은 메시지를 고치고 반응을 옵션에 맞춰 다시 정리합니다.

패널은 **반응 수 1**로 유지할 수 있습니다 — 봇이 멤버의 반응을 즉시 떼어내므로 메시지가 집계가 아니라 버튼 줄처럼 읽히고, 이모지를 누를 때마다 역할이 켜지고 꺼집니다. 끄면 반응 자체가 기록입니다: 붙이면 역할 부여, 떼면 회수.

봇은 보내기 전에 검사합니다: 그 채널에서 글을 쓰고 반응할 수 있어야 하고, 모든 역할이 봇 역할보다 아래에 있어야 하며 디스코드가 관리하는 역할이 아니어야 합니다. 반응 수 1 유지에는 `Manage Messages`도 필요하고, 가운데에 이모지를 끼워 넣은 뒤 순서를 되돌리는 데도 필요합니다 — 디스코드는 반응이 처음 붙은 자리를 고정하므로, 유일한 수리 방법은 전부 지우고 다시 반응하는 것입니다. 역할을 줄 수 없는 패널은 멤버가 반응했을 때 조용히 실패하는 대신 사유와 함께 발행이 거부됩니다. 패널은 `data/reaction-roles.json`에 저장됩니다.

## 소스 추상화

이 저장소는 음악 백엔드를 외부 **music worker**로만 설명합니다 — 특정 소스도, 워커의 이름도 언급하지 않습니다. [docs/music-backend.md](docs/music-backend.md)의 계약이 인터페이스의 전부입니다.

`yarn check:abstraction`이 이를 강제합니다. pre-commit 훅이 스테이징된 파일을, commit-msg 훅이 메시지를, **Source Abstraction** 워크플로가 푸시된 범위 전체를 검사합니다 — 마지막 것은 `--no-verify`로 건너뛸 수 없는 검사입니다.

## 개발

`pipit-bot/`에서:

```sh
yarn install
yarn watch:start
```

대시보드(Vite + Vue)는 `dashboard/`에서:

```sh
yarn dashboard:dev
```

`http://127.0.0.1:5173/`이 열리고 `/api`는 봇으로 프록시됩니다. 프로덕션에서는 `yarn dashboard:build` 후 봇이 `dashboard/dist`를 `GET /`에서 서빙합니다.

전체 스택(봇 + music worker)은 저장소 루트의 워크스페이스 compose를 씁니다:

```sh
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up --build
```

개발용 스트림은 `../shared/`에 저장됩니다.

## 음악 명령

- `!p <query>` / `!play <query>` — 불투명한 쿼리를 music worker로 그대로 전달
- 큐 제어: `!skip`, `!pause`, `!resume`, `!queue` 등

봇은 쿼리 문자열을 검증하거나 파싱하지 않습니다.

## 라이선스

MIT — [LICENSE](./LICENSE) 참고.
