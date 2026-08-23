import type { Events } from "@sapphire/framework";
import { Listener } from "@sapphire/framework";
import type { Message } from "discord.js";
import { getRuntimeConfig } from "../lib/runtime-config.js";

export class UserEvent extends Listener<typeof Events.MentionPrefixOnly> {
  public override run(message: Message) {
    // Do nothing if we cannot send messages in the channel (eg. group DMs)
    if (!message.channel.isSendable()) {
      return;
    }

    const prefix = getRuntimeConfig().prefix;
    return message.channel.send(
      prefix
        ? `My prefix in this guild is: \`${prefix}\``
        : "Cannot find any Prefix for Message Commands.",
    );
  }
}
