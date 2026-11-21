import type { embed as en } from '../en/embed';

/** 임베드 편집기, 미리보기, 이모지 선택기. */
export const embed: typeof en = {
  content: '알림 줄 (임베드 위 평문)',
  contentHint:
    '디스코드는 임베드 안의 멘션으로 알림을 울리지 않습니다. 실제로 사람을 부르려면 멘션은 이 줄에 있어야 합니다.',
  emojiHint: '서버 이모지는 {code} 으로 들어가고, 발송할 때 실제 이모지로 바뀝니다.',
  emojiName: ':이름:',
  title: '제목',
  color: '색',
  clear: '지우기',
  description: '내용',
  fields: '필드',
  addField: '필드 추가',
  noFields: '필드가 없습니다. 인라인으로 두면 여러 개가 한 줄에 나란히 놓입니다.',
  fieldName: '이름',
  fieldValue: '값',
  fieldNameN: '필드 {n} 이름',
  fieldValueN: '필드 {n} 값',
  inline: '인라인',
  deleteFieldN: '필드 {n} 삭제',
  footer: '꼬리말',
  timestamp: '시간 표시',
  previewEmpty: '아직 보낼 내용이 없습니다 — 문구를 채우면 여기에 미리보기가 나타납니다.',
  previewNote:
    '{code} 은 발송할 때 서버 이모지로 바뀝니다. 알림 줄·내용·필드 값은 디스코드 마크다운으로 표시되고, 제목·필드 이름·꼬리말은 디스코드가 마크다운을 렌더하지 않아 쓴 그대로 나옵니다.',
  spoiler: '스포일러',
  emoji: {
    insert: '이모지 넣기',
    search: '이모지 검색…',
    server: '서버 이모지',
    loading: '불러오는 중…',
    serverFailed: '서버 이모지를 불러오지 못했습니다.',
    noResults: '검색 결과가 없습니다.',
    noCustom: '이 서버에는 커스텀 이모지가 없습니다.',
    bot: '봇 이모지',
    botHint: '— 봇이 있는 모든 서버에서 사용',
    standard: '기본 이모지',
    truncated: '상위 {limit}개만 표시합니다 — 검색어를 더 좁혀 보세요.',
  },
};
