// Renders a tile rectangle of a generated Tiled map to a PNG using the REAL tiles (assets/tiles.png via
// assets/tiles.json), so agents that cannot run the game can still see what the player sees.
//
//   node tools/render-map-crop.js <mapKey|path.json> <x0> <y0> <w> <h> <scale> <out.png> [--no-objects]
//   e.g. node tools/render-map-crop.js campus 225 135 40 30 3 /tmp/crop.png
//
// Layers are drawn in the game's order: ground, structures, overhead (assets/maps/<key>.json). Tiled
// flip bits in a gid (horizontal 0x80000000, vertical 0x40000000, diagonal 0x20000000) are honoured.
// Object markers (doors, gates, spawn, cutscene triggers...) are drawn as thin coloured boxes; pass
// --no-objects to hide them. Do not write crops into assets/.
const fs = require('fs');
const path = require('path');
const { encodePNG } = require('./lib/png');
const { decodePNG } = require('./lib/png-decode');

const ROOT = path.join(__dirname, '..');
const FLIP_H = 0x80000000;
const FLIP_V = 0x40000000;
const FLIP_D = 0x20000000;
const OBJECT_COLORS = {
  door: [255, 0, 255],
  gate: [255, 128, 0],
  spawn: [0, 255, 255],
  cutscene: [255, 255, 0],
  car: [255, 0, 0],
  sprite: [0, 128, 255],
};
const DEFAULT_OBJECT_COLOR = [255, 255, 255];
// Types that only describe regions (not worth drawing as boxes over the art).
const QUIET_OBJECT_TYPES = new Set(['depthGroup', 'buildingFootprint', 'zone', 'area', 'building']);

function loadMap(mapKey) {
  // `mapKey` is a key in assets/maps, or a path to any Tiled json (e.g. a build written with --out) when it ends in .json
  const mapFile = mapKey.endsWith('.json') ? path.resolve(mapKey) : path.join(ROOT, 'assets', 'maps', `${mapKey}.json`);
  const map = JSON.parse(fs.readFileSync(mapFile, 'utf8'));
  const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
  const atlas = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
  return { map, tileInfo, atlas };
}

function blendPixel(out, outW, x, y, r, g, b, a) {
  const i = (y * outW + x) * 4;
  if (a >= 255) {
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
  } else if (a > 0) {
    const k = a / 255;
    out[i] = Math.round(r * k + out[i] * (1 - k));
    out[i + 1] = Math.round(g * k + out[i + 1] * (1 - k));
    out[i + 2] = Math.round(b * k + out[i + 2] * (1 - k));
    out[i + 3] = 255;
  }
}

// Draws one 16x16 tile (atlas index `tileIndex`, optional flip flags) with its top-left at (px, py).
function drawTile(out, outW, outH, atlas, columns, tileSize, tileIndex, flags, px, py, scale) {
  const sx0 = (tileIndex % columns) * tileSize;
  const sy0 = Math.floor(tileIndex / columns) * tileSize;
  for (let ty = 0; ty < tileSize; ty++) {
    for (let tx = 0; tx < tileSize; tx++) {
      let u = tx;
      let v = ty;
      if (flags & FLIP_D) [u, v] = [v, u];
      if (flags & FLIP_H) u = tileSize - 1 - u;
      if (flags & FLIP_V) v = tileSize - 1 - v;
      const si = ((sy0 + v) * atlas.width + sx0 + u) * 4;
      const a = atlas.data[si + 3];
      if (!a) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const ox = px + tx * scale + dx;
          const oy = py + ty * scale + dy;
          if (ox < 0 || oy < 0 || ox >= outW || oy >= outH) continue;
          blendPixel(out, outW, ox, oy, atlas.data[si], atlas.data[si + 1], atlas.data[si + 2], a);
        }
      }
    }
  }
}

