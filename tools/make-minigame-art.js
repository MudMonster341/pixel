// Themed backdrops and sprites for the 3 mini-games (docs/ROADMAP.md M4, coordinator art-pass brief
// 2026-09-22): "give each game a themed backdrop instead of black... drawn in the tools like the rest
// of the art." Same technique as tools/make-cutscenes.js -- a tiny Img/PNG writer, no dependencies,
// no photos copied -- just a second illustration set alongside the story cutscenes.
//
// Quality loop pass (Mini-games category, "the lab and the server room are dark and muddy... add
// depth: a layered parallax backdrop"): the platformer scrolls a real camera across a level wider
// than one screen (src/minigames/platformer.js), so it gets *true* two-layer parallax -- a static far
// wall (canvas-sized, pinned like before) plus a mid shelving/equipment layer sized to the whole level
// and scrolled at a fraction of camera speed (scrollFactor, set in platformer.js). Both layers are
// generated here at a smaller "compact" scale (matching platformer.js's own compact level design, see
// that file's header) and stretched 3x in-scene (setDisplaySize, crisp under pixelArt:true, src/
// main.js) rather than authored at full canvas resolution. The flyer's own camera never scrolls (the
// racks scroll past a fixed camera instead, flappy.js's own animation loop), so a second,
// independently-moving layer wouldn't read as parallax there -- it gets one richer, brighter, more
// layered backdrop instead (far sky/cable-tray band behind a dimmer distant rack row behind a
// brighter nearer one), composed in one image the same way the old single-backdrop games did, just
// brighter and busier, also generated compact and stretched 3x. Both games' own floor/foreground (the
// actual near layer) stays code-drawn in their own scene file, tied 1:1 to real world position -- see
// PF_* / FL_* constants there.
//
// Run:  node tools/make-minigame-art.js   (also runs as part of `npm run assets`)
// Output, in assets/minigames/:
//   platformer-bg-far.png  320x180 (compact scale), pinned (scrollFactor 0): the Physics Lab's back
//                           wall, warm lamp glow pools, a ceiling pipe run.
//   platformer-bg-mid.png  PF_LEVEL_WIDTH x 180 (534 compact, = the real level width / 3),
//                           scrollFactor ~0.4: shelving units and a specimen tank, spread across the
//                           whole level so it has room to pan.
//   flappy-bg.png           320x180 (compact scale), pinned: the ICL server room, brighter and more
//                           layered than before -- cable tray, two depth-graded rack rows, a cool
//                           ambient glow.
//   tower-bg.png            480x270 (half scale, stretched 2x in-scene like the others): Room 195's tower climb (FB-0074,
//                           docs/plans/2026-10-04-moments-and-small-touches.md M8): stone walls with arrow slits, torch
//                           brackets, the five wooden beams and their ladders (positions read from src/minigames/
//                           tower-logic.js TOWER_LEVEL, so art and rules cannot drift), banners, and the big round top
//                           window onto a sunset where the prince waits, with a sill for his chameleon.
//   tower-sprites.png       256x96, 32x32 cells (frame order = TW_FRAME in src/minigames/tower.js): the gargoyle (idle,
//                           two wind-up poses, throw, sad), a barrel (from the CC0 Kenney Roguelike Modern City sheet, turned
//                           on its side) in two rolling frames, a flower pot (two sway frames), hearts, a crown, a puff,
//                           the green/pink/green chameleon, a torch flame, a sparkle, a shard. All code-composed from
//                           the project palette except the barrel.
//   tower-prince.png        64x24, four 16x24 frames: the prince (a short-haired student sheet from this project, so one
//                           of our own recolours of the pack characters) with a gold crown: facing front (2 frames),
//                           facing right (2 frames).
// `--out <dir>` writes elsewhere (tests check the files are up to date), matching the convention in
// tools/make-assets.js / tools/make-cutscenes.js.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { encodePNG } = require('./lib/png');
const { decodePNG } = require('./lib/png-decode');

// The compact scale the platformer/flyer backdrops are authored at (a 320x180-equivalent viewport,
// 1/3 of the real 960x540 canvas -- src/state.js ZOOM=3) and the platformer's own compact level width
// -- kept in sync with src/minigames/platformer.js's own compact-scale constants (both files' own
// comments cross-reference this) by hand, the same trust the rest of this file already places in
// matching constants across files (the tower is the exception: its level numbers are read straight from
// src/minigames/tower-logic.js below).
const VIEW_W = 320;
const VIEW_H = 180;
const PF_LEVEL_WIDTH = 534;

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

  // Raw RGBA write (keeps a sprite's own transparency), for copying pixels out of another image.
  pxA(x, y, r, g, b, a) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = r;
    this.data[i + 1] = g;
    this.data[i + 2] = b;
    this.data[i + 3] = a;
  }

  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  // Draws `src` (an Img with transparent pixels) at (dx, dy): its opaque pixels overwrite, transparent ones leave this alone.
  blit(src, dx, dy) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.data[i + 3] > 0) this.pxA(dx + x, dy + y, src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]);
      }
    }
  }

  rect(x0, y0, x1, y1, hex, alpha = 1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.px(x, y, hex, alpha);
  }

  outlineRect(x0, y0, x1, y1, hex) {
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

  line(x0, y0, x1, y1, thickness, hex, alpha = 1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.max(Math.abs(dx), Math.abs(dy)));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (dx * i) / steps;
      const y = y0 + (dy * i) / steps;
      for (let t = -thickness / 2; t <= thickness / 2; t++) this.px(x, y + t, hex, alpha);
    }
  }

  // Vertical gradient band between two colors, `from` inclusive to `to` inclusive.
  vGradient(y0, y1, stops) {
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      let hex = stops[0][1];
      for (const [stopT, stopHex] of stops) if (t >= stopT) hex = stopHex;
      this.rect(0, y, this.w - 1, y, hex);
    }
  }

  toPNG() {
    return encodePNG(this.w, this.h, this.data);
  }
}

