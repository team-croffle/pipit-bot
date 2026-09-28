/**
 * What a person types to name a pull request or issue, turned into a repository and
 * a number.
 *
 * Accepted: `owner/name #12`, `owner/name 12`, `name #12` (a repository name alone),
 * and a pull request or issue URL. Anything else is refused before any request is
 * made — the repository goes into an API path, so only the characters GitHub itself
 * allows get through.
 *
 * WHY a name alone is looked up rather than guessed: the only list worth matching is
 * the repositories the App is installed on, and a name that fits several of them must
 * not ping the people of whichever one happened to come first. Exactly one match is
 * used; otherwise the person is told why, and which repositories they could mean.
 */

import { container } from '@sapphire/framework';

import { listInstallationRepositories } from './app-client.js';
import { recordDelivery } from './delivery-log.js';
import { remindItem, type ItemReference, type ReminderResult } from './remind.js';
import { getGithubNotifySettings } from './settings.js';

/** Either a full `owner/name` or, when the owner was left out, just the name. */
export type ParsedReference =
  | { repo: string; name?: undefined; number: number }
  | { repo?: undefined; name: string; number: number };

const PART = '[\\w.-]{1,100}';
const REFERENCE = new RegExp(`^(${PART}(?:/${PART})?)\\s+#?(\\d{1,9})$`);
const URL_REFERENCE = new RegExp(
  `^(?:https?://)?(?:www\\.)?github\\.com/(${PART}/${PART})/(?:pull|issues)/(\\d{1,9})(?:[/?#].*)?$`,
  'i',
);

export function parseItemReference(text: string): ParsedReference | undefined {
  const trimmed = text.trim();
  const match = URL_REFERENCE.exec(trimmed) ?? REFERENCE.exec(trimmed);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  const number = Number(match[2]);
  if (!Number.isSafeInteger(number) || number < 1) {
    return undefined;
  }

  const target = match[1].toLowerCase();
  return target.includes('/') ? { repo: target, number } : { name: target, number };
}

type Resolution = { ok: true; reference: ItemReference } | { ok: false; detail: string };

/** Finds the one installed repository a bare name can mean. */
async function resolve(parsed: ParsedReference): Promise<Resolution> {
  if (parsed.repo) {
    return { ok: true, reference: { repo: parsed.repo, number: parsed.number } };
  }

  const config = container.config.githubApp;
  if (!config) {
    return {
      ok: false,
      detail: `Without GitHub App credentials a repository name alone cannot be looked up — use owner/${parsed.name}.`,
    };
  }

  let installed: string[];
  try {
    installed = (await listInstallationRepositories(config)).map((item) => item.fullName);
  } catch (error) {
    container.logger.warn('[github] repository list failed while resolving a name:', error);
    return {
      ok: false,
      detail: `Could not read the installed repositories — use owner/${parsed.name}.`,
    };
  }

  const matches = installed.filter(
    (fullName) => fullName.split('/')[1]?.toLowerCase() === parsed.name,
  );
  const [only] = matches;
  if (matches.length === 1 && only) {
    return { ok: true, reference: { repo: only.toLowerCase(), number: parsed.number } };
  }

  if (matches.length === 0) {
    return {
      ok: false,
      detail: `No installed repository is named ${parsed.name} — use owner/name.`,
    };
  }

  return {
    ok: false,
    detail: `${parsed.name} matches several repositories (${matches.join(', ')}) — use owner/name.`,
  };
}

/** A reminder for whatever the person typed, with the repository it resolved to. */
export async function remindReference(
  parsed: ParsedReference,
): Promise<ReminderResult & { repo: string }> {
  const typed = parsed.repo ?? parsed.name;
  if (!getGithubNotifySettings().enabled) {
    return {
      repo: typed,
      outcome: 'skipped',
      detail: 'GitHub notifications are switched off.',
      targets: 0,
    };
  }

  const resolution = await resolve(parsed);
  if (!resolution.ok) {
    recordDelivery(typed, 'Reminder', 'skipped', resolution.detail);
    return { repo: typed, outcome: 'skipped', detail: resolution.detail, targets: 0 };
  }

  return { repo: resolution.reference.repo, ...(await remindItem(resolution.reference)) };
}
