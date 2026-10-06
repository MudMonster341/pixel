// Art of "EDI Madness" (decisions/0025, docs/plans/2026-10-06-edi-madness.md, phase E2): the garage backdrops, the 8-heading car sheet, the small
// sprites, the instructor's portrait and the cover. Used by tools/make-minigame-art.js, which hands in its own small helpers (the Img
// canvas, the pixel-text and sprite helpers), so this file draws with exactly the same pixels as the other mini-games' art.
//
// Rules and art cannot drift: the stage layouts (walls, pillars, parked cars with their angles, the bay, the arrows) are READ from
// src/minigames/edi-logic.js (evaluated in a vm context: it needs no Phaser), never copied.
//
// The cars (owner decision, FB-0025: free packs only, never hand-drawn): no free pack has a true top-down car. The CC0 Kenney Roguelike
// Modern City sheet has one small car in three views (a side view in both directions, a front view and a back view, in green, grey and
// orange). Those pieces ARE the car here; the four in-between headings are composed from them in code (a squeezed side slice joined to
// a squeezed front/back slice, see composeDiagonal) so the car at least feels like it is turning. Every colour is the same pixels with
// the four body tones swapped, so it is recognisably the same car in all 8 frames.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const CITY_SHEET = 'kenney-roguelike-modern-city/Spritesheet/roguelikeCity_magenta.png';

// ---------- the stage data, read from the rules ----------
let ediDataCache = null;
function loadEdiData() {
  if (ediDataCache) return ediDataCache;
  const source = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'edi-logic.js'), 'utf8');
  const context = vm.createContext({ Math, WeakMap });
  vm.runInContext(`${source}\nthis.__edi = { EDI_STAGES, EDI_W, EDI_H, EDI_TILE, EDI_CAR_LEN, EDI_CAR_WID, EDI_STAGE_COUNT, EDI_ART, EDI_CAR_CELL, EDI_CAR_ROWS, EDI_SPRITE_FRAME, ediCarFrame };`, context);
  ediDataCache = context.__edi;
  return ediDataCache;
}

// ---------- car colours (data) ----------
// Body tones, from the pack's green car: main, mid, dark (the rim and the sill), light (the highlight). `green` is the pack's own, grey and
// orange are the pack's own too; red, yellow and blue are palette swaps of the same pixels.
const EDI_CAR_TONES = ['main', 'mid', 'dark', 'light'];
const EDI_CAR_COLOURS = {
  green: { main: '#4ba86d', mid: '#409c62', dark: '#307e4d', light: '#55bd7c' }, // the pack's green car
  grey: { main: '#84929a', mid: '#728087', dark: '#5c676d', light: '#95a2a9' }, // the pack's grey car
  orange: { main: '#c66527', mid: '#b45c24', dark: '#974c1e', light: '#da732c' }, // the pack's orange car
  red: { main: '#d6404f', mid: '#c23545', dark: '#9c2a38', light: '#e8606c' },
  yellow: { main: '#f2c53d', mid: '#dcae2e', dark: '#b98c22', light: '#ffd95c' },
  blue: { main: '#4f8fd0', mid: '#437fbd', dark: '#31609a', light: '#6fa8e6' },
  // the learner car: a white body with green accents (the dark tone, i.e. the rim and the sill, is the green)
  learner: { main: '#f7f6f1', mid: '#cfe9d9', dark: '#2f9d62', light: '#ffffff' },
};
// Row order of the car sheet (the learner car first, then the colours the parked cars use) is the logic's, so the scene and the art agree.
const EDI_CAR_ROWS = Array.from(loadEdiData().EDI_CAR_ROWS);
const EDI_PARKED_COLOURS = ['green', 'grey', 'orange', 'red', 'yellow', 'blue'];
// Parked car number `i` of stage `stageIndex` (counting only the cars, in the stage's own order): neighbours never share a colour.
function ediParkedColour(stageIndex, i) {
  return EDI_PARKED_COLOURS[(i * 5 + stageIndex * 2) % EDI_PARKED_COLOURS.length];
}


// ---------- the car sheet ----------
const CELL = loadEdiData().EDI_CAR_CELL; // one frame: a square cell centred on the car's centre (56)
const HEADINGS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE']; // heading 0 = east, clockwise on screen: frame = Math.round(heading / (PI / 4)) mod 8
const CAR_SCALE = 44 / 36; // the pack's side view is 36 px long; the logic's car is 44 px (EDI_CAR_LEN)
const CAR_STRETCH = 6; // plain body rows added to the front/back views
const CAR_LIFT = 2; // px the sprite is lifted, so the wheels stand about on the hitbox's lower edge

// Source rects in the pack sheet (pixels incl. its 1 px tile margins): the green car (grey and orange are the same drawing).
const CAR_SRC = {
  left: [534, 280, 38, 25], // side view, nose to the left
  right: [583, 280, 38, 25], // side view, nose to the right
  back: [532, 308, 23, 30], // seen from behind (tail lights)
  front: [566, 308, 23, 30], // seen from the front (head lights)
};
// Where the roof sits in each native crop (the roof panel): the learner car's "L" sign is stuck on it.
const CAR_ROOF = { left: [18.5, 5], right: [16.5, 5], back: [10.5, 8.5], front: [10.5, 8.5] };
const L_SIGN = ['KKKKKKKK', 'KWWWWWWK', 'KWGWWWWK', 'KWGWWWWK', 'KWGWWWWK', 'KWGGGWWK', 'KWWWWWWK', 'KKKKKKKK'];

