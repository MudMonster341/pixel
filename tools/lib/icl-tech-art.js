// P5c (FB-0071): the ICL's "spaceship / super-computing lab" tile kit and Alice, the lab's robot.
//
// Owner brief: "a super computing lab with a robot called Alice... modern and like a space ship sort of interior": dark navy and brushed-steel
// floor panels with glowing cyan light strips, bulkhead walls with light bands, tall server racks with blinking lights, a holographic table,
// a big wall display with a graph, curved consoles with screens, cable trunking, a ceiling light bar, and a fingerprint-locked hatch with a
// pulsing scanner pad beside it.
//
// Art rule (FB-0025): free packs first, composed from their pixels and palette. Here that is:
//   - the sealed hatch is a crop of the "Laboratory Tileset PixelArt 16px" blast door (Land of Pixels, marceles, CC BY 4.0, already credited):
//     the red-lit centre of its door for the sealed state, its own steel and cable pixels slid apart for the half and open frames;
//   - the wall display's screen is drawn in the colours of that pack's monitor panels (cyan trace on dark teal);
//   - everything else (floor panels, light strips, bulkhead walls, rack chassis, console tops, holo table, Alice) is composed in code from a small
//     cool palette whose steel/navy/cyan values are sampled from the same pack, so the kit sits together. No freehand PNGs: all of it is here.
//
// tools/make-assets.js appends `ICL_TECH_TILES` to its TILES list (every earlier tile keeps its index) and calls `buildAlice()` for the sheet.

const C = {
  n0: '#090e1a', n1: '#101a2e', n2: '#182440', n3: '#22335a', n4: '#2d4272',
  s0: '#4a5878', s1: '#6f7da0', s2: '#9aa8c8', s3: '#c9d4ea',
  cy: '#4de3ff', ch: '#b9f6ff', cd: '#1e7a9e', cg: '#133e55',
  te: '#2fe0bf', gn: '#5ff08f', gd: '#2f9e5a', am: '#ffb13d', rd: '#ff4d5e', wh: '#f2f8ff',
};

