// Themed backdrops and sprites for the 3 mini-games (docs/ROADMAP.md M4, coordinator art-pass brief
// 2026-09-22): "give each game a themed backdrop instead of black... drawn in the tools like the rest
// of the art." Same technique as tools/make-cutscenes.js -- a tiny Img/PNG writer, no dependencies,
// no photos copied -- just a second illustration set alongside the story cutscenes.
//
// The ICL flyer's camera never scrolls (the racks scroll past a fixed camera instead, flappy.js's own
// animation loop), so it gets one rich, layered backdrop (far sky/cable-tray band behind a dimmer distant
// rack row behind a brighter nearer one), composed in one image, generated at a compact scale
// (a 320x180-equivalent viewport, 1/3 of the real 960x540 canvas) and stretched 3x in-scene. Its own
// floor/foreground stays code-drawn in the scene file (FL_* constants there).
//
// Run:  node tools/make-minigame-art.js   (also runs as part of `npm run assets`)
// Output, in assets/minigames/:
//   flappy-bg.png           320x180 (compact scale), pinned: the ICL fingerprint hack's backdrop (P5c, FB-0071): a dark cyan
//                           grid receding to a horizon, circuit traces, glowing scan-line bands and a dim outer ring. The big
//                           fingerprint scanner ring and its fill (the scan progress) are drawn on top by src/minigames/flappy.js.
//   flappy-sprites.png      64x16, four 16x16 frames (P5c): the glowing data packet the player flies (a diamond core, a trailing
//                           spark; frames 0-3 are its glow pulse). Code-composed from a small cyan palette, like the ICL lab kit.
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
//   hero-bg.png             480x270 (half scale, stretched 2x): the Physics Lab key's hero fight (FB-0066): a lab rooftop at
//                           sunset. A pink-orange sky with a big pale sun and layered cloud bands, a dark city skyline, a
//                           "PHYSICS LAB" sign, vents and a dish on the roof, the three scaffold platforms (read from
//                           src/minigames/hero-logic.js HV_LEVEL, so art and rules cannot drift) and the roof itself (a crop
//                           of the CC0 Kenney Roguelike Modern City roof tiles).
//   hero-sprites.png        256x128, 32x32 cells (frame order = HVS_FRAME in src/minigames/hero.js): the kitten hero (idle x2,
//                           run x4, jump, shoot, hurt, cheer), the shadow bat (idle x2, two wind-up poses, fire, hurt, down),
//                           the robot-bat minion (two flaps, defeated), his bolt (2 frames), her star bolt (2), hearts, a spark,
//                           a wind-up ring, a puff, a sparkle and his shield. GENERIC stand-ins (ADR 0021): a white kitten with
//                           a pink bow, a purple mask and a teal cape; a dark bat-eared caped figure. Nothing is copied from any
//                           real character. All code-composed from the project palette.
//   hero-bar.png            80x10: the villain's health bar frame (its inside is transparent; the scene draws the fill behind it).
//   hero-cover.png          480x270 (half scale, stretched 2x): the hero game's COVER (FB-0066 item M5), behind the intro card: a
//                           sunset, a big pale sun, cloud bands, dark city skyline at the sides, a rooftop ledge in the foreground
//                           with the two stand-ins posed close together (kitten left, shadow bat right) and a title banner.
//   edi-bg-1.png .. edi-bg-3.png   960x540 (full size, drawn 1:1): the three EDI Madness garages (ICL scanner game, ADR 0025), one per
//                           stage: concrete floor, lane and bay lines, the target bay (white outline, a big P), the walls and the
//                           hazard-striped pillars, every parked car in its slot, painted arrows, ceiling lamps and a P sign. Everything is read
//                           from src/minigames/edi-logic.js EDI_STAGES (so the solid things drawn are exactly the collision rectangles).
//                           Drawn by tools/lib/edi-art.js.
//   edi-cars.png            448x392, 56x56 cells, 8 headings per row (E SE S SW W NW N NE: frame = Math.round(heading / (PI / 4)) mod 8,
//                           heading 0 = east, clockwise), rows = learner (white, green trim, an "L" sign), green, grey, orange, red, yellow,
//                           blue (EDI_CAR_ROWS in tools/lib/edi-art.js). The CC0 Kenney Roguelike Modern City car (side, front and back views);
//                           the diagonals are the side view turned 45 degrees in code. The car is 44 px long, the logic's hitbox.
//   edi-sprites.png         256x32, 32x32 cells: heart full, heart empty, bump spark, stars puff, green tick, STOP tag, brake dust, sparkle.
//   edi-instructor.png      96x48, two 48x48 frames: the driving instructor's HUD portrait (neutral, wincing); the head of the project's
//                           own student sheet, redressed (dark hair, green cap, moustache, white polo with a green collar).
//   edi-cover.png           480x270 (half scale, stretched 2x): the EDI Madness COVER behind the intro card: title ribbon, checkered stripe,
//                           the learner car, the instructor in a speech bubble, a pillar and a P sign. Generic lettering, no real logo.
// `--out <dir>` writes elsewhere (tests check the files are up to date), matching the convention in
// tools/make-assets.js / tools/make-cutscenes.js.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { encodePNG } = require('./lib/png');
const { decodePNG } = require('./lib/png-decode');

// The compact scale the flyer's backdrop is authored at (a 320x180-equivalent viewport, 1/3 of the real 960x540
// canvas -- src/state.js ZOOM=3). The tower and the hero fight are authored at half scale instead (480x270).
const VIEW_W = 320;
const VIEW_H = 180;

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

// ---------- ICL fingerprint hack (flappy, P5c FB-0071) ----------
// "dark cyan grid background with a big glowing fingerprint scanner ring behind the play field": the backdrop here is the dark cyan
// grid (a vertical gradient, a perspective floor grid, a faint vertical grid, circuit traces and thin glowing scan-line bands) with a dim
// outer ring; the scanner ring and the fingerprint inside it are vector arcs that src/minigames/flappy.js draws over it, because they
// FILL as the score rises. Sized to the compact scale (the flyer's camera never scrolls) and stretched 3x in-scene.

function buildFlappyBg() {
  const img = new Img(VIEW_W, VIEW_H);
  const C = {
    top: '#050d18', mid: '#081c2c', low: '#0c2e40',
    grid: '#16506a', gridHi: '#1f7a99', trace: '#12435a', node: '#2fc9e8', band: '#4de3ff',
  };
  img.vGradient(0, VIEW_H - 1, [[0, C.top], [0.55, C.mid], [1, C.low]]);

  // A faint square grid over the whole frame (every 10 px), brighter every 5th line.
  for (let x = 0; x < VIEW_W; x += 10) img.rect(x, 0, x, VIEW_H - 1, x % 50 === 0 ? C.gridHi : C.grid, x % 50 === 0 ? 0.28 : 0.16);
  for (let y = 0; y < VIEW_H; y += 10) img.rect(0, y, VIEW_W - 1, y, y % 50 === 0 ? C.gridHi : C.grid, y % 50 === 0 ? 0.28 : 0.16);

  // Circuit traces: a few right-angled lines with a lit node at each corner, hugging the top and bottom edges (clear of the play field).
  const traces = [
    [[12, 18], [12, 8], [64, 8], [64, 14]],
    [[250, 10], [300, 10], [300, 24]],
    [[30, 150], [30, 163], [110, 163]],
    [[210, 165], [262, 165], [262, 150], [306, 150]],
    [[120, 20], [150, 20], [150, 12], [190, 12]],
  ];
  for (const path of traces) {
    for (let i = 0; i < path.length - 1; i++) img.line(path[i][0], path[i][1], path[i + 1][0], path[i + 1][1], 1, C.trace);
    for (const [x, y] of path) { img.rect(x - 1, y - 1, x + 1, y + 1, C.trace); img.px(x, y, C.node, 0.8); }
  }

  // Thin glowing scan-line bands drifting across the room (static here; the glow is a soft cyan, never white).
  for (const y of [42, 96, 138]) {
    img.rect(0, y, VIEW_W - 1, y, C.band, 0.07);
    img.rect(0, y + 1, VIEW_W - 1, y + 1, C.band, 0.03);
  }

  // The dim outer ring of the scanner, centred where flappy.js draws its own (a 3x stretch puts it at the middle of the canvas).
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2 - 4;
  for (let a = 0; a < 720; a++) {
    const t = (a / 720) * Math.PI * 2;
    for (const [r, alpha] of [[78, 0.35], [79, 0.22], [77, 0.12]]) img.px(cx + Math.cos(t) * r, cy + Math.sin(t) * r, C.gridHi, alpha);
  }
  // Tick marks round it, like a dial.
  for (let k = 0; k < 48; k++) {
    const t = (k / 48) * Math.PI * 2;
    const r0 = 81;
    const r1 = k % 4 === 0 ? 87 : 84;
    img.line(cx + Math.cos(t) * r0, cy + Math.sin(t) * r0, cx + Math.cos(t) * r1, cy + Math.sin(t) * r1, 1, C.gridHi, 0.3);
  }
  return img;
}

