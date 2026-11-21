import {
  type ChatInputCommandDeniedPayload,
  type Events,
  Listener,
  type UserError,
} from '@sapphire/framework';

import { replyNotice } from '../../../lib/discord/notice.js';
import type { Phrase } from '../../../lib/i18n/phrase.js';

export class UserEvent extends Listener<typeof Events.ChatInputCommandDenied> {
  public override async run(
    { context, message }: UserError,
    { interaction }: ChatInputCommandDeniedPayload,
  ) {
    // `context: { silent: true }` keeps a refusal quiet.
    if (Reflect.get(Object(context), 'silent')) {
      return;
    }

    // A precondition may carry the refusal as a phrase (i18n/phrase.ts) for the person's language.
    const phrase = Reflect.get(Object(context), 'phrase') as Phrase | undefined;
    await replyNotice(interaction, { ok: false, message, phrase });
  }
}
