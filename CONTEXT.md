# Pixel Quest — context

**Last updated:** 2026-09-13 · **Repo:** https://github.com/MudMonster341/pixel · **Local:** `C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game`

## What this is
A small top-down pixel-art exploration game that runs in the browser and looks like the
Game Boy/DS Pokémon games. The planned game is a treasure hunt: talk to villagers, get clues, find
3 items, open a secret door. It is built only with free software and original art.

## Why it exists
The owner wants to learn how games like this are built by making a small one, one playable step
at a time, on a stable architecture that new maps and story can be added to without rework. The
agent makes the design and technical choices, and the owner plays each version, rates it, and asks
for changes.

## Current state
- **Works (browser-tested 2026-09-13):**
  - Two maps: Meadow, and Tomas's House. You walk through the door to switch maps, with a fade.
  - Player movement, collisions and a camera that follows.
  - Items on the ground go into a 5-slot hotbar and stack. Select a slot with 1-5, the mouse wheel
    or a click.
  - NPC with a typewriter dialog that gives an item, and an "E" prompt when you're in range.
  - Minimap (M), tutorial controls card (H) plus an objectives checklist (ESC skips it), toasts.
- **Not yet:** saving, a clue journal, conditional dialog beyond hand-written functions, signs and
  chests, a locked/secret door, walking behind tall objects, sound.
- **Next:** base systems for the treasure hunt (see MEMORY.md, last entry).

## How to run it
```
npm start            # http://localhost:8080 (no npm install needed)
npm run assets       # regenerate assets/ after editing tools/make-assets.js
```
Needs Node.js and internet on first load (Phaser from cdnjs, font from Google Fonts).
Debugging: `game.scene.getScene('world')` in the browser console.

## Where things live
- `src/items.js`: item definitions (name, icon frame, stack size).
- `src/maps.js`: every map (text rows + legend), buildings, warps, pickups, NPCs and their talk.
- `src/state.js`: shared constants, the `Inventory` class, and `GameState` (what survives map changes).
- `src/scenes/world.js`: map building, player, NPCs, pickups, warps. Restarted on each map change.
- `src/scenes/ui.js`: minimap, hotbar, dialog box, toast, tutorial. Never restarted.
- `src/main.js`: boot/preload and the Phaser config.
- `tools/make-assets.js`: all pixel art and the palette. Writes `assets/*.png` + `assets/tiles.json`.

## Constraints
- $0: free software and free/original assets only.
- No build step and no npm dependencies ([ADR 0003](decisions/0003-no-build-step.md)).
- Art is 16x16 per tile/frame. The canvas is 960x540, the world camera zoom is 3 (320x180 of world
  visible), and the UI draws unzoomed.

## Memory
- [MEMORY.md](MEMORY.md): dated log of what happened and why
- [ERRORS.md](ERRORS.md): failures hit and how they were resolved
- [decisions/](decisions/): numbered architecture decision records
