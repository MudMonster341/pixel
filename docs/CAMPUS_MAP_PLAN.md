# BITS Pilani Dubai campus map: plan

**Status (2026-09-17): C2, an OpenStreetMap-based campus, straightened and cleaned up**
([ADR 0009](../decisions/0009-campus-from-osm-straightened-and-cleaned.md), supersedes 0008). The
owner rejected C1.5's hand-drawn schematic (FB-0021: "nothing like the normal one... the previous
one followed the BITS map and was more intuitive") and chose to rebuild from real OpenStreetMap data
again, this time straightened and cleaned up rather than either left angular (C1) or replaced with an
invented plan (C1.5):
- **Real positions and shapes**: the campus is a long strip along the D54 (about 460 x 215 m,
  matching the real BITS Dubai plot far better than C1.5's near-square guess), with real building
  footprints (the Main Block's actual L-shaped wings included), a real hostel row (boys west of the
  academic complex, girls east, per the research doc), and the real DIAC Park/ring/roundabout.
- **Straight inside the fence.** The academic complex (Main Block, Library Block, Mechanical Block)
  is rotated as one group onto the grid, exactly as ADR 0007 first did. Every building outline is
  then cleaned into a rectilinear polygon (OpenStreetMap digitisation noise and small chamfers
  removed by clustering nearby coordinates, then squaring off anything still diagonal) -- wings and
  L-shapes are kept, but there are no 1-tile jaggies or staircase diagonals. The fence itself is
  reduced to its straightened bounding rectangle (a real chamfered notch near the entrance driveway
  isn't a fence feature; Gate 2 replaces it). A small hand-picked network of constant-width (3-tile)
  orthogonal walkways -- not raw OpenStreetMap footways, which is what made C1's paths a mess --
  connects Gate 2, the three academic blocks, both hostel rows, parking, the track and the courts.
- **Outside the fence**, roads keep their real curved/diagonal OpenStreetMap routes but are drawn
  with a constant width; the Gate 2 approach road is connected into that network so it never dead-ends.
- **Kept from C1.5**: the tile kit (kerbs, walkways, lawns, hedges, the fence kit, 2-tile walls with
  a parapet roof), the `overhead` canopy layer, Gate 2 at the bottom with a straight approach, and
  the Side Gate.
- **New for C2**: a `door` object (with a `to` map key for a future interior) on each of the Main,
  Library and Mechanical Block entrances; a `cutscene` trigger just inside Gate 2 for a parallel
  agent's cutscene engine; a small `signboard` tile in front of each BITS building; art fixes for the
  tree/palm trunk-canopy gap (FB-0019) and the tennis net (FB-0020, now a thin line with posts
  instead of a thick striped block), plus a green apron and hedge surround around the courts.

`tools/campus/layout.js` is settings, clean-up tolerances and a few hand-measured features (the
track, courts and parking, which OpenStreetMap doesn't have) again, not a drawn plan.
`tools/campus/diac.osm` is parsed at build time by `tools/campus/build-campus.js`. Research details
and sources are in [research/bits-dubai-campus.md](research/bits-dubai-campus.md).

Known rough spots: the fence's real chamfered entrance notch isn't drawn (Gate 2 stands in for it);
Gate 2 is centred on the Main Block for a straight gameplay approach rather than sitting exactly on
the real (unnamed, assumed) gate position, which is offset a little to one side in the raw data; a
few non-BITS building tags right at the fence's edge are dropped rather than drawn; hostel letters
are still unverified guesses (ADR 0007).

---

**Previous status (2026-09-13):** Step C1 (a walkable test version rasterised from OpenStreetMap,
[ADR 0007](../decisions/0007-campus-map-from-osm-into-tiled.md)) shipped and drew feedback FB-0003 to
FB-0016: an angular map, diagonal fences/paths, a stray structure, uneven paths, no clear main
entrance, merged buildings, roads with no kerbs, and too little green. The campus was rebuilt as a
hand-designed, fully straight schematic plan ([ADR 0008](../decisions/0008-campus-as-straight-schematic-plan.md)),
which the owner then rejected in favour of the OpenStreetMap-based rebuild above.

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

### Orientation, as built (C2, ADR 0009)

- **Gate 2 is at the bottom (south).** You walk up into campus on a dead-straight entrance avenue,
  and the Main Block's entrance faces the viewer, matching ADR 0007's original convention. It's
  centred on the Main Block for a straight gameplay approach, not on the real (unnamed, assumed)
  gate position, which sits a little off to one side of the building group in the raw data.
  Restored from ADR 0007: the academic complex (Main Block, Library Block, Mechanical Block) is
  rotated as one group onto the grid, since it runs off-grid from the rest of the real campus by
  about 44 degrees. Every outline is then cleaned into a rectilinear polygon (ADR 0009): OpenStreetMap
  digitisation noise and small chamfers are removed, but real wings/L-shapes stay -- the Main Block
  in particular has several setbacks that are real, not staircase artifacts.
- The **Side Gate** (second entrance) is on the west fence, near the boys' hostel row. No source
  confirms a name for it (see "Entrances" in the research doc), so it isn't called "Gate 1".
- D54, the road to Gate 2, the DIAC ring and the roundabout keep their real (curved/diagonal, outside
  the fence only) OpenStreetMap routes, drawn at a constant width; inside the fence, every path is
  the hand-picked orthogonal network from `build-campus.js`, not raw OpenStreetMap footways.

Known rough spots: hostel letters are still unverified guesses (ADR 0007); the DIAC ring's "other
campus" neighbours (University of Birmingham Dubai, student apartments) are squared up individually
but not surveyed exactly; a handful of tiny/stray OpenStreetMap building tags near the fence's edge
are dropped rather than drawn (FB-0003's rule, applied a little conservatively).

## Build order

| Step | What | Status |
|---|---|---|
| C1 | Walkable test version of the outdoor campus + DIAC Park from OpenStreetMap | ✅ built, superseded |
| C1.5 | Rebuild the outdoor campus as a hand-designed straight schematic; the campus tile kit (kerbs, walkways, lawns, hedges, fence, tennis court, 2-tile walls) | ✅ built (ADR 0008), layout rejected by the owner (FB-0021) |
| C2 | Rebuild again from OpenStreetMap, straightened and cleaned up: real positions/shapes, a rectilinear fence and buildings, a hand-picked walkway network, doors with a `to` key, a Gate 2 cutscene trigger, signboards, tree/palm and tennis-net art fixes | ✅ built (ADR 0009) |
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
