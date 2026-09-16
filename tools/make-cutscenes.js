// Generates cutscene illustrations (Pokemon-style story beats, src/scenes/cutscene.js) as PNGs.
// Like tools/make-assets.js, everything is drawn in code — no photos are copied or referenced as
// image files, only as notes (see docs/research/bits-dubai-campus.md, "Main gate appearance").
// Run:  node tools/make-cutscenes.js   (also runs as part of `npm run assets`)
// Output: assets/cutscenes/gate2.png — 320x240, meant to be scaled up 3x by the game (960 wide) and
// panned vertically (960x720 scaled, 540 visible at a time) the way src/scenes/cutscene.js plays it.
//
// `--out <dir>` writes elsewhere (tests use this to check the file is up to date), matching the
// convention in tools/make-assets.js and tools/campus/build-campus.js.
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');

const W = 320;
const H = 240;

// Colors sampled/matched from tools/make-assets.js PALETTE and docs/STYLE_GUIDE.md, so the
// cutscene reads as the same world as the tile art (sand-beige walls, terracotta trim, brick
// paving, kerbs). Picked fresh here because this file draws a full scene, not a tileset.
const C = {
  outline: '#1a1c2c',
  skyDeep: '#3b8fe0', skyMid: '#6fb8f2', skyLight: '#bfe6ff', skyHaze: '#e9f6ff',
  sun: '#fff6cf',
  sand: '#e3cfa3', sandShade: '#cdb487', sandDeep: '#b89a68',
  wall: '#e6cba4', wallShade: '#cfae86', wallDeep: '#a98a63',
  trim: '#cf8a6c', trimDeep: '#9c5a44',
  roof: '#d9a88a', roofDeep: '#b9876c',
  sign: '#f5ead0', signText: '#5e2a20',
  asphalt: '#5b5d66', asphaltShade: '#4a4c54', laneLine: '#eadbb8',
  kerb: '#eadbb8', kerbShade: '#c9ae80',
  boothWall: '#e6cba4', boothRoof: '#8a3b2a', boothWindow: '#9fd3ff',
  barrierRed: '#d9463f', barrierWhite: '#f4f4f4', barrierPost: '#4a4a55',
  trunk: '#7a4a24', trunkDeep: '#5a3418',
  frond: '#4fa34a', frondLight: '#8fd46a', frondDeep: '#1f5227',
  shadow: '#000000',
};

class Img {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = Buffer.alloc(w * h * 4);
  }

  px(x, y, hex, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (alpha >= 1) {
      this.data[i] = parseInt(hex.slice(1, 3), 16);
      this.data[i + 1] = parseInt(hex.slice(3, 5), 16);
      this.data[i + 2] = parseInt(hex.slice(5, 7), 16);
      this.data[i + 3] = 255;
    } else {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this.data[i] = Math.round(this.data[i] * (1 - alpha) + r * alpha);
      this.data[i + 1] = Math.round(this.data[i + 1] * (1 - alpha) + g * alpha);
      this.data[i + 2] = Math.round(this.data[i + 2] * (1 - alpha) + b * alpha);
      this.data[i + 3] = 255;
    }
  }

  rect(x0, y0, x1, y1, hex) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, hex);
  }

  // 1px outline rectangle (style guide: characters/props/buildings get a #1a1c2c outline).
  outlineRect(x0, y0, x1, y1) {
    for (let x = x0; x <= x1; x++) {
      this.px(x, y0, C.outline);
      this.px(x, y1, C.outline);
    }
    for (let y = y0; y <= y1; y++) {
      this.px(x0, y, C.outline);
      this.px(x1, y, C.outline);
    }
  }

  ellipse(cx, cy, rx, ry, hex, alpha = 1) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, hex, alpha);
      }
    }
  }

  // Bresenham-ish thick line, used for the boom barrier arm.
  line(x0, y0, x1, y1, thickness, hex) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (dx * i) / steps;
      const y = y0 + (dy * i) / steps;
      for (let t = -thickness / 2; t <= thickness / 2; t++) this.px(x, y + t, hex);
    }
  }

  toPNG() {
    return encodePNG(this.w, this.h, this.data);
  }
}

// ---------- tiny 5x7 pixel font (uppercase + space only; original blocky glyphs, not a real font) ----------

const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

// Draws text (uppercase only) with each glyph pixel scaled up `scale` times, top-left at (x, y).
function drawText(img, text, x, y, hex, scale) {
  let cx = x;
  for (const ch of text) {
    const glyph = GLYPHS[ch] || GLYPHS[' '];
    glyph.forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === '#') img.rect(cx + rx * scale, y + ry * scale, cx + rx * scale + scale - 1, y + ry * scale + scale - 1, hex);
      });
    });
    cx += (5 + 1) * scale;
  }
  return cx - scale; // right edge of the last glyph
}

