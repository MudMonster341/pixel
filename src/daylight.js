// Golden hour (docs/GAME_FEEL.md "Daylight", wow idea W4/W9): the light on the campus moves from morning to dusk as the three keys are found.
// This file is only the PURE part (plain script, no Phaser, unit-tested in tests/unit/daylight.test.js): which phase the day is in, what the
// colour/alpha/vignette/halo/dust numbers are for it, how two sets of numbers blend, where the lamps are, how a dust mote drifts. The scene
// (src/scenes/world.js createDaylight()/updateDaylight()) only draws what these say.
//
// The tint is a full-screen rectangle drawn with the MULTIPLY blend mode: the screen colour becomes screen * (1 - alpha + alpha * tint / 255) per
// channel (WebGL and Canvas agree on this), so alpha 0 is "no change" and a white tint does nothing. The floor: the overall brightness of the
// overlay (its luminance factor) never drops below DAYLIGHT_MIN_BRIGHTNESS, so the early game stays bright and readable at every phase.

const DAY_PHASES = ['morning', 'midday', 'golden', 'dusk'];
const DAYLIGHT_FADE_MS = 2500; // a key found: the light eases to the new phase over this long
const DAYLIGHT_FAILSAFE_MS = 4500; // wall-clock backstop: a transition that has not finished by now snaps to its target
const DAYLIGHT_MIN_BRIGHTNESS = 0.85; // the overlay's luminance factor never goes below this, at any phase, indoors or out
const DAYLIGHT_EDGE_BRIGHTNESS = 0.72; // ...and with the vignette's darkest (corner) alpha on top of it, never below this (the darkest single corner pixel)
const DAYLIGHT_INDOOR_STRENGTH = 0.4; // indoors the overlay alpha is this fraction of the outdoor one
const DAYLIGHT_INDOOR_VIGNETTE = 0.5; // ...and the vignette this fraction
const DAYLIGHT_MOTE_MAX = 10; // the most dust motes ever alive (outdoors, golden hour and dusk only)
// The vignette's colour (a deep warm plum, drawn with the normal blend), the halo's and the mote's soft glow colours: baked into the cached
// canvas textures (src/scenes/world.js), so no renderer needs to tint anything.
const DAYLIGHT_VIGNETTE_RGB = [40, 16, 28];

// The four phases, outdoors. tint: 0xRRGGBB multiplied in at `alpha`; vignette: the alpha of the darkest (corner) point; halo: the alpha of a
// lamp's additive glow; motes: how many golden dust motes drift; warm: 0..1 how warm the light feels (colours the halos, see haloColor()).
const DAYLIGHT_TABLE = {
  morning: { tint: 0xfff6ec, alpha: 0.30, vignette: 0.05, halo: 0, motes: 0, warm: 0 }, // a hair of warm clear air, almost nothing
  midday: { tint: 0xffffff, alpha: 0, vignette: 0.05, halo: 0, motes: 0, warm: 0.05 }, // neutral and crisp
  golden: { tint: 0xffcc7a, alpha: 0.50, vignette: 0.12, halo: 0.30, motes: 6, warm: 0.7 }, // amber, long and soft
  dusk: { tint: 0xf8a8c0, alpha: 0.55, vignette: 0.16, halo: 0.50, motes: 8, warm: 1 }, // pink-orange sliding to violet
};

// The phase for how many keys she holds and the quest stage: 0 keys morning, 1 midday, 2 golden hour, 3 keys (or the box handed over, stage
// 'rewarded') dusk. Pure and total: a missing/odd input is "no keys, arrival" (the bright morning), so an old save and a new game agree.
function dayPhase(keysHeld, stage) {
  const keys = Number.isFinite(keysHeld) ? Math.max(0, Math.min(3, Math.floor(keysHeld))) : 0;
  const index = stage === 'rewarded' ? 3 : keys;
  return { id: DAY_PHASES[index], index };
}

// The phase for a GameState.quest ({ stage, keys: { id: bool } }), so the world scene and a save's Continue derive it the same way, with no
// field of its own in the save.
function dayPhaseFromQuest(quest) {
  const keys = quest && quest.keys ? Object.values(quest.keys).filter(Boolean).length : 0;
  return dayPhase(keys, quest && quest.stage);
}

