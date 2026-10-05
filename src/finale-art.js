// The finale's drawing (W3, src/finale.js has the rules): a dusk sky, a Dubai skyline silhouette, a table with a tiered cake and
// 22 candles, the flames, smoke, fireworks and balloons -- all as plain SHAPE LISTS, { k: 'r' | 'e' | 'c', ... } (rect, ellipse by
// centre, circle), colour 0xRRGGBB and alpha. src/scenes/finale.js replays them onto Phaser Graphics (and bakes the static ones
// into textures once); the same lists can be rasterised in node, which is how the layout was checked without a browser
// (a throw-away script drew them onto an RGBA buffer, tools/lib/png.js). Free/code art only: every shape is generic (a needle
// tower, a sail-shaped hotel, an arched tower, blocks with lit windows): no logos, no PNG, nothing hand-edited.
//
// Deterministic: the skyline, the stars and the cake's decorations come from seeded random numbers (finaleRng), never Math.random().
// Loaded after src/finale.js (it uses finaleRng, FINALE_CAKE, candlePositions and the firework functions).

const FINALE_HORIZON_Y = 372; // where the skyline stands
const FINALE_TABLE_Y = 432; // the table's far edge (she stands behind it)
const FINALE_SKY_STOPS = [0x14113a, 0x241b57, 0x3d2a73, 0x6a3b86, 0xa9548c, 0xdb7a90, 0xf3a58f]; // = CREDITS_SKY_STOPS (pinned by a test)
const FINALE_FAR_COLOR = 0x7b4a8f; // the hazy far row of buildings
const FINALE_NEAR_COLOR = 0x3b2468; // the near row
const FINALE_TERRACE_COLOR = 0x3a2660;
const FINALE_CANDLE_COLORS = [0xffa3c6, 0xbfe0ff, 0xffe29a, 0xc9f0c4, 0xcdb6ff];
const FINALE_WINDOW_COLORS = [0xffe29a, 0xffc2d9];
const FINALE_PLAYER_POS = { x: 190, y: FINALE_TABLE_Y }; // her feet (origin 0.5, 1), scaled 3x, behind the table
const FINALE_MOUTH = { x: 214, y: 384 }; // where her breath starts (for the little puffs)

const shR = (x, y, w, h, c, a = 1) => ({ k: 'r', x, y, w, h, c, a });
const shE = (x, y, w, h, c, a = 1) => ({ k: 'e', x, y, w, h, c, a }); // x, y = centre
const shC = (x, y, r, c, a = 1) => ({ k: 'c', x, y, r, c, a });

// Linear blend across FINALE_SKY_STOPS: 0 the top of the sky, 1 the horizon (the credits' own sky, src/scenes/credits.js).
function finaleSkyColor(t) {
  const stops = FINALE_SKY_STOPS;
  const scaled = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - i;
  const mix = (shift) => Math.round(((stops[i] >> shift) & 255) * (1 - f) + ((stops[i + 1] >> shift) & 255) * f);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

// ---------- the sky ----------

function finaleSkyShapes() {
  const out = [];
  const bands = 28;
  const bandH = Math.ceil(FINALE_HORIZON_Y / bands);
  for (let i = 0; i < bands; i++) out.push(shR(0, i * bandH, 960, bandH + 1, finaleSkyColor(i / (bands - 1))));
  out.push(shR(0, bands * bandH, 960, 540 - bands * bandH, FINALE_SKY_STOPS[FINALE_SKY_STOPS.length - 1]));
  // a warm glow where the sky meets the city (the credits' horizon glow)
  out.push(shE(480, FINALE_HORIZON_Y, 1300, 260, 0xffc29a, 0.10), shE(480, FINALE_HORIZON_Y, 800, 150, 0xffd7a8, 0.10));
  // stars (seeded), only in the dark upper sky
  const rng = finaleRng(4141);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rng() * 960);
    const y = 6 + Math.floor(rng() * 220);
    const size = rng() < 0.2 ? 2 : 1;
    out.push(shR(x, y, size, size, [0xfff6e0, 0xffe3ef, 0xe6ecff][i % 3], 0.35 + rng() * 0.5));
  }
  // the moon (the credits' moon, smaller, over the left)
  out.push(shC(112, 96, 52, 0xfff0cf, 0.05), shC(112, 96, 38, 0xfff0cf, 0.08), shC(112, 96, 22, 0xfff3d9));
  out.push(shC(106, 91, 4, 0xf1dcbc), shC(118, 102, 3, 0xf1dcbc), shC(117, 88, 2, 0xf1dcbc));
  return out;
}