function textWidth(text, scale) {
  return text.length * (5 + 1) * scale - scale;
}

// ---------- the scene ----------

const img = new Img(W, H);

// Sky: gradient bands, brightening toward the horizon (docs/research: "bright blue sky").
const HORIZON = 130;
for (let y = 0; y < HORIZON; y++) {
  const t = y / HORIZON;
  const hex = t < 0.35 ? C.skyDeep : t < 0.7 ? C.skyMid : t < 0.92 ? C.skyLight : C.skyHaze;
  img.rect(0, y, W - 1, y, hex);
}
img.ellipse(258, 30, 16, 16, C.sun, 0.5);
img.ellipse(258, 30, 10, 10, C.sun, 0.6);

// Ground: sand either side of the road, out to the horizon.
img.rect(0, HORIZON, W - 1, H - 1, C.sand);
for (let y = HORIZON; y < H; y += 5) img.rect(0, y, W - 1, y, C.sandShade); // faint banding, not a flat fill

// Road: a straight avenue leading in, drawn with a little forced perspective (narrower near the
// horizon), kerbed edges and a dashed centre line, matching the campus's own kerb/road tiles.
function roadHalfWidth(y) {
  const t = Math.max(0, Math.min(1, (y - HORIZON) / (H - HORIZON)));
  return 20 + t * 46; // 20px half-width at the horizon, 66px at the bottom edge
}
for (let y = HORIZON; y < H; y++) {
  const half = roadHalfWidth(y);
  const cx = W / 2;
  img.rect(cx - half, y, cx + half, y, C.asphalt);
  img.rect(cx - half, y, cx - half + 2, y, C.kerb);
  img.rect(cx + half - 2, y, cx + half, y, C.kerb);
  if (Math.floor(y / 6) % 2 === 0) img.rect(cx - 1, y, cx + 1, y, C.laneLine);
}

// ---------- palms framing the scene (foreground, bigger = closer, per the style guide) ----------

function palm(cx, groundY, scale) {
  const trunkH = 46 * scale;
  const trunkW = 5 * scale;
  // Trunk: a gentle S-curve out of tiled trunk segments, shaded ramp (wood).
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const lean = Math.sin(t * Math.PI * 0.6) * 6 * scale;
    const y0 = groundY - trunkH * t;
    img.rect(cx + lean - trunkW / 2, y0 - (trunkH / 10), cx + lean + trunkW / 2, y0, t > 0.6 ? C.trunkDeep : C.trunk);
  }
  const crownX = cx + Math.sin(0.6 * Math.PI * 0.6) * 6 * scale;
  const crownY = groundY - trunkH;
  // Fronds: radiating fat triangles (drawn as thick lines), a lighter top layer over a darker one.
  const fronds = [
    [-1, -0.3], [-0.7, -0.9], [-0.2, -1], [0.3, -0.95], [0.8, -0.7], [1, -0.2], [0.5, 0.15], [-0.5, 0.15],
  ];
  for (const [fx, fy] of fronds) {
    img.line(crownX, crownY, crownX + fx * 30 * scale, crownY + fy * 22 * scale, 5 * scale, C.frondDeep);
  }
  for (const [fx, fy] of fronds) {
    img.line(crownX, crownY, crownX + fx * 26 * scale, crownY + fy * 19 * scale, 3 * scale, C.frond);
  }
  img.ellipse(crownX, crownY - 2 * scale, 6 * scale, 4 * scale, C.frondLight);
  img.ellipse(cx, groundY + 2, 12 * scale, 3 * scale, C.shadow, 0.25);
}
palm(28, H - 6, 1.15);
palm(292, H - 6, 1.15);
palm(58, H - 46, 0.75);
palm(262, H - 46, 0.75);

// ---------- the gate itself: two sand-beige pillars, a terracotta-trimmed sign band, a booth and a barrier ----------

const PILLAR_TOP = 132;
const PILLAR_BOTTOM = 212;
const LEFT = { x0: 70, x1: 100 };
const RIGHT = { x0: 218, x1: 248 };

