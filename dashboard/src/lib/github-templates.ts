import type { EmbedTemplate, GithubEventKey } from '@/types';

export const eventLabels: { key: GithubEventKey; label: string }[] = [
  { key: 'pullRequestOpened', label: 'PR 등록' },
  { key: 'pullRequestUpdated', label: 'PR 업데이트 (새 커밋 · rebase)' },
  { key: 'pullRequestMerged', label: 'PR 머지' },
  { key: 'pullRequestAssigned', label: 'PR 리뷰어 / 담당자 배정' },
  { key: 'issueOpened', label: 'Issue 등록' },
  { key: 'issueAssigned', label: 'Issue 담당자 배정' },
  { key: 'reviewSubmitted', label: 'PR 리뷰 제출' },
  { key: 'commentCreated', label: '코멘트 작성' },
];

/**
 * `{actor}` is a different person on every event, and that ambiguity is what made
 * "머지한 사람" render as the assignee. The variable stays one name; the editor spells
 * out who it will be for the event being edited.
 */
export const actorLabels: Record<GithubEventKey, string> = {
  pullRequestOpened: 'PR을 연 사람',
  pullRequestUpdated: '커밋을 푸시한 사람',
  pullRequestMerged: '머지를 실행한 사람',
  pullRequestAssigned: '배정 · 리뷰를 요청한 사람',
  issueOpened: 'Issue를 연 사람',
  issueAssigned: '배정한 사람',
  reviewSubmitted: '리뷰를 제출한 사람',
  commentCreated: '코멘트를 쓴 사람',
};

export const variableHints: Record<string, string> = {
  repo: '저장소 (owner/name)',
  pr_number: 'PR · Issue 번호',
  pr_url: 'PR · Issue 링크',
  pr_title: 'PR · Issue 제목',
  event: '이벤트 이름 (PR Merged, Approved …)',
  actor: '이벤트를 일으킨 사람',
  author: 'PR · Issue를 작성한 사람',
  assignee: '이번에 배정된 담당자 한 명',
  assignees: '담당자 전체',
  reviewers: '아직 응답하지 않은 리뷰 요청 대상',
  mentions: '이 알림으로 불러야 할 사람 (본인 제외)',
};

/** Sample values for the preview — shaped like what the bot actually substitutes. */
export const sampleValues: Record<string, string> = {
  repo: 'team-croffle/pipit-bot',
  pr_number: '42',
  pr_url: 'https://github.com/team-croffle/pipit-bot/pull/42',
  pr_title: '리마인더 문구를 임베드로',
  event: 'PR Merged',
  actor: '@머지한사람',
  author: '@작성자',
  assignee: '@담당자',
  assignees: '@담당자',
  reviewers: '@리뷰어',
  mentions: '@담당자',
};

// Mirrors renderTemplate on the bot: `{name}`, `{name|tail}`, `{name|tail|fallback}`,
// with `{}` inside a branch marking where the value goes. Kept in step by hand — the
// preview is the only thing that needs it, and shipping a parser to the browser just
// to draw one card is not worth an endpoint round trip per keystroke.
const PLACEHOLDER = /\{([a-z_]+)((?:\|(?:[^{}|]|\{\})*){0,2})\}/g;
const VALUE_SLOT = '{}';

export function renderTemplate(template: string, values: Record<string, string>): string {
  return template
    .replaceAll(PLACEHOLDER, (whole, name: string, tail: string) => {
      if (!(name in values)) {
        return whole;
      }

      const value = values[name] ?? '';
      const branches = tail ? tail.slice(1).split('|') : [];
      if (value) {
        if (branches.length === 0) {
          return value;
        }

        const branch = branches[0] ?? '';
        return branch.includes(VALUE_SLOT)
          ? branch.replaceAll(VALUE_SLOT, value)
          : `${value}${branch}`;
      }

      return branches.length > 1 ? (branches[1] ?? '') : '';
    })
    .trim();
}

/** Only the variables this event can fill, so the preview matches what will be sent. */
export function sampleFor(allowed: string[]): Record<string, string> {
  return Object.fromEntries(allowed.map((name) => [name, sampleValues[name] ?? '']));
}

export function emptyTemplate(): EmbedTemplate {
  return {
    content: '',
    title: '',
    description: '',
    fields: [],
    footer: '',
    color: '',
    showTimestamp: false,
  };
}

export function cloneTemplate(template: EmbedTemplate): EmbedTemplate {
  return { ...template, fields: template.fields.map((field) => ({ ...field })) };
}
