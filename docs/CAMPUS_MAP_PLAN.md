# BITS Pilani Dubai campus map: plan

**Status:** proposal (2026-09-13), waiting for the owner's decisions (see the end of this file).
Research details and sources are in [research/bits-dubai-campus.md](research/bits-dubai-campus.md).

## Goal

Recreate the real BITS Pilani Dubai campus top-down, as close to the real thing as possible:
- every building, road, lawn and sports ground in its true place and proportions
- building interiors with **multiple floors** and real staircase positions
- the surroundings in Dubai International Academic City (DIAC), such as the DIAC Park, as a
  limited open world

The story: a new student arrives on campus, finds the **LUG (Linux Users Group) treasure hunt**
event, and explores the campus solving its clues.

## What the research found

| Source | What it gives us | How reliable |
|---|---|---|
| **OpenStreetMap** | Exact outlines and sizes: campus fence, Main Building, Library, Mechanical Block, a hostel block, roads, footpaths, neighbouring universities | High for outlines and scale; interiors not mapped |
| **Wikimedia Commons campus map** (annotated satellite image, CC BY-SA 4.0) | Which building is which: hostel A&B, C, girls' hostel, canteen, track, parking, entrance, bank | High, but older imagery (about 2019) |
| **Google Maps satellite** (reference only) | Current layout: solar roofs, Triangular Park, hostel D, DIAC ring road, University of Birmingham, DIAC Park | High, current |
| **Official virtual tour** (3DVista, reference only) | **143 named Dubai scenes** and which scene links to which (walking routes through the buildings), plus what each room looks like | High for room names and look. **It has no floor plans.** Its overview map belongs to a different BITS campus |
| **Official facilities pages, Wikipedia** | Building list, floor counts (Main Block 4 floors, Library 2, Mechanical 2), auditorium of about 1,000 seats, 6 hostel blocks, sports list | Medium to high |
| **Campus photos** | Colours and materials: sand-beige walls, salmon trim, terracotta tiled tower roofs, glass entrance with a red arch, palms, red brick pavers | High |

**Gap:** no public floor plans exist, so exact staircase positions and which floor each lab or club
is on aren't known yet. See "What I need from you".

## Scale

Real sizes from OpenStreetMap: the campus fence is about **412 × 343 m**, the Main Building about
115 × 102 m, the Library 51 × 48 m and the Mechanical Block 55 × 38 m. The screen shows 20 × 11 tiles,
and the player walks 5 tiles per second.

| Metres per tile | Campus in tiles | Main Building in tiles | Walk across campus | Feel |
|---|---|---|---|---|
| 1 m | 412 × 343 | 115 × 102 | about 80 s | Very big, lots of empty space, a person looks tiny next to buildings |
| **1.5 m** | 275 × 229 | 77 × 68 | about 55 s | Big, still roomy |
| **2 m** | 206 × 172 | 58 × 51 | about 40 s | Big but not tiring, closest to Pokémon town proportions |

**Recommendation:**
- **Outdoors at 2 m per tile.** The whole layout keeps its true proportions.
- **Indoors at 1 m per tile.** Rooms need space for desks, shelves and people.

Like the test house, the inside of a building is bigger than its outline outdoors; that's normal
for this kind of game. I'll build a quick **greybox** (walkable, no art) at 2 m and at 1.5 m first
so you can walk both and choose before any art is made. Characters stay 16×16.

## Orientation

The real campus sits at an angle of roughly 35–40° to north: the D54 road runs south-west to
north-east. Pixel-art buildings need walls that line up with the tile grid, so **the whole map is
rotated to line up with the campus's main walls**. The generator measures the exact angle from
the Main Building's outline. The minimap can show a compass pointing to real north.

## World structure

```
                      ┌──────────────────────────────┐
  D54 road (edge) ─── │  CAMPUS (outdoors, 1 big map) │ ─── DIAC ring road ─── DIAC PARK + ring
                      │  gate · lawns · sports ·      │     (2nd map, limited: other campuses are
                      │  hostels · parking · paths    │      facades you can't enter)
                      └──────┬──────────┬─────────┬───┘
                             │ doors    │         │
          ┌──────────────────┘          │         └──────────────┐
   MAIN BLOCK                       LIBRARY BLOCK            MECHANICAL BLOCK     HOSTELS
   ground ↔ 1st ↔ 2nd ↔ 3rd         ground ↔ 1st             ground ↔ 1st         lobbies (+ a room)
   (stairs = doors between floors)
```

- **Each floor is its own map.** Stairs and lifts are doors that link to the same spot on the floor
  above or below.
