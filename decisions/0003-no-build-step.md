---
status: accepted
date: 2026-09-13
authored_by: agent
derived_from: []
supersedes: null
superseded_by: null
---

# 0003 — No build step: plain script tags, Phaser from CDN, zero-dependency Node server

## Context
The project is meant to stay simple, and the owner is new to game development. Browsers block
WebGL from using images loaded over `file://`, so double-clicking `index.html` cannot work once
PNG assets exist. Some local HTTP server is required.

## Options considered
1. **Vite + npm packages** — hot reload, ES modules, bundling. Cost: `npm install`, a
   `node_modules` folder, and one more tool to explain before the game even runs.
2. **Plain `<script>` tags + Phaser from cdnjs + `server.js` (Node built-ins only)** — nothing to
   install. Cost: global variables shared between scripts, needs internet on first load, no hot
   reload.

## Decision
Use plain scripts with `server.js`. `npm start` works on a fresh clone with no install step.

## Consequences
- Easy: read the whole project in a few minutes; nothing breaks from dependency updates.
- Hard: once there are more than ~6 source files, globals and manual script order get fragile.
- Offline play needs `phaser.min.js` saved into the repo.
- Revisit when: the code grows past ~6 files, TypeScript is wanted, or a multiplayer server is
  added. At that point move to Vite and write an ADR that supersedes this one.

## Links
- Related: [ADR 0001](0001-use-phaser-3-in-the-browser.md)
