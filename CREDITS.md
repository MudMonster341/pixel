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
  `hedge`, `bush`,
  `flowerbed`'s three flowers, and `lawn2`'s grass-tuft speckle -- all recolored onto a new, more
  muted "dry campus greenery" ramp (`remapDryLeaves` in `tools/make-assets.js`) instead of the
  pack's own bright farm-green, per docs/STYLE_GUIDE.md "Green campus". **FB-0053/FB-0056 (P3b):** the
  campus's leafy trees `leafy1`/`leafy2`/`leafy3` are cropped from this pack's round and tall trees
  (`Objects/Basic_Grass_Biom_things.png`) by `tools/lib/tree-art.js`, recoloured onto the project's own
  leaf ramp with brown trunks and a lengthened trunk (see docs/STYLE_GUIDE.md "Trees (P3b)"). The flat `lawn`/`lawn2`/
  `grass`/`grass2` ground fill itself stays Kenney's (below), matching the roads/kerbs around it.
  Licence: non-commercial, editing allowed, **credit required**, the pack itself must not be
  redistributed. *Assets - From: Sprout Lands - By: Cup Nooble.*
- **Roguelike Modern City pack** and **Pixel Vehicle Pack** by **Kenney** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-roguelike-modern-city/` and `assets/vendor/kenney-pixel-vehicle-pack/`) --
  CC0 1.0 (public domain). **In use**: `asphalt`, `roadLineH`/
  `roadLineV`, `crossingH`/`crossingV`, `parking` (asphalt only -- see docs/STYLE_GUIDE.md for why
  the stall lines stay hand-drawn), `lawn`/`lawn2`/`grass`/`grass2`'s flat ground fill, and the
  parked cars (`carSedan`, `carSedanBlue`, `carSuv`, `carVan`) -- see `tools/make-assets.js`'s `PACK`
  table and docs/STYLE_GUIDE.md's "Campus kit" for exactly which tile uses which source rect.
  **No longer used** for the road-facing `kerb*` tiles as of coordinator review round 3 (2026-09-27):
  they used to blit this pack's own brick paver-with-gutter-line tile (`PACK.kerbPaver`), recolored to
  a salmon-brick ramp, as the whole tile -- the actual reason the avenue still read as brick after
  round 2's separate `walkway()` fix. `kerb*` now reuses the RPG Urban Pack's own concrete sidewalk
  (see that pack's entry, above) instead; `PACK.kerbPaver`/`PACK.plainPaver` stay defined for
  reference but nothing calls them any more.
  Kenney's Pixel UI Pack was surveyed here and not used at the time -- **now in use**, see the "UI kit"
  entry below.
- **Cool School Tileset** by **NettySvit** (OpenGameArt, `assets/vendor/cool-school-tileset/`) -- CC0
  1.0. Not used yet -- earmarked as an interior-furniture reference/fallback if Modern Interiors
  Free doesn't cover a piece; needs a recolor pass first (see docs/research/asset-packs.md).

## Premium pass (added 2026-09-26, see docs/research/asset-packs-2026-09-26.md and
docs/plans/2026-09-26-premium-pass.md)

- **RPG Urban Pack** by **Kenney Vleugels** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-rpg-urban-pack/`) -- CC0 1.0 (public domain). Coordinator review round 3
  (2026-09-27, "one coherent free kit"): this is now the main outdoor kit, not just a source of small
  props -- round 2's hand-drawn flat fills still read as flat/no-material at the real camera, so both
  the ground and every BITS building are now composed from real crops of this single sheet, recolored
  onto the established BITS palette (sand body `#e3c09b`, terracotta trim `#b5583c`, light parapet
  `#f2ddb8`) via hue/luminance remaps in `tools/make-assets.js` (`remapBitsWall`,
  `remapBitsWallBase`, `remapBitsWindow`, `remapBitsDoorFrame`, `remapLightStone`,
  `remapBitsColumn`). **In use**:
  - the campus props `lampPost`, `bench`, `bin`, `planter`, `lowFence`, `bollard`, and (new)
    the street bin/flower box at the RTA bus stop (`streetBin`, `streetPlanter`, FB-0044: the same `bin` /
  `planter` sprites without a lawn underlay) -- see the `URBAN` table;
  - `walkway`/`walkwayEdge*`/`walkwayCorner*` and every road-facing `kerb*` tile: the sheet's own
    concrete-plaza 9-slice (fill + edge + corner pieces), used **unrecolored** (the coordinator's own
    "or only slightly warmed") -- see the `SIDEWALK` table. `kerbEdge` now simply calls the same
    `walkwayEdge`/`walkwayCorner` functions instead of Modern City's brick paver (see that pack's own
    entry below), which is what actually explained "the avenue is still salmon brick" surviving round
    2 -- kerb tiles were a separate, untouched code path;
  - every BITS building's facade bands (`bitsFacadeCap`/`Window`/`Body`/`Base`), its portico/column
    tiles (`bitsPillar`, `bitsEntranceColumn`, `bitsPorticoFrame`, `bitsPorticoGlassTop/Mid/Base`), its
    grand entrance doors (`bitsEntranceGrandL/R` and their `...Open` variants), and its staircase
    (`bitsStep1/2/3`) -- a wall-with-coping crop for the cap/body/base bands, a tan arched window, a
    wide glass double door (also reused, recolored, for the portico's own flanking glass panels), a
    free-standing pillar prop (composed onto a wall backdrop the same way `lampPost` composes onto
    grass), and a 3-tread staircase crop -- see the `BLDG` table;
  - the flag's own pole (`FLAG_POLE_SRC`, see the Ninja Adventure entry below for the flag itself).
  The Main Block forecourt's own `paving` (small-scale, low-contrast red-brown pavers) is unchanged
  from round 2 and stays hand-drawn -- the coordinator's round 3 brief keeps it as the one deliberate
  exception ("no brick anywhere on walkable ground except the Main Block forecourt inset").
- **Ninja Adventure -- Asset Pack** by **Pixel-boy and AAA**
  ([pixel-boy.itch.io/ninja-adventure-asset-pack](https://pixel-boy.itch.io/ninja-adventure-asset-pack),
  `assets/vendor/ninja-adventure/`) -- CC0 1.0, attribution appreciated but not required. **In use**:
  (no longer used for trees: FB-0053/FB-0056 replaced its round tree and potted palm, see Sprout Lands
  above and `tools/lib/tree-art.js`.) **In use**: `flagPoleYellow`/`flagPoleBlue`/`flagPoleRed`'s *top* tile (the new, separate
  `flagTopYellow`/`flagTopBlue`/`flagTopRed` overhead tiles -- see the Kenney entry above for the pole
  itself), its animated Flag sprites' first frame, enlarged and mounted on a real 2-tile Kenney pole
  instead of the pack's own short stick (coordinator review round 3: the old single-tile version "read
  as a little axe" at this scale).

## Interior furniture kit (added 2026-09-22, see docs/research/asset-packs.md)

- **Cool School Tileset** by **NettySvit** (`assets/vendor/cool-school-tileset/`) -- CC0 1.0. **Now in
  use** (previously surveyed only): the teacher's desk, lockers, library/mart shelving (`bookshelf`),
  a computer-lab monitor, a printer, and a stack of books, recolored onto this game's own ramps.
- **LimeZu Modern Interiors Free**, stairs and lift (P4b, 2026-10-05; same pack and non-commercial licence as above): the Main Block's
  stairs are cut from the sheet's stepped flight with gold handrails and newel posts (`Interiors_free_16x16.png`, x 92-175, y 48-127: the
  tread/riser/line colours are sampled from it, the rail columns cropped), and the lift is its stainless-steel elevator doors (x 13-50,
  y 423-447) and call-button plate (x 66-71, y 448-456). Only the arrangement and the floor-indicator lamp are ours.
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
  the birthday card, so these are original, generated by this project rather than downloaded --
  `assets/audio/generated/minigame-jump.wav`, `minigame-flap.wav`, `minigame-line-clear.wav`,
  `card-whoosh.wav`, and (P4b) `lift-ding.wav`, the lift's two-note arrival chime. No licence question: they're original work, made for this game.
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

