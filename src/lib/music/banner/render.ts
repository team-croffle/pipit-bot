import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  escapeMarkdown,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from 'discord.js';
import type { TFunction } from 'i18next';

import { getEnv } from '../../env.js';
import { translator } from '../../i18n/index.js';
import { messageLanguage } from '../../i18n/settings.js';
import type { PlaybackState } from '../playback.js';
import { MAX_VOLUME, MIN_VOLUME } from '../volume.js';
import { hasCapability } from '../worker-capabilities.js';
import { getWorkerStatus } from '../worker-status.js';

/**
 * The music channel's remote control: one message per music channel, drawn from the
 * playback state. Idle, it says how to start; playing, it shows the track and the
 * controls. Components V2 — no `content` or `embeds` alongside.
 *
 * A music worker known to be down is said here and nowhere else in the channel: idle,
 * the banner says so instead of inviting a request; playing, the track goes on (it is
 * a local file) and one line warns that new ones cannot be prepared. The buttons that
 * need the worker — play, add, search, playlists, autoplay — are disabled meanwhile;
 * the ones that act on what is already playing stay. All of it goes away on its own
 * when the worker is back — the banner is redrawn on every change of status.
 *
 * Copy follows AGENTS.md §2: "a song title or a link", never a source.
 */

/** Custom ids the button handler routes on (`music:<action>`). */
export const REMOTE = {
  play: 'music:play',
  join: 'music:join',
  search: 'music:search',
  playlists: 'music:playlists',
  pause: 'music:pause',
  resume: 'music:resume',
  skip: 'music:skip',
  stop: 'music:stop',
  queue: 'music:queue',
  loop: 'music:loop',
  volumeDown: 'music:vol-down',
  volumeUp: 'music:vol-up',
  mono: 'music:mono',
  autoplay: 'music:autoplay',
} as const;

const ACCENT = 0xe9a23b;
/** Cells of the progress bar, the knob included; the knob steps one cell per 1/25 of the track. */
export const BAR_CELLS = 25;

/** Which cell the knob is in, 0–24 — the banner is redrawn when this changes. */
export function knobCell(progress: number): number {
  return Math.min(Math.floor(Math.min(Math.max(progress, 0), 1) * BAR_CELLS), BAR_CELLS - 1);
}

const REPEAT_KEY = {
  off: 'repeatOff',
  track: 'repeatTrack',
  queue: 'repeatQueue',
  autoplay: 'repeatAutoplay',
} as const satisfies Record<PlaybackState['repeatMode'], string>;

/** The banner is a public post: it speaks the music feature's language (i18n/settings.ts). */
type T = TFunction;

function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

function separator(): SeparatorBuilder {
  return new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
}

function button(id: string, label: string, emoji: string, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
}

/** The remote's link to the dashboard's music page — absent when its address is not known. */
function dashboardLink(t: T): ButtonBuilder[] {
  const base = getEnv().dashboardUrl;
  return base
    ? [
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setURL(`${base}/music`)
          .setLabel(t('dashboard'))
          .setEmoji('🖥️'),
      ]
    : [];
}

function progressBar(progress: number): string {
  const cell = knobCell(progress);
  return `${'▬'.repeat(cell)}🔘${'▬'.repeat(BAR_CELLS - 1 - cell)}`;
}

/** Music switched off from the dashboard: no buttons, nothing to press. */
function switchedOff(container: ContainerBuilder, t: T): void {
  container.addTextDisplayComponents(text('## 💿 Pipit Hub Music'), text(t('switchedOff')));
}

/** Only a read that failed counts: right after start the status is still unknown. */
function workerDown(): boolean {
  return getWorkerStatus().status === 'down';
}

function idle(container: ContainerBuilder, t: T): void {
  const down = workerDown();
  container
    .addTextDisplayComponents(
      text('## 💿 Pipit Hub Music'),
      text(workerDown() ? t('workerDown') : t('idleHint')),
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text(t('remote')))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(REMOTE.play, t('play'), '▶️', ButtonStyle.Primary).setDisabled(down),
        ...(hasCapability('search')
          ? [button(REMOTE.search, t('search'), '🔍').setDisabled(down)]
          : []),
        button(REMOTE.playlists, t('playlists'), '📁').setDisabled(down),
        button(REMOTE.join, t('join'), '🔈'),
        ...dashboardLink(t),
      ),
    );
}

