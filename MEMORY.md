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

## 2026-09-13 — Tutorial, minimap, inventory bar, enterable house with NPC

**Did:**
- Split into a world scene (restarted on every map change) and a UI scene that stays running
  (minimap, 5-slot hotbar, dialog box, toasts, tutorial card + objectives checklist).
- Added a second map (Tomas's house interior), doors between maps (warps), pickups, and an NPC
  whose conversation gives the player a sword.
- Asset script now writes `tiles.json` (name, solid, minimap color per tile). Maps refer to
  tiles by name, so tile order in the tileset can change freely.
- Tested the whole flow in the browser with synthetic keys: tutorial card → pickup → slot select →
  door (entered 6px off-center thanks to door assist) → talk → sword → tutorial complete → exit.
- Connected GitHub remote `MudMonster341/pixel`.

**Why:**
- The canvas is now 960x540 with the world camera at zoom 3, so the world still shows 320x180 art
  pixels but UI text renders at full resolution instead of blurry 3x-scaled text.
- The UI lives in its own scene so the tutorial progress and HUD aren't rebuilt on every map change.
  Anything that has to survive a map change goes in `GameState`.
- Door assist exists because a 10px-wide feet hitbox needs pixel-perfect alignment to fit a
  16px door between solid walls, which felt broken when tested.

**Decisions:** none new. This chunk has 6 source files, which is right at the ADR 0003 tripwire
(globals + manual script order). Next chunk moves to native ES modules.

**Failures:** none

**Next:** the owner wants a treasure-hunt game (NPCs give clues → find 3 items → open a secret
door). Build data-driven base systems (flags/conditions/actions, dialog scripts, speech bubbles,
interactables, journal), then write an art style guide and architecture rules to follow from now on.

## 2026-09-13 — Style guide, architecture rules and game plan (proposals)

**Did:**
- Wrote [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
  and [docs/GAME_PLAN.md](docs/GAME_PLAN.md) as v1 proposals for the owner to review.
- Proposed [ADR 0004](decisions/0004-es-modules-and-data-driven-content.md): native ES modules,
  and story logic as conditions + actions data.

**Why:**
- The owner asked for rules and a uniform method *before* more building, and wants to decide on
  them. So these are proposals and no engine refactor has happened yet.
- The treasure hunt (clues → 3 items → secret door) needs flags, conditional dialog, hidden
  entities and a locked door. Those are generic systems, so they come before any story content.
- Push to GitHub failed: the agent's shell can't show the credential prompt. The owner has to run
  the first `git push -u origin main` themselves. After that, pushes should work.

**Decisions:** [ADR 0004](decisions/0004-es-modules-and-data-driven-content.md) (proposed, not accepted)

**Failures:** none

**Next:** owner reviews the three docs + ADR 0004 and answers the open questions in GAME_PLAN.md.
Then Phase 1 (foundation) from GAME_PLAN.md.
