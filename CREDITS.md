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
  Interior floors, walls, doors, furniture, and the character sprite sheets.
  Free-version licence: use and editing allowed in **non-commercial** projects; no reselling.
- **Sprout Lands - Basic pack** by **Cup Nooble** --
  [cupnooble.itch.io/sprout-lands-asset-pack](https://cupnooble.itch.io/sprout-lands-asset-pack).
  Outdoor greenery: trees, bushes, flowers, grass detail.
  Licence: non-commercial, editing allowed, **credit required**, the pack itself must not be
  redistributed. *Assets - From: Sprout Lands - By: Cup Nooble.*
- **Roguelike Modern City pack** and **Pixel Vehicle Pack** by **Kenney** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-roguelike-modern-city/` and `assets/vendor/kenney-pixel-vehicle-pack/`) --
  CC0 1.0 (public domain). **In use**: `walkway`, all 8 kerb tiles, `asphalt`, `roadLineH`/
  `roadLineV`, `crossingH`/`crossingV`, `parking` (asphalt only -- see docs/STYLE_GUIDE.md for why
  the stall lines stay hand-drawn), and the parked cars (`carSedan`,
  `carSedanBlue`, `carSuv`, `carVan`) -- see `tools/make-assets.js`'s `PACK` table and
  docs/STYLE_GUIDE.md's "Campus kit" for exactly which tile uses which source rect. `lawn`/`lawn2`/
  `grass`/`grass2`/`bush` also currently use this pack's flat grass/shrub tiles as an interim step
  (this table above assigns outdoor greenery to Sprout Lands instead; that swap hasn't happened yet,
  so these five tile names are Kenney art for now, recolored onto the existing Grass/Leaves ramps).
  Kenney's Pixel UI Pack (`assets/vendor/kenney-pixel-ui-pack/`) was surveyed but **not used** --
  worse fit than the existing hand-drawn dialog box.
- **Cool School Tileset** by **NettySvit** (OpenGameArt, `assets/vendor/cool-school-tileset/`) -- CC0
  1.0. Not used yet -- earmarked as an interior-furniture reference/fallback if Modern Interiors
  Free doesn't cover a piece; needs a recolor pass first (see docs/research/asset-packs.md).

## Character, icon, and audio survey (added 2026-09-21, see docs/research/asset-packs.md)

Research only -- none of these are wired into the game yet (`src/` and `tools/` untouched).

- **RPG Audio**, **UI Audio** and **Music Jingles** by **Kenney Vleugels** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-rpg-audio/`, `assets/vendor/kenney-ui-audio/`, `assets/vendor/kenney-music-jingles/`)
  -- CC0 1.0 (public domain). Footsteps, doors/creaks, book/coin sounds; UI clicks/rollovers/switches;
  and 85 short musical stingers. Not wired in -- candidate SFX for M5.
- **15 Melodic RPG Chiptunes** by **Aureolus_Omicron** (OpenGameArt,
  `assets/vendor/aureolus-15-melodic-rpg-chiptunes/`) -- CC0 ("CC0. No credit required."). 15 full-length
  loopable tracks including a title-screen theme and a calm town/overworld loop. Not wired in --
  candidate background music for M5.
- **Kyrise's 16x16 RPG Icon Pack (V1.2)** by **Kyrise** (OpenGameArt,
  `assets/vendor/kyrise-16x16-rpg-icons/`) -- **CC BY 4.0, attribution required**:
  "Kyrise's 16x16 RPG Icon Pack" by Kyrise (https://kyrise.itch.io/), via
  [opengameart.org/content/kyrises-free-16x16-rpg-icon-pack](https://opengameart.org/content/kyrises-free-16x16-rpg-icon-pack),
  CC BY 4.0. 300+ 16x16/32x32/48x48 item icons with outlines already drawn; includes several key
  designs and closed/open treasure-chest icons, a strong content match for the 3-key/reward-box
  treasure hunt in docs/STORY.md. Not wired in yet.
- **LimeZu Modern Interiors Free's characters** (already in `assets/vendor/limezu-modern-interiors-free/`,
  same licence as above) were surveyed as the female-lead candidate: see
  docs/research/asset-packs.md's 2026-09-21 addendum for the recolor mockup and verdict.
