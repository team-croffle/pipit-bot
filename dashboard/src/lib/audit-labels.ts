import type { AuditCategory, AuditEntry } from '@/types';

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  dashboard: '대시보드',
  music: '음악',
  command: '명령',
  github: 'GitHub',
  member: '멤버',
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as AuditCategory[];

export const OUTCOME_LABEL: Record<AuditEntry['outcome'], string> = {
  ok: '성공',
  failed: '실패',
  skipped: '건너뜀',
};

const ACTION_LABEL: Record<string, string> = {
  'music.pause': '일시정지',
  'music.resume': '재개',
  'music.skip': '다음 곡',
  'music.stop': '정지',
  'music.clear': '대기열 비우기',
  'music.loop': '반복 설정',
  'music.remove': '곡 빼기',
  'music.skipto': '이 곡으로 건너뛰기',
  'music.move': '순서 바꾸기',
  'music.shuffle': '대기열 섞기',
  'music.back': '이전 곡',
  'music.volume': '볼륨',
  'music.join': '통화방 참여',
  'music.leave': '통화방 나가기',
  'music.enqueue': '곡 추가',
  'music.cancel': '작업 취소',
  'music.retry': '작업 다시 시도',
  'music.search': '곡 검색',
  'playlist.create': '재생목록 만들기',
  'playlist.rename': '재생목록 이름 바꾸기',
  'playlist.delete': '재생목록 지우기',
  'playlist.add': '재생목록에 담기',
  'playlist.remove': '재생목록에서 빼기',
  'playlist.move': '재생목록 순서 바꾸기',
  'playlist.play': '재생목록 재생',
  'playlist.import': '재생목록 가져오기',
  'music.request': '채널에 곡 요청',
  'music.ready': '곡 준비 완료',
  'music.failed': '곡 준비 실패',
  'settings.update': '설정 저장',
  'member-events.update': '입장·퇴장 설정 저장',
  'github-notify.update': 'GitHub 알림 설정 저장',
  'github.remind': '다시 알리기',
  'reaction-roles.update': '리액션 롤 저장',
  'reaction-roles.publish': '리액션 롤 게시',
  'member.join': '입장',
  'member.leave': '퇴장',
};

const REMOTE_LABEL: Record<string, string> = {
  'music:play': '재생 창',
  'music:pause': '일시정지',
  'music:resume': '재개',
  'music:skip': '다음 곡',
  'music:stop': '정지',
  'music:loop': '반복',
  'music:vol-down': '볼륨 내리기',
  'music:vol-up': '볼륨 올리기',
  'music:play-modal': '재생 창에서 요청',
  'music:search': '검색 창',
  'music:search-modal': '검색 창에서 검색',
  'search:pick': '검색 결과 고르기',
  'search:play': '검색 결과 재생',
  'search:next': '검색 결과 다음에 재생',
  'search:save': '검색 결과 재생목록에 담기',
  'music:playlists': '재생목록 창',
  'playlist:pick': '재생목록 고르기',
  'playlist:play': '재생목록 재생',
  'playlist:shuffle': '재생목록 섞어서 재생',
  'playlist:save': '재생목록에 담기',
  'playlist:delete': '재생목록 지우기',
};

/** A person-readable name for an action; unknown actions are shown as recorded. */
export function actionLabel(action: string): string {
  if (ACTION_LABEL[action]) {
    return ACTION_LABEL[action];
  }

  const control = /^(button|modal|select):(.+)$/.exec(action);
  if (control) {
    const name = REMOTE_LABEL[control[2]!];
    return name ? `리모컨 · ${name}` : action;
  }

  return action;
}
