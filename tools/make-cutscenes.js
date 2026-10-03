// Generates the game's illustrated (non-tile) art as PNGs: full-screen story cutscenes
// (Pokemon-style beats, src/scenes/cutscene.js) plus the M3a opening's own small art (the bus, the
// title screen's parallax foreground) -- all drawn in code, like tools/make-assets.js. No photos are
// copied or referenced as image files, only as notes (see docs/research/bits-dubai-campus.md, "Main
// gate appearance"). Quality loop (Cutscenes run 1, 2026-09-29): Mustafa's own separate portrait
// (mustafa.png) is gone -- the greeting now shows him as a real, idle-animated 'npc-mustafa' sprite
// (tools/make-assets.js buildCharacter(), assets/npc-mustafa.png) standing on the live campus
// backdrop, the same character/texture the in-world script (src/scripts.js) spawns him as later, so
// there's one Mustafa, not two mismatched pieces of art.
// Run:  node tools/make-cutscenes.js   (also runs as part of `npm run assets`)
// Output, all in assets/cutscenes/:
//   gate2.png      320x240, the Gate 2 welcome cutscene (unchanged)
//   entrance.png   320x240, the Main Block entrance cutscene (M3a): steps, pillars, the glass front
//                  under the red arch, close up -- triggered the first time she reaches the door
//                  (tools/campus/build-campus.js section 17, src/cutscenes.js)
//   rta-bus-sheet.png  520x48, five 104x48 frames of an RTA (Dubai) city bus in a 3/4 raised side view
//                  (closed, halfOpen, open, closing, driving) for the opening's bus arrival and its door
//                  animation (ADR 0016 SCRIPTS.opening) -- see buildBusFrame()'s own header.
//   title-fg.png   480x64, a tileable silhouette strip (palms + fence) scrolled for the title
//                  screen's parallax foreground (docs/GAME_FEEL.md "a little 3D")
// Full-screen cutscenes are meant to be scaled up 3x by the game (960 wide) and panned vertically
// (960x720 scaled, 540 visible at a time) the way src/scenes/cutscene.js plays it; the smaller M3a
// art is used at its own native size (see the intro scenes, src/scenes/intro-*.js).
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
  sign: '#f5ead0', signText: '#5e2a20', signTextShadow: '#fff8ea',
  asphalt: '#5b5d66', asphaltShade: '#4a4c54', laneLine: '#eadbb8',
  kerb: '#eadbb8', kerbShade: '#c9ae80',
  boothWall: '#e6cba4', boothRoof: '#8a3b2a', boothWindow: '#9fd3ff',
  barrierRed: '#d9463f', barrierWhite: '#f4f4f4', barrierPost: '#4a4a55',
  trunk: '#7a4a24', trunkDeep: '#5a3418',
  frond: '#4fa34a', frondLight: '#8fd46a', frondDeep: '#1f5227',
  lawn: '#5ab552', lawnShade: '#3d8a3f', hedge: '#2f7a3a', hedgeLight: '#4fa34a',
  glass: '#2f3a44', archRed: '#c0392b',
  emblem: '#ffd23f', emblemDeep: '#a8812a',
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
// `shadowHex`, if given, draws a 1px-down-right copy first (a lighter tone), so the dark text on
// top reads as embossed against the sign's cream background instead of blending into it.
function drawText(img, text, x, y, hex, scale, shadowHex) {
  const place = (px, py, color) => {
    let cx = px;
    for (const ch of text) {
      const glyph = GLYPHS[ch] || GLYPHS[' '];
      glyph.forEach((row, ry) => {
        [...row].forEach((bit, rx) => {
          if (bit === '#') img.rect(cx + rx * scale, py + ry * scale, cx + rx * scale + scale - 1, py + ry * scale + scale - 1, color);
        });
      });
      cx += (5 + 1) * scale;
    }
    return cx - scale; // right edge of the last glyph
  };
  if (shadowHex) place(x + 1, y + 1, shadowHex);
  return place(x, y, hex);
}

function textWidth(text, scale) {
  return text.length * (5 + 1) * scale - scale;
}

