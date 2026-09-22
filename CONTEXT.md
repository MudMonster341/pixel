# Pixel Quest — context

**Last updated:** 2026-09-22 · **Repo:** https://github.com/MudMonster341/pixel · **Local:** `C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game`

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
- **Works (all covered by tests, 2026-09-17; 136 unit + 59 browser tests):**
  - **Campus C2** ([ADR 0009](decisions/0009-campus-from-osm-straightened-and-cleaned.md)): generated from OpenStreetMap again.
    - Layout: the campus strip along D54, the hostel row, real building shapes simplified into straight rectangles.
    - Around the campus: the real DIAC Park and roundabout.
    - Paths and roads: kerbed roads and D54, 3-tile walkways that go around buildings.
    - Gate 2 + Side Gate, trees/palms with canopies, tennis courts with a thin net, name signboards.
  - **Interiors** ([docs/INTERIORS_PLAN.md](docs/INTERIORS_PLAN.md)): 1 m per tile, with furniture by room type and doors/stairs linking both ways.
    - Main Block ground to 3rd floor; Library Block and Mechanical Block ground + 1st floor.
    - Rooms named after the virtual tour.
    - No running indoors.
  - **Gate 2 welcome cutscene** (plays once, Esc skips, `?cutscene=0` disables it), location banner, full-screen map (click the minimap or press N).
  - Gameplay: compact see-through hotbar, held items (keycard, phone, ID card, notebook, laptop, coffee, apple, sword), Shift to run.
  - Test maps (`?map=meadow`): meadow + Tomas's house, pickups, NPC dialog, tutorial checklist.
- **Dev tooling:**
  - `npm test` runs before every push and on GitHub Actions.
  - `npm run qa:shots` saves screenshots of every area/room to `qa-shots/` ([docs/QA_PLAN.md](docs/QA_PLAN.md)).
  - In-game feedback overlay (O key or yellow button).
  - The owner plays a stable copy: worktree `../2D_pixel_game-play`, launch config "play", feedback still saved to this repo.
- **Open questions for the owner:** where the real main entrance (Gate 2) is (asked in FB-0022); the second gate's name.
- **Not yet:** ES modules, flags/scripts, saving, backpack, dialog choices, the story (the owner explains it after the base map).
- **Next:** the owner verifies FB-0018 to FB-0022, then entrance position, interior polish from feedback, then the Foundation phase of GAME_PLAN.md.

## Where this is going (updated 2026-09-22)
The finish line: a sendable **Windows .exe** of the LUG treasure hunt ending in an animated
**birthday card** ([STORY.md](docs/STORY.md)), target 2-4 weeks from 2026-09-20.
- **What to build:** [docs/ROADMAP.md](docs/ROADMAP.md) (M1 story engine, M2 art from packs,
  M3 story slice, M4 mini-games, M5 feel, M6 ship, M7 QA).
- **How the work runs:** a scheduled loop every 3 hours does one roadmap task, owner feedback first
  ([ADR 0011](decisions/0011-autonomous-roadmap-loop.md)). Sonnet agents write the code; the
  coordinator briefs, reviews, tests, documents and commits.
- **Art comes from free third-party packs** ([ADR 0012](decisions/0012-third-party-asset-packs.md)):
  Kenney (CC0) outdoors, LimeZu free and Sprout Lands (non-commercial, credited) for interiors,
  greenery and characters. The BITS buildings are built by us in the packs' style. **The game is a
  gift and must never be sold.** Raw packs are gitignored; generated art ships.
- **Characters are 16x24** ([ADR 0013](decisions/0013-characters-are-16x24-from-the-pack.md)); the
  clothes-colour choice bakes one sheet per colour ([ADR 0014](decisions/0014-opening-customisation-recolor-sheets.md)).
- **Delivery:** an Electron portable .exe, with the web build for development
  ([ADR 0010](decisions/0010-ship-as-windows-exe-and-web-build.md)).
- **Built so far:** the opening (title, Mustafa's greeting, name entry, customisation, bus arrival),
  campus v3 from satellite (gate on the lower right, roundabout, parking both sides, loop road),
  8 interior floors with warps, saving, and data-driven dialog with choices and the E/! bubble.
- **Owner-supplied media:** pixel video clips for the big cutscenes
  ([prompts](docs/research/cutscene-video-prompts.md)) and the birthday card's photos and video in
  `assets/card/`. Drawn fallbacks mean the game never breaks without them.

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
