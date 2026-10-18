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

import type { PlaybackState } from '../playback.js';
import { MAX_VOLUME, MIN_VOLUME } from '../volume.js';
import { hasCapability } from '../worker-capabilities.js';

/**
 * The music channel's remote control: one message per music channel, drawn from the
 * playback state. Idle, it says how to start; playing, it shows the track and the
 * controls. Components V2 — no `content` or `embeds` alongside.
 *
 * Copy follows AGENTS.md §2: "a song title or a link", never a source.
 */

/** Custom ids the button handler routes on (`music:<action>`). */
export const REMOTE = {
  play: 'music:play',
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
/** Bar characters beside the knob; the knob sits at the share played. */
const BAR_SEGMENTS = 19;

const REPEAT_LABEL: Record<PlaybackState['repeatMode'], string> = {
  off: '반복 꺼짐',
  track: '한 곡 반복',
  queue: '대기열 반복',
  autoplay: '자동 재생',
};

function text(content: string): TextDisplayBuilder {
  return new TextDisplayBuilder().setContent(content);
}

function separator(): SeparatorBuilder {
  return new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
}

function button(id: string, label: string, emoji: string, style = ButtonStyle.Secondary) {
  return new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
}

function progressBar(progress: number): string {
  const filled = Math.round(Math.min(Math.max(progress, 0), 1) * BAR_SEGMENTS);
  return `${'▬'.repeat(filled)}🔘${'▬'.repeat(BAR_SEGMENTS - filled)}`;
}

function idle(container: ContainerBuilder): void {
  container
    .addTextDisplayComponents(
      text('## 💿 Pipit Hub Music'),
      text(
        '**이 채널에 곡 제목이나 URL을 입력하여 재생해 보세요.**\n-# 곡을 준비해서 바로 들려 드릴게요. 통화방에 먼저 들어가 있어 주세요.',
      ),
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(text('### 🎛️ 리모컨'))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(REMOTE.play, '재생', '▶️', ButtonStyle.Primary),
        ...(hasCapability('search') ? [button(REMOTE.search, '검색', '🔍')] : []),
        button(REMOTE.playlists, '재생목록', '📁'),
      ),
    );
}

function playing(container: ContainerBuilder, state: PlaybackState): void {
  const current = state.current!;
  const requester = current.autoplay
    ? '🤖 자동 재생으로 이어 듣는 곡이에요'
    : current.requester
      ? `👤 ${escapeMarkdown(current.requester.name)}님이 신청했어요`
      : '🖥️ 대시보드에서 추가했어요';
  const queueLine =
    state.pendingCount > 0 ? `📜 대기열 ${state.pendingCount}곡` : '📜 대기열이 비었어요';

  container
    .addTextDisplayComponents(
      text(state.paused ? '## ⏸️ 잠시 멈췄어요' : '## 💿 지금 이 곡을 들려 드리고 있어요'),
      text(`### ${escapeMarkdown(current.title)}`),
      text(
        `-# ${requester}\n\`${current.positionLabel}\` ${progressBar(current.progress)} \`${current.durationLabel}\``,
      ),
    )
    .addSeparatorComponents(separator())
    .addTextDisplayComponents(
      text(
        `🔁 ${REPEAT_LABEL[state.repeatMode]} · 🔊 볼륨 ${state.volume}${state.mono ? ' · 🎧 모노' : ''}${state.autoplay ? ' · ♾️ 자동 재생' : ''} · ${queueLine}`,
      ),
    )
    .addSeparatorComponents(separator())
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        state.paused
          ? button(REMOTE.resume, '재개', '▶️', ButtonStyle.Primary)
          : button(REMOTE.pause, '일시정지', '⏸️', ButtonStyle.Primary),
        button(REMOTE.skip, '다음', '⏭️'),
        button(REMOTE.stop, '정지', '⏹️', ButtonStyle.Danger),
        button(REMOTE.queue, '대기열', '📜'),
        button(REMOTE.playlists, '재생목록', '📁'),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(REMOTE.play, '곡 추가', '➕'),
        ...(hasCapability('search') ? [button(REMOTE.search, '검색', '🔍')] : []),
        button(REMOTE.loop, '반복', '🔁'),
        button(REMOTE.volumeDown, '−10', '🔉').setDisabled(state.volume <= MIN_VOLUME),
        button(REMOTE.volumeUp, '+10', '🔊').setDisabled(state.volume >= MAX_VOLUME),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button(
          REMOTE.mono,
          state.mono ? '모노 끄기' : '모노',
          '🎧',
          state.mono ? ButtonStyle.Success : ButtonStyle.Secondary,
        ),
        ...(hasCapability('related')
          ? [
              button(
                REMOTE.autoplay,
                state.autoplay ? '자동 재생 끄기' : '자동 재생',
                '♾️',
                state.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary,
              ),
            ]
          : []),
      ),
    );
}

export function renderBanner(state: PlaybackState) {
  const container = new ContainerBuilder().setAccentColor(ACCENT);
  if (state.active && state.current) {
    playing(container, state);
  } else {
    idle(container);
  }

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2 as const,
    allowedMentions: { parse: [] as never[] },
  };
}

/**
 * What the banner shows, minus the clock. Compared between ticks so the banner is
 * edited when something changed — not every few seconds just because time passed.
 */
export function bannerSignature(state: PlaybackState): string {
  return JSON.stringify({
    // Bumped when the buttons change, so a banner left by an older version is redrawn.
    layout: 4,
    search: hasCapability('search'),
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
  });
}