// A small generic crest (not a copy of the real BITS logo): a gold medallion with a dark ring and
// a pale centre, for the pillars.
function emblem(img, cx, cy, r) {
  img.ellipse(cx, cy, r + 1, r + 1, C.outline);
  img.ellipse(cx, cy, r, r, C.emblemDeep);
  img.ellipse(cx, cy, r - 2, r - 2, C.emblem);
  img.ellipse(cx, cy, r - 5, r - 5, C.sign);
}

// ---------- palms (module-scoped, not nested in one build function): both buildGate2() and
// buildEntrance() below draw palms with the exact same technique, `img` passed explicitly rather
// than closed over so either scene-building function can call it ----------

function palm(img, cx, groundY, scale) {
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

// ---------- the Gate 2 welcome scene (unchanged) ----------

function buildGate2() {
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

// ---------- the Main Block, in the distance behind the gate (docs/research "Look from photos"):
// sand-beige walls, terracotta cornice, small window rows, and a glass entrance under a red arch ----------

// NOTE: this whole silhouette has to fit in the narrow band that stays visible above the sign/gate
// in front of it (the sign band starts at y=84, see SIGN below) — a taller building would just be a
// building-shaped hole behind the sign. So it's compressed into one band: parapet, terracotta
// cornice, a red arch over the glass entrance (docs/research "Look from photos": "glass front under
// a red arch"), ordinary windows either side, then a base course sitting on the horizon.
{
  const B = { x0: 46, x1: 274, y0: 62, y1: 83 };
  const ecx = (B.x0 + B.x1) / 2;
  const archW = 74;
  img.rect(B.x0, B.y0, B.x1, B.y1, C.wall);
  img.rect(B.x0, B.y0, B.x1, B.y0 + 2, C.roofDeep); // parapet edge
  img.rect(B.x0, B.y0 + 2, B.x1, B.y0 + 6, C.trim); // terracotta cornice
  img.rect(ecx - archW / 2, B.y0 + 7, ecx + archW / 2, B.y0 + 11, C.archRed); // the red arch band
  img.rect(ecx - archW / 2 + 4, B.y0 + 12, ecx + archW / 2 - 4, B.y1 - 3, C.glass); // glass entrance beneath it
  for (let wx = B.x0 + 8; wx < ecx - archW / 2 - 8; wx += 16) img.rect(wx, B.y0 + 13, wx + 8, B.y1 - 4, C.glass); // ordinary windows, left
  for (let wx = ecx + archW / 2 + 8; wx < B.x1 - 8; wx += 16) img.rect(wx, B.y0 + 13, wx + 8, B.y1 - 4, C.glass); // ordinary windows, right
  img.rect(B.x0, B.y1 - 3, B.x1, B.y1, C.wallDeep); // base course, right on the horizon
  img.outlineRect(B.x0, B.y0, B.x1, B.y1);
}

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

// ---------- lawn strips and a hedge row along the road, so the gate doesn't sit in empty sand ----------

const LAWN_WIDTH = 18;
for (let y = HORIZON; y < H; y++) {
  const half = roadHalfWidth(y);
  const cx = W / 2;
  const tone = Math.floor(y / 8) % 2 === 0 ? C.lawn : C.lawnShade;
  img.rect(cx - half - 3 - LAWN_WIDTH, y, cx - half - 4, y, tone);
  img.rect(cx + half + 4, y, cx + half + 3 + LAWN_WIDTH, y, tone);
}
// a clipped hedge row on the lawn strip, right where the gate stands (a bright campus touch per
// docs/STYLE_GUIDE.md's "campus kit", not the bare desert the owner flagged).
for (let y = 148; y <= 214; y++) {
  const half = roadHalfWidth(y);
  const cx = W / 2;
  const tone = (y % 6) < 3 ? C.hedge : C.hedgeLight;
  img.rect(cx - half - 3 - LAWN_WIDTH, y, cx - half - 4, y, tone);
  img.rect(cx + half + 4, y, cx + half + 3 + LAWN_WIDTH, y, tone);
}

// ---------- palms framing a scene (foreground, bigger = closer, per the style guide) ----------
palm(img, 90, HORIZON + 6, 0.4); // furthest, just past the gate, for a sense of perspective
palm(img, 230, HORIZON + 6, 0.4);
palm(img, 58, H - 46, 0.75);
palm(img, 262, H - 46, 0.75);
palm(img, 28, H - 6, 1.15); // closest, foreground corners
palm(img, 292, H - 6, 1.15);

// ---------- the gate itself: two sand-beige pillars, a terracotta-trimmed sign band, a booth and a barrier ----------

const PILLAR_TOP = 138;
const PILLAR_BOTTOM = 212;
const LEFT = { x0: 70, x1: 100 };
const RIGHT = { x0: 218, x1: 248 };

function pillar(p) {
  const cx = (p.x0 + p.x1) / 2;
  img.rect(p.x0, PILLAR_TOP, p.x1, PILLAR_BOTTOM, C.wall);
  // Panel line + base course (dark), per the bitsWall tile's look.
  for (let y = PILLAR_TOP + 6; y < PILLAR_BOTTOM; y += 14) img.rect(p.x0 + 3, y, p.x1 - 3, y, C.wallShade);
  img.rect(p.x0, PILLAR_BOTTOM - 8, p.x1, PILLAR_BOTTOM, C.wallDeep);
  // A second, lower terracotta trim/cornice band partway down the shaft (in addition to the cap).
  img.rect(p.x0, PILLAR_TOP + 36, p.x1, PILLAR_TOP + 40, C.trim);
  // Terracotta cap.
  img.rect(p.x0 - 2, PILLAR_TOP - 6, p.x1 + 2, PILLAR_TOP + 2, C.trim);
  img.rect(p.x0 - 2, PILLAR_TOP - 6, p.x1 + 2, PILLAR_TOP - 4, C.roof);
  img.outlineRect(p.x0, PILLAR_TOP - 6, p.x1, PILLAR_BOTTOM);
  // A small generic crest (not the real BITS logo), between the cap and the lower trim band.
  emblem(img, cx, PILLAR_TOP + 18, 8);
  img.ellipse(cx, PILLAR_BOTTOM + 3, (p.x1 - p.x0) / 2 + 3, 4, C.shadow, 0.25); // ground shadow
}
pillar(LEFT);
pillar(RIGHT);

// Sign band spanning both pillars, with the two-line lettering (docs/research: "BITS PILANI, Dubai
// Campus" lettering on the real Main Block entrance; reused here for the gate sign). Each line
// gets its own row, well clear of the other, in a sign band tall enough to hold both.
const SIGN = { x0: LEFT.x0 - 8, x1: RIGHT.x1 + 8, y0: 84, y1: PILLAR_TOP + 2 };
img.rect(SIGN.x0, SIGN.y0, SIGN.x1, SIGN.y1, C.trim);
img.rect(SIGN.x0, SIGN.y0, SIGN.x1, SIGN.y0 + 4, C.roof);
img.rect(SIGN.x0 + 6, SIGN.y0 + 8, SIGN.x1 - 6, SIGN.y1 - 6, C.sign);
img.outlineRect(SIGN.x0, SIGN.y0, SIGN.x1, SIGN.y1);
{
  const scale = 2;
  const lineH = 7 * scale; // one glyph row's pixel height at this scale
  const gap = 4; // px between the two lines, comfortably more than the requested 2px minimum
  const line1 = 'BITS PILANI';
  const line2 = 'DUBAI CAMPUS';
  const innerTop = SIGN.y0 + 8;
  const innerBottom = SIGN.y1 - 6;
  const blockH = lineH * 2 + gap;
  const y1 = innerTop + Math.max(0, Math.round((innerBottom - innerTop - blockH) / 2));
  const y2 = y1 + lineH + gap;
  const cx = (SIGN.x0 + SIGN.x1) / 2;
  drawText(img, line1, cx - textWidth(line1, scale) / 2, y1, C.signText, scale, C.signTextShadow);
  drawText(img, line2, cx - textWidth(line2, scale) / 2, y2, C.signText, scale, C.signTextShadow);
}

// Guard booth beside the right pillar.
const BOOTH = { x0: RIGHT.x1 + 10, x1: RIGHT.x1 + 34, y0: 166, y1: 210 };
img.rect(BOOTH.x0, BOOTH.y0, BOOTH.x1, BOOTH.y1, C.boothWall);
img.rect(BOOTH.x0 - 2, BOOTH.y0 - 6, BOOTH.x1 + 2, BOOTH.y0, C.boothRoof);
img.rect(BOOTH.x0 + 5, BOOTH.y0 + 6, BOOTH.x1 - 5, BOOTH.y0 + 18, C.boothWindow);
img.rect(BOOTH.x0, BOOTH.y1 - 6, BOOTH.x1, BOOTH.y1, C.wallDeep);
img.outlineRect(BOOTH.x0, BOOTH.y0 - 6, BOOTH.x1, BOOTH.y1);
img.ellipse((BOOTH.x0 + BOOTH.x1) / 2, BOOTH.y1 + 3, (BOOTH.x1 - BOOTH.x0) / 2 + 2, 3, C.shadow, 0.25);

// Boom barrier, raised (welcoming you in): a red/white striped arm attached to a short post right
// beside the booth (where the attendant would operate it), raised at 45 degrees up and over the
// road rather than floating in mid-air.
const POST = { x: BOOTH.x0 - 6, y: PILLAR_BOTTOM - 16 };
img.rect(POST.x - 2, POST.y, POST.x + 2, PILLAR_BOTTOM - 4, C.barrierPost);
img.ellipse(POST.x, PILLAR_BOTTOM - 2, 4, 3, C.shadow, 0.25);
{
  const armLen = 92;
  const angle = -Math.PI * 0.75; // 45 degrees up and to the left, swinging out over the road
  const pivotX = POST.x;
  const pivotY = POST.y - 3;
  const ex = pivotX + Math.cos(angle) * armLen;
  const ey = pivotY + Math.sin(angle) * armLen;
  img.line(pivotX, pivotY, ex, ey, 6, C.barrierWhite);
  const stripes = 6;
  for (let i = 0; i < stripes; i += 2) {
    const t0 = i / stripes;
    const t1 = (i + 1) / stripes;
    img.line(pivotX + (ex - pivotX) * t0, pivotY + (ey - pivotY) * t0, pivotX + (ex - pivotX) * t1, pivotY + (ey - pivotY) * t1, 6, C.barrierRed);
  }
  img.ellipse(pivotX, pivotY, 3, 3, C.barrierPost); // pivot housing
}

return img;
}

// ---------- the Main Block entrance scene (M3a, docs/STORY.md "Opening" step 5 / beat 3): a closer
// view than gate2 -- steps, pillars and the glass front under the red arch, per docs/research
// "Look": no road/gate furniture here, just the building she's about to walk into ----------

function buildEntrance() {
const img = new Img(W, H);
const HORIZON = 150;
for (let y = 0; y < HORIZON; y++) {
  const t = y / HORIZON;
  const hex = t < 0.35 ? C.skyDeep : t < 0.7 ? C.skyMid : t < 0.92 ? C.skyLight : C.skyHaze;
  img.rect(0, y, W - 1, y, hex);
}
img.ellipse(46, 26, 14, 14, C.sun, 0.5);
img.ellipse(46, 26, 9, 9, C.sun, 0.6);

// Ground: sand/paving apron in front of the steps, out to the horizon.
img.rect(0, HORIZON, W - 1, H - 1, C.sand);
for (let y = HORIZON; y < H; y += 5) img.rect(0, y, W - 1, y, C.sandShade);

// The facade: fills most of the frame, close up. Parapet, terracotta cornice, a tall red arch over
// the glass entrance, ordinary small windows either side, corner pillars, a short flight of steps
// with a little forced perspective (wider/closer at the bottom, same technique as gate2's road).
const B = { x0: 10, x1: W - 11, y0: 34, y1: 150 };
const ecx = (B.x0 + B.x1) / 2;
const archW = 108;
const archTop = B.y0 + 10;
img.rect(B.x0, B.y0, B.x1, B.y1, C.wall);
img.rect(B.x0, B.y0, B.x1, B.y0 + 4, C.roofDeep); // parapet edge
img.rect(B.x0, B.y0 + 4, B.x1, B.y0 + 12, C.trim); // terracotta cornice, thicker (we're closer)
// The red arch, drawn as a rounded top over the glass entrance beneath it.
for (let y = archTop; y < B.y1 - 6; y++) {
  const t = Math.max(0, (y - archTop) / 18);
  const half = archW / 2 + (t < 1 ? -(1 - t) * 10 : 0); // the arch narrows slightly near its crown
  img.rect(ecx - half, y, ecx + half, y, y < archTop + 18 ? C.archRed : C.trimDeep);
}
img.ellipse(ecx, archTop + 2, archW / 2 + 2, 10, C.archRed);
img.rect(ecx - archW / 2 + 8, archTop + 14, ecx + archW / 2 - 8, B.y1 - 8, C.glass); // the glass front
// A hint of reflection in the glass (a lighter diagonal band), and mullions dividing it into panes.
for (let px = Math.round(ecx - archW / 2) + 8 + 16; px < ecx + archW / 2 - 8; px += 16) {
  img.rect(px, archTop + 14, px + 1, B.y1 - 8, C.trimDeep);
}
img.rect(ecx - 40, archTop + 20, ecx - 10, archTop + 24, C.skyHaze, 0.25);
// Ordinary small windows, two rows, either side of the arch.
for (const wy of [B.y0 + 18, B.y0 + 40]) {
  for (let wx = B.x0 + 10; wx < ecx - archW / 2 - 10; wx += 18) img.rect(wx, wy, wx + 10, wy + 14, C.glass);
  for (let wx = ecx + archW / 2 + 10; wx < B.x1 - 10; wx += 18) img.rect(wx, wy, wx + 10, wy + 14, C.glass);
}
img.rect(B.x0, B.y1 - 6, B.x1, B.y1, C.wallDeep); // base course
img.outlineRect(B.x0, B.y0, B.x1, B.y1);
// Corner pillars framing the whole facade, and a small crest on each (reusing gate2's emblem()).
for (const px of [B.x0 - 8, B.x1 - 6]) {
  img.rect(px, B.y0 - 6, px + 14, B.y1 + 4, C.wall);
  img.outlineRect(px, B.y0 - 6, px + 14, B.y1 + 4);
  emblem(img, px + 7, B.y0 + 20, 5);
}

// Steps: 4 wide bands leading down from the door, each one lighter/closer than the last, in forced
// perspective (widening toward the bottom of the frame -- "a little 3D", docs/STORY.md "Look").
const STEP_COUNT = 4;
for (let i = 0; i < STEP_COUNT; i++) {
  const y0 = B.y1 + i * 12;
  const y1 = y0 + 11;
  const t = i / (STEP_COUNT - 1);
  const half = (ecx - B.x0) * 0.55 + t * 70; // widens with each step down (closer to camera)
  img.rect(ecx - half, y0, ecx + half, y1, i % 2 === 0 ? C.wall : C.wallShade);
  img.rect(ecx - half, y0, ecx + half, y0 + 2, C.sign); // a highlight along the step's top edge
  img.outlineRect(ecx - half, y0, ecx + half, y1);
}

// Palms flanking the steps, closer/bigger than gate2's (we're right at the building now).
palm(img, 24, H - 30, 1.0);
palm(img, W - 24, H - 30, 1.0);

return img;
}

// ---------- the arrival bus (docs/STORY.md "Amendments from the birthday sprint", ADR 0016 SCRIPTS.opening):
// an RTA (Dubai) city bus, drawn as a 3/4 "from slightly above" side view like Pokemon's vehicles ----------
// Birthday sprint, package D: the old art here was a hand-drawn top-down coach, which could not show a
// door opening and was not a Dubai bus. FB-0025 says to use packs for art, but no free pack has a Dubai
// bus (checked), so this is the one allowed hand-drawn exception. Reference only, never traced:
// docs/research/rta-bus-reference.md (livery colours, door layout, proportions, frame list) and the
// private photo it names (docs/research/rta-bus/, a Volvo B8R/Sunsundegui SB3 on route F15).
//
// Layout: a 104x48 frame (the 96x40 body plus a 4px margin all round, for the outline, the door swing and
// the ground shadow), one row of BUS_FRAME_NAMES.length frames in one sheet:
//   0 closed    doors shut, brake lights lit (the bus has just stopped)
//   1 halfOpen  the leaves parted by about half
//   2 open      the leaves folded into the frame: dark doorway, grab pole, low step
//   3 closing   between open and half open (its leaves a different width, so it reads as a new frame)
//   4 driving   doors shut, brake lights off, the wheel spokes turned (a plain frame for the drive in/out)
// The bus faces RIGHT (front at the right), its kerb side (the right-hand side, where Dubai buses have
// their doors) towards the camera: that is a bus travelling east, the way the Gate 2 road lets it (see
// src/scripts.js BUS_STEPS). Two doors, both animated together: the front one just behind the windscreen
// and the centre one, exactly on the frame's centre column (so a script can place the bus by its door).
// Palette: the doc's ten colours and nothing else, with the doc's #14131A as the 1px outline (the same
// "darker outline" rule as every other sprite here, docs/STYLE_GUIDE.md). The ground shadow is baked
// into the frame, under the body and never wider than it (the old bus had a shadow far wider than the
// bus), so the script runner draws no separate one (spawnActor `shadow: false`).
// The numbers below are mirrored in src/scripts.js RTA_BUS_SHEET (the sheet's dimensions and frame
// names); tests/unit/rta-bus.test.js fails if the two drift apart.
const BUS_FRAME_W = 104;
const BUS_FRAME_H = 48;
const BUS_FRAME_NAMES = ['closed', 'halfOpen', 'open', 'closing', 'driving'];
const BUS_PAL = {
  roof: '#E4E6EC', roofShade: '#C4C7D0',
  cream: '#EDE8E0', creamShade: '#B9B3AB',
  red: '#D3232A', redShade: '#8E2021',
  glass: '#2B2A30', glassHi: '#4A5160',
  black: '#14131A', rim: '#9AA0A8',
};
// Leaf width (px) of each door's two glass leaves per frame: the centre door's interior is 11px wide, the
// front door's 9px, so a leaf of width `a` leaves a dark gap of (width - 2a) between the leaves.
const BUS_DOOR_LEAF = {
  closed: { centre: 5, front: 4 },
  halfOpen: { centre: 3, front: 2 },
  open: { centre: 2, front: 1 },
  closing: { centre: 4, front: 3 },
  driving: { centre: 5, front: 4 },
};

function buildBusDoor(img, fx0, fx1, leaf) {
  const P = BUS_PAL;
  const ix0 = fx0 + 1;
  const ix1 = fx1 - 1;
  img.rect(fx0, 14, fx1, 37, P.roof); // the silver frame
  img.rect(ix0, 15, ix1, 36, P.black); // the dark doorway behind the leaves
  const gx0 = ix0 + leaf;
  const gx1 = ix1 - leaf;
  if (gx1 - gx0 + 1 >= 3) {
    img.rect(gx0, 35, gx1, 35, P.roofShade); // the low step
    img.rect(gx0, 36, gx1, 36, P.creamShade);
    img.rect(gx0 + 1, 17, gx0 + 1, 34, P.rim); // the grab pole
  }
  for (const [lx0, lx1] of [[ix0, ix0 + leaf - 1], [ix1 - leaf + 1, ix1]]) {
    img.rect(lx0, 15, lx1, 36, P.glass);
    img.rect(lx0, 15, lx1, 15, P.glassHi); // a lit top edge
    if (lx1 - lx0 >= 2) { img.px(lx0 + 1, 18, P.glassHi); img.px(lx0 + 1, 19, P.glassHi); img.px(lx0 + 2, 17, P.glassHi); }
  }
}

function buildBusWheel(img, cx, cy, spin) {
  const P = BUS_PAL;
  for (let y = 30; y <= 38; y++) {
    for (let x = cx - 7; x <= cx + 7; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= 6.5 * 6.5) img.px(x, y, P.black); // the dark wheel arch
    }
  }
  for (let y = cy - 5; y <= cy + 5; y++) {
    for (let x = cx - 5; x <= cx + 5; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= 22) img.px(x, y, P.glass); // the tyre
      if (d2 <= 6) img.px(x, y, P.rim); // the rim
    }
  }
  img.px(cx - 3, cy - 3, P.glassHi);
  img.px(cx, cy, P.black);
  if (spin) { img.px(cx + 1, cy - 1, P.black); img.px(cx - 1, cy + 1, P.black); } else { img.px(cx - 1, cy - 1, P.black); img.px(cx + 1, cy + 1, P.black); }
}

