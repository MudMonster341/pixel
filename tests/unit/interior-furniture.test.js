// Regression tests for the 2026-09-22 interior furniture kit refresh (owner brief: replace the
// hand-drawn interior furniture with free asset packs; see docs/research/asset-packs.md and
// docs/INTERIORS_PLAN.md). Three things this pass specifically promised and could otherwise silently
// regress later: every room type actually has the furniture its type implies (not just "some tile"),
// no furniture ever sits on a doorway (the one thing that would make a room unreachable), and every
// new tile name this pass added is a real, present tile.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { tileInfo } = loadGameData();
const TILE = Object.fromEntries(tileInfo.tiles.map((t, i) => [t.name, i]));

const KEYS = [
  'main-block-g', 'main-block-1', 'main-block-2', 'main-block-3',
  'library-block-g', 'library-block-1', 'mechanical-block-g', 'mechanical-block-1',
];

const maps = {};
for (const key of KEYS) {
  maps[key] = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${key}.json`), 'utf8'));
}

// ---------- every new tile name this pass added is a real tile ----------

test('interior furniture kit refresh: every new tile name exists in assets/tiles.json (run `npm run assets` if this fails)', () => {
  const newTiles = [
    'intLabBench', 'intLabTank', 'intLabRack', 'intCanteenCounter', 'intPrinter', 'intBooksStack',
    'intGlobe', 'intWaterCooler', 'intVendingMachine', 'intBin',
  ];
  for (const name of newTiles) {
    assert.ok(name in TILE, `expected assets/tiles.json to have a tile named "${name}"`);
  }
});

test('interior furniture kit refresh: the new tiles were appended after the original catalog, not inserted (every existing tile keeps its index)', () => {
  // Same rule FB-0025's own vendor-assets.test.js checks for the parked-car tiles: appending new
  // tiles must never shift an existing tile's numeric index, since every map references tiles by
  // that index (docs/ARCHITECTURE.md "content is data").
  const lastOriginalIndex = TILE.bitsFacadeBaseEndR;
  const newTiles = [
    'intLabBench', 'intLabTank', 'intLabRack', 'intCanteenCounter', 'intPrinter', 'intBooksStack',
    'intGlobe', 'intWaterCooler', 'intVendingMachine', 'intBin',
  ];
  newTiles.forEach((name, i) => {
    assert.equal(TILE[name], lastOriginalIndex + 1 + i, `"${name}" should come right after bitsFacadeBaseEndR, in order`);
  });
});

// ---------- every room type has the furniture its type implies ----------

// name -> a "kind" property value (see build-interiors.js's FURNISHERS keys) -> at least one of
// these tile names must appear somewhere inside that room's own rect.
const EXPECTED_FURNITURE_BY_KIND = {
  classroom: ['intTeacherDesk', 'intDesk'],
  classroom60: ['intTeacherDesk', 'intDesk'],
  lab: ['intLabBench', 'intComputerBench'],
  labHeavy: ['intMachine', 'intLabBench'],
  office: ['intDesk'],
  reception: ['intReceptionDesk'],
  locker: ['intLocker'],
  auditorium: ['intAuditoriumSeat'],
  library: ['bookshelf', 'table'],
  stack: ['bookshelf'],
  reading: ['table'],
  canteen: ['intCanteenCounter', 'table'],
  mart: ['bookshelf', 'intVendingMachine'],
  medical: ['intBed', 'intMedicalDesk'],
  badminton: ['intBadmintonNet'],
  tabletennis: ['intTTTable'],
  club: ['table'],
  discussion: ['table'],
  workshop: ['intMachine', 'intLabBench'],
  service: ['intDesk'],
  // FB-0030/0031 (premium pass stage 5): the ICVL/Physics Lab key rooms get their own dedicated
  // furniture, distinct from the shared 'lab'/'labHeavy' kinds above.
  labIcvl: ['intIcvlBench', 'intServerRack'],
  labPhysics: ['intLabBenchWood'],
};

function roomsByKind(json) {
  const objs = json.layers.find((l) => l.type === 'objectgroup').objects;
  const areas = objs.filter((o) => o.type === 'area');
  const struct = json.layers.find((l) => l.name === 'structures').data;
  const W = json.width;
  return areas.map((area) => {
    const kind = area.properties?.find((p) => p.name === 'kind')?.value;
    const x0 = Math.round(area.x / 16), y0 = Math.round(area.y / 16);
    const x1 = x0 + Math.round(area.width / 16) - 1, y1 = y0 + Math.round(area.height / 16) - 1;
    const tileNamesInRoom = new Set();
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const gid = struct[y * W + x];
        if (gid) tileNamesInRoom.add(tileInfo.tiles[gid - 1].name);
      }
    }
    return { name: area.name, kind, tileNamesInRoom };
  });
}

for (const key of KEYS) {
  test(`${key}: every room whose type names an expected furniture set actually has at least one of those pieces`, () => {
    for (const room of roomsByKind(maps[key])) {
      const expected = EXPECTED_FURNITURE_BY_KIND[room.kind];
      if (!expected) continue; // no expectation registered for this kind (e.g. 'lobby', 'foyer', 'lounge' -- simply-furnished by design, not asserted here)
      const hasOne = expected.some((name) => room.tileNamesInRoom.has(name));
      assert.ok(hasOne, `${key}: room "${room.name}" (kind "${room.kind}") has none of [${expected.join(', ')}] -- found [${[...room.tileNamesInRoom].join(', ')}]`);
    }
  });
}

// FB-0030/0031 (premium pass stage 5) built the foyer per the owner's photo; ADR 0020 rebuilt it to follow the
// official 3D tour (docs/research/tour-ground-floor.md): pale oak floor, columns, a split staircase + landing, a
// spiral chandelier, the wordmark, two reception desks, red and blue sofas, black-pot plants, the glass terrarium,
// and the LUG Stall nook behind the stairs. (tests/unit/foyer-tour.test.js pins the layout itself; this keeps the
// original "the foyer has all of its dressing" check, on the new pieces.)
test('Main Block foyer specifically has a reception desk, seating, a plant, a noticeboard, the oak floor (no marble or runner), columns, a split staircase + landing, a terrarium, a chandelier, the wordmark, and the LUG Stall nook', () => {
  const json = maps['main-block-g'];
  const objs = json.layers.find((l) => l.type === 'objectgroup').objects;
  const foyer = objs.find((o) => o.type === 'area' && o.name === 'Foyer');
  assert.ok(foyer, 'expected a "Foyer" area object on main-block-g');
  const struct = json.layers.find((l) => l.name === 'structures').data;
  const ground = json.layers.find((l) => l.name === 'ground').data;
  const overheadLayer = json.layers.find((l) => l.name === 'overhead');
  const overhead = overheadLayer ? overheadLayer.data : [];
  const W = json.width;
  // The area object is the room's *interior* (Floor.interior(), one tile in from the wall ring) --
  // widen by 1 on every side so the scan also covers the wall row the wordmark is mounted on.
  const x0 = Math.round(foyer.x / 16) - 1, y0 = Math.round(foyer.y / 16) - 1;
  const x1 = x0 + Math.round(foyer.width / 16) + 1, y1 = y0 + Math.round(foyer.height / 16) + 1;
  const found = new Set();
  const groundFound = new Set();
  const overheadFound = new Set();
  let stairsTiles = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const sgid = struct[y * W + x];
      if (sgid) found.add(tileInfo.tiles[sgid - 1].name);
      const ggid = ground[y * W + x];
      if (ggid) groundFound.add(tileInfo.tiles[ggid - 1].name);
      const ogid = overhead[y * W + x];
      if (ogid) overheadFound.add(tileInfo.tiles[ogid - 1].name);
      if (sgid && ['intFoyerStairsL', 'intFoyerStairsR', 'intFoyerLanding'].includes(tileInfo.tiles[sgid - 1].name)) stairsTiles++;
    }
  }
  for (const name of ['intReceptionDesk', 'intSofaRed', 'intSofaBlue', 'intBigPlantTop', 'intNoticeboard', 'intColumnShaftL', 'intTerrariumTL', 'intTotemTop']) {
    assert.ok(found.has(name), `expected the Foyer to include "${name}", found [${[...found]}]`);
  }
  assert.ok(groundFound.has('intFloorOak'), `expected the Foyer's ground layer to include "intFloorOak", found [${[...groundFound]}]`);
  for (const name of ['intFloorMarble', 'intFloorMarbleRunner']) {
    assert.ok(!groundFound.has(name), `the Foyer must not have the old "${name}" any more (the tour has plain oak, no runner)`);
  }
  assert.ok(overheadFound.has('intChandelier'), `expected the Foyer's overhead layer to include "intChandelier", found [${[...overheadFound]}]`);
  assert.ok(stairsTiles >= 6, `expected a real block of staircase/landing tiles in the Foyer, found ${stairsTiles}`);
  const wordmarkTiles = Array.from({ length: 9 }, (_, i) => `bitsSignSeg${i}`).filter((n) => found.has(n));
  assert.ok(wordmarkTiles.length >= 8, `expected the "BITS Pilani, Dubai Campus" wordmark on the Foyer's back wall, found [${wordmarkTiles}]`);
  const stall = objs.find((o) => o.type === 'area' && o.name === 'LUG Stall');
  assert.ok(stall, 'expected a "LUG Stall" area object on main-block-g (docs/STORY.md: "an event stall behind the stairs")');
  assert.equal(stall.properties?.find((p) => p.name === 'kind')?.value, 'stall');
});

// ---------- no furniture ever sits on a doorway tile ----------

for (const key of KEYS) {
  test(`${key}: no structures-layer tile (furniture, walls, whiteboard...) sits on a doorway tile`, () => {
    const json = maps[key];
    const ground = json.layers.find((l) => l.name === 'ground').data;
    const struct = json.layers.find((l) => l.name === 'structures').data;
    const offenders = [];
    for (let i = 0; i < ground.length; i++) {
      const groundGid = ground[i];
      if (!groundGid || tileInfo.tiles[groundGid - 1].name !== 'intDoorway') continue;
      const structGid = struct[i];
      if (structGid) offenders.push(`(${i % json.width},${Math.floor(i / json.width)}): ${tileInfo.tiles[structGid - 1].name}`);
    }
    assert.equal(offenders.length, 0, `${key}: found furniture/walls on a doorway tile: ${offenders.join('; ')}`);
  });
}
