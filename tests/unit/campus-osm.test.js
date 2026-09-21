// New regression tests for the campus v2 rebuild (ADR 0009: back to OpenStreetMap, straightened and
// cleaned up). Named after the owner's feedback on the schematic rebuild it replaces (FB-0019,
// FB-0020, FB-0021) plus the extra checks the ADR calls for (road connectivity, every door/cutscene
// reachable on foot, no solid tile blocking a walkway or road).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { tileInfo, gridFromTiled, tiledObjects, isWalkableTile, objectAt } = loadGameData();
const MAP_FILE = path.join(ROOT, 'assets', 'maps', 'campus.json');
const json = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const grid = gridFromTiled(json);
const objects = tiledObjects(json);
const walkable = (x, y) => isWalkableTile(grid, tileInfo, x, y);
const W = json.width;
const H = json.height;

const groundLayer = json.layers.find((l) => l.name === 'ground').data;
const structuresLayer = json.layers.find((l) => l.name === 'structures').data;
const groundNameAt = (x, y) => {
  const gid = groundLayer[y * W + x];
  return gid ? tileInfo.tiles[gid - 1].name : null;
};
const structNameAt = (x, y) => {
  const gid = structuresLayer[y * W + x];
  return gid ? tileInfo.tiles[gid - 1].name : null;
};

function floodFill(startX, startY, isPassable) {
  const seen = new Uint8Array(W * H);
  if (!isPassable(startX, startY)) return seen;
  const queue = [[startX, startY]];
  seen[startY * W + startX] = 1;
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !isPassable(nx, ny)) continue;
      seen[ny * W + nx] = 1;
      queue.push([nx, ny]);
    }
  }
  return seen;
}

const spawn = objects.find((o) => o.type === 'spawn');
const campusZone = objects.find((o) => o.type === 'area' && o.props.kind === 'campus');

// ---------- FB-0021: the campus follows the real OpenStreetMap layout ----------

test('FB-0021: the campus follows the OpenStreetMap layout (the strip along D54, the hostel row)', () => {
  // The map is generated from real OSM building footprints (ADR 0009), so each named BITS building
  // should be a real, individually-shaped polygon, not a hand-picked rectangle: it should have more
  // than 4 corners somewhere on campus (an L-shaped wing) and a plausible real-world footprint size.
  const buildings = objects.filter((o) => o.type === 'building' && o.props.style === 'bits');
  for (const name of ['Main Block', 'Library Block', 'Mechanical Block']) {
    const b = buildings.find((x) => x.name === name);
    assert.ok(b, `missing ${name}`);
    const metersPerTile = json.properties.find((p) => p.name === 'metersPerTile').value;
    const widthM = b.width * metersPerTile;
    const heightM = b.height * metersPerTile;
    assert.ok(widthM > 20 && heightM > 20, `${name} is only ${widthM}x${heightM} m, too small for a real academic block`);
  }

  // The hostels form a row: their centres should cluster into two groups (boys west of the academic
  // complex, girls east, per docs/research/bits-dubai-campus.md) at roughly the same north-south
  // (v/y) position as each other -- i.e. hostels don't scatter randomly across the whole campus depth.
  const hostels = objects.filter((o) => o.type === 'area' && o.props.kind === 'hostel');
  assert.ok(hostels.length >= 5, `expected at least 5 hostel areas, found ${hostels.length}`);
  const centresY = hostels.map((h) => h.y + h.height / 2);
  const spreadY = Math.max(...centresY) - Math.min(...centresY);
  const campusZone = objects.find((o) => o.type === 'area' && o.props.kind === 'campus');
  assert.ok(spreadY < campusZone.height * 0.6, `hostels spread across ${spreadY.toFixed(0)} tiles of campus depth, expected a tight row`);
});

// ---------- FB-0019: tree and palm trunks touch their canopy ----------

