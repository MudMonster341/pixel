# Research notes: BITS Pilani Dubai campus

Collected 2026-09-13 for [CAMPUS_MAP_PLAN.md](../CAMPUS_MAP_PLAN.md). These are facts and
measurements only: no images from the sources below are stored in this repo.

## Sources

| Source | Link | Used for | Licence |
|---|---|---|---|
| Official virtual tour (3DVista) | https://www.bits-dubai.ac.ae/dubai-campus-virtual-tour/ | Room names, scene connections, interior look | © BITS. Reference only |
| OpenStreetMap | https://www.openstreetmap.org/way/224330161 | Outlines, sizes, roads, neighbours | ODbL, "© OpenStreetMap contributors" |
| Wikimedia Commons category | https://commons.wikimedia.org/wiki/Category:BITS_Pilani,_Dubai | Annotated campus map, exterior and interior photos | CC BY-SA 4.0 (Shamsheer22). Reference only |
| Google Maps (satellite) | https://maps.google.com/?q=BITS+Pilani+Dubai+Campus | Current layout check | © Google/Airbus/Maxar. Reference only |
| Wikipedia | https://en.wikipedia.org/wiki/Birla_Institute_of_Technology_and_Science,_Pilani_%E2%80%93_Dubai_Campus | Buildings, hostels (A–D boys, G–H girls), sports | CC BY-SA |
| Official student facilities page | https://www.bits-pilani.ac.in/dubai/student-facilities/ | Clinic on Main Block ground floor, sports list, gyms | © BITS |
| DIAC Campus Park (Cracknell) | https://www.cracknell.com/portfolio/diac-campus-park/ | Park is circular, next to University of Birmingham Dubai | © Cracknell |
| LUG, BITS Dubai | https://groups.google.com/g/lug-bpd · https://www.linkedin.com/company/bitslug | The club exists. No public treasure-hunt details found | n/a |

## Location and surroundings

- Campus centre at about **25.1314 N, 55.4201 E** (plus code 4CJC+H2 Dubai), inside **Dubai
  International Academic City** (DIAC).
- **North-west edge:** Sheikh Zayed bin Hamdan Al Nahyan Street (**D54**, Academic City Road).
- **East:** the DIAC ring road, with **University of Birmingham Dubai** and the circular **DIAC Park** inside it.
- **Other neighbours** (from OpenStreetMap): Manipal University Dubai (north-east), De Montfort
  University Dubai (south-west), student apartments, an ENOC fuel station.
- The campus is rotated about 35–40° from north (the D54 runs south-west to north-east).

## Entrances: Gate 2 and the second gate (2026-09-13, for ADR 0008)

The owner asked for the real **Gate 2** main entrance. Checked:
- Web search for `BITS Pilani Dubai "Gate 2"` and `"Gate 1" OR "Gate 2"` across the official site,
  admissions pages, 2GIS, Edarabia, Shiksha/Careers360 reviews, Facebook.
- The OpenStreetMap extract (`tools/campus/diac.osm`): several `barrier=gate` / `barrier=lift_gate`
  nodes exist (vehicle gates, mostly on the drop-off loop and parking), but none is named or numbered.

**Finding:** multiple independent sources (official site wording, a Shiksha/student review) confirm
BITS Pilani Dubai has **two gates with security**, matching the owner's expectation, but no source
found names either one "Gate 1" or "Gate 2", or gives its exact position.

