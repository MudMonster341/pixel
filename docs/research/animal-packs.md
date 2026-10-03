# Animal sprite packs for the campus (cats, birds), researched 2026-10-03

Goal: cute free pixel animals for the Dubai campus (stray cats, pigeons/sparrows/crows, optionally a gecko),
matching the Sprout Lands / Kenney look (16x16-ish, soft palette), licence OK for a gift game shipped as files.
Existing licences and how we credit them: [CREDITS.md](../../CREDITS.md), [ADR 0012](../../decisions/0012-third-party-asset-packs.md).
All three packs below were downloaded into `assets/External Tilesets/` (gitignored, never committed; the game ships
only recoloured art baked into our generated sheets, same rule as the other packs). Licence text was read on the
source page (itch.io / OpenGameArt have no separate licence file for these) and saved as `LICENSE.txt` in each folder.

## Already in our files: Ninja Adventure animals (checked, not good enough)

`assets/External Tilesets/Ninja Adventure - Asset Pack.zip` (CC0, already credited) has `Actor/Animal/` with 5 cats,
chicken, parrot, frog, dog, hamster etc. But every sheet is only 2 frames, one facing (e.g. cat 32x16 = idle + one
walk frame), in a chunkier, more cartoonish style. Fine for a quick prop, not a walk cycle. No pigeon/sparrow
(only a parrot). Not recommended as the main animals; it is the zero-effort fallback (no new credit needed).

## Ranked recommendation

| Need | Pick | Why |
|---|---|---|
| Cat | **1. Zeenaz "Free Pixel Animation: Cat"** (CC0) | Real quadruped stray-cat proportions, 16x16, sit + stand + walk + sleep + scared. Side view only (flip for left/right). Grey, so we recolour to orange/tabby/white strays in `tools/make-assets.js`. |
| Birds that walk and fly | **1. [LPC] Birds by bluecarrot16** (CC-BY 4.0) | 32x32, 3/4 view, **walk and fly in 4 directions**, 15 colour variants including a sparrow, a white dove (recolour grey for a pigeon) and a black bird (house crow). The only free pack found with 4-direction bird walking. |
| Pigeon look | **2. Pop Shop Pigeons** (free, credit optional) | Proper rock-pigeon colours at 11x10 / 16x16, but static poses only, no walk cycle. Use as the colour/shape reference for recolouring the LPC dove, or as a sitting/perched prop. |

Gecko: nothing suitable found in a free pack. Needs a generated sprite (small, 16x16, 2-3 frames) if wanted.

## Downloaded packs

### 1. Zeenaz, Free Pixel Animation: Cat [6 loops]
- URL: https://zeenaz.itch.io/free-pixel-animation-cat-6-loops (author: Zeenaz)
- Licence: "CC0 licence, free to use. Public Domain" (read on the page). Folder: `assets/External Tilesets/Zeenaz-Cat/` (`cat-Sheet.png` + `LICENSE.txt`).
- Size: cat-Sheet.zip 3.8 kB, one PNG 128x96, frames 16x16 (8 columns x 6 rows).
- Rows (observed, 1 row = 1 animation, all facing right/side view): 0 sit (4 frames), 1 stand/idle with tail swish (7), 2 sleep curled (7),
  3 walk (5), 4 scared/arched (3), 5 frightened/screaming (4). Row 1 vs row 3 are both "standing" poses; check in-game which one is the walk.
- Directions: side view only. Left/right via `flipX`; no up/down. For campus strays that mostly sit, sleep and wander this is enough; for up/down movement
  use the idle pose or the LPC-style trick of just sliding the sprite.
- Fit: grey 16x16 matches our tile scale and the Sprout Lands chicken/cow size. Recolour the greys onto the campus ramps (orange tabby, white, black-white).
- Credit line (optional for CC0, we give it anyway): `**Free Pixel Animation: Cat [6 loops]** by **Zeenaz** ([zeenaz.itch.io/free-pixel-animation-cat-6-loops](https://zeenaz.itch.io/free-pixel-animation-cat-6-loops)) -- CC0 1.0 (public domain). Stray campus cats, recoloured.`

### 2. [LPC] Birds by bluecarrot16 (commissioned by castelonia)
- URL: https://opengameart.org/content/lpc-birds (author: bluecarrot16)
- Licence: offered under CC-BY 4.0 / 3.0, CC-BY-SA 4.0 / 3.0, GPL 3.0 / 2.0 or OGA-BY 3.0 (read on the page). We use **CC-BY 4.0**. Required attribution text from the page:
  "[LPC] Birds" by bluecarrot16, commissioned by castelonia. Please include a link back to this page on OpenGameArt. Folder: `assets/External Tilesets/LPC-Birds-bluecarrot16/` (16 PNGs + `LICENSE.txt`).
- Size: 16 PNG files of about 3 kB each (plus birds_preview.png). Each sheet is 96x256 = 3 columns x 8 rows of 32x32 frames.
- Rows (observed): 0-3 fly (left, up/back, down/front, right), 4-7 walk (left, up/back, down/front, right); 3 frames each. No idle/sit/sleep (use frame 0 of walk, or standing frame).
- Birds: `bird_3_sparrow` (house sparrow), `bird_2_white` / `bird_1_white` / `bird_1_white_crest` (white dove; recolour grey for a pigeon), `bird_2_black` (black bird, close to a house crow / myna),
  `bird_1_brown`, `bird_2_brown_1/2`, `bird_1_bluejay`, `bird_2_blue`, `bird_2_cardinal`, `bird_2_eagle`, `bird_1_red`, `bird_2_red`, `bird_3_robin`(+`_0`).
