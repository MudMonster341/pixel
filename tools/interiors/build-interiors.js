// Builds every building interior from the plan data in tools/interiors/plans.js (ADR: see
// docs/INTERIORS_PLAN.md). Same idea as tools/campus/build-campus.js: the plan is data (rooms as
// rectangles with a name/type, corridors, connections, doors, stairs), this script is the code that
// turns it into Tiled JSON + a preview PNG per floor.
// Run:    npm run interiors
// Output: assets/maps/<key>.json           one per floor (ground/structures tile layers + objects)
//         docs/research/interiors/<key>.png  preview, 4 px per tile (interiors are small)
// `--out <dir>` writes into <dir> instead (tests use this to check the maps are up to date).
const fs = require('fs');
const path = require('path');
const PLANS = require('./plans');
const { encodePNG } = require('../lib/png');

const ROOT = path.join(__dirname, '..', '..');
const TILE_PX = 16;

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : null;
const MAPS_OUT = outDir ? outDir : path.join(ROOT, 'assets', 'maps');
const PREVIEW_OUT = outDir ? outDir : path.join(ROOT, 'docs', 'research', 'interiors');

const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const TILE = Object.fromEntries(tileInfo.tiles.map((tile, i) => [tile.name, i]));

const REQUIRED_TILES = [
  'edge', 'intDoorway', 'intStairsUp', 'intStairsDown', 'intLift', 'intAtriumVoid', 'intAtriumRailing',
  'intFloorFoyer', 'intFloorClassroom', 'intFloorCarpet', 'intFloorLabVinyl', 'intFloorLibrary',
  'intFloorStage', 'intFloorCourt', 'asphalt',
  'bitsWallPlain', 'bitsWall', 'bitsWallEndL', 'bitsWallEndR',
  'intDesk', 'intTeacherDesk', 'intWhiteboardWall', 'intBench', 'intComputerBench', 'intSink',
  'intCabinet', 'intSofa', 'intNoticeboard', 'intReceptionDesk', 'intLocker', 'intAuditoriumSeat',
  'intBadmintonNet', 'intCourtLineIndoor', 'intTTTable', 'intBed', 'intCurtain', 'intMedicalDesk',
  'intMachine', 'table', 'bookshelf', 'plant',
];
for (const name of REQUIRED_TILES) {
  if (!(name in TILE)) throw new Error(`assets/tiles.json has no tile "${name}". Run npm run assets first.`);
}

// Ground floor tile per room type. Everything not listed gets 'intFloorCarpet'.
const TYPE_FLOOR = {
  office: 'intFloorCarpet', service: 'intFloorCarpet', discussion: 'intFloorCarpet', locker: 'intFloorCarpet', club: 'intFloorCarpet',
  classroom: 'intFloorClassroom', classroom60: 'intFloorClassroom',
  lab: 'intFloorLabVinyl', labHeavy: 'intFloorLabVinyl',
  reception: 'intFloorFoyer', lobby: 'intFloorFoyer', lounge: 'intFloorFoyer', foyer: 'intFloorFoyer', stairwell: 'intFloorFoyer',
  mart: 'intFloorClassroom', medical: 'intFloorFoyer',
  badminton: 'intFloorCourt', tabletennis: 'intFloorCourt',
  auditorium: 'intFloorCarpet',
  library: 'intFloorLibrary', stack: 'intFloorLibrary', reading: 'intFloorLibrary',
  canteen: 'intFloorClassroom', workshop: 'asphalt', corridor: 'intFloorFoyer',
};

// A room type this small (walkable interior) skips furniture rather than risk blocking itself.
const MIN_FURNISHABLE = 4;

class Floor {
  constructor(key, plan) {
    this.key = key;
    this.plan = plan;
    this.W = plan.width;
    this.H = plan.height;
    this.ground = new Int32Array(this.W * this.H).fill(TILE.edge);
    this.structures = new Int32Array(this.W * this.H).fill(-1);
    this.rects = new Map(); // id -> { x0,y0,x1,y1, type, name, isCorridor }
    this.areaRooms = []; // { name, rect } for every real room (not corridors), for `area` objects
    this.objects = [];
    this.nextObjectId = 1;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.W && y < this.H;
  }

  idx(x, y) {
    if (!this.inBounds(x, y)) throw new Error(`${this.key}: (${x},${y}) is outside the ${this.W}x${this.H} canvas`);
    return y * this.W + x;
  }

