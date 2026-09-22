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
  sky: '#bfe6ff',
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

// ---------- placeholder photo (shown until the owner drops real files into assets/card/photos/) ----------

function buildPlaceholderPhoto() {
  const w = FRAME_WINDOW.x1 - FRAME_WINDOW.x0 + 1;
  const h = FRAME_WINDOW.y1 - FRAME_WINDOW.y0 + 1;
  const img = new Img(w, h);
  // A soft warm gradient background (not a blank gray box -- this should still feel like a gift).
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const hex = t < 0.5 ? C.pinkLight : C.paper;
    img.rect(0, y, w - 1, y, hex, 0.5);
  }
  img.rect(0, 0, w - 1, h - 1, C.paperShade, 0.25);
  img.heart(w / 2, h / 2 - 6, 26, C.pink);
  img.heart(w / 2, h / 2 - 6, 26, C.outline, 0.15);
  // A few small stars scattered around the heart.
  const stars = [[24, 20], [w - 28, 24], [26, h - 22], [w - 24, h - 26], [w / 2 - 40, h / 2 + 30]];
  for (const [sx, sy] of stars) {
    img.rect(sx - 1, sy - 4, sx + 1, sy + 4, C.gold);
    img.rect(sx - 4, sy - 1, sx + 4, sy + 1, C.gold);
  }
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
console.log(`Wrote card-box-base, card-box-lid, card-cake, card-frame, card-placeholder-photo, card-heart and card-cover to ${path.relative(path.join(__dirname, '..'), outDir)}/`);

module.exports = { FRAME_W, FRAME_H, FRAME_WINDOW, CAKE_CANDLE_X, CAKE_CANDLE_TOP_Y };