// ---------- Physics Lab (platformer) ----------
// Two layers now (see file header): a static far wall (viewport-sized) behind a scrolling mid layer
// of shelving/a specimen tank (level-width sized). Both brightened well past the old single-image
// version (owner: "dark and muddy") -- lighter wall tones, bigger/warmer lamp pools, and the shelving
// itself uses a lit-tan tone instead of near-black silhouette so it actually reads as lab furniture
// rather than a shadow. The floor is drawn by platformer.js itself now (a real, code-drawn near layer
// tied to world position), not baked into either image.

function buildPlatformerFar() {
  const img = new Img(VIEW_W, VIEW_H);
  const C = {
    wallHi: '#5a4c3a', wallMid: '#463a2c', wallDeep: '#362c22',
    lampGlow: '#ffe6b0', lampGlowDim: '#e0b25e',
    pipe: '#4a3d2c', pipeHi: '#6b5a42',
  };
  // Brighter vertical gradient (was near-black at both ends) -- the wall now reads as lit stone/
  // plaster, not a void, even between the lamp pools.
  img.vGradient(0, VIEW_H - 1, [[0, C.wallMid], [0.45, C.wallHi], [1, C.wallDeep]]);

  // Warm lamp fixtures along the ceiling, bigger and brighter glow pools than before.
  const lamps = [55, 160, 265];
  for (const lx of lamps) {
    img.ellipse(lx, 0, 46, 90, C.lampGlow, 0.22);
    img.ellipse(lx, 0, 26, 55, C.lampGlowDim, 0.28);
    img.rect(lx - 7, 0, lx + 7, 4, C.pipe);
    img.ellipse(lx, 5, 8, 3, C.lampGlow, 0.75);
  }

  // A ceiling pipe run, catching a highlight along its top edge (STYLE_GUIDE "one light source").
  img.rect(0, 9, VIEW_W - 1, 12, C.pipe, 0.9);
  img.rect(0, 9, VIEW_W - 1, 10, C.pipeHi, 0.5);
  for (let x = 8; x < VIEW_W; x += 22) img.rect(x, 7, x + 2, 14, C.pipeHi);

  return img;
}

function buildPlatformerMid() {
  const img = new Img(PF_LEVEL_WIDTH, VIEW_H);
  const C = {
    shelf: '#7a6a4e', shelfHi: '#9c8862', shelfEdge: '#4a3f2e',
    box: '#3a4a52', boxHi: '#5a7078',
    tankGlass: '#4fa08c', tankLiquid: '#3f8f7c', tankBubble: '#d8f5ea', tankRim: '#5a4a34',
  };

  // Wall-mounted shelving units, evenly spaced across the whole level, each carrying a couple of
  // equipment-box silhouettes -- a lit tan tone (not near-black) so it reads as furniture, with a
  // highlight on each shelf's own top edge (the "clear top edge" the rubric asks platforms to have,
  // echoed here in the set dressing too).
  for (let sx = 20; sx < PF_LEVEL_WIDTH; sx += 78) {
    const top = 24;
    const bottom = 118;
    img.rect(sx, top, sx + 46, top + 3, C.shelfHi);
    img.rect(sx, top + 3, sx + 46, bottom, C.shelf);
    for (let shelfY = top + 22; shelfY < bottom; shelfY += 30) {
      img.rect(sx, shelfY, sx + 46, shelfY + 2, C.shelfEdge);
      img.rect(sx, shelfY - 2, sx + 46, shelfY, C.shelfHi, 0.6);
      for (let bx = sx + 4; bx < sx + 40; bx += 14) {
        const bh = 8 + ((bx + shelfY) % 6);
        img.rect(bx, shelfY - bh, bx + 9, shelfY - 1, C.box);
        img.rect(bx, shelfY - bh, bx + 9, shelfY - bh + 2, C.boxHi);
      }
    }
  }

  // A glowing specimen tank every couple of shelf runs -- a lab centerpiece, repeated so it reads
  // wherever the camera happens to be, not just once at a fixed spot.
  for (let tx = 130; tx < PF_LEVEL_WIDTH; tx += 220) {
    img.rect(tx - 16, 30, tx + 16, 118, C.tankGlass, 0.55);
    img.rect(tx - 16, 30, tx + 16, 118, C.tankLiquid, 0.3);
    img.outlineRect(tx - 16, 30, tx + 16, 118, C.tankRim);
    for (let i = 0; i < 6; i++) {
      const bx = tx - 10 + ((i * 13) % 20);
      const by = 108 - ((i * 19) % 70);
      img.ellipse(bx, by, 1, 1, C.tankBubble, 0.7);
    }
    img.rect(tx - 18, 27, tx + 18, 31, C.tankRim); // tank lid/rim
  }

  return img;
}

// ---------- ICL server room (flappy) ----------
// Cold blue light, brightened and more layered than before (owner: "dark and muddy"): a lighter sky
// gradient, a cable tray, two depth-graded rack rows (a dim far row, a brighter mid row) receding
// toward the top of the frame, and a raised-floor tile band -- the actual obstacle racks are drawn by
// src/minigames/flappy.js on top of this. Sized to the compact scale (the flyer's own camera never
// scrolls, so unlike the platformer this stays one static image, just a richer one -- see the file
// header) and stretched 3x in-scene.

