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

// FB-0053/FB-0056: two date palms and three leafy trees (tools/lib/tree-art.js), each <family>Trunk + <family>Canopy{TL,TR,BL,BR}.
const TREE_FAMILIES = ['palm1', 'palm2', 'leafy1', 'leafy2', 'leafy3'];
const CANOPY_TILES = TREE_FAMILIES.flatMap((f) => ['TL', 'TR', 'BL', 'BR'].map((q) => `${f}Canopy${q}`));

test('FB-0015: tree trunks and hedges are solid, canopy tiles are overhead and not solid', () => {
  for (const name of [...TREE_FAMILIES.map((f) => `${f}Trunk`), 'hedge', 'bush']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, true, `${name} should be solid`);
  }
  for (const name of CANOPY_TILES) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.overhead, true, `${name} should be marked overhead: true`);
    assert.equal(tile.solid, false, `${name} should not be solid (it's drawn above the player)`);
  }
});

test('FB-0015: canopy tiles have transparent pixels outside the tree silhouette', () => {
  for (const name of ['leafy1CanopyTL', 'palm1CanopyBR']) {
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

test('tree canopies stay overhead and non-solid, trunks solid, and each canopy touches the trunk planted below it', () => {
  for (const name of CANOPY_TILES) {
    const tile = tileInfoFor(name);
    assert.equal(tile.overhead, true, `${name} should stay overhead (drawn above the player)`);
    assert.equal(tile.solid, false, `${name} should stay non-solid`);
  }
  for (const family of TREE_FAMILIES) {
    assert.equal(tileInfoFor(`${family}Trunk`).solid, true, `${family}Trunk should stay solid`);
    // STYLE_GUIDE "the trunk tile sits directly below the canopy quad": build-campus.js plants the trunk under the canopy's
    // BL quadrant, so BL's bottom row is opaque somewhere over the trunk's columns (x 8..14 of the tile).
    const { x: tx, y: ty } = tileByName(`${family}CanopyBL`);
    let touches = false;
    for (let x = 7; x <= 14; x++) if (png.rgba[((ty + TILE - 1) * png.width + (tx + x)) * 4 + 3] !== 0) touches = true;
    assert.ok(touches, `${family}CanopyBL's bottom row is empty over the trunk columns, so the crown floats above its trunk`);
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

test('point D: the composed portico prefab tiles exist, are all solid (wall/glass surfaces), and the steps are ground-layer (never solid)', () => {
  // FB-0046: bitsPorticoGlassBase used to be walkable ("the door-connecting spur reaches it"), which let the player stand ON
  // the facade line beside the glass door. No walkway reaches it in the built map; it is a wall tile like the rest.
  for (const name of ['bitsPorticoFrame', 'bitsPorticoGlassTop', 'bitsPorticoGlassMid', 'bitsPorticoGlassBase']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, true, `${name} should be solid (a wall/glass surface)`);
  }
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

// ---------- quality loop, category 1 run 1 (2026-09-28): "Outdoor art" fixes ----------

test('the entrance steps are flat horizontal treads (no vertical stripe texture), each a distinct light-stone tone', () => {
  // The old Kenney staircase crop this replaced was a vertical-ridge side-on silhouette -- reading
  // as "grey blinds", per the scorecard. A real horizontal tread should have at most a handful of
  // distinct tones (light face, nosing shadow, riser), not many (a vertical-ridge crop samples many
  // slightly different tones across its own width).
  for (const name of ['bitsStep1', 'bitsStep2', 'bitsStep3']) {
    const counts = colorCounts(name);
    assert.ok(Object.keys(counts).length <= 6, `${name} should be a flat few-tone tread, found ${Object.keys(counts).length} tones`);
  }
  const step1 = colorCounts('bitsStep1');
  const step2 = colorCounts('bitsStep2');
  const step3 = colorCounts('bitsStep3');
  assert.notDeepEqual(step1, step2, 'bitsStep1 and bitsStep2 should be distinct tones, not the same tread repeated');
  assert.notDeepEqual(step2, step3, 'bitsStep2 and bitsStep3 should be distinct tones, not the same tread repeated');
});

// Quality loop, category 1 run 2 (2026-09-28): "steps now read as two flat dark brown bars...
// must be LIGHT stone (cream/pale grey like the sidewalk)... no brown." The tread's own dominant
// (highest-count) tone on each step should be both light (high luminance) and low-saturation/
// neutral (not a warm brown -- a high red-minus-blue gap is exactly what made the old '-'/'D'/'d'
// keys read as brown, see PALETTE's own comment on stepLight/Mid/Dark).
test('the entrance step treads are light stone, not brown', () => {
  for (const name of ['bitsStep1', 'bitsStep2', 'bitsStep3']) {
    const counts = colorCounts(name);
    const [dominantHex] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const r = parseInt(dominantHex.slice(1, 3), 16);
    const g = parseInt(dominantHex.slice(3, 5), 16);
    const b = parseInt(dominantHex.slice(5, 7), 16);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    assert.ok(lum > 170, `${name}'s dominant tone ${dominantHex} (luminance ${lum.toFixed(0)}) is too dark for "light stone"`);
    assert.ok(r - b < 30, `${name}'s dominant tone ${dominantHex} (r-b=${r - b}) reads as warm/brown, not pale cream-grey`);
  }
});

test('the facade cast shadow is a soft translucent gradient, not an opaque bar', () => {
  const { index } = tileByName('bitsFacadeShadow');
  const tx = (index % tileInfo.columns) * TILE;
  const ty = Math.floor(index / tileInfo.columns) * TILE;
  const alphaAt = (yy) => png.rgba[((ty + yy) * png.width + tx) * 4 + 3];
  const topAlpha = alphaAt(0);
  const bottomAlpha = alphaAt(TILE - 1);
  assert.ok(topAlpha > 0 && topAlpha < 128, `bitsFacadeShadow's own top row should be a soft tint (found alpha ${topAlpha}), not opaque or invisible`);
  assert.ok(bottomAlpha < topAlpha, 'bitsFacadeShadow should fade out towards its far edge, not stay a flat bar');
});

test('a large flat roof mixes at least 3 distinct rooftop-clutter variants, not one texture stamped everywhere', () => {
  for (const [a, b, c] of [['bitsRoof', 'bitsRoofB', 'bitsRoofC'], ['otherRoof', 'otherRoofB', 'otherRoofC']]) {
    for (const name of [a, b, c]) assert.ok(tileInfoFor(name), `missing "${name}"`);
    const countsA = colorCounts(a);
    const countsB = colorCounts(b);
    const countsC = colorCounts(c);
    assert.notDeepEqual(countsA, countsB, `${a} and ${b} should look different (real rooftop variety)`);
    assert.notDeepEqual(countsB, countsC, `${b} and ${c} should look different (real rooftop variety)`);
  }
});

test('lawn has tuft/flower variants for a non-repeating scatter, distinct from plain lawn/lawn2', () => {
  for (const name of ['lawn3', 'lawn4', 'lawn5']) assert.ok(tileInfoFor(name), `missing "${name}"`);
  const lawn = colorCounts('lawn');
  for (const name of ['lawn2', 'lawn3', 'lawn4', 'lawn5']) {
    assert.notDeepEqual(colorCounts(name), lawn, `${name} should look different from plain lawn`);
  }
});

test('the lamp post is a real 2-tile-tall pole: a base tile plus an overhead top tile with a distinct lamp head', () => {
  const base = tileInfoFor('lampPost');
  const top = tileInfoFor('lampPostTop');
  assert.ok(base, 'missing lampPost');
  assert.ok(top, 'missing lampPostTop');
  assert.equal(base.solid, true, 'lampPost (the pole\'s own base) should be solid');
  assert.equal(top.overhead, true, 'lampPostTop should be an overhead tile (like a tree canopy), not a ground/structure tile');
  const topCounts = colorCounts('lampPostTop');
  assert.ok('#ffd23f' in topCounts, 'lampPostTop is missing its warm lamp-glow colour');
});

test('Gate 2 has real gate furniture: pillars, a sign, a security booth, and a barrier arm', () => {
  for (const name of ['gateSign', 'securityBooth']) {
    const tile = tileInfoFor(name);
    assert.ok(tile, `missing "${name}"`);
    assert.equal(tile.solid, true, `${name} should be solid`);
  }
  const barrier = tileInfoFor('barrierArm');
  assert.ok(barrier, 'missing barrierArm');
  assert.equal(barrier.solid, false, 'barrierArm sits on the avenue itself and must never block the player');
  assert.ok('#c0392b' in colorCounts('barrierArm'), 'barrierArm should show its red stripe colour');
});
