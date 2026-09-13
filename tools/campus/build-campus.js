// Builds the BITS Pilani Dubai campus map from OpenStreetMap + tools/campus/layout.js (ADR 0007).
// Run:   npm run campus            (after `npm run assets`, because it reads assets/tiles.json)
// Output: assets/maps/campus.json   Tiled map (layers: ground, structures, objects)
//         docs/research/campus-greybox.png   preview, 2 px per tile
// `--out <dir>` writes both files into <dir> instead (the tests use this).
// Map data © OpenStreetMap contributors (ODbL).
const fs = require('fs');
const path = require('path');
const layout = require('./layout');
const { encodePNG } = require('../lib/png');

const ROOT = path.join(__dirname, '..', '..');
const TILE_PX = 16;
const MPT = layout.metersPerTile;

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : null;
const MAP_OUT = outDir ? path.join(outDir, 'campus.json') : path.join(ROOT, 'assets', 'maps', 'campus.json');
const PREVIEW_OUT = outDir ? path.join(outDir, 'campus-greybox.png') : path.join(ROOT, 'docs', 'research', 'campus-greybox.png');

const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const TILE = Object.fromEntries(tileInfo.tiles.map((tile, i) => [tile.name, i]));
for (const name of ['sand', 'campusGround', 'grass', 'asphalt', 'paving', 'parking', 'track', 'turf', 'court', 'fence', 'bitsRoof', 'bitsWall', 'bitsDoor', 'otherRoof', 'otherWall']) {
  if (!(name in TILE)) throw new Error(`assets/tiles.json has no tile "${name}". Run npm run assets first.`);
}

// ---------- read OpenStreetMap ----------

const xml = fs.readFileSync(path.join(__dirname, layout.osmFile), 'utf8');
const nodes = new Map();
for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) nodes.set(m[1], [Number(m[2]), Number(m[3])]);

const mPerLat = 111320;
const mPerLon = 111320 * Math.cos((layout.origin.lat * Math.PI) / 180);
const A = (layout.frameAngleDeg * Math.PI) / 180;
const sign = layout.flip ? -1 : 1;

function toFrame([lat, lon]) {
  const e = (lon - layout.origin.lon) * mPerLon;
  const n = (lat - layout.origin.lat) * mPerLat;
  return [sign * (e * Math.cos(A) + n * Math.sin(A)), sign * (e * Math.sin(A) - n * Math.cos(A))];
}

const ways = [];
for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  const tags = Object.fromEntries([...m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)].map((t) => [t[1], t[2]]));
  const points = [...m[2].matchAll(/<nd ref="(\d+)"/g)].map((r) => nodes.get(r[1])).filter(Boolean).map(toFrame);
  if (points.length >= 2) ways.push({ id: Number(m[1]), tags, points });
}
const wayById = new Map(ways.map((w) => [w.id, w]));
const need = (id) => {
  const way = wayById.get(id);
  if (!way) throw new Error(`OSM way ${id} (from layout.js) is not in ${layout.osmFile}`);
  return way;
};

// ---------- geometry ----------

const centroid = (points) => {
  const pts = isClosed(points) ? points.slice(0, -1) : points;
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
};
function isClosed(points) {
  const a = points[0];
  const b = points[points.length - 1];
  return points.length > 3 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}
function rotateAround(points, [cu, cv], deg) {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return points.map(([u, v]) => [cu + (u - cu) * c - (v - cv) * s, cv + (u - cu) * s + (v - cv) * c]);
}
// Dominant wall direction, folded into (-45, 45] degrees (0 = lined up with the grid)
function dominantAngle(points) {
  const bins = new Array(90).fill(0);
  for (let i = 0; i < points.length - 1; i++) {
    const du = points[i + 1][0] - points[i][0];
    const dv = points[i + 1][1] - points[i][1];
    const deg = (((Math.atan2(dv, du) * 180) / Math.PI) % 90 + 90) % 90;
    bins[Math.floor(deg) % 90] += Math.hypot(du, dv);
  }
  const best = bins.indexOf(Math.max(...bins)) + 0.5;
  return best > 45 ? best - 90 : best;
}
function pointInPolygon(u, v, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i];
    const [uj, vj] = poly[j];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}