function buildFlappyBg() {
  const img = new Img(VIEW_W, VIEW_H);
  const C = {
    skyDeep: '#1c2c48', skyMid: '#28405f', skyLight: '#3a5878',
    rackFar: '#2a3c54', rackFarLit: '#3a5068',
    rackMid: '#33495f', rackMidLit: '#456082',
    cableTray: '#141f2e', cableRung: '#28394e',
    floorLight: '#33465c', floorDark: '#283850', floorGrid: '#4a6480',
    ledGreen: '#8fd46a', ledAmber: '#ffd23f',
  };

  img.vGradient(0, VIEW_H - 1, [[0, C.skyDeep], [0.6, C.skyMid], [1, C.skyLight]]);

  // Cable tray along the ceiling.
  img.rect(0, 0, VIEW_W - 1, 7, C.cableTray);
  for (let x = 2; x < VIEW_W; x += 6) img.rect(x, 0, x + 1, 7, C.cableRung);

  // A dim, distant rack row, then a brighter, closer one just below it -- a cheap two-step depth cue
  // (STYLE_GUIDE "Layering") that reads clearly even at this small scale.
  const rows = [
    { y: 13, scale: 0.55, fill: C.rackFar, lit: C.rackFarLit, alpha: 0.75 },
    { y: 28, scale: 0.8, fill: C.rackMid, lit: C.rackMidLit, alpha: 0.9 },
  ];
  for (const row of rows) {
    const rh = 15 * row.scale;
    const rw = 14 * row.scale;
    for (let x = 4; x < VIEW_W; x += 24) {
      img.rect(x, row.y, x + rw, row.y + rh, row.fill, row.alpha);
      img.rect(x + 1, row.y + 1, x + rw - 1, row.y + 2, row.lit, row.alpha);
      img.px(x + 2, row.y + 4, ((x / 24) | 0) % 2 === 0 ? C.ledGreen : C.ledAmber, 0.85);
    }
  }

  // Floor: raised server-room floor tiles, cool and grid-lined, brighter than before.
  const floorY = 160;
  img.rect(0, floorY, VIEW_W - 1, VIEW_H - 1, C.floorLight);
  for (let x = 0; x < VIEW_W; x += 10) img.rect(x, floorY, x, VIEW_H - 1, C.floorGrid, 0.55);
  for (let y = floorY; y < VIEW_H; y += 10) img.rect(0, y, VIEW_W - 1, y, C.floorGrid, 0.55);

  // A soft cold ambient glow low across the room (cable-tray-to-floor light falloff) -- lighter than
  // the old near-black wash so the middle of the room doesn't read as murky.
  img.rect(0, 7, VIEW_W - 1, floorY, C.skyLight, 0.06);

  return img;
}

// ---------- Room 195: the tower climb (FB-0074) ----------
// The level's numbers (floors, ladders, torches, the window) come straight from src/minigames/tower-logic.js, evaluated here, so the
// beams and ladders painted into the backdrop are exactly where the rules put them. Everything is drawn in "compact" pixels (half the
// real 960x540 canvas, stretched 2x in-scene), like the other backdrops; the sprites are drawn at native size and the scene scales
// them 2x, so one art pixel is the same size everywhere (the lead's 16x24 sprite is 32x48 on screen).

function loadTowerLevel() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'minigames', 'tower-logic.js'), 'utf8');
  // tower-logic.js only needs the platformer's coyote constant while it loads (its helper calls happen later, in a scene).
  const context = vm.createContext({ PLATFORMER_COYOTE_MS: 110, Math });
  vm.runInContext(`${source}\nthis.__tower = { TOWER_LEVEL, TOWER_W, TOWER_H, TOWER_SLAB_H, TOWER_LEFT, TOWER_RIGHT };`, context);
  return context.__tower;
}

// Reads a sprite crop from a vendor sheet (assets/vendor/, CC0) as an Img: the box (sx, sy, w, h) of the sheet.
function cropVendor(relPath, sx, sy, w, h) {
  const atlas = decodePNG(fs.readFileSync(path.join(__dirname, '..', 'assets', 'vendor', relPath)));
  const img = new Img(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((sy + y) * atlas.width + sx + x) * 4;
      img.pxA(x, y, atlas.data[si], atlas.data[si + 1], atlas.data[si + 2], atlas.data[si + 3]);
    }
  }
  return img;
}

const MODERN_CITY = 'kenney-roguelike-modern-city/Spritesheet/roguelikeCity_magenta.png';
const TW_PAL = {
  K: '#1a1c2c', // outline (the project's)
  // stone: wall, lit edge, shade, mortar; the outer (thicker, darker) wall
  stone: '#5a6180', stoneHi: '#6e7699', stoneLo: '#4a5170', mortar: '#3e4460',
  outer: '#363a53', outerHi: '#444965', outerLo: '#2b2e44',
  // wood: sampled from the Kenney fence planks (the beam body uses the pack pixels themselves)
  woodDark: '#8f673f', woodMid: '#b48355', woodLight: '#c58f5c', woodSeam: '#a4774d', woodShadow: '#5e3f26',
  iron: '#2f3346', ironHi: '#5a6078',
  torchGlow: '#ffb25a',
  banner: '#b5354a', bannerHi: '#d9506a', bannerGold: '#ffd23f',
};

// A small text sprite: one character = one pixel, '.' = transparent, drawn into `img` at (ox, oy).
function drawRows(img, ox, oy, rows, palette) {
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => { if (ch !== '.' && palette[ch]) img.px(ox + x, oy + y, palette[ch]); });
  });
}

