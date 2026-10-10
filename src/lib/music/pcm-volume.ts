import { Transform, type TransformCallback } from 'node:stream';

import { VOLUME_LEVELS, type VolumeLevel } from './volume-levels.js';

/**
 * The bot's own volume, applied to the PCM it streams.
 *
 * WHY not the player's volume: the node options switch the player's DSP chain off
 * (the prepared files are already 48 kHz s16le, and reprocessing them stuttered), and
 * the player only builds its volume stage inside that chain — so its `setVolume`
 * always failed and `!volume` silently changed nothing. Scaling the samples here
 * keeps the chain off, and the level lives outside any queue, so it can be set
 * while nothing plays and it carries over to the next session.
 */
let current: VolumeLevel = 'high';

export function getVolumeLevel(): VolumeLevel {
  return current;
}

export function setPcmVolumeLevel(level: VolumeLevel): void {
  current = level;
}

const BYTES_PER_SAMPLE = 2;

/**
 * Scales signed 16-bit little-endian samples by the current level. The gain is read
 * per chunk, so a change applies to whatever has not been read yet — a fraction of a
 * second behind on a playing track. Gains never exceed 1, so nothing clips.
 */
export class PcmVolume extends Transform {
  #carry: Buffer | null = null;

  public override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
    const data = this.#carry ? Buffer.concat([this.#carry, chunk]) : chunk;
    // A chunk can end halfway through a sample; keep that byte for the next one.
    const usable = data.length - (data.length % BYTES_PER_SAMPLE);
    this.#carry = usable < data.length ? data.subarray(usable) : null;

    const gain = VOLUME_LEVELS[current] / 100;
    if (gain === 1) {
      done(null, data.subarray(0, usable));
      return;
    }

    const out = Buffer.allocUnsafe(usable);
    for (let offset = 0; offset < usable; offset += BYTES_PER_SAMPLE) {
      out.writeInt16LE(Math.round(data.readInt16LE(offset) * gain), offset);
    }
    done(null, out);
  }
}
