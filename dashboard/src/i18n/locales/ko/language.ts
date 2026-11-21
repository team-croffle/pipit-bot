import type { language as en } from '../en/language';

export const language: typeof en = {
  cardTitle: '언어',
  cardDescription:
    '대시보드와 봇 메시지의 기본 언어입니다. 기능마다 그 페이지에서 메시지 언어를 따로 고를 수 있고, 혼자만 보는 응답은 각자의 디스코드 언어를 따릅니다.',
  dashboardDefault: '대시보드 기본 언어',
  eachBrowser: '각자의 브라우저 언어',
  dashboardHint: '개인이 고른 언어가 있으면 그것이 먼저입니다.',
  messagesDefault: '봇 메시지 기본 언어',
  messagesHint: '음악 배너, GitHub 알림, 입장·퇴장 기록, 결산처럼 채널에 올라가는 메시지입니다.',
  messageLanguage: '메시지 언어',
  followDefault: '기본 따름',
  followDefaultIs: '기본 따름 ({language})',
  ariaFeature: '{feature} 메시지 언어',
  loadFailed: '언어 설정을 불러오지 못했습니다.',
  notLoaded: '언어 설정을 아직 불러오지 못했습니다.',
  saveFailed: '저장하지 못했습니다.',
};
