# Pixel Quest — context

**Last updated:** 2026-09-16 · **Repo:** https://github.com/MudMonster341/pixel · **Local:** `C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game`

## What this is
A top-down pixel-art exploration game in the browser, in a bright DS-era Pokémon style. It recreates
the real **BITS Pilani Dubai campus** (Dubai International Academic City) with DIAC Park nearby. The
lead is a new female student who arrives, finds the **LUG (Linux Users Group) treasure hunt**
event, and explores campus following its clues. No combat. It's a private club project built with free
software and original art.

## Why it exists
The owner wants to learn how games like this are built by making one, one playable step at a time,
on a stable architecture that can grow. The campus map is the most important piece. The agent makes
the design and technical choices. The owner plays each version, reports feedback in-game, and will
explain the story once the base map is done.

## Current state
- **Works (all covered by tests, 2026-09-16):**
  - **Campus C1.5:** a hand-designed, fully straight outdoor campus ([ADR 0008](decisions/0008-campus-as-straight-schematic-plan.md)),
    573×326 tiles at 2 m per tile, and the start map.
    - Gate 2 main entrance at the bottom with a straight avenue up to the Main Block, plus a Side Gate.
    - Kerbed roads, 3-tile brick walkways, lawns, hedges, about 200 trees/palms (canopies draw over the player).
    - Tennis courts, the athletics track, hostels and DIAC Park.
    - Buildings can't be entered yet.
  - Female lead player sprite, follow camera, scrolling minimap (M), controls card (H).
  - Test maps (`?map=meadow`): meadow + Tomas's house with doors, pickups, the hotbar, NPC dialog and the tutorial checklist.
- **Built but not merged:** branch `feedback/gameplay` (worktree `../2D_pixel_game-gameplay`) holds
  FB-0001 (compact see-through hotbar), FB-0002 (held items + university items) and FB-0017 (running).
- **Dev tooling:** `npm test` (unit + browser tests) runs before every push and on GitHub Actions.
  In-game feedback overlay (O key or yellow button).
- **In progress (2026-09-16):** [docs/plans/2026-09-16-feedback-interiors-cutscene-qa.md](docs/plans/2026-09-16-feedback-interiors-cutscene-qa.md):
  P1 merge gameplay → P2 campus v2 (real strip shape, connected roads, signs, less desert) → P3 interiors
  (Main/Library/Mechanical blocks, 1 m per tile, empty rooms, stairs) → P4 Gate 2 cutscene + location banner
  (in parallel with P2) → P5 QA pass ([docs/QA_PLAN.md](docs/QA_PLAN.md)). Sonnet agents implement; the main agent reviews.
- **Not yet:** ES modules, flags/scripts, saving, backpack, dialog choices, the story (the owner explains it after the base map).
- **Open questions for the owner:** Gate 2's real position (assumed: south entrance by the Main Block drop-off); the second gate's name.

## How to run it
```
npm start                 # http://localhost:8080 (campus; ?map=meadow for the test map; ?dev=0 hides dev tools)
npm test                  # unit + browser tests (also run automatically before git push)
npm run assets            # regenerate assets/ after editing tools/make-assets.js
npm run campus            # regenerate assets/maps/campus.json after editing tools/campus/layout.js
npm run feedback          # feedback items waiting on the agent (docs/FEEDBACK.md)
```
First time on a new machine: `npm install && npx playwright install chromium`. The game itself
needs no install, just Node and internet (Phaser from cdnjs, font from Google Fonts).
Debugging: `game.scene.getScene('world')` and `GameState` in the browser console.

## Where things live
- `src/maps.js`: map list (campus = Tiled file; meadow/house = text test maps). `src/items.js`: items.
- `src/maplogic.js`: pure helpers shared with tests (text grids, Tiled grids/objects, start-map choice).
- `src/state.js`: constants, `Inventory`, `GameState`.
- `src/scenes/world.js` (restarted per map), `src/scenes/ui.js` (persistent HUD), `src/main.js` (boot, `DEV_MODE`).
- `src/dev/`: feedback overlay (dev only). `server.js`: static files + feedback API on 127.0.0.1.
- `tools/make-assets.js`: all pixel art + tiles.json. `tools/campus/`: OSM extract, `layout.js`,
  `build-campus.js`. `tools/lib/png.js`: PNG encoder. `tools/feedback*.js`: feedback CLI.
- `assets/maps/campus.json`: generated campus map. `docs/research/`: campus facts, tour scene list, preview image.
- `tests/unit`, `tests/e2e`, `.githooks/pre-push`, `.github/workflows/test.yml`. `feedback/`: feedback items.

## Constraints
- $0: free software and free/original assets only. The game loads no npm packages; npm is for dev
  tooling only ([ADR 0005](decisions/0005-automated-tests-on-every-push.md)).
- Tiles and characters are 16×16. Campus outdoors is 2 m per tile, indoors 1 m per tile. The canvas is
  960×540, world zoom 3, UI unzoomed.
- The campus map is generated. Change `tools/campus/layout.js`, never hand-edit `campus.json`
  ([ADR 0007](decisions/0007-campus-map-from-osm-into-tiled.md)).
- OpenStreetMap data is ODbL (credited). The tour, Google Maps and Wikimedia photos are reference only.
  No real people in the game.

## Rules and plans
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) · [docs/GAME_PLAN.md](docs/GAME_PLAN.md)
- [docs/CAMPUS_MAP_PLAN.md](docs/CAMPUS_MAP_PLAN.md) (C1.5 built; interiors next) · [docs/research/](docs/research/)
- [docs/TESTING.md](docs/TESTING.md) · [docs/QA_PLAN.md](docs/QA_PLAN.md) · [docs/FEEDBACK.md](docs/FEEDBACK.md)
- [docs/plans/](docs/plans/): dated work plans

## Memory
- [MEMORY.md](MEMORY.md): dated log of what happened and why
- [ERRORS.md](ERRORS.md): failures hit and how they were resolved
- [decisions/](decisions/): numbered architecture decision records
