// P4b (FB-0061, FB-0063, FB-0064, FB-0069): the Main Block's stairs finally read as stairs, and the lift works.
//   FB-0061 "centre the stairs, and then they don't look like stairs so make them look like stairs" (the foyer's staircase)
//   FB-0063 "fix the stairs please, find proper external tilesets to show stairs correctly" (the stairwells on floors 1-3)
//   FB-0064 "fix this please" / FB-0069 "lift not usable" (the grey double-door tile in the stairwell, which did nothing)
// Pinned against the REAL generated maps, the real tiles.png pixels and the real data, by intent. The stairs objects (names,
// destinations, positions, facing, arrival tiles) must not have moved: tests/unit/main-block-stairs.test.js checks the arrivals
// generically, this file pins the exact table so a re-layout cannot quietly change them.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const game = loadGameData();
const { MAPS, AMBIENT, SOUNDS, tileInfo, gridFromTiled, tiledObjects, isWalkableTile, DIRECTION_OFFSET, gameEvents } = game;
const liftDialog = game.evaluate('liftDialog');
const applyDialogActions = game.evaluate('applyDialogActions');
const pickDialogEntry = game.evaluate('pickDialogEntry');

const FLOORS = ['main-block-g', 'main-block-1', 'main-block-2', 'main-block-3'];
const NAMES = tileInfo.tiles.map((t) => t.name);

