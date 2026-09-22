# Style guide

**Status:** v1, approved by the owner on 2026-09-13. Every new tile, sprite and UI element follows it.
Change it deliberately: edit this file and note why in MEMORY.md.

## The target look

**Top-down Pokémon from the DS era, bright and cheerful, with depth.** It should read as a little 3D
world seen from above at an angle, not as flat stickers on a grid.

What creates the 3D feel (every asset must respect these):

1. **One light source, top-left.** Highlights go on top and left edges, shadows on bottom and
   right edges. Never mix light directions.
2. **3/4 view.** Show the top *and* the front face of anything with height: building walls under
   roofs, the front face of cliffs and ledges, table legs, the sides of rocks.
3. **Drop shadows.** Every character, item and freestanding object gets a soft shadow on the
   ground (an ellipse, black at 25% opacity, offset slightly down).
4. **Layering.** Tall things are split into a *base* (drawn under the player, has collision) and a
   *top* (drawn over the player, no collision). Walking behind a tree canopy or roof edge is what
   sells the depth.
5. **Depth sorting.** Characters and objects are drawn in order of their feet's y-position.
6. **Ramps, not flat fills.** Every material uses a 3–4 tone ramp: highlight, base, shadow, deep
   shadow. Shift the hue slightly along the ramp (warmer highlights, cooler shadows), not just the
   brightness.
7. **Gentle life.** Water shimmers, flowers sway, tall grass rustles when walked through, and NPCs
   bob or blink when idle. Keep it subtle: 2–4 frames, slow.

## Grid and sizes

| Thing | Size | Notes |
|---|---|---|
| Map tile | 16×16 | Everything aligns to it |
| Character | 16×24 | [ADR 0013](../decisions/0013-characters-are-16x24-from-the-pack.md), 2026-09-21: moved from 16×16 (the 2026-09-13 decision noted this as an option later) so the vendor pack's characters (below) don't need their hair cropped. `CHAR_HEIGHT` in `src/state.js`. |
| Item icon | 16×16 | Shown at 3× in the UI |
| Building | multiples of 16 | Roof overhangs the walls by one tile-row |
| World camera | zoom 3 | 320×180 world pixels visible |
| UI canvas | 960×540 | UI is drawn unzoomed, sizes below |

## Palette

Bright and saturated, but each ramp keeps its darkest tone dark enough to hold shape. The current
palette lives in `tools/make-assets.js` (`PALETTE`). Use these ramps and don't invent new colors
per sprite. If a new color is really needed, add it to the palette and to this table.

| Material | Highlight | Base | Shadow | Deep |
|---|---|---|---|---|
| Grass | `#8fd46a` | `#5ab552` | `#3d8a3f` | `#2b6b30` |
| Leaves | `#4fa34a` | `#2f7a3a` | `#1f5227` | `#1a1c2c` |
| Water | `#9fd3ff` | `#3b7dd8` | `#2a5aa8` | `#1f3f7a` |
| Dirt path | `#e0c290` | `#c8a26b` | `#a07c4a` | `#7a5a33` |
| Stone | `#c8c8c8` | `#9a9a9a` | `#6b6b6b` | `#4a4a55` |
| Wood | `#cf9a66` | `#b98150` | `#7a4a24` | `#5a3418` |
| Roof (red) | `#d9774f` | `#b5543a` | `#8a3b2a` | `#5e2a20` |
| Plaster wall | `#f5ead0` | `#eadbb8` | `#c9ae80` | `#9c845c` |
| Skin | `#ffe0c4` | `#f4c9a0` | `#d49a6a` | `#a86f45` |
| Accent gold | `#fff1a8` | `#ffd23f` | `#e0b84f` | `#a8812a` |
| Outline | | `#1a1c2c` | | |

## Outlines

- **Characters, items, props and buildings:** 1px outline in `#1a1c2c`. Where the outline sits
  against the object's own light side, it may use the deep tone of that material instead
  (selective outlining). This makes things pop off the ground, as Pokémon sprites do.
- **Ground tiles (grass, path, water, floors):** no outlines. Edges come from shading and
  transition tiles.
- **Never** use pure black `#000000` in art.

## Characters

Rewritten 2026-09-21 ([ADR 0013](../decisions/0013-characters-are-16x24-from-the-pack.md), FB-0025):
the player and the campus NPCs are now recolored crops of LimeZu's Modern Interiors Free character
pack (`assets/vendor/limezu-modern-interiors-free/`, also used for interiors per ADR 0012), built by
`tools/make-assets.js`'s "characters" section, never a hand-edited PNG.

- **Frame:** 16×24 (was 16×16). Sheet layout: one row per direction, **down, up, left** (right =
  mirrored left, unchanged convention). Columns: **idle, 6 walk frames, 1 idle-anim frame** (8 total
  per row) -- `CHAR_COLS` in both `tools/make-assets.js` and `src/scenes/world.js`.
- **Walk cycle:** 6 real motion frames at 12fps, taken directly from the vendor pack's own run sheet
  (leg stride and arm swing, not a hand-drawn 3-pose bounce).
- **Idle animation:** alternates the static idle frame with one frame from the pack's `idle_anim`
  sheet, 2fps, so the player blinks/breathes instead of freezing on a single frame -- the "gentle
  life" rule below, now actually implemented for the player.
