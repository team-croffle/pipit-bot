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
}

export interface DiscordRole {
  id: string;
  name: string;
}

export interface BotRuntimeConfig {
  prefix: string;
  musicChannelIds: string[];
  role?: string;
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
