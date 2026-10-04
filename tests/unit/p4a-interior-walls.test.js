// P4a (2026-10-05): Main Block interiors. FB-0059 (the dirt-brown void is solid black), FB-0058 / FB-0060 / FB-0065 (doors and
// windows in a wall that runs up and down the screen are drawn side-on, never front-on) and FB-0062 (the Library is straight
// ahead of the entrance, through a double door in the foyer's back wall into a small lobby, not a door in the left wall).
// Everything reads the REAL generated maps and tiles.png, so a later generator change that breaks one fails here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const { MAPS, AMBIENT, tileInfo, gridFromTiled, tiledObjects, isWalkableTile } = loadGameData();
const NAMES = tileInfo.tiles.map((t) => t.name);
const KEYS = [
  'main-block-g', 'main-block-1', 'main-block-2', 'main-block-3',
  'library-block-g', 'library-block-1', 'mechanical-block-g', 'mechanical-block-1',
];
const atlas = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));

const load = (key) => {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${key}.json`), 'utf8'));
  const layer = (name) => json.layers.find((l) => l.name === name).data;
  const nameAt = (data, x, y) => (x < 0 || y < 0 || x >= json.width || y >= json.height ? null : (data[y * json.width + x] ? NAMES[data[y * json.width + x] - 1] : null));
  return { key, json, W: json.width, H: json.height, ground: layer('ground'), structures: layer('structures'), nameAt, objects: tiledObjects(json), grid: gridFromTiled(json) };
};
const maps = Object.fromEntries(KEYS.map((k) => [k, load(k)]));

function tilePixels(name) {
  const i = NAMES.indexOf(name);
  assert.ok(i >= 0, `tile ${name} is not in assets/tiles.json`);
  const sx = (i % tileInfo.columns) * 16;
  const sy = Math.floor(i / tileInfo.columns) * 16;
  const out = [];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const o = ((sy + y) * atlas.width + sx + x) * 4;
      out.push([atlas.data[o], atlas.data[o + 1], atlas.data[o + 2], atlas.data[o + 3]]);
    }
  }
  return out;
}

// ---------- FB-0059: black void ----------

test('FB-0059: no interior map contains the old dirt-brown `edge` void tile, and its replacement `intVoid` is solid and pure black', () => {
  for (const m of Object.values(maps)) {
    for (const [layerName, data] of [['ground', m.ground], ['structures', m.structures]]) {
      const bad = [];
      for (let i = 0; i < data.length; i++) if (data[i] && NAMES[data[i] - 1] === 'edge') bad.push(`(${i % m.W},${Math.floor(i / m.W)})`);
      assert.equal(bad.length, 0, `${m.key}/${layerName} still has the dirt tile at ${bad.slice(0, 5).join(' ')}`);
    }
    let voidCells = 0;
    for (const g of m.ground) if (g && NAMES[g - 1] === 'intVoid') voidCells++;
    assert.ok(voidCells > 100, `${m.key} has only ${voidCells} void cells`);
  }
  const voidTile = tileInfo.tiles[NAMES.indexOf('intVoid')];
  assert.equal(voidTile.solid, true, 'the void must be solid');
  for (const px of tilePixels('intVoid')) assert.deepEqual(px, [0, 0, 0, 255], 'every pixel of the void tile must be solid black');
});

test('FB-0059: indoors, the camera background is black too (nothing brown or blue-grey shows at the screen edges)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  assert.match(src, /if \(this\.def\.indoors\) this\.cameras\.main\.setBackgroundColor\('#000000'\)/);
});

// ---------- FB-0058 / FB-0060 / FB-0065: side-on doors and windows in vertical walls ----------

const FRONT_ON = new Set(['intDoorway', 'intDoorClosed', 'intGlassDoor', 'intDoorOffice', 'intDoorFlush', 'intDoorDarkL', 'intDoorDarkR', 'intWallWindow']);
const SIDE = {
  L: ['intDoorClosedSideL', 'intGlassDoorSideL', 'intDoorOfficeSideL', 'intDoorFlushSideL', 'intDoorDarkSideL', 'intWallWindowSideL'],
  R: ['intDoorClosedSideR', 'intGlassDoorSideR', 'intDoorOfficeSideR', 'intDoorFlushSideR', 'intDoorDarkSideR', 'intWallWindowSideR'],
};
const ALL_SIDE = new Set([...SIDE.L, ...SIDE.R, 'intDoorwaySide']);
const WALL_LINE = /^(bitsWall|intWall|intDoor|intGlassDoor|intNameplate|intProjectorScreen|intNoticeboard|intLift|intGlassPanel|bitsSignSeg|libSignSeg)/;

// the same neighbour rule the generator uses: a cell is in a vertical wall when the cells above and below it are wall line
// and the cells left and right of it are not both wall line
function orientation(m, x, y) {
  const line = (cx, cy) => WALL_LINE.test(m.nameAt(m.structures, cx, cy) || '') || WALL_LINE.test(m.nameAt(m.ground, cx, cy) || '');
  return { horizontal: line(x - 1, y) && line(x + 1, y), vertical: line(x, y - 1) && line(x, y + 1) };
}

function doorCells(m) {
  const cells = [];
  for (let y = 0; y < m.H; y++) {
    for (let x = 0; x < m.W; x++) {
      for (const [layer, data] of [['structures', m.structures], ['ground', m.ground]]) {
        const name = m.nameAt(data, x, y);
        if (name && (FRONT_ON.has(name) || ALL_SIDE.has(name))) cells.push({ x, y, name, layer });
      }
    }
  }
  return cells;
}

test('FB-0058/FB-0060/FB-0065: the side-on door/window tiles exist, are whole 16x16 cells with the right solidity, mirror each other and differ from the front-on art', () => {
  const solidOf = (n) => tileInfo.tiles[NAMES.indexOf(n)].solid;
  for (const side of ['L', 'R']) {
    for (const name of SIDE[side]) {
      const front = name.replace(/Side[LR]$/, '');
      const px = tilePixels(name);
      assert.equal(px.length, 256, `${name} is not a 16x16 tile`);
      assert.ok(px.every((p) => p[3] === 255), `${name} has transparent pixels (it must replace the wall tile whole)`);
      const frontSolid = front === 'intDoorDark' ? false : solidOf(front);
      assert.equal(solidOf(name), frontSolid, `${name} must be as solid as ${front}`);
    }
  }
  assert.equal(solidOf('intDoorwaySide'), false, 'the side doorway must be walkable');
  for (let i = 0; i < SIDE.L.length; i++) {
    const a = tilePixels(SIDE.L[i]);
    const b = tilePixels(SIDE.R[i]);
    let same = 0;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a[y * 16 + x].join() === b[y * 16 + 15 - x].join()) same++;
    assert.ok(same >= 230, `${SIDE.L[i]} / ${SIDE.R[i]} are not mirror images (${same}/256 pixels match)`);
  }
  assert.notDeepEqual(tilePixels('intDoorOfficeSideL'), tilePixels('intDoorOffice'));
  assert.notDeepEqual(tilePixels('intDoorwaySide'), tilePixels('intDoorway'));
});

test('FB-0058: no front-on door or window tile sits in a vertical wall of any interior map, and every side variant is in one', () => {
  let sideCount = 0;
  for (const m of Object.values(maps)) {
    for (const c of doorCells(m)) {
      const { horizontal, vertical } = orientation(m, c.x, c.y);
      assert.ok(horizontal || vertical, `${m.key}: ${c.name} at (${c.x},${c.y}) is not in any wall line`);
      if (ALL_SIDE.has(c.name)) {
        sideCount++;
        assert.ok(vertical, `${m.key}: side tile ${c.name} at (${c.x},${c.y}) is NOT in a vertical wall`);
      } else if (vertical && !horizontal) {
        assert.fail(`${m.key}: front-on ${c.name} at (${c.x},${c.y}) stands in a vertical wall (it must be its side variant)`);
      }
    }
  }
  assert.ok(sideCount >= 20, `expected the side variants to be used widely, found ${sideCount}`);
});

test('FB-0058: the window-style frosted door at the Director\'s Office (main-block-g 2,24) is the LEFT-wall side variant, with floor to its right', () => {
  const m = maps['main-block-g'];
  assert.equal(m.nameAt(m.structures, 2, 24), 'intDoorOfficeSideL');
  assert.ok(isWalkableTile(m.grid, tileInfo, 3, 24), 'the room must be on the right of a left-wall door');
});

test('FB-0058: the L/R form follows which side the room is on (every map)', () => {
  for (const m of Object.values(maps)) {
    for (const c of doorCells(m).filter((d) => d.layer === 'structures' && ALL_SIDE.has(d.name))) {
      const floorRight = m.nameAt(m.ground, c.x + 1, c.y) !== 'intVoid';
      const floorLeft = m.nameAt(m.ground, c.x - 1, c.y) !== 'intVoid';
      if (floorRight && !floorLeft) assert.match(c.name, /SideL$/, `${m.key} (${c.x},${c.y}) has its room on the right`);
      if (floorLeft && !floorRight) assert.match(c.name, /SideR$/, `${m.key} (${c.x},${c.y}) has its room on the left`);
    }
  }
  const g = maps['main-block-g'];
  assert.equal(g.nameAt(g.structures, 37, 25), 'intDoorOfficeSideR', 'Student Welfare is in a right-hand wall');
  assert.equal(g.nameAt(g.structures, 10, 11), 'intDoorFlushSideR', 'Mini Mart is in a right-hand wall');
});

test('FB-0060: the foyer\'s left-wall door (Career Services) faces right into the hall, not at the player: a LEFT side variant; the Library door that was beside it is gone', () => {
  const g = maps['main-block-g'];
  const d = g.objects.find((o) => o.type === 'door' && o.name === 'Career Services door');
  assert.ok(d);
  assert.equal(g.nameAt(g.structures, Math.floor(d.x), Math.floor(d.y)), 'intDoorFlushSideL');
  const t = g.nameAt(g.structures, 10, 17);
  assert.ok(t && /^intWallFace/.test(t), `(10,17) is ${t}`);
});

test('FB-0065: the Main Block stairwell doorway (main-block-1, 30,17..18) is the side-on doorway, and no doorway tile reads as a black opening', () => {
  const m = maps['main-block-1'];
  assert.equal(m.nameAt(m.ground, 30, 17), 'intDoorwaySide');
  assert.equal(m.nameAt(m.ground, 30, 18), 'intDoorwaySide');
  const horizontal = [];
  for (let x = 0; x < m.W; x++) if (m.nameAt(m.ground, x, 14) === 'intDoorway') horizontal.push(x);
  assert.ok(horizontal.length >= 4, `expected the ICL and Room 195 doorways on the corridor's top wall, found ${horizontal.length}`);
  for (const name of ['intDoorway', 'intDoorwaySide']) {
    const dark = tilePixels(name).filter(([r, g, b]) => r + g + b < 200).length;
    assert.ok(dark < 70, `${name} is ${dark}/256 near-black pixels: it still reads as a black hole`);
  }
});

