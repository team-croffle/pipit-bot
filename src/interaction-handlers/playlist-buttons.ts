import { ApplyOptions } from '@sapphire/decorators';
import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework';
import type { ButtonInteraction } from 'discord.js';

import { replyNotice } from '../lib/discord/notice.js';
import { refuseWhenMusicOff } from '../lib/music/music-switch.js';
import { discordViewer } from '../lib/music/playlists/discord.js';
import { deletePlaylist, PlaylistError } from '../lib/music/playlists/store.js';
import { PLAYLIST_DELETE } from '../lib/music/playlists/subcommands.js';

/** The delete button `/playlist delete` offers. */
@ApplyOptions<InteractionHandler.Options>({
  interactionHandlerType: InteractionHandlerTypes.Button,
})
export class PlaylistDeleteButton extends InteractionHandler {
  public override parse(interaction: ButtonInteraction) {
    return interaction.customId.startsWith(`${PLAYLIST_DELETE}:`) ? this.some() : this.none();
  }

  public override async run(interaction: ButtonInteraction) {
    if (await refuseWhenMusicOff(interaction)) {
      return;
    }
    const id = interaction.customId.slice(PLAYLIST_DELETE.length + 1);
    await interaction.deferUpdate();
    try {
      const gone = await deletePlaylist(
        id,
        discordViewer(interaction.user, interaction.inCachedGuild() ? interaction.member : null),
      );
      await replyNotice(
        interaction,
        { ok: true, message: `Deleted "${gone.name}".` },
        { seconds: 5 },
      );
    } catch (error) {
      const message = error instanceof PlaylistError ? error.message : 'Could not delete it.';
      await replyNotice(interaction, { ok: false, message }, { seconds: 5 });
    }
  }
}