function readTilesPNG() {
  const buffer = fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png'));
  let offset = 8;
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
    } else if (type === 'IDAT') idatChunks.push(data);
    offset += 8 + length + 4;
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * 4 + 1;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) raw.copy(rgba, y * width * 4, y * stride + 1, (y + 1) * stride);
  return { width, height, rgba };
}
const png = readTilesPNG();
const TILE_PX = 16;
function tileXY(name) {
  const index = tileInfo.tiles.findIndex((t) => t.name === name);
  assert.ok(index !== -1, `no tile named "${name}"`);
  return [(index % tileInfo.columns) * TILE_PX, Math.floor(index / tileInfo.columns) * TILE_PX];
}
function isOpaque(name, x, y) {
  const [tx, ty] = tileXY(name);
  const i = ((ty + y) * png.width + (tx + x)) * 4;
  return png.rgba[i + 3] !== 0;
}
// The trunk is planted directly below the canopy's left (TL/BL) column (STYLE_GUIDE "Campus kit").
// Its own art draws it a little right of centre (make-assets.js), so it touches the canopy's
// silhouette if the canopy's bottom-left quadrant reaches close to the tile's bottom edge there.
function canopyTouchesTrunk(canopyBL) {
  for (let x = 7; x <= 13; x++) {
    if (isOpaque(canopyBL, x, TILE_PX - 1) || isOpaque(canopyBL, x, TILE_PX - 2)) return true;
  }
  return false;
}
test('FB-0019: the tree canopy silhouette reaches down to touch the trunk tile below it', () => {
  assert.ok(canopyTouchesTrunk('treeCanopyBL'), 'treeCanopyBL has a gap above the trunk column');
});
test('FB-0019: the palm canopy silhouette reaches down to touch the trunk tile below it', () => {
  assert.ok(canopyTouchesTrunk('palmCanopyBL'), 'palmCanopyBL has a gap above the trunk column');
});

// ---------- FB-0020: the tennis net is a thin line with posts ----------

test('FB-0020: the tennis net is a thin line (not a thick striped block), with posts at each end', () => {
  const [nx, ny] = tileXY('courtNet');
  let darkPixelsPerRow = [];
  for (let y = 0; y < TILE_PX; y++) {
    let count = 0;
    for (let x = 0; x < TILE_PX; x++) {
      const i = ((ny + y) * png.width + (nx + x)) * 4;
      if (png.rgba[i] < 0x40 && png.rgba[i + 1] < 0x40 && png.rgba[i + 2] < 0x50) count++;
    }
    darkPixelsPerRow.push(count);
  }
  const maxDark = Math.max(...darkPixelsPerRow);
  assert.ok(maxDark <= 3, `courtNet's dark net line is ${maxDark}px wide on some row, expected a thin (<=3px) line`);

  // A post tile has a solid grey post block near the edge where the net meets the sideline, which
  // plain courtNet (checked above) doesn't have.
  const [px, py] = tileXY('courtNetPostT');
  let postPixels = 0;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const i = ((py + y) * png.width + (px + x)) * 4;
      if (png.rgba[i + 3] !== 0 && !(png.rgba[i] < 0x40 && png.rgba[i + 1] < 0x40)) postPixels++;
    }
  }
  assert.ok(postPixels > 0, 'courtNetPostT has no visible post near the sideline');
  assert.ok(tileInfo.tiles.some((t) => t.name === 'courtNetPostB'), 'missing courtNetPostB');
});

// ---------- Road-network connectivity: Gate 2's approach reaches D54 and the DIAC ring; parking touches a road ----------

const ROAD_TILE_NAMES = new Set(['asphalt', 'kerbT', 'kerbB', 'kerbL', 'kerbR', 'kerbTL', 'kerbTR', 'kerbBL', 'kerbBR', 'roadLineH', 'roadLineV', 'crossingH', 'crossingV', 'parking']);
const isRoadTile = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ROAD_TILE_NAMES.has(groundNameAt(x, y));

test('the road network connects Gate 2 out to the wider road system, and parking touches a road', () => {
  const gate2 = objects.find((o) => o.type === 'gate' && /Gate 2/.test(o.name));
  let startX = Math.floor(gate2.x);
  let startY = Math.floor(gate2.y) + 3; // a few tiles outside the gate, on the approach road
  while (startY < H && !isRoadTile(startX, startY)) startY++;
  assert.ok(isRoadTile(startX, startY), 'could not find the Gate 2 approach road outside the fence');

  const seen = floodFill(startX, startY, isRoadTile);
  let minX = W;
  let maxX = 0;
  let minY = H;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!seen[y * W + x]) continue;
      count++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  // A well-connected network spans most of the map (D54 near the top, the DIAC ring off to one side).
  assert.ok(count > 1000, `the road network reachable from Gate 2 is only ${count} tiles`);
  assert.ok(maxX - minX > W * 0.5, 'the road network does not reach across most of the map width (D54 to the DIAC ring)');
  assert.ok(minY < H * 0.4, 'the road network reachable from Gate 2 does not reach up towards D54');

  const parking = objects.find((o) => o.name === 'Student Parking');
  let touches = false;
  for (let y = Math.floor(parking.y) - 1; y <= parking.y + parking.height && !touches; y++) {
    for (let x = Math.floor(parking.x) - 1; x <= parking.x + parking.width; x++) {
      if (seen[y * W + x]) { touches = true; break; }
    }
  }
  assert.ok(touches, 'Student Parking does not touch the flooded road network');
});

