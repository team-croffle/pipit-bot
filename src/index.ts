import { container } from '@sapphire/framework';

import { startApiServer } from './api/server.js';
import { CustomClient } from './lib/client.js';
import { loadGuildEventSettings } from './lib/guild-event-settings.js';
import { env } from './lib/setup.js';

const client = new CustomClient(env);

const main = async () => {
  try {
    await loadGuildEventSettings();
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
