import type { features as en } from '../en/features';

/** 기능 스위치(설정 페이지, 개요, 꺼짐 안내). */
export const features: typeof en = {
  music: {
    label: '음악',
    help: '끄면 재생을 멈추고 통화방에서 나가며, 음악 명령이 사라집니다.',
  },
  github: {
    label: 'GitHub 알림',
    help: 'PR·이슈 알림과 /remind. GitHub 페이지의 전체 스위치와 같습니다.',
  },
  audit: {
    label: '감사 로깅',
    help: '끄는 동안의 조작은 기록하지 않습니다(끈 사실은 남습니다).',
  },
  invites: { label: '초대 추적', help: '초대 코드별 유입과 기록 채널.' },
  memberMessages: {
    label: '입장·퇴장 메시지',
    help: '안내 채널에 보내는 입장·퇴장 메시지.',
  },
  joinRoles: { label: '입장 역할', help: '들어온 멤버에게 주는 역할.' },
  reactionRoles: {
    label: '리액션 롤',
    help: '끄면 패널은 그대로 두고 반응해도 역할을 주지 않습니다.',
  },
  loadFailed: '기능 상태를 불러오지 못했습니다.',
  setFailed: '바꾸지 못했습니다.',
};
