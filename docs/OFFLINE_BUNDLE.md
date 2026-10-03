# Offline bundle (double-click `index.html`)

Decision: [ADR 0017](../decisions/0017-offline-bundle-for-mac.md). The recipient plays on a MacBook and
opens one folder by double-click: no install, no server, no security prompt.

## Build it

```bash
npm run pack:offline            # -> dist/offline/   (a folder you can double-click to test)
npm run pack:offline -- --zip   # -> also dist/offline.zip  (unzips to a "LUG-Treasure-Hunt" folder)
```

Plain Node, no extra dependencies (the zip is written by a small built-in writer on top of Node's `zlib`;
it opens with macOS Archive Utility and Windows Explorer). The script prints the per-folder and total
sizes and **fails** if any asset the game loads is missing. `dist/` is gitignored.

The folder contains `index.html`, `src/*.js` (the game's own scripts), `vendor/phaser/`, `data/assets-NN.js`
(the embedded assets, about 6 MB of text each at most), `src/offline-shim.js` and `HOW_TO_OPEN.txt`
(the plain-language note for her, generated). `HOW_TO_OPEN.txt` is in the zip too.

## Why a bundle is needed

A page opened from `file://` cannot XHR/fetch local files (Phaser's loader reads maps, JSON and audio
that way) and treats `file://` images as cross-origin, so WebGL refuses them as textures. Script tags,
`data:` URIs and `blob:` URLs do work from `file://`.

## How it works

1. `tools/pack-offline.js` collects the runtime assets (below) and writes them as
   `window.__OFFLINE_ASSETS['assets/foo.png'] = 'data:image/png;base64,...'` in `data/assets-NN.js`,
   split into several files so none is huge.
2. The bundle's `index.html` is generated from the repo's `index.html`: the shim and the data files load
   first, the Press Start 2P font is inlined as a data URI, and `src/dev/*` is dropped. The repo's own
   `index.html` (what `npm start` and the Electron app use) never mentions the shim, so the normal path
   is unchanged.
3. `src/offline-shim.js` (conservative ES5, no modules) patches, for registry paths only:
   - `XMLHttpRequest` (Phaser's loader): `open`/`send` are wrapped; a GET to a registry path is answered
     from the registry (text, json, arraybuffer or blob), asynchronously, with status 200.
   - `fetch` (the card and box scenes check for their optional videos with `fetch`).
   - `<img>`/`<audio>`/`<video>` `.src` (images get the data URI, media a blob URL made once). Videos need
     a `blob:` URL because Phaser draws them into a WebGL texture.
   - `URL.createObjectURL`: for a registry image blob it returns the data URI itself, so images are never
     "tainted" for WebGL whatever the browser does with blob origins on `file://`.
   - `localStorage`: if the browser blocks it, an in-memory stand-in is installed so the game still plays
     (it just cannot save). `src/save.js` is also try/catch-wrapped.
   - A path under `assets/` that is not in the registry (an optional file she never supplied, such as
     `assets/card/video.mp4`) gets a quiet synthetic 404, so the game's own "no video, no card.json"
     fallback runs without a console error. Any other path (`data:`, `blob:`, `http:`, `vendor/...`) passes
     through to the browser untouched.
   - It sets `window.__OFFLINE_BUNDLE = true`. `src/main.js` reads it (one line in `DEV_MODE`) so the dev
     overlay (the O feedback tool) stays off in the bundle even with `?dev=1`.
4. Audio: Phaser unlocks Web Audio on the first key press or click, and `AudioManager.bindGestureResume()`
   resumes a suspended context on every later gesture. Nothing extra is needed in the bundle.

## Which assets are embedded

Derived from what the game actually loads, never a hand-kept list:

- every `'assets/...'` string literal in `src/` (comments ignored): each `load.*` call, the `SOUNDS` table,
  mini-game backgrounds, box/card art, UI kit, ...;
- the templates (`assets/${...}`) expanded from the content: character sheets (`characterSheets()`), Tiled
  maps, cutscene art, clothes colours, the temporary card slides;
- the git-ignored owner content, read at build time: `assets/card/card.json`, every photo it lists in
  `assets/card/photos/`, and the optional `assets/card/video.mp4`; plus the optional
  `assets/cutscenes/video/box-opening.mp4`. Videos over 150 MB make the build fail (compress them).

`assets/vendor/` and `assets/External Tilesets/` are never embedded (the game does not load from them).
Without a `card.json` the build still succeeds and prints a NOTE: the card then shows the default
messages and the generated slideshow, exactly as in dev.

## Adding a new asset type or path

- A plain literal such as `this.load.image('x', 'assets/foo/x.png')` is picked up automatically; the file
  must exist or the build fails.
- A new **dynamic** path (a template literal like `` `assets/foo-${id}.png` ``) makes the build fail with
  "cannot expand" until you add a row to `TEMPLATE_HANDLERS` and a branch in `collectRuntimeAssets()` in
  `tools/pack-offline.js` (and a case in `tests/unit/pack-offline.test.js`).
- A new file extension needs a line in `MIME` in the same script.
- A new loader the shim does not know (say a different request API) needs patching in
  `src/offline-shim.js`, with a test in `tests/unit/pack-offline.test.js`.
- A new optional (may-be-absent) file goes into `OPTIONAL_STATIC`.

## Tests

- `tests/unit/pack-offline.test.js`: the manifest covers the content and every `load.*` literal; a missing
  asset or an unhandled dynamic path throws; the shim serves registry paths, passes others through and
  404s unregistered `assets/` paths; the bundle's `index.html` has no dev scripts; a scratch build is
  self-contained and every registry entry round-trips; the zip is valid. Runs in `npm run test:unit`.
- `tests/e2e/offline-bundle.spec.js`: builds the bundle and opens `dist/offline/index.html` via `file://`
  in Chromium: title scene up, zero console errors, no dev overlay, blocked `localStorage` survived.

## Checking it by hand (Safari cannot be automated here)

1. `npm run pack:offline -- --zip`, unzip `dist/offline.zip` somewhere else, double-click `index.html`.
2. In Chrome and in Safari: title appears; Play; walk; click once and music/footsteps play; finish a
   mini-game; reach the box, the card, the credits; quit and reopen in the same browser: Continue works.
3. Open the console: no errors. Try with the photos/video in `assets/card/` before the final build.
4. Known Safari risk: the audio is `.ogg`. Older Safari versions cannot decode Ogg Vorbis, which would
   mean silence there (the game still plays). `HOW_TO_OPEN.txt` tells her to try Chrome if Safari is silent.

## How the owner sends it

`npm run pack:offline -- --zip`, then send `dist/offline.zip` (it is a plain zip). She unzips it and
double-clicks `index.html`. Saves live in the browser she used, so "Continue" only works in that browser.