// ---------- the skyline ----------

// Windows are listed apart from the buildings (they flicker, src/finale.js windowLit): { i, x, y, w, h, base, tone }.
function finaleSkyline() {
  const rng = finaleRng(7722);
  const H = FINALE_HORIZON_Y;
  const far = [];
  const near = [];
  const windows = [];
  const NEAR = FINALE_NEAR_COLOR;
  const addWindows = (x, y, w, h, density, maxRows = 9) => {
    let rows = 0;
    for (let wy = y + 7; wy + 3 <= y + h - 6 && rows < maxRows; wy += 9, rows++) {
      for (let wx = x + 4; wx + 2 <= x + w - 4; wx += 7) {
        const base = rng() < density;
        windows.push({ i: windows.length, x: wx, y: wy, w: 2, h: 3, base, tone: rng() < 0.22 ? 1 : 0 });
      }
    }
  };
  const block = (x, y, w, h, density) => { near.push(shR(x, y, w, h, NEAR)); addWindows(x, y, w, h, density); };

  // the far row: low, hazy blocks, no windows
  for (let x = -6; x < 966;) {
    const w = 20 + Math.floor(rng() * 26);
    const h = 24 + Math.floor(rng() * 54);
    far.push(shR(x, H - h, w, h, FINALE_FAR_COLOR));
    if (rng() < 0.35) far.push(shR(x + Math.floor(w * 0.25), H - h - 6, Math.floor(w * 0.5), 6, FINALE_FAR_COLOR));
    x += w + Math.floor(rng() * 4) - 1;
  }

  // landmark 1: a sail-shaped hotel on a little island (a spine, a curving sail built from 4 px rows, a spire)
  const sail = () => {
    near.push(shR(152, 356, 146, 16, NEAR), shR(172, 332, 70, 24, NEAR), shR(176, 130, 6, 230, NEAR), shR(178, 100, 2, 32, NEAR));
    for (let y = 134; y < 358; y += 4) {
      const t = (y - 134) / 224;
      near.push(shR(176, y, Math.round(6 + 84 * Math.pow(t, 1.3)), 4, NEAR));
    }
    for (let y = 150; y < 340; y += 12) {
      const t = (y - 134) / 224;
      const sw = Math.round(6 + 84 * Math.pow(t, 1.3));
      for (let wx = 186; wx + 2 <= 176 + sw - 6; wx += 8) windows.push({ i: windows.length, x: wx, y, w: 2, h: 4, base: rng() < 0.22, tone: rng() < 0.3 ? 1 : 0 });
    }
  };
  // landmark 2: two slim towers with stepped tops and an antenna
  const twins = () => {
    block(326, 214, 24, 158, 0.3); near.push(shR(330, 206, 16, 8, NEAR), shR(337, 188, 1, 18, NEAR));
    block(354, 238, 30, 134, 0.3); near.push(shR(360, 228, 18, 10, NEAR), shR(364, 220, 10, 8, NEAR));
  };
  // landmark 3: an arched tower (two legs joined by a beam, the opening ends in a round arch)
  const arch = () => {
    near.push(shR(420, 168, 24, 204, NEAR), shR(476, 168, 24, 204, NEAR), shR(420, 168, 80, 46, NEAR), shR(440, 156, 40, 12, NEAR), shR(456, 144, 8, 12, NEAR), shR(459, 118, 2, 26, NEAR));
    for (let y = 214; y < 232; y += 2) { // the rounded top of the opening: a circle of radius 16 centred at (460, 230)
      const hw = Math.round(Math.sqrt(Math.max(0, 256 - (230 - y) * (230 - y))));
      near.push(shR(444, y, 16 - hw, 2, NEAR), shR(460 + hw, y, 16 - hw, 2, NEAR));
    }
    addWindows(420, 232, 24, 140, 0.3);
    addWindows(476, 232, 24, 140, 0.3);
    addWindows(420, 168, 80, 46, 0.4, 2);
  };
  // landmark 4: a round tower with a dome and a mast
  const dome = () => {
    block(580, 235, 40, 137, 0.3);
    near.push(shE(600, 235, 40, 24, NEAR), shR(599, 194, 2, 42, NEAR), shR(575, 300, 50, 6, NEAR));
  };
  // landmark 5: a needle tower, stepping in as it rises, with a long spire and two low wings at its foot
  const needle = () => {
    const tiers = [[300, 372, 46], [245, 300, 38], [200, 245, 30], [160, 200, 24], [125, 160, 18], [95, 125, 12], [70, 95, 8]];
    for (const [y0, y1, w] of tiers) { near.push(shR(770 - w / 2, y0, w, y1 - y0, NEAR)); if (w >= 18) addWindows(770 - w / 2, y0, w, y1 - y0, 0.28, 6); }
    near.push(shR(768.5, 30, 3, 42, NEAR), shR(736, 330, 14, 42, NEAR), shR(790, 330, 14, 42, NEAR));
    addWindows(736, 330, 14, 42, 0.3, 3);
    addWindows(790, 330, 14, 42, 0.3, 3);
  };
  // landmark 6: a twisting tower made of offset slices
  const twist = () => {
    for (let i = 0; i < 17; i++) {
      const x = 893 + Math.round(4 * Math.sin(i * 0.6));
      const w = 22 - Math.floor(i / 6) * 2;
      near.push(shR(x, 372 - 12 * (i + 1), w, 12, NEAR));
      if (i % 2 === 0) windows.push({ i: windows.length, x: x + 4, y: 372 - 12 * (i + 1) + 4, w: 2, h: 3, base: rng() < 0.5, tone: 0 });
    }
    near.push(shR(902, 150, 2, 18, NEAR));
  };
  const zones = [
    { x0: 150, x1: 300, make: sail }, { x0: 322, x1: 392, make: twins }, { x0: 414, x1: 506, make: arch },
    { x0: 572, x1: 628, make: dome }, { x0: 736, x1: 806, make: needle }, { x0: 884, x1: 930, make: twist },
  ];

  // the near row: landmarks where they stand, generic blocks in between
  for (let x = -4; x < 964;) {
    const zone = zones.find((z) => x >= z.x0 && x < z.x1);
    if (zone) { zone.make(); x = zone.x1; continue; }
    const nextStart = Math.min(964, ...zones.filter((z) => z.x0 > x).map((z) => z.x0));
    let w = 24 + Math.floor(rng() * 30);
    if (x + w > nextStart || nextStart - (x + w) < 14) w = nextStart - x;
    const h = 36 + Math.floor(rng() * 70);
    block(x, H - h, w, h, 0.38);
    if (rng() < 0.4) near.push(shR(x + Math.floor(w * 0.2), H - h - 7, Math.floor(w * 0.6), 7, NEAR));
    if (rng() < 0.25) near.push(shR(x + Math.floor(w / 2), H - h - 16, 1, 16, NEAR));
    x += w;
  }
  return { far, near, windows };
}

