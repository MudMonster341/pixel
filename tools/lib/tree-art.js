// Tree art for the campus (FB-0053 / FB-0056): a date palm and leafy trees, each drawn as ONE 32 x 48 px
// picture (2 tiles wide, 3 tall) that tools/make-assets.js then slices into the six tiles a planted
// tree uses (4 overhead canopy quadrants + the solid trunk tile + a non-solid foot tile).
//
//   - The date palm is code-composed here (no free pack has a proper date palm: the Ninja Adventure desert
//     tileset only has a stubby potted plant), from the project palette only: a curved, ringed trunk, a
//     crown of drooping feathery fronds and a bunch of dates.
//   - The leafy trees are cropped from the Sprout Lands Basic pack (Cup Nooble, credited in CREDITS.md): its
//     round and tall trees, recoloured onto the project's own leaf ramp with brown (not orange) trunks, the
//     canopy kept as the pack drew it (soft 4-tone shading) and the trunk lengthened so the tree fits the
//     3-tile footprint.
//
// Every picture is a grid of palette keys (tools/make-assets.js PALETTE) or '.' for transparent, plus an
// optional 'S' that means "soft ground shadow" (translucent, drawn by make-assets). Trunk and the first
// tile's worth of foot always sit inside the LEFT tile column (x 0..15) so the solid trunk tile is the
// left one, exactly like the old trees (plantTree puts the trunk below the canopy's left column).

const W = 32;
const H = 48;

function canvas() {
  return Array.from({ length: H }, () => Array(W).fill('.'));
}
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
function put(c, x, y, k) {
  x = Math.round(x);
  y = Math.round(y);
  if (inside(x, y)) c[y][x] = k;
}
const toRows = (c) => c.map((row) => row.join(''));

// ---------- the date palm ----------

// Cubic Bezier point.
const bez3 = (p, t) => {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  };
};

// One frond: leaves the crown `c`, arches up by `rise`, then droops `droop` px at the tip, `reach` px out
// (negative = to the left). `lit` 1 = sunlit (upper fronds), 0 = shaded (the front ones). The blade is a
// 3 px band (light edge, body, dark edge) along a curve that tapers to a point, with short leaflet ticks
// hanging off the underside, so every frond reads on its own.
function drawFrond(cv, c, reach, rise, droop, lit) {
  const P = [
    { x: c.x, y: c.y },
    { x: c.x + reach * 0.3, y: c.y - rise * 1.35 },
    { x: c.x + reach * 0.8, y: c.y - rise * 1.15 },
    { x: c.x + reach, y: c.y - rise + droop },
  ];
  const dir = reach >= 0 ? 1 : -1;
  const hi = lit ? 't' : 'T';
  const steps = 60;
  const seen = new Set();
  const plot = (x, y, k) => {
    const key = x + ',' + y;
    if (seen.has(key)) return;
    seen.add(key);
    put(cv, x, y, k);
  };
  let prev = bez3(P, 0);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const p = bez3(P, t);
    const dx = p.x - prev.x;
    const dy = p.y - prev.y;
    prev = p;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const thick = t < 0.75 ? 1 : 0; // the last quarter narrows to a single line
    if (Math.abs(dx) >= Math.abs(dy)) {
      plot(x, y - 1 - thick, lit && x % 3 === 0 ? 'G' : hi);
      if (thick) plot(x, y - 1, hi);
      plot(x, y, 'T');
      plot(x, y + 1, 'e');
      if (thick) plot(x, y + 2, 'e');
      if (t > 0.18 && x % 2 === 0) { plot(x, y + 2 + thick, 'T'); plot(x + dir, y + 3 + thick, 'e'); }
    } else {
      plot(x - dir * 2, y, hi);
      plot(x - dir, y, hi);
      plot(x, y, 'T');
      plot(x + dir, y, 'e');
    }
  }
}

// Palm geometry per variant: crown centre, trunk foot x, fronds [reach, rise, droop, sunlit] back to front.
const PALMS = {
  palm1: {
    crown: { x: 15, y: 14 }, footX: 9, trunkTopW: 3,
    fronds: [
      [-4, 12, 3, 1], [5, 12, 3, 1],
      [-10, 11, 8, 1], [11, 11, 8, 1],
      [-14, 7, 12, 1], [14, 7, 12, 1],
      [-7, 3, 10, 0], [8, 3, 10, 0],
    ],
    dates: [[-1, 3], [1, 4], [0, 5], [-2, 5]],
  },
  palm2: {
    crown: { x: 14, y: 14 }, footX: 11, trunkTopW: 3,
    fronds: [
      [1, 13, 2, 1],
      [-8, 12, 6, 1], [9, 12, 6, 1],
      [-13, 9, 11, 1], [14, 9, 11, 1],
      [-11, 3, 11, 0], [12, 3, 11, 0],
      [-4, 2, 9, 0], [5, 2, 9, 0],
    ],
    dates: [[1, 3], [-1, 4], [2, 5], [0, 6]],
  },
};

