---
status: superseded
date: 2026-09-13
authored_by: agent
derived_from: ["owner feedback FB-0003, FB-0004, FB-0005, FB-0007 to FB-0014 on the C1 campus test version (2026-09-13)"]
supersedes: "0007"
superseded_by: "0009"
---

# 0008 — The campus is a hand-designed, fully straight plan (measured from OpenStreetMap, not traced from it)

## Context
[ADR 0007](0007-campus-map-from-osm-into-tiled.md) drew the campus by rasterising OpenStreetMap ways
onto a 2 m grid and rotating the academic complex. The owner played it and rejected the result:
- the map looks angular, and fences and paths run diagonally as staircases (FB-0004, 0008, 0009, 0013)
- structures appear that shouldn't be there (FB-0003)
- path widths are uneven and paths go everywhere (FB-0005, 0007)
- there's no clear straight main entrance; the real **Gate 2** should be added, plus a second
  entrance (FB-0008, 0010, 0012)
- separate buildings are merged and can't be walked between (FB-0011)
- roads and pavements don't read as roads and pavements (FB-0014)

The owner wants the campus to "appear straight up": readable, walkable and game-like, while staying
recognisably BITS Dubai.

## Options considered
1. **Keep rasterising OpenStreetMap and add clean-up filters** (drop small buildings, snap paths).
   Cost: every fix is a heuristic, and odd geometry keeps leaking through; widths still come from the data.
2. **A hand-designed schematic plan in `tools/campus/layout.js`.** Every building, road, pavement, path,
   gate, fence and green area is an axis-aligned shape with fixed widths, placed using measurements from
   OpenStreetMap and photos. The generator only draws that plan.
3. **Hand-paint the map in Tiled.** Full control. Cost: slow, not reviewable as code, no tests on layout
   intent, and it needs the owner's time.

## Decision
Use option 2. The campus becomes a straight schematic plan:
- **Everything is axis-aligned.** The D54 road runs straight along one edge, and there are no diagonal
  walls, fences or paths.
- The real **Gate 2 main entrance** is a straight, obvious approach; the second entrance comes from FB-0012.
- **Standard widths.** Roads have kerbs and pavements; internal walkways use a small set of widths.
  Only paths that make sense are kept.
- **Buildings that are separate in real life are separate footprints**, with walkable gaps between them.
- Positions and sizes come from OpenStreetMap and photo measurements, but are rounded to the plan grid.
  The OpenStreetMap extract stays in the repo as the measurement reference.

The Tiled output, the 2 m-per-tile scale, the generator workflow, the tests and "gate at the bottom"
from ADR 0007 all stay.

## Consequences
- Easy: the map reads cleanly, widths are consistent, and every change is a readable edit to the plan.
- Easy: tests can check intent (gates connect to roads, buildings are separated, paths reach entrances).
- Hard: less geographically exact. Positions are approximate (roughly ±15 m) and real angles are dropped.
- Hard: the plan has to be maintained by hand as features are added.
- Revisit if: the owner wants satellite-exact geometry after all, or starts painting maps in Tiled.

## Links
- Supersedes: [ADR 0007](0007-campus-map-from-osm-into-tiled.md) (rasterising OSM + straightening). Its
  Tiled/generator/scale parts carry over.
- Feedback: FB-0003, FB-0004, FB-0005, FB-0007, FB-0008, FB-0009, FB-0010, FB-0011, FB-0012, FB-0013, FB-0014
