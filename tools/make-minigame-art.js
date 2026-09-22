// Themed backdrops for the 3 mini-games (docs/ROADMAP.md M4, coordinator art-pass brief
// 2026-09-22): "give each game a themed backdrop instead of black... drawn in the tools like the rest
// of the art." Same technique as tools/make-cutscenes.js -- a tiny Img/PNG writer, no dependencies,
// no photos copied -- just a second illustration set alongside the story cutscenes, sized to fill the
// mini-game canvas (960x540) rather than the cutscene player's letterboxed frame.
// Run:  node tools/make-minigame-art.js   (also runs as part of `npm run assets`)
// Output, in assets/minigames/:
//   platformer-bg.png   960x540, the Physics Lab: benches, shelving and a specimen tank silhouetted
//                        against a warm-lit wall, a tiled lab floor along the bottom
//   flappy-bg.png        960x540, the ICVL server room: racks receding into the distance, a cable
//                        tray along the ceiling, cold blue light, a raised-floor tile band
//   tetris-bg.png         960x540, Room 195 at night: a whiteboard, desks either side, a window onto
//                        a skyline of lit windows
// Each scene draws its own foreground (platforms, racks, the Tetris well) itself -- these are just
// the wall/floor/room dressing behind it, loaded once per scene (src/minigames/*.js preload(),
// guarded like every other cached texture in this codebase) and pinned with scrollFactor(0) so a
// scrolling level never has to tile it.
//
// `--out <dir>` writes elsewhere (tests check the files are up to date), matching the convention in
// tools/make-assets.js / tools/make-cutscenes.js.
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');

const W = 960;
const H = 540;

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
// A warm-lit lab interior: a back wall carrying shelving/benches/a specimen tank in silhouette (the
// actual platforms are drawn by src/minigames/platformer.js on top of this), pools of warm lamplight,
// and a tiled lab floor band along the very bottom.

function buildPlatformerBg() {
  const img = new Img(W, H);
  const C = {
    wallDeep: '#241f1a', wallMid: '#332b22', wallWarm: '#463a28',
    shelf: '#1c1712', shelfEdge: '#2e2318',
    tankGlass: '#2f5c52', tankLiquid: '#3f8f7c', tankBubble: '#bfe6da',
    lampGlow: '#ffdf9e', lampGlowDim: '#c9a24d',
    floorLight: '#2a251f', floorDark: '#211d18', floorGrout: '#161310',
    pipe: '#2a2118',
  };

  img.vGradient(0, H - 1, [[0, C.wallDeep], [0.55, C.wallMid], [1, C.wallDeep]]);

  // Warm lamp fixtures along the ceiling, each casting a soft pool of light down the wall.
  const lamps = [130, 430, 730];
  for (const lx of lamps) {
    img.ellipse(lx, 0, 90, 170, C.lampGlow, 0.10);
    img.ellipse(lx, 0, 55, 110, C.lampGlowDim, 0.14);
    img.rect(lx - 14, 0, lx + 14, 8, C.pipe);
    img.ellipse(lx, 10, 16, 6, C.lampGlow, 0.5);
  }

  // Wall-mounted shelving units, evenly spaced, carrying small equipment-box silhouettes.
  for (let sx = 40; sx < W; sx += 190) {
    const top = 70;
    const bottom = 400;
    img.rect(sx, top, sx + 120, top + 4, C.shelfEdge);
    img.rect(sx, top + 4, sx + 120, bottom, C.shelf);
    for (let shelfY = top + 40; shelfY < bottom; shelfY += 70) {
      img.rect(sx, shelfY, sx + 120, shelfY + 4, C.shelfEdge);
      // A couple of boxes/equipment shapes sitting on each shelf.
      for (let bx = sx + 10; bx < sx + 100; bx += 34) {
        const bh = 20 + ((bx + shelfY) % 14);
        img.rect(bx, shelfY - bh, bx + 22, shelfY - 2, C.wallDeep);
        img.rect(bx, shelfY - bh, bx + 22, shelfY - bh + 3, C.shelfEdge);
      }
    }
  }

  // A big specimen tank between two shelving runs, glowing faintly (a lab centerpiece).
  const tx = 480;
  img.rect(tx - 46, 90, tx + 46, 330, C.tankGlass, 0.85);
  img.rect(tx - 46, 90, tx + 46, 330, C.tankLiquid, 0.35);
  img.outlineRect(tx - 46, 90, tx + 46, 330, C.shelfEdge);
  for (let i = 0; i < 10; i++) {
    const bx = tx - 30 + ((i * 37) % 60);
    const by = 300 - ((i * 53) % 200);
    img.ellipse(bx, by, 2, 2, C.tankBubble, 0.6);
  }
  img.rect(tx - 50, 84, tx + 50, 92, C.shelfEdge); // tank lid/rim

  // A ceiling pipe run for a bit of industrial detail.
  img.rect(0, 20, W - 1, 24, C.pipe, 0.8);
  for (let x = 20; x < W; x += 60) img.rect(x, 16, x + 4, 28, C.shelfEdge);

  // Floor band: alternating tile tones with grout lines, warm-toned to match the wall.
  const floorY = 460;
  img.rect(0, floorY, W - 1, H - 1, C.floorLight);
  for (let x = 0; x < W; x += 40) img.rect(x, floorY, x, H - 1, C.floorGrout);
  for (let y = floorY; y < H; y += 40) img.rect(0, y, W - 1, y, C.floorGrout);
  for (let x = 0; x < W; x += 80) {
    for (let y = floorY; y < H; y += 80) img.rect(x, y, x + 39, y + 39, C.floorDark, 0.3);
  }
  img.rect(0, floorY, W - 1, floorY + 3, C.wallDeep); // the wall's own base course, right at the floor line

  return img;
}