function buildBusFrame(name) {
  const P = BUS_PAL;
  const img = new Img(BUS_FRAME_W, BUS_FRAME_H);
  const leaves = BUS_DOOR_LEAF[name];

  // The roof strip (a raised camera sees the top): rounded at the front and rear corners.
  const roofRows = { 5: [8, 93], 6: [6, 96], 7: [5, 98], 8: [5, 98], 9: [5, 98] };
  for (const [y, [x0, x1]] of Object.entries(roofRows)) img.rect(x0, Number(y), x1, Number(y), P.roof);
  img.rect(5, 10, 98, 10, P.roofShade);
  // The recessed roof hatch near the rear and the raised AC pods over the front half.
  img.rect(13, 6, 27, 8, P.roofShade);
  img.rect(14, 7, 26, 7, P.roof);
  for (const x of [52, 59, 66, 73]) {
    img.rect(x, 5, x + 5, 8, P.roofShade);
    img.rect(x + 1, 5, x + 4, 5, P.glassHi);
    img.rect(x + 1, 6, x + 4, 6, P.black); // the grille slot
  }

  // The side panel: cream, shaded along the bottom, and the dark window band above the belt line.
  img.rect(5, 11, 98, 36, P.cream);
  img.rect(5, 37, 98, 37, P.creamShade);
  img.rect(6, 38, 97, 38, P.creamShade);
  img.rect(6, 11, 91, 23, P.glass);
  for (const x of [16, 26, 36, 66, 75]) img.rect(x, 11, x, 23, P.glassHi); // the thin pane frames
  for (const x of [8, 18, 28, 38, 61, 68, 77]) { img.px(x + 2, 13, P.glassHi); img.px(x + 1, 14, P.glassHi); img.px(x, 15, P.glassHi); }

  // The RTA red swoosh: starts under the rear windows, sweeps down and forward to the red front bumper.
  for (let x = 9; x <= 90; x++) {
    const yc = 25 + Math.floor(((x - 9) * 8) / 82);
    img.rect(x, yc, x, yc + 2, P.red);
    img.px(x, yc + 3, P.redShade);
  }
  // A small red logo (a triangle) behind the centre door, below the swoosh.
  img.px(40, 33, P.red);
  img.rect(39, 34, 41, 34, P.red);
  img.rect(38, 35, 42, 35, P.red);

  // The tail light pair at the rear: lit while the bus is braking, dark while it drives.
  const braking = name !== 'driving';
  img.rect(5, 27, 6, 29, braking ? P.red : P.redShade);
  if (braking) img.px(5, 27, P.roof);

  // The front face: the big windscreen with its LED destination board, the black lower face with its
  // headlights and silver mark, and the red bumper.
  img.rect(91, 11, 91, 33, P.roof);
  img.rect(92, 11, 98, 24, P.glassHi);
  img.rect(92, 11, 98, 13, P.black);
  img.rect(93, 12, 95, 12, P.roof);
  img.px(97, 12, P.red);
  img.px(94, 17, P.roof); img.px(95, 16, P.roof); img.px(93, 18, P.roof);
  img.rect(92, 25, 98, 33, P.black);
  img.px(97, 31, P.roof); img.px(98, 31, P.roof);
  img.px(95, 29, P.rim);
  img.rect(91, 34, 98, 38, P.red);
  img.rect(92, 38, 97, 38, P.redShade);
  // The small route-number and destination board on the side, above the front door.
  img.rect(80, 11, 90, 13, P.black);
  img.rect(81, 12, 83, 12, P.roof);
  img.rect(85, 12, 87, 12, P.roof);
  img.px(89, 12, P.red);

  buildBusDoor(img, 46, 58, leaves.centre);
  buildBusDoor(img, 80, 90, leaves.front);
  const spin = name === 'driving';
  buildBusWheel(img, 22, 37, spin);
  buildBusWheel(img, 70, 37, spin);

  // The 1px outline: every empty pixel that touches the body.
  const solid = (x, y) => x >= 0 && y >= 0 && x < BUS_FRAME_W && y < BUS_FRAME_H && img.data[(y * BUS_FRAME_W + x) * 4 + 3] > 0;
  const outline = [];
  for (let y = 0; y < BUS_FRAME_H; y++) {
    for (let x = 0; x < BUS_FRAME_W; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) outline.push([x, y]);
    }
  }
  for (const [x, y] of outline) img.px(x, y, P.black);

  // The soft ground shadow, baked in: two translucent steps under the body, between x 9 and x 95, so it
  // never reaches past the body's own 4..99 span. Written straight into the alpha channel (Img.px would
  // make a translucent pixel opaque on a transparent canvas).
  for (let y = 40; y <= 44; y++) {
    for (let x = 8; x <= 96; x++) {
      if (solid(x, y) || img.data[(y * BUS_FRAME_W + x) * 4 + 3] > 0) continue;
      const d = ((x - 52) / 43) ** 2 + ((y - 42) / 2.3) ** 2;
      if (d > 1) continue;
      const i = (y * BUS_FRAME_W + x) * 4;
      img.data[i] = 0; img.data[i + 1] = 0; img.data[i + 2] = 0;
      img.data[i + 3] = d < 0.4 ? 77 : 38;
    }
  }
  return img;
}

