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
  'edge', 'intDoorway', 'intStairsUp', 'intStairsDown', 'intLift', 'intAtriumVoid', 'intAtriumVoidEdge', 'intAtriumRailing',
  'intFloorFoyer', 'intFloorClassroom', 'intFloorCarpet', 'intFloorLabVinyl', 'intFloorLibrary',
  'intFloorStage', 'intFloorCourt', 'asphalt',
  'bitsWallPlain', 'bitsWall', 'bitsWallEndL', 'bitsWallEndR',
  'intDesk', 'intTeacherDesk', 'intWhiteboardWall', 'intBench', 'intComputerBench', 'intSink',
  'intCabinet', 'intSofa', 'intNoticeboard', 'intReceptionDesk', 'intLocker', 'intAuditoriumSeat',
  'intBadmintonNet', 'intCourtLineIndoor', 'intTTTable', 'intBed', 'intCurtain', 'intMedicalDesk',
  'intMachine', 'table', 'bookshelf', 'plant',
  // 2026-09-22 interior furniture kit refresh (docs/research/asset-packs.md addendum):
  'intLabBench', 'intLabTank', 'intLabRack', 'intCanteenCounter', 'intPrinter', 'intBooksStack',
  'intGlobe', 'intWaterCooler', 'intVendingMachine', 'intBin',
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

  // Overrides a wall tile on one side of a room with a feature tile (a whiteboard, a window). A
  // no-op if that spot is actually a doorway (the room's door happens to land at the wall's own
  // midpoint) -- never silently walls up a room's only way in.
  wallFeature(id, side, tileName) {
    const r = this.get(id);
    const mid = side === 'top' || side === 'bottom' ? Math.round((r.x0 + r.x1) / 2) : Math.round((r.y0 + r.y1) / 2);
    const [x, y] =
      side === 'top' ? [mid, r.y0] : side === 'bottom' ? [mid, r.y1] : side === 'left' ? [r.x0, mid] : [r.x1, mid];
    if (this.ground[this.idx(x, y)] === TILE.intDoorway) return;
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
  // non-walkable "void" tiles bordered by a railing on every side. The ring just inside the railing
  // gets the shadowed edge variant (QA: the void used to look like a missing texture; it now reads
  // as a drop to the foyer floor below, darkest right under the railing lip).
  atriumVoid(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const onBorder = x === x0 || x === x1 || y === y0 || y === y1;
        const onShadowEdge = !onBorder && (x === x0 + 1 || x === x1 - 1 || y === y0 + 1 || y === y1 - 1);
        const tile = onBorder ? 'intAtriumRailing' : onShadowEdge ? 'intAtriumVoidEdge' : 'intAtriumVoid';
        this.structures[this.idx(x, y)] = TILE[tile];
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
    // `this` (the Floor) and the room's own id are passed through so a furnisher can reach the rarer
    // per-room operations (wallFeature, rectObject) that a simple put(x,y,tile) grid can't express --
    // e.g. mounting a whiteboard tile ON a wall rather than as a floor-standing prop.
    fn(put, ix0, iy0, ix1, iy1, { floor: this, id });
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
    // A bigger office gets a printer too (owner brief: "office desks and cabinets" + small props) --
    // only if there's room for it without crowding the desk/cabinet already placed.
    if (ix1 - ix0 >= 5) put(ix1 - 1, iy1, 'intPrinter');
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
  // The Main Block foyer (docs/STORY.md: the opening scene, "an event stall behind the stairs") --
  // the flagship room, so it gets more than the simple-by-design grid every other room uses: a
  // reception desk, armchair seating and plants near the entrance, a noticeboard, and a *decorative*
  // grand staircase (intStairsUp is walkable and has no warp trigger of its own -- see
  // INTERIORS_PLAN.md "the lift is decorative only" for the same trick already used for intLift)
  // standing away from the entrance with a clear, tucked-away nook behind it for the LUG stall.
  foyer: (put, ix0, iy0, ix1, iy1, ctx) => {
    const cx = Math.round((ix0 + ix1) / 2);
    put(cx, iy0 + 6, 'intReceptionDesk');
    put(ix0 + 1, iy1 - 1, 'intSofa');
    put(ix0 + 2, iy1 - 1, 'intSofa');
    put(ix1 - 2, iy1 - 1, 'intSofa');
    put(ix1 - 1, iy1 - 1, 'intSofa');
    put(ix0 + 1, iy0 + 1, 'plant');
    put(ix1 - 1, iy0 + 1, 'plant');
    put(ix0 + 1, iy1 - 3, 'plant');
    put(ix1 - 1, iy1 - 3, 'plant');
    put(Math.round((ix0 + ix1) / 2) - 6, iy1 - 1, 'intNoticeboard');
    // The staircase: a block of decorative stairs-up tiles a few rows in from the back (north) wall,
    // wide enough to read as a real staircase at zoom 3. Everything from the staircase to the back
    // wall stays open floor -- the LUG Stall nook, walkable and reachable around either side.
    const stairsY0 = iy0 + 4;
    const stairsY1 = Math.min(iy0 + 6, iy1 - 4);
    const stairsX0 = cx - 4;
    const stairsX1 = cx + 3;
    if (ctx && ctx.floor && stairsY1 > stairsY0) {
      ctx.floor.paintFloor(Math.max(ix0, stairsX0), stairsY0, Math.min(ix1, stairsX1), stairsY1, 'intStairsUp');
      // The stall counter sits in the cleared nook behind (north of) the staircase, closer to one
      // side so the aisle on the other side stays obviously wider/clearer to walk through.
      put(stairsX0 + 1, iy0 + 1, 'intCanteenCounter');
      ctx.floor.rectObject('area', 'LUG Stall', Math.max(ix0, stairsX0), iy0, Math.min(ix1, stairsX1), stairsY0 - 1, { kind: 'stall' });
    }
  },
  classroom: (put, ix0, iy0, ix1, iy1, ctx) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intTeacherDesk');
    rowGrid(put, ix0, iy0, ix1, iy1, 'intDesk', { topMargin: 2 });
    // A whiteboard mounted on the room's own front wall, above the teacher's desk (owner brief:
    // "classrooms with desks facing a whiteboard") -- wallFeature overrides one wall tile, it can
    // never block the doorway ring furniture already respects.
    if (ctx && ctx.floor) ctx.floor.wallFeature(ctx.id, 'top', 'intWhiteboardWall');
  },
  classroom60: (put, ix0, iy0, ix1, iy1, ctx) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intTeacherDesk');
    rowGrid(put, ix0, iy0, ix1, iy1, 'intDesk', { topMargin: 2, stepX: 2, stepY: 2 });
    if (ctx && ctx.floor) ctx.floor.wallFeature(ctx.id, 'top', 'intWhiteboardWall');
  },
  // Science/engineering labs (owner brief: "science-lab benches with equipment... chemistry
  // glassware, microscopes"): a bench row at each end plus the lab-specific equipment (a chemistry/
  // bio apparatus tank and an instrument rack) so it reads as a real lab, not a repeated bench grid.
  lab: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 2) put(x, iy0, 'intLabBench');
    for (let x = ix0 + 1; x <= ix1; x += 3) put(x, iy0, 'intComputerBench');
    for (let x = ix0; x <= ix1; x += 2) put(x, iy1, 'intLabBench');
    if (iy1 - iy0 >= 4) {
      put(ix1, Math.round((iy0 + iy1) / 2), 'intSink');
      put(ix0, Math.round((iy0 + iy1) / 2), 'intLabTank');
    }
    if (ix1 - ix0 >= 6) put(ix0 + 2, Math.round((iy0 + iy1) / 2), 'intLabRack');
  },
  labHeavy: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 2) {
      put(x, iy0, 'intMachine');
      put(x, iy1, 'intLabBench');
    }
    if (iy1 - iy0 >= 4) put(ix0, Math.round((iy0 + iy1) / 2), 'intLabRack');
  },
  club: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), Math.round((iy0 + iy1) / 2), 'table');
    put(ix0, iy0, 'intNoticeboard');
  },
  locker: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x++) put(x, iy0, 'intLocker');
    if (iy1 - iy0 >= 3) put(ix0, iy1, 'intBin');
  },
  service: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intDesk');
    put(ix0, iy1, 'plant');
  },
  discussion: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), Math.round((iy0 + iy1) / 2), 'table');
  },
  // The mini mart (owner brief's "small props": a vending machine belongs here as much as anywhere).
  mart: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 2) put(x, iy0, 'bookshelf');
    put(Math.round((ix0 + ix1) / 2), iy1, 'table');
    put(ix1, iy1, 'intVendingMachine');
  },
  medical: (put, ix0, iy0, ix1, iy1) => {
    put(ix0 + 1, iy0, 'intBed');
    put(ix0 + 2, iy0 + 1, 'intCurtain');
    put(ix1, iy1, 'intMedicalDesk');
    if (ix1 - ix0 >= 5) put(ix1, iy0, 'intCabinet');
  },
  badminton: (put, ix0, iy0, ix1, iy1) => {
    const cx = Math.round((ix0 + ix1) / 2);
    for (let y = iy0; y <= iy1; y++) put(cx, y, 'intBadmintonNet');
    put(ix0, iy0, 'intWaterCooler');
  },
  tabletennis: (put, ix0, iy0, ix1, iy1) => {
    put(Math.round((ix0 + ix1) / 2), Math.round((iy0 + iy1) / 2), 'intTTTable');
    put(ix0, iy1, 'intWaterCooler');
  },
  // The auditorium (owner brief: "raked seat rows and a stage") -- the stage strip itself is painted
  // separately by mainBlockG's own plan (paintFloor to intFloorStage at the far end); this furnisher
  // just lays out the seat rows facing it, with a centre aisle so every row is walkable end to end.
  auditorium: (put, ix0, iy0, ix1, iy1) => {
    const aisle = Math.round((ix0 + ix1) / 2);
    for (let y = iy0 + 4; y <= iy1; y += 2) {
      for (let x = ix0; x <= ix1; x += 2) {
        if (x === aisle || x === aisle - 1) continue; // keep a walkable centre aisle down to the stage
        put(x, y, 'intAuditoriumSeat');
      }
    }
  },
  // The library reading room (owner brief: "library shelving and reading tables") -- shelf rows
  // along the front wall, reading tables in the body of the room, with a globe for a bit of
  // character.
  library: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 3) put(x, iy0, 'bookshelf');
    for (let y = iy0 + 3; y <= iy1; y += 3) for (let x = ix0 + 1; x <= ix1 - 1; x += 4) put(x, y, 'table');
    put(ix1, iy1, 'intGlobe');
  },
  stack: (put, ix0, iy0, ix1, iy1) => {
    for (let y = iy0; y <= iy1; y += 2) for (let x = ix0; x <= ix1; x += 2) put(x, y, 'bookshelf');
  },
  reading: (put, ix0, iy0, ix1, iy1) => {
    for (let y = iy0; y <= iy1; y += 3) for (let x = ix0; x <= ix1; x += 4) put(x, y, 'table');
    put(ix0, iy0, 'intBooksStack');
  },
  // The canteen (owner brief: "canteen/cafeteria tables and a serving counter") -- a dedicated
  // counter tile instead of a reused reception desk, plus a bin near the tables.
  canteen: (put, ix0, iy0, ix1, iy1) => {
    put(ix0, Math.round((iy0 + iy1) / 2), 'intCanteenCounter');
    for (let y = iy0; y <= iy1; y += 3) for (let x = ix0 + 2; x <= ix1; x += 3) put(x, y, 'table');
    put(ix1, iy1, 'intBin');
  },
  workshop: (put, ix0, iy0, ix1, iy1) => {
    for (let x = ix0; x <= ix1; x += 3) {
      put(x, iy0, 'intMachine');
      put(x, iy1, 'intLabBench');
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