module.exports = function buildIclTech(ctx) {
  const { Img, TILE, hexToRgb, loadAtlas, blitAtlas, copyTile, readTile, putImg, slideDoorPair, LAB_SHEET, DOOR_KINDS } = ctx;

  // ---------- tiny drawing helpers (raw RGBA, so translucent overlay pixels keep their exact colour) ----------
  const raw = (img, x, y, hex, a = 255) => {
    if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
    const [r, g, b] = hexToRgb(hex);
    const i = (y * img.w + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  };
  const px = (img, x, y, hex, a = 255) => raw(img, x, y, hex, a);
  const rect = (img, x, y, w, h, hex, a = 255) => { for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) raw(img, x + xx, y + yy, hex, a); };
  const frame = (img, x, y, w, h, hex, a = 255) => { rect(img, x, y, w, 1, hex, a); rect(img, x, y + h - 1, w, 1, hex, a); rect(img, x, y, 1, h, hex, a); rect(img, x + w - 1, y, 1, h, hex, a); };
  // A tiny deterministic generator so the speckles never change between runs.
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const draw = (img, x, y, rows, map) => rows.forEach((row, yy) => [...row].forEach((ch, xx) => { if (map[ch]) px(img, x + xx, y + yy, map[ch]); }));
  // A tile-sized scratch image for compositions that are cropped into several tiles.
  const canvas = (w, h) => new Img(w, h);
  const crop = (img, x, y, src, sx, sy) => putImg(img, x, y, src, sx, sy, TILE, TILE);

  // ---------- floors ----------
  // Dark navy panels with brushed-steel seams. Low contrast on purpose: the floor must read as a floor behind the furniture.
  function techFloor(img, x, y, variant = 0) {
    rect(img, x, y, TILE, TILE, C.n2);
    for (let i = 0; i < TILE; i++) {
      for (let j = 0; j < TILE; j++) {
        if (i % 8 === 0 || j % 8 === 0) px(img, x + i, y + j, C.n1);
        else if (i % 8 === 1 || j % 8 === 1) px(img, x + i, y + j, C.n3);
      }
    }
    if (variant === 1) { // a brushed streak and two rivets
      for (let i = 2; i < 7; i++) px(img, x + i, y + 4, C.n3);
      px(img, x + 11, y + 12, C.s0); px(img, x + 14, y + 3, C.s0);
    }
  }
  // A glowing cyan light strip set into the floor: arms n/e/s/w run from the middle to the tile's edge (a halo row either side, a hot core).
  function strip(img, x, y, arms) {
    techFloor(img, x, y, 0);
    const blend = (px0, py0, hex, a) => {
      const i = ((y + py0) * img.w + x + px0) * 4;
      const [r, g, b] = hexToRgb(hex);
      img.data[i] = Math.round((r * a + img.data[i] * (255 - a)) / 255);
      img.data[i + 1] = Math.round((g * a + img.data[i + 1] * (255 - a)) / 255);
      img.data[i + 2] = Math.round((b * a + img.data[i + 2] * (255 - a)) / 255);
    };
    const arm = (x0, x1, y0, y1) => { // inclusive pixel box of the 2-px core; the halo is one pixel around it
      for (let yy = y0 - 1; yy <= y1 + 1; yy++) for (let xx = x0 - 1; xx <= x1 + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= TILE || yy >= TILE) continue;
        const core = xx >= x0 && xx <= x1 && yy >= y0 && yy <= y1;
        if (core) blend(xx, yy, C.cy, 255); else blend(xx, yy, C.cd, 150);
      }
    };
    const c = { lo: 7, hi: 8 };
    if (arms.w) arm(0, c.hi, c.lo, c.hi);
    if (arms.e) arm(c.lo, 15, c.lo, c.hi);
    if (arms.n) arm(c.lo, c.hi, 0, c.hi);
    if (arms.s) arm(c.lo, c.hi, c.lo, 15);
    // the hot centre line
    if (arms.w || arms.e) for (let xx = arms.w ? 0 : c.lo; xx <= (arms.e ? 15 : c.hi); xx++) blend(xx, c.lo, C.ch, 200);
    if (arms.n || arms.s) for (let yy = arms.n ? 0 : c.lo; yy <= (arms.s ? 15 : c.hi); yy++) blend(c.lo, yy, C.ch, 200);
  }
  // The pad Alice hovers over: a round charging dock, teal ring on the navy floor.
  function techPad(img, x, y) {
    techFloor(img, x, y, 0);
    for (let yy = 0; yy < TILE; yy++) for (let xx = 0; xx < TILE; xx++) {
      const d = Math.hypot(xx - 7.5, (yy - 8) * 1.15);
      if (d <= 6.2 && d > 4.6) px(img, x + xx, y + yy, C.cd);
      else if (d <= 4.6 && d > 3.8) px(img, x + xx, y + yy, C.te);
      else if (d <= 3.8) px(img, x + xx, y + yy, C.n1);
    }
    px(img, x + 7, y + 8, C.ch); px(img, x + 8, y + 8, C.cy);
  }
  // A cable trunk lying across the floor: a steel conduit with an amber cable laid in it and a status dot.
  function techTrunk(img, x, y, vertical) {
    techFloor(img, x, y, 0);
    for (let i = 0; i < TILE; i++) {
      const w = (a, b) => (vertical ? [5 + a, i] : [i, 5 + a]);
      const set = (a, hex) => { const [xx, yy] = w(a, 0); px(img, x + xx, y + yy, hex); };
      set(-1, C.n0); set(0, C.s2); set(1, C.s1); set(2, C.s1); set(3, C.s0); set(4, C.n0);
      if (i % 8 === 0) { set(0, C.n0); set(1, C.s0); set(2, C.s0); set(3, C.n0); } // a clamp
      else set(2, C.am);
    }
    const [dx, dy] = vertical ? [6, 3] : [3, 6];
    px(img, x + dx, y + dy, C.cy);
  }

  // ---------- walls ----------
  // Bulkhead face: navy steel with a glowing cyan light band across it and a rounded rib on the ends (the `EndL`/`EndR` pieces are the
  // vertical runs of a room's walls, like the cream kit's).
  function wallTech(img, x, y, end) {
    rect(img, x, y, TILE, TILE, C.n3);
    rect(img, x, y, TILE, 1, C.s3);
    rect(img, x, y + 1, TILE, 1, C.s2);
    rect(img, x, y + 2, TILE, 1, C.s0);
    rect(img, x, y + 5, TILE, 1, C.cd);
    rect(img, x, y + 6, TILE, 2, C.cy);
    px(img, x + 0, y + 6, C.ch); for (let i = 2; i < 16; i += 5) px(img, x + i, y + 6, C.ch);
    rect(img, x, y + 8, TILE, 1, C.cd);
    rect(img, x, y + 12, TILE, 1, C.s0);
    rect(img, x, y + 13, TILE, 3, C.n1);
    for (let yy = 3; yy < 12; yy++) if (yy < 5 || yy > 8) px(img, x + 8, y + yy, C.n2); // a faint panel seam
    if (end) {
      const left = end === 'L';
      const cols = left ? [0, 1, 2] : [15, 14, 13];
      rect(img, x + (left ? 0 : 13), y, 3, TILE, C.n0);
      for (let yy = 1; yy < TILE; yy++) px(img, x + cols[1], y + yy, C.s1); // the rounded rib's highlight
      px(img, x + cols[2], y + 6, C.cy); px(img, x + cols[2], y + 7, C.cy);
    }
  }
  // The wall's top face, one row above a room's top wall: brushed steel catching the ceiling light.
  function wallTechCap(img, x, y) {
    rect(img, x, y, TILE, TILE, C.s0);
    rect(img, x, y, TILE, 1, C.s2);
    rect(img, x, y + 1, TILE, 1, C.s1);
    rect(img, x, y + 12, TILE, 1, C.n3);
    rect(img, x, y + 13, TILE, 3, C.n2);
    for (let i = 3; i < TILE; i += 8) { px(img, x + i, y + 6, C.s1); px(img, x + i, y + 7, C.s2); }
  }

  // ---------- the fingerprint scanner pad (a wall fitting beside the hatch) ----------
  const PRINT = [
    '..###..',
    '.#...#.',
    '#.###.#',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#.#',
    '#.#.#..',
    '#...#..',
    '.#.#...',
  ];
  function scannerShape(img, x, y, ink, glow, led) {
    // glass edge + fingerprint, in `ink`, on the pad at x 3..12 (the same shape every scanner state uses)
    PRINT.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === '#') px(img, x + 4 + xx, y + 4 + yy, ink); }));
    px(img, x + 7, y + 2, led); px(img, x + 8, y + 2, led);
    void glow;
  }
  function wallScanner(img, x, y) {
    copyTile(img, x, y, 'intWallFace');
    rect(img, x + 2, y + 1, 12, 14, C.n0);
    rect(img, x + 3, y + 2, 10, 12, C.n1);
    frame(img, x + 3, y + 2, 10, 12, C.s0);
    rect(img, x + 4, y + 3, 8, 1, C.n2);
    scannerShape(img, x, y, C.cd, false, C.cd);
    rect(img, x + 3, y + 14, 10, 1, C.s1); // the sill
  }
  // The overlay (transparent except for the glow) the engine pulses over the pad: three strengths, then a green "accepted" frame.
  function scannerGlow(img, x, y, level) {
    const a = [70, 130, 210][level];
    // a soft halo ringing the pad's glass
    frame(img, x + 2, y + 1, 12, 14, C.cy, Math.round(a * 0.55));
    frame(img, x + 3, y + 2, 10, 12, C.cy, a);
    PRINT.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === '#') px(img, x + 4 + xx, y + 4 + yy, level === 2 ? C.ch : C.cy, Math.min(255, a + 40)); }));
    px(img, x + 7, y + 2, C.ch, 255); px(img, x + 8, y + 2, C.ch, 255);
  }
  function scannerOk(img, x, y) {
    frame(img, x + 2, y + 1, 12, 14, C.gn, 140);
    frame(img, x + 3, y + 2, 10, 12, C.gn, 230);
    PRINT.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch === '#') px(img, x + 4 + xx, y + 4 + yy, C.gn, 255); }));
    px(img, x + 7, y + 2, C.wh, 255); px(img, x + 8, y + 2, C.wh, 255);
  }

  // ---------- the hatch: the lab's fingerprint-locked sliding door (two tiles wide) ----------
  // Sealed: the pack's red-lit blast door, cropped to its middle band (the hex lock and the light strips either side). The 3 frames of the
  // door animation (tools/lib/door-kinds.js `iclHatch`) are closed, a third open and fully open, built the way the lift's are: the
  // leaves' own pixels slide toward the jambs over a dark, cyan-lit opening.
  function hatchClosedImg() {
    const out = canvas(TILE * 2, TILE);
    const atlas = loadAtlas(LAB_SHEET);
    blitAtlas(out, 0, 0, atlas, 184, 83, 32, 16); // the red door's centre: hex lock, red/white light strips, plate seams
    // a steel lintel and sill so it reads as a hatch set into the wall
    rect(out, 0, 0, 32, 1, C.n0);
    rect(out, 0, 15, 32, 1, C.n0);
    return out;
  }
  function hatchOpenImg() {
    const closed = hatchClosedImg();
    const out = canvas(TILE * 2, TILE);
    rect(out, 0, 0, 32, 16, C.n0);
    rect(out, 1, 1, 30, 1, C.s0);
    rect(out, 1, 2, 30, 12, C.n1);
    // the lit corridor beyond: floor glow along the bottom, a cyan strip up the middle
    rect(out, 6, 2, 20, 12, C.n2);
    rect(out, 6, 11, 20, 3, C.n3);
    rect(out, 15, 2, 2, 12, C.cd);
    rect(out, 15, 12, 2, 2, C.cy);
    // the two leaves slid apart, one against each jamb (5 px of each remain visible)
    putImg(out, 1, 1, closed, 1, 1, 5, 14);
    putImg(out, 26, 1, closed, 26, 1, 5, 14);
    rect(out, 0, 0, 32, 1, C.n0);
    rect(out, 0, 15, 32, 1, C.n0);
    return out;
  }
  const hatchCache = {};
  function hatchTile(img, x, y, side, state) {
    if (!hatchCache.closed) hatchCache.closed = hatchClosedImg();
    if (!hatchCache.open) hatchCache.open = hatchOpenImg();
    let pair = hatchCache[state];
    if (!pair) { // half: leaves a third of the way open (the open frame leaves 5 px each side, so the leaves travel about 8 px each)
      pair = slideDoorPair(hatchCache.closed, hatchCache.open, { left: [1, 15], right: [16, 30], rows: [1, 14], shift: 5 });
      hatchCache.half = pair;
    }
    crop(img, x, y, pair, side === 'L' ? 0 : TILE, 0);
  }

  // ---------- furniture ----------
  // A tall server rack, two tiles: `top` (lid + 3 units) and `base` (4 units, feet). Its LEDs are dim here; the engine lays the blinking
  // overlay frames (`intTechLeds*`) over the same pixels. `variant` 1 has a smoked-glass door.
  const RACK_X = { x0: 2, w: 12 };
  function rackUnit(img, x, y, uy, variant) {
    rect(img, x + RACK_X.x0, y + uy, RACK_X.w, 3, C.n0);
    rect(img, x + RACK_X.x0 + 1, y + uy + 1, RACK_X.w - 2, 1, variant ? C.cd : C.n4);
    px(img, x + RACK_X.x0 + 1, y + uy, C.s0); // a lit edge on the unit's top-left, so the stack reads as separate drawers
    for (let vx = 7; vx < 13; vx += 2) px(img, x + vx, y + uy + 1, C.n0); // vent slots
    px(img, x + 3, y + uy + 1, C.s0); px(img, x + 5, y + uy + 1, C.s0); // the LEDs, off
  }
  function rackFrame(img, x, y, top, bottom) {
    rect(img, x + 1, y + top, 14, bottom - top, C.n0);
    rect(img, x + 2, y + top, 12, bottom - top, C.n1);
    rect(img, x + 2, y + top, 1, bottom - top, C.s0); // the left rail catches the light
    rect(img, x + 13, y + top, 1, bottom - top, C.n3); // the right rail in shade
  }
  function rackTop(img, x, y, variant) {
    rackFrame(img, x, y, 1, 16);
    rect(img, x + 2, y + 1, 12, 2, C.s1);
    rect(img, x + 2, y + 1, 12, 1, C.s3);
    for (let k = 0; k < 3; k++) rackUnit(img, x, y, 3 + 4 * k, variant);
    rect(img, x + 2, y + 15, 12, 1, C.n1);
  }
  function rackBase(img, x, y, variant) {
    rackFrame(img, x, y, 0, 15);
    for (let k = 0; k < 3; k++) rackUnit(img, x, y, 1 + 4 * k, variant);
    rect(img, x + 2, y + 13, 12, 1, C.n3);
    rect(img, x + 1, y + 14, 3, 2, C.n0); rect(img, x + 12, y + 14, 3, 2, C.n0); // feet
    rect(img, x + 4, y + 15, 8, 1, C.n0);
  }
  // The blinking overlays: lit LEDs at the dim ones' pixels. Frame A lights the left LED of each unit, frame B the right (and an amber one).
  function rackLeds(img, x, y, rows, frameB) {
    for (const ry of rows) {
      if (!frameB) { px(img, x + 3, y + ry, C.gn); px(img, x + 5, y + ry, C.s0, 0); }
      else { px(img, x + 5, y + ry, C.cy); px(img, x + 3, y + ry, C.s0, 0); }
      if (!frameB && (ry % 8 === 0)) px(img, x + 10, y + ry, C.am);
    }
  }

  // A curved console with a glowing screen set into the desk (seen from above at the game's slant): `end` is 'L', 'R', 'S' (both ends
  // rounded) or null (middle).
  function console_(img, x, y, end, core) {
    const left = end === 'L' || end === 'S';
    const right = end === 'R' || end === 'S';
    rect(img, x, y + 1, TILE, 13, C.n0);
    rect(img, x + (left ? 1 : 0), y + 2, TILE - (left ? 1 : 0) - (right ? 1 : 0), 11, C.n2);
    rect(img, x + (left ? 1 : 0), y + 2, TILE - (left ? 1 : 0) - (right ? 1 : 0), 1, C.s1);
    // the rounded ends: shave the corners
    if (left) { px(img, x, y + 1, C.n0, 0); px(img, x, y + 13, C.n0, 0); px(img, x + 1, y + 2, C.s0); px(img, x + 1, y + 12, C.n0); }
    if (right) { px(img, x + 15, y + 1, C.n0, 0); px(img, x + 15, y + 13, C.n0, 0); px(img, x + 14, y + 2, C.s0); px(img, x + 14, y + 12, C.n0); }
    // the screen
    const sx = 2 + (left ? 1 : 0), sw = TILE - 4 - (left ? 1 : 0) - (right ? 1 : 0);
    rect(img, x + sx, y + 3, sw, 6, C.n0);
    rect(img, x + sx + 1, y + 4, sw - 2, 4, C.cg);
    for (let i = 0; i < sw - 2; i++) {
      const h = 1 + ((i * 7 + 3) % 3);
      px(img, x + sx + 1 + i, y + 7 - h + 1, i % 4 === 0 ? C.am : C.cy); // a little bar chart
    }
    px(img, x + sx + 1, y + 4, C.ch);
    // keys
    rect(img, x + sx, y + 10, sw, 2, C.n1);
    for (let i = 0; i < sw; i += 2) px(img, x + sx + i, y + 10, i % 6 === 0 ? C.te : C.cd);
    // the front lip
    rect(img, x + (left ? 1 : 0), y + 13, TILE - (left ? 1 : 0) - (right ? 1 : 0), 1, C.s1);
    rect(img, x + (left ? 1 : 0), y + 14, TILE - (left ? 1 : 0) - (right ? 1 : 0), 2, C.s0);
    rect(img, x + (left ? 2 : 0), y + 15, TILE - (left ? 2 : 0) - (right ? 2 : 0), 1, C.n0);
    if (core) { // the core terminal: an amber key slot glowing on the desk
      rect(img, x + 5, y + 3, 6, 6, C.n0);
      rect(img, x + 6, y + 4, 4, 4, C.am);
      rect(img, x + 7, y + 5, 2, 2, C.wh);
      frame(img, x + 4, y + 2, 8, 8, C.cy);
    }
  }

  function techChair(img, x, y) {
    rect(img, x + 4, y + 1, 8, 4, C.n0);
    rect(img, x + 5, y + 2, 6, 2, C.n3);
    px(img, x + 6, y + 2, C.cd); px(img, x + 7, y + 2, C.cy); px(img, x + 8, y + 2, C.cy); px(img, x + 9, y + 2, C.cd);
    rect(img, x + 3, y + 5, 10, 6, C.n0);
    rect(img, x + 4, y + 5, 8, 5, C.n4);
    rect(img, x + 4, y + 5, 8, 1, C.s1);
    rect(img, x + 7, y + 11, 2, 2, C.s0);
    rect(img, x + 4, y + 13, 8, 1, C.n0);
    px(img, x + 4, y + 14, C.n0); px(img, x + 11, y + 14, C.n0); px(img, x + 7, y + 14, C.n0); px(img, x + 8, y + 14, C.n0);
  }
  function techCoffee(img, x, y) {
    rect(img, x + 3, y + 1, 10, 14, C.n0);
    rect(img, x + 4, y + 2, 8, 12, C.s1);
    rect(img, x + 4, y + 2, 8, 1, C.s3);
    rect(img, x + 5, y + 3, 6, 4, C.n0);
    rect(img, x + 6, y + 4, 4, 2, C.cd);
    px(img, x + 6, y + 4, C.ch); px(img, x + 9, y + 5, C.cy);
    rect(img, x + 5, y + 8, 6, 1, C.s0);
    rect(img, x + 6, y + 9, 4, 4, C.n1); // the cup bay
    px(img, x + 7, y + 11, C.am); px(img, x + 8, y + 11, C.am);
    rect(img, x + 4, y + 13, 8, 1, C.s0);
  }
  function techPlanter(img, x, y) {
    // leaves first, the capsule over them
    const leaf = [[4, 6], [6, 3], [8, 2], [10, 4], [11, 6], [7, 5], [5, 4], [9, 6]];
    for (const [lx, ly] of leaf) { rect(img, x + lx - 1, y + ly - 1, 3, 3, C.gd); px(img, x + lx, y + ly - 1, C.gn); }
    rect(img, x + 7, y + 6, 2, 4, C.gd);
    rect(img, x + 2, y + 8, 12, 7, C.n0);
    rect(img, x + 3, y + 9, 10, 5, C.n3);
    rect(img, x + 3, y + 9, 10, 1, C.s1);
    rect(img, x + 3, y + 12, 10, 1, C.cd);
    px(img, x + 4, y + 11, C.cy); px(img, x + 11, y + 11, C.cy);
  }
  // A small standing terminal (a data pylon): a narrow screen on a post.
  function techPylon(img, x, y) {
    rect(img, x + 5, y + 1, 6, 9, C.n0);
    rect(img, x + 6, y + 2, 4, 7, C.cg);
    px(img, x + 7, y + 3, C.ch); px(img, x + 8, y + 5, C.cy); px(img, x + 7, y + 7, C.te);
    rect(img, x + 7, y + 10, 2, 3, C.s0);
    rect(img, x + 4, y + 13, 8, 2, C.n0);
    rect(img, x + 5, y + 13, 6, 1, C.s1);
  }

  // ---------- the big wall display (4 x 2 tiles: the top row on the wall, the lower row a console under it) ----------
  function displayImg() {
    const w = TILE * 4, h = TILE * 2;
    const o = canvas(w, h);
    rect(o, 0, 0, w, h, C.n0);
    rect(o, 1, 1, w - 2, 24, C.s0);
    rect(o, 2, 2, w - 4, 22, C.n0);
    rect(o, 3, 3, w - 6, 20, C.cg); // the screen
    for (let gx = 3; gx < w - 3; gx += 8) rect(o, gx, 3, 1, 20, C.n1); // a faint grid
    for (let gy = 7; gy < 23; gy += 8) rect(o, 3, gy, w - 6, 1, C.n1);
    // the graph: a rising trace with its area, a pack-monitor cyan on dark teal
    const pts = [[4, 20], [10, 17], [16, 18], [22, 13], [28, 14], [34, 9], [40, 10], [46, 6]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      for (let s = 0; s <= x1 - x0; s++) {
        const gx = x0 + s, gy = Math.round(y0 + ((y1 - y0) * s) / (x1 - x0));
        for (let fy = gy + 1; fy < 23; fy++) px(o, gx, fy, C.n2);
        px(o, gx, gy, C.cy); px(o, gx, gy - 1, C.cd);
      }
    }
    for (const [gx, gy] of pts) { px(o, gx, gy, C.ch); px(o, gx, gy - 1, C.ch); }
    // right side: a bar chart and a few text rows
    const bars = [9, 13, 7, 15, 11];
    bars.forEach((bh, i) => { rect(o, 50 + i * 2, 22 - bh, 1, bh, i % 2 ? C.te : C.am); });
    rect(o, 49, 5, 11, 1, C.cd); rect(o, 49, 8, 8, 1, C.s1);
    px(o, 5, 5, C.ch); rect(o, 6, 5, 8, 1, C.cd);
    // the console lip under the screen (the lower tile row)
    rect(o, 1, 25, w - 2, 1, C.s2);
    rect(o, 1, 26, w - 2, 5, C.n3);
    rect(o, 1, 26, w - 2, 1, C.s1);
    for (let bx = 5; bx < w - 6; bx += 6) { rect(o, bx, 28, 3, 2, C.n0); px(o, bx + 1, 28, bx % 12 === 5 ? C.cy : C.am); }
    rect(o, 0, 31, w, 1, C.n0);
    return o;
  }
  let displayCache = null;
  const displayTile = (img, x, y, col, row) => { displayCache = displayCache || displayImg(); crop(img, x, y, displayCache, col * TILE, row * TILE); };

  // ---------- the holographic table (4 x 2 tiles) and its rotating globe (an overlay, 3 frames of 2 x 1 tiles) ----------
  function holoTableImg() {
    const w = TILE * 4, h = TILE * 2;
    const o = canvas(w, h);
    // the table top, a rounded slab seen from above
    for (let yy = 2; yy < 16; yy++) for (let xx = 0; xx < w; xx++) {
      const edgeX = Math.min(xx, w - 1 - xx);
      const inset = yy < 5 ? 5 - yy : 0; // rounded back corners
      if (edgeX < inset) continue;
      px(o, xx, yy, edgeX === inset || yy === 2 ? C.s1 : C.n3);
    }
    rect(o, 3, 4, w - 6, 12, C.n1);
    // the glowing inset: an ellipse of light on the slab
    for (let yy = 3; yy < 16; yy++) for (let xx = 0; xx < w; xx++) {
      const d = Math.hypot((xx - 31.5) / 26, (yy - 9.5) / 5.4);
      if (d <= 1.0 && d > 0.88) px(o, xx, yy, C.cy);
      else if (d <= 0.88 && d > 0.8) px(o, xx, yy, C.cd);
      else if (d <= 0.8) px(o, xx, yy, C.cg);
    }
    px(o, 31, 9, C.ch); px(o, 32, 9, C.ch); px(o, 31, 10, C.cy); px(o, 32, 10, C.cy); // the emitter
    // the front face with an under-glow, and two feet
    rect(o, 2, 16, w - 4, 10, C.n2);
    rect(o, 2, 16, w - 4, 1, C.s0);
    rect(o, 3, 17, w - 6, 1, C.n3);
    rect(o, 2, 24, w - 4, 1, C.cd);
    rect(o, 3, 25, w - 6, 1, C.cy);
    for (let bx = 6; bx < w - 8; bx += 8) { rect(o, bx, 19, 4, 2, C.n0); px(o, bx + 1, 19, C.cy); }
    rect(o, 2, 26, w - 4, 1, C.n0);
    rect(o, 5, 27, 5, 5, C.n0); rect(o, w - 10, 27, 5, 5, C.n0);
    rect(o, 6, 27, 3, 4, C.n2); rect(o, w - 9, 27, 3, 4, C.n2);
    return o;
  }
  let holoCache = null;
  const holoTile = (img, x, y, col, row) => { holoCache = holoCache || holoTableImg(); crop(img, x, y, holoCache, col * TILE, row * TILE); };
  // The globe is drawn centred on the table's emitter (x 32, y 9 of the table = x 16, y 9 of a 32x16 overlay over tile columns 1 and 2).
  function holoGlobe(img, x, y, frame, side) {
    const o = canvas(32, 16);
    const cx = 16, cy = 7;
    const rx = [5.4, 3.6, 1.6][frame];
    for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 32; xx++) {
      const dx = xx - cx + 0.5, dy = yy - cy + 0.5;
      const d = Math.hypot(dx, dy);
      if (d > 5.6) { if (d < 7.4) raw(o, xx, yy, C.cy, d < 6.4 ? 38 : 16); continue; } // the soft glow round the sphere
      const rim = d > 4.4;
      const lat = Math.abs(dy) < 0.6 || Math.abs(Math.abs(dy) - 3) < 0.5;
      // a meridian: points where dx^2 / rx^2 + dy^2 / R^2 ~ 1 (an ellipse of width rx), mirrored by the rotation frame
      const mer = Math.abs((dx * dx) / (rx * rx) + (dy * dy) / 29 - 1) < 0.16 || Math.abs(dx) < 0.55;
      if (rim) raw(o, xx, yy, C.cy, 230);
      else if (lat || mer) raw(o, xx, yy, C.ch, 215);
      else raw(o, xx, yy, C.cd, 70);
    }
    // a beam down to the emitter
    for (let yy = 12; yy < 16; yy++) for (let xx = 14; xx < 18; xx++) raw(o, xx, yy, C.cy, xx === 15 || xx === 16 ? 90 : 40);
    crop(img, x, y, o, side * TILE, 0);
  }

  // ---------- the ceiling light bar (an overhead tile: soft white-cyan, drawn over everything at the indoor overhead alpha) ----------
  function lightBar(img, x, y, end) {
    const x0 = end === 'L' ? 3 : 0;
    const x1 = end === 'R' ? 12 : 15;
    for (let yy = 4; yy < 12; yy++) for (let xx = x0; xx <= x1; xx++) {
      const core = yy >= 7 && yy <= 8;
      const near = yy === 6 || yy === 9;
      raw(img, x + xx, y + yy, core ? C.wh : near ? C.ch : C.cy, core ? 255 : near ? 190 : yy === 5 || yy === 10 ? 90 : 45);
    }
  }

  // ---------- Alice: a small hovering white-and-teal service robot ----------
  // A 16x24 character sheet in the game's layout (4 rows down/up/left/right x 8 columns: idle, 6 hover frames, idle-anim), so every existing
  // NPC code path works on it. She bobs up and down one pixel: columns 0 / 7 are the two poses the idle animation alternates between.
  const BOB = [0, 0, -1, -1, -1, 0, 0, -1];
  function alicePose(img, ox, oy, dir, bob) {
    const y0 = oy + 5 + bob; // the top of her dome
    const P = {
      body: C.wh, shade: C.s3, line: C.s1, outline: C.n0, teal: C.te, tealDark: C.cd, visor: C.n1, eye: C.cy, eyeHot: C.ch, glow: C.cy,
    };
    // the hover glow and shadow under her (does not bob)
    for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 12; xx++) {
      const d = Math.hypot((xx - 5.5) / 6, (yy - 1.5) / 2);
      if (d <= 1) raw(img, ox + 2 + xx, oy + 19 + yy, d < 0.55 ? C.cy : C.cd, d < 0.55 ? 150 : 70);
    }
    // the dome (head) and the capsule body, as one rounded shape: 10 wide, 11 tall
    const shape = [
      '...oooooo...',
      '..oWWWWWWo..',
      '.oWWWWWWWWo.',
      '.oWWWWWWWWo.',
      '.oWWWWWWWSo.',
      '.oWWWWWWSSo.',
      '.oTTTTTTTTo.',
      '.oTtttttttTo'.slice(0, 12),
      '..oWWWWWSSo.',
      '..oSSSSSSSo.',
      '...oooooo...',
    ];
    const colour = { o: P.outline, W: P.body, S: P.shade, T: P.teal, t: P.tealDark };
    shape.forEach((row, yy) => [...row].forEach((ch, xx) => { if (colour[ch]) px(img, ox + 2 + xx, y0 + yy, colour[ch]); }));
    // side thrusters
    const thr = (tx) => { rect(img, ox + tx, y0 + 6, 2, 3, P.outline); px(img, ox + tx + (tx < 8 ? 1 : 0), y0 + 7, P.glow); };
    if (dir === 'down' || dir === 'up') { thr(1); thr(13); }
    // the face
    if (dir === 'down') {
      rect(img, ox + 4, y0 + 2, 8, 3, P.visor);
      rect(img, ox + 5, y0 + 3, 6, 1, P.eye);
      px(img, ox + 7, y0 + 3, P.eyeHot); px(img, ox + 8, y0 + 3, P.eyeHot);
      px(img, ox + 7, y0 - 1, P.outline); px(img, ox + 8, y0 - 2, P.outline); px(img, ox + 8, y0 - 3, P.glow); // antenna with a lit tip
    } else if (dir === 'up') {
      rect(img, ox + 5, y0 + 2, 6, 3, P.shade);
      rect(img, ox + 6, y0 + 3, 4, 1, P.tealDark);
      px(img, ox + 7, y0 - 1, P.outline); px(img, ox + 8, y0 - 2, P.outline); px(img, ox + 8, y0 - 3, P.glow);
    } else {
      const left = dir === 'left';
      const vx = left ? 3 : 8; // the visor sits on the side she faces
      rect(img, ox + vx, y0 + 2, 6, 3, P.visor);
      rect(img, ox + vx + (left ? 0 : 1), y0 + 3, 5, 1, P.eye);
      px(img, ox + vx + (left ? 0 : 4), y0 + 3, P.eyeHot);
      const tx = left ? 10 : 5;
      px(img, ox + tx, y0 - 1, P.outline); px(img, ox + tx, y0 - 2, P.outline); px(img, ox + tx, y0 - 3, P.glow);
      rect(img, ox + (left ? 11 : 1), y0 + 6, 3, 3, P.outline); // the one thruster on her far side
      px(img, ox + (left ? 12 : 2), y0 + 7, P.glow);
    }
  }
  function buildAlice() {
    const COLS = 8;
    const sheet = new Img(COLS * TILE, 4 * 24);
    ['down', 'up', 'left', 'right'].forEach((dir, row) => {
      for (let col = 0; col < COLS; col++) alicePose(sheet, col * TILE, row * 24, dir, BOB[col]);
    });
    return sheet;
  }

  // ---------- the tile list (names are the contract with tools/interiors, src/maps.js and the tests) ----------
  const strips = {
    H: { w: 1, e: 1 }, V: { n: 1, s: 1 },
    SE: { s: 1, e: 1 }, SW: { s: 1, w: 1 }, NE: { n: 1, e: 1 }, NW: { n: 1, w: 1 }, TS: { w: 1, e: 1, s: 1 },
  };
  const tiles = [
    { name: 'intTechFloor', draw: (img, x, y) => techFloor(img, x, y, 0) },
    { name: 'intTechFloorB', draw: (img, x, y) => techFloor(img, x, y, 1) },
    ...Object.entries(strips).map(([key, arms]) => ({ name: `intTechFloorStrip${key}`, draw: (img, x, y) => strip(img, x, y, arms) })),
    { name: 'intTechPad', draw: techPad },
    { name: 'intTechTrunkH', draw: (img, x, y) => techTrunk(img, x, y, false) },
    { name: 'intTechTrunkV', draw: (img, x, y) => techTrunk(img, x, y, true) },
    { name: 'intWallTech', solid: true, draw: (img, x, y) => wallTech(img, x, y, null) },
    { name: 'intWallTechEndL', solid: true, draw: (img, x, y) => wallTech(img, x, y, 'L') },
    { name: 'intWallTechEndR', solid: true, draw: (img, x, y) => wallTech(img, x, y, 'R') },
    { name: 'intWallTechCap', solid: true, draw: wallTechCap },
    ...[0, 1, 2, 3].map((col) => ({ name: `intWallDisplay${col}`, solid: true, draw: (img, x, y) => displayTile(img, x, y, col, 0) })),
    ...[0, 1, 2, 3].map((col) => ({ name: `intTechDisplayBase${col}`, solid: true, draw: (img, x, y) => displayTile(img, x, y, col, 1) })),
    { name: 'intWallScanner', solid: true, draw: wallScanner },
    ...[0, 1, 2].map((level) => ({ name: `intScannerGlow${level}`, draw: (img, x, y) => scannerGlow(img, x, y, level) })),
    { name: 'intScannerOk', draw: scannerOk },
    // the hatch: closed (solid, the sealed door), half, open (walkable) -- the names are tools/lib/door-kinds.js `iclHatch`
    ...['closed', 'half', 'open'].flatMap((state) => ['L', 'R'].map((side, i) => ({
      name: DOOR_KINDS.iclHatch[state][i],
      solid: state === 'closed',
      draw: (img, x, y) => hatchTile(img, x, y, side, state),
    }))),
    { name: 'intTechRackTopA', solid: true, draw: (img, x, y) => rackTop(img, x, y, 0) },
    { name: 'intTechRackBaseA', solid: true, draw: (img, x, y) => rackBase(img, x, y, 0) },
    { name: 'intTechRackTopB', solid: true, draw: (img, x, y) => rackTop(img, x, y, 1) },
    { name: 'intTechRackBaseB', solid: true, draw: (img, x, y) => rackBase(img, x, y, 1) },
    { name: 'intTechLedsTopA', draw: (img, x, y) => rackLeds(img, x, y, [4, 8, 12], false) },
    { name: 'intTechLedsTopB', draw: (img, x, y) => rackLeds(img, x, y, [4, 8, 12], true) },
    { name: 'intTechLedsBaseA', draw: (img, x, y) => rackLeds(img, x, y, [2, 6, 10], false) },
    { name: 'intTechLedsBaseB', draw: (img, x, y) => rackLeds(img, x, y, [2, 6, 10], true) },
    { name: 'intTechConsoleL', solid: true, draw: (img, x, y) => console_(img, x, y, 'L', false) },
    { name: 'intTechConsoleM', solid: true, draw: (img, x, y) => console_(img, x, y, null, false) },
    { name: 'intTechConsoleR', solid: true, draw: (img, x, y) => console_(img, x, y, 'R', false) },
    { name: 'intTechConsoleS', solid: true, draw: (img, x, y) => console_(img, x, y, 'S', false) },
    { name: 'intTechCoreConsole', solid: true, draw: (img, x, y) => console_(img, x, y, 'S', true) },
    { name: 'intTechChair', solid: true, draw: techChair },
    { name: 'intTechCoffee', solid: true, draw: techCoffee },
    { name: 'intTechPlanter', solid: true, draw: techPlanter },
    { name: 'intTechPylon', solid: true, draw: techPylon },
    ...[0, 1, 2, 3].flatMap((col) => [0, 1].map((row) => ({ name: `intHoloTable${col}${row}`, solid: true, draw: (img, x, y) => holoTile(img, x, y, col, row) }))),
    ...[0, 1, 2].flatMap((frame) => [0, 1].map((side) => ({ name: `intHoloGlobe${frame}${side ? 'R' : 'L'}`, draw: (img, x, y) => holoGlobe(img, x, y, frame, side) }))),
    { name: 'intTechLightBarL', overhead: true, draw: (img, x, y) => lightBar(img, x, y, 'L') },
    { name: 'intTechLightBarM', overhead: true, draw: (img, x, y) => lightBar(img, x, y, null) },
    { name: 'intTechLightBarR', overhead: true, draw: (img, x, y) => lightBar(img, x, y, 'R') },
  ];

  return { tiles, buildAlice };
};
