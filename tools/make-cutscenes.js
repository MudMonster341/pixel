// Generates the game's illustrated (non-tile) art as PNGs: full-screen story cutscenes
// (Pokemon-style beats, src/scenes/cutscene.js) plus the M3a opening's own small art (Mustafa's
// portrait, the bus, the title screen's parallax foreground) -- all drawn in code, like
// tools/make-assets.js. No photos are copied or referenced as image files, only as notes (see
// docs/research/bits-dubai-campus.md, "Main gate appearance").
// Run:  node tools/make-cutscenes.js   (also runs as part of `npm run assets`)
// Output, all in assets/cutscenes/:
//   gate2.png      320x240, the Gate 2 welcome cutscene (unchanged)
//   entrance.png   320x240, the Main Block entrance cutscene (M3a): steps, pillars, the glass front
//                  under the red arch, close up -- triggered the first time she reaches the door
//                  (tools/campus/build-campus.js section 17, src/cutscenes.js)
//   mustafa.png    96x128, a bust portrait of the friendly organiser who greets her (M3a step 1) --
//                  an original, generic young man, not a likeness of anyone
//   bus.png        96x48, the side-view coach for the arrival animation (M3a step 4/5)
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

// ---------- Mustafa's portrait (M3a step 1): a friendly, generic student organiser -- original art,
// not a likeness of anyone. Bust framing (head + shoulders), soft shading per docs/STYLE_GUIDE.md's
// "one light source, top-left" rule, shown beside the dialog box during his greeting. ----------

function buildPortrait() {
const PW = 96;
const PH = 128;
const img = new Img(PW, PH);
const P = {
  skin: '#f0bd8e', skinShade: '#cf9a68', skinDeep: '#a86f45',
  hair: '#3a2a1c', hairHi: '#5a4128',
  shirt: '#3b7dd8', shirtHi: '#6fa8f2', shirtShade: '#2a5aa8',
  collar: '#eadbb8',
  outline: '#1a1c2c',
};
const cx = PW / 2;

// Shoulders/shirt (drawn first, the head overlaps its top edge).
img.ellipse(cx, PH - 30, 42, 46, P.shirt);
img.ellipse(cx - 14, PH - 30, 30, 40, P.shirtHi, 0.5); // a soft highlight, upper-left (light source rule)
img.ellipse(cx + 16, PH - 22, 26, 36, P.shirtShade, 0.4);
// A simple open collar (a V of the plaster/cream trim color), friendly and casual.
img.rect(cx - 14, PH - 62, cx + 14, PH - 46, P.collar);
img.rect(cx - 6, PH - 62, cx + 6, PH - 40, P.shirt);

// Head (a rounded rectangle via a big ellipse), fair-medium skin.
const headCy = 56;
img.ellipse(cx, headCy, 30, 34, P.skin);
img.ellipse(cx - 10, headCy - 6, 18, 20, P.skinShade, 0.35); // gentle shading, lower-right of the highlight
img.ellipse(cx + 12, headCy + 10, 14, 14, P.skinDeep, 0.3);
// Ears.
img.ellipse(cx - 29, headCy + 4, 6, 8, P.skin);
img.ellipse(cx + 29, headCy + 4, 6, 8, P.skin);

// Hair: short and neat, a side parting, covering the top and sides of the head.
img.ellipse(cx, headCy - 20, 32, 22, P.hair);
img.rect(cx - 30, headCy - 24, cx + 30, headCy + 2, P.hair);
img.ellipse(cx - 8, headCy - 26, 14, 10, P.hairHi, 0.6); // a lift near the parting, top-left light
img.rect(cx - 30, headCy - 4, cx - 22, headCy + 14, P.hair); // a little more hair in front of the ears
img.rect(cx + 22, headCy - 4, cx + 30, headCy + 14, P.hair);

// Face: simple friendly features -- open eyes, eyebrows, a warm smile, per "generic young man".
const eyeY = headCy + 2;
for (const ex of [cx - 11, cx + 11]) {
  img.rect(ex - 4, eyeY - 6, ex + 4, eyeY - 5, P.outline); // eyebrow
  img.ellipse(ex, eyeY, 4, 5, '#ffffff');
  img.ellipse(ex, eyeY + 1, 2, 3, P.outline); // pupil
}
img.ellipse(cx, headCy + 8, 3, 4, P.skinDeep, 0.5); // nose shadow
img.rect(cx - 9, headCy + 18, cx + 9, headCy + 19, P.outline); // a simple smile line
img.ellipse(cx - 9, headCy + 17, 2, 2, P.outline);
img.ellipse(cx + 9, headCy + 17, 2, 2, P.outline); // smile corners turn up slightly

return img;
}

