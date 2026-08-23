import { QueueRepeatMode, useQueue, type Track } from 'discord-player';

import { getConfiguredGuild } from '../discord-guild.js';

const QUEUE_PREVIEW_LIMIT = 20;

export interface PlaybackTrackItem {
  index: number;
  title: string;
  duration: string | null;
}

export interface PlaybackCurrentTrack {
  title: string;
  durationMs: number;
  positionMs: number;
  progress: number;
  durationLabel: string;
  positionLabel: string;
}

export type PlaybackRepeatMode = 'off' | 'track' | 'queue' | 'autoplay';

export interface PlaybackState {
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

function repeatModeLabel(mode: number): PlaybackRepeatMode {
  switch (mode) {
    case QueueRepeatMode.TRACK:
      return 'track';
    case QueueRepeatMode.QUEUE:
      return 'queue';
    case QueueRepeatMode.AUTOPLAY:
      return 'autoplay';
    default:
      return 'off';
  }
}

function inactiveState(): PlaybackState {
  return {
    active: false,
    paused: false,
    repeatMode: 'off',
    voiceChannelId: null,
    voiceChannelName: null,
    current: null,
    tracks: [],
    pendingCount: 0,
    durationFormatted: null,
  };
}

function formatTrackTitle(track: Track): string {
  const title = track.title?.trim();
  return title || 'Unknown';
}

function getGuildQueue() {
  const guild = getConfiguredGuild();
  if (!guild) {
    return undefined;
  }

  return useQueue(guild.id);
}

export function getPlaybackState(): PlaybackState {
  const guild = getConfiguredGuild();
  const queue = getGuildQueue();
  const current = queue?.currentTrack;

  if (!guild || !queue || !current) {
    return inactiveState();
  }

  const timestamp = queue.node.getTimestamp();
  const voiceChannel = guild.members.me?.voice.channel;

  return {
    active: true,
    paused: queue.node.isPaused(),
    repeatMode: repeatModeLabel(queue.repeatMode),
    voiceChannelId: voiceChannel?.id ?? null,
    voiceChannelName: voiceChannel?.name ?? null,
    current: timestamp
      ? {
          title: formatTrackTitle(current),
          durationMs: timestamp.total.value,
          positionMs: timestamp.current.value,
          progress: timestamp.progress,
          durationLabel: timestamp.total.label,
          positionLabel: timestamp.current.label,
        }
      : {
          title: formatTrackTitle(current),
          durationMs: 0,
          positionMs: 0,
          progress: 0,
          durationLabel: current.duration ?? '—',
          positionLabel: '0:00',
        },
    tracks: queue.tracks.store.slice(0, QUEUE_PREVIEW_LIMIT).map((track, index) => ({
      index: index + 1,
      title: formatTrackTitle(track),
      duration: track.duration ?? null,
    })),
    pendingCount: queue.tracks.size,
    durationFormatted: queue.tracks.size > 0 ? queue.durationFormatted : null,
  };
}

export function pausePlayback(): PlaybackActionResult {
  const queue = getGuildQueue();
  const current = queue?.currentTrack;

  if (!queue || !current) {
    return { ok: false, message: 'No track is currently playing.' };
  }

  if (queue.node.isPaused()) {
    return { ok: false, message: 'The music is already paused.' };
  }

  if (queue.node.pause()) {
    return { ok: true, message: `Paused: ${formatTrackTitle(current)}` };
  }

  return { ok: false, message: 'Failed to pause the track.' };
}

export function resumePlayback(): PlaybackActionResult {
  const queue = getGuildQueue();
  const current = queue?.currentTrack;

  if (!queue || !current) {
    return { ok: false, message: 'No track is currently playing.' };
  }

  if (!queue.node.isPaused()) {
    return { ok: false, message: 'The music is not paused.' };
  }

  if (queue.node.resume()) {
    return { ok: true, message: `Resumed: ${formatTrackTitle(current)}` };
  }

  return { ok: false, message: 'Failed to resume the track.' };
}

export function skipPlayback(): PlaybackActionResult {
  const queue = getGuildQueue();
  const current = queue?.currentTrack;

  if (!queue) {
    return { ok: false, message: 'No active music session found.' };
  }

  if (!current) {
    return { ok: false, message: 'No track is currently playing.' };
  }

  if (queue.node.skip()) {
    return { ok: true, message: `Skipped: ${formatTrackTitle(current)}` };
  }

  return { ok: false, message: 'Failed to skip the track.' };
}
