# Pixel Quest

A small top-down pixel RPG exploration game. It looks like the old Pokémon games and plays like
Realm of the Mad God (ROTMG). Everything here is free: free engine, free tools, and original art.

## Play it

You need [Node.js](https://nodejs.org) (free). There's nothing to install.

```bash
npm start
```

Then open **http://localhost:8080**.

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| E / Space | Talk, next line of dialog |
| 1-5 / mouse wheel / click | Select inventory slot |
| M | Show/hide minimap |
| H | Show controls |
| Esc | Skip tutorial |

## The stack (all free)

| Part | Tool | Why |
|---|---|---|
| Game engine | [Phaser 3](https://phaser.io) (JavaScript) | Runs in the browser like ROTMG. Handles tilemaps, physics, cameras and animation |
| Art | `tools/make-assets.js` | Pixel art written as text and turned into PNGs. Original, so no license worries |
| Local server | `server.js` | Browsers won't load game images straight off the disk |
| Code editor | [VS Code](https://code.visualstudio.com) | Free |

Free tools for later:
- **[Tiled](https://www.mapeditor.org)**: draw maps visually instead of editing text.
- **[Piskel](https://www.piskelapp.com)** (in the browser) or **[LibreSprite](https://libresprite.github.io)**: draw pixel art by hand.
- **Free art packs** (check each license; CC0 means do anything): [Kenney.nl](https://kenney.nl/assets), [OpenGameArt](https://opengameart.org), free packs on [itch.io](https://itch.io/game-assets/free).
- **Free hosting**: GitHub Pages or itch.io.

## How it's put together

```
index.html            loads Phaser + the game scripts
src/items.js          item definitions
src/maps.js           the map list: the campus (generated) + text test maps with doors, items and NPCs
tools/campus/         campus map generator: OpenStreetMap extract + layout.js → assets/maps/campus.json
                      (run `npm run campus`; open the old test map with ?map=meadow)
src/maplogic.js       map helpers shared by the game and the tests
src/state.js          inventory + game state that survives moving between maps
src/scenes/world.js   the map, player, NPCs, pickups, doors
src/scenes/ui.js      minimap, inventory bar, dialog box, tutorial
src/main.js           loads the art and starts the game
src/dev/              dev-only tools (feedback overlay)
tools/make-assets.js  the pixel art (run `npm run assets` after changing it)
tools/feedback*.js    feedback storage + command line
assets/               the generated PNGs + tiles.json
server.js             local web server + feedback API
tests/                unit tests and browser tests
feedback/             feedback items from play-testing
```

**Change the world:** edit `src/maps.js` and refresh the browser.
**Change the art:** edit the text sprites in `tools/make-assets.js`, run `npm run assets`, and refresh.

## Tests

```bash
npm install && npx playwright install chromium
npm test
```

The first command is only needed once. `npm test` runs unit tests plus browser tests that play the game in Chromium. The same suite runs
automatically before every `git push` and on GitHub Actions. Details: [docs/TESTING.md](docs/TESTING.md).

## Giving feedback while playing (dev mode)

With `npm start` running, press **`` ` ``** (backtick) or click **Feedback** in the corner. The game
pauses, takes a screenshot (click it to point at something), and saves your note with where you
are. Answers to questions and fixes to check show up in the **Inbox** tab. Details:
[docs/FEEDBACK.md](docs/FEEDBACK.md). Add `?dev=0` to the address to play without dev tools.

## Roadmap (small steps, each one playable)

1. ✅ **Move one character** on a tile map with collisions and a camera that follows
2. ✅ **Tutorial, minimap, 5-slot inventory bar**
3. ✅ **A house you can enter** with an NPC you can talk to (dialog box, gives an item)
4. Trees and rocks drawn in front of or behind the player (depth sorting), plus animated water
5. A simple enemy that wanders and chases you. Health bar, taking damage
6. **ROTMG-style combat:** aim with the mouse, click to shoot projectiles
7. Loot drops, a small inventory, and XP/levels
8. Save the game in the browser (localStorage)
9. Maps built in Tiled instead of text
10. *(Big step)* Multiplayer: a Node.js WebSocket server so friends share the same world

## Project memory

Development notes live in [CONTEXT.md](CONTEXT.md), [MEMORY.md](MEMORY.md),
[ERRORS.md](ERRORS.md) and [decisions/](decisions/).
