// Builds the BITS Pilani Dubai campus map from the hand-designed plan in tools/campus/layout.js
// (ADR 0008: a straight schematic, not a rasterisation of OpenStreetMap). tools/campus/diac.osm
// stays in the repo as the measurement reference the plan's numbers were taken from, but this
// script no longer parses it: every shape below is an axis-aligned rectangle or straight line.
// Run:   npm run assets && npm run campus
// Output: assets/maps/campus.json   Tiled map (layers: ground, structures, overhead, objects)
//         docs/research/campus-greybox.png   preview, 2 px per tile
// `--out <dir>` writes both files into <dir> instead (tests use this to check the map is up to date).
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
const REQUIRED_TILES = [
  'sand', 'lawn', 'lawn2', 'hedge', 'bush', 'flowerbed',
  'treeTrunk', 'treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR',
  'palmTrunk', 'palmCanopyTL', 'palmCanopyTR', 'palmCanopyBL', 'palmCanopyBR',
  'asphalt', 'paving', 'parking', 'track', 'turf', 'walkway',
  'kerbT', 'kerbB', 'kerbL', 'kerbR', 'kerbTL', 'kerbTR', 'kerbBL', 'kerbBR', 'roadLineH', 'roadLineV', 'crossingH', 'crossingV',
  'court', 'courtLineH', 'courtLineV', 'courtCornerTL', 'courtCornerTR', 'courtCornerBL', 'courtCornerBR', 'courtCenterMark', 'courtNet',
  'bitsRoof', 'bitsRoofT', 'bitsRoofL', 'bitsRoofR', 'bitsRoofTL', 'bitsRoofTR', 'bitsWallPlain', 'bitsWall', 'bitsWallEndL', 'bitsWallEndR', 'bitsEntranceL', 'bitsEntranceR', 'bitsPillar',
  'otherRoof', 'otherRoofT', 'otherRoofL', 'otherRoofR', 'otherRoofTL', 'otherRoofTR', 'otherWallPlain', 'otherWall', 'otherWallEndL', 'otherWallEndR',
  'fenceH', 'fenceV', 'fenceCornerTL', 'fenceCornerTR', 'fenceCornerBL', 'fenceCornerBR', 'fenceGate',
];
for (const name of REQUIRED_TILES) {
  if (!(name in TILE)) throw new Error(`assets/tiles.json has no tile "${name}". Run npm run assets first.`);
}

// ---------- work out the map's bounding box from every feature in the plan ----------

const fenceBox = { x0: 0, y0: 0, x1: layout.fence.width - 1, y1: layout.fence.height - 1 };
const ringBox = {
  x0: layout.diacRing.center[0] - layout.diacRing.radius,
  y0: layout.diacRing.center[1] - layout.diacRing.radius,
  x1: layout.diacRing.center[0] + layout.diacRing.radius,
  y1: layout.diacRing.center[1] + layout.diacRing.radius,
};
const allBoxes = [
  fenceBox,
  ringBox,
  layout.d54,
  layout.ringRoad,
  { x0: layout.avenue.x0, y0: layout.fence.height, x1: layout.avenue.x1, y1: layout.outerApproachY1 },
  ...layout.otherBuildings,
];
const margin = layout.boundsMargin;
const minX = Math.min(...allBoxes.map((b) => b.x0)) - margin;
const minY = Math.min(...allBoxes.map((b) => b.y0)) - margin;
const maxX = Math.max(...allBoxes.map((b) => b.x1)) + margin;
const maxY = Math.max(...allBoxes.map((b) => b.y1)) + margin;
const W = Math.ceil(maxX - minX) + 1;
const H = Math.ceil(maxY - minY) + 1;
if (W > 600 || H > 600) throw new Error(`campus map is ${W}x${H} tiles, over the 600-tile limit`);

// Every plan coordinate is local (fence north-west corner = 0,0); shift by (offX, offY) to land on the grid.
const offX = -Math.floor(minX);
const offY = -Math.floor(minY);
const gx = (x) => x + offX;
const gy = (y) => y + offY;

