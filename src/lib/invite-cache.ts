import { GuildFeature, type Guild } from 'discord.js';

export interface InviteMatch {
  code: string;
  uses: number;
  inviterId: string | null;
}

const inviteCache = new Map<string, Map<string, InviteMatch>>();
const vanityUses = new Map<string, number>();

function snapshotInvites(guild: Guild): Map<string, InviteMatch> {
  const next = new Map<string, InviteMatch>();
  for (const invite of guild.invites.cache.values()) {
    next.set(invite.code, {
      code: invite.code,
      uses: invite.uses ?? 0,
      inviterId: invite.inviterId,
    });
  }

  return next;
}

export async function refreshGuildInvites(guild: Guild): Promise<void> {
  try {
    await guild.invites.fetch();
    inviteCache.set(guild.id, snapshotInvites(guild));
  } catch {
    inviteCache.set(guild.id, new Map());
  }

  if (guild.features.includes(GuildFeature.VanityURL)) {
    try {
      const vanity = await guild.fetchVanityData();
      vanityUses.set(guild.id, vanity.uses);
    } catch {
      vanityUses.delete(guild.id);
    }
  }
}

export async function consumeUsedInvite(guild: Guild): Promise<InviteMatch | null> {
  const previous = inviteCache.get(guild.id) ?? new Map();
  const previousVanity = vanityUses.get(guild.id) ?? 0;

  try {
    await guild.invites.fetch();
  } catch {
    return null;
  }

  const current = snapshotInvites(guild);
  inviteCache.set(guild.id, current);

  for (const [code, invite] of current) {
    const before = previous.get(code);
    if (invite.uses > (before?.uses ?? 0)) {
      return invite;
    }
  }

  for (const [code, invite] of previous) {
    if (!current.has(code)) {
      return invite;
    }
  }

  if (guild.features.includes(GuildFeature.VanityURL)) {
    try {
      const vanity = await guild.fetchVanityData();
      vanityUses.set(guild.id, vanity.uses);
      if (vanity.uses > previousVanity) {
        return { code: vanity.code ?? 'vanity', uses: vanity.uses, inviterId: null };
      }
    } catch {
      return null;
    }
  }

  return null;
}
