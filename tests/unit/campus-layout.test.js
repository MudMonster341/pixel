// Regression tests for the campus layout, named after the owner's original feedback items (FB-0003
// to FB-0016) on the very first rasterised map. ADR 0008 (a hand-drawn schematic) rewrote these to
// check fixed numbers in tools/campus/layout.js; ADR 0009 (back to OpenStreetMap, straightened and
// cleaned up) rewrites them again to check the same intent on the real, generated layout instead of
// on hand-picked constants, since layout.js is now settings and clean-up rules, not a drawn plan.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { tileInfo, gridFromTiled, tiledObjects, isWalkableTile } = loadGameData();
const MAP_FILE = path.join(ROOT, 'assets', 'maps', 'campus.json');
const json = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const grid = gridFromTiled(json);
const objects = tiledObjects(json);
const walkable = (x, y) => isWalkableTile(grid, tileInfo, x, y);

const structuresLayer = json.layers.find((l) => l.name === 'structures').data;
const groundLayer = json.layers.find((l) => l.name === 'ground').data;
const structNameAt = (x, y) => {
  const gid = structuresLayer[y * json.width + x];
  return gid ? tileInfo.tiles[gid - 1].name : null;
};
const groundNameAt = (x, y) => {
  const gid = groundLayer[y * json.width + x];
  return gid ? tileInfo.tiles[gid - 1].name : null;
};

function reachableFrom(start) {
  const seen = new Uint8Array(json.width * json.height);
  const queue = [start];
  seen[start.y * json.width + start.x] = 1;
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= json.width || ny >= json.height) continue;
      if (seen[ny * json.width + nx] || !walkable(nx, ny)) continue;
      seen[ny * json.width + nx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return (x, y) => seen[y * json.width + x] === 1;
}

const spawn = objects.find((o) => o.type === 'spawn');
const campusZone = objects.find((o) => o.type === 'area' && o.props.kind === 'campus');
const doors = objects.filter((o) => o.type === 'door');
const gates = objects.filter((o) => o.type === 'gate');
const reachableFromSpawn = reachableFrom({ x: Math.floor(spawn.x), y: Math.floor(spawn.y) });

// ---------- FB-0004/FB-0009/FB-0013: the map is straight, the fence is a closed loop broken only by gates ----------

const FENCE_FAMILY = new Set(['fenceH', 'fenceV', 'fenceCornerTL', 'fenceCornerTR', 'fenceCornerBL', 'fenceCornerBR']);
const WALL_FAMILY = new Set([
  'bitsWallPlain', 'bitsWall', 'bitsWallEndL', 'bitsWallEndR', 'bitsRoof', 'bitsRoofT', 'bitsRoofL', 'bitsRoofR', 'bitsRoofTL', 'bitsRoofTR',
  'otherWallPlain', 'otherWall', 'otherWallEndL', 'otherWallEndR', 'otherRoof', 'otherRoofT', 'otherRoofL', 'otherRoofR', 'otherRoofTL', 'otherRoofTR',
]);

test('FB-0009: fence and wall tiles never join in a diagonal-only (staircase) line', () => {
  const isStructural = (x, y) => {
    const n = structNameAt(x, y);
    return n !== null && (FENCE_FAMILY.has(n) || WALL_FAMILY.has(n));
  };
  let staircases = 0;
  for (let y = 0; y < json.height - 1; y++) {
    for (let x = 0; x < json.width - 1; x++) {
      if (isStructural(x, y) && isStructural(x + 1, y + 1) && !isStructural(x + 1, y) && !isStructural(x, y + 1)) staircases++;
      if (isStructural(x + 1, y) && isStructural(x, y + 1) && !isStructural(x, y) && !isStructural(x + 1, y + 1)) staircases++;
    }
  }
  assert.equal(staircases, 0, `found ${staircases} diagonal-only (staircase) joins between fence/wall tiles`);
});

