import { ApplyOptions } from '@sapphire/decorators';
import { Events, Listener } from '@sapphire/framework';

import { syncSlashCommands } from '../lib/discord/command-features.js';
import { isEnabled, onFeatureChange } from '../lib/features.js';

/**
 * Keeps Discord's command list to the switched-on features.
 *
 * WHY after the framework's own registration: at start it overwrites the list with every
 * command, so a switched-off feature's commands are removed again right after. Later, a
 * switch flipped on the dashboard replaces the list at once.
 */
@ApplyOptions<Listener.Options>({
  event: Events.ApplicationCommandRegistriesRegistered,
  once: true,
})
export class UserListener extends Listener {
  public override async run() {
    onFeatureChange((feature) => {
      if (feature === 'music' || feature === 'github') {
        void syncSlashCommands().catch((error: unknown) =>
          this.container.logger.warn('[commands] could not update the command list:', error),
        );
      }
    });

    if (!isEnabled('music') || !isEnabled('github')) {
      await syncSlashCommands();
    }
  }
}
