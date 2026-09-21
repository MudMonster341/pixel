// Regression tests for FB-0025 (owner feedback: replace hand-drawn trees/pavements with a free
// asset pack). Covers the two new pieces this pass added: tools/lib/png-decode.js (a PNG decoder,
// needed because tools/lib/png.js only encodes) and the vendor-pack tile swap in
// tools/make-assets.js. See docs/research/asset-packs.md for the survey and docs/STYLE_GUIDE.md
// "Campus kit" for which tile now comes from which pack.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');
const { encodePNG } = require('../../tools/lib/png');

const { tileInfo } = loadGameData();
const VENDOR_DIR = path.join(ROOT, 'assets', 'vendor');

function tileIndex(name) {
  return tileInfo.tiles.findIndex((t) => t.name === name);
}

// ---------- tools/lib/png-decode.js: round-trips our own encoder, reads the real vendor files,
// and fails loudly instead of guessing on what it doesn't support ----------

test('png-decode: round-trips an RGBA image written by tools/lib/png.js (encodePNG)', () => {
  const w = 5;
  const h = 3;
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = (i * 37) % 256;
    rgba[i * 4 + 1] = (i * 53) % 256;
    rgba[i * 4 + 2] = (i * 11) % 256;
    rgba[i * 4 + 3] = i % 2 === 0 ? 255 : 0; // mix of opaque and fully transparent
  }
  const decoded = decodePNG(encodePNG(w, h, rgba));
  assert.equal(decoded.width, w);
  assert.equal(decoded.height, h);
  assert.ok(decoded.data.equals(rgba), 'decoded pixels should exactly match the original RGBA buffer');
});

test('png-decode: reads the real Roguelike Modern City sheet (8-bit RGB and RGBA) at its real size', () => {
  const rgba = decodePNG(fs.readFileSync(path.join(VENDOR_DIR, 'kenney-roguelike-modern-city/Spritesheet/roguelikeCity_magenta.png')));
  assert.equal(rgba.width, 628);
  assert.equal(rgba.height, 475);
  assert.equal(rgba.data.length, 628 * 475 * 4);
  // SOURCE.txt: this file has a real alpha channel despite its filename suggesting otherwise --
  // somewhere in a nearly-full sheet there must be at least one transparent pixel (the gaps between
  // sprites) and at least one opaque one.
  let sawTransparent = false;
  let sawOpaque = false;
  for (let i = 3; i < rgba.data.length; i += 4) {
    if (rgba.data[i] === 0) sawTransparent = true;
    else if (rgba.data[i] === 255) sawOpaque = true;
    if (sawTransparent && sawOpaque) break;
  }
  assert.ok(sawTransparent && sawOpaque, 'expected both transparent and opaque pixels in the sheet');
});

test('png-decode: reads a 4-bit palette PNG with tRNS (the vehicle pack\'s own PNG format)', () => {
  const rgba = decodePNG(fs.readFileSync(path.join(VENDOR_DIR, 'kenney-pixel-vehicle-pack/PNG/Cars/sedan.png')));
  assert.equal(rgba.width, 29);
  assert.equal(rgba.height, 13);
  // The corners of a car sprite on a mostly-transparent canvas should be transparent.
  assert.equal(rgba.data[3], 0, 'top-left corner should be transparent (alpha 0)');
});

test('png-decode: fails loudly on an interlaced PNG instead of decoding it wrong', () => {
  const w = 4;
  const h = 4;
  const rgba = Buffer.alloc(w * h * 4, 255);
  const png = encodePNG(w, h, rgba);
  // Flip the IHDR interlace-method byte (offset 28: signature 8 + length 4 + type 4 + width 4 +
  // height 4 + depth 1 + colorType 1 + compression 1 + filter 1 = 28) from 0 to 1 (Adam7). The CRC
  // no longer matches, but this decoder doesn't check chunk CRCs (see tools/lib/png-decode.js), so
  // it reads the (now-wrong) header field it's actually being tested against.
  const tampered = Buffer.from(png);
  tampered[28] = 1;
  assert.throws(() => decodePNG(tampered), /interlac/i);
});