- Fit: LPC-style 3/4 view with a soft palette and dark-brown outline-free shading; birds fill about 16-20 px of the 32x32 frame so they sit next to the 16x16 tiles. Same family as LPC characters, close to the Modern Interiors look. Needs only a mild recolour.
- Credit line: `**[LPC] Birds** by **bluecarrot16** (commissioned by castelonia) ([opengameart.org/content/lpc-birds](https://opengameart.org/content/lpc-birds)) -- CC BY 4.0, attribution required. Campus sparrows, pigeons and crows.`
  Also add the same line to the title screen's Credits page (ADR 0012 rule).

### 3. Pop Shop Packs, Pigeons || Pixel Asset Pack
- URL: https://pop-shop-packs.itch.io/pigeons-2d-pixel-asset-pack (author: Pop Shop Packs, art by Savannah, wording by Admurin)
- Licence (page text, saved in `LICENSE.txt`): use in any project personal or commercial; do not resell or redistribute as a game asset (must be part of a project); credit not necessary but appreciated; modify freely; no NFTs; no feeding into generative AI. All fine for a gift game that ships baked-in art.
  Folder: `assets/External Tilesets/PopShop-Pigeons/` (the zip plus extracted `Pigeons/` with `Original Diminsions/` and an x40 upscaled copy; the `.mdp` Fire Alpaca source files are in the zip too).
- Size: Pigeons.zip 75 kB. `Pigeon Sprite Sheet.png` is 176x160 (not a regular grid): pigeon variants in white, brown, grey rock pigeon, spotted and tan, drawn in 3 poses (about 11x10 stand, flying-ish and 16x16 sitting). Also hutch/coop sheet (not needed).
- Animations: none really (static poses). Directions: right-facing side view only.
- Fit: very cute, soft, correct pigeon colours (grey with orange feet, spotted). Use it for the sitting/perched pigeon on benches and ledges, and as the colour guide for the LPC dove recolour.
- Credit line (optional): `**Pigeons || Pixel Asset Pack** by **Pop Shop Packs** ([pop-shop-packs.itch.io/pigeons-2d-pixel-asset-pack](https://pop-shop-packs.itch.io/pigeons-2d-pixel-asset-pack)) -- free to use in projects, credit appreciated, no redistribution of the pack. Perched campus pigeons.`

## Looked at and not downloaded

| Pack | Why not |
|---|---|
| ComfyMattres "Animals Character Asset Pack" (comfymattres.itch.io/animals-character-asset-pack, 16x16 top-down, cat + bear/pig/penguin, idle + walk in 4 directions) | Licence is OK ("use in any way you want, no reselling, no NFTs") and I downloaded and viewed it, then removed it: the cat is a very chibi dark upright cat (sits like a teddy), no sleep, not stray-like. It is the best 4-direction cat if the owner prefers up/down walking over a realistic cat; re-download from itch.io. |
| Joshua Briggs "Pixel Art Bird 16x16" (joshua-briggs.itch.io/bird-sprite) | Nice 16x16 sparrow with idle/walk/fly/eat (side view), but the licence is only an author comment ("completely free... do not resell... no need to credit"), not a licence statement. Removed per the unclear-licence rule. |
| mxmaze "16 Bit Kitty - Free" (CC BY 4.0, 16x16 brown, idle/walk/sit/sleep) | Not downloaded; single colour, direction unknown. Backup cat with sit/sleep if Zeenaz's cat proves unsuitable. |
| octopusINKUS "Cat Pack" free version (16x16, idle/walk/sleep/sit etc.) | Side-view platformer cat, itch.io page gives no clear licence beyond "can be included in a game". |
| inkBubi "16x16 Pixel Forest Animal Pack" (OGA, CC0) | Real top-down 4-direction idle + run, but fox, doe, owl, squirrel, frog only. No cat or bird; only the frog is slightly useful. |
| Elthen pigeon (32x32), Peak Pixels Common Birds, gamedeveloperstudio top-down birds, Daniele Santana Animals, Pixelmia cats | Paid, or custom/Patreon licence, or side view/vector style that does not match. |
| Ninja Adventure animals | Already owned (CC0), but only 2 frames per animal, see above. |

## Notes for whoever wires this in
- Cat side-view only: pick direction by `flipX`; stationary strays use sit/sleep rows, wanderers use the walk row.
- LPC bird row order observed in the sheets is left, up, down, right (not the usual LPC up, left, down, right); verify in a test render.
- All art goes through `tools/make-assets.js` (decode the vendor sheet, recolour onto our ramps, write into `assets/`), like the Ninja Adventure flag.
  Raw packs stay in `assets/External Tilesets/` (gitignored) or move into `assets/vendor/<name>/` the way the other packs were.
- If neither the cat nor the gecko is acceptable at game scale, a generator fallback in `tools/make-assets.js` (a 16x16 text-sprite gecko, 3 frames) is needed; birds and cats are covered.