  // A wall-ring rectangle: the border (x0,y0)-(x1,y1) becomes wall, the interior becomes floor.
  // Reuses the outdoor BITS wall tiles: a horizontal run (top/bottom) shows the front face
  // (cornice + base course), a vertical run (left/right) shows the darker side face.
  addRect(id, { name, type, x0, y0, x1, y1, isCorridor = false, floorTile }) {
    if (x1 <= x0 || y1 <= y0) throw new Error(`${this.key}: room "${id}" has a non-positive size (${x0},${y0})-(${x1},${y1})`);
    const floor = TILE[floorTile || TYPE_FLOOR[type] || 'intFloorCarpet'];
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = this.idx(x, y);
        this.ground[i] = floor;
        const onBorder = x === x0 || x === x1 || y === y0 || y === y1;
        this.structures[i] = onBorder ? TILE[x === x0 || x === x1 ? (x === x0 ? 'bitsWallEndL' : 'bitsWallEndR') : 'bitsWallPlain'] : -1;
      }
    }
    const rect = { id, name, type, x0, y0, x1, y1, isCorridor };
    this.rects.set(id, rect);
    if (!isCorridor && name) this.areaRooms.push(rect);
    return rect;
  }

  get(id) {
    const r = this.rects.get(id);
    if (!r) throw new Error(`${this.key}: no room/corridor "${id}"`);
    return r;
  }

  // Interior floor area (inside the wall ring).
  interior(id) {
    const r = this.get(id);
    return { x0: r.x0 + 1, y0: r.y0 + 1, x1: r.x1 - 1, y1: r.y1 - 1 };
  }

  setDoor(x, y) {
    this.ground[this.idx(x, y)] = TILE.intDoorway;
    this.structures[this.idx(x, y)] = -1;
  }

  // Clears a door-width opening in the wall the two rects share. Throws if they don't share one
  // (fails loudly on a plan mistake, per docs/ARCHITECTURE.md rule 1), so a typo'd id or a pair of
  // rects that don't actually touch is caught immediately by running the generator.
  connect(idA, idB, { width = 2 } = {}) {
    const a = this.get(idA);
    const b = this.get(idB);
    if (a.x1 === b.x0 || b.x1 === a.x0) {
      const wallX = a.x1 === b.x0 ? a.x1 : a.x0;
      const y0 = Math.max(a.y0, b.y0) + 1;
      const y1 = Math.min(a.y1, b.y1) - 1;
      if (y1 < y0) throw new Error(`${this.key}: "${idA}" and "${idB}" touch but share no open wall for a door`);
      const w = Math.min(width, y1 - y0 + 1);
      const start = y0 + Math.floor((y1 - y0 + 1 - w) / 2);
      for (let y = start; y < start + w; y++) this.setDoor(wallX, y);
      return;
    }
    if (a.y1 === b.y0 || b.y1 === a.y0) {
      const wallY = a.y1 === b.y0 ? a.y1 : a.y0;
      const x0 = Math.max(a.x0, b.x0) + 1;
      const x1 = Math.min(a.x1, b.x1) - 1;
      if (x1 < x0) throw new Error(`${this.key}: "${idA}" and "${idB}" touch but share no open wall for a door`);
      const w = Math.min(width, x1 - x0 + 1);
      const start = x0 + Math.floor((x1 - x0 + 1 - w) / 2);
      for (let x = start; x < start + w; x++) this.setDoor(x, wallY);
      return;
    }
    throw new Error(`${this.key}: "${idA}" (${a.x0},${a.y0})-(${a.x1},${a.y1}) and "${idB}" (${b.x0},${b.y0})-(${b.x1},${b.y1}) do not share a wall`);
  }

  // Overrides a wall tile on one side of a room with a feature tile (a whiteboard, a window).
  wallFeature(id, side, tileName) {
    const r = this.get(id);
    const mid = side === 'top' || side === 'bottom' ? Math.round((r.x0 + r.x1) / 2) : Math.round((r.y0 + r.y1) / 2);
    const [x, y] =
      side === 'top' ? [mid, r.y0] : side === 'bottom' ? [mid, r.y1] : side === 'left' ? [r.x0, mid] : [r.x1, mid];
    this.structures[this.idx(x, y)] = TILE[tileName];
  }

  // Paints a sub-rectangle of the ground layer a different floor tile (e.g. a stage strip).
  paintFloor(x0, y0, x1, y1, tileName) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.ground[this.idx(x, y)] = TILE[tileName];
  }

  pointObject(type, name, x, y, props = {}) {
    this.objects.push({
      id: this.nextObjectId++, name, type, x: (x + 0.5) * TILE_PX, y: (y + 0.5) * TILE_PX, width: 0, height: 0,
      rotation: 0, visible: true, point: true,
      properties: Object.entries(props).map(([k, v]) => ({ name: k, type: typeof v === 'boolean' ? 'bool' : 'string', value: v })),
    });
  }

  rectObject(type, name, x0, y0, x1, y1, props = {}) {
    this.objects.push({
      id: this.nextObjectId++, name, type, x: x0 * TILE_PX, y: y0 * TILE_PX, width: (x1 - x0 + 1) * TILE_PX, height: (y1 - y0 + 1) * TILE_PX,
      rotation: 0, visible: true,
      properties: Object.entries(props).map(([k, v]) => ({ name: k, type: typeof v === 'boolean' ? 'bool' : 'string', value: v })),
    });
  }

  // An exterior/interior door: carves an opening in the room's own OUTER wall on the given side
  // (used where a room's wall is the building's outside wall) and drops a `door`-type object there
  // with `to`/`toId`/`facing` (world.js resolves these generically; see docs/INTERIORS_PLAN.md).
  exteriorDoor(id, side, { name, to, toId, facing }) {
    const r = this.get(id);
    const mid = side === 'top' || side === 'bottom' ? Math.round((r.x0 + r.x1) / 2) : Math.round((r.y0 + r.y1) / 2);
    const horizontal = side === 'top' || side === 'bottom';
    const [x, y] = side === 'top' ? [mid, r.y0] : side === 'bottom' ? [mid, r.y1] : side === 'left' ? [r.x0, mid] : [r.x1, mid];
    this.setDoor(x, y);
    this.setDoor(x + (horizontal ? 1 : 0), y + (horizontal ? 0 : 1));
    this.pointObject('door', name, x, y, { to, toId, facing });
  }

  // A stairs flight inside a room: a small walkable graphic plus a `stairs`-type warp object.
  stairsObject(id, { name, to, toId, facing, dir, offset = [0, 0] }) {
    const r = this.get(id);
    const cx = Math.round((r.x0 + r.x1) / 2) + offset[0];
    const cy = Math.round((r.y0 + r.y1) / 2) + offset[1];
    const tile = dir === 'up' ? 'intStairsUp' : 'intStairsDown';
    this.paintFloor(cx - 1, cy - 1, Math.min(cx, r.x1 - 1), Math.min(cy + 1, r.y1 - 1), tile);
    this.pointObject('stairs', name, cx, cy, { to, toId, facing });
  }

  // A lift: purely decorative (per the owner's plan, no working lift yet), placed against a wall.
  liftFeature(id, x, y) {
    this.structures[this.idx(x, y)] = TILE.intLift;
  }

  // The atrium void + railing (mezzanine looking down into the foyer below): a rectangle of
  // non-walkable "void" tiles bordered by a railing on every side.
  atriumVoid(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const onBorder = x === x0 || x === x1 || y === y0 || y === y1;
        this.structures[this.idx(x, y)] = TILE[onBorder ? 'intAtriumRailing' : 'intAtriumVoid'];
      }
    }
  }

  // Furniture, dispatched by room type. Only places furniture at least 1 tile in from every wall
  // (the "inset"), so the outer ring stays clear as a walking lane connecting every door in the
  // room to every other one -- furniture can never block a doorway or wall someone off.
  furnish(id) {
    const r = this.get(id);
    const put = (x, y, tileName) => {
      if (x >= ix0 && x <= ix1 && y >= iy0 && y <= iy1) this.structures[this.idx(x, y)] = TILE[tileName];
    };
    const full = this.interior(id);
    const ix0 = full.x0 + 1, iy0 = full.y0 + 1, ix1 = full.x1 - 1, iy1 = full.y1 - 1;
    if (ix1 - ix0 < MIN_FURNISHABLE - 2 || iy1 - iy0 < MIN_FURNISHABLE - 2) return; // too small to furnish safely
    const fn = FURNISHERS[r.type] || FURNISHERS.default;
    fn(put, ix0, iy0, ix1, iy1);
  }

  toTiledJSON() {
    const columns = tileInfo.columns;
    const tilesetRows = Math.ceil(tileInfo.tiles.length / columns);
    const gids = (arr) => Array.from(arr, (t) => (t < 0 ? 0 : t + 1));
    return {
      type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
      infinite: false, width: this.W, height: this.H, tilewidth: TILE_PX, tileheight: TILE_PX,
      nextlayerid: 4, nextobjectid: this.nextObjectId,
      properties: [
        { name: 'name', type: 'string', value: this.plan.name },
        { name: 'metersPerTile', type: 'float', value: 1 },
        { name: 'indoors', type: 'bool', value: true },
        { name: 'generatedBy', type: 'string', value: 'tools/interiors/build-interiors.js' },
      ],
      tilesets: [
        { firstgid: 1, name: 'tiles', image: '../tiles.png', imagewidth: columns * TILE_PX, imageheight: tilesetRows * TILE_PX, tilewidth: TILE_PX, tileheight: TILE_PX, tilecount: tileInfo.tiles.length, columns, margin: 0, spacing: 0 },
      ],
      layers: [
        { id: 1, name: 'ground', type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true, data: gids(this.ground) },
        { id: 2, name: 'structures', type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true, data: gids(this.structures) },
        { id: 3, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: this.objects },
      ],
    };
  }

  previewPNG() {
    const SCALE = 4;
    const rgba = Buffer.alloc(this.W * SCALE * this.H * SCALE * 4);
    const colors = tileInfo.tiles.map((t) => [parseInt(t.color.slice(1, 3), 16), parseInt(t.color.slice(3, 5), 16), parseInt(t.color.slice(5, 7), 16)]);
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        const s = this.structures[y * this.W + x];
        const t = s !== -1 ? s : this.ground[y * this.W + x];
        const [r, g, b] = colors[t];
        for (let dy = 0; dy < SCALE; dy++) {
          for (let dx = 0; dx < SCALE; dx++) {
            const i = ((y * SCALE + dy) * this.W * SCALE + x * SCALE + dx) * 4;
            rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
          }
        }
      }
    }
    return encodePNG(this.W * SCALE, this.H * SCALE, rgba);
  }
}