- Big readable head, a distinct hair/clothing color per character so each is recognisable on the
  minimap and in a crowd (the whole reason each NPC below got its own recolor, not a shared one).
- **The player is the female lead** (owner decision 2026-09-13, palette unchanged): a recolored
  Amelia -- black hair `#2a1c14`, fair skin `#f4c9a0`/`#d49a6a`, a hot pink top `#ff6fb1`/`#d94b8f`
  and a lighter pink skirt `#ff7eb6`. Built in `tools/make-assets.js` (`AMELIA_RECOLOR`,
  `buildCharacter`). No other character wears the same pink.
- **Campus NPCs** (new, FB-0025): recolors of the pack's other three named characters, same frame
  layout as the player, selected per-NPC by a `character` field in the NPC's map data
  (`src/maps.js`, resolved to a texture in `src/scenes/world.js` `createNpcs()`):
  - **LUG volunteer** (Adam): teal polo (`#2f9e8f`/`#4fc2ae`), his own hair/skin untouched.
  - **Background student A** (Alex): plain blue shirt (reuses `PALETTE.B`), his own hair/vest untouched.
  - **Background student B** (Bob): mustard/gold blazer (this file's own Accent gold ramp, below),
    his own hair/skin untouched.
  - Demonstrated today as fixtures on the meadow test map (plain placeholder chat); real campus
    placement is a follow-up task.
- **Tomas** (the meadow/house test-map NPC) keeps his original hand-drawn art, unchanged --
  ADR 0013 scoped this pass to the lead and the campus NPCs. His sprite is just bottom-aligned into
  the new 16×24 canvas so every character shares one frame size.
- NPCs get an idle animation (blink or bob) so they don't look frozen -- see above.

## M3a opening art (owner brief, 2026-09-21, docs/STORY.md "Opening")

- **Clothes-color customisation:** `tools/make-assets.js` `CLOTHES_SWATCHES` -- one full recolored
  character sheet per swatch (`player-<id>.png`: pink [default, unchanged from the 2026-09-13 brief],
  sky, mint, lavender, sunset), built the same exact-RGB-swap way as the campus NPC recolors, just
  swapping the top/skirt colors instead of leaving them alone. Hair and skin are not customisable yet
  (see the code comment by `CLOTHES_SWATCHES` for the cost/benefit judgment call). Picked on the
  `customize` intro scene, saved in `GameState.customization.clothes`, loaded as the game's real
  `player` texture by `src/main.js` BootScene.
- **Mustafa's portrait:** `tools/make-cutscenes.js` `buildPortrait()` → `assets/cutscenes/mustafa.png`,
  96x128. A friendly, generic young man (brown hair, a blue collared shirt) -- original art, not a
  likeness of anyone, per CLAUDE.md's "no real people" rule.
  Shown beside the game's own dialog box on the `greeting` and `name-entry` intro scenes.
- **The arrival bus:** `tools/make-cutscenes.js` `buildBus()` → `assets/cutscenes/bus.png`, 96x48, a
  side-view coach with a distinct door panel (its own outlined section, so the `bus-arrival` intro
  scene has a real spot to animate "the door opens" over).
- **Title screen parallax foreground:** `tools/make-cutscenes.js` `buildTitleForeground()` →
  `assets/cutscenes/title-fg.png`, 480x64, a tileable palm/fence silhouette strip scrolled behind the
  title menu at its own speed (docs/GAME_FEEL.md "a little 3D" rule 3).
- **The Main Block entrance cutscene:** `tools/make-cutscenes.js` `buildEntrance()` →
  `assets/cutscenes/entrance.png`, 320x240, a closer view than the Gate 2 illustration -- steps,
  corner pillars, the glass front under the red arch -- with the same forced-perspective road/step
  technique the gate scene already used. Triggered by a map object exactly like Gate 2's own trigger
  (tools/campus/build-campus.js section 17), the first time she reaches the Main Block's real door.

## Speech bubbles and interaction

| Bubble | When | Look |
|---|---|---|
| **E key** | Player is in range of something interactable | White keycap with an outline, bobs 1px |
| **!** | NPC has something *new* to say (a clue, a quest step) | Gold "!" bubble, gentle pulse |
| **?** | NPC is waiting for you to finish something | White "?" bubble |
| **…** | Ordinary chatter already heard | Small grey bubble, only when in range |

Bubbles are drawn in the world (they move with the character) above the head, on the topmost layer.

## UI

- **Font:** "Press Start 2P" (free, Open Font License). Sizes 8, 12, 16, 24 only.
- **Panels:** navy `#1a1c2c` at 92% opacity, 4px cream border `#eadbb8`, 4px drop shadow.
- **Colors:** body text `#f4f4f4`, secondary `#9aa0b0`, highlight/selected `#ffd23f`,
  success `#8fd46a`, danger `#ff5a5a`.
- **Screen layout** (16px margin from the edges):

```
┌───────────────────────────────────────────────┐
│ [minimap]                   [quest / tutorial]│
│                                               │
│                  toasts                       │
│                                               │
│         [hotbar]  or  [dialog box]            │
└───────────────────────────────────────────────┘
```

- Dialog: name tag top-left of the box, typewriter text at 45 chars/sec, blinking ▼ when the line is
  done, at most 3 lines per page.
- Every key shown in the UI is written in CAPITALS (E, M, ESC).

## Motion

- Map change: 250ms fade to black and back.
- Pickups: bob 3px up and down, 1.4s loop. On pickup, float up and fade in 250ms.
- Toasts: appear instantly, hold 1.4s, fade up over 0.5s.
- Nothing flashes faster than 3 times a second.

## Campus kit

Added 2026-09-13 for the campus art pass (FB-0006, FB-0011, FB-0014, FB-0015, FB-0016). The tiles
are generated by `tools/make-assets.js` (see the "campus kit additions" section near the bottom)
into `assets/tiles.png` / `assets/tiles.json`; a labelled catalog with mock scenes is at
[research/campus-tile-kit.png](research/campus-tile-kit.png). The 44 original campus/house/outdoor
tiles keep their names, positions and `solid` behaviour; everything below is appended after them,
so map tile indices never shift.

### The `overhead` tile property

`tiles.json` now carries `overhead: true/false` on every tile, alongside `solid`. An overhead tile
is meant for a layer drawn *above* the player (a tree canopy, for example) rather than the ground/
structures layers drawn at the player's depth. Overhead tiles are never solid: they're decoration
over whatever is underneath. No renderer reads this yet; it's data for the layout rebuild (ADR 0008)
to wire into an above-player layer.

### Roads, kerbs and paths (FB-0014, art replaced by FB-0025)

- `kerbT` / `kerbB` / `kerbL` / `kerbR`: the border of a road or path rectangle on that side of the
  tile — a paved sidewalk band with a black-and-white gutter line, asphalt filling the rest of the
  road. `kerbTL` / `kerbTR` / `kerbBL` / `kerbBR`: the corners, where two borders meet. Combine all
  eight around a rectangle of `asphalt` to get a road with kerbs and a raised pavement on every side.
  **Art source (FB-0025):** the Kenney Roguelike Modern City pack's sidewalk-paver-with-gutter-line
  tile, rotated a quarter turn per side (corners overlay both sides' gutter-line bands on a plain
  paver base) — see `tools/make-assets.js` `atlasKerbEdge`/`PACK.kerbPaver`.
- `roadLineH` / `roadLineV`: a short dashed lane marking on asphalt, for a horizontal or vertical
  road. **Art source:** the pack's lane-dash tile (`PACK.laneDash`), `roadLineV` is the same source
  rotated 90°.
- `crossingH` / `crossingV`: a zebra crossing band (stripes run perpendicular to the road so a
  horizontal road gets `crossingH`, a vertical one `crossingV`). **Art source:** the pack's crosswalk
  tile (`PACK.crosswalk`), `crossingV` rotated 90° from the same source.
- `walkway`: a brick path with a light stone edge on its long (north/south) sides only, so a run of
  walkway tiles reads as one continuous bordered path across lawn or sand — the border doesn't
  repeat at the seam between two tiles, which would look like a flat grid (the thing FB-0006 and
  FB-0014 both flagged). Best suited to paths running roughly east–west; a north–south path shows
  the border on the wrong sides until a rotated variant is added. **Art source:** the pack's plain
  paver tile (`PACK.plainPaver`) for the brick fill; the top/bottom stone-edge rows stay hand-drawn
  (unchanged design, just re-fed with pack texture underneath).
- `parking`: parking-bay ground. **Art source:** the pack's plain asphalt (`PACK.asphalt`, same as
  the `asphalt` tile) for the base, but the stall-divider line stays the original hand-drawn single
  white column (`PACK.parkingPaint`, a two-bar stall-paint tile, is in `PACK` but *not* used here --
  tiled across a whole lot its two bars line up into a wall-to-wall horizontal ladder that reads as
  crosswalk stripes covering the entire lot, not individual stalls; worse than the original, so kept
  hand-drawn instead. See the `parkingBay` function).
