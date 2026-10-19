import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction, StringSelectMenuInteraction } from 'discord.js';

import { replyNotice } from '../lib/discord/notice.js';
import { requestBannerRefresh } from '../lib/music/banner/manager.js';
import { refuseWhenMusicOff } from '../lib/music/music-switch.js';
import { canEnqueuePlayback } from '../lib/music/playback.js';
import { discordViewer } from '../lib/music/playlists/discord.js';
import { playPlaylist } from '../lib/music/playlists/feeder.js';
import { PLAYLIST_UI, playPlaylistMessage } from '../lib/music/playlists/pickers.js';
import { resolveItems } from '../lib/music/playlists/sources.js';
import { addItems, getPlaylist, PlaylistError } from '../lib/music/playlists/store.js';
import { connectPlayerToChannel } from '../lib/music/voice-connection.js';

const RESULT_SECONDS = 5;

/** Choosing in a playlist picker: save a search result, or mark the playlist to play. */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.SelectMenu,
})
export class PlaylistPickerSelect extends InteractionHandler {
  public override parse(interaction: StringSelectMenuInteraction) {
    return interaction.customId.startsWith(`${PLAYLIST_UI.save}:`) ||
      interaction.customId === PLAYLIST_UI.pick
      ? this.some()
      : this.none();
  }

  public override async run(interaction: StringSelectMenuInteraction) {
    if (await refuseWhenMusicOff(interaction)) {
      return;
    }
    const viewer = discordViewer(
      interaction.user,
      interaction.inCachedGuild() ? interaction.member : null,
    );
    const playlistId = interaction.values[0] ?? '';

    if (interaction.customId === PLAYLIST_UI.pick) {
      const next = playPlaylistMessage(viewer, playlistId);
      if (next) {
        await interaction.update(next);
      }
      return;
    }

    // `playlist:save:<searchId>:<index>`
    const [, , searchId, index] = interaction.customId.split(':');
    await interaction.deferUpdate();
    try {
      const playlist = getPlaylist(playlistId, viewer);
      const items = resolveItems({
        from: 'search',
        searchId: searchId ?? '',
        index: Number(index),
        owner: interaction.user.id,
      });
      await addItems(playlist.id, items, viewer);
      await replyNotice(
        interaction,
        { ok: true, message: `Saved to "${playlist.name}".` },
        { seconds: RESULT_SECONDS },
      );
    } catch (error) {
      const message = error instanceof PlaylistError ? error.message : 'Could not save it.';
      await replyNotice(interaction, { ok: false, message }, { seconds: RESULT_SECONDS });
    }
  }
}

/** Play or shuffle the playlist chosen in the remote's picker. */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class PlaylistPickerPlay extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    return interaction.customId.startsWith(`${PLAYLIST_UI.play}:`) ||
      interaction.customId.startsWith(`${PLAYLIST_UI.shuffle}:`)
      ? this.some()
      : this.none();
  }

  public override async run(interaction: ButtonInteraction) {
    if (await refuseWhenMusicOff(interaction)) {
      return;
    }
    if (!interaction.inCachedGuild()) {
      return;
    }

    const [, part, playlistId] = interaction.customId.split(':');
    await interaction.deferUpdate();
    try {
      const playlist = getPlaylist(
        playlistId ?? '',
        discordViewer(interaction.user, interaction.member),
      );
      if (!canEnqueuePlayback()) {
        const voice = interaction.member.voice.channel;
        if (!voice) {
          await replyNotice(
            interaction,
            { ok: false, message: 'Join a voice channel first.' },
            { seconds: RESULT_SECONDS },
          );
          return;
        }
        await connectPlayerToChannel(voice);
      }
      const notice = playPlaylist(playlist, {
        shuffle: part === 'shuffle',
        requestedBy: interaction.user.id,
      });
      await replyNotice(interaction, notice, { seconds: RESULT_SECONDS });
      requestBannerRefresh();
    } catch (error) {
      const message = error instanceof PlaylistError ? error.message : 'Could not play it.';
      await replyNotice(interaction, { ok: false, message }, { seconds: RESULT_SECONDS });
    }
  }
}
