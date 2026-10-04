// Themed backdrops for the 3 mini-games (docs/ROADMAP.md M4, coordinator art-pass brief
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
//   tetris-bg.png            960x540 (unchanged -- Tetris rated fine, this pass leaves it alone):
//                            Room 195 at night, a whiteboard, desks either side, a lit skyline window.
// `--out <dir>` writes elsewhere (tests check the files are up to date), matching the convention in
// tools/make-assets.js / tools/make-cutscenes.js.
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');

// Tetris keeps its own original, full UI-resolution canvas (unchanged this pass).
const W = 960;
const H = 540;
// The compact scale the platformer/flyer backdrops are authored at (a 320x180-equivalent viewport,
// 1/3 of the real 960x540 canvas -- src/state.js ZOOM=3) and the platformer's own compact level width
// -- kept in sync with src/minigames/platformer.js's own compact-scale constants (both files' own
// comments cross-reference this) by hand, the same trust the rest of this file already places in
// matching constants across files, e.g. TETRIS_COLS living in src/minigames/tetris-logic.js but drawn
// here nowhere at all.
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

// ---------- Room 195 at night (Tetris) ----------
// A classroom after hours: a whiteboard on the back wall, desks flanking the well on both sides, and
// a window onto a skyline of lit windows -- the well itself is drawn by src/minigames/tetris.js on
// top of this, roughly centered, so the board's own furniture is composed to flank it.

function buildTetrisBg() {
  const img = new Img(W, H);
  const C = {
    wall: '#232535', wallShade: '#1b1c29',
    board: '#eef3ee', boardFrame: '#7a4a24', boardShade: '#cfd8cf',
    marker: ['#ff5a5a', '#3b7dd8', '#8fd46a'],
    nightSky: '#141a2e', building: '#20263a', buildingLit: '#ffd23f',
    windowFrame: '#5a3418', windowSill: '#7a4a24',
    desk: '#7a4a24', deskTop: '#9c6a3a', deskShade: '#5a3418',
    floor: '#2a2530', floorShade: '#211d26',
    outline: '#100f18',
  };

  img.rect(0, 0, W - 1, H - 1, C.wall);
  for (let y = 0; y < H; y += 60) img.rect(0, y, W - 1, y, C.wallShade, 0.25); // faint wall banding, not a flat fill

  // Floor band along the bottom.
  const floorY = 470;
  img.rect(0, floorY, W - 1, H - 1, C.floor);
  for (let x = 0; x < W; x += 48) img.rect(x, floorY, x, H - 1, C.floorShade, 0.5);

  // The whiteboard, mounted high and wide on the back wall (the Tetris well sits in front of its
  // lower half once the scene draws it -- only the top strip and the flanking edges stay visible).
  const bx0 = 260, bx1 = 700, by0 = 26, by1 = 150;
  img.rect(bx0 - 8, by0 - 8, bx1 + 8, by1 + 8, C.boardFrame);
  img.rect(bx0, by0, bx1, by1, C.board);
  img.rect(bx0, by0, bx1, by0 + 6, C.boardShade, 0.6);
  // A couple of loose marker scribbles for character (simple colored squiggle lines, not real text).
  img.line(bx0 + 30, by0 + 30, bx0 + 120, by0 + 26, 2, C.marker[0]);
  img.line(bx0 + 120, by0 + 26, bx0 + 90, by0 + 60, 2, C.marker[0]);
  img.line(bx1 - 140, by0 + 40, bx1 - 40, by0 + 34, 2, C.marker[1]);
  img.ellipse(bx1 - 90, by0 + 70, 26, 14, C.marker[2], 0.8);
  // A marker tray along the bottom edge.
  img.rect(bx0, by1 + 8, bx1, by1 + 14, C.boardFrame);

  // Window onto a night skyline, to the right of the whiteboard.
  const wx0 = 760, wx1 = 940, wy0 = 60, wy1 = 320;
  img.rect(wx0 - 6, wy0 - 6, wx1 + 6, wy1 + 6, C.windowFrame);
  img.rect(wx0, wy0, wx1, wy1, C.nightSky);
  const buildings = [
    { x0: wx0 + 4, x1: wx0 + 40, top: wy0 + 90 },
    { x0: wx0 + 44, x1: wx0 + 80, top: wy0 + 40 },
    { x0: wx0 + 84, x1: wx0 + 116, top: wy0 + 130 },
    { x0: wx0 + 120, x1: wx0 + 160, top: wy0 + 20 },
  ];
  for (const b of buildings) {
    img.rect(b.x0, b.top, b.x1, wy1, C.building);
    for (let wy = b.top + 8; wy < wy1 - 6; wy += 12) {
      for (let wx = b.x0 + 4; wx < b.x1 - 3; wx += 8) {
        if ((wx + wy) % 5 !== 0) img.px(wx, wy, C.buildingLit, 0.85);
      }
    }
  }
  img.rect(wx0, wy1 - 3, wx1, wy1, C.windowSill);
  // A window mullion cross for a real "window" read.
  img.rect((wx0 + wx1) / 2 - 1, wy0, (wx0 + wx1) / 2 + 1, wy1, C.windowFrame);
  img.rect(wx0, (wy0 + wy1) / 2 - 1, wx1, (wy0 + wy1) / 2 + 1, C.windowFrame);

  // Desks flanking the well, one cluster on each side, simple 3/4-view boxes with a shaded front face.
  function desk(dx, dy) {
    img.rect(dx, dy, dx + 60, dy + 6, C.deskTop);
    img.rect(dx, dy + 6, dx + 60, dy + 34, C.desk);
    img.rect(dx, dy + 30, dx + 60, dy + 34, C.deskShade);
    img.rect(dx + 4, dy + 8, dx + 8, dy + 34, C.deskShade); // legs
    img.rect(dx + 48, dy + 8, dx + 52, dy + 34, C.deskShade);
    img.outlineRect(dx, dy, dx + 60, dy + 34, C.outline);
  }
  desk(40, floorY - 50);
  desk(130, floorY - 40);
  desk(W - 100, floorY - 50);
  desk(W - 190, floorY - 40);

  return img;
}

// ---------- write the files ----------

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : path.join(__dirname, '..', 'assets', 'minigames');
fs.mkdirSync(outDir, { recursive: true });
const write = (name, built) => fs.writeFileSync(path.join(outDir, name), built.toPNG());
write('platformer-bg-far.png', buildPlatformerFar());
write('platformer-bg-mid.png', buildPlatformerMid());
write('flappy-bg.png', buildFlappyBg());
write('tetris-bg.png', buildTetrisBg());
// The old single platformer-bg.png is retired (replaced by the far/mid pair above) -- remove it if a
// previous run left it behind, so assets.test.js's "every generated file is exactly what the tool
// would write" check doesn't trip over a stale, no-longer-written file.
const stale = path.join(outDir, 'platformer-bg.png');
if (fs.existsSync(stale)) fs.unlinkSync(stale);
console.log(`Wrote platformer-bg-far, platformer-bg-mid, flappy-bg and tetris-bg to ${path.relative(path.join(__dirname, '..'), outDir)}/`);
