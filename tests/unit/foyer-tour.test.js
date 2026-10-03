// ADR 0020: the Main Block ground floor (map `main-block-g`) follows the official 3D virtual tour, not the
// older owner photo. These tests pin the layout the tour describes (docs/research/tour-ground-floor.md)
// against the REAL generated map, by intent rather than by hard-coded coordinates: two reception desks
// flanking the entrance, a glass terrarium on the central axis, a pale oak floor with no runner, a split
// staircase on the left towards the back with the LUG stall behind it, red and blue sofas on the back
// walls, a spiral chandelier over the middle of the hall, two long wings whose every door is closed AND
// says something, and the upper floors left exactly as they were.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { MAPS, AMBIENT, gridFromTiled, tiledObjects, isWalkableTile, tileInfo } = loadGameData();

const mapPath = (key) => path.join(ROOT, 'assets', 'maps', `${key}.json`);
const json = JSON.parse(fs.readFileSync(mapPath('main-block-g'), 'utf8'));
const grid = gridFromTiled(json);
const objects = tiledObjects(json);
const W = json.width;
const H = json.height;
const names = tileInfo.tiles.map((t) => t.name);

const layerData = (name) => {
  const layer = json.layers.find((l) => l.name === name);
  return layer ? layer.data : new Array(W * H).fill(0);
};
const ground = layerData('ground');
const structures = layerData('structures');
const overhead = layerData('overhead');
const nameAt = (data, x, y) => {
  const gid = data[y * W + x];
  return gid ? names[gid - 1] : null;
};
// Every cell (x, y, name) of `data` whose tile is in `wanted`, optionally inside rect r.
function cells(data, wanted, r = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 }) {
  const set = new Set([].concat(wanted));
  const out = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) {
    const n = nameAt(data, x, y);
    if (n && set.has(n)) out.push({ x, y, name: n });
  }
  return out;
}

const foyerArea = objects.find((o) => o.type === 'area' && o.name === 'Foyer');
assert.ok(foyerArea, 'main-block-g has no "Foyer" area');
const FOYER = { x0: foyerArea.x, y0: foyerArea.y, x1: foyerArea.x + foyerArea.width - 1, y1: foyerArea.y + foyerArea.height - 1 };
// the hall's centre line, as an edge coordinate (so a 2-wide thing centred on it has x0 + 1 === axis)
const AXIS = (FOYER.x0 + FOYER.x1 + 1) / 2;
const FOYER_WALLS = { x0: FOYER.x0 - 1, y0: FOYER.y0 - 1, x1: FOYER.x1 + 1, y1: FOYER.y1 + 1 };

const spawn = objects.find((o) => o.type === 'spawn');
const entrance = objects.find((o) => o.type === 'door' && o.name === 'Main Block Ground Floor entrance');
const stairs = objects.find((o) => o.type === 'stairs' && o.name === 'Main Block Stairs G (up)');

const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && isWalkableTile(grid, tileInfo, x, y);

// BFS distances (4-neighbour) from the spawn over walkable tiles.
function distancesFromSpawn() {
  const dist = new Int32Array(W * H).fill(-1);
  const start = { x: Math.floor(spawn.x), y: Math.floor(spawn.y) };
  dist[start.y * W + start.x] = 0;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!walkable(nx, ny) || dist[ny * W + nx] !== -1) continue;
      dist[ny * W + nx] = dist[y * W + x] + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : dist[y * W + x]);
}
const dist = distancesFromSpawn();

const depthGroups = objects.filter((o) => o.type === 'depthGroup');
const inDepthGroup = (x, y) => depthGroups.some((g) => x >= g.x && x < g.x + g.width && y >= g.y && y < g.y + g.height);

// ---------- spawn and the entrance ----------

