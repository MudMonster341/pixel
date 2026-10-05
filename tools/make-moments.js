// Generates the prop sheets the "moments" use (docs/plans/2026-10-04-moments-and-small-touches.md, src/moments.js, src/scripts.js
// MOMENT_SHEETS) as PNG files in assets/.   Run:  node tools/make-moments.js [--out <dir>]   (also part of `npm run assets`)
//
//   moment-unicorn.png   32x32 frames, 6 across.  M1, the unicorn and the prince.
//        0 graze A   1 graze B (the head-bob: a 2-frame loop, the head down in the grass)   2 head up (it has noticed someone)
//        3 head up, ridden (the prince sits on its back)   4 airborne, ridden (legs tucked, tail streaming)   5 airborne, riderless
//        Drawn entirely here in code (FB-0078: the pack's chibi side-view horse read as a white pig with a horn): a slim pearl-white horse with
//        lilac shading, a pastel pink/lilac/sky mane and tail, pink hooves and a slim golden spiral horn, plus the little prince rider.
//        A GENERIC white horse with a horn: not any protected character.
//   moment-drums.png     28x22 frames, 5 across.  M2, Mevin's little drum kit (kick, snare, rack and floor tom, hi-hat, crash).
//        0 idle   1 snare hit   2 kick hit   3 crash hit   4 snare and crash together
//   moment-chariot.png   40x44 frames, 4 across.  M3, Prof. Raja's chariot, seen from the front: two gilded horses (the Ninja Adventure FRONT-view
//        horse, CC0, recoloured palomino; in the git-ignored pack folder assets/External Tilesets/Ninja-Adventure-Horse), a maroon-and-gold cart, parasol, pennants.
//        0 trot A   1 trot B   2 trot A with Prof. Raja aboard   3 trot B with Raja aboard
//
// Never hand-edit the PNGs: edit the tables below and re-run. Frame sizes are mirrored in src/scripts.js MOMENT_SHEETS;
// tests/unit/moments.test.js checks both against the committed files.

const fs = require('fs');
const path = require('path');
const { decodePNG } = require('./lib/png-decode');
const { encodePNG } = require('./lib/png');

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
// The Ninja Adventure side-view horse (a 23x16 round chibi) turned out to read as a white pig with a horn (FB-0078), so the unicorn's body
// is now drawn here as a slim, long-legged horse silhouette (filled spans, then one soft indigo outline pass), with pastel extras on top.

const FRAME = 32;

const HC = {
  W: '#f6f2fa', // coat: pearl
  S: '#cdc4e0', // shade: pale lilac
  H: '#ff9fcb', // hooves: pink
  h: '#e07eb0', // the far hooves, a shade darker
  N: '#ffc9e3', // muzzle
  E: '#3b3358', // eye
  K: '#3b3358', // outline: a soft indigo, not black
  P: '#ff8fc7', V: '#b690ff', B: '#7fd6ff', // the mane and tail: pink, lilac, sky
};
const HORN_PIXELS = ['#f0c648', '#fff2c2', '#f0c648', '#fff2c2', '#d9a21f', '#fff2c2']; // a slim golden spiral: base to tip

const paint = (img, x, y, c) => img.set(x, y, HC[c] || c);
function spans(img, color, list) {
  for (const [y, x0, x1] of list) for (let x = x0; x <= x1; x++) paint(img, x, y, color);
}

// One soft indigo line around everything drawn so far (4-neighbours).
function outline(img, color) {
  const add = [];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.get(x, y)) continue;
    if (img.get(x - 1, y) || img.get(x + 1, y) || img.get(x, y - 1) || img.get(x, y + 1)) add.push([x, y]);
  }
  add.forEach(([x, y]) => img.set(x, y, color));
}

// A leg `w` wide from row `y0` down to the hooves (the last two rows) on the ground row GROUND.
const GROUND = 29;
function leg(img, x, y0, coat, hoof, w = 2) {
  spans(img, coat, [...Array(GROUND - y0 - 1).keys()].map((i) => [y0 + i, x, x + w - 1]));
  spans(img, hoof, [[GROUND - 1, x, x + w - 1], [GROUND, x, x + w - 1]]);
}

