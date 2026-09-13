# BITS Pilani Dubai campus map: plan

**Status (2026-09-13):** the owner approved the plan. **Step C1 is built:** a walkable test version of
the outdoor campus generated from OpenStreetMap ([ADR 0007](../decisions/0007-campus-map-from-osm-into-tiled.md)).
**The owner's feedback on C1 (FB-0003 to FB-0016) changed the approach:** the campus is being rebuilt as a
hand-designed, fully straight plan ([ADR 0008](../decisions/0008-campus-as-straight-schematic-plan.md)):
- straight D54 road
- the real Gate 2 main entrance, plus a second entrance
- even-width roads with kerbs and pavements, clean internal walkways
- separate buildings you can walk between
- trees and bushes, a proper tennis court, better 3D art

Sections below describing the rasterised C1 are historical until the rebuild lands.
Research details and sources are in [research/bits-dubai-campus.md](research/bits-dubai-campus.md).

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

- `tools/campus/diac.osm`: OpenStreetMap extract of the campus and DIAC (ODbL, "© OpenStreetMap contributors").
- `tools/campus/layout.js`: all the settings. Scale, grid angle, which buildings are which, wall
  heights, hand-measured features OpenStreetMap lacks (track, courts, parking, lawn), the DIAC ring,
  and the spawn point.
- `tools/campus/build-campus.js` (`npm run campus`) writes:
  - `assets/maps/campus.json`: a Tiled map with ground and structures layers, plus objects for the spawn,
    doors, buildings and areas
  - `docs/research/campus-greybox.png`: a preview image
- The game loads Tiled maps directly. The campus is the start map; the meadow and house test maps
  open with `?map=meadow`.
- Tests check the committed map matches the generator, the spawn is walkable, the Main Block
  entrance is reachable, and all named buildings exist.

### Orientation, as built

Measured from OpenStreetMap, the campus has **two grids about 45° apart**. The Main Block, Library and
Mechanical Block run almost north–south. The fence, hostels, track, D54 road and neighbouring
campuses run 39° off north. No single rotation makes both straight, so:

- **The map follows the fence, road and hostel grid** (most of the campus).
- **The academic complex is rotated as one group** onto that grid, keeping its sizes and the
  positions of its three buildings relative to each other.
- **The main gate is at the bottom.** You walk up into campus, and building fronts with doors face
  the viewer (Pokémon-style). `flip: true` in `layout.js` turns the map around if the gate should be
  at the top.

Known rough spots in the test version: fence lines and paths near the academic complex still run
diagonally (they're drawn as steps), and the exact spots of the track, courts and parking are estimates
(±10 m).

## Build order

| Step | What | Status |
|---|---|---|
| C1 | Walkable test version of the outdoor campus + DIAC Park from OpenStreetMap | ✅ built, waiting for owner feedback |
| C2 | Campus tileset and art: entrance, Main Block front, trees, palms, lawns; tidy the diagonal fence and paths | Next |
| C3 | Main Block ground floor (1 m per tile): foyer atrium, with stairs to the 1st-floor mezzanine | |
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