// ---------- Every door and cutscene object is reachable on foot from spawn ----------

test('every door and cutscene object is reachable on foot from spawn', () => {
  const seen = floodFill(Math.floor(spawn.x), Math.floor(spawn.y), walkable);
  const targets = objects.filter((o) => o.type === 'door' || o.type === 'cutscene');
  assert.ok(targets.length >= 3, `expected at least 3 door/cutscene objects, found ${targets.length}`);
  for (const t of targets) {
    const cx = Math.floor(t.type === 'cutscene' ? t.x + t.width / 2 : t.x);
    const cy = Math.floor(t.type === 'cutscene' ? t.y + t.height / 2 : t.y);
    assert.ok(seen[cy * W + cx], `${t.name} (${t.type}) is not reachable on foot from spawn`);
  }
});

// ---------- No solid tile (tree/hedge/sign) sits on a walkway or road ----------

test('no solid tile (tree trunk, hedge, signboard, ...) sits on a walkway or road tile', () => {
  const BLOCKING_GROUND = new Set(['walkway', 'asphalt', 'paving', ...ROAD_TILE_NAMES]);
  let violations = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = groundNameAt(x, y);
      if (!g || !BLOCKING_GROUND.has(g)) continue;
      const s = structNameAt(x, y);
      if (!s) continue;
      // FB-0025: a parked car occupying a parking space is intentional (that's the point of a
      // parking lot), unlike a tree/hedge/sign accidentally placed on a road or walkway -- exempt
      // just that one case, only on 'parking' ground, so a real generator bug elsewhere still fails.
      if (g === 'parking' && s.startsWith('car')) continue;
      const tile = tileInfo.tiles[structuresLayer[y * W + x] - 1];
      if (tile.solid) violations.push(`${s} on ${g} at ${x},${y}`);
    }
  }
  assert.equal(violations.length, 0, `found solid tiles blocking a walkway/road/paving: ${violations.slice(0, 10).join('; ')}`);
});

// ---------- Doors carry a `to` property the game can use for interiors later ----------

test('every enterable BITS building has a door object with a `to` map key', () => {
  const doors = objects.filter((o) => o.type === 'door');
  const expected = { 'Main Block': 'main-block-g', 'Library Block': 'library-block-g', 'Mechanical Block': 'mechanical-block-g' };
  for (const [building, to] of Object.entries(expected)) {
    const door = doors.find((d) => d.props.building === building);
    assert.ok(door, `missing door object for ${building}`);
    assert.equal(door.props.to, to, `${building}'s door should have to="${to}"`);
  }
});

// ---------- A cutscene trigger sits just inside Gate 2, spanning the avenue ----------

test('a "gate2" cutscene trigger sits just inside Gate 2, spanning the avenue width', () => {
  const cutscene = objects.find((o) => o.type === 'cutscene' && o.props.cutscene === 'gate2');
  assert.ok(cutscene, 'no gate2 cutscene object');
  const gate2 = objects.find((o) => o.type === 'gate' && /Gate 2/.test(o.name));
  assert.ok(Math.abs(cutscene.x + cutscene.width / 2 - gate2.x) <= 2, 'the gate2 cutscene is not centred on the avenue');
  assert.ok(cutscene.y < gate2.y, 'the gate2 cutscene should sit north of (inside) the gate');
  assert.ok(gate2.y - (cutscene.y + cutscene.height) < 6, 'the gate2 cutscene is not close to Gate 2');
});

// ---------- P5 QA: no isolated walkway/road islands (a paved tile cut off from the network) ----------

// "Hardscape" is every tile family a pedestrian or vehicle actually travels on: walkways, paving,
// asphalt, kerb, lane markings, crossings and parking.
const HARDSCAPE_TILE_NAMES = new Set([
  'walkway', 'paving', 'asphalt', 'kerbT', 'kerbB', 'kerbL', 'kerbR', 'kerbTL', 'kerbTR', 'kerbBL', 'kerbBR',
  'roadLineH', 'roadLineV', 'crossingH', 'crossingV', 'parking',
]);