test('ADR 0020: the player spawns at the entrance, facing up; the exterior door keeps its names', () => {
  assert.ok(spawn && entrance && stairs);
  assert.equal(spawn.props.facing, 'up');
  assert.ok(Math.abs(Math.floor(spawn.x) - Math.floor(entrance.x)) <= 2, 'spawn is not in line with the entrance');
  assert.ok(Math.floor(entrance.y) - Math.floor(spawn.y) <= 4, 'spawn is not at the entrance');
  assert.equal(entrance.props.to, 'campus');
  assert.equal(entrance.props.toId, 'Main Block entrance');
  assert.ok(Math.abs(Math.floor(entrance.x) + 1 - AXIS) <= 1, 'the entrance is not centred on the hall axis');
  assert.equal(Math.floor(entrance.y), FOYER_WALLS.y1, 'the entrance is not in the hall front wall');
});

// ---------- floor ----------

test('ADR 0020: the foyer floor is pale oak planks, with no marble and no darker runner anywhere on the floor', () => {
  for (let y = FOYER.y0; y <= FOYER.y1; y++) for (let x = FOYER.x0; x <= FOYER.x1; x++) {
    const onStairMat = Math.floor(stairs.y) === y && Math.abs(Math.floor(stairs.x) + 0.5 - (x + 0.5)) <= 1; // the stairs object's own mat
    if (onStairMat && nameAt(ground, x, y) === 'intStairsUp') continue;
    assert.equal(nameAt(ground, x, y), 'intFloorOak', `foyer floor at (${x},${y}) is ${nameAt(ground, x, y)}`);
  }
  assert.equal(cells(ground, ['intFloorMarble', 'intFloorMarbleRunner']).length, 0, 'marble floor tiles are still on the ground floor');
  assert.equal(cells(structures, ['intRug']).length + cells(ground, ['intRug']).length, 0, 'a rug/runner strip is still on the ground floor');
});

// ---------- terrarium ----------

test('ADR 0020: a glass terrarium on a round plinth stands on the central axis, a few tiles in from the entrance, solid and walk-behind', () => {
  const parts = ['intTerrariumTL', 'intTerrariumTR', 'intTerrariumML', 'intTerrariumMR', 'intTerrariumBL', 'intTerrariumBR'];
  const found = parts.map((p) => cells(structures, p, FOYER));
  parts.forEach((p, i) => assert.equal(found[i].length, 1, `expected exactly one ${p} in the foyer`));
  const [tl, tr, ml, mr, bl, br] = found.map((f) => f[0]);
  assert.equal(tr.x, tl.x + 1);
  assert.equal(tl.x, bl.x);
  assert.equal(tl.x, ml.x);
  assert.equal(br.x, tr.x);
  assert.equal(mr.x, tr.x);
  assert.equal(tl.y + 1, ml.y);
  assert.equal(ml.y + 1, bl.y);
  assert.ok(Math.abs(tl.x + 1 - AXIS) <= 0.5, `terrarium is not centred on the hall axis (x ${tl.x}..${tr.x}, axis ${AXIS})`);
  const rowsFromEntrance = FOYER_WALLS.y1 - bl.y;
  assert.ok(rowsFromEntrance >= 4 && rowsFromEntrance <= 10, `terrarium base is ${rowsFromEntrance} rows from the entrance wall`);
  for (const p of parts) assert.ok(tileInfo.tiles[names.indexOf(p)].solid, `${p} must be solid (walked around)`);
  for (const t of [tl, tr, ml, mr, bl, br]) assert.ok(inDepthGroup(t.x, t.y), `terrarium tile (${t.x},${t.y}) is not in a depth group`);
});

test('ADR 0020: back-lit totem pillars stand in pairs either side of the terrarium', () => {
  const tops = cells(structures, 'intTotemTop', FOYER);
  const left = tops.filter((t) => t.x + 1 <= AXIS - 2);
  const right = tops.filter((t) => t.x >= AXIS + 2);
  assert.ok(left.length >= 2 && right.length >= 2, `expected a pair each side, found ${left.length} left and ${right.length} right`);
  assert.equal(left.length, right.length, 'the two sides are not mirror pairs');
  for (const t of tops) {
    assert.equal(nameAt(structures, t.x, t.y + 1), 'intTotemBase', `totem at (${t.x},${t.y}) has no base under it`);
    assert.ok(inDepthGroup(t.x, t.y) && inDepthGroup(t.x, t.y + 1), `totem at (${t.x},${t.y}) is not a depth group`);
  }
});

