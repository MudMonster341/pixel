// Generates all of the game's pixel art as PNG files. No dependencies.
// Run:  node tools/make-assets.js
// Output (in assets/):
//   tiles.png + tiles.json  every map tile (8 per row), with name, solid flag and minimap color
//   player.png              the lead, recolored from a vendor pack (ADR 0013, FB-0043): 4 rows
//                           (down/up/left/right, no mirroring) x 8 cols (idle, 6 walk frames,
//                           idle-anim), each frame 16x24
//   player-<swatch>.png     one full sheet per clothes-color customisation swatch (M3a, see
//                           "character customisation" section below); player-pink.png === player.png
//   npc.png                 Tomas (hand-drawn, unchanged): 3 frames (down/up/left), 16x24
//   npc-volunteer.png, npc-student-a.png, npc-student-b.png
//                           campus NPCs, recolored from the same vendor pack, same 16x24/8-col
//                           layout as player.png (ADR 0013, FB-0025)
//   items.png               item icons, in the order of src/items.js
//   held-items.png          tiny 8x8 versions shown in the character's hand, same order/frames
//   prompt.png              interaction bubble, 2 frames: "E" (talk) and "!" (something new to say)
//   ui-panel.png            the one UI kit (docs/GAME_FEEL.md): a 9-slice frame recolored from the
//                           Kenney Pixel UI Pack, 4 frames stacked vertically (panel, then the
//                           button's normal/hover/pressed states) -- see "UI kit" section below
//   ui-icons.png            the cursor/selection arrow + dialog "next line" arrow, 2 16x16 frames
//
// Most sprites are still hand-drawn as text: one character = one pixel, "." = transparent. The
// player and campus NPCs are the exception (ADR 0013): recolored crops of a vendor pack, blitted and
// recolored by the "characters" section below instead of drawn pixel-by-pixel -- edit the recolor
// tables there, not a PNG.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decodePNG } = require('./lib/png-decode');

const TILE = 16;
const TILESET_COLUMNS = 8;

const PALETTE = {
  K: '#1a1c2c', // outline
  // player
  S: '#f4c9a0', s: '#d49a6a', // skin
  H: '#6b3e1f',               // hair
  R: '#c0392b', r: '#8e2a20', // shirt
  B: '#3b5dc9',               // pants
  // npc (Tomas)
  A: '#b7bcc8', J: '#4f8a4a', h: '#35632f', a: '#6a4a3a',
  // grass
  G: '#5ab552', g: '#3d8a3f', l: '#8fd46a', k: '#2b6b30',
  // path
  D: '#c8a26b', d: '#a07c4a', p: '#e0c290',
  // water
  U: '#3b7dd8', u: '#2a5aa8', w: '#9fd3ff',
  // tree
  T: '#2f7a3a', t: '#4fa34a', e: '#1f5227', N: '#7a4a24', n: '#5a3418',
  // rock
  O: '#9a9a9a', o: '#6b6b6b', Q: '#c8c8c8',
  // flowers
  W: '#ffffff', Y: '#ffd23f', P: '#ff7eb6',
  // house outside: roof, walls
  X: '#b5543a', x: '#8a3b2a', j: '#d9774f', V: '#eadbb8', v: '#c9ae80',
  // house inside: floor, wallpaper, dark wood, rug, mat, blanket, pot
  F: '#b98150', f: '#93602f', i: '#cf9a66', Z: '#7d9bb3', z: '#5f7d96', E: '#3d2a1e', q: '#2a1c14',
  C: '#a33b4a', y: '#e0b84f', L: '#8e7a3a', I: '#4a6fd0', m: '#3552a3', b: '#c0703a',
  // player (female lead): pink top + shade, light pink skirt
  M: '#ff6fb1', c: '#d94b8f',
  // campus (colours sampled from BITS Dubai photos, brightened per docs/STYLE_GUIDE.md)
  1: '#e3cfa3', 2: '#cdb487',             // desert sand
  3: '#5b5d66', 4: '#6d707a',             // asphalt
  5: '#d9c7a0', 6: '#c9b58c',             // campus ground (packed sand)
  7: '#c0735c', 8: '#9c5a4a',             // brick paving
  9: '#c9603f', 0: '#e08a6a',             // running track + lane line
  '!': '#4f9e45', '?': '#63b457',         // turf stripes
  '@': '#3f8a8c', '#': '#e8e8e8',         // court + line
  $: '#e6cba4', '%': '#cfae86',           // BITS wall + shade
  '&': '#cf8a6c', '*': '#2f3a44',         // BITS trim + glass
  // BITS building kit addendum (2026-09-21, decisions/0012 addendum): studied from LimeZu's Room
  // Builder wall swatches (docs/STYLE_GUIDE.md "How our buildings are built") -- a light cap band
  // under the roofline, a cool (not same-hue) baseboard where the wall meets the ground, and a
  // genuinely red arch band for the Main Block's grand entrance (the existing '&' trim is salmon,
  // too close to the wall body to read as "a red arch" on its own).
  wallHi: '#f2ddb8', baseCool: '#6b7280', archRed: '#9c3a28',
  // Quality loop, category 1 run 2 (2026-09-28): the entrance steps used '-'/'D'/'d' for their own
  // "light stone" tread face -- those are actually the old dirt-path/paving-bevel keys (salmon-tan
  // and brown), never light at all, which is the real reason the steps read as "flat dark brown
  // bars" even after round 3's redesign moved away from the Kenney staircase crop. Three genuinely
  // pale cream-grey tones instead, close in lightness to the Kenney sidewalk they sit next to.
  stepLight: '#e8e4d8', stepMid: '#d6d0c0', stepDark: '#c2bbaa',
  // FB-0022 (QA): flat concrete roof (from directly above, this is the whole tile) -- a
  // darker/greyer tone than it used to be, deliberately distinct from both the reddish-brown brick
  // paving ('7'/'-'/'_' below) and the blue-grey "other building" roof ('~'), so a roof never reads
  // as pavement from the map/minimap. ',' is the AC-unit/skylight speckle on top of it.
  '+': '#9c9488', '=': '#b9876c', ',': '#6e675a', // BITS roof (grey concrete) + roof edge + AC unit
  '^': '#c9ccd3', '~': '#a4a9b3', '·': '#7d818a', // other buildings: wall + roof + roof speckle
  '<': '#7c8088',                          // fence
  // campus kit additions (FB-0006/0011/0014/0015/0016): appended, existing keys unchanged
  '-': '#d9927a', _: '#6f362c',           // paving bevel: highlight + deep shadow
  // FB-0025 addendum (2026-09-21): retuned to match the new Sprout-Lands-sourced tree/hedge/bush
  // ramp below (DRY_LEAVES) so hand-drawn palms don't clash with the recolored pack greenery next
  // to them -- palms were the one tree type Sprout Lands had nothing suitable for (no date palm),
  // so they stay hand-drawn but now share the same dry, Dubai-appropriate green.
  ':': '#8fc463', ';': '#4f7a30',         // date palm fronds: light + dark
  // interior kit (P3, interiors): floor variants per room type + a couple of furniture fabrics.
  // Walls reuse the BITS wall/trim/glass keys above ($ % & *) so buildings match inside and out.
  µ: '#f2ede0', ß: '#ded4bd',             // foyer/lobby floor: light + fleck
  // FB from QA: the atrium void used to be a flat grey checkerboard that read as a missing texture.
  // It's now a darkened version of the foyer floor above (ø/Ø), with a darker vignette band (º) on
  // the ring of void tiles touching the railing, so it reads as a shadowed drop to the floor below.
  ø: '#85827b', Ø: '#7a7568', º: '#55534e',
  '[': '#d7c9a8', ']': '#bfae8a',         // classroom floor: light + plank line
  '{': '#5b6b8a', '}': '#42506b',         // office/club carpet: light + weave
  '¦': '#cfe0e0', '¬': '#a9c2c2',         // lab vinyl: light + speckle
  '§': '#7f9c8f', '¶': '#5f7a6e',         // library carpet: light + weave
  '>': '#4f7ba3', '°': '#3a5a7a',         // sofa fabric: light + shade
  '¤': '#c9a86b',                          // noticeboard cork
  // premium pass (2026-09-26, docs/plans/2026-09-26-premium-pass.md Part 3): navy lettering for the
  // Main Block's "BITS Pilani, Dubai Campus" entrance sign band (docs/research/campus-visual-
  // reference.md "Signage": #1A3A6B, confirmed from the owner's and Wikimedia photos, not gold/white).
  Ñ: '#1a3a6b',
  // Coordinator review round 2 (2026-09-27): ordinary walkways read as brick at any hue -- light warm
  // concrete slabs instead (Pokemon HGSS/BW city sidewalks), a base tone with a slightly darker 1px
  // joint line, both close in luminance so the grid stays subtle, plus an occasional lighter fleck
  // (a third tone, still faint) so the slab isn't perfectly flat up close.
  Å: '#d9d1c3', å: '#c6bcae', ą: '#e6ded0',
  // The Main Block forecourt keeps red-brown pavers, but at small scale and low contrast (a joint
  // ~10% darker than the brick face, not the old high-contrast bevel) so it reads as a floor, not a
  // wall, per the coordinator's exact spec. A third, slightly lighter tone on each brick's own
  // top-left pixel keeps it from being perfectly flat while staying inside that same low-contrast band.
  Æ: '#b06b4a', æ: '#9d6249', ǽ: '#c47f5c',
  // A lighter blue-grey reflection streak on the entrance's dark glass front (`*`), so the glass
  // reads as glazing catching the sky rather than a flat dark fill.
  Œ: '#4a5a68',
  // Interiors rebuild (FB-0030/0031, premium pass stage 5, docs/research/campus-visual-reference.md
  // "2. Main reception foyer"): the owner's own foyer photo -- glossy cream marble (base/highlight/
  // shadow + a darker inlay "runner" band down the centre), black wrought-iron railing (not the
  // fence's grey '<'), cool-white columns, warm chandelier brass/glow, and the ICVL's royal-blue
  // cabinetry, all sampled from the reference photo/spec, not reused from an unrelated hue.
  // Quality loop (docs/quality/scorecard.md, Interior art run 1, 2026-09-28: "the marble reads as
  // sand") -- cooled and desaturated from the first pass's warmer, more golden tones, which read as
  // desert sand once combined with a speckle dither. A genuinely dark, cool taupe for the runner
  // (not a golden tan) so it reads as a stone inlay, not a sand path.
  // Quality loop run 2 (2026-09-28: "a high-contrast white-on-tan checker... floors must be LOW
  // contrast... luminance variation <= ~8%") -- `marbleFleck` moved much closer to `marbleLight`
  // (was a 9.5% jump, now ~5.6%) so the base floor's own remap (remapMarbleFloor, below) never
  // reaches for the far darker `marbleShadow` any more; that tone is now reserved for the runner/
  // stair risers, where strong contrast is the whole point.
  marbleLight: '#f2ede0', marbleFleck: '#e6e0ce', marbleShadow: '#b9ac8e', marbleRunner: '#8f8264',
  marbleRunnerDark: '#786d54',
  floorGreyLight: '#dfe0dc', floorGreyFleck: '#d2d4ce', // the corridor's own tight low-contrast pair
  ironRail: '#2a2a32',
  columnBody: '#efe9da', columnShade: '#d8d0bd',
  chandelierGold: '#e8c46a', chandelierGlow: '#fff6df',
  icvlBlue: '#2f4a7a', icvlBlueHi: '#3a5a8f',
};

// ---------- tiny image + PNG writer ----------

class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }

  set(x, y, key) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const hex = PALETTE[key];
    if (!hex) throw new Error(`Unknown palette key "${key}"`);
    const i = (y * this.w + x) * 4;
    this.data[i] = parseInt(hex.slice(1, 3), 16);
    this.data[i + 1] = parseInt(hex.slice(3, 5), 16);
    this.data[i + 2] = parseInt(hex.slice(5, 7), 16);
    this.data[i + 3] = 255;
  }

  fill(ox, oy, w, h, key) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.set(ox + x, oy + y, key);
  }

  // Like `set`, but takes a raw RGBA quad instead of a PALETTE key (FB-0025: for copying/recoloring
  // pixels out of a vendor atlas, which don't come from our own palette). a=0 is a no-op (leaves
  // whatever's already there alone, so callers don't need to pre-clear); 0<a<255 alpha-blends over
  // the existing pixel instead of overwriting it, since a couple of source packs have soft edges.
  setRGBA(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a === 0) return;
    const i = (y * this.w + x) * 4;
    if (a >= 255) {
      this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
      return;
    }
    const ia = 255 - a;
    this.data[i] = Math.round((r * a + this.data[i] * ia) / 255);
    this.data[i + 1] = Math.round((g * a + this.data[i + 1] * ia) / 255);
    this.data[i + 2] = Math.round((b * a + this.data[i + 2] * ia) / 255);
    this.data[i + 3] = Math.min(255, this.data[i + 3] + a);
  }

  // Filled rectangle with a 1px outline
  box(ox, oy, w, h, key) {
    this.fill(ox, oy, w, h, 'K');
    this.fill(ox + 1, oy + 1, w - 2, h - 2, key);
  }

  draw(rows, ox, oy) {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== '.') this.set(ox + x, oy + y, ch);
      });
    });
  }

  averageColor(ox, oy, w, h) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = oy; y < oy + h; y++) {
      for (let x = ox; x < ox + w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.data[i + 3] === 0) continue;
        r += this.data[i]; g += this.data[i + 1]; b += this.data[i + 2]; n++;
      }
    }
    const hex = (v) => Math.round(v / Math.max(n, 1)).toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  toPNG() {
    const stride = this.w * 4 + 1;
    const raw = Buffer.alloc(stride * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * stride] = 0; // filter: none
      this.data.copy(raw, y * stride + 1, y * this.w * 4, (y + 1) * this.w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // RGBA
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// ---------- vendor atlas: blit + recolor (FB-0025, docs/research/asset-packs.md) ----------
// Copies rectangles out of the CC0 packs in assets/vendor/ instead of drawing pixels by hand, for
// the specific tiles the owner asked to replace (roads/kerbs/paths/greenery/parked cars). Tile
// *names*, their *order* in tiles.json, and their `solid`/`overhead` flags never change here --
// only what gets drawn into a tile's slot, exactly like re-drawing a hand-drawn tile would.

const VENDOR_DIR = path.join(__dirname, '..', 'assets', 'vendor');
const atlasCache = new Map();
// Reads and decodes a vendor PNG once (relative to assets/vendor/), then serves it from a cache --
// several tiles below sample the same sheet.
function loadAtlas(relPath) {
  if (!atlasCache.has(relPath)) {
    atlasCache.set(relPath, decodePNG(fs.readFileSync(path.join(VENDOR_DIR, relPath))));
  }
  return atlasCache.get(relPath);
}

function hexToRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// Copies an sw x sh rectangle from `atlas` (as returned by loadAtlas) into `img` at (dx, dy),
// optionally scaled to a different dw x dh (nearest-neighbor -- vehicle sprites aren't 16x16) and/or
// rotated a quarter turn at a time (kerb edges: one drawn source, rotated per side). `remap(r,g,b,a)`
// recolors each sampled pixel before it's drawn, so a pack's own colors can be pulled onto this
// game's palette instead of sitting next to it looking foreign. Fully transparent source pixels are
// skipped (leaving whatever's already at that destination pixel, usually nothing yet).
function blitAtlas(img, dx, dy, atlas, sx, sy, sw, sh, opts = {}) {
  const { dw = sw, dh = sh, offsetX = 0, offsetY = 0, rotate = 0, flipX = false, flipY = false, remap = null } = opts;
  for (let ddy = 0; ddy < dh; ddy++) {
    for (let ddx = 0; ddx < dw; ddx++) {
      let cx = flipX ? dw - 1 - ddx : ddx;
      let cy = flipY ? dh - 1 - ddy : ddy;
      // Quarter-turn rotations, valid because every rotated blit in this file is square (16x16).
      if (rotate === 90) { const t = cx; cx = cy; cy = dh - 1 - t; }
      else if (rotate === 180) { cx = dw - 1 - cx; cy = dh - 1 - cy; }
      else if (rotate === 270) { const t = cx; cx = dw - 1 - cy; cy = t; }
      const srcX = sx + Math.floor((cx * sw) / dw);
      const srcY = sy + Math.floor((cy * sh) / dh);
      const si = (srcY * atlas.width + srcX) * 4;
      let r = atlas.data[si];
      let g = atlas.data[si + 1];
      let b = atlas.data[si + 2];
      let a = atlas.data[si + 3];
      if (a === 0) continue;
      if (remap) [r, g, b, a] = remap(r, g, b, a);
      img.setRGBA(dx + offsetX + ddx, dy + offsetY + ddy, r, g, b, a);
    }
  }
}

// Buckets a source pixel into one of `rampHexes` (given dark-to-light) by where its luminance falls
// within [loLum, hiLum] -- a *narrow* range fitted to the specific source tile's own shading, not
// 0-255, since a pack tile's highlight/shadow tones usually sit close together. Luminance outside
// that range is treated as a near-black outline (snapped to the game's `#1a1c2c` outline color) or a
// bright paint marking (snapped to `lineHex`), so kerb lines and lane markings stay crisp instead of
// being folded into the material ramp.
function remapShaded(rampHexes, { loLum, hiLum, outlineBelow = 60, lineAbove = 190, lineHex = '#ffffff' } = {}) {
  const ramp = rampHexes.map(hexToRgb);
  const outline = hexToRgb('#1a1c2c');
  const line = hexToRgb(lineHex);
  return (r, g, b, a) => {
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum <= outlineBelow) return [outline[0], outline[1], outline[2], a];
    if (lum >= lineAbove) return [line[0], line[1], line[2], a];
    const t = Math.max(0, Math.min(0.999, (lum - loLum) / (hiLum - loLum)));
    const [nr, ng, nb] = ramp[Math.floor(t * ramp.length)];
    return [nr, ng, nb, a];
  };
}

// The Modern City sheet's asphalt is a near-flat dark grey (~60-68) with bright white/yellow paint
// on top -- recolor the body onto this game's own asphalt ramp ('3'/'4') and snap paint to this
// game's line colors (court-line white '#e8e8e8', accent gold for yellow lines) instead of folding
// the (much brighter) paint into the same narrow luminance bucket as the road surface.
function remapRoad(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  if (r > 150 && g > 100 && b < 100) return [...hexToRgb('#ffd23f'), a]; // yellow line -> accent gold
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum > 150) return [...hexToRgb('#e8e8e8'), a]; // bright paint -> this game's line color
  return [...hexToRgb(lum >= 64 ? '#6d707a' : '#5b5d66'), a]; // asphalt body, 2-tone
}

// The sidewalk paver's brick body sits in a narrow band (~149-166 luminance); its kerb/gutter line
// is a dark near-black edge plus a light grey-blue stripe. Recolor the body onto this game's own
// brick-paving ramp ('8'/'7'/'-') and snap the line to black/white, matching the hand-drawn kerb's
// existing black-and-white gutter line (kept for FB-0014's own regression test).
// premium pass (2026-09-26, docs/research/campus-visual-reference.md "the real ground is a
// herringbone or basket-weave interlocking paver in a warm red-brown (#B06B4A/#8C5236)"): nudged
// browner/redder than the original FB-0025 salmon-pink (#9c5a4a/#c0735c/#d9927a), per that doc's own
// "if there's room in this pass" suggestion -- same 3-stop luminance bucketing, just retuned hexes.
function remapPaver(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 90) return [...hexToRgb('#1a1c2c'), a];
  if (lum > 190) return [...hexToRgb('#ffffff'), a];
  const hex = lum < 153 ? '#8c5236' : lum < 162 ? '#b06b4a' : '#d9a478';
  return [...hexToRgb(hex), a];
}

// This game's own Grass and Leaves ramps (STYLE_GUIDE palette table), reused so pack greenery sits
// on the same hues as the hand-drawn grass/trees around it instead of introducing new colors.
const remapGrass = remapShaded(['#3d8a3f', '#5ab552', '#8fd46a'], { loLum: 113, hiLum: 133 });
const remapLeaves = remapShaded(['#1f5227', '#2f7a3a', '#4fa34a'], { loLum: 118, hiLum: 148 });

// Sprout Lands greenery addendum (2026-09-21, decisions/0012 addendum): a *new*, more muted ramp for
// the pack-sourced trees/hedges/bushes/flowerbed/grass tufts below, deliberately distinct from the
// bright `remapLeaves` ramp above (still used by Kenney's `bush` fallback nowhere now, kept only for
// any other caller) -- the owner asked for "Dubai-dry greens rather than lush farm green" (Sprout
// Lands' own art is bright farm-green), so this ramp centers on the campus lawn's own tone
// (`#6FAE4A`) instead of the saturated Leaves highlight. loLum/hiLum fitted to Basic_Grass_Biom_
// things.png's own decoded luminance range for its leaf tones (~114-207, sampled directly);
// outlineBelow raised to 95 because Sprout Lands outlines its shapes in a dark *purple*-tinted green
// (~lum 77), not nearer-black like Kenney's, so the default 60 cutoff would leave it uncaught.
const remapDryLeaves = remapShaded(['#33501f', '#4f7a30', '#6fae4a'], { loLum: 108, hiLum: 210, outlineBelow: 95, lineAbove: 235 });
// Wraps a remap so it only touches green-dominant pixels (leaves/foliage) and passes anything else
// (a flower's pink petals, say) through unchanged -- for source crops that mix foliage with a
// non-green subject, so the subject keeps its own pack color instead of being folded into the leaf
// ramp by luminance alone.
function remapGreenOnly(greenRemap) {
  return (r, g, b, a) => {
    if (a === 0) return [r, g, b, a];
    if (g > r + 6 && g > b + 6) return greenRemap(r, g, b, a);
    return [r, g, b, a];
  };
}
const remapFlowerLeaf = remapGreenOnly(remapDryLeaves);

// ---------- vendor source rects (docs/research/asset-packs.md) ----------
// Roguelike Modern City pack (Kenney, CC0): 16x16 tiles on a 17px pitch (1px margin). Coordinates
// found by decoding the sheet and eyeballing/measuring crops -- see MEMORY.md for how.
const MODERN_CITY = 'kenney-roguelike-modern-city/Spritesheet/roguelikeCity_magenta.png';
const cityTile = (col, row) => ({ atlas: MODERN_CITY, sx: col * 17, sy: row * 17, sw: 16, sh: 16 });
const PACK = {
  asphalt: cityTile(11, 19), // plain dark asphalt, no markings
  laneDash: cityTile(9, 19), // a short white dash, centered
  crosswalk: cityTile(12, 22), // evenly spaced vertical white bars
  parkingPaint: cityTile(9, 22), // two horizontal white stall-paint bars on asphalt
  kerbPaver: cityTile(0, 22), // brick sidewalk paver with a dark/white gutter line along its bottom edge
  plainPaver: cityTile(0, 19), // the same paver, no line -- for walkway's plain fill
  grass: cityTile(0, 24), // flat speckled grass fill
  bush: cityTile(31, 13), // a round clipped bush/shrub, transparent outside its silhouette (no longer
  // used by `bush` itself, FB-0025 addendum below, but left here as-is since `lawn`/`lawn2` still
  // use PACK.grass as their base fill and the tile stays a legitimate reference).
};
// Sprout Lands Basic pack (Cup Nooble, non-commercial + editing allowed, credited in CREDITS.md):
// outdoor greenery per decisions/0012's addendum. All four rects below are decoded/measured crops
// from the same sheet -- see MEMORY.md for how each one was located (connected-component bounding
// boxes plus eyeballed zoomed crops, since sprites on this sheet aren't laid out on a clean 16x16
// grid the way Kenney's is).
const SPROUT_GRASS_BIOM = 'sprout-lands-basic/Sprout Lands - Sprites - Basic pack/Objects/Basic_Grass_Biom_things.png';
const SPROUT = {
  // A complete, plain round tree (no fruit/blotches) -- canopy only, cropped just above where its
  // trunk begins (row 24 of this crop) so no brown trunk pixel ever enters the green-only canopy
  // remap below. Sampled into the game's existing 32x32 virtual canopy space (canopyQuadrantFromAtlas).
  treeCanopy: { atlas: SPROUT_GRASS_BIOM, sx: 20, sy: 1, sw: 24, sh: 23 },
  // The plain (no-berry) right half of a symmetric round double-bush -- used for the standalone
  // `bush` tile.
  bush: { atlas: SPROUT_GRASS_BIOM, sx: 16, sy: 48, sw: 16, sh: 16 },
  // The flattest, fullest-height cross-section of a long oval bush (avoiding both its rounded end
  // caps and the small brown twig at its right tip) -- opaque top-to-bottom at both its left and
  // right edges, so tiling this same 16x16 crop along a run reads as one continuous hedge with no
  // transparent gap at the seam between tiles (regression test: campus-tiles.test.js).
  hedge: { atlas: SPROUT_GRASS_BIOM, sx: 41, sy: 64, sw: 16, sh: 16 },
  // A small pink flower on a leafy tuft (no soil/pot base) for the flowerbed, and a tiny grass-tuft
  // sprout for lawn2's speckle.
  flower: { atlas: SPROUT_GRASS_BIOM, sx: 96, sy: 48, sw: 16, sh: 16 },
  tuft: { atlas: SPROUT_GRASS_BIOM, sx: 97, sy: 18, sw: 8, sh: 5 },
};
// premium pass (2026-09-26, docs/plans/2026-09-26-premium-pass.md Part 1/2, docs/research/
// asset-packs-2026-09-26.md): Kenney RPG Urban Pack (CC0, assets/vendor/kenney-rpg-urban-pack/),
// 16x16 tiles on a 17px pitch (1px margin) same as Modern City above. Coordinates found the same way
// (decoding the sheet and measuring crops, see MEMORY.md) -- rects below are hand-picked "plain
// piece" and "one edge/corner" tiles from the pack's own plaza-path autotile set (it's a connected
// path kit, not a single repeatable ground fill, so a genuinely border-free tile had to be found by
// scanning every cell's own edges for the pack's blue-purple border color).
const URBAN_SHEET = 'kenney-rpg-urban-pack/Tilemap/tilemap.png';
const urbanTile = (col, row) => ({ atlas: URBAN_SHEET, sx: col * 17, sy: row * 17, sw: 16, sh: 16 });
const URBAN = {
  // premium pass round 2 (2026-09-27): the plaza-path tiles this pack offered for `walkway` are no
  // longer used -- they still read as a brick pattern at any recolor, so ordinary walkways are now
  // hand-drawn concrete instead (see walkway()'s own comment). This table keeps only the props.
  lampPost: urbanTile(0, 6), // a curved-arm street lamp
  bench: urbanTile(3, 14), // a wooden park bench, slatted seat
  bin: urbanTile(10, 9), // a round waste bin
  planter: urbanTile(6, 10), // a wood flower box with two flower colors
  lowFence: urbanTile(4, 12), // a low decorative railing, one straight run segment
  bollard: urbanTile(5, 8), // a striped barrier/bollard
  // Quality loop, category 1 run 3 (2026-09-29): "a few parked cars in the right perspective (Kenney
  // RPG Urban cars are top-down 3/4, use those)" -- this pack's own vehicle row is mostly 2-tile-wide
  // compositions (a hood tile + a body tile side by side), but each colour also has one clean,
  // complete-in-a-single-tile front view a few columns over (found by decoding the sheet and cropping
  // individual cells) -- those are what these three point at, one per colour the sheet offers.
  carFrontYellow: urbanTile(17, 15),
  carFrontRed: urbanTile(17, 17),
  carFrontGreen: urbanTile(21, 15),
};
// premium pass Part 2: Ninja Adventure asset pack (Pixel-boy and AAA, CC0, assets/vendor/
// ninja-adventure/) -- palms (no free pack has date palms in the right pixel style, per the asset
// survey addendum, but this pack's own desert-town "potted palm" prop reads as a good canopy fill once
// recolored) and round shade trees (its Nature tileset's own single round tree, canopy only, same
// "recolor the fill, keep our own hand-drawn trunk/shape" technique FB-0025 already used for Sprout
// Lands -- see canopyQuadrantFromAtlas below). Rects are crops (fronds/canopy only, no pot/trunk
// pixels) found by decoding the sheets and measuring, same method as SPROUT above.
const NINJA_DESERT = 'ninja-adventure/Backgrounds/Tilesets/TilesetDesert.png';
const NINJA_NATURE = 'ninja-adventure/Backgrounds/Tilesets/TilesetNature.png';
const NINJA = {
  // A dense, almost entirely opaque crop from the middle of the frond fan (not the whole plant's own
  // silhouette -- this asset's potted-palm shape doesn't isolate cleanly the way the round tree above
  // does, so this is a texture sample for canopyQuadrantFromAtlas's per-pixel fill, not a shape match;
  // palmCanopyShape (unchanged, ours) still draws the actual frond silhouette).
  palmCanopy: { atlas: NINJA_DESERT, sx: 163, sy: 70, sw: 24, sh: 12 },
  treeCanopy: { atlas: NINJA_NATURE, sx: 204, sy: 254, sw: 32, sh: 18 },
  flag: (color) => ({ atlas: `ninja-adventure/Backgrounds/Animated/Flag/Flag${color}16x16.png`, sx: 0, sy: 0, sw: 16, sh: 16 }),
};

