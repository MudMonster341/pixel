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

// Coordinator review round 3 (2026-09-27): kerbT/B/L/R/TL/TR/BL/BR used to be a completely separate
// code path from walkway()/walkwayEdge() -- Modern City's own brick paver-with-gutter-line tile,
// recolored to a salmon-brick ramp, filling the *entire* tile. That's what made every road-facing
// sidewalk edge (the avenue included) still read as brick even after round 2 fixed the plain
// `walkway` fill. kerbT is now literally the same Kenney concrete-sidewalk edge piece as
// walkwayEdgeT -- one sidewalk material, whether it borders a road or a lawn -- so this test checks
// they're pixel-identical and that neither one is brick.
test('FB-0014/round 3: a kerb edge tile is the same real sidewalk material as an ordinary walkway edge, not brick', () => {
  const kerb = colorCounts('kerbT');
  const walkEdge = colorCounts('walkwayEdgeT');
  assert.deepEqual(kerb, walkEdge, 'kerbT should be the same Kenney sidewalk-edge art as walkwayEdgeT');
  for (const brick of ['#1a1c2c', '#ffffff', '#b06b4a', '#9d6249', '#c0735c']) {
    assert.ok(!(brick in kerb), `kerbT should not contain the old brick-paver color ${brick}`);
  }
  assert.ok(Object.keys(kerb).length >= 3, 'kerbT should show real pack texture (several distinct tones), not a flat fill');
});

test('FB-0014: lane markings and a pedestrian crossing exist', () => {
  for (const name of ['roadLineH', 'roadLineV', 'crossingH', 'crossingV']) {
    assert.ok(tileInfoFor(name), `missing "${name}"`);
  }
});

// premium pass (2026-09-26, FB-0028: "the map pavements... look like brick walls... same visual
// weight as a wall"): the walkway's own border used to be baked into the top+bottom of every single
// tile unconditionally, which is exactly what made a path read as walled-in (a 3-tile-wide run
// stripes itself with a false seam down the middle, see tools/make-assets.js walkway()'s own comment).
// The plain `walkway` fill is now genuinely borderless -- a real border only exists on the network's
// true outward edge, as its own dedicated tile (build-campus.js stamps walkwayEdge*/walkwayCorner* in
// place of a plain `walkway` cell only where it actually borders lawn).
test("FB-0028: the walkway's plain fill has no border baked in (a path doesn't read as a walled-in strip)", () => {
  const counts = colorCounts('walkway');
  assert.ok(!('#c8c8c8' in counts) && !('#ffffff' in counts), 'walkway should not have its own border baked into every tile');
});