// The dark outline round a sprite: every transparent pixel touching a drawn one (4-neighbour) becomes outline-coloured.
function outlineSprite(img, hex = TW_PAL.K) {
  const mark = [];
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.alphaAt(x, y) !== 0) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => img.alphaAt(x + dx, y + dy) > 0)) mark.push([x, y]);
    }
  }
  for (const [x, y] of mark) img.px(x, y, hex);
}

// ----- the gargoyle: a squat, round stone gargoyle (cute, not scary): grumpy brows, tiny fangs, folded wings, moss -----
const G = { stone: '#8d93a6', light: '#b4bacb', dark: '#5f647a', deep: '#454a5e', moss: '#6fa06a', eye: '#ffd23f', white: '#f4f1ea', pupil: '#1a1c2c' };

// pose: arms 'down' | 'up' | 'high' | 'throw'; mouth 'frown' | 'open' | 'sad'; cheeks (puffed); eyes 'open' | 'closed' | 'sad'
function drawGargoyle(pose) {
  const img = new Img(32, 32);
  const cx = 16;
  // wings folded behind the body, tail, then the body, feet and head on top
  img.rect(5, 12, 9, 23, G.dark);
  img.rect(6, 10, 8, 14, G.dark);
  img.rect(22, 12, 26, 23, G.dark);
  img.rect(24, 10, 26, 14, G.dark);
  img.px(4, 14, G.dark); img.px(27, 14, G.dark);
  img.line(24, 25, 28, 26, 1, G.dark);
  img.px(28, 24, G.dark); img.px(29, 23, G.dark);
  img.ellipse(cx, 21, 9, 7, G.stone);
  img.ellipse(cx, 23, 6, 4, G.light); // belly
  img.rect(10, 26, 14, 27, G.dark); // feet
  img.rect(18, 26, 22, 27, G.dark);
  img.px(10, 27, G.deep); img.px(14, 27, G.deep); img.px(18, 27, G.deep); img.px(22, 27, G.deep);
  // head
  const headRx = pose.cheeks ? 9 : 8;
  img.ellipse(cx, 12, headRx, 6, G.stone);
  img.rect(cx - 5, 7, cx + 5, 8, G.light); // lit top
  // little horns
  img.rect(8, 4, 10, 7, G.dark); img.px(8, 3, G.dark);
  img.rect(22, 4, 24, 7, G.dark); img.px(24, 3, G.dark);
  // moss tuft
  img.px(14, 6, G.moss); img.px(15, 5, G.moss); img.px(16, 6, G.moss); img.px(18, 6, G.moss);
  img.px(11, 23, G.moss); img.px(12, 24, G.moss); img.px(21, 24, G.moss);
  // face
  if (pose.eyes === 'closed') {
    img.line(11, 12, 14, 12, 1, G.pupil); img.line(18, 12, 21, 12, 1, G.pupil);
  } else {
    img.ellipse(12, 12, 2, 2, G.eye); img.ellipse(20, 12, 2, 2, G.eye);
    img.px(13, 12, G.pupil); img.px(13, 13, G.pupil); img.px(19, 12, G.pupil); img.px(19, 13, G.pupil);
  }
  if (pose.eyes === 'sad') { // brows slant up at the middle
    img.line(10, 9, 14, 8, 1, G.pupil); img.line(18, 8, 22, 9, 1, G.pupil);
  } else { // grumpy: brows slant down toward the nose
    img.line(10, 8, 14, 10, 1, G.pupil); img.line(18, 10, 22, 8, 1, G.pupil);
  }
  img.px(cx, 14, G.dark); img.px(cx, 15, G.dark); // nose
  if (pose.mouth === 'open') {
    img.rect(13, 16, 19, 18, G.pupil);
    img.rect(14, 16, 15, 16, G.white); img.rect(17, 16, 18, 16, G.white);
  } else if (pose.mouth === 'sad') {
    img.line(13, 17, 19, 17, 1, G.pupil); img.px(12, 18, G.pupil); img.px(20, 18, G.pupil);
  } else {
    img.line(13, 17, 19, 17, 1, G.pupil); img.px(13, 18, G.pupil); img.px(19, 18, G.pupil);
    img.px(14, 18, G.white); img.px(18, 18, G.white); // two tiny fangs
  }
  // arms
  const arm = (x0, y0, x1, y1) => { img.line(x0, y0, x1, y1, 2, G.light); img.ellipse(x1, y1, 1, 1, G.stone); };
  if (pose.arms === 'up') { arm(7, 21, 3, 14); arm(25, 21, 29, 14); }
  else if (pose.arms === 'high') { arm(7, 20, 3, 5); arm(25, 20, 29, 5); }
  else if (pose.arms === 'throw') { arm(25, 19, 30, 25); arm(7, 21, 5, 26); }
  else { arm(7, 22, 6, 26); arm(25, 22, 26, 26); }
  outlineSprite(img);
  return img;
}

// ----- the small sprites -----
const HEART = [
  '.KKK.KKK.',
  'KRRRKRRRK',
  'KRHRRRRRK',
  'KRRRRRRrK',
  'KRRRRRRrK',
  '.KRRRRrK.',
  '..KRRrK..',
  '...KrK...',
  '....K....',
];
const CROWN = [
  '.K..K..K.',
  'KGKKGKKGK',
  'KGGGGGGGK',
  'KgGGPGGgK',
  '.KKKKKKK.',
];
const FLAME = [
  '...OO...',
  '..OYYO..',
  '..OYYO..',
  '.OOYYOO.',
  '.OYYYYO.',
  'OOYWWYOO',
  'OYYWWYYO',
  'OYYWWYYO',
  'OYYYYYYO',
  '.OYYYYO.',
  '..OOOO..',
];
const SPARKLE = [
  '...Y...',
  '...Y...',
  '..YWY..',
  'YYWWWYY',
  '..YWY..',
  '...Y...',
  '...Y...',
];
const POT_TOP = [
  '...PPP....',
  '..PPYPP...',
  '...PPP....',
  '..g.G.g...',
  '.gG.G.Gg..',
  '..gGGGg...',
];
const POT_BODY = [
  '.OOOOOOOO.',
  '.OttttttO.',
  '..OtttTO..',
  '..OtttTO..',
  '...OtTO...',
  '...OOOO...',
];

