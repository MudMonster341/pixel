// Generates the two prop sheets the "moments" use (docs/plans/2026-10-04-moments-and-small-touches.md, src/moments.js, src/scripts.js
// MOMENT_SHEETS) as PNG files in assets/.   Run:  node tools/make-moments.js [--out <dir>]   (also part of `npm run assets`)
//
//   moment-unicorn.png   32x32 frames, 6 across.  M1, the unicorn and the prince.
//        0 graze A   1 graze B (the head-bob: a 2-frame loop, the head down in the grass)   2 head up (it has noticed someone)
//        3 head up, ridden (the prince sits on its back)   4 airborne, ridden (legs tucked, tail streaming)   5 airborne, riderless
//        The body is the Ninja Adventure horse (CC0, the side-view brown horse, assets/External Tilesets/, git-ignored, credited in
//        CREDITS.md), recoloured white with a pink mane and tail; the horn, the extra mane tufts, the lowered head and the rider are
//        composed here in code. A GENERIC white horse with a horn: not any protected character.
//   moment-drums.png     28x22 frames, 5 across.  M2, Mevin's little drum kit (kick, snare, rack and floor tom, hi-hat, crash).
//        0 idle   1 snare hit   2 kick hit   3 crash hit   4 snare and crash together
//
// Never hand-edit the PNGs: edit the tables below and re-run. Frame sizes are mirrored in src/scripts.js MOMENT_SHEETS;
// tests/unit/moments.test.js checks both against the committed files.

const fs = require('fs');
const path = require('path');
const { decodePNG } = require('./lib/png-decode');
const { encodePNG } = require('./lib/png');

const HORSE = path.join(__dirname, '..', 'assets', 'External Tilesets', 'Ninja-Adventure-Horse', 'SpriteSheetBrownSide.png');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const key = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

// A little RGBA canvas.
function canvas(width, height) {
  const data = Buffer.alloc(width * height * 4);
  return {
    width, height, data,
    set(x, y, color) {
      if (x < 0 || y < 0 || x >= width || y >= height || !color) return;
      const [r, g, b] = hex(color);
      const i = (y * width + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    },
    get(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      const i = (y * width + x) * 4;
      return data[i + 3] ? key(data[i], data[i + 1], data[i + 2]) : null;
    },
    clear(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 4);
    },
  };
}

// Stamps text rows ('.' = nothing, any other character looked up in `palette`) with the top-left corner at (x, y).
function stamp(img, x, y, rows, palette) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (palette[row[dx]]) img.set(x + dx, y + dy, palette[row[dx]]);
  });
}

// ---------- the unicorn ----------

const FRAME = 32;
const HORSE_FRAME_W = 23;
const HORSE_FRAME_H = 16;
const HORSE_X = 2; // where the pack's 23x16 horse sits in the 32x32 frame (there is room above it for the horn and the rider)
const HORSE_Y = 15;

// The pack's brown horse -> a white one with a pink mane and tail. Exact-colour swap (the horse uses 7 colours).
const HORSE_RECOLOR = {
  '#d14b34': '#f6f2fa', // body
  '#8f3e56': '#cdc4e0', // belly / shade
  '#cf736d': '#ffb3d9', // tail highlight
  '#f2ad7d': '#ffd9ec', // muzzle
  '#5f7160': '#ff8fc7', // mane and tail (the pack's grey-green)
  '#141b1b': '#3b3358', // outline: a soft indigo, not black
};

function loadHorseFrame(index) {
  const sheet = decodePNG(fs.readFileSync(HORSE));
  const map = new Map(Object.entries(HORSE_RECOLOR).map(([from, to]) => [from, to]));
  const frame = canvas(HORSE_FRAME_W, HORSE_FRAME_H);
  for (let y = 0; y < HORSE_FRAME_H; y++) {
    for (let x = 0; x < HORSE_FRAME_W; x++) {
      const s = (y * sheet.width + index * HORSE_FRAME_W + x) * 4;
      if (!sheet.data[s + 3]) continue;
      const from = key(sheet.data[s], sheet.data[s + 1], sheet.data[s + 2]);
      frame.set(x, y, map.get(from) || from);
    }
  }
  return frame;
}

// The horse's head and neck are everything from this column right, above the chest (rows 0-11). A graze pose copies that block `drop`
// rows lower, so the neck dips and the muzzle reaches the grass; the body (columns 0-12) and the legs stay as they are.
const HEAD_X0 = 13;
const HEAD_Y1 = 11;
function lowerHead(frame, drop, nudge = 0) {
  const out = canvas(HORSE_FRAME_W + nudge, HORSE_FRAME_H);
  for (let y = 0; y < HORSE_FRAME_H; y++) for (let x = 0; x < HEAD_X0; x++) out.set(x, y, frame.get(x, y));
  // the chest and legs under the head (rows 12-15, columns 13+) first, then the head on top
  for (let y = HEAD_Y1 + 1; y < HORSE_FRAME_H; y++) for (let x = HEAD_X0; x < HORSE_FRAME_W; x++) out.set(x, y, frame.get(x, y));
  for (let y = 0; y <= HEAD_Y1; y++) for (let x = HEAD_X0; x < HORSE_FRAME_W; x++) out.set(x + nudge, y + drop, frame.get(x, y));
  return out;
}

