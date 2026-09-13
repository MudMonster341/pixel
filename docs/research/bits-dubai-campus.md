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

## Look (from photos)

- Mediterranean / Arabian style: **sand-beige** walls with panel lines, **salmon/terracotta trim**
  around windows and along cornices, **hipped terracotta roofs** on corner towers, arched colonnades.
- Main entrance: glass front under a **red arch**, "BITS Pilani, Dubai Campus" lettering, steps, and
  a drop-off area with a small roundabout.
- Grounds: **red-brown brick pavers**, black-and-white kerbs, lawns with trees and palms, clipped hedges.
- Hostels: 4–5 storey beige blocks with recessed windows and grilles at ground level.
- Foyer interior: light floor, white curved balconies, large screens, backlit portrait panels.
- Library interior: white tiled floor, green-grey columns, wooden desks and shelving.
