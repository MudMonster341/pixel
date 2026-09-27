// Art for the ending (docs/ROADMAP.md M3 "the reward box... the birthday card"): the reward-box
// sequence and the full-screen birthday card that follows it. Same technique as
// tools/make-cutscenes.js / tools/make-minigame-art.js -- a tiny Img/PNG writer, no dependencies.
// Run:  node tools/make-card-art.js   (also runs as part of `npm run assets`)
// Output, all in assets/cutscenes/ (the ending's own chrome, always committed -- this is NOT the
// owner's photos, which live in assets/card/ and are gitignored, see src/card.js):
//   card-box-base.png       64x40, the box's body (src/scenes/box-opening.js)
//   card-box-lid.png        64x22, the lid, rotated open by a tween around its own hinge edge
//   card-cake.png           56x40, a two-tier cake with 3 candles (src/scenes/card.js)
//   card-frame.png          220x160, a pixel picture frame with a transparent 200x140 window in the
//                            middle -- a photo (real or the placeholder below) is drawn behind it,
//                            this is drawn on top, punched-out center included
//   card-placeholder-photo.png   200x140, exactly the frame's window size -- shown in the photo
//                            slideshow whenever assets/card/photos/ doesn't have a real file for
//                            that slot yet (docs/STORY.md "the game runs with placeholders until
//                            [the owner supplies photos]")
//   card-heart.png           12x10, a small heart used for the card's floating decoration
//   card-cover.png           400x260, the closed card's front -- a bordered panel with a
//                            balloon/confetti motif; the actual "Happy Birthday" title is real
//                            Phaser text drawn over it (src/scenes/card.js), not baked into the PNG,
//                            so it can use the game's own font and the recipient's name
//   card-temp-1..5.png       200x140 each (same size as card-placeholder-photo.png), the temporary
//                            slideshow (entrance, foyer staircase, LUG stall, the three keys, the
//                            box) shown until the owner's own photos exist -- see src/card.js
//                            TEMP_CARD_SLIDES for the captions and the "real photos always win"
//                            fallback rule
//
// `--out <dir>` writes elsewhere (tests check the files are up to date), matching every other
// generator in tools/.
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');

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
      const a0 = this.data[i + 3] / 255;
      const a1 = alpha + a0 * (1 - alpha);
      this.data[i] = Math.round((this.data[i] * a0 * (1 - alpha) + r * alpha) / (a1 || 1));
      this.data[i + 1] = Math.round((this.data[i + 1] * a0 * (1 - alpha) + g * alpha) / (a1 || 1));
      this.data[i + 2] = Math.round((this.data[i + 2] * a0 * (1 - alpha) + b * alpha) / (a1 || 1));
      this.data[i + 3] = Math.round(a1 * 255);
    }
  }

  rect(x0, y0, x1, y1, hex, alpha = 1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, hex, alpha);
  }

  outlineRect(x0, y0, x1, y1, hex = C.outline) {
    for (let x = x0; x <= x1; x++) { this.px(x, y0, hex); this.px(x, y1, hex); }
    for (let y = y0; y <= y1; y++) { this.px(x0, y, hex); this.px(x1, y, hex); }
  }

  ellipse(cx, cy, rx, ry, hex, alpha = 1) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) this.px(cx + x, cy + y, hex, alpha);
      }
    }
  }

  // Punches a hole (fully transparent) in a rectangular region -- used for card-frame.png's window.
  clear(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * this.w + x) * 4;
        this.data[i] = 0; this.data[i + 1] = 0; this.data[i + 2] = 0; this.data[i + 3] = 0;
      }
    }
  }

  // A simple 4-point heart, used both for card-heart.png and the cover's confetti motif.
  heart(cx, cy, r, hex) {
    this.ellipse(cx - r * 0.55, cy - r * 0.3, r * 0.6, r * 0.55, hex);
    this.ellipse(cx + r * 0.55, cy - r * 0.3, r * 0.6, r * 0.55, hex);
    for (let y = 0; y <= r * 1.3; y++) {
      const t = y / (r * 1.3);
      const half = r * (1 - t) * 1.05;
      this.rect(cx - half, cy - r * 0.15 + y, cx + half, cy - r * 0.15 + y, hex);
    }
  }

  toPNG() {
    return encodePNG(this.w, this.h, this.data);
  }
}