function distToSegment(pu, pv, [au, av], [bu, bv]) {
  const du = bu - au;
  const dv = bv - av;
  const len2 = du * du + dv * dv || 1e-9;
  const t = Math.max(0, Math.min(1, ((pu - au) * du + (pv - av) * dv) / len2));
  return Math.hypot(pu - (au + t * du), pv - (av + t * dv));
}

// ---------- straighten off-grid parts ----------

const straightened = new Set();
for (const group of layout.straighten) {
  const anchorWays = group.anchors.map(need);
  const center = centroid(anchorWays.flatMap((w) => centroid(w.points)).reduce((acc, value, i) => {
    if (i % 2 === 0) acc.push([value]);
    else acc[acc.length - 1].push(value);
    return acc;
  }, []));
  const angle = dominantAngle(anchorWays.flatMap((w) => w.points));
  const entrance = centroid(need(group.entranceWay).points);

  // Of the four grid-aligned rotations, pick the one that puts the entrance most directly below
  let best = null;
  for (const turn of [0, 90, -90, 180]) {
    const deg = -angle + turn;
    const [[eu, ev]] = rotateAround([entrance], center, deg);
    const du = eu - center[0];
    const dv = ev - center[1];
    const score = dv > 0 ? Math.abs(du) / dv : Infinity;
    if (!best || score < best.score) best = { deg, score };
  }

  const members = ways.filter((w) => {
    if (group.anchors.includes(w.id)) return true;
    const [u, v] = centroid(w.points);
    const inside = Math.hypot(u - center[0], v - center[1]) <= group.radiusMeters;
    return inside && Math.abs(dominantAngle(w.points)) > 20 && !w.tags.barrier && !layout.buildings[w.id];
  });
  for (const w of members) {
    w.points = rotateAround(w.points, center, best.deg);
    straightened.add(w.id);
  }
  const after = dominantAngle(anchorWays.flatMap((w) => w.points));
  console.log(`${group.name}: walls were ${angle.toFixed(1)}° off grid → rotated ${best.deg.toFixed(1)}° (${members.length} ways), now ${after.toFixed(1)}°`);
}

// Other off-grid buildings (other campuses) are squared up around their own centre
for (const w of ways) {
  if (!w.tags.building || straightened.has(w.id) || layout.buildings[w.id]) continue;
  const angle = dominantAngle(w.points);
  if (Math.abs(angle) > 8) w.points = rotateAround(w.points, centroid(w.points), -angle);
}

// ---------- DIAC ring (measured in layout.js; its OSM ways include connector roads, so fitting is unreliable) ----------

const ringFit = layout.diacRing;

// ---------- grid: campus fence + the DIAC ring, plus a margin ----------

const fencePoints = need(layout.campusFence).points;
const margin = layout.boundsMarginMeters;
const boundU = [...fencePoints.map((p) => p[0]), ringFit.center[0] - ringFit.radius, ringFit.center[0] + ringFit.radius];
const boundV = [...fencePoints.map((p) => p[1]), ringFit.center[1] - ringFit.radius, ringFit.center[1] + ringFit.radius];
const extend = layout.boundsExtend || {};
const minU = Math.floor(Math.min(Math.min(...boundU) - margin, extend.minU ?? Infinity) / MPT) * MPT;
const minV = Math.floor(Math.min(Math.min(...boundV) - margin, extend.minV ?? Infinity) / MPT) * MPT;
const maxU = Math.ceil(Math.max(Math.max(...boundU) + margin, extend.maxU ?? -Infinity) / MPT) * MPT;
const maxV = Math.ceil(Math.max(Math.max(...boundV) + margin, extend.maxV ?? -Infinity) / MPT) * MPT;
const W = Math.round((maxU - minU) / MPT);
const H = Math.round((maxV - minV) / MPT);
console.log(`DIAC ring: centre (${ringFit.center.map((n) => n.toFixed(0)).join(', ')}) m, radius ${ringFit.radius.toFixed(0)} m; map frame u ${minU}..${maxU}, v ${minV}..${maxV}`);

const ground = new Int32Array(W * H).fill(TILE.sand);
const structures = new Int32Array(W * H).fill(-1);
const roofOwner = new Int32Array(W * H).fill(-1); // index into buildingList