// premium pass round 3 (2026-09-27 continued, coordinator "one coherent free kit" review): more of
// the same Kenney RPG Urban Pack sheet, this time its building parts and a proper concrete-sidewalk
// plot -- round 2 fixed *colors* (flat palette fills tuned to the right hexes) but the coordinator's
// side-by-side photo comparison found flat fills still read as a box with no material at the real
// camera, and separately found that road-facing kerb tiles (kerbT/B/L/R/TL/TR/BL/BR, drawn by a
// completely different code path below until this pass) were still blitting Modern City's brick
// paver recolored to a salmon-brick ramp everywhere a sidewalk meets a road -- the actual reason "the
// avenue is still salmon brick" survived round 2's walkway() rewrite untouched (walkway() only ever
// controlled the *interior* fill, never the road-edge tiles). Coordinates found the same way as URBAN
// above (decoding the sheet, measuring crops), cross-checked against a labelled contact-sheet render
// this time (script kept out of the repo; MEMORY.md has the method and every coordinate's own pixel
// sample) since this pass reads much more of the sheet than Part 1/2 did.
const SIDEWALK = {
  // A complete concrete-plaza 9-slice: a light blue-grey slab fill with its own built-in warm
  // tan/khaki kerb border baked into the edge/corner pieces -- literally "a sidewalk with a kerb
  // edge" in one asset family. Used unrecolored (the coordinator's own "or only slightly warmed" --
  // native is already close enough) for every ordinary walkway *and* every road-facing kerb tile
  // (kerbEdge below now points at this same table instead of Modern City's brick paver).
  fill: urbanTile(9, 4),
  edgeT: urbanTile(9, 3), edgeB: urbanTile(9, 5), edgeL: urbanTile(8, 4), edgeR: urbanTile(10, 4),
  cornerTL: urbanTile(8, 3), cornerTR: urbanTile(10, 3), cornerBL: urbanTile(8, 5), cornerBR: urbanTile(10, 5),
};
// Building parts: a red-brick wall-with-coping (one crop for the cap row, one for the plain body,
// one for the base/plinth row -- the coping band sits at the *top* edge of the cap crop and the
// *bottom* edge of the base crop), a tan arched window (frame + glass, already close to this game's
// sand wall so needs the least recoloring), a wide glass double door (two tiles, left+right halves
// of one picture), a plain glass panel with and without a green sill (the portico's own flanking
// glass, not the door itself), a free-standing pillar (transparent margin -- a prop, not a wall
// crop), and a 3-tread stone staircase.
const BLDG = {
  cap: urbanTile(18, 0),
  body: urbanTile(18, 2),
  base: urbanTile(18, 3),
  window: urbanTile(13, 13),
  doorL: urbanTile(7, 15), doorR: urbanTile(8, 15),
  glassPanel: urbanTile(9, 13), glassPanelBase: urbanTile(9, 14),
  pillar: urbanTile(2, 10),
  step1: urbanTile(0, 12), step2: urbanTile(0, 13), step3: urbanTile(0, 14),
};
// A plain pole shaft (the bare post beneath one of the sheet's own street signs, cropped of its own
// sign) -- see flagPoleBase/flagPoleTop below, replacing the single squat Ninja "flag on a stick"
// tile the coordinator described as reading like a hand axe at this scale.
const FLAG_POLE_SRC = urbanTile(4, 7);
const BUS_STOP_SIGN_SRC = urbanTile(6, 6); // a plaque-on-a-pole street sign, native blue

// Buckets a wall pixel by HUE first, not just luminance: this sheet's brick body and its tan coping
// share overlapping luminance bands (sampled directly -- MEMORY.md), so a plain remapShaded ramp
// would smear one into the other. `r - b` cleanly separates them (brick body samples at r-b > ~100;
// tan coping/plinth at r-b < ~40). Brick -> this game's own sand wall body (#e3c09b, the
// coordinator's exact hex); tan coping -> the existing `wallHi` cream (#f2ddb8, reused so a recolored
// roofline matches every hand-drawn cap band already using that key) with a terracotta shadow at its
// own darker edge.
function remapBitsWall(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (r - b > 60) {
    if (lum < 105) return [...hexToRgb('#a86a44'), a];
    if (lum < 125) return [...hexToRgb('#e3c09b'), a];
    return [...hexToRgb('#f0d6b0'), a];
  }
  if (lum < 150) return [...hexToRgb('#b5583c'), a];
  if (lum < 200) return [...hexToRgb('#f2ddb8'), a];
  return [...hexToRgb('#f8ecd4'), a];
}
// Same hue-split, but the tan band becomes a genuinely *darker* cool plinth course instead of a light
// coping -- round 2's own "darker plinth, not just a thin shadow line" ask, now built from a real
// Kenney crop instead of a flat fill.
function remapBitsWallBase(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (r - b > 60) {
    if (lum < 105) return [...hexToRgb('#a86a44'), a];
    if (lum < 125) return [...hexToRgb('#e3c09b'), a];
    return [...hexToRgb('#f0d6b0'), a];
  }
  if (lum < 150) return [...hexToRgb('#4f4536'), a];
  if (lum < 200) return [...hexToRgb('#6b7280'), a]; // baseCool's own hex, reused
  return [...hexToRgb('#7d8290'), a];
}
// The tan window frame is already close to the sand wall -- darken its own shadow edge to terracotta
// for definition, lighten its face to the sand body, and leave the glass pane exactly as drawn.
function remapBitsWindow(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 150) return [...hexToRgb('#b5583c'), a];
  if (lum < 210) return [...hexToRgb('#e3c09b'), a];
  return [r, g, b, a];
}
// The door/glass-panel's dark navy frame becomes terracotta; the light blue-white glass (and its own
// reflection tones) are left exactly as the pack drew them -- "a big glass entrance", not a flat
// recolor of the glass itself.
function remapBitsDoorFrame(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 115) return [...hexToRgb('#8a4530'), a];
  return [r, g, b, a];
}
// A neutral light stone for the staircase, and a terracotta pillar for the portico columns -- both
// plain grey-purple on the sheet, recolored the same luminance-ramp way every other pack crop in this
// file already is (lineAbove pushed out of range since these crops have no separate bright accent to
// snap away from -- the ramp alone covers their whole tonal range).
const remapLightStone = remapShaded(['#8a8a94', '#d6d2c8', '#efece4'], { loLum: 90, hiLum: 190, outlineBelow: 0, lineAbove: 500 });
const remapBitsColumn = remapShaded(['#8a4530', '#b5583c', '#d97850'], { loLum: 85, hiLum: 195, outlineBelow: 0, lineAbove: 500 });

// Pixel Vehicle Pack (Kenney, CC0): irregular small top-down sprites, not on the 16x16 tile grid --
// each is its own PNG, decoded on demand (they're 4-bit palette images, see tools/lib/png-decode.js).
const VEHICLE_DIR = 'kenney-pixel-vehicle-pack/PNG/Cars';
function vehicleSprite(file) {
  return loadAtlas(path.join(VEHICLE_DIR, file));
}
// Scales a whole vehicle sprite down (nearest-neighbor) to fit inside maxW x maxH, keeping its
// aspect ratio, and centers it in the 16x16 tile -- these sprites are their own irregular size
// (e.g. a 29x13 sedan), not pre-cut to the tile grid like the Modern City sheet.
function blitVehicle(img, x, y, atlas, { maxW = 16, maxH = 12 } = {}) {
  const scale = Math.min(maxW / atlas.width, maxH / atlas.height);
  const dw = Math.max(1, Math.round(atlas.width * scale));
  const dh = Math.max(1, Math.round(atlas.height * scale));
  blitAtlas(img, x, y, atlas, 0, 0, atlas.width, atlas.height, {
    dw,
    dh,
    offsetX: Math.round((TILE - dw) / 2),
    offsetY: Math.round((TILE - dh) / 2),
  });
}

// ---------- interior furniture kit, 2026-09-22 (docs/research/asset-packs.md addendum) ----------
// Owner brief: "find [free asset packs] on your own... take what you need, customise and add it in
// here" -- the hand-drawn interior furniture looked poor. Same blit+recolor technique as the outdoor
// kit above, three more sources: LimeZu's own furniture sheet (same pack the walls/floors and
// characters already come from, ADR 0012/0013 -- so these pieces are guaranteed to match, no recolor
// needed), Cool School (CC0, downloaded 2026-09-20 for the original survey but never wired in until
// now -- its pastel palette *does* need recoloring, per that survey's own verdict), and two newly
// downloaded CC-BY packs for the two gaps neither of the above covers: auditorium seating and
// science-lab equipment. Exact source rects were found by decoding each sheet (connected-component
// bounding-box scan / grid overlay) rather than eyeballed from a screenshot -- see MEMORY.md.

// LimeZu Modern Interiors Free (non-commercial + editing allowed, ADR 0012): the furniture sheet,
// not yet mined before this pass (only the Room Builder wall swatches and character sheets were).
const LIMEZU_FURNITURE = 'limezu-modern-interiors-free/Modern tiles_Free/Interiors_free/16x16/Interiors_free_16x16.png';
const LIMEZU = {
  desk: { atlas: LIMEZU_FURNITURE, sx: 83, sy: 580, sw: 27, sh: 28 }, // a single classroom/office desk with an open book
  chalkboard: { atlas: LIMEZU_FURNITURE, sx: 162, sy: 640, sw: 26, sh: 24 }, // freestanding chalkboard on its own easel/stand
  corkboard: { atlas: LIMEZU_FURNITURE, sx: 2, sy: 650, sw: 27, sh: 17 }, // a corkboard with pinned notes
  globe: { atlas: LIMEZU_FURNITURE, sx: 207, sy: 576, sw: 16, sh: 22 },
  cabinet: { atlas: LIMEZU_FURNITURE, sx: 192, sy: 639, sw: 13, sh: 26 }, // grey office/lab storage cabinet
  plant: { atlas: LIMEZU_FURNITURE, sx: 192, sy: 723, sw: 14, sh: 19 }, // a compact potted plant
  ottoman: { atlas: LIMEZU_FURNITURE, sx: 13, sy: 161, sw: 36, sh: 33 }, // a cushioned bench (foyer/lounge seating)
};

// Cool School Tileset (NettySvit, CC0, assets/vendor/cool-school-tileset/): a clean 48x48 grid (see
// its own SOURCE.txt), 1/3 scale = exactly 16x16. Coordinates for the tile-grid items are cell
// multiples of 48; the small clutter items (chairs/computers/books, lower rows) have real transparent
// margins and were located with a connected-component bounding-box scan instead.
const COOL_SCHOOL_SHEET = 'cool-school-tileset/CoolSchool_tileset.png';
const COOL_SCHOOL = {
  teacherDesk: { atlas: COOL_SCHOOL_SHEET, sx: 0, sy: 357, sw: 96, sh: 50 }, // desk w/ drawers + kneehole
  locker: { atlas: COOL_SCHOOL_SHEET, sx: 336, sy: 192, sw: 48, sh: 96 }, // the round-handle 2-tall locker
  bookshelf: { atlas: COOL_SCHOOL_SHEET, sx: 240, sy: 0, sw: 48, sh: 96 },
  computer: { atlas: COOL_SCHOOL_SHEET, sx: 8, sy: 487, sw: 35, sh: 41 }, // CRT + keyboard
  printer: { atlas: COOL_SCHOOL_SHEET, sx: 197, sy: 498, sw: 38, sh: 28 }, // flatbed scanner/printer
  books: { atlas: COOL_SCHOOL_SHEET, sx: 6, sy: 534, sw: 37, sh: 36 }, // a stacked pile of books
};

// "Laboratory Tileset PixelArt 16px" ("Land of Pixels") by marceles, CC BY 4.0,
// assets/vendor/landofpixels-laboratory-tileset/ -- three crops from its tilesStuff.png sheet, kept
// mostly in the pack's own colors (like the parked cars: "they already read fine... next to the
// bright... campus palette") since its blue/grey/green console-and-tank look already reads as generic
// lab equipment once placed on this game's own lab-vinyl floor.
const LAB_SHEET = 'landofpixels-laboratory-tileset/16px/tilesStuff.png';
const LAB_PACK = {
  bench: { atlas: LAB_SHEET, sx: 431, sy: 146, sw: 50, sh: 30 }, // a plain lab workbench
  tank: { atlas: LAB_SHEET, sx: 492, sy: 111, sw: 22, sh: 55 }, // a tall chemistry/bio apparatus tank
  rack: { atlas: LAB_SHEET, sx: 527, sy: 141, sw: 32, sh: 50 }, // an equipment/server rack
};

// "Pixel Seating" by Molly "Cougarmint" Willits, CC-BY 3.0, assets/vendor/pixel-seating/: a single
// theatre seat, front view -- already close to this game's own red seat ramp, so no recolor needed.
const SEATING_CHAIR = 'pixel-seating/Chair1_front.png';

// Quality loop, Interior art run 1 (docs/quality/scorecard.md 2026-09-28, "3/10... 1-tile vertical
// wall strips... the marble reads as sand"): LimeZu's own Room_Builder sheet, not mined before this
// pass (only its furniture sheet, Interiors_free_16x16.png, was) -- real 3/4-view walls (a light
// "cap" row where the wall meets the ceiling, then a genuinely 2-tile-tall coloured face row below
// it) and real floor textures, instead of every wall/floor being a single hand-drawn 16x16 tile.
// Coordinates found the same way as every other pack mined in this file: decoding the sheet and
// measuring grid cells directly (see MEMORY.md), not guessed from the README thumbnail. The sheet's
// own layout: 8 wall colourways stacked vertically, each 2 rows tall (a light cap row, then a
// coloured face row), 3 tileable columns wide; a separate floor-texture block to the right, each
// pattern also 2 rows tall (2 closely-related variants) x 3 (or, for the plainer "noise" family, 6)
// columns wide.
const ROOM_BUILDER = 'limezu-modern-interiors-free/Modern tiles_Free/Interiors_free/16x16/Room_Builder_free_16x16.png';
function rb(col, row) {
  return { atlas: ROOM_BUILDER, sx: col * 16, sy: row * 16, sw: 16, sh: 16 };
}
const RB = {
  wallCreamCap: rb(0, 7), wallCreamFace: rb(0, 8), // the palest of the 8 colourways -- closest to the owner's cream/white foyer walls
  floorStoneCap: rb(11, 11), floorStoneFace: rb(11, 12), // a plain light stone/slab floor with a subtle panel seam -- the "polished stone" candidate
  floorTiled: rb(11, 7), // a cream tile with a raised cross/waffle pattern -- a genuinely *tiled* floor for corridors
  floorWood: rb(0, 12), // the first wood-plank wall colourway's own face row, reused flat as a wood floor (real plank-grain pixels, not a hand-drawn ramp)
  floorLight: rb(14, 5), // the palest "noise" floor variant -- a light, low-contrast tile for labs
};
// The cream wall family, recoloured onto this game's own marble ramp (the exact 3-tone palette the
// foyer floor below also uses, so the walls and floor read as one coherent cream-stone hall instead
// of two unrelated materials) -- sampled range (MEMORY.md: decoded and measured directly) covers
// this crop's own light-tan bands, 61-248, its outline sitting right at the bottom of that range.
const remapMarbleWall = remapShaded(['marbleShadow', 'marbleFleck', 'marbleLight'].map((k) => PALETTE[k]), { loLum: 120, hiLum: 230, outlineBelow: 90, lineAbove: 500 });
// Quality loop run 2 (docs/quality/scorecard.md, 2026-09-28: "a high-contrast white-on-tan checker
// (graph paper)... floors must be LOW contrast: a near-uniform light cream/grey with only subtle 1px
// joint lines"). Run 1's floor remap reached across all 3 marble tones (shadow-to-light, a ~40%
// luminance swing) for a crop whose own tonal range is just two close clusters (155-157 / 171-173) --
// every "high" pixel snapped to the lightest tone and every "low" pixel to the darkest, which is
// exactly a checker, not a subtle seam. Two tones only now (`marbleFleck`/`marbleLight`, ~5.6% apart,
// under the "~8%" ceiling), the same tight loLum/hiLum window so the crop's own two clusters still
// land on two *different* (if barely) output tones -- a joint line, not a jump.
const remapMarbleFloor = remapShaded(['marbleFleck', 'marbleLight'].map((k) => PALETTE[k]), { loLum: 152, hiLum: 176, outlineBelow: 0, lineAbove: 500 });
// The runner: the same floor crop's own seam structure, mapped onto a darker taupe ramp instead of a
// flat fill, so the inlay band still reads as stone (with real pack pixels), just a shade darker --
// deliberately higher-contrast than the base floor (the brief's own "strong pattern goes only in a
// narrow border/inlay band or the runner").
const remapMarbleRunner = remapShaded(['marbleRunnerDark', 'marbleRunner', 'marbleShadow'].map((k) => PALETTE[k]), { loLum: 152, hiLum: 176, outlineBelow: 0, lineAbove: 500 });
// The corridor's own tiled floor (quality loop run 2: same "LOW contrast" rule) -- a cooler grey
// pair instead of marble's cream, matching STYLE_GUIDE's "corridors are grey-flecked, utilitarian".
// RB.floorTiled's own range (182-235) is wider than the stone crop's, so a wider loLum/hiLum window,
// still landing on only two close output tones.
const remapCorridorTile = remapShaded(['floorGreyFleck', 'floorGreyLight'].map((k) => PALETTE[k]), { loLum: 182, hiLum: 235, outlineBelow: 0, lineAbove: 500 });
// The ICVL/Physics Lab's own light floor -- same idea, kept close to its native pale grey (126-149)
// rather than the noticeably bluer/darker stone/corridor tones, so the 3 room types still read as
// distinct floor materials at a glance.
const remapLabFloor = remapShaded(['#d7d9d3', '#e3e4de'], { loLum: 126, hiLum: 149, outlineBelow: 0, lineAbove: 500 });

// Scales an arbitrary sw x sh crop from `atlas` down (nearest-neighbor, aspect preserved) to fit
// inside maxW x maxH, then sits it on the tile's own base line (bottom-aligned, like a piece of
// furniture standing on the floor) rather than centering vertically -- the same idea as blitVehicle
// above, but for a sub-rectangle of a larger sheet instead of a whole standalone file.
function blitFit(img, x, y, atlas, sx, sy, sw, sh, { maxW = 16, maxH = 15, remap = null, bottomPad = 1 } = {}) {
  const scale = Math.min(maxW / sw, maxH / sh, 1);
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  blitAtlas(img, x, y, atlas, sx, sy, sw, sh, {
    dw,
    dh,
    offsetX: Math.round((TILE - dw) / 2),
    offsetY: TILE - dh - bottomPad,
    remap,
  });
}

// Shorthand for blitFit from one of the LIMEZU/COOL_SCHOOL/LAB_PACK rect tables above, instead of
// repeating `loadAtlas(rect.atlas), rect.sx, rect.sy, rect.sw, rect.sh` at every call site.
function blitRect(img, x, y, rect, opts) {
  blitFit(img, x, y, loadAtlas(rect.atlas), rect.sx, rect.sy, rect.sw, rect.sh, opts);
}

// Cool School's own palette is pastel pink/purple/orange (confirmed by the original survey's
// mockup) -- a hard clash with this game's warm wood/stone ramps, so every piece from it is
// recolored the same way the outdoor packs are: bucket by luminance onto this game's own ramps
// (STYLE_GUIDE.md "Wood": #cf9a66/#b98150/#7a4a24/#5a3418).
const remapSchoolWood = remapShaded(['#5a3418', '#7a4a24', '#b98150', '#cf9a66'], { loLum: 80, hiLum: 205, outlineBelow: 65 });
// The CRT computer/printer's own blue-grey plastic, recolored onto this game's stone/screen ramp
// (STYLE_GUIDE.md "Stone" plus the screen-blue 'I' key) instead of Cool School's lilac-tinted grey.
const remapSchoolScreen = remapShaded(['#4a4a55', '#9a9a9a', '#c8c8c8'], { loLum: 70, hiLum: 200, outlineBelow: 55, lineAbove: 230 });

// Coordinator review round 3 (2026-09-27): this used to blit Modern City's brick paver-with-gutter-
// line tile (PACK.kerbPaver), recolored via remapPaver to a salmon-brick ramp, as the *entire* 16x16
// tile for every kerbT/B/L/R/TL/TR/BL/BR -- i.e. every road-facing edge of every sidewalk in the
// game, avenue included. Round 2's walkway() rewrite never touched this code path, which is the real
// reason the avenue still read as brick after that pass. kerbT/B/L/R/TL/TR/BL/BR now just reuse the
// same Kenney concrete-sidewalk edge/corner pieces as an ordinary pedestrian walkway (see
// walkway()/walkwayEdge()/walkwayCorner() below) -- one sidewalk material for the whole campus,
// whether it's bordering a road or a lawn.

// Seeded random so the art is the same every time you run the script.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (r, min, max) => min + Math.floor(r() * (max - min + 1));

function sprite(name, rows, w = TILE, h = TILE) {
  if (rows.length !== h || rows.some((row) => row.length !== w)) {
    throw new Error(`${name} must be ${w}x${h}; row lengths: ${rows.map((row) => row.length).join(',')}`);
  }
  return rows;
}

function forEachPixel(fn) {
  for (let yy = 0; yy < TILE; yy++) for (let xx = 0; xx < TILE; xx++) fn(xx, yy);
}

function outline(img, x, y, { top, bottom, left, right }) {
  for (let i = 0; i < TILE; i++) {
    if (top) img.set(x + i, y, 'K');
    if (bottom) img.set(x + i, y + TILE - 1, 'K');
    if (left) img.set(x, y + i, 'K');
    if (right) img.set(x + TILE - 1, y + i, 'K');
  }
}

// ---------- outdoor tiles ----------

const TREE = sprite('tree', [
  '......KKKK......',
  '....KKTTTTKK....',
  '...KTTTtTTTTK...',
  '..KTTtTTTTTtTK..',
  '.KTTTTTTTtTTTTK.',
  '.KTtTTTTTTTTtTK.',
  'KTTTTTtTTTTTTTTK',
  'KTTTTTTTTTtTTTTK',
  'KTtTTTTTTTTTTteK',
  '.KeTTTTTTTTTTeK.',
  '..KeeTTTTTTeeK..',
  '...KKeeeeeeKK...',
  '......KNNK......',
  '......KNnK......',
  '.....KNNnNK.....',
  '......KKKK......',
]);

const ROCK = sprite('rock', [
  '................',
  '................',
  '................',
  '................',
  '......KKKK......',
  '....KKOOOOKK....',
  '...KOQQOOOOOK...',
  '..KOQOOOOOOOoK..',
  '..KOOOOOOOOOoK..',
  '..KOOOOOOOOooK..',
  '...KoOOOOOooK...',
  '....KKooooKK....',
  '......KKKK......',
  '................',
  '................',
  '................',
]);

const BLADES = sprite('blades', [
  '........',
  '..k...k.',
  '.kg..kg.',
  '.gk.kgk.',
  'kgg.ggk.',
  'kgk.kgg.',
  '.kk..kk.',
  '........',
], 8, 8);

function grass(img, ox, oy, seed) {
  img.fill(ox, oy, TILE, TILE, 'G');
  const r = rng(seed);
  for (let i = 0; i < 4; i++) {
    const x = randInt(r, 1, 14);
    const y = randInt(r, 0, 13);
    img.set(ox + x - 1, oy + y, 'g');
    img.set(ox + x + 1, oy + y, 'g');
    img.set(ox + x, oy + y + 1, 'g');
  }
  for (let i = 0; i < 3; i++) img.set(ox + randInt(r, 0, 15), oy + randInt(r, 0, 15), 'l');
}

function flower(img, x, y, petal) {
  img.set(x, y, 'Y');
  img.set(x - 1, y, petal);
  img.set(x + 1, y, petal);
  img.set(x, y - 1, petal);
  img.set(x, y + 1, petal);
}

// ---------- house (outside) ----------

function roof(img, x, y, edges = {}) {
  forEachPixel((xx, yy) => {
    const seam = (yy >> 2) % 2 ? 4 : 0;
    let key = 'X';
    if (yy % 4 === 3 || xx % 8 === seam) key = 'x';
    else if (yy % 4 === 0 && (xx - seam + 8) % 8 < 3) key = 'j';
    img.set(x + xx, y + yy, key);
  });
  outline(img, x, y, edges);
}

function eave(img, x, y, edges = {}) {
  roof(img, x, y);
  img.fill(x, y + 12, TILE, 2, 'x');
  img.fill(x, y + 14, TILE, 1, 'K');
  img.fill(x, y + 15, TILE, 1, 'v');
  outline(img, x, y, edges);
}

function wall(img, x, y, edges = {}) {
  img.fill(x, y, TILE, TILE, 'V');
  for (const row of [0, 5, 10, 15]) img.fill(x, y + row, TILE, 1, 'v');
  outline(img, x, y, edges);
}

function houseWindow(img, x, y) {
  wall(img, x, y);
  img.box(x + 3, y + 3, 10, 9, 'w');
  img.fill(x + 7, y + 4, 2, 7, 'K');
  img.fill(x + 4, y + 7, 8, 1, 'K');
  img.set(x + 5, y + 5, 'W');
  img.set(x + 5, y + 6, 'W');
  img.fill(x + 2, y + 12, 12, 1, 'n');
}

function door(img, x, y) {
  wall(img, x, y);
  img.box(x + 3, y + 2, 10, 14, 'N');
  img.fill(x + 6, y + 3, 1, 12, 'n');
  img.fill(x + 9, y + 3, 1, 12, 'n');
  img.set(x + 10, y + 9, 'Y');
}

// ---------- house (inside) ----------

function floor(img, x, y) {
  forEachPixel((xx, yy) => {
    const odd = (yy >> 2) % 2;
    let key = 'F';
    if (yy % 4 === 3 || xx === (odd ? 11 : 3)) key = 'f';
    else if (yy % 4 === 0 && xx === (odd ? 13 : 5)) key = 'i';
    img.set(x + xx, y + yy, key);
  });
}

function wallpaper(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, xx % 4 === 0 ? 'z' : 'Z'));
}

function wallUpper(img, x, y) {
  wallpaper(img, x, y);
  img.fill(x, y, TILE, 3, 'E');
  img.fill(x, y + 3, TILE, 1, 'q');
}

function wallLower(img, x, y) {
  wallpaper(img, x, y);
  img.fill(x, y + 11, TILE, 1, 'q');
  img.fill(x, y + 12, TILE, 1, 'i');
  img.fill(x, y + 13, TILE, 2, 'N');
  img.fill(x, y + 15, TILE, 1, 'n');
}

function wallWindow(img, x, y) {
  wallLower(img, x, y);
  img.box(x + 3, y + 1, 10, 9, 'w');
  img.fill(x + 7, y + 2, 2, 7, 'K');
  img.fill(x + 4, y + 5, 8, 1, 'K');
  img.set(x + 5, y + 3, 'W');
  img.set(x + 5, y + 4, 'W');
  img.fill(x + 2, y + 10, 12, 1, 'n');
}

function edge(img, x, y) {
  img.fill(x, y, TILE, TILE, 'E');
  const r = rng(31);
  for (let i = 0; i < 10; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), 'q');
}

function doorway(img, x, y) {
  img.fill(x, y, TILE, TILE, 'q');
  img.fill(x, y, TILE, 1, 'f');
}

function doormat(img, x, y) {
  floor(img, x, y);
  img.box(x + 1, y + 3, 14, 10, 'L');
  img.fill(x + 2, y + 5, 12, 1, 'y');
  img.fill(x + 2, y + 10, 12, 1, 'y');
}

function rug(img, x, y) {
  forEachPixel((xx, yy) => {
    const pattern = (xx + yy) % 8 === 0 || (xx - yy + 16) % 8 === 0;
    img.set(x + xx, y + yy, pattern ? 'y' : 'C');
  });
}

function table(img, x, y) {
  floor(img, x, y);
  img.box(x + 2, y + 9, 3, 6, 'n');
  img.box(x + 11, y + 9, 3, 6, 'n');
  img.box(x + 1, y + 2, 14, 9, 'N');
  img.fill(x + 2, y + 3, 12, 1, 'i');
}

function bedHead(img, x, y) {
  floor(img, x, y);
  img.fill(x + 1, y + 4, 14, 12, 'K');
  img.fill(x + 2, y + 5, 12, 4, 'W');
  img.fill(x + 2, y + 9, 12, 7, 'I');
  img.fill(x + 2, y + 9, 12, 1, 'm');
  img.box(x + 1, y, 14, 5, 'N');
  img.box(x + 4, y + 4, 8, 5, 'W');
}

function bedFoot(img, x, y) {
  floor(img, x, y);
  img.fill(x + 1, y, 1, 12, 'K');
  img.fill(x + 14, y, 1, 12, 'K');
  img.fill(x + 2, y, 12, 12, 'I');
  img.fill(x + 2, y + 3, 12, 1, 'm');
  img.box(x + 1, y + 11, 14, 5, 'N');
}

