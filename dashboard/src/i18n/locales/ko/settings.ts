import type { settings as en } from '../en/settings';

/** 설정 페이지와 카드들. */
export const settings: typeof en = {
  title: '설정',
  description: '기본 동작, 채널, 기능별 on/off',
  readOnly: '읽기 전용 계정입니다 — 설정을 변경할 수 없습니다.',
  commandChannels: '명령 채널 제한',
  commandChannelsBody:
    '기능별로 나뉘어 각 기능 페이지에서 지정합니다. 음악은 {link}의 재생 옵션 탭에서 설정하세요.',
  musicPage: '음악 페이지',
  featuresTitle: '기능별 on/off',
  featuresDescription:
    '기능 단위로 켜고 끕니다. 끄면 그 기능의 디스코드 명령도 사라집니다(디스코드에 반영되는 데 잠시 걸릴 수 있어요).',
  plannedCalendar: '캘린더 연동',
  plannedPolls: '투표 연동',
  auditTitle: '감사 로그',
  auditDescription:
    '기본으로 음악 기록은 누가 어떤 기능을 썼는지만 남깁니다. 곡 제목도 요청 내용도 남기지 않습니다.',
  musicRequests: '음악 요청 기록',
  musicRequestsHelp:
    '켜면 그때부터 곡 준비 기록에 요청한 내용과 준비된 곡 제목을 함께 남깁니다. 끄면 다시 기능 사용만 남고, 이미 남은 기록은 바뀌지 않습니다.',
  auditOff: '감사 로깅이 꺼져 있어 지금은 아무것도 남지 않습니다.',
  auditLoadFailed: '감사 설정을 불러오지 못했습니다.',
  auditSaveFailed: '감사 설정을 저장하지 못했습니다.',
  rssTitle: '블로그 RSS 알림',
  rssDescription: '등록한 여러 블로그의 새 글을 채널 하나로 모아 링크와 함께 안내합니다.',
  rssBlog: '블로그',
  rssUrl: 'RSS 주소',
  rssStatus: '상태',
  rssEmpty: '등록된 피드가 없습니다.',
  rssAdd: '피드 추가',
  signIn: {
    title: '로그인 방법',
    description:
      '로그인 화면에 보일 방법입니다. 하나는 항상 켜져 있어야 합니다. 잠겼다면 서버의 {file}을 고치고 다시 시작하세요.',
    fallback:
      '설정 파일을 쓸 수 없어(손상되었거나 모두 꺼짐) 설정된 방법을 모두 켠 상태로 시작했습니다. 여기서 저장하면 파일이 다시 만들어집니다.',
    unavailable: '사용할 수 없음 — {reason}',
    lastOn: '마지막으로 켜진 방법이라 끌 수 없습니다.',
    loadFailed: '로그인 방법을 불러오지 못했습니다.',
    saveFailed: '저장하지 못했습니다.',
    password: { label: '비밀번호', help: '관리자가 사용자 페이지에서 만든 계정' },
    oidc: { label: 'SSO (OIDC)', help: '설정한 ID 제공자(Dex 등)로 로그인' },
    discord: { label: 'Discord', help: '서버 멤버만 — 처음이면 viewer로 만들어집니다' },
    github: { label: 'GitHub', help: '사용자에 GitHub 로그인이 등록된 사람만' },
  },
};
