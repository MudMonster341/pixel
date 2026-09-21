---
status: accepted
date: 2026-09-21
authored_by: agent
derived_from: ["owner feedback FB-0025", "docs/research/asset-packs.md 2026-09-21 addendum (character findings)", "decisions/0012-third-party-asset-packs.md"]
supersedes: null
superseded_by: null
---

# 0013 — Characters are 16x24, recolored from the vendor pack

## Context

FB-0025's story brief was blunt about the characters specifically: *"the character drawings need
to be improved, they look pretty bad right now, no detail."* [ADR 0012](0012-third-party-asset-packs.md)
already moved the outdoor tiles to vendor packs for the same reason; characters were the one thing
that survey left hand-drawn, because no free, clearly-licensed pack matched this game's 16x16
character frame.

The research addendum (docs/research/asset-packs.md, 2026-09-21) closed that gap: LimeZu's Modern
Interiors **Free** pack (already in use for interiors, ADR 0012) ships four named characters (Adam,
Alex, Amelia, Bob) with real walk-cycle sheets, and its free-tier licence explicitly allows editing
for non-commercial use. It also measured the actual problem: every character's figure occupies
roughly 22-24 rows of pixels, not 16 -- confirmed again here by decoding the PNGs directly and
bounding-box-scanning each frame (rows 8-31 of a 32-tall canvas, every character, every sheet).
Forcing that into a 16-tall frame means cropping off the top of the hair. STYLE_GUIDE.md had already
flagged 16x24 as "an option later" back when the player was first drawn (2026-09-13); this is that
option being taken.

## Decision

**Characters are 16 wide x 24 tall.** Map tiles stay 16x16 (`TILE`); a new `CHAR_HEIGHT = 24`
constant (`src/state.js`) is the character frame height everywhere it matters (`src/main.js`'s
spritesheet loaders, `tools/make-assets.js`'s `CHAR_H`).

**The lead is a recolored Amelia**, and three campus NPCs are recolored Adam/Alex/Bob (the other
three named pack characters) -- `tools/make-assets.js`'s new "characters" section
(`buildCharacter`, `AMELIA_RECOLOR`/`ADAM_RECOLOR`/`STUDENT_A_RECOLOR`/`STUDENT_B_RECOLOR`), all
built from the vendor pack the same way ADR 0012's tile swap works: decode, crop, recolor, blit --
never a hand-edited PNG. Recoloring is an **exact-RGB swap table**, not the luminance-bucket ramp
used for tiles (`remapShaded`/`remapRoad`/`remapPaver`): the pack's soft-shaded character art uses a
small, consistent set of exact colors per character (18-23 total, decoded and counted), so an exact
table is simpler and safer than trying to bucket hair and skin apart by luminance alone (they sit at
similar brightness).

| Character | Source | What changed |
|---|---|---|
| The lead | Amelia | Hair, skin, top and skirt recolored onto the owner's exact brief (black hair `#2a1c14`, fair skin `#f4c9a0`/`#d49a6a`, hot pink top `#ff6fb1`/`#d94b8f`, light pink skirt `#ff7eb6`) -- all colors already in `PALETTE` (`q`/`S`/`s`/`M`/`c`/`P`), reused rather than invented. |
| LUG volunteer | Adam | Only the shirt recolored (purple to teal, `#2f9e8f`/`#4fc2ae`, new colors -- a small nod to the club). His own olive hair and skin are untouched; they already look nothing like the lead. |
| Background student A | Alex | Only the plaid shirt recolored, to plain blue (reusing `PALETTE.B`, the existing pants blue). Hair and grey vest untouched. |
| Background student B | Bob | Only the near-black blazer recolored, to the mustard/gold already documented as this game's Accent gold ramp in STYLE_GUIDE.md (`#a8812a`/`#e0b84f`/`#ffd23f`). Hair and skin untouched -- his hair was already dark like the lead's new hair, so leaving his top dark too would have made him a visual near-duplicate; the recolor exists specifically to avoid that. |

**Frame layout, per character, 3 rows x 8 columns** (`CHAR_COLS = 8` in both `tools/make-assets.js`
and `src/scenes/world.js`, kept as two independent literals rather than a shared import since this
project has no module system yet -- see docs/ARCHITECTURE.md):

- Rows: down, up, left (right = flipX-mirrored left, unchanged convention, STYLE_GUIDE.md
  "Characters"). The pack's own sheets have an explicit fourth "right" column, but it's a plain
  horizontal mirror of "left" in every frame checked, so mirroring stays the simpler, unchanged
  approach rather than adding a true fourth direction throughout the engine.
- Columns: `[idle, walk×6, idle-anim]`.
  - **Idle** (frame 0 of each row): the pack's `_idle_16x16.png`, one static pose per direction.
  - **Walk** (frames 1-6): the pack's `_run_16x16.png`, which has genuine per-frame motion (leg
    stride, arm swing -- verified by diffing frames, and now asserted by a unit test). The pack ships
    no separate "walk" sheet, only "run"; this game already only had one motion (the existing
    `RUN_ANIM_SCALE` in `src/scenes/world.js` just plays the same animation faster while Shift is
    held), so the run sheet is reused for both walking and running rather than adding a second,
    separate animation set the pack can't actually back.
  - **Idle-anim** (frame 7): one frame from the pack's `_idle_anim_16x16.png` (same 6-frames-per-
    direction layout as the run sheet; frame index 3, picked by eye as the clearest blink/breathe
    variant). `src/scenes/world.js` alternates between the idle and idle-anim frames
    (`idle-down`/`idle-up`/`idle-side` animations, 2fps, yoyo) instead of freezing on a single frame
    when the character isn't moving -- STYLE_GUIDE.md's existing "gentle life" rule (NPCs/the player
    blink or bob when idle), now actually implemented for the player instead of only asked for.