// ---------- FB-0062: the Library is straight ahead ----------

test('FB-0062: a double door in the foyer\'s back wall at the centre leads into a bright Library lobby; the Library door is on that lobby\'s back wall', () => {
  const g = maps['main-block-g'];
  const foyer = g.objects.find((o) => o.type === 'area' && o.name === 'Foyer');
  const lobby = g.objects.find((o) => o.type === 'area' && o.name === 'Library Lobby');
  assert.ok(lobby, 'no "Library Lobby" area');
  const backWallY = Math.round(foyer.y) - 1;
  const axis = Math.round(foyer.x + foyer.width / 2); // the hall's centre line, as an edge coordinate
  const doorway = [];
  for (let x = 0; x < g.W; x++) if (g.nameAt(g.ground, x, backWallY) === 'intDoorway') doorway.push(x);
  assert.deepEqual(doorway, [axis - 1, axis], `expected a 2-wide doorway centred on the axis in the back wall (y ${backWallY}), found ${doorway}`);
  assert.equal(Math.round(lobby.y + lobby.height), backWallY, 'the lobby is not directly behind the foyer back wall');
  assert.equal(Math.round(lobby.x * 2 + lobby.width), axis * 2, 'the lobby is not centred on the hall axis');
  assert.ok(lobby.width >= 7 && lobby.width <= 9 && lobby.height >= 4 && lobby.height <= 5, `the lobby is ${lobby.width}x${lobby.height}`);
  const names = new Set();
  for (let y = Math.round(lobby.y); y < lobby.y + lobby.height; y++) {
    for (let x = Math.round(lobby.x); x < lobby.x + lobby.width; x++) {
      assert.equal(g.nameAt(g.ground, x, y), 'intFloorOak', `lobby floor at (${x},${y}) is not the foyer's oak`);
      names.add(g.nameAt(g.structures, x, y));
    }
  }
  assert.ok(names.has('bench'), 'no bench in the lobby');
  assert.ok(names.has('intBigPlantTop'), 'no plant in the lobby');
  const doorRow = Math.round(lobby.y) - 1;
  const libDoors = g.objects.filter((o) => o.type === 'door' && o.name === 'Library door');
  assert.equal(libDoors.length, 2, 'the Library door should be a double door (two cells)');
  for (const d of libDoors) assert.equal(Math.floor(d.y), doorRow, 'a Library door is not on the lobby back wall');
  assert.deepEqual(libDoors.map((d) => Math.floor(d.x)).sort((a, b) => a - b), [axis - 1, axis]);
  const sign = ['libSignSeg0', 'libSignSeg1', 'libSignSeg2'].map((n) => {
    for (let x = 0; x < g.W; x++) if (g.nameAt(g.structures, x, doorRow) === n) return x;
    return -1;
  });
  assert.ok(sign.every((x) => x >= 0) && sign[1] === sign[0] + 1 && sign[2] === sign[1] + 1, 'the "LIBRARY" sign is missing from the lobby back wall');
});

