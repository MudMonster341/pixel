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
| Road network is connected: Gate 2 approach, D54, ring road, parking | 🔲 (P2) |
| Every building door and gate is reachable from spawn (flood fill) | 🟡 (Main Block only) |
| No isolated walkway or road islands | 🔲 (P2) |
| Sports areas (track, courts) are reachable by walkway | 🔲 (P2) |
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
| Minimap toggle (M) | 🟡 |
| Compact hotbar turns see-through when the player is behind it (FB-0001) | ✅ after P1 |
| Held item drawn on the character in all 4 directions (FB-0002) | ✅ after P1 |
| Running outdoors, not indoors (FB-0017) | ✅ after P1, indoors confirmed in P3 |
| Walking from campus into the Main/Library Block, stairs up and down, and back out | ✅ (P3, `tests/e2e/interiors.spec.js`) |
| Tree canopies draw over the player | 🟡 |
| Gate cutscene: plays once, keys advance/skip, control returns | 🔲 (P4) |
| Location banner on map/area change | 🔲 (P4) |
| Feedback overlay: O key and button open it, the game pauses | ✅ |

## 3. Visual walkthrough (screenshots for a human look)

A Playwright script (`npm run qa:shots`, added in P5) teleports to each point of interest and saves a
screenshot to `test-results/qa/`:
- **Outdoors:** spawn, Gate 2, avenue, plaza, Main Block front, Library, Mechanical, each hostel, the
  track, the tennis courts, parking, the Side Gate, D54, the ring road, and DIAC Park.
- **Indoors:** every interior map's entrance and each room -- done for P3 with a scratch Playwright
  script (not committed; the pattern is in `docs/INTERIORS_PLAN.md`), which is how the badminton
  hall's floor colour and the atrium void's contrast got fixed before shipping. A `npm run qa:shots`
  script covering outdoors + indoors together is still P5 work.
- **The cutscene:** first frame, message box, last frame.

The main agent looks at them before telling the owner a version is ready. Things to look for:
- tiles that don't join (kerbs, fences, walls, walkway borders)
- floating or cut-off trees
- doors that don't line up with paths
- text that overflows its box
- UI covering the player

## 4. Performance and robustness

| Check | Status |
|---|---|
| Campus loads in under 5 s locally, no frame drops while walking (check FPS in the debug console) | 🔲 (P5) |
| Resizing the window keeps the game letterboxed and readable | 🔲 (P5) |
| Rapid key presses during fades/cutscenes don't soft-lock the player | 🔲 (P5) |
| Walking into every map edge never leaves the map or gets stuck | 🔲 (P5) |
