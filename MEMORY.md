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

## 2026-09-13 — Campus test version (step C1): OpenStreetMap → Tiled map, female lead

**Did:**
- Owner answered the campus questions: 2 m outdoors / 1 m indoors, entrance-straight orientation,
  DIAC Park and the road to it, other buildings not enterable, empty rooms first, hostels outside only,
  female lead (pink, black hair, fair), private project so BITS name is fine.
- Built `tools/campus/build-campus.js` + `layout.js` + a committed OSM extract. It writes
  `assets/maps/campus.json` (Tiled, **422×338 tiles = 844×676 m**) and a preview image.
- The game loads Tiled maps: multiple layers, collision from tiles.json, spawn and objects from the map.
  The campus is now the start map; test maps open with `?map=meadow`. The minimap became a texture that
  scrolls with the player on big maps. The tutorial checklist only appears on maps with `tutorial: true`.
- Added 14 campus tiles, a shared PNG encoder (`tools/lib/png.js`), and redrew the player as the female lead.
- Tests: `tests/unit/campus.test.js` (map up to date, spawn walkable, Main Block door reachable,
  buildings present) and `tests/e2e/campus.spec.js`. 36 unit + 30 browser tests pass.

**Why:**
- OSM wall angles show two grids ~45° apart: the academic buildings run ~5° off north, while the fence,
  hostels, track and D54 run ~39°. The map follows the fence/road grid and rotates the academic
  complex as one group. The gate is at the bottom so door-side walls face the viewer; `flip` would put it
  at the top.
- Fitting a circle to the DIAC ring's OSM ways failed (radius 397 m instead of ~222 m, because connector
  roads pulled the fit), so the ring is measured and set in `layout.js`.
- Track, courts and parking aren't in OSM. They were measured from the Wikimedia annotated campus map
  (~3.8 px/m, checked against the OSM drop-off loop to within ~7 m).

**Decisions:** [ADR 0007](decisions/0007-campus-map-from-osm-into-tiled.md)

**Failures:** none worth an ERRORS entry. The ring-fit problem was caught and fixed before commit
(see Why).

**Next:** the owner walks the test version and sends feedback. Then C2: campus art (entrance, Main
Block front, trees and palms), tidy the diagonal fence and paths near the academic complex, and
start the Main Block ground-floor interior.

## 2026-09-13 — Feedback overlay opens with O

**Did:** the owner couldn't open feedback with the backtick. **O** now opens and closes the overlay
(the backtick still works, and typing "o" in a field doesn't close it). The launcher became a large
yellow "Feedback O" button. The controls card lists "O: Give feedback" in dev mode. Tests were added
for the O key and the button.

**Why:** backtick isn't in the same place on every keyboard layout (the owner reported it as the
apostrophe key). Also, the old launcher was small, navy, and sat in the letterbox outside the game
picture, which made it easy to miss.

**Decisions:** none · **Failures:** none

**Next:** unchanged. The owner walks the campus test version and sends feedback.

## 2026-09-13 — Feedback batch FB-0001–FB-0017 triaged; Sonnet agents implement

**Did:**
- The owner answered FB-0001 (option B: compact hotbar, see-through when the player is behind it) and
  FB-0002 (holding an item shows it on the character; add keycard, phone and other university items).
- 15 new items came in from walking the C1 campus: angular map, diagonal fences and paths, a random
  structure near the gate, uneven or too many paths, no clear Gate 2 entrance, merged buildings, roads
  without kerbs, flat pavement art, too little greenery, the tennis court, running.
- Grouped into three packages: gameplay (FB-0001, 0002, 0017), campus art (FB-0006, 0014, 0015, 0016),
  campus layout (FB-0003–0005, 0007–0013). Marked in-progress/planned.
- Wrote [ADR 0008](decisions/0008-campus-as-straight-schematic-plan.md), which supersedes 0007: the campus
  becomes a hand-designed straight plan measured from OpenStreetMap instead of rasterised from it.
- Owner rule: **Sonnet agents implement the fixes; the main agent only monitors** (briefs, review, tests,
  browser check, statuses, checkpoints). Recorded in FEEDBACK.md and CLAUDE.md.

**Why:** the screenshots show the raw OSM rasterisation creates exactly the problems the owner hates
(stair-step diagonals, odd leftovers, uneven widths). Heuristic clean-up would keep leaking, so a
schematic plan is the durable fix. The layout package depends on the new art tiles, so art goes first.
Gameplay doesn't touch the campus files, so it can run alongside in a separate worktree.

**Decisions:** ADR 0008 (supersedes 0007) · **Failures:** none

**Next:** the gameplay agent (worktree) and the art agent (main tree) run in parallel; then the layout
agent. Review, test, `feedback fix` and checkpoint after each.

## 2026-09-13 — Campus art kit landed (Sonnet agent), reviewed

**Did:**
- The art agent (Sonnet) added 64 campus tiles, 108 in total:
  - kerbed road edges and corners, lane lines, zebra crossings, a bordered walkway
  - lawn variants, hedge, bush, flowerbed
  - tree and date-palm trunks with 2×2 **overhead** canopies (new `overhead` flag in tiles.json)
  - tennis court lines and net
  - slimmer BITS and other building walls, parapet roof edges, entrance, pillar
  - a straight fence and gate kit
- It also redrew paving with a 4-tone bevel, added `tests/unit/campus-tiles.test.js` (15 FB-XXXX tests),
  the `docs/research/campus-tile-kit.png` catalog, and a "Campus kit" section in STYLE_GUIDE.md.
- Both agents were cut off once by the account usage limit and resumed with SendMessage; no work was lost.
- Review: scope respected (only `make-assets.js`, generated assets, STYLE_GUIDE, a new unit test,
  regenerated campus map and preview). My own run: 51 unit + 32 browser tests pass.

**Why:** these items stay `in-progress`, not `fixed`: the tiles aren't placed on the campus yet, so the
owner couldn't verify anything in-game. They get marked fixed when the layout agent uses them.
Small art nits for the layout agent to fix: the tennis net is drawn as two strips, and in the
mock-up the tree trunk sits apart from its canopy.

**Decisions:** none · **Failures:** the harness couldn't create an agent worktree (the session started
before `git init`), so the gameplay worktree was made by hand with `git worktree add`.

**Next:** commit the art, start the layout agent (ADR 0008 plan, Gate 2, overhead canopy layer), then
merge the gameplay branch when that agent reports.

## 2026-09-16 — Full review, docs refresh, work plan (feedback → campus v2 → interiors → cutscene → QA)

**Did:**
- The owner asked for a review of all feedback plus anything else that stands out, then fixes,
  interiors, a Pokémon-style Gate 2 cutscene with a message, full QA, updated docs, and a live game
  to keep testing.
- Re-read FB-0001–0017. The gameplay three (0001, 0002, 0017) are built on `feedback/gameplay` but not
  merged. The campus items were rebuilt in C1.5 (509a867) and wait for the owner to check them.
- My own review of C1.5 found:
  - the campus is a square, not the real strip
  - roads aren't connected, with no ring road and the parking lot not joined to any road
  - too much empty desert, including an oversized park
  - no signs or location names
  - trees on a visible grid, and sports areas as islands
- Wrote [docs/plans/2026-09-16-feedback-interiors-cutscene-qa.md](docs/plans/2026-09-16-feedback-interiors-cutscene-qa.md)
  (packages P1–P5) and [docs/QA_PLAN.md](docs/QA_PLAN.md) (coverage matrix), and updated CONTEXT.md.

**Why:** the owner wants to keep testing while the work continues, so each package ends playable,
checkpointed, and with the server restarted. The gate trigger lives in the campus map, so the cutscene
runs in its own worktree alongside the campus rebuild.

**Decisions:** none new (ADR 0008 still holds) · **Failures:** none

**Next:** P1 merge (Sonnet), then P2 + P4 in parallel.

## 2026-09-16/17 — Overnight: campus v2 (ADR 0009), cutscene, interiors running in parallel

**Did:**
- FB-0021: the owner rejected C1.5's square schematic and chose "Real layout, straightened" in chat.
  Wrote ADR 0009, which supersedes 0008.
- New feedback triaged:
  - FB-0018: a full-screen map
  - FB-0019: palm and tree trunks detached from their canopies
  - FB-0020: the tennis net drawn as a thick block
- FB-0001, 0002 and 0017 merged (04cc7c8) and marked fixed. The owner verified FB-0007 to FB-0016 in the inbox.
- A stable play copy runs from worktree `../2D_pixel_game-play` (launch config "play", feedback still
  written to the main tree), so agents' half-finished edits don't break the owner's session.