// ---------- furniture, by room type (simply furnished, per the owner's decision) ----------

function rowGrid(put, ix0, iy0, ix1, iy1, tile, { stepX = 2, stepY = 2, topMargin = 0 } = {}) {
  for (let y = iy0 + topMargin; y <= iy1; y += stepY) for (let x = ix0; x <= ix1; x += stepX) put(x, y, tile);
}

const FURNISHERS = {
  default: (put, ix0, iy0, ix1, iy1) => {
    put(ix0, iy0, 'plant');
  },
  office: (put, ix0, iy0, ix1, iy1) => {
    put(ix0 + 1, iy0, 'intDesk');
    put(ix1, iy0, 'intCabinet');
    put(ix0, iy1, 'plant');
  },
  reception: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intReceptionDesk');
    put(ix0, iy1, 'plant');
    put(ix1, iy1, 'plant');
  },
  lobby: (put, ix0, iy0, ix1, iy1) => {
    put(ix0 + 1, iy0, 'intSofa');
    put(ix0 + 1, iy1 - 1, 'intSofa');
    put(ix1 - 1, iy0, 'plant');
    put(Math.round((ix0 + ix1) / 2), iy1, 'intNoticeboard');
  },
  lounge: (put, ix0, iy0, ix1, iy1) => {
    put(ix0 + 1, iy0 + 1, 'intSofa');
    put(ix1 - 1, iy0 + 1, 'intSofa');
    put(ix0 + 1, iy1 - 1, 'plant');
  },
  foyer: (put, ix0, iy0, ix1, iy1) => {
    const cx = Math.round((ix0 + ix1) / 2);
    put(cx, iy0 + 1, 'intReceptionDesk');
    put(ix0 + 1, iy1 - 1, 'intSofa');
    put(ix1 - 1, iy1 - 1, 'intSofa');
    put(ix0 + 1, iy0 + 1, 'plant');
    put(ix1 - 1, iy0 + 1, 'plant');
    put(cx, iy1 - 1, 'intNoticeboard');
  },
  classroom: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intTeacherDesk');
    rowGrid(put, ix0, iy0, ix1, iy1, 'intDesk', { topMargin: 2 });
  },
  classroom60: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intTeacherDesk');
    rowGrid(put, ix0, iy0, ix1, iy1, 'intDesk', { topMargin: 2, stepX: 2, stepY: 2 });
  },
  lab: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 2) put(x, iy0, 'intBench');
    for (let x = ix0 + 1; x <= ix1; x += 3) put(x, iy0, 'intComputerBench');
    for (let x = ix0; x <= ix1; x += 2) put(x, iy1, 'intBench');
    if (iy1 - iy0 >= 4) put(ix1, Math.round((iy0 + iy1) / 2), 'intSink');
  },
  labHeavy: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 2) {
      put(x, iy0, 'intMachine');
      put(x, iy1, 'intBench');
    }
  },
  club: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), Math.round((iy0 + iy1) / 2), 'table');
    put(ix0, iy0, 'intNoticeboard');
  },
  locker: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x++) put(x, iy0, 'intLocker');
  },
  service: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intDesk');
    put(ix0, iy1, 'plant');
  },
  discussion: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), Math.round((iy0 + iy1) / 2), 'table');
  },
  mart: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 2) put(x, iy0, 'bookshelf');
    put(Math.round((ix0 + ix1) / 2), iy1, 'table');
  },
  medical: (put, ix0, iy0, ix1, iy1) => {
    put(ix0 + 1, iy0, 'intBed');
    put(ix0 + 2, iy0 + 1, 'intCurtain');
    put(ix1, iy1, 'intMedicalDesk');
  },
  badminton: (put, ix0, iy0, ix1, iy1) => {
    const cx = Math.round((ix0 + ix1) / 2);
    for (let y = iy0; y <= iy1; y++) put(cx, y, 'intBadmintonNet');
  },
  tabletennis: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), Math.round((iy0 + iy1) / 2), 'intTTTable');
  },
  auditorium: (put, ix0, iy0, ix1, iy1) => {
    for (let y = iy0 + 4; y <= iy1; y += 2) {
      for (let x = ix0; x <= ix1; x += 2) put(x, y, 'intAuditoriumSeat');
    }
  },
  library: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 3) put(x, iy0, 'bookshelf');
    for (let y = iy0 + 3; y <= iy1; y += 3) for (let x = ix0 + 1; x <= ix1 - 1; x += 4) put(x, y, 'table');
  },
  stack: (put, ix0, iy0, ix1, iy1) => {
    for (let y = iy0; y <= iy1; y += 2) for (let x = ix0; x <= ix1; x += 2) put(x, y, 'bookshelf');
  },
  reading: (put, ix0, iy0, ix1, iy1) => {
    for (let y = iy0; y <= iy1; y += 3) for (let x = ix0; x <= ix1; x += 4) put(x, y, 'table');
  },
  canteen: (put, ix0, iy0, ix1, iy1) => {
    put(ix0, Math.round((iy0 + iy1) / 2), 'intReceptionDesk');
    for (let y = iy0; y <= iy1; y += 3) for (let x = ix0 + 2; x <= ix1; x += 3) put(x, y, 'table');
  },
  workshop: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 3) {
      put(x, iy0, 'intMachine');
      put(x, iy1, 'intBench');
    }
  },
  stairwell: () => {}, // the stairs graphic itself is the furniture
};

