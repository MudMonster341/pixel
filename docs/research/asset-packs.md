# Asset-pack survey (FB-0025)

**Status:** research only. Nothing in `src/` or `tools/` changed. Four packs were downloaded into
`assets/vendor/` for evaluation (see recommendation below); nothing has been wired into the game yet.

**Why this exists:** FB-0025 (owner feedback, high priority): *"Don't try making assets on your own
because you are sort of bad at it. Find open source asset packages with assets like trees, pathways
and all of that already made and use them... Change all the trees, pavements, everything."*

This is a genuinely fair critique of the *current* trees/paving specifically -- the flat lawn and the
repeating brick `walkway` read as a stamped grid up close (see `docs/research/campus-tile-kit.png`
and the `qa-shots/outdoor-*.png` screenshots for the current look). The rest of this doc looks for a
free replacement, is honest about how well it actually fits, and prices out the integration.

## The licence filter

Only CC0, CC-BY, or an explicit permissive/commercial-use licence was considered. Ruled out on sight:
anything "personal use only," anything without a licence I could find and quote, and anything that's
Nintendo/Pokémon-derived fan art (a lot of "Pokémon-style" tile search results are exactly that --
skipped entirely, not listed below). The project's own constraint is **$0** (CONTEXT.md), so paid
packs are noted for completeness but not downloaded or recommended without the owner's OK to spend
money.

## Candidates