// ---------- reception: two desks ----------

test('ADR 0020: exactly two curved reception desks, one each side of the entrance, each with a frosted partition and a glass side door', () => {
  const caps = cells(structures, 'intReceptionDeskL', FOYER_WALLS);
  const rights = cells(structures, 'intReceptionDeskR', FOYER_WALLS);
  const centres = cells(structures, 'intReceptionDesk', FOYER_WALLS);
  assert.equal(caps.length, 2, `expected 2 desks, found ${caps.length} left end-caps`);
  assert.equal(rights.length, 2);
  assert.equal(centres.length, 2);
  const sorted = [...caps].sort((a, b) => a.x - b.x);
  assert.ok(sorted[0].x + 3 <= AXIS && sorted[1].x >= AXIS, 'the two desks are not on opposite sides of the entrance');
  // mirror images of each other about the hall axis
  assert.equal(sorted[0].x + sorted[1].x + 3, 2 * AXIS, 'desks are not mirrored about the hall axis');
  for (const desk of sorted) {
    assert.ok(FOYER_WALLS.y1 - desk.y <= 6, 'a desk is not in the entrance end of the hall');
    // a glass partition within 3 tiles behind it
    const partition = cells(structures, ['intGlassPanel', 'intGlassPanelB'], { x0: desk.x - 1, y0: desk.y - 3, x1: desk.x + 3, y1: desk.y - 1 });
    assert.ok(partition.length >= 3, `no frosted glass partition behind the desk at (${desk.x},${desk.y})`);
  }
  // a glass side door between each desk and the entrance doors, in the front wall
  const sideDoors = objects.filter((o) => o.type === 'door' && /^Glass side door/.test(o.name));
  assert.ok(sideDoors.length >= 2);
  const leftDoor = sideDoors.filter((d) => d.x < AXIS);
  const rightDoor = sideDoors.filter((d) => d.x >= AXIS);
  assert.ok(leftDoor.length && rightDoor.length, 'a side door is missing on one side');
  for (const d of leftDoor) assert.ok(d.x > sorted[0].x + 2 && d.x < entrance.x, 'left glass door is not between the desk and the entrance');
  for (const d of rightDoor) assert.ok(d.x < sorted[1].x && d.x > entrance.x + 1, 'right glass door is not between the desk and the entrance');
  for (const d of sideDoors) assert.equal(Math.floor(d.y), FOYER_WALLS.y1, 'a glass side door is not in the entrance wall');
});

// ---------- staircase ----------

test('ADR 0020: the stairs object keeps its name and links; it sits at the foot of a staircase on the LEFT side towards the back', () => {
  assert.equal(stairs.props.to, 'main-block-1');
  assert.equal(stairs.props.toId, 'Main Block Stairs 1 (down)');
  assert.ok(stairs.x + 1 <= AXIS - 1, `stairs object at x=${stairs.x} is not in the left half (axis ${AXIS})`);
  assert.ok(stairs.y < (FOYER.y0 + FOYER.y1) / 2 + 1, `stairs object at y=${stairs.y} is not towards the back of the hall`);
  assert.ok(walkable(Math.floor(stairs.x), Math.floor(stairs.y)), 'the stairs object is on a solid tile');
  assert.ok(dist(Math.floor(stairs.x), Math.floor(stairs.y)) > 0, 'the stairs object cannot be reached from the spawn');
});