const ground = new Int32Array(W * H).fill(TILE.sand);
const structures = new Int32Array(W * H).fill(-1);
const overhead = new Int32Array(W * H).fill(-1);

const inGrid = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
function forRect(x0, y0, x1, y1, fn) {
  const gx0 = Math.max(0, Math.round(gx(x0)));
  const gy0 = Math.max(0, Math.round(gy(y0)));
  const gx1 = Math.min(W - 1, Math.round(gx(x1)));
  const gy1 = Math.min(H - 1, Math.round(gy(y1)));
  for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) fn(x, y);
}
const setGround = (x0, y0, x1, y1, tile) => forRect(x0, y0, x1, y1, (x, y) => (ground[y * W + x] = tile));
const setStruct = (x0, y0, x1, y1, tile) => forRect(x0, y0, x1, y1, (x, y) => (structures[y * W + x] = tile));
const isLawn = (x, y) => inGrid(x, y) && (ground[y * W + x] === TILE.lawn || ground[y * W + x] === TILE.lawn2) && structures[y * W + x] === -1;
// Only paints over untouched lawn, so decorations (hedges, flowerbeds, trees) never corrupt a
// road/building/court placed earlier, even if two features' numbers happen to overlap a little.
function structOnLawn(x, y, tile) {
  if (isLawn(x, y)) structures[y * W + x] = tile;
}

// ---------- ground fill: lawn inside the fence and the DIAC ring, sand (desert) elsewhere ----------

