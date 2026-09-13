---
status: accepted
date: 2026-09-13
authored_by: agent
derived_from: ["user request 2026-09-13: small free 2D RPG exploration game, old-Pokemon look, inspired by ROTMG"]
supersedes: null
superseded_by: null
---

# 0001 — Build the game with Phaser 3 (JavaScript, runs in the browser)

## Context
The user wants a small top-down pixel RPG, built entirely with free software, starting with "move
one character" and growing from there. The stated long-term reference is Realm of the Mad God
(ROTMG), a browser-based real-time multiplayer shooter-RPG. The user wants the agent to make the
technical choices.

## Options considered
1. **Phaser 3** — free, MIT-licensed JS game framework. Built-in tilemaps, arcade physics,
   cameras, sprite animation. Runs in any browser, so sharing the game is sending a link.
   Cost: no visual editor; everything is code.
2. **Godot 4** — free, MIT-licensed engine with a full editor, strong 2D tooling. Cost: a ~100 MB
   editor install, GDScript to learn, and web export plus multiplayer is heavier than in JS.
3. **Plain HTML canvas, no framework** — zero dependencies. Cost: tilemaps, collision, cameras and
   animation all hand-written before any gameplay exists.

## Decision
Use Phaser 3 (3.80.1). It gets a playable character on screen fastest and matches ROTMG's own
path (a browser game), which later allows a Node.js WebSocket server in the same language.

## Consequences
- Easy: tile maps (and later Tiled `.json` maps), collisions, camera follow, and hosting for free
  (GitHub Pages / itch.io).
- Easy later: multiplayer server in Node.js sharing code with the client.
- Hard / given up: no scene editor like Godot's. Level design goes through text maps now and the
  free Tiled editor later.
- Revisit if: the user wants a desktop/console release, or finds a visual editor matters more than
  code-first control.

## Links
- Related: [ADR 0002](0002-generate-pixel-art-from-code.md), [ADR 0003](0003-no-build-step.md)