// `phase` is a { id } from dayPhase(), a phase id string, or an index 0..3. Returns a NEW plain object { tint, alpha, vignette, halo, motes,
// warm }. Indoors the overlay is DAYLIGHT_INDOOR_STRENGTH of the outdoor one, the vignette half, the halos (the chandeliers' warm glow) a
// little softer, and there is no dust.
function daylightParams(phase, indoors) {
  const id = typeof phase === 'number' ? DAY_PHASES[Math.max(0, Math.min(3, Math.floor(phase)))] : (phase && phase.id) || phase;
  const row = DAYLIGHT_TABLE[id] || DAYLIGHT_TABLE.morning;
  if (!indoors) return { ...row };
  return {
    tint: row.tint,
    alpha: row.alpha * DAYLIGHT_INDOOR_STRENGTH,
    vignette: row.vignette * DAYLIGHT_INDOOR_VIGNETTE,
    halo: row.halo * 0.8,
    motes: 0,
    warm: row.warm,
  };
}

// Blends two parameter sets (t 0..1): the tint channel by channel, the rest linearly, motes rounded to a whole count. Writes into `out`
// when it is given (the scene reuses one object every frame: no per-frame allocation), otherwise returns a new object.
function lerpParams(a, b, t, out) {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const o = out || {};
  const ar = (a.tint >> 16) & 255, ag = (a.tint >> 8) & 255, ab = a.tint & 255;
  const br = (b.tint >> 16) & 255, bg = (b.tint >> 8) & 255, bb = b.tint & 255;
  o.tint = (Math.round(ar + (br - ar) * k) << 16) | (Math.round(ag + (bg - ag) * k) << 8) | Math.round(ab + (bb - ab) * k);
  o.alpha = a.alpha + (b.alpha - a.alpha) * k;
  o.vignette = a.vignette + (b.vignette - a.vignette) * k;
  o.halo = a.halo + (b.halo - a.halo) * k;
  o.motes = Math.round(a.motes + (b.motes - a.motes) * k);
  o.warm = a.warm + (b.warm - a.warm) * k;
  return o;
}

// Copies one parameter set into another (so the scene can remember where a transition started without allocating).
function copyParams(from, to) {
  to.tint = from.tint; to.alpha = from.alpha; to.vignette = from.vignette; to.halo = from.halo; to.motes = from.motes; to.warm = from.warm;
  return to;
}

// Smoothstep: the ease of a transition (a slow start and a slow finish, never a flat linear slide).
function daylightEase(t) {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return k * k * (3 - 2 * k);
}

// The per-channel factor the MULTIPLY overlay applies to what is under it: [r, g, b], each 0..1 (1 = unchanged). The same maths the preview
// tool (tools/preview-daylight.js) uses, and what the WebGL and Canvas renderers compute.
function overlayFactor(params) {
  const a = params.alpha;
  return [
    1 - a + (a * ((params.tint >> 16) & 255)) / 255,
    1 - a + (a * ((params.tint >> 8) & 255)) / 255,
    1 - a + (a * (params.tint & 255)) / 255,
  ];
}

// The overlay's overall brightness, 0..1: the luminance of its factor (Rec. 601 weights). 1 = no darkening.
function daylightBrightness(params) {
  const [r, g, b] = overlayFactor(params);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// How much the light changes the picture, 0 (nothing) to ~0.14 (dusk): 1 - brightness.
function daylightStrength(params) {
  return 1 - daylightBrightness(params);
}

// The brightness of the screen's darkest corner: the overlay and the vignette together.
function daylightEdgeBrightness(params) {
  return daylightBrightness(params) * (1 - params.vignette);
}

// The halo glow's colour for a warmth 0..1: pale cream at 0, amber at 1 (0xRRGGBB). The scene bakes its halo texture in this colour range;
// the preview tool uses it directly.
function haloColor(warm) {
  const k = warm <= 0 ? 0 : warm >= 1 ? 1 : warm;
  const r = 255;
  const g = Math.round(241 + (178 - 241) * k);
  const b = Math.round(201 + (104 - 201) * k);
  return (r << 16) | (g << 8) | b;
}

// `?daylight=0` (dev and tests: tests/e2e/helpers.js sets it for every spec) turns the whole effect off. `search` is injectable, the same
// pattern as momentsEnabled() in src/moments.js.
function daylightEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('daylight') !== '0';
}

