// Regression tests for the campus art kit (FB-0006, FB-0011, FB-0014, FB-0015, FB-0016).
// Reads pixel data straight out of assets/tiles.png (same PNG format tools/lib/png.js writes:
// 8-bit RGBA, one zlib-deflated IDAT, filter type 0 on every row) rather than trusting only the
// generator source, so a change to tools/make-assets.js that breaks the art breaks these tests too.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { tileInfo } = loadGameData();

function readPNG(buffer) {
  let offset = 8; // skip the signature
  let width = 0;
  let height = 0;
  const idatChunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
    offset += 8 + length + 4; // length + type + data + crc
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4 + 1;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    assert.equal(raw[y * stride], 0, 'tiles.png must use PNG filter type 0 (none) on every row');
    raw.copy(rgba, y * width * 4, y * stride + 1, (y + 1) * stride);
  }
  return { width, height, rgba };
}

const png = readPNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
const TILE = 16;

function tileByName(name) {
  const index = tileInfo.tiles.findIndex((t) => t.name === name);
  assert.ok(index !== -1, `no tile named "${name}" in assets/tiles.json`);
  return { index, x: (index % tileInfo.columns) * TILE, y: Math.floor(index / tileInfo.columns) * TILE };
}

// Every opaque pixel color used in a tile, as '#rrggbb' -> count. Transparent pixels (alpha 0,
// used by overhead canopy tiles) are reported separately under the key 'transparent'.
function colorCounts(name) {
  const { x: tx, y: ty } = tileByName(name);
  const counts = {};
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const i = ((ty + y) * png.width + (tx + x)) * 4;
      const key = png.rgba[i + 3] === 0 ? 'transparent' : `#${[0, 1, 2].map((k) => png.rgba[i + k].toString(16).padStart(2, '0')).join('')}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  }
  return counts;
}

function tileInfoFor(name) {
  return tileInfo.tiles.find((t) => t.name === name);
}

// ---------- FB-0006: pavement is beveled and shaded, not a flat repeating grid ----------

test('FB-0006: paving tiles use at least 3 tones (shaded, not flat)', () => {
  const counts = colorCounts('paving');
  assert.ok(Object.keys(counts).length >= 3, `paving uses only ${Object.keys(counts).length} tone(s): ${Object.keys(counts)}`);
});

test('FB-0006: the walkway path also uses a shaded, multi-tone brick fill', () => {
  const counts = colorCounts('walkway');
  assert.ok(Object.keys(counts).length >= 3, `walkway uses only ${Object.keys(counts).length} tone(s): ${Object.keys(counts)}`);
});

// ---------- FB-0014: road kerb edges, corners, and walkways, all walkable ----------

test('FB-0014: road kerb edge and corner tiles exist and roads stay walkable', () => {
  for (const name of ['kerbT', 'kerbB', 'kerbL', 'kerbR', 'kerbTL', 'kerbTR', 'kerbBL', 'kerbBR']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing kerb tile "${name}"`);
    assert.equal(tile.solid, false, `${name} should be walkable`);
  }
  // The roads and pavements the kerb sits between must stay walkable, as before.
  for (const name of ['asphalt', 'paving', 'walkway']) {
    assert.equal(tileInfoFor(name).solid, false, `${name} should stay walkable`);
  }
});

test('FB-0014: a kerb edge tile shows both the black-and-white kerb line and the paved sidewalk', () => {
  const counts = colorCounts('kerbT');
  assert.ok('#1a1c2c' in counts && '#ffffff' in counts, 'kerbT is missing the black/white kerb line');
  assert.ok('#c0735c' in counts, 'kerbT is missing the paving (sidewalk) brick color');
});

test('FB-0014: lane markings and a pedestrian crossing exist', () => {
  for (const name of ['roadLineH', 'roadLineV', 'crossingH', 'crossingV']) {
    assert.ok(tileInfoFor(name), `missing "${name}"`);
  }
});

test('FB-0014: the walkway path has a border distinct from its brick fill, so it reads as a path', () => {
  const counts = colorCounts('walkway');
  assert.ok('#c8c8c8' in counts || '#6b6b6b' in counts, 'walkway has no stone border color');
});

// ---------- FB-0015: lawns, hedges, bushes, and trees with an overhead canopy ----------

test('FB-0015: tree trunks and hedges are solid, canopy tiles are overhead and not solid', () => {
  for (const name of ['treeTrunk', 'palmTrunk', 'hedge', 'bush']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, true, `${name} should be solid`);
  }
  for (const name of ['treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR', 'palmCanopyTL', 'palmCanopyTR', 'palmCanopyBL', 'palmCanopyBR']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.overhead, true, `${name} should be marked overhead: true`);
    assert.equal(tile.solid, false, `${name} should not be solid (it's drawn above the player)`);
  }
});

