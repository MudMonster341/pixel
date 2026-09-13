// Generates all of the game's pixel art as PNG files. No dependencies.
// Run:  node tools/make-assets.js
// Output (in assets/):
//   tiles.png + tiles.json  every map tile (8 per row), with name, solid flag and minimap color
//   player.png              3x3 frames: down / up / left, each [idle, step1, step2]
//   npc.png                 3 frames: down / up / left
//   items.png               item icons, in the order of src/items.js
//   prompt.png              the "E" bubble shown above someone you can talk to
//
// Hand-drawn sprites are text: one character = one pixel, "." = transparent.
// Change a character, re-run the script, refresh the browser.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
  { name: 'grass', draw: (img, x, y) => grass(img, x, y, 1) },
  { name: 'grass2', draw: (img, x, y) => grass(img, x, y, 2) },
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

// ---------- npc: Tomas, an old villager (player body, recolored, with a beard) ----------

const recolor = (rows, map) => rows.map((row) => [...row].map((ch) => map[ch] || ch).join(''));
const replaceRows = (rows, replacements) => rows.map((row, i) => replacements[i] || row);
const TOMAS_COLORS = { H: 'A', R: 'J', r: 'h', B: 'a' };

const NPC_FRAMES = [
  replaceRows(recolor([...DOWN_TOP, ...FRONT_LEGS.idle], TOMAS_COLORS), {
    7: '...KSAAAAAASK...',
    8: '....KAAAAAAK....',
  }),
  recolor([...UP_TOP, ...FRONT_LEGS.idle], TOMAS_COLORS),
  replaceRows(recolor([...SIDE_TOP, ...SIDE_LEGS.idle], TOMAS_COLORS), {
    7: '..KSAAAAAAAK....',
    8: '...KAAAAAAK.....',
  }),
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
  sprite('potion', [
    '................',
    '......KKKK......',
    '......KNNK......',
    '......KNnK......',
    '.....KKKKKK.....',
    '......KwwK......',
    '......KwwK......',
    '....KKwwwwKK....',
    '...KwWwwwwwwK...',
    '..KwWRRRRRRRwK..',
    '..KwRRRRRRRRwK..',
    '..KwRRRRRRRrwK..',
    '..KwrRRRRRrrwK..',
    '...KwrrrrrrwK...',
    '....KKKKKKKK....',
    '................',
  ]),
  sprite('gem', [
    '................',
    '................',
    '.....KKKKKK.....',
    '....KwWwUUuK....',
    '...KwWwUUUUuK...',
    '..KKKKKKKKKKKK..',
    '..KwwUUUUUUuuK..',
    '...KwUUUUUUuK...',
    '....KwUUUUuK....',
    '.....KwUUuK.....',
    '......KwuK......',
    '.......KK.......',
    '................',
    '................',
    '................',
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
];

const PROMPT = sprite('prompt', [
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

// ---------- write files ----------

// `--out <dir>` writes somewhere else (the tests use this to check assets/ is up to date).
const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, img) => fs.writeFileSync(path.join(outDir, name), img.toPNG());

const tileRows = Math.ceil(TILES.length / TILESET_COLUMNS);
const tiles = new Img(TILESET_COLUMNS * TILE, tileRows * TILE);
const tileInfo = TILES.map(({ name, solid, draw }, i) => {
  const x = (i % TILESET_COLUMNS) * TILE;
  const y = Math.floor(i / TILESET_COLUMNS) * TILE;
  draw(tiles, x, y);
  return { name, solid: Boolean(solid), color: tiles.averageColor(x, y, TILE, TILE) };
});
write('tiles.png', tiles);
fs.writeFileSync(
  path.join(outDir, 'tiles.json'),
  JSON.stringify({ tileSize: TILE, columns: TILESET_COLUMNS, tiles: tileInfo }, null, 2) + '\n',
);

const player = new Img(3 * TILE, 3 * TILE);
PLAYER_ROWS.forEach(([top, legs], row) => {
  ['idle', 'step1', 'step2'].forEach((pose, col) => {
    const frame = sprite(`player row ${row} ${pose}`, [...top, ...legs[pose]]);
    player.draw(frame, col * TILE, row * TILE);
  });
});
write('player.png', player);

const npc = new Img(NPC_FRAMES.length * TILE, TILE);
NPC_FRAMES.forEach((frame, i) => npc.draw(sprite(`npc frame ${i}`, frame), i * TILE, 0));
write('npc.png', npc);

const items = new Img(ITEM_ICONS.length * TILE, TILE);
ITEM_ICONS.forEach((icon, i) => items.draw(icon, i * TILE, 0));
write('items.png', items);

const prompt = new Img(TILE, TILE);
prompt.draw(PROMPT, 0, 0);
write('prompt.png', prompt);

console.log(`Wrote ${TILES.length} tiles, player, npc, ${ITEM_ICONS.length} items and prompt to assets/`);