// Palette pulled from docs/STYLE_GUIDE.md's existing ramps (Wood, Accent gold, Skin) plus the
// lead's own pink (player.png) so the ending reads as the same game, not a different art style.
const C = {
  outline: '#1a1c2c',
  wood: '#cf9a66', woodHi: '#e0b483', woodShade: '#b98150', woodDeep: '#7a4a24', woodDeepest: '#5a3418',
  gold: '#ffd23f', goldHi: '#fff1a8', goldDeep: '#a8812a',
  brass: '#e0b84f', brassDeep: '#a8812a',
  paper: '#f5ead0', paperShade: '#eadbb8', paperDeep: '#c9ae80',
  pink: '#ff6fb1', pinkDeep: '#d94b8f', pinkLight: '#ff9ecf',
  icing: '#fff8ea', icingShade: '#f4c9a0',
  cakeBody: '#e6cba4', cakeShade: '#cf8a6c',
  candle: '#9fd3ff', candleFlame: '#ffd23f',
  glow: '#fff1a8',
  ribbon: '#3b7dd8', ribbonDeep: '#2a5aa8',
  sky: '#bfe6ff', skyHaze: '#dff3ff',
  // Added for the temporary slideshow (below): entrance/foyer/stall/keys/box scenes reuse this same
  // ramp set rather than inventing a new palette per scene, so all 5 slides still read as "this game".
  stone: '#cbb98a', stoneShade: '#b39c68',
  wallBeige: '#f0e6cf', wallShade: '#c9b483',
  archRed: '#c1443b', archRedDeep: '#8a2a24',
  glass: '#8fd0e6', glassDeep: '#5aa0c0',
  clothDark: '#241d38', clothGlow: '#3a3260',
  silver: '#c7d0da', silverShade: '#98a3ae',
  bronze: '#c98a4b', bronzeShade: '#96602f',
};

// ---------- the reward box: base + lid drawn separately so the lid can hinge open in the scene ----------

function buildBoxBase() {
  const W = 64;
  const H = 40;
  const img = new Img(W, H);
  const x0 = 6, x1 = W - 7, y0 = 10, y1 = H - 3;
  img.rect(x0, y0, x1, y1, C.wood);
  for (let y = y0 + 4; y < y1; y += 8) img.rect(x0 + 2, y, x1 - 2, y + 1, C.woodShade); // plank lines
  img.rect(x0, y1 - 5, x1, y1, C.woodDeep); // base shade, light from top-left
  img.rect(x0, y0, x1, y0 + 3, C.woodHi);
  // Brass corner brackets (per the owner's video prompt: "brass corners").
  for (const cx of [x0, x1 - 5]) {
    img.rect(cx, y0, cx + 5, y0 + 5, C.brass);
    img.outlineRect(cx, y0, cx + 5, y0 + 5, C.brassDeep);
  }
  for (const cx of [x0, x1 - 5]) {
    img.rect(cx, y1 - 5, cx + 5, y1, C.brass);
    img.outlineRect(cx, y1 - 5, cx + 5, y1, C.brassDeep);
  }
  // A ribbon band down the front, matching the lid's own ribbon.
  const cx = (x0 + x1) / 2;
  img.rect(cx - 3, y0, cx + 3, y1, C.ribbon);
  img.rect(cx - 3, y0, cx, y1, C.ribbonDeep, 0.4);
  img.outlineRect(x0, y0, x1, y1);
  img.ellipse((x0 + x1) / 2, y1 + 3, (x1 - x0) / 2 + 2, 3, '#000000', 0.25); // ground shadow
  return img;
}

