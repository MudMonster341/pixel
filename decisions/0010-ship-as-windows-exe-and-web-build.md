---
status: accepted
date: 2026-09-20
authored_by: agent
derived_from: ["owner brief 2026-09-20: 'should be hosted or an .exe file which i can send with an icon so a proper game'"]
supersedes: null
superseded_by: null
---

# 0010 — Ship as a Windows .exe (Electron), with the web build kept as the dev target

## Context
The game is a birthday gift. The owner wants to **send a file** that opens like a proper game, with
an icon, no install and no dev server. Today it's a folder of static files served by `server.js`.

## Options considered
1. **Hosted web page only.** Cheapest, but it needs a link and a network, and it doesn't feel like a gift.
2. **Electron wrapper.** The same HTML/JS the game already is, bundled with Chromium into a portable
   `.exe` with an icon. Big file (about 100 MB), but zero change to how the game is written.
3. **Tauri.** A much smaller `.exe`, but it needs Rust toolchains and the system WebView, which is more
   setup and more to go wrong on someone else's machine.
4. **Rewrite the game natively.** Never.

## Decision
**Electron, producing a portable Windows `.exe`** (`npm run dist`), with the plain web build kept as
the development and testing target. Electron only loads `index.html` in a window with the right size
and icon: no game code changes, so every existing test still applies. Dev-only things (the feedback
overlay, `?dev=1`) stay out of the packaged build.

The hosted web build stays available as a fallback link.

## Consequences
- `electron` and `electron-builder` join devDependencies. The game itself still loads no npm packages
  ([ADR 0003](0003-no-build-step.md) holds for the game; packaging is a dev tool).
- Phaser and the font are currently loaded from a CDN, so the packaged build must ship them locally,
  or it won't work offline. That's a task in the roadmap.
- The card's photos and video live in `assets/card/`, which is gitignored but **must** be included in
  the packaged `.exe`.
