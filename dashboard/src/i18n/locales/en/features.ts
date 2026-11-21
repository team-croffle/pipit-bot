/** The feature switches (settings page, overview, feature-off notice). */
export const features = {
  music: {
    label: 'Music',
    help: 'Switching it off stops playback, leaves the voice channel and removes the music commands.',
  },
  github: {
    label: 'GitHub notifications',
    help: 'PR and issue notifications and /remind. The same as the master switch on the GitHub page.',
  },
  audit: {
    label: 'Audit logging',
    help: 'Actions taken while it is off are not recorded (switching it off is).',
  },
  invites: { label: 'Invite tracking', help: 'Joins per invite code, and the record channel.' },
  memberMessages: {
    label: 'Join and leave messages',
    help: 'The join and leave messages sent to the welcome channel.',
  },
  joinRoles: { label: 'Join roles', help: 'Roles given to members who join.' },
  reactionRoles: {
    label: 'Reaction roles',
    help: 'Switching it off leaves the panels in place, but reacting gives no role.',
  },
  loadFailed: 'The feature states could not be loaded.',
  setFailed: 'Could not change it.',
};
