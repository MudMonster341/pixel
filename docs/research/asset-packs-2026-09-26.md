# Asset-pack survey, round 3 (2026-09-26, premium pass Part B)

**Status:** research only, plus new downloads into `assets/vendor/`. Nothing in `src/` or `tools/`
changed (out of scope for this task). Builds on the two earlier surveys --
[asset-packs.md](asset-packs.md) (2026-09-20/21/22, outdoor tiles/characters/interior furniture,
already wired into the game) -- rather than repeating what's already settled there. This pass looks
specifically for what the premium pass still needs per
[docs/plans/2026-09-26-premium-pass.md](../plans/2026-09-26-premium-pass.md): palm trees, plazas
that read as ground, and the Main Block entrance/foyer's specific architectural pieces (glass
canopy, twin curved staircase, chandelier), informed by
[campus-visual-reference.md](campus-visual-reference.md) (Part A of this same task).

**The licence filter is unchanged from the earlier surveys:** CC0, CC-BY, or an explicit
permissive/commercial licence only; anything "personal use only" or unclearly licensed is ruled out
on sight; the project's own $0 budget means paid packs are noted for completeness but not bought.

## Per-need table

| Need | Best source found | Licence | Verdict |
|---|---|---|---|
| **Palm trees** | *(no good free pack found)* | -- | **Gap -- keep hand-drawn.** See "Palm trees" below; this confirms `docs/STYLE_GUIDE.md`'s existing "Trees and palms: kept hand-drawn" decision is still the right call, now with real photo reference (`campus-visual-reference.md`) to draw from instead of a guess. |
| **Paved walkways/plazas** | Kenney Roguelike Modern City (already in `assets/vendor/`, already wired in) | CC0 | **Already solved**, confirmed a good fit by the new campus photos -- only a hue nudge suggested (redder/browner, see below), not a pack swap. |
| **Park paths that read as ground (plazas specifically)** | **Kenney RPG Urban Pack** (new, downloaded) | CC0 | **Good new source** -- distinct rounded-corner park/plaza path tiles (teal-grass and tan-sand variants, light stone border), better suited to courtyard/plaza areas than the road-derived `walkway` tile. |
| **Benches, bins, lamp posts, planters, fences** | Kenney Roguelike Modern City (existing) + **Kenney RPG Urban Pack** (new) | CC0 | **Good** -- the new pack adds park-specific variants (planters/flower boxes, striped barricades, low fences, a "P" parking icon) alongside the existing street furniture. |
| **Flag poles/flags** | *(no dedicated pack found)* | -- | **Gap -- keep hand-drawn**, but now with a real reference: `campus-visual-reference.md`'s Main Block section confirms red/gold pennant flags on tall white poles. |
| **Sign boards** | Existing `signboard` tile (hand-drawn) | -- | **No change** -- confirmed correct by photos, just recolour the lettering navy (`#1A3A6B`), not gold, per the new corrected finding. |
| **Bollards, fences/gates, parked cars, a bus** | Kenney Pixel Vehicle Pack (existing, has a bus already) | CC0 | **Already solved.** |
| **Modern building parts (facades, glass doors, columns, steps, awnings/canopies)** | *(no good free pack found in the right style)* | -- | **Gap -- keep hand-drawn**, per the existing "How our buildings are built" method in `STYLE_GUIDE.md` (study a pack's construction method, draw in the game's own palette). The one CC0 sample close in *spirit* (`opengameart-modern-houses-topdown`, downloaded) is too small/wrong-palette to blit from directly -- see below. |
| **Marble/polished floors, columns, staircase w/ railings, mezzanine edge, chandelier, reception desk, sofas** | LimeZu Modern Interiors Free (existing) for floors/columns/desk/sofa; **no pack has a twin curved staircase or a chandelier** | non-commercial, editing allowed | **Partial.** The straight staircase/mezzanine-railing/reception-desk/sofa pieces are already sourced; the *specific* twin-curved-flight staircase and the chandelier are a **confirmed gap**, per a fresh, targeted search this pass (see below) -- draw these ourselves from `owner-main-block-foyer.png`. |
| **Potted plants** | LimeZu Modern Interiors Free (existing, `plant` tile) | non-commercial | **Already solved.** |
| **Classroom desks + whiteboard** | LimeZu Modern Interiors Free / Cool School (existing) | mixed, both already in use | **Already solved**, plus new detail: add a projector screen prop (not currently in the kit) per `campus-visual-reference.md`'s classroom photo. |
| **Computer-lab desks + monitors** | Cool School (existing) | CC0 | **Already solved**, plus new detail: the ICL/Incubation room specifically wants royal-blue cabinetry and a poster-covered wall, a colour/dressing change rather than a new pack. |
| **Science-lab benches + equipment** | Laboratory Tileset PixelArt 16px (existing) | CC BY 4.0 | **Already solved.** |
| **Library shelves** | LimeZu / Cool School (existing) | mixed | **Already solved**, plus new detail: the real library's shelving reads lighter/honey-toned than the game's current shelf colour, and its columns have a pale sage-green base band worth its own palette key -- both cheap recolour tweaks, not new packs. |
| **4-direction walk + idle student sheets** | LimeZu Modern Interiors Free's characters (existing, Amelia/Adam/Alex/Bob) | non-commercial | **Already solved** (ADR 0013). Re-checked this pass for a second free option (below) -- still nothing better. |

