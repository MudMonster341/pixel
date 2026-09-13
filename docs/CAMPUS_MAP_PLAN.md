# BITS Pilani Dubai campus map: plan

**Status (2026-09-13):** Step C1 (a walkable test version rasterised from OpenStreetMap,
[ADR 0007](../decisions/0007-campus-map-from-osm-into-tiled.md)) shipped and drew feedback FB-0003 to
FB-0016: an angular map, diagonal fences/paths, a stray structure, uneven paths, no clear main
entrance, merged buildings, roads with no kerbs, and too little green. **The campus has been rebuilt
as a hand-designed, fully straight schematic plan** ([ADR 0008](../decisions/0008-campus-as-straight-schematic-plan.md),
supersedes 0007):
- a dead-straight entrance avenue up to **Gate 2** (the assumed main entrance, see "Entrances" in
  [research/bits-dubai-campus.md](research/bits-dubai-campus.md)), plus a second entrance (Side Gate)
- a straight D54 edge and a straight road from the campus to the DIAC ring
- constant-width roads with kerbs and lane markings, and a small set of constant-width internal walkways
- the Main Block, Library Block and Mechanical Block as separate footprints with walkable gaps, hostels the same
- lawns, hedges, flowerbeds, scattered shade trees and a date-palm avenue along the entrance road, a proper tennis court
- a new `overhead` tile layer so tree/palm canopies draw above the player

`tools/campus/layout.js` is now the plan itself (rectangles and straight lines with fixed widths,
positions rounded from OpenStreetMap/photo measurements); `tools/campus/diac.osm` stays only as the
measurement reference and is no longer parsed at build time. Research details and sources are in
[research/bits-dubai-campus.md](research/bits-dubai-campus.md).

## Goal

Recreate the real BITS Pilani Dubai campus top-down, as close to the real thing as possible: every
building, road, lawn and sports ground in its true place and proportions, the main campus interiors
with multiple floors, and the road to **DIAC Park** with the park's own walkways. The story (a new
student and the **LUG treasure hunt**) is added after the base map is done.

## Owner decisions (2026-09-13)

| Topic | Decision |
|---|---|
| Scale | **2 m per tile outdoors, 1 m per tile indoors** |
| Orientation | Straight with the entrance: the main gate is the "north" reference, so walking in means walking up. A compromise is fine if exact is hard |
| Surroundings | DIAC Park with its walkways, and the road to it. Other campuses and buildings stand along the roads but **can't be entered** |
| Floor plans | Decided later. Build the rooms **empty**; what goes where is filled in afterwards |
| Interiors first | Foyer, auditorium, library, canteen, a lab corridor. The LUG room comes later (LUG will say where and what). **Hostels: outside only** |
| Event and story | Explained once the base map is done |
| Main character | **Female lead: pink clothes, black hair, fair skin** (16×16) |
| Sharing | Private club project, and the owner has access, so using the BITS name is fine |
| Method | Any method is fine as long as it fits the 2D pixel style; assets mapped out properly and adjusted as needed |

## How the map is built

