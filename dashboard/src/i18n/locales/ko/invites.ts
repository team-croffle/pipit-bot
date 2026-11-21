import type { invites as en } from '../en/invites';

/** 초대 로거 페이지와 초대 통계. */
export const invites: typeof en = {
  title: '초대 로거',
  description: '초대 코드별 유입, 입장·퇴장 안내와 기록, 가입 시 자동 역할 부여',
  readOnly: '읽기 전용 계정입니다 — 설정을 변경할 수 없습니다.',
  loadErrorTitle: '저장된 설정 파일을 읽지 못했습니다',
  loadErrorBody:
    '봇이 기본값으로 동작하고 있습니다. 지금 저장하면 기본값이 파일을 덮어씁니다 — 서버의 사본을 먼저 확인하세요. {error}',
  errorTitle: '문제가 발생했습니다',
  channels: {
    title: '채널',
    description:
      '안내 채널에는 아래의 입장·퇴장 메시지가, 기록 채널에는 누가 어떤 초대로 들어왔고 얼마나 머물렀는지만 담은 한 줄이 남습니다(알림 없음).',
    log: '안내 채널',
    record: '기록 채널',
    none: '지정 안 함',
  },
  messages: {
    title: '입장 / 퇴장 메시지',
    placeholders: '자리표시자:',
    random: '. 여러 줄을 넣으면 그중 하나를 무작위로 고릅니다.',
    join: '입장 메시지',
    joinPlaceholder: '{user} 님이 들어왔습니다 ({inviter} 초대)',
    joinDelete: '입장 메시지 삭제',
    joinAdd: '입장 메시지 추가',
    leave: '퇴장 메시지',
    leavePlaceholder: '{username} 님이 나갔습니다',
    leaveDelete: '퇴장 메시지 삭제',
    leaveAdd: '퇴장 메시지 추가',
  },
  joinRoles: {
    title: '가입 시 역할 부여',
    description: '새로 들어온 멤버에게 자동으로 부여할 역할입니다.',
    none: '가져온 역할이 없습니다.',
  },
  save: '저장',
  stats: {
    title: '초대 코드별 유입',
    description: '봇이 본 입장 수를 코드별로 셉니다. 초대가 사라져도 수는 남습니다.',
    warningBefore: '봇에게 ',
    manageServer: '서버 관리',
    warningAfter:
      ' 권한이 없어 초대의 사용 횟수를 볼 수 없습니다. 이 상태로는 새 멤버가 어떤 초대로 들어왔는지 알 수 없어 유입이 세어지지 않습니다. 봇 역할에 서버 관리 권한을 주세요.',
    empty: '아직 기록된 초대가 없습니다.',
    loadFailed: '초대 목록을 불러오지 못했습니다.',
    code: '코드',
    inviter: '만든 사람',
    joins: '유입',
    uses: '사용',
    lastJoin: '최근 유입',
    status: '상태',
    gone: '사라짐',
    expires: '{date} 만료',
    noExpiry: '만료 없음',
    joinsCount: '유입 {count}',
    unknownInviter: '만든 사람 모름',
    usesCount: '· 사용 {uses}',
    lastJoinAt: '최근 유입 {at}',
  },
};
