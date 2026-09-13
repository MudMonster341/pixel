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

## 2026-09-13 — Correction: GitHub push works

Corrects the previous entry, which said the owner must run the first push. The very next
checkpoint pushed successfully (credentials became available between the two attempts), and
`origin/main` now matches local. Checkpoints push normally from now on.

**Decisions:** none · **Failures:** none

**Next:** unchanged. Owner review of the `docs/` proposals.

## 2026-09-13 — Automated tests on every push + dev feedback overlay

**Did:**
- Test pipeline: 31 unit tests (`node:test`: maps valid and reachable, inventory, Tomas dialog,
  assets up to date, feedback store) and 26 browser tests (Playwright: boot, movement/collisions,
  pickups/slots, doors, NPC talk, tutorial, minimap, feedback overlay). They run in the pre-push hook
  (`.githooks`) and in GitHub Actions (`.github/workflows/test.yml`). All green locally.
- Dev feedback loop: overlay (`` ` `` in dev mode) with a screenshot you can click to mark a spot,
  captured game context, and an inbox for answering questions and confirming fixes.
  `server.js` API → `tools/feedback-store.js` → `feedback/items/*.json`, plus the agent CLI
  `npm run feedback`.
- Moved map building into `src/maplogic.js` so the game and the tests share it.
- Dev server now binds to 127.0.0.1 and refuses dotfiles and `node_modules`.
- Recorded owner decisions in GAME_PLAN.md. Accepted ADR 0004.

**Why:**
- The first browser-test run failed 3 tests that manual play had never caught: quick taps were
  dropped ([ERR-0001](ERRORS.md)). Fixing it (keydown events) is now an architecture rule.
- Feedback is stored as files, not in the browser or GitHub Issues, so the agent can read it
  directly and git keeps the history. The owner asked for "ask before building", hence the
  needs-info → answered loop.
- Browser tests use port 4173 and a temporary feedback folder, so they never touch real feedback or
  the dev server on 8080.
- Owner decisions: backpack instead of an on-screen hotbar (keep the hotbar code), no combat,
  characters stay 16×16, dialog choices with branching, saves designed for multiple profiles later.

**Decisions:** [ADR 0004](decisions/0004-es-modules-and-data-driven-content.md) accepted,
[ADR 0005](decisions/0005-automated-tests-on-every-push.md), [ADR 0006](decisions/0006-dev-feedback-loop.md)

**Failures:** [ERR-0001](ERRORS.md) (quick key taps ignored)

**Next:** Phase 1 of GAME_PLAN.md, starting with the ES modules move (the browser tests are the
safety net), then events, flags/scripts, content registry, and profile-ready save/load. The first
GitHub Actions run hadn't been observed when this entry was written.

## 2026-09-13 — Real campus research and map plan (BITS Pilani Dubai)

**Did:**
- The owner set the real game: recreate the **BITS Pilani Dubai campus** (multi-floor interiors, DIAC
  Park nearby) for a story about a new student and the **LUG treasure hunt**. The meadow and house
  are test maps.
- Researched the official 3DVista tour, OpenStreetMap, Wikimedia Commons, Google satellite,
  Wikipedia and the official facilities pages. Wrote [docs/CAMPUS_MAP_PLAN.md](docs/CAMPUS_MAP_PLAN.md)
  and [docs/research/](docs/research/).
- Pulled the tour's 143 Dubai scenes and the links between them (walking routes) into
  `docs/research/bits-dubai-tour-scenes.json`. Took true building sizes from OpenStreetMap.
- Corrects the previous entry's open point: the first GitHub Actions run (acb9402) passed.

**Why:**
- The tour has **no floor plans**, and its overview map and "Floor Plan" panel come from another
  BITS campus's template. Staircase positions can't be taken from public data, so the plan asks the
  owner for photos of the fire evacuation plans.
- Proposed 2 m per tile outdoors: at 1 m the 412×343 m campus takes about 80 s to cross and feels empty.
  Indoors at 1 m for furniture. Both are to be tested as walkable greyboxes before any art.
- The map is rotated about 35–40° to line up with the campus walls, because pixel buildings need
  grid-aligned walls.
- Tour, Google and Wikimedia images are reference only; only facts and measurements are in the repo.
  No real logos or people without permission.

**Decisions:** none accepted yet. Tiled maps and the scale choice need owner answers, then an ADR.

**Failures:** none

**Next:** owner answers the 7 questions in CAMPUS_MAP_PLAN.md. Meanwhile Phase 1 foundation work
(ES modules, events/flags, save) is still the prerequisite.

## 2026-09-13 — First real feedback items triaged (FB-0001, FB-0002)

**Did:**
- Found the owner's first two overlay items, which the previous checkpoint committed.
- **FB-0001** (high): in the house the player can be hidden under the hotbar, because the room is 12 tiles
  tall and the camera can't scroll the player above the bottom UI.
- **FB-0002:** show the equipped item on the character, add use animations (sword swing, eat apple),
  and keep only the sword and apple.
- Asked clarifying questions on both (status `needs-info`). Nothing built yet.

**Why:** both overlap earlier owner decisions (backpack replaces the hotbar; no combat) and the new
campus direction, so the design is the owner's call. Proposed for FB-0001: hide the bar in favour of
an equipped-item icon plus backpack, and keep camera headroom so UI never covers the player.

**Decisions:** none · **Failures:** none

**Next:** owner answers in the overlay inbox (FB-0001, FB-0002) and the campus plan questions.