test('ADR 0020: the staircase is split (one wide flight dividing into two upper flights), white-railed, with two round columns at its foot', () => {
  const treads = cells(structures, ['intFoyerTreadPlain', 'intFoyerStairsL', 'intFoyerStairsR'], FOYER);
  assert.ok(treads.length >= 12, `expected a real block of treads, found ${treads.length}`);
  assert.ok(treads.every((t) => t.x + 1 <= AXIS), 'staircase tiles are not all in the left half of the hall');
  const ys = [...new Set(treads.map((t) => t.y))].sort((a, b) => a - b);
  const runs = (y) => {
    const xs = treads.filter((t) => t.y === y).map((t) => t.x).sort((a, b) => a - b);
    let n = xs.length ? 1 : 0;
    for (let i = 1; i < xs.length; i++) if (xs[i] !== xs[i - 1] + 1) n++;
    return n;
  };
  assert.equal(runs(ys[0]), 2, 'the top of the staircase should be two separate upper flights');
  assert.equal(runs(ys[ys.length - 1]), 1, 'the foot of the staircase should be one wide flight');
  assert.ok(cells(structures, 'intFoyerLanding', FOYER).length >= 4, 'no landing where the flight divides');
  const columns = cells(structures, 'intColumnShaftL', FOYER);
  assert.equal(columns.length, 2, `expected two round columns, found ${columns.length}`);
  const footY = Math.max(...treads.map((t) => t.y));
  const minX = Math.min(...treads.map((t) => t.x)), maxX = Math.max(...treads.map((t) => t.x));
  for (const c of columns) {
    assert.ok(c.y >= footY, 'a column is not at the foot of the staircase');
    assert.ok(c.x >= minX - 1 && c.x <= maxX + 1, 'a column is not beside the staircase');
    assert.ok(inDepthGroup(c.x, c.y) && inDepthGroup(c.x + 1, c.y), 'a column is not a depth group');
  }
  // the stairs object is at the foot, between the two columns
  const [a, b] = columns.map((c) => c.x).sort((p, q) => p - q);
  assert.ok(stairs.x > a && stairs.x < b + 1, 'the stairs object is not between the two columns at the foot');
});

// ---------- the LUG stall and the volunteer ----------

test('ADR 0020: the LUG volunteer and "LUG Stall" are behind the left staircase, reachable from the spawn', () => {
  const volunteer = MAPS['main-block-g'].npcs.find((n) => n.id === 'lug-volunteer');
  assert.ok(volunteer, 'the LUG volunteer is gone from main-block-g');
  const stall = objects.find((o) => o.type === 'area' && o.name === 'LUG Stall');
  assert.ok(stall, 'no "LUG Stall" area');
  assert.equal(stall.props.kind, 'stall');
  assert.ok(volunteer.x >= stall.x && volunteer.x < stall.x + stall.width && volunteer.y >= stall.y && volunteer.y < stall.y + stall.height, 'the volunteer is outside the stall');
  const treads = cells(structures, ['intFoyerTreadPlain', 'intFoyerStairsL', 'intFoyerStairsR'], FOYER);
  const topY = Math.min(...treads.map((t) => t.y));
  assert.ok(volunteer.y < topY, `the volunteer (y ${volunteer.y}) is not behind the staircase (top y ${topY})`);
  assert.ok(volunteer.x + 1 <= AXIS, 'the stall is not on the left side');
  // somewhere beside the volunteer a player can stand and reach him from the spawn
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => dist(volunteer.x + dx, volunteer.y + dy)).filter((d) => d > 0);
  assert.ok(around.length > 0, 'nobody can walk up to the volunteer from the spawn');
  assert.ok(Math.hypot(volunteer.x - stairs.x, volunteer.y - stairs.y) <= 12, 'the stall is not near the staircase');
});

// ---------- sofas, chandelier, wordmark ----------

test('ADR 0020: low red and blue sofas on the left AND right back walls, with small tables, not by the entrance', () => {
  const sofas = cells(structures, ['intSofaRed', 'intSofaBlue'], FOYER);
  assert.ok(cells(structures, 'intSofaRed', FOYER).length >= 2 && cells(structures, 'intSofaBlue', FOYER).length >= 2, 'need both red and blue sofas');
  assert.ok(sofas.some((s) => s.x + 1 <= AXIS - 1), 'no sofa on the left side');
  assert.ok(sofas.some((s) => s.x >= AXIS + 1), 'no sofa on the right side');
  for (const s of sofas) assert.ok(FOYER_WALLS.y1 - s.y >= 8, `sofa at (${s.x},${s.y}) is by the entrance, not on a back wall`);
  assert.ok(cells(structures, 'table', FOYER).length >= 2, 'no small tables by the sofas');
  assert.equal(cells(structures, 'intSofa', FOYER).length, 0, 'the old brown foyer sofas are still there');
});

