// FB-0030/FB-0031 (premium pass stage 5, docs/plans/2026-09-26-premium-pass.md, docs/INTERIORS_PLAN.md):
// the Main Block interiors rebuilt compact per the owner's own words -- the foyer per her photo
// (docs/research/reference/owner-main-block-foyer.png), a short corridor to the locked side wings,
// and one corridor per upper floor carrying the 3 key rooms. Three things this pass specifically
// promised and could otherwise silently regress later, not already covered by
// tests/unit/interiors.test.js (generic connectivity/area checks) or
// tests/unit/interior-furniture.test.js (the foyer's own dressing):
//   1. every key station sits on its OWN room's specific furniture (not just "some structure tile"),
//   2. tall foyer/key-room furniture (columns, the staircase, plants, the server/lab rack) is a real
//      y-sorted `depthGroup` (ADR 0015), not just a solid tile,
//   3. every script/route anchor (src/scripts.js, src/objective-routes.js) resolves against the real
//      generated maps -- a later map regeneration that renames/moves one of these would otherwise
//      only be caught by manually walking the game.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { MAPS, SCRIPTS, OBJECTIVE_ROUTES, tiledObjects, resolveAnchor } = loadGameData();

const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const tileNames = tileInfo.tiles.map((t) => t.name);

const mapJsonCache = {};
function loadMapJson(key) {
  if (!mapJsonCache[key]) {
    mapJsonCache[key] = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${key}.json`), 'utf8'));
  }
  return mapJsonCache[key];
}
function structureNameAt(json, x, y) {
  const layer = json.layers.find((l) => l.name === 'structures').data;
  const gid = layer[y * json.width + x];
  return gid ? tileNames[gid - 1] : null;
}

// ---------- FB-0030: every key station sits on its own room's specific furniture ----------

const KEY_STATION_FURNITURE = {
  'main-block-1': { icl: 'intTechCoreConsole', room195: 'intTeacherDesk' }, // P5c: the ICL's key sits on the lab's core console
  'main-block-3': { physicsLab: 'intLabBenchWood' },
};

for (const [mapKey, stations] of Object.entries(KEY_STATION_FURNITURE)) {
  for (const [id, expectedTile] of Object.entries(stations)) {
    test(`FB-0030: ${mapKey}'s "${id}" key station sits exactly on a "${expectedTile}" tile`, () => {
      const def = MAPS[mapKey].keyStations.find((ks) => ks.id === id);
      assert.ok(def, `${mapKey} has no key station "${id}"`);
      const json = loadMapJson(mapKey);
      const found = structureNameAt(json, def.x, def.y);
      assert.equal(found, expectedTile, `${mapKey}: key station "${id}" at (${def.x},${def.y}) sits on "${found}", expected "${expectedTile}"`);
    });
  }
}

// ---------- FB-0030: tall furniture (columns, the staircase, plants, racks) is a real depthGroup ----------

function depthGroupsOf(json) {
  return tiledObjects(json).filter((o) => o.type === 'depthGroup');
}
function coveredByDepthGroup(groups, x, y) {
  return groups.some((g) => x >= g.x && x < g.x + g.width && y >= g.y && y < g.y + g.height);
}
// Every structures-layer tile of these tile names, anywhere on the map, must sit inside some
// depthGroup rect -- the exact "she walks behind it" promise (ADR 0015) the owner's brief asked for
// ("make the staircase/mezzanine/columns/big plants depthGroups").
const TALL_TILES_BY_MAP = {
  'main-block-g': [
    'intColumnCapL', 'intColumnCapR', 'intColumnShaftL', 'intColumnShaftR', 'intColumnBaseL', 'intColumnBaseR',
    // P4b: the staircase is the stair kit now (flight tiles, landing, the wall between the upper flights)
    ...['M', 'EL', 'ER', 'WL', 'WR'].flatMap((kind) => [0, 1, 2, 3].map((row) => `intStairs${kind}${row}`)),
    'intStairsLandL', 'intStairsLandM', 'intStairsLandR',
    ...['L', 'R'].flatMap((side) => [0, 1, 2].map((row) => `intStairsWall${side}${row}`)),
    'intPottedPlant',
  ],
  'main-block-1': ['intTechRackTopA', 'intTechRackBaseA', 'intTechRackTopB', 'intTechRackBaseB', ...[0, 1, 2, 3].flatMap((c) => [0, 1].map((r) => `intHoloTable${c}${r}`))], // P5c: the ICL's racks and holo table
  'main-block-3': ['intLabRack'],
};

