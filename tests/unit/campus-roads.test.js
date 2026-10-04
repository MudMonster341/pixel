// Road autotile, roundabout, west road and parking-lot regression tests (P3a: FB-0047, FB-0048, FB-0049,
// FB-0054, FB-0055) plus the crop renderer the coordinator uses to look at the map (tools/render-map-crop.js).
// Pure autotile rules are tested on hand-made grids; the generated map is checked from assets/maps/campus.json.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const autotile = require('../../tools/campus/autotile');
const { renderCrop } = require('../../tools/render-map-crop');

const ROOT = path.join(__dirname, '..', '..');
const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', 'campus.json'), 'utf8'));
const NAMES = tileInfo.tiles.map((t) => t.name);
const W = map.width;
const H = map.height;
const layer = (name) => map.layers.find((l) => l.name === name).data;
const groundL = layer('ground');
const structL = layer('structures');
const ground = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : NAMES[groundL[y * W + x] - 1]);
const struct = (x, y) => (x < 0 || y < 0 || x >= W || y >= H || !structL[y * W + x] ? null : NAMES[structL[y * W + x] - 1]);
const objects = map.layers.find((l) => l.type === 'objectgroup').objects;
const area = (name) => objects.find((o) => o.type === 'area' && o.name === name);
const isRoad = (n) => n === 'asphalt' || n === 'roadLineH' || n === 'roadLineV' || (n || '').startsWith('crossing');
const isKerb = (n) => (n || '').startsWith('kerb');

// ASCII grid -> class function: R road, P pavement, I island pavement, C other hard ground, anything else open ground.
function gridOf(rows) {
  return { w: rows[0].length, h: rows.length, cls: (x, y) => (rows[y] && rows[y][x] && 'RPIC'.includes(rows[y][x]) ? rows[y][x] : 'O') };
}
const tileAt = (rows, x, y) => autotile.autotileKerbs(rows[0].length, rows.length, gridOf(rows).cls).tiles.get(`${x},${y}`);

// ---------- tools/render-map-crop.js ----------

test('render-map-crop: a 2x2 tile crop at scale 3 is 96x96 px and draws real tile pixels', () => {
  const img = renderCrop('campus', 245, 150, 2, 2, 3, { objects: false });
  assert.equal(img.width, 2 * 16 * 3);
  assert.equal(img.height, 2 * 16 * 3);
  assert.equal(img.rgba.length, 96 * 96 * 4);
  // the road is not black: the crop really composites tiles
  assert.ok(img.rgba[0] + img.rgba[1] + img.rgba[2] > 0);
  const marked = renderCrop('campus', 240, 150, 12, 12, 1, { objects: true });
  assert.equal(marked.width, 12 * 16);
});

// ---------- autotile rules on hand-made grids ----------

test('FB-0054: autotile gives every kerb case its own tile (straight, outer corner, inner corner, strip, cap, island)', () => {
  const f = (o) => autotile.kerbTileName({ N: false, E: false, S: false, W: false, NE: false, SE: false, SW: false, NW: false, ...o });
  assert.equal(f({ N: true }), 'kerbT');
  assert.equal(f({ S: true }), 'kerbB');
  assert.equal(f({ W: true }), 'kerbL');
  assert.equal(f({ E: true }), 'kerbR');
  assert.equal(f({ N: true, W: true }), 'kerbTL');
  assert.equal(f({ S: true, E: true }), 'kerbBR');
  assert.equal(f({ NW: true }), 'kerbInTL');
  assert.equal(f({ SE: true }), 'kerbInBR');
  assert.equal(f({ W: true, E: true }), 'kerbStripV');
  assert.equal(f({ N: true, S: true }), 'kerbStripH');
  assert.equal(f({ W: true, E: true, N: true }), 'kerbCapT');
  assert.equal(f({ N: true, S: true, W: true, E: true }), 'kerbIsland');
  assert.equal(f({}), 'kerbFill');
  for (const n of autotile.KERB_TILE_NAMES) assert.ok(NAMES.includes(n), `tiles.json has no ${n}`);
});