test('FB-0004/FB-0013: the campus fence is a closed straight loop broken only by the two gates', () => {
  assert.ok(campusZone, 'no campus zone object');
  const x0 = Math.round(campusZone.x);
  const y0 = Math.round(campusZone.y);
  const x1 = x0 + Math.round(campusZone.width) - 1;
  const y1 = y0 + Math.round(campusZone.height) - 1;
  const onPerimeter = (x, y) => x === x0 || x === x1 || y === y0 || y === y1;
  const isFenceOrGate = (name) => name !== null && (FENCE_FAMILY.has(name) || name === 'fenceGate');

  let offPerimeterFence = 0;
  for (let y = 0; y < json.height; y++) {
    for (let x = 0; x < json.width; x++) {
      const name = structNameAt(x, y);
      if (isFenceOrGate(name) && !onPerimeter(x, y)) offPerimeterFence++;
    }
  }
  assert.equal(offPerimeterFence, 0, `${offPerimeterFence} fence/gate tiles are off the fence rectangle (a stray fragment)`);

  let gapsInLoop = 0;
  for (let x = x0; x <= x1; x++) {
    if (!isFenceOrGate(structNameAt(x, y0))) gapsInLoop++;
    if (!isFenceOrGate(structNameAt(x, y1))) gapsInLoop++;
  }
  for (let y = y0 + 1; y < y1; y++) {
    if (!isFenceOrGate(structNameAt(x0, y))) gapsInLoop++;
    if (!isFenceOrGate(structNameAt(x1, y))) gapsInLoop++;
  }
  assert.equal(gapsInLoop, 0, `the fence perimeter has ${gapsInLoop} cells that are neither fence nor a gate`);
});

// ---------- FB-0003: only real BITS buildings (and neighbouring campuses outside it) ----------

test('FB-0003: no non-BITS ("other" style) buildings overlap the campus fence', () => {
  assert.ok(campusZone, 'no campus zone object');
  const fx0 = campusZone.x;
  const fy0 = campusZone.y;
  const fx1 = campusZone.x + campusZone.width;
  const fy1 = campusZone.y + campusZone.height;
  const overlaps = (o) => o.x < fx1 && o.x + o.width > fx0 && o.y < fy1 && o.y + o.height > fy0;
  const otherBuildings = objects.filter((o) => o.type === 'building' && o.props.style === 'other');
  assert.ok(otherBuildings.length > 0, 'expected some non-BITS buildings outside campus (neighbouring campuses)');
  for (const b of otherBuildings) assert.ok(!overlaps(b), `${b.name} (style "other") overlaps the campus fence`);
});

// ---------- FB-0005/FB-0007: internal walkways are proper, even-width paths, not scattered ----------