**Two different things had to move, for two different reasons, and they move by different amounts:**

- **Physics body `setOffset` preserves an invariant, not a "+8 shift".** Every spawn point, door and
  warp trigger in every map was authored against the *old* 16-tall frame's rule that the feet
  (body's bottom edge) sit exactly 8px below the sprite's origin -- `toPixel()` places the origin at
  a tile's center, so `origin + 8` lands exactly on that tile's bottom edge. The frame growing to 24
  tall moves the origin itself (it's the frame's vertical center: row 8 of 16, now row 12 of 24), so
  `offsetY` has to grow to *keep* `origin + 8` as the body's bottom edge, not move it. The formula is
  `offsetY = 8 + newHalf - bodyHeight`: player `setSize(10, 6).setOffset(3, 14)` (14 = 8+12-6, was
  `setOffset(3, 10)` = 8+8-6), legacy NPC `setSize(12, 8).setOffset(2, 12)` (12 = 8+12-8, was
  `setOffset(2, 8)`). Getting this wrong (an early draft of this change used a flat "+8 from the old
  number", i.e. `setOffset(3, 18)`, reasoning from the frame's top-left instead of the origin) is
  exactly the kind of thing that looks fine by eye and breaks a specific door: it put the feet 4px
  further down the map than every spawn point intended, which was enough to land inside the *next*
  tile row -- at the house's own spawn point, that row was the exit warp, so arriving instantly
  re-triggered leaving again. Caught by `tests/e2e/house.spec.js` failing, not by looking at a
  screenshot (she looked perfectly normal standing still).
- **Held-item `HELD_OFFSET` y values track a point on the drawn art**, which is a different question
  from where the collision box sits: the sprite's origin itself moved from (8,8) to (8,12) inside the
  now-taller frame, so a hand drawn at the same *visual* spot on the body sits 4px further from the
  new, lower-down center. These got a flat **+4** (down: 3→7, up: -2→2, left/right: 2→6),
  `src/scenes/world.js` has the derivation in a comment, and it was verified by eye afterwards with
  `npm run qa:shots` and a scratch Playwright script that walks the lead in all 4 directions and
  captures frames (docs/QA_PLAN.md's normal "look at it" bar, same as any other visual change) --
  unlike the body offset, getting this one slightly wrong is a cosmetic problem, not a broken door.
- Depth-by-y sorting is untouched: it already sorts by the sprite's y position (the origin, which is
  still vertically centered in the taller frame), not by anything frame-height-specific.

**Tomas (the meadow/house test-map NPC) keeps his unchanged hand-drawn art.** FB-0025 and this pass
are scoped to the lead and the campus NPCs the owner's brief actually named; Tomas is an engine
fixture (`src/maps.js` already calls him that), not BITS campus content. His art is just
bottom-aligned into the new 16x24 canvas (`tools/make-assets.js`'s `growToCharHeight`, 8 blank rows
prepended) so every character in the game shares one frame size -- no new recolor work, no new walk
cycle (he never had one).

**The 3 new campus NPCs are wired up as data, not placed on the real campus yet.** `src/maps.js`'s
`npcs` array gained a `character` field (`'volunteer' | 'student-a' | 'student-b'`, resolved to
texture `npc-<character>` by `src/scenes/world.js` `createNpcs()`); an NPC with no `character` keeps
the legacy `'npc'` texture (Tomas/Guide, unaffected). The three new characters are demonstrated today
as fixtures on the meadow test map, at plain open grass tiles, with placeholder one-line chat --
proving the pipeline end to end (texture load, frame numbering, body size, dialog) without guessing
at real campus coordinates or writing story content the owner hasn't given yet
(CLAUDE.md: "Don't invent the story: the owner writes it"). Real placement on the campus map is a
follow-up task.

## Consequences

- Every character reads with real detail at the game's zoom (3x) -- hair strands, a visible fringe,
  shading -- instead of the old flat hand-drawn 16x16 sprite. This is the actual ask in FB-0025.
- `assets/player.png`, `assets/npc.png`, and three new `assets/npc-*.png` files are all generated,
  never hand-edited, from `tools/make-assets.js` -- same rule as every other asset in this repo.
- A few numbers moved by a fixed, documented amount (body offset +8, held-item y +4) rather than
  needing per-direction re-tuning from scratch; STYLE_GUIDE.md's grid table is updated to say 16x24.
- The vendor pack (`assets/vendor/limezu-modern-interiors-free/`) stays gitignored, same as ADR 0012
  -- the generated sheets are what ships, and a clean clone needs the pack downloaded again to
  regenerate (already true for every pack-sourced asset in this repo).
- NPCs still don't walk (no patrol AI exists); the new characters' walk/idle-anim frames are ready
  for when that's built, matching the research doc's own framing ("so the campus can be populated
  later").