test('ADR 0020: a spiral gold-ring chandelier hangs on the overhead layer over the middle of the hall, not over the stairs', () => {
  const rings = cells(overhead, ['intChandelier', 'intChandelierTR', 'intChandelierBL', 'intChandelierBR']);
  assert.ok(rings.length >= 4, 'no chandelier on the overhead layer');
  const treads = cells(structures, ['intFoyerTreadPlain', 'intFoyerStairsL', 'intFoyerStairsR', 'intFoyerLanding'], FOYER);
  const midX = rings.reduce((s, r) => s + r.x + 0.5, 0) / rings.length;
  const midY = rings.reduce((s, r) => s + r.y + 0.5, 0) / rings.length;
  assert.ok(Math.abs(midX - AXIS) <= 2.5, `chandelier is at x ${midX}, hall axis ${AXIS}`);
  assert.ok(midY > FOYER.y0 + 4 && midY < FOYER.y1 - 4, 'chandelier is not over the middle of the hall');
  for (const r of rings) assert.ok(!treads.some((t) => t.x === r.x && t.y === r.y), 'the chandelier hangs over the stairs');
  const nearStairs = rings.filter((r) => Math.hypot(r.x - stairs.x, r.y - stairs.y) < 3);
  assert.equal(nearStairs.length, 0, 'the chandelier is over the stairs object');
});

test('ADR 0020: the mezzanine railing and the lit "BITS Pilani, Dubai Campus" wordmark are kept', () => {
  assert.ok(cells(structures, 'intAtriumRailing', FOYER).length >= 6, 'the mezzanine railing is gone');
  const segs = cells(structures, Array.from({ length: 9 }, (_, i) => `bitsSignSeg${i}`), FOYER_WALLS);
  assert.equal(segs.length, 9, 'the wordmark is not whole');
  const row = [...new Set(segs.map((s) => s.y))];
  assert.equal(row.length, 1, 'the wordmark is split across rows');
  const sortedSegs = [...segs].sort((a, b) => a.x - b.x);
  sortedSegs.forEach((s, i) => assert.equal(s.name, `bitsSignSeg${i}`, 'wordmark segments are out of order'));
});

// ---------- the two long wings and every closed door ----------

test('ADR 0020: two long wings, left to the Sports Complex end and right to the Auditorium end, each a long walk from the foyer', () => {
  const left = objects.find((o) => o.type === 'area' && o.name === 'Sports Complex Lobby');
  const right = objects.find((o) => o.type === 'area' && o.name === 'Auditorium Lobby');
  assert.ok(left && right, 'a wing end lobby is missing');
  assert.ok(left.x + left.width <= AXIS, 'the Sports Complex end is not on the left');
  assert.ok(right.x >= AXIS, 'the Auditorium end is not on the right');
  for (const lobby of [left, right]) {
    const d = dist(Math.floor(lobby.x + lobby.width / 2), Math.floor(lobby.y + lobby.height / 2));
    assert.ok(d >= 35, `"${lobby.name}" is only ${d} steps from the spawn: not a long wing`);
  }
});

const REQUIRED_ROOMS = [
  'Admissions Office', "Director's Office", 'Sports Complex', 'Prime Medical Centre', 'Mini Mart',
  'Academic Undergraduate Studies Division', 'Student Welfare Division', "Deputy Registrar's Office",
  'Auditorium', 'Parents-Visitor Lounge', 'Library', 'Career Services',
];
const closedDoors = objects.filter((o) => o.type === 'door' && !o.props.to);

