// Generates the campus animal sheets (cats and birds only, decisions/0018) as PNG files in assets/.
// Run:  node tools/make-animals.js [--out <dir>]      (also part of `npm run assets`)
//
// The raw packs are NOT in the repository (assets/External Tilesets/ is git-ignored, see CREDITS.md and
// docs/research/animal-packs.md); this crops and recolours them into our own sheets, which ARE committed.
// Never hand-edit the PNGs: edit the tables below and re-run.
//
//   animal-cat-orange / -charcoal.png   the owner's Animals Asset Pack cat (16x16, 4 directions).
//        6 columns x 5 rows:  row 0 = sitting (front, 4 frames); rows 1-4 = walk down / up / left / right
//        (6 frames each).
//   animal-catside-ginger / -silver.png           Zeenaz "Free Pixel Animation: Cat" (CC0, 16x16, side view,
//        faces LEFT; flip for right), recoloured. 8 columns x 6 rows, one animation per row: sit (4),
//        stand with a tail swish (8), sleep (8), walk (5), scared (3), panic (4).
//   animal-bird-sparrow / -pigeon / -crow.png    [LPC] Birds by bluecarrot16 (CC BY 4.0, 32x32, 3/4 view).
//        3 columns x 8 rows (rows: fly left / up / down / right, then walk left / up / down / right).
//        The pigeon is the pack's white dove recoloured to a rock-pigeon grey.
//
// Frame layouts are mirrored in src/animals.js ANIMAL_LAYOUTS; tests/unit/animals.test.js checks both.

const fs = require('fs');
const path = require('path');
const { decodePNG } = require('./lib/png-decode');
const { encodePNG } = require('./lib/png');

const PACKS = path.join(__dirname, '..', 'assets', 'External Tilesets');
const OWNER_CAT = path.join(PACKS, 'Animals-Pack-Owner', 'AnimalsAssetPack', 'Assets');
const ZEENAZ_CAT = path.join(PACKS, 'Zeenaz-Cat', 'cat-Sheet.png');
const LPC_BIRDS = path.join(PACKS, 'LPC-Birds-bluecarrot16');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const key = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

function load(file) {
  return decodePNG(fs.readFileSync(file));
}

// A sheet under construction: width x height RGBA, transparent.
function blank(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

// Copies a (sw x sh) block of `src` at (sx, sy) to `dst` at (dx, dy), mapping every opaque pixel through
// `remap(r, g, b, a) -> [r, g, b, a]`.
function blit(dst, dx, dy, src, sx, sy, sw, sh, remap) {
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const s = ((sy + y) * src.width + sx + x) * 4;
      const a = src.data[s + 3];
      if (a === 0) continue;
      const [r, g, b, na] = remap(src.data[s], src.data[s + 1], src.data[s + 2], a);
      const d = ((dy + y) * dst.width + dx + x) * 4;
      dst.data[d] = r;
      dst.data[d + 1] = g;
      dst.data[d + 2] = b;
      dst.data[d + 3] = na;
    }
  }
}

const identity = (r, g, b, a) => [r, g, b, a];

// Exact-colour swap: anything not in the table passes through unchanged.
function exactRemap(table) {
  const map = new Map(Object.entries(table).map(([from, to]) => [from, hex(to)]));
  return (r, g, b, a) => {
    const to = map.get(key(r, g, b));
    return to ? [to[0], to[1], to[2], a] : [r, g, b, a];
  };
}