const HORN_COLORS = { H: '#fff2c2', G: '#f0c648', O: '#8a6a1f' };
// The horn: leaning forward from the forehead. `hx, hy` = the pixel just in front of the top of the head.
const HORN = [
  '...OO',
  '..OHO',
  '..OGO',
  '.OHO.',
  '.OGO.',
  'OHO..',
  'OO...',
];
const MANE_COLORS = { P: '#ff8fc7', V: '#b690ff', B: '#7fd6ff' };
// A few more tufts of mane along the neck, in three pastel colours. Relative to the top of the neck.
const MANE_TUFTS = ['.PVB', 'PVBP', 'VBP.'];

// Where the head's top-front is in the horse frame (before any drop): the horn base and the mane tufts hang off it.
const HEAD_TOP = { x: 17, y: 1 };

function drawHorse(img, horse, { drop = 0, nudge = 0, withHorn = true, legsUp = 0, tail = false } = {}) {
  // composite the (possibly head-lowered) horse into the frame
  const body = drop ? lowerHead(horse, drop, nudge) : horse;
  for (let y = 0; y < body.height; y++) for (let x = 0; x < body.width; x++) {
    const c = body.get(x, y);
    if (!c) continue;
    // legs tucked up (airborne): drop the last `legsUp` rows of both leg pairs and leave the hooves a little higher
    if (legsUp && y >= HORSE_FRAME_H - legsUp && ((x >= 4 && x <= 8) || (x >= 11 && x <= 16))) continue;
    img.set(HORSE_X + x, HORSE_Y + y, c);
  }
  stamp(img, HORSE_X + 9, HORSE_Y + 0 + drop * 0, MANE_TUFTS, MANE_COLORS); // behind the withers
  if (tail) { // a long pink tail streaming back
    stamp(img, HORSE_X - 2, HORSE_Y + 6, ['.PP', 'PVP', 'PBP', '.PV'], MANE_COLORS);
  }
  if (withHorn) stamp(img, HORSE_X + HEAD_TOP.x + nudge, HORSE_Y + HEAD_TOP.y + drop - HORN.length + 3, HORN, HORN_COLORS);
}

// The prince, seated: facing right, a crown, a red cape streaming behind, a blue tunic, his legs over the horse's back. 10 wide.
const RIDER_COLORS = { K: '#3b3358', S: '#ffcbb0', H: '#3f2a20', G: '#e0b84f', Y: '#ffe27a', B: '#2f5fb8', b: '#22458a', R: '#c0392b', r: '#8e2021', W: '#f2f2f6' };
const RIDER = [
  '...GYGG...',
  '..GGGGGG..',
  '..KHHHHK..',
  '..KHSSSK..',
  '..KSSSSK..',
  '...KSSK...',
  'rRKBBBBK..',
  'RRKBBBBBS.',
  'RrKBbBBBS.',
  '.rKBBbBK..',
  '..KWWWWK..',
  '..KWWKWK..',
];
// The same, leaning into the wind with the cape long behind him (airborne).
const RIDER_FLY = [
  '....GYGG..',
  '...GGGGGG.',
  '...KHHHHK.',
  '...KHSSSK.',
  '...KSSSSK.',
  '....KSSK..',
  'RRRKBBBBK.',
  'RRrKBBBBBS',
  '.rRKBbBBBS',
  '..rKBBbBK.',
  '...KWWWWK.',
  '...KWWKWK.',
];

function unicornFrame(index) {
  const img = canvas(FRAME, FRAME);
  const a = loadHorseFrame(0);
  const b = loadHorseFrame(1);
  switch (index) {
    case 0: drawHorse(img, a, { drop: 3 }); break; // graze A
    case 1: drawHorse(img, b, { drop: 4, nudge: 1 }); break; // graze B: lower, the muzzle nudged: chewing
    case 2: drawHorse(img, a); break; // head up
    case 3: drawHorse(img, a); stamp(img, HORSE_X + 4, HORSE_Y - 6, RIDER, RIDER_COLORS); break; // ridden
    case 4: drawHorse(img, b, { legsUp: 2, tail: true }); stamp(img, HORSE_X + 3, HORSE_Y - 6, RIDER_FLY, RIDER_COLORS); break; // ridden, airborne
    default: drawHorse(img, b, { legsUp: 2, tail: true }); // airborne, riderless
  }
  return img;
}

const UNICORN_FRAMES = 6;
function buildUnicornSheet() {
  const sheet = canvas(FRAME * UNICORN_FRAMES, FRAME);
  for (let i = 0; i < UNICORN_FRAMES; i++) {
    const frame = unicornFrame(i);
    for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) {
      const c = frame.get(x, y);
      if (c) sheet.set(i * FRAME + x, y, c);
    }
  }
  return sheet;
}

// ---------- the drum kit ----------

const KIT_W = 28;
const KIT_H = 22;
const KIT_FRAMES = 5;
const KIT = { K: '#1a1c2c', W: '#f4f4fa', S: '#aeb4c4', R: '#c0392b', r: '#7e1a1a', G: '#e0b84f', Y: '#ffe27a', D: '#4b4b5e', F: '#fff6b0' };