// ---------- ICVL server room (flappy) ----------
// Cold blue light, rows of server racks with lit LEDs receding toward the top of the frame (a cheap
// sense of depth without true 3D perspective), a cable tray along the ceiling, and a raised-floor
// tile band -- the actual obstacle racks are drawn by src/minigames/flappy.js on top of this.

function buildFlappyBg() {
  const img = new Img(W, H);
  const C = {
    skyDeep: '#111a2b', skyMid: '#1a2740', skyLight: '#243652',
    rackFar: '#182231', rackFarLit: '#233348',
    cableTray: '#0c121b', cableRung: '#1c2836',
    floorLight: '#26313f', floorDark: '#1c2530', floorGrid: '#33465c',
    ledRed: '#ff5a5a', ledGreen: '#8fd46a', ledAmber: '#ffd23f', ledBlue: '#7fe0ff',
  };

  img.vGradient(0, H - 1, [[0, C.skyDeep], [0.6, C.skyMid], [1, C.skyLight]]);

  // Cable tray along the ceiling.
  img.rect(0, 0, W - 1, 22, C.cableTray);
  for (let x = 6; x < W; x += 18) img.rect(x, 0, x + 3, 22, C.cableRung);

  // Two faint, smaller "distant" rack rows (implied depth) above the real, closer racks the scene
  // draws itself -- deliberately dim/small so the real obstacles read as the nearest, sharpest row.
  const rowYs = [40, 96];
  const scales = [0.55, 0.75];
  for (let r = 0; r < rowYs.length; r++) {
    const rh = 46 * scales[r];
    for (let x = 10; x < W; x += 70) {
      img.rect(x, rowYs[r], x + 46 * scales[r], rowYs[r] + rh, C.rackFar);
      img.rect(x + 3, rowYs[r] + 4, x + 6, rowYs[r] + 7, ((x / 70) | 0) % 3 === 0 ? C.ledGreen : C.rackFarLit, 0.7);
      img.rect(x + 10, rowYs[r] + 4, x + 13, rowYs[r] + 7, ((x / 70) | 0) % 2 === 0 ? C.ledAmber : C.rackFarLit, 0.7);
    }
  }

  // Floor: raised server-room floor tiles, cool and grid-lined.
  const floorY = 480;
  img.rect(0, floorY, W - 1, H - 1, C.floorLight);
  for (let x = 0; x < W; x += 30) img.rect(x, floorY, x, H - 1, C.floorGrid, 0.6);
  for (let y = floorY; y < H; y += 30) img.rect(0, y, W - 1, y, C.floorGrid, 0.6);
  for (let x = 0; x < W; x += 60) {
    for (let y = floorY; y < H; y += 60) img.rect(x, y, x + 29, y + 29, C.floorDark, 0.35);
  }

  // A soft cold ambient glow low across the room (cable-tray-to-floor light falloff).
  img.rect(0, 22, W - 1, floorY, C.skyDeep, 0.08);

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
write('platformer-bg.png', buildPlatformerBg());
write('flappy-bg.png', buildFlappyBg());
write('tetris-bg.png', buildTetrisBg());
console.log(`Wrote platformer-bg, flappy-bg and tetris-bg to ${path.relative(path.join(__dirname, '..'), outDir)}/`);