function lawnPatch(x, y) {
  return (Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0 ? TILE.lawn : TILE.lawn2;
}
setGround(fenceBox.x0, fenceBox.y0, fenceBox.x1, fenceBox.y1, TILE.lawn);
forRect(fenceBox.x0, fenceBox.y0, fenceBox.x1, fenceBox.y1, (x, y) => (ground[y * W + x] = lawnPatch(x - offX, y - offY)));
{
  const [cu, cv] = layout.diacRing.center;
  const r = layout.diacRing.radius;
  forRect(cu - r, cv - r, cu + r, cv + r, (x, y) => {
    const du = x - gx(cu);
    const dv = y - gy(cv);
    if (Math.hypot(du, dv) < r - 3) ground[y * W + x] = lawnPatch(x - offX, y - offY);
  });
}

// ---------- roads: kerb border + paved/asphalt interior, constant width along their length ----------

function kerbSide(x, y, x0, y0, x1, y1) {
  const top = y === y0;
  const bottom = y === y1;
  const left = x === x0;
  const right = x === x1;
  if (top && left) return 'kerbTL';
  if (top && right) return 'kerbTR';
  if (bottom && left) return 'kerbBL';
  if (bottom && right) return 'kerbBR';
  if (top) return 'kerbT';
  if (bottom) return 'kerbB';
  if (left) return 'kerbL';
  if (right) return 'kerbR';
  return null;
}
// A road or plaza rectangle: kerb tiles around the border, `fillName` inside. `laneAxis` ('h' or
// 'v') draws a dashed centre line the length of the road; omit it for a plaza (no lane markings).
function paveRect(x0, y0, x1, y1, fillName, laneAxis) {
  const gx0 = Math.round(gx(x0));
  const gy0 = Math.round(gy(y0));
  const gx1 = Math.round(gx(x1));
  const gy1 = Math.round(gy(y1));
  const midX = Math.round((gx0 + gx1) / 2);
  const midY = Math.round((gy0 + gy1) / 2);
  forRect(x0, y0, x1, y1, (x, y) => {
    const side = kerbSide(x, y, gx0, gy0, gx1, gy1);
    if (side) {
      structures[y * W + x] = -1;
      ground[y * W + x] = TILE[side];
      return;
    }
    let tile = TILE[fillName];
    if (laneAxis === 'v' && x === midX && (y - gy0) % 4 < 2) tile = TILE.roadLineV;
    if (laneAxis === 'h' && y === midY && (x - gx0) % 4 < 2) tile = TILE.roadLineH;
    ground[y * W + x] = tile;
  });
}
function crossing(x0, y0, x1, y1, axis) {
  setGround(x0, y0, x1, y1, axis === 'v' ? TILE.crossingV : TILE.crossingH);
}

paveRect(layout.d54.x0, layout.d54.y0, layout.d54.x1, layout.d54.y1, 'asphalt', 'h');
paveRect(layout.ringRoad.x0, layout.ringRoad.y0, layout.ringRoad.x1, layout.ringRoad.y1, 'asphalt', 'h');
paveRect(layout.avenue.x0, layout.fence.height, layout.avenue.x1, layout.outerApproachY1, 'asphalt', 'v'); // outside the fence, south of the gate
paveRect(layout.avenue.x0, layout.avenueInnerY1, layout.avenue.x1, layout.fence.height - 1, 'asphalt', 'v'); // inside the fence, up to the plaza
paveRect(layout.plaza.x0, layout.plaza.y0, layout.plaza.x1, layout.plaza.y1, 'paving');

// ---------- internal pedestrian walkways: one constant width, brick paving ----------

for (const w of layout.walkways) {
  setGround(w.x0, w.y0, w.x1, w.y1, TILE.walkway);
}
// where the entrance avenue (a road) crosses the walkway spine, mark a crossing across the road
crossing(layout.avenue.x0 + 1, layout.walkways[0].y0, layout.avenue.x1 - 1, layout.walkways[0].y1, 'v');

// ---------- parking, courts, track ----------

paveRect(layout.parking.x0, layout.parking.y0, layout.parking.x1, layout.parking.y1, 'parking');
for (const c of layout.otherCourts) setGround(c.x0, c.y0, c.x1, c.y1, TILE.court);

{
  const { center, length, width, laneWidth } = layout.track;
  const r = width / 2;
  const a = [center[0] - length / 2 + r, center[1]];
  const b = [center[0] + length / 2 - r, center[1]];
  forRect(center[0] - length / 2, center[1] - r, center[0] + length / 2, center[1] + r, (x, y) => {
    const u = x - offX;
    const v = y - offY;
    const t = Math.max(0, Math.min(1, ((u - a[0]) * (b[0] - a[0]) + (v - a[1]) * (b[1] - a[1])) / ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2 || 1)));
    const px = a[0] + t * (b[0] - a[0]);
    const py = a[1] + t * (b[1] - a[1]);
    const d = Math.hypot(u - px, v - py);
    if (d <= r - laneWidth) ground[y * W + x] = TILE.turf;
    else if (d <= r) ground[y * W + x] = TILE.track;
  });
}

// Tennis courts: the standard 18x9 kit from STYLE_GUIDE "Campus kit" (also documented above
// courtSurface() in tools/make-assets.js). Net redrawn as a single line (small art fix, FB-0016).
function tennisCourt(x0, y0) {
  const at = (dx, dy, name) => (ground[gy(y0 + dy) * W + gx(x0 + dx)] = TILE[name]);
  for (let dx = 0; dx <= 17; dx++) for (let dy = 0; dy <= 8; dy++) at(dx, dy, 'sand');
  for (let dx = 3; dx <= 14; dx++) {
    at(dx, 1, 'courtLineH');
    at(dx, 7, 'courtLineH');
  }
  for (let dy = 2; dy <= 6; dy++) {
    at(2, dy, 'courtLineV');
    at(15, dy, 'courtLineV');
    at(5, dy, 'courtLineV');
    at(12, dy, 'courtLineV');
    at(8, dy, 'courtNet');
    at(9, dy, 'courtNet');
  }
  at(6, 4, 'courtLineH');
  at(7, 4, 'courtLineH');
  at(10, 4, 'courtLineH');
  at(11, 4, 'courtLineH');
  at(2, 1, 'courtCornerTL');
  at(15, 1, 'courtCornerTR');
  at(2, 7, 'courtCornerBL');
  at(15, 7, 'courtCornerBR');
  at(2, 4, 'courtCenterMark');
  at(15, 4, 'courtCenterMark');
  for (let dx = 3; dx <= 14; dx++) for (let dy = 2; dy <= 6; dy++) if (ground[gy(y0 + dy) * W + gx(x0 + dx)] === TILE.sand) at(dx, dy, 'court');
}
for (const court of layout.tennisCourts) tennisCourt(court.x0, court.y0);