// The data packet the player flies (flappy.js): a glowing diamond with a bright core and a trailing spark, four glow-pulse frames (16x16).
function buildFlappySprites() {
  const img = new Img(64, 16);
  const P = { core: '#f2fdff', hot: '#b9f6ff', mid: '#4de3ff', rim: '#1e9ec4', deep: '#0e5a78', glow: '#4de3ff' };
  for (let f = 0; f < 4; f++) {
    const ox = f * 16;
    const pulse = [0, 1, 2, 1][f];
    // a soft glow round the diamond
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - 9.5) + Math.abs(y - 7.5);
      if (d > 6 && d <= 7 + pulse) img.px(ox + x, y, P.glow, 0.22 + 0.06 * pulse);
    }
    // the diamond (a rotated square, 11 px across), outlined, with a lit top-left facet
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = x - 9.5, dy = y - 7.5;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d <= 5.5) img.px(ox + x, y, d > 4.5 ? P.rim : d > 2.5 ? P.mid : P.hot);
    }
    img.px(ox + 9, 7, P.core); img.px(ox + 10, 7, P.core); img.px(ox + 9, 8, P.core);
    img.px(ox + 8, 5, P.hot); img.px(ox + 7, 6, P.hot);
    // the trailing spark: a short tail behind it (to the left) that twinkles
    img.px(ox + 3, 7, P.mid); img.px(ox + 2, 8, P.rim);
    img.px(ox + 4 + (f % 2), 5 - (f > 1 ? 1 : 0), P.hot, 0.8);
    img.px(ox + 1 + f % 3, 7 + (f % 2), P.deep);
  }
  return img;
}

// ---------- Room 195: the tower climb (FB-0074) ----------
// The level's numbers (floors, ladders, torches, the window) come straight from src/minigames/tower-logic.js, evaluated here, so the
// beams and ladders painted into the backdrop are exactly where the rules put them. Everything is drawn in "compact" pixels (half the
// real 960x540 canvas, stretched 2x in-scene), like the other backdrops; the sprites are drawn at native size and the scene scales
// them 2x, so one art pixel is the same size everywhere (the lead's 16x24 sprite is 32x48 on screen).

function loadTowerLevel() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'minigames', 'tower-logic.js'), 'utf8');
  // tower-logic.js only needs the platformer-physics coyote constant while it loads (its helper calls happen later, in a scene).
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

// ---------- Physics Lab: the hero fight (FB-0066) ----------
// A small white kitten hero (a pink bow, a purple mask, a teal cape, big eyes) against a dark bat-eared caped "shadow bat". Both are
// GENERIC stand-ins (ADR 0021: Taru asked for her favourite characters, who are protected; nothing here copies their faces, colours or
// logos): the kitten has big blue eyes in a mask, a tiny pink nose, no whiskers and no yellow nose; the villain has no emblem and no
// yellow belt. Everything is composed from code and the project palette, and the roof is a crop of the CC0 Kenney Roguelike Modern City tiles.

function loadHeroLevel() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'minigames', 'hero-logic.js'), 'utf8');
  // hero-logic.js only needs the platformer's coyote constant while it loads (its helper calls happen later, in a scene).
  const context = vm.createContext({ PLATFORMER_COYOTE_MS: 110, Math });
  vm.runInContext(`${source}\nthis.__hero = { HV_LEVEL, HV_W, HV_H, HV_FLOOR_Y, HV_PLATFORMS };`, context);
  return context.__hero;
}

const HV_PAL = {
  K: '#1a1c2c', // the project's outline
  // the kitten
  fur: '#f7f3ec', furShade: '#d9d2e0', furDark: '#b3aac8', earIn: '#ffb3d4',
  pink: '#ff6fb1', pinkHi: '#ffb3d4', pinkDark: '#c2417f',
  mask: '#6b4fa8', maskHi: '#8b6fc8',
  eyeWhite: '#ffffff', iris: '#3a5fc8', irisHi: '#7fb0ff', nose: '#ff7d9c',
  cape: '#2fb4d4', capeHi: '#7fe0f0', capeDark: '#1f7e9c',
  boot: '#c2417f', glove: '#ffffff',
  // her star bolt
  star: '#ffd23f', starHi: '#fff3b0', starDark: '#d9961f',
  // the shadow bat
  cowl: '#2b2a45', cowlHi: '#46446b', suit: '#22223f', suitHi: '#3a3a64', gloveV: '#a39fc8',
  capeV: '#7452a8', capeVHi: '#9a78cc', capeVDark: '#4d3382', belt: '#4a4868', buckle: '#9593b2',
  skin: '#3a3664', skinDark: '#2b2850', slit: '#ff9cf0', slitGlow: '#ffffff',
  orb: '#b05cff', orbHi: '#e8c4ff', orbDark: '#6d2fb5',
  // the minion
  mBody: '#3c3f5c', mHi: '#5a5e86', mWing: '#2a2c44', mWingHi: '#454968', mEye: '#ff4d5e', mEyeHi: '#ffc2c9', mFang: '#f4f1ea',
};

function fillTri(img, a, b, c, hex) {
  const minX = Math.floor(Math.min(a[0], b[0], c[0]));
  const maxX = Math.ceil(Math.max(a[0], b[0], c[0]));
  const minY = Math.floor(Math.min(a[1], b[1], c[1]));
  const maxY = Math.ceil(Math.max(a[1], b[1], c[1]));
  const edge = (p, q, x, y) => (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const w0 = edge(a, b, x, y);
      const w1 = edge(b, c, x, y);
      const w2 = edge(c, a, x, y);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) img.px(x, y, hex);
    }
  }
}

// A polygon fill by scanlines (convex or not), pixel centres.
function fillPoly(img, pts, hex) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x <= Math.round(xs[i + 1]) - 1; x++) img.px(x, y, hex);
  }
}

// Nearest-neighbour scale (the cover draws the sprites 2x into a half-scale image).
function scaleImg(src, k) {
  const out = new Img(src.w * k, src.h * k);
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const i = ((Math.floor(y / k)) * src.w + Math.floor(x / k)) * 4;
      if (src.data[i + 3] > 0) out.pxA(x, y, src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]);
    }
  }
  return out;
}

