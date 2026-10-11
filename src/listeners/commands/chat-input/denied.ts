import {
  type ChatInputCommandDeniedPayload,
  type Events,
  Listener,
  type UserError,
} from '@sapphire/framework';

import { replyNotice } from '../../../lib/discord/notice.js';

export class UserEvent extends Listener<typeof Events.ChatInputCommandDenied> {
  public override async run(
    { context, message }: UserError,
    { interaction }: ChatInputCommandDeniedPayload,
  ) {
    // `context: { silent: true }` keeps a refusal quiet.
    if (Reflect.get(Object(context), 'silent')) {
      return;
    }

    await replyNotice(interaction, { ok: false, message });
  }
}
