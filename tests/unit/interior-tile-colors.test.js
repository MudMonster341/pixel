// Rainbow-glitch guard (found via a qa-shot capture,
// docs/research/premium-pass/cutscenes/12-key-room-beat-physics-lab.png: the Physics Lab's stools
// showed a hot-pink/lime-green/sky-blue glitch sprite instead of a plain stack of books).
//
// The actual bug: `intBooksStack` (tools/make-assets.js) blitted a Cool School Tileset crop with no
// `remap` option, the one piece from that pack left in its own raw "pastel pink/purple/orange"
// (every other Cool School piece gets bucketed onto this game's own ramp -- see remapSchoolWood's
// own comment) -- reading as a rainbow glitch once several copies sat side by side in a dense room.
//
// This test reads the *committed* assets/tiles.png pixels directly (the same decoder
// tools/make-assets.js itself uses to read vendor packs, not the generator's own code), so a future
// tile that reintroduces an unrecolored/miscropped vendor sprite fails here instead of only showing
// up in a qa-shot months later. "Interior tile" = the `int*` naming convention docs/ARCHITECTURE.md
// already uses for this kit; legitimately colourful real-world objects (a plant, a lab tank's own
// dials, a noticeboard's pinned notes) stay well under the threshold calibrated below -- only a raw,
// never-recoloured vendor crop spikes past it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const TILE = 16;
// Calibrated against the real bug: the raw, unrecoloured `intBooksStack` crop scores 7-9 hue
// buckets at every satMin from 0.35-0.7 (checked directly against the vendor sheet), while every
// legitimately multi-coloured tile in the current catalog (plants, trees, a lab tank's dials, a
// noticeboard's notes...) stays at 4 or under with satMin=0.6 -- a wide margin either side of N=5.
const SAT_MIN = 0.6;
const VAL_MIN = 0.25;
const MAX_HUE_BUCKETS = 5;

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

// The number of distinct 30-degree hue buckets a tile's own pixels touch, counting only pixels
// that are actually vivid (saturated and bright enough to read as "a colour", not a near-grey
// outline or shadow) -- a real rainbow-glitch sprite spans most of the colour wheel; a genuine
// multi-coloured object (a plant's leaves + pot, a lab tank's dials) stays within a handful of
// neighbouring or thematically related bands.
function hueBucketCount(img, tx, ty) {
  const buckets = new Set();
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = ((ty + y) * img.width + (tx + x)) * 4;
      if (img.data[i + 3] < 10) continue; // transparent
      const [h, s, v] = rgbToHsv(img.data[i], img.data[i + 1], img.data[i + 2]);
      if (s >= SAT_MIN && v >= VAL_MIN) buckets.add(Math.floor(h / 30));
    }
  }
  return buckets.size;
}

test('rainbow-glitch guard: every interior tile (assets/tiles.png) stays under the saturated-hue-spread ceiling', () => {
  const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
  const img = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
  const cols = tileInfo.columns;
  const offenders = [];
  tileInfo.tiles.forEach((tile, i) => {
    if (!tile.name.startsWith('int')) return; // the interior-kit naming convention
    const tx = (i % cols) * TILE;
    const ty = Math.floor(i / cols) * TILE;
    const buckets = hueBucketCount(img, tx, ty);
    if (buckets > MAX_HUE_BUCKETS) offenders.push(`${tile.name} (${buckets} saturated hue bands)`);
  });
  assert.deepEqual(offenders, [], `tile(s) read as a rainbow/glitch sprite (likely an unrecoloured or mis-cropped vendor sheet read): ${offenders.join(', ')}`);
});
