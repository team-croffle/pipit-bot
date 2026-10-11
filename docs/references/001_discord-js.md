# 001 — discord.js and the Discord API

- **discord.js** v14 — https://discord.js.org/docs · guide https://discordjs.guide
- **discord-api-types** — typed API payloads
- **Discord developer docs** — https://discord.com/developers/docs (permissions, message formatting, rate limits)

## How Pipit uses it

- One client, one guild (`getConfiguredGuild()` — the first guild the bot is in).
- Gateway intents: `Guilds`, `GuildMessages`, `MessageContent` (message commands), `GuildMembers` (member picker, join
  roles), `GuildVoiceStates` (music), `GuildInvites` (invite tracking), `GuildMessageReactions` (reaction roles),
  `GuildExpressions` (keeps the emoji cache current), `DirectMessages`. `MessageContent` and `GuildMembers` are
  privileged — enable them in the developer portal.
- Partials for messages, reactions, users and members, so reactions on old panel messages still arrive.
- Permissions the features need: View Channel, Send Messages, Embed Links, Add Reactions, Read Message History, Manage
  Roles, Manage Guild (invites), Connect and Speak (voice); Manage Messages for one-reaction panels and reordering;
  Mention Everyone only where a role must be pinged without being mentionable.

## Worth knowing

- **A mention inside an embed notifies no one.** Pings go in the message content ([decision 008](../decisions/008_v0.6.4_embed-notifications.md)).
- **A mention added by editing a message notifies no one** either — which is why an assignment edits the tracked
  announcement *and* sends its own message.
- Markdown renders in content, embed descriptions and field values, not in titles, field names or footers — the
  dashboard preview follows the same rule.
- The member cache is not filled by the gateway alone; the dashboard fetches members on demand.
- A reaction's position on a message is fixed when it is first added; reordering means clearing and reacting again.
- Content is limited to 2000 characters and an embed to 6000 in total; anything substituted from outside is trimmed.