function drawPot(sway) {
  const img = new Img(16, 20);
  const pal = { P: '#ff7eb6', Y: '#ffd23f', g: '#4fa34a', G: '#2f7a3a', O: '#d9774f', t: '#c0623e', T: '#a04a2c' };
  drawRows(img, 3 + (sway ? 1 : 0), 2, POT_TOP, pal);
  drawRows(img, 3, 8, POT_BODY, pal);
  img.px(5, 9, '#ffb08a'); img.px(6, 9, '#ffb08a'); // rim highlight
  outlineSprite(img);
  return img;
}

function drawChameleon(color, blink) {
  const pal = color === 'pink'
    ? { body: '#ff8fb8', dark: '#d9578d', light: '#ffc2d9' }
    : { body: '#6bbf4a', dark: '#3f8a3f', light: '#a8e07a' };
  const img = new Img(18, 16);
  // tail curl on the left, body, head with a turret eye on the right, legs and toes
  img.ellipse(3, 8, 3, 3, pal.dark);
  img.ellipse(3, 8, 1, 1, pal.body);
  img.rect(4, 9, 6, 11, pal.body);
  img.ellipse(9, 8, 6, 4, pal.body);
  img.ellipse(9, 9, 4, 2, pal.light); // belly
  img.rect(5, 4, 12, 5, pal.dark); // dorsal ridge (little bumps)
  for (const x of [5, 7, 9, 11]) img.px(x, 3, pal.dark);
  img.ellipse(14, 7, 3, 3, pal.body); // head
  img.rect(14, 9, 17, 10, pal.body); // snout
  img.px(17, 8, pal.dark);
  img.ellipse(13, 5, 2, 2, pal.light); // eye turret
  if (blink) img.line(12, 5, 14, 5, 1, TW_PAL.K);
  else { img.rect(12, 4, 14, 6, '#ffffff'); img.px(13, 5, TW_PAL.K); }
  img.rect(5, 12, 6, 13, pal.dark); img.px(4, 13, pal.dark); img.px(7, 13, pal.dark); // legs, toes
  img.rect(11, 12, 12, 13, pal.dark); img.px(10, 13, pal.dark); img.px(13, 13, pal.dark);
  outlineSprite(img);
  return img;
}

// The barrel: the CC0 Kenney Roguelike Modern City orange barrel (an 8x12 upright sprite), turned on its side so it can roll.
function barrelOnSide(flip) {
  const upright = cropVendor(MODERN_CITY, 544 + 4, 51 + 2, 8, 12); // the barrel's own bounding box in tile (col 32, row 3)
  const img = new Img(12, 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 12; x++) {
      // quarter turn: lying barrel pixel (x, y) is the upright pixel (y, 11 - x); `flip` swaps the lit side (a rolling look)
      const sx = flip ? 7 - y : y;
      const sy = 11 - x;
      const i = (sy * 8 + sx) * 4;
      img.pxA(x, y, upright.data[i], upright.data[i + 1], upright.data[i + 2], upright.data[i + 3]);
    }
  }
  // two iron-dark hoops (from the pack's own outline colour) that shift between the two frames, so it reads as rolling
  for (const hx of flip ? [4, 9] : [3, 8]) {
    for (let y = 1; y < 7; y++) if (img.alphaAt(hx, y) > 0) img.px(hx, y, '#974c1e');
  }
  return img;
}

function drawShard() {
  const img = new Img(6, 6);
  drawRows(img, 0, 0, ['..bb..', '.bBBb.', 'bBBBb.', '.bBBbb', '..bBb.', '...b..'], { b: '#8f673f', B: '#c58f5c' });
  return img;
}

function drawPuff() {
  const img = new Img(14, 10);
  img.ellipse(5, 6, 4, 3, '#f4f1ea');
  img.ellipse(9, 5, 4, 3, '#f4f1ea');
  img.ellipse(7, 4, 3, 3, '#ffffff');
  img.rect(3, 8, 10, 8, '#cfc8c0');
  return img;
}