function palmTrunk(cv, g) {
  const top = g.crown.y + 2;
  for (let y = top; y < H - 1; y++) {
    const t = (y - top) / (H - 1 - top); // 0 at the crown, 1 at the foot
    const cx = g.crown.x + (g.footX - g.crown.x) * Math.pow(t, 1.6) - Math.sin(t * Math.PI) * 1.6;
    const w = g.trunkTopW + Math.round(t * 2) + (y > H - 5 ? 2 : 0); // widens towards the foot
    const x0 = Math.round(cx - w / 2);
    for (let k = 0; k < w; k++) {
      let key = k === 0 ? 'D' : k >= w - 1 ? 'N' : 'd';
      put(cv, x0 + k, y, key);
    }
    put(cv, x0 - 1, y, 'n');
    put(cv, x0 + w, y, 'n');
    // ring marks every 3 rows
    if ((y - top) % 3 === 2) for (let k = 0; k < w; k++) put(cv, x0 + k, y, k === 0 ? 'd' : 'N');
  }
  // the foot: a small root flare
  const fx = g.footX;
  for (let k = -4; k <= 4; k++) put(cv, fx + k + 1, H - 1, Math.abs(k) === 4 ? 'n' : 'N');
}

function buildPalm(name) {
  const g = PALMS[name];
  const cv = canvas();
  palmTrunk(cv, g);
  // soft ground shadow under the foot (resolved to a translucent pixel by make-assets)
  for (let x = g.footX - 7; x <= g.footX + 9; x++) put(cv, x, H - 1, cv[H - 1][x] === '.' ? 'S' : cv[H - 1][x]);
  for (let x = g.footX - 4; x <= g.footX + 6; x++) put(cv, x, H - 2, cv[H - 2][x] === '.' ? 'S' : cv[H - 2][x]);
  for (const [reach, rise, droop, lit] of g.fronds) drawFrond(cv, g.crown, reach, rise, droop, lit);
  // the crown boss where the fronds meet
  for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
    if (dx * dx / 9 + dy * dy / 5 <= 1) put(cv, g.crown.x + dx, g.crown.y + dy, dy < 0 ? 'l' : dy === 0 ? 't' : 'T');
  }
  // a bunch of dates hanging under the crown
  for (const [dx, dy] of g.dates) {
    put(cv, g.crown.x + dx, g.crown.y + dy, 'j');
    put(cv, g.crown.x + dx, g.crown.y + dy + 1, 'x');
  }
  return toRows(cv);
}

// ---------- leafy trees (Sprout Lands crop, recoloured) ----------

// Sprout Lands Basic, Objects/Basic_Grass_Biom_things.png: the plain round tree and the tall narrow tree.
const SPROUT_FILE = 'sprout-lands-basic/Sprout Lands - Sprites - Basic pack/Objects/Basic_Grass_Biom_things.png';
const LEAFY = {
  // x, y, w, h of the pack sprite; `left` = where its left edge lands in the 32 px picture (so the trunk, which
  // is 8..9 px wide and sits mid-sprite, ends up inside the left tile column); `top` = first picture row.
  leafy1: { src: { x: 20, y: 1, w: 26, h: 31 }, left: 0, top: 8, trunk: 6, ramp: 'fresh', flip: false },
  leafy2: { src: { x: 20, y: 1, w: 26, h: 31 }, left: 0, top: 10, trunk: 7, ramp: 'deep', flip: true },
  leafy3: { src: { x: 1, y: 0, w: 14, h: 29 }, left: 4, top: 4, trunk: 13, ramp: 'fresh', flip: false },
};
// The pack's own exact colours -> palette keys. greens: highlight, light, mid, shade, outline; browns: light..dark.
const RAMPS = {
  fresh: { '194,224,154': 'l', '174,212,153': 'G', '151,187,142': 't', '110,150,124': 'T', '95,122,121': 'e' },
  deep: { '194,224,154': 'G', '174,212,153': 't', '151,187,142': 'T', '110,150,124': 'e', '95,122,121': 'e' },
};
const BROWNS = { '196,154,108': 'F', '182,137,98': 'f', '170,121,89': 'N', '144,98,93': 'n', '150,109,87': 'n', '160,114,92': 'N' };

