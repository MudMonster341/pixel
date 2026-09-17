// Generates all of the game's pixel art as PNG files. No dependencies.
// Run:  node tools/make-assets.js
// Output (in assets/):
//   tiles.png + tiles.json  every map tile (8 per row), with name, solid flag and minimap color
//   player.png              3x3 frames: down / up / left, each [idle, step1, step2]
//   npc.png                 3 frames: down / up / left
//   items.png               item icons, in the order of src/items.js
//   held-items.png          tiny 8x8 versions shown in the character's hand, same order/frames
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
  '+': '#d9a88a', '=': '#b9876c',         // BITS roof (light terracotta) + roof edge
  '^': '#c9ccd3', '~': '#a4a9b3',         // other buildings: wall + roof
  '<': '#7c8088',                          // fence
  // campus kit additions (FB-0006/0011/0014/0015/0016): appended, existing keys unchanged
  '-': '#d9927a', _: '#6f362c',           // paving bevel: highlight + deep shadow
  ':': '#8fbf52', ';': '#4f7a2f',         // date palm fronds: light + dark
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

  // campus (tools/campus/build-campus.js). 1 tile = 2 m outdoors.
  { name: 'sand', draw: (img, x, y) => speckle(img, x, y, '1', '2', 45, 12) },
  { name: 'campusGround', draw: (img, x, y) => speckle(img, x, y, '5', '6', 49, 10) },
  { name: 'asphalt', draw: (img, x, y) => speckle(img, x, y, '3', '4', 47, 14) },
  { name: 'paving', draw: paving },
  { name: 'parking', draw: parkingBay },
  { name: 'track', draw: runningTrack },
  { name: 'turf', draw: turf },
  { name: 'court', draw: (img, x, y) => img.fill(x, y, TILE, TILE, '@') },
  { name: 'fence', solid: true, draw: fence },
  { name: 'bitsRoof', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '+', '=') },
  { name: 'bitsWall', solid: true, draw: bitsWall },
  { name: 'bitsDoor', draw: bitsDoor },
  { name: 'otherRoof', solid: true, draw: (img, x, y) => flatRoof(img, x, y, '~', '<') },
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

  // FB-0015: lush lawn variants, clipped hedge, round bush, a flower bed, and two kinds of tree.
  // Trees are split into a solid trunk (ground level) and a 2x2 overhead canopy (see STYLE_GUIDE).
  { name: 'lawn', draw: (img, x, y) => grass(img, x, y, 71) },
  {
    name: 'lawn2',
    draw: (img, x, y) => {
      grass(img, x, y, 73);
      const r = rng(75);
      for (let i = 0; i < 3; i++) img.set(x + randInt(r, 0, 15), y + randInt(r, 0, 15), 'l');
    },
  },
  { name: 'hedge', solid: true, draw: hedge },
  { name: 'bush', solid: true, draw: bush },
  { name: 'flowerbed', solid: true, draw: flowerbed },
  { name: 'treeTrunk', solid: true, draw: treeTrunk },
  { name: 'treeCanopyTL', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 0, 0, roundCanopyShape, roundCanopyTone) },
  { name: 'treeCanopyTR', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 1, 0, roundCanopyShape, roundCanopyTone) },
  { name: 'treeCanopyBL', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 0, 1, roundCanopyShape, roundCanopyTone) },
  { name: 'treeCanopyBR', overhead: true, draw: (img, x, y) => canopyQuadrant(img, x, y, 1, 1, roundCanopyShape, roundCanopyTone) },
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
  { name: 'bitsEntranceL', draw: (img, x, y) => bitsEntrance(img, x, y, true) },
  { name: 'bitsEntranceR', draw: (img, x, y) => bitsEntrance(img, x, y, false) },
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