- **Limits:**
  - the campus fence and gates
  - the D54 road, as a hard edge
  - the DIAC ring road ("the event is on campus", so you can't wander further)
  - buildings on other campuses are outside walls only

## How the map gets built

1. **OpenStreetMap → greybox generator** (`tools/osm-to-tiled.js`). It rotates and scales the real
   outlines of buildings, fence, roads and footpaths onto the tile grid, and saves a map for
   Tiled with a "guide" layer. This keeps the true layout without hand-measuring anything.
2. **Paint in Tiled** (free map editor):
   - tile layers for ground, details, walls, *overhead* (roof edges and treetops drawn above the
     player) and collision
   - object layers for entities (doors, stairs, NPCs, clue spots, triggers) and zones (area names
     for the minimap and "Now entering the Library" messages)
3. **The game loads Tiled maps** (Phaser supports them natively). This replaces text maps and
   needs a new ADR. The meadow and house move to the same format so there's one way to make maps.
4. **Tests are extended to Tiled maps:**
   - every door and stair has a matching partner
   - every room is reachable, including across floors
   - no spawn point is inside a wall
   - every entity has a valid type
5. **A campus tileset** in the style guide, using colours taken from the real photos (see below).
6. **Interiors from evidence:**
   - tour photos give the look and which rooms are next to each other
   - floor plans come from you (see the questions below)
   - anything still unknown is designed to be believable, marked `unverified` in the map data, and
     corrected later through the feedback overlay

## Campus look (from photos, approximate)

| Surface | Colour | Where |
|---|---|---|
| Wall | `#E6CBA4`, shade `#CFAE86` | All buildings: sand-beige render with panel lines |
| Trim | `#CF8A6C`, dark `#A8634B` | Window surrounds, cornices, entrance arch |
| Roof tile | `#B85C3E` | Hipped roofs on corner towers |
| Glass | `#2F3A44` | Main entrance, stair towers |
| Paving | `#A8614F` / `#8C4F42` | Red-brown brick pavers on paths and drop-off areas |
| Kerbs | white/black stripes | Road edges |
| Lawn | `#6FAE4A` | Central lawns, Triangular Park |
| Hedge | `#3E7A3A` | Borders around lawns and entrance |
| Palm | leaves `#5E8F3A`, trunk `#8A6A4A` | Entrance avenue, lawns |
| Running track | `#B5563E` | Around the football field |
| Desert sand | `#D9C29A` | Outside the fence |
| Foyer floor | `#E8DDCF` + blue accent lights | Main Block atrium |

These are brightened slightly to match the style guide.

## What goes where (first pass)

**Outdoors:**
- Main Gate and roundabout entrance, visitor and student parking, bus stop, transport pick-up
- Triangular Park and the central lawns
- Main Block front with its towers
- Library Block and canteen, Mechanical Block
- Boys' hostels A–D and girls' hostels G–H
- Athletics track and football, cricket, tennis, basketball, volleyball, throwball, box cricket
- The perimeter fence and the D54 road edge

**Main Block, ground floor** (known from tour links):
- Foyer atrium and the BITS Dubai entrance
- Reception, Career Services
- Auditorium (about 1,000 seats) and its lobby, parents' lounge
- Offices: Director, Admissions, AUGSD, Student Welfare, Deputy Registrar
- Sports complex (badminton, table tennis), mini mart, medical centre
- Telepresence classroom, Intelligent Computing Lab, Incubation Centre

**Main Block, upper floors** (which floor is still unknown):
- Connecting Lobby, which overlooks the atrium, with the 50- and 60-seat classrooms and lockers
- EEE, CS, CHEM, BIOT, Physics, Chemistry and Civil labs
- Club rooms: ACM, IEEE, GDG, MTC, Supernova, Music, Shades, SWE, WIE, IFOR, Student Council
- Counselling Centre, International Student Services, VC office, meeting rooms

**Library Block:**
- Ground floor: circulation desk, reading area, stacks, textbook area
- 1st floor: reading hall, Centre for Higher Education
- Canteen, activity room, dance and design club rooms

**Mechanical Block:** Workshops 1 and 2, CNC room, mechatronics, composites, thermo-fluids,
prime movers and structures labs.

**Hostels:** lobby, rooms (with and without attached washroom), dining hall, gym, laundry,
recreation room.

## Build order

This needs **Phase 1 (foundation) from GAME_PLAN.md** first, plus Tiled map loading and the overhead
layer. Each step ends playable, tested, and open for your feedback in the overlay.

| Step | What | You check |
|---|---|---|
| C1 | Greybox outdoors from OpenStreetMap at 2 m and 1.5 m (walkable, plain colours) | Scale and layout feel right |
| C2 | Campus tileset + art for the entrance, Main Block front, Triangular Park | The look matches the real campus |
| C3 | Main Block ground floor with the foyer atrium, plus stairs to the 1st-floor mezzanine | Interior scale, stairs |
| C4 | Library + canteen, Mechanical Block | |
| C5 | Hostels, detail on the sports grounds, DIAC Park area | |
| C6 | Main Block upper floors | Floor accuracy |
| C7 | Story: arrival, the LUG event stall, the clue chain (from your story template) | The treasure hunt |

## What I need from you

1. **Scale:** is 2 m outdoors and 1 m indoors OK, or do you want to walk both greyboxes first?
   (Recommended: walk both.)
2. **Floor plans:** the biggest missing piece. Every building has **fire evacuation plans** posted
   near the stairs on each floor. Photos of those (with permission) would give exact stairs, lifts
   and room positions. Otherwise, a rough sketch or a list of which lab, club and classroom is on
   which floor.
3. **Which interiors matter for the story:** 143 rooms is a lot. My suggestion for the first
   version is the foyer, auditorium, library, canteen, one lab corridor, the LUG room and one hostel.
   Other doors stay locked ("Closed for the event").
4. **How far outside campus:** DIAC Park and the ring road? Can the player enter other campuses,
   or are they just walls?
5. **The event:** where LUG sets up, where the hunt starts and ends, and roughly where the clues are.
6. **The main character:** hair, clothes, colours (still 16×16).
7. **Sharing:** will this be public? If so, check with LUG and BITS about using their names. Until
   then the game uses no real logos, no real people's faces or names, and generic signs.

## Rights and attribution

- **OpenStreetMap data** is ODbL. The game credits "© OpenStreetMap contributors", and the derived map
  data stays shareable under the same licence.
- **Wikimedia photos** (CC BY-SA 4.0), **Google Maps** and the **official virtual tour** are used
  **as reference only**. None of their images are copied into the game or the repo.
- **BITS and LUG names and logos** are trademarks of their owners. No logos in the game unless permission is given.
- **People** in the tour photos are real students and staff. No real people appear in the game.