test('ADR 0020: every wing destination is a closed, nameplated door (no new enterable rooms)', () => {
  for (const room of REQUIRED_ROOMS) {
    assert.ok(closedDoors.some((d) => d.name.startsWith(room)), `no closed door for "${room}"`);
  }
  assert.equal(cells(structures, 'intDoorClosed').length, 0, 'a silent solid closed-door tile is still on the ground floor');
  const plates = cells(structures, 'intNameplate').length;
  assert.ok(plates >= REQUIRED_ROOMS.length, `only ${plates} nameplates for ${REQUIRED_ROOMS.length} rooms`);
});

test('ADR 0020: no door is silent and no door opens onto nothing: every closed door is flagged closed, has its own in-voice line, and is reachable', () => {
  const rules = MAPS['main-block-g'].doorLocks;
  const reasons = new Set();
  for (const d of closedDoors) {
    assert.equal(d.props.closed, true, `door "${d.name}" has no \`to\` and is not marked closed`);
    const rule = rules.find((r) => r.match === d.name);
    assert.ok(rule, `closed door "${d.name}" has no doorLocks entry`);
    assert.equal(rule.stages, undefined, `closed door "${d.name}" must stay shut for the whole game`);
    assert.equal(typeof rule.reason, 'string');
    assert.ok(rule.reason.length >= 10 && rule.reason.length <= 70, `"${d.name}" line is empty or too long: ${rule.reason}`);
    reasons.add(rule.reason);
    assert.ok(walkable(Math.floor(d.x), Math.floor(d.y)), `closed door "${d.name}" is on a solid tile, so stepping into it says nothing`);
    assert.ok(dist(Math.floor(d.x), Math.floor(d.y)) > 0, `closed door "${d.name}" cannot be reached from the spawn`);
    // it is a real doorway in the wall: the tile on the far side of the wall is solid (nothing is behind it)
    const far = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !walkable(Math.floor(d.x) + dx, Math.floor(d.y) + dy)
      && walkable(Math.floor(d.x) - dx, Math.floor(d.y) - dy));
    assert.ok(far.length >= 1, `closed door "${d.name}" does not sit in a wall with the floor on one side`);
  }
  assert.ok(reasons.size >= 8, `lines are too samey: only ${reasons.size} distinct`);
  for (const room of REQUIRED_ROOMS) {
    const rule = rules.find((r) => r.match.startsWith(room));
    assert.ok(rule.reason.includes(room), `the line for "${room}" does not name the room: ${rule.reason}`);
  }
  // every doorLocks rule still names a real object
  for (const rule of rules) assert.ok(objects.some((o) => o.name === rule.match), `doorLocks names "${rule.match}", which is not on the map`);
});

test('ADR 0020: world.js treats a Tiled door marked `closed` as a locked warp (toast + thud), and never door-assists into it', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  assert.match(src, /o\.props\.to \|\| o\.props\.closed/, 'computeWarpPoints() does not accept closed doors');
  assert.match(src, /!w\.closed/, 'doorAssist() would steer into closed doors');
});

// ---------- every tile the map uses is a real, drawn tile ----------

test('ADR 0020: every tile the map references exists in assets/tiles.json and tiles.png, and openTiles names are real', () => {
  const png = fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png'));
  const pngHeight = png.readUInt32BE(20);
  const rows = Math.ceil(tileInfo.tiles.length / tileInfo.columns);
  assert.ok(pngHeight >= rows * 16, 'tiles.png is shorter than tiles.json says');
  const used = new Set();
  for (const layer of json.layers.filter((l) => l.type === 'tilelayer')) {
    for (const gid of layer.data) {
      if (!gid) continue;
      assert.ok(gid <= tileInfo.tiles.length, `${layer.name} has gid ${gid} beyond the tile list`);
      used.add(names[gid - 1]);
    }
  }
  for (const needed of ['intFloorOak', 'intTerrariumTL', 'intSofaRed', 'intSofaBlue', 'intTotemTop', 'intGlassPanel', 'intDoorOffice']) {
    assert.ok(used.has(needed), `the map never uses ${needed}`);
  }
  for (const o of objects) {
    if (!o.props.openTiles) continue;
    for (const n of String(o.props.openTiles).split(',')) assert.ok(names.includes(n.trim()), `"${o.name}" openTiles names unknown tile "${n}"`);
  }
});

