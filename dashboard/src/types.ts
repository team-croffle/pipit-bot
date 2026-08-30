export interface DashboardIdentity {
  user: string | null;
  groups: string[];
  canWriteSettings: boolean;
  canControlPlayback: boolean;
}

export type JobStatus = 'pending' | 'ready' | 'failed';

export interface TrackMeta {
  title: string;
  durationSec?: number;
  file: string;
}

export interface JobRecord {
  jobId: string;
  query: string;
  status: JobStatus;
  track?: TrackMeta;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HealthResponse {
  status: string;
}

export interface JobsResponse {
  jobs: JobRecord[];
}

export interface ReactionRoleMapping {
  channelId: string;
  messageId: string;
  emoji: string;
  roleId: string;
}

export interface GuildEventSettings {
  logChannelId: string | null;
  joinMessages: string[];
  leaveMessages: string[];
  joinRoleIds: string[];
  reactionRoles: ReactionRoleMapping[];
}

export interface DiscordChannel {
  id: string;
  name: string;
  /** The category the channel sits in, or null when it sits above all of them. */
  category: string | null;
  /** False when the bot cannot actually post there. */
  canPost: boolean;
}

export interface GithubDelivery {
  at: string;
  repo: string;
  event: string;
  outcome: 'sent' | 'failed' | 'skipped';
  detail?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
}

export interface DiscordMember {
  id: string;
  name: string;
  /** Discord CDN URL; server avatar when set, otherwise the account avatar. */
  avatarUrl?: string;
}

export interface GithubEventToggles {
  pullRequestOpened: boolean;
  pullRequestUpdated: boolean;
  pullRequestAssigned: boolean;
  pullRequestChangesRequested: boolean;
  pullRequestApproved: boolean;
  pullRequestMerged: boolean;
  issueOpened: boolean;
  issueAssigned: boolean;
  /** Closed as completed. */
  issueResolved: boolean;
  /** Closed as not planned or duplicate. */
  issueClosed: boolean;
  issueReopened: boolean;
  commentCreated: boolean;
}

/** `null` on a field means "inherit the global default". */
export interface GithubRepoRule {
  repo: string;
  channelId: string | null;
  events: GithubEventToggles | null;
}

export interface GithubAccountMapping {
  githubLogin: string;
  discordUserId: string;
}

export type GithubEventKey = keyof GithubEventToggles;

export interface EmbedFieldTemplate {
  name: string;
  value: string;
  inline: boolean;
}

export interface EmbedTemplate {
  /** Plain text above the embed — the only place a mention actually pings. */
  content: string;
  title: string;
  description: string;
  fields: EmbedFieldTemplate[];
  footer: string;
  /** , or '' to leave the embed uncoloured. */
  color: string;
  showTimestamp: boolean;
}

/** A missing key means the event uses its built-in default. */
export type GithubEventTemplates = Partial<Record<GithubEventKey, EmbedTemplate>>;

export interface GithubNotifySettings {
  enabled: boolean;
  channelId: string | null;
  events: GithubEventToggles;
  eventTemplates: GithubEventTemplates;
  repos: GithubRepoRule[];
  accounts: GithubAccountMapping[];
}

/** What the server falls back to, and what each event is allowed to reference. */
export interface GithubTemplateDefaults {
  templates: Record<GithubEventKey, EmbedTemplate>;
  variables: Record<GithubEventKey, string[]>;
}

export interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  url: string;
  /** What has to be typed into a message for the emoji to render. */
  markup: string;
}

export interface BotRuntimeConfig {
  prefix: string;
  musicChannelIds: string[];
}

export interface PlaybackCurrentTrack {
  title: string;
  durationMs: number;
  positionMs: number;
  progress: number;
  durationLabel: string;
  positionLabel: string;
}

export interface PlaybackTrackItem {
  index: number;
  title: string;
  duration: string | null;
}

export type PlaybackRepeatMode = 'off' | 'track' | 'queue' | 'autoplay';
export type PlaybackStatus = 'loading' | 'playing' | 'paused' | 'ready' | 'idle';

export interface PlaybackState {
  status: PlaybackStatus;
  canEnqueue: boolean;
  active: boolean;
  paused: boolean;
  repeatMode: PlaybackRepeatMode;
  voiceChannelId: string | null;
  voiceChannelName: string | null;
  current: PlaybackCurrentTrack | null;
  tracks: PlaybackTrackItem[];
  pendingCount: number;
  durationFormatted: string | null;
}

export interface PlaybackActionResult {
  ok: boolean;
  message: string;
}
