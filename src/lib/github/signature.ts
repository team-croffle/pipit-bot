import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';

/**
 * Verifies GitHub's `X-Hub-Signature-256` header against the raw request body.
 * The body must be the exact bytes received — re-serializing parsed JSON changes
 * the digest.
 */
export function verifyGithubSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expected = Buffer.from(`${SIGNATURE_PREFIX}${digest}`, 'utf8');
  const received = Buffer.from(signatureHeader, 'utf8');

  // WHY: timingSafeEqual throws on length mismatch. `expected` is a constant 71
  // bytes, so comparing lengths first reveals nothing about the secret.
  if (expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
