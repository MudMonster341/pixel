# Credits

Third-party data and art used by Pixel Quest, beyond the original art in `tools/make-assets.js`.

## Map data

- **OpenStreetMap** contributors -- campus and DIAC Park layout extracted for `assets/maps/campus.json`.
  © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/). See
  [decisions/0007-campus-map-from-osm-into-tiled.md](decisions/0007-campus-map-from-osm-into-tiled.md).

## Art packs (added 2026-09-21, see [ADR 0012](decisions/0012-third-party-asset-packs.md))

This game is a private gift and is **never sold**, which is what the two non-commercial licences below
require. The raw packs are not in this repository; download them again if you need to rebuild the art.

- **Modern Interiors (Free v2.2, 16×16)** by **LimeZu** --
  [limezu.itch.io/moderninteriors](https://limezu.itch.io/moderninteriors).
  Interior floors, walls, doors, furniture, and the character sprite sheets. Also studied (2026-09-21,
  not blitted -- its wall art turned out to be flat color bands with no fine texture to copy
  pixel-for-pixel) as the reference for how the BITS building exteriors are constructed: see
  docs/STYLE_GUIDE.md "How our buildings are built".
  Free-version licence: use and editing allowed in **non-commercial** projects; no reselling.
- **Sprout Lands - Basic pack** by **Cup Nooble** --
  [cupnooble.itch.io/sprout-lands-asset-pack](https://cupnooble.itch.io/sprout-lands-asset-pack).
  Outdoor greenery: trees, bushes, flowers, grass detail. **In use** (wired in 2026-09-21): the
  `treeCanopyTL/TR/BL/BR` fill (a complete plain round tree, canopy only), `hedge`, `bush`,
  `flowerbed`'s three flowers, and `lawn2`'s grass-tuft speckle -- all recolored onto a new, more
  muted "dry campus greenery" ramp (`remapDryLeaves` in `tools/make-assets.js`) instead of the
  pack's own bright farm-green, per docs/STYLE_GUIDE.md "Green campus". The flat `lawn`/`lawn2`/
  `grass`/`grass2` ground fill itself stays Kenney's (below), matching the roads/kerbs around it.
  Licence: non-commercial, editing allowed, **credit required**, the pack itself must not be
  redistributed. *Assets - From: Sprout Lands - By: Cup Nooble.*
- **Roguelike Modern City pack** and **Pixel Vehicle Pack** by **Kenney** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-roguelike-modern-city/` and `assets/vendor/kenney-pixel-vehicle-pack/`) --
  CC0 1.0 (public domain). **In use**: all 8 kerb tiles, `asphalt`, `roadLineH`/
  `roadLineV`, `crossingH`/`crossingV`, `parking` (asphalt only -- see docs/STYLE_GUIDE.md for why
  the stall lines stay hand-drawn), `lawn`/`lawn2`/`grass`/`grass2`'s flat ground fill, and the
  parked cars (`carSedan`, `carSedanBlue`, `carSuv`, `carVan`) -- see `tools/make-assets.js`'s `PACK`
  table and docs/STYLE_GUIDE.md's "Campus kit" for exactly which tile uses which source rect.
  Kenney's Pixel UI Pack (`assets/vendor/kenney-pixel-ui-pack/`) was surveyed but **not used** --
  worse fit than the existing hand-drawn dialog box.
- **Cool School Tileset** by **NettySvit** (OpenGameArt, `assets/vendor/cool-school-tileset/`) -- CC0
  1.0. Not used yet -- earmarked as an interior-furniture reference/fallback if Modern Interiors
  Free doesn't cover a piece; needs a recolor pass first (see docs/research/asset-packs.md).

## Premium pass (added 2026-09-26, see docs/research/asset-packs-2026-09-26.md and
docs/plans/2026-09-26-premium-pass.md)

- **RPG Urban Pack** by **Kenney Vleugels** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-rpg-urban-pack/`) -- CC0 1.0 (public domain). **In use**: `walkway`'s plain
  fill (replacing Roguelike Modern City's plainPaver, FB-0028's "look like brick walls" fix) plus its
  own edge/corner border tiles (`walkwayEdgeT/B/L/R`, `walkwayCornerTL/TR/BL/BR`), and the new campus
  props `lampPost`, `bench`, `bin`, `planter`, `lowFence`, `bollard` -- see `tools/make-assets.js`'s
  `URBAN` table.
- **Ninja Adventure -- Asset Pack** by **Pixel-boy and AAA**
  ([pixel-boy.itch.io/ninja-adventure-asset-pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack),
  `assets/vendor/ninja-adventure/`) -- CC0 1.0, attribution appreciated but not required. **In use**:
  `treeCanopyTL/TR/BL/BR`'s fill (its Nature tileset's own round tree, replacing Sprout Lands) and
  `palmCanopyTL/TR/BL/BR`'s fill (its Desert tileset's potted-palm fronds, replacing the hand-picked
  palette ramp -- our own hand-drawn trunk/shape/outline is unchanged, only the fill, the same "our
  shape, its fill" technique FB-0025 used for the round tree originally), plus `flagPoleYellow`/
  `flagPoleBlue`/`flagPoleRed` (its animated Flag sprites, first frame only for now -- named per
  colour so the engine can animate them later). See `tools/make-assets.js`'s `NINJA` table.

## Interior furniture kit (added 2026-09-22, see docs/research/asset-packs.md)