function disc(img, cx, cy, r, color) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r / 2) img.set(cx + x, cy + y, color);
}
function rect(img, x, y, w, h, color) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) img.set(x + xx, y + yy, color);
}

// st: { snare, kick, crash } = which part was just hit (a bright flash on it).
function drawKit(img, ox, st) {
  const c = canvas(KIT_W, KIT_H);
  // stands first (behind everything)
  rect(c, 4, 9, 1, 12, KIT.S); // hi-hat pole
  rect(c, 23, 8, 1, 13, KIT.S); // crash pole
  rect(c, 3, 19, 3, 1, KIT.D); // tripod feet
  rect(c, 22, 19, 3, 1, KIT.D);
  // cymbals (a hit tips them and throws sparks)
  const tip = st.crash ? 1 : 0;
  rect(c, 0, 7 + tip, 9, 1, KIT.G); rect(c, 1, 6 + tip, 7, 1, KIT.Y); rect(c, 1, 8 + tip, 7, 1, KIT.K);
  rect(c, 19, 5 + tip, 9, 1, KIT.G); rect(c, 20, 4 + tip, 7, 1, KIT.Y); rect(c, 20, 6 + tip, 7, 1, KIT.K);
  if (st.crash) { c.set(1, 3, KIT.F); c.set(3, 2, KIT.F); c.set(26, 2, KIT.F); c.set(24, 0, KIT.F); c.set(22, 3, KIT.Y); }
  // kick drum: a red rim, a white head and a dark centre; a hit puffs it out by a pixel and adds a flash ring
  const kr = st.kick ? 7 : 6;
  disc(c, 14, 15, kr, KIT.K);
  disc(c, 14, 15, kr - 1, KIT.R);
  disc(c, 14, 15, kr - 3, KIT.W);
  disc(c, 14, 15, 1, KIT.D);
  if (st.kick) { c.set(6, 15, KIT.Y); c.set(22, 15, KIT.Y); c.set(14, 8, KIT.Y); c.set(5, 13, KIT.F); c.set(23, 13, KIT.F); }
  // rack tom on top of the kick
  rect(c, 10, 5, 8, 4, KIT.K); rect(c, 11, 5, 6, 1, KIT.W); rect(c, 11, 6, 6, 2, KIT.R); rect(c, 11, 8, 6, 1, KIT.r);
  // snare on its stand (left), the head flashes when hit
  rect(c, 2, 13, 8, 5, KIT.K); rect(c, 3, 12, 6, 1, st.snare ? KIT.F : KIT.W); rect(c, 3, 13, 6, 1, st.snare ? KIT.Y : KIT.W);
  rect(c, 3, 14, 6, 3, KIT.S); rect(c, 3, 17, 6, 1, KIT.D);
  rect(c, 4, 18, 1, 3, KIT.D); rect(c, 7, 18, 1, 3, KIT.D);
  if (st.snare) { c.set(1, 11, KIT.F); c.set(10, 11, KIT.F); c.set(5, 10, KIT.Y); c.set(8, 10, KIT.Y); }
  // floor tom (right)
  rect(c, 19, 12, 8, 6, KIT.K); rect(c, 20, 12, 6, 1, KIT.W); rect(c, 20, 13, 6, 3, KIT.R); rect(c, 20, 16, 6, 1, KIT.r);
  rect(c, 20, 18, 1, 3, KIT.D); rect(c, 25, 18, 1, 3, KIT.D);
  for (let y = 0; y < KIT_H; y++) for (let x = 0; x < KIT_W; x++) {
    const col = c.get(x, y);
    if (col) img.set(ox + x, y, col);
  }
}

const KIT_STATES = [{}, { snare: true }, { kick: true }, { crash: true }, { snare: true, crash: true }];
function buildDrumSheet() {
  const sheet = canvas(KIT_W * KIT_FRAMES, KIT_H);
  KIT_STATES.forEach((st, i) => drawKit(sheet, i * KIT_W, st));
  return sheet;
}

// name -> { width, height, data } for every committed moment sheet.
function buildMomentSheets() {
  return { 'moment-unicorn.png': buildUnicornSheet(), 'moment-drums.png': buildDrumSheet() };
}

function writeMomentSheets(outDir) {
  const sheets = buildMomentSheets();
  for (const [name, sheet] of Object.entries(sheets)) fs.writeFileSync(path.join(outDir, name), encodePNG(sheet.width, sheet.height, sheet.data));
  return Object.keys(sheets);
}

module.exports = { buildMomentSheets, writeMomentSheets, FRAME, KIT_W, KIT_H, UNICORN_FRAMES, KIT_FRAMES };

if (require.main === module) {
  const flag = process.argv.indexOf('--out');
  const outDir = flag !== -1 ? path.resolve(process.argv[flag + 1]) : path.join(__dirname, '..', 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  const names = writeMomentSheets(outDir);
  console.log(`Wrote ${names.length} moment sheets (${names.join(', ')}) to ${outDir}`);
}