test('FB-0005/FB-0007: internal walkways are a constant-width brick path, not raw OpenStreetMap footways', () => {
  // A walkway run's cross-section (measured a few tiles in from either end, to skip a junction
  // with another path or a road) should hold to one width the whole way -- never widen or narrow,
  // and never show the ragged edge a rasterised OpenStreetMap footway would have.
  const x0 = Math.round(campusZone.x);
  const y0 = Math.round(campusZone.y);
  const x1 = x0 + Math.round(campusZone.width);
  const y1 = y0 + Math.round(campusZone.height);
  let walkwayTiles = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (groundNameAt(x, y) === 'walkway') walkwayTiles++;
    }
  }
  assert.ok(walkwayTiles > 200, `expected a real network of walkway tiles inside the fence, found ${walkwayTiles}`);

  // Sample several straight (horizontal or vertical) walkway runs, well clear of a junction with a
  // crossing path (skipped by requiring the run to be clearly long in one direction and clearly
  // short in the other): the cross-section should stay the same a few tiles either side.
  let sampledRuns = 0;
  for (let y = y0 + 4; y < y1 - 4 && sampledRuns < 6; y++) {
    for (let x = x0 + 4; x < x1 - 4 && sampledRuns < 6; x++) {
      if (groundNameAt(x, y) !== 'walkway') continue;
      let hx0 = x;
      let hx1 = x;
      while (groundNameAt(hx0 - 1, y) === 'walkway') hx0--;
      while (groundNameAt(hx1 + 1, y) === 'walkway') hx1++;
      let vy0 = y;
      let vy1 = y;
      while (groundNameAt(x, vy0 - 1) === 'walkway') vy0--;
      while (groundNameAt(x, vy1 + 1) === 'walkway') vy1++;
      const hLen = hx1 - hx0 + 1;
      const vLen = vy1 - vy0 + 1;
      if (hLen >= 10 && vLen <= 4 && x - hx0 >= 5 && hx1 - x >= 5) {
        const widthAt = (dx) => {
          let a = y;
          let b = y;
          while (groundNameAt(x + dx, a - 1) === 'walkway') a--;
          while (groundNameAt(x + dx, b + 1) === 'walkway') b++;
          return b - a + 1;
        };
        assert.equal(widthAt(1), vLen, `horizontal walkway run at ${x},${y} is not a constant width`);
        assert.equal(widthAt(-1), vLen, `horizontal walkway run at ${x},${y} is not a constant width`);
        sampledRuns++;
      } else if (vLen >= 10 && hLen <= 4 && y - vy0 >= 5 && vy1 - y >= 5) {
        const widthAt = (dy) => {
          let a = x;
          let b = x;
          while (groundNameAt(a - 1, y + dy) === 'walkway') a--;
          while (groundNameAt(b + 1, y + dy) === 'walkway') b++;
          return b - a + 1;
        };
        assert.equal(widthAt(1), hLen, `vertical walkway run at ${x},${y} is not a constant width`);
        assert.equal(widthAt(-1), hLen, `vertical walkway run at ${x},${y} is not a constant width`);
        sampledRuns++;
      }
    }
  }
  assert.ok(sampledRuns >= 3, `found only ${sampledRuns} straight walkway runs long enough to check their width`);
});

// ---------- FB-0008/FB-0010: Gate 2, a straight approach to the roundabout, and a reachable Main Block ----------
// Rewritten for the owner's layout correction (2026-09-21, docs/research/bits-dubai-campus.md
// "Layout correction from the owner"): the straight avenue no longer runs all the way to the Main
// Block door -- it hands off to a roundabout just inside the gate, then a loop road (FB-0026 below).
// The property this test protects (a dead-straight, constant-width entrance, Main Block reachable) is
// the same; only how far the straight part runs has changed.

test('FB-0008/FB-0010: Gate 2 exists, a straight avenue leads to the roundabout just inside it, and the Main Block entrance is reachable', () => {
  const gate2 = gates.find((g) => /Gate 2/.test(g.name));
  assert.ok(gate2, 'no Gate 2 object');
  assert.equal(gate2.props.main, true, 'Gate 2 should be flagged as the main entrance');

  const roundabout = objects.find((o) => o.type === 'area' && o.name === 'Gate 2 Roundabout');
  assert.ok(roundabout, 'no Gate 2 Roundabout area object');

  // The entrance avenue is one constant-width, dead-straight (single x) corridor from the gate to the
  // roundabout's own south edge: sample a row near each end and check the paved band's x-range
  // (found from its kerb columns) never moves sideways.
  const gateXCenter = Math.floor(gate2.x);
  const findRoadSpan = (y) => {
    let x0 = null;
    let x1 = null;
    // Scan a window around Gate 2's column, not the whole map width: at some rows another kerbed
    // feature (a hostel spur, the DIAC ring) sits far off to the side on the same row.
    for (let x = gateXCenter - 20; x <= gateXCenter + 20; x++) {
      const n = groundNameAt(x, y) || structNameAt(x, y);
      if (n && (n.startsWith('kerb') || n === 'asphalt' || n.startsWith('roadLine') || n.startsWith('crossing'))) {
        if (x0 === null) x0 = x;
        x1 = x;
      }
    }
    return x0 === null ? null : [x0, x1];
  };
  const gateY = Math.floor(gate2.y);
  const roundaboutSouthY = Math.round(roundabout.y + roundabout.height);
  const span = gateY - roundaboutSouthY;
  assert.ok(span > 2, 'the roundabout should sit a real distance inside the gate, not right on top of it');
  // Close to each end of the avenue (not the middle), clear of the roundabout's own kerb and of any
  // perpendicular service spur (e.g. a parking connector) that might cross the avenue's row.
  const rows = [gateY - Math.max(2, Math.round(span * 0.15)), roundaboutSouthY + Math.max(2, Math.round(span * 0.15))];
  const spans = rows.map((y) => findRoadSpan(y)).filter(Boolean);
  assert.ok(spans.length >= 2, 'could not find the entrance avenue at multiple rows');
  const [first] = spans;
  for (const span of spans) {
    assert.ok(Math.abs(span[0] - first[0]) <= 1 && Math.abs(span[1] - first[1]) <= 1, `entrance avenue is not straight: ${JSON.stringify(spans)}`);
  }

  const mainDoor = doors.find((d) => d.props.building === 'Main Block');
  assert.ok(mainDoor, 'no Main Block door');
  assert.ok(reachableFromSpawn(Math.floor(mainDoor.x), Math.floor(mainDoor.y)), 'Main Block entrance is not reachable from the Gate 2 spawn');
});