// 2026-09-22: the shelf icon itself is now Cool School's bookshelf sprite (CC0, recolored onto this
// game's wood ramp -- its own pastel palette clashed, per docs/research/asset-packs.md), replacing
// the hand-drawn colored-books grid below. The wallLower backdrop is unchanged (this tile is reused
// as-is for library shelving/mini-mart shelving per INTERIORS_PLAN.md, always shown against a wall).
function bookshelf(img, x, y) {
  wallLower(img, x, y);
  blitFit(img, x, y, loadAtlas(COOL_SCHOOL.bookshelf.atlas), COOL_SCHOOL.bookshelf.sx, COOL_SCHOOL.bookshelf.sy, COOL_SCHOOL.bookshelf.sw, COOL_SCHOOL.bookshelf.sh, {
    maxW: 15, maxH: 16, bottomPad: 0, remap: remapSchoolWood,
  });
}

// 2026-09-22: a LimeZu potted plant (same pack as the walls/floors, no recolor needed) over the
// existing floor backdrop, replacing the hand-drawn round shrub below.
function plant(img, x, y) {
  floor(img, x, y);
  blitFit(img, x, y, loadAtlas(LIMEZU.plant.atlas), LIMEZU.plant.sx, LIMEZU.plant.sy, LIMEZU.plant.sw, LIMEZU.plant.sh, { maxW: 14, maxH: 15 });
}

// premium pass round 2 (2026-09-27): the Main Block sign message, as data (STYLE_GUIDE "content is
// data") -- moved above TILES because the `...SIGN_SEGMENTS.map(...)` spread below evaluates eagerly
// at array-construction time (unlike a `draw: (img,x,y) => fn(...)` closure, which only reads a
// same-named function later and so can point at something defined further down the file).
// build-campus.js only needs `SIGN_SEGMENTS.length` and places `bitsSignSeg0..N` in order.
const MAIN_SIGN_TEXT = 'BITS PILANI, DUBAI CAMPUS';
const SIGN_CHARS_PER_TILE = 3;
const SIGN_SEGMENTS = Array.from(
  { length: Math.ceil(MAIN_SIGN_TEXT.length / SIGN_CHARS_PER_TILE) },
  (_, i) => MAIN_SIGN_TEXT.slice(i * SIGN_CHARS_PER_TILE, i * SIGN_CHARS_PER_TILE + SIGN_CHARS_PER_TILE).padEnd(SIGN_CHARS_PER_TILE, ' '),
);

// Quality loop, category 1 run 3 (2026-09-29): "the plaza gets... the 'welcomes you' sign board, per
// the photo" -- a free-standing 2-tile board (not the fascia wordmark above), 4 chars/tile (no gap
// between glyphs, same as gateSign's single-tile "BITS") since SIGN_FONT_4X6's glyphs are exactly 4px
// wide and the tile is 16px. build-campus.js only needs WELCOME_SIGN_SEGMENTS.length and places
// `welcomeSignSeg0..N` in order, the same convention as bitsSignSeg above.
const WELCOME_SIGN_TEXT = 'WELCOME';
const WELCOME_SIGN_CHARS_PER_TILE = 4;
const WELCOME_SIGN_SEGMENTS = Array.from(
  { length: Math.ceil(WELCOME_SIGN_TEXT.length / WELCOME_SIGN_CHARS_PER_TILE) },
  (_, i) => WELCOME_SIGN_TEXT.slice(i * WELCOME_SIGN_CHARS_PER_TILE, i * WELCOME_SIGN_CHARS_PER_TILE + WELCOME_SIGN_CHARS_PER_TILE).padEnd(WELCOME_SIGN_CHARS_PER_TILE, ' '),
);

// Quality loop, category 1 run 1 (2026-09-28): "lawn tufts repeat on a rigid grid (wallpaper
// look)" -- lawn2 is one static pre-rendered tile (always the same tuft, same seed), and
// build-campus.js's old lawnPatch() picked it on a strict 6x6-tile checkerboard, so the exact same
// tuft stamped out a printed-looking grid. These three extra variants (a 2-tuft cluster, a denser
// 3-tuft cluster, a single wildflower) give lawnPatch's new deterministic-hash scatter (see that
// function's own comment in tools/campus/build-campus.js) real variety to pick from, still mostly
// plain lawn/lawn2 -- "keep large plain areas".
function lawnTuftCluster(img, x, y, seed, count) {
  blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass });
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    blitAtlas(img, x + randInt(r, 0, 8), y + randInt(r, 0, 10), loadAtlas(SPROUT.tuft.atlas), SPROUT.tuft.sx, SPROUT.tuft.sy, 8, 5, { remap: remapDryLeaves });
  }
}
function lawnFlowerSpeck(img, x, y, seed) {
  blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass });
  const r = rng(seed);
  flower(img, x + randInt(r, 2, 13), y + randInt(r, 2, 13), r() < 0.5 ? 'W' : 'P');
}

// Quality loop, category 1 run 1 (2026-09-28): a proper Gate 2 (point 6 -- "two gate pillars with
// the BITS sign, a security booth, a barrier arm, and planters with plants"). The pillars reuse
// bitsColumnTile (the same terracotta column the Main Block portico already uses); this adds the
// small sign plaque between them, a compact security booth, and a red/white barrier arm.
function gateSign(img, x, y) {
  img.fill(x, y, TILE, TILE, 'wallHi'); // cream fascia, matches the Main Block's own sign band
  img.fill(x, y, TILE, 1, 'K');
  img.fill(x, y + 13, TILE, 3, '&'); // terracotta base trim, ties it to the rest of the BITS kit
  [...'BITS'].forEach((ch, i) => {
    const glyph = SIGN_FONT_4X6[ch] || SIGN_FONT_4X6[' '];
    const gx = x + i * 4;
    const gy = y + 4;
    glyph.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') img.set(gx + rx, gy + ry, 'Ñ'); }));
  });
}
function securityBooth(img, x, y) {
  img.fill(x, y, TILE, TILE, '$'); // sand wall body, the same BITS wall tone as every other building
  img.fill(x, y, TILE, 2, 'K'); // flat dark roof cap
  img.fill(x, y + 2, TILE, 1, 'wallHi'); // parapet highlight line
  img.fill(x + 3, y + 5, 10, 7, '&'); // terracotta window frame
  img.fill(x + 4, y + 6, 8, 5, '*'); // glass
  img.set(x + 6, y + 7, 'W'); // glint
  img.fill(x, y + 14, TILE, 2, 'baseCool'); // plinth, meets the ground
}
function barrierArm(img, x, y) {
  // A raised red/white boom barrier across the road, on a low post at one end -- reads clearly
  // enough as "the gate arm" as a flat horizontal bar at this scale (a true diagonal/raised barrier
  // would need a rotated sprite, more than this pass needs).
  img.box(x, y + 6, 3, 5, 'K'); // post
  img.fill(x + 3, y + 7, TILE - 3, 3, '#'); // pale bar body
  for (let xx = 3; xx < TILE; xx += 4) img.fill(x + xx, y + 7, 2, 3, 'archRed');
}

// Order here = tile index. The game looks tiles up by name via assets/tiles.json,
// so reordering is safe; `solid` tiles block the player.
const TILES = [
  // outdoors
  // FB-0025: flat grass fill from the Modern City pack (assets/vendor/, CC0), recolored onto this
  // game's own Grass ramp. grass2 gets a few darker tufts so a run of tiles doesn't look stamped.
  {
    name: 'grass',
    draw: (img, x, y) => blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass }),
  },
  {
    name: 'grass2',
    draw: (img, x, y) => {
      blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass });
      const r = rng(3);
      for (let i = 0; i < 4; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), 'g');
    },
  },
  {
    name: 'flowers',
    draw: (img, x, y) => {
      grass(img, x, y, 4);
      flower(img, x + 3, y + 4, 'W');
      flower(img, x + 11, y + 9, 'P');
      flower(img, x + 6, y + 12, 'W');
    },
  },
  {
    name: 'tallgrass',
    draw: (img, x, y) => {
      grass(img, x, y, 3);
      for (const [bx, by] of [[0, 0], [8, 0], [0, 8], [8, 8]]) img.draw(BLADES, x + bx, y + by);
    },
  },
  {
    name: 'path',
    draw: (img, x, y) => {
      img.fill(x, y, TILE, TILE, 'D');
      const r = rng(9);
      for (let i = 0; i < 8; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), 'd');
      for (let i = 0; i < 4; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), 'p');
    },
  },
  {
    name: 'water',
    solid: true,
    draw: (img, x, y) => {
      img.fill(x, y, TILE, TILE, 'U');
      const r = rng(11);
      for (let i = 0; i < 3; i++) {
        const wx = randInt(r, 1, 10);
        const wy = randInt(r, 1, 13);
        for (let k = 0; k < 3; k++) img.set(x + wx + k, y + wy, 'w');
        for (let k = 1; k < 4; k++) img.set(x + wx + k, y + wy + 1, 'u');
      }
    },
  },
  { name: 'tree', solid: true, draw: (img, x, y) => { grass(img, x, y, 5); img.draw(TREE, x, y); } },
  { name: 'rock', solid: true, draw: (img, x, y) => { grass(img, x, y, 6); img.draw(ROCK, x, y); } },

  // house, outside
  { name: 'roofTL', solid: true, draw: (img, x, y) => roof(img, x, y, { top: true, left: true }) },
  { name: 'roofT', solid: true, draw: (img, x, y) => roof(img, x, y, { top: true }) },
  { name: 'roofTR', solid: true, draw: (img, x, y) => roof(img, x, y, { top: true, right: true }) },
  { name: 'eaveL', solid: true, draw: (img, x, y) => eave(img, x, y, { left: true }) },
  { name: 'eave', solid: true, draw: (img, x, y) => eave(img, x, y) },
  { name: 'eaveR', solid: true, draw: (img, x, y) => eave(img, x, y, { right: true }) },
  { name: 'wallL', solid: true, draw: (img, x, y) => wall(img, x, y, { left: true }) },
  { name: 'wall', solid: true, draw: (img, x, y) => wall(img, x, y) },
  { name: 'wallR', solid: true, draw: (img, x, y) => wall(img, x, y, { right: true }) },
  { name: 'houseWindow', solid: true, draw: houseWindow },
  { name: 'door', draw: door },

  // house, inside
  { name: 'floor', draw: floor },
  { name: 'wallUpper', solid: true, draw: wallUpper },
  { name: 'wallLower', solid: true, draw: wallLower },
  { name: 'wallWindow', solid: true, draw: wallWindow },
  { name: 'edge', solid: true, draw: edge },
  { name: 'doorway', draw: doorway },
  { name: 'doormat', draw: doormat },
  { name: 'rug', draw: rug },
  { name: 'table', solid: true, draw: table },
  { name: 'bedHead', solid: true, draw: bedHead },
  { name: 'bedFoot', solid: true, draw: bedFoot },
  { name: 'bookshelf', solid: true, draw: bookshelf },
  { name: 'plant', solid: true, draw: plant },

  // campus (tools/campus/build-campus.js). 1 tile = 2 m outdoors.
  { name: 'sand', draw: (img, x, y) => speckle(img, x, y, '1', '2', 45, 12) },
  { name: 'campusGround', draw: (img, x, y) => speckle(img, x, y, '5', '6', 49, 10) },
  // FB-0025: plain asphalt from the Modern City pack, recolored onto this game's own asphalt ramp.
  { name: 'asphalt', draw: (img, x, y) => blitAtlas(img, x, y, loadAtlas(PACK.asphalt.atlas), PACK.asphalt.sx, PACK.asphalt.sy, 16, 16, { remap: remapRoad }) },
  { name: 'paving', draw: paving },
  { name: 'parking', draw: parkingBay },
  { name: 'track', draw: runningTrack },
  { name: 'turf', draw: turf },
  { name: 'court', draw: (img, x, y) => img.fill(x, y, TILE, TILE, '@') },
  { name: 'fence', solid: true, draw: fence },
  { name: 'bitsRoof', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '+', '=', ',') },
  { name: 'bitsWall', solid: true, draw: bitsWall },
  { name: 'bitsDoor', draw: bitsDoor },
  { name: 'otherRoof', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '~', '<', '·') },
  { name: 'otherWall', solid: true, draw: otherWall },

  // ---- campus kit additions, appended after the original 44 tiles (indices are stable) ----

  // FB-0014: road kerbs + pavement, lane markings, a crossing, and bordered walkways.
  // kerbT/B/L/R = a straight border where a paved sidewalk band meets the road on that side of the
  // tile; kerbTL/TR/BL/BR = the corner where two of those borders meet, for a rectangular road area.
  { name: 'kerbT', draw: (img, x, y) => kerbEdge(img, x, y, 'T') },
  { name: 'kerbB', draw: (img, x, y) => kerbEdge(img, x, y, 'B') },
  { name: 'kerbL', draw: (img, x, y) => kerbEdge(img, x, y, 'L') },
  { name: 'kerbR', draw: (img, x, y) => kerbEdge(img, x, y, 'R') },
  { name: 'kerbTL', draw: (img, x, y) => kerbEdge(img, x, y, 'TL') },
  { name: 'kerbTR', draw: (img, x, y) => kerbEdge(img, x, y, 'TR') },
  { name: 'kerbBL', draw: (img, x, y) => kerbEdge(img, x, y, 'BL') },
  { name: 'kerbBR', draw: (img, x, y) => kerbEdge(img, x, y, 'BR') },
  { name: 'roadLineH', draw: roadLineH },
  { name: 'roadLineV', draw: roadLineV },
  { name: 'crossingH', draw: crossingH },
  { name: 'crossingV', draw: crossingV },
  { name: 'walkway', draw: walkway },

  // FB-0015/FB-0025: lush lawn variants (now the Modern City pack's grass fill, FB-0025 -- flatter
  // than the old procedural ramp on its own, but it doesn't repeat as an obvious grid, and it sits
  // right next to the pack's own paths/kerbs/hedges without clashing), clipped hedge, round bush, a
  // flower bed, and two kinds of tree. Trees are split into a solid trunk (ground level) and a 2x2
  // overhead canopy (see STYLE_GUIDE).
  { name: 'lawn', draw: (img, x, y) => blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass }) },
  {
    name: 'lawn2',
    draw: (img, x, y) => {
      blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass });
      // FB-0025 addendum: a small Sprout Lands grass-tuft sprite (SPROUT.tuft) instead of loose dark
      // dots, so lawn2 doesn't look like the exact same stamp as `lawn` -- and now reads as a little
      // planted tuft instead of a few stray pixels.
      const r = rng(75);
      blitAtlas(img, x + randInt(r, 0, 8), y + randInt(r, 0, 10), loadAtlas(SPROUT.tuft.atlas), SPROUT.tuft.sx, SPROUT.tuft.sy, 8, 5, { remap: remapDryLeaves });
    },
  },
  { name: 'hedge', solid: true, draw: hedge },
  { name: 'bush', solid: true, draw: bush },
  { name: 'flowerbed', solid: true, draw: flowerbed },
  { name: 'treeTrunk', solid: true, draw: treeTrunk },
  // premium pass (2026-09-26, Part 2): the fill is now Ninja Adventure's own round tree (its Nature
  // tileset), replacing Sprout Lands -- same "our shape, its fill" technique FB-0025 used, and the
  // same remapDryLeaves ramp so it still sits with the rest of the dry-campus-green palette.
  { name: 'treeCanopyTL', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 0, 0, roundCanopyShape, NINJA.treeCanopy) },
  { name: 'treeCanopyTR', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 1, 0, roundCanopyShape, NINJA.treeCanopy) },
  { name: 'treeCanopyBL', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 0, 1, roundCanopyShape, NINJA.treeCanopy) },
  { name: 'treeCanopyBR', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 1, 1, roundCanopyShape, NINJA.treeCanopy) },
  { name: 'palmTrunk', solid: true, draw: palmTrunk },
  // premium pass (Part 2): the frond fill is now Ninja Adventure's desert-tileset potted palm
  // (cropped to fronds only, no pot -- our own trunk/neck shape stays exactly as FB-0019 built it,
  // same "our shape, its fill" technique as the round tree above, still on the palm's own dry-green
  // palette keys since remapDryLeaves already matches them).
  { name: 'palmCanopyTL', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 0, 0, palmCanopyShape, NINJA.palmCanopy) },
  { name: 'palmCanopyTR', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 1, 0, palmCanopyShape, NINJA.palmCanopy) },
  { name: 'palmCanopyBL', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 0, 1, palmCanopyShape, NINJA.palmCanopy) },
  { name: 'palmCanopyBR', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 1, 1, palmCanopyShape, NINJA.palmCanopy) },

  // FB-0016: a tennis court kit. See the arrangement comment above courtSurface() below for how
  // these combine into a standard 18x9-tile court (36x18 m including run-off).
  { name: 'courtLineH', draw: courtLineH },
  { name: 'courtLineV', draw: courtLineV },
  { name: 'courtCornerTL', draw: (img, x, y) => courtCorner(img, x, y, 'B', 'R') },
  { name: 'courtCornerTR', draw: (img, x, y) => courtCorner(img, x, y, 'B', 'L') },
  { name: 'courtCornerBL', draw: (img, x, y) => courtCorner(img, x, y, 'T', 'R') },
  { name: 'courtCornerBR', draw: (img, x, y) => courtCorner(img, x, y, 'T', 'L') },
  { name: 'courtCenterMark', draw: courtCenterMark },
  { name: 'courtNet', draw: courtNet },

  // FB-0011: cleaner BITS + other-building fronts (small windows, corners, roof parapet, entrance,
  // pillar) and a straight fence kit (horizontal/vertical runs, corners, and a walkable gate).
  { name: 'bitsWallPlain', solid: true, draw: bitsWallPlain },
  { name: 'bitsWallEndL', solid: true, draw: (img, x, y) => bitsWallEnd(img, x, y, 'L') },
  { name: 'bitsWallEndR', solid: true, draw: (img, x, y) => bitsWallEnd(img, x, y, 'R') },
  { name: 'bitsRoofT', solid: true, draw: (img, x, y) => bitsRoofEdge(img, x, y, { top: true }) },
  { name: 'bitsRoofL', solid: true, draw: (img, x, y) => bitsRoofEdge(img, x, y, { left: true }) },
  { name: 'bitsRoofR', solid: true, draw: (img, x, y) => bitsRoofEdge(img, x, y, { right: true }) },
  { name: 'bitsRoofTL', solid: true, draw: (img, x, y) => bitsRoofEdge(img, x, y, { top: true, left: true }) },
  { name: 'bitsRoofTR', solid: true, draw: (img, x, y) => bitsRoofEdge(img, x, y, { top: true, right: true }) },
  { name: 'bitsEntranceL', draw: (img, x, y) => bitsEntrance(img, x, y, true, false) },
  { name: 'bitsEntranceR', draw: (img, x, y) => bitsEntrance(img, x, y, false, false) },
  { name: 'bitsPillar', solid: true, draw: bitsPillar },
  { name: 'otherWallPlain', solid: true, draw: otherWallPlain },
  { name: 'otherWallEndL', solid: true, draw: (img, x, y) => otherWallEnd(img, x, y, 'L') },
  { name: 'otherWallEndR', solid: true, draw: (img, x, y) => otherWallEnd(img, x, y, 'R') },
  { name: 'otherRoofT', solid: true, draw: (img, x, y) => otherRoofEdge(img, x, y, { top: true }) },
  { name: 'otherRoofL', solid: true, draw: (img, x, y) => otherRoofEdge(img, x, y, { left: true }) },
  { name: 'otherRoofR', solid: true, draw: (img, x, y) => otherRoofEdge(img, x, y, { right: true }) },
  { name: 'otherRoofTL', solid: true, draw: (img, x, y) => otherRoofEdge(img, x, y, { top: true, left: true }) },
  { name: 'otherRoofTR', solid: true, draw: (img, x, y) => otherRoofEdge(img, x, y, { top: true, right: true }) },
  { name: 'fenceH', solid: true, draw: fenceH },
  { name: 'fenceV', solid: true, draw: fenceV },
  { name: 'fenceCornerTL', solid: true, draw: (img, x, y) => fenceCorner(img, x, y, 'B', 'R') },
  { name: 'fenceCornerTR', solid: true, draw: (img, x, y) => fenceCorner(img, x, y, 'B', 'L') },
  { name: 'fenceCornerBL', solid: true, draw: (img, x, y) => fenceCorner(img, x, y, 'T', 'R') },
  { name: 'fenceCornerBR', solid: true, draw: (img, x, y) => fenceCorner(img, x, y, 'T', 'L') },
  { name: 'fenceGate', draw: fenceGate },

  // ADR 0009: a thin-line tennis net with end posts (FB-0020) and a building-name signboard.
  { name: 'courtNetPostT', draw: (img, x, y) => courtNetPost(img, x, y, 'T') },
  { name: 'courtNetPostB', draw: (img, x, y) => courtNetPost(img, x, y, 'B') },
  { name: 'signboard', solid: true, draw: signboard },

  // ---------- interior kit (P3: Main/Library/Mechanical Block interiors, 1 m/tile) ----------
  { name: 'intFloorFoyer', draw: intFloorFoyer },
  { name: 'intFloorClassroom', draw: intFloorClassroom },
  { name: 'intFloorCarpet', draw: intFloorCarpet },
  { name: 'intFloorLabVinyl', draw: intFloorLabVinyl },
  { name: 'intFloorLibrary', draw: intFloorLibrary },
  { name: 'intFloorStage', draw: intFloorStage },
  { name: 'intFloorCourt', draw: intFloorCourt },
  { name: 'intDoorway', draw: intDoorway },
  { name: 'intStairsUp', draw: intStairsUp },
  { name: 'intStairsDown', draw: intStairsDown },
  { name: 'intLift', solid: true, draw: intLift },
  { name: 'intAtriumVoid', solid: true, draw: intAtriumVoid },
  { name: 'intAtriumVoidEdge', solid: true, draw: intAtriumVoidEdge },
  { name: 'intAtriumRailing', solid: true, draw: intAtriumRailing },
  { name: 'intDesk', solid: true, draw: intDesk },
  { name: 'intTeacherDesk', solid: true, draw: intTeacherDesk },
  { name: 'intWhiteboardWall', solid: true, draw: intWhiteboardWall },
  { name: 'intBench', solid: true, draw: intBench },
  { name: 'intComputerBench', solid: true, draw: intComputerBench },
  { name: 'intSink', solid: true, draw: intSink },
  { name: 'intCabinet', solid: true, draw: intCabinet },
  { name: 'intSofa', solid: true, draw: intSofa },
  { name: 'intNoticeboard', solid: true, draw: intNoticeboard },
  { name: 'intReceptionDesk', solid: true, draw: intReceptionDesk },
  { name: 'intLocker', solid: true, draw: intLocker },
  { name: 'intAuditoriumSeat', solid: true, draw: intAuditoriumSeat },
  { name: 'intBadmintonNet', draw: intBadmintonNet },
  { name: 'intCourtLineIndoor', draw: intCourtLineIndoor },
  { name: 'intTTTable', solid: true, draw: intTTTable },
  { name: 'intBed', solid: true, draw: intBed },
  { name: 'intCurtain', solid: true, draw: intCurtain },
  { name: 'intMedicalDesk', solid: true, draw: intMedicalDesk },
  { name: 'intMachine', solid: true, draw: intMachine },

  // ---- FB-0025: parked cars, Pixel Vehicle Pack (assets/vendor/, CC0) ----
  // Decoration for tools/campus/build-campus.js's parking lot: a few colors/models for variety,
  // kept in their pack colors (no palette remap -- they already read fine next to the bright,
  // saturated campus palette, per docs/research/asset-packs.md's own mockup). Each sprite is scaled
  // down to fit inside one tile, since the pack's cars aren't pre-cut to a 16x16 grid.
  { name: 'carSedan', solid: true, draw: (img, x, y) => blitVehicle(img, x, y, vehicleSprite('sedan.png')) },
  { name: 'carSedanBlue', solid: true, draw: (img, x, y) => blitVehicle(img, x, y, vehicleSprite('sedan_blue.png')) },
  { name: 'carSuv', solid: true, draw: (img, x, y) => blitVehicle(img, x, y, vehicleSprite('suv_green.png')) },
  { name: 'carVan', solid: true, draw: (img, x, y) => blitVehicle(img, x, y, vehicleSprite('van_small.png')) },

  // ---- BITS building kit addendum (2026-09-21, decisions/0012 addendum): the Main Block's real,
  // grander entrance -- glass front under a genuinely red arch, per docs/research/bits-dubai-campus.md
  // "Look (from photos)". Separate tile names (not a parameter on the existing bitsEntranceL/R) so
  // Library/Mechanical/hostels keep the ordinary entrance look and only the Main Block gets this one
  // (tools/campus/layout.js's `grand: true`, tools/campus/build-campus.js drawBuilding).
  // premium pass (2026-09-26, FB-0029): redrawn in place (name/index unchanged) as the real Main
  // Block entrance -- a terracotta portal frame around a dark glass double door -- see
  // bitsEntranceGrand's own comment below for the full design.
  { name: 'bitsEntranceGrandL', draw: (img, x, y) => bitsEntranceGrand(img, x, y, true, false) },
  { name: 'bitsEntranceGrandR', draw: (img, x, y) => bitsEntranceGrand(img, x, y, false, false) },

  // ---- BITS building kit addendum (2026-09-21, coordinator review): a 4-tile-tall front facade,
  // one dedicated tile per band, so a BITS building's front reads as a real wall with windows from
  // a normal standing distance instead of a couple of thin bands under a huge roof. See the
  // functions' own comment above for the full reasoning. ----
  { name: 'bitsFacadeCap', solid: true, draw: bitsFacadeCap },
  { name: 'bitsFacadeCapEndL', solid: true, draw: (img, x, y) => bitsFacadeCapEnd(img, x, y, 'L') },
  { name: 'bitsFacadeCapEndR', solid: true, draw: (img, x, y) => bitsFacadeCapEnd(img, x, y, 'R') },
  { name: 'bitsFacadeWindow', solid: true, draw: bitsFacadeWindow },
  { name: 'bitsFacadeWindowEndL', solid: true, draw: (img, x, y) => bitsFacadeWindowEnd(img, x, y, 'L') },
  { name: 'bitsFacadeWindowEndR', solid: true, draw: (img, x, y) => bitsFacadeWindowEnd(img, x, y, 'R') },
  { name: 'bitsFacadeBody', solid: true, draw: bitsFacadeBody },
  { name: 'bitsFacadeBodyEndL', solid: true, draw: (img, x, y) => bitsFacadeBodyEnd(img, x, y, 'L') },
  { name: 'bitsFacadeBodyEndR', solid: true, draw: (img, x, y) => bitsFacadeBodyEnd(img, x, y, 'R') },
  { name: 'bitsFacadeBase', solid: true, draw: bitsFacadeBase },
  { name: 'bitsFacadeBaseEndL', solid: true, draw: (img, x, y) => bitsFacadeBaseEnd(img, x, y, 'L') },
  { name: 'bitsFacadeBaseEndR', solid: true, draw: (img, x, y) => bitsFacadeBaseEnd(img, x, y, 'R') },

  // ---- 2026-09-22 interior furniture kit refresh (docs/research/asset-packs.md addendum): new
  // props the owner's brief named that the original interior kit didn't have a piece for yet.
  // Appended at the very end of the catalog so every existing tile's index stays unchanged.
  { name: 'intLabBench', solid: true, draw: intLabBench },
  { name: 'intLabTank', solid: true, draw: intLabTank },
  { name: 'intLabRack', solid: true, draw: intLabRack },
  { name: 'intCanteenCounter', solid: true, draw: intCanteenCounter },
  { name: 'intPrinter', solid: true, draw: intPrinter },
  { name: 'intBooksStack', solid: true, draw: intBooksStack },
  { name: 'intGlobe', solid: true, draw: intGlobe },
  { name: 'intWaterCooler', solid: true, draw: intWaterCooler },
  { name: 'intVendingMachine', solid: true, draw: intVendingMachine },
  { name: 'intBin', solid: true, draw: intBin },

  // ---- premium pass (2026-09-26, docs/plans/2026-09-26-premium-pass.md): appended at the very end
  // so every existing tile's name/index stays stable. ----

  // Part 1 (FB-0028): the walkway network's own edge/corner tiles (see walkway()'s comment).
  { name: 'walkwayEdgeT', draw: (img, x, y) => walkwayEdge(img, x, y, 'T') },
  { name: 'walkwayEdgeB', draw: (img, x, y) => walkwayEdge(img, x, y, 'B') },
  { name: 'walkwayEdgeL', draw: (img, x, y) => walkwayEdge(img, x, y, 'L') },
  { name: 'walkwayEdgeR', draw: (img, x, y) => walkwayEdge(img, x, y, 'R') },
  { name: 'walkwayCornerTL', draw: (img, x, y) => walkwayCorner(img, x, y, 'TL') },
  { name: 'walkwayCornerTR', draw: (img, x, y) => walkwayCorner(img, x, y, 'TR') },
  { name: 'walkwayCornerBL', draw: (img, x, y) => walkwayCorner(img, x, y, 'BL') },
  { name: 'walkwayCornerBR', draw: (img, x, y) => walkwayCorner(img, x, y, 'BR') },

  // Part 2: campus props (Kenney RPG Urban Pack + Ninja Adventure flags).
  { name: 'lampPost', solid: true, draw: lampPost },
  { name: 'bench', solid: true, draw: bench },
  { name: 'bin', solid: true, draw: bin },
  { name: 'planter', solid: true, draw: planter },
  { name: 'lowFence', solid: true, draw: lowFence },
  { name: 'bollard', solid: true, draw: bollard },
  { name: 'flagPoleYellow', solid: true, draw: (img, x, y) => flagPoleBase(img, x, y) },
  { name: 'flagPoleBlue', solid: true, draw: (img, x, y) => flagPoleBase(img, x, y) },
  { name: 'flagPoleRed', solid: true, draw: (img, x, y) => flagPoleBase(img, x, y) },

  // Part 3 (FB-0029): the Main Block's portico columns, glass canopy, open-door variants and its
  // "BITS PILANI, DUBAI CAMPUS" sign-band lettering (one tile per character actually used).
  { name: 'bitsEntranceColumn', solid: true, draw: bitsEntranceColumn },
  { name: 'bitsEntranceCanopy', solid: true, draw: bitsEntranceCanopy },
  { name: 'bitsEntranceGrandLOpen', draw: (img, x, y) => bitsEntranceGrand(img, x, y, true, true) },
  { name: 'bitsEntranceGrandROpen', draw: (img, x, y) => bitsEntranceGrand(img, x, y, false, true) },
  { name: 'bitsSignB', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'B') },
  { name: 'bitsSignI', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'I') },
  { name: 'bitsSignT', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'T') },
  { name: 'bitsSignS', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'S') },
  { name: 'bitsSignP', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'P') },
  { name: 'bitsSignL', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'L') },
  { name: 'bitsSignA', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'A') },
  { name: 'bitsSignN', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'N') },
  { name: 'bitsSignD', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'D') },
  { name: 'bitsSignU', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'U') },
  { name: 'bitsSignC', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'C') },
  { name: 'bitsSignM', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, 'M') },
  { name: 'bitsSignComma', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, ',') },
  { name: 'bitsSignSpace', solid: true, draw: (img, x, y) => bitsSignGlyph(img, x, y, ' ') },

  // premium pass round 2 (2026-09-27, coordinator review): the composed entrance prefab's own
  // pieces, plus the general per-building 3D-feel shadow. Appended at the very end so every
  // existing tile's name/index stays stable.
  { name: 'bitsFacadeShadow', draw: bitsFacadeShadow },
  { name: 'bitsPorticoFrame', solid: true, draw: bitsPorticoFrame },
  { name: 'bitsPorticoGlassTop', solid: true, draw: bitsPorticoGlassTop },
  { name: 'bitsPorticoGlassMid', solid: true, draw: bitsPorticoGlassMid },
  // Coordinator review round 2 (2026-09-27): non-solid, unlike the window/body glass above it -- the
  // pedestrian walkway network's own door-connecting spur is 3 tiles wide and centred on the door
  // (an existing, deliberate exception, `crossWalls: true` in tools/campus/build-campus.js), so it
  // legitimately reaches the 2 columns immediately either side of the door at ground level. Making
  // this one row walkable (a player "stands in front of the glass", not through it) avoids stranding
  // that spur's own tiles instead of fighting the router to avoid a path it's explicitly allowed to take.
  { name: 'bitsPorticoGlassBase', draw: bitsPorticoGlassBase },
  { name: 'bitsStep1', draw: bitsStep1 },
  { name: 'bitsStep2', draw: bitsStep2 },
  { name: 'bitsStep3', draw: bitsStep3 },
  ...SIGN_SEGMENTS.map((text3, i) => ({ name: `bitsSignSeg${i}`, solid: true, draw: (img, x, y) => bitsSignSegment(img, x, y, text3) })),

  // premium pass round 3 (2026-09-27, coordinator review, "one coherent free kit"): the flag's own
  // overhead top-of-pole tile (see flagPoleTop's comment), and a bus stop sign prop. Appended at the
  // very end so every existing tile's name/index stays stable.
  { name: 'flagTopYellow', overhead: true, draw: (img, x, y) => flagPoleTop(img, x, y, 'Yellow') },
  { name: 'flagTopBlue', overhead: true, draw: (img, x, y) => flagPoleTop(img, x, y, 'Blue') },
  { name: 'flagTopRed', overhead: true, draw: (img, x, y) => flagPoleTop(img, x, y, 'Red') },
  { name: 'busStopSign', solid: true, draw: busStopSign },

  // Interiors rebuild (FB-0030/0031, premium pass stage 5, docs/INTERIORS_PLAN.md): the Main Block
  // foyer per the owner's photo, plus the ICVL/Physics Lab/Room 195 key-room dressing. Appended at
  // the very end so every existing tile's name/index stays stable.
  { name: 'intFloorMarble', draw: intFloorMarble },
  { name: 'intFloorMarbleRunner', draw: intFloorMarbleRunner },
  { name: 'intColumn', solid: true, draw: intColumn },
  // Quality loop run 2 (2026-09-28): these two names now draw the staircase's *rail* edge tiles
  // (intFoyerStairsRailL/R) instead of a per-tile flight variant -- reusing the existing tile
  // names/indices rather than adding new ones, per "tile names stay stable, append only".
  { name: 'intFoyerStairsL', solid: true, draw: intFoyerStairsRailL },
  { name: 'intFoyerStairsR', solid: true, draw: intFoyerStairsRailR },
  { name: 'intFoyerLanding', solid: true, draw: intFoyerLanding },
  // Quality loop run 2: this name now draws the 2x2 chandelier's own top-left quadrant (see
  // intChandelierTR/BL/BR, appended further down) instead of a single small 1-tile fixture.
  { name: 'intChandelier', overhead: true, draw: intChandelierTL },
  { name: 'intGlassDoorOpen', draw: intGlassDoorOpen },
  { name: 'intDoorClosed', solid: true, draw: intDoorClosed },
  { name: 'intIcvlBench', solid: true, draw: intIcvlBench },
  { name: 'intServerRack', solid: true, draw: intServerRack },
  { name: 'intLabBenchWood', solid: true, draw: intLabBenchWood },
  { name: 'intProjectorScreen', solid: true, draw: intProjectorScreen },

  // Quality loop, category 1 run 1 (2026-09-28): fixes for the "Outdoor art" rating (docs/quality/
  // scorecard.md). Appended at the very end so every existing tile's name/index stays stable.
  { name: 'lampPostTop', overhead: true, draw: lampPostTop },
  { name: 'bitsRoofB', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '+', '=', ',', 1) },
  { name: 'bitsRoofC', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '+', '=', ',', 2) },
  { name: 'otherRoofB', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '~', '<', '·', 1) },
  { name: 'otherRoofC', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '~', '<', '·', 2) },
  { name: 'lawn3', draw: (img, x, y) => lawnTuftCluster(img, x, y, 151, 2) },
  { name: 'lawn4', draw: (img, x, y) => lawnTuftCluster(img, x, y, 233, 3) },
  { name: 'lawn5', draw: (img, x, y) => lawnFlowerSpeck(img, x, y, 311) },
  { name: 'gateSign', solid: true, draw: gateSign },
  { name: 'securityBooth', solid: true, draw: securityBooth },
  { name: 'barrierArm', draw: barrierArm },
  // Quality loop (docs/quality/scorecard.md, Interior art run 1, 2026-09-28): real LimeZu
  // Room_Builder walls (2 tiles tall: a cap + a face) and floors, replacing the hand-drawn 1-tile
  // wall strips and the sand-reading "marble". Appended at the very end so every existing tile's
  // name/index stays stable.
  { name: 'intWallCap', solid: true, draw: intWallCap },
  { name: 'intWallFace', solid: true, draw: intWallFace },
  { name: 'intWallFaceEndL', solid: true, draw: intWallFaceEndL },
  { name: 'intWallFaceEndR', solid: true, draw: intWallFaceEndR },
  { name: 'intWallWindow', solid: true, draw: intWallWindow },
  { name: 'intFloorTiled', draw: intFloorTiled },
  { name: 'intFloorLabLight', draw: intFloorLabLight },

  // Quality loop, Interior art run 2 (2026-09-28): the staircase's plain (no-rail) tread, the
  // chandelier's other 3 quadrants, a chair/stool, a plain ICVL cabinet, and 3 varied-equipment lab
  // bench tops. Appended at the very end so every existing tile's name/index stays stable.
  { name: 'intFoyerTreadPlain', solid: true, draw: intFoyerTread },
  { name: 'intChandelierTR', overhead: true, draw: intChandelierTR },
  { name: 'intChandelierBL', overhead: true, draw: intChandelierBL },
  { name: 'intChandelierBR', overhead: true, draw: intChandelierBR },
  { name: 'intChair', solid: true, draw: intChair },
  { name: 'intIcvlCabinet', solid: true, draw: intIcvlCabinet },
  { name: 'intFumeHood', solid: true, draw: intFumeHood },
  { name: 'intLabBenchScope', solid: true, draw: intLabBenchScope },
  { name: 'intLabBenchFlask', solid: true, draw: intLabBenchFlask },
  { name: 'intLabBenchLaptop', solid: true, draw: intLabBenchLaptop },

  // Quality loop, Interior art run 3 (2026-09-29): the interior potted plant (no brick-floor
  // background), round columns, a rug, a bigger reception desk's end caps, wall posters/nameplates,
  // and an equipment trolley. Appended at the very end so every existing tile's name/index stays
  // stable.
  { name: 'intPottedPlant', solid: true, draw: intPottedPlant },
  { name: 'intColumnCapL', solid: true, draw: intColumnCapL },
  { name: 'intColumnCapR', solid: true, draw: intColumnCapR },
  { name: 'intColumnShaftL', solid: true, draw: intColumnShaftL },
  { name: 'intColumnShaftR', solid: true, draw: intColumnShaftR },
  { name: 'intColumnBaseL', solid: true, draw: intColumnBaseL },
  { name: 'intColumnBaseR', solid: true, draw: intColumnBaseR },
  { name: 'intRug', draw: intRug },
  { name: 'intReceptionDeskL', solid: true, draw: intReceptionDeskL },
  { name: 'intReceptionDeskR', solid: true, draw: intReceptionDeskR },
  { name: 'intWallPoster', solid: true, draw: intWallPoster },
  { name: 'intNameplate', solid: true, draw: intNameplate },
  { name: 'intEquipmentTrolley', solid: true, draw: intEquipmentTrolley },

  // Quality loop, category 1 run 3 (2026-09-29): the Main Block forecourt's own free-standing
  // "welcomes you" board (docs reference photo), distinct from the fascia wordmark above -- appended
  // at the very end so every existing tile's name/index stays stable.
  ...WELCOME_SIGN_SEGMENTS.map((text4, i) => ({ name: `welcomeSignSeg${i}`, solid: true, draw: (img, x, y) => welcomeSignSegment(img, x, y, text4) })),

  // Quality loop, category 1 run 3 (2026-09-29) continued: "more outdoor detail... bike racks near
  // hostels, benches under trees, a few parked cars in the right perspective, shade sails or a bus
  // shelter at the bus stop". Appended at the very end so every existing tile's name/index stays
  // stable.
  { name: 'busShelter', solid: true, draw: busShelter },
  { name: 'bikeRack', solid: true, draw: bikeRack },
  { name: 'carFrontYellow', solid: true, draw: (img, x, y) => blitAtlas(img, x, y, loadAtlas(URBAN.carFrontYellow.atlas), URBAN.carFrontYellow.sx, URBAN.carFrontYellow.sy, 16, 16) },
  { name: 'carFrontRed', solid: true, draw: (img, x, y) => blitAtlas(img, x, y, loadAtlas(URBAN.carFrontRed.atlas), URBAN.carFrontRed.sx, URBAN.carFrontRed.sy, 16, 16) },
  { name: 'carFrontGreen', solid: true, draw: (img, x, y) => blitAtlas(img, x, y, loadAtlas(URBAN.carFrontGreen.atlas), URBAN.carFrontGreen.sx, URBAN.carFrontGreen.sy, 16, 16) },
];

