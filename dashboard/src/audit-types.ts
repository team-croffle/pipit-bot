/** The logs and invites pages: audit lines and invite statistics. */

export type AuditCategory = 'dashboard' | 'music' | 'command' | 'github' | 'member';

/** One line of the audit log. Music lines say only that someone used a feature. */
export interface AuditEntry {
  at: string;
  category: AuditCategory;
  action: string;
  actor?: { id?: string; name: string };
  target?: string;
  outcome: 'ok' | 'failed' | 'skipped';
  detail?: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  next: string | null;
}

/** One invite: what Discord still knows about it, and the arrivals the bot has counted. */
export interface InviteRow {
  code: string;
  inviterId: string | null;
  inviterName: string | null;
  joins: number;
  lastJoinAt: string | null;
  uses: number | null;
  maxUses: number | null;
  expiresAt: string | null;
  active: boolean;
}

export interface InvitesResponse {
  invites: InviteRow[];
  /** False when the bot lacks Manage Server and can only show its own counts. */
  canListInvites: boolean;
  /** False when Discord withholds use counts (no Manage Server) — arrivals cannot be traced. */
  hasUseCounts: boolean;
  loadError: string | null;
}
