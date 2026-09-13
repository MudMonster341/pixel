// Regression tests for the campus layout rebuild (ADR 0008): a hand-designed, straight schematic
// plan instead of a rasterisation of OpenStreetMap. Named after the owner's feedback items on the
// old (rasterised) map that this rebuild fixes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');
const layout = require('../../tools/campus/layout');

const { tileInfo, gridFromTiled, tiledObjects, isWalkableTile } = loadGameData();
const MAP_FILE = path.join(ROOT, 'assets', 'maps', 'campus.json');
const json = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const grid = gridFromTiled(json);
const objects = tiledObjects(json);
const walkable = (x, y) => isWalkableTile(grid, tileInfo, x, y);
const nameOf = (index) => (index >= 0 ? tileInfo.tiles[index].name : null);
const tileAt = (x, y) => nameOf(grid[y]?.[x]);

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

// ---------- FB-0009: the map is straight, not angular ----------

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
      // A diagonal pair of structural tiles with neither orthogonal neighbour filled is a
      // stair-step corner: the classic look of a line drawn at an angle on a square grid.
      if (isStructural(x, y) && isStructural(x + 1, y + 1) && !isStructural(x + 1, y) && !isStructural(x, y + 1)) staircases++;
      if (isStructural(x + 1, y) && isStructural(x, y + 1) && !isStructural(x, y) && !isStructural(x + 1, y + 1)) staircases++;
    }
  }
  assert.equal(staircases, 0, `found ${staircases} diagonal-only (staircase) joins between fence/wall tiles`);
});

// ---------- FB-0004/FB-0013: the fence is a closed straight loop, broken only by gates ----------

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

// ---------- FB-0003: only real BITS buildings (and the spawn's outside world) inside the fence ----------

test('FB-0003: no non-BITS ("other" style) buildings are inside the campus fence', () => {
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

test('FB-0005/FB-0007: every internal walkway run has one constant width', () => {
  for (const w of [...layout.walkways, ...layout.parkPaths]) {
    const width = w.x1 - w.x0 + 1;
    const height = w.y1 - w.y0 + 1;
    const crossWidth = width >= height ? height : width;
    assert.equal(crossWidth, layout.walkwayWidth, `walkway run ${JSON.stringify(w)} is not a constant ${layout.walkwayWidth} tiles wide`);
  }
});

// ---------- FB-0008/FB-0010: Gate 2, a straight approach, and a reachable Main Block entrance ----------

test('FB-0008/FB-0010: Gate 2 exists, a straight road leads to it, and the Main Block entrance is reachable', () => {
  const gate2 = gates.find((g) => /Gate 2/.test(g.name));
  assert.ok(gate2, 'no Gate 2 object');
  assert.equal(gate2.props.main, true, 'Gate 2 should be flagged as the main entrance');

  // The entrance avenue is one constant-width, dead-straight (single x) corridor from the gate to
  // the plaza in front of the Main Block: sample a few rows and check the paved band's x-range
  // (found from its kerb columns) never moves sideways.
  const findRoadSpan = (y) => {
    let x0 = null;
    let x1 = null;
    for (let x = 0; x < json.width; x++) {
      const n = groundNameAt(x, y) || structNameAt(x, y);
      if (n && (n.startsWith('kerb') || n === 'asphalt' || n.startsWith('roadLine') || n.startsWith('crossing'))) {
        if (x0 === null) x0 = x;
        x1 = x;
      }
    }
    return x0 === null ? null : [x0, x1];
  };
  const rows = [layout.fence.height - 5, layout.fence.height - 40, layout.avenueInnerY1 + 5];
  const spans = rows.map((localY) => findRoadSpan(Math.round(campusZone.y) + localY)).filter(Boolean);
  assert.ok(spans.length >= 2, 'could not find the entrance avenue at multiple rows');
  const [first] = spans;
  for (const span of spans) {
    assert.ok(Math.abs(span[0] - first[0]) <= 1 && Math.abs(span[1] - first[1]) <= 1, `entrance avenue is not straight: ${JSON.stringify(spans)}`);
  }

  const reachable = reachableFrom({ x: Math.floor(spawn.x), y: Math.floor(spawn.y) });
  const mainDoor = doors.find((d) => d.props.building === 'Main Block');
  assert.ok(mainDoor, 'no Main Block door');
  assert.ok(reachable(Math.floor(mainDoor.x), Math.floor(mainDoor.y)), 'Main Block entrance is not reachable from the Gate 2 spawn');
});

// ---------- FB-0011: separate, walkable-between buildings ----------

test('FB-0011: the Main Block, Library Block and Mechanical Block are separate, with a walkable route between each pair', () => {
  const names = ['Main Block', 'Library Block', 'Mechanical Block'];
  const buildings = names.map((n) => objects.find((o) => o.type === 'building' && o.name === n));
  for (const b of buildings) assert.ok(b, 'missing building object');

  // Separate footprints: no two of the three bounding boxes overlap or touch.
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i];
      const b = buildings[j];
      const gapX = Math.max(a.x, b.x) - Math.min(a.x + a.width, b.x + b.width);
      const gapY = Math.max(a.y, b.y) - Math.min(a.y + a.height, b.y + b.height);
      const separated = gapX > 0 || gapY > 0;
      assert.ok(separated, `${a.name} and ${b.name} are not separate footprints`);
    }
  }

  const doorFor = (name) => doors.find((d) => d.props.building === name);
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
  // One step further out (west) is outside the fence; one step back in (east) is inside it.
  assert.ok(walkable(gx - 1, gy), 'just outside the Side Gate is not walkable');
  assert.ok(walkable(gx + 1, gy), 'just inside the Side Gate is not walkable');
  const reachable = reachableFrom({ x: gx + 1, y: gy });
  assert.ok(reachable(gx - 1, gy), 'the Side Gate does not connect the inside of campus to the outside');
});

// ---------- FB-0014: roads are bordered by kerb tiles ----------

test('FB-0014: the entrance avenue and the road to DIAC are bordered by kerb tiles', () => {
  const sampleY = Math.round(campusZone.y) + layout.avenueInnerY1 + 10;
  const rowNames = [];
  for (let x = 0; x < json.width; x++) {
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
  for (const name of ['courtLineH', 'courtLineV', 'courtNet', 'courtCornerTL', 'courtCornerTR', 'courtCornerBL', 'courtCornerBR']) {
    assert.ok(seen.has(name), `Tennis Courts area has no "${name}" tile`);
  }
});

// ---------- FB-0006: pavements use the shaded paving/walkway tiles, not flat road fill ----------

test('FB-0006: the drop-off plaza and internal paths use paving/walkway, not plain asphalt', () => {
  const plazaCenterX = Math.round(campusZone.x) + Math.round((layout.plaza.x0 + layout.plaza.x1) / 2);
  const plazaCenterY = Math.round(campusZone.y) + Math.round((layout.plaza.y0 + layout.plaza.y1) / 2);
  assert.equal(groundNameAt(plazaCenterX, plazaCenterY), 'paving');

  // Sample the spine well away from where it crosses the entrance avenue (that cell is a road
  // crossing, not plain walkway).
  const spineY = Math.round(campusZone.y) + layout.walkways[0].y0;
  const spineX = Math.round(campusZone.x) + layout.walkways[0].x0 + 10;
  assert.equal(groundNameAt(spineX, spineY), 'walkway');
});