// The barrel, the rump and the chest (x 4..24, y 15..21), facing right.
const BARREL = [[15, 6, 15], [16, 5, 23], [17, 4, 24], [18, 4, 24], [19, 4, 24], [20, 4, 24], [21, 5, 23]];
const BARREL_SHADE = [[21, 5, 23], [20, 4, 5], [20, 23, 24], [19, 4, 4], [18, 5, 5]];

// Head up: ear, forehead, long muzzle, and the arched neck down to the withers.
const HEAD_UP = [
  [4, 20, 20], [5, 19, 20], [6, 20, 23], [7, 19, 24], [8, 19, 25], [9, 18, 26], [10, 18, 27], [11, 17, 27], [12, 17, 26],
  [13, 16, 22], [14, 15, 23], [15, 13, 24],
];
const NECK_SHADE_UP = [[13, 21, 22], [14, 22, 23], [12, 25, 26], [11, 26, 27]];
// Head down, grazing: the neck dips forward and the muzzle reaches the grass.
const HEAD_DOWN = [
  [14, 14, 18], [15, 15, 21], [17, 19, 25], [18, 21, 26], [19, 22, 27], [20, 23, 28], [21, 24, 29], [22, 24, 29],
  [23, 25, 30], [24, 25, 30], [25, 26, 30], [26, 26, 31], [27, 27, 31], [28, 27, 31], [29, 27, 30],
];
const NECK_SHADE_DOWN = [[17, 19, 20], [18, 21, 22], [19, 22, 23], [20, 23, 24], [21, 24, 25]];

// Tails (drawn first, behind the rump): hanging while it stands, streaming back in the air.
const TAIL_HANG = ['..PP', '.PVP', '.PVB', 'PVBP', 'PBPV', 'PVPB', '.PBP', '.VBP', '..PB', '..BP'];
const TAIL_FLY = ['...PP', '.PPVB', 'PVBPV', '.BPVP', '..PBP'];
function tail(img, rows, x, y) {
  rows.forEach((row, dy) => { for (let dx = 0; dx < row.length; dx++) if (row[dx] !== '.') paint(img, x + dx, y + dy, row[dx]); });
}