## UI kit (added 2026-09-28, docs/GAME_FEEL.md "one UI kit", roadmap M2)

- **Pixel UI Pack** by **Kenney Vleugels** (with help by Lynn Evers) ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-pixel-ui-pack/`) -- CC0 1.0 (public domain). Surveyed and shelved during the
  2026-09-21 art pass (see the note above); **now the source of every panel and button in the game**.
  `tools/make-assets.js`'s "UI kit" section decodes the pack's own `9-Slice/Ancient/tan.png` (and
  `tan_pressed.png` for the button's pressed state) directly -- a plain 45x45 bordered square (fill,
  border line, a light top/left bevel and a dark bottom/right one, already following this game's own
  "one light source, top-left" rule) -- and recolors its 4 flat colors onto this game's navy/cream/gold
  palette, upscaled 2x into `assets/ui-panel.png` (4 90x90 frames: panel, button normal/hover/pressed).
  `src/scenes/ui.js`'s `makePanel()`/`Button` build a real Phaser NineSlice from it, replacing the old
  hand-drawn `drawPanel()`/`drawButtonState()` Graphics rectangles everywhere in the game (every dialog
  box, menu, tracker, banner, mini-game card and the title screen's own buttons) without any layout
  code changing.
- **Hand-drawn, this pass**: the cursor/selection arrow (every keyboard-driven list: the pause menu,
  the shared Controls/Sound panel, dialog choices, mini-game cards) and the dialog box's own bouncing
  "next line" arrow, `assets/ui-icons.png` -- no pack at this exact tiny size/shape was a clean fit, so
  these are original pixel art, drawn the same text-sprite way as everything else in
  `tools/make-assets.js`.

## Animals (added 2026-10-03, see [ADR 0018](decisions/0018-talkable-campus-life.md) and docs/research/animal-packs.md)

Cats and birds only. The raw packs stay in `assets/External Tilesets/` (git-ignored, never committed);
`tools/make-animals.js` crops and recolours them into `assets/animal-*.png`.

- **Animals Asset Pack** (16x16 top-down animals, supplied by the owner; free licence: no resale, no NFTs;
  author not named in the pack, so none is claimed here). Use and modification are allowed, but the pack
  itself must not be resold or redistributed. Only the cat is used (the bear, penguin and pig are not),
  recoloured, as the 4-direction wandering campus cats.
- **Free Pixel Animation: Cat [6 loops]** by **Zeenaz**
  ([zeenaz.itch.io/free-pixel-animation-cat-6-loops](https://zeenaz.itch.io/free-pixel-animation-cat-6-loops))
  -- CC0 1.0 (public domain). Stray campus cats, recoloured: sitting, sleeping, standing and startled poses.
- **[LPC] Birds** by **bluecarrot16** (commissioned by castelonia)
  ([opengameart.org/content/lpc-birds](https://opengameart.org/content/lpc-birds)) -- CC BY 4.0,
  attribution required. Campus sparrows, pigeons (the white dove recoloured grey) and crows.
  Also on the title screen's Credits page (`src/scenes/title.js` `CREDITS_LINES`, ADR 0012's rule).