// ---------- campus tiles ----------

function speckle(img, x, y, base, speck, seed, count) {
  img.fill(x, y, TILE, TILE, base);
  const r = rng(seed);
  for (let i = 0; i < count; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), speck);
}

// Coordinator review round 2 (2026-09-27): the Main Block forecourt keeps red-brown pavers, but the
// old running-bond brick (8px bricks, a bright highlight + a dark shadow bevel on every brick) read
// as a wall at the real camera. Small-scale interlock instead -- each brick is only 4x2 px, one joint
// tone about 10% darker than the face (no highlight/shadow bevel at all), so up close it reads as a
// finely-jointed floor rather than individually-lit blocks.
function paving(img, x, y) {
  forEachPixel((xx, yy) => {
    const offset = (yy >> 1) % 2 ? 2 : 0; // running bond, offset every 2px row
    const withinRow = yy % 2;
    const brickX = (xx + offset) % 4;
    const joint = withinRow === 1 || brickX === 3;
    const highlight = !joint && withinRow === 0 && brickX === 0; // each brick's own top-left pixel
    img.set(x + xx, y + yy, joint ? 'æ' : highlight ? 'ǽ' : 'Æ');
  });
}

// FB-0025: the pack's own parking-paint tile (PACK.parkingPaint, two horizontal stall-line bars)
// looked good as a single tile, but tiled across a whole lot its bars line up into a wall-to-wall
// horizontal ladder that reads as crosswalk stripes covering the entire lot, not individual stalls
// -- worse than the original, so it's not used here (kept in PACK for reference/other uses). Instead:
// the pack's own plain-asphalt fill (already used for `asphalt`, so the lot matches its own aisles)
// plus the single hand-drawn stall-divider column from before FB-0025, which reads cleanly at any
// lot size and pairs correctly with the parked-car tiles now sitting in every other column.
function parkingBay(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.asphalt.atlas), PACK.asphalt.sx, PACK.asphalt.sy, 16, 16, { remap: remapRoad });
  img.fill(x, y, 1, TILE, '#');
}

function runningTrack(img, x, y) {
  img.fill(x, y, TILE, TILE, '9');
  img.fill(x, y + 7, TILE, 1, '0');
  img.fill(x, y + 15, TILE, 1, '0');
}

function turf(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, xx < 8 ? '!' : '?'));
}

function fence(img, x, y) {
  speckle(img, x, y, '5', '6', 43, 6);
  img.fill(x + 1, y + 1, 2, 12, '<');
  img.fill(x + 9, y + 1, 2, 12, '<');
  img.fill(x, y + 3, TILE, 1, '<');
  img.fill(x, y + 9, TILE, 1, '<');
  img.fill(x, y + 13, TILE, 1, '2');
}

// `speck` (FB-0022, QA: "roofs read as pavement") scatters a few darker AC-unit/skylight dots over
// the flat fill, so a big roof reads as a textured rooftop from above rather than a flat colour
// block that can be mistaken for paving.
// Quality loop, category 1 run 1 (2026-09-28): this used to *also* draw a 1px `edge` line along its
// own top+left every time, unconditionally -- meaning every plain interior roof tile (not just the
// real building-edge tiles, bitsRoofEdge/otherRoofEdge below, which already draw their own edge
// line deliberately) carried a border, so a big flat roof was a literal grid of 1px lines at every
// tile seam. Removed here; `flatRoof` is pure rooftop texture now, no border.
// A `variant` (0/1/2) also mixes in a distinct piece of roof clutter -- an AC unit, a hatch, or a
// vent stack -- so a large roof reads as a mix of real rooftop equipment instead of the exact same
// speckle pattern repeated at every tile (build-campus.js's drawBuilding picks a variant per cell
// with the same deterministic per-position hash already used to scatter shade trees).
function flatRoof(img, x, y, base, edge, speck, variant = 0) {
  if (speck) speckle(img, x, y, base, speck, 733 + variant * 191, 6);
  else img.fill(x, y, TILE, TILE, base);
  if (variant === 1) {
    // a squat AC condenser unit: a grey block, a darker top edge, a short ground shadow
    img.fill(x + 3, y + 9, 5, 4, speck);
    img.fill(x + 3, y + 9, 5, 1, edge);
    img.fill(x + 3, y + 13, 5, 1, '%');
  } else if (variant === 2) {
    // a roof hatch (a small outlined square) plus a thin vent stack
    img.box(x + 9, y + 2, 5, 5, edge);
    img.fill(x + 2, y + 9, 2, 5, speck);
    img.set(x + 2, y + 8, edge);
  }
}

// Sand-beige render, banded per docs/STYLE_GUIDE.md "How our buildings are built" (studied from
// LimeZu's Room Builder wall swatches, FB-0025 addendum): a dark roofline outline, a light cap band
// where the wall meets the roof, a trim line, the body (with a panel line and, on `bitsWall`, two
// small windows), a shadow line, and a *cool* baseboard sliver at the ground -- deliberately a
// different hue from the trim, not just a darker version of it, matching the pack's own grey-blue
// kick plate against a warm wall.
function bitsWallPlain(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 1, 'K'); // roofline outline
  img.fill(x, y + 1, TILE, 3, 'wallHi'); // light cap band
  img.fill(x, y + 4, TILE, 1, '&'); // trim line
  img.fill(x + 7, y + 5, 1, 9, '%'); // panel line
  img.fill(x, y + 14, TILE, 1, '%'); // shadow line just above the base
  img.fill(x, y + 15, TILE, 1, 'baseCool'); // cool baseboard where the wall meets the ground
}

function bitsWall(img, x, y) {
  bitsWallPlain(img, x, y);
  for (const wx of [2, 9]) {
    img.fill(x + wx, y + 5, 5, 6, '&'); // frame
    img.fill(x + wx + 1, y + 6, 3, 4, '*'); // glass
    img.set(x + wx + 1, y + 7, 'W'); // glint
  }
}

// The wall turning a corner: a darker side face in shadow, per the 3/4-view rule.
function bitsWallEnd(img, x, y, side) {
  bitsWallPlain(img, x, y);
  const w = 3;
  const x0 = side === 'L' ? 0 : TILE - w;
  img.fill(x + x0, y, w, TILE, '%');
  img.fill(x + x0, y, w, 2, '=');
}

// Quality loop (docs/quality/scorecard.md, Interior art run 1, 2026-09-28: "1-tile vertical wall
// strips (no 3/4 top edge + face)"): real LimeZu Room_Builder wall crops (RB.wallCreamCap/Face),
// recoloured onto the marble ramp so the Main Block's own walls match its floor. Two physical tiles
// tall -- `intWallCap` is placed one row *above* the room's own wall-ring row (Floor.capTopWall(),
// tools/interiors/build-interiors.js, only where that row is still open void), `intWallFace` is the
// wall-ring row itself -- a genuine "top edge, then a face" instead of one tile squeezing both bands
// into 16px. Distinct tile names from `bitsWallPlain`/`bitsWall`/`bitsWallEndL`/`bitsWallEndR` (which
// Library/Mechanical Block still use, untouched) so this is purely additive.
function intWallCap(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(RB.wallCreamCap.atlas), RB.wallCreamCap.sx, RB.wallCreamCap.sy, 16, 16, { remap: remapMarbleWall });
}
function intWallFace(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(RB.wallCreamFace.atlas), RB.wallCreamFace.sx, RB.wallCreamFace.sy, 16, 16, { remap: remapMarbleWall });
}
// The wall turning a corner: the same darker side-face shadow strip as bitsWallEnd, over the new
// marble-toned face instead of the BITS sand wall.
function intWallFaceEnd(img, x, y, side) {
  intWallFace(img, x, y);
  const w = 3;
  const x0 = side === 'L' ? 0 : TILE - w;
  img.fill(x + x0, y, w, TILE, 'marbleShadow');
}
function intWallFaceEndL(img, x, y) { intWallFaceEnd(img, x, y, 'L'); }
function intWallFaceEndR(img, x, y) { intWallFaceEnd(img, x, y, 'R'); }
// A window on an outer wall (quality loop: "windows on outer walls") -- a plain frame + glass, over
// the new marble-toned face.
function intWallWindow(img, x, y) {
  intWallFace(img, x, y);
  img.fill(x + 3, y + 4, TILE - 6, 9, '&');
  img.fill(x + 4, y + 5, TILE - 8, 7, '*');
  img.set(x + 5, y + 6, 'W');
}

// BITS building kit addendum (2026-09-21, coordinator review): a building's outdoor front reads as
// a roof-textured plain when its wall is only 1-2 tiles tall next to a 20+ tile-wide roof -- at the
// game's zoom (3x, ~20x11 tiles visible) almost nothing of the actual wall is on screen from a
// normal standing position. The front is now 4 tiles tall, one dedicated tile per band instead of
// every row repeating the same cap+trim+body+base band squished into one tile:
// cap (meets the roof) / window (a real, full-size window) / body (plain) / base (meets the ground,
// where the entrance is carved in). `tools/campus/build-campus.js`'s drawBuilding assigns one of
// these per wall row instead of repeating bitsWallPlain/bitsWall for every row (which stay exactly
// as they were, still used for interiors and un-touched here).
// Coordinator review round 2 (2026-09-27), point E ("the core complaint" -- 3D feel for every
// building): a visible flat roof band (parapet highlight + terracotta coping), a darker plinth band
// at the base, windows with a frame + sill + glint, and a cast shadow tile on the ground right below
// the facade (bitsFacadeShadow, placed by build-campus.js) -- these four are what sell height at the
// real game camera, more than any single building's own entrance treatment.
// Coordinator review round 3 (2026-09-27): round 2 tuned these to flat palette fills in the right
// hexes (sand wall, terracotta trim, light parapet) -- the coordinator's side-by-side photo
// comparison found a flat fill still reads as a box with no material at the real camera, "compose it
// from Kenney building parts, recolored" instead. Every band below now blits BLDG's own wall crop
// (remapBitsWall/remapBitsWallBase, above) for its real brick-coursing texture, onto the *same* target
// hexes round 2 already established (so nothing about the established palette changes, only the fact
// that it's now real pack pixels instead of a flat fill) -- a thin flat roofline/panel/ground-line
// accent stays on top where a crisp 1px architectural line reads better than more texture.
function bitsFacadeCap(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.cap.atlas), BLDG.cap.sx, BLDG.cap.sy, 16, 16, { remap: remapBitsWall });
  img.fill(x, y, TILE, 1, 'K'); // roofline outline
}

function bitsFacadeWindow(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.body.atlas), BLDG.body.sx, BLDG.body.sy, 16, 16, { remap: remapBitsWall });
  // BLDG.window is an arched crop with its own transparent corners (a real window punched into the
  // wall, not a full tile) -- the wall blit above is its backdrop.
  blitAtlas(img, x, y, loadAtlas(BLDG.window.atlas), BLDG.window.sx, BLDG.window.sy, 16, 16, { remap: remapBitsWindow });
}

function bitsFacadeBody(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.body.atlas), BLDG.body.sx, BLDG.body.sy, 16, 16, { remap: remapBitsWall });
  img.fill(x + 7, y, 1, TILE, '%'); // panel line, full height -- no cap/base bands to interrupt it here
}

function bitsFacadeBase(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.base.atlas), BLDG.base.sx, BLDG.base.sy, 16, 16, { remap: remapBitsWallBase });
  img.fill(x, y + 15, TILE, 1, 'K'); // a dark ground-line pixel, the plinth's own contact shadow
}

// The cast shadow a facade throws onto the ground right in front of it -- a flat 25%-black overlay
// (real alpha, not a palette color) placed by build-campus.js one row south of every BITS building's
// front run, on top of whatever ground/steps/paving is there. Non-solid: it's a tint, not an object.
// Quality loop, category 1 run 1 (2026-09-28): a flat 25%-black fill across the *whole* tile drew as
// an opaque dark grey bar the full width of a building (worst on the wide Mechanical/Library plazas)
// -- not a shadow, a glitch-looking stripe. Now a soft gradient instead: strongest right at the wall
// (still well under half-black) fading to fully transparent by the tile's own far edge, so it reads
// as one soft contact shadow cast onto the ground, not a hard-edged band.
// Quality loop, category 1 run 2 (2026-09-28): "still reads as a grey band on the Mechanical
// plaza" -- round 2's fade spanned the tile's *whole* 16px depth, so even its faded tail still
// tinted most of the tile a visible grey across a wide plaza. Peak alpha halved (28, ~11%, down
// from 56/~22%) and the fade now reaches zero by row 6 instead of row 16, so the effect reads as a
// soft tint hugging the one row directly under the facade, not a band running the tile's full depth.
function bitsFacadeShadow(img, x, y) {
  const peak = 28;
  const fadeRows = 6;
  for (let yy = 0; yy < TILE; yy++) {
    const alpha = Math.round(peak * Math.max(0, 1 - yy / fadeRows));
    if (alpha <= 0) continue;
    for (let xx = 0; xx < TILE; xx++) img.setRGBA(x + xx, y + yy, 0, 0, 0, alpha);
  }
}

// Shared corner treatment for every facade band above: darken a 3px side column (the 3/4-view
// "shadowed side face" rule, same as the original bitsWallEnd) plus its own roofline outline pixel,
// so a building turning a corner reads consistently across all 4 bands, not just the old 2.
function facadeEnd(drawPlain) {
  return (img, x, y, side) => {
    drawPlain(img, x, y);
    const w = 3;
    const x0 = side === 'L' ? 0 : TILE - w;
    img.fill(x + x0, y, w, TILE, '%');
    img.set(x + x0, y, 'K');
    img.set(x + x0 + (side === 'L' ? w - 1 : 0), y, 'K');
  };
}
const bitsFacadeCapEnd = facadeEnd(bitsFacadeCap);
const bitsFacadeWindowEnd = facadeEnd(bitsFacadeWindow);
const bitsFacadeBodyEnd = facadeEnd(bitsFacadeBody);
const bitsFacadeBaseEnd = facadeEnd(bitsFacadeBase);

// Glass entrance under a salmon arch
function bitsDoor(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x + 2, y + 2, 12, 14, '&');
  img.fill(x + 3, y + 4, 10, 12, '*');
  img.fill(x + 7, y + 4, 2, 12, '$');
  img.set(x + 4, y + 6, 'W');
  img.set(x + 10, y + 6, 'W');
}

function otherWallPlain(img, x, y) {
  img.fill(x, y, TILE, TILE, '^');
  img.fill(x, y, TILE, 2, '~');
  img.fill(x + 7, y + 2, 1, 12, '~');
  img.fill(x, y + 14, TILE, 2, '~');
}

function otherWall(img, x, y) {
  otherWallPlain(img, x, y);
  for (const wx of [2, 9]) {
    img.fill(x + wx, y + 5, 5, 6, '~');
    img.fill(x + wx + 1, y + 6, 3, 4, '*');
  }
}

function otherWallEnd(img, x, y, side) {
  otherWallPlain(img, x, y);
  const w = 3;
  const x0 = side === 'L' ? 0 : TILE - w;
  img.fill(x + x0, y, w, TILE, '~');
}

// ---------- campus kit additions (FB-0006, FB-0011, FB-0014, FB-0015, FB-0016) ----------
// Appended after the original campus tiles; see docs/STYLE_GUIDE.md "Campus kit" for the full list.

// -- FB-0014/FB-0025: roads with kerb edges + a raised pavement, lane markings, a crossing,
// walkways -- all now blitted from the Roguelike Modern City pack (assets/vendor/, CC0) instead of
// drawn as flat procedural fills. See PACK above for the source rects and docs/STYLE_GUIDE.md
// "Campus kit" for which pack tile backs which name.

// A road rectangle's border: `sides` is a string built from 'T'/'B'/'L'/'R' ('kerbEdge(img,x,y,
// "TL")' etc. below); one letter is a straight edge, two make a corner. Coordinator review round 3
// (2026-09-27): this used to be its own brick-paver-based rotation/compositing path (see the removed
// atlasKerbEdge/atlasKerbSide/atlasKerbBand above this comment's old location) -- now it's simply the
// same Kenney concrete sidewalk edge/corner used for an ordinary pedestrian walkway, so a road-facing
// kerb and a lawn-facing walkway edge are the same material campus-wide.
function kerbEdge(img, x, y, sides) {
  if (sides.length === 1) walkwayEdge(img, x, y, sides);
  else walkwayCorner(img, x, y, sides);
}

function roadLineH(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.laneDash.atlas), PACK.laneDash.sx, PACK.laneDash.sy, 16, 16, { remap: remapRoad });
}
function roadLineV(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.laneDash.atlas), PACK.laneDash.sx, PACK.laneDash.sy, 16, 16, { rotate: 90, remap: remapRoad });
}
function crossingH(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.crosswalk.atlas), PACK.crosswalk.sx, PACK.crosswalk.sy, 16, 16, { remap: remapRoad });
}
function crossingV(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.crosswalk.atlas), PACK.crosswalk.sx, PACK.crosswalk.sy, 16, 16, { rotate: 90, remap: remapRoad });
}

