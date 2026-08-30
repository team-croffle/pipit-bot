import type { EmbedTemplate, GithubEventKey, GithubEventToggles } from '@/types';

/** A pull request's life, then an issue's — the order the server lists them in. */
export const eventLabels: { key: GithubEventKey; label: string; group: string }[] = [
  { key: 'pullRequestOpened', label: 'PR 등록', group: 'PR' },
  { key: 'pullRequestUpdated', label: 'PR 업데이트 (새 커밋 · rebase)', group: 'PR' },
  { key: 'pullRequestAssigned', label: 'PR 리뷰어 / 담당자 배정', group: 'PR' },
  { key: 'pullRequestChangesRequested', label: 'PR 변경 요청', group: 'PR' },
  { key: 'pullRequestApproved', label: 'PR 승인 (Approved)', group: 'PR' },
  { key: 'pullRequestMerged', label: 'PR 머지', group: 'PR' },
  { key: 'pullRequestClosed', label: 'PR 닫음 (머지 안 함)', group: 'PR' },
  { key: 'issueOpened', label: 'Issue 등록', group: 'Issue' },
  { key: 'issueAssigned', label: 'Issue 담당자 배정', group: 'Issue' },
  { key: 'issueResolved', label: 'Issue 해결 (Completed)', group: 'Issue' },
  { key: 'issueClosed', label: 'Issue 닫음 (Not planned · Duplicate)', group: 'Issue' },
  { key: 'issueReopened', label: 'Issue 재오픈', group: 'Issue' },
  { key: 'commentCreated', label: '코멘트 작성 (리뷰 코멘트 포함)', group: '공통' },
];

/**
 * `{actor}` is a different person on every event, and that ambiguity is what made
 * "머지한 사람" render as the assignee. The variable stays one name; the editor spells
 * out who it will be for the event being edited.
 */
export const actorLabels: Record<GithubEventKey, string> = {
  pullRequestOpened: 'PR을 연 사람',
  pullRequestUpdated: '커밋을 푸시한 사람',
  pullRequestAssigned: '배정 · 리뷰를 요청한 사람',
  pullRequestChangesRequested: '변경을 요청한 리뷰어',
  pullRequestApproved: '승인한 리뷰어',
  pullRequestMerged: '머지를 실행한 사람',
  pullRequestClosed: 'PR을 닫은 사람',
  issueOpened: 'Issue를 연 사람',
  issueAssigned: '배정한 사람',
  issueResolved: 'Issue를 해결 처리한 사람',
  issueClosed: 'Issue를 닫은 사람',
  issueReopened: 'Issue를 다시 연 사람',
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

/**
 * Sample values for the preview — shaped like what the bot actually substitutes.
 *
 * `{event}` and the subject vary per event: with one fixed set, every row in the
 * summary table rendered the same sentence, which made the table useless for telling
 * the events apart.
 */
const BASE_SAMPLE: Record<string, string> = {
  repo: 'team-croffle/pipit-bot',
  pr_number: '42',
  actor: '@행위자',
  author: '@작성자',
  assignee: '@담당자',
  assignees: '@담당자',
  reviewers: '@리뷰어',
  mentions: '@담당자',
};

const PULL_SAMPLE = {
  pr_url: 'https://github.com/team-croffle/pipit-bot/pull/42',
  pr_title: '리마인더 문구를 임베드로',
};

const ISSUE_SAMPLE = {
  pr_url: 'https://github.com/team-croffle/pipit-bot/issues/42',
  pr_title: '알림이 두 번 오는 문제',
};

/** Who `{actor}` is, phrased short enough for a sample value. */
const ACTOR_SAMPLE: Partial<Record<GithubEventKey, string>> = {
  pullRequestOpened: '@등록자',
  pullRequestUpdated: '@푸시한사람',
  pullRequestAssigned: '@요청자',
  pullRequestChangesRequested: '@리뷰어',
  pullRequestApproved: '@리뷰어',
  pullRequestMerged: '@머지한사람',
  pullRequestClosed: '@닫은사람',
  issueOpened: '@등록자',
  issueAssigned: '@배정한사람',
  issueResolved: '@해결한사람',
  issueClosed: '@닫은사람',
  issueReopened: '@다시연사람',
  commentCreated: '@작성자',
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
export function sampleFor(
  event: GithubEventKey,
  allowed: string[],
  label: string,
): Record<string, string> {
  const subject = event.startsWith('issue') ? ISSUE_SAMPLE : PULL_SAMPLE;
  const values: Record<string, string> = {
    ...BASE_SAMPLE,
    ...subject,
    event: label,
    actor: ACTOR_SAMPLE[event] ?? BASE_SAMPLE.actor ?? '',
  };

  return Object.fromEntries(allowed.map((name) => [name, values[name] ?? '']));
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

/** The label list folded into its groups, for rendering twelve checkboxes readably. */
export const eventGroups: { name: string; events: typeof eventLabels }[] = [
  ...new Set(eventLabels.map((event) => event.group)),
].map((name) => ({ name, events: eventLabels.filter((event) => event.group === name) }));

/** Derived from the label list, so a new event cannot be missed here. */
export function emptyToggles(): GithubEventToggles {
  return Object.fromEntries(
    eventLabels.map((event) => [event.key, false]),
  ) as unknown as GithubEventToggles;
}