// ---------- the arrival bus (M3a step 4/5): a simple side-view coach, driven in from off-screen for
// the arrival animation (src/scenes/intro-bus.js drives its position; this is just the art) ----------

function buildBus() {
const BW = 96;
const BH = 48;
const img = new Img(BW, BH);
const C2 = {
  body: '#eadbb8', bodyShade: '#c9ae80',
  stripe: '#cf8a6c', stripeDeep: '#9c5a44',
  glass: '#2f3a44', glassHi: '#9fd3ff',
  wheel: '#1a1c2c', hub: '#c8c8c8',
  door: '#e6cba4', doorLine: '#a98a63',
  outline: '#1a1c2c',
};
// Body: a rounded box, cabin taller at the front (left) with a sloped nose, per a friendly coach shape.
img.rect(10, 8, BW - 6, BH - 14, C2.body);
img.rect(4, 16, 12, BH - 14, C2.body); // sloped nose
img.rect(10, 6, BW - 6, 9, C2.bodyShade); // roof shade band (light from top-left overall, but roof edge reads as shade)
img.rect(10, BH - 16, BW - 6, BH - 14, C2.bodyShade); // lower skirt shade
img.rect(6, 30, BW - 6, 34, C2.stripe); // a mid stripe, the campus trim color
img.rect(6, 33, BW - 6, 34, C2.stripeDeep);
// Windscreen + windshield strip along the top.
img.rect(6, 12, 16, 24, C2.glass);
img.ellipse(10, 16, 3, 2, C2.glassHi, 0.6);
for (let wx = 20; wx < BW - 14; wx += 12) img.rect(wx, 12, wx + 8, 24, C2.glass);
// The door: a distinct panel with a center split line (the "opens" line the game tweens over).
const doorX = BW - 26;
img.rect(doorX, 16, doorX + 16, BH - 16, C2.door);
img.rect(doorX + 7, 16, doorX + 9, BH - 16, C2.doorLine);
img.outlineRect(doorX, 16, doorX + 16, BH - 16);
img.rect(doorX + 2, 18, doorX + 14, 26, C2.glass); // a small door window
// Outline the whole silhouette last so panel seams don't get double-outlined oddly.
img.outlineRect(10, 6, BW - 6, BH - 14);
img.outlineRect(4, 16, 12, BH - 14);
// Wheels + hubs, and a soft ground shadow.
img.ellipse(BW * 0.28, BH - 6, 10, 3, '#000000', 0.25);
img.ellipse(BW * 0.78, BH - 6, 10, 3, '#000000', 0.25);
for (const wx of [BW * 0.28, BW * 0.78]) {
  img.ellipse(wx, BH - 13, 8, 8, C2.wheel);
  img.ellipse(wx, BH - 13, 3, 3, C2.hub);
}
return img;
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
write('mustafa.png', buildPortrait());
write('bus.png', buildBus());
write('title-fg.png', buildTitleForeground());
console.log(`Wrote gate2, entrance, mustafa, bus and title-fg to ${path.relative(path.join(__dirname, '..'), outDir)}/`);
