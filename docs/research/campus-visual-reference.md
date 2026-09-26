# Campus visual reference (2026-09-26, premium pass Part A)

**Purpose:** give a pixel artist a literal, buildable spec for the Main Block entrance, foyer, and
every other named space, grounded in real photos of BITS Pilani, Dubai Campus rather than
guesswork. Collected per the owner's brief in
[docs/plans/2026-09-26-premium-pass.md](../plans/2026-09-26-premium-pass.md) ("Do a bit of search...
take and model everything based on that").

**Method:** web search + direct download (`curl.exe -L`, images only) from Wikimedia Commons (CC
BY-SA 4.0, uploader Shamsheer22, already logged as a source in
[bits-dubai-campus.md](bits-dubai-campus.md)), the official BITS Pilani picture gallery
(`bits-pilani.ac.in/wp-content/uploads/`), and the owner's own two reference photos. Every image
kept below was opened and looked at (Read tool), not just listed from a search result. The virtual
tour (`bits-dubai.ac.ae/dubai-campus-virtual-tour/`) was re-checked for a scriptable image URL: its
HTML only preloads **one** panorama's cube-face tiles for the tour's default opening scene
(`media/panorama_75420915_.../{r,l,u,d,f,b}/3/0_0.jpg`) and its `script.js` is pure 3DVista player
code with no embedded scene data or asset URLs -- confirming the earlier research's "reference
only, no images" finding. No image was taken from Instagram/Facebook (nothing usable turned up that
was viewable without login).