function buildTowerSprites() {
  const sheet = new Img(256, 96);
  const put = (col, row, sprite, ox = null, oy = null, footRow = null) => {
    // centre horizontally; vertically either centred or standing on `footRow` (the cell's foot line)
    const x = ox !== null ? ox : Math.floor((32 - sprite.w) / 2);
    const y = oy !== null ? oy : footRow !== null ? footRow - sprite.h : Math.floor((32 - sprite.h) / 2);
    sheet.blit(sprite, col * 32 + x, row * 32 + y);
  };
  const FOOT = 28; // = TW_FOOT_ROW in src/minigames/tower.js: where things stand
  // row 0: the gargoyle (the cell is the sprite; it stands with its feet on row 27)
  put(0, 0, drawGargoyle({ arms: 'down', mouth: 'frown', eyes: 'open' }), 0, 0);
  put(1, 0, drawGargoyle({ arms: 'up', mouth: 'frown', eyes: 'open', cheeks: true }), 0, 0);
  put(2, 0, drawGargoyle({ arms: 'high', mouth: 'open', eyes: 'open', cheeks: true }), 0, 0);
  put(3, 0, drawGargoyle({ arms: 'throw', mouth: 'open', eyes: 'open' }), 0, 0);
  put(4, 0, drawGargoyle({ arms: 'down', mouth: 'sad', eyes: 'sad' }), 0, 0);
  // row 1: barrel x2, pot x2, hearts, crown, puff
  put(0, 1, barrelOnSide(false), null, null, FOOT);
  put(1, 1, barrelOnSide(true), null, null, FOOT);
  put(2, 1, drawPot(false), null, null, FOOT);
  put(3, 1, drawPot(true), null, null, FOOT);
  const heart = (full) => {
    const img = new Img(9, 9);
    const pal = full
      ? { K: TW_PAL.K, R: '#e8465a', r: '#b02a44', H: '#ffb3c0' }
      : { K: TW_PAL.K, R: '#767b92', r: '#5a5f76', H: '#9a9fb4' };
    drawRows(img, 0, 0, HEART, pal);
    return img;
  };
  put(4, 1, heart(true));
  put(5, 1, heart(false));
  const crown = new Img(9, 5);
  drawRows(crown, 0, 0, CROWN, { K: TW_PAL.K, G: '#ffd23f', g: '#d9961f', P: '#ff6fb1' });
  put(6, 1, crown);
  put(7, 1, drawPuff());
  // row 2: the chameleon (green, pink, green blinking), flame, sparkle, shard
  put(0, 2, drawChameleon('green', false), null, null, FOOT);
  put(1, 2, drawChameleon('pink', false), null, null, FOOT);
  put(2, 2, drawChameleon('green', true), null, null, FOOT);
  const flame = new Img(8, 11);
  drawRows(flame, 0, 0, FLAME, { O: '#ff8a1c', Y: '#ffd23f', W: '#fff3b0' });
  put(3, 2, flame);
  const sparkle = new Img(7, 7);
  drawRows(sparkle, 0, 0, SPARKLE, { Y: '#ffd23f', W: '#ffffff' });
  put(4, 2, sparkle);
  put(5, 2, drawShard());
  return sheet;
}

// The prince: a short-haired student from this project's own character sheet (assets/npc-student-a.png, a recolour of the
// pack characters, 8 columns x 4 rows of 16x24: down, up, left, right), with a small gold crown on his hair. Frames:
// front idle, front idle-anim, right idle, right idle-anim.
function buildTowerPrince() {
  const sheet = decodePNG(fs.readFileSync(path.join(__dirname, '..', 'assets', 'npc-student-a.png')));
  const out = new Img(64, 24);
  const picks = [[0, 0], [0, 7], [3, 0], [3, 7]]; // [row, col]
  const crown = ['.K.K.K.', 'KGKGKGK', 'KGGPGGK', '.KKKKK.'];
  const pal = { K: TW_PAL.K, G: '#ffd23f', P: '#ff6fb1' };
  picks.forEach(([row, col], f) => {
    let top = 24;
    let x0 = 16;
    let x1 = -1;
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 16; x++) {
        const si = ((row * 24 + y) * sheet.width + col * 16 + x) * 4;
        out.pxA(f * 16 + x, y, sheet.data[si], sheet.data[si + 1], sheet.data[si + 2], sheet.data[si + 3]);
        if (sheet.data[si + 3] > 0 && y < top) top = y;
      }
    }
    for (let y = top; y < top + 3; y++) { // the hair's horizontal span in its top rows: the crown sits centred on it
      for (let x = 0; x < 16; x++) {
        const si = ((row * 24 + y) * sheet.width + col * 16 + x) * 4;
        if (sheet.data[si + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      }
    }
    const cx = Math.round((x0 + x1) / 2);
    drawRows(out, f * 16 + cx - 3, Math.max(0, top - 2), crown, pal);
  });
  return out;
}