test('png-decode: fails loudly on a bad PNG signature', () => {
  assert.throws(() => decodePNG(Buffer.from('not a png at all')), /signature/i);
});

// ---------- tools/make-assets.js: the vendor-pack swap keeps tile names/positions stable ----------

test('FB-0025: swapped outdoor tiles (roads, kerbs, lawn, bush, parked cars) keep their existing names and tile-catalog positions', () => {
  // These are the exact indices assets/tiles.json had before this pass touched any pixels --
  // swapping a tile's *art* must never move it, or every map (which references tiles by index,
  // docs/ARCHITECTURE.md "content is data") and every other test would silently break.
  const expected = {
    grass: 0, grass2: 1, asphalt: 34, parking: 36,
    kerbT: 46, kerbB: 47, kerbL: 48, kerbR: 49, kerbTL: 50, kerbTR: 51, kerbBL: 52, kerbBR: 53,
    roadLineH: 54, roadLineV: 55, crossingH: 56, crossingV: 57, walkway: 58,
    lawn: 59, lawn2: 60, hedge: 61, bush: 62, flowerbed: 63,
  };
  for (const [name, index] of Object.entries(expected)) {
    assert.equal(tileIndex(name), index, `"${name}" should still be tile index ${index}`);
  }
});

test('FB-0025: the new parked-car tiles are appended after every existing tile, not inserted', () => {
  const before = ['intMedicalDesk', 'intMachine'];
  const cars = ['carSedan', 'carSedanBlue', 'carSuv', 'carVan'];
  const lastExistingIndex = Math.max(...before.map(tileIndex));
  cars.forEach((name, i) => {
    assert.equal(tileIndex(name), lastExistingIndex + 1 + i, `"${name}" should come right after ${before[1]}, in order`);
  });
  assert.equal(tileIndex('carVan'), tileInfo.tiles.length - 1, 'carVan should be the very last tile');
});

test('FB-0025: parked-car tiles are solid, with transparent corners (they\'re a prop on top of the parking-lot ground, not a full-tile fill)', () => {
  for (const name of ['carSedan', 'carSedanBlue', 'carSuv', 'carVan']) {
    const tile = tileInfo.tiles[tileIndex(name)];
    assert.ok(tile, `missing tile "${name}"`);
    assert.equal(tile.solid, true, `${name} should be solid (it's a parked car blocking that tile)`);
    assert.equal(tile.overhead, false, `${name} should not be an overhead/above-player tile`);
  }
});

// ---------- every CC0 pack this survey/pass downloaded has its own LICENSE file ----------
// Scoped to the packs docs/research/asset-packs.md's FB-0025 survey put in assets/vendor/ (not a
// blanket scan of the whole folder): other in-progress packs can land in assets/vendor/ from other
// work (e.g. ADR 0012's LimeZu/Sprout Lands) without failing a test that isn't about them.

const FB_0025_VENDOR_PACKS = ['kenney-roguelike-modern-city', 'kenney-pixel-vehicle-pack', 'kenney-pixel-ui-pack', 'cool-school-tileset'];

test('FB-0025: every CC0 pack this survey downloaded has its own LICENSE file', () => {
  for (const folder of FB_0025_VENDOR_PACKS) {
    const dir = path.join(VENDOR_DIR, folder);
    assert.ok(fs.existsSync(dir), `expected assets/vendor/${folder}/ to exist`);
    assert.ok(fs.existsSync(path.join(dir, 'LICENSE.txt')), `expected assets/vendor/${folder}/LICENSE.txt to exist`);
  }
});

test('FB-0025: the two packs make-assets.js actually reads pixels from (Roguelike Modern City, Pixel Vehicle Pack) are present with a license', () => {
  for (const folder of ['kenney-roguelike-modern-city', 'kenney-pixel-vehicle-pack']) {
    const dir = path.join(VENDOR_DIR, folder);
    assert.ok(fs.existsSync(dir), `expected assets/vendor/${folder}/ to exist`);
    assert.ok(fs.existsSync(path.join(dir, 'LICENSE.txt')), `expected assets/vendor/${folder}/LICENSE.txt to exist`);
  }
});
