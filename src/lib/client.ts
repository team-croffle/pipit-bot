import { LogLevel, SapphireClient, container } from '@sapphire/framework';
import { Player } from 'discord-player';
import { GatewayIntentBits } from 'discord.js';

import type { EnvConfig } from './env.js';
import { LocalFileExtractor } from './music/local-file-extractor.js';

export class CustomClient extends SapphireClient {
  public player: Player | null = null;

  public constructor(private readonly config: EnvConfig) {
    super({
      defaultPrefix: '!',
      caseInsensitiveCommands: true,
      logger: {
        level: config.nodeEnv === 'production' ? LogLevel.Info : LogLevel.Debug,
      },
      intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
      loadMessageCommandListeners: true,
    });

    if (config.isMain) {
      this.player = new Player(this as unknown as ConstructorParameters<typeof Player>[0], {
        skipFFmpeg: true,
        connectionTimeout: 30000,
        probeTimeout: 0,
      });

      this.player.events.on('playerError', (_, error) => {
        container.logger.error('[player]', error);
      });

      this.player.events.on('error', (_, error) => {
        container.logger.error('[queue]', error);
      });
    }
  }

  public override async login(token?: string) {
    if (this.config.isMain && this.player) {
      await this.player.extractors.register(LocalFileExtractor, {});
      container.logger.info(
        `Loaded ${this.player.extractors.store.size} extractors: ${[...this.player.extractors.store.keys()].join(', ')}`,
      );
    } else {
      container.logger.info(`Running in ROLE=${this.config.role}; music player disabled.`);
    }

    return super.login(token ?? this.config.botToken);
  }
}