function parkingBay(img, x, y) {
  speckle(img, x, y, '3', '4', 41, 10);
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

function flatRoof(img, x, y, base, edge) {
  img.fill(x, y, TILE, TILE, base);
  img.fill(x, y, TILE, 1, edge);
  img.fill(x, y, 1, TILE, edge);
}

// Sand-beige render with a salmon cornice, a panel line, a dark base course and two small
// windows (FB-0011: one big window per tile made every row read as a band of glass).
function bitsWallPlain(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 2, '&'); // cornice / trim line
  img.fill(x + 7, y + 2, 1, 12, '%'); // panel line
  img.fill(x, y + 14, TILE, 2, '%'); // dark base course
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

// -- FB-0014: roads with kerb edges + a raised pavement, lane markings, a crossing, walkways --

// A road/path rectangle's border: a paved (sidewalk) band along the named edge(s), a black-and-white
// kerb line between it and the road surface, and asphalt filling the rest. `sides` is a string built
// from 'T'/'B'/'L'/'R'; combining two perpendicular sides makes a corner piece.
function kerbEdge(img, x, y, sides) {
  speckle(img, x, y, '3', '4', 61, 10); // asphalt base
  const band = 5;
  const kerbW = 2;
  const kerbAt = (i) => (Math.floor(i / 4) % 2 === 0 ? 'W' : 'K');
  const sidewalkAt = (gx, gy) => brickBevel(gx, gy, (gy >> 2) % 2 ? 4 : 0, 8, '7');
  if (sides.includes('T')) {
    for (let yy = 0; yy < band; yy++) for (let xx = 0; xx < TILE; xx++) img.set(x + xx, y + yy, sidewalkAt(xx, yy));
    for (let yy = band; yy < band + kerbW; yy++) for (let xx = 0; xx < TILE; xx++) img.set(x + xx, y + yy, kerbAt(xx));
  }
  if (sides.includes('B')) {
    for (let yy = TILE - band; yy < TILE; yy++) for (let xx = 0; xx < TILE; xx++) img.set(x + xx, y + yy, sidewalkAt(xx, yy - (TILE - band)));
    for (let yy = TILE - band - kerbW; yy < TILE - band; yy++) for (let xx = 0; xx < TILE; xx++) img.set(x + xx, y + yy, kerbAt(xx));
  }
  if (sides.includes('L')) {
    for (let xx = 0; xx < band; xx++) for (let yy = 0; yy < TILE; yy++) img.set(x + xx, y + yy, sidewalkAt(xx, yy));
    for (let xx = band; xx < band + kerbW; xx++) for (let yy = 0; yy < TILE; yy++) img.set(x + xx, y + yy, kerbAt(yy));
  }
  if (sides.includes('R')) {
    for (let xx = TILE - band; xx < TILE; xx++) for (let yy = 0; yy < TILE; yy++) img.set(x + xx, y + yy, sidewalkAt(xx - (TILE - band), yy));
    for (let xx = TILE - band - kerbW; xx < TILE - band; xx++) for (let yy = 0; yy < TILE; yy++) img.set(x + xx, y + yy, kerbAt(yy));
  }
}

function roadLineH(img, x, y) {
  speckle(img, x, y, '3', '4', 63, 10);
  img.fill(x + 6, y + 7, 4, 2, 'W');
}
function roadLineV(img, x, y) {
  speckle(img, x, y, '3', '4', 65, 10);
  img.fill(x + 7, y + 6, 2, 4, 'W');
}
function crossingH(img, x, y) {
  speckle(img, x, y, '3', '4', 67, 6);
  for (let xx = 1; xx < TILE; xx += 4) img.fill(x + xx, y, 2, TILE, 'W');
}
function crossingV(img, x, y) {
  speckle(img, x, y, '3', '4', 69, 6);
  for (let yy = 1; yy < TILE; yy += 4) img.fill(x, y + yy, TILE, 2, 'W');
}

// A brick walkway with a light stone edging along its long (north/south) sides, so a run of these
// tiles reads as one continuous bordered path across lawn or sand, not a grid of framed squares:
// the border only shows where the path meets the ground, not at the seam between two path tiles.
function walkway(img, x, y) {
  forEachPixel((xx, yy) => {
    if (yy === 0 || yy === 15) {
      img.set(x + xx, y + yy, xx % 2 === 0 ? 'Q' : 'O');
      return;
    }
    const inRow = yy - 1;
    const offset = (Math.floor(inRow / 3) % 2) ? 3 : 0;
    const withinRow = inRow % 3;
    const brickX = (xx + offset) % 6;
    let key = '7';
    if (withinRow === 2 || brickX === 5) key = '8';
    else if (withinRow === 0 || brickX === 0) key = '-';
    img.set(x + xx, y + yy, key);
  });
}

// -- FB-0015: lush lawn, hedges, bushes, a flower bed, and trees with overhead canopies --

function hedge(img, x, y) {
  forEachPixel((xx, yy) => {
    const key = (xx + yy * 3) % 7 === 0 ? 't' : (xx * 2 + yy) % 11 === 0 ? 'e' : 'T';
    img.set(x + xx, y + yy, key);
  });
  img.fill(x, y, TILE, 2, 't');
  img.fill(x, y, 2, TILE, 't');
  img.fill(x, y + TILE - 2, TILE, 2, 'e');
  img.fill(x + TILE - 2, y, 2, TILE, 'e');
}

function bush(img, x, y) {
  grass(img, x, y, 77);
  const inside = (xx, yy) => ((xx - 7.5) / 6.5) ** 2 + ((yy - 8) / 6) ** 2 < 1;
  for (let yy = 0; yy < TILE; yy++) {
    for (let xx = 0; xx < TILE; xx++) {
      if (inside(xx, yy)) {
        img.set(x + xx, y + yy, xx < 8 && yy < 9 ? 't' : xx > 9 || yy > 10 ? 'e' : 'T');
      } else if (inside(xx - 1, yy) || inside(xx + 1, yy) || inside(xx, yy - 1) || inside(xx, yy + 1)) {
        img.set(x + xx, y + yy, 'K');
      }
    }
  }
}

// A small brick-edged planter (a garden bed border, not a fill color close to the soil, so the
// edge actually reads against the dirt) with a few flowers.
function flowerbed(img, x, y) {
  img.fill(x, y, TILE, TILE, 'n');
  img.fill(x, y, TILE, 2, 'Q');
  img.fill(x, y, 2, TILE, 'Q');
  img.fill(x, y + TILE - 2, TILE, 2, 'o');
  img.fill(x + TILE - 2, y, 2, TILE, 'o');
  flower(img, x + 4, y + 5, 'W');
  flower(img, x + 10, y + 6, 'P');
  flower(img, x + 7, y + 10, 'Y');
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
const roundCanopyTone = (gx, gy) => {
  const d = (gx - 16) + (gy - 13); // diagonal position: light from the top-left
  return d < -8 ? 't' : d > 10 ? 'e' : 'T';
};

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
  img.fill(x, y, TILE, TILE, '+');
  if (edges.top) img.fill(x, y, TILE, 3, '=');
  if (edges.left) img.fill(x, y, 3, TILE, '=');
  if (edges.right) img.fill(x + TILE - 3, y, 3, TILE, '=');
  outline(img, x, y, edges);
}

function otherRoofEdge(img, x, y, edges) {
  img.fill(x, y, TILE, TILE, '~');
  if (edges.top) img.fill(x, y, TILE, 3, '<');
  if (edges.left) img.fill(x, y, 3, TILE, '<');
  if (edges.right) img.fill(x + TILE - 3, y, 3, TILE, '<');
  outline(img, x, y, edges);
}

// Glass entrance under a salmon arch, 2 tiles wide.
function bitsEntrance(img, x, y, isLeft) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 3, '&');
  img.fill(x + (isLeft ? 3 : 0), y + 3, 13, 11, '*');
  img.set(x + (isLeft ? 5 : 10), y + 6, 'W');
  img.fill(x, y + 14, TILE, 2, '%');
}