| Pack | Author | URL | Licence | Tile size | Covers | Tiles | Style fit |
|---|---|---|---|---|---|---|---|
| **Roguelike Modern City pack** ✅ downloaded | Kenney Vleugels / kenney.nl | [opengameart.org/content/roguelike-modern-city-pack](https://opengameart.org/content/roguelike-modern-city-pack) | CC0 1.0 ([full text](https://creativecommons.org/publicdomain/zero/1.0/)) | 16×16, 1px margin | Roads (line/lane markings), crosswalks, kerbs/sidewalks (3 materials), parking-lot paint, traffic lights/signs, streetlamps, benches, planters, small shopfront facades, round trees + hedges/bushes (top-down canopy), a few top-down cars | 1,000+ | **Good.** Same tile size as the game exactly. Flatter shading than this game's 4-tone ramps (see side-by-side below) but the *content* -- roads with kerbs and crossings, sidewalks, trees, hedges -- is exactly what FB-0025 asked for, and it's the same tile size so it drops straight onto the existing grid. Its "buildings" are pure top-down roofs, not the wall+roof 3/4 view this game's BITS buildings use, so building tiles are **not** a fit -- keep those hand-drawn. |
| **Pixel Vehicle Pack** ✅ downloaded | Kenney / kenney.nl | [kenney.nl/assets/pixel-vehicle-pack](https://kenney.nl/assets/pixel-vehicle-pack) | CC0 1.0 | small sprites, mostly <32×16 | ~45 top-down/angled cars, vans, a bus, bikes | 45 | **Good for parked cars specifically** (FB-0025 named these). More variety than the handful of cars baked into the Modern City pack. Static sprites only, no driving animation -- fine for decoration. |
| **Pixel UI Pack** ✅ downloaded | Kenney / kenney.nl | [kenney.nl/assets/pixel-ui-pack](https://kenney.nl/assets/pixel-ui-pack) | CC0 1.0 | 48×48 9-slice panels | Bordered panels/buttons/cursors in several colourways | ~750 pieces | **Weak as-is.** Flat colours, rounded corners -- a different visual language from the game's cream-border-on-navy, sharp-corner dialog box (see the dialog mockup below). Usable as a *base* to recolour and square off, not a drop-in. |
| **Cool School Tileset** ✅ downloaded | NettySvit | [opengameart.org/content/cool-school-tileset](https://opengameart.org/content/cool-school-tileset) | CC0 1.0 | 48×48 (÷3 → 16×16 exactly) | Teacher desk, student-desk strip, bookshelves, 2-tall lockers, office chairs, whiteboard/screen, computers, books | ~60 pieces | **Content is right, palette is wrong.** Genuinely has the classroom furniture this game's interiors need (desks, lockers, bookshelves) and downscales cleanly (48→16 is an exact ÷3). But it's pastel pink/purple/orange -- a hard clash with the game's sand/salmon/teal campus palette (see interior mockup). Every piece needs recolouring, which the style guide already expects of any adopted pack. |
| Roguelike/RPG Pack | Kenney / kenney.nl | [kenney.nl/assets/roguelike-rpg-pack](https://kenney.nl/assets/roguelike-rpg-pack) | CC0 1.0 | 16×16 | Grass/water/dungeon terrain, medieval buildings (gothic windows, banners, tents, gravestones) | 1,700+ | **Ruled out.** Inspected the sheet directly (`Preview.png`, cropped closeups) -- it's a fantasy/medieval kit (castles, tents, graveyards), flat-shaded with no ramping. Wrong content and wrong mood for a modern university campus. Not downloaded into `assets/vendor/`. |
| Inside School Tileset | drewmanfu | [opengameart.org/content/inside-school-tileset](https://opengameart.org/content/inside-school-tileset) | CC0 1.0 | unspecified | School interior, but only a `.psd` — no exported PNG/tile grid, no dimensions documented | unknown | **Ruled out for now.** Licence is fine but the asset is a single unlabelled Photoshop file with no stated tile size; would need real digging to know what's even in it. Not downloaded. |
| Modern Exteriors / Modern Interiors [16×16] | LimeZu | [limezu.itch.io/modernexteriors](https://limezu.itch.io/modernexteriors), [.../moderninteriors](https://limezu.itch.io/moderninteriors) | **Paid** (~$2.50–5 each, itch.io sale price varies). Custom commercial licence: use in commercial/non-commercial projects, edit freely, **cannot resell or redistribute the raw asset files themselves** | 16×16 | Exactly this: modern building exteriors (concrete, glass, modern roofs), roads, modern interiors (classrooms/offices/labs) in the *exact* tile size and a much closer art style (soft shading, not flat) | large | **By far the best content AND style match I found** -- but it costs money, which conflicts with the project's stated $0 constraint, and I don't have authority to purchase it. Flagging clearly: if the owner is willing to spend roughly $10-15 total for both packs, this is what I'd actually recommend over the CC0 options above. Not downloaded, not purchased. |
| Liberated Pixel Cup (LPC) Base Assets + Universal LPC Spritesheet Character Generator | many contributors, via [lpc.opengameart.org](https://lpc.opengameart.org/) / [liberatedpixelcup.github.io/...-Character-Generator](https://liberatedpixelcup.github.io/Universal-LPC-Spritesheet-Character-Generator/) | CC-BY-SA 3.0 **and/or** GPLv3 (dual-licensed; either satisfies) | 32×32 tiles, 64×64 character frames | Huge breadth: buildings, interiors, terrain, and — most relevantly — a character generator that composes hair/skin/clothing (including pink tops) into a full walk/idle/run sheet, 4+ directions | huge | **Good for characters, wrong scale for tiles.** This is the one real option found for "4-direction walk cycle, pink top, a few students" content — the generator can build exactly that, licence-clean, well-documented, used in many shipped commercial games. But its native canvas is 64×64 per frame vs. this game's 16×16 characters (a 4× difference); tiles are 32×32 vs. this game's 16×16 (2×). Downscaling either loses most of the detail that makes LPC art readable. Also medieval-flavoured overall (LPC's building/terrain tiles are fantasy villages, not concrete campuses) so only the character generator is really relevant here. Not downloaded — see the character recommendation below. |
| 16×16 Character Template — 4 Direction | 5yvalia (itch.io) | [5yvalia.itch.io/16x16-character-template-4-direction](https://5yvalia.itch.io/16x16-character-template-4-direction) | **Ambiguous/excluded.** Page states commercial use is allowed but also that assets "can not be... included in a game or engine... without my permission" — those two statements conflict, and per this task's licence rule ("rule out anything whose licence you can't cite cleanly") it's out. | 16×16, 3 frames/direction | 4-direction character base | — | **Ruled out** on licence ambiguity alone, despite being the right tile size. Not downloaded. |
| Kenney Tiny Dungeon / other Kenney character sets | Kenney | kenney.nl | CC0 | 16×16 | Static single-pose fantasy characters, no multi-frame walk cycle | — | **Ruled out.** Checked; no 4-direction walk-cycle character sheets in Kenney's CC0 catalogue at this tile size, only single static poses meant for a dungeon crawler where characters don't walk on-screen. |

## The honest verdict on style fit

I built three small mockups from the four downloaded packs, at the game's real render scale (16px
tile × zoom 3 = 48px on screen), and looked at them next to the current game. They're saved at:

- `docs/research/asset-pack-preview-outdoor.png` -- lawn, a tree, a hedge, sidewalk with a kerb, a
  road with a crosswalk, and a parked car, all from the Roguelike Modern City pack.
- `docs/research/asset-pack-preview-interior.png` -- a teacher's desk, a bookshelf, a locker and
  three chairs from the Cool School tileset, on a flat floor fill (this pack has no matching floor
  tile of its own).
- `docs/research/asset-pack-preview-dialog.png` -- the Pixel UI Pack's blue 9-slice panel, stretched
  to dialog-box proportions.

**Outdoor:** genuinely better than what FB-0025 is complaining about. The road, kerb and crosswalk
read clearly and don't repeat as an obvious grid the way the current `walkway` tile does; the tree
and hedge are clean, simple, readable shapes. The grass is flatter/less detailed than the current
game's grass ramp, which is a small step backward on its own, but the overall street scene is a
clear net improvement, which is the specific thing that was asked for.

**Interior:** the furniture shapes are exactly right (a desk is obviously a desk, a locker is
obviously a locker) but the palette is a hard clash with this game's warm sand/salmon/teal campus
colours -- pastel pink/purple/orange next to the BITS building interiors would look like a different
game glued on. Usable only after a real recolour pass, not as a drop-in.

**Dialog/UI:** worse than the current dialog box as-is (rounded corners, flat fill, no drop shadow,
generic blue) -- the current hand-drawn dialog box (cream border on navy, pixel-sharp corners,
matches `docs/STYLE_GUIDE.md`) is better today. The UI pack is only useful as cheap raw material
(a resizable bordered rectangle) for a redraw, not as something to use as-is.

## Recommendation

**Use the Roguelike Modern City pack as the primary source for outdoor ground-level tiles** (roads,
kerbs, sidewalks, crosswalks, trees, hedges/bushes, benches/planters, streetlamps), supplemented by
the **Pixel Vehicle Pack** for parked-car variety. Both are CC0, both are already 16×16, both are
already downloaded to `assets/vendor/`.

**Use the Cool School tileset as a furniture reference for interiors**, but plan on a real recolour
pass (per `docs/STYLE_GUIDE.md`'s existing rule: "If a free pack is used, it must be... recolored to
this palette"). It fills a real gap (the game has almost no interior furniture variety today).

**Do not adopt the Pixel UI Pack's look as-is.** Keep the current dialog box; if UI ever needs
outside help, treat this pack as scrap material for borders, not a finished design.

**Leave building exteriors, characters, and UI/dialog art hand-drawn for now.** No CC0/CC-BY pack
found has 3/4-view modern buildings, or a 4-direction 16×16 walk-cycle character set, that's an
actual improvement over what exists. If the owner is willing to spend ~$10-15, LimeZu's Modern
Exteriors + Modern Interiors packs (see table) are a substantially better match than anything free
and would be worth reconsidering; I did not purchase or download them.

**What this set doesn't cover** (still hand-drawn / still a gap after adopting all four packs):
- Building exteriors (BITS/other-building walls, roofs, entrances) -- keep `tools/make-assets.js`'s
  existing drawing for these.
- Interior floors and walls -- Cool School has no plain floor/wall tile; interiors still need the
  game's own `intFloor*` tiles.
- Characters -- player, NPCs, students. No CC0/CC-BY 16×16 walk-cycle pack was found; keep the
  hand-drawn sprites, or revisit the LPC character generator if/when the game ever moves to a bigger
  character canvas (see `docs/STYLE_GUIDE.md`'s note that 16×24 is an option later).
- Tennis/basketball court tiles, signboards, atrium/stairs/lift -- campus-specific, not something a
  generic pack would have; keep hand-drawn.

## What was downloaded

All four packs are in `assets/vendor/<pack-name>/`, each with its own `LICENSE.txt` (the pack's own
licence file) and `SOURCE.txt` (URL, author, licence, download date, and the **sha256 of the original
zip** as downloaded). Total size on disk: **~1.1 MB** (well under the 50 MB budget).

| Folder | Pack | sha256 of original zip |
|---|---|---|
| `assets/vendor/kenney-roguelike-modern-city/` | Roguelike Modern City pack | `ed45d3c0de24e821d71048fd665e3e238ccb49748c5cc520b43c751b39be93a5` |
| `assets/vendor/kenney-pixel-vehicle-pack/` | Pixel Vehicle Pack | `b582163a0f366d8d24821eb763892ac29ff780a011e9b7b42baf86d1f051803f` |
| `assets/vendor/kenney-pixel-ui-pack/` | Pixel UI Pack | `b76f2f60f2be76eb8e66511038fa4d48faec11e638316fa37d06084878cdf0c7` |
| `assets/vendor/cool-school-tileset/` | Cool School Tileset | `fc01a936f8794b1a43a830c4f28309941f52a336456aed577f7f93c5211368dc` |

Each `Spritesheet/spritesheetInfo.txt` (Kenney packs) documents the exact tile pitch/margin. A quirk
worth flagging for whoever integrates this: the Modern City pack's two spritesheet files are named
backwards from what they contain -- `roguelikeCity_transparent.png` is actually opaque RGB with a
magenta background, and `roguelikeCity_magenta.png` is the one with a real alpha channel. Verified by
decoding both files' PNG color type during this research; **use the file named `_magenta.png`** for
anything that needs real transparency.

Nothing was purchased, and nothing requiring a click-through/account was skipped silently -- none of
the four recommended packs needed one.

## Migration plan

This is a plan, not a change -- `tools/make-assets.js` and `src/` are untouched.

### Today's model vs. what a tile pack needs

`tools/make-assets.js` draws every tile as a text-sprite (one character = one pixel) directly into a
generated `tiles.png`, and writes out `tiles.json` as `{ tileSize, columns, tiles: [{name, solid,
overhead, minimapColor}, ...] }` in **drawing order** -- a tile's index in the array is its position
in the 8-column sheet, and every map (`assets/maps/campus.json`, the interior floors) references
tiles **by that numeric index** (Tiled `gid`), not by name. `docs/ARCHITECTURE.md`'s "content is
data" rule and the existing 144-tile catalog (`assets/tiles.json`) both assume this: add tiles at the
end, never reorder, never remove.

To pull tiles from an external pack, `make-assets.js` needs two new things instead of (not
necessarily replacing) the per-pixel drawing:
1. **An atlas loader**: read a vendor pack's PNG once, and instead of `img.draw(rows, ox, oy)`
   (pixel-by-pixel), copy a rectangular region from the vendor sheet at a given `(srcX, srcY)` into
   the tile's slot in `tiles.png`. A single small function (`blitFromAtlas(destImg, destX, destY,
   atlasImg, srcX, srcY, w, h)`) covers this; the PNG decode needed already exists as prior art in
   this research (`decode.js`, not committed -- would need a small clean version added to
   `tools/lib/`, since the current `tools/lib/png.js` only *encodes*).
2. **A name → source-rect map**, one entry per adopted tile, e.g. `{ name: 'walkway', atlas:
   'kenney-roguelike-modern-city', srcX: 0, srcY: 340, w: 16, h: 16 }`. This is a data table, not
   code, so it lives alongside `PALETTE` in `make-assets.js` or in its own small JSON/JS file.

### Tile-name mapping (existing names -> pack source), for the tiles this survey found a fit for

| Existing tile name | Source | Note |
|---|---|---|
| `walkway` | Modern City, sidewalk paver (any of the 3 materials) | The specific FB-0006/FB-0014 complaint (repeats as a grid) -- the pack's paver has more internal texture per tile, repeats less obviously |
| `kerbT`/`kerbB`/`kerbL`/`kerbR`/corners | Modern City, kerb-edge paver variant | Pack draws the highlight on one edge only per tile; the existing 8-piece kerb-loop system in `layout.js`/`build-campus.js` would need re-checking against which edge the pack's highlight is on, likely needs 4 rotations generated from 1 source tile |
| `asphalt`, `roadLineH`/`roadLineV` | Modern City, plain asphalt + lane-marking variants | Direct swap |
| `crossingH`/`crossingV` | Modern City, crosswalk stripe tiles | Direct swap |
| `treeCanopyTL/TR/BL/BR` + `treeTrunk` | Modern City, round tree (single-tile canopy, not a 2×2 quad) | **Not a direct swap** -- pack trees are one tile, this game's trees are a 2×2 overhead canopy over a ground trunk. Either accept a smaller single-tile tree (simpler, loses the "walk behind it" depth cue) or keep the hand-drawn tree and only replace hedges/paths |
| `hedge`, `bush` | Modern City, hedge/bush tiles | Direct swap |
| `lawn`/`lawn2`/`grass`/`grass2` | Modern City, flat grass tiles | Direct swap, but see the honest note above: flatter than today's ramped grass, a small step down in isolation even though the overall scene reads better |
| new: parked cars | Pixel Vehicle Pack | New content, not a replacement -- add as decorative (non-solid or solid, owner's call) objects in `build-campus.js`'s parking areas |
| `intDesk`/`intTeacherDesk` | Cool School, desk tiles | Needs recolour pass first |
| `intCabinet`, lockers | Cool School, locker tile | Needs recolour pass first |
| `bookshelf` | Cool School, bookshelf tile | Needs recolour pass first |

Everything else in the 144-tile catalog (buildings, courts, interior floors, doors/stairs, signboard,
fences) has **no pack replacement found** and stays hand-drawn as-is.

### How existing maps survive

Unaffected either way, by design: `campus.json` and the interior floor JSONs reference tiles by
**index**, and `tools/campus/layout.js` / interior layout files reference tiles by **name** (resolved
to an index at build time). Swapping a tile's *pixels* (whether hand-drawn or copied from a vendor
atlas) without changing its name, its position in `tiles.json`, or its `solid`/`overhead` flags is
invisible to every map file and every test that doesn't screenshot-diff pixels. The only tests at
risk are the QA screenshots (`qa-shots/`, compared by eye, not asserted in `npm test`) -- expect those
to need a fresh set after any real swap, which is expected and already how visual changes are
reviewed per `docs/QA_PLAN.md`.

### Task breakdown (each sized for one work session)

1. **Add a minimal PNG decoder to `tools/lib/`** (`tools/lib/png.js` currently only encodes) so
   `make-assets.js` can read vendor atlas PNGs. Small, self-contained, no dependencies (this research
   already proved the approach in a throwaway script).
2. **Add the atlas-blit helper + name→source-rect table to `make-assets.js`**, wired for just
   `walkway` + the 8 kerb pieces + `asphalt`/`roadLineH`/`roadLineV`/`crossingH`/`crossingV` (the
   FB-0006/FB-0014 complaint tiles specifically). Regenerate, screenshot, compare to today's
   `qa-shots/outdoor-d54.png` and `outdoor-avenue.png`.
3. **Swap `hedge`/`bush`/`lawn`/`lawn2`/`grass`/`grass2`** the same way. Screenshot-compare against
   `qa-shots/outdoor-diac-park.png`.
4. **Decide on trees**: either accept a single-tile Modern City tree (simplifies `layout.js`'s
   tree-placement code, since it drops the trunk+2×2-canopy dance) or keep the current hand-drawn
   tree and stop here for outdoor tiles. This needs the owner's call since it changes how trees read
   during walk-behind, a named style-guide feature.
5. **Add parked cars** from the Pixel Vehicle Pack as new decorative objects in
   `tools/campus/build-campus.js`'s parking-lot placement, a few colors scattered for variety. New
   content, lowest risk.
6. **Recolour a first interior furniture set from Cool School** (desk, one locker, one bookshelf) to
   the existing wood/carpet ramps in `PALETTE`, add as new tile names (`intDeskV2` or similar, don't
   overwrite the existing plain `intDesk` until compared side-by-side in a real room).
   Screenshot-compare against an existing classroom (`qa-shots/indoor-main-block-*-classroom*.png`).
7. **(Optional, owner decision required first)** If the owner approves spending ~$10-15, redo this
   whole survey's outdoor+interior recommendation against LimeZu's Modern Exteriors/Interiors packs
   instead -- likely fewer, smaller tasks than 1-6 above since the style needs no recolouring.

Each of 2-6 above should regenerate `assets/tiles.png`/`tiles.json` via `npm run assets`, run
`npm test`, and get a fresh `npm run qa:shots` pass before being considered done, per
`docs/TESTING.md` and this repo's normal "done" bar.
