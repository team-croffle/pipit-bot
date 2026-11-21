import type { planned as en } from '../en/planned';

/** 계획된 기능의 자리를 잡아 두는 페이지. */
export const planned: typeof en = {
  calendar: {
    title: '캘린더 연동',
    description: 'Google 캘린더를 읽어 일정과 생일을 안내',
    points: [
      '팀 캘린더에 대한 읽기 권한만 요청',
      '생일자 알림',
      '회의 시작 전 알림',
      '제품 릴리즈 및 팀 자체 일정 알림',
    ],
  },
  polls: {
    title: '투표',
    description: 'croffle-polls 의견 취합 시스템 연동',
    points: [
      '대시보드와 디스코드에서 투표 생성',
      '익명 투표 지원',
      '진행 중인 투표 현황과 결과 조회',
      'croffle 일정관리 시스템 연동(v0.10.1)과 함께 정리됩니다',
    ],
  },
};