- `paving` (existing name, redrawn for FB-0006): **kept hand-drawn** — brick pavers with a highlight
  on each brick's top-left edge and a shadow on its bottom-right edge, per the light-from-top-left
  rule, plus mortar joints — four tones, not a flat fill. Not in FB-0025's swap list (only
  `walkway`/kerbs/roads were named), and no pack tile was a clear improvement over it.
- Every pack tile above is recolored onto this game's *existing* palette ramps (asphalt `3`/`4`,
  paving `7`/`8`/`-`, plus black/white for the kerb line) rather than kept in the pack's own colors
  — `tools/make-assets.js`'s `remapRoad`/`remapPaver` bucket each source pixel by luminance onto
  those ramps, so the pack art doesn't sit next to the hand-drawn buildings looking like a different
  game's tileset. No new palette colors were needed.

### Green campus (FB-0015, grass/bush art replaced by FB-0025, greenery re-sourced to Sprout Lands 2026-09-21)

**Ground fill stays Kenney; everything planted on top of it is now Sprout Lands.** ADR 0012's table
assigns outdoor greenery (trees, bushes, flowers, grass detail) to the Sprout Lands Basic pack
(`assets/vendor/sprout-lands-basic/`, non-commercial + credit required, credited in `CREDITS.md`).
That swap is now wired in for the *objects* below; `lawn`/`lawn2`/`grass`/`grass2` (the flat ground
fill itself, not "outdoor greenery" in the sense of a planted object) stay Kenney's `PACK.grass` --
they already match the roads/kerbs they sit next to, and re-sourcing a flat fill wasn't what FB-0025
or the addendum asked for.

