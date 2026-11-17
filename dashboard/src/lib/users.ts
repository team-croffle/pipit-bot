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

export const METHOD_LABELS: Record<string, string> = {
  password: '비밀번호',
  oidc: 'SSO',
  discord: 'Discord',
  github: 'GitHub',
};

/** Same rule as the server (lib/auth/password-policy.ts), for a hint before saving. */
export function passwordHint(password: string): string | null {
  if (password.length < 8) {
    return '8자 이상이어야 합니다.';
  }
  const kinds = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z\d]/].filter((kind) => kind.test(password));
  return kinds.length < 2 ? '대문자·소문자·숫자·기호 중 두 종류 이상을 섞어 주세요.' : null;
}
