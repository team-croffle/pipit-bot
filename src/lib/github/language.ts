import type { Language } from '../i18n/index.js';
import { messageLanguage } from '../i18n/settings.js';

/**
 * GitHub notifications in the GitHub feature's language (i18n/settings.ts).
 *
 * WHY only the built-in words: a template the operator wrote is the operator's text and is
 * sent as written. What the bot itself supplies — the `{event}` label ("PR Merged") and the
 * field names of the built-in templates — follows the language. So does `{event}` inside an
 * operator's template, since it is a value the bot fills in (v0.8.3 notes say so).
 * The delivery log keeps the English label.
 *
 * Keyed by the English text, so default-templates.ts and template.ts state their words once.
 */
const KOREAN: Record<string, string> = {
  // `{event}` labels
  'PR Open': 'PR 열림',
  'PR Updated': 'PR 업데이트',
  'PR Assigned': 'PR 배정',
  'Review Requested': '리뷰 요청',
  'Changes Requested': '변경 요청',
  Approved: '승인',
  'PR Merged': 'PR 병합',
  'PR Closed': 'PR 닫힘',
  'PR Reopened': 'PR 다시 열림',
  'PR Reminder': 'PR 리마인더',
  'Issue Open': '이슈 열림',
  'Issue Assigned': '이슈 배정',
  'Issue Resolved': '이슈 해결',
  'Issue Closed': '이슈 닫힘',
  'Issue Reopened': '이슈 다시 열림',
  'Issue Reminder': '이슈 리마인더',
  Comment: '댓글',
  Reviewed: '리뷰함',
  Reminder: '리마인더',
  // field names of the built-in templates
  'Opened by': '연 사람',
  'Pushed by': '푸시한 사람',
  'Merged by': '병합한 사람',
  Author: '작성자',
  'Closed by': '닫은 사람',
  'Reopened by': '다시 연 사람',
  Assigned: '담당자',
  'Assigned by': '배정한 사람',
  Reviewer: '리뷰어',
  Reviewers: '리뷰어',
  Assignees: '담당자',
  'Requested by': '요청한 사람',
  'Resolved by': '해결한 사람',
  'Comment by': '댓글 단 사람',
};

/** The bot's own English word in `language`; anything else as it is. */
export function githubText(text: string, language: Language): string {
  return language === 'ko' ? (KOREAN[text] ?? text) : text;
}

export function githubLanguage(): Language {
  return messageLanguage('github');
}

/** Every English word this table covers — for local checks. */
export const GITHUB_TRANSLATED = Object.keys(KOREAN);