- **Cool School Tileset** by **NettySvit** (`assets/vendor/cool-school-tileset/`) -- CC0 1.0. **Now in
  use** (previously surveyed only): the teacher's desk, lockers, library/mart shelving (`bookshelf`),
  a computer-lab monitor, a printer, and a stack of books, recolored onto this game's own ramps.
- **LimeZu Modern Interiors Free**'s furniture sheet (same pack/licence as above, "Art packs" section)
  -- its `Interiors_free_16x16.png` sheet is now mined for classroom desks, a wall chalkboard, a
  corkboard noticeboard, a globe, an office/lab cabinet, a potted plant, a reading armchair (`intSofa`)
  and a canteen counter shelf, matching the walls/floors already sourced from the same sheet.
- **Pixel Seating** by **Molly "Cougarmint" Willits** (OpenGameArt,
  `assets/vendor/pixel-seating/`) -- **CC-BY 3.0**: *"Licences CC-BY 3.0. Free Commercial Use: Yes.
  Free Personal Use: Yes."* A single theatre seat sprite is the new `intAuditoriumSeat` art.
- **Laboratory Tileset PixelArt 16px** ("Land of Pixels") by **marceles** (OpenGameArt,
  `assets/vendor/landofpixels-laboratory-tileset/`) -- **CC BY 4.0**: *"Attribution 4.0 International
  (CC BY 4.0)"*. A lab bench, a chemistry/bio apparatus tank, and an equipment rack furnish the
  science/engineering labs (`intLabBench`, `intLabTank`, `intLabRack`).
- Not used: Antea's "Free Furniture Office Equipment Set" (itch.io, CC-BY) -- on-brief content
  (cabinets/printer/vending machines) but itch.io's free-tier download needs an interactive browser
  session rather than a scriptable URL; see docs/research/asset-packs.md's 2026-09-22 addendum for why
  it's named rather than silently skipped. Water coolers, vending machines and a trash bin are
  hand-drawn instead (no clean free-licensed match found).

## Character, icon, and audio survey (added 2026-09-21; audio wired in for M5, 2026-09-22)

- **RPG Audio**, **UI Audio** and **Music Jingles** by **Kenney Vleugels** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-rpg-audio/`, `assets/vendor/kenney-ui-audio/`, `assets/vendor/kenney-music-jingles/`)
  -- CC0 1.0 (public domain). **In use** (M5, `tools/make-audio.js` copies the exact files below into
  `assets/audio/` -- see that file's own header for why a copy, not a direct load from
  `assets/vendor/`): footstep00-03/06-09 (outdoor/indoor footsteps), doorOpen_1 (door open), creak1
  (warp/stairs), metalLatch (locked-door thud), handleCoins (item pickup), bookOpen (the reward box
  opening); rollover1 (menu move), click3 (menu confirm), switch1 (the dialog typewriter's blip);
  Steel jingles/jingles_STEEL00 (key awarded), Pizzicato jingles/jingles_PIZZI00 (mini-game win), Hit
  jingles/jingles_HIT01 (mini-game lose).
- **15 Melodic RPG Chiptunes** by **Aureolus_Omicron** (OpenGameArt,
  `assets/vendor/aureolus-15-melodic-rpg-chiptunes/`) -- CC0 ("CC0. No credit required."). **In use**
  (M5): rpgchip01_title_screen (title screen), rpgchip03_town (the outdoor campus), rpgchip07_the_
  shrine_of_mysteries (indoors), rpgchip11_airship (mini-games -- tense but light), rpgchip02_
  bittersweet_story (the birthday card).
- **Synth-generated, M5 (`tools/make-audio.js`, a tiny jsfxr-style oscillator + envelope, no
  dependencies, written straight to WAV)**: none of the above packs had a clean match for a
  platformer jump, a flappy-style flap, a Tetris line-clear stinger, or a soft confetti whoosh for
  the birthday card, so these 4 are original, generated by this project rather than downloaded --
  `assets/audio/generated/minigame-jump.wav`, `minigame-flap.wav`, `minigame-line-clear.wav`,
  `card-whoosh.wav`. No licence question: they're original work, made for this game.
- **Kyrise's 16x16 RPG Icon Pack (V1.2)** by **Kyrise** (OpenGameArt,
  `assets/vendor/kyrise-16x16-rpg-icons/`) -- **CC BY 4.0, attribution required**:
  "Kyrise's 16x16 RPG Icon Pack" by Kyrise (https://kyrise.itch.io/), via
  [opengameart.org/content/kyrises-free-16x16-rpg-icon-pack](https://opengameart.org/content/kyrises-free-16x16-rpg-icon-pack),
  CC BY 4.0. 300+ 16x16/32x32/48x48 item icons with outlines already drawn. **Wired in** (M3, the LUG
  treasure hunt): `tools/make-assets.js`'s `VENDOR_ITEM_ICONS` blits `key_01a`/`key_02a`/`key_01c`
  (the 3 treasure-hunt key items) and `gift_01a` (the reward box) straight into `assets/items.png`,
  unmodified -- no recolor was needed, unlike the outdoor/interior tile packs.
- **LimeZu Modern Interiors Free's characters** (`assets/vendor/limezu-modern-interiors-free/`, same
  licence as above): **wired in** ([decisions/0013-characters-are-16x24-from-the-pack.md](decisions/0013-characters-are-16x24-from-the-pack.md),
  FB-0025) -- recolored crops of Amelia (the lead), Adam (the LUG volunteer), Alex and Bob
  (background students), built by `tools/make-assets.js`. The original survey/mockup that led to
  this is still at docs/research/asset-packs.md's 2026-09-21 addendum.