function pillar(p) {
  img.rect(p.x0, PILLAR_TOP, p.x1, PILLAR_BOTTOM, C.wall);
  // Panel line + base course (dark), per the bitsWall tile's look.
  for (let y = PILLAR_TOP + 6; y < PILLAR_BOTTOM; y += 14) img.rect(p.x0 + 3, y, p.x1 - 3, y, C.wallShade);
  img.rect(p.x0, PILLAR_BOTTOM - 8, p.x1, PILLAR_BOTTOM, C.wallDeep);
  // Terracotta cap.
  img.rect(p.x0 - 2, PILLAR_TOP - 6, p.x1 + 2, PILLAR_TOP + 2, C.trim);
  img.rect(p.x0 - 2, PILLAR_TOP - 6, p.x1 + 2, PILLAR_TOP - 4, C.roof);
  img.outlineRect(p.x0, PILLAR_TOP - 6, p.x1, PILLAR_BOTTOM);
  img.ellipse((p.x0 + p.x1) / 2, PILLAR_BOTTOM + 3, (p.x1 - p.x0) / 2 + 3, 4, C.shadow, 0.25);
}
pillar(LEFT);
pillar(RIGHT);

// Sign band spanning both pillars, with the two-line lettering (docs/research: "BITS PILANI, Dubai
// Campus" lettering on the real Main Block entrance; reused here for the gate sign).
const SIGN = { x0: LEFT.x0 - 6, x1: RIGHT.x1 + 6, y0: 96, y1: 134 };
img.rect(SIGN.x0, SIGN.y0, SIGN.x1, SIGN.y1, C.trim);
img.rect(SIGN.x0, SIGN.y0, SIGN.x1, SIGN.y0 + 4, C.roof);
img.rect(SIGN.x0 + 6, SIGN.y0 + 8, SIGN.x1 - 6, SIGN.y1 - 6, C.sign);
img.outlineRect(SIGN.x0, SIGN.y0, SIGN.x1, SIGN.y1);
{
  const scale = 2;
  const line1 = 'BITS PILANI';
  const line2 = 'DUBAI CAMPUS';
  const cx = (SIGN.x0 + SIGN.x1) / 2;
  drawText(img, line1, cx - textWidth(line1, scale) / 2, SIGN.y0 + 11, C.signText, scale);
  drawText(img, line2, cx - textWidth(line2, scale) / 2, SIGN.y0 + 20, C.signText, scale);
}

// Guard booth beside the right pillar.
const BOOTH = { x0: RIGHT.x1 + 10, x1: RIGHT.x1 + 34, y0: 166, y1: 210 };
img.rect(BOOTH.x0, BOOTH.y0, BOOTH.x1, BOOTH.y1, C.boothWall);
img.rect(BOOTH.x0 - 2, BOOTH.y0 - 6, BOOTH.x1 + 2, BOOTH.y0, C.boothRoof);
img.rect(BOOTH.x0 + 5, BOOTH.y0 + 6, BOOTH.x1 - 5, BOOTH.y0 + 18, C.boothWindow);
img.rect(BOOTH.x0, BOOTH.y1 - 6, BOOTH.x1, BOOTH.y1, C.wallDeep);
img.outlineRect(BOOTH.x0, BOOTH.y0 - 6, BOOTH.x1, BOOTH.y1);
img.ellipse((BOOTH.x0 + BOOTH.x1) / 2, BOOTH.y1 + 3, (BOOTH.x1 - BOOTH.x0) / 2 + 2, 3, C.shadow, 0.25);

// Boom barrier, raised (welcoming you in): a red/white striped arm pivoting from a short post
// beside the left pillar, angled up and over the road.
const POST = { x: LEFT.x1 + 8, y: 196 };
img.rect(POST.x - 2, POST.y, POST.x + 2, PILLAR_BOTTOM - 4, C.barrierPost);
{
  const armLen = 66;
  const angle = -1.45; // radians, near-vertical: raised clear of the road, welcoming you in
  const ex = POST.x + Math.cos(angle) * armLen;
  const ey = POST.y + Math.sin(angle) * armLen;
  img.line(POST.x, POST.y - 4, ex, ey, 6, C.barrierWhite);
  const stripes = 5;
  for (let i = 0; i < stripes; i += 2) {
    const t0 = i / stripes;
    const t1 = (i + 1) / stripes;
    img.line(
      POST.x + (ex - POST.x) * t0, POST.y - 4 + (ey - (POST.y - 4)) * t0,
      POST.x + (ex - POST.x) * t1, POST.y - 4 + (ey - (POST.y - 4)) * t1,
      6, C.barrierRed,
    );
  }
}

// ---------- write the file ----------

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets', 'cutscenes');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'gate2.png'), img.toPNG());
console.log(`Wrote ${W}x${H} gate2.png to ${path.relative(path.join(__dirname, '..'), outDir)}/`);
