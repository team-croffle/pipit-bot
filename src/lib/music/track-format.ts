export function formatDurationFromSeconds(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * The share of a track played, 0–1.
 *
 * WHY not the player's own `progress`: that is a rounded percentage (0–100), and both the
 * banner and the dashboard read this field as a share — every track past 1% showed as
 * finished on the remote and as empty on the dashboard.
 */
export function shareOf(positionMs: number, durationMs: number): number {
  if (!(durationMs > 0) || !(positionMs > 0)) {
    return 0;
  }
  return Math.min(positionMs / durationMs, 1);
}