**A new, more muted recolor ramp** (`remapDryLeaves` in `tools/make-assets.js`, three stops:
`#33501f` / `#4f7a30` / `#6fae4a`) replaces the old bright `remapLeaves` ramp (`#1f5227`/`#2f7a3a`/
`#4fa34a`) for everything below: the owner's brief for this pass asked for "Dubai-dry greens rather
than lush farm green" specifically because Sprout Lands' own native palette *is* bright farm-green.
The ramp centers on the campus lawn's own tone (`#6FAE4A`) rather than a saturated highlight, so
hedges/bushes/tree canopies read as dry, planted campus greenery next to Kenney's flatter roads
instead of a lush farm dropped onto a university. `outlineBelow` is raised to 95 (not the usual 60)
because Sprout Lands outlines its own shapes in a dark *purple*-tinted green (~lum 77), not
near-black -- checked by decoding the sheet directly, not assumed.

- `lawn`, `lawn2`: unchanged from the FB-0025 pass -- Kenney's flat grass fill (`PACK.grass`),
  recolored onto the existing (brighter) Grass ramp; `lawn2` adds one small Sprout Lands grass-tuft
  sprite (`SPROUT.tuft`, recolored onto the new dry ramp) at a randomized spot instead of the old
  loose dark-pixel scatter, so it reads as a little planted tuft instead of a few stray dots.
- `hedge`: **now Sprout Lands** (`SPROUT.hedge`), replacing the hand-drawn clipped-hedge art. The
  pack has no purpose-built tileable hedge run, so this crops the *flattest, fullest-height*
  cross-section of one of its long oval bush sprites (`Basic_Grass_Biom_things.png`, decoded and
  measured column-by-column for full-height opacity at both edges) -- "extend one piece" per the
  addendum's own suggested approach, rather than a run of dedicated cap/middle/end pieces. Tested
  (`campus-tiles.test.js` "hedges tile seamlessly") for no fully-transparent edge column, so a run of
  `hedge` tiles reads as one continuous row with no gap at the seam between tiles. A Kenney grass
  undercoat goes down first (same source as `lawn`), matching `bush`'s own base-then-blob composition.
- `bush`: **now Sprout Lands** (`SPROUT.bush`, the plain -- no-berry -- half of a round double-bush
  sprite), replacing the Modern City pack's round clipped shrub, over the same Kenney grass undercoat.
- `flowerbed`: the brick-edged planter frame **stays hand-drawn** (no pack has a matching plain
  soil/brick box), but its three flowers are now Sprout Lands' own pink rose-on-a-leafy-tuft sprite
  (`SPROUT.flower`, scaled down 2x, green-only recolored via `remapGreenOnly` so the pink petals keep
  their own pack color and only the leafy base gets pulled onto the dry ramp) instead of three
  hand-drawn dots.
- Trees are split into a solid trunk (ground level, drawn like any other object) and a 2×2 overhead
  canopy above it (drawn on the above-player layer — see `overhead` above):
  - `treeTrunk` + `treeCanopyTL` / `treeCanopyTR` / `treeCanopyBL` / `treeCanopyBR`: a round shade
    tree. **The canopy fill is now Sprout Lands** (`SPROUT.treeCanopy`, a complete, plain, no-fruit
    round tree found among several in `Basic_Grass_Biom_things.png` and cropped just above where its
    own trunk begins, so no brown trunk pixel ever enters the green-only recolor) -- `treeTrunk`
    itself stays the original hand-drawn brown box; only the leafy fill changed. The *shape* (the
    ellipse-plus-skirt silhouette, the 1px outline, the FB-0019 trunk-touching fix) is completely
    unchanged -- `canopyQuadrantFromAtlas` (`tools/make-assets.js`) reuses the exact same shape
    function as before and only swaps where the *fill color* comes from, sampling the recolored pack
    art through the same silhouette instead of a flat 3-tone hand-picked ramp. This is deliberate:
    STYLE_GUIDE's own "Trees and palms: kept hand-drawn" section below (unchanged since FB-0025)
    explains why the pack's own single-tile tree art can't just replace the 2x2 trunk+canopy split --
    that reasoning still holds, so this pass keeps *our* shape and only recolors *its* fill.
  - `palmTrunk` + `palmCanopyTL` / `palmCanopyTR` / `palmCanopyBL` / `palmCanopyBR`: a date palm,
    fronds radiating from the crown. **Stays hand-drawn** -- Sprout Lands has no date palm, the one
    tree type it has nothing suitable for -- but its frond palette keys (`:`/`;` in `PALETTE`) were
    retuned to the same new dry-green ramp above, so a palm standing next to a recolored round tree or
    hedge doesn't clash (the specific "must match the new style" bar this pass set for anything left
    hand-drawn).
  - The trunk tile sits directly below the canopy quad. Canopy tiles are transparent outside the
    tree's silhouette, so the ground/trunk show through around the edges.

