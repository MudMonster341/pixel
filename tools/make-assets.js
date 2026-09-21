// Generates all of the game's pixel art as PNG files. No dependencies.
// Run:  node tools/make-assets.js
// Output (in assets/):
//   tiles.png + tiles.json  every map tile (8 per row), with name, solid flag and minimap color
//   player.png              the lead, recolored from a vendor pack (ADR 0013): 3 rows (down/up/
//                           left, right = mirrored left) x 8 cols (idle, 6 walk frames, idle-anim),
//                           each frame 16x24
//   npc.png                 Tomas (hand-drawn, unchanged): 3 frames (down/up/left), 16x24
//   npc-volunteer.png, npc-student-a.png, npc-student-b.png
//                           campus NPCs, recolored from the same vendor pack, same 16x24/8-col
//                           layout as player.png (ADR 0013, FB-0025)
//   items.png               item icons, in the order of src/items.js
//   held-items.png          tiny 8x8 versions shown in the character's hand, same order/frames
//   prompt.png              interaction bubble, 2 frames: "E" (talk) and "!" (something new to say)
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
function remapPaver(r, g, b, a) {
  if (a === 0) return [r, g, b, a];
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  if (lum < 90) return [...hexToRgb('#1a1c2c'), a];
  if (lum > 190) return [...hexToRgb('#ffffff'), a];
  const hex = lum < 153 ? '#9c5a4a' : lum < 162 ? '#c0735c' : '#d9927a';
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

// A straight kerb edge is the paver-with-line tile rotated so its line faces the right side; the
// line sits in the source tile's bottom 4px (rows 12-15), so after each rotation the same 4px band
// sits at the corresponding edge -- used directly for a straight kerbT/B/L/R tile, or as a strip
// overlaid on a plain base for a corner (see atlasKerbCorner).
const KERB_ROTATE = { B: 0, L: 90, T: 180, R: 270 };
const KERB_BAND = {
  B: { x: 0, y: 12, w: 16, h: 4 },
  T: { x: 0, y: 0, w: 16, h: 4 },
  L: { x: 0, y: 0, w: 4, h: 16 },
  R: { x: 12, y: 0, w: 4, h: 16 },
};
function atlasKerbSide(img, x, y, side) {
  blitAtlas(img, x, y, loadAtlas(PACK.kerbPaver.atlas), PACK.kerbPaver.sx, PACK.kerbPaver.sy, 16, 16, {
    rotate: KERB_ROTATE[side],
    remap: remapPaver,
  });
}
// Only the band strip for `side` (its gutter line + a little paver either side of it), overlaid on
// top of whatever's already there -- how a corner tile gets both of its two lines.
function atlasKerbBand(img, x, y, side) {
  const band = KERB_BAND[side];
  const full = new Img(16, 16);
  blitAtlas(full, 0, 0, loadAtlas(PACK.kerbPaver.atlas), PACK.kerbPaver.sx, PACK.kerbPaver.sy, 16, 16, {
    rotate: KERB_ROTATE[side],
    remap: remapPaver,
  });
  for (let yy = 0; yy < band.h; yy++) {
    for (let xx = 0; xx < band.w; xx++) {
      const i = ((band.y + yy) * 16 + (band.x + xx)) * 4;
      img.setRGBA(x + band.x + xx, y + band.y + yy, full.data[i], full.data[i + 1], full.data[i + 2], full.data[i + 3]);
    }
  }
}
// A straight border (kerbT/B/L/R): the whole tile is the rotated paver-with-line source.
function atlasKerbEdge(img, x, y, sides) {
  if (sides.length === 1) {
    atlasKerbSide(img, x, y, sides);
    return;
  }
  // A corner (two sides, e.g. "TL"): a plain-paver base (no baked-in line) plus both sides' bands,
  // so the corner shows the paver texture with a line along each of its two road-facing edges.
  blitAtlas(img, x, y, loadAtlas(PACK.plainPaver.atlas), PACK.plainPaver.sx, PACK.plainPaver.sy, 16, 16, { remap: remapPaver });
  for (const side of sides) atlasKerbBand(img, x, y, side);
}

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

function bookshelf(img, x, y) {
  wallLower(img, x, y);
  img.box(x + 1, y, 14, 16, 'n');
  const colors = ['R', 'U', 'Y', 'J', 'P', 'C', 'I'];
  [1, 8].forEach((top, shelf) => {
    for (let bx = 2; bx <= 12; bx += 2) {
      const height = (bx * 7 + shelf) % 3 === 0 ? 5 : 6;
      img.fill(x + bx, y + top + (6 - height), 2, height, colors[(bx + shelf * 3) % colors.length]);
    }
    img.fill(x + 2, y + top + 6, 12, 1, 'N');
  });
}

function plant(img, x, y) {
  floor(img, x, y);
  const inside = (xx, yy) => ((xx - 7.5) / 6) ** 2 + ((yy - 6) / 5.5) ** 2 < 1;
  const r = rng(21);
  for (let yy = 0; yy < 13; yy++) {
    for (let xx = 0; xx < TILE; xx++) {
      if (inside(xx, yy)) {
        const roll = r();
        img.set(x + xx, y + yy, roll < 0.15 ? 't' : roll < 0.25 ? 'e' : 'T');
      } else if (inside(xx - 1, yy) || inside(xx + 1, yy) || inside(xx, yy - 1) || inside(xx, yy + 1)) {
        img.set(x + xx, y + yy, 'K');
      }
    }
  }
  img.box(x + 4, y + 10, 8, 6, 'b');
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
  { name: 'treeCanopyTL', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 0, 0, roundCanopyShape, SPROUT.treeCanopy, remapDryLeaves) },
  { name: 'treeCanopyTR', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 1, 0, roundCanopyShape, SPROUT.treeCanopy, remapDryLeaves) },
  { name: 'treeCanopyBL', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 0, 1, roundCanopyShape, SPROUT.treeCanopy, remapDryLeaves) },
  { name: 'treeCanopyBR', overhead: true, draw: (img, x, y) => canopyQuadrantFromAtlas(img, x, y, 1, 1, roundCanopyShape, SPROUT.treeCanopy, remapDryLeaves) },
  { name: 'palmTrunk', solid: true, draw: palmTrunk },
  { name: 'palmCanopyTL', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 0, 0, palmCanopyShape, palmCanopyTone) },
  { name: 'palmCanopyTR', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 1, 0, palmCanopyShape, palmCanopyTone) },
  { name: 'palmCanopyBL', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 0, 1, palmCanopyShape, palmCanopyTone) },
  { name: 'palmCanopyBR', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 1, 1, palmCanopyShape, palmCanopyTone) },

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
  { name: 'bitsEntranceGrandL', draw: (img, x, y) => bitsEntrance(img, x, y, true, true) },
  { name: 'bitsEntranceGrandR', draw: (img, x, y) => bitsEntrance(img, x, y, false, true) },

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
];