function buildBoxLid() {
  const W = 64;
  const H = 22;
  const img = new Img(W, H);
  // Drawn so the hinge edge (what the scene rotates around) is the BOTTOM row -- the lid sits on
  // top of the box and swings up/back from there, so origin (0.5, 1) in the scene lines up here.
  const x0 = 4, x1 = W - 5, y0 = 2, y1 = H - 2;
  img.rect(x0, y0, x1, y1, C.woodHi);
  img.rect(x0, y0, x1, y0 + 3, C.icing, 0.15);
  img.rect(x0, y1 - 4, x1, y1, C.woodShade);
  for (const cx of [x0, x1 - 5]) { img.rect(cx, y0, cx + 5, y0 + 4, C.brass); img.outlineRect(cx, y0, cx + 5, y0 + 4, C.brassDeep); }
  const cx = (x0 + x1) / 2;
  img.rect(cx - 3, y0, cx + 3, y1, C.ribbon);
  // A small bow on top, the sequence's one bit of whimsy on an otherwise plain lid.
  img.ellipse(cx - 5, y0 + 2, 5, 4, C.ribbon);
  img.ellipse(cx + 5, y0 + 2, 5, 4, C.ribbon);
  img.ellipse(cx, y0 + 2, 3, 3, C.ribbonDeep);
  img.outlineRect(x0, y0, x1, y1);
  return img;
}

// ---------- the birthday cake (card-cake.png): candle FLAMES are drawn live in the scene (a small
// flicker tween reads better animated), this is just the cake + candle sticks ----------

function buildCake() {
  const W = 56;
  const H = 40;
  const img = new Img(W, H);
  const baseY = H - 4;
  // Bottom tier.
  img.rect(4, baseY - 14, W - 5, baseY, C.cakeBody);
  img.rect(4, baseY - 14, W - 5, baseY - 11, C.icing); // icing drip band
  img.rect(4, baseY - 5, W - 5, baseY, C.cakeShade);
  img.outlineRect(4, baseY - 14, W - 5, baseY);
  // Top tier, narrower, centered.
  img.rect(12, baseY - 26, W - 13, baseY - 13, C.cakeBody);
  img.rect(12, baseY - 26, W - 13, baseY - 23, C.icing);
  img.rect(12, baseY - 18, W - 13, baseY - 13, C.cakeShade);
  img.outlineRect(12, baseY - 26, W - 13, baseY - 13);
  // Icing drips off the top tier's edge, a little playful detail.
  for (let x = 13; x < W - 13; x += 5) img.rect(x, baseY - 23, x + 2, baseY - 20, C.icing);
  // 3 candle sticks (flames added at runtime, src/scenes/card.js) -- their x/topY are documented
  // here so the scene can place flames exactly on top without guessing.
  const candleXs = [W / 2 - 10, W / 2, W / 2 + 10];
  for (const cx of candleXs) {
    img.rect(cx - 1, baseY - 34, cx + 1, baseY - 27, C.candle);
    img.outlineRect(cx - 1, baseY - 34, cx + 1, baseY - 27);
  }
  return img;
}

// Exposed so src/scenes/card.js's own comment can cite the exact spot without re-deriving it, and so
// a unit test can check the candle flames the scene draws line up with the art.
const CAKE_CANDLE_X = [56 / 2 - 10, 56 / 2, 56 / 2 + 10];
const CAKE_CANDLE_TOP_Y = 40 - 34;

// ---------- picture frame (card-frame.png): a pixel frame with a transparent window in the middle,
// drawn OVER a photo (real or placeholder) so the photo appears "in" a frame, pixel-style ----------

