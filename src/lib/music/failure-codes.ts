/**
 * Why a music job failed, as a short code the worker may send with its failure
 * callback (docs/music-backend.md). The code is optional — a worker that sends only
 * `error` still works — and the bot adds two of its own: `unavailable` when the
 * worker could not be reached, `timeout` when it gave up waiting.
 */
export const FAILURE_CODES = [
  'not-found',
  'rejected',
  'unavailable',
  'timeout',
  'internal',
] as const;

export type FailureCode = (typeof FAILURE_CODES)[number];

const CODE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * Accepts any short lowercase code, not only the known ones: a worker newer than this
 * bot may send one it does not know yet, and keeping it beats dropping it. Anything
 * else is ignored rather than stored.
 */
export function readFailureCode(value: unknown): string | undefined {
  return typeof value === 'string' && CODE_PATTERN.test(value) ? value : undefined;
}

const DESCRIPTIONS: Record<FailureCode, string> = {
  'not-found': 'The music worker found nothing for that.',
  rejected: 'The music worker refused that request.',
  unavailable: 'The music worker is unavailable.',
  timeout: 'Preparing the track took too long.',
  internal: 'The music worker ran into an error.',
};

function isKnown(code: string): code is FailureCode {
  return (FAILURE_CODES as readonly string[]).includes(code);
}

/** The sentence a command answers with: the code's meaning, then the worker's own words. */
export function describeFailure(code: string | undefined, error: string | undefined): string {
  const base = code && isKnown(code) ? DESCRIPTIONS[code] : undefined;
  if (!base) {
    return error ?? 'Failed to prepare track.';
  }

  return error && error !== base ? `${base} (${error})` : base;
}