// Semi-transparent paint that keeps the transparency of what is under it (Img.px would make a faded pixel opaque black-blended).
function glow(img, x, y, hex, alpha) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  const i = (y * img.w + x) * 4;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a0 = img.data[i + 3] / 255;
  const a = alpha + a0 * (1 - alpha);
  if (a0 === 0) { img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = Math.round(alpha * 255); return; }
  img.data[i] = Math.round((img.data[i] * a0 * (1 - alpha) + r * alpha) / a);
  img.data[i + 1] = Math.round((img.data[i + 1] * a0 * (1 - alpha) + g * alpha) / a);
  img.data[i + 2] = Math.round((img.data[i + 2] * a0 * (1 - alpha) + b * alpha) / a);
  img.data[i + 3] = Math.round(a * 255);
}

// ----- the kitten hero (faces right; the scene flips her for left) -----
// pose: bob (0|1: the head and torso dip), legs 'stand'|'runA'|'runB'|'runC'|'runD'|'tuck', arms 'down'|'shoot'|'up'|'cheer',
// cape 'hang'|'stream'|'up', eyes 'open'|'hurt'|'happy'
function drawKitten(pose) {
  const P = HV_PAL;
  const img = new Img(32, 32);
  const bob = pose.bob || 0;
  const hx = 16; // head centre x
  const hy = 12 + bob;
  const top = 19 + bob; // the shoulders

  // cape, behind everything (a bell, two wings of teal either side of her, or streaming out behind her)
  if (pose.cape === 'stream') {
    fillPoly(img, [[12, top], [20, top], [15, 29], [1, 28], [3, 23]], P.cape);
    fillPoly(img, [[12, top], [15, top], [7, 25], [3, 23]], P.capeHi);
    for (const [x, y] of [[3, 28], [6, 28], [9, 29], [12, 29]]) img.px(x, y, P.capeDark);
  } else if (pose.cape === 'up') {
    fillPoly(img, [[12, top], [20, top], [15, 23], [4, 19], [5, 13]], P.cape);
    fillPoly(img, [[12, top], [15, top], [8, 18], [5, 14]], P.capeHi);
  } else {
    fillPoly(img, [[11, top], [21, top], [27, 29], [5, 29]], P.cape);
    fillPoly(img, [[11, top], [14, top], [9, 29], [5, 29]], P.capeHi);
    for (const x of [6, 9, 12, 20, 23, 26]) img.px(x, 29, P.capeDark);
  }

  // tail (curling up behind her)
  const tail = pose.cape === 'stream' ? [[11, 26], [8, 26], [5, 24]] : [[10, 26], [7, 25], [5, 22], [5, 18]];
  for (let i = 0; i + 1 < tail.length; i++) img.line(tail[i][0], tail[i][1] + bob, tail[i + 1][0], tail[i + 1][1] + bob, 2, P.fur);
  img.px(tail[tail.length - 1][0], tail[tail.length - 1][1] + bob, P.furShade);

  // legs and boots
  const legRows = { stand: [[12, 0], [17, 0]], runA: [[10, 0], [18, -2]], runB: [[12, -1], [16, 0]], runC: [[14, 0], [11, -2]], runD: [[16, -1], [12, 0]], tuck: [[12, -4], [17, -4]] }[pose.legs || 'stand'];
  for (const [lx, up] of legRows) {
    img.rect(lx, 27 + up, lx + 2, 28 + up, P.fur);
    img.rect(lx, 29 + up, lx + 2, 29 + up, P.boot);
    img.px(lx, 29 + up, P.pinkDark);
  }

  // body, a little pink bow at the neck, arms
  img.ellipse(16, 24 + bob, 5, 5, P.fur);
  img.ellipse(16, 26 + bob, 3, 2, P.furShade);
  img.rect(13, 19 + bob, 19, 19 + bob, P.pink);
  img.rect(15, 20 + bob, 17, 21 + bob, P.pinkDark);
  img.px(12, 20 + bob, P.pink); img.px(20, 20 + bob, P.pink); img.px(15, 20 + bob, P.pinkHi);
  const arm = (x0, y0, x1, y1) => { img.line(x0, y0, x1, y1, 2, P.fur); img.px(x1, y1, P.glove); };
  if (pose.arms === 'shoot') { arm(20, 23 + bob, 26, 22 + bob); arm(12, 24 + bob, 11, 27 + bob); img.px(27, 22 + bob, P.star); img.px(28, 21 + bob, P.starHi); img.px(28, 23 + bob, P.starHi); }
  else if (pose.arms === 'up') { arm(11, 23 + bob, 8, 18 + bob); arm(21, 23 + bob, 24, 18 + bob); }
  else if (pose.arms === 'cheer') { arm(11, 23 + bob, 7, 16 + bob); arm(21, 23 + bob, 25, 16 + bob); }
  else { arm(11, 23 + bob, 10, 26 + bob); arm(21, 23 + bob, 22, 26 + bob); }

  // head: pointed ears, a round face, the mask, big eyes, a tiny pink nose and mouth, the pink bow between the ears
  fillTri(img, [8, 1 + bob], [7, 9 + bob], [14, 6 + bob], P.fur);
  fillTri(img, [24, 1 + bob], [25, 9 + bob], [18, 6 + bob], P.fur);
  fillTri(img, [8.5, 3.5 + bob], [8.5, 8 + bob], [12, 6.5 + bob], P.earIn);
  fillTri(img, [23.5, 3.5 + bob], [23.5, 8 + bob], [20, 6.5 + bob], P.earIn);
  img.ellipse(hx, hy, 9, 6, P.fur);
  img.ellipse(hx, hy + 2, 7, 4, P.fur);
  img.ellipse(hx, hy + 5, 5, 1, P.furShade);
  // the mask: two purple patches round the eyes joined over the nose, with a lit top edge
  img.ellipse(12, hy, 3, 3, P.mask);
  img.ellipse(20, hy, 3, 3, P.mask);
  img.rect(14, hy - 1, 18, hy, P.mask);
  img.rect(10, hy - 3, 14, hy - 3, P.maskHi); img.rect(18, hy - 3, 22, hy - 3, P.maskHi);
  const eye = (ex) => {
    if (pose.eyes === 'hurt') { img.line(ex - 1, hy - 1, ex + 1, hy + 1, 1, P.K); img.line(ex + 1, hy - 1, ex - 1, hy + 1, 1, P.K); return; }
    if (pose.eyes === 'happy') { img.px(ex - 1, hy + 1, P.K); img.px(ex, hy, P.K); img.px(ex + 1, hy + 1, P.K); return; }
    img.rect(ex - 1, hy - 2, ex + 1, hy + 2, P.eyeWhite);
    for (const [cx, cy] of [[-1, -2], [1, -2], [-1, 2], [1, 2]]) img.px(ex + cx, hy + cy, P.mask); // rounded corners
    img.rect(ex - 1, hy - 1, ex + 1, hy + 2, P.iris);
    img.rect(ex, hy, ex, hy + 1, P.K);
    img.px(ex - 1, hy - 1, P.eyeWhite); img.px(ex + 1, hy + 2, P.irisHi);
  };
  eye(12); eye(20);
  img.rect(15, hy + 4, 16, hy + 4, P.nose);
  img.px(14, hy + 5, P.K); img.px(15, hy + 6, P.K); img.px(16, hy + 6, P.K); img.px(17, hy + 5, P.K);
  img.px(10, hy + 4, P.pinkHi); img.px(22, hy + 4, P.pinkHi);
  img.rect(13, hy - 9, 15, hy - 6, P.pink); img.rect(18, hy - 9, 20, hy - 6, P.pink);
  img.rect(16, hy - 8, 17, hy - 7, P.pinkDark);
  img.px(13, hy - 9, P.pinkHi); img.px(18, hy - 9, P.pinkHi);
  img.px(14, hy - 6, P.pinkDark); img.px(19, hy - 6, P.pinkDark);
  outlineSprite(img);
  return img;
}