// ---------- DIAC Park: straight cross-shaped walkways through the ring ----------

for (const p of layout.parkPaths) setGround(p.x0, p.y0, p.x1, p.y1, TILE.walkway);

// ---------- buildings: parapet roof, front wall, small windows, an entrance for the ones with doors ----------

function drawBuilding(b) {
  const bits = b.style === 'bits';
  const roofFlat = bits ? TILE.bitsRoof : TILE.otherRoof;
  const roofT = bits ? TILE.bitsRoofT : TILE.otherRoofT;
  const roofL = bits ? TILE.bitsRoofL : TILE.otherRoofL;
  const roofR = bits ? TILE.bitsRoofR : TILE.otherRoofR;
  const roofTL = bits ? TILE.bitsRoofTL : TILE.otherRoofTL;
  const roofTR = bits ? TILE.bitsRoofTR : TILE.otherRoofTR;
  const wallPlain = bits ? TILE.bitsWallPlain : TILE.otherWallPlain;
  const wallWindow = bits ? TILE.bitsWall : TILE.otherWall;
  const wallEndL = bits ? TILE.bitsWallEndL : TILE.otherWallEndL;
  const wallEndR = bits ? TILE.bitsWallEndR : TILE.otherWallEndR;

  const roofY1 = b.y1 - b.wallTiles;
  forRect(b.x0, b.y0, b.x1, roofY1, (x, y) => {
    const lx = Math.round(x - offX);
    const ly = Math.round(y - offY);
    let tile = roofFlat;
    if (ly === b.y0 && lx === b.x0) tile = roofTL;
    else if (ly === b.y0 && lx === b.x1) tile = roofTR;
    else if (ly === b.y0) tile = roofT;
    else if (lx === b.x0) tile = roofL;
    else if (lx === b.x1) tile = roofR;
    structures[y * W + x] = tile;
  });

  const doorX0 = Math.round((b.x0 + b.x1) / 2);
  const doorX1 = doorX0 + 1;
  for (let ly = roofY1 + 1; ly <= b.y1; ly++) {
    const isBottomRow = ly === b.y1;
    forRect(b.x0, ly, b.x1, ly, (x, y) => {
      const lx = Math.round(x - offX);
      let tile;
      if (lx === b.x0) tile = wallEndL;
      else if (lx === b.x1) tile = wallEndR;
      else tile = (lx - b.x0) % 4 === 2 ? wallWindow : wallPlain;
      if (bits && b.door && isBottomRow && (lx === doorX0 || lx === doorX1)) {
        tile = lx === doorX0 ? TILE.bitsEntranceL : TILE.bitsEntranceR;
      }
      structures[y * W + x] = tile;
    });
  }
  if (bits && b.door) {
    structOnLawn(gx(doorX0 - 2), gy(b.y1 + 1), TILE.bitsPillar);
    structOnLawn(gx(doorX1 + 2), gy(b.y1 + 1), TILE.bitsPillar);
  }
}
for (const b of layout.buildings) drawBuilding(b);
for (const b of layout.otherBuildings) drawBuilding(b);

// ---------- campus fence: a closed straight loop, broken only by the two gates ----------