function playing(container: ContainerBuilder, state: PlaybackState, t: T): void {
  const current = state.current!;
  const down = workerDown();
  const requester = current.autoplay
    ? t('byAutoplay')
    : current.requester
      ? t('requestedBy', { name: escapeMarkdown(current.requester.name) })
      : t('fromDashboard');
  const queueLine =
    state.pendingCount > 0 ? t('queued', { count: state.pendingCount }) : t('queueEmpty');
  const status = [
    t('status', { repeat: t(REPEAT_KEY[state.repeatMode]), volume: state.volume }),
    ...(state.mono ? [t('mono')] : []),
    ...(state.autoplay ? [t('autoplayOn')] : []),
    queueLine,
  ].join(' · ');

  container
    .addTextDisplayComponents(
      text(state.paused ? t('pausedHeading') : t('playingHeading')),
      text(`### ${escapeMarkdown(current.title)}`),
      text(`-# ${requester}\n${progressBar(current.progress)} \`${current.durationLabel}\``),
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text(down ? `${status}\n${t('workerDownLine')}` : status))
    .addSeparatorComponents(separator())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        state.paused
          ? button(REMOTE.resume, t('resume'), '▶️', ButtonStyle.Primary)
          : button(REMOTE.pause, t('pause'), '⏸️', ButtonStyle.Primary),
        button(REMOTE.skip, t('next'), '⏭️'),
        button(REMOTE.stop, t('stop'), '⏹️', ButtonStyle.Danger),
        button(REMOTE.queue, t('queue'), '📜'),
        button(REMOTE.playlists, t('playlists'), '📁').setDisabled(down),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(REMOTE.play, t('add'), '➕').setDisabled(down),
        ...(hasCapability('search')
          ? [button(REMOTE.search, t('search'), '🔍').setDisabled(down)]
          : []),
        button(REMOTE.loop, t('loop'), '🔁'),
        button(REMOTE.volumeDown, '−10', '🔉').setDisabled(state.volume <= MIN_VOLUME),
        button(REMOTE.volumeUp, '+10', '🔊').setDisabled(state.volume >= MAX_VOLUME),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(
          REMOTE.mono,
          state.mono ? t('monoOffButton') : t('monoButton'),
          '🎧',
          state.mono ? ButtonStyle.Success : ButtonStyle.Secondary,
        ),
        ...(hasCapability('related')
          ? [
              button(
                REMOTE.autoplay,
                state.autoplay ? t('autoplayOffButton') : t('autoplayButton'),
                '♾️',
                state.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary,
              ).setDisabled(down),
            ]
          : []),
        button(REMOTE.join, t('join'), '🔈'),
        ...dashboardLink(t),
      ),
    );
}

export function renderBanner(state: PlaybackState) {
  const t = translator(messageLanguage('music'), 'music');
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  if (state.musicEnabled === false) {
    switchedOff(container, t);
  } else if (state.active && state.current) {
    playing(container, state, t);
  } else {
    idle(container, t);
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] as never[] },
  };
}

/**
 * What the banner shows. Compared between ticks so the banner is edited when something
 * changed — the knob's cell included, so the bar moves one cell at a time.
 */
export function bannerSignature(state: PlaybackState): string {
  return JSON.stringify({
    // Bumped when the buttons change, so a banner left by an older version is redrawn.
    layout: 6,
    // A change of language redraws it (v0.8.3).
    language: messageLanguage('music'),
    search: hasCapability('search'),
    workerDown: workerDown(),
    off: state.musicEnabled === false,
    active: state.active,
    paused: state.paused,
    title: state.current?.title ?? null,
    requester: state.current?.requester?.userId ?? null,
    autoplayTrack: state.current?.autoplay ?? false,
    repeat: state.repeatMode,
    volume: state.volume,
    mono: state.mono,
    autoplay: state.autoplay,
    related: hasCapability('related'),
    pending: state.pendingCount,
    knob: state.active && state.current ? knobCell(state.current.progress) : null,
  });
}