test('FB-0015: canopy tiles have transparent pixels outside the tree silhouette', () => {
  for (const name of ['treeCanopyTL', 'palmCanopyBR']) {
    const counts = colorCounts(name);
    assert.ok(counts.transparent > 0, `${name} should have transparent pixels around its silhouette`);
  }
});

test('FB-0015: two lush lawn variants and a flower bed exist, plus the round bush', () => {
  for (const name of ['lawn', 'lawn2', 'flowerbed', 'bush']) {
    assert.ok(tileInfoFor(name), `missing "${name}"`);
  }
});

// ---------- FB-0016: a tennis court with lines and a net ----------

test('FB-0016: tennis court tiles include line and net pieces', () => {
  for (const name of ['courtLineH', 'courtLineV', 'courtCornerTL', 'courtCornerTR', 'courtCornerBL', 'courtCornerBR', 'courtCenterMark', 'courtNet']) {
    assert.ok(tileInfoFor(name), `missing "${name}"`);
  }
  const lineCounts = colorCounts('courtLineH');
  assert.ok('#ffffff' in lineCounts, 'courtLineH has no white line');
  const netCounts = colorCounts('courtNet');
  assert.ok('#1a1c2c' in netCounts, 'courtNet has no dark mesh');
});

// ---------- FB-0011: slimmer BITS + other buildings, with corners, roof edges, a fence kit ----------

test('FB-0011: BITS wall tiles have small windows (glass is under 25% of the tile)', () => {
  const glassColor = '#2f3a44';
  for (const name of ['bitsWall', 'otherWall']) {
    const counts = colorCounts(name);
    const glass = counts[glassColor] || 0;
    assert.ok(glass / (TILE * TILE) < 0.25, `${name} is ${((glass / (TILE * TILE)) * 100).toFixed(1)}% glass, should be under 25%`);
    assert.ok(glass > 0, `${name} should still show some window glass`);
  }
});

test('FB-0011: building fronts have plain walls, corner ends, and parapet roof edges', () => {
  for (const name of ['bitsWallPlain', 'bitsWallEndL', 'bitsWallEndR', 'bitsRoofT', 'bitsRoofL', 'bitsRoofR', 'bitsRoofTL', 'bitsRoofTR', 'bitsEntranceL', 'bitsEntranceR', 'bitsPillar']) {
    assert.ok(tileInfoFor(name), `missing "${name}"`);
  }
  for (const name of ['otherWallPlain', 'otherWallEndL', 'otherWallEndR', 'otherRoofT', 'otherRoofL', 'otherRoofR', 'otherRoofTL', 'otherRoofTR']) {
    assert.ok(tileInfoFor(name), `missing "${name}"`);
  }
  for (const name of ['bitsWallPlain', 'bitsWallEndL', 'bitsWallEndR', 'bitsRoofT', 'otherWallPlain', 'otherRoofT']) {
    assert.equal(tileInfoFor(name).solid, true, `${name} should be solid`);
  }
  // The glass entrance stays walkable, like the existing bitsDoor.
  assert.equal(tileInfoFor('bitsEntranceL').solid, false);
  assert.equal(tileInfoFor('bitsEntranceR').solid, false);
});

test('FB-0011: existing building and campus tile names still work the same way', () => {
  const stillSolid = ['fence', 'bitsRoof', 'bitsWall', 'otherRoof', 'otherWall'];
  const stillWalkable = ['sand', 'campusGround', 'asphalt', 'paving', 'parking', 'track', 'turf', 'court', 'bitsDoor'];
  for (const name of stillSolid) assert.equal(tileInfoFor(name).solid, true, `${name} should still be solid`);
  for (const name of stillWalkable) assert.equal(tileInfoFor(name).solid, false, `${name} should still be walkable`);
});

test('FB-0011: a straight fence kit exists (horizontal/vertical runs, corners, and a gate)', () => {
  for (const name of ['fenceH', 'fenceV', 'fenceCornerTL', 'fenceCornerTR', 'fenceCornerBL', 'fenceCornerBR']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, true, `${name} should be solid`);
  }
  const gate = tileInfoFor('fenceGate');
  assert.ok(gate, 'missing "fenceGate"');
  assert.equal(gate.solid, false, 'fenceGate should be a walkable opening');
});

// ---------- FB-0025 addendum (2026-09-21): Sprout Lands greenery + the BITS building kit ----------

test('hedges tile seamlessly: no fully-transparent column at either edge of the hedge tile', () => {
  const { x: tx, y: ty } = tileByName('hedge');
  const colOpaque = (x) => {
    for (let y = 0; y < TILE; y++) {
      const i = ((ty + y) * png.width + (tx + x)) * 4;
      if (png.rgba[i + 3] !== 0) return true;
    }
    return false;
  };
  assert.ok(colOpaque(0), 'hedge tile has a fully transparent left edge column -- adjacent hedge tiles would show a gap there');
  assert.ok(colOpaque(TILE - 1), 'hedge tile has a fully transparent right edge column -- adjacent hedge tiles would show a gap there');
});

