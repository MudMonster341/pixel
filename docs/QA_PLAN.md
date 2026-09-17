# QA plan

How the game is checked before the owner plays a new version. Automated tests ([TESTING.md](TESTING.md))
run on every push. This file lists **what** must be covered, so gaps are visible. When something
new is added to the game, add its row here and a test for it.

✅ = automated test exists · 🟡 = partly covered · 🔲 = not covered yet

## 1. Maps and pathways (unit tests on the generated map data)

| Check | Status |
|---|---|
| Committed `campus.json` matches the generator output | ✅ |
| Spawn is on a walkable tile | ✅ |
| Fence is a closed straight loop, broken only by the gates | ✅ |
| Buildings are separate with walkable gaps | ✅ |
| Walkways have a constant width | ✅ |
| Map is axis-aligned (no staircase diagonals) | ✅ |
| Road network is connected: Gate 2 approach, D54, ring road, parking | ✅ (`tests/unit/campus-osm.test.js`) |
| Every building door and gate is reachable from spawn (flood fill) | ✅ (every door, `tests/unit/campus.test.js` + `campus-osm.test.js`) |
| No isolated walkway or road islands | ✅ (P5, `tests/unit/campus-osm.test.js`) |
| Sports areas (track, courts) are reachable by walkway | ✅ (P5, `tests/unit/campus-osm.test.js`) |
| Every warp lands on a walkable tile, and every door has a way back | ✅ (P3, `tests/unit/interiors.test.js`) |
| Every interior room is reachable from its entrance (and across floors, via stairs) | ✅ (P3) |
| Stairs connect the floors both ways, and line up between floors | ✅ (P3) |
| Interior floors are axis-aligned (no staircase diagonals), furniture never blocks a doorway | ✅ (P3) |
| Tile data: every tile name used in a map exists in `tiles.json` | ✅ (campus + interiors) |

## 2. Mechanics (browser tests)

| Check | Status |
|---|---|
| Boot with no console errors (campus and `?map=meadow`) | ✅ |
| Walking in 4 directions, collisions with solid tiles | ✅ |
| Controls card opens (H) and closes (Enter/Space/Esc) | ✅ |
| Doors and fades between maps (house test map) | ✅ |
| Pickups, inventory stacking, bag full | ✅ |
| NPC dialog, prompt, typewriter | ✅ |
| Minimap toggle (M) | ✅ (`tests/e2e/boot.spec.js`, `fullmap.spec.js`, follows the player: `campus.spec.js`) |
| Compact hotbar turns see-through when the player is behind it (FB-0001) | ✅ after P1 |
| Held item drawn on the character in all 4 directions (FB-0002) | ✅ after P1 |
| Running outdoors, not indoors (FB-0017) | ✅ after P1, indoors confirmed in P3 |
| Walking from campus into the Main/Library Block, stairs up and down, and back out | ✅ (P3, `tests/e2e/interiors.spec.js`) |
| Tree canopies draw over the player | ✅ (P5, `tests/e2e/campus.spec.js`) |
| Gate cutscene: plays once, keys advance/skip, control returns | ✅ (P4, `tests/e2e/cutscene.spec.js`) |
| Location banner on map/area change | ✅ (P4, `tests/e2e/campus.spec.js`) |
| Feedback overlay: O key and button open it, the game pauses | ✅ |

## 3. Visual walkthrough (screenshots for a human look)

`npm run qa:shots` (`tools/qa-shots.js`, added in P5): starts `server.js` on a scratch port (8097)
with a throwaway feedback folder, loads the game with `?cutscene=0`, and teleports (via
`page.evaluate`, never hard-coded tile numbers -- every position comes from the generated map's own
Tiled objects) to every point of interest, saving a screenshot of each to `qa-shots/` (gitignored):
- **Outdoors:** spawn, Gate 2, avenue, Main/Library/Mechanical Block fronts, every hostel, the
  track, the tennis courts, the other courts, parking, the Side Gate, D54, the DIAC ring road, and
  DIAC Park. D54 and the ring road have no Tiled object (they're drawn tiles only, ADR 0009), so
  their points are found by scanning the generated ground layer instead of a hand-picked constant.
- **Indoors:** every interior floor's entrance, and every named room (`area` object) on it.
- **The cutscene:** the image, the message box mid-typewriter, and control handed back afterward --
  plus the location banner and the full-screen map, both P4/FB-0018 UI in the same neighbourhood.

The main agent runs it and looks at every screenshot before telling the owner a version is ready.
Things to look for:
- tiles that don't join (kerbs, fences, walls, walkway borders)
- floating or cut-off trees
- doors that don't line up with paths
- text that overflows its box
- UI covering the player
- rooms that look empty or broken, unreachable spots, anything ugly

P5's pass found and fixed one real bug this way: the full-screen map labelled every one of the
dozens of nameless neighbouring OSM buildings with the generator's own placeholder name
(`Building <osm id>`), burying real names (Main Block, Gate 2, DIAC Park...) under illegible
overlapping text -- `src/scenes/ui.js`'s `FullMap` now skips that exact placeholder pattern
(`tests/e2e/fullmap.spec.js`, "never labels a nameless neighbouring building").

## 4. Performance and robustness

| Check | Status |
|---|---|
| Campus loads in under 5 s locally, no frame drops while walking (check FPS in the debug console) | ✅ (P5, `tests/e2e/performance.spec.js`, loose bounds -- logs both numbers) |
| Resizing the window keeps the game letterboxed and readable | ✅ (P5, `tests/e2e/robustness.spec.js`) |
| Rapid key presses during fades/cutscenes don't soft-lock the player | ✅ (P5, `tests/e2e/robustness.spec.js`) |
| Walking into every map edge never leaves the map or gets stuck | ✅ (P5, `tests/e2e/robustness.spec.js`) |