const maps = {};
for (const key of FLOORS) {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${MAPS[key].tiled}.json`), 'utf8'));
  const layer = (name) => json.layers.find((l) => l.name === name).data;
  maps[key] = { key, json, W: json.width, H: json.height, grid: gridFromTiled(json), objects: tiledObjects(json), ground: layer('ground'), structures: layer('structures') };
}
const plain = (v) => JSON.parse(JSON.stringify(v)); // the game data lives in another vm realm: compare plain copies
const nameAt = (m, layer, x, y) => {
  const gid = m[layer][y * m.W + x];
  return gid ? NAMES[gid - 1] : null;
};
const walkable = (m, x, y) => x >= 0 && y >= 0 && x < m.W && y < m.H && isWalkableTile(m.grid, tileInfo, x, y);
const tileOf = (o) => ({ x: Math.floor(o.x), y: Math.floor(o.y) });
const arrivalOf = (o) => {
  const [dx, dy] = DIRECTION_OFFSET[o.props.facing || 'down'];
  return { x: Math.floor(o.x) + dx, y: Math.floor(o.y) + dy };
};

// ---- the tile art, from the real PNG ----
const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
const lum = (x, y) => {
  const i = (y * png.width + x) * 4;
  return 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2];
};
const tilePx = (name) => {
  const i = NAMES.indexOf(name);
  assert.ok(i >= 0, `no tile "${name}"`);
  return { x0: (i % tileInfo.columns) * 16, y0: Math.floor(i / tileInfo.columns) * 16 };
};
// Luminance down one pixel column of a flight, from its far end (row 0) to its near end (row 3): 64 values.
const flightColumn = (col) => [0, 1, 2, 3].flatMap((row) => {
  const { x0, y0 } = tilePx(`intStairsM${row}`);
  return Array.from({ length: 16 }, (_, yy) => lum(x0 + col, y0 + yy));
});
const meanLum = (name) => {
  const { x0, y0 } = tilePx(name);
  let sum = 0;
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) sum += lum(x0 + xx, y0 + yy);
  return sum / 256;
};

const FLIGHT_RE = /^intStairs(M|EL|ER|WL|WR)[0-3]$/;
const OLD_STAIR_TILES = ['intFoyerTreadPlain', 'intFoyerStairsL', 'intFoyerStairsR', 'intFoyerLanding', 'intStairsUp', 'intStairsDown', 'intLift'];

// =====================================================================================================================
// The stair art itself (FB-0061 / FB-0063)
// =====================================================================================================================

test('FB-0063: the stair tiles alternate a light flat tread and a darker riser down the flight, a clear rhythm (7 steps), darkening towards the far end', () => {
  const col = flightColumn(8);
  let drops = 0; // tread -> riser: a clear step down in brightness
  let rises = 0; // the line under a riser -> the next tread: a clear step up
  for (let i = 1; i < col.length; i++) {
    if (col[i - 1] - col[i] >= 12) drops++;
    if (col[i] - col[i - 1] >= 12) rises++;
  }
  assert.ok(drops >= 6, `only ${drops} tread->riser steps down in brightness: the bands do not alternate`);
  assert.ok(rises >= 5, `only ${rises} riser->tread steps up in brightness: the bands do not alternate`);
  // the flight narrows into the distance and darkens towards its far end (row 0)
  assert.ok(meanLum('intStairsM0') < meanLum('intStairsM1') && meanLum('intStairsM1') < meanLum('intStairsM2') && meanLum('intStairsM2') < meanLum('intStairsM3'), 'the flight does not darken towards its far end');
  // near the viewer the tread is a light stone and the riser clearly darker
  const near = col.slice(48);
  assert.ok(Math.max(...near) - Math.min(...near) >= 60, 'the near steps have no real light/dark contrast');
});

test('FB-0063: a flight has real handrails (gold, with newel caps) on its open side and a plain stringer on the wall side', () => {
  const gold = (name, xx) => { // average colour of a column of the tile: is it gold-ish (r > b by a lot)?
    const { x0, y0 } = tilePx(name);
    let r = 0, b = 0;
    for (let yy = 6; yy < 12; yy++) { const i = ((y0 + yy) * png.width + x0 + xx) * 4; r += png.data[i]; b += png.data[i + 2]; }
    return (r - b) / 6;
  };
  assert.ok(gold('intStairsEL1', 2) > 60 || gold('intStairsEL1', 3) > 60, 'no gold handrail on the left of an EL tile');
  assert.ok(gold('intStairsER1', 12) > 60 || gold('intStairsER1', 13) > 60, 'no gold handrail on the right of an ER tile');
  assert.ok(gold('intStairsM1', 2) < 30 && gold('intStairsM1', 12) < 30, 'a plain tread tile must not have a rail');
  for (const t of ['intStairsEL0', 'intStairsER0']) assert.ok(tileInfo.tiles[NAMES.indexOf(t)].solid, `${t} must be solid (you do not walk up the flight)`);
  for (const t of ['intStairsFootM', 'intStairsFootWL', 'intStairsFootWR']) assert.equal(tileInfo.tiles[NAMES.indexOf(t)].solid, false, `${t} is the walkable foot slab`);
});

test('FB-0063: the stair art credits its pack: LimeZu Modern Interiors Free (stairs/handrails/lift doors), in CREDITS.md and asset-packs.md', () => {
  const credits = fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8');
  const packs = fs.readFileSync(path.join(ROOT, 'docs', 'research', 'asset-packs.md'), 'utf8');
  assert.match(credits, /stair/i, 'CREDITS.md does not mention the stair/lift crops');
  assert.match(packs, /P4b/, 'docs/research/asset-packs.md has no P4b stairs/lift entry');
});

// =====================================================================================================================
// FB-0061: the foyer staircase
// =====================================================================================================================

const G = maps['main-block-g'];
const gStairs = G.objects.find((o) => o.type === 'stairs' && o.name === 'Main Block Stairs G (up)');
const MIRROR = { EL: 'ER', ER: 'EL', WL: 'WR', WR: 'WL', LandL: 'LandR', LandR: 'LandL', WallL: 'WallR', WallR: 'WallL' };
const mirrorName = (n) => {
  const m = /^intStairs(EL|ER|WL|WR|LandL|LandR|WallL|WallR)([0-3]?)$/.exec(n);
  return m ? `intStairs${MIRROR[m[1]]}${m[2]}` : n; // plain treads (M) and the middle landing mirror to themselves
};

// the staircase's footprint: every stair-kit tile on the structures layer
const stairCells = [];
for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) { const n = nameAt(G, 'structures', x, y); if (n && /^intStairs/.test(n)) stairCells.push({ x, y, n }); }
const sMinX = Math.min(...stairCells.map((c) => c.x));
const sMaxX = Math.max(...stairCells.map((c) => c.x));
const sMinY = Math.min(...stairCells.map((c) => c.y));
const sMaxY = Math.max(...stairCells.map((c) => c.y));
const centre = (sMinX + sMaxX + 1) / 2; // an edge coordinate, like the foyer's own axis

test('FB-0061: the foyer staircase is built only from the new stair tiles: no old band tile is left anywhere on the ground floor', () => {
  assert.ok(stairCells.length >= 30, `expected a real staircase, found ${stairCells.length} stair tiles`);
  for (const layer of ['ground', 'structures']) {
    for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) {
      assert.ok(!OLD_STAIR_TILES.includes(nameAt(G, layer, x, y)), `old stair/lift tile ${nameAt(G, layer, x, y)} at (${x},${y}) on ${layer}`);
    }
  }
  // flight tiles, a landing, the wall between the upper flights, and the walkable foot slab
  assert.ok(stairCells.some((c) => FLIGHT_RE.test(c.n)));
  assert.ok(stairCells.some((c) => /^intStairsLand/.test(c.n)));
  assert.ok(stairCells.some((c) => /^intStairsWall/.test(c.n)));
});

test('FB-0061: the foyer staircase is symmetric about its own centre line: every tile has its mirror twin, rails included', () => {
  const at = new Map(stairCells.map((c) => [`${c.x},${c.y}`, c.n]));
  for (const c of stairCells) {
    const mx = sMinX + sMaxX - c.x;
    assert.equal(at.get(`${mx},${c.y}`), mirrorName(c.n), `(${c.x},${c.y}) ${c.n} has no mirror at (${mx},${c.y}): got ${at.get(`${mx},${c.y}`)}`);
  }
  // a handrail on BOTH outer edges of the wide lower flight, a stringer against the wall between the upper flights
  const topRow = stairCells.filter((c) => c.y === sMinY && FLIGHT_RE.test(c.n)).sort((a, b) => a.x - b.x);
  assert.deepEqual(topRow.map((c) => c.n.replace(/\d$/, '')), ['intStairsEL', 'intStairsWR', 'intStairsWL', 'intStairsER'], 'the two upper flights: a rail outside, a wall stringer inside');
  const footRow = stairCells.filter((c) => c.y === sMaxY && FLIGHT_RE.test(c.n)).sort((a, b) => a.x - b.x);
  assert.equal(footRow[0].n.replace(/\d$/, ''), 'intStairsEL');
  assert.equal(footRow[footRow.length - 1].n.replace(/\d$/, ''), 'intStairsER');
});

test('FB-0061: the foot opening is centred under the flight: the walkable foot slab, the two columns and the stairs object all sit on the staircase centre line', () => {
  const foot = [];
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) if (nameAt(G, 'ground', x, y) === 'intStairsFootM') foot.push({ x, y });
  assert.equal(foot.length, 2, 'the foyer foot slab is two tiles wide');
  assert.equal(foot[0].y, foot[1].y);
  assert.equal((foot[0].x + foot[1].x + 1) / 2, centre, `the foot opening (x ${foot[0].x}..${foot[1].x}) is not centred under the flight (centre ${centre})`);
  assert.ok(foot.every((f) => walkable(G, f.x, f.y)), 'the foot slab must be walkable');
  assert.ok(foot[0].y > sMaxY, 'the foot slab is below the lowest tread');
  // the stairs object stands on the slab and both of its tiles take her up (`cells` 2x1)
  assert.deepEqual(tileOf(gStairs), foot[0]);
  assert.equal(gStairs.props.cells, '2x1');
  // the two round columns frame the foot, mirrored about the same centre line
  const cols = [];
  for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) if (nameAt(G, 'structures', x, y) === 'intColumnShaftL') cols.push({ x, y });
  assert.equal(cols.length, 2);
  const xs = cols.map((c) => c.x).sort((a, b) => a - b);
  assert.equal((xs[0] + xs[1] + 2) / 2, centre, 'the two columns are not mirrored about the staircase centre line');
});

test('FB-0061: the foyer staircase says UP (a blue plate on the dark wall between the upper flights) and its wall tiles are solid', () => {
  const plate = stairCells.filter((c) => /^intStairsWall[LR]0$/.test(c.n));
  assert.equal(plate.length, 2, 'the UP plate is two tiles (the top row of the wall)');
  const { x0, y0 } = tilePx('intStairsWallL0');
  let blue = 0;
  for (let yy = 0; yy < 16; yy++) for (let xx = 0; xx < 16; xx++) { const i = ((y0 + yy) * png.width + x0 + xx) * 4; if (png.data[i + 2] > png.data[i] + 40) blue++; }
  assert.ok(blue >= 20, 'no blue sign plate on the top wall tile');
  for (const c of stairCells.filter((s) => s.y >= sMinY && s.y <= sMaxY)) assert.ok(!walkable(G, c.x, c.y), `stair tile ${c.n} at (${c.x},${c.y}) is walkable: she would walk up the flight`);
});

// =====================================================================================================================
// FB-0063: the stairwells on floors 1, 2 and 3
// =====================================================================================================================

// The exact stairs table (names, positions, destinations, facing, arrival tile): none of it moved.
const STAIRS_TABLE = [
  ['main-block-g', 'Main Block Stairs G (up)', 15, 25, 'main-block-1', 'Main Block Stairs 1 (down)', 'down', 15, 26],
  ['main-block-1', 'Main Block Stairs 1 (down)', 36, 17, 'main-block-g', 'Main Block Stairs G (up)', 'left', 35, 17],
  ['main-block-1', 'Main Block Stairs 1 (up)', 32, 17, 'main-block-2', 'Main Block Stairs 2 (down)', 'left', 31, 17],
  ['main-block-2', 'Main Block Stairs 2 (down)', 36, 17, 'main-block-1', 'Main Block Stairs 1 (up)', 'left', 35, 17],
  ['main-block-2', 'Main Block Stairs 2 (up)', 32, 17, 'main-block-3', 'Main Block Stairs 3 (down)', 'left', 31, 17],
  ['main-block-3', 'Main Block Stairs 3 (down)', 36, 17, 'main-block-2', 'Main Block Stairs 2 (up)', 'left', 35, 17],
];

test('FB-0063: nothing else changed in the stairs: every stairs object keeps its name, tile, destination, facing and arrival tile exactly', () => {
  const all = FLOORS.flatMap((key) => maps[key].objects.filter((o) => o.type === 'stairs').map((o) => ({ key, o })));
  assert.equal(all.length, STAIRS_TABLE.length, `expected ${STAIRS_TABLE.length} stairs objects, found ${all.length}`);
  for (const [key, name, x, y, to, toId, facing, ax, ay] of STAIRS_TABLE) {
    const found = all.find((s) => s.key === key && s.o.name === name);
    assert.ok(found, `${key} has no stairs "${name}"`);
    assert.deepEqual(tileOf(found.o), { x, y }, `${name} moved`);
    assert.equal(found.o.props.to, to);
    assert.equal(found.o.props.toId, toId);
    assert.equal(found.o.props.facing, facing);
    assert.deepEqual(arrivalOf(found.o), { x: ax, y: ay }, `the arrival tile of ${name} moved`);
    assert.ok(walkable(maps[key], ax, ay), `the arrival tile (${ax},${ay}) of ${name} is solid`);
    assert.ok(walkable(maps[key], x, y), `${name} stands on a solid tile`);
  }
});

for (const key of ['main-block-1', 'main-block-2', 'main-block-3']) {
  test(`FB-0063: ${key}'s stairwell is built from the stair tiles (alternating treads, a gold rail on the lane side, a wall stringer, UP/DOWN plates) and no old band tile is left`, () => {
    const m = maps[key];
    for (const layer of ['ground', 'structures']) {
      for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
        assert.ok(!OLD_STAIR_TILES.includes(nameAt(m, layer, x, y)), `${key}: old tile ${nameAt(m, layer, x, y)} at (${x},${y}) on ${layer}`);
      }
    }
    const hasUp = m.objects.some((o) => o.type === 'stairs' && /\(up\)$/.test(o.name));
    const hasDown = m.objects.some((o) => o.type === 'stairs' && /\(down\)$/.test(o.name));
    assert.ok(hasDown);
    const rows = [0, 1, 2, 3];
    if (hasUp) { // the left flight: x 31..32, y 13..16, rail on the lane (east) side
      rows.forEach((r) => {
        assert.equal(nameAt(m, 'structures', 31, 13 + r), `intStairsWL${r}`);
        assert.equal(nameAt(m, 'structures', 32, 13 + r), `intStairsER${r}`);
      });
      assert.equal(nameAt(m, 'ground', 31, 17), 'intStairsFootWL');
      assert.equal(nameAt(m, 'ground', 32, 17), 'intStairsFootM');
      assert.equal(nameAt(m, 'structures', 31, 12), 'intStairsSignUp');
    }
    if (hasDown) { // the right flight: x 35..36, rail on the lane (west) side
      rows.forEach((r) => {
        assert.equal(nameAt(m, 'structures', 35, 13 + r), `intStairsEL${r}`);
        assert.equal(nameAt(m, 'structures', 36, 13 + r), `intStairsWR${r}`);
      });
      assert.equal(nameAt(m, 'ground', 35, 17), 'intStairsFootM');
      assert.equal(nameAt(m, 'ground', 36, 17), 'intStairsFootWR');
      assert.equal(nameAt(m, 'structures', 36, 12), 'intStairsSignDown');
    }
    // the flights are solid, the foot slabs and the lane between are walkable (she reaches the objects)
    for (let y = 13; y <= 16; y++) for (const x of hasUp ? [31, 32] : []) assert.ok(!walkable(m, x, y), `${key}: flight tile (${x},${y}) is walkable`);
    for (let y = 13; y <= 16; y++) for (const x of hasDown ? [35, 36] : []) assert.ok(!walkable(m, x, y), `${key}: flight tile (${x},${y}) is walkable`);
    for (let x = 31; x <= 36; x++) assert.ok(walkable(m, x, 17), `${key}: the stairs row is blocked at (${x},17)`);
    assert.ok(walkable(m, 33, 14) && walkable(m, 34, 14), `${key}: the lane between the flights is blocked`);
  });
}

