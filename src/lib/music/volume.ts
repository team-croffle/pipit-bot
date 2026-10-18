/**
 * The bot's volume as a number: 0–200, where 100 is the file as prepared and anything
 * above boosts it. Applied to the samples as they stream (pcm-volume.ts).
 */
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 200;
export const DEFAULT_VOLUME = 100;
/** One press of the remote's volume buttons. */
export const REMOTE_VOLUME_STEP = 10;

/** The three levels of v0.7.0–v0.7.5-rc.2, as numbers that sound the same. */
const LEGACY_LEVELS: Record<string, number> = { low: 30, mid: 50, high: 100 };

export function isVolume(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_VOLUME &&
    value <= MAX_VOLUME
  );
}

export function clampVolume(value: number): number {
  return Math.min(Math.max(Math.round(value), MIN_VOLUME), MAX_VOLUME);
}

/** A stored or requested volume: a number in range, or one of the old level names. */
export function volumeFrom(value: unknown): number | null {
  if (isVolume(value)) {
    return value;
  }
  return typeof value === 'string' && Object.hasOwn(LEGACY_LEVELS, value)
    ? LEGACY_LEVELS[value]!
    : null;
}
