---
status: accepted
date: 2026-09-16
authored_by: agent
derived_from: ["owner feedback FB-0021 (2026-09-16)", "owner answer in chat: 'Real layout, straightened'"]
supersedes: "0008"
superseded_by: null
---

# 0009 — The campus comes from OpenStreetMap again, straightened on the grid and cleaned up

## Context
[ADR 0008](0008-campus-as-straight-schematic-plan.md) replaced the OpenStreetMap-derived campus (C1)
with a hand-designed square schematic (C1.5). After playing it, the owner rejected the new layout in
FB-0021:
- "nothing like the normal one"
- the earlier map "followed the BITS map" and was "more intuitive"
- they want it back, with "just the pavements and paths fixed"

Their earlier feedback on C1 still stands: no angled map, no staircase fences, even-width paths, a
clear straight Gate 2 entrance, separate buildings, kerbed roads, more green, and a real tennis court
(FB-0003 to FB-0016).

Asked which way to rebuild, the owner chose **"Real layout, straightened"** from three options. The
other two were the exact old map with only the paths fixed, and everything forced to right angles.

## Decision
Rebuild the campus from the OpenStreetMap data again (ADR 0007's pipeline and frame), then clean it:
- **Real positions and shapes:**
  - the campus strip along the D54
  - real building footprints (L-shapes included) and the hostel row
  - track, field and courts where the annotated map puts them
  - the real DIAC Park design, the ring road and the roundabout
- **Straight inside the fence.** The campus frame lines up with the D54. The academic complex is
  rotated as one group onto the grid, and every building, fence, pavement and path inside the fence
  is snapped to axis-aligned (rectilinear) shapes. No staircase diagonals inside the campus.
- **Outside the fence,** roads keep their real routes (diagonals and curves allowed) but are drawn
  with a constant width and clean edges.
- **Clean-up rules from the C1 feedback:**
  - drop stray and tiny OSM leftovers
  - one closed fence loop broken only by the gates
  - constant-width pavements and walkways with borders
  - kerbs on roads
  - separate buildings with walkable gaps and modest wall heights
  - lawns, trees, palms and a proper tennis court
- **Kept from C1.5:** the tile kit, the `overhead` canopy layer, Gate 2 at the bottom with a straight
  approach, and the Side Gate.
- `tools/campus/layout.js` goes back to being settings plus clean-up rules and manual features, not a
  hand-drawn plan. `tools/campus/diac.osm` is parsed at build time again.

## Consequences
- The FB-0003 to FB-0016 tests keep their intent, and some change from "matches the schematic numbers"
  to "holds on the real layout".
- The data can still leak odd shapes, so the clean-up rules need tests: no staircases inside the fence,
  and no solid tiles blocking a walkway.
- Positions are as accurate as OpenStreetMap plus the Wikimedia annotated map, roughly ±10 m.