// The city as it is baked into one texture: the far row, the near row, the terrace below the horizon.
function finaleCityShapes(skyline = finaleSkyline()) {
  return [...skyline.far, ...skyline.near, shR(0, FINALE_HORIZON_Y, 960, 540 - FINALE_HORIZON_Y, FINALE_TERRACE_COLOR)];
}

// Which colour a lit window is drawn in.
function finaleWindowColor(win) {
  return FINALE_WINDOW_COLORS[win.tone] || FINALE_WINDOW_COLORS[0];
}

// ---------- the table, the cake, the candles ----------

// The front of the rim of an ellipse centred (cx, cy) with half-width rx, half-height ry, at column x.
const rimY = (cx, cy, rx, ry, x) => cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2));

function finaleTableShapes() {
  const out = [];
  out.push(shR(0, FINALE_TABLE_Y, 960, 73, 0xf2c9ae), shR(0, FINALE_TABLE_Y, 960, 2, 0xdcae92));
  out.push(shR(0, 505, 960, 25, 0xf2b8c6)); // the cloth hanging down the front...
  for (let x = 14; x < 980; x += 28) out.push(shC(x, 530, 14, 0xf2b8c6), shC(x, 514, 3, 0xffd9e4, 0.85)); // ...with a scalloped edge and polka dots
  // two presents on the right
  out.push(shR(740, 452, 50, 36, 0x6fc3ff), shR(736, 444, 58, 10, 0x8fd0ff), shR(762, 444, 6, 44, 0xffe29a), shC(760, 440, 5, 0xffe29a), shC(770, 440, 5, 0xffe29a));
  out.push(shR(812, 462, 38, 28, 0xcdb6ff), shR(809, 456, 44, 8, 0xdcc8ff), shR(827, 456, 6, 34, 0xffa3c6), shC(826, 452, 4, 0xffa3c6), shC(834, 452, 4, 0xffa3c6));
  return out;
}