const FRAME_W = 220;
const FRAME_H = 160;
const FRAME_WINDOW = { x0: 10, y0: 10, x1: FRAME_W - 11, y1: FRAME_H - 11 }; // 200x140 inside

function buildFrame() {
  const img = new Img(FRAME_W, FRAME_H);
  img.rect(0, 0, FRAME_W - 1, FRAME_H - 1, C.paper);
  img.rect(0, 0, FRAME_W - 1, 4, C.icing, 0.5);
  img.rect(0, FRAME_H - 5, FRAME_W - 1, FRAME_H - 1, C.paperDeep);
  // A thin gold inner border right at the window's edge, a warm pixel-frame look.
  img.outlineRect(FRAME_WINDOW.x0 - 2, FRAME_WINDOW.y0 - 2, FRAME_WINDOW.x1 + 2, FRAME_WINDOW.y1 + 2, C.gold);
  img.outlineRect(FRAME_WINDOW.x0 - 1, FRAME_WINDOW.y0 - 1, FRAME_WINDOW.x1 + 1, FRAME_WINDOW.y1 + 1, C.outline);
  // Small corner hearts, a friendly touch, well clear of the window.
  img.heart(14, 14, 6, C.pink);
  img.heart(FRAME_W - 14, 14, 6, C.pink);
  img.heart(14, FRAME_H - 14, 6, C.pink);
  img.heart(FRAME_W - 14, FRAME_H - 14, 6, C.pink);
  img.outlineRect(0, 0, FRAME_W - 1, FRAME_H - 1);
  // Punch the window fully transparent last, so a photo drawn *behind* this texture in the scene
  // shows through cleanly with no frame-color halo around its edge.
  img.clear(FRAME_WINDOW.x0, FRAME_WINDOW.y0, FRAME_WINDOW.x1, FRAME_WINDOW.y1);
  return img;
}

// ---------- a tiny 5x7 font, just the letters "YOUR PHOTO HERE" needs (coordinator review,
// 2026-09-22: the placeholder photo must be obviously a placeholder, not just a pretty filler
// image) -- same glyph style as tools/make-cutscenes.js's own GLYPHS, but that file is a different
// generator with its own letters; duplicated here rather than shared, the same way each tools/make-
// *.js file already keeps its own Img class (see this file's header comment). ----------

const PLACEHOLDER_GLYPHS = {
  E: ['#####', '#....', '#....', '###..', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#..#.', '#...#', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

function placeholderText(img, text, x, y, hex, scale) {
  let cx = x;
  for (const ch of text) {
    const glyph = PLACEHOLDER_GLYPHS[ch] || PLACEHOLDER_GLYPHS[' '];
    glyph.forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === '#') img.rect(cx + rx * scale, y + ry * scale, cx + rx * scale + scale - 1, y + ry * scale + scale - 1, hex);
      });
    });
    cx += (5 + 1) * scale;
  }
  return cx - scale;
}

function placeholderTextWidth(text, scale) {
  return text.length * (5 + 1) * scale - scale;
}

// ---------- placeholder photo (shown until the owner drops real files into assets/card/photos/):
// a camera icon and "YOUR PHOTO HERE", unmistakably an empty slot rather than a pretty filler image
// the owner might mistake for finished content ----------

