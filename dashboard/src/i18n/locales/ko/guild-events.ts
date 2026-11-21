import type { guildEvents as en } from '../en/guild-events';

/** 초대 페이지가 쓰는 멤버 이벤트 설정(use-guild-events). */
export const guildEvents: typeof en = {
  loadFailed: '설정을 불러오지 못했습니다.',
  saved: '저장했습니다.',
  saveFailed: '저장하지 못했습니다.',
};
