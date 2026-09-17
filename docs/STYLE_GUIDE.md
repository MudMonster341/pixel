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
| Character | 16×16 | Owner decision 2026-09-13: keep for now. 16×24 is an option later for more expressive faces |
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

- Sheet layout: one row per direction, **down, up, left** (right = mirrored left). Columns are
  animation frames.
- Walk cycle: 4 frames at 8 fps (currently 3 poses).
- Big readable head (about 40% of height), 2px-wide eyes, a distinct hair/clothing color per NPC
  so each is recognisable on the minimap and in a crowd.
- **The player is the female lead** (owner decision 2026-09-13): black shoulder-length hair, fair
  skin, a hot pink top and a lighter pink skirt. Built in `tools/make-assets.js` (`LEAD_COLORS`,
  `LEAD_HAIR`). No other character wears the same pink.
- NPCs get an idle animation (blink or bob) so they don't look frozen.

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

### Roads, kerbs and paths (FB-0014)

- `kerbT` / `kerbB` / `kerbL` / `kerbR`: the border of a road or path rectangle on that side of the
  tile — a paved sidewalk band, a black-and-white kerb line, and asphalt filling the rest.
  `kerbTL` / `kerbTR` / `kerbBL` / `kerbBR`: the corners, where two borders meet. Combine all eight
  around a rectangle of `asphalt` to get a road with kerbs and a raised pavement on every side.
- `roadLineH` / `roadLineV`: a short dashed lane marking on asphalt, for a horizontal or vertical road.
- `crossingH` / `crossingV`: a zebra crossing band (stripes run perpendicular to the road so a
  horizontal road gets `crossingH`, a vertical one `crossingV`).
- `walkway`: a brick path with a light stone edge on its long (north/south) sides only, so a run of
  walkway tiles reads as one continuous bordered path across lawn or sand — the border doesn't
  repeat at the seam between two tiles, which would look like a flat grid (the thing FB-0006 and
  FB-0014 both flagged). Best suited to paths running roughly east–west; a north–south path shows
  the border on the wrong sides until a rotated variant is added.
- `paving` (existing name, redrawn for FB-0006): brick pavers with a highlight on each brick's
  top-left edge and a shadow on its bottom-right edge, per the light-from-top-left rule, plus mortar
  joints — four tones, not a flat fill.

### Green campus (FB-0015)

- `lawn`, `lawn2`: lush grass variants (same Grass ramp as the base `grass`/`grass2` tiles, different
  seeds/tufts) — alternate between them so a lawn doesn't look like one stamped tile.
- `hedge`: a solid, tileable clipped hedge (Leaves ramp) with a highlight top/left edge and shadow
  bottom/right edge.
- `bush`: a solid, round clipped bush.
- `flowerbed`: a solid brick-edged planter (light stone border against dark soil, so the edge
  actually reads) with a few flowers — an obstacle, not a walkable ground tile.
- Trees are split into a solid trunk (ground level, drawn like any other object) and a 2×2 overhead
  canopy above it (drawn on the above-player layer — see `overhead` above):
  - `treeTrunk` + `treeCanopyTL` / `treeCanopyTR` / `treeCanopyBL` / `treeCanopyBR`: a round shade tree.
  - `palmTrunk` + `palmCanopyTL` / `palmCanopyTR` / `palmCanopyBL` / `palmCanopyBR`: a date palm,
    fronds radiating from the crown.
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

### Buildings (FB-0011)

One big window per tile made every row of a building read as a solid band of glass. Walls now have
two small windows per tile instead, plus the pieces needed to build a proper front with a parapet
roof, corners and an entrance:

- `bitsWallPlain` / `bitsWall` (existing name, redrawn): plain wall vs. wall with two small windows,
  both with a salmon cornice line, a panel line, and a dark base course.
- `bitsWallEndL` / `bitsWallEndR`: the wall turning a corner (a darker side face, in shadow).
- `bitsRoof` (existing, unchanged fill) plus `bitsRoofT` / `bitsRoofL` / `bitsRoofR` / `bitsRoofTL` /
  `bitsRoofTR`: parapet edge pieces, so a roof reads as having a raised edge instead of a flat tint.
- `bitsEntranceL` / `bitsEntranceR`: a 2-tile-wide glass entrance under the salmon arch (`bitsDoor`,
  the existing single-tile door, keeps working for the current generator's one-tile doors).
- `bitsPillar`: a decorative column for a colonnade entrance.
- `otherWallPlain` / `otherWall` (existing, redrawn to match), `otherWallEndL` / `otherWallEndR`,
  `otherRoof` (existing) plus `otherRoofT` / `otherRoofL` / `otherRoofR` / `otherRoofTL` /
  `otherRoofTR`: the same kit in the other-buildings' grey/white palette.

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

## Asset sources and licenses

- Current art is original, generated by `tools/make-assets.js` from text sprites.
- If a free pack is used, it must be CC0 or CC-BY, recolored to this palette, and credited in
  `CREDITS.md` with its link and license.
- When text sprites get too limiting, switch to hand-drawn PNGs made in LibreSprite (free) or
  Piskel (free, in the browser). Keep the same sheet layouts so no code changes.