// =====================================================================================================================
// FB-0064 / FB-0069: the lift
// =====================================================================================================================

const LIFT_NAMES = { 'main-block-g': 'Main Block Lift G', 'main-block-1': 'Main Block Lift 1', 'main-block-2': 'Main Block Lift 2', 'main-block-3': 'Main Block Lift 3' };
const FLOOR_LABELS = ['Ground floor', '1st floor', '2nd floor', '3rd floor'];

// floor reachability from the map's own spawn (4-neighbour flood fill), to prove a lift never drops her into a sealed pocket
function reachableFrom(m, start) {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(m, nx, ny) || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

for (const key of FLOORS) {
  test(`${key === 'main-block-1' ? 'FB-0064' : 'FB-0069'}: ${key} has a working lift: stainless doors with an indicator lamp and a call plate, a \`lift\` object, a walkable front tile, a choice list of the other floors`, () => {
    const m = maps[key];
    const lifts = m.objects.filter((o) => o.type === 'lift');
    assert.equal(lifts.length, 1, `${key} should have exactly one lift`);
    const lift = lifts[0];
    assert.equal(lift.name, LIFT_NAMES[key]);
    assert.equal(lift.props.facing, 'down');
    assert.equal(lift.props.cells, '2x1');
    const { x, y } = tileOf(lift);
    // the doors are in the wall: the door art on both cells, the call plate beside them, all solid (nobody walks into the wall)
    assert.equal(nameAt(m, 'structures', x, y), 'intLiftDoorL');
    assert.equal(nameAt(m, 'structures', x + 1, y), 'intLiftDoorR');
    assert.equal(nameAt(m, 'structures', x + 2, y), 'intLiftPanel');
    for (const dx of [0, 1, 2]) assert.ok(!walkable(m, x + dx, y), `${key}: lift tile (${x + dx},${y}) is walkable`);
    // the open-door art for the door animation (the next package) exists, one tile per door cell
    const open = String(lift.props.openTiles).split(',').map((s) => s.trim());
    assert.deepEqual(open, ['intLiftOpenL', 'intLiftOpenR']);
    for (const n of open) assert.ok(NAMES.includes(n), `${key}: openTiles names "${n}", not a tile`);
    // the front of the doors is walkable on both cells, so she can stand in front of either leaf
    assert.ok(walkable(m, x, y + 1) && walkable(m, x + 1, y + 1), `${key}: the floor in front of the lift is blocked`);
    // the arrival tile: walkable, reachable from the spawn, not on an NPC, an ambient student, a key station or a stairs/door trigger
    const land = arrivalOf(lift);
    assert.deepEqual(land, { x, y: y + 1 });
    assert.ok(walkable(m, land.x, land.y));
    const spawn = m.objects.find((o) => o.type === 'spawn') || { x: land.x, y: land.y };
    assert.ok(reachableFrom(m, tileOf(spawn)).has(`${land.x},${land.y}`), `${key}: the lift's front tile is not reachable from the spawn`);
    const def = MAPS[key];
    const spots = [
      ...(def.npcs || []).map((n) => ({ id: n.id, x: n.x, y: n.y })),
      ...(def.keyStations || []).map((k) => ({ id: k.id, x: k.x, y: k.y })),
      ...(AMBIENT[key] || []).flatMap((a) => (a.kind === 'patrol' ? a.waypoints : [{ x: a.x, y: a.y }]).map((p) => ({ id: a.id, x: p.x, y: p.y }))),
    ];
    for (const s of spots) assert.ok(s.x !== land.x || s.y !== land.y, `${key}: ${s.id} stands on the lift's arrival tile`);
    for (const s of spots.filter((p) => p.id.startsWith('mb') )) assert.ok(Math.hypot(s.x - land.x, s.y - land.y) >= 2, `${key}: ${s.id} stands right next to the lift's front tile`);
    for (const o of m.objects.filter((w) => (w.type === 'door' || w.type === 'stairs') && w.props.to)) {
      assert.ok(tileOf(o).x !== land.x || tileOf(o).y !== land.y, `${key}: the lift's front tile is on the ${o.name} trigger`);
    }
  });

  test(`${key === 'main-block-1' ? 'FB-0064' : 'FB-0069'}: the lift on ${key} offers every OTHER floor and "Never mind", and each choice warps to a valid, walkable lift front tile on that floor`, () => {
    const lift = MAPS[key].lift;
    assert.ok(lift, `${key}'s map def has no \`lift\` data`);
    const entries = liftDialog(lift, key);
    const main = entries[entries.length - 1];
    assert.equal(main.id, 'lift');
    assert.equal(main.lines[0], 'Which floor?');
    const wanted = FLOORS.filter((f) => f !== key).map((f) => FLOOR_LABELS[FLOORS.indexOf(f)]);
    assert.deepEqual(plain(main.choices.map((c) => c.text)), [...wanted, 'Never mind']);
    assert.equal(main.choices[main.choices.length - 1].actions, undefined, '"Never mind" must do nothing');
    for (const choice of main.choices.slice(0, -1)) {
      assert.equal(choice.actions.length, 1);
      const { to, spawnAt } = choice.actions[0].warp;
      assert.notEqual(to, key, 'a lift never offers the floor she is on');
      assert.ok(maps[to], `${choice.text} warps to unknown map ${to}`);
      assert.equal(spawnAt, LIFT_NAMES[to]);
      const dest = maps[to].objects.find((o) => o.name === spawnAt && o.type === 'lift');
      assert.ok(dest, `${to} has no lift object "${spawnAt}"`);
      const land = arrivalOf(dest);
      assert.ok(walkable(maps[to], land.x, land.y), `${choice.text}: arrives on a solid tile (${land.x},${land.y}) of ${to}`);
      const spawn = maps[to].objects.find((o) => o.type === 'spawn');
      assert.ok(reachableFrom(maps[to], tileOf(spawn)).has(`${land.x},${land.y}`), `${choice.text}: lands in a pocket not reachable from ${to}'s spawn`);
    }
  });
}

test('FB-0069: every lift choice is the dialog `warp` action, which asks for the warp with its map and the target lift', () => {
  const seen = [];
  gameEvents.on('warp:requested', (payload) => seen.push(payload));
  const state = { flags: {}, quest: { stage: 'hunting', keys: {} }, inventory: { slots: [] }, seenDialog: new Set() };
  applyDialogActions([{ warp: { to: 'main-block-3', spawnAt: 'Main Block Lift 3' } }], state);
  assert.deepEqual(JSON.parse(JSON.stringify(seen)), [{ to: 'main-block-3', spawnAt: 'Main Block Lift 3' }]);
});

test('FB-0069: the lift never skips a lock: before the LUG volunteer has set the task it only says it is switched off; afterwards it offers the floors; rooms keep their own door locks', () => {
  const entries = liftDialog(MAPS['main-block-g'].lift, 'main-block-g');
  const npc = { id: 'lift:Main Block Lift G', dialog: entries };
  const state = (stage) => ({ flags: {}, quest: { stage, keys: {} }, inventory: { slots: [] }, seenDialog: new Set() });
  const locked = pickDialogEntry(npc, state('arrival')).entry;
  assert.equal(locked.choices, undefined, 'the lift offers floors before the hunt has been given');
  assert.match(locked.lines[0], /LUG volunteer/);
  for (const stage of ['hunting', 'rewarded']) {
    const open = pickDialogEntry(npc, state(stage)).entry;
    assert.equal(open.id, 'lift');
    assert.ok(open.choices.length >= 4);
  }
  // the ground-floor stairs are locked by the same stages, and every room door is still locked or closed
  const stairsRule = MAPS['main-block-g'].doorLocks.find((r) => r.match === 'Main Block Stairs G (up)');
  assert.deepEqual(plain(MAPS['main-block-g'].lift.lockedStages), ['arrival']);
  assert.deepEqual(plain(stairsRule.stages), ['hunting', 'rewarded']);
  for (const o of maps['main-block-g'].objects.filter((x) => x.type === 'door' && !x.props.to)) assert.equal(o.props.closed, true, `${o.name} lost its closed flag`);
});

test('FB-0064: no lift is a dead decoration any more: the old `intLift` tile is gone and every lift door tile has a lift object on it', () => {
  for (const key of FLOORS) {
    const m = maps[key];
    const objs = m.objects.filter((o) => o.type === 'lift').map(tileOf);
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const n = nameAt(m, 'structures', x, y);
      assert.notEqual(n, 'intLift', `${key}: the decorative lift tile is still at (${x},${y})`);
      if (n === 'intLiftDoorL') assert.ok(objs.some((o) => o.x === x && o.y === y), `${key}: lift doors at (${x},${y}) have no \`lift\` object: a dead decoration`);
    }
  }
});