// ----- the backdrop -----
function buildTowerBg() {
  const { TOWER_LEVEL, TOWER_W, TOWER_H, TOWER_SLAB_H, TOWER_LEFT, TOWER_RIGHT } = loadTowerLevel();
  const w = TOWER_W / 2;
  const h = TOWER_H / 2;
  const img = new Img(w, h);
  const P = TW_PAL;
  const hash = (a, b) => { let n = Math.imul(a * 73856093 ^ b * 19349663, 2654435761) >>> 0; n ^= n >>> 13; return (n >>> 0) % 1000 / 1000; };
  const innerL = TOWER_LEFT / 2; // 65
  const innerR = TOWER_RIGHT / 2; // 415

  // stone blocks over a region: rows `rowH` high, block widths 16..30, a lit top-left and a shaded bottom-right edge
  function stoneRegion(x0, x1, y0, y1, rowH, base, hi, lo, mortar, seed) {
    img.rect(x0, y0, x1, y1, mortar);
    for (let row = 0, y = y0; y <= y1; row++, y += rowH) {
      let x = x0 - Math.floor(hash(seed, row) * 20);
      while (x <= x1) {
        const bw = 16 + Math.floor(hash(row, x + seed) * 14);
        const bx0 = Math.max(x0, x + 1);
        const bx1 = Math.min(x1, x + bw - 1);
        if (bx1 >= bx0) {
          const by1 = Math.min(y1, y + rowH - 2);
          img.rect(bx0, y + 1, bx1, by1, base);
          img.rect(bx0, y + 1, bx1, y + 1, hi);
          img.rect(bx1, y + 1, bx1, by1, lo);
          img.rect(bx0, by1, bx1, by1, lo);
          if (hash(row * 7 + 1, x) > 0.8) img.px(bx0 + 4, y + 4, lo); // a chip
        }
        x += bw;
      }
    }
  }
  stoneRegion(0, w - 1, 0, h - 1, 10, P.outer, P.outerHi, P.outerLo, '#23263a', 3);
  stoneRegion(innerL, innerR, 0, h - 1, 9, P.stone, P.stoneHi, P.stoneLo, P.mortar, 11);
  // the inner walls' edges: a shadow on each side of the chamber, and the ceiling darker
  img.rect(innerL, 0, innerL + 2, h - 1, '#232640', 0.55);
  img.rect(innerR - 2, 0, innerR, h - 1, '#232640', 0.55);
  for (let y = 0; y < 14; y++) img.rect(innerL, y, innerR, y, '#1a1c2c', 0.5 - y * 0.035);

  // arrow slits in the outer walls, one per floor and one at the top: a stone surround round a strip of night sky
  const slitYs = [...TOWER_LEVEL.floors.map((f) => f.y / 2 - 38)];
  for (const cx of [innerL / 2, (innerR + w) / 2]) {
    for (const y of slitYs) {
      img.rect(cx - 4, y - 2, cx + 3, y + 19, '#6e7699');
      img.rect(cx - 3, y - 1, cx + 2, y + 18, '#232640');
      for (let r = 0; r < 18; r++) img.rect(cx - 2, y + r, cx + 1, y + r, r < 9 ? '#2c3c6e' : '#4a4f8a');
      img.px(cx - 1, y + 4, '#fff3b0');
      img.px(cx + 1, y + 11, '#ffffff');
      img.rect(cx - 4, y + 19, cx + 3, y + 20, '#454a65'); // sill
    }
  }

  // hanging banners (flavour): two on each side of the window, one lower on each side
  const banner = (bx, by, bh) => {
    img.rect(bx - 1, by - 2, bx + 8, by - 1, P.iron);
    img.rect(bx, by, bx + 7, by + bh, P.banner);
    img.rect(bx, by, bx + 1, by + bh, P.bannerHi);
    img.px(bx + 3, by + bh - 4, P.bannerGold); img.px(bx + 4, by + bh - 4, P.bannerGold);
    img.rect(bx + 2, by + bh - 7, bx + 5, by + bh - 6, P.bannerGold);
    for (let i = 0; i < 4; i++) { img.px(bx + i * 2, by + bh + 1, P.banner); img.px(bx + i * 2 + 1, by + bh + 2, P.bannerHi); }
  };
  const topY = TOWER_LEVEL.floors[TOWER_LEVEL.topFloor].y / 2; // 57
  banner(172, 12, 24);
  banner(302, 12, 24);
  banner(100, 162, 22);
  banner(374, 112, 22);

  // the big round window above the top floor, onto a sunset (the bright spot the eye climbs toward)
  const wx = TOWER_LEVEL.princeX / 2;
  const wy = topY - 24;
  const R = 24;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      if (x * x + y * y > R * R) continue;
      const t = (y + R) / (2 * R);
      const sky = t < 0.4 ? '#6a58b0' : t < 0.6 ? '#c277b0' : t < 0.78 ? '#ff9a9a' : '#ffc88a';
      img.px(wx + x, wy + y, sky);
    }
  }
  img.ellipse(wx - 8, wy + 8, 6, 6, '#fff3c8'); // a big pale sun low in the sky
  img.ellipse(wx + 9, wy - 8, 6, 2, '#ffd9e8', 0.85); // clouds
  img.ellipse(wx + 6, wy - 6, 4, 1, '#ffd9e8', 0.85);
  img.ellipse(wx - 10, wy - 12, 4, 1, '#ffd9e8', 0.7);
  for (let x = -R; x <= R; x++) { // a skyline of towers and hills along the window's lower edge
    const ground = 17 + Math.round(3 * Math.sin(x / 5) + (Math.abs(x + 4) % 9 < 3 ? -4 : 0));
    for (let y = ground; y <= R; y++) if (x * x + y * y <= R * R) img.px(wx + x, wy + y, '#3a3a6e');
  }
  for (let r = R; r <= R + 3; r++) { // the stone ring
    for (let a = 0; a < 720; a++) {
      const ang = (a / 720) * Math.PI * 2;
      img.px(Math.round(wx + Math.cos(ang) * r), Math.round(wy + Math.sin(ang) * r), r === R + 3 ? '#454a65' : r === R ? '#8e96b8' : '#a3a9c4');
    }
  }
  for (const k of [-1, 1]) { // keystones at the ring's sides
    img.rect(wx + k * (R + 1) - 2, wy - 2, wx + k * (R + 1) + 2, wy + 2, '#b9bfd8');
  }
  // the window sill with the chameleon's perch to its right (TOWER_LEVEL.sillX/sillY)
  const sillTop = TOWER_LEVEL.sillY / 2;
  const sillX = TOWER_LEVEL.sillX / 2;
  img.rect(sillX - 14, sillTop, sillX + 14, sillTop + 3, '#8e96b8');
  img.rect(sillX - 14, sillTop, sillX + 14, sillTop, '#c9cfe6');
  img.rect(sillX - 14, sillTop + 3, sillX + 14, sillTop + 3, '#3e4460');
  img.rect(sillX - 12, sillTop + 4, sillX - 8, sillTop + 6, '#454a65'); // a corbel under it
  img.rect(sillX + 8, sillTop + 4, sillX + 12, sillTop + 6, '#454a65');

  // torch brackets (the flames are sprites in the scene) with a warm light pool round each
  for (const t of TOWER_LEVEL.torches) {
    const tx = t.x / 2;
    const ty = t.y / 2;
    img.ellipse(tx, ty, 26, 19, '#ff9a3c', 0.07);
    img.ellipse(tx, ty, 17, 12, '#ff9a3c', 0.1);
    img.ellipse(tx, ty, 9, 7, '#ffc46e', 0.14);
    img.rect(tx - 1, ty + 5, tx, ty + 12, P.iron);
    img.rect(tx - 3, ty + 4, tx + 2, ty + 5, P.ironHi);
    img.rect(tx - 2, ty + 5, tx + 1, ty + 6, P.iron);
  }

  // the beams (wooden, from the Kenney fence planks) and the stone ground floor
  const plank = cropVendor(MODERN_CITY, 374, 238, 16, 16); // vertical planks; turned so they run along the beam
  const slab = TOWER_SLAB_H / 2; // 7
  for (const f of TOWER_LEVEL.floors) {
    const x0 = f.x0 / 2;
    const x1 = f.x1 / 2;
    const y = f.y / 2;
    if (f.ground) {
      stoneRegion(innerL - 8, innerR + 8, y, h - 1, 9, '#69709a', '#7f87b0', '#4f5578', P.mortar, 29);
      img.rect(innerL - 8, y, innerR + 8, y, '#b9bfd8');
      img.rect(innerL - 8, y + 1, innerR + 8, y + 1, '#8e96b8');
      continue;
    }
    // supports under the beam: little stone corbels
    for (let cx = x0 + 18; cx < x1 - 10; cx += 64) {
      img.rect(cx, y + slab, cx + 7, y + slab + 2, '#454a65');
      img.rect(cx + 1, y + slab + 3, cx + 6, y + slab + 4, '#3a3f58');
      img.rect(cx + 2, y + slab + 5, cx + 5, y + slab + 5, '#2f3346');
    }
    for (let x = x0; x < x1; x++) { // the beam body: pack plank pixels, rows across the beam
      for (let r = 0; r < slab; r++) {
        const sx = 1 + (r % 4); // a column of the plank sheet (its rows become the beam's); column 4 is the plank seam
        const sy = 3 + (x % 12);
        const i = (sy * 16 + sx) * 4;
        img.px(x, y + r, `#${[plank.data[i], plank.data[i + 1], plank.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
      }
    }
    for (let x = x0 + 6; x < x1 - 2; x += 24) img.rect(x, y + 1, x, y + slab - 2, P.woodDark); // plank joints
    img.rect(x0, y, x1 - 1, y, P.woodLight); // lit top
    img.rect(x0, y + 1, x1 - 1, y + 1, '#d9a56e');
    img.rect(x0, y + slab - 1, x1 - 1, y + slab - 1, P.woodDark); // shaded underside
    img.rect(x0, y + slab, x1 - 1, y + slab, P.woodShadow);
    for (let x = x0 + 12; x < x1 - 4; x += 24) { // bolts
      img.px(x, y + 3, P.iron); img.px(x + 1, y + 3, P.ironHi);
    }
    for (const endX of [x0, x1 - 1]) { // iron end caps
      const open = f.flow > 0 ? endX === x1 - 1 : endX === x0;
      img.rect(endX - (endX === x0 ? 0 : 1), y, endX + (endX === x0 ? 1 : 0), y + slab, P.iron);
      if (open) img.rect(endX, y, endX, y, P.ironHi);
    }
  }

  // the ladders (wooden rails and rungs, standing on the lower beam and reaching a little above the upper one)
  for (const L of TOWER_LEVEL.ladders) {
    const lx = L.x / 2;
    const yTop = L.yTop / 2 - 7;
    const yBottom = L.yBottom / 2;
    for (const rx of [lx - 5, lx + 4]) {
      img.rect(rx, yTop, rx + 1, yBottom, P.woodMid);
      img.rect(rx, yTop, rx, yBottom, P.woodLight);
      img.rect(rx + 1, yTop, rx + 1, yBottom, P.woodDark);
      img.rect(rx - 1, yTop + 1, rx + 2, yTop + 1, P.woodDark); // rail cap
    }
    for (let y = yTop + 4; y < yBottom - 2; y += 5) {
      img.rect(lx - 4, y, lx + 3, y, P.woodLight);
      img.rect(lx - 4, y + 1, lx + 3, y + 1, P.woodDark);
      img.rect(lx - 4, y + 2, lx + 3, y + 2, '#2a2236', 0.3);
    }
  }

  vignette(img);
  return img;
}

// A final soft vignette keeps the eye in the middle (alpha bands along the very edges), so the HUD and hearts read on a darker margin.
function vignette(img) {
  for (let i = 0; i < 14; i++) {
    const a = 0.34 - i * 0.024;
    img.rect(0, i, img.w - 1, i, '#12131a', a);
    img.rect(i, 0, i, img.h - 1, '#12131a', a * 0.8);
    img.rect(img.w - 1 - i, 0, img.w - 1 - i, img.h - 1, '#12131a', a * 0.8);
  }
}

// ---------- write the files ----------

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets', 'minigames');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, built) => fs.writeFileSync(path.join(outDir, name), built.toPNG());
write('platformer-bg-far.png', buildPlatformerFar());
write('platformer-bg-mid.png', buildPlatformerMid());
write('flappy-bg.png', buildFlappyBg());
write('tower-bg.png', buildTowerBg());
write('tower-sprites.png', buildTowerSprites());
write('tower-prince.png', buildTowerPrince());
// The old single platformer-bg.png is retired (replaced by the far/mid pair above) -- remove it if a
// previous run left it behind, so assets.test.js's "every generated file is exactly what the tool
// would write" check doesn't trip over a stale, no-longer-written file.
const stale = path.join(outDir, 'platformer-bg.png');
if (fs.existsSync(stale)) fs.unlinkSync(stale);
console.log(`Wrote platformer-bg-far, platformer-bg-mid, flappy-bg, tower-bg, tower-sprites and tower-prince to ${path.relative(path.join(__dirname, '..'), outDir)}/`);