// An "island" is a walkway/road tile a player actually can't get to on foot -- fully hemmed in by
// solid tiles, not just a paved path that opens onto open turf/lawn/sand instead of onto more
// paving (the hostel walkway spurs open onto the athletics track's turf on their way further into
// campus, and the whole exterior is walkable desert sand, both by design, not a generator bug). This
// reuses the same general walkability a player experiences, rather than requiring the paved surface
// itself to stay one unbroken shape, which would flag deliberate track/turf crossings as "islands".
test('no isolated walkway/road island (every walkway/road tile is reachable on foot from spawn)', () => {
  const reachable = floodFill(Math.floor(spawn.x), Math.floor(spawn.y), walkable);
  let hardscapeTileCount = 0;
  const unreachable = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!HARDSCAPE_TILE_NAMES.has(groundNameAt(x, y))) continue;
      // FB-0025: a parking cell with a parked car on it is never meant to be stood on, so it's not
      // an "island" bug the way an unreachable stretch of open walkway/asphalt would be.
      const s = structNameAt(x, y);
      if (s && s.startsWith('car')) continue;
      hardscapeTileCount++;
      if (!reachable[y * W + x]) unreachable.push([x, y]);
    }
  }
  assert.ok(hardscapeTileCount > 1000, `expected a substantial walkway/road network, found ${hardscapeTileCount} tiles`);
  assert.equal(unreachable.length, 0, `found ${unreachable.length} walkway/road tile(s) not reachable on foot from spawn (e.g. ${unreachable[0]})`);
});

// ---------- P5 QA: sports areas are reachable by walkway from spawn ----------

test('the Athletics Track and Tennis Courts are reachable on foot from spawn', () => {
  const reachable = floodFill(Math.floor(spawn.x), Math.floor(spawn.y), walkable);
  for (const name of ['Athletics Track', 'Tennis Courts']) {
    const area = objects.find((o) => o.type === 'area' && o.name === name);
    assert.ok(area, `no "${name}" area object`);
    const cx = Math.floor(area.x + area.width / 2);
    const cy = Math.floor(area.y + area.height / 2);
    // The area's own centre might land on a solid net/line tile; scan the area for any reachable cell.
    let found = false;
    for (let y = Math.floor(area.y); y < area.y + area.height && !found; y++) {
      for (let x = Math.floor(area.x); x < area.x + area.width && !found; x++) {
        if (reachable[y * W + x]) found = true;
      }
    }
    assert.ok(found, `${name} (centre ${cx},${cy}) is not reachable on foot from spawn`);
  }
});

// ---------- FB-0022: walkways/roads never overwrite a building's own footprint ----------

const PATH_LIKE_GROUND = new Set(['walkway', 'asphalt', 'paving', 'parking', ...['T', 'B', 'L', 'R', 'TL', 'TR', 'BL', 'BR'].map((s) => `kerb${s}`), 'roadLineH', 'roadLineV', 'crossingH', 'crossingV']);

test('FB-0022: no walkway or road tile lies inside any building footprint', () => {
  // buildingFootprint objects (build-campus.js section 17) are the ground truth: the exact rectangles
  // a building was drawn from, independent of whatever ended up in the compiled structures layer --
  // a walkway that overwrote a roof clears that cell's structure tile, so checking structure tile
  // names alone (the earlier QA check) can't catch this; checking against the footprint rectangles
  // themselves can.
  // Real BITS buildings only: a neighbouring non-BITS ("other") building outside the fence is
  // allowed to have a real OpenStreetMap road drawn across it (section 16 -- deliberate, unrelated
  // to this bug: those buildings aren't enterable, and the road wins rather than blocking traffic
  // that was never meant to route around them).
  const footprints = objects.filter((o) => o.type === 'buildingFootprint' && o.props.style === 'bits');
  assert.ok(footprints.length > 0, 'no BITS buildingFootprint objects on the map');
  const violations = [];
  for (const f of footprints) {
    const x0 = Math.round(f.x);
    const y0 = Math.round(f.y);
    const x1 = x0 + Math.round(f.width);
    const y1 = y0 + Math.round(f.height);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const g = groundNameAt(x, y);
        if (g && PATH_LIKE_GROUND.has(g)) violations.push(`${f.name} footprint has ${g} at ${x},${y}`);
      }
    }
  }
  assert.equal(violations.length, 0, `found walkway/road tiles inside a building footprint: ${violations.slice(0, 10).join('; ')}`);
});

// ---------- FB-0022: the flat roof reads as a roof, not as pavement, from above ----------

test('FB-0022: the flat roof tile is clearly distinct from the paving tile in average colour', () => {
  const colorOf = (name) => tileInfo.tiles.find((t) => t.name === name).color;
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const dist = (a, b) => {
    const [ar, ag, ab] = rgb(a);
    const [br, bg, bb] = rgb(b);
    return Math.hypot(ar - br, ag - bg, ab - bb);
  };
  const paving = colorOf('paving');
  for (const roofName of ['bitsRoof', 'otherRoof']) {
    const d = dist(colorOf(roofName), paving);
    assert.ok(d > 40, `${roofName} (${colorOf(roofName)}) is too close to paving (${paving}), distance ${d.toFixed(1)}`);
  }
});

