---
status: accepted
date: 2026-09-13
authored_by: agent
derived_from: ["user request 2026-09-13: 'build the assets', free assets only"]
supersedes: null
superseded_by: null
---

# 0002 — Generate the starter pixel art from text sprites in a script

## Context
The user asked for all assets to be free and for the agent to build them. Every sprite needs a
clear license, and the agent should not download files without the user's say-so.

## Options considered
1. **Download a CC0 pack (e.g. Kenney, OpenGameArt)** — higher-quality art right away. Cost:
   downloading third-party files without the user present, per-pack license checks, and a style
   that may not match later additions.
2. **Draw PNGs by hand in Piskel/LibreSprite** — best control. Cost: the user said they don't want
   to do this work themselves right now.
3. **Text sprites turned into PNGs by `tools/make-assets.js`** — each sprite is a 16x16 grid of
   palette characters, written out as PNGs with no dependencies (Node `zlib` only).

## Decision
Generate the art with `tools/make-assets.js`. It is original work with no license questions, it
can be diffed and reviewed like code, and the agent can change it whenever the user asks.

## Consequences
- Easy: tweak a pixel, re-run `npm run assets`, refresh. One shared palette keeps the style
  consistent.
- Hard: detailed art (big buildings, enemies with many animation frames) gets tedious as text.
- The game only reads `assets/*.png`, so hand-drawn or CC0 PNGs can replace generated ones without
  code changes as long as they keep the same layout (16x16 grid, same frame order).
- Revisit if: the art needs outgrow text grids. Then switch to Aseprite/LibreSprite files or a
  CC0 pack, recorded in a new ADR.

## Links
- Related: [ADR 0001](0001-use-phaser-3-in-the-browser.md)