// ----- the shadow bat (faces left; the scene flips him for right) -----
// pose: arms 'cross'|'raise'|'fire'|'slump', orb 0|1|2 (a purple energy ball over his raised hand), eyes 'open'|'closed', tilt (px shift), down (kneeling)
function drawVillain(pose) {
  const P = HV_PAL;
  const img = new Img(32, 32);
  const dx = pose.tilt || 0;
  const cx = 15 + dx;

  if (pose.down) {
    // slumped on one knee: a cape heap, the head bowed, the ears drooping
    fillPoly(img, [[cx - 11, 30], [cx - 7, 21], [cx + 7, 21], [cx + 12, 30]], P.capeV);
    fillPoly(img, [[cx - 11, 30], [cx - 9, 24], [cx - 6, 30]], P.capeVHi);
    for (const x of [-10, -6, -2, 2, 6, 10]) img.px(cx + x, 30, P.capeVDark);
    img.ellipse(cx - 3, 19, 6, 5, P.cowl);
    fillTri(img, [cx - 9, 17], [cx - 9, 13], [cx - 5, 15], P.cowl);
    fillTri(img, [cx + 3, 17], [cx + 3, 13], [cx - 1, 15], P.cowl);
    img.rect(cx - 6, 20, cx - 1, 22, P.skin);
    img.px(cx - 6, 19, P.slit); img.px(cx - 5, 19, P.slit); img.px(cx - 2, 19, P.slit); img.px(cx - 1, 19, P.slit);
    img.rect(cx - 9, 24, cx - 5, 25, P.gloveV); // a hand on the roof
    outlineSprite(img);
    return img;
  }

  // the cape: a big scalloped shape behind him (wide at the hem)
  fillPoly(img, [[cx - 7, 14], [cx + 7, 14], [cx + 14, 30], [cx - 14, 30]], P.capeV);
  fillPoly(img, [[cx - 7, 14], [cx - 4, 14], [cx - 11, 30], [cx - 14, 30]], P.capeVHi);
  fillPoly(img, [[cx + 4, 14], [cx + 7, 14], [cx + 14, 30], [cx + 10, 30]], P.capeVDark);
  for (const x of [-12, -8, -4, 0, 4, 8, 12]) { img.px(cx + x, 30, P.capeVDark); img.px(cx + x + 1, 31, P.capeVDark); }
  // a high pointed collar
  fillTri(img, [cx - 8, 10], [cx - 8, 15], [cx - 4, 14], P.capeVDark);
  fillTri(img, [cx + 8, 10], [cx + 8, 15], [cx + 4, 14], P.capeVDark);
  // torso (a dark suit with a plain grey belt: no emblem, nothing yellow)
  img.ellipse(cx, 19, 5, 6, P.suit);
  img.rect(cx - 3, 15, cx - 2, 20, P.suitHi);
  img.rect(cx - 5, 23, cx + 5, 24, P.belt);
  img.rect(cx - 1, 23, cx + 1, 24, P.buckle);
  // head: a cowl with tall bat ears and a shadowed muzzle, glowing pink slit eyes
  fillTri(img, [cx - 6, 0], [cx - 7, 8], [cx - 2, 5], P.cowl);
  fillTri(img, [cx + 6, 0], [cx + 7, 8], [cx + 2, 5], P.cowl);
  img.px(cx - 6, 2, P.cowlHi); img.px(cx - 6, 3, P.cowlHi); img.px(cx + 6, 2, P.cowlHi);
  img.ellipse(cx, 8, 6, 5, P.cowl);
  img.rect(cx - 4, 4, cx + 3, 4, P.cowlHi);
  img.rect(cx - 4, 9, cx + 4, 12, P.skin); // the lower face
  img.rect(cx - 4, 12, cx + 4, 12, P.skinDark);
  if (pose.eyes === 'closed') { img.line(cx - 4, 8, cx - 2, 8, 1, P.slit); img.line(cx + 2, 8, cx + 4, 8, 1, P.slit); }
  else {
    img.rect(cx - 4, 7, cx - 2, 8, P.slit); img.px(cx - 4, 6, P.cowl); img.px(cx - 3, 6, P.cowl); // angry slits slanting to the nose
    img.rect(cx + 2, 7, cx + 4, 8, P.slit); img.px(cx + 3, 6, P.cowl); img.px(cx + 4, 6, P.cowl);
    img.px(cx - 3, 8, P.slitGlow); img.px(cx + 3, 8, P.slitGlow);
  }
  for (const fx of [-3, 0, 3]) img.px(cx + fx, 11, '#e8e0ff'); // three tiny fangs in the shadow of the cowl

  // arms
  const glove = (x, y) => img.rect(x, y, x + 2, y + 2, P.gloveV);
  if (pose.arms === 'raise') {
    img.line(cx - 5, 17, cx - 9, 10, 2, P.suit); glove(cx - 11, 8);
    img.line(cx + 5, 17, cx + 9, 10, 2, P.suit); glove(cx + 9, 8);
    const r = pose.orb === 2 ? 4 : 2;
    img.ellipse(cx - 10, 4, r, r, P.orbDark);
    img.ellipse(cx - 10, 4, r - 1, r - 1, P.orb);
    img.px(cx - 10, 3, P.orbHi); img.px(cx - 11, 3, P.orbHi);
  } else if (pose.arms === 'fire') {
    img.line(cx - 4, 17, cx - 13, 18, 2, P.suit); glove(cx - 15, 17);
    img.px(cx - 16, 18, P.orbHi); img.px(cx - 17, 18, P.orb); img.px(cx - 16, 16, P.orb); img.px(cx - 16, 20, P.orb); // the muzzle flash
    img.line(cx + 4, 18, cx + 6, 22, 2, P.suit); glove(cx + 5, 22);
  } else if (pose.arms === 'slump') {
    img.line(cx - 5, 18, cx - 7, 24, 2, P.suit); glove(cx - 8, 24);
    img.line(cx + 5, 18, cx + 7, 24, 2, P.suit); glove(cx + 6, 24);
  } else { // arms crossed over the chest
    img.line(cx - 6, 18, cx + 4, 20, 2, P.suit); img.line(cx + 6, 18, cx - 4, 20, 2, P.suit);
    glove(cx + 3, 19); glove(cx - 5, 19);
  }
  outlineSprite(img);
  return img;
}

