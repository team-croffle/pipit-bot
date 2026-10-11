# 003 — discord-player and voice

- **discord-player** v7 — https://discord-player.js.org/docs
- **@discordjs/voice** — https://discordjs.guide/voice/ · **@discordjs/opus** for encoding

## How Pipit uses it

- One `Player` on the client with a single extractor, `LocalFileExtractor`, which accepts `local:<file>.pcm` and streams
  that file from `STREAM_ROOT` as raw PCM. Nothing else is resolved by the player.
- Node options shared by every queue (`player-node-options.ts`): the processing chain (equaliser, filters, resampler,
  compressor, …) is **off** — the files are already 48 kHz 16-bit stereo and reprocessing stuttered — leave timers on
  end and on empty, and a history of 20 tracks.
- Queue actions use the player's own operations: `node.remove`, `node.skipTo`, `node.move`, `node.insert` (play next),
  `tracks.shuffle()` (one-time shuffle), `history.back()` (previous).

## Worth knowing

- **The volume stage lives inside the processing chain.** With the chain off, `setVolume` always returns false; Pipit
  scales the PCM itself ([decision 015](../decisions/015_v0.7.0_bot-side-volume.md)).
- **Connecting a queue to another channel destroys its dispatcher** and stops the track. Moving uses the voice
  connection's `rejoin`, and the default voice-state handler points the queue at the new channel.
- `enableShuffle()` without arguments turns on *dynamic* shuffle, which picks at random as tracks end; `enableShuffle(false)`
  (or `tracks.shuffle()`) reorders once.
- When a stream cannot be opened the player emits `playerSkip` (`ERR_NO_STREAM`) and `playerError` and moves on by itself.
- The history is a LIFO queue (`store[0]` is the previous track); `maxHistorySize` defaults to unlimited.
- Track ids are generated per track and stay stable while it waits — safe to address rows by.