for (const [mapKey, tileList] of Object.entries(TALL_TILES_BY_MAP)) {
  test(`FB-0030: ${mapKey}'s tall furniture (${tileList.join(', ')}) is covered by a depthGroup`, () => {
    const json = loadMapJson(mapKey);
    const groups = depthGroupsOf(json);
    assert.ok(groups.length > 0, `${mapKey} has no depthGroup objects at all`);
    const layer = json.layers.find((l) => l.name === 'structures').data;
    let checked = 0;
    for (let y = 0; y < json.height; y++) {
      for (let x = 0; x < json.width; x++) {
        const gid = layer[y * json.width + x];
        if (!gid) continue;
        const name = tileNames[gid - 1];
        if (!tileList.includes(name)) continue;
        checked++;
        assert.ok(coveredByDepthGroup(groups, x, y), `${mapKey}: "${name}" at (${x},${y}) isn't covered by any depthGroup`);
      }
    }
    assert.ok(checked > 0, `${mapKey}: none of [${tileList.join(', ')}] were actually found on the map`);
  });
}

// ---------- FB-0030: the mezzanine balcony edge (in the foyer, at the top of the staircase) ----------

test('FB-0030: the foyer has a mezzanine balcony edge (the black wrought-iron railing) at the top of the staircase', () => {
  const json = loadMapJson('main-block-g');
  const layer = json.layers.find((l) => l.name === 'structures').data;
  const names = new Set();
  for (const gid of layer) if (gid) names.add(tileNames[gid - 1]);
  assert.ok(names.has('intAtriumRailing'), 'expected the foyer to have the mezzanine\'s own railing tile (intAtriumRailing)');
});

// ---------- FB-0031: every script/route anchor resolves against the real generated maps ----------

// src/objective-routes.js OBJECTIVE_ROUTES: every `{ map, anchor }` stop must resolve on that real
// map (campus.json or the generated interior JSON) -- this is exactly what a renamed/moved door or
// stairs object (a map regeneration, a future art pass) would silently break.
for (const [objective, stops] of Object.entries(OBJECTIVE_ROUTES)) {
  for (const stop of stops) {
    if (!stop.anchor) continue; // npc/keyStation stops are resolved a different way, not by name
    test(`FB-0031: OBJECTIVE_ROUTES["${objective}"]'s anchor "${stop.anchor}" resolves on ${stop.map}`, () => {
      const json = loadMapJson(stop.map);
      const objects = tiledObjects(json);
      const point = resolveAnchor(objects, stop.anchor);
      assert.ok(point, `"${stop.anchor}" does not resolve on map "${stop.map}"`);
    });
  }
}

// src/scripts.js SCRIPTS: every step naming a plain-string anchor (cameraPan.to, move.path entries,
// spawnActor/placeActor.at) resolves on the map that script actually plays on. `{ keyStation: id }`/
// `{ actor, offset }`/`{ anchor, offset }` points are resolved a different way at runtime (not by a
// bare name) and are skipped here; walking those is tests/e2e/scripts.spec.js's job.
const SCRIPT_MAP = {
  gate2: 'campus',
  opening: 'campus',
  entrance: 'campus',
  keyRoomPhysicsLab: 'main-block-3',
  keyRoomIcl: 'main-block-1',
  keyRoomRoom195: 'main-block-1',
};

function namedAnchorsIn(steps, out = []) {
  for (const step of steps) {
    if (step.cameraPan && typeof step.cameraPan.to === 'string') out.push(step.cameraPan.to);
    if (step.spawnActor && typeof step.spawnActor.at === 'string') out.push(step.spawnActor.at);
    if (step.placeActor && typeof step.placeActor.at === 'string') out.push(step.placeActor.at);
    if (step.move && Array.isArray(step.move.path)) {
      for (const p of step.move.path) if (typeof p === 'string') out.push(p);
    }
    if (step.parallel) namedAnchorsIn(step.parallel, out);
  }
  return out;
}

for (const [key, mapKey] of Object.entries(SCRIPT_MAP)) {
  const anchors = [...new Set(namedAnchorsIn(SCRIPTS[key]))];
  if (!anchors.length) continue;
  test(`FB-0031: SCRIPTS.${key}'s named anchors resolve on ${mapKey}`, () => {
    const json = loadMapJson(mapKey);
    const objects = tiledObjects(json);
    for (const name of anchors) {
      assert.ok(resolveAnchor(objects, name), `SCRIPTS.${key}: anchor "${name}" does not resolve on map "${mapKey}"`);
    }
  });
}

// ---------- Quality loop, Interior art run 1+2 (docs/quality/scorecard.md, 2026-09-28) ----------
// Run 1's owner rating: "3/10... a big pale empty floor... 1-tile vertical wall strips (no 3/4 top
// edge + face)". Run 1's fix (every row/column packed, no aisles) over-corrected: run 2's rating
// ("Over-corrected: a solid wall-to-wall grid... no aisles, she stands among them... uniform rows of
// identical benches, like a warehouse") asked for real aisles/a walkway and "about 50% walkable
// floor" instead of "as dense as possible". Checked directly against the generated maps so a later
// regeneration can't silently regress either direction: every story room's own walkable share stays
// inside a 35-60% band (dense, but with real room to walk), and every Main Block room's own walls
// are a real 2-tile-tall cap-then-face, not a single flat tile.