// ---------- the street lamps and chandeliers ----------
// Tiles that carry a glow: tile name -> { kind, dx, dy (the glow's centre in tiles from the tile's top-left corner), size (halo diameter in
// world px) }. The street lamp is one tall prop: its pole is `lampPost` (solid, on the ground) and its head `lampPostTop` (overhead, one
// tile up), so the head tile is where the light is. The Main Block's chandelier is a 2x2 piece whose top-left tile is `intChandelier`.
// The lab's cyan light bars (intTechLightBar*) are already glowing in their own art and are left alone.
const DAYLIGHT_LIGHT_TILES = {
  lampPostTop: { kind: 'lamp', dx: 0.5, dy: 0.5, size: 56 },
  intChandelier: { kind: 'chandelier', dx: 1, dy: 1, size: 80 },
};

// Scans tile layers for the glowing tiles. `layers`: [{ data (a flat array of tile numbers, row by row), width, offset }] where offset is
// what to subtract from a number to get the tile index (1 for Tiled gids, 0 for plain grids; 0 / -1 mean empty). `tileNames`: tile index ->
// name (assets/tiles.json). Returns [{ kind, x, y (world px of the glow centre), size }], in reading order.
function findLightSpots(layers, tileNames, tileSize) {
  const size = tileSize || 16;
  const spots = [];
  for (const layer of layers) {
    const offset = layer.offset || 0;
    const data = layer.data;
    for (let i = 0; i < data.length; i++) {
      const raw = data[i];
      if (!raw || raw < 0) continue;
      const index = (raw & 0x0fffffff) - offset; // the top bits of a Tiled gid are flip flags
      const info = DAYLIGHT_LIGHT_TILES[tileNames[index]];
      if (!info) continue;
      const tx = i % layer.width;
      const ty = Math.floor(i / layer.width);
      spots.push({ kind: info.kind, x: (tx + info.dx) * size, y: (ty + info.dy) * size, size: info.size });
    }
  }
  return spots;
}

// ---------- dust motes ----------
// A mote lives in unit coordinates of the visible view (x, y 0..1) and drifts slowly right and a little up, wavering with its own phase;
// `moteInit(i)` is deterministic (a hash of i, no Math.random), so a test can pin it and every run looks the same.
function moteHash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function moteInit(i) {
  return {
    x: moteHash(i + 1),
    y: moteHash(i + 101),
    vx: 0.012 + moteHash(i + 201) * 0.016, // view widths per second: slow (one crossing takes about a minute)
    vy: -(0.004 + moteHash(i + 301) * 0.008),
    phase: moteHash(i + 401) * Math.PI * 2,
    scale: 0.7 + moteHash(i + 501) * 0.6, // size multiplier
  };
}

// One step of `dtMs` milliseconds (capped so a stalled frame cannot throw a mote across the screen); the mote wraps around the view.
function moteStep(m, dtMs) {
  const dt = Math.min(Math.max(dtMs, 0), 100) / 1000;
  m.phase += dt * 0.9;
  m.x += m.vx * dt + Math.sin(m.phase) * 0.004 * dt;
  m.y += m.vy * dt;
  if (m.x > 1.04) m.x -= 1.08;
  if (m.x < -0.04) m.x += 1.08;
  if (m.y < -0.04) m.y += 1.08;
  if (m.y > 1.04) m.y -= 1.08;
  return m;
}

// How visible mote `i` is (0..1) while `count` motes are meant to show: whole motes beyond the count are 0, so a changing count fades them
// one by one; a soft twinkle on top.
function moteAlpha(m, i, count) {
  const on = Math.max(0, Math.min(1, count - i));
  return on * (0.55 + 0.45 * Math.sin(m.phase * 1.7));
}