## New packs downloaded this pass

### Kenney RPG Urban Pack (CC0) -- `assets/vendor/kenney-rpg-urban-pack/`

- **URL:** https://kenney.nl/assets/rpg-urban-pack -- direct zip from kenney.nl, no account needed.
- **Licence:** CC0 1.0 (public domain), quoted from the pack's own `License.txt`: *"This content is
  free to use in personal, educational and commercial projects. Support us by crediting Kenney...
  (this is not mandatory)."*
- **Tile size:** 16x16 (matches the game exactly).
- **Downloaded:** `curl.exe -L` straight to the zip, unzipped keeping `License.txt`; `SOURCE.txt`
  added recording the URL/licence/date. No `.gitignore` entry needed (CC0 permits redistribution).
- **What it actually has**, decoded from `Preview.png` (previews saved for this pass, see below):
  rounded-corner park/plaza *paths* in two colourways (a teal "grass-park" and a tan "sand-park"
  variant, each with a light stone/paver border -- genuinely reads as a plaza, not a repeating brick
  wall), park benches, streetlamps, planters/flower boxes, waste bins, fire hydrants, striped
  barricades, low decorative fences, market-stall props, vending machines, paved steps, a small "P"
  parking icon, plus (not used by this project) residential red/orange-brick building parts, round
  summer/autumn trees (**no palms**), front-angled (not top-down) cars, and a set of chibi RPG
  characters.
- **Verdict:** genuinely useful, narrower than the name suggests -- adopt the **plaza paths, benches,
  planters, bins, and low fences** specifically; skip the brick buildings (wrong palette/style for
  BITS) and the cars (wrong perspective, the existing Pixel Vehicle Pack is already top-down and
  already wired in).
- **Contact-sheet previews** (cropped from the pack's own `Preview.png` at 4x, looked at before
  keeping): [asset-pack-preview-urban-paths.png](asset-pack-preview-urban-paths.png) (the plaza path
  tiles + early street-furniture rows), [asset-pack-preview-urban-props.png](asset-pack-preview-urban-props.png)
  (benches/planters/bins/fences/steps -- the specific props worth adopting).

### "Modern Houses" Tileset TopDown (CC0) -- `assets/vendor/opengameart-modern-houses-topdown/`

- **URL:** https://opengameart.org/content/modern-houses-tileset-topdown, file
  `opengameart.org/sites/default/files/tiletest.png` -- direct download, no account needed.
- **Licence:** CC0, credit requested but not required (quoted from the submission page).
- **What it is:** a single small (18.5 KB) sample sheet -- one house rendered in a genuinely
  Fire-Red/Pokemon-GBA style (white walls, orange/blue/teal accent bands, a tiled roof), a few
  interior furniture pieces, and 3 small round trees. Not a full pack.
- **Verdict:** kept as a **style reference only**, not for blitting -- it's proof that "a modern
  building with coloured accent bands" reads well in genuine Pokemon-GBA pixel style at this tile
  size, which is useful confirmation for the hand-drawing approach the Main Block facade already
  needs (see "Modern building parts" gap below), but its own palette (bright primary accent colours)
  and content (a small suburban house, not a 4-storey academic block) don't transfer directly to
  BITS' sand/terracotta palette.

## Gaps confirmed this pass (no good free option -- draw ourselves)

### Palm trees