// A brick walkway with a light stone edging along its long (north/south) sides, so a run of these
// tiles reads as one continuous bordered path across lawn or sand, not a grid of framed squares --
// the border only shows where the path meets the ground, not at the seam between two path tiles
// (unchanged design from FB-0006/FB-0014; only the brick fill itself now comes from the vendor
// pack's paver texture instead of a procedural brick-bevel, since that's the specific "reads as a
// stamped grid up close" complaint FB-0025 named).
// premium pass (2026-09-26, FB-0028: "the map pavements aren't the best, they look like brick
// walls... something more intuitive and it connects"): the old walkway baked a light-grey/white
// dotted border into the TOP and BOTTOM of every single tile, unconditionally -- fine for a path
// exactly one tile wide, but the pedestrian network is 3 tiles wide (layout.js walkwayWidthMeters),
// so the middle row's own top+bottom borders landed right next to its neighbours' borders too,
// striping the whole path with a repeating light band every tile, in both directions -- exactly the
// "same visual weight as a wall" complaint.
//
// Coordinator review round 2 (2026-09-27): recoloring the same Kenney brick-pattern fill onto a
// browner hue still read as brick at the real game camera ("the avenue shot looks almost
// unchanged"). Round 2's fix was a hand-drawn flat concrete fill; coordinator review round 3
// (2026-09-27) found *that* still wasn't the fix the owner needed either -- flat palette fills read
// as a flat plane with no material at all, and separately, the walkway's own kerb-adjacent tiles
// were a completely different code path (kerbEdge above) still blitting actual brick the whole time.
// Ordinary walkways are now the Kenney RPG Urban Pack's own light concrete sidewalk plot (SIDEWALK,
// above) -- native colors ("unrecoloured or only slightly warmed"), a light blue-grey slab fill with
// a warm tan kerb line built into its own edge/corner pieces, used directly instead of drawn.
function walkway(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(SIDEWALK.fill.atlas), SIDEWALK.fill.sx, SIDEWALK.fill.sy, 16, 16);
}

// The walkway's true outward edge/corner: the same plot's own bordered pieces, which already carry a
// warm kerb line along the side(s) that face lawn or a road -- not a second border drawn on top.
const WALKWAY_EDGE_SRC = { T: SIDEWALK.edgeT, B: SIDEWALK.edgeB, L: SIDEWALK.edgeL, R: SIDEWALK.edgeR };
const WALKWAY_CORNER_SRC = { TL: SIDEWALK.cornerTL, TR: SIDEWALK.cornerTR, BL: SIDEWALK.cornerBL, BR: SIDEWALK.cornerBR };
function walkwayEdge(img, x, y, side) {
  const src = WALKWAY_EDGE_SRC[side];
  blitAtlas(img, x, y, loadAtlas(src.atlas), src.sx, src.sy, 16, 16);
}
function walkwayCorner(img, x, y, corner) {
  const src = WALKWAY_CORNER_SRC[corner];
  blitAtlas(img, x, y, loadAtlas(src.atlas), src.sx, src.sy, 16, 16);
}

// -- FB-0015: lush lawn, hedges, bushes, a flower bed, and trees with overhead canopies --

// FB-0025 addendum (2026-09-21): recolored from Sprout Lands (SPROUT.hedge) instead of hand-drawn --
// see that rect's comment for exactly which crop and why it tiles seamlessly. A grass undercoat
// (same source/remap as `lawn`) goes down first, same reasoning as `bush` below: any thin gap in the
// bush silhouette shows the surrounding lawn's own texture, not a black hole.
function hedge(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass });
  blitAtlas(img, x, y, loadAtlas(SPROUT.hedge.atlas), SPROUT.hedge.sx, SPROUT.hedge.sy, 16, 16, { remap: remapDryLeaves });
}

// FB-0025 addendum: a standalone round shrub, now from Sprout Lands (SPROUT.bush) instead of the
// Modern City pack, over the same Kenney grass undercoat as `lawn`/`hedge` so the bush's transparent
// corners still match the ground around it (STYLE_GUIDE "every piece transparent outside its own
// silhouette").
function bush(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.grass.atlas), PACK.grass.sx, PACK.grass.sy, 16, 16, { remap: remapGrass });
  blitAtlas(img, x, y, loadAtlas(SPROUT.bush.atlas), SPROUT.bush.sx, SPROUT.bush.sy, 16, 16, { remap: remapDryLeaves });
}

// A small brick-edged planter (a garden bed border, not a fill color close to the soil, so the
// edge actually reads against the dirt) with three Sprout Lands flowers (FB-0025 addendum: was three
// hand-drawn dots) scaled down to fit -- the planter frame itself stays hand-drawn since no pack has
// a matching plain soil/brick box, per this pass's own "reuse actual pieces where they fit" rule.
function flowerbed(img, x, y) {
  img.fill(x, y, TILE, TILE, 'n');
  img.fill(x, y, TILE, 2, 'Q');
  img.fill(x, y, 2, TILE, 'Q');
  img.fill(x, y + TILE - 2, TILE, 2, 'o');
  img.fill(x + TILE - 2, y, 2, TILE, 'o');
  const spot = (dx, dy) => blitAtlas(img, x + dx, y + dy, loadAtlas(SPROUT.flower.atlas), SPROUT.flower.sx, SPROUT.flower.sy, 16, 16, { dw: 8, dh: 8, remap: remapFlowerLeaf });
  spot(1, 3);
  spot(7, 2);
  spot(4, 8);
}

// Tall trees are split into a solid trunk (drawn under the player, like any other object) and a
// 2x2 canopy above it, drawn on an overhead layer so walking behind it reads as depth (STYLE_GUIDE).
// Small art fix: the canopy's true centre is the seam between its TL/TR (or BL/BR) tiles, one
// tile to the right of where the trunk is placed (build-campus.js puts the trunk directly below
// the canopy's LEFT column, per STYLE_GUIDE "the trunk tile sits directly below the canopy quad").
// Drawing the trunk near the tile's right edge, instead of dead centre, puts it visibly under that
// seam instead of apart from it.
function treeTrunk(img, x, y) {
  grass(img, x, y, 79);
  img.box(x + 8, y + 1, 6, 15, 'n');
  img.fill(x + 9, y + 2, 2, 13, 'N');
}

function palmTrunk(img, x, y) {
  grass(img, x, y, 81);
  img.box(x + 9, y, 4, 16, 'n');
  for (let ring = 2; ring < 16; ring += 3) img.fill(x + 9, y + ring, 4, 1, 'N');
}

// Draws one 16x16 quadrant (qx, qy in {0,1}) of a 32x32 canopy described by a shape test and a
// tone function, both working in the canopy's own 32x32 virtual space. Pixels outside the shape
// stay transparent, so the ground/trunk show through around the canopy's silhouette.
function canopyQuadrant(img, x, y, qx, qy, shapeFn, toneFn) {
  forEachPixel((xx, yy) => {
    const gx = qx * TILE + xx;
    const gy = qy * TILE + yy;
    if (!shapeFn(gx, gy)) return;
    const edge = !shapeFn(gx - 1, gy) || !shapeFn(gx + 1, gy) || !shapeFn(gx, gy - 1) || !shapeFn(gx, gy + 1);
    img.set(x + xx, y + yy, edge ? 'K' : toneFn(gx, gy));
  });
}

// FB-0019: the round canopy's silhouette (an ellipse) narrows away from its own centre, so at the
// column where build-campus.js plants the trunk (the canopy's left-quadrant tile, off to one side
// of the ellipse's centre) the silhouette fell well short of the tile's bottom edge, leaving a
// visible gap above the trunk. A flat "skirt" band near the bottom, wide enough to cover the
// trunk's columns regardless of the ellipse's curve, guarantees the two always touch.
const roundCanopyShape = (gx, gy) => {
  if (((gx - 16) / 15.5) ** 2 + ((gy - 15) / 14) ** 2 <= 1) return true;
  return gy >= 27 && gy <= 30 && Math.abs(gx - 16) <= 12;
};
// FB-0025 addendum (2026-09-21): like canopyQuadrant above, but instead of a hand-picked palette
// tone, samples the recolored pack tree's own pixels -- shapeFn (still ours, unchanged) decides the
// silhouette and the 1px outline exactly as before, so the "walk behind the canopy" depth cue and
// the FB-0019 seam fix are untouched; only the *fill* now comes from Sprout Lands' art instead of a
// flat 3-tone hand-picked ramp. `rect` is a SPROUT source rect (a crop containing ONLY the tree's
// canopy, no trunk pixels -- see SPROUT.treeCanopy's comment) nearest-neighbor-mapped from the
// canopy's 32x32 virtual space onto the crop's own (possibly different) size.
// Coordinator review round 3 (2026-09-27): `remap` defaults to identity (native pack colors) --
// round 2's palms/round trees used `remapDryLeaves` to match a muted "Dubai-dry" ramp, but the
// coordinator's review found the palm "murky and dark" and asked for both back in their pack's own
// bright native colors, so the tree/palm TILES entries below now call this with no remap at all.
function canopyQuadrantFromAtlas(img, x, y, qx, qy, shapeFn, rect, remap = (r, g, b, a) => [r, g, b, a]) {
  const atlas = loadAtlas(rect.atlas);
  forEachPixel((xx, yy) => {
    const gx = qx * TILE + xx;
    const gy = qy * TILE + yy;
    if (!shapeFn(gx, gy)) return;
    const edge = !shapeFn(gx - 1, gy) || !shapeFn(gx + 1, gy) || !shapeFn(gx, gy - 1) || !shapeFn(gx, gy + 1);
    if (edge) {
      img.set(x + xx, y + yy, 'K');
      return;
    }
    const sx = rect.sx + Math.min(rect.sw - 1, Math.floor((gx * rect.sw) / 32));
    const sy = rect.sy + Math.min(rect.sh - 1, Math.floor((gy * rect.sh) / 32));
    const si = (sy * atlas.width + sx) * 4;
    let [r, g, b, a] = [atlas.data[si], atlas.data[si + 1], atlas.data[si + 2], atlas.data[si + 3]];
    if (a === 0) return; // shouldn't happen inside a canopy-only crop, but stay transparent if it does
    [r, g, b, a] = remap(r, g, b, a);
    img.setRGBA(x + xx, y + yy, r, g, b, 255);
  });
}

function palmCanopyShape(gx, gy) {
  // FB-0019: a short solid "neck" from the crown straight down to the tile edge, over the columns
  // where the trunk is planted directly below (build-campus.js puts it under the canopy's left
  // column), so the frond cluster and the trunk join instead of floating apart with a gap.
  if (gy >= 14 && gy <= 31 && gx >= 6 && gx <= 15) return true;
  const dx = gx - 16;
  const dy = gy - 16;
  const dist = Math.hypot(dx, dy);
  if (dist > 15) return false;
  if (dist <= 3) return true; // crown
  const angle = Math.atan2(dy, dx);
  const fronds = 8;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2;
    const diff = Math.atan2(Math.sin(angle - a), Math.cos(angle - a));
    if (Math.abs(diff) < 0.28) return true;
  }
  return false;
}
const palmCanopyTone = (gx, gy) => {
  const d = (gx - 16) + (gy - 16); // diagonal position: light from the top-left
  return d < -8 ? ':' : d > 6 ? ';' : 'T';
};

// -- FB-0016: a tennis court kit --
//
// A standard court is 18x9 tiles (36x18 m at 2 m/tile, including run-off). Arrangement, columns
// 0-17 and rows 0-8 (also documented in docs/STYLE_GUIDE.md "Campus kit"):
//
//   row 1, cols 3-14    top sideline               courtLineH
//   row 7, cols 3-14    bottom sideline             courtLineH
//   col 2, rows 2-6     left baseline               courtLineV
//   col 15, rows 2-6    right baseline              courtLineV
//   col 5 / col 12, rows 2-6   service lines        courtLineV
//   col 8, row 2 / row 6   the net where it meets the sideline (a small post)   courtNetPostT/B
//   col 8, rows 3-5   the net (a thin line)         courtNet
//   row 4, cols 6-7 and 10-11  centre service line (either side of the net)   courtLineH
//   (row1,col2) (row1,col15) (row7,col2) (row7,col15)   the four corners     courtCornerTL/TR/BL/BR
//   (row4,col2) (row4,col15)   centre marks                                  courtCenterMark
//   everywhere else inside cols 2-15, rows 1-7   plain surface               court
//   outside that rectangle: run-off, whatever ground the court sits on (e.g. sand)
//
// tools/../docs/research/campus-tile-kit.png has a rendered example of this exact arrangement.

function courtSurface(img, x, y, seed) {
  speckle(img, x, y, '@', '#', seed, 4);
}
function courtLineH(img, x, y) {
  courtSurface(img, x, y, 87);
  img.fill(x, y + 7, TILE, 2, 'W');
}
function courtLineV(img, x, y) {
  courtSurface(img, x, y, 89);
  img.fill(x + 7, y, 2, TILE, 'W');
}
// vSide: which half ('T' or 'B') carries the vertical line continuing to that edge.
// hSide: which half ('L' or 'R') carries the horizontal line continuing to that edge.
function courtCorner(img, x, y, vSide, hSide) {
  courtSurface(img, x, y, 91);
  img.fill(x + 7, y + (vSide === 'T' ? 0 : 8), 2, 8, 'W');
  img.fill(x + (hSide === 'L' ? 0 : 8), y + 7, 8, 2, 'W');
}
function courtCenterMark(img, x, y) {
  courtSurface(img, x, y, 93);
  img.fill(x + 7, y, 2, TILE, 'W');
  img.fill(x + 4, y + 6, 8, 2, 'W');
}
// FB-0020: the net used to fill two whole tiles edge to edge with dark stripes -- a thick striped
// block the owner couldn't read as a net. Redrawn as a thin (2 px) line down a single column, with
// small posts where it meets the sidelines (courtNetPostT/B), so it reads as a real tennis net
// instead of an unexplained block. Visual only (not solid), so it doesn't block the run-off either side.
function courtNet(img, x, y) {
  courtSurface(img, x, y, 95);
  img.fill(x + 7, y, 2, TILE, 'K');
  for (let yy = 1; yy < TILE; yy += 3) img.set(x + 7, y + yy, '4');
}
function courtNetPost(img, x, y, side) {
  courtNet(img, x, y);
  const postY = side === 'T' ? 0 : TILE - 4;
  img.fill(x + 5, y + postY, 6, 4, 'K');
  img.fill(x + 6, y + postY + 1, 4, 2, 'o');
}

// -- FB-0011: BITS + other-building fronts (roof edges, entrance, pillar) and a fence kit --

function bitsRoofEdge(img, x, y, edges) {
  speckle(img, x, y, '+', ',', 739, 5); // same AC-unit texture as the plain roof fill (flatRoof)
  if (edges.top) img.fill(x, y, TILE, 3, '=');
  if (edges.left) img.fill(x, y, 3, TILE, '=');
  if (edges.right) img.fill(x + TILE - 3, y, 3, TILE, '=');
  outline(img, x, y, edges);
}

function otherRoofEdge(img, x, y, edges) {
  speckle(img, x, y, '~', '·', 997, 5);
  if (edges.top) img.fill(x, y, TILE, 3, '<');
  if (edges.left) img.fill(x, y, 3, TILE, '<');
  if (edges.right) img.fill(x + TILE - 3, y, 3, TILE, '<');
  outline(img, x, y, edges);
}

// Glass entrance, 2 tiles wide, with light stone steps at its base (FB-0025 addendum: "steps" from
// the BITS building kit brief). `grand` is the Main Block's own real-photo look ("glass front under
// a red arch", docs/research/bits-dubai-campus.md "Look (from photos)") -- a taller, genuinely red
// lintel band instead of the ordinary buildings' thin salmon trim, which is too close to the wall's
// own body color to read as "an arch" on its own. Two tile names use this (bitsEntranceGrandL/R),
// so an ordinary building's front doesn't get the grand look by accident.
function bitsEntrance(img, x, y, isLeft, grand) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 1, 'K');
  const glassTop = grand ? 7 : 4;
  if (grand) {
    img.fill(x, y + 1, TILE, 5, 'archRed');
    img.fill(x, y + 6, TILE, 1, '&'); // soft shadow where the arch meets the glass below
  } else {
    img.fill(x, y + 1, TILE, 3, '&');
  }
  img.fill(x + (isLeft ? 3 : 0), y + glassTop, 13, 13 - glassTop, '*');
  img.set(x + (isLeft ? 5 : 10), y + glassTop + 2, 'W');
  img.fill(x, y + 13, TILE, 1, '%'); // shadow line above the steps
  img.fill(x, y + 14, TILE, 1, '-'); // step tread, lit
  img.fill(x, y + 15, TILE, 1, 'O'); // step riser, in shadow
}

// Coordinator review round 3 (2026-09-27): composed from a Kenney wall crop (backdrop) plus its own
// free-standing pillar prop (BLDG.pillar, a transparent-margin sprite -- the same "grass then prop"
// pattern lampPost/bench/etc. already use, just with a wall backdrop instead of grass), recolored
// terracotta so it reads as an architectural column rather than another flat wall panel.
function bitsColumnTile(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.body.atlas), BLDG.body.sx, BLDG.body.sy, 16, 16, { remap: remapBitsWall });
  blitAtlas(img, x, y, loadAtlas(BLDG.pillar.atlas), BLDG.pillar.sx, BLDG.pillar.sy, 16, 16, { remap: remapBitsColumn });
}
function bitsPillar(img, x, y) {
  bitsColumnTile(img, x, y);
  img.fill(x, y + 15, TILE, 1, 'baseCool');
}

function fenceH(img, x, y) {
  fence(img, x, y);
}
function fenceV(img, x, y) {
  speckle(img, x, y, '5', '6', 44, 6);
  img.fill(x + 1, y + 1, 12, 2, '<');
  img.fill(x + 1, y + 9, 12, 2, '<');
  img.fill(x + 3, y, 1, TILE, '<');
  img.fill(x + 9, y, 1, TILE, '<');
  img.fill(x + 13, y, 1, TILE, '2');
}
function fenceCorner(img, x, y, vSide, hSide) {
  speckle(img, x, y, '5', '6', 46, 6);
  const vy0 = vSide === 'T' ? 0 : 8;
  img.fill(x + 3, y + vy0, 1, 8, '<');
  img.fill(x + 9, y + vy0, 1, 8, '<');
  const hx0 = hSide === 'L' ? 0 : 8;
  img.fill(x + hx0, y + 3, 8, 1, '<');
  img.fill(x + hx0, y + 9, 8, 1, '<');
}
function fenceGate(img, x, y) {
  speckle(img, x, y, '5', '6', 48, 6);
  img.fill(x, y + 1, 2, 12, '<');
  img.fill(x + 14, y + 1, 2, 12, '<');
}

// A small building-name signboard (ADR 0009): a post on lawn with a salmon-trimmed BITS-coloured
// board, placed in front of each named BITS building's entrance.
function signboard(img, x, y) {
  grass(img, x, y, 97);
  img.fill(x + 7, y + 7, 2, 9, 'n');
  img.box(x + 1, y + 1, 14, 7, '$');
  img.fill(x + 1, y + 1, 14, 2, '&');
}

// ---------- premium pass (2026-09-26, Part 3): the Main Block's real entrance ----------
// docs/research/campus-visual-reference.md's literal spec: a centred portico with two tall columns,
// a terracotta portal frame around a dark glass front, a glass canopy, navy lettering on the fascia
// above it, and wide steps -- replacing the old "two random doors" look (FB-0029). Reuses this game's
// existing BITS palette keys (`&` terracotta trim, `*` dark glass, `$`/`wallHi` cream wall) rather
// than inventing new ones -- see STYLE_GUIDE.md's "How our buildings are built" for why that's the
// established approach here. `bitsEntranceGrandL/R` keep their existing names (tools/campus/
// build-campus.js/layout.js `grand: true` already selects them for the Main Block only); only the
// art inside them changes, the same way earlier passes redrew `bitsWallPlain` in place.
// Coordinator review round 3 (2026-09-27): composed from Kenney's own wide glass double door
// (BLDG.doorL/doorR, a matched left/right pair -- one picture, two tiles), frame recolored terracotta,
// glass left exactly as drawn ("a big glass entrance", not a flat recolor).
function bitsEntranceGrand(img, x, y, isLeft, open) {
  const src = isLeft ? BLDG.doorL : BLDG.doorR;
  blitAtlas(img, x, y, loadAtlas(src.atlas), src.sx, src.sy, 16, 16, { remap: remapBitsDoorFrame });
  if (open) {
    // FB-0029/ADR 0015 "door-entry animation": the open-tile variant (`openTiles` on the door
    // object) -- a dark, empty doorway instead of the glass, so stepping in reads as the door having
    // actually opened rather than the glass just vanishing. Approximate rectangle (the glass panes'
    // own footprint within the source picture, not pixel-measured) rather than the door's full tile,
    // so the terracotta frame around the opening still reads as this same door.
    img.fill(x + 2, y + 2, 12, 12, 'K');
  }
}

// The glass canopy, directly above the door (one row up): a fascia band (where the sign lettering
// row sits, above this tile) over a shallow glass canopy roof, then the wall carrying on down to meet
// the door row below.
function bitsEntranceCanopy(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 1, 'K');
  img.fill(x, y + 1, TILE, 3, 'wallHi');
  img.fill(x, y + 4, TILE, 2, '&'); // terracotta canopy fascia edge (coping)
  img.fill(x, y + 6, TILE, 3, '*'); // the canopy's glass underside
  img.fill(x, y + 9, TILE, 1, '='); // drip edge / shadow where the canopy meets the wall below
  img.fill(x, y + 10, TILE, 6, '%');
}

// The two tall portico columns flanking the door -- reuses the same Kenney pillar-on-wall composition
// as the ordinary bitsPillar decoration (bitsColumnTile, defined with it above) so every column in the
// game, grand entrance or not, is the same real material.
function bitsEntranceColumn(img, x, y) {
  bitsColumnTile(img, x, y);
}

// A tiny 5x7 pixel font, just the characters "BITS PILANI, DUBAI CAMPUS" needs -- generated into
// dedicated tiles (one per character) rather than a single wide baked sign, so build-campus.js can
// centre the real message across whatever width the Main Block's front run actually is (STYLE_GUIDE
// "content is data" -- the message and its width live in build-campus.js, not baked art).
const SIGN_FONT_5X7 = {
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  ',': ['.....', '.....', '.....', '.....', '..##.', '..#..', '.#...'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};
// Same cream fascia/roofline/trim as the ordinary bitsFacadeCap band (so a lettered tile sits flush
// with the plain cap tiles on either side of the sign run), with the glyph stamped in navy on top.
function bitsSignGlyph(img, x, y, ch) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 1, 'K');
  img.fill(x, y + 1, TILE, 10, 'wallHi');
  img.fill(x, y + 11, TILE, 2, '&');
  const glyph = SIGN_FONT_5X7[ch] || SIGN_FONT_5X7[' '];
  const gx = x + 6;
  const gy = y + 2;
  glyph.forEach((row, ry) => {
    [...row].forEach((c, rx) => {
      if (c === '#') img.set(gx + rx, gy + ry, 'Ñ');
    });
  });
}
// bitsSignB..bitsSignSpace and bitsEntranceCanopy (above) are kept but no longer placed by
// build-campus.js as of the round-2 rework below (one letter per 16px tile read as "widely spaced,
// running the whole facade" -- the coordinator's own words) -- tile names/indices stay stable
// (STYLE_GUIDE "append only"), so they're simply unused rather than removed.

// ---------- premium pass round 2 (2026-09-27, coordinator review): a composed entrance prefab -----
// The coordinator's brief: "a centred portico about 8-10 tiles wide... two full-height columns... a
// glass canopy, a dark glass front about 4 tiles wide with reflections, and the double door... in
// the middle... a wide 3-row light-stone staircase below it... planters at the step ends". Built as
// a small set of column-type tiles (frame / glass-top / glass-mid / glass-base / step) that
// build-campus.js lays out from one column table, rather than one function per absolute tile
// position -- the composition (which column is a frame vs. glass vs. a column) is authored once,
// here, as a single coherent picture read left-to-right, not scattered per-tile logic.

// Coordinator review round 3 (2026-09-27): the portal frame stays a flat terracotta pier (a crisp
// 1px-scale architectural mullion reads better flat than textured at this width), now on a real
// Kenney wall backdrop instead of a flat '$' fill.
function bitsPorticoFrame(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.body.atlas), BLDG.body.sx, BLDG.body.sy, 16, 16, { remap: remapBitsWall });
  img.fill(x, y, TILE, 1, 'K');
  img.fill(x + 4, y + 1, 8, 15, '&'); // terracotta pier, centred, full height
  img.fill(x + 5, y + 1, 6, 1, 'wallHi'); // a thin lit highlight along its top-left edge
}

// The glass front's top/mid/base rows -- Kenney's own wide glass panel (BLDG.glassPanel/
// glassPanelBase, not the door itself: this is the flanking "dark glass front... with reflections"
// either side of the real double door), frame recolored terracotta, glass left native.
// Quality loop, category 1 run 1 (2026-09-28): "the glass front is small... make it taller (2+ rows
// of glass with frame mullions) so the entrance reads from the forecourt" -- the window+body rows
// already give 2 rows of glass, but the Kenney crop's own frame reads faint at this camera; a
// deliberate terracotta mullion (a full frame border, plus a centre divider on the top row) makes
// each tile read unmistakably as "a framed glass pane", not a flat blue rectangle.
function bitsPorticoGlassTop(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.glassPanel.atlas), BLDG.glassPanel.sx, BLDG.glassPanel.sy, 16, 16, { remap: remapBitsDoorFrame });
  img.fill(x, y, TILE, 2, 'K'); // canopy underside shadow -- reads as an overhang above the glass
  img.fill(x, y, 1, TILE, '&'); // left mullion
  img.fill(x + TILE - 1, y, 1, TILE, '&'); // right mullion
  img.fill(x + 7, y + 2, 2, TILE - 2, '&'); // centre mullion, splitting the pane in two
}
function bitsPorticoGlassMid(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.glassPanel.atlas), BLDG.glassPanel.sx, BLDG.glassPanel.sy, 16, 16, { remap: remapBitsDoorFrame });
  img.fill(x, y, TILE, 1, '&'); // top mullion, meets the top row's own frame
  img.fill(x, y, 1, TILE, '&');
  img.fill(x + TILE - 1, y, 1, TILE, '&');
  img.fill(x + 7, y, 2, TILE, '&');
}
// The glass front's base row (either side of the actual door, not the door itself): Kenney's own
// glass-with-a-sill crop, so the ground line reads as a real ledge instead of a flat color band.
function bitsPorticoGlassBase(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(BLDG.glassPanelBase.atlas), BLDG.glassPanelBase.sx, BLDG.glassPanelBase.sy, 16, 16, { remap: remapBitsDoorFrame });
  img.fill(x, y, TILE, 1, '&');
  img.fill(x, y, 1, TILE, '&');
  img.fill(x + TILE - 1, y, 1, TILE, '&');
  img.fill(x + 7, y, 2, TILE, '&');
}

// The wide 3-row light-stone staircase in front of the portico (ground layer, walkable): Kenney's own
// 3-tread staircase crop (BLDG.step1/2/3, top to bottom), recolored to a neutral light stone so the
// steps read as their own material against both the sand wall above and the sidewalk below.
// Quality loop, category 1 run 1 (2026-09-28): the Kenney staircase crop used above read as "a row
// of tall grey vertical panels -- window blinds or a fence", not steps -- that source art is a
// side-on staircase silhouette (vertical ridges), the wrong perspective for a top-down tread. Hand-
// drawn instead: each tread is a flat light-stone face (top ~10px) with a 1px nosing shadow and a
// shallow shadowed riser band (~5px) below it -- no vertical lines at all, so three of these stacked
// read as shallow horizontal steps the full width of the entrance (build-campus.js widens the step
// run to the forecourt's own width, removing the bare paver strip that used to flank a narrower run).
// Quality loop, category 1 run 2 (2026-09-28): "steps read as two flat dark brown bars... must be
// LIGHT stone (cream/pale grey like the sidewalk)... a light tread top (~11px) with a thin darker
// riser line (~3-4px)". Face keys are now stepLight/Mid/Dark (genuinely pale, PALETTE's own
// comment on why the old '-'/'D'/'d' choice was wrong); the riser is a plain 4px neutral-grey band
// (baseCool, already used for plinths elsewhere -- a cool grey, never brown), not the majority of
// the tile.
function bitsStepTread(img, x, y, faceKey) {
  img.fill(x, y, TILE, 11, faceKey); // light stone tread face
  img.fill(x, y + 11, TILE, 1, 'K'); // crisp line where the riser meets the tread above
  img.fill(x, y + 12, TILE, 4, 'baseCool'); // riser, thin and in shadow
}
function bitsStep1(img, x, y) { bitsStepTread(img, x, y, 'stepLight'); }
function bitsStep2(img, x, y) { bitsStepTread(img, x, y, 'stepMid'); }
function bitsStep3(img, x, y) { bitsStepTread(img, x, y, 'stepDark'); }

// A tight 4x6 pixel font (the coordinator's "1px spacing... several letters per tile" -- the old
// 5x7-one-tile-per-character version spelled the message across the *whole* facade). 4 wide + 1px
// gap = 5px pitch, 3 characters comfortably per 16px tile with a 1px margin.
const SIGN_FONT_4X6 = {
  B: ['###.', '#..#', '###.', '#..#', '#..#', '###.'],
  I: ['####', '..#.', '..#.', '..#.', '..#.', '####'],
  T: ['####', '..#.', '..#.', '..#.', '..#.', '..#.'],
  S: ['.###', '#...', '.##.', '...#', '...#', '###.'],
  P: ['###.', '#..#', '###.', '#...', '#...', '#...'],
  L: ['#...', '#...', '#...', '#...', '#...', '####'],
  A: ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#', '#..#'],
  D: ['###.', '#..#', '#..#', '#..#', '#..#', '###.'],
  U: ['#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  C: ['.###', '#...', '#...', '#...', '#...', '.###'],
  M: ['#..#', '####', '#..#', '#..#', '#..#', '#..#'],
  ',': ['....', '....', '....', '....', '..#.', '.#..'],
  ' ': ['....', '....', '....', '....', '....', '....'],
  // Quality loop, category 1 run 3 (2026-09-29): the two extra letters WELCOME_SIGN_SEGMENTS needs
  // that the fascia wordmark ("BITS PILANI, DUBAI CAMPUS") never did.
  O: ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  W: ['#..#', '#..#', '#..#', '#.##', '##.#', '#..#'],
};
// A compact sign band: navy letters on a light fascia, three per tile -- replaces bitsSignGlyph's
// one-letter-per-tile band above (kept, unused) for the Main Block's own cap row.
function bitsSignSegment(img, x, y, text3) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 1, 'K');
  img.fill(x, y + 1, TILE, 10, 'wallHi');
  img.fill(x, y + 11, TILE, 2, '&');
  [...text3].forEach((ch, i) => {
    const glyph = SIGN_FONT_4X6[ch] || SIGN_FONT_4X6[' '];
    const gx = x + 1 + i * 5;
    const gy = y + 3;
    glyph.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c === '#') img.set(gx + rx, gy + ry, 'Ñ');
      });
    });
  });
}