// Coordinator review round 3 (2026-09-27): round 2's own hand-drawn concrete fill + a flat 2px
// light-grey line border ('#c8c8c8' on a '#d9d1c3' fill) was replaced with Kenney RPG Urban Pack's
// own concrete-sidewalk plot -- a real light blue-grey slab with its own built-in warm tan kerb
// border baked into the edge/corner art itself, used unrecolored. So the edge/corner tiles no longer
// carry either of round 2's specific hex values; instead each one differs from the plain `walkway`
// fill (it has its own border baked in) while staying in the same light, low-saturation tonal family.
test('FB-0028: the walkway network has dedicated edge/corner tiles for its true outward border', () => {
  const plainWalkway = colorCounts('walkway');
  for (const name of ['walkwayEdgeT', 'walkwayEdgeB', 'walkwayEdgeL', 'walkwayEdgeR', 'walkwayCornerTL', 'walkwayCornerTR', 'walkwayCornerBL', 'walkwayCornerBR']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, false, `${name} should stay walkable`);
    const counts = colorCounts(name);
    assert.notDeepEqual(counts, plainWalkway, `${name} should have its own kerb border, not be identical to plain walkway`);
    assert.ok(Object.keys(counts).length >= 3, `${name} should show real pack texture (several distinct tones)`);
  }
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
  // premium pass (2026-09-26, FB-0029): the Main Block entrance is a terracotta portal frame around
  // a dark glass door, per the owner's own photo and two independent Wikimedia angles -- not the red
  // arch this test used to pin (docs/STYLE_GUIDE.md's "Main Block specifically gets a real red arch"
  // section is corrected to match, see that file's own note). archRed is gone entirely now.
  // Coordinator review round 3 (2026-09-27): "compose it from Kenney's glass storefront/double door...
  // pieces" -- bitsEntranceGrandL/R are now a real Kenney glass double door (recolored terracotta
  // frame, native glass), not a flat '&'/'*' palette fill, so the frame is now '#8a4530' (this pass's
  // own terracotta-from-brick remap, not round 2's '#cf8a6c') and the glass is several real reflection
  // tones instead of one flat dark fill.
  const grandCounts = colorCounts('bitsEntranceGrandL');
  assert.ok(!('#9c3a28' in grandCounts), 'bitsEntranceGrandL should no longer use the old red arch color (archRed)');
  assert.ok('#8a4530' in grandCounts, 'bitsEntranceGrandL is missing the terracotta portal frame color');
  assert.ok(Object.keys(grandCounts).length >= 4, 'bitsEntranceGrandL should show real glass-door texture (several distinct tones), not a flat fill');
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

// ---------- coordinator review round 2 (2026-09-27) ----------

test('FB-0029: the compact sign band is navy lettering on a light fascia, not a flat tile', () => {
  const counts = colorCounts('bitsSignSeg0');
  assert.ok('#1a3a6b' in counts, 'bitsSignSeg0 has no navy lettering color');
  assert.ok('#f2ddb8' in counts, 'bitsSignSeg0 has no light fascia band');
  assert.ok(counts['#1a3a6b'] >= 6, `expected a real glyph (several navy pixels), found only ${counts['#1a3a6b'] || 0}`);
});

// Coordinator review round 3 (2026-09-27): the portico's glass panels are now Kenney's own wide glass
// window crop (frame recolored terracotta, glass left exactly as the pack drew it) instead of a flat
// dark '*' fill with one hand-drawn reflection streak -- real reflection variation (several distinct
// light-blue/lavender tones) is the whole point, not a single extra hex.
test('FB-0029: the entrance glass reads as glazing (real reflection texture), not a flat dark fill', () => {
  for (const name of ['bitsPorticoGlassTop', 'bitsPorticoGlassMid', 'bitsPorticoGlassBase']) {
    const counts = colorCounts(name);
    assert.ok('#8a4530' in counts, `${name} is missing the terracotta frame color`);
    assert.ok(Object.keys(counts).length >= 4, `${name} should show several distinct glass/reflection tones, not a flat fill`);
  }
});

// Coordinator review round 3 (2026-09-27): ordinary walkways moved again -- round 2's hand-drawn
// flat concrete fill ('#d9d1c3' etc.) still didn't read as real ground at the camera, so `walkway` is
// now Kenney RPG Urban Pack's own light concrete sidewalk plot, used natively (the coordinator's own
// "unrecoloured or only slightly warmed"). It should be a light, low-saturation grey slab with real
// texture (several distinct tones) and, still, no brick.
test('FB-0028: ordinary walkways are light concrete, not brick, and stay a subtle multi-tone slab', () => {
  const counts = colorCounts('walkway');
  assert.ok(Object.keys(counts).length >= 3, `walkway uses only ${Object.keys(counts).length} tone(s), expected real pack texture`);
  for (const brick of ['#b06b4a', '#9d6249', '#c0735c', '#8c5236']) {
    assert.ok(!(brick in counts), `walkway should not use the forecourt paver/brick color ${brick} (it should read as concrete, not brick)`);
  }
  // Light and low-saturation: every opaque tone's channels should sit close together (grey, not a
  // warm brick hue) and the tile should be reasonably bright overall.
  for (const hex of Object.keys(counts)) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    assert.ok(r - b < 40, `walkway tone ${hex} looks too warm/brick-like for a concrete sidewalk`);
    assert.ok((r + g + b) / 3 > 120, `walkway tone ${hex} looks too dark for a light concrete sidewalk`);
  }
});

// Coordinator review round 3 (2026-09-27): the cap/base bands are now blitted from a real Kenney wall
// crop (remapBitsWall/remapBitsWallBase, tools/make-assets.js) instead of a flat '$'/'wallHi'/'&'
// fill -- the parapet highlight is still this game's own `wallHi` hex ('#f2ddb8', reused deliberately
// so a recolored roofline still matches every hand-drawn cap band using that key), but the coping's
// own darker edge is now the coordinator's exact terracotta hex ('#b5583c'), not round 2's '#cf8a6c'.
test("point E: every building's facade has a distinct parapet/coping roof band, a darker plinth, and a cast-shadow tile", () => {
  const capCounts = colorCounts('bitsFacadeCap');
  assert.ok('#f2ddb8' in capCounts && '#b5583c' in capCounts, 'bitsFacadeCap is missing a distinct parapet highlight + terracotta coping');
  assert.ok(Object.keys(capCounts).length >= 4, 'bitsFacadeCap should show real brick-coursing texture, not a flat fill');
  const baseCounts = colorCounts('bitsFacadeBase');
  assert.ok('#6b7280' in baseCounts, 'bitsFacadeBase is missing its cool baseboard');
  const shadowTile = tileInfoFor('bitsFacadeShadow');
  assert.ok(shadowTile, 'missing bitsFacadeShadow');
  assert.equal(shadowTile.solid, false, 'bitsFacadeShadow should stay walkable (a ground tint, not an obstacle)');
});

test('point D: the composed portico prefab tiles exist, are solid except the walkable glass base and steps, and the steps are ground-layer (never solid)', () => {
  for (const name of ['bitsPorticoFrame', 'bitsPorticoGlassTop', 'bitsPorticoGlassMid']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, true, `${name} should be solid (a wall/glass surface)`);
  }
  const glassBase = tileInfoFor('bitsPorticoGlassBase');
  assert.ok(glassBase, 'missing bitsPorticoGlassBase');
  assert.equal(glassBase.solid, false, 'bitsPorticoGlassBase should stay walkable (the door-connecting spur legitimately reaches it, see its own comment in tools/make-assets.js)');
  for (const name of ['bitsStep1', 'bitsStep2', 'bitsStep3']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, false, `${name} should be walkable`);
  }
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
