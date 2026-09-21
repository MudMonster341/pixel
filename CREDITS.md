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
- **Roguelike Modern City pack** and **Pixel Vehicle Pack** by **Kenney** ([kenney.nl](https://kenney.nl)) --
  roads, kerbs, crossings, pavements and parked cars. CC0 1.0 (public domain).
- **Cool School Tileset** by **NettySvit** (OpenGameArt) -- classroom furniture reference. CC0 1.0.

## Fonts

- **Press Start 2P** by Cody "CodeMan38" Boisclair -- [SIL Open Font License](https://scripts.sil.org/OFL),
  loaded from Google Fonts.

## Vendored asset packs (research only, not yet wired into the game)

Downloaded 2026-09-20 for the FB-0025 asset-pack survey
([docs/research/asset-packs.md](docs/research/asset-packs.md)). Not yet used by any tile, sprite or
UI element in `src/` or `tools/` -- kept in `assets/vendor/` for evaluation and possible future
integration. Each folder has its own `LICENSE.txt` and `SOURCE.txt` with the exact download details.

- **Roguelike Modern City pack** by Kenney Vleugels / [kenney.nl](https://kenney.nl) -- CC0 1.0.
  `assets/vendor/kenney-roguelike-modern-city/`
- **Pixel Vehicle Pack** by Kenney / [kenney.nl](https://kenney.nl) -- CC0 1.0.
  `assets/vendor/kenney-pixel-vehicle-pack/`
- **Pixel UI Pack** by Kenney / [kenney.nl](https://kenney.nl) -- CC0 1.0.
  `assets/vendor/kenney-pixel-ui-pack/`
- **Cool School Tileset** by NettySvit ([OpenGameArt](https://opengameart.org/content/cool-school-tileset)) -- CC0 1.0.
  `assets/vendor/cool-school-tileset/`

None of these require attribution under CC0, but they're credited here anyway as good practice.