function buildPlaceholderPhoto() {
  const w = FRAME_WINDOW.x1 - FRAME_WINDOW.x0 + 1;
  const h = FRAME_WINDOW.y1 - FRAME_WINDOW.y0 + 1;
  const img = new Img(w, h);

  // A neutral, slightly cool gray-cream fill (deliberately plainer than a real photo would be) with
  // a dashed border -- the familiar "empty upload slot" convention, pixel-styled.
  img.rect(0, 0, w - 1, h - 1, '#d8d2c4');
  const dash = (x0, y0, x1, y1) => {
    for (let x = x0; x <= x1; x += 6) img.rect(x, y0, Math.min(x + 3, x1), y0, C.outline, 0.4);
    for (let x = x0; x <= x1; x += 6) img.rect(x, y1, Math.min(x + 3, x1), y1, C.outline, 0.4);
    for (let y = y0; y <= y1; y += 6) img.rect(x0, y, x0, Math.min(y + 3, y1), C.outline, 0.4);
    for (let y = y0; y <= y1; y += 6) img.rect(x1, y, x1, Math.min(y + 3, y1), C.outline, 0.4);
  };
  dash(4, 4, w - 5, h - 5);

  // A simple pixel camera: body, a raised viewfinder bump, a lens (two rings) and a small flash.
  const camCx = w / 2;
  const camCy = h / 2 - 12;
  const bodyW = 56, bodyH = 38;
  img.rect(camCx - bodyW / 2, camCy - bodyH / 2, camCx + bodyW / 2, camCy + bodyH / 2, '#8a93a0');
  img.rect(camCx - bodyW / 2, camCy - bodyH / 2, camCx + bodyW / 2, camCy - bodyH / 2 + 6, '#aab2bd'); // top highlight band
  img.rect(camCx - 14, camCy - bodyH / 2 - 8, camCx + 14, camCy - bodyH / 2, '#8a93a0'); // viewfinder bump
  img.outlineRect(camCx - bodyW / 2, camCy - bodyH / 2 - 8, camCx + bodyW / 2, camCy + bodyH / 2, C.outline);
  img.ellipse(camCx, camCy + 3, 13, 13, C.outline);
  img.ellipse(camCx, camCy + 3, 10, 10, '#3b4a5a');
  img.ellipse(camCx - 3, camCy, 4, 4, '#7fa8d0', 0.7); // a lens glint
  img.rect(camCx + bodyW / 2 - 12, camCy - bodyH / 2 + 2, camCx + bodyW / 2 - 4, camCy - bodyH / 2 + 8, '#f5ead0'); // flash

  const label = 'YOUR PHOTO HERE';
  const scale = 1;
  placeholderText(img, label, camCx - placeholderTextWidth(label, scale) / 2, h - 26, '#5a6270', scale);

  return img;
}

// ---------- the temporary slideshow (owner brief, this pass: "add in a temporary card as well"): 5
// small pixel illustrations of campus/story moments, shown in the card's photo frame instead of a
// single "YOUR PHOTO HERE" placeholder whenever the owner hasn't dropped real photos into
// assets/card/photos/ yet (src/card.js TEMP_CARD_SLIDES pairs each one with a short, neutral caption
// -- captions live there, not here, this file only draws pixels). Every one is exactly the frame
// window's own size (FRAME_WINDOW, 200x140) so it drops in with the same fit math as a real photo or
// the single placeholder above -- no separate scaling path to keep in sync. docs/STORY.md still calls
// the whole card a placeholder until the owner supplies real content; the point of this pass is that
// the placeholder LOOKS finished in the meantime, not that it stops being one. ----------

const TEMP_W = FRAME_WINDOW.x1 - FRAME_WINDOW.x0 + 1; // 200
const TEMP_H = FRAME_WINDOW.y1 - FRAME_WINDOW.y0 + 1; // 140