const cellU = (x) => minU + (x + 0.5) * MPT;
const cellV = (y) => minV + (y + 0.5) * MPT;
const toCell = ([u, v]) => [Math.floor((u - minU) / MPT), Math.floor((v - minV) / MPT)];
const inGrid = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

function eachCellIn(minPu, minPv, maxPu, maxPv, fn) {
  const [x0, y0] = toCell([minPu, minPv]);
  const [x1, y1] = toCell([maxPu, maxPv]);
  for (let y = Math.max(0, y0); y <= Math.min(H - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) fn(x, y, cellU(x), cellV(y));
  }
}
function fillPolygon(points, fn) {
  const us = points.map((p) => p[0]);
  const vs = points.map((p) => p[1]);
  eachCellIn(Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs), (x, y, u, v) => {
    if (pointInPolygon(u, v, points)) fn(x, y);
  });
}
function strokePolyline(points, width, fn) {
  const r = width / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    eachCellIn(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (x, y, u, v) => {
      if (distToSegment(u, v, a, b) <= r) fn(x, y);
    });
  }
}
const setGround = (tile) => (x, y) => (ground[y * W + x] = tile);

// ---------- paint ground ----------

// DIAC Park: everything inside the ring road starts as lawn
const ringCenter = ringFit.center;
const ringRadius = ringFit.radius;
eachCellIn(ringCenter[0] - ringRadius, ringCenter[1] - ringRadius, ringCenter[0] + ringRadius, ringCenter[1] + ringRadius, (x, y, u, v) => {
  if (Math.hypot(u - ringCenter[0], v - ringCenter[1]) < ringRadius - 6) ground[y * W + x] = TILE.grass;
});

// Campus grounds (BITS and neighbouring universities)
for (const w of ways) if (w.tags.amenity === 'university' && isClosed(w.points)) fillPolygon(w.points, setGround(TILE.campusGround));
for (const w of ways) if (w.tags.amenity === 'parking' && isClosed(w.points)) fillPolygon(w.points, setGround(TILE.parking));
for (const f of layout.manual.filter((f) => f.kind === 'lawn')) fillRect(f.rect, TILE.grass);

// Roads and paths
const PAVED = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway']);
const roadOrder = (w) => (PAVED.has(w.tags.highway) ? 0 : 1);
for (const w of ways.filter((w) => w.tags.highway && layout.roadWidths[w.tags.highway]).sort((a, b) => roadOrder(a) - roadOrder(b))) {
  const width = w.tags.service === 'parking_aisle' ? 5 : layout.roadWidths[w.tags.highway];
  strokePolyline(w.points, width, setGround(PAVED.has(w.tags.highway) ? TILE.paving : TILE.asphalt));
}

// Hand-measured sports grounds and parking
function fillRect([u, v, w, h], tile) {
  eachCellIn(u, v, u + w - 0.001, v + h - 0.001, (x, y) => (ground[y * W + x] = tile));
}
for (const f of layout.manual) {
  if (f.kind === 'court') fillRect(f.rect, TILE.court);
  if (f.kind === 'parking') fillRect(f.rect, TILE.parking);
  if (f.kind === 'track') {
    const r = f.width / 2;
    const a = [f.center[0] - f.length / 2 + r, f.center[1]];
    const b = [f.center[0] + f.length / 2 - r, f.center[1]];
    eachCellIn(f.center[0] - f.length / 2, f.center[1] - r, f.center[0] + f.length / 2, f.center[1] + r, (x, y, u, v) => {
      const d = distToSegment(u, v, a, b);
      if (d <= r - f.laneWidth) ground[y * W + x] = TILE.turf;
      else if (d <= r) ground[y * W + x] = TILE.track;
    });
  }
}

// ---------- buildings: roof on the footprint, front wall below it ----------

const buildingList = [];
for (const w of ways) {
  if (!w.tags.building || !isClosed(w.points)) continue;
  const meta = layout.buildings[w.id];
  const info = {
    id: w.id,
    name: meta?.name || w.tags.name || null,
    style: meta?.style || 'other',
    wallTiles: meta?.wallTiles ?? layout.otherBuildingWallTiles,
    door: Boolean(meta?.door),
    unverified: Boolean(meta?.unverified),
    cells: [],
  };
  const index = buildingList.push(info) - 1;
  fillPolygon(w.points, (x, y) => {
    roofOwner[y * W + x] = index;
    info.cells.push([x, y]);
  });
}

