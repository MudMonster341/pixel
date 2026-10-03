---
status: accepted
date: 2026-10-03
authored_by: agent
derived_from: ["owner design interview 2026-10-03 (she has a MacBook; wants a file she can open without setup)", "docs/plans/2026-10-03-birthday-sprint.md"]
supersedes: null
superseded_by: null
---

# 0017 — Ship an offline single-folder bundle that opens by double-click

## Context

The recipient plays on a MacBook. The only build so far is a Windows .exe (`npm run pack:win`), which
is useless to her. The game loads maps, sprites and audio through Phaser's loader, which uses XHR/fetch;
browsers block that for `file://` pages, so double-clicking `index.html` fails today. She is not
technical: it must open with a double-click, no install, no server, no security warning.

## Options considered
1. **Electron Mac `.app`.** Built on Windows, untestable here, unsigned: macOS (especially Apple
   Silicon) blocks unsigned apps ("damaged"), zipping from Windows can break the app's symlinks.
2. **Hosted URL.** The owner doesn't want it hosted.
3. **A folder + a local server she runs.** Needs a terminal; no.
4. **One offline bundle (chosen).** `dist/offline/index.html` with the runtime assets embedded as
   script-loaded data (script tags work on `file://`), loaded by a small loader shim instead of XHR.

## Decision
- `npm run pack:offline` (`tools/pack-offline.js`) builds `dist/offline/`: `index.html`, the game scripts,
  Phaser from `vendor/`, and the runtime assets only (maps, sprites, audio, `assets/card/`) as embedded
  data. The source packs under `assets/External Tilesets` and `assets/vendor` are **not** embedded.
- The loader reads the embedded data (data URIs / blobs), never local `fetch`. Plain script tags, no ES
  module imports, no features Safari lacks.
- Dev tools (the O feedback overlay) are off in the bundle (`?dev=0` behaviour is the default).
- It reads the gitignored `assets/card/` at build time, so the owner's real photos land in the bundle.
- Verified here under `file://` in Chrome/Edge. Safari can't be tested; the note to her says to use
  Safari or Chrome.
- Audio is embedded as MP3, not Ogg (older Safari cannot decode Ogg Vorbis): the bundler converts every `.ogg`
  at build time with pure-JS/WASM dev dependencies (no ffmpeg), and the shim answers `x.ogg` requests with the
  `x.mp3` data. The game and the dev build still use the Ogg files. Details: docs/OFFLINE_BUNDLE.md "Audio".
- The Windows .exe path (`pack:win`) is kept in the repo but not built unless the owner asks.

## Consequences
- The bundle is bigger than a loose-files build, but only runtime assets are embedded.
- Any new asset type must be registered in the bundler (a unit test checks every preloaded key is in the bundle manifest).
- Saves use `localStorage` on `file://`; this works in Safari and Chrome but is per-browser, so "Continue"
  only resumes in the same browser. Documented in the "how to open it" note.