test('FB-0062: the lobby is reachable from the foyer spawn, and the Library door keeps its old closed-door rules (no `to`, same doorLocks line)', () => {
  const g = maps['main-block-g'];
  const spawn = g.objects.find((o) => o.type === 'spawn');
  const seen = new Set([`${Math.floor(spawn.x)},${Math.floor(spawn.y)}`]);
  const queue = [[Math.floor(spawn.x), Math.floor(spawn.y)]];
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = `${nx},${ny}`;
      if (seen.has(k) || !isWalkableTile(g.grid, tileInfo, nx, ny)) continue;
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  const libDoors = g.objects.filter((o) => o.type === 'door' && o.name === 'Library door');
  for (const d of libDoors) {
    assert.ok(seen.has(`${Math.floor(d.x)},${Math.floor(d.y)}`), 'a Library door cannot be reached from the spawn');
    assert.equal(d.props.closed, true);
    assert.equal(d.props.to, undefined, 'the Library door must stay a closed door, as it was');
  }
  const rule = MAPS['main-block-g'].doorLocks.find((r) => r.match === 'Library door');
  assert.ok(rule && !rule.stages && rule.reason.includes('Library'), 'the Library door lost its doorLocks line');
});

test('FB-0062: there is exactly one Library entrance (the old left-wall one is gone), and no ambient student stands in the lobby', () => {
  const g = maps['main-block-g'];
  const foyer = g.objects.find((o) => o.type === 'area' && o.name === 'Foyer');
  const leftWallX = Math.round(foyer.x) - 1;
  const libDoors = g.objects.filter((o) => o.type === 'door' && /^Library/.test(o.name));
  assert.equal(libDoors.length, 2, 'exactly one (double) Library entrance');
  for (const d of libDoors) assert.notEqual(Math.floor(d.x), leftWallX, 'a Library door is still in the foyer left wall');
  const lobby = g.objects.find((o) => o.type === 'area' && o.name === 'Library Lobby');
  for (const e of AMBIENT['main-block-g']) {
    const pts = e.kind === 'patrol' ? e.waypoints : [{ x: e.x, y: e.y }];
    for (const p of pts) {
      const inside = p.x >= lobby.x - 1 && p.x < lobby.x + lobby.width + 1 && p.y >= lobby.y - 1 && p.y < lobby.y + lobby.height + 1;
      assert.ok(!inside, `${e.id} stands in the Library lobby`);
    }
  }
});
