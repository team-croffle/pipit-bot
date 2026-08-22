import type { GuildNodeCreateOptions } from 'discord-player';

// WHY: play and playnext must share leave/filter flags. The extractor already
// emits 48 kHz s16le PCM; the default DSP chain reprocesses it and can stutter.
export const PLAYER_NODE_OPTIONS = {
  bufferingTimeout: 30_000,
  connectionTimeout: 30_000,
  leaveOnStop: true,
  leaveOnEmpty: true,
  leaveOnEnd: true,
  leaveOnEmptyCooldown: 30_000,
  leaveOnEndCooldown: 30_000,
  disableVolume: true,
  disableEqualizer: true,
  disableBiquad: true,
  disableResampler: true,
  disableFilterer: true,
  disableCompressor: true,
  disableReverb: true,
  disableSeeker: true,
} as const satisfies Omit<GuildNodeCreateOptions, 'metadata'>;
