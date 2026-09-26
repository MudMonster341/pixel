---
status: accepted
date: 2026-09-26
authored_by: agent
derived_from: ["owner feedback FB-0027 (no 3D presence, walks over doors)", "docs/plans/2026-09-26-premium-pass.md", "qa-shots 2026-09-26"]
supersedes: null
superseded_by: null
---

# 0015 — Tall things are y-sorted "depth groups", and doors are entered, not walked over

## Context

Every map draws its `structures` layer as one flat tile layer under the player, and only the
`overhead` layer (tree canopies) above her. A 16x24 character standing on a door tile therefore
draws her head over the wall above the door, and walking past a building, a bookshelf or a lab bench
never puts anything in front of her. The owner: "the 3D presence is not there, for example I walk
over doors."

Getting this right needs two things the tile layer can't do: something drawn *in front of* her when
she's behind it, and a Pokémon-style door moment (the door opens, she steps in and disappears,
fade). Per-tile depth doesn't work: on a door tile her feet are level with the door row itself,
so she can only disappear behind the building if the whole building sorts by its *base line*.

The campus is 534x341 tiles with 83 building footprints; interiors are 136x84. One TilemapLayer per
building is out (Phaser allocates a Tile object per cell of every layer).

## Options considered
1. **Two fixed priority layers (below/above), RPG Maker style.** Cheap, but a row is always above
   or always below, so she's either hidden while walking along a facade or never hidden in a door.
2. **Y-sorted depth groups (chosen).** The generators emit `depthGroup` rectangles. At load, the
   engine bakes the structures/overhead tiles inside each rectangle into one image whose depth is
   the rectangle's bottom edge, and blanks those tiles from the static layers. The player's depth is
   her feet y, so she sorts correctly against every building, tree and piece of furniture.
3. **Every tall prop as its own sprite object in the map data.** Most flexible, but it means
   rewriting both generators' output format at once. Depth groups get the same result from the
   tiles the generators already place.

## Decision
We render tall things as y-sorted depth groups declared by the map generators, and doors become
an animated entry sequence driven by the door's own map object.

- `depthGroup` objects (Tiled object layer): `{ x, y, width, height }` in tiles, optional
  `baseOffset` (rows above the bottom edge where the base line sits, default 0). Buildings,
  trees (trunk + canopy), lamp posts, flag poles, tall furniture, the foyer staircase.
- The engine bakes each group once per map load into a static image (RenderTexture snapshot),
  with depth = base line in pixels. Groups are culled by the camera like any other game object.
- Art may extend *above* a building's collision footprint (roof and upper floors drawn over the
  tiles north of it), so walking behind a building hides her body behind its upper storeys.
- Doors: stepping onto a door tile starts the entry sequence: input off, the door opens (door
  object's `openFrames`), she walks one tile in (now behind the building's base line, so hidden),
  fade, warp. Arriving through a door plays it in reverse (appear in the doorway, step out, door
  closes). Locked doors rattle and show the toast instead.

## Consequences
- Buildings, trees and furniture finally have presence; the door moment reads like Pokémon.
- The generators own depth, so the art stage and the engine stage can work independently: a map
  without `depthGroup` objects renders exactly as before.
- Anything placed in a depth group can't change at runtime (it's baked). Animated props stay
  separate sprites.
- Revisit if baking cost shows up in load time on the campus (83+ groups), for example by baking
  lazily as groups come into view.

## Links
- Related: [ADR 0008](0008-campus-as-straight-schematic-plan.md) (the overhead layer this extends),
  [ADR 0013](0013-characters-are-16x24-from-the-pack.md) (why characters are taller than a tile)