function finaleCakeShapes() {
  const out = [];
  const rng = finaleRng(1122);
  const cx = FINALE_CAKE.cx;
  // plate and its shadow
  out.push(shE(cx, 482, 372, 46, 0x000000, 0.2), shE(cx, 474, 372, 46, 0xfff4e6), shE(cx, 474, 350, 38, 0xffe9d2));
  // tiers, bottom to top: [body colour, drip colour, left, width, top y, body height, rim ry]
  const tiers = [
    { body: 0xff9ec1, drip: 0xfffaf2, w: 340, top: 440, h: 30, ry: 20 },
    { body: 0xfff0d8, drip: 0xffb8d2, w: 300, top: 410, h: 30, ry: 18 },
    { body: 0xffb8d2, drip: 0xfffaf2, w: 260, top: 382, h: 28, ry: 16 },
  ];
  tiers.forEach((tier, ti) => {
    const left = cx - tier.w / 2;
    out.push(shR(left, tier.top, tier.w, tier.h, tier.body), shE(cx, tier.top + tier.h, tier.w, tier.ry * 2, tier.body), shE(cx, tier.top, tier.w, tier.ry * 2, 0xfffaf2));
    // drips running down from the rim
    for (let x = left + 16; x < left + tier.w - 10; x += 26) {
      const len = 5 + Math.floor(rng() * 9);
      const y = rimY(cx, tier.top, tier.w / 2, tier.ry, x);
      out.push(shR(x - 4, y, 9, len, tier.drip), shC(x, y + len, 4.5, tier.drip));
    }
    // whipped-cream dollops along the front rim, with a berry on every fourth
    let n = 0;
    for (let x = left + 12; x < left + tier.w - 8; x += 15, n++) {
      const y = rimY(cx, tier.top, tier.w / 2, tier.ry, x);
      out.push(shC(x, y, 5.5, 0xffffff), shC(x - 1, y - 1, 2.5, 0xfff0f5));
      if (ti < 2 && n % 4 === 2) {
        const blue = ti === 0;
        out.push(shC(x, y - 5, 4, blue ? 0x5b6fd6 : 0xe5395c), shR(x - 2, y - 7, 1, 1, blue ? 0x9fb0ff : 0xff8fa5), shR(x + 1, y - 10, 3, 2, 0x6fbf5a));
      }
    }
  });
  // pearls round the bottom tier, sprinkles on the top tier
  for (let x = 326; x < 640; x += 14) out.push(shC(x, rimY(cx, 470, 170, 20, x) - 6, 2, 0xffffff, 0.8));
  for (let i = 0; i < 26; i++) {
    const x = 362 + Math.floor(rng() * 236);
    const y = Math.round(rimY(cx, 382, 130, 16, x)) + 6 + Math.floor(rng() * 12);
    if (y < 408) out.push(shR(x, y, 2, 1, [0xffa3c6, 0xffe29a, 0xbfe0ff, 0xc9f0c4][i % 4]));
  }
  return out;
}

// The candle sticks (static: a blown-out candle keeps its stick), back row first so the front ones overlap.
function finaleCandleShapes() {
  const out = [];
  const candles = candlePositions().sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of candles) {
    const color = FINALE_CANDLE_COLORS[c.index % FINALE_CANDLE_COLORS.length];
    out.push(shE(c.x, c.y + 1, 7, 3, 0x000000, 0.15));
    out.push(shR(c.x - 2, c.y - FINALE_CAKE.candleH, 5, FINALE_CAKE.candleH, color), shR(c.x - 2, c.y - 15, 5, 1, 0xffffff, 0.6), shR(c.x - 2, c.y - 9, 5, 1, 0xffffff, 0.6), shR(c.x + 2, c.y - FINALE_CAKE.candleH, 1, FINALE_CAKE.candleH, 0x000000, 0.12));
    out.push(shR(c.x, c.y - FINALE_CAKE.candleH - 2, 1, 2, 0x4a3520));
  }
  return out;
}