test('FB-0054: a pavement ring round a road turns its corners with outer corner tiles, and a bend with an inner corner', () => {
  // an L-shaped road with pavement on both sides
  const rows = [
    'PPPPPP',
    'PRRRRP',
    'PRRRRP',
    'PPPRRP',
    'OOPRRP',
    'OOPRRP',
    'OOPPPP',
  ];
  assert.equal(tileAt(rows, 0, 0), 'kerbTL');
  assert.equal(tileAt(rows, 3, 0), 'kerbT');
  assert.equal(tileAt(rows, 5, 0), 'kerbTR');
  assert.equal(tileAt(rows, 5, 3), 'kerbR');
  assert.equal(tileAt(rows, 2, 6), 'kerbBL');
  assert.equal(tileAt(rows, 5, 6), 'kerbBR');
  // the pavement cell at the inside of the bend has open ground only diagonally: an inner corner
  assert.equal(tileAt(rows, 2, 3), 'kerbInBL');
  const inner = ['OPPP', 'PPPP', 'PPPP'];
  assert.equal(tileAt(inner, 1, 1), 'kerbInTL');
});

test('FB-0055: a pavement strip left across a junction between two roads becomes road, a splitter island does not', () => {
  const rows = [
    'OOOOOOO',
    'RRRRRRR',
    'PPPPPPP', // a kerb strip left across the junction by two overlapping road rectangles
    'RRRRRRR',
    'OOOOOOO',
  ];
  const { toRoad, tiles } = autotile.autotileKerbs(7, 5, gridOf(rows).cls);
  assert.equal(toRoad.length, 7, 'the stray strip is turned into road');
  assert.equal(tiles.size, 0);
  const splitter = ['RRRR', 'RIIR', 'RIIR', 'RRRR'];
  const s = autotile.autotileKerbs(4, 4, gridOf(splitter).cls);
  assert.equal(s.toRoad.length, 0, 'island pavement between roads stays');
  assert.equal(s.tiles.get('1,1'), 'kerbTL');
  assert.equal(s.tiles.get('2,2'), 'kerbBR');
});

test('FB-0048: a pavement beside another pavement is one surface: no kerb line between them', () => {
  // two pavements touching (a road\'s sidewalk and a car park\'s border): only the outer edges are kerbed
  const rows = ['OOOOO', 'PPPPP', 'PPPPP', 'OOOOO'];
  const { tiles } = autotile.autotileKerbs(5, 4, gridOf(rows).cls);
  assert.equal(tiles.get('2,1'), 'kerbT');
  assert.equal(tiles.get('2,2'), 'kerbB');
});

test('FB-0055: lane dashes stop short of a junction and of a road end', () => {
  const road = new Set();
  for (let x = 0; x < 30; x++) for (const y of [4, 5, 6]) road.add(`${x},${y}`);
  for (let y = 7; y < 14; y++) for (const x of [14, 15, 16]) road.add(`${x},${y}`); // a side road joins from below
  const isR = (x, y) => road.has(`${x},${y}`);
  assert.equal(autotile.laneLineKept(isR, 5, 5, 'h'), true);
  assert.equal(autotile.laneLineKept(isR, 15, 5, 'h'), false, 'no dash through the junction');
  assert.equal(autotile.laneLineKept(isR, 12, 5, 'h'), false, 'none right up against it either');
  assert.equal(autotile.laneLineKept(isR, 1, 5, 'h'), false, 'none at the very end of a road');
  assert.equal(autotile.laneLineKept(isR, 22, 5, 'h'), true);
});

test('FB-0054: a path running straight over a road to a path on the far side is found as a crossing', () => {
  const rows = [
    'OWWWO',
    'OWWWO',
    'OPPPO',
    'RRRRR',
    'RRRRR',
    'OPPPO',
    'OWWWO',
    'OWWWO',
  ];
  const at = (x, y) => (rows[y] || '')[x] || 'O';
  const cross = autotile.findCrossings(5, 8, (x, y) => at(x, y) === 'R', (x, y) => at(x, y) === 'P', (x, y) => at(x, y) === 'W');
  const cells = cross.filter((c) => c.axis === 'v').map((c) => `${c.x},${c.y}`).sort();
  assert.deepEqual(cells, ['1,3', '1,4', '2,3', '2,4', '3,3', '3,4']);
});

// ---------- the generated campus map ----------

