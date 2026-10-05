// Previews the golden-hour light (src/daylight.js) without a browser: renders a campus crop with the REAL tiles four times, once per phase
// (morning, midday, golden hour, dusk), each with the game's own maths applied (the MULTIPLY overlay, the vignette, the additive lamp halos and
// dust motes), and stitches them into one PNG strip so the four phases can be compared side by side.
//
//   node tools/preview-daylight.js [out.png] [--map campus] [--crop x0,y0,w,h] [--scale 2] [--indoor]
//   default crop: campus 222,124,20,12 (about one game screen: the forecourt with the two street lamps). Order, left to right: morning,
//   midday, golden hour, dusk. The default output is <temp dir>/daylight-preview.png. Do not write previews into assets/.
//
// What is NOT reproduced: the sprites (player, NPCs), the tile-animations, and a real GPU's rounding; the colour maths is the same as the game's.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { encodePNG } = require('./lib/png');
const { renderCrop, loadMap } = require('./render-map-crop');

const ROOT = path.join(__dirname, '..');
const GAP = 6;

function loadDaylight() {
  const context = vm.createContext({ URLSearchParams, console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'daylight.js'), 'utf8'), context, { filename: 'src/daylight.js' });
  const get = (name) => vm.runInContext(name, context);
  const names = ['DAY_PHASES', 'daylightParams', 'overlayFactor', 'findLightSpots', 'moteInit', 'moteAlpha', 'DAYLIGHT_VIGNETTE_RGB'];
  return Object.fromEntries(names.map((name) => [name, get(name)]));
}

// The vignette texture's alpha at normalised distance d (0 centre .. 1 corner), the same stops as WorldScene.ensureDaylightTextures().
function vignetteStop(d) {
  const stops = [[0, 0], [0.5, 0], [0.8, 0.45], [1, 1]];
  for (let i = 1; i < stops.length; i++) {
    if (d <= stops[i][0]) {
      const [d0, a0] = stops[i - 1];
      const [d1, a1] = stops[i];
      return a0 + ((a1 - a0) * (d - d0)) / (d1 - d0);
    }
  }
  return 1;
}

// The halo texture's colour/alpha at normalised radius r (0 centre .. 1 edge).
function haloStop(r) {
  const stops = [[0, [255, 226, 170, 1]], [0.35, [255, 196, 118, 0.5]], [1, [255, 170, 90, 0]]];
  for (let i = 1; i < stops.length; i++) {
    if (r <= stops[i][0]) {
      const [r0, c0] = stops[i - 1];
      const [r1, c1] = stops[i];
      const k = (r - r0) / (r1 - r0);
      return c0.map((v, j) => v + (c1[j] - v) * k);
    }
  }
  return [255, 170, 90, 0];
}

function addPixel(rgba, w, x, y, r, g, b, a) {
  const i = (y * w + x) * 4;
  rgba[i] = Math.min(255, rgba[i] + r * a);
  rgba[i + 1] = Math.min(255, rgba[i + 1] + g * a);
  rgba[i + 2] = Math.min(255, rgba[i + 2] + b * a);
}

