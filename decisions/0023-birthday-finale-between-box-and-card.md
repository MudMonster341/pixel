---
status: accepted
date: 2026-10-05
authored_by: agent
derived_from: ["docs/plans/2026-10-04-day3-feedback-and-wow.md section B (W3, W9)", "owner approval of the recommendation (Q14: hold a key to blow the candles; the chain box -> finale -> card)", "docs/STORY.md", "decisions/0019-credits-ending-and-recipient.md"]
supersedes: null
superseded_by: null
---

# 0023 — The birthday finale (cake, candles, fireworks, song) plays between the box and the card

## Context

After the box opens the game went straight to the card. The owner approved a celebration first (wow idea W3): a cake, candles she blows out, fireworks over
a Dubai skyline and a "Happy Birthday" tune, so the card then reads as the personal message afterwards.

## Decision

- The ending chain is **box opening -> finale -> card -> credits -> title** (ADR 0019 added the credits). "Watch the Card Again" still starts the card directly:
  the finale is a one-time moment, and the card does not depend on it.
- The finale (`src/scenes/finale.js`) is one scene. The candles are the interaction: **HOLD Space / E / Enter (or the mouse / a finger)**, the 22 flames go out one
  by one over about 3 s of holding; releasing pauses it. Soft-lock guards: a hint after 8 s without progress, the rest go out by themselves after 20 s, a 60 s hard stop.
  Nothing skips the candles; a skip (Esc / Enter / Space / a click) works from 2 s into the fireworks. The held state is keydown/keyup state (never key repeat) and is
  cleared on blur.
- Pure logic (`src/finale.js`: blow progress, the deterministic out-order, failsafes, the phase schedule, the seeded firework show) and the drawing as shape lists
  (`src/finale-art.js`) are separate from the Phaser scene, so they are unit-tested (`tests/unit/finale.test.js`) and the layout could be checked by rasterising the
  same lists in node.
- All art is code-drawn from generic shapes (no PNGs, no logos). The sound is synthesized by `tools/make-audio.js`: a soft "pff", a firework whoosh / pop / crackle,
  and a two-voice chiptune of the public-domain "Happy Birthday to You" tune (`tools/lib/happy-birthday.js`, about 14.9 s, `oneShot` in the sound registry: the one
  non-looping music sound). The scene works fully silent.
- The name is the card's recipient ("Taru" by default) through `buildCardConfig()`; no age is shown in the finale.

## Consequences

- The offline bundle grows by the song's ~650 KB WAV (generated audio is not converted to MP3; only Ogg is). `tests/unit/pack-offline.test.js` allows that one file above 100 KB.
- `tests/unit/audio.test.js` allows one declared `oneShot` music sound.
- Nothing about the finale could be looked at in a browser while it was built (the build-first-then-test rule): hold-key behaviour across browsers, draw order, performance
  and the sound of the synthesized song are the things to check in the quality loop.
