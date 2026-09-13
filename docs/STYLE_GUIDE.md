# Style guide

**Status:** v1 proposal (2026-09-13). Waiting for the owner's review. Once approved, every new
tile, sprite and UI element follows it. Change it deliberately: edit this file and note why in
MEMORY.md.

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

## Asset sources and licenses

- Current art is original, generated by `tools/make-assets.js` from text sprites.
- If a free pack is used, it must be CC0 or CC-BY, recolored to this palette, and credited in
  `CREDITS.md` with its link and license.
- When text sprites get too limiting, switch to hand-drawn PNGs made in LibreSprite (free) or
  Piskel (free, in the browser). Keep the same sheet layouts so no code changes.