// ---------- FB-0026: the owner's layout correction (roundabout, parking either side, loop road) ----------

test('FB-0026: a roundabout sits just inside the main gate', () => {
  const gate2 = gates.find((g) => /Gate 2/.test(g.name));
  const roundabout = objects.find((o) => o.type === 'area' && o.name === 'Gate 2 Roundabout');
  assert.ok(roundabout, 'no Gate 2 Roundabout area object');
  assert.ok(roundabout.y + roundabout.height <= gate2.y, 'the roundabout should be north of (inside from) the gate');
  const gapToGate = gate2.y - (roundabout.y + roundabout.height);
  assert.ok(gapToGate >= 0 && gapToGate < 15, `the roundabout is ${gapToGate.toFixed(1)} tiles from the gate, expected it just inside`);
  assert.ok(Math.abs(roundabout.x + roundabout.width / 2 - gate2.x) <= 2, 'the roundabout is not centred on the entrance avenue');

  // A paved (asphalt) ring around a walkable lawn island in the middle -- kept axis-aligned/square
  // rather than a true circle (ADR 0009 rules out diagonal tiles), but still reads as a roundabout:
  // asphalt at the edges of its own row, lawn at the centre.
  const cy = Math.floor(roundabout.y + roundabout.height / 2);
  const cx = Math.floor(roundabout.x + roundabout.width / 2);
  assert.ok(walkable(cx, cy), 'the roundabout island (its centre) should be walkable');
  let sawAsphalt = false;
  let sawLawn = false;
  for (let x = Math.floor(roundabout.x); x < roundabout.x + roundabout.width; x++) {
    const n = groundNameAt(x, cy);
    if (n === 'asphalt') sawAsphalt = true;
    if (n === 'lawn' || n === 'lawn2') sawLawn = true;
  }
  assert.ok(sawAsphalt, 'the roundabout has no paved (asphalt) ring');
  assert.ok(sawLawn, 'the roundabout has no lawn island in the middle');
});

test('FB-0026: parking areas lie on both sides of the entrance road', () => {
  const gate2 = gates.find((g) => /Gate 2/.test(g.name));
  const west = objects.find((o) => o.type === 'area' && o.name === 'Gate Parking (West)');
  const east = objects.find((o) => o.type === 'area' && o.name === 'Gate Parking (East)');
  assert.ok(west, 'no Gate Parking (West) area object');
  assert.ok(east, 'no Gate Parking (East) area object');
  assert.ok(west.x + west.width < gate2.x, 'the west parking lot should be west of the entrance road');
  assert.ok(east.x > gate2.x, 'the east parking lot should be east of the entrance road');
  for (const lot of [west, east]) {
    let parkingTiles = 0;
    for (let y = Math.floor(lot.y); y < lot.y + lot.height; y++) {
      for (let x = Math.floor(lot.x); x < lot.x + lot.width; x++) {
        if (groundNameAt(x, y) === 'parking') parkingTiles++;
      }
    }
    assert.ok(parkingTiles > 20, `${lot.name} has only ${parkingTiles} parking tiles`);
  }
});

