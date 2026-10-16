import { LogLevel, SapphireClient, container } from '@sapphire/framework';
import { Player } from 'discord-player';
import { GatewayIntentBits, Partials } from 'discord.js';

import type { EnvConfig } from './env.js';
import { watchAutoplay } from './music/autoplay.js';
import { LocalFileExtractor } from './music/local-file-extractor.js';
import { watchMissingFiles } from './music/missing-file.js';
import { watchPlaylistFeed } from './music/playlists/feeder.js';

export class CustomClient extends SapphireClient {
  public readonly player: Player;

  public constructor(private readonly config: EnvConfig) {
    super({
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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessageReactions,
        // Keeps the emoji cache current after start: without it a server emoji added
        // or renamed while the bot runs is unknown to `:name:` resolution.
        GatewayIntentBits.GuildExpressions,
      ],
      partials: [Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember],
      // Slash commands only (v0.7.1): no message commands, so no prefix.
      loadMessageCommandListeners: false,
    });

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

    watchMissingFiles(this.player);
    watchPlaylistFeed(this.player);
    watchAutoplay(this.player);
  }

  public override async login(token?: string) {
    await this.player.extractors.register(LocalFileExtractor, {});
    container.logger.info(
      `Loaded ${this.player.extractors.store.size} extractors: ${[...this.player.extractors.store.keys()].join(', ')}`,
    );

    return super.login(token ?? this.config.botToken);
  }
}
