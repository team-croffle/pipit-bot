import { container } from '@sapphire/framework';

import { startApiServer } from './api/server.js';
import { startAuditRetention } from './lib/audit/retention.js';
import { CustomClient } from './lib/client.js';
import { loadFeatures } from './lib/features.js';
import { loadTrackedMessages } from './lib/github/message-tracker.js';
import { loadGithubNotifySettings } from './lib/github/settings.js';
import { loadGuildEventSettings } from './lib/guild-event-settings.js';
import { loadInviteStats } from './lib/invite-stats.js';
import { loadPlaybackOptions } from './lib/music/playback-options.js';
import { loadPlaylists } from './lib/music/playlists/store.js';
import { startCapabilityWatch } from './lib/music/worker-capabilities.js';
import { loadReactionRoleSettings } from './lib/reaction-roles/settings.js';
import { env } from './lib/setup.js';

const client = new CustomClient(env);

const main = async () => {
  try {
    await loadGuildEventSettings();
    await loadGithubNotifySettings();
    // Before login: the command registry, filled at login, leaves out switched-off features.
    await loadFeatures();
    await loadTrackedMessages();
    await loadReactionRoleSettings();
    await loadInviteStats();
    await loadPlaylists();
    await loadPlaybackOptions();
    startCapabilityWatch();
    startAuditRetention();
    startApiServer(env, {
      info(message: string) {
        container.logger.info(message);
      },
      error(message: unknown, ...rest: unknown[]) {
        container.logger.error(message, ...rest);
      },
    });

    container.logger.info('Logging in');
    await client.login();
    container.logger.info('Logged in');
  } catch (error) {
    container.logger.fatal(error);
    await client.destroy();
    process.exit(1);
  }
};

void main();
