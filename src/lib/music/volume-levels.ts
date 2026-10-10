export const VOLUME_LEVELS = {
  low: 30,
  mid: 50,
  high: 100,
} as const;

export type VolumeLevel = keyof typeof VOLUME_LEVELS;

export function isVolumeLevel(value: unknown): value is VolumeLevel {
  return typeof value === 'string' && Object.hasOwn(VOLUME_LEVELS, value);
}