// One lit candle: the flame (normal blend) and its halo (additive). `base` is the candle's { x, y }, `shape` from flameShape().
function finaleFlameShapes(base, shape) {
  const x = base.x + 0.5;
  const y = base.y - FINALE_CAKE.candleH - 2; // the wick's tip
  const flame = [
    shE(x + shape.lean * 0.3, y - shape.h * 0.35, shape.w, shape.h * 0.7, 0xff9a3d),
    shE(x + shape.lean * 0.8, y - shape.h * 0.72, shape.w * 0.7, shape.h * 0.6, 0xffb347),
    shE(x + shape.lean * 0.2, y - shape.h * 0.3, shape.w * 0.45, shape.h * 0.45, 0xfff3b0),
  ];
  const glow = [shC(x + shape.lean * 0.5, y - 6, 14 * shape.glow, 0xffb060, 0.1), shC(x + shape.lean * 0.5, y - 6, 8 * shape.glow, 0xffd080, 0.16)];
  return { flame, glow };
}

// The smoke of a candle that went out `ageMs` ago.
function finaleSmokeShapes(base, index, ageMs) {
  return smokeWisps(index, ageMs).map((w) => shC(base.x + w.dx, base.y - FINALE_CAKE.candleH - 4 + w.dy, w.r, 0xe4dcef, w.a));
}

// A few soft puffs of breath travelling from her mouth toward the cake while she blows (`strength` 0..1).
function finaleBreathShapes(tMs, strength) {
  if (strength < 0.05) return [];
  const out = [];
  const target = { x: FINALE_CAKE.cx - FINALE_CAKE.rx - 8, y: FINALE_CAKE.cy - 16 };
  for (let i = 0; i < 6; i++) {
    const u = ((tMs / 650 + i / 6) % 1);
    out.push(shC(FINALE_MOUTH.x + (target.x - FINALE_MOUTH.x) * u, FINALE_MOUTH.y + (target.y - FINALE_MOUTH.y) * u + Math.sin(u * 9 + i) * 3, 2 + u * 4, 0xffffff, 0.35 * strength * (1 - u)));
  }
  return out;
}

// A balloon for a texture 24 wide and 48 tall (the string hangs under it).
function finaleBalloonShapes(color) {
  return [shR(11, 26, 1, 22, 0xffffff, 0.55), shE(12, 12, 20, 24, color), shC(7, 7, 2, 0xffffff, 0.55), shR(10, 24, 4, 3, color), shR(10, 24, 4, 1, 0x000000, 0.12)];
}

// ---------- the fireworks (celebration time `ms`; `particles` maps burst index -> burstParticles(burst)) ----------

function finaleFireworkShapes(ms, schedule, particles) {
  const out = [];
  for (const b of schedule) {
    if (ms < b.t - b.launchMs || ms > b.t + FIREWORK_MAX_LIFE_MS) continue;
    const rocket = rocketAt(b, ms);
    if (rocket) {
      out.push(shR(Math.round(rocket.x - 1), Math.round(rocket.y - 1), 3, 3, 0xfff0cf));
      for (const t of rocket.trail) out.push(shR(Math.round(t.x), Math.round(t.y), 2, 2, 0xffd08a, Math.max(0.1, t.a)));
      continue;
    }
    const flash = burstFlash(b, ms);
    if (flash > 0) out.push(shC(b.x, b.y, 10 + 22 * (1 - flash), 0xffffff, 0.55 * flash), shC(b.x, b.y, 26, b.color, 0.18 * flash));
    const age = ms - b.t;
    const list = particles[b.index];
    for (const p of list) {
      const s = sparkAt(p, age);
      if (!s) continue;
      const color = p.second ? b.color2 : b.color;
      const alpha = Math.max(0, Math.min(1, s.alpha));
      out.push(shR(Math.round(b.x + s.x - s.size / 2 - 2), Math.round(b.y + s.y - s.size / 2 - 2), s.size + 4, s.size + 4, color, 0.2 * alpha)); // a soft halo
      out.push(shR(Math.round(b.x + s.x - s.size / 2), Math.round(b.y + s.y - s.size / 2), s.size, s.size, color, alpha));
      const trail = sparkAt(p, age - 45);
      if (trail) out.push(shR(Math.round(b.x + trail.x - 1), Math.round(b.y + trail.y - 1), 3, 3, color, Math.max(0, Math.min(1, trail.alpha)) * 0.4));
    }
  }
  return out;
}