function inSpan(v, a, b) {
  return v >= Math.min(a, b) && v <= Math.max(a, b);
}
{
  const { x0, y0, x1, y1 } = fenceBox;
  for (let x = x0; x <= x1; x++) {
    const gate = inSpan(x, layout.gate2.x0, layout.gate2.x1);
    structures[gy(y0) * W + gx(x)] = x === x0 ? TILE.fenceCornerTL : x === x1 ? TILE.fenceCornerTR : TILE.fenceH;
    structures[gy(y1) * W + gx(x)] = x === x0 ? TILE.fenceCornerBL : x === x1 ? TILE.fenceCornerBR : gate ? TILE.fenceGate : TILE.fenceH;
  }
  for (let y = y0 + 1; y < y1; y++) {
    const gate = inSpan(y, layout.sideGate.y0, layout.sideGate.y1);
    structures[gy(y) * W + gx(x0)] = gate ? TILE.fenceGate : TILE.fenceV;
    structures[gy(y) * W + gx(x1)] = TILE.fenceV;
  }
  // clear the fence line's ground so it doesn't show sand/lawn seams through the fence sprite
  setGround(x0, y0, x1, y0, TILE.lawn);
  setGround(x0, y1, x1, y1, TILE.lawn);
  setGround(x0, y0, x0, y1, TILE.lawn);
  setGround(x1, y0, x1, y1, TILE.lawn);
}

// ---------- green: hedges + flowerbeds near the gates and Main Block, then trees and palms ----------

for (let x = layout.plaza.x0; x <= layout.plaza.x1; x++) {
  if (inSpan(x, layout.avenue.x0 - 1, layout.avenue.x1 + 1)) continue;
  structOnLawn(gx(x), gy(layout.plaza.y0 - 2), TILE.hedge);
}
structOnLawn(gx(Math.round((layout.mainBlock.x0 + layout.mainBlock.x1) / 2) - 3), gy(layout.mainBlock.y1 + 1), TILE.flowerbed);
structOnLawn(gx(Math.round((layout.mainBlock.x0 + layout.mainBlock.x1) / 2) + 4), gy(layout.mainBlock.y1 + 1), TILE.flowerbed);
structOnLawn(gx(layout.gate2.x0 - 3), gy(layout.fence.height - 2), TILE.flowerbed);
structOnLawn(gx(layout.gate2.x1 + 3), gy(layout.fence.height - 2), TILE.flowerbed);

function plantTree(cx, topY, kind) {
  const cells = [
    [cx, topY], [cx + 1, topY], [cx, topY + 1], [cx + 1, topY + 1], // 2x2 canopy footprint
    [cx, topY + 2], // trunk, directly under the canopy's left column
  ];
  if (!cells.every(([x, y]) => isLawn(gx(x), gy(y)))) return false;
  const canopy = kind === 'palm'
    ? ['palmCanopyTL', 'palmCanopyTR', 'palmCanopyBL', 'palmCanopyBR']
    : ['treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR'];
  overhead[gy(topY) * W + gx(cx)] = TILE[canopy[0]];
  overhead[gy(topY) * W + gx(cx + 1)] = TILE[canopy[1]];
  overhead[gy(topY + 1) * W + gx(cx)] = TILE[canopy[2]];
  overhead[gy(topY + 1) * W + gx(cx + 1)] = TILE[canopy[3]];
  structures[gy(topY + 2) * W + gx(cx)] = TILE[kind === 'palm' ? 'palmTrunk' : 'treeTrunk'];
  return true;
}

// Palm avenue: date palms lining the entrance road, per the owner's note that the real campus has
// many palms "especially along the entrance" (FB-0015).
for (let y = layout.palmAvenue.y0; y <= layout.palmAvenue.y1; y += layout.palmAvenue.step) {
  plantTree(layout.palmAvenue.leftCol, y, 'palm');
  plantTree(layout.palmAvenue.rightCol, y, 'palm');
}

