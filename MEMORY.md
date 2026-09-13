# Memory

Append-only log, one entry per work chunk, newest at the bottom. Read recent history with
`tail -n 150 MEMORY.md`.

## 2026-09-13 — Bootstrap: playable character on a tile map

**Did:**
- Chose the stack and built the first playable version: Phaser 3 scene with a tilemap, a player
  with 4-direction walk animation, collisions, and a camera that follows the player.
- Wrote all starter art as text sprites in `tools/make-assets.js` (8 tiles, 9 player frames), which
  outputs PNGs with a zero-dependency encoder.
- Generated a 40x30 starter map (paths, pond, lake, tall grass, trees, rocks) as editable text rows.
- Set up project memory (CONTEXT, MEMORY, ERRORS, decisions/, checkpoint scripts) and git.

**Why:**
- The owner asked for a free, small, Pokémon-looking game heading toward ROTMG, and wants the agent
  to make the choices. A browser engine matches ROTMG's platform.
- Only the feet collide (10x6 body at the bottom of the 16x16 sprite) so the player can walk close
  to trees and rocks, as in top-down Pokémon games.
- Tested movement with synthetic key events: 80 px/s, the player stops at the tree border
  (y=14), and diagonal speed stays at 80.

**Decisions:** [ADR 0001](decisions/0001-use-phaser-3-in-the-browser.md),
[ADR 0002](decisions/0002-generate-pixel-art-from-code.md),
[ADR 0003](decisions/0003-no-build-step.md)

**Failures:** none

**Next:** get the owner's feedback on look and feel, then roadmap step 2 (depth sorting so the
player goes behind tree canopies, and animated water). Blocker for pushing: no GitHub remote yet.