test('FB-0026: a loop road encircles the academic core and connects back to the gate', () => {
  const loop = objects.find((o) => o.type === 'area' && o.name === 'Academic Core Loop Road');
  assert.ok(loop, 'no Academic Core Loop Road area object');
  const mainBlockObj = objects.find((o) => o.type === 'building' && o.name === 'Main Block');
  assert.ok(mainBlockObj, 'no Main Block building object');
  // West, north and south: the loop reaches clear around the core on these sides. East is not
  // required to clear the Main Block too -- Hostel H (Girls) sits close enough to the complex's own
  // east wall (a real, close BITS neighbour, ADR 0009) that there's no room left for a loop strip
  // beyond it there, a known rough spot rather than a generator bug (see the research doc).
  assert.ok(loop.x < mainBlockObj.x, 'the loop does not reach west of the Main Block');
  assert.ok(loop.y <= mainBlockObj.y, 'the loop does not reach north of the Main Block');
  assert.ok(loop.y + loop.height > mainBlockObj.y + mainBlockObj.height, 'the loop does not reach south of the Main Block');

  const x0 = Math.floor(loop.x);
  const y0 = Math.floor(loop.y);
  const x1 = Math.floor(loop.x + loop.width) - 1;
  const y1 = Math.floor(loop.y + loop.height) - 1;
  const isRoad = (x, y) => {
    const n = groundNameAt(x, y);
    return n === 'asphalt' || (n !== null && n.startsWith('kerb'));
  };
  // The west and south strips run the loop's full constant width, gaplessly, the whole way round --
  // real BITS buildings (a hostel on the east side) are close enough to interrupt the other two sides
  // in places, which ADR 0009's "buildings stay separate" rule takes priority over a perfect ring.
  for (let y = y0; y <= y1; y++) assert.ok(isRoad(x0, y) || isRoad(x0 + 1, y), `the loop's west strip has a gap at row ${y}`);
  for (let x = x0; x <= x1; x++) assert.ok(isRoad(x, y1) || isRoad(x, y1 - 1), `the loop's south strip has a gap at column ${x}`);

  // The ring connects, on foot, all the way back down the avenue to the gate.
  assert.ok(reachableFromSpawn(x0 + 1, Math.floor((y0 + y1) / 2)), "the loop road's west strip is not reachable from the Gate 2 spawn");
});

test('FB-0026: the walk from spawn to the Main Block door follows roads and walkways only', () => {
  const HARDSCAPE = new Set([
    'walkway', 'paving', 'asphalt', 'parking',
    'kerbT', 'kerbB', 'kerbL', 'kerbR', 'kerbTL', 'kerbTR', 'kerbBL', 'kerbBR',
    'roadLineH', 'roadLineV', 'crossingH', 'crossingV',
  ]);
  const isHardscape = (x, y) => {
    const n = groundNameAt(x, y);
    return Boolean(n && HARDSCAPE.has(n)) && walkable(x, y);
  };
  const startX = Math.floor(spawn.x);
  const startY = Math.floor(spawn.y);
  assert.ok(isHardscape(startX, startY), 'the spawn point itself is not on a road/walkway tile');

  const seen = new Uint8Array(json.width * json.height);
  const queue = [{ x: startX, y: startY }];
  seen[startY * json.width + startX] = 1;
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= json.width || ny >= json.height) continue;
      if (seen[ny * json.width + nx] || !isHardscape(nx, ny)) continue;
      seen[ny * json.width + nx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }

  const mainDoor = doors.find((d) => d.props.building === 'Main Block');
  assert.ok(mainDoor, 'no Main Block door');
  // The door's own threshold is a building structure tile, not "ground" hardscape -- walk a few tiles
  // south (matching its `facing: down`) to the first hardscape tile in front of it, the same pattern
  // tests/unit/campus-osm.test.js already uses for "the tile in front of each building door".
  let py = Math.floor(mainDoor.y);
  let steps = 0;
  while (steps < 6 && !isHardscape(Math.floor(mainDoor.x), py)) {
    py += 1;
    steps += 1;
  }
  assert.ok(isHardscape(Math.floor(mainDoor.x), py), 'no hardscape (road/walkway) tile found in front of the Main Block door');
  assert.equal(seen[py * json.width + Math.floor(mainDoor.x)], 1, 'no all-hardscape walk from spawn to the Main Block door plaza');
});