// A room's own `area` object is its *interior* (Floor.interior(), one tile in from the wall ring) --
// exactly the rectangle the brief's "~50% walkable floor" means "of any room's floor". Returns the
// *walkable* (plain, unfurnished) share, not the furnished share.
function walkableFloorRatio(json, areaName) {
  const struct = json.layers.find((l) => l.name === 'structures').data;
  const objs = json.layers.find((l) => l.type === 'objectgroup').objects;
  const area = objs.find((o) => o.type === 'area' && o.name === areaName);
  if (!area) throw new Error(`no area object named "${areaName}"`);
  const x0 = Math.round(area.x / 16), y0 = Math.round(area.y / 16);
  const x1 = x0 + Math.round(area.width / 16) - 1, y1 = y0 + Math.round(area.height / 16) - 1;
  let total = 0, plain = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      total++;
      if (!struct[y * json.width + x]) plain++;
    }
  }
  return plain / total;
}

const DENSE_STORY_ROOMS = {
  'main-block-1': ['ICL', 'Room 195'],
  'main-block-3': ['Physics Lab'],
};

for (const [mapKey, names] of Object.entries(DENSE_STORY_ROOMS)) {
  for (const name of names) {
    test(`Quality loop (Interior art run 2): ${mapKey}'s "${name}" has real aisles (35-60% walkable floor)`, () => {
      const json = loadMapJson(mapKey);
      const ratio = walkableFloorRatio(json, name);
      assert.ok(ratio >= 0.35 && ratio <= 0.6, `${mapKey}: "${name}" is ${(ratio * 100).toFixed(1)}% walkable, expected 35-60%`);
    });
  }
}

// Every Main Block room built with `wallKit: 'roomBuilder'` (tools/interiors/plans.js) gets a real
// LimeZu Room_Builder face on its own wall ring (`intWallFace`/`intWallFaceEndL`/`intWallFaceEndR`),
// and at least some of its top wall has a matching `intWallCap` bled in one row above it
// (Floor.capTopWall()) -- together a genuine "top edge, then a 2nd tile of coloured face" instead of
// one flat hand-drawn tile. The foyer specifically has full clearance above its own top wall (open
// canvas, nothing built north of it), so its cap coverage should be complete, not just partial.
const MAIN_BLOCK_KEYS = ['main-block-g', 'main-block-1', 'main-block-2', 'main-block-3'];

for (const key of MAIN_BLOCK_KEYS) {
  test(`Quality loop (Interior art run 1): ${key} uses the real Room_Builder wall face (2-tile-tall: a cap row above a face row)`, () => {
    const json = loadMapJson(key);
    const struct = json.layers.find((l) => l.name === 'structures').data;
    const names = new Set();
    for (const gid of struct) if (gid) names.add(tileNames[gid - 1]);
    assert.ok(names.has('intWallFace'), `${key}: expected the Room_Builder wall face (intWallFace) somewhere on this floor`);
    assert.ok(names.has('intWallCap'), `${key}: expected a wall cap (intWallCap) bled in above at least one wall on this floor`);
  });
}

test('Quality loop (Interior art run 1): the Foyer\'s entire top wall has a full-width cap row (intWallCap) above it -- a genuine 2-tile-tall wall, not a single flat tile', () => {
  const json = loadMapJson('main-block-g');
  const struct = json.layers.find((l) => l.name === 'structures').data;
  const objs = json.layers.find((l) => l.type === 'objectgroup').objects;
  const foyer = objs.find((o) => o.type === 'area' && o.name === 'Foyer');
  const x0 = Math.round(foyer.x / 16), x1 = x0 + Math.round(foyer.width / 16) - 1;
  const capRow = Math.round(foyer.y / 16) - 2; // one row above the outer wall ring itself
  // FB-0062 (P4a): the Library lobby stands against the middle of this wall with its own walls, so the cap row is
  // full width everywhere EXCEPT the lobby's columns (its own wall ring is there instead).
  const lobby = objs.find((o) => o.type === 'area' && o.name === 'Library Lobby');
  const lobbyX0 = Math.round(lobby.x / 16) - 1, lobbyX1 = lobbyX0 + Math.round(lobby.width / 16) + 1;
  let capTiles = 0;
  let expected = 0;
  for (let x = x0; x <= x1; x++) {
    if (x >= lobbyX0 && x <= lobbyX1) continue;
    expected++;
    const gid = struct[capRow * json.width + x];
    if (gid && tileNames[gid - 1] === 'intWallCap') capTiles++;
  }
  assert.equal(capTiles, expected, `expected every one of the Foyer's ${expected} open top-wall columns to have an intWallCap, found ${capTiles}`);
});