Searched specifically and thoroughly this pass (palm trees were named the #1 priority alongside
pavers): OpenGameArt ("palm tree sprite", "top-down tileset template"), itch.io (tag `palm`, tag
`palm-tree` + `Pixel Art`), and re-checked the packs already in `assets/vendor/` (Kenney Roguelike
Modern City has round trees + hedges but **no palm** -- confirmed by decoding its own `Preview.png`
directly, not just re-reading the earlier survey's text; Sprout Lands Basic was already confirmed
palm-less in the 2026-09-21 addendum to `asset-packs.md`).

- **Pixel-boy "Ninja Adventure - Asset Pack"** (CC0, named in this task's own candidate list) --
  confirmed CC0 via its own itch.io page, and its screenshots show a desert-town scene with palm
  trees. **Not downloaded**: itch.io serves this pack only through its interactive "Download Now" /
  purchase-flow page (pay-what-you-want, $0 minimum), not a scriptable direct URL -- the same
  friction the 2026-09-22 addendum to `asset-packs.md` already flagged for a different pack rather
  than silently skipping it. **Flagging the exact page for the coordinator to download manually:**
  https://pixel-boy.itch.io/ninja-adventure-asset-pack (89 MB zip). If downloaded, its palm trees
  would need decoding/cropping the same way the LimeZu furniture sheets were mined, and possibly a
  recolour to fit the campus's dry-green ramp.
- **Crimplewood "Top Down Exterior"** ($4.99, free demo available) -- has palm trees, but they're
  part of a **beach/tropical-island** scene set (coconuts, giant octopus, beach towels) in a
  fantasy-RPG art style, not a modern-campus one; also paid outside the demo. Not downloaded --
  wrong style fit even before the price question.
- **"Animated Palm Tree Sprite"** (OpenGameArt, CC-BY 4.0, direct PNG download, fetched and looked
  at) -- a side-view, painterly/anti-aliased palm with a 15-frame sway animation, not built on a
  clean pixel grid and far larger than 16x16. Style mismatch (too smooth/high-colour for this game's
  hard-edged ramped-shading rule) -- not adopted, not copied into `assets/vendor/`.
- **Verdict: no free palm asset was found that's both the right licence *and* the right pixel style.**
  Keep drawing `palmTrunk`/`palmCanopy*` by hand (unchanged from the FB-0025-era decision in
  `STYLE_GUIDE.md`), now grounded in real photos instead of a guess: `campus-visual-reference.md`'s
  Main Block and G&H Block sections give exact placement (flanking entrances/plazas, not lining
  every avenue) and frond colour (already retuned to the dry-green ramp, confirmed still correct).

### Modern building parts (facade, glass canopy, columns, steps)

Searched this pass for a CC0/CC-BY pack with modern glass-fronted buildings at 16x16: nothing found
beyond LimeZu's **paid** Modern Exteriors (~$5, re-confirmed no free version exists -- checked the
page directly, matches the 2026-09-20 survey's finding) and small single-house samples too generic/
wrong-palette to use (see "Modern Houses Tileset TopDown" above). This matches
`docs/STYLE_GUIDE.md`'s existing "How our buildings are built" section's own conclusion (LimeZu's
wall art is flat colour bands with no fine texture worth blitting, so *the construction method* is
what's worth copying, not literal pixels) -- unchanged by this pass. The one new, concrete input is
`campus-visual-reference.md`'s correction that the Main Block entrance is a **glass canopy with navy
lettering**, not the red arch `STYLE_GUIDE.md` currently describes -- a drawing correction, not a
pack search result.

### The foyer's staircase, mezzanine railing, and chandelier

Searched specifically this pass ("curved staircase pixel art", "chandelier sprite CC0/16x16"):
nothing usable turned up -- results were either stock-photo sites (not game assets), 32x32+ paid
dungeon packs with the wrong theme (medieval castle, not a modern atrium), or single low-res candle/
lamp sprites too small and wrong-styled to read as a hanging crystal chandelier at this game's scale.
**Confirmed gap -- draw both by hand**, following `owner-main-block-foyer.png` and
`campus-visual-reference.md`'s "Main reception foyer" section exactly (twin curved flights to one
landing, black wrought-iron railing, a tiered chandelier over the lower landing).

### LimeZu "Serene Village" (checked, wrong content despite being free)

Checked because it's genuinely **free** ("name your own price", unlike LimeZu's other paid packs)
and **CC BY 4.0** (more permissive than the non-commercial Modern Interiors/Sprout Lands packs
already in use -- redistribution would be allowed). But its content is a rural/fantasy village
(houses, fences, flowers, signs -- a Fire-Red-style farm town), not palms, pavers, or modern
buildings. Not downloaded -- content mismatch, not a licence or access problem.