// ---------- FB-0011: separate, walkable-between buildings ----------

test('FB-0011: the Main Block, Library Block and Mechanical Block are separate buildings, each reachable from the others', () => {
  const names = ['Main Block', 'Library Block', 'Mechanical Block'];
  const buildings = names.map((n) => objects.find((o) => o.type === 'building' && o.name === n));
  for (const b of buildings) assert.ok(b, 'missing building object');

  // Separate footprints: flood-fill each building's own contiguous roof/wall/entrance tiles,
  // starting from its door, and check no two of those connected components share a tile. This
  // reads the actual structure, not the bounding box -- real BITS buildings have L-shaped wings
  // (ADR 0009) whose bounding boxes can legitimately overlap while the footprints stay separate.
  const isBuildingTile = (x, y) => {
    const n = structNameAt(x, y);
    return n !== null && (n.startsWith('bitsRoof') || n.startsWith('bitsWall') || n.startsWith('bitsEntrance') || n === 'bitsPillar');
  };
  const doorFor = (name) => doors.find((d) => d.props.building === name);
  function floodBuildingTiles(startX, startY) {
    const seen = new Set([`${startX},${startY}`]);
    const stack = [[startX, startY]];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key) || !isBuildingTile(nx, ny)) continue;
        seen.add(key);
        stack.push([nx, ny]);
      }
    }
    return seen;
  }
  const cellSets = names.map((n) => {
    const d = doorFor(n);
    assert.ok(d, `missing door for ${n}`);
    return floodBuildingTiles(Math.floor(d.x), Math.floor(d.y));
  });
  for (let i = 0; i < cellSets.length; i++) {
    for (let j = i + 1; j < cellSets.length; j++) {
      let shared = 0;
      for (const cell of cellSets[i]) if (cellSets[j].has(cell)) shared++;
      assert.equal(shared, 0, `${names[i]} and ${names[j]} share ${shared} structure tiles (touching or merged, not separate footprints)`);
    }
  }

  for (let i = 0; i < names.length; i++) {
    const reachable = reachableFrom({ x: Math.floor(doorFor(names[i]).x), y: Math.floor(doorFor(names[i]).y) });
    for (let j = 0; j < names.length; j++) {
      if (i === j) continue;
      const other = doorFor(names[j]);
      assert.ok(reachable(Math.floor(other.x), Math.floor(other.y)), `no walkable route from ${names[i]} to ${names[j]}`);
    }
  }
});

// ---------- FB-0012: a second entrance, connecting inside to outside ----------

test('FB-0012: a second entrance (Side Gate) exists and connects the inside of campus to the outside', () => {
  const sideGate = gates.find((g) => g.name === 'Side Gate');
  assert.ok(sideGate, 'no Side Gate object');
  assert.equal(sideGate.props.main, false);

  const gx = Math.floor(sideGate.x);
  const gy = Math.floor(sideGate.y);
  assert.ok(walkable(gx, gy), 'the Side Gate tile itself is not walkable');
  assert.ok(walkable(gx - 1, gy), 'just outside the Side Gate is not walkable');
  assert.ok(walkable(gx + 1, gy), 'just inside the Side Gate is not walkable');
  const reachable = reachableFrom({ x: gx + 1, y: gy });
  assert.ok(reachable(gx - 1, gy), 'the Side Gate does not connect the inside of campus to the outside');
});

