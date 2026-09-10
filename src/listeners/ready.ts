import { ApplyOptions } from '@sapphire/decorators';
import { Listener } from '@sapphire/framework';
import type { StoreRegistryValue } from '@sapphire/pieces';
import { blue, gray, green, magenta, magentaBright, white, yellow } from 'colorette';

import { refreshGuildInvites } from '../lib/invite-cache.js';

const dev = process.env.NODE_ENV !== 'production';

@ApplyOptions<Listener.Options>({ once: true })
export class UserEvent extends Listener {
  private readonly style = dev ? yellow : blue;

  public override async run() {
    this.printBanner();
    this.printStoreDebugInformation();

    for (const guild of this.container.client.guilds.cache.values()) {
      await refreshGuildInvites(guild);
    }

    // WHY here: the bot's own emoji never arrive over the gateway, so the cache is
    // empty until something fetches it. Until now only the dashboard picker did,
    // which left a `:name:` in a notification as text after every restart.
    try {
      await this.container.client.application?.emojis.fetch();
    } catch (error) {
      this.container.logger.warn('[emoji] could not load the application emoji:', error);
    }
  }

  private printBanner() {
    const success = green('+');
    const llc = dev ? magentaBright : white;
    const blc = dev ? magenta : blue;
    const pad = ' '.repeat(7);

    this.container.logger.info(
      String.raw`
${llc('')} ${pad}${blc('pipit-hub')} ${blc('1.0.0')}
${llc('')} ${pad}[${success}] Gateway
${dev ? ` ${pad}${blc('<')}${llc('/')}${blc('>')} ${llc('DEVELOPMENT MODE')}` : ''}
		`.trim(),
    );
  }

  private printStoreDebugInformation() {
    const { client, logger } = this.container;
    const stores = [...client.stores.values()];
    const last = stores.pop()!;

    for (const store of stores) {
      logger.info(this.styleStore(store, false));
    }
    logger.info(this.styleStore(last, true));
  }

  private styleStore(store: StoreRegistryValue, last: boolean) {
    return gray(
      `${last ? '└─' : '├─'} Loaded ${this.style(store.size.toString().padEnd(3, ' '))} ${store.name}.`,
    );
  }
}