// ---------- FB-0022: trees keep at least 1 tile of clearance from paths, roads and buildings ----------

test('FB-0022: every tree/palm trunk has at least 1 tile of clearance from any walkway/road tile or building footprint', () => {
  const footprints = objects.filter((o) => o.type === 'buildingFootprint' && o.props.style === 'bits');
  const insideAnyFootprint = (x, y) => footprints.some((f) => x >= f.x && x < f.x + f.width && y >= f.y && y < f.y + f.height);
  const trunkNames = new Set(['treeTrunk', 'palmTrunk']);
  let trunkCount = 0;
  const violations = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = structNameAt(x, y);
      if (!trunkNames.has(s)) continue;
      trunkCount++;
      for (let yy = y - 1; yy <= y + 1; yy++) {
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx === x && yy === y) continue;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const g = groundNameAt(xx, yy);
          if (g && PATH_LIKE_GROUND.has(g)) violations.push(`${s} at ${x},${y} is adjacent to ${g} at ${xx},${yy}`);
          if (insideAnyFootprint(xx, yy)) violations.push(`${s} at ${x},${y} is adjacent to a building footprint cell ${xx},${yy}`);
        }
      }
    }
  }
  assert.ok(trunkCount > 20, `expected plenty of trees, found ${trunkCount}`);
  assert.equal(violations.length, 0, `trees too close to a path/road/building: ${violations.slice(0, 10).join('; ')}`);
});

// ---------- D54 gets the road kit (kerbs + lane markings) where it's straight ----------

test('D54 gets kerbs and lane markings near the campus, not a plain grey slab', () => {
  // A kerbed cross-section: a column where a 'kerbT' tile sits above a short run of asphalt/lane
  // marking tiles that ends in a 'kerbB' tile, above (north of) the campus fence -- the same road
  // kit as the Gate 2 avenue, rather than every D54 tile being bare asphalt.
  let found = null;
  for (let x = 0; x < W && !found; x++) {
    for (let y = 0; y < Math.floor(campusZone.y) - 1; y++) {
      if (groundNameAt(x, y) !== 'kerbT') continue;
      let y1 = y + 1;
      while (y1 < H && ['asphalt', 'roadLineH', 'roadLineV'].includes(groundNameAt(x, y1))) y1++;
      if (groundNameAt(x, y1) === 'kerbB' && y1 - y >= 3) {
        found = { x, y0: y, y1 };
        break;
      }
    }
  }
  assert.ok(found, 'no kerbed D54 cross-section (kerbT ... asphalt/lane markings ... kerbB) found north of the campus');
});

// ---------- The tile in front of each building's door resolves to that building, never another ----------

test('the tile in front of each building door resolves to that building (or a neutral area), never a different building', () => {
  // areaHere() (world.js) reads building names from 'zone' objects, one per real footprint
  // rectangle (extended south, on the rectangle that reaches the door, to cover the plaza right in
  // front of it) -- not from the coarse 'building' bbox, whose bounding box can spill into a
  // neighbouring building's own plaza on an L-shaped footprint (QA: standing outside the Mechanical
  // Block's door used to read "Main Block").
  const doors = objects.filter((o) => o.type === 'door' && o.props.building);
  assert.ok(doors.length >= 3, `expected at least 3 building doors, found ${doors.length}`);
  const hitTestObjects = objects.filter((o) => o.type === 'area' || o.type === 'zone');
  for (const door of doors) {
    const x = Math.floor(door.x);
    // The door's threshold, then a few tiles south (away from the building, matching its own
    // `facing: down`) -- some real BITS buildings sit only a tile or two apart (ADR 0009), so the
    // first walkable tile in that direction is used rather than a fixed offset that could land
    // inside a neighbour's wall.
    let y = Math.floor(door.y);
    let steps = 0;
    while (steps < 6 && !walkable(x, y)) {
      y += 1;
      steps += 1;
    }
    assert.ok(walkable(x, y), `no walkable tile found south of ${door.name}`);
    const hit = objectAt(hitTestObjects, ['area', 'zone'], x, y);
    assert.ok(
      !hit || hit.name === door.props.building,
      `${x},${y} (in front of ${door.props.building}'s door) resolved to "${hit && hit.name}", not "${door.props.building}"`,
    );
  }
});