// ----- the minion: a round robot-bat with a red eye, flapping -----
function drawMinion(frame) {
  const P = HV_PAL;
  const img = new Img(32, 32);
  if (frame === 'down') { // defeated: a ring of sparks and a cracked eye
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      img.rect(Math.round(16 + Math.cos(ang) * 7), Math.round(22 + Math.sin(ang) * 5), Math.round(16 + Math.cos(ang) * 7) + 1, Math.round(22 + Math.sin(ang) * 5) + 1, a % 2 ? P.star : P.mEyeHi);
    }
    img.ellipse(16, 22, 4, 3, P.mBody);
    img.px(15, 22, P.mEye); img.px(17, 21, P.mEye);
    outlineSprite(img);
    return img;
  }
  const up = frame === 'up';
  // wings (up: raised, down: lowered), behind the body
  const wingL = up ? [[9, 20], [1, 10], [4, 16], [3, 22]] : [[9, 20], [0, 26], [4, 22], [2, 20]];
  const wingR = up ? [[23, 20], [31, 10], [28, 16], [29, 22]] : [[23, 20], [32, 26], [28, 22], [30, 20]];
  fillPoly(img, wingL, P.mWing);
  fillPoly(img, wingR, P.mWing);
  img.line(wingL[0][0], wingL[0][1], wingL[1][0], wingL[1][1], 1, P.mWingHi);
  img.line(wingR[0][0], wingR[0][1], wingR[1][0], wingR[1][1], 1, P.mWingHi);
  // body: a round dark shell, a lit top, one big red eye, two little fangs, short legs, an antenna
  img.ellipse(16, 22, 8, 7, P.mBody);
  img.ellipse(16, 19, 6, 3, P.mHi);
  img.ellipse(16, 22, 3, 3, P.mEye);
  img.px(15, 21, P.mEyeHi); img.px(16, 21, P.mEyeHi);
  img.px(14, 26, P.mFang); img.px(18, 26, P.mFang);
  img.rect(12, 28, 13, 29, P.mWing); img.rect(19, 28, 20, 29, P.mWing);
  fillTri(img, [11, 15], [9, 11], [13, 14], P.mBody); // bat ears
  fillTri(img, [21, 15], [23, 11], [19, 14], P.mBody);
  img.line(16, 15, 16, 12, 1, P.mWingHi);
  img.px(16, 11, P.mEye);
  outlineSprite(img);
  return img;
}

// ----- bolts and small effects -----
const HV_STAR = [
  '....Y....',
  '...YWY...',
  '...YWY...',
  'YYYYWYYYY',
  '.YWWWWWY.',
  '..YWWWY..',
  '..YWYWY..',
  '.YY...YY.',
  '.Y.....Y.',
];

function drawVillainBolt(big) {
  const P = HV_PAL;
  const img = new Img(10, 10);
  const r = big ? 4 : 3;
  img.ellipse(5, 5, r, r, P.orbDark);
  img.ellipse(5, 5, r - 1, r - 1, P.orb);
  img.px(4, 4, P.orbHi); img.px(5, 4, P.orbHi); img.px(4, 5, P.orbHi);
  outlineSprite(img);
  return img;
}

function drawStar(frame) {
  const img = new Img(11, 11);
  drawRows(img, 1, 1, HV_STAR, { Y: HV_PAL.star, W: HV_PAL.starHi });
  if (frame === 1) { // the second frame: a little rotated, a spark off the tail
    img.px(0, 5, HV_PAL.starHi); img.px(10, 5, HV_PAL.starHi); img.px(5, 0, HV_PAL.starDark);
  }
  outlineSprite(img);
  return img;
}

function drawSpark() { // a hit burst
  const img = new Img(15, 15);
  const pal = { Y: '#ffd23f', W: '#ffffff', O: '#ff8a1c' };
  drawRows(img, 0, 0, [
    '.......O.......',
    '.......Y.......',
    '..O....Y....O..',
    '...Y...W...Y...',
    '....Y..W..Y....',
    '.....YYWYY.....',
    'O.....YWY.....O',
    'YYYYWWWWWWWYYYY',
    'O.....YWY.....O',
    '.....YYWYY.....',
    '....Y..W..Y....',
    '...Y...W...Y...',
    '..O....Y....O..',
    '.......Y.......',
    '.......O.......',
  ], pal);
  return img;
}

function drawRing() { // the wind-up flash: a soft purple ring and a bright centre
  const img = new Img(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5);
      if (d > 14.5) continue;
      const edge = Math.abs(d - 12);
      if (edge < 1.6) glow(img, x, y, HV_PAL.orbHi, 0.95);
      else if (edge < 3) glow(img, x, y, HV_PAL.orb, 0.55);
      else if (d < 9) glow(img, x, y, HV_PAL.orb, 0.22);
    }
  }
  return img;
}

function drawShield() { // his shield: a pale bubble with a bright rim and a glint
  const img = new Img(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x - 15.5, y - 15.5);
      if (d > 15) continue;
      if (d > 13.4) glow(img, x, y, '#cfe9ff', 0.95);
      else glow(img, x, y, '#9fd0ff', 0.2);
    }
  }
  for (const [x, y] of [[8, 8], [9, 7], [7, 9], [10, 7]]) glow(img, x, y, '#ffffff', 0.95);
  return img;
}

function heroUiHeart(full) {
  const img = new Img(9, 9);
  const pal = full
    ? { K: HV_PAL.K, R: '#e8465a', r: '#b02a44', H: '#ffb3c0' }
    : { K: HV_PAL.K, R: '#767b92', r: '#5a5f76', H: '#9a9fb4' };
  drawRows(img, 0, 0, HEART, pal);
  return img;
}

function buildHeroSprites() {
  const sheet = new Img(256, 128);
  const put = (col, row, sprite, footRow = null) => {
    const x = Math.floor((32 - sprite.w) / 2);
    const y = footRow !== null ? footRow - sprite.h : Math.floor((32 - sprite.h) / 2);
    sheet.blit(sprite, col * 32 + x, row * 32 + y);
  };
  const cell = (col, row, sprite) => sheet.blit(sprite, col * 32, row * 32); // a sprite that is already a full 32x32 cell
  // row 0: the kitten: idle, idle (breath), run x4, jump, shoot
  cell(0, 0, drawKitten({ bob: 0, legs: 'stand', arms: 'down', cape: 'hang', eyes: 'open' }));
  cell(1, 0, drawKitten({ bob: 1, legs: 'stand', arms: 'down', cape: 'hang', eyes: 'open' }));
  cell(2, 0, drawKitten({ bob: 0, legs: 'runA', arms: 'down', cape: 'stream', eyes: 'open' }));
  cell(3, 0, drawKitten({ bob: 1, legs: 'runB', arms: 'down', cape: 'stream', eyes: 'open' }));
  cell(4, 0, drawKitten({ bob: 0, legs: 'runC', arms: 'down', cape: 'stream', eyes: 'open' }));
  cell(5, 0, drawKitten({ bob: 1, legs: 'runD', arms: 'down', cape: 'stream', eyes: 'open' }));
  cell(6, 0, drawKitten({ bob: 0, legs: 'tuck', arms: 'up', cape: 'up', eyes: 'open' }));
  cell(7, 0, drawKitten({ bob: 0, legs: 'stand', arms: 'shoot', cape: 'hang', eyes: 'open' }));
  // row 1: kitten hurt and cheering; the shadow bat idle x2, wind-up x2, fire, hurt
  cell(0, 1, drawKitten({ bob: 1, legs: 'stand', arms: 'up', cape: 'up', eyes: 'hurt' }));
  cell(1, 1, drawKitten({ bob: 0, legs: 'stand', arms: 'cheer', cape: 'hang', eyes: 'happy' }));
  cell(2, 1, drawVillain({ arms: 'cross', eyes: 'open', tilt: 0 }));
  cell(3, 1, drawVillain({ arms: 'cross', eyes: 'open', tilt: 1 }));
  cell(4, 1, drawVillain({ arms: 'raise', orb: 1, eyes: 'open' }));
  cell(5, 1, drawVillain({ arms: 'raise', orb: 2, eyes: 'open' }));
  cell(6, 1, drawVillain({ arms: 'fire', eyes: 'open' }));
  cell(7, 1, drawVillain({ arms: 'slump', eyes: 'closed', tilt: 2 }));
  // row 2: the villain down; the minion x3; his bolt x2; her star x2
  cell(0, 2, drawVillain({ down: true }));
  cell(1, 2, drawMinion('up'));
  cell(2, 2, drawMinion('flat'));
  cell(3, 2, drawMinion('down'));
  put(4, 2, drawVillainBolt(false));
  put(5, 2, drawVillainBolt(true));
  put(6, 2, drawStar(0));
  put(7, 2, drawStar(1));
  // row 3: hearts, spark, the wind-up ring, a puff, a sparkle, the shield
  put(0, 3, heroUiHeart(true));
  put(1, 3, heroUiHeart(false));
  put(2, 3, drawSpark());
  cell(3, 3, drawRing());
  put(4, 3, drawPuff());
  const sparkle = new Img(7, 7);
  drawRows(sparkle, 0, 0, SPARKLE, { Y: '#ffd23f', W: '#ffffff' });
  put(5, 3, sparkle);
  cell(6, 3, drawShield());
  return sheet;
}

