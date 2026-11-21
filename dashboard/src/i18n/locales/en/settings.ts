/** The settings page and its cards. */
export const settings = {
  title: 'Settings',
  description: 'Defaults, channels and per-feature switches',
  readOnly: 'This account is read-only — settings cannot be changed.',
  commandChannels: 'Command channel limits',
  commandChannelsBody:
    "Set per feature, on each feature's page. For music, set it on the {link}'s playback options tab.",
  musicPage: 'music page',
  featuresTitle: 'Per-feature switches',
  featuresDescription:
    'Switch features on and off one by one. Switching one off also removes its Discord commands (Discord can take a moment to catch up).',
  plannedCalendar: 'Calendar integration',
  plannedPolls: 'Polls integration',
  auditTitle: 'Audit log',
  auditDescription:
    'By default a music record only says who used which feature. Neither the track title nor the request is kept.',
  musicRequests: 'Record music requests',
  musicRequestsHelp:
    'Switched on, track preparation records from then on also keep the request and the prepared track title. Switched off, only feature use is kept again; records already made do not change.',
  auditOff: 'Audit logging is off, so nothing is recorded right now.',
  auditLoadFailed: 'The audit settings could not be loaded.',
  auditSaveFailed: 'The audit settings could not be saved.',
  rssTitle: 'Blog RSS notifications',
  rssDescription: 'Gathers new posts from the registered blogs into one channel, with links.',
  rssBlog: 'Blog',
  rssUrl: 'RSS URL',
  rssStatus: 'Status',
  rssEmpty: 'No feeds registered.',
  rssAdd: 'Add feed',
  signIn: {
    title: 'Sign-in methods',
    description:
      'The methods the sign-in page offers. One must always stay on. If you are locked out, fix {file} on the server and restart.',
    fallback:
      'The settings file could not be used (damaged, or everything off), so every configured method started switched on. Saving here writes the file again.',
    unavailable: 'Unavailable — {reason}',
    lastOn: 'This is the last method switched on, so it cannot be switched off.',
    loadFailed: 'The sign-in methods could not be loaded.',
    saveFailed: 'Could not save.',
    password: { label: 'Password', help: 'Accounts an admin created on the users page' },
    oidc: {
      label: 'SSO (OIDC)',
      help: 'Sign in with the configured identity provider (Dex or similar)',
    },
    discord: { label: 'Discord', help: 'Server members only — created as a viewer the first time' },
    github: { label: 'GitHub', help: 'Only people whose user has a GitHub login registered' },
  },
};
