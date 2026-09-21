---
status: accepted
date: 2026-09-21
authored_by: agent
derived_from: ["owner brief 2026-09-21 (docs/STORY.md 'Opening')", "ADR 0013 (character recolor pipeline)"]
supersedes: null
superseded_by: null
---

# 0014 — Clothes-color customisation is one baked sheet per swatch, not a runtime recolor

## Context
The M3a opening (docs/STORY.md "Opening") asks for character customisation "at least clothes colour,
chosen from swatches with her sprite previewed live and animated... The choice is saved and applied
to her sprite everywhere in the game", and explicitly asks for the approach to be picked and
explained: "the cleanest approach is probably to generate one sheet per palette option, or to
recolour at runtime with a Phaser pipeline/texture copy; pick one, explain why."

ADR 0013 already established how the lead's sprite is built: `tools/make-assets.js` decodes the
vendor pack, recolors it with an exact-RGB swap table, and bakes the result into a committed PNG at
build time (`buildCharacter()`). This project also has no build step (ADR 0003/0004): every asset the
game loads is a static file already sitting in `assets/`, generated ahead of time, never computed by
the browser at runtime.

## Options considered
1. **Runtime recolor** (a Phaser render pipeline, or a canvas texture copy with per-pixel remapping
   done in the browser when she picks a swatch). Flexible -- any color, chosen at any time, no extra
   files -- but it's a second recolor mechanism alongside the exact-RGB table `buildCharacter()`
   already uses, running in a place (the browser, at play time) this codebase has deliberately never
   put art generation before. It would also need to run once per swatch just to *preview* them side
   by side on the customisation screen, and the "content is data, engine is code" split
   (docs/ARCHITECTURE.md) gets blurrier if the engine can also generate content.
2. **One baked sheet per swatch** (chosen): extend `buildCharacter()`'s existing recolor table with a
   small `CLOTHES_SWATCHES` map (`tools/make-assets.js`), and write one full `player-<id>.png` per
   swatch at build time -- the exact same mechanism ADR 0013 already uses for the campus NPCs, just
   parameterised over swatch instead of character. The game loads only the one file the player
   actually picked (`src/main.js` BootScene, keyed off `GameState.customization.clothes`); the
   customisation screen itself preloads all of them (they're a few KB each) so switching the live
   preview is instant.

## Decision
Bake one full character sheet per clothes swatch at build time, the same way every other character
recolor in this codebase already works, and pick which file to load at runtime rather than recoloring
pixels in the browser. It's the smaller change (a new recolor table plus a loop, not a new subsystem),
it keeps the "engine never generates art" rule ADR 0002/0012 already established, and it costs nothing
extra at runtime beyond loading one small PNG instead of one specific other small PNG.

**Hair and skin tone are not included in this pass**, despite the brief's "if the recolour pipeline
makes it cheap" hedge: costed out, they're not cheap under this approach specifically, because every
extra axis multiplies the number of sheets that have to be drawn, decoded and committed (5 clothes x 3
hair x 2 skin = 30 sheets, versus 5 today), and the customisation screen would need to preload all of
them just to preview a few at once. Clothes-only satisfies "at least clothes colour" and leaves
hair/skin as a follow-up if the owner asks for it after seeing this.

## Consequences
- Five new committed PNGs (`assets/player-pink.png` [== the original `player.png`], `-sky`, `-mint`,
  `-lavender`, `-sunset`), all generated, never hand-edited, same as everything else in `assets/`.
- `GameState.customization = { clothes: 'pink' }` is a new saved field (src/state.js, src/save.js),
  defaulting and round-tripping like every other GameState field; an old save missing it just gets the
  default rather than crashing.
- A future hair/skin axis is a bigger version of the same mechanism (more swatch tables, more baked
  sheets), not a redesign -- the runtime-recolor alternative was never blocked, just not worth it yet.

## Links
- Related: [ADR 0013](0013-characters-are-16x24-from-the-pack.md), [ADR 0012](0012-third-party-asset-packs.md)