// Slide 1: the Main Block entrance -- steps, pillars, the glass front under a red arch (docs/STORY.md
// beat 3), the same forced-perspective narrowing-toward-the-back idea docs/GAME_FEEL.md's cutscene
// art already uses, sketched small rather than reusing tools/make-cutscenes.js's own (much bigger,
// differently-scaled) entrance art.
function buildTempEntrance() {
  const img = new Img(TEMP_W, TEMP_H);
  img.rect(0, 0, TEMP_W - 1, 68, C.sky);
  img.rect(0, 56, TEMP_W - 1, 68, C.skyHaze);
  img.rect(0, 69, TEMP_W - 1, TEMP_H - 1, C.stone);
  for (let x = 0; x < TEMP_W; x += 18) img.rect(x, 100, x, TEMP_H - 1, C.stoneShade, 0.35); // plaza seams
  // Steps, narrowing toward the entrance (near) from the plaza (far).
  const steps = [C.wallShade, C.wallBeige, '#f7edd2'];
  steps.forEach((hex, i) => {
    const inset = i * 12;
    const y0 = 100 - i * 11;
    img.rect(58 + inset, y0, TEMP_W - 59 - inset, y0 + 10, hex);
  });
  // Pillars either side of the glass front.
  for (const px of [64, TEMP_W - 65]) {
    img.rect(px - 7, 26, px + 7, 100, C.wallShade);
    img.rect(px - 7, 26, px, 100, C.wallBeige);
    img.outlineRect(px - 7, 26, px + 7, 100);
  }
  // Glass front with faint pane lines.
  img.rect(78, 30, TEMP_W - 79, 100, C.glassDeep);
  for (let y = 34; y < 100; y += 9) img.rect(78, y, TEMP_W - 79, y, C.glass, 0.45);
  img.outlineRect(78, 30, TEMP_W - 79, 100);
  // The red arch over the door.
  img.rect(70, 18, TEMP_W - 71, 30, C.archRed);
  img.ellipse(TEMP_W / 2, 18, 30, 13, C.archRed);
  img.outlineRect(70, 12, TEMP_W - 71, 30, C.archRedDeep);
  img.outlineRect(0, 0, TEMP_W - 1, TEMP_H - 1);
  return img;
}

// Slide 2: the foyer staircase (docs/STORY.md beat 4, "everywhere else... blocked off... only way is
// around and behind the staircase") -- warm interior, steps rising toward the upper floors.
function buildTempFoyer() {
  const img = new Img(TEMP_W, TEMP_H);
  img.rect(0, 0, TEMP_W - 1, TEMP_H - 1, C.wallBeige);
  img.rect(0, 100, TEMP_W - 1, TEMP_H - 1, C.stone);
  const stepCount = 6;
  for (let i = 0; i < stepCount; i++) {
    const x0 = 30 + i * 24;
    const y0 = 96 - i * 11;
    img.rect(x0, y0, x0 + 24, 100, i % 2 === 0 ? C.wood : C.woodHi);
    img.outlineRect(x0, y0, x0 + 24, 100, C.woodDeep);
  }
  // Banister rail along the top of the stairs.
  img.rect(30, 24, TEMP_W - 31, 30, C.woodDeep);
  img.rect(30, 24, TEMP_W - 31, 26, C.woodShade);
  // A couple of warm ceiling lamps, low-alpha glow pools underneath.
  for (const lx of [46, TEMP_W - 46]) {
    img.ellipse(lx, 40, 22, 14, C.goldHi, 0.18);
    img.ellipse(lx, 16, 7, 5, C.gold);
    img.outlineRect(lx - 7, 12, lx + 7, 20, C.goldDeep);
  }
  img.outlineRect(0, 0, TEMP_W - 1, TEMP_H - 1);
  return img;
}

// Slide 3: the LUG stall (docs/STORY.md beat 5, "a student stands at the stall") -- a table with a
// banner and a couple of balloons, no baked-in text (the caption below it already says what it is).
function buildTempStall() {
  const img = new Img(TEMP_W, TEMP_H);
  img.rect(0, 0, TEMP_W - 1, TEMP_H - 1, C.wallShade);
  img.rect(0, 92, TEMP_W - 1, TEMP_H - 1, C.stone);
  // Banner backdrop.
  img.rect(46, 22, TEMP_W - 47, 60, C.pinkDeep);
  img.rect(46, 22, TEMP_W - 47, 30, C.pinkLight, 0.5);
  img.outlineRect(46, 22, TEMP_W - 47, 60);
  // Balloons either side of the banner.
  img.ellipse(58, 14, 9, 11, C.gold);
  img.ellipse(TEMP_W - 58, 14, 9, 11, C.ribbon);
  // The table.
  img.rect(36, 92, TEMP_W - 37, 118, C.wood);
  img.rect(36, 92, TEMP_W - 37, 98, C.woodHi);
  img.outlineRect(36, 92, TEMP_W - 37, 118);
  // A stack of small key-shaped tokens on the table, hinting at the hunt without spelling it out.
  for (const kx of [TEMP_W / 2 - 16, TEMP_W / 2 + 2]) {
    img.ellipse(kx, 84, 4, 4, C.gold);
    img.rect(kx - 1, 86, kx + 1, 92, C.gold);
  }
  img.outlineRect(0, 0, TEMP_W - 1, TEMP_H - 1);
  return img;
}

