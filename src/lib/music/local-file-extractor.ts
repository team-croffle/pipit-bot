import { createReadStream, existsSync } from 'node:fs';
import { join, normalize } from 'node:path';

import { BaseExtractor, type ExtractorInfo, type ExtractorStreamable, Track } from 'discord-player';

import { getEnv } from '../env.js';
import { consumeTrackMeta, getTrackMeta } from './prepare-track.js';
import { formatDurationFromSeconds } from './track-format.js';

const LOCAL_PREFIX = 'local:';

function resolveRelativeFile(query: string): string | null {
  if (!query.startsWith(LOCAL_PREFIX)) {
    return null;
  }

  const relativePath = query.slice(LOCAL_PREFIX.length).trim();
  if (!relativePath || relativePath.includes('..') || relativePath.includes(':')) {
    return null;
  }

  return relativePath.replace(/\\/g, '/');
}

export class LocalFileExtractor extends BaseExtractor {
  public static override get identifier() {
    return 'local-file';
  }

  public override async activate() {
    this.protocols = ['local'];
  }

  public override async validate(query: string) {
    return query.startsWith(LOCAL_PREFIX);
  }

  public override async handle(query: string, _: unknown): Promise<ExtractorInfo> {
    const relativeFile = resolveRelativeFile(query);
    if (!relativeFile) {
      throw new Error('Invalid local track reference.');
    }

    const { streamRoot } = getEnv();
    const absolutePath = join(streamRoot, relativeFile);
    const normalizedRoot = normalize(streamRoot);
    const normalizedFile = normalize(absolutePath);

    if (!normalizedFile.startsWith(normalizedRoot)) {
      throw new Error('Track path escapes STREAM_ROOT.');
    }

    if (!existsSync(normalizedFile)) {
      throw new Error('Track file not found.');
    }

    const meta = consumeTrackMeta(relativeFile) ?? getTrackMeta(relativeFile);
    const title = meta?.title ?? relativeFile;
    const durationSec = meta?.durationSec ?? 0;

    const track = new Track(this.context.player, {
      title,
      author: 'Music Backend',
      url: `${LOCAL_PREFIX}${relativeFile}`,
      thumbnail: '',
      duration: durationSec > 0 ? formatDurationFromSeconds(durationSec) : '0:00',
      views: 0,
      source: 'arbitrary',
      queryType: 'auto',
    });

    return this.createResponse(null, [track]);
  }

  public override async stream(info: Track): Promise<ExtractorStreamable> {
    const relativeFile = resolveRelativeFile(info.url);
    if (!relativeFile) {
      throw new Error('Invalid local track reference.');
    }

    const { streamRoot } = getEnv();
    const absolutePath = join(streamRoot, relativeFile);

    if (!existsSync(absolutePath)) {
      throw new Error('Track file not found.');
    }

    return {
      stream: createReadStream(absolutePath),
      $fmt: 'pcm',
    };
  }
}

export function toLocalPlayQuery(file: string): string {
  return `${LOCAL_PREFIX}${file.replace(/\\/g, '/').replace(/^\/+/, '')}`;
}
