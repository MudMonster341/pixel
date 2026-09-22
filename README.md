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
| Shift | Run (outdoors only) |
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

## The birthday card (the ending)

The game ends on a full-screen animated birthday card. It plays on placeholders out of the box; to
put in real photos, messages and a video, drop them into `assets/card/` (never committed -- see
`.gitignore`). Full details, including the exact `card.json` shape: [docs/STORY.md](docs/STORY.md)
"How to put your photos and messages in".

## How to build and send the game

For playtesting and development, keep using `npm start` (the web build) -- it needs Node and a
browser, same as always. To send the finished game to someone as a file that just opens, with no
install and no server to run, build a Windows app
([ADR 0010](decisions/0010-ship-as-windows-exe-and-web-build.md)). There are **two ways to build
one** -- pick whichever works on the machine you're building on:

| | `npm run dist` | `npm run pack:win` |
|---|---|---|
| Tool | electron-builder | @electron/packager |
| Output | **one** `.exe` file | a folder, zipped |
| Size | ~100-120 MB (one file) | ~270 MB folder / ~110 MB zipped |
| Needs on this machine | Developer Mode **or** admin terminal (see below) | nothing extra -- works everywhere |
| Send the receiver | the single `.exe` | the `.zip`; they unzip it, then run the `.exe` inside |

Both produce the exact same game -- same `index.html`/`src/`, same `server.js`, same
`electron/main.js` window -- just packaged differently. Prefer `npm run dist`'s single file when you
can build it (nicer to send); use `npm run pack:win` when you can't turn on Developer Mode or don't
have an admin terminal handy.

```bash
npm run dist       # single PixelQuest-portable.exe (needs Developer Mode/admin, see below)
npm run pack:win    # dist/PixelQuest-win32-x64.zip (works everywhere, no setting to change)
```

- **If the card is for someone specific**, drop their photos, messages and video into
  `assets/card/` *first* (see "The birthday card" above and [docs/STORY.md](docs/STORY.md)) -- then
  build. The folder is gitignored, never committed, and either build works fine even if it's empty
  (the card falls back to its placeholders).
- **`npm run dist` output:** `dist\PixelQuest-portable.exe` -- a single portable executable. No
  installer, no admin rights *to run it*, nothing else to send -- just that one file.
- **`npm run pack:win` output:** `dist\PixelQuest-win32-x64\` (containing `PixelQuest.exe` plus
  Chromium's supporting files) and `dist\PixelQuest-win32-x64.zip` -- send the `.zip`; the receiver
  unzips it anywhere and runs `PixelQuest.exe` from inside the unzipped folder (moving just the
  `.exe` out on its own won't work -- it needs the files alongside it).
  `dist/` itself is gitignored either way; it's rebuilt from source each time, never committed.
- **Sending it:** however it was built, the receiver needs no internet to run it (Phaser and the
  font are vendored locally, see `vendor/README.md`) and no account/install step. Their progress
  (`localStorage`, [src/save.js](src/save.js)) is saved inside the app and survives closing and
  reopening it, completely separate from any save made playing the web build.
- **What's inside:** the same `index.html`/`src/` the web build serves, run through the same
  `server.js` on a local port inside the app ([electron/main.js](electron/main.js)) -- no game code
  is different between either packaged build and the web build. The dev feedback overlay and
  anything gated on `DEV_MODE` never ship: the packaged app always loads with `?dev=0` forced,
  regardless of the hostname-based default `src/main.js` uses for the web build.
- **The internal port** (M6.6): the app tries a short list of ports (starting at 51973) and uses
  whichever is free, instead of failing outright if something else happens to be using the first
  one. Whichever port it lands on, the window always loads a fixed `pixelquest://app/` address
  ([electron/main.js](electron/main.js) `registerAppProtocol()`), never the raw
  `http://127.0.0.1:<port>` address directly -- browsers key `localStorage` by the exact address a
  page loaded from, so if the window's address changed with the port, a save made on one launch
  could look like it had vanished on the next, the moment the app ever had to fall back to a
  different port. The fixed address forwards every request through to the real port underneath, so
  the save (`localStorage`) is keyed identically no matter which port the server actually used.
- **F11** toggles fullscreen in either packaged build. DevTools are compiled out entirely unless it's
  started with `--devtools` (`npm run electron -- --devtools`), which neither `npm run dist` nor
  `npm run pack:win` ever passes.
- **First build on a new machine:** either script downloads Electron the first time (needs internet
  just for that one-time setup, same as any `npm install`); the produced app itself needs no
  internet to run.
  - **`npm run dist`** additionally needs electron-builder's own helper tools, which on Windows
    includes an archive (`winCodeSign`) containing macOS files with symbolic links inside it.
    Extracting a symlink needs `SeCreateSymbolicLinkPrivilege`, which a normal (non-admin, non-
    Developer-Mode) Windows account doesn't have -- without it, the build fails partway through
    with exactly this error:
    ```
    ERROR: Cannot create symbolic link : A required privilege is not held by the client :
    ...\electron-builder\Cache\winCodeSign\...\darwin\...\lib\libcrypto.dylib
    ```
    Fix it once, machine-wide, either way (a one-off hiccup, not something the build needs on every
    run afterwards):
    - Turn on [Developer Mode](ms-settings:developers) (Settings -> System -> For developers ->
      Developer Mode), **or**
    - Run the build from an elevated ("Run as administrator") terminal.
  - **`npm run pack:win`** never downloads or extracts that archive (`@electron/packager` doesn't use
    electron-builder's code-signing tooling at all), so it needs no privilege change on any machine --
    that's the whole reason it exists as a second option.
- **Regenerating the icon:** `npm run icon` rebuilds `build/icon.ico` from
  [tools/make-icon.js](tools/make-icon.js) (a small drawn BITS gate/arch motif, the same style as
  every other sprite in the game) -- both `npm run dist` and `npm run pack:win` always run it first,
  so the committed `build/icon.ico` only needs regenerating by hand if you're editing the icon's own
  art.

## Giving feedback while playing (dev mode)

With `npm start` running, press **O** or click the yellow **Feedback** button in the corner. The game
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