// ---------- build every floor from the plan ----------

fs.mkdirSync(MAPS_OUT, { recursive: true });
fs.mkdirSync(PREVIEW_OUT, { recursive: true });

let builtCount = 0;
const summaries = [];
for (const [key, plan] of Object.entries(PLANS)) {
  const floor = new Floor(key, plan);
  plan.build(floor);

  // Furnish every real room (corridors and stairwells excluded) per its type.
  for (const r of floor.areaRooms) floor.furnish(r.id);

  // Named `area` objects (for the location banner) for every real room, corridors excluded.
  for (const r of floor.areaRooms) {
    const i = floor.interior(r.id);
    floor.rectObject('area', r.name, i.x0, i.y0, i.x1, i.y1, { kind: r.type });
  }
  // A default spawn (used by `?map=<key>` and as a fallback): just inside the entrance room.
  if (plan.spawn) {
    floor.pointObject('spawn', 'spawn', plan.spawn.x, plan.spawn.y, { facing: plan.spawn.facing });
  }

  const json = floor.toTiledJSON();
  fs.writeFileSync(path.join(MAPS_OUT, `${key}.json`), JSON.stringify(json) + '\n');
  fs.writeFileSync(path.join(PREVIEW_OUT, `${key}.png`), floor.previewPNG());
  builtCount++;
  summaries.push(`${key}: ${floor.W}x${floor.H} tiles, ${floor.areaRooms.length} rooms, ${floor.objects.length} objects`);
}

console.log(`interiors: built ${builtCount} floors`);
summaries.forEach((s) => console.log(`  ${s}`));