test('FB-0064: the engine wires the lift: E at a lift (createLifts/nearestInteractable), the floor choice warps with the stairs fade, the ding plays on arrival, UIScene relays the warp action', () => {
  const world = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  assert.match(world, /createLifts\(\) \{/);
  assert.match(world, /this\.createLifts\(\);/);
  assert.match(world, /consider\('lift', 'lift', lift, lift\.def\)/);
  assert.match(world, /warpTo\(\{ to, spawnAt \}\) \{/);
  assert.match(world, /this\.cameras\.main\.fadeOut\(250, 0, 0, 0\);\r?\n\s+this\.cameras\.main\.once\('camerafadeoutcomplete', \(\) => \{\r?\n\s+this\.scene\.restart\(\{ map: to, spawnAt, viaWarpKind: 'lift' \}\);/);
  assert.match(world, /if \(this\.viaWarpKind === 'lift'\) AudioManager\.play\('liftDing'\);/);
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'ui.js'), 'utf8');
  assert.match(ui, /game\.events\.on\('warp:requested', this\.onWarpRequested\)/);
  assert.match(ui, /game\.events\.off\('warp:requested', this\.onWarpRequested\)/);
  assert.match(ui, /world\.warpTo\(payload\)/);
});

test('FB-0064: the lift ding is a registered sound whose synthesized file exists', () => {
  assert.ok(SOUNDS.liftDing, 'no liftDing in SOUNDS');
  assert.equal(SOUNDS.liftDing.category, 'sfx');
  const file = path.join(ROOT, SOUNDS.liftDing.file);
  assert.ok(fs.existsSync(file), `${SOUNDS.liftDing.file} is missing (npm run audio)`);
  assert.equal(fs.readFileSync(file).toString('ascii', 0, 4), 'RIFF');
  assert.match(fs.readFileSync(path.join(ROOT, 'tools', 'make-audio.js'), 'utf8'), /generated\/lift-ding\.wav/);
});

test('FB-0069: the volunteer no longer claims the lift is just for show', () => {
  const story = fs.readFileSync(path.join(ROOT, 'src', 'story.js'), 'utf8');
  assert.ok(!/just for show/.test(story), 'the volunteer still says the lift is just for show');
});