// Everything the unicorn is made of in one pose. `head` 'up' | 'down'; `lift` raises the grazing muzzle a row (the chew); `fly` tucks the legs.
function drawUnicorn(img, { head = 'up', lift = 0, fly = false } = {}) {
  const fill = canvas(FRAME, FRAME);
  if (fly) tail(fill, TAIL_FLY, 0, 15); else tail(fill, TAIL_HANG, 0, 16);
  // far legs (shaded), then the body, then the near legs
  if (fly) {
    spans(fill, 'S', [[22, 9, 11], [23, 8, 10], [24, 6, 9]]); spans(fill, 'h', [[24, 6, 7]]);
    spans(fill, 'S', [[22, 18, 19], [23, 18, 19], [24, 17, 21]]); spans(fill, 'h', [[24, 17, 18]]);
  } else {
    leg(fill, 9, 21, 'S', 'h'); leg(fill, 18, 21, 'S', 'h');
  }
  spans(fill, 'W', BARREL);
  spans(fill, 'S', BARREL_SHADE);
  if (fly) {
    spans(fill, 'W', [[22, 6, 8], [23, 5, 7], [24, 3, 6], [25, 2, 4]]); spans(fill, 'H', [[25, 2, 3], [24, 3, 4]]);
    spans(fill, 'W', [[22, 21, 22], [23, 21, 22], [24, 22, 26]]); spans(fill, 'H', [[24, 25, 26], [25, 26, 26]]);
  } else {
    spans(fill, 'W', [[20, 5, 8], [21, 5, 8], [22, 5, 8]]); // the thigh, a little wider than the leg under it
    leg(fill, 6, 23, 'W', 'H'); spans(fill, 'W', [[22, 6, 7]]);
    spans(fill, 'W', [[20, 20, 23], [21, 20, 23]]); // the shoulder
    leg(fill, 21, 22, 'W', 'H');
  }
  const rows = head === 'up' ? HEAD_UP : HEAD_DOWN;
  const placed = rows.map(([y, x0, x1]) => (head === 'down' && lift && y >= 23 ? [y - lift, x0, x1] : [y, x0, x1]));
  spans(fill, 'W', placed);
  if (head === 'down' && lift) spans(fill, 'W', [[22, 25, 30], [23, 25, 30]]); // the neck stays joined to the lifted head
  spans(fill, 'S', head === 'up' ? NECK_SHADE_UP : NECK_SHADE_DOWN);
  outline(fill, HC.K);

  // face: a two-pixel eye, a blush, the pink muzzle with a nostril
  if (head === 'up') {
    paint(fill, 23, 8, 'E'); paint(fill, 23, 9, 'E'); paint(fill, 22, 10, 'N');
    spans(fill, 'N', [[10, 26, 27], [11, 26, 27], [12, 25, 26]]); paint(fill, 27, 10, 'E');
  } else {
    paint(fill, 27, 22, 'E'); paint(fill, 27, 23 - lift, 'E');
    spans(fill, 'N', [[27 - lift, 30, 31], [28 - lift, 29, 31], [29 - lift, 29, 30]]); paint(fill, 29, 26 - lift, 'E');
  }
  // mane: a two-pixel pastel ridge down the crest, one colour per step
  if (head === 'up') {
    rows.forEach(([y, x0], i) => { paint(fill, x0, y, 'PVB'[i % 3]); paint(fill, x0 - 1, y, 'PVB'[(i + 1) % 3]); });
    paint(fill, 21, 6, 'P'); paint(fill, 22, 6, 'V'); paint(fill, 22, 7, 'P'); paint(fill, 21, 7, 'B'); // the forelock
  } else {
    for (let x = 16; x <= 27; x++) {
      const top = Math.min(...rows.filter(([, x0, x1]) => x >= x0 && x <= x1).map(([y]) => y));
      if (!Number.isFinite(top)) continue;
      paint(fill, x, top, 'PVB'[x % 3]); paint(fill, x, top - 1, 'PVB'[(x + 1) % 3]);
    }
    paint(fill, 27, 21 - lift, 'P'); paint(fill, 28, 22 - lift, 'V');
  }
  // the horn, leaning forward off the forehead
  const horn = head === 'up' ? [[24, 5], [24, 4], [25, 3], [25, 2], [26, 1], [27, 0]] : [[28, 19], [29, 18], [29, 17], [30, 16], [30, 15], [31, 14]];
  horn.forEach(([x, y], i) => fill.set(x, y, HORN_PIXELS[i]));
  // composite
  for (let y = 0; y < FRAME; y++) for (let x = 0; x < FRAME; x++) { const c = fill.get(x, y); if (c) img.set(x, y, c); }
}