// Quality loop, category 1 run 3 (2026-09-29): a free-standing board on its own low post (unlike
// bitsSignSegment above, which is a flush fascia strip meant to sit high on a wall) -- planted on the
// lawn like signboard()/the flag poles, terracotta-framed to match the rest of the BITS kit.
function welcomeSignSegment(img, x, y, text4) {
  grass(img, x, y, 158);
  img.box(x, y + 2, TILE, 9, '&');
  img.fill(x + 1, y + 3, TILE - 2, 7, 'wallHi');
  img.fill(x + 5, y + 11, 6, 4, 'baseCool'); // post, meets the ground
  [...text4].forEach((ch, i) => {
    const glyph = SIGN_FONT_4X6[ch] || SIGN_FONT_4X6[' '];
    const gx = x + i * 4; // 4 chars x 4px = the full 16px tile width, same convention as gateSign's "BITS"
    const gy = y + 5;
    glyph.forEach((row, ry) => {
      [...row].forEach((c, rx) => {
        if (c === '#') img.set(gx + rx, gy + ry, 'Ñ');
      });
    });
  });
}

// ---------- premium pass (2026-09-26, Part 2): campus props from Kenney RPG Urban Pack ----------
// Benches, bins, lamp posts, planters/flower boxes, a low decorative fence, and a bollard/barrier --
// none of these existed before this pass (docs/research/asset-packs-2026-09-26.md). Each paints its
// own lawn background first (like `signboard`/`hedge` above) since these are solid, always-on-ground
// props, then blits the pack sprite on top in its own bright colors (no recolor -- the owner asked
// for "more vibrant", and these already read well next to the campus palette, the same call already
// made for the parked cars in FB-0025).
// Quality loop, category 1 run 1 (2026-09-28): the Kenney sheet's curved-arm street lamp
// (URBAN.lampPost) reads as "a sideways hammer" at this scale -- the bent arm and lamp head sit at
// roughly the same height as the pole's own width, with nothing reading as clearly vertical. Redrawn
// as a real 2-tile-tall lamp instead, the same base/overhead split as the round-3 flag pole:
// `lampPost` (unchanged name) draws just the lower pole shaft on the ground; a new `lampPostTop`
// (overhead, like a tree canopy) draws the shaft continuing up to a small hand-drawn glowing globe
// on a bracket. build-campus.js's avenue-prop loop places both.
function lampPost(img, x, y) {
  grass(img, x, y, 151);
  blitAtlas(img, x, y, loadAtlas(FLAG_POLE_SRC.atlas), FLAG_POLE_SRC.sx, FLAG_POLE_SRC.sy, 16, 16, { remap: remapLightStone });
}
function lampPostTop(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(FLAG_POLE_SRC.atlas), FLAG_POLE_SRC.sx, FLAG_POLE_SRC.sy, 16, 16, { remap: remapLightStone });
  img.fill(x + 5, y + 3, 6, 2, 'K'); // bracket, dark, reads as a clear horizontal break from the pole
  img.box(x + 6, y + 5, 4, 4, 'Y'); // the globe itself, warm lamp-glow yellow
  img.set(x + 7, y + 6, 'W'); // glint
}
function bench(img, x, y) {
  grass(img, x, y, 152);
  blitAtlas(img, x, y, loadAtlas(URBAN.bench.atlas), URBAN.bench.sx, URBAN.bench.sy, 16, 16);
}
function bin(img, x, y) {
  grass(img, x, y, 153);
  blitAtlas(img, x, y, loadAtlas(URBAN.bin.atlas), URBAN.bin.sx, URBAN.bin.sy, 16, 16);
}
function planter(img, x, y) {
  grass(img, x, y, 154);
  blitAtlas(img, x, y, loadAtlas(URBAN.planter.atlas), URBAN.planter.sx, URBAN.planter.sy, 16, 16);
}
function lowFence(img, x, y) {
  grass(img, x, y, 155);
  blitAtlas(img, x, y, loadAtlas(URBAN.lowFence.atlas), URBAN.lowFence.sx, URBAN.lowFence.sy, 16, 16);
}
function bollard(img, x, y) {
  grass(img, x, y, 156);
  blitAtlas(img, x, y, loadAtlas(URBAN.bollard.atlas), URBAN.bollard.sx, URBAN.bollard.sy, 16, 16);
}
// A row of coloured pennant flags on a tall pole in front of the Main Block forecourt, per the
// owner's own reference photo. Named per colour (yellow/blue/red, matching the photo) so the engine
// can animate them later (ADR 0015-adjacent note in the premium-pass brief) -- static first frame
// only for now, the same "static now, animate later" call already made for gentle-life props
// elsewhere in this kit.
// Coordinator review round 3 (2026-09-27): the single-tile version above (grass + Ninja's own short
// "flag on a stick" sprite, its pole and pennant both squeezed into one 16px tile) "read as a little
// axe" at this scale. Now a real 2-tile-tall pole (`flagPoleYellow` etc. stay the *base* tile,
// unchanged names -- ADR/append-only -- now drawing just the lower pole shaft; a new `flagTopYellow`
// etc., overhead like a tree canopy, draws the shaft continuing up plus the Ninja flag mounted at its
// top) -- "a proper flag pole (a Kenney pole piece, 2 tiles tall)... a Ninja Adventure flag frame at
// the top", exactly the coordinator's own words.
function flagPoleBase(img, x, y) {
  grass(img, x, y, 157);
  blitAtlas(img, x, y, loadAtlas(FLAG_POLE_SRC.atlas), FLAG_POLE_SRC.sx, FLAG_POLE_SRC.sy, 16, 16, { remap: remapLightStone });
}
function flagPoleTop(img, x, y, color) {
  blitAtlas(img, x, y, loadAtlas(FLAG_POLE_SRC.atlas), FLAG_POLE_SRC.sx, FLAG_POLE_SRC.sy, 16, 16, { remap: remapLightStone });
  const rect = NINJA.flag(color);
  // Enlarged and shifted up so the pennant clears the pole's own top and reads as a distinct flag
  // shape, not a small icon glued to the shaft -- native Ninja Adventure colors, no recolor.
  blitAtlas(img, x, y, loadAtlas(rect.atlas), rect.sx, rect.sy, 16, 16, { dw: 20, dh: 20, offsetX: -2, offsetY: -6 });
}
// A plaque-on-a-pole street sign (Kenney RPG Urban Pack, native blue) near Gate 2 -- "Kenney...bus
// stop sign near the gate", coordinator review round 3.
function busStopSign(img, x, y) {
  grass(img, x, y, 158);
  blitAtlas(img, x, y, loadAtlas(BUS_STOP_SIGN_SRC.atlas), BUS_STOP_SIGN_SRC.sx, BUS_STOP_SIGN_SRC.sy, 16, 16);
}

// Quality loop, category 1 run 3 (2026-09-29): "shade sails or a bus shelter at the bus stop" -- a
// small hand-drawn lean-to canopy (this pack has no ready-made shelter sprite), two dark support poles
// under a sloped fabric roof, in the same terracotta/cream the rest of the BITS kit uses so it reads
// as campus furniture rather than a city-street prop transplanted in.
function busShelter(img, x, y) {
  grass(img, x, y, 159);
  img.fill(x + 1, y + 2, TILE - 2, 3, '&'); // sloped canvas roof, terracotta
  img.fill(x + 1, y + 4, TILE - 2, 1, 'wallHi'); // a highlight seam along the roof's low edge
  img.fill(x + 2, y + 5, 2, 9, 'K'); // left post
  img.fill(x + TILE - 4, y + 5, 2, 9, 'K'); // right post
  img.fill(x + 3, y + 12, TILE - 6, 2, 'baseCool'); // low bench/plinth under the canopy
}

// Quality loop, category 1 run 3 (2026-09-29): "bike racks near hostels" -- this pack's own bicycle
// art (found while surveying it for a rack sprite) is a ground-paint stencil icon, not an upright 3D
// rack, so this is hand-drawn instead: two dark inverted-U stands on the paving, the same technique
// signboard()/securityBooth() above already use for kit pieces this asset survey didn't have a direct
// match for.
function bikeRack(img, x, y) {
  grass(img, x, y, 160);
  img.fill(x + 2, y + 10, TILE - 4, 2, '%'); // paved pad the rack stands on
  for (const ux of [4, 10]) {
    img.fill(x + ux, y + 4, 2, 7, 'K'); // one stand's left post
    img.fill(x + ux + 4, y + 4, 2, 7, 'K'); // right post
    img.fill(x + ux, y + 4, 6, 2, 'K'); // the loop's own top bar
  }
}

// ---------- interior kit (P3: Main/Library/Mechanical Block interiors, 1 m/tile) ----------
// Indoor walls reuse the outdoor bitsWallPlain/bitsWall/bitsWallEndL/bitsWallEndR tiles above, so a
// building's inside matches its outside: sand-beige body, salmon cornice (the "top face"), a dark
// base course where wall meets floor (the "front face"). Below: floor variants per room type, a
// doorway opening, stairs/lift, the atrium void + railing, and simply-furnished pieces for every
// room type in docs/INTERIORS_PLAN.md. Furniture leaves its background transparent (only the object
// itself is painted) so it sits on whatever floor tile is under it on the ground layer, the same way
// campus trees sit on the lawn layer beneath them.

function intFloorFoyer(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, (xx + yy * 3) % 9 === 0 ? 'ß' : 'µ'));
}
// Quality loop (docs/quality/scorecard.md, Interior art run 1): a real LimeZu Room_Builder wood-plank
// crop (RB.floorWood -- one of the pack's own wood wall face rows, flat and grain-visible enough to
// double as a floor) instead of a hand-drawn 2-tone stripe, kept in the pack's own warm tone (no
// recolor needed, it's already this game's wood hue).
function intFloorClassroom(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(RB.floorWood.atlas), RB.floorWood.sx, RB.floorWood.sy, 16, 16);
}
function intFloorCarpet(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, (xx + yy) % 5 === 0 ? '}' : '{'));
}
function intFloorLabVinyl(img, x, y) {
  const r = rng((x * 13 + y * 7) | 0);
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, r() < 0.08 ? '¬' : '¦'));
}
function intFloorLibrary(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, (xx - yy + 32) % 6 === 0 ? '¶' : '§'));
}
function intFloorStage(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, yy % 4 === 0 ? 'F' : 'i'));
  img.fill(x, y, TILE, 1, 'N');
}
// Indoor sport-court floor: the same teal court surface as the outdoor tennis/basketball courts
// (`courtSurface`, '@'/'#'), not the outdoor lawn greens -- so a badminton hall reads as an indoor
// court, not a patch of grass that wandered inside.
function intFloorCourt(img, x, y) {
  speckle(img, x, y, '@', '#', 77, 4);
}
// Quality loop (docs/quality/scorecard.md, Interior art run 1, "corridors are bare"): a genuinely
// *tiled* corridor floor -- LimeZu's own cream cross/waffle-pattern tile crop, kept native (it's
// already a light, low-saturation cream close to this game's existing corridor palette, so no
// recolor needed) -- replacing the corridor's previous reuse of the plain `intFloorFoyer` fleck tile.
function intFloorTiled(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(RB.floorTiled.atlas), RB.floorTiled.sx, RB.floorTiled.sy, 16, 16, { remap: remapCorridorTile });
}
// A light, low-noise lab floor for the ICVL/Physics Lab specifically (docs/research/campus-visual-
// reference.md: "floor is plain pale vinyl/terrazzo") -- a distinct tile name from the shared
// `intFloorLabVinyl` Mechanical Block's own labs still use, so that art stays untouched.
function intFloorLabLight(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(RB.floorLight.atlas), RB.floorLight.sx, RB.floorLight.sy, 16, 16, { remap: remapLabFloor });
}

// A cleared wall opening: a dark threshold framed in the BITS trim colour, always walkable.
function intDoorway(img, x, y) {
  img.fill(x, y, TILE, TILE, 'q');
  img.fill(x, y, 2, TILE, '&');
  img.fill(x + TILE - 2, y, 2, TILE, '&');
  img.fill(x + 2, y, TILE - 4, 1, '&');
}

function intStairsFlight(img, x, y, up) {
  img.fill(x, y, TILE, TILE, 'o');
  for (let i = 0; i < 5; i++) img.fill(x, y + i * 3, TILE, 2, i % 2 ? 'O' : 'Q');
  const ay = up ? 13 : 1;
  img.set(x + 7, y + ay, 'Y');
  img.set(x + 8, y + ay, 'Y');
  img.set(x + (up ? 6 : 9), y + (up ? 12 : 2), 'Y');
}
function intStairsUp(img, x, y) { intStairsFlight(img, x, y, true); }
function intStairsDown(img, x, y) { intStairsFlight(img, x, y, false); }

function intLift(img, x, y) {
  img.fill(x, y, TILE, TILE, 'o');
  img.box(x + 1, y + 1, 6, 14, 'O');
  img.box(x + 9, y + 1, 6, 14, 'O');
  img.fill(x + 7, y + 1, 2, 14, 'K');
  img.set(x + 7, y + 7, 'Y');
}

// The mezzanine's atrium opening (railing-bordered, non-walkable): a view straight down onto the
// ground-floor foyer below, so it reads as a drop rather than a hole in the texture -- the same
// fleck pattern as intFloorFoyer, several shades darker (as if seen through the well, away from the
// mezzanine's own lighting).
function intAtriumVoid(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, (xx + yy * 3) % 9 === 0 ? 'ø' : 'Ø'));
}
// The ring of void tiles that touch the railing (build-interiors.js atriumVoid): the same darkened
// foyer floor, with a soft shadow band along the tile's own edges -- cast by the railing lip above --
// so the drop reads clearly no matter which side of the rectangle the tile sits on.
function intAtriumVoidEdge(img, x, y) {
  forEachPixel((xx, yy) => {
    const edgeDist = Math.min(xx, TILE - 1 - xx, yy, TILE - 1 - yy);
    img.set(x + xx, y + yy, edgeDist < 3 ? 'º' : (xx + yy * 3) % 9 === 0 ? 'ø' : 'Ø');
  });
}
function intAtriumRailing(img, x, y) {
  intFloorFoyer(img, x, y);
  img.fill(x, y + 6, TILE, 3, '<');
  img.fill(x, y + 6, TILE, 1, 'Q');
  for (let i = 2; i < TILE; i += 4) img.fill(x + i, y + 4, 1, 2, '<');
}

// 2026-09-22: a single classroom/office desk, LimeZu's own sprite (same pack as the walls, no
// recolor needed) -- replacing the plain hand-drawn box below.
function intDesk(img, x, y) {
  blitRect(img, x, y, LIMEZU.desk, { maxW: 15, maxH: 15 });
}
// 2026-09-22: Cool School's desk-with-drawers (CC0, recolored onto this game's wood ramp -- its own
// pastel palette clashed) -- a visibly bigger/fancier desk than the plain student one above.
function intTeacherDesk(img, x, y) {
  blitRect(img, x, y, COOL_SCHOOL.teacherDesk, { maxW: 15, maxH: 15, remap: remapSchoolWood });
}
// A whiteboard mounted on the front wall: a wall tile (solid), not a floor prop. 2026-09-22: the
// board itself is now LimeZu's own freestanding chalkboard sprite, over the usual wall backdrop.
function intWhiteboardWall(img, x, y) {
  bitsWallPlain(img, x, y);
  blitRect(img, x, y, LIMEZU.chalkboard, { maxW: 15, maxH: 13, bottomPad: 2 });
}
function intBench(img, x, y) {
  img.box(x + 1, y + 5, 14, 7, '¦');
  img.fill(x + 1, y + 11, 14, 1, '¬');
  img.fill(x + 2, y + 12, 1, 3, 'o');
  img.fill(x + 12, y + 12, 1, 3, 'o');
}
// 2026-09-22 (owner brief: "science-lab benches with equipment"): a dedicated lab bench, kept in the
// Laboratory Tileset pack's own colors (CC BY 4.0, see docs/research/asset-packs.md) over the plain
// bench shape above, plus a small apparatus tank standing on the near end -- both from the same pack.
function intLabBench(img, x, y) {
  intBench(img, x, y);
  blitRect(img, x, y, LAB_PACK.bench, { maxW: 15, maxH: 12, bottomPad: 3 });
}
// A tall chemistry/bio apparatus tank -- lab equipment variety alongside the bench.
function intLabTank(img, x, y) {
  blitRect(img, x, y, LAB_PACK.tank, { maxW: 11, maxH: 15 });
}
// An equipment/server rack -- doubles as lab instrumentation and computer-lab-adjacent dressing.
function intLabRack(img, x, y) {
  blitRect(img, x, y, LAB_PACK.rack, { maxW: 13, maxH: 15 });
}
function intComputerBench(img, x, y) {
  intBench(img, x, y);
  // 2026-09-22: the monitor itself is now Cool School's CRT+keyboard sprite (recolored onto this
  // game's stone/screen ramp), replacing the plain hand-drawn box+screen.
  blitRect(img, x, y, COOL_SCHOOL.computer, { maxW: 13, maxH: 11, bottomPad: 4, remap: remapSchoolScreen });
}
function intSink(img, x, y) {
  img.box(x + 2, y + 6, 12, 7, 'Q');
  img.fill(x + 4, y + 7, 8, 3, 'w');
  img.fill(x + 7, y + 4, 2, 3, 'o');
}
// 2026-09-22: LimeZu's own office/lab storage cabinet over the existing plain-box silhouette.
function intCabinet(img, x, y) {
  blitRect(img, x, y, LIMEZU.cabinet, { maxW: 12, maxH: 15 });
}
// 2026-09-22: a LimeZu cushioned ottoman/bench (foyer/lounge seating), replacing the flat-color box.
function intSofa(img, x, y) {
  blitRect(img, x, y, LIMEZU.ottoman, { maxW: 15, maxH: 14 });
}
// 2026-09-22: LimeZu's own corkboard-with-pinned-notes over the cork backdrop, instead of the
// hand-drawn dots.
function intNoticeboard(img, x, y) {
  img.fill(x + 2, y + 2, 12, 11, '¤');
  blitRect(img, x, y, LIMEZU.corkboard, { maxW: 15, maxH: 13, bottomPad: 2 });
}
function intReceptionDesk(img, x, y) {
  img.box(x + 1, y + 6, 14, 8, 'N');
  img.fill(x + 1, y + 6, 14, 1, '&');
  img.fill(x + 6, y + 2, 4, 4, 'W');
}
// A serving counter for the canteen (owner brief: "a serving counter") -- hand-drawn (no clean free
// pack match found for this specific piece, see docs/research/asset-packs.md): a wood counter front
// with a raised service top and a food-tray accent, in the same wood/accent tones as the rest of the
// kit.
function intCanteenCounter(img, x, y) {
  img.box(x + 1, y + 6, 14, 8, 'N');
  img.fill(x + 1, y + 6, 14, 2, 'i');
  img.fill(x + 3, y + 3, 4, 3, 'o');
  img.fill(x + 9, y + 3, 4, 3, 'Y');
}
// 2026-09-22: Cool School's round-handle 2-tall locker, recolored onto this game's own wood ramp
// (its native reddish-brown reads better through a wood remap than a hue-shifted blue one did),
// replacing the plain 3-division box below.
function intLocker(img, x, y) {
  blitRect(img, x, y, COOL_SCHOOL.locker, { maxW: 14, maxH: 15, remap: remapSchoolWood });
}
// An office/computer-lab printer -- Cool School's flatbed-scanner sprite, recolored.
function intPrinter(img, x, y) {
  blitRect(img, x, y, COOL_SCHOOL.printer, { maxW: 14, maxH: 10, bottomPad: 3, remap: remapSchoolScreen });
}
// Bug (found via a rainbow-glitch qa-shot, docs/research/premium-pass/cutscenes/12-key-room-beat-
// physics-lab.png): `intBooksStack` was the one Cool School piece in the whole file that never got
// the pack's own "recolor onto this game's ramp" treatment every other piece gets (see
// remapSchoolWood's own comment, above) -- left in the pack's raw "pastel pink/purple/orange", which
// reads as a rainbow glitch once several copies sit next to each other. A bucketed luminance ramp
// (like remapSchoolWood) collapsed the sprite's own shading into a shapeless blob, so this is a
// *continuous* single-hue tint instead: every pixel keeps its exact original brightness, just
// recoloured toward one warm book-cover brown -- preserves the source art's own light/dark contrast
// (the shape that actually reads as "books"), not just its silhouette.
function remapBooksHue(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 35) return [...hexToRgb('#1a1c2c'), a]; // keep the art's own outline near-black
  const t = Math.min(1, lum / 255);
  const shade = 0.35 + t * 0.9;
  const [tr, tg, tb] = [150, 92, 48]; // a warm book-cover brown-red
  return [Math.min(255, Math.round(tr * shade)), Math.min(255, Math.round(tg * shade)), Math.min(255, Math.round(tb * shade)), a];
}
// A small pile of books -- decorative clutter for library tables/classroom desks.
function intBooksStack(img, x, y) {
  blitRect(img, x, y, COOL_SCHOOL.books, { maxW: 12, maxH: 10, bottomPad: 3, remap: remapBooksHue });
}
// A globe on a stand -- classroom/library decoration, LimeZu's own sprite.
function intGlobe(img, x, y) {
  blitRect(img, x, y, LIMEZU.globe, { maxW: 11, maxH: 15 });
}
// A hand-drawn water cooler (owner brief's "small props" list; no clean free-licensed match was found
// in time, see docs/research/asset-packs.md) -- a blue bottle on a white dispenser stand.
function intWaterCooler(img, x, y) {
  img.box(x + 4, y + 1, 8, 6, 'U');
  img.fill(x + 5, y + 2, 6, 3, 'w');
  img.box(x + 3, y + 7, 10, 8, 'Q');
  img.fill(x + 5, y + 9, 2, 2, 'u');
}
// A hand-drawn vending machine -- a tall red cabinet with a glowing blue screen and a coin slot.
function intVendingMachine(img, x, y) {
  img.box(x + 1, y + 1, 14, 14, 'R');
  img.box(x + 3, y + 2, 10, 7, 'I');
  for (const ry of [10, 12]) img.fill(x + 3, y + ry, 10, 1, 'r');
  img.set(x + 11, y + 10, 'Y');
}
// A hand-drawn trash bin -- a grey cylinder with a darker rim.
function intBin(img, x, y) {
  img.box(x + 4, y + 5, 8, 9, 'O');
  img.fill(x + 3, y + 4, 10, 2, 'o');
}
function intAuditoriumSeat(img, x, y) {
  // 2026-09-22 (owner brief: "lecture-hall/auditorium seating"): two real theatre-seat sprites
  // (Pixel Seating, CC-BY 3.0, see docs/research/asset-packs.md) side by side across the tile,
  // replacing the flat hand-drawn boxes -- already close to this game's own red seat ramp, no
  // recolor needed. blitFit centers within a full tile, so each half is placed by hand instead.
  const atlas = loadAtlas(SEATING_CHAIR);
  const scale = Math.min(7 / atlas.width, 14 / atlas.height);
  const dw = Math.max(1, Math.round(atlas.width * scale));
  const dh = Math.max(1, Math.round(atlas.height * scale));
  for (const seatX of [1, 9]) {
    blitAtlas(img, x, y, atlas, 0, 0, atlas.width, atlas.height, {
      dw, dh, offsetX: seatX + Math.round((7 - dw) / 2), offsetY: TILE - dh - 1,
    });
  }
}
function intBadmintonNet(img, x, y) {
  intFloorCourt(img, x, y);
  img.fill(x + 7, y, 2, TILE, '#');
  img.fill(x, y, TILE, 1, 'o');
}
function intCourtLineIndoor(img, x, y) {
  intFloorCourt(img, x, y);
  img.fill(x, y + 1, TILE, 1, '#');
}
function intTTTable(img, x, y) {
  img.box(x + 1, y + 2, 14, 10, '@');
  img.fill(x + 1, y + 6, 14, 1, '#');
  img.fill(x + 7, y + 12, 1, 3, 'o');
}
function intBed(img, x, y) {
  img.box(x + 1, y + 1, 14, 14, 'W');
  img.fill(x + 1, y + 1, 14, 3, 'Z');
  img.fill(x + 1, y + 11, 14, 4, 'I');
}
function intCurtain(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, xx % 3 === 0 ? 'z' : 'Z'));
}
function intMedicalDesk(img, x, y) {
  intReceptionDesk(img, x, y);
  img.fill(x + 7, y + 2, 2, 2, 'C');
  img.fill(x + 6, y + 3, 4, 1, 'C');
}
function intMachine(img, x, y) {
  img.box(x + 2, y + 2, 12, 12, 'O');
  img.fill(x + 4, y + 4, 8, 2, 'Y');
  img.box(x + 6, y + 7, 4, 4, 'o');
}