### Kenney "Tiny Town" (checked, wrong content)

CC0, direct zip download, but it's a **medieval/fantasy** kit (stone-brick cottages, wooden fences, a
mine cart, pickaxes/keys) -- confirmed by downloading and looking at its own `Preview.png`. No palm
trees, no modern anything. Not kept.

## Characters: re-checked, no change to the existing plan

Re-searched for a second free 4-direction 16x16 (or 16x24) walk-cycle character pack beyond LimeZu's
Amelia/Adam/Alex/Bob (already recolored and wired in per ADR 0013) -- nothing new turned up beyond
what the 2026-09-21 addendum to `asset-packs.md` already ruled out (LPC generator's 64x64 scale
mismatch, Mana Seed's AI-content clause, Kenney's single-pose-only characters). No action needed here.

## Credit lines for CREDITS.md

*(Not written into `CREDITS.md` itself -- this task's brief keeps edits to `docs/research/` and
`assets/vendor/` only. The coordinator should add these when the packs are actually wired into a
build, matching the existing entries' format.)*

- **RPG Urban Pack** by **Kenney Vleugels** ([kenney.nl](https://kenney.nl),
  `assets/vendor/kenney-rpg-urban-pack/`) -- CC0 1.0 (public domain). Candidate for: plaza/park paved
  paths, benches, planters, bins, low fences (not yet wired into `tools/make-assets.js`).
- *("Modern Houses" Tileset TopDown is a style reference only, not blitted from -- no credit line
  needed unless a future pass actually copies pixels from it.)*

## What's still a genuine gap after this pass

1. **Palm trees** -- no free, right-styled pack found; keep hand-drawing, now with a real photo
   reference and a placement rule (entrances/plazas, not every avenue).
2. **The Main Block's glass entrance canopy, the foyer's twin staircase, its mezzanine railing, and
   its chandelier** -- all confirmed no-pack-fits; draw by hand from `campus-visual-reference.md`'s
   literal specs, following `STYLE_GUIDE.md`'s existing "study the construction method, draw in our
   own palette" approach.
3. **Flag poles/flags** -- minor, hand-drawn is fine, just recolour/reposition per the new reference.

Everything else the premium pass's outdoor/indoor list named (roads/kerbs/crossings, hedges/lawns/
flower beds, benches/bins/lamps, fences/gates, parked cars/a bus, marble floors, columns, potted
plants, reception desk, sofas, classroom/computer-lab/science-lab furniture, library shelves) was
**already solved** by the two earlier surveys and just gets small colour/dressing refinements from
this pass's new photos, not a new pack.

## Addendum (coordinator, 2026-09-26): Ninja Adventure downloaded

The coordinator fetched the full **Ninja Adventure – Asset Pack** by Pixel-boy and AAA
(https://pixel-boy.itch.io/ninja-adventure-asset-pack, **CC0 1.0**, attribution appreciated, not
required) through itch.io's free download page. Only `Backgrounds/` (tilesets, animated props),
`Ui/`, `FX/` and `LICENSE.txt` are kept, in `assets/vendor/ninja-adventure/` (about 1.2 MB). The
GitHub repo pixel-boy/NinjaAdventure is only a cut-down Godot demo without the nature tiles.

Useful for this game:
- `Backgrounds/Tilesets/TilesetDesert.png`: **top-down palm trees** (the gap above), sand-town props.
- `Backgrounds/Tilesets/TilesetNature.png`: round shade trees, bushes, flower clumps, rocks.
- `Backgrounds/Animated/Flag/Flag*16x16.png`: animated flags (the entrance flag poles).
- `FX/`: dust and particle effects (footstep dust); `Ui/`: frames and dialog boxes for the UI kit pass.

Its outlines are bolder and its palette brighter than LimeZu's; recolour toward the campus palette
where the two sit side by side.

Credit line: *Ninja Adventure asset pack by Pixel-boy and AAA (CC0) — pixel-boy.itch.io/ninja-adventure-asset-pack*
