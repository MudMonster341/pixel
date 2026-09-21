---
status: accepted
date: 2026-09-21
authored_by: agent
derived_from: ["owner feedback FB-0025", "the owner downloaded Modern Interiors Free and Sprout Lands into assets/External Tilesets on 2026-09-21"]
supersedes: "0002"
superseded_by: null
---

# 0012 — Art comes from third-party pixel-art packs, not from our own code

## Context
[ADR 0002](0002-generate-pixel-art-from-code.md) had every sprite drawn in code, because it cost
nothing and needed no artist. After playing the campus the owner rejected the result (FB-0025):
*"Don't try making assets on your own because you are sort of bad at it. Find open source asset
packages... change all the trees, pavements, everything."* They then downloaded two packs themselves.

The game is a **private birthday gift**, never sold, which is what makes non-commercial licences usable.

## Decision
Art comes from packs, and we only draw what no pack covers.

| Pack | Author | Licence | Used for |
|---|---|---|---|
| Roguelike Modern City + Pixel Vehicle | Kenney | CC0 (public domain) | Roads, kerbs, lane markings, crossings, pavements, parked cars |
| Modern Interiors **Free** v2.2 (16×16) | LimeZu | Free version: **non-commercial use and editing allowed**, no reselling | Interior floors, walls, doors and furniture (Room Builder), and the **characters** (16×16 walk/idle/run sheets) |
| Sprout Lands **Basic** | Cup Nooble | Non-commercial, editing allowed, **credit required**, pack itself must not be redistributed | Outdoor greenery: trees, bushes, flowers, grass detail |

Rules that follow:
- **The game stays non-commercial.** It's a gift; it must never be sold. If that ever changes, the
  LimeZu and Sprout Lands art has to be replaced or licensed (LimeZu's full pack is about $1.20).
- **Credit is required** for Sprout Lands and is given to everyone anyway, in `CREDITS.md` and on the
  title screen's Credits page.
- **Raw packs are never committed.** `assets/External Tilesets/` and the two vendor folders are
  gitignored, because redistributing the packs themselves isn't allowed. The game ships their art
  baked into our generated sheets, which is ordinary use. Anyone rebuilding from a clean clone needs
  to download the packs again; `CREDITS.md` says where from.
- Hand-drawn art stays only where no pack fits: the BITS building exteriors (sand-beige walls with
  terracotta trim, seen 3/4 from above), the gate, the cutscene illustrations and the dialog box.
- Tile **names and indices stay stable** when art is swapped, so every generated map and test keeps working.

## Consequences
- The look improves a lot for free, at the cost of a licence that forbids selling the game.
- Two art styles now meet: LimeZu (modern, soft shading) indoors and Kenney (flat) outdoors, with
  Sprout Lands greenery between them. Everything gets recoloured towards the campus palette in
  [STYLE_GUIDE.md](../docs/STYLE_GUIDE.md), and mismatches are a bug worth reporting.
- A clean clone can't regenerate the art without the packs, so `assets/` generated files stay committed.
