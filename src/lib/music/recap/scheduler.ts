import { container } from '@sapphire/framework';

import { getConfiguredGuild } from '../../discord-guild.js';
import { isEnabled } from '../../features.js';
import { nextMonthStart, previousPeriods } from './periods.js';
import { isPosted, postRecap } from './post.js';
import { getRecapSettings } from './settings.js';

/**
 * Posts each month's recap when the month is over, and each year's on the 1st of January.
 *
 * WHY catch up rather than only fire on time: the bot may be down at midnight. At start
 * and at every boundary, the month and the year just ended are posted if they have not
 * been — only those two, so a long outage never floods the channel. The timer is also
 * re-armed every few hours, so a changed time zone takes effect without a restart.
 */

const REARM_MS = 6 * 60 * 60 * 1000;
const AFTER_BOUNDARY_MS = 5_000;

let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> | undefined;

export async function catchUpRecaps(now = new Date()): Promise<string[]> {
  const settings = getRecapSettings();
  const guild = getConfiguredGuild();
  if (!settings.post || !settings.channelId || !guild || !isEnabled('music')) {
    return [];
  }

  const due = previousPeriods(now, settings.timeZone);
  const posted: string[] = [];
  for (const period of [due.month, due.year]) {
    if (await isPosted(guild.id, period.id)) {
      continue;
    }
    const outcome = await postRecap(guild.id, period);
    if (outcome.ok) {
      posted.push(period.id);
    }
  }
  return posted;
}

function run(): void {
  running ??= catchUpRecaps()
    .then((posted) => {
      if (posted.length > 0) {
        container.logger.info(`[recap] posted ${posted.join(', ')}`);
      }
    })
    .catch((error: unknown) => container.logger.warn('[recap] could not post recaps:', error))
    .finally(() => {
      running = undefined;
    });
}

function arm(): void {
  const now = Date.now();
  const boundary = nextMonthStart(new Date(now), getRecapSettings().timeZone).getTime();
  const untilBoundary = boundary - now + AFTER_BOUNDARY_MS;
  timer = setTimeout(
    () => {
      if (untilBoundary <= REARM_MS) {
        run();
      }
      arm();
    },
    Math.min(untilBoundary, REARM_MS),
  );
  timer.unref();
}

/** At ready: posts what is overdue, then waits for the next boundary. */
export function startRecapSchedule(): void {
  if (timer) {
    clearTimeout(timer);
  }
  run();
  arm();
}