**Assumption made (per the owner's fallback instruction):** Gate 2 is the main entrance off the DIAC
road on the campus's south/entrance side, next to the Main Block drop-off — i.e. where the C1 test
map already put its one gate (a gate booth way in the OpenStreetMap extract, `nearWay: 1090992244`
in the old `layout.js`). The rebuilt plan ([ADR 0008](../../decisions/0008-campus-as-straight-schematic-plan.md))
keeps the entrance in that same relative position: south fence, straight avenue up to the Main
Block. **This is an assumption, not a confirmed fact — flagged for the owner to correct if they
know otherwise.**

The second entrance (FB-0012) is placed on the **west fence**, near the Library/hostel side. Nothing
found supports calling it "Gate 1", so it's named **"Side Gate"** instead, per the owner's fallback
instruction.

## Measurements (OpenStreetMap bounding boxes, in metres)

| Feature | Size | OpenStreetMap way |
|---|---|---|
| Campus fence (BITS Pilani Dubai) | 412 × 343 | 224330161 |
| Main Building | 115 × 102 | 224330149 |
| Library | 51 × 48 | 224330155 |
| Mechanical Block | 55 × 38 | 224330151 |
| Block H (hostel) | 30 × 22 | 519044001 |
| Student apartments (typical) | 52 × 45 | 519043993 |

The sizes are bounding boxes of rotated shapes, so the real wall lengths are a little smaller.

## Buildings and floors (official sources)

- **Main (Academic) Block:** 4 floors. Lecture halls, departments, conference halls, lounges, mini
  mart, sports complex, auditorium (1,000–1,100 seats, movable partitions), labs, and the **clinic on
  the ground floor**. Server room on the 1st floor.
- **Mechanical Block:** 2 floors. Workshop on the ground floor, mechanical, civil and robotics labs above.
- **Library Block:** library on 2 floors (300+ seats, 70 study carrels), discussion rooms, cafeteria, activity room.
- **Hostels:** boys' blocks A, B, C, D; girls' blocks G, H. Each has mess, prayer hall, common room,
  recreation room, laundry and gym.
- **Sports:** full-size football field with a synthetic athletics track, turf cricket ground and nets,
  tennis, basketball, volleyball, throwball and handball, an indoor badminton and table tennis complex,
  chess and carrom.

## Virtual tour: scenes by building

From the tour's scene list and its links between scenes. "Floor?" means the tour doesn't say.

- **Outdoors:**
  - Main Gate, BITS Dubai Entrance, Parking, Transport Facility
  - Central path ("Connecting - Girls Hostel, Main Gate - Boys Hostel")
  - Athletics Track, Football, Cricket, Box Cricket, Tennis, Basketball, Volleyball, Throwball, Boxing
- **Main Block, ground floor:**
  - Foyer (double-height atrium with a mezzanine, glass terrarium, spiral chandelier), Foyer 2
  - Career Services (placement, waiting area, counselling rooms, meeting room, coordinator workspaces)
  - Audi/offices reception hub: Admissions, Academic Undergraduate Studies Division, Director's Office,
    Deputy Registrar, Student Welfare Division
  - Auditorium, with its outside lobby and the Parents-Visitor Lounge
  - Sports reception hub: Mini Mart, Badminton, Table Tennis, Telepresence Classroom, Prime Medical Centre (+ doctor's room)
  - Intelligent Computing Lab entrance, then the lab and the Incubation Centre
- **Main Block, upper floors:**
  - Connecting Lobby: overlooks the atrium from the mezzanine, so the **1st floor** (confirmed from the photo).
    Leads to the 50- and 60-seat classrooms and the locker area.
  - Linked from Foyer 2, floor unknown:
    - EEE labs: Analog & Digital, Communication Systems, Electrical Machines, Instrumentation, Power Electronics
    - CS labs: Computer Lab, Database Systems & Algorithms, Network & Distributed Systems, Signal Processing
    - CHEM labs: Chemical Engineering, Petroleum
    - BIOT labs: Advanced Molecular Biology, Biotechnology Research, Microbiology
    - GS labs: Chemistry, Physics
    - Civil labs: Soil Mechanics, Transport Engineering
    - Thermo-Fluids
    - Clubs: ACM, ACM-W, GDG, MTC, IEEE, IFOR, Supernova, Music, Shades Art, SWE, WIE, Chimera, Student Council
    - Offices and services: Counselling Centre, International Student Services, VC Office, Guest and
      other meeting rooms, Telepresence Conference Room
- **Library Block:**
  - Library entrance, Circulation Reception, Reading Area, Stack Area, Textbook Area
  - Library 1st Floor (open reading hall), Centre for Higher Education (1st floor)
  - Canteen (2 scenes), Activity Room, Groove (dance), Oh Crop! (design)
  - Surveying Lab (Civil), Reflexions (photography), located near the canteen and girls' hostel
- **Mechanical Block:** Workshop, Workshop 1, Workshop 2, CNC Room, Mechatronics, Composite
  Manufacturing, Prime Movers & Fluid Machinery, Structures & Construction Material, Heat Transfer
  (MECH), Advanced Characterization (MECH)
- **Boys' hostel:** outside, lobby/reception, room, room with attached washroom, dining hall, gym, laundry,
  recreational areas
- **Girls' hostel:** the same set of rooms
- **Not placed:** MAD Club, MAHASAT (+ room). There are also tour extras outside campus: Burj Khalifa,
  Dubai Frame, Museum of the Future, Kite Beach, Jumeirah, Silicon Central.

The tour's "BITS Map" hotspots (Grand Spine, B-Dome, SAC, VGH...) and its "Floor Plan" panel come
from a template for another campus. Don't use them for Dubai.

The full list of scenes and their links is in [bits-dubai-tour-scenes.json](bits-dubai-tour-scenes.json).

## Main gate appearance (for the cutscene)

Researched 2026-09-16 for the Gate 2 welcome cutscene (package P4). Checked: web search for
`BITS Pilani Dubai Campus main gate entrance photo`, `... entrance gate booth boom barrier
signage`, `... gate security guard entrance pillars photo review`; the Wikimedia Commons category
(`Category:BITS_Pilani,_Dubai`, file list only, no captions describing the gate itself); the
official picture gallery (`bits-pilani.ac.in/dubai/picture-gallery/`, interiors and events, no
entrance photos in the fetched text).

- No photo specifically of the vehicle/pedestrian gate structure (as opposed to the Main Block
  entrance) turned up in any of these sources — same gap already noted above under "Entrances".
- What *is* confirmed, and used for the illustration:
  - Two staffed gates exist (official wording + student reviews, see "Entrances" above).
  - The building palette across every confirmed photo/description is **sand-beige walls with
    salmon/terracotta trim** (panel lines, cornices), consistent with the Main Block's "glass front
    under a red arch" and the `bits*` tile kit already built in `tools/make-assets.js`.
  - Grounds use **red-brown brick pavers and black-and-white kerbs** (also already in the tile kit),
    lawns, and palms "especially along the entrance" (FB-0015 note).
  - DIAC gates generally (per the OSM extract, `tools/campus/diac.osm`) are vehicle gates with a
    boom barrier and a small guard booth, not an ornamental arch.
- **Conclusion: no reliable photo of the gate structure itself was found, so the cutscene gate is a
  tasteful, plausible design, not a reproduction of a real photo** (no image was copied or saved —
  everything below is drawn in code from these notes):
  - two sand-beige pillars/short wall sections with a terracotta/salmon cornice line, matching the
    `bitsWall`/`bitsRoofT` tiles' palette
  - a sign band across the top reading "BITS PILANI" / "DUBAI CAMPUS" in a small pixel font
  - a small guard booth beside one pillar and a red/white boom barrier across the road
  - date palms either side, a paved road leading in, kerb lines, bright blue sky
  - This matches the "assumption, not a confirmed fact" framing already used for Gate 2's location
    above, and should be corrected if the owner has a real photo.

## Look (from photos)

- Mediterranean / Arabian style: **sand-beige** walls with panel lines, **salmon/terracotta trim**
  around windows and along cornices, **hipped terracotta roofs** on corner towers, arched colonnades.
- Main entrance: glass front under a **red arch**, "BITS Pilani, Dubai Campus" lettering, steps, and
  a drop-off area with a small roundabout.
- Grounds: **red-brown brick pavers**, black-and-white kerbs, lawns with trees and palms, clipped hedges.
- Hostels: 4–5 storey beige blocks with recessed windows and grilles at ground level.
- Foyer interior: light floor, white curved balconies, large screens, backlit portrait panels.
- Library interior: white tiled floor, green-grey columns, wooden desks and shelving.

## Layout correction from the owner (2026-09-21, high priority)

The owner rejected the generated layout: *"take a step back and look at the map first... it doesn't
map back to the actual layout... as soon as you get in there's a roundabout and then parking on the
left and right, look at satellite images and then improve the map."*

They sent a Google Maps screenshot, rotated the way they want the game to read
([reference/owner-google-maps-orientation.jpg](reference/owner-google-maps-orientation.jpg), their
screenshot, reference only, never shipped in the game). What it shows:

- **Sheikh Zayed bin Hamdan (D54) runs straight along the TOP** of the picture, horizontal.
- The campus sits just below it as a wide block, with its own boundary road.
- **The entrance is on the lower-right side**, off the DIAC ring road, with a **small roundabout just
  inside the gate** and a **bus stop** on the approach road right outside.
- Internal roads form a **loop** around the academic buildings rather than one straight avenue.
- The **Cricket/Football field** is on the **left (west)** end of the campus.
- DIAC Park's big circle is to the lower right, outside the campus.

**What this means for the game map:** the entrance stops being a straight avenue up the middle. You
come in from the lower right, pass the roundabout, with **parking on both sides**, and the loop road
takes you round to the Main Block. Rebuild `tools/campus/layout.js` against satellite imagery in this
orientation, keeping everything axis-aligned in the game ([ADR 0009](../../decisions/0009-campus-from-osm-straightened-and-cleaned.md)).