// ---------- ambient students stand on real floor of the new layout ----------

test('ADR 0020: the foyer and wing students stand on real floor, 3+ tiles from the volunteer, the stairs and every door', () => {
  const entries = AMBIENT['main-block-g'];
  assert.ok(entries.length >= 4 && entries.length <= 10, `expected a handful of students, found ${entries.length}`);
  const volunteer = MAPS['main-block-g'].npcs.find((n) => n.id === 'lug-volunteer');
  const keepAway = [{ x: volunteer.x, y: volunteer.y }, { x: stairs.x, y: stairs.y }, ...objects.filter((o) => o.type === 'door').map((d) => ({ x: d.x, y: d.y }))];
  let inFoyer = 0;
  for (const e of entries) {
    const pts = e.kind === 'patrol' ? e.waypoints : [{ x: e.x, y: e.y }];
    const standing = e.kind === 'patrol' ? [pts[0], pts[pts.length - 1]] : pts;
    for (const p of pts) {
      assert.ok(walkable(Math.floor(p.x), Math.floor(p.y)), `${e.id}: (${p.x},${p.y}) is not walkable`);
      assert.ok(dist(Math.floor(p.x), Math.floor(p.y)) > 0, `${e.id}: (${p.x},${p.y}) cannot be reached from the spawn`);
    }
    for (const p of standing) {
      for (const k of keepAway) assert.ok(Math.hypot(p.x - k.x, p.y - k.y) >= 3, `${e.id} stands within 3 tiles of (${k.x},${k.y})`);
      if (p.x >= FOYER.x0 && p.x <= FOYER.x1 && p.y >= FOYER.y0 && p.y <= FOYER.y1) inFoyer++;
    }
  }
  assert.ok(inFoyer >= 3, 'too few students in the foyer itself');
});

// ---------- the upper floors are untouched ----------

// SHA-256 of the committed upper-floor maps' CONTENT (everything but the `tilesets` header) from before the
// ADR 0020 rebuild. The tileset header (tilecount/imageheight) is excluded on purpose: every generated map
// restates the size of the shared tile list (interiors.test.js and campus.test.js check it), so appending
// the new foyer tiles rewrites that one line in every map, upper floors included. Layers, objects,
// properties and ids must not move. If the upper floors are ever deliberately rebuilt (the owner's feedback,
// a later ADR), update these together with that change.
// 2026-10-04 (defect sweep D07 + D06), a deliberate, justified change: all three hashes were re-pinned.
//   - main-block-1/2/3: the "(down)" stairs objects now say `facing: left` instead of `right`, so arriving by the stairs
//     below lands on the flight's own walkable tile instead of inside the stairwell's east wall (tools/interiors/plans.js
//     stairwell(); the arrival rule is in tests/unit/completeness.test.js and tests/unit/main-block-stairs.test.js).
//   - main-block-2: the landing is furnished (FURNISHERS.lounge, defect D06).
// Nothing else on the upper floors moved: the old hashes are in git history (16c79daa..., 9f2e13a8..., 5df58a8e...).
const UPPER_FLOOR_CONTENT_HASHES = {
  'main-block-1': '332bfaa6647ddcaafbff45202fc0fa9ff7c526c662d610c3274b42e39b5e57fd',
  'main-block-2': 'b5db0bf7980438d0c8f5a01c1c454dc52c56adb0f4fa61bf61138d4a57be0b8c',
  'main-block-3': '2a9cadb7b2fedffd72b62650cc03f70b3da129b80a60b8117e390096f842719d',
};
for (const [key, hash] of Object.entries(UPPER_FLOOR_CONTENT_HASHES)) {
  test(`ADR 0020: ${key} has exactly its pre-rebuild layers, objects and properties (only the tileset size header may change)`, () => {
    const { tilesets, ...content } = JSON.parse(fs.readFileSync(mapPath(key), 'utf8'));
    assert.ok(tilesets && tilesets.length === 1);
    const actual = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
    assert.equal(actual, hash, `${key}.json changed: the ground-floor rebuild must not touch the upper floors`);
  });
}
