# Pixel Quest — context

**Last updated:** 2026-09-13 · **Repo:** not pushed yet (local git only) · **Local:** `C:\Users\Mustafa\Desktop\Mustafa\Projects\2D_pixel_game`

## What this is
A small top-down pixel-art RPG exploration game that runs in the browser. It looks like the
Game Boy Pokémon games and aims to play like Realm of the Mad God (real-time movement, later
mouse-aimed shooting). It is built only with free software and original art.

## Why it exists
The owner wants to learn how games like ROTMG are built by making a small one, one playable step
at a time. The scope is deliberately small. The agent makes the design and technical choices, and
the owner plays each version, rates it, and asks for changes.

## Current state
- **Works:** a 40x30-tile world (grass, flowers, tall grass, paths, water, trees, rocks). One
  player character with 4-direction walk animations, WASD/arrow movement at 80 px/s (diagonals
  normalized), collision against water, trees and rocks (feet-only hitbox), and a camera that
  follows the player inside the map bounds. Checked in the browser on 2026-09-13.
- **Not yet:** depth sorting (the player's head doesn't go behind trees), NPCs, enemies, combat,
  items, sound, save games.
- **Next:** roadmap step 2 in [README.md](README.md#roadmap-small-steps-each-one-playable).

## How to run it
```
npm start            # serves the game at http://localhost:8080 (no npm install needed)
npm run assets       # regenerate assets/*.png after editing tools/make-assets.js
```
Needs Node.js and internet on first load (Phaser comes from cdnjs).

## Where things live
- `src/map.js`: the world as text rows. The legend and solid tiles are defined in the same file.
- `src/main.js`: the Phaser scene: loading, tilemap, player, input, camera.
- `tools/make-assets.js`: all pixel art as text sprites plus the palette, which writes the PNGs.
- `assets/`: generated PNGs. Don't hand-edit them.
- `server.js`: static file server using Node built-ins only.

## Constraints
- $0: free software and free/original assets only.
- No build step and no npm dependencies until [ADR 0003](decisions/0003-no-build-step.md) is superseded.
- Tiles and character frames are 16x16 px. The virtual screen is 320x180, scaled to fit the window.

## Memory
- [MEMORY.md](MEMORY.md): dated log of what happened and why
- [ERRORS.md](ERRORS.md): failures hit and how they were resolved
- [decisions/](decisions/): numbered architecture decision records