// All frames in one row: frame i occupies x = i * BUS_FRAME_W. Phaser loads it as a spritesheet
// (frameWidth/frameHeight from src/scripts.js RTA_BUS_SHEET).
function buildBusSheet() {
  const sheet = new Img(BUS_FRAME_W * BUS_FRAME_NAMES.length, BUS_FRAME_H);
  BUS_FRAME_NAMES.forEach((name, i) => {
    const frame = buildBusFrame(name);
    for (let y = 0; y < BUS_FRAME_H; y++) {
      frame.data.copy(sheet.data, (y * sheet.w + i * BUS_FRAME_W) * 4, y * BUS_FRAME_W * 4, (y + 1) * BUS_FRAME_W * 4);
    }
  });
  return sheet;
}

// ---------- title screen parallax foreground (docs/GAME_FEEL.md "a little 3D"): a tileable
// silhouette strip (palms + a low fence), scrolled behind the title menu at its own speed, separate
// from the slower vertical pan of the gate illustration -- true multi-layer parallax, not one image
// panning on its own. ----------

function buildTitleForeground() {
const FW = 480;
const FH = 64;
const img = new Img(FW, FH);
const silhouette = '#0f1018';
// A low fence/hedge line along the bottom.
img.rect(0, FH - 10, FW - 1, FH - 1, silhouette);
for (let x = 0; x < FW; x += 16) img.rect(x, FH - 16, x + 2, FH - 10, silhouette);
// Palm silhouettes, evenly spaced so the strip tiles seamlessly (first and last are half-width
// copies of each other across the seam).
const spacing = 80;
for (let cx = spacing / 2; cx < FW; cx += spacing) {
  const groundY = FH - 8;
  const trunkH = 40;
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const lean = Math.sin(t * Math.PI * 0.5) * 5;
    img.rect(cx + lean - 2, groundY - trunkH * t - 5, cx + lean + 2, groundY - trunkH * t, silhouette);
  }
  const crownY = groundY - trunkH;
  const fronds = [[-1, -0.3], [-0.6, -0.9], [0, -1], [0.6, -0.85], [1, -0.3], [0.4, 0.1], [-0.4, 0.1]];
  for (const [fx, fy] of fronds) img.line(cx, crownY, cx + fx * 26, crownY + fy * 18, 4, silhouette);
}
return img;
}

// ---------- write the files ----------

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets', 'cutscenes');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, built) => fs.writeFileSync(path.join(outDir, name), built.toPNG());
write('gate2.png', buildGate2());
write('entrance.png', buildEntrance());
write('rta-bus-sheet.png', buildBusSheet());
write('title-fg.png', buildTitleForeground());
console.log(`Wrote gate2, entrance, rta-bus-sheet and title-fg to ${path.relative(path.join(__dirname, '..'), outDir)}/`);
