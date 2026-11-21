import type { pickers as en } from '../en/pickers';

/** 채널·통화방·역할·멤버 선택기. */
export const pickers: typeof en = {
  uncategorized: '카테고리 없음',
  choose: '선택',
  cannotPost: ' — 봇이 글을 쓸 수 없음',
  voicePlaceholder: '통화방 선택',
  noVoice: '이 서버에 통화방이 없습니다.',
  voiceMembers: '{count}명',
  cannotJoin: ' — 봇이 참여할 수 없음',
  roleId: '역할 ID',
  rolePlaceholder: '역할 선택',
  noRoles: '가져온 역할이 없습니다 — 직접 입력하세요.',
  memberPlaceholder: '멤버 선택',
  noMembers: '가져온 멤버가 없습니다.',
};
