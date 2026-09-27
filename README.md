# BITS Dubai: The LUG Treasure Hunt

A small pixel-art game, made as a birthday gift. You play a new student arriving at BITS Pilani
Dubai, join the LUG treasure hunt, win three keys, and open a birthday card at the end.

## Opening the game

1. Unzip `PixelQuest-win32-x64.zip` -- right-click it and choose **Extract All**, anywhere you like
   (your Desktop is fine).
2. Open the folder that appears and double-click **`PixelQuest.exe`**.
3. Windows may show a blue **"Windows protected your PC"** screen first. This just means the app
   isn't signed with a paid certificate -- it happens to almost every small, independently-made
   program. Click **More info**, then **Run anyway**, and the game will open normally from then on.
4. The game opens in its own window, starting on the title screen. Pick **Play** to start a new game,
   or **Continue** to pick up where you left off.

Nothing needs installing, and you don't need to be online -- it's a normal desktop app once it's
open.

## Controls

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| Shift | Run (outdoors only) |
| E / Space | Talk, advance a line of dialog |
| 1-5 / mouse wheel / click | Choose an inventory slot |
| M | Show/hide the minimap |
| N, or click the minimap | Full-screen map |
| J | Journal |
| Esc | Pause |
| F11 | Toggle fullscreen |

The game teaches each of these the first time you'd actually need it, so you don't need to memorize
this table before playing -- it's here for reference. The same list is always available in-game from
the pause menu (Esc → **Controls**) or from the title screen.

## Saving

Your progress saves itself automatically as you play -- there's no separate "save" button to
remember. It's stored inside the app itself, so it stays put between sessions on this computer.
**Continue** on the title screen picks up exactly where you left off. Once you've reached the end,
a **Watch the Card Again** option appears on the title screen too, so you can revisit the birthday
card any time without replaying the whole game.

## Credits

This game uses some free, third-party art and audio packs alongside original work -- every one of
them, and what it's used for, is listed in [CREDITS.md](CREDITS.md) and in the game's own **Credits**
screen (title screen → **Credits**).

---

## For developers

You need [Node.js](https://nodejs.org) (free). There's nothing else to install for the web build.

```bash
npm start
```

Then open **http://localhost:8080**.

### The stack (all free)

| Part | Tool | Why |
|---|---|---|
| Game engine | [Phaser 3](https://phaser.io) (JavaScript) | Runs in the browser. Handles tilemaps, physics, cameras and animation |
| Art | `tools/make-assets.js` and friends | Pixel art written as text/code and turned into PNGs, plus some third-party CC0/free packs (see [CREDITS.md](CREDITS.md)) |
| Local server | `server.js` | Browsers won't load game images straight off the disk |
| Code editor | [VS Code](https://code.visualstudio.com) | Free |

### How it's put together

```
index.html            loads Phaser + the game scripts
src/items.js          item definitions
src/maps.js           the map list: the campus (generated) + text test maps with doors, items and NPCs
tools/campus/         campus map generator: OpenStreetMap extract + layout.js → assets/maps/campus.json
                      (run `npm run campus`; open the old test map with ?map=meadow)
tools/interiors/      interior map generator (run `npm run interiors`)
src/maplogic.js       map helpers shared by the game and the tests
src/state.js          inventory + game state that survives moving between maps
src/save.js           save/load (localStorage), profiles, autosave
src/scenes/world.js   the map, player, NPCs, pickups, doors
src/scenes/ui.js      minimap, inventory bar, dialog box, tutorial, pause menu, controls panel
src/scenes/title.js   title screen
src/scenes/card.js    the ending's birthday card
src/minigames/        the three key mini-games (platformer, flyer, Tetris)
src/dev/              dev-only tools (feedback overlay)
tools/make-*.js       the pixel art (run `npm run assets` after changing any of them)
tools/feedback*.js    feedback storage + command line
assets/               the generated PNGs, audio and maps
server.js             local web server + feedback API
tests/                unit tests and browser tests
feedback/             feedback items from play-testing
```

**Change the world:** edit `src/maps.js` and refresh the browser.
**Change the art:** edit the text/code sprites in `tools/make-assets.js` (or the matching
`tools/make-*.js` file), run `npm run assets`, and refresh. Never hand-edit the PNGs in `assets/`.

### Tests

```bash
npm install && npx playwright install chromium
npm test
```

The first command is only needed once. `npm test` runs unit tests plus browser tests that play the
game in Chromium. The same suite runs automatically before every `git push` and on GitHub Actions.
Details: [docs/TESTING.md](docs/TESTING.md).

### The birthday card (the ending)

The game ends on a full-screen animated birthday card. It plays on a finished-looking temporary
slideshow out of the box; to put in real photos, messages and a video, drop them into `assets/card/`
(never committed -- see `.gitignore`, and copy the shape from
`assets/card/card.example.json`). Full details: [docs/STORY.md](docs/STORY.md) "How to put your
photos and messages in".

### Useful scripts

```
npm start           # http://localhost:8080
npm test            # unit + browser tests
npm run assets       # regenerate all generated art after editing tools/make-*.js
npm run campus       # regenerate the campus map
npm run interiors    # regenerate the interior maps
npm run qa:shots     # screenshots of every area/room into qa-shots/
npm run feedback     # feedback waiting on the agent
npm run pack:win     # dist/PixelQuest-win32-x64.zip -- the sendable build
npm run dist         # dist/PixelQuest-portable.exe -- single-file build (needs Developer Mode/admin)
```

### Building and sending the game

For playtesting and development, keep using `npm start` (the web build). To send the finished game
to someone as a file that just opens, with no install and no server to run, build a Windows app
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

- **If the card is for someone specific**, drop their photos, messages and video into
  `assets/card/` *first* (see "The birthday card" above and [docs/STORY.md](docs/STORY.md)) -- then
  build. The folder is gitignored, never committed, and either build works fine even if it's empty
  (the card falls back to its temporary slideshow).
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

### Giving feedback while playing (dev mode)

With `npm start` running, press **O** or click the yellow **Feedback** button in the corner. The game
pauses, takes a screenshot (click it to point at something), and saves your note with where you
are. Answers to questions and fixes to check show up in the **Inbox** tab. Details:
[docs/FEEDBACK.md](docs/FEEDBACK.md). Add `?dev=0` to the address to play without dev tools.

### Where to start

Read [HANDOFF.md](HANDOFF.md) first, then [CONTEXT.md](CONTEXT.md) and the last few entries of
[MEMORY.md](MEMORY.md). Other useful pointers: [docs/ROADMAP.md](docs/ROADMAP.md) (what's built and
what's next), [docs/STORY.md](docs/STORY.md) (the script this game follows),
[docs/GAME_FEEL.md](docs/GAME_FEEL.md) (the UI/UX standard), [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md)
(art rules), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (content vs. engine), and
[decisions/](decisions/) (ADRs) / [ERRORS.md](ERRORS.md) (failures and fixes) for the history behind
any of it.