- Three Sonnet agents are running in parallel:
  - P2 campus v2 (main tree)
  - P4 cutscene, location banner and full-screen map (`feature/cutscene` worktree)
  - P3 interiors for all Main, Library and Mechanical Block floors (`feature/interiors` worktree)
- The owner asked for straight interior layouts with classrooms properly placed, and a full layout.
- All three agents hit the account usage limit around midnight and were resumed with SendMessage after the reset.

**Decisions:** ADR 0009 · **Failures:** usage limit (not a code problem)

**Next:** review and merge in order: P2 (main) → P4 → P3, with Sonnet resolving any merge conflicts;
then QA (P5); then a morning update for the owner.

## 2026-09-17 — Overnight results: C2 campus, interiors, cutscene, QA pass merged

**Did:**
- **P2 (C2 campus):** first review sent back staircase academic buildings, a missing D54, fence/park
  overlap and a leftover cross through the park; the fix pass solved them (rectangle decomposition of
  footprints, a ring shift). Committed cc6bbdf.
- **P4 (cutscene):** first review sent back an overlapping sign text and an empty background; fixed, then merged 19c0a08.
- **P3 (interiors):** 8 floors, straight corridors, tour room names, furniture per room type,
  Tiled door/stairs warps. Merged 9625f78.
- **P5 (QA):**
  - `qa:shots` screenshot sweep and performance/robustness tests (38df4ee).
  - Flaky e2e root causes fixed (ERR-0002/0003).
  - Full-map label clutter fixed.
- **Follow-up fixes (3646d49):**
  - minimap caption fit, building area names, D54 kerbs/lanes, atrium void art
  - FB-0022 (owner, 04:04): walkways drawn over building roofs, roofs looking like pavement, trees
    crowding paths. The QA agent had missed this (it checked wall tiles, not roofs).
- Feedback: FB-0018–0022 marked fixed. Asked the owner where the real main entrance is (FB-0022).
- Sonnet agents hit the account usage limit 4 times overnight and were resumed each time.

**Why:** QA screenshots plus my own review before merging caught most layout problems, but the owner still found one first, so review rules now include "check roofs too".

**Decisions:** none new · **Failures:** usage limits; one QA miss (roof check)

**Next:** owner verification; the Gate 2 position; interior polish from feedback.

## 2026-09-20 — Story, roadmap, the scheduled loop, and M1 save/load

**Did:**
- The owner told the full story (LUG treasure hunt, three keys won through mini-games, ending in an
  animated birthday card) and set the finish line: a sendable Windows .exe in 2-4 weeks, with
  Pokémon-class art. Wrote [docs/STORY.md](docs/STORY.md) and [docs/ROADMAP.md](docs/ROADMAP.md) (M1-M7).
- Decisions recorded: [ADR 0010](decisions/0010-ship-as-windows-exe-and-web-build.md) (Electron .exe,
  web build kept for dev) and [ADR 0011](decisions/0011-autonomous-roadmap-loop.md) (a scheduled loop
  over the roadmap, every 3 hours, owner feedback first). GAME_PLAN and CONTEXT updated.
- Checked for real BITS Dubai floor plans: none are published (official site, 2025 prospectus PDF,
  Wikipedia, 2GIS, Google). The virtual tour's scene links stay the best source. Asked the owner for
  the Physics Lab, ICVL and Room 195 positions.
- First roadmap task done by a Sonnet agent: quest state (stage, 3 keys) + versioned, profile-ready
  save/load in `src/save.js`, autosave debounced on real events, `?save=0` and `?profile=` switches,
  player position restored on reload. 145 unit + 63 e2e tests.

**Why:** the loop needs a written source of truth because each scheduled run starts with no memory
of the last one, so the roadmap, ADRs and this log are how work carries across runs.

**Decisions:** ADR 0010, ADR 0011 · **Failures:** one e2e flake remains (world-bounds edge test,
passes on repeat); logged as an M7 task.

**Next:** M1 data-driven NPC dialog with flag conditions and `onEnd` actions, so the quest stage and
keys are actually set by the story.

## 2026-09-21 — Opening flow, and art moves to real asset packs

**Did:**
- **Opening (FB-0023, FB-0024):** title screen ("BITS DUBAI / The LUG Treasure Hunt", panning gate art,
  press-enter then a menu panel), a real loading screen, an ESC pause menu with Quit to Title, and the
  overflowing controls card replaced by hints that appear when first needed. `docs/GAME_FEEL.md` is now
  the UI standard (studied from how Pokémon structures its opening, dialog and transitions).
  Found and fixed ERR-0004 on the way: the HUD's listeners weren't torn down on quit, so relaunching crashed it.
- **Art direction (FB-0025):** the owner said to stop drawing assets and use ready-made packs, then
  downloaded LimeZu Modern Interiors Free and Sprout Lands Basic. [ADR 0012](decisions/0012-third-party-asset-packs.md)
  supersedes 0002: art comes from packs, we draw only what no pack covers. The owner declined the paid
  Modern Exteriors pack, so the BITS blocks get built by us in the packs' style instead (ADR 0012 addendum).
- **First swap landed:** a PNG decoder plus an atlas-blit path in make-assets, and paths, kerbs, roads,
  lane lines, crossings, grass and new parked cars now come from Kenney's CC0 city pack.
  179 unit + 72 e2e tests. Kerbs went from a black-and-white barcode to terracotta brick; the car park reads properly.
- Licences: the two owner-supplied packs are non-commercial with credit required, so the game must never
  be sold, and raw packs stay out of git (gitignored); CREDITS.md lists everyone.

**Why:** the owner's judgement on the art was right, and packs cost nothing but a licence constraint
that a private gift can live with.

**Decisions:** ADR 0012 (+ addendum) · **Failures:** ERR-0004

**Next:** Sprout Lands greenery, the BITS building kit in the packs' style, then interiors and characters
from LimeZu. A research agent is checking free character packs and free UI/sound packs.

## 2026-09-21 — The lead stops being a blob

**Did:** characters now come from LimeZu's free pack, recoloured in the generator: the lead is Amelia
with black hair, fair skin and a pink top, with a 6-frame walk in all directions and an idle
animation; the LUG volunteer and two background students come from Adam, Alex and Bob. Character
frames moved 16×16 → **16×24** ([ADR 0013](decisions/0013-characters-are-16x24-from-the-pack.md)),
which touched the sprite loaders, animations, held-item offsets and the physics body.
182 unit + 74 e2e tests.

**Why:** the owner said the character art looked bad, and it did. The taller frame is what the pack
needs and is the usual proportion for this kind of game.

**Decisions:** ADR 0013 · **Failures:** a wrong body-offset derivation broke the house door until the
e2e tests caught it; the invariant (feet at origin + 8) is now written down in the ADR.

**Next:** Sprout Lands greenery, then the BITS building kit in the packs' style, then interiors.

## 2026-09-21 — M3a: the opening (title redesign, Mustafa, name entry, customisation, the bus)

**Did:** built the whole opening the owner's brief described (docs/STORY.md "Opening"), in
`../2D_pixel_game-intro` (branch `feature/intro`, based on `main` at `08c0295`):
- **Title screen redesigned:** big drawn buttons (`src/scenes/ui.js` `Button`/`drawButtonState()` --
  bevelled, drop-shadowed, hover/pressed states, keyboard and mouse both drive the same visual) and a
  second parallax layer (`assets/cutscenes/title-fg.png`, a palm/fence silhouette scrolling faster
  than the existing gate pan) instead of the old plain text-row menu.
- **Four new scenes chain off "Play"** (`src/scenes/intro-greeting.js`, `intro-name.js`,
  `intro-customize.js`, `intro-bus.js`): Mustafa's portrait + dialog greeting; name entry (real typing
  + an arrow-key/mouse on-screen keyboard, 10-char letters/spaces, a default that skips it in one
  Enter); clothes-color customisation (5 swatches, live animated preview); a bus drives in, stops,
  she steps off, it pulls away, then hands off to the existing campus spawn/Gate 2 cutscene unchanged.
  `?intro=0` skips the whole chain, the same shape as `?title=0` (tests/e2e/helpers.js openTitle()/
  openGame() both default it off, so none of the other specs needed to change).