### Tennis court (FB-0016)

A standard court is **18×9 tiles** (36×18 m at 2 m/tile, including run-off), built from `court`
(surface) plus:

- `courtLineH` / `courtLineV`: a straight white line (baseline, sideline or service line) across the
  tile, horizontal or vertical.
- `courtCornerTL` / `courtCornerTR` / `courtCornerBL` / `courtCornerBR`: right-angle joins where a
  sideline meets a baseline.
- `courtCenterMark`: a baseline tile with the small centre-mark tick.
- `courtNet` / `courtNetPostT` / `courtNetPostB`: the net across the middle — a thin (2 px) line
  down a single column, with a small post where it meets the top/bottom sideline (`courtNetPostT`/
  `courtNetPostB`; the plain `courtNet` tiles between them have no post). Redrawn for FB-0020: it
  used to fill two whole tiles edge to edge with dark stripes, which read as an unexplained thick
  block rather than a net. Visual only (not solid), so it doesn't block the run-off either side.

Arrangement (columns 0–17, rows 0–8; documented as a comment above the tennis-court tiles in
`tools/make-assets.js` and used as-is in the catalog's mock scene):

| Row/col | What |
|---|---|
| Row 1, cols 3–14 | top sideline (`courtLineH`) |
| Row 7, cols 3–14 | bottom sideline (`courtLineH`) |
| Col 2, rows 2–6 | left baseline (`courtLineV`) |
| Col 15, rows 2–6 | right baseline (`courtLineV`) |
| Col 5 / col 12, rows 2–6 | service lines (`courtLineV`) |
| Col 8, row 2 / row 6 | the net where it meets the sideline (`courtNetPostT`/`courtNetPostB`) |
| Col 8, rows 3–5 | the net (`courtNet`) |
| Row 4, cols 6–7 and 10–11 | centre service line either side of the net (`courtLineH`) |
| Row 1/7 × col 2/15 | the four corners (`courtCornerTL/TR/BL/BR`) |
| Row 4 × col 2/15 | centre marks (`courtCenterMark`) |
| Everywhere else inside cols 2–15, rows 1–7 | `court` |
| Outside that rectangle | run-off (whatever ground the court sits on) plus a hedge one tile further
  out, and a green apron in between (ADR 0009: bare sand around the court read oddly) |

### How our buildings are built (BITS building kit addendum, 2026-09-21)

The owner declined LimeZu's paid Modern Exteriors pack: *"we are trying to build the BITS building,
not those drop-in ones, we would have to edit anyway, so understand how he makes it, copy and
paste."* This section is that study, written from decoding LimeZu's own **Room Builder** sheet
(`assets/vendor/limezu-modern-interiors-free/Modern tiles_Free/Interiors_free/16x16/
Room_Builder_free_16x16.png`, already in use for interiors per ADR 0012) and `free_overview.png`
pixel-by-pixel, not guessed from a thumbnail.

**What the wall swatches actually are:** every wall colorway on that sheet is a pure horizontal
band -- there is no per-pixel brick/panel texture at all, just flat color rows, decoded and confirmed
column-by-column (every column in a given row is identical). The bands, top to bottom:

1. A 1px dark navy outline (`#3a3a50` in the pack) along the tile's top edge and both side edges.
2. On the **top course** (the wall row that meets the ceiling/roofline): a light "coving" band
   (about a quarter of the tile's height), then a 1-2px colored trim line, then the body fill.
3. On a **repeat/lower course**: the body fill, with one or two thin darker "shadow" bands part-way
   down (a groove line, not a full shade change) breaking up an otherwise flat fill.
4. At the very **base** (the row that meets the floor): a distinct *cool grey-blue* sliver, not just
   a darker version of the wall's own warm trim -- a genuinely different hue, a "kick plate".

**Windows** are a separate multi-tile module (`Interiors_free_16x16.png`, decoded separately): a
warm wood-toned frame post on each side, the glass itself carrying horizontal light/dark banding
(not a flat fill -- it reads as catching light), and a light sill/valance band where the frame meets
the wall below it. **Doors** are a single unit: a warm wood panel with a darker recessed inset and a
small round handle.

**The rules this game's own BITS kit now follows, copied from that method:**

- A wall run's top course gets a light band + trim line before the body (`bitsWallPlain`'s `wallHi`
  + `&` rows) -- this game already had a cornice line here (FB-0011); this pass makes the light band
  itself genuinely lighter and adds the coving proportion the pack uses.
- The base course gets a **cool, different-hue** sliver (`baseCool`, `#6b7280`), not a darker shade
  of the wall's own trim -- previously the base course reused the same `%` shade tone as everywhere
  else, which is exactly the "just darker, not a different material" gap the pack's own base doesn't
  have.
- Windows get their own frame + fill, kept as two small punched-out windows per tile (FB-0011's own
  fix for "one big window reads as a band of glass," which still holds and isn't revisited here).
- A building's front door/entrance gets **steps**: a light stone tread + a shadowed riser at its very
  base (`bitsEntrance`'s bottom two rows, reusing this game's own paving-bevel highlight/shadow
  tones so the steps read as the same material as the plaza in front of them, not a new material).
- Corners stay this game's own existing solution (a uniformly darker side face, `bitsWallEndL/R`) --
  the pack's own sheet doesn't show a building corner at all (it's an interior kit), so there was
  nothing to copy there; the 3/4-view "shadowed side face" rule (this file's own "Layering" section)
  already covers it.
- The Main Block specifically gets a real **red arch** (`archRed`, `#9c3a28`) across its 2-tile
  entrance instead of the ordinary thin salmon trim -- the one building confirmed from real photos as
  "glass front under a red arch" (docs/research/bits-dubai-campus.md "Look (from photos)"). Two
  dedicated tile names (`bitsEntranceGrandL`/`bitsEntranceGrandR`) carry this so ordinary buildings
  (Library, Mechanical, hostels) keep the plain entrance look -- `tools/campus/layout.js`'s
  `grand: true` on the Main Block's own entry picks which one `tools/campus/build-campus.js` uses.
  **Routing never paints over a wall, and the front reads as a building, not a roof plain
  (2026-09-21 coordinator review):** the entrance avenue and walkway-network junctions used to be
  drawn *after* the building (`tools/campus/build-campus.js` sections 11-12) and reached right up to
  the door, painting asphalt back over a stretch of wall either side of the entrance -- at zoom 3
  (about 20x11 tiles on screen) a wide roof with a 2-tile door floating in a grey field never read as
  a building at all. Fixed two ways:
  - A `wallOwner` ownership grid (parallel to the existing `roofOwner`) now marks every cell a
    building's wall or entrance occupies, and the avenue/crossing/parking-spur paving (`paveRectFrame`)
    refuses to paint over it, the same way it already refused to paint over a roof. The pedestrian
    walkway network (`connectWalkway`) is the one exception (`crossWalls: true`, threaded through
    `fillRectFrame`/`connectRect`): it's allowed to cross a wall band if that's the only way to keep a
    building connected, matching how the network already behaved before the wall got deeper.
  - The player-facing side of a BITS building (its widest wall run with a clear approach, found by
    `clearSpan`) is now drawn `FRONT_WALL_TILES` (4) tiles deep instead of 2, with one dedicated tile
    per band -- cap, window, body, base (`tools/make-assets.js`'s `bitsFacade*` tiles) -- so standing
    at the front shows an actual wall with windows, not a sliver of wall dwarfed by roof texture.
    Every other wall run of the same building (sides/back) keeps the original, shallower `b.wallTiles`
    depth: deepening every run started colliding with close neighbours across the whole campus, and
    the player rarely sees a side wall anyway. A building wedged close enough to a neighbour that
    *no* run has 6+ clear tiles at depth 4 (found for one of the two OSM rectangles that make up
    "Hostel C" -- literally flush against its own other wing) falls back to depth 3, the shallowest
    that still fits a window row, before giving up on a facade for that run entirely.

**What's reused from the pack directly vs. what's our own drawing in the pack's style:** the actual
wall/window pieces turned out to be near-flat color bands with no fine texture worth blitting
pixel-for-pixel (confirmed by decoding, above) -- so "copy and paste" here means *the construction
method and band proportions*, drawn with this game's own palette, rather than literal pixel copies
that would carry no more information than a flat fill already does. This mirrors how the outdoor
tile swap in the previous FB-0025 pass worked (blit real pack pixels where the pack has real texture
to offer, e.g. the kerb/paver tiles; draw our own where a pack turns out to be flat or missing).

### Buildings (FB-0011, entrance/steps/arch extended by the addendum above)

One big window per tile made every row of a building read as a solid band of glass. Walls now have
two small windows per tile instead, plus the pieces needed to build a proper front with a parapet
roof, corners and an entrance:

- `bitsWallPlain` / `bitsWall` (redrawn again by the addendum above): plain wall vs. wall with two
  small windows, now with the full banded ramp -- outline, light cap, trim line, body + panel line,
  shadow line, cool baseboard -- instead of just a cornice + one dark base band.
- `bitsWallEndL` / `bitsWallEndR`: the wall turning a corner (a darker side face, in shadow).
- `bitsRoof` (existing, unchanged fill) plus `bitsRoofT` / `bitsRoofL` / `bitsRoofR` / `bitsRoofTL` /
  `bitsRoofTR`: parapet edge pieces, so a roof reads as having a raised edge instead of a flat tint.
- `bitsEntranceL` / `bitsEntranceR`: a 2-tile-wide glass entrance with light stone steps at its base
  (`bitsDoor`, the existing single-tile door, keeps working for the current generator's one-tile
  doors). `bitsEntranceGrandL` / `bitsEntranceGrandR`: the Main Block's own red-arch variant, see
  the addendum above.
- `bitsPillar`: a decorative column for a colonnade entrance, redrawn with the same outline/trim/base
  banding as the wall.
- `otherWallPlain` / `otherWall` (existing, redrawn to match), `otherWallEndL` / `otherWallEndR`,
  `otherRoof` (existing) plus `otherRoofT` / `otherRoofL` / `otherRoofR` / `otherRoofTL` /
  `otherRoofTR`: the same kit in the other-buildings' grey/white palette -- **not** touched by this
  addendum (it's used only by non-BITS neighbours, not the Main/Library/Mechanical Blocks or hostels).
- Every BITS-style building's front run now gets the full entrance treatment (glass + steps, flanked
  by pillars and a signboard) in `tools/campus/build-campus.js`'s `drawBuilding` -- previously gated
  on a building having a working interior door (`b.door`), so hostels (no interior yet) fell through
  to a plain wall/window run where a real front door should read. The *interactive* door trigger
  stays exclusive to buildings with a real interior to link to (Main/Library/Mechanical); hostels get
  the entrance *look* only, not a working door with nowhere to send the player.

### Fence kit

`fence` (existing name, unchanged) plus a directional kit: `fenceH` / `fenceV` (straight runs),
`fenceCornerTL` / `fenceCornerTR` / `fenceCornerBL` / `fenceCornerBR` (corners), and `fenceGate` (a
walkable opening between two posts, `solid: false`, unlike the rest of the fence kit).

### Signboard (ADR 0009)

`signboard`: a small post-mounted sign on lawn, solid, placed in front of each named BITS
building's entrance by `tools/campus/build-campus.js`.

### Tree/palm canopy fix (FB-0019, ADR 0009)

The round tree canopy (`treeCanopyTL/TR/BL/BR`) and the date palm canopy (`palmCanopyTL/TR/BL/BR`)
used to leave a visible gap above the trunk tile planted directly below them: the round canopy's
ellipse narrowed away from the trunk's column, and the palm's fronds didn't reach down to the tile
edge at all. Fixed by giving the round canopy a flat "skirt" near the bottom of its silhouette (wide
enough to cover the trunk's columns regardless of the ellipse's curve) and giving the palm a solid
"neck" from the crown straight down to the tile edge over the trunk's columns. No tile names or
positions changed, only what's drawn inside `treeCanopyBL`/`palmCanopyBL` (and their TL/TR/BR
counterparts, which share the same shape function).

### Trees and palms: the *shape* stays hand-drawn (FB-0025; the *fill* moved to Sprout Lands 2026-09-21)

FB-0025 asked for trees to be replaced from a pack too, and the Roguelike Modern City pack does have
round tree art -- but it's a single 16x16 tile (a top-down canopy with its own trunk baked into the
same tile), not the trunk-plus-2x2-overhead-canopy split this game's trees use for the "walk behind
the canopy" depth cue (STYLE_GUIDE "Layering", above). Fitting the pack's tree into that split would
mean either upscaling one small tile into four (blocky, and the pack's own trunk pixels would end up
buried inside the canopy quadrants instead of at the base where `treeTrunk`/`palmTrunk` go), or
giving up the 2x2 canopy/walk-behind effect entirely. Neither reads as better than the existing
hand-drawn round-tree/date-palm canopies, so `treeTrunk`/`treeCanopy*`/`palmTrunk`/`palmCanopy*` are
unchanged. Hedges/bushes/lawn/paths (all flat, single-tile ground dressing) didn't have this problem
and were swapped; trees were the one place this survey's own migration plan flagged as needing a
judgment call, and the call was to keep the depth effect.

### Parked cars (FB-0025)

`carSedan` / `carSedanBlue` / `carSuv` / `carVan`: decoration for the student parking lot
(`tools/campus/build-campus.js`, section 13), not part of the 16x16 tile-name catalog's original
"content is data" grid-drawing convention -- each is a Pixel Vehicle Pack sprite (CC0,
`assets/vendor/kenney-pixel-vehicle-pack/`) at its own irregular size (e.g. a 29x13 sedan), scaled
down (nearest-neighbor, aspect preserved) and centered in a 16x16 tile with the sprite's own colors
kept as-is (no palette recolor -- they already read fine next to the bright campus palette). Solid,
placed only on plain `parking` ground tiles with two rows hugging the lot's north/south kerb and a
gap between cars, leaving the middle of the lot open as a driving aisle. A parked car is one full
16x16 tile (2 m) here, smaller than a real car's actual footprint -- a deliberate simplification, the
same scale compromise every other single-tile prop in this kit (`rock`, `flowerbed`, a tree trunk)
already makes.

## Interior kit

Added 2026-09-17 for the building interiors (P3, [INTERIORS_PLAN.md](INTERIORS_PLAN.md)). 32 tiles
appended to `tools/make-assets.js` in one "interior kit" section, 1 m per tile indoors. A labelled
overview of every generated floor is in `docs/research/interiors/*.png`.

- **Walls are reused, not redrawn:** interiors use the outdoor `bitsWallPlain` (front face: sand
  body, salmon cornice on top, a dark base course at the floor) / `bitsWall` (windowed) /
  `bitsWallEndL` / `bitsWallEndR` (side faces, in shadow) tiles, so a building's inside matches its
  outside.
- **Floors, one tile name per room type:** `intFloorFoyer` (light, flecked -- foyers, lobbies,
  reception, medical), `intFloorClassroom` (light planked wood -- classrooms, mini mart, canteen),
  `intFloorCarpet` (blue-grey weave -- offices, clubs, lockers, the auditorium aisle),
  `intFloorLabVinyl` (pale teal, lightly speckled -- labs), `intFloorLibrary` (green-grey weave, per
  the real library's green-grey columns), `intFloorStage` (a wood-tone strip at the front of the
  auditorium), `intFloorCourt` (the **same teal court surface as the outdoor tennis/basketball
  courts**, not a lawn green, so an indoor court doesn't read as a patch of grass).
- **Openings:** `intDoorway` (a dark threshold framed in the BITS trim colour, always walkable) for
  every door; `intStairsUp` / `intStairsDown` (a short flight with a directional arrow, walkable --
  stepping onto one triggers the warp to the next floor); `intLift` (decorative only, no warp).
- **The atrium void** (the 1st-floor mezzanine looking down into the ground-floor foyer):
  `intAtriumVoid` (solid, a flat cool grey so it reads as a drop, not just another floor texture) and
  `intAtriumRailing` (the bordering rail).
- **Furniture** (every piece transparent outside its own silhouette, so the room's floor tile shows
  through around it, the same way a tree sits on the lawn layer beneath it): `intDesk` /
  `intTeacherDesk` (classrooms, offices), `intWhiteboardWall` (a wall tile, not a floor piece --
  mounted on a classroom's front wall), `intBench` / `intComputerBench` / `intSink` (labs),
  `intCabinet`, `intSofa`, `intNoticeboard`, `intReceptionDesk` (reception, foyers, canteen
  counters), `intLocker`, `intAuditoriumSeat` (red, in rows facing the stage), `intBadmintonNet` /
  `intCourtLineIndoor`, `intTTTable`, `intBed` / `intCurtain` / `intMedicalDesk` (the medical
  centre), `intMachine` (workshops). Reused as-is from the house/campus kits where a generic piece
  already fits: `table` (reading tables, canteen tables, club tables), `bookshelf` (library shelving
  and mini-mart shelving alike), `plant`.
- **New palette keys** (`tools/make-assets.js` `PALETTE`): `µ`/`ß` (foyer floor), `[`/`]` (classroom
  floor), `{`/`}` (carpet), `¦`/`¬` (lab vinyl), `§`/`¶` (library carpet), `>`/`°` (sofa fabric), `¤`
  (noticeboard cork). Everything else reuses existing ramps (BITS wall/trim/glass, wood, red seating,
  blue lockers/screens, stone stairs/lift, the outdoor court teal) rather than inventing new ones.

### Interior furniture kit refresh (2026-09-22, owner brief: "find asset packs... customise")

The furniture pieces above were originally flat hand-drawn boxes ("simply furnished by design" still
holds -- one or two pieces per room type, not hand-decorated -- but the *pieces themselves* looked
poor). They're now blitted and recolored from real packs, the same `blitAtlas`/`remapShaded` technique
as the outdoor kit, documented in full in `docs/research/asset-packs.md`'s 2026-09-22 addendum:

- **LimeZu Modern Interiors Free**'s furniture sheet (same pack the walls/floors/characters already
  come from, ADR 0012/0013 -- no recolor needed, guaranteed to match): `intDesk`, `intWhiteboardWall`,
  `intNoticeboard`, `intCabinet`, `intSofa` (a cushioned ottoman), `plant`, and the new `intGlobe`.
- **Cool School Tileset** (CC0, downloaded earlier but unused until this pass -- its pastel palette
  needed a real recolor, per the original survey's own verdict): `intTeacherDesk`, `intLocker`,
  `bookshelf`, `intComputerBench`'s monitor, and the new `intPrinter`/`intBooksStack`.
- **Pixel Seating** (CC-BY 3.0, new download): `intAuditoriumSeat` -- two real theatre-seat sprites
  per tile.
- **Laboratory Tileset PixelArt 16px** (CC BY 4.0, new download): the new `intLabBench` (replaces
  `intBench` for science/engineering labs), `intLabTank`, `intLabRack`.
- **Hand-drawn, new this pass** (no clean free-licensed match found in time, see
  docs/research/asset-packs.md): `intCanteenCounter`, `intWaterCooler`, `intVendingMachine`, `intBin`.

All ten new tile names are appended at the very end of the `TILES` catalog in `tools/make-assets.js`
(after `bitsFacadeBaseEndR`) -- every existing tile keeps its name, index and `solid` flag.
`tools/interiors/build-interiors.js`'s `FURNISHERS` table was rewritten alongside this to actually use
the new pieces per room type (a classroom's whiteboard is mounted via `Floor.wallFeature`, added
2026-09-22; a lab gets a tank and rack, not just benches; the auditorium keeps a walkable centre
aisle; canteen/mart/lockers/badminton get the small props the owner's brief named). The Main Block
foyer (`docs/INTERIORS_PLAN.md`) got the most attention: real seating/plants/noticeboard art plus a
*decorative* grand staircase (walkable, no warp trigger of its own -- the same trick `intLift` already
used) with a cleared nook and a stall counter behind it for the LUG event stall (docs/STORY.md).

## Asset sources and licenses

- Current art is original, generated by `tools/make-assets.js` from text sprites.
- If a free pack is used, it must be CC0 or CC-BY, recolored to this palette, and credited in
  `CREDITS.md` with its link and license.
- When text sprites get too limiting, switch to hand-drawn PNGs made in LibreSprite (free) or
  Piskel (free, in the browser). Keep the same sheet layouts so no code changes.