// Slide 4: the three keys (docs/STORY.md "find 3 keys hidden around campus") -- a small trophy-style
// display, gold/silver/bronze, on a dark cloth so they read as the prize, not clutter on a table.
function buildTempKeys() {
  const img = new Img(TEMP_W, TEMP_H);
  img.rect(0, 0, TEMP_W - 1, TEMP_H - 1, C.clothDark);
  img.ellipse(TEMP_W / 2, 76, 92, 50, C.clothGlow, 0.6);
  img.ellipse(TEMP_W / 2, 76, 56, 30, '#4a4270', 0.4);
  const keys = [
    { x: TEMP_W / 2 - 46, hex: C.gold, shade: C.goldDeep },
    { x: TEMP_W / 2, hex: C.silver, shade: C.silverShade },
    { x: TEMP_W / 2 + 46, hex: C.bronze, shade: C.bronzeShade },
  ];
  for (const key of keys) {
    const { x, hex, shade } = key;
    img.ellipse(x, 54, 11, 11, hex);
    img.ellipse(x, 54, 5, 5, C.clothDark);
    img.rect(x - 3, 62, x + 3, 96, hex);
    img.rect(x - 3, 62, x, 96, shade, 0.4);
    img.rect(x - 3, 80, x + 7, 86, hex); // tooth
    img.rect(x - 3, 88, x + 5, 93, hex); // tooth
    img.outlineRect(x - 11, 43, x + 11, 65);
  }
  img.outlineRect(0, 0, TEMP_W - 1, TEMP_H - 1);
  return img;
}

// Slide 5: the box (docs/STORY.md "hands her a small box") -- a preview of the ending's own reward,
// lid ajar with a warm glow escaping, so this slide bridges straight into the box-opening scene that
// actually follows it in the real game.
function buildTempBox() {
  const img = new Img(TEMP_W, TEMP_H);
  img.rect(0, 0, TEMP_W - 1, TEMP_H - 1, '#2a1c14');
  img.ellipse(TEMP_W / 2, 82, 86, 44, C.woodDeep, 0.5);
  img.ellipse(TEMP_W / 2, 82, 52, 26, C.goldDeep, 0.35);
  const x0 = TEMP_W / 2 - 40, x1 = TEMP_W / 2 + 40;
  // Box body.
  img.rect(x0, 90, x1, 122, C.wood);
  img.rect(x0, 90, x1, 96, C.woodHi);
  img.rect(x0, 116, x1, 122, C.woodDeep);
  img.outlineRect(x0, 90, x1, 122);
  // Lid, tilted ajar, with the glow escaping from underneath it.
  img.ellipse(TEMP_W / 2, 88, 30, 10, C.goldHi, 0.85);
  img.rect(x0 - 2, 68, x1 + 2, 90, C.woodHi);
  img.rect(x0 - 2, 68, x1 + 2, 74, C.icing, 0.2);
  img.outlineRect(x0 - 2, 68, x1 + 2, 90);
  // Ribbon down the front.
  img.rect(TEMP_W / 2 - 4, 90, TEMP_W / 2 + 4, 122, C.ribbon);
  img.ellipse(TEMP_W / 2 - 7, 70, 6, 5, C.ribbon);
  img.ellipse(TEMP_W / 2 + 7, 70, 6, 5, C.ribbon);
  img.outlineRect(0, 0, TEMP_W - 1, TEMP_H - 1);
  return img;
}