// Greys -> a colour ramp by lightness (piecewise linear between `stops` [[lightness, '#rrggbb'], ...]).
// Pixels that are clearly coloured (the Zeenaz cat's green eyes) are kept.
function rampRemap(stops) {
  const pts = stops.map(([l, h]) => [l, hex(h)]);
  return (r, g, b, a) => {
    if (g - r > 30 && g - b > 10) return [r, g, b, a]; // eyes
    const l = (r + g + b) / 3;
    if (l <= pts[0][0]) return [...pts[0][1], a];
    for (let i = 1; i < pts.length; i++) {
      if (l <= pts[i][0]) {
        const t = (l - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return [0, 1, 2].map((c) => Math.round(pts[i - 1][1][c] + (pts[i][1][c] - pts[i - 1][1][c]) * t)).concat(a);
      }
    }
    return [...pts[pts.length - 1][1], a];
  };
}

// ---------- the owner's cat (chibi, 4 directions) ----------
const OWNER_CAT_FILES = {
  sit: 'CatIdle.png', // 4 frames, facing the camera
  down: 'CatWalkFoward-Sheet.png',
  up: 'CatWalkAnimBack-Sheet.png',
  left: 'CatWalkLeft.png',
  right: 'CatWalkRight-Sheet.png',
};
// The pack's slate cat uses 5 greys + 2 outline darks + a pink; each recolour swaps them exactly.
const CAT_RECOLORS = {
  charcoal: {}, // the pack's own look, unchanged
  orange: {
    '#1c1c2e': '#4a2a1e', '#1c2022': '#4a2a1e', '#2f2c3b': '#7a4220', '#393b4d': '#93502a', '#4d5261': '#b3662f',
    '#59616e': '#cf7f37', '#5a626f': '#cf7f37', '#5b6370': '#cf7f37', '#677580': '#e69a4f', '#a68695': '#d79a92',
  },
};

function buildOwnerCat(recolor) {
  const remap = Object.keys(recolor).length ? exactRemap(recolor) : identity;
  const sheet = blank(6 * 16, 5 * 16);
  ['sit', 'down', 'up', 'left', 'right'].forEach((name, row) => {
    const src = load(path.join(OWNER_CAT, OWNER_CAT_FILES[name]));
    for (let f = 0; f < src.width / 16; f++) blit(sheet, f * 16, row * 16, src, f * 16, 0, 16, 16, remap);
  });
  return sheet;
}

// ---------- Zeenaz's side-view cat (whole sheet, recoloured) ----------
const SIDE_CAT_RAMPS = {
  ginger: [[24, '#3b2314'], [60, '#6b3a1c'], [100, '#a85a28'], [130, '#d98a3d'], [170, '#efb065'], [200, '#f8d79c']],
  silver: [[24, '#4a4452'], [60, '#7d7585'], [100, '#aaa3b0'], [130, '#cfc9cf'], [170, '#ece7e4'], [200, '#ffffff']],
};

function buildSideCat(ramp) {
  const src = load(ZEENAZ_CAT);
  const sheet = blank(src.width, src.height);
  blit(sheet, 0, 0, src, 0, 0, src.width, src.height, rampRemap(ramp));
  return sheet;
}

// ---------- LPC birds ----------
const BIRD_FILES = { sparrow: 'bird_3_sparrow.png', pigeon: 'bird_2_white.png', crow: 'bird_2_black.png' };
// The white dove -> a grey rock pigeon with pinkish feet and wing edges (the pack's cream/white to soft greys).
const PIGEON_RECOLOR = {
  '#ffffff': '#b9bfcc', '#e5e6c7': '#9ba2b2', '#b19998': '#7c8393', '#726b7e': '#4b505f', '#c4b59f': '#c8a79f',
};

function buildBird(name) {
  const src = load(path.join(LPC_BIRDS, BIRD_FILES[name]));
  const sheet = blank(src.width, src.height);
  blit(sheet, 0, 0, src, 0, 0, src.width, src.height, name === 'pigeon' ? exactRemap(PIGEON_RECOLOR) : identity);
  return sheet;
}

// name -> { width, height, data } for every committed animal sheet.
function buildAnimalSheets() {
  const sheets = {};
  for (const colour of Object.keys(CAT_RECOLORS)) sheets[`animal-cat-${colour}.png`] = buildOwnerCat(CAT_RECOLORS[colour]);
  for (const colour of Object.keys(SIDE_CAT_RAMPS)) sheets[`animal-catside-${colour}.png`] = buildSideCat(SIDE_CAT_RAMPS[colour]);
  for (const name of Object.keys(BIRD_FILES)) sheets[`animal-bird-${name}.png`] = buildBird(name);
  return sheets;
}

function writeAnimalSheets(outDir) {
  const sheets = buildAnimalSheets();
  for (const [name, sheet] of Object.entries(sheets)) {
    fs.writeFileSync(path.join(outDir, name), encodePNG(sheet.width, sheet.height, sheet.data));
  }
  return Object.keys(sheets);
}

module.exports = { buildAnimalSheets, writeAnimalSheets };

if (require.main === module) {
  const flag = process.argv.indexOf('--out');
  const outDir = flag !== -1 ? path.resolve(process.argv[flag + 1]) : path.join(__dirname, '..', 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  const names = writeAnimalSheets(outDir);
  console.log(`Wrote ${names.length} animal sheets (${names.join(', ')}) to ${outDir}`);
}