function strokeBox(out, outW, outH, x0, y0, x1, y1, color) {
  const put = (x, y) => {
    if (x >= 0 && y >= 0 && x < outW && y < outH) blendPixel(out, outW, x, y, color[0], color[1], color[2], 255);
  };
  for (let x = x0; x <= x1; x++) { put(x, y0); put(x, y1); }
  for (let y = y0; y <= y1; y++) { put(x0, y); put(x1, y); }
}

// Returns { width, height, rgba } for the tile rectangle [x0, x0+w) x [y0, y0+h) at `scale` output px
// per source px (a tile is 16 * scale px wide). `loaded` can be passed to avoid re-reading files.
function renderCrop(mapKey, x0, y0, w, h, scale, options = {}) {
  const { map, tileInfo, atlas } = options.loaded || loadMap(mapKey);
  const tileSize = tileInfo.tileSize || map.tilewidth || 16;
  const columns = tileInfo.columns;
  const outW = w * tileSize * scale;
  const outH = h * tileSize * scale;
  const out = Buffer.alloc(outW * outH * 4);
  // transparent areas outside the map read as black
  for (let i = 3; i < out.length; i += 4) out[i] = 255;

  const drawOrder = ['ground', 'structures', 'overhead'];
  for (const name of drawOrder) {
    const layer = map.layers.find((l) => l.type === 'tilelayer' && l.name === name);
    if (!layer) continue;
    for (let cy = 0; cy < h; cy++) {
      for (let cx = 0; cx < w; cx++) {
        const mx = x0 + cx;
        const my = y0 + cy;
        if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) continue;
        const raw = layer.data[my * map.width + mx] >>> 0;
        if (!raw) continue;
        const flags = raw & (FLIP_H | FLIP_V | FLIP_D);
        const gid = (raw & ~(FLIP_H | FLIP_V | FLIP_D | 0x10000000)) >>> 0;
        if (!gid) continue;
        drawTile(out, outW, outH, atlas, columns, tileSize, gid - 1, flags, cx * tileSize * scale, cy * tileSize * scale, scale);
      }
    }
  }

  if (options.objects !== false) {
    for (const layer of map.layers.filter((l) => l.type === 'objectgroup')) {
      for (const o of layer.objects || []) {
        if (QUIET_OBJECT_TYPES.has(o.type)) continue;
        const color = OBJECT_COLORS[o.type] || DEFAULT_OBJECT_COLOR;
        // point objects get a 1-tile box centred on the point; rect objects their own box
        const ox = o.point || !o.width ? o.x - tileSize / 2 : o.x;
        const oy = o.point || !o.height ? o.y - tileSize / 2 : o.y;
        const ow = o.point || !o.width ? tileSize : o.width;
        const oh = o.point || !o.height ? tileSize : o.height;
        const bx0 = Math.round((ox - x0 * tileSize) * scale);
        const by0 = Math.round((oy - y0 * tileSize) * scale);
        const bx1 = Math.round((ox + ow - x0 * tileSize) * scale) - 1;
        const by1 = Math.round((oy + oh - y0 * tileSize) * scale) - 1;
        if (bx1 < 0 || by1 < 0 || bx0 >= outW || by0 >= outH) continue;
        strokeBox(out, outW, outH, bx0, by0, bx1, by1, color);
      }
    }
  }
  return { width: outW, height: outH, rgba: out };
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  if (args.length < 7) {
    console.error('usage: node tools/render-map-crop.js <mapKey> <x0> <y0> <w> <h> <scale> <out.png> [--no-objects]');
    process.exit(1);
  }
  const [mapKey, x0, y0, w, h, scale] = args.slice(0, 6);
  const outPath = path.resolve(args[6]);
  const img = renderCrop(mapKey, +x0, +y0, +w, +h, +scale, { objects: !argv.includes('--no-objects') });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, encodePNG(img.width, img.height, img.rgba));
  console.log(`wrote ${outPath} (${img.width}x${img.height})`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { renderCrop, loadMap };