const roofTile = (b) => (b.style === 'bits' ? TILE.bitsRoof : TILE.otherRoof);
const wallTile = (b) => (b.style === 'bits' ? TILE.bitsWall : TILE.otherWall);
for (const b of buildingList) for (const [x, y] of b.cells) structures[y * W + x] = roofTile(b);
for (const b of buildingList) {
  const index = buildingList.indexOf(b);
  for (const [x, y] of b.cells) {
    if (inGrid(x, y + 1) && roofOwner[(y + 1) * W + x] === index) continue; // not the bottom edge
    for (let k = 1; k <= b.wallTiles; k++) {
      if (!inGrid(x, y + k) || roofOwner[(y + k) * W + x] !== -1) break;
      structures[(y + k) * W + x] = wallTile(b);
    }
  }
}

// ---------- campus fence (gaps where roads and paths cross) ----------

const fence = need(layout.campusFence);
strokePolyline(fence.points, MPT * 0.9, (x, y) => {
  const i = y * W + x;
  if (structures[i] !== -1) return;
  if (ground[i] === TILE.asphalt || ground[i] === TILE.paving) return;
  structures[i] = TILE.fence;
});

// ---------- doors ----------

const objects = [];
let nextObjectId = 1;
const pointObject = (type, name, x, y, properties = []) =>
  objects.push({ id: nextObjectId++, name, type, x: (x + 0.5) * TILE_PX, y: (y + 0.5) * TILE_PX, width: 0, height: 0, rotation: 0, visible: true, point: true, properties });

for (const b of buildingList.filter((b) => b.door)) {
  const group = layout.straighten.find((g) => g.anchors.includes(b.id));
  const target = group ? centroid(need(group.entranceWay).points) : centroid(b.cells.map(([x, y]) => [cellU(x), cellV(y)]));
  const [tx] = toCell(target);
  const bottomWall = new Map(); // column -> lowest wall row belonging to this building
  const index = buildingList.indexOf(b);
  for (const [x, y] of b.cells) {
    if (inGrid(x, y + 1) && roofOwner[(y + 1) * W + x] === index) continue;
    let k = 1;
    while (k <= b.wallTiles && inGrid(x, y + k) && structures[(y + k) * W + x] === wallTile(b)) k++;
    if (k > 1) bottomWall.set(x, Math.max(bottomWall.get(x) ?? -1, y + k - 1));
  }
  const columns = [...bottomWall.keys()].sort((a, b2) => Math.abs(a - tx) - Math.abs(b2 - tx));
  if (!columns.length) throw new Error(`${b.name}: no front wall to put a door in`);
  const dx = columns[0];
  const dy = bottomWall.get(dx);
  structures[dy * W + dx] = TILE.bitsDoor;
  pointObject('door', `${b.name} entrance`, dx, dy, [{ name: 'building', type: 'string', value: b.name }]);
}

// ---------- objects: spawn and zones ----------

const walkable = (x, y) => inGrid(x, y) && structures[y * W + x] === -1 ? !tileInfo.tiles[ground[y * W + x]].solid : inGrid(x, y) && structures[y * W + x] !== -1 && !tileInfo.tiles[structures[y * W + x]].solid;

const spawnBase = centroid(need(layout.spawn.nearWay).points);
let [sx, sy] = toCell([spawnBase[0] + layout.spawn.offsetMeters[0], spawnBase[1] + layout.spawn.offsetMeters[1]]);
if (!walkable(sx, sy)) {
  // nearest walkable cell
  let found = null;
  for (let r = 1; r < 30 && !found; r++) {
    for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) if (walkable(sx + dx, sy + dy)) found = [sx + dx, sy + dy];
  }
  if (!found) throw new Error('No walkable spawn near the gate');
  [sx, sy] = found;
}
pointObject('spawn', 'spawn', sx, sy, [{ name: 'facing', type: 'string', value: layout.spawn.facing }]);

