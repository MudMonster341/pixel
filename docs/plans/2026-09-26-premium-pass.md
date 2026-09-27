# The premium pass (2026-09-26)

**Why:** the owner played the finished game and asked for a complete quality pass (feedback
FB-0027 to FB-0043). Their words: the 3D presence isn't there, the walk animation is mirrored, the
pavements look like brick walls, the Main Block entrance must look like the real one, the foyer must
look like the real foyer, interiors can be redesigned freely using the 3D tour, the cutscenes and
opening are choppy and disconnected, and "as soon as I walk in I don't understand what's going on".
Then: add the keys and a temporary card, optimise performance, and make every mechanic and detail
premium.

Reference photos: [entrance](../research/reference/owner-main-block-entrance.png),
[foyer](../research/reference/owner-main-block-foyer.png).

## What's wrong today (seen in `npm run qa:shots`, 2026-09-26)

- **Outdoors:** walkways are big salmon bricks with white edges, the same weight as walls. The Main
  Block front is a flat strip of windows with a one-tile door on the pavement edge. Buildings have
  no roofs, depth or entrances. Nothing tells the player where to go.
- **Depth:** every building, wall and piece of furniture is a flat tile layer under the player, so
  she draws on top of doors and walls ("walks over doors").
- **Characters:** the LimeZu sheet's first block faces right; the generator treats it as left and
  the game mirrors it for right, so she walks backwards. Only 3 directions are baked.
- **Interiors:** big empty cream floors, wall strips at odd scales, sparse furniture. The foyer is
  an empty room with a counter.
- **Cutscenes:** static illustrations in a different style from the world, panned under letterbox
  bars, then a hard cut back to the map. The opening is five separate screens.

## Direction (decisions)

1. **Look:** Pokémon Gen 4/5 top-down 3/4 view on the 16 px grid (unchanged, so maps and tests
   survive). Warm Dubai palette: sand, peach facades, palms, red pavers, blue sky light.
2. **Depth is an engine feature, not art:** tall things (buildings, trees, lamp posts, flag poles,
   tall furniture, the staircase) render as y-sorted objects. She walks behind a building's upper
   floors and in front of its base; she walks *into* a door (it opens, she steps in, fade), never
   over it. ADR to be written with the engine change.
3. **Art sources:** free packs first (CC0/CC-BY, or free non-commercial and credited, since this is a
   gift that's never sold). Where no free pack fits (the BITS facades, the foyer staircase and
   mezzanine), we draw our own in the packs' style, following the reference photos. The owner has
   explicitly OK'd downloading free packs and reference images for this.
4. **Cutscenes play in the game world** (Pokémon style): the camera pans across the real map,
   characters walk, dialog boxes appear, with no cut to a different-looking picture. Title,
   bus arrival, gate, entrance and key-room scenes all move to this. Scripts are data.
5. **Interiors are redesigned for the story:** a grand foyer modelled on the photo, a clear route to
   the three key rooms, and rooms that look like their real counterparts in the 3D tour. They don't
   need to be to scale.
6. **Onboarding:** after the bus, Mustafa meets her at the gate and walks her to the path; the goal
   is always on screen (tracker, minimap marker, a guide arrow when she hesitates).

## Status at the pause (2026-09-27)

Stages 1, 1b, 2 and 3 are merged and pushed. Stages 4 and 6 are unreviewed WIP on their own
branches; 5 and 7 are not started. Details and how to resume: [HANDOFF.md](../../HANDOFF.md).
Owner decision 2026-09-27: free packs only; the outdoor kit is Kenney's RPG Urban Pack (CC0),
recoloured to the campus palette.

## Process change (owner, 2026-09-27): build everything first, then test once

Feature-by-feature full test runs were too slow. From now on: agents build features and run only
the unit tests plus their own spec/screenshots; the coordinator merges each after reviewing the diff
and screenshots, without pushing. When all features are in, one full `npm test` round on a quiet
machine, one fix round, then push. New tests are still written with each feature.

## Stages (in order)

| # | Stage | Feedback | Notes |
|---|---|---|---|
| 1 | **Bug batch**: Esc/J/M/keys gated while a cutscene/mini-game/menu owns the screen; toast queue + tutorial fix; truthful credits; clothes-colour cache; hints by missing key; overwrite-save confirm; journal redraw + height; bag-full safety; mini-game input polish; mirrored walk + a real right-facing row | FB-0035–0043 | Unblocks pushing |
| 1b | Merge `feature/audio` onto the fixed main | — | Music, SFX, volume |
| 2 | **Research**: reference photos and 3D-tour notes for the entrance, foyer, corridors, labs, classrooms; free packs for pavements, plazas, palms, flags, benches, lamps, modern interiors | FB-0029–0031, FB-0034 | Runs alongside stage 1; output in `docs/research/` |
| 3 | **Depth engine**: y-sorted structures, door-open-and-enter, camera feel, footstep dust | FB-0027 | ADR |
| 4 | **Campus art**: walkways and plazas that read as ground, roads that connect, the Main Block entrance per the photo, roofs and facades with depth, palms, flags, signage, benches, lamps | FB-0028, FB-0029 | Layout unchanged except around the entrance |
| 5 | **Interiors rebuild**: the foyer per the photo (marble floor, columns, central staircase to a mezzanine, chandelier, fascia with the name), stall behind the stairs, corridors and the three key rooms | FB-0030, FB-0031 | Story rooms keep their floors (STORY.md) |
| 6 | **In-engine cutscenes + opening rework + onboarding**: title over a live campus, bus arriving on the real map, Mustafa meeting her, gate and entrance beats, key-room scenes | FB-0032, FB-0033 | Replaces the static illustrations |
| 7 | **Finish**: temporary card polish, UI kit pass, performance pass, full QA at several window sizes, README for the recipient | FB-0034 | Then the owner plays again |

## Rules that still hold

Sonnet agents write the code; the coordinator briefs, reviews, tests, looks at screenshots and
commits. Every fix gets an `FB-XXXX:` regression test. Art only through the generators, never
hand-edited PNGs or maps. Don't invent story beyond STORY.md (onboarding lines and room flavour text
are kept short and neutral, and flagged to the owner).