// ---------- a small floating heart (confetti/decoration) ----------

function buildHeart() {
  const img = new Img(12, 10);
  img.heart(6, 5, 5, C.pink);
  return img;
}

// ---------- the closed card's cover: a bordered panel + a balloon/confetti motif; the actual
// "Happy Birthday {name}!" title is drawn as real game text over this (src/scenes/card.js), not
// baked into the pixels, so it can use the game's own font and pick up the recipient's real name ----------

function buildCover() {
  const W = 400;
  const H = 260;
  const img = new Img(W, H);
  img.rect(0, 0, W - 1, H - 1, C.paper);
  for (let y = 0; y < H; y += 4) img.rect(0, y, W - 1, y, C.paperShade, 0.12); // a faint paper texture
  img.outlineRect(6, 6, W - 7, H - 7, C.gold);
  img.outlineRect(8, 8, W - 9, H - 9, C.outline);

  // Balloons, three of them, warm colours per docs/STYLE_GUIDE.md's palette.
  const balloons = [
    { x: 70, y: 96, r: 26, hex: C.pink, string: H - 40 },
    { x: 140, y: 70, r: 22, hex: C.gold, string: H - 40 },
    { x: W - 90, y: 88, r: 24, hex: C.ribbon, string: H - 40 },
  ];
  for (const b of balloons) {
    img.ellipse(b.x, b.y, b.r, b.r * 1.15, b.hex);
    img.ellipse(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, b.r * 0.4, '#ffffff', 0.35);
    img.outlineRect(b.x - 1, b.y + b.r * 1.15 - 1, b.x + 1, b.y + b.r * 1.15 + 1, C.outline);
    for (let y = b.y + b.r * 1.15; y < b.string; y++) img.px(b.x + Math.round(Math.sin(y / 8) * 3), y, C.outline);
  }

  // A cluster of confetti hearts and dots around the bottom, framing where the title text will sit.
  for (const [x, y, r] of [[40, H - 44, 6], [W - 44, H - 50, 5], [90, H - 30, 4], [W - 90, H - 28, 5]]) {
    img.heart(x, y, r, C.pink);
  }
  for (const [x, y] of [[60, 40], [W - 60, 46], [W / 2, 30], [30, H - 90], [W - 30, H - 100]]) {
    img.rect(x - 1, y - 3, x + 1, y + 3, C.gold);
    img.rect(x - 3, y - 1, x + 3, y + 1, C.gold);
  }
  return img;
}

// ---------- write the files ----------

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets', 'cutscenes');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, built) => fs.writeFileSync(path.join(outDir, name), built.toPNG());
write('card-box-base.png', buildBoxBase());
write('card-box-lid.png', buildBoxLid());
write('card-cake.png', buildCake());
write('card-frame.png', buildFrame());
write('card-placeholder-photo.png', buildPlaceholderPhoto());
write('card-heart.png', buildHeart());
write('card-cover.png', buildCover());
write('card-temp-1.png', buildTempEntrance());
write('card-temp-2.png', buildTempFoyer());
write('card-temp-3.png', buildTempStall());
write('card-temp-4.png', buildTempKeys());
write('card-temp-5.png', buildTempBox());
console.log(`Wrote card-box-base, card-box-lid, card-cake, card-frame, card-placeholder-photo, card-heart, card-cover and card-temp-1..5 to ${path.relative(path.join(__dirname, '..'), outDir)}/`);

module.exports = { FRAME_W, FRAME_H, FRAME_WINDOW, CAKE_CANDLE_X, CAKE_CANDLE_TOP_Y };