const rectObject = (type, name, x0, y0, x1, y1, properties = []) =>
  objects.push({ id: nextObjectId++, name, type, x: x0 * TILE_PX, y: y0 * TILE_PX, width: (x1 - x0 + 1) * TILE_PX, height: (y1 - y0 + 1) * TILE_PX, rotation: 0, visible: true, properties });
const bbox = (cells) => [Math.min(...cells.map((c) => c[0])), Math.min(...cells.map((c) => c[1])), Math.max(...cells.map((c) => c[0])), Math.max(...cells.map((c) => c[1]))];

for (const b of buildingList.filter((b) => b.name && b.cells.length)) {
  const [x0, y0, x1, y1] = bbox(b.cells);
  rectObject('building', b.name, x0, y0, x1, y1 + b.wallTiles, [
    { name: 'style', type: 'string', value: b.style },
    { name: 'unverified', type: 'bool', value: b.unverified },
  ]);
}
for (const f of layout.manual) {
  const [u, v, w, h] = f.rect || [f.center[0] - f.length / 2, f.center[1] - f.width / 2, f.length, f.width];
  const [x0, y0] = toCell([u, v]);
  const [x1, y1] = toCell([u + w, v + h]);
  rectObject('area', f.name, x0, y0, x1, y1, [{ name: 'kind', type: 'string', value: f.kind }]);
}
{
  const [x0, y0] = toCell([ringCenter[0] - ringRadius, ringCenter[1] - ringRadius]);
  const [x1, y1] = toCell([ringCenter[0] + ringRadius, ringCenter[1] + ringRadius]);
  rectObject('area', 'DIAC Park', x0, y0, x1, y1, [{ name: 'kind', type: 'string', value: 'park' }]);
}

// ---------- write Tiled JSON ----------

const columns = tileInfo.columns;
const tilesetRows = Math.ceil(tileInfo.tiles.length / columns);
const gids = (arr) => Array.from(arr, (t) => (t < 0 ? 0 : t + 1));
const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE_PX,
  tileheight: TILE_PX,
  nextlayerid: 4,
  nextobjectid: nextObjectId,
  properties: [
    { name: 'name', type: 'string', value: 'BITS Pilani, Dubai Campus' },
    { name: 'metersPerTile', type: 'float', value: MPT },
    { name: 'generatedBy', type: 'string', value: 'tools/campus/build-campus.js' },
    { name: 'attribution', type: 'string', value: 'Map data © OpenStreetMap contributors (ODbL)' },
  ],
  tilesets: [
    { firstgid: 1, name: 'tiles', image: '../tiles.png', imagewidth: columns * TILE_PX, imageheight: tilesetRows * TILE_PX, tilewidth: TILE_PX, tileheight: TILE_PX, tilecount: tileInfo.tiles.length, columns, margin: 0, spacing: 0 },
  ],
  layers: [
    { id: 1, name: 'ground', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(ground) },
    { id: 2, name: 'structures', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(structures) },
    { id: 3, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
  ],
};

fs.mkdirSync(path.dirname(MAP_OUT), { recursive: true });
fs.writeFileSync(MAP_OUT, JSON.stringify(map) + '\n');

// ---------- preview PNG (2 px per tile) ----------

const SCALE = 2;
const rgba = Buffer.alloc(W * SCALE * H * SCALE * 4);
const colors = tileInfo.tiles.map((t) => [parseInt(t.color.slice(1, 3), 16), parseInt(t.color.slice(3, 5), 16), parseInt(t.color.slice(5, 7), 16)]);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = structures[y * W + x] !== -1 ? structures[y * W + x] : ground[y * W + x];
    const [r, g, b] = colors[t];
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        const i = ((y * SCALE + dy) * W * SCALE + x * SCALE + dx) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  }
}
fs.mkdirSync(path.dirname(PREVIEW_OUT), { recursive: true });
fs.writeFileSync(PREVIEW_OUT, encodePNG(W * SCALE, H * SCALE, rgba));

console.log(`campus: ${W}x${H} tiles (${W * MPT}x${H * MPT} m), ${buildingList.length} buildings, ${objects.length} objects, spawn at ${sx},${sy}`);
console.log(`wrote ${path.relative(ROOT, MAP_OUT)} and ${path.relative(ROOT, PREVIEW_OUT)}`);