- `tools/campus/diac.osm`: OpenStreetMap extract of the campus and DIAC (ODbL, "© OpenStreetMap
  contributors"). Kept as the measurement reference the plan's numbers were taken from; no longer
  parsed at build time (ADR 0008).
- `tools/campus/layout.js`: **the plan itself.** Every building, road, path, gate, fence and green
  area is an axis-aligned rectangle or straight line with a fixed width, in a local tile frame (x =
  east, y = south, the campus fence's north-west corner is `0,0`). Positions and sizes come from
  `docs/research/bits-dubai-campus.md` measurements, rounded to the tile grid.
- `tools/campus/build-campus.js` (`npm run campus`) draws that plan and writes:
  - `assets/maps/campus.json`: a Tiled map with **ground**, **structures** and **overhead** tile
    layers, plus objects for the spawn, the two gates, doors, buildings and areas
  - `docs/research/campus-greybox.png`: a preview image (the `overhead` layer is drawn on top, so
    tree/palm canopies show over whatever's underneath, like in the game)
- The game loads Tiled maps directly. `overhead` gets a depth above every character and never
  collides (`src/scenes/world.js` `buildMap`); `gridFromTiled` (`src/maplogic.js`) skips it so
  walkability and the minimap read from ground/structures only. The campus is the start map; the
  meadow and house test maps open with `?map=meadow`.
- Tests (`tests/unit/campus.test.js`, `tests/unit/campus-layout.test.js`) check the committed map
  matches the generator, the spawn is walkable, Gate 2's approach is straight and reaches the Main
  Block, the fence is a closed loop broken only by the two gates, buildings are separate and
  walkable-between, walkways are constant-width, and the campus is mostly lawn with plenty of trees.

### Orientation, as built

- **Gate 2 is at the bottom (south).** You walk up into campus on a dead-straight entrance avenue,
  and the Main Block's entrance faces the viewer, matching ADR 0007's original convention.
- **Everything is axis-aligned** — no rotation, no diagonal walls/fences/paths. ADR 0007's OpenStreetMap
  rotation trick (two grids ~45° apart, straightening the academic complex as one group) is gone:
  the plan places every shape by hand instead, so there's nothing to straighten.
- The **Side Gate** (second entrance) is on the west fence, near the Library/hostel side. No source
  confirms a name for it (see "Entrances" in the research doc), so it isn't called "Gate 1".
- D54 runs along the north edge as a straight line for context; the road from Gate 2's approach to
  the DIAC ring is a separate straight segment (the two aren't directly connected in this schematic).

Known rough spots: positions are approximate (roughly ±15 m, per ADR 0008) and the DIAC ring's
"other campus" neighbours (University of Birmingham Dubai, student apartments) are placed for
scale and readability, not surveyed exactly.

## Build order

| Step | What | Status |
|---|---|---|
| C1 | Walkable test version of the outdoor campus + DIAC Park from OpenStreetMap | ✅ built, superseded by C1.5 |
| C1.5 | Rebuild the outdoor campus as a hand-designed straight schematic (Gate 2, separate buildings, kerbed roads, green) | ✅ built (ADR 0008) |
| C2 | Campus tileset and art: entrance, Main Block front, trees, palms, lawns | ✅ built, placed on the map in C1.5 |
| C3 | Main Block ground floor (1 m per tile): foyer atrium, with stairs to the 1st-floor mezzanine | Next |
| C4 | Auditorium, library, canteen, a lab corridor (empty rooms) | |
| C5 | Remaining main campus rooms and upper floors (empty), DIAC Park detail | |
| C6 | Story: LUG event, clues (after the owner explains it) | |

Foundation work from GAME_PLAN.md (ES modules, flags/scripts, saving) runs alongside when the
interiors need it.

## Campus look (from photos, approximate)

| Surface | Colour | Where |
|---|---|---|
| Wall | `#E6CBA4`, shade `#CFAE86` | All buildings: sand-beige render with panel lines |
| Trim | `#CF8A6C`, dark `#A8634B` | Window surrounds, cornices, entrance arch |
| Roof tile | `#B85C3E` | Hipped roofs on corner towers |
| Glass | `#2F3A44` | Main entrance, stair towers |
| Paving | `#A8614F` / `#8C4F42` | Red-brown brick pavers on paths and drop-off areas |
| Lawn | `#6FAE4A` | Central lawns, Triangular Park |
| Hedge | `#3E7A3A` | Borders around lawns and entrance |
| Palm | leaves `#5E8F3A`, trunk `#8A6A4A` | Entrance avenue, lawns |
| Running track | `#B5563E` | Around the football field |
| Desert sand | `#D9C29A` | Outside the fence |

## What goes where (first pass)

**Outdoors (C1, built as a test version):**
- Main gate and approach road, the D54 road edge
- Main Block, Library Block and Mechanical Block
- Hostels A–D and G–H (outside only)
- Athletics track and field, courts, student parking, central lawn
- Other campuses as buildings you can't enter
- DIAC ring road and DIAC Park walkways

**Main Block, ground floor** (from the tour's links): foyer atrium, reception, Career Services,
auditorium and its lobby, offices, sports complex (badminton, table tennis), mini mart, medical
centre, telepresence classroom, Intelligent Computing Lab, Incubation Centre.

**Main Block, upper floors** (floors decided later): Connecting Lobby (1st-floor mezzanine), classrooms,
labs, club rooms, counselling, offices.

**Library Block:** library on two floors, canteen, activity and club rooms.
**Mechanical Block:** workshops and labs.

## Rights and attribution

- **OpenStreetMap data** (ODbL): credited in the map's properties and in these docs.
- **The virtual tour, Google Maps and Wikimedia photos:** reference only. None of their images are in the game or the repo.
- **BITS name:** fine for this private club project (owner decision). Real people don't appear in the game.