module.exports = createEdiArt;
Object.assign(createEdiArt, { loadEdiData, EDI_CAR_COLOURS, EDI_CAR_ROWS, EDI_PARKED_COLOURS, ediParkedColour, CELL, HEADINGS });

function createEdiArt(h) {
  const { Img, decodePNG, glow } = h;
  const hex = (r, g, b) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

  let cityCache = null;
  // A crop of the pack sheet with its 1 px tile margins taken out (the sheet's own coordinates in, a seamless Img out).
  function cityCrop(x, y, w, hh) {
    if (!cityCache) cityCache = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'vendor', CITY_SHEET)));
    const sheet = cityCache;
    const xs = [];
    const ys = [];
    for (let i = x; i < x + w; i++) if (i % 17 !== 16) xs.push(i);
    for (let j = y; j < y + hh; j++) if (j % 17 !== 16) ys.push(j);
    const img = new Img(xs.length, ys.length);
    ys.forEach((sy, yy) => xs.forEach((sx, xx) => {
      const si = (sy * sheet.width + sx) * 4;
      img.pxA(xx, yy, sheet.data[si], sheet.data[si + 1], sheet.data[si + 2], sheet.data[si + 3]);
    }));
    return img;
  }

  // `img` with its row `at` repeated `extra` more times.
  function stretchRows(img, at, extra) {
    const out = new Img(img.w, img.h + extra);
    for (let y = 0; y < out.h; y++) {
      const sy = y <= at ? y : Math.max(at, y - extra);
      for (let x = 0; x < img.w; x++) {
        const i = (sy * img.w + x) * 4;
        if (img.data[i + 3]) out.pxA(x, y, img.data[i], img.data[i + 1], img.data[i + 2], 255);
      }
    }
    return out;
  }

  // The same pixels in another colour: the four body tones of the green car swapped for the colour's. `windows` re-tints the pale glass.
  function recolour(src, to, windows) {
    const map = new Map(EDI_CAR_TONES.map((t) => [EDI_CAR_COLOURS.green[t], to[t]]));
    if (windows) for (const k of ['#d9dde6', '#d1d6e1', '#dee2e9']) map.set(k, windows);
    const out = new Img(src.w, src.h);
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (!src.data[i + 3]) continue;
        const swap = map.get(hex(src.data[i], src.data[i + 1], src.data[i + 2]));
        if (swap) out.px(x, y, swap);
        else out.pxA(x, y, src.data[i], src.data[i + 1], src.data[i + 2], 255);
      }
    }
    return out;
  }

  // One frame: `src` (a native crop) turned by `deg` (positive = clockwise on screen) about its centre and scaled by CAR_SCALE, nearest
  // neighbour, into a CELL x CELL cell, lifted CAR_LIFT px so the wheels stand about on the hitbox's lower edge (the roof stands above it).
  // A turned frame gets a clean one-pixel rim in the colour's dark tone (the nearest-neighbour turn breaks the pack's own rim into dots),
  // and a soft drop shadow (the silhouette, shifted) goes under the car.
  function renderFrame(src, deg, roof, tones) {
    const body = new Img(CELL, CELL);
    const a = (deg * Math.PI) / 180;
    const c = Math.cos(a);
    const s = Math.sin(a);
    for (let y = 0; y < CELL; y++) {
      for (let x = 0; x < CELL; x++) {
        const dx = x + 0.5 - CELL / 2;
        const dy = y + 0.5 - CELL / 2 + CAR_LIFT;
        const sx = Math.floor((c * dx + s * dy) / CAR_SCALE + src.w / 2);
        const sy = Math.floor((-s * dx + c * dy) / CAR_SCALE + src.h / 2);
        if (sx < 0 || sy < 0 || sx >= src.w || sy >= src.h) continue;
        const i = (sy * src.w + sx) * 4;
        if (src.data[i + 3]) body.pxA(x, y, src.data[i], src.data[i + 1], src.data[i + 2], 255);
      }
    }
    if (deg !== 0) {
      const rim = [];
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          const i = (y * CELL + x) * 4;
          const wheel = body.data[i] < 0x58 && body.data[i + 1] < 0x58 && body.data[i + 2] < 0x58; // the dark grey tyres keep their own colour
          if (body.data[i + 3] && !wheel && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => body.alphaAt(x + ox, y + oy) === 0)) rim.push([x, y]);
        }
      }
      for (const [x, y] of rim) body.px(x, y, tones.dark);
    }
    const cell = new Img(CELL, CELL);
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (body.alphaAt(x, y)) glow(cell, x + 1, y + 2, '#1a1c2c', 0.28);
    cell.blit(body, 0, 0);
    // where the roof panel ended up in the cell (the forward transform of the same turn)
    const rx = roof[0] - src.w / 2;
    const ry = roof[1] - src.h / 2;
    return { cell, roof: [CELL / 2 + CAR_SCALE * (c * rx - s * ry), CELL / 2 + CAR_SCALE * (s * rx + c * ry) - CAR_LIFT] };
  }

  // The 8 frames of one colour, E SE S SW W NW N NE. The four straight ones are the pack's own views; the diagonals are the side view
  // turned 45 degrees (nearest neighbour), since the blend of a squeezed side slice and a front slice read as two cars glued together.
  function buildCarFrames(colourName) {
    const tones = EDI_CAR_COLOURS[colourName];
    const windows = colourName === 'learner' ? '#a9cde8' : null;
    const crop = (key) => recolour(cityCrop(...CAR_SRC[key]), tones, windows);
    // the front and back views are drawn from a high camera and look stubby next to the 44 px side view: their plain body rows are repeated
    // so the car is about as long on screen as the logic's hitbox (the roof panel, the glass and the bumpers keep their own pixels)
    const sources = { left: crop('left'), right: crop('right'), back: stretchRows(crop('back'), 12, CAR_STRETCH), front: stretchRows(crop('front'), 12, CAR_STRETCH) };
    const specs = [ // [source, degrees clockwise]
      ['right', 0], ['right', 45], ['front', 0], ['left', -45], ['left', 0], ['left', 45], ['back', 0], ['right', -45],
    ];
    return specs.map(([key, deg]) => {
      const { cell, roof } = renderFrame(sources[key], deg, CAR_ROOF[key], tones);
      if (colourName === 'learner') { // the learner's "L" sign, upright on the roof whatever the heading
        const sign = new Img(8, 8);
        h.drawRows(sign, 0, 0, L_SIGN, { K: '#1a1c2c', W: '#ffffff', G: '#2f9d62' });
        cell.blit(sign, Math.round(roof[0] - 4), Math.round(roof[1] - 4));
      }
      return cell;
    });
  }

  // edi-cars.png: one row of 8 headings per colour (EDI_CAR_ROWS order), 8 x 7 cells of 56 px = 448 x 392.
  function buildEdiCars() {
    const sheet = new Img(CELL * 8, CELL * EDI_CAR_ROWS.length);
    EDI_CAR_ROWS.forEach((name, row) => buildCarFrames(name).forEach((frame, col) => sheet.blit(frame, col * CELL, row * CELL)));
    return sheet;
  }


  // ---------- small helpers ----------
  function rng(seed) { // a tiny deterministic generator: the art never changes between runs
    let s = seed >>> 0;
    return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  }
  // Paints the opaque pixels of `mask` (an Img) onto `dst` at (ox, oy) in one colour and opacity (painted markings are a little worn).
  function stamp(dst, mask, hexColour, alpha, ox = 0, oy = 0) {
    for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) if (mask.alphaAt(x, y)) dst.px(ox + x, oy + y, hexColour, alpha);
  }
  // A solid arrow (shaft and head) of `len` px, turned by `angle` (radians, 0 = pointing right), centred on (cx, cy).
  function arrowMask(len, shaftHalf, headHalf, angle, size) {
    const mask = new Img(size, size);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const pt = (x, y) => [size / 2 + c * x - s * y, size / 2 + s * x + c * y];
    const headLen = Math.round(len * 0.42);
    h.fillPoly(mask, [pt(-len / 2, -shaftHalf), pt(len / 2 - headLen, -shaftHalf), pt(len / 2 - headLen, shaftHalf), pt(-len / 2, shaftHalf)], '#ffffff');
    h.fillTri(mask, pt(len / 2 - headLen, -headHalf), pt(len / 2, 0), pt(len / 2 - headLen, headHalf), '#ffffff');
    return mask;
  }
  function paintArrow(img, cx, cy, angle, len, alpha) {
    const size = len + 12;
    stamp(img, arrowMask(len, 4, 11, angle, size), '#f4f1ea', alpha, Math.round(cx - size / 2), Math.round(cy - size / 2));
  }
  function dashedLine(img, x0, y0, x1, y1, dash, gap, thick, hexColour, alpha, skips = []) {
    const horizontal = y0 === y1;
    const from = horizontal ? x0 : y0;
    const to = horizontal ? x1 : y1;
    for (let p = from; p < to; p += dash + gap) {
      const q = Math.min(p + dash, to);
      const mid = (p + q) / 2;
      if (skips.some(([a, b]) => mid >= a && mid <= b)) continue;
      if (horizontal) img.rect(p, y0 - Math.floor(thick / 2), q, y0 + Math.ceil(thick / 2) - 1, hexColour, alpha);
      else img.rect(x0 - Math.floor(thick / 2), p, x0 + Math.ceil(thick / 2) - 1, q, hexColour, alpha);
    }
  }

  // ---------- the garage backdrops ----------
  const BG = [
    { base: '#b8bdca', alt: '#b1b7c5', joint: '#9ea5b6', stain: '#656c82', lamp: 0.14, shade: 0 },
    { base: '#aeb4c2', alt: '#a7adbc', joint: '#979eb0', stain: '#5d647a', lamp: 0.16, shade: 0.06 },
    { base: '#9ba1b3', alt: '#949aad', joint: '#858ba0', stain: '#4d5470', lamp: 0.22, shade: 0.16 },
  ];
  const WALL = { top: '#cfd3df', topHi: '#e8ebf2', face: '#7f869e', faceLo: '#5d6480', line: '#1a1c2c', joint: '#b9bfd0' };
  const EDI_STAINS = [ // oil stains: [x, y, rx, ry] per stage, in the aisles, away from the walls
    [[210, 330, 22, 9], [740, 250, 16, 7], [480, 440, 12, 6], [880, 330, 10, 5]],
    [[200, 120, 18, 8], [620, 200, 26, 9], [820, 160, 12, 6], [330, 250, 10, 5]],
    [[300, 380, 20, 8], [640, 220, 14, 7], [820, 420, 18, 8], [200, 200, 12, 6]],
  ];
  const EDI_LAMPS = [ // ceiling lamp pools on the floor: [x, y, radius] per stage
    [[160, 250, 150], [480, 250, 170], [800, 250, 150]],
    [[200, 190, 150], [480, 190, 170], [760, 190, 150]],
    [[200, 410, 130], [470, 410, 130], [200, 180, 120], [560, 190, 140], [800, 430, 120]],
  ];
  const EDI_LANES = [ // painted dashed lane centre lines: [x0, y0, x1, y1, skips[]] per stage (the arrows keep their own gap)
    [[40, 300, 920, 300, [[540, 580]]]],
    [[40, 200, 920, 200, [[120, 180]]]],
    [[40, 410, 920, 410, [[230, 270]]], [420, 226, 920, 226, [[440, 480]]]],
  ];

  function drawFloor(img, stageIndex) {
    const p = BG[stageIndex];
    const rand = rng(7000 + stageIndex);
    img.rect(0, 0, img.w - 1, img.h - 1, p.base);
    for (let r = 0; r * 90 < img.h; r++) { // concrete slabs, 96 x 90, in two near tones with a thin joint
      for (let c = 0; c * 96 < img.w; c++) {
        if ((c + r) % 2) img.rect(c * 96, r * 90, c * 96 + 95, r * 90 + 89, p.alt);
      }
    }
    for (let x = 0; x < img.w; x += 96) img.rect(x, 0, x, img.h - 1, p.joint, 0.55);
    for (let y = 0; y < img.h; y += 90) img.rect(0, y, img.w - 1, y, p.joint, 0.55);
    for (let i = 0; i < 2600; i++) { // concrete speckle
      const x = Math.floor(rand() * img.w);
      const y = Math.floor(rand() * img.h);
      img.px(x, y, rand() < 0.5 ? '#ffffff' : '#4a5068', 0.09);
    }
    for (const [x, y, rx, ry] of EDI_STAINS[stageIndex]) { // oil stains: a dark blob with a darker core
      img.ellipse(x, y, rx, ry, p.stain, 0.16);
      img.ellipse(x + 2, y + 1, Math.round(rx * 0.6), Math.round(ry * 0.6), p.stain, 0.14);
    }
    for (const [x, y, rad] of EDI_LAMPS[stageIndex]) { // warm light pools under the ceiling lamps
      for (let yy = -rad; yy <= rad; yy++) {
        for (let xx = -rad; xx <= rad; xx++) {
          const d = Math.hypot(xx, yy * 1.3) / rad;
          if (d < 1) img.px(x + xx, y + yy, '#fff3c4', p.lamp * (1 - d) * (1 - d) * 1.6);
        }
      }
    }
    if (p.shade) { // the darker the garage, the more the corners fall off
      for (let i = 0; i < 60; i++) {
        const a = p.shade * (1 - i / 60) * (1 - i / 60);
        img.rect(0, i, img.w - 1, i, '#12131a', a);
        img.rect(0, img.h - 1 - i, img.w - 1, img.h - 1 - i, '#12131a', a);
        img.rect(i, 0, i, img.h - 1, '#12131a', a);
        img.rect(img.w - 1 - i, 0, img.w - 1 - i, img.h - 1, '#12131a', a);
      }
    }
  }

  // The U-shaped marking of one parking slot (open toward the aisle) for a car whose nose is at `heading` (a multiple of 90 degrees):
  // the slot is as wide as the target bay (34 px) and 56 deep, like the bay the logic makes with ediTopBay.
  function drawSlot(img, cx, cy, heading, alpha = 0.8) {
    const horizontal = Math.abs(Math.cos(heading)) > 0.5;
    const along = horizontal ? 56 : 56; // depth of the slot
    const w = horizontal ? along : 34;
    const hgt = horizontal ? 34 : along;
    const x0 = Math.round(cx - w / 2);
    const y0 = Math.round(cy - hgt / 2);
    const white = '#f4f1ea';
    if (horizontal) { // nose east or west: lines on the long sides, the back line on the side opposite the nose
      img.rect(x0, y0, x0 + w - 1, y0 + 1, white, alpha);
      img.rect(x0, y0 + hgt - 2, x0 + w - 1, y0 + hgt - 1, white, alpha);
      const back = Math.cos(heading) > 0 ? x0 : x0 + w - 2;
      img.rect(back, y0, back + 1, y0 + hgt - 1, white, alpha);
    } else {
      img.rect(x0, y0, x0 + 1, y0 + hgt - 1, white, alpha);
      img.rect(x0 + w - 2, y0, x0 + w - 1, y0 + hgt - 1, white, alpha);
      const back = Math.sin(heading) < 0 ? y0 : y0 + hgt - 2; // nose up: the back line is at the top
      img.rect(x0, back, x0 + w - 1, back + 1, white, alpha);
    }
  }

  function drawBay(img, bay) { // the target: pale blue paint, a white outline and a big P
    img.rect(bay.x, bay.y, bay.x + bay.w - 1, bay.y + bay.h - 1, '#8fb4ee', 0.5);
    for (let t = 0; t < 3; t++) img.outlineRect(bay.x + t, bay.y + t, bay.x + bay.w - 1 - t, bay.y + bay.h - 1 - t, '#ffffff');
    const letter = 4;
    const px = Math.round(bay.x + bay.w / 2 - (5 * letter) / 2);
    const py = Math.round(bay.y + bay.h / 2 - (7 * letter) / 2);
    h.drawPixelText(img, 'P', px, py, '#ffffff', letter, null);
  }

  // A concrete block (a wall or a pillar): a lit top, a darker front face along its lower edge (the face is INSIDE the collision rectangle,
  // so what is drawn solid is exactly what the logic treats as solid), a dark outline and a soft shadow on the floor next to it.
  function drawBlock(img, o, hazard) {
    const { x, y, w, h: hh } = o;
    const face = Math.min(hazard ? 10 : 12, Math.floor(hh * 0.45));
    const rand = rng(x * 31 + y * 17 + w);
    img.rect(x + w, y + 3, x + w + 4, y + hh + 2, '#12131a', 0.2); // shadow on the floor (right and below, a few px)
    img.rect(x + 3, y + hh, x + w + 4, y + hh + 4, '#12131a', 0.2);
    img.rect(x, y, x + w - 1, y + hh - 1, WALL.top);
    img.rect(x, y, x + w - 1, y, WALL.topHi);
    img.rect(x, y, x, y + hh - 1, WALL.topHi);
    for (let i = 0; i < Math.floor((w * hh) / 90); i++) img.px(x + Math.floor(rand() * w), y + Math.floor(rand() * (hh - face)), rand() < 0.5 ? '#ffffff' : '#8d94aa', 0.25);
    for (let jx = x + 48; jx < x + w - 8; jx += 48) img.rect(jx, y + 2, jx, y + hh - face - 2, WALL.joint, 0.7); // panel joints on long tops
    img.rect(x, y + hh - face, x + w - 1, y + hh - 1, WALL.face); // the front face
    img.rect(x, y + hh - face, x + w - 1, y + hh - face, WALL.faceLo);
    img.rect(x, y + hh - 3, x + w - 1, y + hh - 1, WALL.faceLo);
    if (hh > 2 * w && w <= 40) { // a tall narrow wall: the side that looks at the playfield is in shade
      const sx = x + w / 2 < 480 ? x + w - 6 : x;
      img.rect(sx, y, sx + 5, y + hh - 1, WALL.face);
    }
    if (hazard) { // yellow-black warning stripes at the base
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < 6; j++) img.px(x + i, y + hh - 7 + j, ((i + j) >> 2) % 2 ? '#1a1c2c' : '#ffd23f');
      }
      img.rect(x, y + hh - 8, x + w - 1, y + hh - 8, WALL.faceLo);
    }
    img.outlineRect(x, y, x + w - 1, y + hh - 1, WALL.line);
  }

  function drawSign(img, x, y, w, hgt) { // a blue square sign with a white frame (the P sign, the one-way sign)
    img.rect(x, y, x + w - 1, y + hgt - 1, '#2f64b8');
    img.outlineRect(x, y, x + w - 1, y + hgt - 1, '#ffffff');
    img.outlineRect(x - 1, y - 1, x + w, y + hgt, WALL.line);
  }

  // Every parked car, painted from its frame of the car sheet (the colour per car from ediParkedColour), nearest first-drawn at the back.
  function drawParkedCars(img, stage, stageIndex, frames) {
    const { ediCarFrame } = loadEdiData();
    const cars = stage.obstacles.filter((o) => o.kind === 'car').map((o, i) => ({ o, colour: ediParkedColour(stageIndex, i) }));
    cars.sort((m, n) => m.o.y - n.o.y);
    for (const { o, colour } of cars) {
      const frame = ediCarFrame(o.angle || 0);
      img.blit(frames[colour][frame], Math.round(o.x + o.w / 2 - CELL / 2), Math.round(o.y + o.h / 2 - CELL / 2));
    }
  }

  // The sheet's frames as cells, per colour name: { green: [8 Imgs], ... }
  function carFrameSet() {
    const set = {};
    for (const name of EDI_CAR_ROWS) set[name] = buildCarFrames(name);
    return set;
  }

  // edi-bg-1..3.png: 960 x 540, one garage per stage, drawn from the stage's own data.
  function buildEdiBg(stageIndex, frames = carFrameSet()) {
    const { EDI_STAGES, EDI_W, EDI_H, ediCarFrame } = loadEdiData();
    const stage = EDI_STAGES[stageIndex];
    const img = new Img(EDI_W, EDI_H);
    drawFloor(img, stageIndex);
    for (const lane of EDI_LANES[stageIndex]) dashedLine(img, lane[0], lane[1], lane[2], lane[3], 22, 18, 3, '#f4f1ea', 0.75, lane[4]);
    for (const o of stage.obstacles) { // a slot line set for every parked car
      if (o.kind === 'car') drawSlot(img, o.x + o.w / 2, o.y + o.h / 2, o.angle || 0);
    }
    drawBay(img, stage.bay);
    for (const a of stage.arrows || []) paintArrow(img, a.x, a.y, a.angle, stageIndex === 2 && a.angle === Math.PI ? 56 : 44, 0.85);
    // walls and pillars: the long ones first so the pillars stand on top of them
    for (const o of stage.obstacles.filter((q) => q.kind === 'wall')) drawBlock(img, o, false);
    for (const o of stage.obstacles.filter((q) => q.kind === 'pillar')) drawBlock(img, o, true);
    drawParkedCars(img, stage, stageIndex, frames);
    // ceiling lamps (light strips on the top wall's face) and the P sign over the target bay
    for (const lx of [120, 360, 600, 840]) { img.rect(lx - 22, 23, lx + 22, 26, '#fff6c8'); img.rect(lx - 22, 27, lx + 22, 27, '#d9c98a'); }
    const sx = Math.round(stage.bay.x + stage.bay.w / 2);
    drawSign(img, sx - 11, 4, 22, 20);
    h.drawPixelText(img, 'P', sx - 5, 8, '#ffffff', 2, null);
    if (stageIndex === 2) { // the one-way sign on the hanging wall: a white arrow on blue, pointing the way of the painted arrow (west)
      drawSign(img, 364, 104, 24, 16);
      h.fillTri(img, [368, 112], [376, 106], [376, 118], '#ffffff');
      img.rect(376, 110, 384, 113, '#ffffff');
    }
    return img;
  }


  // ---------- the small sprites ----------
  const K = '#1a1c2c'; // the project's outline

  function drawBumpSpark() { // a cartoon crash star: yellow, a pale core and a white centre
    const img = new Img(25, 25);
    const star = (r1, r2, hexColour) => {
      const pts = [];
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8 - Math.PI / 2;
        const r = i % 2 ? r2 : r1;
        pts.push([12 + Math.cos(a) * r, 12 + Math.sin(a) * r]);
      }
      h.fillPoly(img, pts, hexColour);
    };
    star(12, 6, '#ff8a1c');
    star(10, 5, '#ffd23f');
    star(6, 3, '#fff3b0');
    img.ellipse(12, 12, 2, 2, '#ffffff');
    return img;
  }

  function drawStarsPuff() { // a little dust cloud with three stars circling above it (the car's wobble after a bump)
    const img = new Img(26, 22);
    img.ellipse(8, 16, 5, 4, '#f4f1ea');
    img.ellipse(14, 15, 6, 5, '#f4f1ea');
    img.ellipse(19, 16, 4, 3, '#f4f1ea');
    img.ellipse(13, 13, 4, 4, '#ffffff');
    img.rect(5, 19, 22, 19, '#cfc8c0');
    const sparkle = new Img(7, 7);
    h.drawRows(sparkle, 0, 0, h.SPARKLE, { Y: '#ffd23f', W: '#ffffff' });
    for (const [x, y] of [[0, 3], [10, 0], [19, 4]]) img.blit(sparkle, x, y);
    return img;
  }

  function drawTick() { // a green round tick (parked)
    const img = new Img(20, 20);
    img.ellipse(10, 10, 9, 9, K);
    img.ellipse(10, 10, 8, 8, '#3fbf6e');
    img.ellipse(10, 8, 6, 4, '#6fdc96', 0.7);
    for (const [x, y] of [[5, 10], [6, 11], [7, 12], [8, 13], [9, 12], [10, 11], [11, 10], [12, 9], [13, 8], [14, 7]]) {
      img.rect(x, y, x + 1, y + 1, '#ffffff');
    }
    return img;
  }

  function drawStopTag() { // a stop-sign-ish tag for the near-park moment: a red octagon with a white rim and the word STOP
    const img = new Img(30, 30);
    const oct = (r, hexColour) => {
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        pts.push([15 + Math.cos(a) * r, 15 + Math.sin(a) * r]);
      }
      h.fillPoly(img, pts, hexColour);
    };
    oct(15.5, K);
    oct(14.5, '#ffffff');
    oct(12.5, '#e8465a');
    h.drawPixelText(img, 'STOP', 4, 12, '#ffffff', 1, null);
    return img;
  }

  function drawDust() { // a small grey puff (the brake)
    const img = new Img(12, 8);
    img.ellipse(4, 4, 3, 3, '#dcd8d2');
    img.ellipse(8, 4, 3, 3, '#dcd8d2');
    img.ellipse(6, 3, 3, 3, '#f4f1ea');
    return img;
  }

  // edi-sprites.png: 8 cells of 32 x 32 (frame order = EDI_SPRITE_FRAME): heart full, heart empty, bump spark, stars puff, green tick,
  // STOP tag, brake dust, sparkle. Each sprite is centred in its cell.
  function buildEdiSprites() {
    const sheet = new Img(256, 32);
    const sparkle = new Img(7, 7);
    h.drawRows(sparkle, 0, 0, h.SPARKLE, { Y: '#ffd23f', W: '#ffffff' });
    [h.heroUiHeart(true), h.heroUiHeart(false), drawBumpSpark(), drawStarsPuff(), drawTick(), drawStopTag(), drawDust(), sparkle].forEach((sprite, i) => {
      sheet.blit(sprite, i * 32 + Math.floor((32 - sprite.w) / 2), Math.floor((32 - sprite.h) / 2));
    });
    return sheet;
  }

  // ---------- the instructor's portrait ----------
  // The head of the project's own short-haired student sheet (assets/npc-student-a.png, 16 x 24 frames): its head and shoulders (16 x 16
  // pixels) are redressed pixel by pixel (dark hair at the sides, a green driving-school cap, brows, a moustache, a white polo with a
  // green collar) and blown up 3x to 48 x 48. Two frames side by side (96 x 48): 0 = worried but kind, 1 = wincing (eyes shut, a sweat drop).
  const SKIN = '#ffcbb0';
  const SKIN_SHADE = '#eab49a';
  const HAIR = '#2d2a3e';
  const POLO_MAP = { '28408f': '#dfe5ee', '3b5dc9': '#ffffff', '5f86e6': '#f1f4f9' };

  function instructorHead(student, frame) {
    const nat = new Img(16, 16);
    for (let y = 0; y < 16; y++) { // rows 2..17 of the front-facing frame
      for (let x = 0; x < 16; x++) {
        const i = ((y + 2) * student.width + x) * 4;
        if (!student.data[i + 3]) continue;
        const key = [0, 1, 2].map((c) => student.data[i + c].toString(16).padStart(2, '0')).join('');
        if (y >= 13) nat.px(x, y, POLO_MAP[key] || `#${key}`); // the shirt
        else if (y <= 6) nat.px(x, y, '#46465e'); // the hair block: the cap goes over it
        else if (key === '3a3a50' || key === '46465e') nat.px(x, y, `#${key}`); // outline
        else nat.px(x, y, key === 'f6ae9f' || key === 'e19b9b' ? '#f3b6a0' : SKIN); // the face: forehead, cheeks, chin
      }
    }
    // the cap: a green crown with a white stripe and a badge, a darker peak
    for (let y = 0; y <= 4; y++) for (let x = 2; x <= 13; x++) if (!(y === 0 && (x < 4 || x > 11))) nat.px(x, y, '#2f9d62');
    for (let x = 2; x <= 13; x++) nat.px(x, 3, '#f4f1ea');
    nat.px(7, 1, '#ffffff'); nat.px(8, 1, '#ffffff'); nat.px(7, 2, '#ffffff'); nat.px(8, 2, '#2f9d62');
    for (let x = 1; x <= 14; x++) { nat.px(x, 5, '#23774a'); nat.px(x, 6, x === 1 || x === 14 ? K : '#58b07a'); }
    for (let x = 4; x <= 11; x++) nat.px(x, 6, '#23774a');
    nat.px(1, 5, K); nat.px(14, 5, K);
    // dark hair showing under the cap at the sides
    for (let y = 7; y <= 10; y++) { nat.px(2, y, HAIR); nat.px(13, y, HAIR); }
    // eyes (open: a dark pupil with a white corner; wincing: shut, a dark line)
    for (const x of [5, 10]) {
      const inner = x < 8 ? 1 : -1;
      if (frame === 0) {
        nat.px(x, 10, K); nat.px(x, 11, K);
        nat.px(x - inner, 10, '#ffffff'); // a small glint on the outer side
      } else {
        nat.px(x - 1, 10, K); nat.px(x, 10, K); nat.px(x + 1, 10, K); nat.px(x - 1, 11, SKIN_SHADE); nat.px(x + 1, 11, SKIN_SHADE); // shut, with a scrunched cheek
      }
    }
    // worried brows: the inner ends are up
    for (const [x, y] of [[4, 8], [5, 8], [6, 7], [11, 8], [10, 8], [9, 7]]) nat.px(x, y, HAIR);
    if (frame === 1) { nat.px(7, 7, HAIR); nat.px(8, 7, HAIR); }
    nat.px(7, 11, SKIN_SHADE); nat.px(8, 11, SKIN_SHADE); // the nose
    // the moustache (it wobbles when he winces)
    for (let x = 4; x <= 11; x++) nat.px(x, 12, HAIR);
    if (frame === 0) { nat.px(3, 12, HAIR); nat.px(12, 12, HAIR); } else { nat.px(5, 12, '#f3b6a0'); nat.px(10, 12, '#f3b6a0'); nat.px(4, 13, HAIR); nat.px(11, 13, HAIR); }
    // the polo's green collar
    for (const [x, y] of [[5, 13], [6, 13], [9, 13], [10, 13], [6, 14], [7, 14], [8, 14], [9, 14]]) nat.px(x, y, '#2f9d62');
    nat.px(7, 15, '#e8f6ee'); nat.px(8, 15, '#e8f6ee');
    return h.scaleImg(nat, 3);
  }

  function buildEdiInstructor() {
    const student = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'npc-student-a.png')));
    const out = new Img(96, 48);
    for (let f = 0; f < 2; f++) {
      const img = instructorHead(student, f);
      if (f === 1) { // a sweat drop at the temple
        h.fillTri(img, [42, 15], [39, 21], [45, 21], '#7fd0f0');
        img.ellipse(42, 22, 3, 2, '#7fd0f0');
        img.rect(41, 20, 42, 21, '#ffffff');
      }
      out.blit(img, f * 48, 0);
    }
    return out;
  }


  // ---------- the cover ----------
  // edi-cover.png: 480 x 270 (half scale, stretched 2x like hero-cover.png), behind the intro card (which covers cover y >= 175): a title
  // ribbon, a checkered stripe, a garage floor with lane lines, the learner car (3x, an "L" on the roof), the instructor in a speech
  // bubble (his portrait, "SLOWLY PLEASE"), a hazard-striped pillar and a P sign. Generic lettering only, no real logo.
  function buildEdiCover(frames = carFrameSet()) {
    const w = 480;
    const hgt = 270;
    const img = new Img(w, hgt);
    const floorTop = 82;
    // the floor: concrete slabs, bay lines along the back, a dashed lane line, a painted arrow, a warm lamp glow
    img.rect(0, 0, w - 1, hgt - 1, '#a2a8ba');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) if ((c + r) % 2) img.rect(c * 96, floorTop + r * 60, c * 96 + 95, floorTop + r * 60 + 59, '#9ba1b3');
    for (let x = 0; x < w; x += 96) img.rect(x, floorTop, x, hgt - 1, '#9ea5b6', 0.55);
    for (let y = floorTop; y < hgt; y += 60) img.rect(0, y, w - 1, y, '#9ea5b6', 0.55);
    for (let yy = -120; yy <= 120; yy++) {
      for (let xx = -200; xx <= 200; xx++) {
        const d = Math.hypot(xx / 200, yy / 110);
        if (d < 1) img.px(250 + xx, 150 + yy, '#fff3c4', 0.22 * (1 - d) * (1 - d));
      }
    }
    for (let x = 60; x < 440; x += 52) { // a row of slot lines behind the title's checkered stripe
      img.rect(x, floorTop, x + 1, floorTop + 26, '#f4f1ea', 0.7);
    }
    img.rect(60, floorTop + 26, 60 + 52 * 7 + 1, floorTop + 27, '#f4f1ea', 0.35);
    dashedLine(img, 0, 176, w, 176, 16, 14, 2, '#f4f1ea', 0.7);
    paintArrow(img, 372, 164, 0, 56, 0.8);

    // a hazard-striped pillar at the left and the P sign on a post at the right
    drawBlock(img, { x: 14, y: 94, w: 26, h: 66 }, true);
    img.rect(436, 120, 439, 158, '#6d7390');
    img.outlineRect(435, 119, 440, 159, K);
    drawSign(img, 420, 92, 36, 34);
    h.drawPixelText(img, 'P', 429, 100, '#ffffff', 3, null);

    // the learner car, big (3x), parked at an angle of its own: the pack's side view with the green-and-white paint
    const car = h.scaleImg(frames.learner[0], 3);
    img.blit(car, 74, 46);
    // the instructor in a speech bubble that points at the car's window
    const bx0 = 262;
    const by0 = 92;
    const bx1 = 408;
    const by1 = 158;
    fillRoundRect(img, bx0 - 1, by0 - 1, bx1 + 1, by1 + 1, K);
    fillRoundRect(img, bx0, by0, bx1, by1, '#ffffff');
    h.fillTri(img, [bx0 + 2, by0 + 40], [bx0 + 2, by0 + 56], [bx0 - 26, by0 + 66], K);
    h.fillTri(img, [bx0 + 3, by0 + 43], [bx0 + 3, by0 + 54], [bx0 - 20, by0 + 62], '#ffffff');
    const face = buildEdiInstructor();
    const frame = new Img(48, 48);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { // frame 1: the wince
      const i = (y * face.w + 48 + x) * 4;
      if (face.data[i + 3]) frame.pxA(x, y, face.data[i], face.data[i + 1], face.data[i + 2], 255);
    }
    img.blit(frame, bx0 + 8, by0 + 9);
    h.drawPixelText(img, 'SLOWLY', bx0 + 64, by0 + 14, '#2b2e44', 2, null);
    h.drawPixelText(img, 'PLEASE', bx0 + 64, by0 + 36, '#2f9d62', 2, null);

    // the title ribbon: dark green with white and light-green lines, then a checkered stripe
    const bx = 56;
    const bX1 = 424;
    const by = 6;
    const bY1 = 72;
    h.fillTri(img, [bx - 22, by + 10], [bx - 22, bY1 + 4], [bx + 2, bY1 - 6], '#14452d');
    h.fillTri(img, [bX1 + 22, by + 10], [bX1 + 22, bY1 + 4], [bX1 - 2, bY1 - 6], '#14452d');
    img.rect(bx - 22, by + 10, bx + 2, bY1 + 4, '#14452d');
    img.rect(bX1 - 2, by + 10, bX1 + 22, bY1 + 4, '#14452d');
    img.rect(bx, by, bX1, bY1, '#1f6b45');
    img.rect(bx, by, bX1, by + 1, '#58c98a'); img.rect(bx, bY1 - 1, bX1, bY1, '#58c98a');
    img.rect(bx, by + 2, bX1, by + 2, '#ffffff'); img.rect(bx, bY1 - 2, bX1, bY1 - 2, '#ffffff');
    img.rect(bx, by, bx + 1, bY1, '#58c98a'); img.rect(bX1 - 1, by, bX1, bY1, '#58c98a');
    img.outlineRect(bx - 1, by - 1, bX1 + 1, bY1 + 1, K);
    const title = 'EDI MADNESS';
    const sub = 'GARAGE PARKING';
    h.drawPixelText(img, title, Math.round((w - h.hvTextWidth(title, 5)) / 2), by + 8, '#ffffff', 5, '#0d2e1e');
    h.drawPixelText(img, sub, Math.round((w - h.hvTextWidth(sub, 2)) / 2), by + 47, '#bff0d4', 2, '#0d2e1e');
    for (let x = 0; x < w; x += 6) for (let y = 0; y < 2; y++) img.rect(x, 76 + y * 3, x + 5, 78 + y * 3, (x / 6 + y) % 2 ? '#1a1c2c' : '#ffffff');
    img.rect(0, 75, w - 1, 75, K); img.rect(0, 82, w - 1, 82, K);
    return img;
  }

  function fillRoundRect(img, x0, y0, x1, y1, hexColour) { // a rectangle with its corners cut
    img.rect(x0 + 3, y0, x1 - 3, y1, hexColour);
    img.rect(x0, y0 + 3, x1, y1 - 3, hexColour);
    img.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, hexColour);
  }

  return { buildEdiCars, buildCarFrames, cityCrop, buildEdiBg, carFrameSet, buildEdiSprites, buildEdiInstructor, buildEdiCover };
}