// ---------- Main Block foyer rebuild (FB-0030/0031, premium pass stage 5) ----------
// Hand-drawn (no new vendor pack, same box/fill idiom as the rest of the interior kit), following
// docs/research/campus-visual-reference.md "2. Main reception foyer" and the owner's own photo
// (docs/research/reference/owner-main-block-foyer.png): glossy marble with a centre runner, a twin
// staircase converging on a landing, walk-behind columns, a chandelier over the landing, and glass
// entrance doors. tools/interiors/plans.js/build-interiors.js place these as `depthGroup`s (ADR
// 0015) so she walks behind the staircase/columns/big plants, never over them.
// Quality loop (docs/quality/scorecard.md, Interior art run 1, 2026-09-28: "the marble reads as
// sand"): a real LimeZu Room_Builder floor crop (RB.floorStoneCap/Face -- a light stone/slab texture
// with its own panel-seam shading), recoloured onto the marble ramp instead of a hand-drawn speckle,
// so the panel seams (real pack pixels) read as the photo's floor reflections/joints.
function intFloorMarble(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(RB.floorStoneCap.atlas), RB.floorStoneCap.sx, RB.floorStoneCap.sy, 16, 16, { remap: remapMarbleFloor });
}
// The dark inlay "runner" band down the centre of the floor from the entrance toward the staircase
// (visible as a distinct stripe in the owner's photo): the same real crop's *other* row (a slightly
// different seam pattern), recoloured to the darker end of the same marble ramp.
function intFloorMarbleRunner(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(RB.floorStoneFace.atlas), RB.floorStoneFace.sx, RB.floorStoneFace.sy, 16, 16, { remap: remapMarbleFloor });
  blitAtlas(img, x + 2, y, loadAtlas(RB.floorStoneFace.atlas), RB.floorStoneFace.sx + 2, RB.floorStoneFace.sy, TILE - 4, TILE, { remap: remapMarbleRunner });
}
// A big, tall column (quality loop: "4 big white columns, 2 tiles wide, full height, depthGroups") --
// build-interiors.js now places 4 of these as a 2-wide x 3-tall solid `depthGroup` block each, so a
// single tile only ever needs to tile cleanly with its neighbours, not read as "big" on its own.
// Cool-white body, a shaded right/bottom edge for the 3/4-view read, and a thin fluted centre line.
function intColumn(img, x, y) {
  img.fill(x, y, TILE, TILE, 'columnBody');
  img.fill(x + TILE - 5, y, 5, TILE, 'columnShade');
  img.fill(x, y, TILE, 2, 'wallHi');
  img.fill(x, y + TILE - 2, TILE, 2, 'K');
  img.fill(x + 7, y, 1, TILE, 'columnShade');
}
// The twin-flight staircase converging on a shared landing (quality loop: "the staircase is a wide
// central flight of HORIZONTAL treads... draw it as steps, not vertical rails" -- the previous
// version's vertical-rail fills read as a ladder). Each tread is now a full-width HORIZONTAL band
// (a light stone tread + a shadowed riser line), climbing north exactly like the existing plain
// `intStairsFlight` stairwell tiles already do; only a thin 2px black wrought-iron rail sits at the
// *outer* edge of each flight (left flight's own left edge, right flight's own right edge) so most of
// the tile still reads as a horizontal step, not a vertical bar.
// Quality loop run 2 (docs/quality/scorecard.md, 2026-09-28: "it STILL draws as long vertical dark
// lines. Draw it as a block of horizontal treads: each row of the stair block = one step... rails
// only as a thin line at the two outer edges... No vertical stripes inside the block"). Run 1's
// mistake: every tile of the stair block called a per-tile "railSide" variant, so a 2px rail column
// was redrawn at the *inner* edge of every single tile, not just the block's own true outer edge --
// tiled side by side across many columns, those per-tile rails read as a row of parallel vertical
// bars (a ladder). Fixed two ways at once: `intFoyerTread` itself is now a single full-width
// horizontal step (a light tread over a darker riser line, no vertical marks at all), and the rail
// is its own separate tile (`intFoyerStairsRailL`/`R`) build-interiors.js places *only* at the
// staircase block's own leftmost/rightmost column -- see FURNISHERS.foyer.
function intFoyerTread(img, x, y) {
  img.fill(x, y, TILE, 11, 'marbleFleck'); // tread (light), the top 11px
  img.fill(x, y + 11, TILE, 5, 'marbleShadow'); // riser (darker), the bottom 5px
}
function intFoyerStairsRailL(img, x, y) {
  intFoyerTread(img, x, y);
  img.fill(x, y, 2, TILE, 'ironRail');
}
function intFoyerStairsRailR(img, x, y) {
  intFoyerTread(img, x, y);
  img.fill(x + TILE - 2, y, 2, TILE, 'ironRail');
}
function intFoyerLanding(img, x, y) {
  img.fill(x, y, TILE, TILE, 'marbleLight');
  img.fill(x, y, TILE, 2, 'marbleShadow');
}
// The tiered chandelier over the staircase's lower landing: quality loop run 2 ("chandelier bigger,
// 2x2 tiles, overhead, so it reads") -- a single 32x32 picture split across 4 tile names
// (intChandelierTL/TR/BL/BR), each just the pixels that land in its own quadrant of the shared
// `chandelierPixels` drawing (the same "draw once, crop per tile" idea `bitsSignSegN` already uses
// for the wordmark). Placed on the `overhead` layer (ADR 0008) by
// `Floor.placeOverhead()`/FURNISHERS.foyer as a 2x2 block, transparent everywhere but the fixture.
// Quality loop run 3 (docs/quality/scorecard.md, 2026-09-29: "the chandelier reads as a gold plus
// sign: draw a tiered chandelier (a gold frame with rows of warm light dots and a soft glow)") --
// run 2's two stacked rectangles made a cross silhouette once the chain was added; two true ellipses
// (an ORed-together x/y radius test, not row-by-row rectangles) give round tiers instead, with a
// ring of glowing "bulb" dots around each one and a brighter glow at the very centre.
function chandelierPixels(put) {
  for (let gy = 0; gy < 6; gy++) { put(15, gy, 'ironRail'); put(16, gy, 'ironRail'); } // chain
  const inEllipse = (gx, gy, cx, cy, rx, ry) => {
    const dx = (gx + 0.5 - cx) / rx;
    const dy = (gy + 0.5 - cy) / ry;
    return dx * dx + dy * dy <= 1;
  };
  for (let gx = 0; gx < 32; gx++) {
    for (let gy = 6; gy < 32; gy++) {
      if (inEllipse(gx, gy, 15.5, 13, 10, 6) || inEllipse(gx, gy, 15.5, 23, 6.5, 5)) put(gx, gy, 'chandelierGold');
    }
  }
  // A ring of small warm light dots around each tier's own rim, plus a soft glow at each centre.
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    put(Math.round(15.5 + Math.cos(ang) * 8), Math.round(13 + Math.sin(ang) * 4.5), 'chandelierGlow');
  }
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    put(Math.round(15.5 + Math.cos(ang) * 5), Math.round(23 + Math.sin(ang) * 3.5), 'chandelierGlow');
  }
  put(15, 12, 'chandelierGlow'); put(16, 12, 'chandelierGlow');
  put(15, 22, 'chandelierGlow'); put(16, 22, 'chandelierGlow');
}
function intChandelierQuadrant(img, x, y, qx, qy) {
  chandelierPixels((gx, gy, key) => {
    if (gx >= qx * 16 && gx < qx * 16 + 16 && gy >= qy * 16 && gy < qy * 16 + 16) img.set(x + gx - qx * 16, y + gy - qy * 16, key);
  });
}
function intChandelierTL(img, x, y) { intChandelierQuadrant(img, x, y, 0, 0); }
function intChandelierTR(img, x, y) { intChandelierQuadrant(img, x, y, 1, 0); }
function intChandelierBL(img, x, y) { intChandelierQuadrant(img, x, y, 0, 1); }
function intChandelierBR(img, x, y) { intChandelierQuadrant(img, x, y, 1, 1); }
// The glass double door's own `openTiles` overlay (ADR 0015: shown while she's walking through) --
// dark glazing with a reflection streak and a top transom bar, reusing the outdoor entrance's own
// glass/reflection palette keys ('*'/'Œ') rather than inventing a new one.
function intGlassDoorOpen(img, x, y) {
  img.fill(x, y, TILE, TILE, '*');
  img.fill(x + 1, y + 2, TILE - 2, TILE - 3, 'Œ');
  img.fill(x, y, TILE, 2, 'ironRail');
}
// A closed, decorative door standing in for the "locked, but visible" side-wing/classroom doors
// (docs/STORY.md: "everywhere else in the building is blocked off") -- solid, no warp object, just
// wall dressing placed directly (Floor.placeStructure), so nothing about it needs a target map.
function intDoorClosed(img, x, y) {
  bitsWallPlain(img, x, y);
  img.fill(x + 2, y + 1, TILE - 4, TILE - 2, 'n');
  img.fill(x + 3, y + 2, TILE - 6, TILE - 4, 'N');
  img.set(x + TILE - 5, y + TILE / 2, 'Y');
}
// ICVL (docs/research/campus-visual-reference.md "5. Computer lab / ICL"): royal-blue built-in
// cabinetry with a monitor sitting directly on the worktop, distinct from the generic grey
// `intComputerBench` shared with Mechanical Block's own labs.
function intIcvlBench(img, x, y) {
  img.fill(x + 1, y + 5, TILE - 2, 10, 'icvlBlue');
  img.fill(x + 1, y + 5, TILE - 2, 1, 'icvlBlueHi');
  img.fill(x + 2, y + 9, 1, 5, 'icvlBlueHi');
  img.fill(x + 12, y + 9, 1, 5, 'icvlBlueHi');
  blitRect(img, x, y, COOL_SCHOOL.computer, { maxW: 13, maxH: 11, bottomPad: 4, remap: remapSchoolScreen });
}
// A server rack -- the ICVL's own equipment, in the same blue cabinetry tone as its benches.
function intServerRack(img, x, y) {
  img.box(x + 2, y, TILE - 4, TILE - 1, 'icvlBlue');
  for (let ry = 2; ry < TILE - 2; ry += 3) img.fill(x + 3, y + ry, TILE - 6, 1, 'K');
  img.set(x + 4, y + 3, 'chandelierGlow'); // a small lit status LED
}
// The Physics Lab's wood-topped benches (docs/research/campus-visual-reference.md "6. Physics/
// science lab": "wooden-topped benches... over a metal one") -- the same wood-ramp tone ('i') the
// rest of the kit already uses, over the generic metal-topped `intLabBench` shared with Mechanical
// Block.
function intLabBenchWood(img, x, y) {
  img.box(x + 1, y + 5, TILE - 2, 7, 'i');
  img.fill(x + 1, y + 5, TILE - 2, 1, 'wallHi');
  img.fill(x + 2, y + 12, 1, 3, 'o');
  img.fill(x + 12, y + 12, 1, 3, 'o');
}
// A pull-down projector screen beside the classroom's whiteboard (docs/research/campus-visual-
// reference.md "4. Classroom": "a full-width whiteboard plus a pull-down projector screen").
function intProjectorScreen(img, x, y) {
  bitsWallPlain(img, x, y);
  img.fill(x + 3, y + 2, TILE - 6, 10, 'Q');
  img.fill(x + 3, y + 2, TILE - 6, 1, 'o');
}

// ---------- Quality loop, Interior art run 2 (docs/quality/scorecard.md, 2026-09-28) ----------
// "Over-corrected [ICVL] into a solid wall-to-wall grid... no aisles"; "[Physics Lab] uniform rows
// of identical benches, like a warehouse" -- both key rooms get real aisles now (FURNISHERS.labIcvl/
// labPhysics, build-interiors.js) and enough distinct pieces (a chair, a plain cabinet, a fume hood,
// 3 differently-topped lab benches) that the rooms don't read as one tile repeated.
// A simple stool/chair -- "each desk row has monitors and chairs".
function intChair(img, x, y) {
  img.fill(x + 5, y + 5, 6, 6, 'o');
  img.fill(x + 5, y + 5, 6, 1, 'O');
  img.fill(x + 5, y + 11, 1, 3, 'K');
  img.fill(x + 10, y + 11, 1, 3, 'K');
}
// A plain blue cabinet (no monitor) -- "blue cabinets along a wall", distinct from `intIcvlBench`
// (a bench *with* a monitor on top).
function intIcvlCabinet(img, x, y) {
  img.fill(x + 1, y + 2, TILE - 2, 13, 'icvlBlue');
  img.fill(x + 1, y + 2, TILE - 2, 1, 'icvlBlueHi');
  img.fill(x + 4, y + 6, 1, 8, 'K');
  img.fill(x + 11, y + 6, 1, 8, 'K');
  img.set(x + 5, y + 9, 'chandelierGlow');
  img.set(x + 10, y + 9, 'chandelierGlow');
}
// A fume hood beside the Physics Lab's sink ("a sink + fume hood") -- a light cabinet with a dark
// vent recess and an extraction duct along the top.
function intFumeHood(img, x, y) {
  img.box(x + 1, y + 1, TILE - 2, 13, 'Q');
  img.fill(x + 3, y + 3, TILE - 6, 8, '*');
  img.fill(x + 1, y, TILE - 2, 1, 'o');
}
// 3 differently-topped lab benches ("each with varied equipment on top -- scopes, flasks, a
// laptop"), each drawn over the same wood-topped bench, the equipment sitting on its own worktop
// (y+5..y+11) rather than floating above it.
function intLabBenchScope(img, x, y) {
  intLabBenchWood(img, x, y);
  img.fill(x + 6, y + 6, 4, 4, 'o');
  img.fill(x + 7, y + 4, 2, 3, 'O');
}
function intLabBenchFlask(img, x, y) {
  intLabBenchWood(img, x, y);
  img.fill(x + 5, y + 7, 2, 3, '@');
  img.fill(x + 9, y + 6, 2, 4, '!');
}
function intLabBenchLaptop(img, x, y) {
  intLabBenchWood(img, x, y);
  img.fill(x + 5, y + 6, 7, 4, 'o');
  img.fill(x + 6, y + 5, 5, 1, 'Q');
}

// ---------- Quality loop, Interior art run 3 (docs/quality/scorecard.md, 2026-09-29) ----------
// "Foyer... bland: white stripes for columns, the chandelier reads as a gold plus sign... tiny
// reception desk and sofas... empty of people"; "plants sit on brick-tile pedestals"; "Physics Lab
// still a uniform grid, sparse wall decoration".

// The interior potted plant (LimeZu's own crop already has a proper round terracotta pot baked in --
// see MEMORY.md) WITHOUT the outdoor `plant()`'s own `floor()` background call, which was a warm
// plank/brick fill meant for the meadow-house test map, not Main Block's own marble/tile floors --
// that fill showing through the sprite's transparent margins is exactly "plants on brick tiles".
function intPottedPlant(img, x, y) {
  blitFit(img, x, y, loadAtlas(LIMEZU.plant.atlas), LIMEZU.plant.sx, LIMEZU.plant.sy, LIMEZU.plant.sw, LIMEZU.plant.sh, { maxW: 14, maxH: 15 });
}

// Round columns (quality loop run 3: "make them read as round white columns (a shaded cylinder with
// a capital and base, 2 tiles wide)"): each half-tile shades from light (at the seam between the two
// tiles, the cylinder's own lit centre) to dark (at the tile's outer edge, the shadowed side) --
// side-by-side, the two halves read as one round column, not two flat stripes. `band` adds a
// lighter flared cap (top row) or a darker flared foot (bottom row) of the 2-wide x 3-tall block
// build-interiors.js places these in.
function intColumnHalf(img, x, y, side, band) {
  const seamX = side === 'L' ? TILE - 1 : 0; // the edge touching the *other* half-tile
  for (let xx = 0; xx < TILE; xx++) {
    const d = Math.abs(xx - seamX);
    const key = d < 4 ? 'wallHi' : d < 10 ? 'columnBody' : 'columnShade';
    img.fill(x + xx, y, 1, TILE, key);
  }
  if (band === 'cap') {
    img.fill(x, y, TILE, 3, 'wallHi');
    img.fill(x, y + 2, TILE, 1, 'K');
  } else if (band === 'base') {
    img.fill(x, y + TILE - 3, TILE, 3, 'columnShade');
    img.fill(x, y + TILE - 4, TILE, 1, 'K');
    img.fill(x, y + TILE - 1, TILE, 1, 'K');
  }
}
function intColumnCapL(img, x, y) { intColumnHalf(img, x, y, 'L', 'cap'); }
function intColumnCapR(img, x, y) { intColumnHalf(img, x, y, 'R', 'cap'); }
function intColumnShaftL(img, x, y) { intColumnHalf(img, x, y, 'L', null); }
function intColumnShaftR(img, x, y) { intColumnHalf(img, x, y, 'R', null); }
function intColumnBaseL(img, x, y) { intColumnHalf(img, x, y, 'L', 'base'); }
function intColumnBaseR(img, x, y) { intColumnHalf(img, x, y, 'R', 'base'); }

// A large rug in front of the staircase (quality loop run 3) -- a warm patterned floor tile, low
// contrast in the body (same "no checker" rule as the rest of the floor kit) with a distinct dark
// border so it reads as a rug laid over the marble, not more marble.
function intRug(img, x, y) {
  img.fill(x, y, TILE, TILE, 'marbleRunner');
  img.fill(x + 2, y + 2, TILE - 4, TILE - 4, 'marbleRunnerDark');
  img.fill(x + 4, y + 4, TILE - 8, TILE - 8, 'marbleRunner');
}
// A bigger reception desk (quality loop run 3: "4-5 tiles, a curved counter look") -- tapered end
// caps either side of the existing straight `intReceptionDesk` centre section, so the counter reads
// as gently curving inward at both ends instead of a flat slab.
function intReceptionDeskEnd(img, x, y, side) {
  const inset = side === 'L' ? [3, 0] : [0, 3];
  img.box(x + 1 + inset[0], y + 6, TILE - 2 - inset[0] - inset[1], 8, 'N');
  img.fill(x + 1 + inset[0], y + 6, TILE - 2 - inset[0] - inset[1], 1, '&');
}
function intReceptionDeskL(img, x, y) { intReceptionDeskEnd(img, x, y, 'L'); }
function intReceptionDeskR(img, x, y) { intReceptionDeskEnd(img, x, y, 'R'); }

// A wall poster / periodic table / diagram (quality loop run 3: "posters/periodic table and diagrams
// on walls" for the Physics Lab, "wall posters/notice boards" for corridors) -- a plain sheet pinned
// to the wall, distinct from `intNoticeboard` (a corkboard with pinned notes): a flat colour field
// with a grid of thin lines, reading as a chart/diagram rather than a corkboard.
function intWallPoster(img, x, y) {
  bitsWallPlain(img, x, y);
  img.fill(x + 2, y + 2, TILE - 4, 11, 'W');
  for (let gx = 4; gx < TILE - 2; gx += 3) img.fill(x + gx, y + 3, 1, 9, 'icvlBlue');
  for (let gy = 4; gy < 12; gy += 3) img.fill(x + 3, y + gy, TILE - 6, 1, 'icvlBlue');
}
// A small door nameplate (quality loop run 3: "doors with small name plates beside them") -- a tiny
// plaque mounted on the wall next to a door, placed via Floor.placeStructure at a specific spot
// (not part of a door object itself), so it works beside any door without new warp data.
function intNameplate(img, x, y) {
  bitsWallPlain(img, x, y);
  img.fill(x + 5, y + 6, 6, 4, 'wallHi');
  img.fill(x + 5, y + 6, 6, 1, 'K');
}
// An equipment trolley (quality loop run 3: "an equipment trolley") -- a small wheeled cart with a
// tray of loose apparatus, for the Physics Lab.
function intEquipmentTrolley(img, x, y) {
  img.box(x + 2, y + 4, TILE - 4, 7, 'Q');
  img.fill(x + 3, y + 5, 3, 2, '@');
  img.fill(x + 9, y + 5, 3, 2, '!');
  img.set(x + 4, y + 12, 'K');
  img.set(x + 11, y + 12, 'K');
}

// ---------- characters: recolored LimeZu Modern Interiors Free sprites (FB-0025, ADR 0013) ----------
// The player and the new campus NPCs are recolors of LimeZu's free "Characters_free" pack
// (assets/vendor/limezu-modern-interiors-free/, free-tier licence: non-commercial use and *edits*
// allowed -- decisions/0012, docs/research/asset-packs.md's 2026-09-21 addendum). Tomas (the
// meadow/house test-map NPC, see below) is unchanged hand-drawn art -- FB-0025 and this pass only
// covers the lead and the campus-population NPCs the owner asked for.
//
// Each named character (Amelia/Adam/Alex/Bob) ships three 16-wide sheets, decoded and measured
// directly rather than trusted from the file names (see MEMORY.md for the method):
//   - `<name>_idle_16x16.png`: 64x32, four 16x32 frames, one static pose per direction.
//   - `<name>_run_16x16.png` / `<name>_idle_anim_16x16.png`: 384x32, 24 columns = four 6-frame
//     blocks (one block per direction), with genuine per-frame motion (verified by diffing columns).
// In both layouts, the four directions sit in the same order: column/block 0 faces RIGHT, 1 is up
// (back of the head, no face), 2 faces LEFT, 3 is down (facing the camera) -- verified ERR-0007-style
// by actually decoding the source PNGs and looking at where the face/skin pixels sit in each column,
// not assumed from a guess about how these packs are usually laid out. The original FB-0025/ADR-0013
// pass got this wrong: it read block 0 as "a side profile, mirrored for the other side" and built
// only 3 rows (down/up/"left" -- actually built from block 0, i.e. genuinely right-facing art), then
// had world.js mirror that same row for "right" -- so *both* directions ended up wrong (a real
// right-facing frame shown unflipped while walking left, and that same frame mirrored into a
// left-facing pose while walking right; ERR-0007, "she moonwalks both ways"). FB-0043 fixes it by
// building all FOUR rows for real, one per direction, each from its own genuine block -- no mirroring
// anywhere in this file or in any of its consumers.
// Every frame's actual figure occupies only the bottom ~22-24 rows of the 32-tall canvas (rows
// 8-31) -- confirmed with a bounding-box scan, not assumed -- so building a 16x24 frame (ADR 0013)
// means cropping that bottom 24px band, not the whole 32px canvas.
const CHAR_LIB = 'limezu-modern-interiors-free/Modern tiles_Free/Characters_free';
const CHAR_W = TILE; // 16
const CHAR_H = 24; // ADR 0013: characters are 16x24 now, was 16x16
const CHAR_WALK_FRAMES = 6; // one full stride cycle, taken straight from the pack's run sheet
const CHAR_IDLE_ANIM_FRAME = 3; // mid-block idle_anim frame -- reads as the clearest blink/breathe pose
// FB-0043: 4 real rows now, down/up/left/right -- was 3 (down/up/"left", with world.js mirroring that
// row for right). Every consumer of this sheet layout (src/scenes/world.js, src/minigames/
// framework-scene.js, platformer.js/flappy.js, intro-customize.js/intro-bus.js) was updated alongside
// this: search each for "FB-0043" to see what changed and why.
const CHAR_ROWS = ['down', 'up', 'left', 'right']; // output row order (docs/STYLE_GUIDE.md "Characters")
// Column in idle_16x16 *and* block index (of 6) in run/idle_anim -- both sheets share the same
// four-direction order, so one table serves both lookups. FB-0043: `right: 0`/`left: 2` (previously
// just `left: 0`, which was actually the pack's right-facing block mislabeled).
const CHAR_DIR_INDEX = { right: 0, up: 1, left: 2, down: 3 };

function charSheet(name, suffix) {
  return loadAtlas(path.join(CHAR_LIB, `${name}_${suffix}_16x16.png`));
}

// Crops the bottom CHAR_H rows of a 16x32 source frame at (sx, 0) into `img` at (dx, dy), recoloring
// as it's copied (see the *_RECOLOR tables below).
function blitCharFrame(img, dx, dy, atlas, sx, remap) {
  blitAtlas(img, dx, dy, atlas, sx, 32 - CHAR_H, CHAR_W, CHAR_H, { remap });
}

// One character's full sheet: 4 rows (down/up/left/right, FB-0043 -- no mirroring anywhere, every
// direction is its own genuine art) x (1 idle frame, CHAR_WALK_FRAMES walk frames, 1 idle-anim frame)
// -- CHAR_COLS wide. `recolorMap` is an exact-RGB swap table (see AMELIA_RECOLOR etc.), built by
// decoding the source PNGs and sampling every distinct color they actually use -- the method
// docs/research/asset-packs.md's character addendum already proved out. Anything not in the map
// passes through unchanged, so a character can keep its own hair/skin and only have its clothes
// recolored (see the NPCs below).
function buildCharacter(name, recolorMap) {
  const idle = charSheet(name, 'idle');
  const run = charSheet(name, 'run');
  const idleAnim = charSheet(name, 'idle_anim');
  const remap = remapExact(recolorMap);
  const img = new Img(CHAR_COLS * CHAR_W, CHAR_ROWS.length * CHAR_H);
  CHAR_ROWS.forEach((dir, row) => {
    const y = row * CHAR_H;
    const dirIndex = CHAR_DIR_INDEX[dir];
    blitCharFrame(img, 0, y, idle, dirIndex * CHAR_W, remap);
    const block = dirIndex * CHAR_WALK_FRAMES;
    for (let f = 0; f < CHAR_WALK_FRAMES; f++) {
      blitCharFrame(img, (1 + f) * CHAR_W, y, run, (block + f) * CHAR_W, remap);
    }
    blitCharFrame(img, (1 + CHAR_WALK_FRAMES) * CHAR_W, y, idleAnim, (block + CHAR_IDLE_ANIM_FRAME) * CHAR_W, remap);
  });
  return img;
}
const CHAR_COLS = 2 + CHAR_WALK_FRAMES; // idle, CHAR_WALK_FRAMES walk frames, 1 idle-anim frame