- **New art**, all generated (`tools/make-assets.js`, `tools/make-cutscenes.js`, never hand-edited):
  5 clothes-swatch character sheets ([ADR 0014](decisions/0014-opening-customisation-recolor-sheets.md)),
  Mustafa's portrait, the bus sprite, the title's parallax strip, and a new "entrance" cutscene
  illustration (Main Block steps/pillars/arch), triggered by a map object the same way Gate 2's is
  (`tools/campus/build-campus.js`).
- **"A little 3D" pass, written into docs/GAME_FEEL.md:** every panel gets a 1px inner bevel now (one
  change to `drawPanel()`, so the whole game's UI lifted at once); the player and NPCs cast a ground
  shadow; every new tween eases instead of moving linearly.
- Found and fixed two real bugs by looking at the screenshots and running the tests repeatedly, not
  just reading the code: `WASD` aliased to the on-screen keyboard's arrow navigation silently stole
  focus off "OK" whenever her own name contained one of those letters (ERR-0005); typing over the
  pre-filled default name appended to it instead of replacing it, first caught by
  `tools/qa-shots-intro.js`'s own screenshot, not a test.
- 184 unit + 81 e2e tests (was 182 + 74 on `main`), all green with `E2E_PORT=4180 npm test`. One
  pre-existing, unrelated e2e flake confirmed via `git stash` against `main`'s own committed code
  (`held-item.spec.js`, a ~2px timing margin) -- not touched, out of scope for this task.

**Why:** the owner's words were "it looks really bad right now... a little 3D please" -- the title/
opening is the very first thing anyone sees, so it got real design effort and several passes at the
actual screenshots (`qa-shots/intro/`), not just a functional pass.

**Decisions:** ADR 0014 · **Failures:** ERR-0005

**Next:** merge `feature/intro` into `main` (another agent is changing building/greenery art on `main`
in parallel -- expect to merge, not rebase blindly); then the Main Block foyer/LUG stall (M3 beat 4).

## 2026-09-21 — The opening, and buildings that look like buildings

**Did:**
- **Opening (M3a, owner brief):** title screen with big bevelled buttons and parallax, Mustafa's
  greeting with a portrait, name entry (typed + on-screen keyboard, saved and used in-game), clothes
  colour customisation with a live animated preview ([ADR 0014](decisions/0014-opening-customisation-recolor-sheets.md):
  one baked sheet per colour), the bus arrival at the gate, and a Main Block entrance cutscene.
  Built on `feature/intro`, merged (conflict was only the generated campus.json: regenerated).
- **Art:** greenery from Sprout Lands (seamless hedges, bushes, flowerbeds, tufts, recoloured to a dry
  campus green), and BITS buildings now get a 4-tile front facade (cap / windows / body / base) so they
  read as buildings; paving stops at walls instead of painting over them; the Main Block has the red-arch entrance.
- **Fixed:** the held-item position for 16×24 frames (velocity extrapolation, not a looser test).
- 192 unit + 81 e2e tests green.

**Why:** the owner's "it looks blocky and bad" was right on both the opening and the buildings.

**Decisions:** ADR 0014 · **Failures:** ERR-0005 (WASD stole on-screen-keyboard focus during name entry)

**Next (owner, high priority):** rebuild the campus LAYOUT from satellite imagery. Their reference
screenshot ([docs/research/reference/owner-google-maps-orientation.jpg](docs/research/reference/owner-google-maps-orientation.jpg))
shows D54 along the top, the entrance on the lower right with a roundabout just inside and parking on
both sides, a loop road round the academic core, and the sports field at the west end.

## 2026-09-22 — Campus layout v3, and a real bug behind a "flaky" test

**Did:**
- **Campus v3** from the owner's satellite reference: Gate 2 moved off the Main Block centreline to the
  east (0.82 across the fence), a square roundabout with a hedged island just inside the gate, parking
  on both sides of the entrance road, and a loop road round the academic core instead of one straight
  avenue. Sports field, hostels, DIAC Park and the building art are unchanged. 196 unit + 81 e2e green,
  with four new FB-0026 tests (roundabout position, parking both sides, loop encircles the core,
  spawn→Main Block walk stays on roads).
- **ERR-0006:** the "flaky" held-item test was a real bug. Held-item position guessed the player's
  movement as velocity × frame delta, but Arcade Physics steps on a fixed 1/60 s clock, so on the frame
  you turn, the item could sit ~2.7 px out of place. It now reads the body's actual step for that frame.

**Why:** the owner said the map didn't match the real campus; it didn't, structurally. A test that only
fails under load is a bug until proven otherwise, and this one was.

**Decisions:** none new · **Failures:** ERR-0006

**Next:** interiors from LimeZu (Room Builder walls/floors + furniture), then M3 story content
(the LUG stall, the three key rooms), then mini-games.

## 2026-09-22 — Interiors from packs, and the game becomes playable end to end

**Did:**
- **Interiors art:** furniture now comes from free packs (new: a CC-BY seating pack for the auditorium,
  a CC-BY laboratory tileset for lab kit; plus LimeZu and Cool School already local), recoloured to the
  campus palette. All 8 floors re-dressed; the Main Block foyer got a reception desk, seating, plants
  and a staircase with the **LUG stall nook** behind it.
- **Story spine (M3):** the LUG volunteer greets her by the name the player typed, sets the hunt,
  hints by how many keys she holds, and hands over the box at the end. Three keys are interactables in
  the Physics Lab (3rd floor), the ICVL (1st) and Room 195, each routed through a `minigame` action
  that's a no-op until M4. Doors the story doesn't use are politely locked. Quest tracker and journal (J) added.
  Story text lives in data (`src/story.js`).
- 242 unit + 82 e2e tests green.

**Why:** the point of the loop is a finished gift, so the spine had to exist before polish; mini-games
slot into the existing action without rewriting story data.

**Decisions:** none new · **Failures:** none

**Next:** M4 mini-games (platformer, flappy, Tetris) behind the three keys, then the reward box opening
and the birthday card, then sound and packaging.

**Owner to confirm:** the real locations of the Physics Lab, the ICVL and Room 195 (rooms were placed
on plausible floors), and whether keys should leave the bag when handed in.

## 2026-09-22 — Mini-games and the ending

**Did:**
- **Mini-games (M4):** a framework (intro card, HUD, retry, **skip offered after 3 losses** so the gift
  can never be blocked, outcomes saved) plus three games behind the three keys: a Physics Lab
  platformer with coyote time and variable jump, an ICVL server-room flappy, and Room 195 Tetris with
  a NEXT box and score panel. Art pass gave each a themed backdrop and put her real sprite in as the hero.
- **The ending (M3):** the reward box opens with sparkles and a wash of light, then a full-screen
  animated birthday card: one centred card, framed photo slideshow, typed messages, confetti and corner
  motifs, ending on THE END and back to the title, with "Watch the Card Again" once finished.
  Owner content goes in `assets/card/` (gitignored): `card.json` + `photos/` + optional `video.mp4`,
  with placeholders until then. Video paths fall back to drawn art when a file is missing.
- 291 unit + 89 e2e tests green.

**Why:** with the spine playable, the ending is the point of the whole thing, so it got the care.

**Decisions:** none new · **Failures:** a batch of e2e failures turned out to be machine load from
running the suite alongside an agent's own run; the specs pass individually and on a quiet machine
(same family as ERR-0002/0003). Real bugs the agent found: Phaser reports a 404'd video as loaded,
and server.js served .mp4/.jpeg as octet-stream.

**Next:** packaging as a Windows .exe (M6), then sound and music (M5), then the three key-room cutscenes.

## 2026-09-26 — Paused for the owner to play; where everything stands

**The game is complete end to end** and buildable as a Windows package.

**Done and on main (all pushed, 306 unit + 91 e2e green):**
- Opening: title screen (BITS DUBAI), Mustafa's greeting, name entry, clothes customisation, the bus
  arrival at the gate, the Main Block entrance cutscene.
- Campus v3 from satellite: gate on the lower right, roundabout inside it, parking both sides, loop
  road, facades with windows, greenery and roads from packs.
- Interiors: 8 floors furnished from free packs, foyer with the LUG stall nook.
- Story: the volunteer, three keys (Physics Lab, ICVL, Room 195), locked doors, quest tracker, journal.
- Mini-games: platformer, flappy, Tetris, each themed, with retry and a skip after three losses.
- Ending: the reward box opening and the animated birthday card (owner content goes in `assets/card/`).
- Packaging: Phaser and the font vendored (runs offline), Electron wrapper, icon, and
  `npm run pack:win` → a 110 MB zip containing PixelQuest.exe. Verified by launching the exe.

**Parked, not on main:** `feature/audio` (music, sound effects, volume settings). It fails
`tutorial.spec.js` "completing every step finishes the tutorial" repeatably — the completion toast
never replaces the sword toast — so it stays off main until that's fixed properly.

**Waiting on the owner:** verify the 12 fixed feedback items; the real locations of the Physics Lab,
the ICVL and Room 195; the card's photos, names and messages; and optionally the pixel video clips
([prompts](docs/research/cutscene-video-prompts.md)).

**Next when work resumes:** fix the audio regression and merge `feature/audio`, the three key-room
cutscenes, then a full QA pass over the finished game.

## 2026-09-26 — Paused at the owner's request; HANDOFF.md written

**Did:** stopped all agents, parked the audio work on `feature/audio`, built the sendable package
(`dist/PixelQuest-win32-x64.zip`, 110 MB) and launched the exe to confirm it runs, then wrote
[HANDOFF.md](HANDOFF.md): current state, what's done, known problems, the MVP order, what's waiting on
the owner, how the 3-hourly loop works and the rules that must not be broken. CLAUDE.md, CONTEXT.md and
ROADMAP.md now point at it.

**Why:** the owner wants to play the whole game and give feedback across a full playthrough, and wants
a clean starting point for the next session because usage limits keep ending sessions mid-task.

**Found while pausing:** `tests/e2e/tutorial.spec.js` "completing every step finishes the tutorial"
fails **repeatably on main**, not just with the audio branch, so it predates that work. It blocks
pushing (the pre-push hook runs the tests and `--no-verify` is forbidden), so the latest docs commit
is local until it's fixed. That's task 1 next session.

**Decisions:** none · **Failures:** the tutorial-toast regression above

**Next:** fix the tutorial toast, push, merge audio, then the owner's full playthrough drives the rest.

## 2026-09-27 — Premium pass started; bug batch FB-0035..0043 merged

**Did:** the owner asked (2026-09-26, in chat) for a complete quality pass after playing: no 3D
presence, mirrored walk, pavements that look like brick walls, an entrance and foyer that should look
like the real photos, choppy disconnected cutscenes, "I don't understand what's going on" when she
walks in. Recorded as FB-0027..0034, plus the 2026-09-26 code review as FB-0035..0043. Plan:
[docs/plans/2026-09-26-premium-pass.md](docs/plans/2026-09-26-premium-pass.md), 7 stages.
- Research (Sonnet): 32 campus photos + per-space build specs (docs/research/campus-visual-reference.md),
  free packs (docs/research/asset-packs-2026-09-26.md). Coordinator downloaded the CC0 Ninja Adventure
  pack (palms, trees, animated flags, FX, UI) through itch.io's free download page (owner approved).
- Bug batch (Sonnet, worktree): HUD keys gated while a cutscene/mini-game/fade owns the screen; toast
  queue and the tutorial race fixed at its cause (npc-talked now fires after the dialog opens); honest
  credits; clothes-colour reload; hints by missing key; overwrite-save confirm; journal redraw/scroll;
  `take` action so the volunteer collects the keys and the box always fits; mini-game input polish;
  real left/right character rows (ERR-0007). 315 unit + 115 e2e.
- ADR 0015 (y-sorted depth groups, door entry) and ADR 0016 (cutscenes play in the world) written.
- A `.session-active` lock (docs/ROADMAP.md) keeps the 3-hourly loop out while a live session drives.

**Why:** the owner's playthrough; the tutorial fix also unblocks pushing.

**Decisions:** ADR 0015, ADR 0016; the keys leave the bag at the reward (answers an open owner question).

**Failures:** usage limit stopped both agents once; resumed with SendMessage, no work lost. One
`story.spec.js` timeout in a full run while another agent was also running e2e: passes alone and on
repeat (18s), host load (ERR-0002/0003 family).

**Next:** merge the campus-art stage (paths, palms, entrance), then the depth engine, interiors, in-world
cutscenes.

## 2026-09-27 — `feature/audio` merged into the FB-0035..FB-0043 bug batch (M5 sound)

**Did:** merged the parked `feature/audio` branch (music, sound effects, volume settings, 321 unit
tests at the time) into a worktree branch already caught up to `main` (dbce111, the FB-0035..0043 bug
batch). One real conflict, in `src/scenes/title.js` (both sides added Up/Down keydown handlers on the
same lines: audio's Controls-panel setting scroll vs. the bug batch's Credits scroll and "start a new
game?" confirm) -- resolved by priority-ordering all three (new-game confirm > Controls settings >
Credits scroll > the plain menu), since the three overlays are never open at once. Everything else
auto-merged cleanly (non-overlapping hunks in the same files: `world.js`'s footstep sfx sat right next
to FB-0043's real left/right animation rows, `framework-scene.js`/`flappy.js`/`platformer.js`'s sound
calls sat next to FB-0042's input-delay/hover-prompt work) -- checked each by hand against both
branches' diffs, not just trusted a clean auto-merge.

**Adapted audio to the new main:** menuMove/menuConfirm sfx added to the two pieces the audio branch
never saw -- the Credits panel's scroll (FB-0037) and the new-game overwrite confirm (FB-0040), both
in `src/scenes/title.js`. Confirmed the FB-0035 HUD-gating rule already covers every sound-emitting
path for free: `movePlayer()` zeroes `dx`/`dy` (so no footstep) and `update()` returns early
(`this.transitioning`) before any sound-triggering code runs, whenever `worldHasControl()` would say
no -- no gated key needed a separate silence fix. Added the audio packs (Kenney RPG/UI Audio, Kenney
Music Jingles, Aureolus_Omicron's 15 Melodic RPG Chiptunes -- already in CREDITS.md via the clean
merge) to the in-game Credits text too, extending FB-0037's own test to check for them
(`'Kenney Vleugels'`, `'Aureolus_Omicron'`) -- caught one real bug doing this: a two-line credit split
"Kenney" and "Vleugels" across two separate array entries, which the panel's own `\n` join broke
apart exactly the way this file's header comment warns against; fixed by keeping the whole phrase on
one short line, per that same file's own established convention.

**Test fixed, not just adapted:** `tests/e2e/audio.spec.js`'s pause-menu/title-Controls settings tests
used a bare `page.keyboard.press()` sequence (move to a row, adjust it, move again...) with only the
*final* state wrapped in `expect.poll` -- exactly the ERR-0003 shape (a dropped one-shot keydown
under load derails everything after it, and the final poll times out for a reason several steps
back). Caught this for real: the second of two full `npm test` runs failed exactly this way. Rewrote
both tests to use `pressUntil` (retrying the keypress itself, not just the read) for every step,
matching how the rest of the suite already handles one-shot toggles. Confirmed with
`--repeat-each=3` on `audio.spec.js` alone (all green) and both full-suite reruns after (see below).

**Also added:** 2 new e2e regression tests (`FB-0037/M5 sound`, `FB-0040/M5 sound` in
`tests/e2e/audio.spec.js`) covering the Credits-scroll and new-game-confirm sound wiring with real
audio files loaded, specifically to catch an `AudioManager.play()` call throwing partway through
either panel.

**Test counts:** 330 unit (unchanged) + 124 e2e, both green, on two full `npm test` runs after the
pause-menu-settings fix. A third full run (taken before that fix, to decide whether the failure was
audio-related) turned up the ERR-0003 flake above plus, separately, 3 more failures in
`intro.spec.js`/`minigames.spec.js`/`story.spec.js` -- all pre-existing, timing-sensitive, host-load
flakes unrelated to this merge (none of those 3 files were touched by it); re-running just those 3
files in isolation passed all 3 but turned up a 4th, *different* pre-existing flake instead (a
Backspace-loop in `intro.spec.js`'s name-entry test, same ERR-0003 shape) -- the textbook signature of
host load, not a regression, so left as-is (out of scope for this task; matches the existing
ERR-0002/0003 family already documented).

**Decisions:** none new. **Failures:** the pre-existing ERR-0003-shaped flake in
`audio.spec.js` above (fixed) and the load-only flakes in 3 unrelated specs (not fixed, out of scope,
see above).

**Next:** the owner's full playthrough should now include music/sfx/volume; cutscenes for the three
key rooms are still the next real feature.

## 2026-09-27 — Premium pass paused at the owner's request

**Did since the last entry:**
- Merged `feature/audio` (music, SFX, volume settings, audio packs credited in-game) and the depth
  engine (ADR 0015: depth groups, feet-based depth, door entry/exit, locked-door rattle, camera lerp,
  running dust, cached warp points). Both pushed; main `f3006ea`, 337 unit + 132 e2e green.
- Campus art: rounds 1 and 2 rejected at review (walkways still read as brick; the entrance read as a
  flat box; murky palm; flags read as axes). Asked the owner about buying LimeZu Modern Exteriors
  ($2.50): **declined, free only**. Round 3 switched the outdoor kit to Kenney's RPG Urban Pack (CC0),
  a complete matching modern-city set recoloured to the campus palette. Paused mid-round.
- Stage 6 (in-world cutscenes, ADR 0016) started in parallel; paused mid-way.
- On pause: both agents stopped and their work committed as unreviewed WIP on their branches
  (`worktree-agent-a3b2fc0b219dea823` @ c02913f, `worktree-agent-a459f3366dea619e6` @ e3eb7b6); stray
  test servers stopped; the scheduled loop **disabled**; `.session-active` removed; HANDOFF.md,
  CONTEXT.md, ROADMAP.md and the plan updated with exact resume steps.

**Why:** the owner asked to pause everything and bring the docs up to date.

**Decisions:** free packs only (owner); Kenney RPG Urban Pack is the outdoor base kit.

**Failures:** usage limits stopped agents four times (resumed each time, no work lost). Pushing while
two agents ran e2e suites failed three times (timeouts, corrupted trace zips); each passed on a quiet
machine. Rule: push only when no other tests are running.

**Next:** see HANDOFF.md "How to resume".
## 2026-09-27: campus premium pass, coordinator review round 2 (worktree agent-a3b2fc0b219dea823)

The coordinator compared round 1's before/after shots against the owner's own
`owner-main-block-entrance.png` and sent it back with 6 specific problems (A-F). Fixed all of them
in `tools/make-assets.js`/`tools/campus/build-campus.js`:

- **A, walkway:** round 1 had just recoloured the same Kenney Urban Pack brick-pattern fill onto a
  browner hue -- still read as brick. Replaced with hand-drawn light warm concrete (a flat base +
  faint speckle + a 1px joint on the tile's own top/left edge, no pack texture at all). The Main
  Block forecourt's own paver (`paving`) shrank to a 4x2px low-contrast interlock.
- **B, Mechanical Block "fence":** the actual cause was `bitsPillar` (the old decorative column, 2
  tiles out from the door) drawing *alongside* the new portico columns -- doubled columns read as
  a fence. Suppressed wherever `showPortico` already draws its own.
- **C, sign lettering:** was one 16px tile per character, spelling the message across the *whole*
  facade run and mostly hidden behind the HUD. Replaced with a composed prefab: a tight 4x6 font, 3
  characters per tile (`bitsSignSeg0..8`), centred over just the portico (9 tiles).
- **D, the entrance itself:** replaced the old 2-tile door in a plain wall with a real composed
  portico -- a column table (`PORTICO_WIDE`: column/column/frame/glass x4/door x2/glass/frame/
  column/column) spanning 3 facade rows, a new wide 3-row staircase (ground layer, walkable), and a
  forecourt plaza. Hit a real geometry problem doing this: the Main Block's *real* drawn door sits
  much closer to the loop road and the entrance parking than `coreFrontV`'s estimate assumed (an
  L-shaped building's front run isn't always on its bbox's own edge) -- `loopBox.v1`/`parkingV0` now
  floor against the real door position instead. This specific campus's gate-to-core corridor turned
  out to be only ~14 tiles deep once a forecourt *and* the loop road both need room -- pushing the
  forecourt to the coordinator's literal "5 tiles" would have shrunk the entrance parking lot to 0
  actual tiles (paveRectFrame's own kerb border eats 1 tile top+bottom, so <3 tiles deep shows none
  at all). Settled on ~3-4 tiles of real forecourt + keeping the parking lot's FB-0026 test passing
  (>20 tiles) -- a genuine trade-off given the fixed corridor, documented in the test itself and in
  STYLE_GUIDE.md, not hidden.
- **E, 3D feel generally:** every BITS building's cap/window/base bands redrawn again -- a 2-row
  parapet highlight + terracotta coping, a window sill, a real darker plinth course, and a new
  `bitsFacadeShadow` tile (25%-black, real alpha, non-solid) placed one row south of every building's
  own front run.
- **F, screenshots:** teleported in-game (not the fixed qa-shots camera) to the real Main Block door,
  Mechanical Block door, and the Gate 2 roundabout/avenue, with the HUD visible; composed proper
  before/after pairs against round 1's own committed assets (not the very first, pre-round-1 state)
  since that's the comparison the coordinator's own review used. Palms flanking the steps directly
  failed to place (the walkway network hems in the lawn too tightly right at the door for a 2x3+
  margin footprint) -- widened the search to a ring of candidate spots and took the nearest that
  actually planted; they ended up ~30 tiles out instead of right at the steps, a real placement
  compromise, not silently dropped.

**A real bug found (not on the coordinator's list) while building the portico:** the re-stamp step
that protects the entrance from being overwritten by a later-processed run of the same L-shaped
building was destructuring `[x, tile]` from cells that were actually `[x, y, tile]` triples (the row
varies now, it used to be fixed) -- `portico.y` was `undefined`, so every re-stamp silently no-opped
and the whole body row came out blank. Found by direct pixel inspection of the generated map, not by
a test (no test was pinning that specific row -- added one after, `FB-0029`'s own body/window-row
checks).

**Test counts:** 339 unit (up from 324 after the audio merge), all green. E2E on E2E_PORT=4174.

**Decisions:** none new (no ADR needed -- this is an art/generator-tuning pass, same as round 1).
**Failures:** none outstanding from this pass; the parking-lot depth trade-off above is a known,
documented compromise, not a bug.

## 2026-09-27 (later): coordinator review round 3 -- "one coherent free kit" (Kenney RPG Urban Pack)

Round 2's fix was tuning flat palette fills to the right hexes; the coordinator's side-by-side photo
comparison found flat fills still read as a box with no material, and separately found the avenue's
own kerb tiles (a completely different code path from `walkway()`) were still blitting Modern City's
brick paver recolored to salmon -- that's the real reason "the avenue is still salmon brick" survived
round 2 untouched. Owner decision: **free packs only** (no paid LimeZu Exteriors) -- rebuild the whole
outdoor look on the Kenney RPG Urban Pack alone (already in `assets/vendor/`), studied by decoding its
`Tilemap/tilemap.png` sheet directly (27x18 tiles at a 17px pitch) rather than eyeballing `Sample.png`
-- a small labelled-contact-sheet script (kept out of the repo, in scratch) rendered every cell with
its own `col,row` burned in, so every source rect below was picked by reading real pixels, not
guessing from a thumbnail.

- **Sidewalks/kerb (point 1):** found a complete 9-slice concrete-plaza plot on the sheet (cols 8-11,
  rows 0-5) -- a light blue-grey slab fill with a warm tan kerb border baked into its own edge/corner
  pieces. `walkway`/`walkwayEdge*`/`walkwayCorner*` now blit this directly, unrecolored (`SIDEWALK`
  table, `tools/make-assets.js`). The real fix: `kerbEdge()` used to call `atlasKerbSide`/
  `atlasKerbBand` (Modern City's brick paver, recolored) as a *separate* code path from `walkway()` --
  now it just calls `walkwayEdge`/`walkwayCorner`, so every road-facing sidewalk edge campus-wide
  (the avenue included) uses the same real concrete art. Forecourt `paving` is untouched (round 2's
  low-contrast paver stays, the brief's one deliberate exception).
- **Buildings (point 2):** `bitsFacadeCap/Window/Body/Base` now blit a real wall-with-coping crop
  (cols 18, rows 0/2/3) instead of a flat `$` fill, recolored by a hue-then-luminance split
  (`remapBitsWall`/`remapBitsWallBase`: `r-b > 60` = brick body -> sand `#e3c09b`; else = tan
  coping/plinth -> light parapet `#f2ddb8` on the cap, a genuinely darker cool plinth on the base) --
  picked apart this way because the sheet's brick body and its tan coping/plinth trim overlap in
  luminance, so a plain luminance ramp would have smeared one into the other. The window band adds a
  real tan arched window (col 13, row 13) on top. Thin roofline/panel/ground-line accents stay flat
  palette fills (crisp 1px lines read better flat than textured at that scale).
- **Main Block entrance (point 3):** the portico's glass panels (`bitsPorticoGlassTop/Mid/Base`) and
  the real double door (`bitsEntranceGrandL/R`) now blit the sheet's own wide glass door/window crops
  (cols 7-10, rows 13-15), frame recolored terracotta (`remapBitsDoorFrame`: dark navy -> terracotta,
  glass left exactly as drawn), not a flat `*` fill. Columns (`bitsPillar`/`bitsEntranceColumn`, both
  now the same `bitsColumnTile`) compose the sheet's own free-standing pillar prop (col 2, rows 10-11,
  a transparent-margin sprite, same "backdrop then prop" pattern as `lampPost`) onto a wall backdrop,
  recolored terracotta (`remapBitsColumn`). Steps (`bitsStep1/2/3`) blit the sheet's own 3-tread
  staircase (col 0, rows 12-14), recolored to a neutral light stone (`remapLightStone`) instead of
  flat tone fills.
- **Palms/trees (point 4):** `canopyQuadrantFromAtlas`'s `remap` param is now optional (defaults to
  identity); `treeCanopyTL/TR/BL/BR` and `palmCanopyTL/TR/BL/BR` no longer pass `remapDryLeaves` --
  both are native Ninja Adventure colors now (the coordinator's own "murky and dark" complaint about
  the muted ramp).
- **Flags (point 5):** was one 16x16 tile (grass + Ninja's own short "flag on a stick" sprite, pole
  and pennant both squeezed into one tile -- "reads as a little axe" per the coordinator). Now a real
  2-tile pole: `flagPoleYellow/Blue/Red` (unchanged names, append-only) draw just the lower pole shaft
  (a plain Kenney sign-pole shaft, `FLAG_POLE_SRC`); three new `flagTopYellow/Blue/Red` tiles (overhead,
  like a tree canopy) draw the shaft continuing up plus the Ninja flag enlarged and mounted at the
  top. `build-campus.js`'s flag-placement loop now also sets the matching `flagTop*` tile one row
  north of each base, the same pattern `plantTree()` already uses for a canopy above a trunk.
- **Props (point 6):** added `busStopSign` (a native-blue plaque-on-a-pole sign, col 6 row 6),
  placed near Gate 2 next to the existing bollards.
- Merged main (`f3006ea`, the depth engine/ADR 0015) at the start of this round; no conflicts.

**A real, hard-to-find bug hit while getting a live screenshot (not a code bug, a *harness* one):**
teleporting the player via `body.reset()`/direct `x`/`y` assignment to a point a few tiles south of
the Main Block door -- which looked like open forecourt -- silently re-triggered the door's own
warp-into-building logic (the same scene object just reloads a different `mapKey`, so
`scene.scene.getScene('world')` stays valid and gives no error; only `scene.mapKey` reading
`"main-block-g"` instead of `"campus"` gave it away). The door's trigger zone reaches further out from
the door tile than the door itself. Lesson for next time: when scripting a screenshot, decouple the
camera from the player entirely (`cameras.main.stopFollow()` then `centerOn()`) and put the player
somewhere unambiguously safe, rather than trying to place the player "just outside" a door.

**Build verified:** `npm run assets && npm run campus && npm run interiors` all run clean (no
placement/reachability errors). Unit tests: 346/346 green (`node --test tests/unit/*.test.js`),
including the round-2 tests updated for the new pack-sourced pixels (colors are now real Kenney
tones, not flat hex fills, so several assertions moved from "contains hex X" to "shows N distinct
tones and doesn't contain brick hex Y" -- see `tests/unit/campus-tiles.test.js`'s round-3 comments).

**Visual QA/screenshots for this round were not done in this session** -- the owner paused the
screenshot/server/browser workflow partway through debugging a Playwright timing issue (a slow
darken-then-brighten effect on world-scene load, unrelated to camera fade, needed ~15s of real wait
before a fresh headless page reached full brightness) and asked for a build-only pass instead: code
changes, `npm run assets`/`npm run campus`, unit tests, commit, report. Visual review is a separate
follow-up quality loop per the owner's own instruction.

**Decisions:** none new (an art/generator-tuning pass, same rationale as rounds 1-2).
**Failures:** none outstanding in the code itself; visual review is deferred to the follow-up loop
described above, not a bug in this pass.

## 2026-09-27 — Stage 7 (partial): the temporary card + a recipient/developer README

**Did:**
- Built the temporary card slideshow ("add in a temporary card as well", owner brief): 5 pixel
  illustrations (Main Block entrance, foyer staircase, LUG stall, three keys, the box) drawn by
  `tools/make-card-art.js` into `assets/cutscenes/card-temp-1..5.png`. `src/card.js` gained
  `TEMP_CARD_SLIDES` (the captions) and a pure `buildCardSlides(photos, resolvePhotoKey)` that shows
  them only when `card.json` has zero real photos -- real photos always win, never mixed in.
- Polished the card's motion (`src/scenes/card.js`): a slow continuous Ken Burns zoom on whichever
  photo is currently shown (`startKenBurns()`), confetti that bursts at the start then tapers off and
  stops (`spawnConfettiBurst()`, replacing the old always-on 220ms timer that ran the whole message
  sequence), a soft pulsing glow behind the title (a second low-alpha text copy, since Phaser's real
  `postFX.addGlow` is WebGL-only and this game's renderer is `Phaser.AUTO`), and a one-shot sparkle
  burst as "THE END" fades in (`spawnEndingSparkles()`, same technique as `box-opening.js`'s own
  `spawnSparkle()`).
- Added `assets/card/card.example.json` (committed, with a `.gitignore` exception alongside the
  existing `.gitkeep` one) and pointed `docs/STORY.md` at it.
- Rewrote README.md: top half for the person receiving the game (unzip/run/SmartScreen "More info ->
  Run anyway", a controls table read straight from `src/scenes/ui.js` CONTROLS, how autosave works,
  F11, a Credits pointer), bottom half (below a divider) for developers (unchanged stack/tests/build
  content, reorganised). Removed stale claims: the Realm of the Mad God comparison, "H: show
  controls" and "Esc: skip tutorial" (both replaced long ago by in-fiction hints/pause-menu Controls),
  and "original art only" (this game now also credits several free/CC0 packs, CREDITS.md).
- Extended `tests/unit/card.test.js` (4 new tests: temp slides used with no photos, one real photo
  still wins, temp slide captions are short/non-empty) and `tests/helpers/game-data.js` to expose
  `buildCardSlides`/`TEMP_CARD_SLIDES`. Updated `tests/e2e/ending.spec.js`'s existing assertions for
  the new 5-slide temp slideshow (written correctly, not run this session -- see below).

**Why:** the owner's two asks this pass -- a temporary card that looks finished rather than a bare
placeholder, and a README a non-developer recipient can actually follow to open the game
(roadmap M6). Ken Burns/confetti/glow/sparkle came from the same brief's own "polish the card's
motion" list.

**Decisions:** none new (no ADR) -- the glow-via-duplicate-text choice (over `postFX.addGlow`) is
recorded in `src/scenes/card.js`'s own comment, not worth a separate decision record.

**Failures:** none.

**Next:** this chunk was built under an explicit owner rule for the session ("BUILD ONLY" -- no
server/browser/Playwright): `node --test tests/unit/*.test.js` is green (341 passed, including the 4
new card tests), and `tools/make-card-art.js`'s output was regenerated and matches what's committed
(`assets.test.js` passes), but `tests/e2e/ending.spec.js` and a look at the actual card in
`npm start` are still outstanding before this is fully checked off -- run those next, then the rest of
stage 7 (UI kit polish, performance, QA at window sizes).

## 2026-09-28 — Phase A (build) complete; one test round, one fix round

**Did:** under the owner's build-first rule (docs/QUALITY_LOOP.md), merged without e2e runs: the
Kenney-kit campus art rebuild, in-world cutscenes + connected opening + Mustafa + onboarding markers
(ADR 0016), the temporary card + README, the Main Block interiors rebuild (4 compact 40x40 floors,
foyer per the owner's photo, furnished key rooms), and the UI kit + HUD declutter (Kenney Pixel UI
9-slice, hudLayout). Unit tests 394/394. The one full round then gave 138 passed / 10 failed; one fix
agent found three real bugs: ERR-0008 (stale overheadLayer crashed every campus->interior door),
ERR-0009 (depth-group baking took 5.3 s per campus load; batched to ~0.1-0.2 s, regression test
added), and deleteProfile() not cancelling a pending autosave. Full runs after: 149/149, then 148/149
(one known load flake in interiors.spec.js, passes alone 3/3). Pushed.

**Why:** the owner's rule: build the whole flow fast, then test once, fix once, then rate and fix by
category.

**Decisions:** none new. Owner approval of 5 new dialogue lines is pending in FB-0032.

**Failures:** see the three bugs above; merge conflicts only in MEMORY.md and one trivial one in
src/scenes/card.js (both preload blocks kept).

**Next:** Phase B, the quality loop: rate category by category, starting with Outdoor art (1) and
Interior art (2).

## 2026-09-29 — Quality loop, category 10 "Card and ending", run 1 fixes

**Did:** three bugs from the scorecard's first "Card and ending" rating (5/10):
- The title's "soft glow" was a second, offset copy of the title text -- read as a rendering error,
  not a glow. Replaced with `buildTitleGlow()` (`src/scenes/card.js`): three low-alpha ellipses (same
  faked-radial-gradient technique as `box-opening.js`'s `buildVignette()`) pulsing behind the title,
  no text duplicated anywhere.
- `card-temp-1` (the entrance temp slide) still drew an invented red-arch building. Redrawn
  (`tools/make-card-art.js` `buildTempEntrance()`) to match the real Main Block
  (`docs/research/reference/owner-main-block-entrance.png`) using the exact palette the outdoor
  campus art already settled on for this building: sand facade, terracotta portal frame around a
  mullioned dark-glass front, navy lettering ("BITS DUBAI" -- the full "BITS Pilani, Dubai Campus"
  wouldn't be legible at this thumbnail's scale, so the glyph set (5 new letters: B/I/S/D/A) only
  covers the short form), light stone steps with tread-shadow lines, and two palms (new
  `drawTempPalm()`/`thickTaperLine()` helpers) flanking it.
- The message box read as a second, unrelated UI panel (ui.js's usual dark navy dialog box) sitting
  under the photo frame's warm paper. `src/scenes/card.js` now draws its own cream "note paper" panel
  (`drawNotePanel()`) under the message, hides DialogBox's own panel by alpha (not visibility --
  `open()` would just turn it back on), and recolors the typed text to a warm dark ink
  (`#4a3520`) instead of the game's usual near-white.
- Regenerated `assets/cutscenes/card-temp-1..5.png` (`npm run assets`); only slide 1 actually changed.

**Why:** docs/quality/scorecard.md "Card and ending" run 1 (rated 5/10) — coordinator's brief named
all three bugs explicitly, including the reference photo to redraw slide 1 against.

**Decisions:** none new (no ADR).

**Failures:** none.

**Next:** re-rate "Card and ending" (a fresh qa-shots/manual look at the card) once the next full test
round runs; this branch (`quality/card-1`) built under the session's "build only" rule -- unit tests
only (427 passed), no server/browser/e2e run yet.

## 2026-10-03 — Handoff before the owner's playtest

**Did (2026-09-28..29):** Phase A finished and pushed; quality loop runs 1-4 lifted outdoor art
4->7, interior 3->6, UI 5->7, card 5->7, cutscenes 5->7, mini-games 4->6, story flow 6. Added
ambient students, a top-down shuttle, the in-person Mustafa greeting, a real red-paver forecourt,
the 3x mini-game rescale, a fault-tolerant qa-shots (96 shots). Fix rounds found real bugs:
ERR-0008/0009, a rainbow tile (unrecoloured Cool School books), ambient NPCs blocking the door route
and out-competing key stations on exact ties.

**Open:** ambient-student textures not preloaded (missing-texture boxes in the foyer); key-station
tie-break; new dialogue lines await owner approval (FB-0032). Audio, game feel, performance unrated.

**Next:** the owner plays; their feedback first, then the bugs in HANDOFF.md "Known bugs", then the
quality loop continues.

## 2026-10-03 — Design interview, repo cleanup, birthday sprint plan

**Did:** Grilled the design with the owner (grilling skill). Settled: the game is a birthday gift for
**Taru's 22nd (next week, ~4 days to finish)**; she has a **MacBook**, so the deliverable is an offline
double-click `index.html` bundle, not an .exe. Cleanup done (9 agent worktrees, `-intro`, 32 merged local
branches, `origin-local/main`, `-cutscene`/`-interiors` leftovers; kept `-play`). Scheduled task "Pixel game:
work the roadmap" **disabled** (owner re-enables). Wrote the sprint plan, ADRs 0017-0019, and updated
HANDOFF, STORY and QUALITY_LOOP (ratings paused until the owner plays).

**Why:** the owner wants it complete (nothing empty), cute and soft, matching the real campus, with talkable
students (facts from the BITS Dubai site; real CS professors may be named), cats and birds, an RTA bus
with a door-opening animation, and a credits scene ("Happy Birthday Taru, Happy 22", wishes one by one).

**Decisions:** ADR 0017 offline bundle for Mac, ADR 0018 talkable campus life, ADR 0019 credits ending and
recipient. FB-0025 means "use free asset packs, don't hand-draw art" (the bus is the one exception: no pack has one).

**Failures:** none. (The "food truck by the gate" ambient line is wrong and is removed on Day 1.)

**Next:** research agents (facts, RTA bus reference, 3D tour ground floor, animal packs) and Sonnet briefs A-D
per docs/plans/2026-10-03-birthday-sprint.md. No pushes during the build; the full `npm test` and push are Day 2.

## 2026-10-03 (evening) — Sprint Day 1 done; handoff written

**Did:** Merged packages A (3 bugs), B (offline bundle), G (MP3 audio for Safari), C (credits + Taru prefill), D (RTA bus), E (talkable students + cats/birds); first full e2e run (177/184) and a fix round that also removed real soft-locks (Room 195 key unreachable, two students blocking the ICVL closet and the Physics Lab desk). Research: campus facts (77), RTA bus, 3D tour, animal packs. Marked FB-0027..0034 fixed. Wrote ADR 0020 (ground floor follows the tour; owner chose it) and rewrote HANDOFF.md plus docs/NEXT_SESSION_PROMPT.md.

**Why:** the owner wants it complete and working before they playtest (end of Day 2); ratings paused.

**Decisions:** ADR 0017-0020.

**Failures:** ERR-0010..0013 (see ERRORS.md): slow opening backdrop made double-Esc skip the name screen; generated Room 195 layout walled off the key desk; ambient students placed in story doorways; test timing under headless FPS.

**Next:** foyer rebuild per the tour, file:// check of the bundle, defect sweep, full npm test, push, update the play copy, tell the owner. Not pushed yet (main is ahead of origin).

## 2026-10-04 — Foyer and wings rebuilt to the 3D tour (ADR 0020, package F)

**Did:** One Sonnet agent rebuilt `main-block-g`: oak foyer, terrarium on the axis, two reception desks with glass side doors, split stair on the left-back (object "Main Block Stairs G (up)" at the foot, LUG stall + volunteer behind it), ring chandelier, red/blue sofas on the back walls, totem pillars, two long wings with 13 closed nameplated doors (each speaks a `doorLocks` line; small `closed` door support in `world.js`), 9 ambient students re-placed. 26 new tiles (pack crops/recolours only; approximations listed in docs/INTERIORS_PLAN.md). New `tests/unit/foyer-tour.test.js` (20 tests); 599/599 unit tests green. Upper-floor map content is unchanged (hash-pinned); only the shared tileset header line changed in every generated map.

**Why:** the owner chose the tour over the older photo (ADR 0020).

**Open for the playtest:** compass/stair position medium confidence; the foyer west lane by the stair is 1 tile; desks are straight not curved, no white balustrade tile; nothing seen in the running game yet.

**Next:** build the offline bundle and play it from file:// (Chromium + WebKit), defect sweep, full test via the pre-push hook, push.

## 2026-10-04 (later) — Offline bundle played from file:// (Chromium + WebKit)

**Did:** `npm run pack:offline` (13.2 MB), then `tools/qa-offline-play.js` (new, `npm run qa:offline`) plays the bundle title -> name (prefilled TARU) -> RTA bus -> volunteer -> 3 keys -> box -> card (recipient Taru) -> credits -> title -> reload (Continue + Watch card present). Chromium and Playwright WebKit 26.6 (downloaded with the owner's OK): zero console/page errors, zero external requests, save kept in localStorage. Chromium audio context running after the first click. The built-in browser pane cannot test it (it opens local files as data: URLs, so relative scripts do not load): use Playwright.

**Limits:** Playwright's Windows WebKit has no Web Audio (AudioContext undefined), so audio is verified only in Chromium; real Safari is still untested. Owner has no Mac: plan a hostable-site option for the zip.

**Next:** defect sweep (qa:shots), completeness check, full test via pre-push, push, update the play copy.

## 2026-10-04 (evening) — Defect sweep fixed; card typewriter bug; ready for the full test

**Did:** One review agent (97 screenshots, 23 objective faults + `tests/unit/completeness.test.js`), two fix agents (story-route/UI/mini-game/stairs/landing; campus art: tree, entrances, cars, gate palm), me: card message box typewriter (ERR-0014). Re-ran qa:shots and looked at the fixed shots (library front, gate 2, parking, box, landing, platformer game-over): fixed. Rebuilt the bundle. 690 unit tests green.

**Decisions:** Library/Mechanical interiors are exempt from furniture/life rules by a named list (locked for the whole game). D12/D18 left. Birthday is 2026-10-11 (owner); a hosted-site option is wanted because there is no Mac to test on.

**Next:** push (the pre-push hook runs the full `npm test`, about 17 min, quiet machine), update ../2D_pixel_game-play, tell the owner it is ready; hosted-site option; owner feedback via the O overlay.

## 2026-10-04 (night) — Pushed; hosted-link build

**Did:** Pushed `main` (`ea1303b`) after the full suite (unit + 185 e2e) passed twice (once directly, once as the pre-push hook). Added `npm run pack:site` (`--hosted`: noindex meta, robots.txt, `_headers`; `dist/offline-site`), played it over http (zero errors), wrote docs/HOSTING.md (Netlify Drop; the owner uploads). `tools/qa-offline-play.js` takes `PLAY_URL`.

**Failures:** my first throwaway static server compared `/` and `\` paths (404 everywhere) and then kept Node alive; for any scripted http check use `path.resolve` and `server.unref()`.

**Next:** owner playtest feedback (O overlay); card assets -> `npm run pack:offline -- --zip` and `npm run pack:site`; final zip + HOW_TO_OPEN.txt.

## 2026-10-04 (late) — The owner's first playtest; handoff for Day 3

**Did:** The owner played once through the O overlay: "fine, but no wow yet", 33 items FB-0044..FB-0076 (controls/UI, names + friends + club colours + the ICVL -> ICL rename, campus outdoors incl. an RTA bus stop and roundabout, Main Block stairs/doors/lift, a match-3 to replace Tetris, an ICL fingerprint lab with a robot "Alice", a harder Physics Lab fight). Wrote the Day 3 plan (docs/plans/2026-10-04-day3-feedback-and-wow.md: 6 packages, 9 wow ideas, schedule to the 10-11 birthday), ADR 0021 (friends as characters) and ADR 0022 (hosted link), rewrote HANDOFF.md and docs/NEXT_SESSION_PROMPT.md, refreshed CONTEXT.md. Dev-server lessons: the app kills preview servers at turn end; PowerShell blocks `npm.ps1` (use `node server.js`).

**Decisions:** owner's friends allowed as NPCs (their lines approved by the owner); generic stand-ins for Hello Kitty/Batman; one Sonnet agent at a time, monitored, committed after each; birthday 2026-10-11, deliver by 10-09.

**Next:** triage the 33 items (view each screenshot), P1 -> P5, then the wow layer; second playtest ~10-08; final zip + link by 10-09.

## 2026-10-04 (Day 3) — Triage, P1 started, the owner's "moments" ideas written down

**Did:** Viewed all 33 feedback screenshots. Found the shared bug behind FB-0045/0068/0073 (right border of every bordered panel missing), that FB-0051 names ~15 people (friends, 3 professors, Sana/Shraddha/Palak), that the pause menu already has "Quit to Title" (FB-0075 is discoverability + a real quit), and asked FB-0076 in the thread. Wrote `docs/plans/agent-rules.md` (shared brief rules for build agents), extended ADR 0021, started the P1 agent (controls/UI). The owner then sent 5 small scene ideas (unicorn and prince, a tower-climb game, Mevin the drummer, a Hello Kitty/Batman cover, a ball pit): written up as `docs/plans/2026-10-04-moments-and-small-touches.md` (designed, not built, 6 open questions).

**Decisions:** library door goes to the back-centre of the foyer (FB-0062); working lift (FB-0069); ICL fingerprint door opened by the existing flyer game, then the lab with Alice (FB-0071); only the NPC the owner pointed at becomes "Deanne" (FB-0050); "Welakkiya" = Dr. Elakkiya R (already in the sourced facts). Protected characters (Hello Kitty/Batman) stay generic stand-ins even for the cover; it takes the mood of the owner's picture only.

**Next:** review + commit P1, then P2a (ICL rename, Deanne, club colours), P2b (friends, professors, funnier lines), P3 a/b, P4, P5; moments after P5 (one per agent).

## 2026-10-04 (Day 3) — P1 (controls/UI) done: 753 unit tests green

**Did:** One Sonnet agent fixed FB-0045/0046/0068/0072/0073/0075/0076. Root causes: the UI frame crop threw away the right and bottom border of the Kenney 48 px frame (ERR-0017, all panels); `transitioning` scripts/door walks skipped movePlayer so the player kept sliding in the run animation under dialogs (ERR-0016: now an accessor that calls haltPlayer()); E/Space/Enter share one handler (`uiConsumed` mark); Quit (title + pause "Quit Game") with a goodbye scene; ending chain hardened; Main Block door glass solid, two-tile doorways (`cells`), door walk = walk animation. +62 tests (691 -> 753). Reviewed the diff, ran test:unit myself.

**Not run:** e2e (changed tests/e2e/title.spec.js; the daily full test must cover title, audio, dialog, minigames, ending, credits, depth-groups, robustness). Not seen in the running game: dialog/panel edges, title menu with 6 buttons, goodbye flow, Enter on pause Resume next to an NPC, the Main Block door.

**Grilling (moments doc):** round 1 settled (tower climb is the Room 195 key, match-3 dropped, moments play once, etc.); round 2 questions Q8-Q12 are with the owner.

**Next:** P2a (ICL rename, Deanne, club colours), P2b (friends, professors, funnier lines), P3, P4, P5.

## 2026-10-04 (Day 3) — P2a done (ICL rename, Deanne, club colours): 770 unit tests green

**Did:** One Sonnet agent: ICVL -> ICL everywhere incl. ids (`quest.keys.icl`, `keyIcl`, route `key-icl`) with a save migration (`renameLegacyIds()` in src/save.js, any depth, case-preserving); `name` + `lines` fields on ambient entries (named NPCs; Deanne = campus-amb-sit-2; other hostel residents "Hostel mate"); club outfits (role `outfit` -> 32 baked sheets `npc-<body>-<outfit>`, `ambientSheetKey()`; ACM dark pink, LUG/volunteer orange+black, new role `mtc-member` black/white with 3 placeholder-line students, other clubs sky blue; the LUG stall volunteer now in LUG colours). Reviewed, ran test:unit (770).
**Not run:** e2e (specs edited for the rename). Check in the game: no missing-texture boxes for club variants, the old playtest save loading under ICL ids.
**Next:** P2b (friends, professors, funnier CS-student lines, Mustafa near games), then P3.

## 2026-10-04 (Day 3) — P2b done (friends, professors, funnier lines): 782 unit tests green

**Did:** One Sonnet agent: 4-6 funnier openers per CS-flavoured role (facts unchanged), 9 named friends (Sid, Akshit, Varun, Mitul, Karthik, Siva, Shamsuddin, Najam, Satvik with a camera), 3 Mustafas (black+orange hoodie `npc-mustafa`) near the Physics Lab, ICL and Room 195 with fixed lines, Prof. Elakkiya / Angel (wings) / Raja (hint of a ride) as named ambient NPCs; `sheet` and `factIds` ambient fields; 12 `FB-0051:` tests. 13 existing entries converted, 2 new. Lines are listed in docs/research/campus-lines-review.md for the owner's edits (risky ones flagged: Raja "royalty", Elakkiya "no mercy", Angel "wings are real. Mostly.", Najam "sleep is a feature I turned off").
**Open:** FB-0051 stays in-progress until Raja's chariot, Sana/Shraddha/Palak, Mevin and Narda (the moments) are built. Mustafa's Room 195 line hints at "stack things neatly" (Tetris): rewrite it when P5 replaces the game with the tower climb. Props (camera/wings) are per-frame overlays and may jitter 1 px against the walk bob (look in the game). Not seen in the running game; e2e not run.
**Next:** P3 (campus outdoors, 2 agents), P4, P5.
