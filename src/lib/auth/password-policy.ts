/**
 * What a dashboard password must be (2026-11-18, the team): at least 8 characters, at
 * most 128, mixing at least two kinds of upper-case letters, lower-case letters, digits
 * and other characters. Checked wherever a password is set — the first-admin environment,
 * the users page — since sign-up is closed and no Better Auth endpoint sets one.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const KINDS = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z\d]/];

/** Null when the password is good, otherwise why not (English, shown on the dashboard). */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `A password needs at least ${PASSWORD_MIN} characters.`;
  }
  if (password.length > PASSWORD_MAX) {
    return `A password can have at most ${PASSWORD_MAX} characters.`;
  }
  if (KINDS.filter((kind) => kind.test(password)).length < 2) {
    return 'A password needs at least two of: upper-case letters, lower-case letters, digits, symbols.';
  }
  return null;
}