// Shade trees scattered across the lawn: a deterministic hash so the map is reproducible, not a
// random-every-run generator. Skips any cell that isn't still plain lawn (road/building/court/etc.).
function hash(x, y) {
  let h = (x * 73856093) ^ (y * 19349663) ^ layout.treeScatter.seed;
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}
let treeCount = 0;
for (let y = fenceBox.y0 + 4; y < fenceBox.y1 - 4; y += layout.treeScatter.stepY) {
  for (let x = fenceBox.x0 + 4; x < fenceBox.x1 - 4; x += layout.treeScatter.stepX) {
    if (hash(x, y) % layout.treeScatter.keepOneIn !== 0) continue;
    const kind = hash(x + 1, y + 1) % 5 === 0 ? 'palm' : 'tree';
    if (plantTree(x, y, kind)) treeCount++;
  }
}
{
  const [cu, cv] = layout.diacRing.center;
  const r = layout.diacRing.radius;
  for (let y = cv - r + 4; y < cv + r - 4; y += layout.treeScatter.stepY) {
    for (let x = cu - r + 4; x < cu + r - 4; x += layout.treeScatter.stepX) {
      if (Math.hypot(x - cu, y - cv) > r - 8) continue;
      if (hash(x, y) % layout.treeScatter.keepOneIn !== 0) continue;
      if (plantTree(x, y, hash(x + 1, y + 1) % 5 === 0 ? 'palm' : 'tree')) treeCount++;
    }
  }
}

// ---------- objects: spawn, gates, doors, building zones, areas ----------

const objects = [];
let nextObjectId = 1;
const pointObject = (type, name, x, y, properties = []) =>
  objects.push({ id: nextObjectId++, name, type, x: (x + 0.5) * TILE_PX, y: (y + 0.5) * TILE_PX, width: 0, height: 0, rotation: 0, visible: true, point: true, properties });
const rectObject = (type, name, x0, y0, x1, y1, properties = []) =>
  objects.push({ id: nextObjectId++, name, type, x: gx(x0) * TILE_PX, y: gy(y0) * TILE_PX, width: (x1 - x0 + 1) * TILE_PX, height: (y1 - y0 + 1) * TILE_PX, rotation: 0, visible: true, properties });

const walkable = (x, y) => inGrid(x, y) && (structures[y * W + x] !== -1 ? !tileInfo.tiles[structures[y * W + x]].solid : !tileInfo.tiles[ground[y * W + x]].solid);

let [sx, sy] = [gx(layout.spawn.x), gy(layout.spawn.y)];
if (!walkable(sx, sy)) {
  let found = null;
  for (let r = 1; r < 20 && !found; r++) {
    for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) if (walkable(sx + dx, sy + dy)) found = [sx + dx, sy + dy];
  }
  if (!found) throw new Error('No walkable spawn near Gate 2');
  [sx, sy] = found;
}
pointObject('spawn', 'spawn', sx, sy, [{ name: 'facing', type: 'string', value: layout.spawn.facing }]);

pointObject('gate', 'Gate 2 (Main Entrance)', gx((layout.gate2.x0 + layout.gate2.x1) / 2), gy(layout.fence.height - 1), [{ name: 'main', type: 'bool', value: true }]);
pointObject('gate', 'Side Gate', gx(0), gy((layout.sideGate.y0 + layout.sideGate.y1) / 2), [{ name: 'main', type: 'bool', value: false }]);

// P4 (Gate 2 welcome cutscene, own worktree): a trigger a few tiles inside Gate 2, spanning the
// avenue's width, so walking in from the gate plays the cutscene once (src/scenes/world.js reads
// `type: 'cutscene'` objects and their `cutscene` property; CUTSCENES lives in src/cutscenes.js).
// Self-contained on purpose — safe to re-add after a layout.js rebuild lands from package P2.
rectObject('cutscene', 'Gate 2 welcome cutscene', layout.avenue.x0, layout.fence.height - 10, layout.avenue.x1, layout.fence.height - 6, [
  { name: 'cutscene', type: 'string', value: 'gate2' },
]);

for (const b of [layout.mainBlock, layout.libraryBlock, layout.mechanicalBlock]) {
  const doorX0 = Math.round((b.x0 + b.x1) / 2);
  pointObject('door', `${b.name} entrance`, gx(doorX0), gy(b.y1), [{ name: 'building', type: 'string', value: b.name }]);
}

