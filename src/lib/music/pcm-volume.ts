import { Transform, type TransformCallback } from 'node:stream';

import { getPlaybackOptions, updatePlaybackOptions } from './playback-options.js';

/**
 * The bot's own volume, applied to the PCM it streams.
 *
 * WHY not the player's volume: the node options switch the player's DSP chain off
 * (the prepared files are already 48 kHz s16le, and reprocessing them stuttered), and
 * the player only builds its volume stage inside that chain — so its `setVolume`
 * always failed and `!volume` silently changed nothing. Scaling the samples here
 * keeps the chain off, and the level lives outside any queue, so it can be set
 * while nothing plays and it carries over to the next session — and, kept in the
 * playback options file, to the next start.
 */
export function getVolume(): number {
  return getPlaybackOptions().volume;
}

export function setPcmVolume(volume: number): void {
  void updatePlaybackOptions({ volume });
}

/** A boosted sample can leave the 16-bit range; it is cut at the edge. */
function clampSample(value: number): number {
  return Math.min(Math.max(Math.round(value), -32768), 32767);
}

const BYTES_PER_SAMPLE = 2;
/** The prepared files are interleaved stereo: left sample, right sample. */
const BYTES_PER_FRAME = 2 * BYTES_PER_SAMPLE;

/**
 * Scales signed 16-bit little-endian stereo samples by the current volume and, with mono
 * on, puts the average of left and right into both ears — so one earphone hears
 * everything. Both are read per chunk, so a change applies to whatever has not been read
 * yet — a fraction of a second behind on a playing track. Up to 100 nothing clips; above it
 * (a boost) loud passages are cut at the edge of the 16-bit range.
 */
export class PcmVolume extends Transform {
  #carry: Buffer | null = null;

  public override _transform(chunk: Buffer, _encoding: BufferEncoding, done: TransformCallback) {
    const data = this.#carry ? Buffer.concat([this.#carry, chunk]) : chunk;
    // A chunk can end halfway through a frame; keep those bytes for the next one.
    const usable = data.length - (data.length % BYTES_PER_FRAME);
    this.#carry = usable < data.length ? data.subarray(usable) : null;

    const gain = getVolume() / 100;
    const { mono } = getPlaybackOptions();
    if (gain === 1 && !mono) {
      done(null, data.subarray(0, usable));
      return;
    }

    const out = Buffer.allocUnsafe(usable);
    for (let offset = 0; offset < usable; offset += BYTES_PER_FRAME) {
      const left = data.readInt16LE(offset);
      const right = data.readInt16LE(offset + BYTES_PER_SAMPLE);
      if (mono) {
        const both = clampSample(((left + right) / 2) * gain);
        out.writeInt16LE(both, offset);
        out.writeInt16LE(both, offset + BYTES_PER_SAMPLE);
      } else {
        out.writeInt16LE(clampSample(left * gain), offset);
        out.writeInt16LE(clampSample(right * gain), offset + BYTES_PER_SAMPLE);
      }
    }
    done(null, out);
  }
}
