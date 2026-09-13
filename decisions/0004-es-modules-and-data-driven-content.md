---
status: accepted
date: 2026-09-13
authored_by: agent
derived_from: ["owner request 2026-09-13: stable architecture, base components first, uniform method for adding new content", "ADR 0003 tripwire: more than ~6 source files"]
supersedes: null
superseded_by: null
---

# 0004 — Native ES modules, data-driven content, still no build step

## Context
The project reached 6 source files that share globals, and they only work if `index.html` loads
them in the right order. That is the tripwire named in [ADR 0003](0003-no-build-step.md). The owner
now wants a stable base where new maps, NPCs, clues and items are added the same way every time,
for a treasure hunt that will grow with new content. Today, NPC dialog is a hand-written JavaScript
function, which doesn't scale and can't be checked automatically.

## Options considered
1. **Keep plain scripts and globals.** No change needed now. Cost: every new file adds ordering
   risk and name collisions, and content keeps drifting into code.
2. **Vite + npm with ES modules.** Hot reload, bundling, room for TypeScript. Cost: `npm install`,
   `node_modules`, a build tool to learn, and dependency updates that can break things.
3. **Native ES modules (`<script type="module">`) served by the existing `server.js`.** Real
   `import`/`export`, no load-order problems, and still nothing to install. Cost: no hot reload,
   and Phaser stays a CDN global rather than an import.

Content format, considered alongside:
- **a. Functions in data** (today): flexible, but arbitrary code can't be validated.
- **b. Conditions + actions as plain objects** (see `docs/ARCHITECTURE.md`): limited to what the
  script runner supports, but it can be validated at boot, saved, and later edited in tools like
  Tiled.

## Decision
Move to native ES modules (option 3), and express all story logic as conditions and
actions (option b). Option 3 removes the global/order problem without giving up the zero-install
setup that has worked so far. Option b is what makes "new content = data only" enforceable.

## Consequences
- Easy: adding a map or NPC is one new data file plus one registration line. Boot-time validation
  catches typos.
- Easy: GameState + data fully describe the game, so save/load and a debug mode follow naturally.
- Hard: a story beat the script runner can't express needs a new generic action first (more work
  than an inline function, but reusable afterwards).
- Hard: a one-time refactor of the current 6 files.
- Revisit if: hot reload becomes painful to live without, TypeScript is wanted, or a multiplayer
  server is added. Then move to Vite in a new ADR.

## Links
- Supersedes (when accepted): [ADR 0003](0003-no-build-step.md). Only the "plain script tags"
  part; "no build step" stays.
- Related: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
