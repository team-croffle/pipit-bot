# Pipit Hub

<div align="center">
  <img height="150" width="150" src="./docs/img/pipit-mark.png" alt="Pipit"/>
</div>

<p align="center"><a href="./README.md">English</a></p>

**Pipit**은 디스코드를 중심으로 모여 함께 작업하는 작은 개발팀을 위한 디스코드 봇입니다. 팀이 이미 대화하는 자리에 팀의 워크플로우를 접어 넣습니다 — 봇 하나, 대시보드 하나로 전부 설정합니다.

- **PR·이슈 리마인더** — GitHub App이 등록·업데이트·리뷰·머지·닫힘을 지정한 채널로 알리고, 필요한 사람만 멘션하며, 담당자·리뷰어가 바뀌면 원래 알림 메시지를 최신 상태로 고칩니다
- **리액션 롤** — 봇이 패널 메시지를 발행하고, 멤버가 반응하면 역할을 부여합니다
- **초대 로거** — 입장·퇴장 메시지, 초대 코드별 유입 수, 기록 채널, 입장 시 자동 역할
- **감사 로그** — 대시보드·디스코드에서 누가 무엇을 했는지, GitHub 발송과 멤버 입장·퇴장. 90일 보관
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
# 기본값: openid profile email groups
OIDC_SCOPES=
DASHBOARD_SESSION_SECRET=
```

프로덕션 대시보드 인증은 **OIDC**(Authorization Code + PKCE)입니다 — Authentik과 Dex는 동작이 확인됐고, 이 플로우를 지원하는 다른 제공자도 쓸 수 있습니다. 봇이 OIDC 클라이언트이며, 이 compose에 인증 프록시 컨테이너는 없습니다. 프로덕션에서는 `OIDC_*`와 `DASHBOARD_SESSION_SECRET`을 설정하세요. `/internal/*`은 공개 호스트에 노출하지 않습니다. music worker 콜백은 `INTERNAL_TOKEN`을 씁니다.

`OIDC_ISSUER`가 비어 있으면 로컬/개발 환경은 로그인 대신 `DASHBOARD_DEV_USER` / `DASHBOARD_DEV_ROLE`을 씁니다. `DASHBOARD_ADMIN_GROUPS`는 IdP 그룹을 쓰기 권한(봇 설정, 길드 이벤트, 재생)에 매핑합니다: 제공자가 내려주는 `groups` 클레임과 대소문자 구분 없이 전체 일치로 비교합니다. 일부 제공자는 `groups` 스코프를 요청해야만 그 클레임을 내려주므로(Dex가 그렇습니다) 기본 `OIDC_SCOPES`에 포함돼 있습니다. 값은 공백 또는 쉼표로 구분하며 `openid`를 반드시 포함해야 합니다. 그룹 이름은 제공자가 부르는 그대로 적으세요 — 예를 들어 Dex의 GitHub 커넥터는 그룹을 `org:team`(`teamNameField: slug`이면 `org:team-slug`)으로 부르므로 `DASHBOARD_ADMIN_GROUPS=my-org:admins`처럼 씁니다. 제공자에 연결할 수 없으면 `/api/auth/login`과 콜백은 `502`와 `{"error":"The identity provider could not be reached."}`로 응답하고 봇이 원인을 로그에 남깁니다.

봇 설정과 길드 이벤트 설정은 `data/` 아래에 저장됩니다 (`runtime-config.json`, `guild-events.json`, `github-notify.json`, `github-messages.json`, `reaction-roles.json`, `invite-stats.json`, `playlists.json`, `playback-options.json`, 감사 로그는 `audit/`; gitignore 대상). Docker에서는 `./pipit-bot/data:/app/data`를 마운트하세요.

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

라우팅은 `data/github-notify.json`에 있습니다: 기본 채널, 저장소별 채널·이벤트 종류 override, 멘션에 쓰는 GitHub 로그인→디스코드 사용자 매핑, GitHub 팀→디스코드 역할 매핑(`teams`). 매핑되지 않은 로그인은 일반 텍스트로 나갑니다. 자기 규칙이 없는 저장소는 기본 채널로 보내되, `notifyUnlistedRepos`를 끄면 목록에 있는 저장소만 보고합니다. 이 기능은 기본 비활성(`enabled: false`)으로 출하됩니다.

리뷰는 사람뿐 아니라 **팀**에도 요청될 수 있습니다. GitHub 페이지의 "팀 → 역할" 카드에서 팀(`org/slug`, org는 저장소 소유자)을 디스코드 역할에 매핑하면, 그 팀에 대한 리뷰 요청은 — webhook으로 오든 `/remind`로 오든 — 역할을 멘션합니다(`<@&role>`). 매핑이 없는 팀은 지금까지처럼 이름만 적고 멘션하지 않습니다. 핑이 실제로 사람들에게 닿으려면 역할이 누구나 멘션할 수 있어야 하거나("Allow anyone to @mention this role"), 봇이 그 채널에서 **Mention Everyone** 권한을 가져야 합니다. 둘 다 아니면 카드가 해당 행에 경고를 띄우고, 역할을 멘션하지 못한 경우 발송 기록에도 그렇게 남습니다. 매핑은 `data/github-notify.json`의 `teams`(`[{ githubTeam, discordRoleId }]`)에 저장되며, 이 키가 생기기 전에 쓰인 파일도 그대로 읽힙니다.

각 이벤트는 같은 페이지에서 구성하는 **임베드**를 보냅니다 — 평문 줄, 제목, 내용, 필드, 꼬리말, 색, 선택적 시간. 모든 부분이 템플릿입니다: `{repo}`, `{pr_number}`, `{pr_url}`, `{pr_title}`, `{event}`, `{actor}`, `{author}`, `{assignee}`, `{assignees}`, `{reviewers}`, `{mentions}`가 치환되고, `{name|있을 때|없을 때}`는 값 유무에 따라 문구를 고릅니다. 비어 있게 렌더되는 부분은 빠집니다.

조용해진 PR이나 Issue는 **손으로 다시 알릴 수 있습니다** — 디스코드에서 `/remind`, 또는 GitHub 페이지의 "다시 알리기" 카드. 카드는 설치된 저장소 목록에서 저장소를, 이어서 그 저장소의 열린 PR·Issue 목록에서 번호를 고릅니다(`#12 · 제목`, PR·Issue·초안 표시). 닫힌 항목이나 목록을 읽을 수 없는 저장소는 번호를 직접 입력하고("직접 입력…"), App 자격 증명이 없으면 모든 피커가 직접 입력을 제공합니다. 설치된 저장소 중 이름이 하나로 정해지면 이름만 써도 되고(`pipit-bot #12`), PR·Issue 링크도 받습니다. 봇이 App으로 항목을 읽어(여기서부터 `GITHUB_APP_ID`와 개인 키가 필요합니다) 번호가 PR인지 Issue인지 GitHub에서 확인합니다. PR이면 아직 리뷰 요청이 남은 사람과 담당자를 부르는 `PR Reminder`를, Issue면 담당자를 부르는 `Issue Reminder`를 보내며, 작성자는 부르지 않습니다. 리뷰를 요청받은 팀은 매핑된 역할로 멘션하고(위 참고), 매핑이 없으면 이름만 적습니다. 응답은 둘을 합쳐 "Reminded N people or teams"로 셉니다. 초안이거나 기다리는 사람이 없으면 보내지 않고, 머지됐거나 닫힌 항목은 새로 보내지 않되 처음 알림 메시지를 최신 상태로 고칩니다. 사유는 디스코드에 답하고 최근 발송에 남깁니다. 같은 항목은 5분에 한 번만 보냅니다. `PR Reminder`·`Issue Reminder` 이벤트 토글은 이 기능의 허용 스위치입니다 — 기본 켬이고, 저장소에서 끄면 그 저장소에서는 그 종류를 다시 알리지 않습니다.

이벤트가 제공하는 변수는 그 이벤트가 채울 수 있는 것에 따라 다릅니다 — `{actor}`는 머지에서는 머지한 사람, 리뷰에서는 리뷰어이고, `{reviewers}`(아직 남은 요청 목록)는 GitHub가 이미 비운 자리에서는 제공되지 않습니다. 편집기는 편집 중인 이벤트의 변수를 나열하고, 다른 변수를 쓴 템플릿은 저장이 거부됩니다. 이벤트마다 기본값이 있고, 편집하지 않은 이벤트는 그것을 따릅니다.

멘션은 평문 줄에 둡니다: 임베드 안에만 있는 멘션으로는 디스코드가 알림을 울리지 않습니다. 템플릿은 운영자가 쓴 마크다운 그대로지만 치환되는 값은 전부 이스케이프되므로, PR 제목으로 멘션이나 링크를 위조할 수 없습니다.

PR이나 이슈를 알린 메시지는 `data/github-messages.json`에 기억됩니다(상한 있음, 오래된 것부터 삭제). 나중에 누군가 배정되거나 리뷰 요청을 받으면 — 또는 배정이 해제되거나 제목이 바뀌면 — 그 메시지를 현재 제목·담당자·리뷰어로 다시 그려 제자리에서 수정하므로 낡지 않습니다. PR이나 이슈를 재오픈하면 다시 알리고, 그 메시지가 이후 최신 상태를 유지하는 메시지가 됩니다. 자기 자신을 배정하면 수정만 합니다 — 새 메시지도, 핑도 없습니다. 다른 사람을 배정하거나 리뷰를 요청하면 메시지를 수정하고 그 이벤트의 메시지도 보냅니다. 수정으로 생긴 멘션에는 디스코드가 알림을 주지 않기 때문입니다. 봇이 추적을 시작하기 전에 알려진 항목이나 메시지가 삭제된 항목은 수정하지 않습니다. 새로 게시한 것 없이 갱신만 한 경우 최근 발송 결과에 `edited`로 표시됩니다.

디스코드 개발자 포털에서 **Server Members Intent**를 켜세요. 봇에는 `Manage Roles`, `Send Messages`, `Add Reactions`, `View Channel`, `Read Message History`, `Manage Guild`(초대 사용 횟수)가 필요합니다. 봇 역할은 부여하는 역할보다 위에 있어야 합니다.

## 초대

초대 페이지에서 채널 두 개를 정합니다. **안내 채널**에는 직접 쓴 입장·퇴장 메시지가 갑니다(`{user}`, `{username}`, `{inviter}`, `{invite}`; 여러 개면 무작위로 하나). **기록 채널**은 선택이며 따로 정하고, 입장·퇴장마다 사실만 담은 한 줄 — 누가, 어떤 초대로, 누가 만든 초대인지, 나간 사람은 며칠 머물렀는지 — 이 남습니다. 알림은 가지 않습니다.

유입은 초대 코드별로 `data/invite-stats.json`에 세므로, 초대가 사라져도 수는 남습니다. "초대 코드별 유입" 카드는 초대마다 만든 사람, 봇이 센 유입 수, 디스코드의 사용 수, 최근 유입, 만료·사라짐 여부를 보여 줍니다. 새 멤버가 어떤 초대로 들어왔는지 알려면 **Manage Guild**(서버 관리) 권한이 필요합니다. 없으면 디스코드가 초대 목록은 보여 줘도 사용 횟수를 빼고 보내서, 어떤 초대인지 알 수 없고 아무것도 세어지지 않습니다 — 그럴 때 카드가 경고합니다.

## 감사 로그

봇은 누가 무엇을 했고 결과가 어땠는지 남깁니다:

- 대시보드에서 바꾼 것(설정, 음악 조작, 리액션 롤 패널, 다시 알리기 등) — 요청 본문은 남기지 않습니다
- 디스코드의 슬래시 명령, 리모컨 버튼과 재생 입력 창, 음악 채널에 친 요청. 보기만 하는 명령(`/queue`, `/help`)은 남기지 않습니다
- 음악 작업이 어떻게 끝났는지(출처, 실패했으면 실패 코드)
- GitHub 발송(보냄·수정·건너뜀·실패와 사유), 멤버 입장(초대 코드·초대한 사람)·퇴장

**음악은 누가 어떤 기능을 썼는지만** 남깁니다 — 곡도, 요청한 내용도 남기지 않습니다. 하루 파일 하나 `data/audit/YYYY-MM-DD.jsonl`(UTC)에 덧붙이고, **90일**이 지난 파일은 지웁니다. 기록에는 디스코드 사용자 ID·표시 이름과 대시보드 사용자 이름이 들어가므로, `data/`를 읽을 수 있는 사람을 생각해 두세요. 대시보드 **로깅** 페이지에서 분류·기간·검색으로 봅니다.

## 리액션 롤

**패널**은 봇이 소유한 메시지 하나입니다. 채널을 고르고, 임베드를 구성하고, 어떤 이모지가 어떤 역할을 주는지 나열합니다. 발행하면 메시지를 보내고 각 이모지로 반응을 붙입니다. 패널을 수정해 다시 발행하면 같은 메시지를 고치고 반응을 옵션에 맞춰 다시 정리합니다.

패널은 **반응 수 1**로 유지할 수 있습니다 — 봇이 멤버의 반응을 즉시 떼어내므로 메시지가 집계가 아니라 버튼 줄처럼 읽히고, 이모지를 누를 때마다 역할이 켜지고 꺼집니다. 끄면 반응 자체가 기록입니다: 붙이면 역할 부여, 떼면 회수.

봇은 보내기 전에 검사합니다: 그 채널에서 글을 쓰고 반응할 수 있어야 하고, 모든 역할이 봇 역할보다 아래에 있어야 하며 디스코드가 관리하는 역할이 아니어야 합니다. 반응 수 1 유지에는 `Manage Messages`도 필요하고, 가운데에 이모지를 끼워 넣은 뒤 순서를 되돌리는 데도 필요합니다 — 디스코드는 반응이 처음 붙은 자리를 고정하므로, 유일한 수리 방법은 전부 지우고 다시 반응하는 것입니다. 역할을 줄 수 없는 패널은 멤버가 반응했을 때 조용히 실패하는 대신 사유와 함께 발행이 거부됩니다. 패널은 `data/reaction-roles.json`에 저장됩니다.

## 음악

음악 명령으로 하는 일은 대시보드 **음악** 페이지에서도 할 수 있습니다:

- **통화방** — 통화방을 고르면 봇이 참여하고, 연결된 상태에서 다른 방을 고르면 지금 곡을 멈추지 않고 옮겨 갑니다. 피커에 방마다 인원이 보입니다 — 아무도 없는 방은 30초 뒤 봇이 스스로 나가기 때문입니다. **나가기**로 연결을 끊습니다
- **대기열** — 대기 중인 곡 전체(최대 100곡 표시)와 곡마다 **위로**·**아래로**·**여기로 건너뛰기**·**빼기**(휴대폰에서는 메뉴 하나로), 그리고 대기 중인 곡을 한 번 섞는 **섞기**. 행은 플레이어의 트랙 id로 지정하므로 목록이 잠깐 늦어도 다른 곡을 건드리지 않습니다. 건너뛰면 앞의 곡들은 `/skip to`처럼 빠집니다
- **최근 재생** — 이번 세션에서 재생한 곡(최근 20곡)과 **이전 곡**. 이전 곡으로 가면 지금 곡은 대기열 맨 앞으로 돌아갑니다. 기록은 세션이 끝나면 사라집니다
- **추가** — 입력한 쿼리를 그대로 music worker에 보냅니다. 메뉴의 **다음에 재생**은 `/play next`처럼 대기열 맨 앞에 넣습니다
- **검색** — music worker의 결과를 최대 5개 보여 주는 창을 엽니다. 결과마다 **추가**하거나 **다음에 재생**으로 넣을 수 있고, 여러 곡을 이어서 넣을 수 있습니다. 봇이 통화방에 들어가기 전에도 검색은 되고, 추가는 들어간 뒤에 됩니다
- **볼륨** — 낮음 / 중간 / 높음, `/volume`과 같은 세 단계. 봇이 통화방에 있으면 재생 중이 아니어도 바꿀 수 있습니다
- **재생 옵션** — **모노**는 좌우 소리를 합쳐 양쪽에 똑같이 내보냅니다(이어폰 한쪽으로 들을 때). 재생 중인 곡에도 바로 적용되고, 봇이 통화방에 없어도 바꿀 수 있습니다. **자동 재생**은 음악이 끊기지 않게 합니다: 대기열의 마지막 곡이 시작되면 봇이 music worker에게 이어 들을 곡을 받아 준비하고, 그 곡이 끝나기 10초 전에 대기열에 넣습니다 — 그 사이 누가 곡을 넣으면 그 곡이 먼저입니다. 반복이 켜져 있거나 재생목록을 재생하는 동안은 쉬고, 다음 곡 추천을 지원하는 music worker가 필요합니다([docs/music-backend.md](./docs/music-backend.md)). 볼륨·모노·자동 재생은 `data/playback-options.json`에 저장되어 재시작해도 유지됩니다

대시보드, 배너, 명령은 같은 대기열을 씁니다. 어느 쪽에서든 이어서 조작할 수 있습니다.

### 음악 채널

설정된 음악 채널에는 **리모컨 배너**가 하나 있고, 봇이 채널의 마지막 메시지로 유지합니다:

- **대기 화면** — "💿 Pipit Hub Music", 곡을 요청하는 방법, 곡 제목이나 링크를 입력하는 창을 여는 **재생** 버튼, 그리고 **검색** 버튼
- **재생 중 화면** — 곡, 신청한 사람, 진행 막대, 반복·볼륨·대기열, 그리고 일시정지/재개·다음·정지·대기열·곡 추가·검색·반복·볼륨 낮추기/높이기·모노·자동 재생 버튼. 버튼의 결과는 누른 사람에게만 5초 동안 보입니다
- 채널에 **곡 제목이나 링크를 치면** 재생합니다: 그 줄은 지워지고, 모두에게 보이는 짧은 배너가 결과를 알린 뒤 스스로 사라집니다. 줄을 지우려면 그 채널에서 봇에게 **메시지 관리** 권한이 필요합니다. 없으면 요청은 그대로 처리되고 줄만 남습니다

**검색** — `/search`나 배너의 검색 버튼 — 은 결과를 최대 5개, 검색한 사람에게만 보여 줍니다. 하나를 골라 바로 재생하거나 다음 곡으로 넣습니다. 결과는 10분 동안, 검색한 사람만 고를 수 있습니다. 검색을 지원하는 music worker가 필요하고([docs/music-backend.md](./docs/music-backend.md)), 지원하지 않으면 봇이 그렇게 알려 주고 나머지는 그대로 동작합니다.

배너는 봇이 시작하거나 음악 채널이 추가될 때 게시되고, 지워지면 다시 게시되며, 음악 채널에서 빠진 채널에서는 사라집니다.

### 재생목록

재생목록은 음악 페이지의 **재생목록** 탭과 `/playlist`에 있습니다:

- **공용** 재생목록은 서버 모두가 보고 누구나 고칠 수 있고, **개인** 재생목록은 주인만 보고 고칩니다. 대시보드에서 개인 재생목록을 쓰려면 GitHub 페이지의 계정 연결에 내 GitHub ↔ 디스코드가 있어야 합니다(대시보드 로그인 = GitHub)
- **곡 담기** — 곡 제목이나 링크를 입력하거나, 지금 곡·대기열 곡·대기열 전체·최근 재생·검색 결과 옆의 "재생목록에 담기"(대시보드와 디스코드 검색 결과), 또는 music worker가 여러 곡으로 풀 수 있는 **링크에서 가져오기**(worker가 지원할 때만 보임, [docs/music-backend.md](./docs/music-backend.md))
- **재생** — 차례로 또는 섞어서, 지금 대기열 뒤에. 봇은 music worker에 두 곡씩 요청하고 재생목록 순서를 지킵니다. 준비하지 못한 곡은 건너뛰고 셉니다. 정지·비우기·나가기·다른 재생목록 재생은 지금 재생목록을 멈춥니다
- 음악 채널 리모컨에 **재생목록** 버튼 — 고르고 재생 또는 섞어서 재생
- 상한: 재생목록 200개, 재생목록마다 300곡. 재생목록은 곡의 요청 값까지 `data/playlists.json`에 보관하고, 화면과 답에는 제목만 보입니다

### 음악 작업

요청 하나하나는 music worker가 준비한 뒤에야 재생되는 **작업**입니다. **음악 작업** 카드가 상태와 함께 보여 줍니다:

- 준비 중인 작업은 **취소**할 수 있습니다 — 봇이 기다리기를 멈추고, 나중에 파일이 와도 재생하지 않습니다
- 실패했거나 취소한 작업은 같은 요청으로 **다시 시도**할 수 있습니다("다음에 재생"이었다면 그대로 맨 앞). 찾을 수 없음처럼 다시 해도 안 될 실패에는 버튼이 없습니다
- 실패에는 이유가 표시됩니다 — worker가 짧은 코드를 함께 보낼 수 있습니다([docs/music-backend.md](./docs/music-backend.md) 참고). 너무 오래 걸리는 작업은 끝없이 기다리지 않고 시간 초과로 실패합니다
- 대기열에서 기다리는 동안 준비된 파일이 사라진 곡은 건너뛰고, 음악 채널과 대시보드에 알립니다

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

## 명령

모든 명령은 **슬래시 명령**입니다(v0.7.1부터) — 디스코드에서 `/`를 치면 목록이 보입니다. 명령 접두사는 더 이상 없습니다. 답은 명령을 쓴 사람에게만 보입니다.

- `/remind item` — `owner/name #12`, `name #12`, 또는 PR·Issue 링크. PR이나 Issue가 기다리는 사람을 저장소의 알림 채널에서 다시 부릅니다. 위 리마인더 절 참고
- `/help` — 명령 목록 · `/ping` — 봇이 답하는지 확인

### 음악 명령

음악 채널에서 쓸 수 있습니다(음악 채널이 없으면 어디서나):

- `/play query [next]` — 쿼리를 그대로 music worker로 전달. `next`는 대기열 맨 앞에 넣음
- `/search query` — 결과 최대 5개를 나에게만 보여 줌. 골라서 바로 재생하거나 다음 곡으로
- `/playlist` — `list`, `show`, `create [personal]`, `rename`, `delete`, `add`(지금 곡·대기열 전체·제목이나 링크), `remove`, `move`, `import link [into]`, `play [shuffle]`. 재생목록 이름은 자동완성
- `/join`, `/leave` — 내가 있는 통화방에 참여(또는 이동), 또는 나가기
- 재생: `/pause`, `/resume`, `/skip [to]`, `/stop`, `/back`, `/loop mode`, `/volume [level]`
- 옵션: `/options [mono] [autoplay]` — 모노나 자동 재생을 켜고 끄거나 재생 옵션을 봅니다
- 대기열: `/queue`, `/remove position`, `/move from to`, `/shuffle`, `/clear`

대시보드 음악 페이지와 음악 채널의 배너에서도 같은 조작을 할 수 있습니다([음악](#음악) 참고). 봇은 쿼리 문자열을 검증하거나 파싱하지 않습니다.

### `!` 명령에서 올라올 때

슬래시 명령을 쓰려면 봇이 **`applications.commands`** scope로 초대되어 있어야 합니다: Discord Developer Portal에서 앱 → OAuth2 → URL Generator를 열고 `bot`과 `applications.commands`를 체크한 뒤 봇 권한을 골라, 나온 URL로 서버에 다시 승인하세요 — 봇을 내보낼 필요는 없습니다. 음악 채널을 깔끔하게 유지하려면 그 채널에서 봇에게 **메시지 관리** 권한을 주세요(채널 편집 → 권한 → 봇 역할).

## 라이선스

MIT — [LICENSE](./LICENSE) 참고.