**32 images kept**, all in [reference/campus/](reference/campus/):
- `wiki-*` -- Wikimedia Commons, [Category:BITS Pilani, Dubai](https://commons.wikimedia.org/wiki/Category:BITS_Pilani,_Dubai), CC BY-SA 4.0, reference only (not redistributed further, matching how `bits-dubai-campus.md` already treats this category).
- `gallery-*` -- the official [Picture Gallery](https://www.bits-pilani.ac.in/dubai/picture-gallery/), © BITS, reference only.
- `owner-main-block-entrance.png` / `owner-main-block-foyer.png` -- the owner's own two reference photos (already in the repo before this task).

All colour values below are **estimated by eye from the photos** (no exact pixel-sampling tool for
JPEG exists in this repo's `tools/lib/` -- only a PNG decoder), cross-checked against the game's own
existing `PALETTE` ramps in `tools/make-assets.js` and `docs/STYLE_GUIDE.md` so a builder can slot
them in as new ramp stops rather than one-off colours. Tile counts below use the project's own scale
rule: **2 m/tile outdoors, 1 m/tile indoors** (docs/CAMPUS_MAP_PLAN.md, docs/INTERIORS_PLAN.md).
Where a room already exists at a fixed size (`tools/interiors/plans.js`), the spec below targets
*that* rectangle rather than inventing a new size, so it's directly buildable without growing the
building further.

---

## 1. Main Block exterior and entrance plaza

**Sources:**
- [owner-main-block-entrance.png](reference/owner-main-block-entrance.png) -- the owner's own photo, primary reference.
- [wiki-BITS_Dubai_Main_Building.jpg](reference/campus/wiki-BITS_Dubai_Main_Building.jpg) -- a second, closer angle of the same entrance (evening light, a dark sedan parked at the kerb).
- [wiki-BITS_Dubai_campus_main.jpg](reference/campus/wiki-BITS_Dubai_campus_main.jpg) -- a wide panorama of the *whole* Main Block facade, corner towers with red-tile pyramidal caps either end, a low gate/boundary structure visible at the far left edge.
- [wiki-BITS_Dubai_5.jpg](reference/campus/wiki-BITS_Dubai_5.jpg) ("Triangular part...") -- a close-up of a corner pillar/tower, showing the wall's panel-line construction and roof junction in detail.
- [wiki-BITS_dubai_campus_map.jpg](reference/campus/wiki-BITS_dubai_campus_map.jpg) -- satellite map with labels (Hostel A&B, Hostel C, Girls Hostel, Canteen, Students Parking, Bank of Baroda), confirms the ADR-0009/campus-v3 layout (roundabout + parking flanking the entrance road) is correct.

**Design spec:**
- **Facade colour:** sand/peach body `#E3C09B` (highlight `#EAD0B4`, shadow `#C9A87E`), NOT the
  game's current plain `bitsWallPlain` sand -- the real wall has vertical **panel-line** divisions
  (thin recessed joints every 2-3 tiles, `#B99A6E`) and horizontal banding at each floor line, both
  visible in `wiki-BITS_Dubai_5.jpg`.
- **Trim colour:** salmon/terracotta `#B5583C` (a warmer, more saturated red-brown than the game's
  current `archRed` `#9C3A28`) on cornice bands between floors, around the corner towers' vertical
  stripes, and the parapet edge. This matches the `roof (red)` ramp already in `STYLE_GUIDE.md`
  (`#D9774F`/`#B5543A`/`#8A3B2A`) closely -- reuse that ramp for the trim rather than inventing a new
  one.
- **Roof:** hipped terracotta tile `#A1502F`, only on the corner towers (small pyramidal caps), not
  a flat roof over the whole building -- the main facade between towers is a flat parapet.
  `owner-main-block-entrance.png` shows this clearly: two towers with peaked terracotta roofs
  flanking a flatter central block.
- **Entrance canopy/arch:** a **glass-fronted single-storey canopy** projecting forward from the
  main facade, centred between the two flanking towers, with the "BITS Pilani, Dubai Campus"
  lettering (`#1A3A6B` navy blue, serif-ish, on the beam above the glass doors) mounted directly on
  its fascia -- not a big red arch as the current cutscene art (`buildEntrance()`) assumes; the red
  arch idea in `STYLE_GUIDE.md`'s "Main Block specifically gets a real red arch" section should be
  corrected to **a projecting glass canopy with a navy-lettered sign band**, confirmed now by both
  the owner's photo and two independent Wikimedia angles.
- **Steps:** 5-6 shallow steps the full width of the canopy, light stone `#D8CBAE` tread /
  `#A89478` riser, with a **black tubular handrail** down the middle (visible in both
  `owner-main-block-entrance.png` and `wiki-BITS_Dubai_Main_Building.jpg`) -- add a handrail prop,
  the current kit has none.
- **Columns:** the entrance itself doesn't use freestanding columns (it's a flat glass front), but
  the corner towers read as thick square piers with a vertical two-tone stripe (cream centre panel,
  terracotta trim either side) -- see `wiki-BITS_Dubai_5.jpg`.
- **Flags:** 4+ flagpoles in a row along the plaza edge (owner's photo shows red/gold/purple pennant
  flags on tall white poles, roughly one every 3-4 tiles) -- not a single flagpole with the UAE flag;
  a *row* of small coloured pennants is the real look for event days, but for the everyday game scene
  a smaller row of 2-3 flags (still red/gold, matching the game's existing accent-gold ramp) reads
  as "this is the important building" without needing event bunting.
- **Palms:** tall **date palms** (`palmTrunk`/`palmCanopy*`, already in the kit) directly flanking
  the entrance steps, 2-3 per side, taller than the canopy roofline -- exactly what both photos show,
  confirming FB-0015's "especially along the entrance" note and that palms (not round trees) belong
  right at the door, with round shade trees further back in the plaza.
- **Planters/hedges:** a low clipped hedge run (`hedge`, dry-green ramp) along the base of the
  facade either side of the entrance, with individual planter boxes at the base of each palm.
- **Sign board:** a **freestanding sign board** near the drop-off (owner's photo shows a portable
  event sign in front of the hedge -- for the everyday scene this becomes the existing `signboard`
  tile, reading "BITS Pilani, Dubai Campus" in the navy/gold lettering).
- **Ground:** the plaza in front is **interlocking red-brown pavers** (`#B06B4A` base, `#8C5236`
  joints, a herringbone pattern visible in `wiki-BITS_Dubai_Campus_2.jpg` and
  `wiki-BITS_Pilani_Dubai_Campus.jpg`) with a **black-and-white striped kerb** at the drive edge --
  matches the game's existing `walkway`/`kerb*` tiles' intent exactly, just confirms the red-brown
  tone (current game paver is closer to salmon-pink than red-brown; nudge `remapPaver`'s target hue
  warmer/browner if there's room in this pass).
- **What the player sees first:** walking up the entrance avenue, the canopy's glass front and navy
  lettering dead ahead, flanked by two tall palms either side of the steps, corner towers with
  terracotta pyramidal roofs visible above and behind the canopy on both sides, red/gold flags off to
  one side of the plaza. The one-tile door + flat window-strip look (`qa-shots/outdoor-main-block-
  front.png`) is replaced by this canopy-plus-towers silhouette, built at the building's existing
  `FRONT_WALL_TILES` depth (4 tiles) using new dedicated canopy/tower tiles rather than the plain
  `bitsEntranceGrandL/R` arch tiles.

## 2. Main reception foyer

**Sources:** [owner-main-block-foyer.png](reference/owner-main-block-foyer.png) (the only foyer
photo found; the virtual tour lists "Foyer" and "Foyer 2" scenes by name but their images weren't
retrievable, see Method above).

**Design spec** (target rectangle: the existing `foyer` + `foyer2` rooms in
`tools/interiors/plans.js`, combined footprint **x:42-71, y:46-79** -- 29 tiles wide, 33 tiles deep,
1 m/tile; the 1st floor's `atriumVoid(48,58,65,73)` -- 17x15 tiles, offset toward the left/back of
that rectangle -- already marks where the mezzanine hole should sit, so the staircase below it
should rise roughly under/behind that void, not centred in the room):

- **Floor:** glossy cream/beige marble `#E8DDBF` (highlight `#F2E9D2`, shadow `#C9BB94`) with visible
  reflections of the columns and ceiling lights -- brighter and glossier than the game's current
  `intFloorFoyer` "light, flecked" tile. A **darker inlay band** (`#B8A473`) runs down the centre of
  the floor from the entrance toward the staircase, visible as a distinct stripe in the photo -- add
  this as a 1-2-tile-wide "runner" strip of a second foyer-floor variant down the main sightline.
- **Columns:** thick square white/cream columns (`#EFE9DA`, a cooler, whiter tone than the walls)
  spaced roughly every 4-5 tiles along both sides of the hall, floor to mezzanine height -- the photo
  shows at least 4 on each side. These should be *tall/overhead* objects (walk-behind, per the depth
  engine work in the same premium pass) since the real hall is double-height.
  small chandelier medallion recess above.
- **The staircase:** a **single central staircase that splits into two mirrored flights**, both
  curving outward from a shared landing partway up, each with a **black wrought-iron scroll
  railing** (`#2A2A32`, a cool near-black, not the game's warm outline colour) on a light stone
  stringer -- not the game's existing straight `intStairsUp` tile. This is the single biggest gap
  between the current foyer (`qa-shots/indoor-main-block-g-foyer.png`, a flat empty room) and the
  real one; STYLE_GUIDE already flags a "decorative grand staircase" was added, this spec confirms
  its shape should be the **twin-flight curve**, not a straight run.
- **Mezzanine:** a full-width balcony at the top of the stairs, fronted by the **same black
  wrought-iron railing**, with potted plants set at intervals along its edge and doors visible behind
  it in shadow. The "BITS Pilani, Dubai Campus" wordmark (navy `#1A3A6B`, the same blue as the
  exterior sign) is mounted on the mezzanine's front fascia, directly above the point where the two
  stair flights meet -- this is the room's single dominant feature, dead centre, and should be what
  the player sees first on entering.
- **Chandelier:** a tiered crystal/spiral chandelier hangs from the double-height ceiling void,
  roughly above the staircase's lower landing -- render as a bright, warm-white overhead sprite (a
  new decorative object, not derived from any existing tile) with a soft glow/highlight rather than a
  flat colour, per the "gentle life" style rule.
- **Reception desk and seating:** out of frame in this specific photo (camera faces the stairs), but
  per the tour's own scene list ("Foyer", "Foyer 2") and the already-built `intReceptionDesk`/
  `intSofa` pieces, these belong along the side walls, not blocking the central sightline to the
  stairs.
- **Plants:** dark planter pots with palms/ferns flank the base of the staircase (visible either side
  of the lower steps in the photo) and repeat along the mezzanine edge.
- **Lighting:** warm, even downlighting from recessed ceiling fixtures plus the chandelier's own
  glow; no strong directional shadows indoors (unlike the outdoor "light from top-left" rule) --
  keep indoor floor tiles brighter/flatter than outdoor ground.
- **What the player sees first:** entering from the south door (per the existing `Main Block Ground
  Floor entrance`), the full-width staircase and mezzanine dead ahead, the navy wordmark above it,
  the chandelier overhead, columns marching away on both sides toward the mezzanine -- replacing
  today's "empty cream floor with a counter" (`qa-shots/indoor-main-block-g-foyer.png`).

## 3. Corridors

**Sources:** no dedicated corridor photo was found (the tour's corridor-adjacent scenes -- Connecting
Lobby, Foyer 2 -- weren't retrievable as images); inferred from the foyer/library/lab photos' shared
wall and floor treatment, and the Mechanical Block passage photo below.
- [wiki-BITS_Dubai_Mechanical_Block_and_Labs.jpg](reference/campus/wiki-BITS_Dubai_Mechanical_Block_and_Labs.jpg) -- an external passage between two wings, useful for the corbelled-cornice-under-roof detail repeated indoors above doorways.

**Design spec:** plain sand-cream walls (same body tone as the exterior, `#E3C09B`, no panel lines
indoors), a plainer **grey-flecked** floor (matches the game's current `intFloorCarpet`/office floor,
not the foyer's glossy marble -- corridors are utilitarian, not showpiece), doors recessed in dark
wood (`#5A3418`, the game's existing Wood-shadow tone) with a small nameplate beside each one,
fluorescent panel lighting overhead (flat white light, no warm pooling like the foyer). Nothing here
contradicts the current corridor art; this confirms it's already a reasonable, low-priority match.

## 4. Classroom

**Sources:**
- [gallery-Classroom.jpg](reference/campus/gallery-Classroom.jpg) -- official gallery photo: rows of paired student desks with fold-down laptop trays, a teacher at a whiteboard beside a projector screen, a wall clock, two support columns.
- [wiki-BITS_Dubai_Classroom.jpg](reference/campus/wiki-BITS_Dubai_Classroom.jpg) -- a tiered lecture-hall-style room instead (fixed desks with microphones, two wall-mounted screens) -- likely a bigger lecture theatre rather than a standard classroom, useful for the Auditorium/big-classroom look instead.

**Design spec:** off-white walls with a **cream dado band** at chair-rail height (a two-tone wall
split visible in `gallery-Classroom.jpg`, not a single flat colour), light terrazzo/tile floor
(pale grey-cream fleck, close to the game's `intFloorClassroom` but cooler/greyer than its current
warm wood-plank look -- consider a cooler variant), desks in **pairs facing the front**, each with a
small built-in device tray, a full-width whiteboard plus a **pull-down projector screen** beside it
(the game has `intWhiteboardWall` but no screen prop -- worth adding), a wall clock, and support
columns breaking up the room every 6-8 tiles for a large classroom. Confirms the existing
`intDesk`+`intWhiteboardWall` approach; the addition worth making is the projector screen and the
two-tone wall.

## 5. Computer lab / Intelligent Computing Lab (ICL)

**Sources:**
- [wiki-BITS_Dubai_Creative_Lab.jpg](reference/campus/wiki-BITS_Dubai_Creative_Lab.jpg) -- blue-cabinet workbenches, monitors, motivational/innovation posters on the wall, a swirl-edged suspended ceiling feature.
- [gallery-Labs-3.jpg](reference/campus/gallery-Labs-3.jpg) -- the same room/style in use (students at a round blue worktable building a drone), same wall posters, same blue cabinetry.

**Design spec:** the ICL/Incubation Centre has a distinct identity from an ordinary computer lab:
**royal-blue cabinetry** (`#2F4A7A` body, `#3A5A8F` highlight -- a cooler, more saturated blue than
the game's existing locker-blue) on built-in benches along the walls, monitors and loose electronics
sitting directly on the worktop (not sunk into a desk), and **large wall posters** (innovation/
creativity themed collages -- render as a generic "noticeboard wall" of mixed colour rectangles
rather than legible text) covering most of the wall above the bench line. Floor is plain pale
vinyl/terrazzo, cooler grey than the classroom's. This matches and extends the existing
`intComputerBench`/`intLabBench` pieces -- the distinguishing feature to add is the blue cabinetry
colour and poster-covered wall, to make the ICL feel different from a generic classroom-turned-lab
(currently `qa-shots/indoor-main-block-1-icvl.png` uses plain grey benches with no wall dressing).

## 6. Physics / science lab

**Sources:** no photo specifically labelled "Physics Lab" was found (same "floor unknown" gap noted
in `docs/INTERIORS_PLAN.md`'s "Story rooms" section -- Physics is a placed guess, not sourced).
Closest available references, both general engineering/science benches:
- [gallery-labs.png](reference/campus/gallery-labs.png) -- an EEE-style bench row, students in white lab coats at wooden-topped benches with oscilloscopes/instruments, pastel wall posters.
- [gallery-Labs-2.jpg](reference/campus/gallery-Labs-2.jpg) -- an injection-moulding machine (Mechanical Block, not Physics) -- useful only for general "lab equipment reads as blocky, brightly-coloured machinery" texture, not for room dressing.

**Design spec:** wooden-topped benches (`#CF9A66`, the game's existing Wood ramp) in rows with
stools, small benchtop instruments (oscilloscope-like boxes, cabling) scattered per bench rather than
identical repeats, pale two-tone walls, and white lab coats worth noting if any NPC ever appears here
(out of scope for this art pass). This is broadly what `intLabBench`/`intLabTank`/`intLabRack`
already deliver; no strong change indicated beyond confirming the wood-tone bench colour over a
metal one.

## 7. Library

**Sources:**
- [wiki-BITS_Dubai_Library_1st_floor.jpg](reference/campus/wiki-BITS_Dubai_Library_1st_floor.jpg), [wiki-BITS_Dubai_Library_2nd_floor.jpg](reference/campus/wiki-BITS_Dubai_Library_2nd_floor.jpg), [wiki-BITS_Dubai_Library_ground_floor.jpg](reference/campus/wiki-BITS_Dubai_Library_ground_floor.jpg) -- three stack/reading-area angles.
- [gallery-Library1.jpg](reference/campus/gallery-Library1.jpg) -- students at reading tables among stacks.
- [wiki-BITS_Dubai_Library_block_i8.jpg](reference/campus/wiki-BITS_Dubai_Library_block_i8.jpg) -- the Library Block's own exterior (same sand/terracotta family as Main Block, confirming one shared building palette campus-wide).

**Design spec:** confirms `docs/research/bits-dubai-campus.md`'s existing "white tiled floor,
green-grey columns" note exactly -- `wiki-BITS_Dubai_Library_2nd_floor.jpg` shows the column base
painted a distinct **pale mint/sage green** (`#B8C9B0`) up to about waist height, a colour that
appears nowhere else on campus and is worth its own palette key if the library gets more detail.
Light wood-veneer shelving (`#DCC59A`, lighter/more honey than the game's Wood ramp) in long
back-to-back rows, light grey terrazzo floor, pale grey plastic stacking chairs, and wood-veneer
reading tables. The existing `intFloorLibrary` ("green-grey weave") already gestures at the column
colour finding; `bookshelf`'s current colour could shift lighter/honey to match.

## 8. Auditorium

**Sources:** [gallery-Auditorium.jpg](reference/campus/gallery-Auditorium.jpg) -- rows of
mic-equipped tiered desks (not simple flip-seats), two wall-mounted display screens, a large fixed
front desk/dais.

**Design spec:** this photo reads more like a **large tiered lecture/conference hall** than a
1,000-seat auditorium (docs/research/bits-dubai-campus.md's official capacity figure) -- likely a
secondary hall, not the main Audi. Still useful for the auditorium's general materials: warm wood-
tone desks in curved tiered rows, dark upholstered fold-seats, wall-mounted flat screens either side
of a central stage/clock wall, dark blue-grey carpet. This matches the existing `intAuditoriumSeat`
(red seating, per Pixel Seating pack) reasonably -- the one clear addition is the **paired wall
screens either side of the stage wall**, not currently in the kit.

## 9. Canteen / food court

**Sources:**
- [wiki-BITS_Dubai_Cafeteria.jpg](reference/campus/wiki-BITS_Dubai_Cafeteria.jpg), [wiki-BITS_Dubai_Cafeteria_2.jpg](reference/campus/wiki-BITS_Dubai_Cafeteria_2.jpg) -- same room, two angles: a mural wall, a red service counter, a drinks fridge, a menu board.

**Design spec:** bright **yellow accent walls** (`#E8C14A`) with a large black-and-white pop-art-
style mural (render as a generic abstract wall graphic, not legible art), a **red service counter**
(`#C23B2E`) with a wall-mounted menu board above it, round white cafe tables on a single central
pedestal leg, mismatched **blue/white/grey plastic stacking chairs** (blue `#4A7FC4`, not a uniform
colour per chair), a yellow support column, and plain pale terrazzo floor. This is a clear step up
from the game's current plain `intFloorClassroom`-and-`table` canteen -- worth a distinct
`intCanteenCounter` recolour (red, not the current generic tone) and a yellow accent-wall variant.

## 10. Outdoor walkways, plazas, and landscaping (palms, hedges, lawns)

**Sources:**
- [wiki-BITS_Dubai_Campus.jpg](reference/campus/wiki-BITS_Dubai_Campus.jpg) -- a hostel-block courtyard: red park benches, diamond stepping-paver path through mulch/hedge beds, a service door.
- [wiki-BITS_Dubai_Campus_2.jpg](reference/campus/wiki-BITS_Dubai_Campus_2.jpg) -- a tree-lined internal road, full herringbone brick paving, black/white kerb, parked sedans under tree shade.
- [wiki-BITS_Dubai_3.jpg](reference/campus/wiki-BITS_Dubai_3.jpg) -- a flowerbed/lawn/hedge composition right at a building's edge, event flags visible beyond the hedge.
- [wiki-BITS_Pilani_Dubai_Campus.jpg](reference/campus/wiki-BITS_Pilani_Dubai_Campus.jpg) -- a long straight paved avenue, trees both sides, sports field visible at the far end.
- [wiki-BITS_Dubai_Campus_view.jpg](reference/campus/wiki-BITS_Dubai_Campus_view.jpg) -- a stepping-stone path through a lawn with bougainvillea hedges (pink-flowered), banner flags, and an "INNOVATION" building sign in the background.
- [wiki-Triangular_part_at_BITS_Pilani_Dubai.jpg](reference/campus/wiki-Triangular_part_at_BITS_Pilani_Dubai.jpg) -- a large paved courtyard under mature tree canopy, with a speed bump crossing it, next to a plain-white (non-BITS-coloured) building wing.

**Design spec:**
- **Walkways/plazas:** the real ground is a **herringbone or basket-weave interlocking paver** in a
  warm red-brown (`#B06B4A`/`#8C5236`), consistently bordered by a **black-and-white striped kerb**
  wherever it meets a road or lawn -- exactly the game's existing `walkway`/`kerb*` intent, this pass
  just confirms the hue should trend browner/redder than the current salmon-pink, and that the paver
  pattern is diagonal herringbone, not a square running-bond.
  a secondary path type worth adding for courtyards specifically (not the main circulation routes).
- **Lawns:** flat, well-kept, saturated green (`#6FAE4A` -- matches the game's existing Grass ramp
  and `lawn` tile almost exactly, no change needed), edged with a **mowed-edge kerb strip** rather
  than hedges everywhere.
- **Hedges:** low, tightly clipped, dry mid-green (`#4F7A30`-`#6FAE4A`, matches the game's own
  `remapDryLeaves` ramp already tuned for this) -- confirmed correct, no change.
- **Flower beds:** in the courtyard/plaza photos, flowering shrubs (purple/pink) are used loosely as
  a border planting, not the boxed single-species planter the game's `flowerbed` currently draws --
  a looser, more organic "flowering hedge" variant would read closer to real photos, worth a follow-
  up tile if time allows.
- **Palms:** tall date palms cluster **right at building entrances and plaza edges** (see Main Block
  section above), while broader avenues (Campus_2, Pilani_Dubai_Campus) are lined with **ordinary
  round-canopy shade trees**, not palms -- palms are a landmark/entrance accent, shade trees are the
  everyday street tree. The current game may be over-using palms uniformly; reserve them for
  entrances/plazas specifically per this finding.
- **Benches:** simple red-painted metal-and-wood park benches (`wiki-BITS_Dubai_Campus.jpg`),
  matching the game's existing bench asset well enough (Kenney Modern City bench) -- no change
  needed, just confirms red as an acceptable recolour if the current bench is a different colour.
- **Bins:** a plain beige waist-height bin on a paved base (`wiki-BITS_Dubai_Hostels.jpg`'s
  streetlamp photo) -- matches the existing bin concept.
- **Lamp posts:** tall white poles with a **solar panel mounted near the top** (not just a lamp head)
  -- a distinctive real detail (`wiki-BITS_Dubai_Hostels.jpg`) worth adding as a small solar-panel
  silhouette on the lamp post sprite if there's time; skip if not, it's a minor detail.
- **What the player should see walking the main avenue:** red-brown herringbone paving underfoot,
  black/white kerb lines, a mix of palms near buildings and round shade trees lining the straight
  runs, clipped hedges bordering lawns, red benches at intervals, and the Main Block's terracotta
  roofline visible ahead over the treeline (`wiki-BITS_Pilani_Dubai_Campus.jpg`'s exact composition).

## 11. Parking

**Sources:** [wiki-BITS_Dubai_Main_Building.jpg](reference/campus/wiki-BITS_Dubai_Main_Building.jpg)
(a single sedan parked directly at the entrance kerb, an orange traffic cone beside it),
[wiki-BITS_dubai_campus_map.jpg](reference/campus/wiki-BITS_dubai_campus_map.jpg) (labelled
"Students Parking" as a lot beside the athletics track, matching the game's own `Student Parking
(existing lot, near the track)` entry in `bits-dubai-campus.md`'s v3 table).

**Design spec:** no dedicated parking-lot photo was found; the map confirms the *existing* game
layout's parking-lot position (near the track) is correct, and the single sedan-at-the-kerb detail
supports keeping a few cars near building entrances (already done via `carSedan` etc. in
`build-campus.js`) in addition to the main lot. No change indicated beyond what FB-0025 already
built.

## 12. Main gate

**Sources:** [wiki-BITS_Dubai_campus_main.jpg](reference/campus/wiki-BITS_Dubai_campus_main.jpg) --
the wide facade panorama's far-left edge shows a **low gabled-roof gatehouse structure** set back
from the road, with striped bollards in front of it; this is the closest thing to a real gate photo
found in this pass (still not a clean, close-up shot of the gate itself -- the gap
`bits-dubai-campus.md`'s "Main gate appearance" section already flagged as unresolved stands).

**Design spec:** no change to that section's existing "plausible, not a reproduction of a real
photo" gate design is warranted from this one distant, partial view -- it's consistent with (small
sand-beige structure, striped road markings) but doesn't add enough detail to redraw it. Still
flagged here rather than silently reused, per this doc's own sourcing standard.

## 13. Hostels

**Sources:**
- [wiki-BITS_Dubai_Hostels.jpg](reference/campus/wiki-BITS_Dubai_Hostels.jpg) -- a hostel corner facade: plain sand-tan panels (no terracotta trim), recessed windows with grilles at a lower level, a "no smoking" sign by a service door.
- [wiki-BITS_Dubai_G_and_H_Block.jpg](reference/campus/wiki-BITS_Dubai_G_and_H_Block.jpg) -- the gap between two hostel wings: a paved courtyard, a solar-panel streetlamp, a water-tank service shed, palms and hedges.
- [wiki-BITS_Dubai_Campus.jpg](reference/campus/wiki-BITS_Dubai_Campus.jpg) -- the courtyard-benches-and-stepping-path scene between hostel blocks (see "Outdoor" section above).

**Design spec:** confirms `bits-dubai-campus.md`'s "4-5 storey beige blocks with recessed windows and
grilles at ground level" note -- the hostel facade is **plainer than the Main/Library/Mechanical
Blocks**: sand-tan body, little to no terracotta trim, a simpler window pattern. This matches the
game's existing `otherWallPlain`/`otherWall` (grey/white "non-BITS" palette) being reserved for
non-named buildings -- worth checking whether hostels should instead get a **third, intermediate**
wall style (plain sand, no red trim) rather than either the full BITS trim kit or the generic grey
kit, since neither quite matches this photo. Flagging as a judgement call for whoever builds it, not
resolving it here.

## 14. Sports areas

**Sources:** [wiki-BITS_Dubai_4.jpg](reference/campus/wiki-BITS_Dubai_4.jpg) -- pitch-level view of
the football/athletics field, goal posts, a row of parked buses/vans along the far side, the
Main Block and a hostel block visible beyond the treeline.

**Design spec:** confirms the existing `court`/tennis-kit approach and the field's real scale
relationship to the surrounding buildings (the field reads as roughly as wide as 3-4 building widths,
matching the game's existing 67x32-tile Athletics Track sizing in the v3 layout table). The **row of
parked buses along the field's edge** is a detail not currently in the game -- worth adding 1-2 bus
sprites (Kenney Pixel Vehicle Pack already has a bus, per `docs/research/asset-packs.md`) near the
sports area specifically, matching "Transport Facility" being one of the virtual tour's own outdoor
scene names.

## 15. Signage

**Sources:** [wiki-BITS_Dubai_Main_Building.jpg](reference/campus/wiki-BITS_Dubai_Main_Building.jpg),
[wiki-BITS_Dubai_campus_main.jpg](reference/campus/wiki-BITS_Dubai_campus_main.jpg) -- both show the
"BITS Pilani, Dubai Campus" wordmark on the entrance canopy fascia.

**Design spec:** **navy blue** lettering (`#1A3A6B`), a plain sans/serif-mix face, mounted directly on
a cream fascia board -- not gold or white as might be assumed. This is a specific, confirmed colour
correction worth applying anywhere the game currently renders campus signage text.

## 16. Aerial / overall layout

**Sources:** [wiki-BITS_dubai_campus_map.jpg](reference/campus/wiki-BITS_dubai_campus_map.jpg) -- a
labelled Google-Maps-style satellite crop.

**Design spec:** this is the single most useful confirmation image in this whole set -- it labels
Hostel A&B Block and Hostel C Block together on the north side facing D54, Girls' Hostel to their
east, a running track enclosing a football pitch with tennis courts beside it on the west end,
Canteen on the Main Block's own north face, Students Parking beside the track, and Bank of Baroda +
a bus stop near the entrance road's roundabout on the south side -- **this matches the existing
"Campus v3" layout in `bits-dubai-campus.md` almost exactly** (roundabout + flanking parking near
the gate, sports field at the west end, hostel row to the north). No layout change is indicated;
this image is best used as a shared "ground truth" reference to keep in view while placing any new
detail (benches, palms, signage) rather than a source of new facts.

---

## Summary of corrections to existing docs/assumptions

1. **The Main Block entrance is a glass canopy with navy lettering, not a red arch.** Both the
   owner's photo and two independent Wikimedia photos agree. `docs/STYLE_GUIDE.md`'s
   `bitsEntranceGrandL`/`bitsEntranceGrandR` red-arch tiles should be revisited against this
   (flagged here, not changed -- this task is research-only).
2. **The foyer staircase is a twin curved flight to one shared landing**, not a straight run, with a
   **black wrought-iron railing** (cooler/darker than the game's usual outline colour) and a
   ceiling-hung chandelier over the lower landing.
3. **Signage lettering is navy blue** (`#1A3A6B`), not gold/white.
4. **Palms belong at entrances/plazas; ordinary shade trees line the everyday avenues** -- a
   placement rule, not just an asset choice.
5. **Pavers read redder/browner** (`#B06B4A`) than the game's current salmon-pink tone.
6. **The library's columns have a distinct pale sage-green base band** (`#B8C9B0`), a real detail
   worth its own palette key.
7. **The canteen is yellow-accented with a red counter**, brighter/more specific than the game's
   current plain classroom-floor canteen.
8. Two open gaps confirmed still open, not solved by this pass: **no clean photo of the gate
   structure itself**, and **no photo confirmed for "Physics Lab" specifically** (both already
   flagged in `bits-dubai-campus.md`/`INTERIORS_PLAN.md`).
