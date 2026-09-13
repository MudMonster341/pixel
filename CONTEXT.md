# Pixel Quest — context

**Last updated:** 2026-09-13 · **Repo:** https://github.com/MudMonster341/pixel · **Local:** `C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game`

## What this is
A top-down pixel-art exploration game in the browser, in a bright DS-era Pokémon style. It
recreates the real **BITS Pilani Dubai campus** (in Dubai International Academic City) as closely
as possible, including multi-floor building interiors and DIAC Park nearby. A new student arrives,
finds the **LUG (Linux Users Group) treasure hunt** event, and explores campus following its clues.
No combat. Built with free software and original art.

## Why it exists
The owner wants to learn how games like this are built by making one, one playable step at a time,
on a stable architecture that can grow. The campus map is the most important piece. The agent makes
the design and technical choices. The owner plays each version, reports feedback in-game, and
writes the story.

## Current state
- **Works (all covered by tests, 2026-09-13):**
  - Test maps only (Meadow, Tomas's House) with doors, collisions and a follow camera.
  - Pickups into a 5-slot inventory (hotbar UI, to be replaced by a backpack).
  - NPC dialog, minimap (M), tutorial card (H) + checklist.
- **Dev tooling:**
  - `npm test` (31 unit + 26 browser tests) runs before every push and on GitHub Actions; the first CI
    run passed.
  - In-game feedback overlay (`` ` ``) with an inbox.
- **Planned, not built:** the campus map ([docs/CAMPUS_MAP_PLAN.md](docs/CAMPUS_MAP_PLAN.md), waiting on
  the owner's answers), ES modules, events/flags/scripts, saving, backpack, dialog choices, Tiled maps.
- **Next:** the owner answers the campus plan questions (scale, floor plans, which interiors, event
  details). Phase 1 foundation of [docs/GAME_PLAN.md](docs/GAME_PLAN.md) is still the prerequisite.

## How to run it
```
npm start                 # http://localhost:8080 (dev mode on; add ?dev=0 to play without dev tools)
npm test                  # unit + browser tests (also run automatically before git push)
npm run feedback          # feedback items waiting on the agent (docs/FEEDBACK.md)
npm run assets            # regenerate assets/ after editing tools/make-assets.js
```
First time on a new machine: `npm install && npx playwright install chromium`. The game itself
needs no install, just Node and internet (Phaser from cdnjs, font from Google Fonts).
Debugging: `game.scene.getScene('world')` and `GameState` in the browser console.

## Where things live
- `src/items.js`, `src/maps.js`: content (items; test maps with buildings, warps, pickups, NPCs).
- `src/maplogic.js`: pure map helpers shared by the game and the tests.
- `src/state.js`: constants, `Inventory`, `GameState`.
- `src/scenes/world.js` (restarted per map), `src/scenes/ui.js` (persistent HUD), `src/main.js` (boot, `DEV_MODE`).
- `src/dev/`: feedback overlay (dev only). `server.js`: static files + feedback API on 127.0.0.1.
- `tools/`: `make-assets.js` (pixel art), `feedback-store.js` + `feedback.js`.
- `tests/unit`, `tests/e2e`, `.githooks/pre-push`, `.github/workflows/test.yml`. `feedback/`: feedback items.
- `docs/research/`: campus facts, measurements, tour scene list (no third-party images).

## Constraints
- $0: free software and free/original assets only. The game loads no npm packages; npm is for dev
  tooling only ([ADR 0005](decisions/0005-automated-tests-on-every-push.md)).
- Art is 16x16 per tile/frame, characters included. The canvas is 960x540, world zoom 3, UI unzoomed.
- Real campus: the virtual tour, Google Maps and Wikimedia photos are reference only; OpenStreetMap data
  is ODbL with attribution. No real logos or real people without permission.

## Rules and plans
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) · [docs/GAME_PLAN.md](docs/GAME_PLAN.md) (approved 2026-09-13)
- [docs/CAMPUS_MAP_PLAN.md](docs/CAMPUS_MAP_PLAN.md) (proposal, waiting on owner answers) · [docs/research/](docs/research/)
- [docs/TESTING.md](docs/TESTING.md) · [docs/FEEDBACK.md](docs/FEEDBACK.md)

## Memory
- [MEMORY.md](MEMORY.md): dated log of what happened and why
- [ERRORS.md](ERRORS.md): failures hit and how they were resolved
- [decisions/](decisions/): numbered architecture decision records