test('hedge and bush are recolored onto the dry campus greenery ramp, not left in Sprout Lands\' own bright farm-green', () => {
  for (const name of ['hedge', 'bush']) {
    const counts = colorCounts(name);
    // Sprout Lands' own un-recolored highlight tone -- must not survive the remap.
    assert.ok(!('#c2e09a' in counts), `${name} still shows Sprout Lands' native bright green (#c2e09a), the dry-greenery remap should have caught it`);
    // At least one tone from the new dry ramp (deep/base/highlight) should be present.
    const dryTones = ['#33501f', '#4f7a30', '#6fae4a'];
    assert.ok(dryTones.some((hex) => hex in counts), `${name} shows none of the dry-greenery ramp tones (${dryTones.join(', ')})`);
  }
});

test('tree canopy stays overhead and non-solid, and its bottom-left quadrant still touches the trunk planted below it', () => {
  for (const name of ['treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR']) {
    const tile = tileInfoFor(name);
    assert.equal(tile.overhead, true, `${name} should stay overhead (drawn above the player)`);
    assert.equal(tile.solid, false, `${name} should stay non-solid`);
  }
  assert.equal(tileInfoFor('treeTrunk').solid, true, 'treeTrunk should stay solid');
  // STYLE_GUIDE "the trunk tile sits directly below the canopy quad": build-campus.js plants the
  // trunk under the canopy's BL quadrant, so BL's own "skirt" row (FB-0019's fix -- the flat band
  // added at virtual gy 27-30, i.e. local row 14 of this quadrant's own 0-15) must stay opaque
  // across the columns the trunk actually occupies (x+8..13 in treeTrunk's own art), regardless of
  // the recolor source (FB-0025 addendum): the shape/outline logic is unchanged, only the fill.
  const { x: tx, y: ty } = tileByName('treeCanopyBL');
  for (const x of [8, 9, 10, 11, 12, 13]) {
    const i = ((ty + TILE - 2) * png.width + (tx + x)) * 4;
    assert.ok(png.rgba[i + 3] !== 0, `treeCanopyBL's skirt row should be opaque at column ${x} (over the trunk), or the canopy floats above it`);
  }
});

test('BITS building walls use the BITS palette (sand wall, terracotta trim, and the new cap/base bands)', () => {
  const wallCounts = colorCounts('bitsWallPlain');
  assert.ok('#e6cba4' in wallCounts, 'bitsWallPlain is missing the sand wall color');
  assert.ok('#cf8a6c' in wallCounts, 'bitsWallPlain is missing the terracotta trim color');
  assert.ok('#f2ddb8' in wallCounts, 'bitsWallPlain is missing the light cap band (wallHi)');
  assert.ok('#6b7280' in wallCounts, 'bitsWallPlain is missing the cool baseboard (baseCool)');
  const grandCounts = colorCounts('bitsEntranceGrandL');
  assert.ok('#9c3a28' in grandCounts, 'bitsEntranceGrandL is missing the red arch color (archRed)');
  const plainCounts = colorCounts('bitsEntranceL');
  assert.ok(!('#9c3a28' in plainCounts), 'the ordinary bitsEntranceL should not have the grand arch color');
});

test('the Main Block entrance tiles exist, are distinct from the ordinary entrance, and stay walkable', () => {
  for (const name of ['bitsEntranceGrandL', 'bitsEntranceGrandR']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, false, `${name} should be walkable, like the ordinary entrance`);
  }
});

test('every tile name this pass added is present in assets/tiles.json', () => {
  const addedNames = ['bitsEntranceGrandL', 'bitsEntranceGrandR'];
  for (const name of addedNames) assert.ok(tileInfoFor(name), `missing "${name}" in assets/tiles.json`);
});

// ---------- general kit hygiene ----------

test('the original 44 tile names keep their positions (map tile indices stay stable)', () => {
  const original = [
    'grass', 'grass2', 'flowers', 'tallgrass', 'path', 'water', 'tree', 'rock',
    'roofTL', 'roofT', 'roofTR', 'eaveL', 'eave', 'eaveR', 'wallL', 'wall', 'wallR', 'houseWindow', 'door',
    'floor', 'wallUpper', 'wallLower', 'wallWindow', 'edge', 'doorway', 'doormat', 'rug', 'table', 'bedHead', 'bedFoot', 'bookshelf', 'plant',
    'sand', 'campusGround', 'asphalt', 'paving', 'parking', 'track', 'turf', 'court', 'fence',
    'bitsRoof', 'bitsWall', 'bitsDoor', 'otherRoof', 'otherWall',
  ];
  original.forEach((name, i) => {
    assert.equal(tileInfo.tiles[i].name, name, `tile index ${i} should still be "${name}"`);
  });
});