test('FB-0054: the Gate 2 roundabout is a closed ring road with its island (lawn and kerbed rim) inside, and every arm joins a road', () => {
  const a = area('Gate 2 Roundabout');
  assert.ok(a, 'no roundabout area');
  const x0 = Math.round(a.x / 16);
  const y0 = Math.round(a.y / 16);
  const w = Math.round(a.width / 16);
  const h = Math.round(a.height / 16);
  assert.ok(w >= 12 && h >= 12, `a roundabout needs room to read round, got ${w}x${h}`);
  const cx = x0 + Math.floor(w / 2);
  const cy = y0 + Math.floor(h / 2);
  // flood outwards from the island centre through everything that is not carriageway (4-connected): it must stay inside the box
  const seen = new Set([`${cx},${cy}`]);
  const q = [[cx, cy]];
  let escaped = false;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < x0 || ny < y0 || nx >= x0 + w || ny >= y0 + h) { escaped = true; continue; }
      if (seen.has(`${nx},${ny}`) || isRoad(ground(nx, ny))) continue;
      seen.add(`${nx},${ny}`);
      q.push([nx, ny]);
    }
  }
  assert.equal(escaped, false, 'the island is not enclosed by a closed ring of road');
  const island = [...seen].map((k) => k.split(',').map(Number));
  assert.ok(island.length >= 20, `the island is only ${island.length} tiles`);
  assert.ok(island.some(([x, y]) => (ground(x, y) || '').startsWith('lawn')), 'no lawn on the island');
  assert.ok(island.some(([x, y]) => isKerb(ground(x, y))), 'no kerbed rim on the island');
  assert.ok(island.some(([x, y]) => struct(x, y) === 'bush'), 'no shrubs on the island');
  // the ring really is round-ish: asphalt on all four diagonals between the island and the outer pavement
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    let found = false;
    for (let k = 3; k <= 7; k++) if (isRoad(ground(cx + sx * k, cy + sy * Math.ceil(k / 1.34)))) found = true;
    assert.ok(found, `no ring road on the (${sx},${sy}) diagonal`);
  }
  // arms: road runs out of the ring north, south, west and east
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    let x = cx + (dx === 0 ? -2 : 0); // north/south arms: the lane beside the splitter island
    let y = cy;
    let steps = 0;
    while (!isRoad(ground(x, y)) && steps++ < 12) { x += dx; y += dy; }
    let run = 0;
    while (isRoad(ground(x, y)) && run < 30) { x += dx; y += dy; run++; }
    assert.ok(run >= 4, `the (${dx},${dy}) arm of the roundabout is only ${run} road tiles long`);
  }
  // the island pavement is walkable and has a splitter island kerbed on all sides in the gate arm
  let splitter = 0;
  for (let y = y0; y < y0 + h + 3; y++) for (let x = x0; x < x0 + w; x++) if (ground(x, y) === 'kerbBR' && isRoad(ground(x + 1, y)) && isRoad(ground(x, y + 1))) splitter++;
  assert.ok(splitter >= 1, 'no splitter island in the gate arm');
});

test('FB-0048: no doubled kerb line anywhere: no kerb facing another kerb across one tile, and no kerb strip across a road (FB-0055)', () => {
  const PLAIN_DOWN = new Set(['kerbB', 'kerbBL', 'kerbBR']);
  const PLAIN_UP = new Set(['kerbT', 'kerbTL', 'kerbTR']);
  const PLAIN_RIGHT = new Set(['kerbR', 'kerbTR', 'kerbBR']);
  const PLAIN_LEFT = new Set(['kerbL', 'kerbTL', 'kerbBL']);
  const doubled = [];
  const strips = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = ground(x, y);
      if (!isKerb(n)) continue;
      // back to back: a south-facing kerb directly above a north-facing one (two kerb lines one above the other)
      if (PLAIN_DOWN.has(n) && PLAIN_UP.has(ground(x, y + 1))) doubled.push([x, y]);
      if (PLAIN_RIGHT.has(n) && PLAIN_LEFT.has(ground(x + 1, y))) doubled.push([x, y]);
      // a plain kerb with carriageway on both opposite sides is a strip across a road
      if (/^kerb(T|B|L|R|TL|TR|BL|BR|Fill)$/.test(n)) {
        if ((isRoad(ground(x, y - 1)) && isRoad(ground(x, y + 1))) || (isRoad(ground(x - 1, y)) && isRoad(ground(x + 1, y)))) strips.push([x, y]);
      }
    }
  }
  assert.deepEqual(doubled.slice(0, 5), [], `${doubled.length} doubled kerb line(s), e.g. at ${doubled[0]}`);
  assert.deepEqual(strips.slice(0, 5), [], `${strips.length} kerb strip(s) across a road, e.g. at ${strips[0]}`);
});