// Little stars around it in the air.
function sparkle(img, x, y, c = '#fff2c2') { [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy], i) => img.set(x + dx, y + dy, i ? c : '#ffffff')); }

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
  switch (index) {
    case 0: drawUnicorn(img, { head: 'down' }); break; // graze A
    case 1: drawUnicorn(img, { head: 'down', lift: 1 }); break; // graze B: the muzzle a row off the grass: chewing
    case 2: drawUnicorn(img); break; // head up
    case 3: drawUnicorn(img); stamp(img, 6, 5, RIDER, RIDER_COLORS); break; // ridden
    case 4: drawUnicorn(img, { fly: true }); stamp(img, 5, 5, RIDER_FLY, RIDER_COLORS); sparkle(img, 3, 9); sparkle(img, 29, 22); break; // ridden, airborne
    default: drawUnicorn(img, { fly: true }); sparkle(img, 3, 9); sparkle(img, 29, 22); sparkle(img, 14, 5, '#ffb3d9'); // airborne, riderless
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

// ---------- the chariot ----------
// M3, Prof. Raja's chariot: seen from the FRONT (it rolls down the hall toward the camera and away again), two gilded horses abreast,
// a maroon-and-gold cart behind them with two edge-on spoked wheels, two saffron pennants and a gold-and-maroon royal parasol. The horses
// are the Ninja Adventure FRONT-view brown horse (CC0, credited in CREDITS.md), recoloured palomino with a
// pale mane, with a red plume and a ruby harness added in code; everything else is composed here. A GENERIC royal chariot: nobody's
// protected character. Frame order (src/scripts.js MOMENT_SHEETS.chariot): 0 trot A, 1 trot B (the horses bob, the wheels turn, the
// pennants flap), 2 and 3 the same with Prof. Raja seated in the cart.
const HORSE_FRONT = path.join(__dirname, '..', 'assets', 'External Tilesets', 'Ninja-Adventure-Horse', 'SpriteSheetBrown.png');
const CHARIOT_W = 40;
const CHARIOT_H = 44;
const CHARIOT_FRAMES = 4;
const FRONT_W = 16;
const FRONT_H = 16;

const FRONT_RECOLOR = {
  '#d14b34': '#e7b04a', // face and body: palomino gold
  '#8f3e56': '#b9772f', // chest shade
  '#5f7160': '#fff4cf', // forelock and mane: pale
  '#f2ad7d': '#ffd7b0', // muzzle
  '#141b1b': '#2a1420', // outline: a deep wine, not black
};

function loadHorseFront(index) {
  const sheet = decodePNG(fs.readFileSync(HORSE_FRONT));
  const frame = canvas(FRONT_W, FRONT_H);
  for (let y = 0; y < FRONT_H; y++) {
    for (let x = 0; x < FRONT_W; x++) {
      const s = (y * sheet.width + index * FRONT_W + x) * 4;
      if (!sheet.data[s + 3]) continue;
      const from = key(sheet.data[s], sheet.data[s + 1], sheet.data[s + 2]);
      frame.set(x, y, FRONT_RECOLOR[from] || from);
    }
  }
  return frame;
}

const CH = { K: '#2a1420', R: '#8e1f3a', r: '#6a1429', L: '#b32a4c', G: '#e0b84f', Y: '#ffe27a', O: '#ff9933', o: '#d9701c', W: '#fff4cf', B: '#c0392b' };
// Prof. Raja seated, seen from the front: grey hair, maroon jacket with a gold sash (the same palette as his standing sprite). 10 wide.
const RAJA_SEATED = [
  '...KKKK...',
  '..KhhhhK..',
  '.KhhhhhhK.',
  '.KhSSSShK.',
  '.KSeSSeSK.',
  '.KSSSSSSK.',
  '..KSSSSK..',
  '..KKGGKK..',
  '.KJJJGJJK.',
  'KJLJJGJJLK',
  'KJJJJGGJJK',
  'KJLJJGJJJK',
];
const RAJA_COLORS = { K: CH.K, h: '#c9cbd6', S: '#e9b98f', e: '#4a2d2d', J: '#7a1530', L: '#a32347', G: CH.G };

function drawChariot(index) {
  const img = canvas(CHARIOT_W, CHARIOT_H);
  const b = index % 2; // trot A / trot B
  const rider = index >= 2;
  // wheels, edge-on (behind the horses): a gold rim with dark spokes that turn between the two frames
  for (const wx of [0, 36]) {
    rect(img, wx, 22, 4, 16, CH.K);
    rect(img, wx + 1, 23, 2, 14, CH.G);
    for (let y = 23; y < 37; y++) if ((y + b * 2) % 4 < 2) { img.set(wx + 1, y, CH.o); img.set(wx + 2, y, CH.r); }
  }
  // the royal parasol: a pole and a striped dome with a scalloped gold edge
  rect(img, 19, 5, 2, 14, CH.G);
  for (let x = 9; x <= 30; x++) {
    const k = (x - 19.5) / 11;
    const h = Math.ceil(5 * Math.sqrt(Math.max(0, 1 - k * k)));
    for (let y = 5 - h; y < 5; y++) img.set(x, y, Math.floor((x - 9) / 3) % 2 ? CH.G : CH.R);
    img.set(x, 5, x % 2 ? CH.Y : CH.G);
  }
  rect(img, 18, 0, 4, 1, CH.K);
  img.set(19, 0, CH.Y); img.set(20, 0, CH.Y);
  // the cart: the rim and the front panel (only the top of it shows above the horses)
  rect(img, 5, 18, 30, 1, CH.Y);
  rect(img, 5, 19, 30, 9, CH.R);
  rect(img, 5, 19, 30, 1, CH.K);
  for (let x = 7; x < 34; x += 5) { rect(img, x, 22, 3, 3, CH.G); img.set(x + 1, 23, CH.B); } // a row of gold lozenges with a ruby heart
  rect(img, 5, 27, 30, 1, CH.G);
  // the two pennants on the cart's corners, flapping: saffron, drooping a pixel on the B frame
  for (const fx of [6, 33]) {
    rect(img, fx, 8, 1, 11, CH.G);
    const out = fx < 20 ? -1 : 1;
    const droop = b;
    for (let i = 1; i <= 5; i++) {
      const x = fx + out * i;
      const height = Math.max(1, 4 - Math.floor((i * 3) / 5));
      for (let y = 0; y < height; y++) img.set(x, 8 + y + (b && i > 2 ? droop : 0), y === height - 1 ? CH.o : CH.O);
    }
    img.set(fx, 7, CH.Y);
  }
  // Prof. Raja, on the parasol's pole side: the pole is behind him (his own body comes first)
  if (rider) stamp(img, 15, 6, RAJA_SEATED, RAJA_COLORS);
  // the horses (in front): they bob a pixel on the B frame, left and right on opposite beats
  const bob = b ? -1 : 0;
  const left = loadHorseFront(b);
  const right = loadHorseFront(1 - b);
  [[left, 4], [right, 20]].forEach(([horse, hx], n) => {
    const oy = 28 + (n ? 0 : bob) + (n ? bob : 0);
    for (let y = 0; y < FRONT_H; y++) for (let x = 0; x < FRONT_W; x++) {
      const c = horse.get(x, y);
      if (c) img.set(hx + x, oy + y, c);
    }
    // a red plume with a gold tip on the forehead, a ruby collar with gold studs across the chest
    stamp(img, hx + 7, oy - 3, ['.Y.', 'YWY', '.G.', '.B.'], CH);
    rect(img, hx + 3, oy + 12, 10, 2, CH.B);
    for (const sx of [4, 7, 10]) img.set(hx + sx, oy + 12, CH.Y);
  });
  // the yoke between the horses
  rect(img, 18, 33, 4, 1, CH.G);
  return img;
}

function buildChariotSheet() {
  const sheet = canvas(CHARIOT_W * CHARIOT_FRAMES, CHARIOT_H);
  for (let i = 0; i < CHARIOT_FRAMES; i++) {
    const frame = drawChariot(i);
    for (let y = 0; y < CHARIOT_H; y++) for (let x = 0; x < CHARIOT_W; x++) {
      const c = frame.get(x, y);
      if (c) sheet.set(i * CHARIOT_W + x, y, c);
    }
  }
  return sheet;
}

// name -> { width, height, data } for every committed moment sheet.
function buildMomentSheets() {
  return { 'moment-unicorn.png': buildUnicornSheet(), 'moment-drums.png': buildDrumSheet(), 'moment-chariot.png': buildChariotSheet() };
}

function writeMomentSheets(outDir) {
  const sheets = buildMomentSheets();
  for (const [name, sheet] of Object.entries(sheets)) fs.writeFileSync(path.join(outDir, name), encodePNG(sheet.width, sheet.height, sheet.data));
  return Object.keys(sheets);
}

module.exports = { buildMomentSheets, writeMomentSheets, FRAME, KIT_W, KIT_H, UNICORN_FRAMES, KIT_FRAMES, CHARIOT_W, CHARIOT_H, CHARIOT_FRAMES };

if (require.main === module) {
  const flag = process.argv.indexOf('--out');
  const outDir = flag !== -1 ? path.resolve(process.argv[flag + 1]) : path.join(__dirname, '..', 'assets');
  fs.mkdirSync(outDir, { recursive: true });
  const names = writeMomentSheets(outDir);
  console.log(`Wrote ${names.length} moment sheets (${names.join(', ')}) to ${outDir}`);
}
