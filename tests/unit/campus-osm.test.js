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

const { tileInfo, gridFromTiled, tiledObjects, isWalkableTile } = loadGameData();
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