// The villain's health bar frame: a dark rail with a pale lit edge and little bat-ear notches at both ends. The inside (x 2..77, y 2..7) is transparent.
function buildHeroBar() {
  const img = new Img(80, 10);
  img.rect(0, 0, 79, 9, HV_PAL.K);
  img.rect(1, 1, 78, 8, '#454a65');
  img.rect(1, 1, 78, 1, '#8e96b8');
  for (let y = 2; y <= 7; y++) for (let x = 2; x <= 77; x++) img.pxA(x, y, 0, 0, 0, 0); // the window
  for (const x of [1, 78]) img.rect(x, 3, x, 6, '#8e96b8');
  for (const [x, y] of [[0, 0], [79, 0], [0, 9], [79, 9]]) img.pxA(x, y, 0, 0, 0, 0); // rounded corners
  return img;
}

// ----- shared bits of the two big pictures: the sunset sky, the skyline, the roof -----
const SUNSET = {
  sky: [[0, '#5a3d8f'], [0.2, '#8f58a8'], [0.4, '#d9689a'], [0.58, '#ff7f86'], [0.78, '#ffa878'], [1, '#ffd08a']],
  sun: '#fff3c8', sunHalo: '#ffe0c0', cloudA: '#ffb7c8', cloudB: '#e089b8', cloudC: '#8a5aa8',
  far: '#8a4f90', near: '#4a2f6e', nearer: '#2c1f4d', win: '#ffd98a', winPink: '#ff9ec0',
};

// A layered sky: the gradient, a big pale sun with a halo, and long cloud bands in three tones.
function paintSunsetSky(img, w, h, sunX, sunY, sunR) {
  const stops = SUNSET.sky;
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1);
    let hex = stops[0][1];
    for (const [stopT, stopHex] of stops) if (t >= stopT) hex = stopHex;
    img.rect(0, y, w - 1, y, hex);
  }
  for (let r = sunR + 26; r > sunR; r -= 2) img.ellipse(sunX, sunY, r, r, SUNSET.sunHalo, 0.05);
  img.ellipse(sunX, sunY, sunR + 3, sunR + 3, SUNSET.sunHalo, 0.35);
  img.ellipse(sunX, sunY, sunR, sunR, SUNSET.sun);
  img.ellipse(sunX - 6, sunY - 8, Math.round(sunR * 0.45), Math.round(sunR * 0.35), '#ffffff', 0.55);
  // cloud bands: flat ellipses in layers, lit from the sun
  const band = (cy, tone, alpha, spans) => {
    for (const [cx, rx, ry] of spans) img.ellipse(cx, cy, rx, ry, tone, alpha);
  };
  band(Math.round(h * 0.2), SUNSET.cloudC, 0.5, [[w * 0.12, 70, 3], [w * 0.6, 90, 3], [w * 0.95, 60, 3]]);
  band(Math.round(h * 0.3), SUNSET.cloudB, 0.7, [[w * 0.22, 80, 4], [w * 0.5, 60, 3], [w * 0.82, 90, 4]]);
  band(Math.round(h * 0.4), SUNSET.cloudA, 0.8, [[w * 0.05, 60, 3], [w * 0.38, 75, 3], [w * 0.72, 70, 3], [w * 0.98, 50, 3]]);
  band(Math.round(h * 0.5), SUNSET.cloudA, 0.55, [[w * 0.3, 90, 2], [w * 0.64, 70, 2]]);
  // the sun cuts through the lowest band: a lit streak either side of it
  img.ellipse(sunX, Math.round(h * 0.4), 55, 2, '#fff3c8', 0.7);
}

// A skyline silhouette between x0 and x1 on a base line `base`: blocks of different heights, a few lit windows, a needle tower. `seed` varies it.
function paintSkyline(img, x0, x1, base, tone, seed, litHex, maxH = 60, needleAt = null) {
  const hash = (a, b) => { let n = Math.imul(a * 73856093 ^ b * 19349663, 2654435761) >>> 0; n ^= n >>> 13; return (n >>> 0) % 1000 / 1000; };
  let x = x0;
  let i = 0;
  while (x < x1) {
    const bw = 8 + Math.floor(hash(seed, i) * 14);
    const bh = 14 + Math.floor(hash(i, seed + 5) * maxH);
    const right = Math.min(x1, x + bw - 1);
    img.rect(x, base - bh, right, base, tone);
    if (hash(seed + 3, i) > 0.6) img.rect(x + 2, base - bh - 3, Math.min(right, x + 3), base - bh, tone); // a roof mast
    for (let wy = base - bh + 3; wy < base - 2; wy += 4) {
      for (let wx = x + 2; wx < right - 1; wx += 3) if (hash(wx * 3 + seed, wy) > 0.72) img.rect(wx, wy, wx, wy + 1, litHex);
    }
    x += bw;
    i++;
  }
  if (needleAt !== null) { // a tall stepped needle tower (a generic skyline landmark)
    const nx = needleAt;
    img.rect(nx - 4, base - 70, nx + 4, base, tone);
    img.rect(nx - 3, base - 90, nx + 3, base - 70, tone);
    img.rect(nx - 2, base - 108, nx + 2, base - 90, tone);
    img.rect(nx - 1, base - 124, nx + 1, base - 108, tone);
    img.rect(nx, base - 134, nx, base - 124, tone);
    for (let wy = base - 66; wy < base - 4; wy += 5) img.rect(nx - 1, wy, nx - 1, wy + 1, litHex);
  }
}

// A tile of the Kenney roof (a grey concrete panel), used as the roof's top face; `variant` shifts which pack tile is used.
function roofTile(variant = 0) {
  return cropVendor(MODERN_CITY, 136 + (variant % 2) * 17, 0, 16, 16);
}

