import { t } from '@/i18n';

/** The users page's data (GET /api/users) and its labels. */

export interface DashboardUser {
  id: string;
  name: string;
  username: string | null;
  githubLogin: string | null;
  discordUserId: string | null;
  groups: string[];
  idpGroups: string[];
  admin: boolean;
  adminByProvider: boolean;
  methods: string[];
  createdAt: string;
}

const METHOD_NAMES: Record<string, string> = {
  oidc: 'SSO',
  discord: 'Discord',
  github: 'GitHub',
};

/** A sign-in method's name, in the current language (only "password" is a word). */
export function methodLabel(method: string): string {
  return method === 'password' ? t('users.method.password') : (METHOD_NAMES[method] ?? method);
}

/** Same rule as the server (lib/auth/password-policy.ts), for a hint before saving. */
export function passwordHint(password: string): string | null {
  if (password.length < 8) {
    return t('users.passwordLength');
  }
  const kinds = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z\d]/].filter((kind) => kind.test(password));
  return kinds.length < 2 ? t('users.passwordKinds') : null;
}