test('FB-0048: the pavement between the loop road and the gate car parks is a single kerbed band (the owner\'s spot, tile 232,141)', () => {
  for (let x = 224; x <= 236; x++) {
    const n = ground(x, 141);
    assert.ok(n === 'kerbB' || n === 'kerbFill' || isKerb(n), `unexpected ${n} at ${x},141`);
    // the row below it is lawn (the car park starts further south), so there is no second kerb row right under the first
    assert.ok(!isKerb(ground(x, 142)) || ground(x, 142) === 'kerbFill', `a second kerb row sits right under the loop road's at ${x},142`);
  }
});

test('FB-0055: the loop road\'s corners and the avenue\'s junction have continuous carriageway and kerbs that join up (tile 262,138)', () => {
  const loop = area('Academic Core Loop Road');
  const x1 = Math.floor((loop.x + loop.width) / 16) - 1;
  const y1 = Math.floor((loop.y + loop.height) / 16) - 1;
  // the south-east corner of the ring: asphalt turns the corner and the outer kerb is a corner tile
  assert.ok(isRoad(ground(x1 - 2, y1 - 2)), 'no road at the loop road\'s south-east corner');
  // no carriageway tile has a kerb tile between it and more carriageway in a straight line (checked globally above); the outer
  // corner of the ring is a single corner kerb
  assert.equal(ground(x1, y1), 'kerbBR');
  // the avenue meets the roundabout without a kerb across it: carriageway straight from the loop road down to the ring
  const gate = objects.find((o) => o.name === 'Gate 2 (Main Entrance)');
  const gx = Math.floor(gate.x / 16);
  for (let y = y1 - 3; y <= y1 + 3; y++) assert.ok(isRoad(ground(gx - 1, y)), `the avenue is not continuous into the loop road at ${gx - 1},${y}`);
});

test('FB-0049: the Gate 2 road continues west of the avenue to a turning circle, with pavement on both sides and no cut-off pieces', () => {
  const gate = objects.find((o) => o.name === 'Gate 2 (Main Entrance)');
  const gx = Math.floor(gate.x / 16);
  // the road row: find the horizontal road south of the gate (the dashed centre line)
  let row = null;
  for (let y = Math.floor(gate.y / 16) + 10; y < Math.floor(gate.y / 16) + 30 && row === null; y++) {
    if (ground(gx - 10, y) === 'roadLineH' || ground(gx - 11, y) === 'roadLineH' || ground(gx - 12, y) === 'roadLineH') row = y;
  }
  assert.ok(row !== null, 'no dashed centre line west of the avenue');
  let x = gx;
  while (isRoad(ground(x - 1, row))) x--;
  assert.ok(gx - x >= 25, `the road only continues ${gx - x} tiles west`);
  // it ends in a turning circle: much taller than the road is wide at the western end
  let tall = 0;
  for (let y = row - 8; y <= row + 8; y++) if (isRoad(ground(x + 4, y))) tall++;
  const roadWidth = (() => { let t = 0; for (let y = row - 8; y <= row + 8; y++) if (isRoad(ground(gx - 12, y))) t++; return t; })();
  assert.ok(tall > roadWidth + 2, `no turning circle at the west end (${tall} vs ${roadWidth})`);
  // pavement on both sides along the straight stretch, one unbroken kerbed band (no cut-off piece)
  for (let px = x + 8; px < gx - 6; px++) {
    let top = row;
    while (isRoad(ground(px, top - 1))) top--;
    let bottom = row;
    while (isRoad(ground(px, bottom + 1))) bottom++;
    assert.ok(isKerb(ground(px, top - 1)) && isKerb(ground(px, bottom + 1)), `no pavement beside the road at column ${px}`);
    assert.equal(ground(px, top - 2) === 'sand' || isKerb(ground(px, top - 2)), true);
  }
  // nothing but sand and kerb beyond the road's west end (no stray cut-off pavement piece left behind)
  for (let y = row - 12; y <= row + 12; y++) {
    const n = ground(x - 8, y);
    assert.ok(n === 'sand', `unexpected ${n} at ${x - 8},${y} west of the road's end`);
  }
});

