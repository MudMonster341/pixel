// Generates all of the game's pixel art as PNG files. No dependencies.
// Run:  node tools/make-assets.js
// Output: assets/tiles.png (8 tiles, 16x16 each) and assets/player.png (3x3 frames, 16x16 each)
//
// Every sprite is drawn as text: one character = one pixel, "." = transparent.
// Change a character, re-run the script, refresh the browser.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const TILE = 16;

const PALETTE = {
  K: '#1a1c2c', // outline
  // player
  S: '#f4c9a0', s: '#d49a6a', // skin
  H: '#6b3e1f',               // hair
  R: '#c0392b', r: '#8e2a20', // shirt
  B: '#3b5dc9',               // pants
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

  draw(rows, ox, oy) {
    rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== '.') this.set(ox + x, oy + y, ch);
      });
    });
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

// ---------- tiles ----------

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

// Order here = tile index used by the map (see src/map.js)
const TILES = [
  (img, x, y) => grass(img, x, y, 1),                                 // 0 grass
  (img, x, y) => grass(img, x, y, 2),                                 // 1 grass variant
  (img, x, y) => {                                                    // 2 flowers
    grass(img, x, y, 4);
    flower(img, x + 3, y + 4, 'W');
    flower(img, x + 11, y + 9, 'P');
    flower(img, x + 6, y + 12, 'W');
  },
  (img, x, y) => {                                                    // 3 tall grass
    grass(img, x, y, 3);
    for (const [bx, by] of [[0, 0], [8, 0], [0, 8], [8, 8]]) img.draw(BLADES, x + bx, y + by);
  },
  (img, x, y) => {                                                    // 4 path
    img.fill(x, y, TILE, TILE, 'D');
    const r = rng(9);
    for (let i = 0; i < 8; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), 'd');
    for (let i = 0; i < 4; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), 'p');
  },
  (img, x, y) => {                                                    // 5 water
    img.fill(x, y, TILE, TILE, 'U');
    const r = rng(11);
    for (let i = 0; i < 3; i++) {
      const wx = randInt(r, 1, 10);
      const wy = randInt(r, 1, 13);
      for (let k = 0; k < 3; k++) img.set(x + wx + k, y + wy, 'w');
      for (let k = 1; k < 4; k++) img.set(x + wx + k, y + wy + 1, 'u');
    }
  },
  (img, x, y) => { grass(img, x, y, 5); img.draw(TREE, x, y); },      // 6 tree
  (img, x, y) => { grass(img, x, y, 6); img.draw(ROCK, x, y); },      // 7 rock
];

// ---------- player (facing down / up / left; right = mirrored left) ----------

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

// Sheet layout (frame index = row * 3 + column):
//   row 0: down  [idle, step1, step2]
//   row 1: up    [idle, step1, step2]
//   row 2: left  [idle, step1, step2]
const PLAYER_ROWS = [
  [DOWN_TOP, FRONT_LEGS],
  [UP_TOP, FRONT_LEGS],
  [SIDE_TOP, SIDE_LEGS],
];

// ---------- write files ----------

const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

const tiles = new Img(TILES.length * TILE, TILE);
TILES.forEach((drawTile, i) => drawTile(tiles, i * TILE, 0));
fs.writeFileSync(path.join(outDir, 'tiles.png'), tiles.toPNG());

const player = new Img(3 * TILE, 3 * TILE);
PLAYER_ROWS.forEach(([top, legs], row) => {
  ['idle', 'step1', 'step2'].forEach((pose, col) => {
    const frame = sprite(`player row ${row} ${pose}`, [...top, ...legs[pose]]);
    player.draw(frame, col * TILE, row * TILE);
  });
});
fs.writeFileSync(path.join(outDir, 'player.png'), player.toPNG());

console.log('Wrote assets/tiles.png and assets/player.png');
