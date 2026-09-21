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