test('FB-0047: every parking lot has one car per bay, spaced out with empty bays, a driving aisle and kerbed planting islands', () => {
  const lots = objects.filter((o) => o.type === 'area' && /Parking/.test(o.name));
  assert.ok(lots.length >= 3, 'expected the student lot and two gate lots');
  for (const lot of lots) {
    const x0 = Math.floor(lot.x / 16);
    const y0 = Math.floor(lot.y / 16);
    const x1 = Math.ceil((lot.x + lot.width) / 16) - 1;
    const y1 = Math.ceil((lot.y + lot.height) / 16) - 1;
    let bays = 0;
    let cars = 0;
    let islands = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const s = struct(x, y);
        if (ground(x, y) === 'parking') {
          bays++;
          if (s && s.startsWith('car')) {
            cars++;
            // one car per bay: never a car directly behind another (the bumper-to-bumper stack of FB-0047) or three side by side
            assert.ok(!(struct(x, y + 1) || '').startsWith('car') && !(struct(x, y - 1) || '').startsWith('car'), `${lot.name}: two cars stacked at ${x},${y}`);
            assert.ok(!((struct(x - 1, y) || '').startsWith('car') && (struct(x + 1, y) || '').startsWith('car')), `${lot.name}: three cars in a row at ${x},${y}`);
          }
        }
        if (s === 'bush' && (ground(x, y) || '').startsWith('lawn')) islands++;
      }
    }
    assert.ok(bays >= 20, `${lot.name}: only ${bays} bays`);
    assert.ok(cars / bays > 0.2 && cars / bays < 0.65, `${lot.name}: ${cars} cars in ${bays} bays should leave some empty bays but not be a bare lot`);
    assert.ok(islands >= 2, `${lot.name}: no planting islands`);
    // a driving aisle: two rows of plain asphalt between the bay rows
    let aisleRows = 0;
    for (let y = y0; y <= y1; y++) {
      let asphalt = 0;
      for (let x = x0 + 1; x < x1; x++) if (ground(x, y) === 'asphalt') asphalt++;
      if (asphalt >= (x1 - x0 - 2) * 0.8) aisleRows++;
    }
    assert.ok(aisleRows >= 2, `${lot.name}: no two-row driving aisle`);
    // a single clean kerb line round the lot (no kerb row right next to another)
    for (let x = x0 + 1; x < x1; x++) {
      assert.ok(!(isKerb(ground(x, y0)) && isKerb(ground(x, y0 + 1)) && ground(x, y0 + 1) !== 'kerbFill' && ground(x, y0 + 1) !== 'kerbB'), `${lot.name}: double kerb at the top at column ${x}`);
    }
  }
  // the lot's cars are the front-view family the owner liked
  const carNames = new Set();
  for (let i = 0; i < structL.length; i++) if (structL[i] && NAMES[structL[i] - 1].startsWith('car')) carNames.add(NAMES[structL[i] - 1]);
  for (const n of carNames) assert.match(n, /^carFront(Yellow|Red|Green)$/);
});

test('FB-0047: the gate lots\' aisles run straight into the roundabout (west and east arms)', () => {
  const a = area('Gate 2 Roundabout');
  const cy = Math.round(a.y / 16) + Math.floor(Math.round(a.height / 16) / 2);
  for (const lotName of ['Gate Parking (West)', 'Gate Parking (East)']) {
    const lot = area(lotName);
    const lx = Math.floor((lotName.includes('West') ? lot.x + lot.width - 17 : lot.x + 1) / 16);
    assert.ok(isRoad(ground(lx, cy)) && isRoad(ground(lx, cy - 1)), `${lotName}: the aisle does not reach the lot's edge`);
    const ax = lotName.includes('West') ? Math.round(a.x / 16) : Math.round((a.x + a.width) / 16) - 1;
    for (let x = Math.min(lx, ax); x <= Math.max(lx, ax); x++) assert.ok(isRoad(ground(x, cy)), `${lotName}: a gap in the aisle at ${x},${cy}`);
  }
});
