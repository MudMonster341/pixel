---
status: accepted
date: 2026-09-13
authored_by: agent
derived_from: ["owner answers 2026-09-13 to docs/CAMPUS_MAP_PLAN.md", "OSM wall-angle measurement 2026-09-13"]
supersedes: null
superseded_by: null
---

# 0007 — Generate the campus map from OpenStreetMap into Tiled JSON, on the fence/road grid, entrance at the bottom

## Context
The owner wants the real BITS Pilani Dubai campus, true to layout and scale, with DIAC Park nearby.
They accepted 2 m per tile outdoors and 1 m per tile indoors. They asked for the map to be "straight
according to the entrance", with permission to compromise if that's hard.

Measuring wall angles in OpenStreetMap shows **two grids about 45° apart**. The Main Block,
Library and Mechanical Block run about 5° off north. The fence, all hostels, the track, the D54
road and the neighbouring campuses run about 39° off north.

At 2 m per tile the campus plus the DIAC ring is about 440 × 440 tiles, far too big for text maps.

## Options considered
1. **Hand-draw the map in Tiled from satellite images.** Full control. Cost: weeks of manual tracing,
   not reproducible, and scale errors creep in.
2. **Rasterise OpenStreetMap exactly as it is.** Faithful. Cost: one of the two grids ends up at 45°,
   so its walls become staircases, which looks broken in pixel art.
3. **A generator script that turns OpenStreetMap plus a small layout config into Tiled JSON.** It uses
   the fence/road grid, straightens the academic complex as one group around its centre (keeping
   sizes and relative positions), and adds hand-measured features OpenStreetMap lacks (track, courts,
   parking, lawns).

## Decision
Use option 3: `tools/campus/build-campus.js` with `tools/campus/layout.js`, writing
`assets/maps/campus.json` (Tiled format, loaded natively by Phaser) and a preview image.

- The map uses the grid of the fence, roads and hostels, because that's most of the campus.
- The entrance is at the **bottom**, so walking in through the gate means walking up, and building
  fronts with doors face the viewer as in Pokémon. `layout.flip` turns the map 180° if the owner meant
  the gate at the top.
- Buildings on other campuses are solid outside walls only. DIAC Park gets its walkways from OpenStreetMap.
- Interiors come next as separate maps at 1 m per tile. Rooms start empty; the foyer, auditorium,
  library, canteen and a lab corridor come first. Hostels are exteriors only.
- The campus becomes the start map. The meadow and house stay as test maps, reached with `?map=meadow`.

## Consequences
- Easy: the layout is reproducible and adjustable. Change a number in `layout.js` and re-run.
  A test checks the committed map matches the generator.
- Easy: the tests read the same Tiled data (spawn is walkable, entrances are reachable).
- Hard: the academic complex is rotated about 44° from reality, so its walkways meet the rest of the
  campus less exactly. Positions near the complex are approximate.
- Hard: features missing from OpenStreetMap (track, courts, parking) are estimated from the
  annotated campus photo map (roughly ±10 m) and marked in `layout.js`.
- Hand edits made in Tiled would be lost when the map is regenerated. Hand-made detail goes into
  `layout.js` or separate layers the generator doesn't touch.
- Map data is derived from OpenStreetMap (ODbL), so attribution stays in the map properties and docs.
- Revisit if: the owner wants exact satellite-accurate diagonal geometry, or hand-painting in Tiled
  becomes the main workflow (then generate once and stop regenerating).

## Links
- Plan: [docs/CAMPUS_MAP_PLAN.md](../docs/CAMPUS_MAP_PLAN.md) · Research: [docs/research/bits-dubai-campus.md](../docs/research/bits-dubai-campus.md)
- Related: [ADR 0002](0002-generate-pixel-art-from-code.md) (same "generated from a script" approach)