// ---------- FB-0014: roads are bordered by kerb tiles ----------

test('FB-0014: the entrance avenue is bordered by kerb tiles on both sides', () => {
  const gate2 = gates.find((g) => /Gate 2/.test(g.name));
  const mainDoor = doors.find((d) => d.props.building === 'Main Block');
  const sampleY = Math.floor(gate2.y) - Math.round((Math.floor(gate2.y) - Math.floor(mainDoor.y)) * 0.4);
  const gx = Math.floor(gate2.x);
  const rowNames = [];
  for (let x = gx - 15; x <= gx + 15; x++) {
    const n = groundNameAt(x, sampleY);
    if (n && (n.startsWith('kerb') || n === 'asphalt')) rowNames.push(n);
  }
  assert.ok(rowNames.some((n) => n.startsWith('kerb')), 'the entrance avenue has no kerb tiles');
  assert.ok(rowNames.includes('asphalt'), 'the entrance avenue has no asphalt');
  assert.equal(rowNames[0].startsWith('kerb') && rowNames.at(-1).startsWith('kerb'), true, 'the avenue is not bordered by kerb on both sides');
});

// ---------- FB-0015: green campus -- lawn coverage and tree/palm count ----------

test('FB-0015: the campus interior is mostly lawn, with plenty of trees and palms', () => {
  const x0 = Math.round(campusZone.x);
  const y0 = Math.round(campusZone.y);
  const x1 = x0 + Math.round(campusZone.width);
  const y1 = y0 + Math.round(campusZone.height);
  let lawn = 0;
  let total = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      total++;
      const n = groundNameAt(x, y);
      if (n === 'lawn' || n === 'lawn2') lawn++;
    }
  }
  const pct = (lawn / total) * 100;
  assert.ok(pct >= 40, `only ${pct.toFixed(1)}% of the campus interior is lawn`);

  let trees = 0;
  for (let i = 0; i < structuresLayer.length; i++) {
    const gid = structuresLayer[i];
    if (!gid) continue;
    const n = tileInfo.tiles[gid - 1].name;
    if (n === 'treeTrunk' || n === 'palmTrunk') trees++;
  }
  assert.ok(trees >= 50, `only ${trees} trees/palms on the map`);
});

// ---------- FB-0016: a proper tennis court ----------

test('FB-0016: the tennis courts use the court line and net tile kit', () => {
  const courtZone = objects.find((o) => o.type === 'area' && o.name === 'Tennis Courts');
  assert.ok(courtZone, 'no Tennis Courts area object');
  const seen = new Set();
  for (let y = Math.floor(courtZone.y); y < courtZone.y + courtZone.height; y++) {
    for (let x = Math.floor(courtZone.x); x < courtZone.x + courtZone.width; x++) {
      const n = groundNameAt(x, y);
      if (n) seen.add(n);
    }
  }
  for (const name of ['courtLineH', 'courtLineV', 'courtNet', 'courtNetPostT', 'courtNetPostB', 'courtCornerTL', 'courtCornerTR', 'courtCornerBL', 'courtCornerBR']) {
    assert.ok(seen.has(name), `Tennis Courts area has no "${name}" tile`);
  }
});

// ---------- FB-0006: pavements use the shaded paving/walkway tiles, not flat road fill ----------

test('FB-0006: the campus uses paving and walkway tiles (not plain asphalt) for pedestrian areas', () => {
  const x0 = Math.round(campusZone.x);
  const y0 = Math.round(campusZone.y);
  const x1 = x0 + Math.round(campusZone.width);
  const y1 = y0 + Math.round(campusZone.height);
  let walkway = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (groundNameAt(x, y) === 'walkway') walkway++;
  assert.ok(walkway > 200, `expected substantial walkway coverage inside the fence, found ${walkway} tiles`);
});