// Exact-RGB recolor (as opposed to remapShaded's luminance bucketing above): looks up each sampled
// pixel's hex in `map` and swaps it verbatim, leaving anything not listed untouched. Right for
// character art because LimeZu's soft-shaded sprites use a small, consistent set of exact colors per
// character (~18-23 total per character, decoded and counted -- see MEMORY.md) rather than the wide
// anti-aliased gradients a luminance bucket would be needed for.
function remapExact(map) {
  const table = new Map(Object.entries(map).map(([src, dst]) => [src, hexToRgb(dst)]));
  return (r, g, b, a) => {
    const key = `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    const rgb = table.get(key);
    return rgb ? [rgb[0], rgb[1], rgb[2], a] : [r, g, b, a];
  };
}

// The lead (Amelia): every color the pack's idle/run/idle_anim sheets use for her (21 total,
// decoded and counted), bucketed by eye into hair/skin/top/pants/outline and mapped onto the owner's
// brief -- black hair, fair skin, hot pink top, light pink skirt (docs/STYLE_GUIDE.md "Characters")
// -- reusing the exact hex already in PALETTE (q/S/s/M/c/P) so the lead matches wherever else those
// colors appear.
const HAIR_HI = '#4a3527'; // a lift on PALETTE.q for a hint of sheen -- still reads as black hair
const AMELIA_RECOLOR = {
  '#ba8d5e': HAIR_HI, // hair highlight
  '#957350': PALETTE.q, // hair base
  '#8d7051': PALETTE.q, // hair base (secondary tone)
  '#8a6552': PALETTE.q, // hair shadow
  '#bf8b78': PALETTE.S, // skin highlight
  '#a77a67': PALETTE.s, // skin mid
  '#b57972': PALETTE.s, // cheek blush
  '#aa5e56': PALETTE.s, // cheek blush (shadow)
  '#b58472': PALETTE.s, // skin (rare blend)
  '#b2736d': PALETTE.s, // skin (rare blend)
  '#a85377': PALETTE.c, // top base/shadow
  '#b95d72': PALETTE.M, // top highlight / center stripe
  '#c78c59': PALETTE.P, // skirt base
  '#b35e3f': PALETTE.P, // skirt shadow
  '#674d49': PALETTE.K, // eyes + warm outline near hair
  '#ab4a36': PALETTE.K, // shoes
  '#3a3a50': PALETTE.K, // outline
  '#46465e': PALETTE.K, // outline
  '#565972': PALETTE.K, // outline
  '#6c5981': PALETTE.K, // outline (rare blend)
  '#787d93': PALETTE.K, // outline (rare blend)
};

// LUG volunteer (Adam, otherwise unrecolored -- his own olive hair and skin already look nothing
// like the lead): a teal polo, a small nod to the club without inventing a mascot.
const LUG_TEAL = '#2f9e8f';
const LUG_TEAL_HI = '#4fc2ae';
const ADAM_RECOLOR = { '#805e8e': LUG_TEAL, '#9f74a8': LUG_TEAL_HI };

// Background student A (Alex): the red plaid shirt becomes plain blue (reusing PALETTE.B, the
// existing pants blue) so he doesn't read as a smaller copy of the volunteer or the lead. His own
// brown hair and grey vest are untouched.
const STUDENT_A_RECOLOR = {
  '#5a444a': '#28408f', // shirt shadow
  '#6f494d': '#28408f', // shirt shadow (secondary tone)
  '#a2394b': PALETTE.B, // shirt base
  '#ae4a52': '#5f86e6', // shirt highlight
};

// Background student B (Bob): the near-black blazer becomes mustard/gold (STYLE_GUIDE's existing
// Accent gold ramp) instead of the dark tone the pack ships -- his hair is already dark, and a
// second black-haired, dark-shirted NPC standing next to the lead would read as reused art.
const STUDENT_B_RECOLOR = {
  '#5d585f': '#a8812a', // blazer shadow (Accent gold "deep")
  '#555157': '#a8812a', // blazer shadow (secondary tone)
  '#716b6e': '#e0b84f', // blazer base (Accent gold "shadow", used here as the base tone)
  '#6c6e85': '#ffd23f', // collar/shirt highlight (Accent gold "base")
};

// Mustafa, the LUG organiser who meets her at the gate (docs/STORY.md "Opening", ADR 0016 -- a script
// actor, src/scripts.js SCRIPTS.opening/gate2, not a placed map NPC). Only 4 named characters exist in
// this pack (Amelia/Adam/Alex/Bob, all already spoken for: the lead/volunteer/student-a/student-b), so
// this reuses Adam's own body again -- same as the volunteer -- with a warm maroon organiser polo
// instead of Adam's teal, so the two don't read as the same character recolored twice standing side by
// side (they never actually do in this game, but the same reasoning as STUDENT_A/B_RECOLOR applies).
const MUSTAFA_MAROON = '#a33b4a';
const MUSTAFA_MAROON_HI = '#c8637a';
const MUSTAFA_RECOLOR = { '#805e8e': MUSTAFA_MAROON, '#9f74a8': MUSTAFA_MAROON_HI };

// ---------- ambient campus/Main Block life (quality loop, Characters run 1, 2026-09-29) ----------
// "The world is empty" -- background students, walking, sitting, chatting (src/maps.js `ambient`,
// src/scenes/world.js createAmbient()). Same 4 named characters as everything else above (this pack
// ships nothing else), so variety comes from more recolors of the same 3 non-lead bodies -- each pair
// reuses that body's own already-established recolor keys (ADAM_RECOLOR's shirt pair, STUDENT_A/B's
// own shirt/blazer keys) with a fresh color, the same "clothes-only, keep the hair/skin" approach
// those already use. Amelia (the lead's own body) is deliberately left out of this pool -- she's
// customisable at the start of a new game, and an ambient NPC that could coincidentally match
// whichever swatch the player just picked would read as a glitch, not a background student.
const AMBIENT_A_RECOLOR = { '#805e8e': '#c0602f', '#9f74a8': '#e69a5c' }; // Adam body, rust/orange polo
const AMBIENT_B_RECOLOR = { '#805e8e': '#2c4a7a', '#9f74a8': '#6f95d6' }; // Adam body, navy polo
const AMBIENT_C_RECOLOR = { // Alex body, olive/mustard shirt (Alex's own shirt keys, STUDENT_A_RECOLOR's own comment)
  '#5a444a': '#6b5a1e', '#6f494d': '#6b5a1e', '#a2394b': '#a8812a', '#ae4a52': '#d4ac4a',
};
const AMBIENT_D_RECOLOR = { // Alex body, purple shirt
  '#5a444a': '#4a2d6e', '#6f494d': '#4a2d6e', '#a2394b': '#7a5ad9', '#ae4a52': '#a893ea',
};
const AMBIENT_E_RECOLOR = { // Bob body, forest-green blazer (Bob's own blazer keys, STUDENT_B_RECOLOR's own comment)
  '#5d585f': '#1f5227', '#555157': '#1f5227', '#716b6e': '#2f7a3a', '#6c6e85': '#5ab552',
};
const AMBIENT_F_RECOLOR = { // Bob body, crimson blazer
  '#5d585f': '#6e1f24', '#555157': '#6e1f24', '#716b6e': '#a83b41', '#6c6e85': '#d96a6f',
};

// ---------- character customisation (M3a, docs/STORY.md "Opening" step 3) ----------
//
// The owner's brief asks for clothes-colour swatches (hair/skin "too if the recolour pipeline makes
// it cheap"). Approach chosen, and why: buildCharacter() already recolors from an exact-RGB swap
// table, so a second clothes palette is just a different table -- no runtime recolor code needed.
// One full sheet is generated per swatch at build time (this section), and the game loads only the
// one the player actually picked (src/main.js BootScene, keyed off GameState.customization.clothes)
// -- "generate one sheet per palette option", not a runtime Phaser pipeline/texture copy, because
// this project has no build step and already treats art as data baked by tools/make-assets.js, never
// computed in the browser. Hair/skin swatches are NOT included in this pass: every extra axis
// multiplies the sheet count (5 clothes x 3 hair x 2 skin = 30 sheets to draw, decode and commit),
// and the only place that needs a *live* preview of several of them at once is the customisation
// screen itself, which would then need to preload all 30 just to show swatches -- not "cheap" once
// actually costed out, unlike the single clothes axis. Clothes-only satisfies the brief's "at
// minimum" and leaves hair/skin as a follow-up if the owner asks for it after seeing this.
const CLOTHES_SWATCHES = {
  // pink is the default/original look (owner's 2026-09-13 brief) -- unchanged from AMELIA_RECOLOR.
  pink: { top: PALETTE.c, topHi: PALETTE.M, skirt: PALETTE.P },
  sky: { top: '#3b7dd8', topHi: '#9fd3ff', skirt: '#2a5aa8' },
  mint: { top: '#3d8a3f', topHi: '#8fd46a', skirt: '#2b6b30' },
  lavender: { top: '#7a5ad9', topHi: '#b9a6f2', skirt: '#5a3fae' },
  sunset: { top: '#e0803a', topHi: '#ffc27a', skirt: '#a85e22' },
};

// Overrides just the 4 source colors AMELIA_RECOLOR maps to top/skirt tones (see the table above),
// keeping every other entry (hair, skin, outline) exactly as the owner's original brief specified --
// only clothes change between swatches.
function ameliaClothesRecolor(swatch) {
  return {
    ...AMELIA_RECOLOR,
    '#a85377': swatch.top, // top base/shadow
    '#b95d72': swatch.topHi, // top highlight / center stripe
    '#c78c59': swatch.skirt, // skirt base
    '#b35e3f': swatch.skirt, // skirt shadow
  };
}

// ---------- Tomas + old player art (hand-drawn, DOWN_TOP/UP_TOP/SIDE_TOP/legs below): Tomas keeps
// this unchanged art (see the big comment above -- FB-0025 only covers the lead and the new campus
// NPCs), just bottom-aligned into the new 16x24 canvas like every other character (ADR 0013). The
// player no longer uses this art -- see AMELIA_RECOLOR/buildCharacter above. ----------

const DOWN_TOP = [
  '................',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KHSSSSSSHK...',
  '...KSKSSSSKSK...',
  '...KSSSSSSSSK...',
  '....KSSSSSSK....',
  '...KRRRRRRRRK...',
  '..KSKRRRRRRKSK..',
  '..KSKrRRRRrKSK..',
  '..KKKBBBBBBKKK..',
  '....KBBBBBBK....',
];

const UP_TOP = [
  ...DOWN_TOP.slice(0, 5),
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KSHHHHHHSK...',
  '....KSSSSSSK....',
  ...DOWN_TOP.slice(9),
];

const SIDE_TOP = [
  '................',
  '.....KKKKKK.....',
  '....KHHHHHHK....',
  '...KHHHHHHHHK...',
  '...KHHHHHHHHK...',
  '...KSSSSHHHHK...',
  '...KSKSSSHHHK...',
  '..KSSSSSSHHK....',
  '...KSSSSSSK.....',
  '....KRRRRRRK....',
  '....KRRRSSRK....',
  '....KRRRSSRK....',
  '....KBBBBBBK....',
  '....KBBBBBBK....',
];

const FRONT_LEGS = {
  idle: ['....KBBKKBBK....', '.....KK..KK.....'],
  step1: ['....KBBKKKK.....', '.....KK.........'],
  step2: ['.....KKKKBBK....', '.........KK.....'],
};

const SIDE_LEGS = {
  idle: ['.....KBBBBK.....', '.....KKKKKK.....'],
  step1: ['....KBBKKBBK....', '...KKK....KKK...'],
  step2: ['.....KBKKBK.....', '......KKKK......'],
};

// ---------- npc: Tomas, an old villager (player body, recolored, with a beard) ----------

const recolor = (rows, map) => rows.map((row) => [...row].map((ch) => map[ch] || ch).join(''));
const replaceRows = (rows, replacements) => rows.map((row, i) => replacements[i] || row);
const TOMAS_COLORS = { H: 'A', R: 'J', r: 'h', B: 'a' };
// This hand-drawn art is still a flat 16 tall; pad it to CHAR_H with transparent rows on *top* so it
// sits bottom-aligned in the frame, exactly like the pack characters' own 16x24 crop (ADR 0013) --
// Tomas's feet land on the same row of the frame as everyone else's.
const growToCharHeight = (rows) => Array(CHAR_H - rows.length).fill('.'.repeat(CHAR_W)).concat(rows);

const NPC_FRAMES = [
  growToCharHeight(replaceRows(recolor([...DOWN_TOP, ...FRONT_LEGS.idle], TOMAS_COLORS), {
    7: '...KSAAAAAASK...',
    8: '....KAAAAAAK....',
  })),
  growToCharHeight(recolor([...UP_TOP, ...FRONT_LEGS.idle], TOMAS_COLORS)),
  growToCharHeight(replaceRows(recolor([...SIDE_TOP, ...SIDE_LEGS.idle], TOMAS_COLORS), {
    7: '..KSAAAAAAAK....',
    8: '...KAAAAAAK.....',
  })),
];

// ---------- items (same order as the `frame` numbers in src/items.js) ----------

const ITEM_ICONS = [
  sprite('apple', [
    '................',
    '........KK......',
    '.......KnK.KK...',
    '.......KnKKGGK..',
    '....KKKKnKKKK...',
    '...KRRRRRRRRRK..',
    '..KRWWRRRRRRRRK.',
    '..KRWRRRRRRRRRK.',
    '..KRRRRRRRRRRRK.',
    '..KRRRRRRRRRRrK.',
    '..KRRRRRRRRRRrK.',
    '...KRRRRRRRRrK..',
    '...KrRRRRRRrrK..',
    '....KrrRRrrrK...',
    '.....KKKKKKK....',
    '................',
  ]),
  sprite('sword', [
    '............KKK.',
    '...........KWQK.',
    '..........KWQOK.',
    '.........KWQOK..',
    '........KWQOK...',
    '.......KWQOK....',
    '......KWQOK.....',
    '..KK.KWQOK......',
    '..KYKWQOK.......',
    '...KYYOK........',
    '..KNKYYK........',
    '.KNK.KK.........',
    'KNK.............',
    'KK..............',
    '................',
    '................',
  ]),
  // Student keycard: plastic card, gold photo swatch, dark magnetic stripe.
  sprite('keycard', [
    '................',
    '................',
    '.KKKKKKKKKKKKK..',
    '.KVVVVVVVVVVVK..',
    '.KVYYYVVVVVVVK..',
    '.KVYYYVVVVVVVK..',
    '.KVYYYVVVVVVVK..',
    '.KVVVVVVVVVVVK..',
    '.KqqqqqqqqqqqK..',
    '.KqqqqqqqqqqqK..',
    '.KVVVVVVVVVVVK..',
    '.KKKKKKKKKKKKK..',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Phone: dark case, glowing screen, home button.
  sprite('phone', [
    '................',
    '....KKKKKKK.....',
    '...KAAAAAAAK....',
    '...KAwwwwwAK....',
    '...KAwwwwwAK....',
    '...KAwwwwwAK....',
    '...KAwwwwwAK....',
    '...KAwwwwwAK....',
    '...KAwwwwwAK....',
    '...KAwwwwwAK....',
    '...KAAAAAAAK....',
    '...KAAAKAAAK....',
    '....KKKKKKK.....',
    '................',
    '................',
    '................',
  ]),
  // Student ID: card with a small photo, a name band and text lines.
  sprite('idCard', [
    '................',
    '................',
    '.KKKKKKKKKKKKK..',
    '.KVVVVVVVVVVVK..',
    '.KVSSSVVVVVVVK..',
    '.KVSsSVVVVVVVK..',
    '.KVSSSVRRRRRVK..',
    '.KVVVVVRRRRRVK..',
    '.KVVVVVVVVVVVK..',
    '.KVVVVVLLLLLVK..',
    '.KVVVVVLLLLLVK..',
    '.KKKKKKKKKKKKK..',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Notebook: brown cover, wire-spiral binding, a sliver of pages peeking out.
  sprite('notebook', [
    '................',
    '...KKKKKKKKKK...',
    '..oKNNNNNNNNKo..',
    '..oKNNNNNNNNKo..',
    '..oKNnnnnnnNKo..',
    '..oKNNNNNNNNKo..',
    '..oKNNNNNNNNKo..',
    '..oKNnnnnnnNKo..',
    '..oKNNNNNNNNKo..',
    '..oKNNNNNNNNKo..',
    '..oKKKKKKKKKKo..',
    '...WWWWWWWWWW...',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Laptop: silver lid with a dark screen, open over a keyboard deck.
  sprite('laptop', [
    '................',
    '................',
    '..KKKKKKKKKKK...',
    '..KAAAAAAAAAK...',
    '..KAqqqqqqqAK...',
    '..KAqWWWWWqAK...',
    '..KAqqqqqqqAK...',
    '..KAqqqqqqqAK...',
    '..KAAAAAAAAAK...',
    '.KKKKKKKKKKKKK..',
    '.KoooooooooooK..',
    '.KKKKKKKKKKKKK..',
    '................',
    '................',
    '................',
    '................',
  ]),
  // Coffee cup: to-go cup with a lid and a wisp of steam.
  sprite('coffee', [
    '.......WW.......',
    '......W..W......',
    '.......WW.......',
    '................',
    '.....KKKKKK.....',
    '....KFFFFFFK....',
    '....KNNNNNNK....',
    '....KFffffFK....',
    '....KFffffFK....',
    '....KFffffFK....',
    '....KFffffFK....',
    '....KFffffFK....',
    '.....KFFFFK.....',
    '.....KKKKKK.....',
    '................',
    '................',
  ]),
];

// ---------- held items: tiny 8x8 versions shown in the character's hand (FB-0002) ----------
// Same order as ITEM_ICONS, so an item's `frame` indexes both sheets.

const HELD_ITEM_ICONS = [
  sprite('apple-held', [
    '...KK...',
    '..KnKK..',
    '.KRRRRK.',
    'KRRRRRRK',
    'KRRRRRRK',
    '.KRRRRK.',
    '..KKKK..',
    '........',
  ], 8, 8),
  sprite('sword-held', [
    '.....KK.',
    '....KWK.',
    '...KWQK.',
    '..KWQK..',
    '.KYQK...',
    'KYYK....',
    'KNK.....',
    'KK......',
  ], 8, 8),
  sprite('keycard-held', [
    '........',
    '.KKKKK..',
    '.KVVVK..',
    '.KVYVK..',
    '.KqqVK..',
    '.KKKKK..',
    '........',
    '........',
  ], 8, 8),
  sprite('phone-held', [
    '........',
    '..KKK...',
    '.KAwAK..',
    '.KAwAK..',
    '.KAwAK..',
    '..KAK...',
    '........',
    '........',
  ], 8, 8),
  sprite('idCard-held', [
    '........',
    '.KKKKK..',
    '.KSSVK..',
    '.KVRVK..',
    '.KVLVK..',
    '.KKKKK..',
    '........',
    '........',
  ], 8, 8),
  sprite('notebook-held', [
    '........',
    '.KKKKK..',
    '.KNNNK..',
    '.KNnNK..',
    '.KNNNK..',
    '.KKKKK..',
    '........',
    '........',
  ], 8, 8),
  sprite('laptop-held', [
    '........',
    '.KKKKK..',
    '.KAqAK..',
    '.KAqAK..',
    'KooooK..',
    '.KKKKK..',
    '........',
    '........',
  ], 8, 8),
  sprite('coffee-held', [
    '..WW....',
    '.KKKK...',
    'KFFFFK..',
    'KFffFK..',
    'KFffFK..',
    '.KKKK...',
    '........',
    '........',
  ], 8, 8),
];

// The interaction bubble (docs/STYLE_GUIDE.md "Speech bubbles and interaction"): frame 0 is the
// white "E" keycap shown whenever something's in range; frame 1 is the gold "!" shown instead when
// it has something new to say (src/dialog.js hasNewDialog(), drawn by src/scenes/world.js).
const PROMPT_E = sprite('prompt-e', [
  '................',
  '..KKKKKKKKKKKK..',
  '..KWWWWWWWWWWK..',
  '..KWWWKKKKWWWK..',
  '..KWWWKWWWWWWK..',
  '..KWWWKKKWWWWK..',
  '..KWWWKWWWWWWK..',
  '..KWWWKKKKWWWK..',
  '..KWWWWWWWWWWK..',
  '..KOOOOOOOOOOK..',
  '..KKKKKKKKKKKK..',
  '.......KK.......',
  '................',
  '................',
  '................',
  '................',
]);

const PROMPT_BANG = sprite('prompt-bang', [
  '................',
  '..KKKKKKKKKKKK..',
  '..KYYYYYYYYYYK..',
  '..KYYYYKKYYYYK..',
  '..KYYYYKKYYYYK..',
  '..KYYYYKKYYYYK..',
  '..KYYYYYYYYYYK..',
  '..KYYYYKKYYYYK..',
  '..KYYYYYYYYYYK..',
  '..KyyyyyyyyyyK..',
  '..KKKKKKKKKKKK..',
  '.......KK.......',
  '................',
  '................',
  '................',
  '................',
]);

// ---------- UI kit (docs/GAME_FEEL.md "one UI kit", docs/STYLE_GUIDE.md panel colors) ----------
// One 9-slice frame for every panel/button in the game (dialog, menus, tracker, banners, mini-game
// cards, ...), recolored from the Kenney Pixel UI Pack's own "9-Slice/Ancient/tan" frame (CC0,
// assets/vendor/kenney-pixel-ui-pack/, credited in CREDITS.md) instead of drawn pixel-by-pixel.
// Decoded directly (not guessed from a thumbnail): the pack's 48x48 source is really just a flat
// 45x45 bordered square (a fill, a border line, a light top/left bevel line and a dark bottom/right
// one -- 4 solid colors total, already following this game's own "one light source, top-left" rule,
// which is exactly why this frame was picked over any other) plus its own baked-in drop-shadow sliver
// along the last few rows/columns, cropped off below since this game already draws its own soft
// shadow behind every panel (see makePanel(), src/scenes/ui.js) and stacking two shadows would just
// double-darken the same corner. `tan_pressed.png` is the pack's own "flush, no shadow" variant, used
// for the button's own pressed state below.
const KENNEY_UI_PANEL = 'kenney-pixel-ui-pack/9-Slice/Ancient/tan.png';
const KENNEY_UI_PANEL_PRESSED = 'kenney-pixel-ui-pack/9-Slice/Ancient/tan_pressed.png';
const UI_FRAME_CROP = 45; // the pack's own bordered square, minus its baked-in shadow sliver past it
const UI_FRAME_SCALE = 2; // upscaled so the border reads as a chunky ~4px line (STYLE_GUIDE's own spec)
const UI_FRAME_SIZE = UI_FRAME_CROP * UI_FRAME_SCALE; // one frame's width/height in ui-panel.png (90)
// src/scenes/ui.js's makePanel()/makeButtonFrame() use this same inset for every NineSlice they build
// -- keeping the number here (not re-derived there) is the single source of truth for both files.
const UI_FRAME_BORDER = 2 * UI_FRAME_SCALE; // 4

// The pack frame's own 4 flat colors (sampled by decoding the PNG directly, not eyeballed), mapped
// onto this game's palette: fill, border line, the light top/left bevel and the dark bottom/right one
// (a corner "rivet" fleck in the pack's own art, and this game's own soft shadow color here). Each
// entry is `[hex, alpha]` -- alpha lets the fill stay close to STYLE_GUIDE's "92% opacity" panel spec
// baked directly into the texture, rather than something every caller has to remember to set again.
function uiFrameMap(fill, border, hiBevel, loBevel) {
  const map = { '#d3bf8f': fill, '#b1a077': border, '#d9cdaf': hiBevel };
  if (loBevel) map['#a3997f'] = loBevel; // tan_pressed.png has no pixels of this color at all
  return map;
}
const UI_PANEL_MAP = uiFrameMap(['#1a1c2c', 235], ['#eadbb8', 255], ['#fff1a8', 255], ['#000000', 90]);
const UI_BUTTON_NORMAL_MAP = uiFrameMap(['#1a1c2c', 255], ['#eadbb8', 255], ['#fff1a8', 255], ['#000000', 100]);
// Hover/focused (docs/GAME_FEEL.md rule 7, "big buttons... drawn properly"): a brighter fill and a
// gold border, matching this game's existing highlight color everywhere else a selection is shown.
const UI_BUTTON_HOVER_MAP = uiFrameMap(['#24273c', 255], ['#ffd23f', 255], ['#fff1a8', 255], ['#000000', 110]);
// Pressed: built from tan_pressed.png (no border-line pixels past the frame at all, see above), and
// the top/left bevel line is recolored dark instead of light -- reading as a sunken, pushed-in frame
// rather than the normal state's own raised one (docs/GAME_FEEL.md "inverted bevel" rule).
const UI_BUTTON_PRESSED_MAP = uiFrameMap(['#1a1c2c', 255], ['#eadbb8', 255], ['#000000', 70], null);

// Crops the pack frame's own 45x45 bordered square out of `atlasPath`, recolors it pixel-by-pixel via
// `colorMap` (`{'#srcHex': ['#dstHex', alpha]}`, above) and upscales it 2x (nearest-neighbor, the same
// technique every other blit in this file uses) into a fresh Img.
function buildUiFrame(atlasPath, colorMap) {
  const atlas = loadAtlas(atlasPath);
  const out = new Img(UI_FRAME_SIZE, UI_FRAME_SIZE);
  for (let y = 0; y < UI_FRAME_CROP; y++) {
    for (let x = 0; x < UI_FRAME_CROP; x++) {
      const si = (y * atlas.width + x) * 4;
      const a = atlas.data[si + 3];
      if (a === 0) continue;
      const key = '#' + [atlas.data[si], atlas.data[si + 1], atlas.data[si + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      const target = colorMap[key];
      if (!target) continue; // this frame only ever has the colors mapped above
      const [hex, alpha] = target;
      const [r, g, b] = hexToRgb(hex);
      for (let dy = 0; dy < UI_FRAME_SCALE; dy++) {
        for (let dx = 0; dx < UI_FRAME_SCALE; dx++) out.setRGBA(x * UI_FRAME_SCALE + dx, y * UI_FRAME_SCALE + dy, r, g, b, alpha);
      }
    }
  }
  return out;
}

// Copies one Img wholesale into another at (dx, dy) -- the same job blitAtlas() does for a raw
// decoded-PNG atlas, just for an Img we built ourselves (buildUiFrame() above) instead.
function blitImg(dst, dx, dy, src) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      dst.setRGBA(dx + x, dy + y, src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]);
    }
  }
}

// One sheet, 4 frames stacked vertically -- src/scenes/ui.js's UI_PANEL_FRAME/UI_BUTTON_*_FRAME
// constants read this exact order (panel, then the button's normal/hover/pressed states).
const uiPanelSheet = new Img(UI_FRAME_SIZE, UI_FRAME_SIZE * 4);
[
  buildUiFrame(KENNEY_UI_PANEL, UI_PANEL_MAP),
  buildUiFrame(KENNEY_UI_PANEL, UI_BUTTON_NORMAL_MAP),
  buildUiFrame(KENNEY_UI_PANEL, UI_BUTTON_HOVER_MAP),
  buildUiFrame(KENNEY_UI_PANEL_PRESSED, UI_BUTTON_PRESSED_MAP),
].forEach((frame, i) => blitImg(uiPanelSheet, 0, i * UI_FRAME_SIZE, frame));

// The cursor/selection arrow (every keyboard-driven list: pause menu, controls/settings rows, dialog
// choices, the journal) and the dialog box's own bouncing "next line" arrow -- hand-drawn (this pack
// has nothing at this exact tiny size/shape), gold on the game's own outline color, same text-sprite
// technique as everything else in this file.
const UI_CURSOR = sprite('ui-cursor', [
  '................',
  '.KK.............',
  '.KYK............',
  '.KYYK...........',
  '.KYYYK..........',
  '.KYYYYK.........',
  '.KYYYYYK........',
  '.KYYYYYYK.......',
  '.KYYYYYK........',
  '.KYYYYK.........',
  '.KYYYK..........',
  '.KYYK...........',
  '.KYK............',
  '.KK.............',
  '................',
  '................',
]);
const UI_NEXT_ARROW = sprite('ui-next-arrow', [
  '................',
  '................',
  '................',
  '..KKKKKKKKKKKK..',
  '..KYYYYYYYYYYK..',
  '...KYYYYYYYYK...',
  '...KYYYYYYYYK...',
  '....KYYYYYYK....',
  '....KYYYYYYK....',
  '.....KYYYYK.....',
  '.....KYYYYK.....',
  '......KYYK......',
  '......KYYK......',
  '.......KK.......',
  '................',
  '................',
]);
const uiIcons = new Img(TILE * 2, TILE);
uiIcons.draw(UI_CURSOR, 0, 0);
uiIcons.draw(UI_NEXT_ARROW, TILE, 0);

// ---------- write files ----------

// `--out <dir>` writes somewhere else (the tests use this to check assets/ is up to date).
const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, img) => fs.writeFileSync(path.join(outDir, name), img.toPNG());

const tileRows = Math.ceil(TILES.length / TILESET_COLUMNS);
const tiles = new Img(TILESET_COLUMNS * TILE, tileRows * TILE);
const tileInfo = TILES.map(({ name, solid, overhead, draw }, i) => {
  const x = (i % TILESET_COLUMNS) * TILE;
  const y = Math.floor(i / TILESET_COLUMNS) * TILE;
  draw(tiles, x, y);
  return { name, solid: Boolean(solid), overhead: Boolean(overhead), color: tiles.averageColor(x, y, TILE, TILE) };
});
write('tiles.png', tiles);
fs.writeFileSync(
  path.join(outDir, 'tiles.json'),
  JSON.stringify({ tileSize: TILE, columns: TILESET_COLUMNS, tiles: tileInfo }, null, 2) + '\n',
);

// The player is the female lead: a recolored LimeZu Amelia (ADR 0013, FB-0025) -- black
// shoulder-length hair, fair skin, pink top, lighter pink skirt, 16x24, idle + 6-frame walk + an
// idle-anim blink/breathe frame per direction. See AMELIA_RECOLOR/buildCharacter above.
write('player.png', buildCharacter('Amelia', AMELIA_RECOLOR));

// Clothes-color customisation (M3a): one full sheet per swatch, `player-<id>.png` -- see
// ameliaClothesRecolor() above for why this is generated at build time instead of recolored live.
// `player-pink.png` is identical to `player.png` (the default look), committed anyway so
// src/main.js's BootScene can always load `assets/player-${clothes}.png` uniformly, with no special
// case for the default.
for (const [id, swatch] of Object.entries(CLOTHES_SWATCHES)) {
  write(`player-${id}.png`, buildCharacter('Amelia', ameliaClothesRecolor(swatch)));
}

// Campus NPCs (FB-0025): recolors of the pack's other three named characters, same 16x24/
// idle+walk+idle-anim layout as the player, so they're ready for the campus to be populated with
// them later (docs/research/asset-packs.md). Placed today only as fixtures on the meadow test map
// (src/maps.js) to prove the pipeline end to end; real campus placement is a follow-up task.
write('npc-volunteer.png', buildCharacter('Adam', ADAM_RECOLOR)); // the LUG volunteer
write('npc-student-a.png', buildCharacter('Alex', STUDENT_A_RECOLOR));
write('npc-student-b.png', buildCharacter('Bob', STUDENT_B_RECOLOR));
write('npc-mustafa.png', buildCharacter('Adam', MUSTAFA_RECOLOR)); // ADR 0016: the opening's own script actor
// Quality loop, Characters run 1: 6 more recolors (2 each of Adam/Alex/Bob) for ambient campus/Main
// Block life -- src/maps.js `ambient` entries, src/scenes/world.js createAmbient().
write('npc-ambient-a.png', buildCharacter('Adam', AMBIENT_A_RECOLOR));
write('npc-ambient-b.png', buildCharacter('Adam', AMBIENT_B_RECOLOR));
write('npc-ambient-c.png', buildCharacter('Alex', AMBIENT_C_RECOLOR));
write('npc-ambient-d.png', buildCharacter('Alex', AMBIENT_D_RECOLOR));
write('npc-ambient-e.png', buildCharacter('Bob', AMBIENT_E_RECOLOR));
write('npc-ambient-f.png', buildCharacter('Bob', AMBIENT_F_RECOLOR));

// Tomas (meadow/house test-map NPC): unchanged hand-drawn art, just bottom-aligned into the new
// 16x24 canvas (ADR 0013) -- no walk cycle, same 3-frame (down/up/left) sheet as before.
const npc = new Img(NPC_FRAMES.length * CHAR_W, CHAR_H);
NPC_FRAMES.forEach((frame, i) => npc.draw(sprite(`npc frame ${i}`, frame, CHAR_W, CHAR_H), i * CHAR_W, 0));
write('npc.png', npc);

// The LUG treasure hunt's keys and reward box (docs/STORY.md, M3): blitted straight from the Kyrise
// 16x16 RPG Icon Pack (assets/vendor/kyrise-16x16-rpg-icons, CREDITS.md) instead of hand-drawn like
// everything above -- the owner's task brief specifically named this pack's key icons. Each source
// file is its own already-16x16 PNG (not a shared atlas), so blitAtlas just copies it whole (sx=sy=0,
// sw=sh=16), no recolor/rotate needed. Appended *after* ITEM_ICONS/HELD_ITEM_ICONS (not spliced in)
// so every existing item's frame index is unchanged, per src/items.js's own frame numbers.
const KYRISE_ICON_DIR = "kyrise-16x16-rpg-icons/Kyrise's 16x16 RPG Icon Pack - V1.2/icons/16x16";
const VENDOR_ITEM_ICONS = [
  { item: 'keyPhysicsLab', file: 'key_01a.png' },
  { item: 'keyIcvl', file: 'key_02a.png' },
  { item: 'keyRoom195', file: 'key_01c.png' },
  { item: 'lugBox', file: 'gift_01a.png' },
];

const items = new Img((ITEM_ICONS.length + VENDOR_ITEM_ICONS.length) * TILE, TILE);
ITEM_ICONS.forEach((icon, i) => items.draw(icon, i * TILE, 0));
VENDOR_ITEM_ICONS.forEach(({ file }, i) => {
  const atlas = loadAtlas(`${KYRISE_ICON_DIR}/${file}`);
  blitAtlas(items, (ITEM_ICONS.length + i) * TILE, 0, atlas, 0, 0, 16, 16);
});
write('items.png', items);

// Small in-hand sprites (FB-0002): 8x8 frames, same order/frame numbers as items.png -- the vendor
// icons are just downsampled (nearest-neighbor, via blitAtlas's dw/dh) rather than redrawn.
const HELD_ITEM_SIZE = 8;
const heldItems = new Img((HELD_ITEM_ICONS.length + VENDOR_ITEM_ICONS.length) * HELD_ITEM_SIZE, HELD_ITEM_SIZE);
HELD_ITEM_ICONS.forEach((icon, i) => heldItems.draw(icon, i * HELD_ITEM_SIZE, 0));
VENDOR_ITEM_ICONS.forEach(({ file }, i) => {
  const atlas = loadAtlas(`${KYRISE_ICON_DIR}/${file}`);
  blitAtlas(heldItems, (HELD_ITEM_ICONS.length + i) * HELD_ITEM_SIZE, 0, atlas, 0, 0, 16, 16, { dw: HELD_ITEM_SIZE, dh: HELD_ITEM_SIZE });
});
write('held-items.png', heldItems);

const prompt = new Img(2 * TILE, TILE);
prompt.draw(PROMPT_E, 0, 0);
prompt.draw(PROMPT_BANG, TILE, 0);
write('prompt.png', prompt);

// The one UI kit (docs/GAME_FEEL.md): the panel/button 9-slice frame + the cursor/next-line arrows.
write('ui-panel.png', uiPanelSheet);
write('ui-icons.png', uiIcons);

console.log(`Wrote ${TILES.length} tiles, player (+${Object.keys(CLOTHES_SWATCHES).length} swatches), npc, ${ITEM_ICONS.length + VENDOR_ITEM_ICONS.length} items, prompt and the UI kit to assets/`);