function bitsPillar(img, x, y) {
  img.fill(x, y, TILE, TILE, '$');
  img.fill(x, y, TILE, 2, '&');
  img.box(x + 5, y + 1, 6, 15, '%');
  img.fill(x + 6, y + 2, 4, 13, '&');
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

// The player is the female lead: black shoulder-length hair, pink top, lighter pink skirt.
const LEAD_COLORS = { H: 'q', R: 'M', r: 'c', B: 'P' };
const LEAD_HAIR = [
  { 7: '...KHSSSSSSHK...', 8: '...KHKSSSSKHK...' }, // down: hair falls beside the face
  { 8: '...KHHHHHHHHK...', 9: '...KHRRRRRRHK...' }, // up: hair down the back
  { 8: '...KSSSSHHHK....', 9: '....KRRRRHHK....' }, // left: hair behind the shoulder
];
const player = new Img(3 * TILE, 3 * TILE);
PLAYER_ROWS.forEach(([top, legs], row) => {
  const leadTop = recolor(replaceRows(top, LEAD_HAIR[row]), LEAD_COLORS);
  ['idle', 'step1', 'step2'].forEach((pose, col) => {
    const frame = sprite(`player row ${row} ${pose}`, [...leadTop, ...recolor(legs[pose], LEAD_COLORS)]);
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

// Small in-hand sprites (FB-0002): 8x8 frames, same order/frame numbers as items.png.
const HELD_ITEM_SIZE = 8;
const heldItems = new Img(HELD_ITEM_ICONS.length * HELD_ITEM_SIZE, HELD_ITEM_SIZE);
HELD_ITEM_ICONS.forEach((icon, i) => heldItems.draw(icon, i * HELD_ITEM_SIZE, 0));
write('held-items.png', heldItems);

const prompt = new Img(TILE, TILE);
prompt.draw(PROMPT, 0, 0);
write('prompt.png', prompt);

console.log(`Wrote ${TILES.length} tiles, player, npc, ${ITEM_ICONS.length} items and prompt to assets/`);