// ----- the arena backdrop -----
function buildHeroBg() {
  const { HV_LEVEL, HV_W, HV_H, HV_FLOOR_Y, HV_PLATFORMS } = loadHeroLevel();
  const w = HV_W / 2;
  const h = HV_H / 2;
  const img = new Img(w, h);
  const floorY = HV_FLOOR_Y / 2; // 235
  paintSunsetSky(img, w, h, 330, 108, 36);
  paintSkyline(img, 0, w - 1, floorY - 18, SUNSET.far, 7, SUNSET.winPink, 70, 90);
  paintSkyline(img, 0, w - 1, floorY - 6, SUNSET.near, 23, SUNSET.win, 52, null);
  // the roof of the lab building: a low parapet wall behind the roof deck
  img.rect(0, floorY - 14, w - 1, floorY, '#3b3560');
  img.rect(0, floorY - 14, w - 1, floorY - 13, '#6a6296');
  for (let x = 0; x < w; x += 24) img.rect(x, floorY - 14, x, floorY, '#2b2648');
  // rooftop dressing: an AC unit with a fan, a vent stack, a dish, an antenna mast with a red light
  const ac = (x) => {
    img.rect(x, floorY - 36, x + 28, floorY - 14, '#8d93a6'); img.rect(x, floorY - 36, x + 28, floorY - 35, '#cfd3e0');
    img.rect(x, floorY - 14, x + 28, floorY - 13, '#454a65'); img.rect(x + 29, floorY - 35, x + 29, floorY - 14, '#5f647a');
    img.ellipse(x + 14, floorY - 25, 8, 8, '#454a65'); img.ellipse(x + 14, floorY - 25, 6, 6, '#2b2e44');
    img.line(x + 8, floorY - 25, x + 20, floorY - 25, 1, '#8d93a6'); img.line(x + 14, floorY - 31, x + 14, floorY - 19, 1, '#8d93a6');
    for (let gy = floorY - 20; gy < floorY - 15; gy += 2) img.rect(x + 3, gy, x + 25, gy, '#5f647a');
  };
  ac(14); ac(176); ac(400);
  img.rect(82, floorY - 44, 90, floorY - 14, '#7d839a'); img.rect(80, floorY - 47, 92, floorY - 44, '#a9aebf'); // a vent stack
  img.rect(82, floorY - 44, 84, floorY - 14, '#a9aebf');
  img.ellipse(226, floorY - 36, 15, 12, '#cfd3e0'); img.rect(211, floorY - 36, 241, floorY - 24, '#3b3560'); // a dish
  img.ellipse(226, floorY - 36, 11, 8, '#a9aebf'); img.line(226, floorY - 36, 236, floorY - 48, 1, '#454a65'); img.px(236, floorY - 49, '#ff4d5e');
  img.rect(300, floorY - 100, 301, floorY - 14, '#454a65'); // a mast
  for (let y = floorY - 96; y < floorY - 20; y += 12) img.line(292, y + 8, 309, y, 1, '#454a65');
  img.rect(299, floorY - 104, 302, floorY - 101, '#ff4d5e'); img.ellipse(300, floorY - 103, 6, 6, '#ff4d5e', 0.2);
  // the "PHYSICS LAB" sign on two posts, right side: a lit board with pixel letters
  const sx = 342;
  const sy = floorY - 76;
  img.rect(sx + 6, sy + 16, sx + 7, floorY - 14, '#454a65'); img.rect(sx + 70, sy + 16, sx + 71, floorY - 14, '#454a65');
  img.rect(sx, sy, sx + 77, sy + 17, '#2b2648'); img.outlineRect(sx, sy, sx + 77, sy + 17, '#8e96b8');
  img.rect(sx + 1, sy + 1, sx + 76, sy + 1, '#4a4478');
  drawPixelText(img, 'PHYSICS LAB', sx + 5, sy + 5, '#7fe0ff', 1, '#1f7e9c');

  // scaffold platforms (from the rules): a steel deck on two braced legs down to the roof
  for (const plat of HV_PLATFORMS) {
    const x0 = plat.x0 / 2;
    const x1 = plat.x1 / 2;
    const y = plat.y / 2;
    for (const lx of [x0 + 5, x1 - 7]) { // legs with a cross brace
      img.rect(lx, y + 5, lx + 2, floorY, '#5f647a');
      img.rect(lx, y + 5, lx, floorY, '#8d93a6');
    }
    img.line(x0 + 7, y + 8, x1 - 6, floorY - 4, 1, '#454a65');
    img.line(x1 - 6, y + 8, x0 + 7, floorY - 4, 1, '#454a65');
    img.rect(x0, y, x1, y + 5, '#8d93a6'); // the deck
    img.rect(x0, y, x1, y, '#e4e8f2');
    img.rect(x0, y + 1, x1, y + 1, '#cfd3e0');
    img.rect(x0, y + 4, x1, y + 5, '#454a65');
    for (let x = x0 + 3; x < x1; x += 6) img.rect(x, y + 2, x + 1, y + 3, '#5f647a'); // grating
    img.rect(x0, y, x0, y + 5, HV_PAL.K); img.rect(x1, y, x1, y + 5, HV_PAL.K);
    // a hazard stripe on the front edge
    for (let x = x0 + 1; x < x1; x += 6) img.rect(x, y + 4, Math.min(x + 2, x1 - 1), y + 4, '#ffd23f');
  }

  // the roof deck: Kenney concrete tiles across the top face, then a darker slab front
  const tileA = roofTile(0);
  const tileB = roofTile(1);
  for (let x = 0; x < w; x += 16) {
    const tile = (x / 16) % 2 === 0 ? tileA : tileB;
    for (let ty = 0; ty < 16 && floorY + ty < h; ty++) {
      for (let tx = 0; tx < 16 && x + tx < w; tx++) {
        const i = (ty * 16 + tx) * 4;
        img.px(x + tx, floorY + ty, `#${[tile.data[i], tile.data[i + 1], tile.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
      }
    }
  }
  img.rect(0, floorY, w - 1, floorY, '#e4e8f2'); // the lit edge the characters stand on
  img.rect(0, floorY + 1, w - 1, floorY + 1, '#b9bfd8');
  img.rect(0, floorY + 16, w - 1, h - 1, '#2b2e44'); // the slab front
  for (let x = 0; x < w; x += 20) img.rect(x, floorY + 16, x, h - 1, '#1a1c2c');
  img.rect(0, floorY + 16, w - 1, floorY + 17, '#454a65');
  for (let x = 4; x < w; x += 20) { img.rect(x, floorY + 24, x + 11, floorY + 25, '#3b3f58'); }
  // a warm light cast from the low sun along the roof
  for (let x = 0; x < w; x++) glow(img, x, floorY + 2, '#ffb27a', 0.12);
  vignette(img);
  return img;
}

// Pixel text, 5x7 glyphs (an original blocky face, like tools/make-cutscenes.js's): only the letters the hero art needs.
const HV_GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

function hvTextWidth(text, scale) {
  return text.length * 6 * scale - scale;
}

// Draws `text` (capitals and spaces) with glyph pixels scaled `scale`, top-left (x, y); `shadowHex` adds a one-pixel-down-right shadow
// (scaled with the text), `outlineHex` a one-pixel outline round the letters.
function drawPixelText(img, text, x, y, hex, scale, shadowHex, outlineHex) {
  const place = (px, py, color) => {
    let cx = px;
    for (const ch of text) {
      const glyph = HV_GLYPHS[ch] || HV_GLYPHS[' '];
      glyph.forEach((row, ry) => [...row].forEach((bit, rx) => {
        if (bit === '#') img.rect(cx + rx * scale, py + ry * scale, cx + rx * scale + scale - 1, py + ry * scale + scale - 1, color);
      }));
      cx += 6 * scale;
    }
  };
  if (outlineHex) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) place(x + ox, y + oy, outlineHex);
  if (shadowHex) place(x + scale, y + scale, shadowHex);
  place(x, y, hex);
}

// ----- the cover: the picture behind the intro card -----
function buildHeroCover() {
  const w = 480;
  const h = 270;
  const img = new Img(w, h);
  const ledgeY = 176; // where the two stand: the top of the foreground ledge (the card covers screen y >= 350, cover y >= 175, and is only the dark ledge face)
  paintSunsetSky(img, w, h, 240, 112, 46);
  // far skyline, with the needle tower at the left; then the nearer, darker blocks at both sides only (the sun shines through the middle)
  paintSkyline(img, 0, w - 1, ledgeY - 8, SUNSET.far, 31, SUNSET.winPink, 44, 70);
  paintSkyline(img, 0, 130, ledgeY - 2, SUNSET.near, 5, SUNSET.win, 70, null);
  paintSkyline(img, 350, w - 1, ledgeY - 2, SUNSET.near, 17, SUNSET.win, 78, 440);
  paintSkyline(img, 0, 60, ledgeY, SUNSET.nearer, 41, SUNSET.win, 90, null);
  paintSkyline(img, 410, w - 1, ledgeY, SUNSET.nearer, 53, SUNSET.win, 84, null);
  // a few early stars and little sparkles near the title
  for (const [x, y] of [[40, 14], [98, 40], [150, 18], [330, 20], [386, 44], [440, 16], [452, 66], [22, 70]]) { img.px(x, y, '#ffffff'); img.px(x + 1, y, '#ffe6ff'); }

  // the rooftop ledge: a concrete slab (Kenney roof tiles) with a bright lip, a dark front face and a pink rim light from the sun
  const tileA = roofTile(0);
  const tileB = roofTile(1);
  for (let x = 0; x < w; x += 16) {
    const tile = (x / 16) % 2 === 0 ? tileA : tileB;
    for (let ty = 0; ty < 16; ty++) {
      for (let tx = 0; tx < 16 && x + tx < w; tx++) {
        const i = (ty * 16 + tx) * 4;
        const shade = ty < 3 ? 1 : 0.8;
        const hex = `#${[0, 1, 2].map((c) => Math.round(tile.data[i + c] * shade).toString(16).padStart(2, '0')).join('')}`;
        img.px(x + tx, ledgeY + ty, hex);
      }
    }
  }
  img.rect(0, ledgeY, w - 1, ledgeY, '#fff0f4'); // the lip
  img.rect(0, ledgeY + 1, w - 1, ledgeY + 1, '#ffc2d8');
  img.rect(0, ledgeY + 16, w - 1, h - 1, '#2b2e44'); // the dark front face, with block joints
  img.rect(0, ledgeY + 16, w - 1, ledgeY + 17, '#454a65');
  for (let row = 0; ledgeY + 20 + row * 14 < h; row++) {
    const yy = ledgeY + 20 + row * 14;
    img.rect(0, yy, w - 1, yy, '#1a1c2c');
    for (let x = (row % 2) * 20; x < w; x += 40) img.rect(x, yy, x, yy + 13, '#1a1c2c');
  }
  for (let x = 0; x < w; x++) { glow(img, x, ledgeY + 2, '#ff9ec0', 0.18); glow(img, x, ledgeY + 3, '#ff9ec0', 0.08); }
  // a soft dark gradient toward the bottom, so the card on top reads
  for (let y = ledgeY + 18; y < h; y++) img.rect(0, y, w - 1, y, '#12131a', Math.min(0.55, (y - ledgeY - 18) / 160));

  // the two stand-ins, close together on the ledge, drawn at 3x (a 6x pixel on screen: the same size as the title's big letters)
  const kitten = scaleImg(drawKitten({ bob: 0, legs: 'stand', arms: 'cheer', cape: 'stream', eyes: 'open' }), 3);
  const villain = scaleImg(drawVillain({ arms: 'cross', eyes: 'open', tilt: 0 }), 3);
  // a shadow under each of them, then the kitten standing on the ledge (her boots end at sprite row 30, x3 = 93) and the villain hovering above it
  img.ellipse(190, ledgeY + 2, 30, 4, '#1a1c2c', 0.45);
  img.ellipse(292, ledgeY + 2, 36, 4, '#1a1c2c', 0.45);
  img.blit(kitten, 142, ledgeY - 93);
  img.blit(villain, 247, ledgeY - 96 - 8);
  // warm sparks of light between them
  const sparkle = new Img(7, 7);
  drawRows(sparkle, 0, 0, SPARKLE, { Y: '#ffd23f', W: '#ffffff' });
  img.blit(sparkle, 238, ledgeY - 100);

  // the title banner: a dark ribbon with a pink and gold edge, two lines of pixel letters
  const bx0 = 84;
  const bx1 = 396;
  const by0 = 10;
  const by1 = 62;
  fillTri(img, [bx0 - 20, by0 + 10], [bx0 - 20, by1 + 4], [bx0 + 2, by1 - 6], '#6d2fb5'); // the ribbon tails
  fillTri(img, [bx1 + 20, by0 + 10], [bx1 + 20, by1 + 4], [bx1 - 2, by1 - 6], '#6d2fb5');
  img.rect(bx0 - 20, by0 + 10, bx0 + 2, by1 + 4, '#6d2fb5');
  img.rect(bx1 - 2, by0 + 10, bx1 + 20, by1 + 4, '#6d2fb5');
  img.rect(bx0, by0, bx1, by1, '#241c45');
  img.rect(bx0, by0, bx1, by0 + 1, '#ff7eb6'); img.rect(bx0, by1 - 1, bx1, by1, '#ff7eb6'); // pink edges
  img.rect(bx0, by0 + 2, bx1, by0 + 2, '#ffd23f'); img.rect(bx0, by1 - 2, bx1, by1 - 2, '#ffd23f'); // gold lines
  img.rect(bx0, by0, bx0 + 1, by1, '#ff7eb6'); img.rect(bx1 - 1, by0, bx1, by1, '#ff7eb6');
  img.outlineRect(bx0 - 1, by0 - 1, bx1 + 1, by1 + 1, HV_PAL.K);
  const line1 = 'SHADOW BAT';
  const line2 = 'VS KITTEN HERO';
  const l1x = Math.round((w - hvTextWidth(line1, 3)) / 2);
  const l2x = Math.round((w - hvTextWidth(line2, 2)) / 2);
  drawPixelText(img, line1, l1x, by0 + 6, '#f2eaff', 3, '#6d2fb5');
  drawPixelText(img, line2, l2x, by0 + 33, '#ffb3d4', 2, '#6d2fb5');
  vignette(img);
  return img;
}

// ---------- EDI Madness (ADR 0025): drawn in tools/lib/edi-art.js, with this file's own helpers ----------
const ediArt = require('./lib/edi-art')({ Img, decodePNG, glow, drawRows, scaleImg, fillPoly, fillTri, drawPixelText, hvTextWidth, heroUiHeart, SPARKLE });

// ---------- write the files ----------

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets', 'minigames');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, built) => fs.writeFileSync(path.join(outDir, name), built.toPNG());
write('flappy-bg.png', buildFlappyBg());
write('flappy-sprites.png', buildFlappySprites());
write('tower-bg.png', buildTowerBg());
write('tower-sprites.png', buildTowerSprites());
write('tower-prince.png', buildTowerPrince());
write('hero-bg.png', buildHeroBg());
write('hero-sprites.png', buildHeroSprites());
write('hero-bar.png', buildHeroBar());
write('hero-cover.png', buildHeroCover());
const ediFrames = ediArt.carFrameSet();
for (let stage = 0; stage < 3; stage++) write(`edi-bg-${stage + 1}.png`, ediArt.buildEdiBg(stage, ediFrames));
write('edi-cars.png', ediArt.buildEdiCars());
write('edi-sprites.png', ediArt.buildEdiSprites());
write('edi-instructor.png', ediArt.buildEdiInstructor());
write('edi-cover.png', ediArt.buildEdiCover(ediFrames));
// The old Physics Lab platformer's backdrops are retired (FB-0066: the Physics Lab is the hero fight now) -- remove them if a previous
// run left them behind, so assets.test.js's "every generated file is exactly what the tool would write" check doesn't trip over stale files.
for (const name of ['platformer-bg.png', 'platformer-bg-far.png', 'platformer-bg-mid.png']) {
  const stale = path.join(outDir, name);
  if (fs.existsSync(stale)) fs.unlinkSync(stale);
}
console.log(`Wrote flappy-bg, flappy-sprites, tower-bg, tower-sprites, tower-prince, hero-bg, hero-sprites, hero-bar, hero-cover and the EDI Madness art (edi-bg-1..3, edi-cars, edi-sprites, edi-instructor, edi-cover) to ${path.relative(path.join(__dirname, '..'), outDir)}/`);
