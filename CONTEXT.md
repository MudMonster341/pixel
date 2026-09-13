# Pixel Quest — context

**Last updated:** 2026-09-13 · **Repo:** https://github.com/MudMonster341/pixel · **Local:** `C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game`

## What this is
A small top-down pixel-art exploration game that runs in the browser and looks like the DS-era
Pokémon games. The planned game is a cosy treasure hunt: talk to villagers, get clues, find 3 items,
open a secret door. No combat. Built only with free software and original art.

## Why it exists
The owner wants to learn how games like this are built by making a small one, one playable step
at a time, on a stable architecture that new maps and story can be added to without rework. The
agent makes the design and technical choices. The owner plays each version, reports feedback in-game,
and writes the story.

## Current state
- **Works (all covered by tests, 2026-09-13):**
  - Two maps (Meadow, Tomas's House) with doors between them, collisions, and a camera that follows.
  - Pickups into a 5-slot inventory (hotbar UI, to be replaced by a backpack).
  - NPC with typewriter dialog that gives an item; minimap (M); tutorial card (H) + checklist (ESC skips).
- **Dev tooling:**
  - `npm test` (31 unit + 26 browser tests) runs before every push and on GitHub Actions.
  - In-game feedback overlay (`` ` `` in dev mode) with an inbox. The agent reads it via `npm run feedback`.
- **Not yet:** ES modules, events/flags/scripts, saving, backpack, dialog choices, journal, signs,
  chests, the secret door, depth layering, sound.
- **Next:** Phase 1 (foundation) of [docs/GAME_PLAN.md](docs/GAME_PLAN.md). The owner is preparing
  the story and new map.

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
- `src/items.js`, `src/maps.js`: content (items; maps with buildings, warps, pickups, NPCs).
- `src/maplogic.js`: pure map helpers shared by the game and the tests.
- `src/state.js`: constants, `Inventory`, `GameState` (what survives map changes).
- `src/scenes/world.js`: map, player, NPCs, pickups, warps. Restarted on each map change.
- `src/scenes/ui.js`: minimap, hotbar, dialog, toast, tutorial. Never restarted.
- `src/main.js`: boot, Phaser config, `DEV_MODE`. `src/dev/`: feedback overlay (dev only).
- `server.js`: static files + feedback API, bound to 127.0.0.1.
- `tools/`: `make-assets.js` (all pixel art), `feedback-store.js` + `feedback.js` (feedback CLI).
- `tests/unit`, `tests/e2e`, `playwright.config.js`, `.githooks/pre-push`, `.github/workflows/test.yml`.
- `feedback/`: feedback items + screenshots (committed).

## Constraints
- $0: free software and free/original assets only.
- The game loads no npm packages. npm is for dev tooling only ([ADR 0005](decisions/0005-automated-tests-on-every-push.md)).
- Art is 16x16 per tile/frame, characters included. The canvas is 960x540, world zoom 3, UI unzoomed.

## Rules and plans (approved 2026-09-13)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): content is data; scripts, entities, saves/profiles, input rule
- [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md): bright DS-era Pokémon look with depth
- [docs/GAME_PLAN.md](docs/GAME_PLAN.md): treasure hunt, owner decisions, component backlog, phases
- [docs/TESTING.md](docs/TESTING.md) · [docs/FEEDBACK.md](docs/FEEDBACK.md)

## Memory
- [MEMORY.md](MEMORY.md): dated log of what happened and why
- [ERRORS.md](ERRORS.md): failures hit and how they were resolved
- [decisions/](decisions/): numbered architecture decision records