for (const b of [...layout.buildings, ...layout.otherBuildings]) {
  rectObject('building', b.name, b.x0, b.y0, b.x1, b.y1, [
    { name: 'style', type: 'string', value: b.style },
    { name: 'unverified', type: 'bool', value: Boolean(b.unverified) },
  ]);
}
rectObject('area', 'Central Lawn', layout.mainBlock.x0, layout.mainBlock.y1 + 2, layout.mainBlock.x1, layout.plaza.y0 - 3, [{ name: 'kind', type: 'string', value: 'lawn' }]);
rectObject('area', 'Athletics Track', layout.track.center[0] - layout.track.length / 2, layout.track.center[1] - layout.track.width / 2, layout.track.center[0] + layout.track.length / 2, layout.track.center[1] + layout.track.width / 2, [{ name: 'kind', type: 'string', value: 'track' }]);
rectObject('area', 'Tennis Courts', layout.tennisCourts[0].x0, layout.tennisCourts[0].y0, layout.tennisCourts[layout.tennisCourts.length - 1].x0 + 17, layout.tennisCourts[0].y0 + 8, [{ name: 'kind', type: 'string', value: 'court' }]);
for (const c of layout.otherCourts) rectObject('area', c.name, c.x0, c.y0, c.x1, c.y1, [{ name: 'kind', type: 'string', value: 'court' }]);
rectObject('area', 'Student Parking', layout.parking.x0, layout.parking.y0, layout.parking.x1, layout.parking.y1, [{ name: 'kind', type: 'string', value: 'parking' }]);
rectObject('area', 'DIAC Park', ringBox.x0, ringBox.y0, ringBox.x1, ringBox.y1, [{ name: 'kind', type: 'string', value: 'park' }]);
rectObject('area', 'BITS Pilani, Dubai Campus', fenceBox.x0, fenceBox.y0, fenceBox.x1, fenceBox.y1, [{ name: 'kind', type: 'string', value: 'campus' }]);

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
  nextlayerid: 5,
  nextobjectid: nextObjectId,
  properties: [
    { name: 'name', type: 'string', value: 'BITS Pilani, Dubai Campus' },
    { name: 'metersPerTile', type: 'float', value: MPT },
    { name: 'generatedBy', type: 'string', value: 'tools/campus/build-campus.js' },
    { name: 'attribution', type: 'string', value: 'Map data © OpenStreetMap contributors (ODbL); a hand-designed schematic plan (ADR 0008), not a rasterisation' },
  ],
  tilesets: [
    { firstgid: 1, name: 'tiles', image: '../tiles.png', imagewidth: columns * TILE_PX, imageheight: tilesetRows * TILE_PX, tilewidth: TILE_PX, tileheight: TILE_PX, tilecount: tileInfo.tiles.length, columns, margin: 0, spacing: 0 },
  ],
  layers: [
    { id: 1, name: 'ground', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(ground) },
    { id: 2, name: 'structures', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(structures) },
    { id: 4, name: 'overhead', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(overhead) },
    { id: 3, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
  ],
};

fs.mkdirSync(path.dirname(MAP_OUT), { recursive: true });
fs.writeFileSync(MAP_OUT, JSON.stringify(map) + '\n');

// ---------- preview PNG (2 px per tile); overhead canopies drawn over whatever's underneath ----------

const SCALE = 2;
const rgba = Buffer.alloc(W * SCALE * H * SCALE * 4);
const colors = tileInfo.tiles.map((t) => [parseInt(t.color.slice(1, 3), 16), parseInt(t.color.slice(3, 5), 16), parseInt(t.color.slice(5, 7), 16)]);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = overhead[y * W + x] !== -1 ? overhead[y * W + x] : structures[y * W + x] !== -1 ? structures[y * W + x] : ground[y * W + x];
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

console.log(`campus: ${W}x${H} tiles (${W * MPT}x${H * MPT} m), ${layout.buildings.length + layout.otherBuildings.length} buildings, ${treeCount} trees/palms, ${objects.length} objects, spawn at ${sx},${sy}`);
console.log(`wrote ${path.relative(ROOT, MAP_OUT)} and ${path.relative(ROOT, PREVIEW_OUT)}`);
