export const VOLUME_LEVELS = {
  low: 30,
  mid: 50,
  high: 100,
} as const;

export type VolumeLevel = keyof typeof VOLUME_LEVELS;

export function isVolumeLevel(value: unknown): value is VolumeLevel {
  return typeof value === 'string' && Object.hasOwn(VOLUME_LEVELS, value);
}

export function volumeLevelOf(volume: number | null): VolumeLevel | null {
  if (volume === null) {
    return null;
  }

  const match = Object.entries(VOLUME_LEVELS).find(([, value]) => value === volume);
  return match ? (match[0] as VolumeLevel) : null;
}