// Applies one phase's light to a copy of a rendered crop. `crop` { width, height, rgba }; `spots` the light spots in crop-local WORLD px.
function applyLight(day, crop, params, spots, scale) {
  const { width: w, height: h } = crop;
  const rgba = Buffer.from(crop.rgba);
  // 1. the MULTIPLY overlay: dst * (1 - a + a * tint / 255)
  const [fr, fg, fb] = day.overlayFactor(params);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = Math.round(rgba[i] * fr);
    rgba[i + 1] = Math.round(rgba[i + 1] * fg);
    rgba[i + 2] = Math.round(rgba[i + 2] * fb);
  }
  // 2. the additive halos (above the overlay)
  for (const spot of spots) {
    if (params.halo <= 0.002) break;
    const radius = (spot.size / 2) * scale;
    const cx = spot.x * scale;
    const cy = spot.y * scale;
    for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(h, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(w, Math.ceil(cx + radius)); x++) {
        const r = Math.hypot(x - cx, y - cy) / radius;
        if (r >= 1) continue;
        const [hr, hg, hb, ha] = haloStop(r);
        addPixel(rgba, w, x, y, hr, hg, hb, ha * params.halo);
      }
    }
  }
  // 3. the vignette (normal blend, above the halos)
  const [vr, vg, vb] = day.DAYLIGHT_VIGNETTE_RGB;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x + 0.5 - w / 2) / (w / 2);
      const ny = (y + 0.5 - h / 2) / (h / 2);
      const a = params.vignette * vignetteStop(Math.min(1, Math.hypot(nx, ny) * (240 / 340)));
      if (a <= 0) continue;
      const i = (y * w + x) * 4;
      rgba[i] = Math.round(rgba[i] * (1 - a) + vr * a);
      rgba[i + 1] = Math.round(rgba[i + 1] * (1 - a) + vg * a);
      rgba[i + 2] = Math.round(rgba[i + 2] * (1 - a) + vb * a);
    }
  }
  // 4. the dust motes (additive, a frozen frame: each at its starting position), on top
  for (let i = 0; i < params.motes; i++) {
    const m = day.moteInit(i);
    const alpha = day.moteAlpha(m, i, params.motes);
    const radius = Math.max(1, 0.25 * m.scale * 8 * scale * 0.5);
    const cx = m.x * w;
    const cy = m.y * h;
    for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(h, Math.ceil(cy + radius)); y++) {
      for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(w, Math.ceil(cx + radius)); x++) {
        const r = Math.hypot(x - cx, y - cy) / radius;
        if (r < 1) addPixel(rgba, w, x, y, 255, 232, 160, (1 - r) * alpha);
      }
    }
  }
  return { width: w, height: h, rgba };
}

function main(argv) {
  const flag = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && argv[i - 1] !== '--indoor'));
  const out = path.resolve(positional[0] || path.join(os.tmpdir(), 'daylight-preview.png'));
  const mapKey = flag('map', 'campus');
  const [x0, y0, w, h] = flag('crop', '222,124,20,12').split(',').map(Number);
  const scale = Number(flag('scale', 2));
  const indoors = argv.includes('--indoor');
  const day = loadDaylight();
  const loaded = loadMap(mapKey);
  const tileNames = loaded.tileInfo.tiles.map((t) => t.name);
  const layers = loaded.map.layers.filter((l) => l.type === 'tilelayer').map((l) => ({ data: l.data, width: loaded.map.width, offset: 1 }));
  const spots = day.findLightSpots(layers, tileNames, 16)
    .map((s) => ({ ...s, x: s.x - x0 * 16, y: s.y - y0 * 16 }))
    .filter((s) => s.x > -40 && s.y > -40 && s.x < w * 16 + 40 && s.y < h * 16 + 40);
  const base = renderCrop(mapKey, x0, y0, w, h, scale, { loaded, objects: false });

  const panels = day.DAY_PHASES.map((id) => applyLight(day, base, day.daylightParams(id, indoors), spots, scale));
  const stripW = panels.length * base.width + (panels.length - 1) * GAP;
  const rgba = Buffer.alloc(stripW * base.height * 4, 255);
  panels.forEach((panel, p) => {
    const ox = p * (base.width + GAP);
    for (let y = 0; y < panel.height; y++) panel.rgba.copy(rgba, (y * stripW + ox) * 4, y * panel.width * 4, (y + 1) * panel.width * 4);
  });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePNG(stripW, base.height, rgba));
  console.log(`wrote ${out} (${stripW}x${base.height}): ${day.DAY_PHASES.join(' | ')} (${indoors ? 'indoors' : 'outdoors'}, ${spots.length} light spot(s) in the crop)`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { applyLight, vignetteStop, haloStop, loadDaylight };