// ---------- campus tiles ----------

function speckle(img, x, y, base, speck, seed, count) {
  img.fill(x, y, TILE, TILE, base);
  const r = rng(seed);
  for (let i = 0; i < count; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), speck);
}

// Red-brown brick pavers in a running bond (FB-0006): each brick is bevelled, with a highlight on
// its top/left edge and a shadow on its bottom/right edge (light from the top-left), plus a
// slightly varying base tone so a large paved area doesn't read as one flat repeating grid.
function brickBevel(xx, yy, offset, period, base) {
  const withinRow = yy % 4;
  const brickX = (xx + offset) % period;
  if (withinRow === 3 || brickX === period - 1) return '8'; // mortar joint
  if (withinRow === 0 || brickX === 0) return '-';           // highlight (top-left of brick)
  if (withinRow === 2 || brickX === period - 2) return '_';  // shadow (bottom-right of brick)
  return base;
}

function paving(img, x, y) {
  forEachPixel((xx, yy) => {
    const offset = (yy >> 2) % 2 ? 4 : 0;
    img.set(x + xx, y + yy, brickBevel(xx, yy, offset, 8, '7'));
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
// block that can be mistaken for paving; the parapet edge strip is unchanged.
function flatRoof(img, x, y, base, edge, speck) {
  if (speck) speckle(img, x, y, base, speck, 733, 5);
  else img.fill(x, y, TILE, TILE, base);
  img.fill(x, y, TILE, 1, edge);
  img.fill(x, y, 1, TILE, edge);
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

// BITS building kit addendum (2026-09-21, coordinator review): a building's outdoor front reads as
// a roof-textured plain when its wall is only 1-2 tiles tall next to a 20+ tile-wide roof -- at the
// game's zoom (3x, ~20x11 tiles visible) almost nothing of the actual wall is on screen from a
// normal standing position. The front is now 4 tiles tall, one dedicated tile per band instead of
// every row repeating the same cap+trim+body+base band squished into one tile:
// cap (meets the roof) / window (a real, full-size window) / body (plain) / base (meets the ground,
// where the entrance is carved in). `tools/campus/build-campus.js`'s drawBuilding assigns one of
// these per wall row instead of repeating bitsWallPlain/bitsWall for every row (which stay exactly
// as they were, still used for interiors and un-touched here).
function bitsFacadeCap(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 1, 'K'); // roofline outline
  img.fill(x, y + 1, TILE, 10, 'wallHi'); // tall light cap band -- this is the building's crown
  img.fill(x, y + 11, TILE, 2, '&'); // trim line
}

function bitsFacadeWindow(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x + 2, y + 1, 12, 14, '&'); // frame, nearly the full tile: this row exists to *be* windows
  img.fill(x + 3, y + 2, 10, 12, '*'); // glass
  img.set(x + 5, y + 4, 'W');
  img.set(x + 5, y + 5, 'W'); // a taller glint than the small punched windows, matching the bigger pane
}

function bitsFacadeBody(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x + 7, y, 1, TILE, '%'); // panel line, full height -- no cap/base bands to interrupt it here
}

function bitsFacadeBase(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 3, '%'); // shadow band where the body above ends
  img.fill(x, y + 13, TILE, 2, '%'); // shadow just above the baseboard
  img.fill(x, y + 15, TILE, 1, 'baseCool'); // cool baseboard where the wall meets the ground
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
// "TL")' etc. below); one letter is a straight edge, two make a corner. atlasKerbEdge/atlasKerbSide/
// atlasKerbBand (defined above, with the vendor-atlas helpers) do the actual rotation/compositing.
function kerbEdge(img, x, y, sides) {
  atlasKerbEdge(img, x, y, sides);
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
function walkway(img, x, y) {
  blitAtlas(img, x, y, loadAtlas(PACK.plainPaver.atlas), PACK.plainPaver.sx, PACK.plainPaver.sy, 16, 16, { remap: remapPaver });
  img.fill(x, y, TILE, 1, 'Q');
  for (let xx = 0; xx < TILE; xx += 2) img.set(x + xx + 1, y, 'O');
  img.fill(x, y + TILE - 1, TILE, 1, 'Q');
  for (let xx = 0; xx < TILE; xx += 2) img.set(x + xx + 1, y + TILE - 1, 'O');
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
function canopyQuadrantFromAtlas(img, x, y, qx, qy, shapeFn, rect, remap) {
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

function bitsPillar(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 1, 'K');
  img.fill(x, y + 1, TILE, 2, '&');
  img.box(x + 5, y + 3, 6, 11, '%');
  img.fill(x + 6, y + 4, 4, 9, '&');
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
function intFloorClassroom(img, x, y) {
  forEachPixel((xx, yy) => img.set(x + xx, y + yy, yy % 4 === 3 ? ']' : '['));
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

function intDesk(img, x, y) {
  img.box(x + 2, y + 3, 12, 7, 'i');
  img.fill(x + 3, y + 9, 1, 3, 'N');
  img.fill(x + 12, y + 9, 1, 3, 'N');
  img.box(x + 5, y + 11, 6, 4, 'o');
}
function intTeacherDesk(img, x, y) {
  img.box(x + 1, y + 4, 14, 8, 'N');
  img.fill(x + 2, y + 5, 12, 1, 'i');
  img.box(x + 6, y + 12, 4, 3, 'o');
}
// A whiteboard mounted on the front wall: a wall tile (solid), not a floor prop.
function intWhiteboardWall(img, x, y) {
  bitsWallPlain(img, x, y);
  img.box(x + 2, y + 3, 12, 8, 'W');
  img.fill(x + 3, y + 7, 6, 1, '3');
  img.fill(x + 3, y + 9, 4, 1, '3');
}
function intBench(img, x, y) {
  img.box(x + 1, y + 5, 14, 7, '¦');
  img.fill(x + 1, y + 11, 14, 1, '¬');
  img.fill(x + 2, y + 12, 1, 3, 'o');
  img.fill(x + 12, y + 12, 1, 3, 'o');
}
function intComputerBench(img, x, y) {
  intBench(img, x, y);
  img.box(x + 5, y + 1, 6, 5, 'O');
  img.fill(x + 6, y + 2, 4, 3, 'I');
}
function intSink(img, x, y) {
  img.box(x + 2, y + 6, 12, 7, 'Q');
  img.fill(x + 4, y + 7, 8, 3, 'w');
  img.fill(x + 7, y + 4, 2, 3, 'o');
}
function intCabinet(img, x, y) {
  img.box(x + 2, y + 1, 12, 14, 'O');
  img.fill(x + 2, y + 7, 12, 1, 'o');
  img.set(x + 7, y + 4, 'K');
  img.set(x + 7, y + 10, 'K');
}
function intSofa(img, x, y) {
  img.box(x + 1, y + 5, 14, 9, '>');
  img.fill(x + 1, y + 5, 14, 2, '°');
  img.fill(x + 1, y + 5, 2, 9, '°');
  img.fill(x + 12, y + 5, 2, 9, '°');
}
function intNoticeboard(img, x, y) {
  img.box(x + 2, y + 2, 12, 11, '¤');
  img.set(x + 5, y + 5, 'Y');
  img.set(x + 10, y + 6, 'P');
  img.set(x + 6, y + 10, 'W');
}
function intReceptionDesk(img, x, y) {
  img.box(x + 1, y + 6, 14, 8, 'N');
  img.fill(x + 1, y + 6, 14, 1, '&');
  img.fill(x + 6, y + 2, 4, 4, 'W');
}
function intLocker(img, x, y) {
  img.box(x + 1, y + 1, 14, 14, 'I');
  for (const lx of [1, 6, 11]) {
    img.fill(x + lx + 3, y + 1, 1, 14, 'K');
    img.set(x + lx + 5, y + 7, 'Q');
  }
}
function intAuditoriumSeat(img, x, y) {
  for (let sx = 1; sx < TILE - 3; sx += 5) {
    img.box(x + sx, y + 3, 4, 11, 'R');
    img.fill(x + sx + 1, y + 4, 2, 2, 'r');
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
// In both layouts, the four directions sit in the same order: column/block 0 is a side profile,
// 1 is up (back of the head, no face), 2 is the *other* side profile (a mirror of 0 -- unused here,
// since docs/STYLE_GUIDE.md already mirrors "left" for "right"), 3 is down (facing the camera).
// Every frame's actual figure occupies only the bottom ~22-24 rows of the 32-tall canvas (rows
// 8-31) -- confirmed with a bounding-box scan, not assumed -- so building a 16x24 frame (ADR 0013)
// means cropping that bottom 24px band, not the whole 32px canvas.
const CHAR_LIB = 'limezu-modern-interiors-free/Modern tiles_Free/Characters_free';
const CHAR_W = TILE; // 16
const CHAR_H = 24; // ADR 0013: characters are 16x24 now, was 16x16
const CHAR_WALK_FRAMES = 6; // one full stride cycle, taken straight from the pack's run sheet
const CHAR_IDLE_ANIM_FRAME = 3; // mid-block idle_anim frame -- reads as the clearest blink/breathe pose
const CHAR_ROWS = ['down', 'up', 'left']; // sheet row order (docs/STYLE_GUIDE.md "Characters")
// Column in idle_16x16 *and* block index (of 6) in run/idle_anim -- both sheets share the same
// four-direction order, so one table serves both lookups.
const CHAR_DIR_INDEX = { left: 0, up: 1, down: 3 };

function charSheet(name, suffix) {
  return loadAtlas(path.join(CHAR_LIB, `${name}_${suffix}_16x16.png`));
}

// Crops the bottom CHAR_H rows of a 16x32 source frame at (sx, 0) into `img` at (dx, dy), recoloring
// as it's copied (see the *_RECOLOR tables below).
function blitCharFrame(img, dx, dy, atlas, sx, remap) {
  blitAtlas(img, dx, dy, atlas, sx, 32 - CHAR_H, CHAR_W, CHAR_H, { remap });
}

// One character's full sheet: 3 rows (down/up/left; right is flipX-mirrored left everywhere this
// game draws a character) x (1 idle frame, CHAR_WALK_FRAMES walk frames, 1 idle-anim frame) --
// CHAR_COLS wide. `recolorMap` is an exact-RGB swap table (see AMELIA_RECOLOR etc.), built by
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

// Campus NPCs (FB-0025): recolors of the pack's other three named characters, same 16x24/
// idle+walk+idle-anim layout as the player, so they're ready for the campus to be populated with
// them later (docs/research/asset-packs.md). Placed today only as fixtures on the meadow test map
// (src/maps.js) to prove the pipeline end to end; real campus placement is a follow-up task.
write('npc-volunteer.png', buildCharacter('Adam', ADAM_RECOLOR)); // the LUG volunteer
write('npc-student-a.png', buildCharacter('Alex', STUDENT_A_RECOLOR));
write('npc-student-b.png', buildCharacter('Bob', STUDENT_B_RECOLOR));

// Tomas (meadow/house test-map NPC): unchanged hand-drawn art, just bottom-aligned into the new
// 16x24 canvas (ADR 0013) -- no walk cycle, same 3-frame (down/up/left) sheet as before.
const npc = new Img(NPC_FRAMES.length * CHAR_W, CHAR_H);
NPC_FRAMES.forEach((frame, i) => npc.draw(sprite(`npc frame ${i}`, frame, CHAR_W, CHAR_H), i * CHAR_W, 0));
write('npc.png', npc);

const items = new Img(ITEM_ICONS.length * TILE, TILE);
ITEM_ICONS.forEach((icon, i) => items.draw(icon, i * TILE, 0));
write('items.png', items);

// Small in-hand sprites (FB-0002): 8x8 frames, same order/frame numbers as items.png.
const HELD_ITEM_SIZE = 8;
const heldItems = new Img(HELD_ITEM_ICONS.length * HELD_ITEM_SIZE, HELD_ITEM_SIZE);
HELD_ITEM_ICONS.forEach((icon, i) => heldItems.draw(icon, i * HELD_ITEM_SIZE, 0));
write('held-items.png', heldItems);

const prompt = new Img(2 * TILE, TILE);
prompt.draw(PROMPT_E, 0, 0);
prompt.draw(PROMPT_BANG, TILE, 0);
write('prompt.png', prompt);

console.log(`Wrote ${TILES.length} tiles, player, npc, ${ITEM_ICONS.length} items and prompt to assets/`);