function nearestBrown(r, g, b) {
  const refs = [[196, 154, 108, 'F'], [182, 137, 98, 'f'], [170, 121, 89, 'N'], [144, 98, 93, 'n']];
  let best = 'N';
  let bd = 1e9;
  for (const [rr, gg, bb, key] of refs) {
    const d = (r - rr) ** 2 + (g - gg) ** 2 + (b - bb) ** 2;
    if (d < bd) { bd = d; best = key; }
  }
  return best;
}
function nearestGreen(r, g, b, ramp) {
  let best = null;
  let bd = 1e9;
  for (const [rgb, key] of Object.entries(ramp)) {
    const [rr, gg, bb] = rgb.split(',').map(Number);
    const d = (r - rr) ** 2 + (g - gg) ** 2 + (b - bb) ** 2;
    if (d < bd) { bd = d; best = key; }
  }
  return best;
}

// `atlas` is a decoded PNG ({ width, data }). Returns the 48 row strings of the picture.
function buildLeafy(name, atlas) {
  const spec = LEAFY[name];
  const ramp = RAMPS[spec.ramp];
  const { x, y, w, h } = spec.src;
  // classify each source pixel into a palette key ('.' transparent, 'S' translucent shadow)
  const px = (sx, sy) => {
    const i = ((y + sy) * atlas.width + (x + sx)) * 4;
    const [r, g, b, a] = [atlas.data[i], atlas.data[i + 1], atlas.data[i + 2], atlas.data[i + 3]];
    if (a === 0) return '.';
    if (a < 255) return 'S';
    const key = `${r},${g},${b}`;
    if (ramp[key]) return ramp[key];
    if (BROWNS[key]) return BROWNS[key];
    return g >= r ? nearestGreen(r, g, b, ramp) : nearestBrown(r, g, b);
  };
  const src = [];
  for (let sy = 0; sy < h; sy++) {
    const row = [];
    for (let sx = 0; sx < w; sx++) row.push(px(spec.flip ? w - 1 - sx : sx, sy));
    src.push(row);
  }
  const isBrown = (k) => 'FfNn'.includes(k);
  const isGreen = (k) => 'lGtTeK'.includes(k);
  // canopy = rows up to the last row that has green; the trunk rows after it repeat to lengthen the tree
  let canopyEnd = 0;
  src.forEach((row, sy) => { if (row.some(isGreen)) canopyEnd = sy; });
  const trunkRows = [];
  for (let sy = canopyEnd + 1; sy < h; sy++) if (src[sy].some(isBrown)) trunkRows.push(sy);
  const bodyRow = trunkRows[Math.min(1, trunkRows.length - 1)]; // a straight trunk row to repeat
  const footRows = trunkRows.slice(Math.max(2, trunkRows.length - 4)); // the root flare + shadow
  const shadowRows = [];
  for (let sy = canopyEnd + 1; sy < h; sy++) if (!src[sy].some(isBrown) && src[sy].some((k) => k === 'S')) shadowRows.push(sy);
  const cv = canvas();
  let row = spec.top;
  const draw = (sy) => {
    if (row >= H) return;
    for (let sx = 0; sx < w; sx++) {
      const px2 = src[sy][sx];
      if (px2 !== '.') put(cv, spec.left + sx, row, px2);
    }
    row++;
  };
  for (let sy = 0; sy <= canopyEnd; sy++) draw(sy);
  // lengthen the trunk so the tree is as tall as its 3-tile footprint (leaves 1-2 rows for the foot)
  const footCount = footRows.length + shadowRows.length;
  const straight = Math.max(0, Math.min(spec.trunk, H - row - footCount));
  for (let i = 0; i < straight; i++) draw(bodyRow);
  footRows.forEach(draw);
  shadowRows.forEach(draw);
  // sit the whole tree on the bottom edge of the picture, so its foot is the bottom of the trunk tile (the solid tile the
  // player is stopped by) instead of floating half a tile above it
  let last = 0;
  cv.forEach((r, y) => { if (r.some((k) => k !== '.')) last = y; });
  const shift = H - 1 - last;
  const shifted = canvas();
  for (let y = 0; y <= last; y++) shifted[y + shift] = cv[y];
  return toRows(shifted);
}

module.exports = { W, H, PALM_NAMES: Object.keys(PALMS), PALM_FROND_COUNT: Object.fromEntries(Object.entries(PALMS).map(([n, g]) => [n, g.fronds.length])), LEAFY_NAMES: Object.keys(LEAFY), SPROUT_FILE, buildPalm, buildLeafy };
