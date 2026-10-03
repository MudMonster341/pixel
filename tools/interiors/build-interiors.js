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
  // FB-0030/0031 (premium pass stage 5): the Main Block foyer rebuild + key-room dressing.
  'intFloorMarble', 'intFloorMarbleRunner', 'intColumn', 'intFoyerStairsL', 'intFoyerStairsR',
  'intFoyerLanding', 'intChandelier', 'intGlassDoorOpen', 'intDoorClosed', 'intIcvlBench',
  'intServerRack', 'intLabBenchWood', 'intProjectorScreen',
  ...Array.from({ length: 9 }, (_, i) => `bitsSignSeg${i}`), // "BITS PILANI, DUBAI CAMPUS" wordmark
  // Quality loop (docs/quality/scorecard.md, Interior art run 1, 2026-09-28): real LimeZu
  // Room_Builder walls (cap + face) and floors.
  'intWallCap', 'intWallFace', 'intWallFaceEndL', 'intWallFaceEndR', 'intWallWindow',
  'intFloorTiled', 'intFloorLabLight',
  // Quality loop, Interior art run 2 (2026-09-28): plain stair treads, the chandelier's other 3
  // quadrants, and the ICVL/Physics Lab's extra furniture variety.
  'intFoyerTreadPlain', 'intChandelierTR', 'intChandelierBL', 'intChandelierBR', 'intChair',
  'intIcvlCabinet', 'intFumeHood', 'intLabBenchScope', 'intLabBenchFlask', 'intLabBenchLaptop',
  // Quality loop, Interior art run 3 (2026-09-29): round columns, the interior potted plant, a rug,
  // a bigger reception desk, wall posters/nameplates, and an equipment trolley.
  'intPottedPlant', 'intColumnCapL', 'intColumnCapR', 'intColumnShaftL', 'intColumnShaftR',
  'intColumnBaseL', 'intColumnBaseR', 'intRug', 'intReceptionDeskL', 'intReceptionDeskR',
  'intWallPoster', 'intNameplate', 'intEquipmentTrolley',
  // ADR 0020 (the ground floor follows the official 3D tour): oak floor, skirted and peach walls, red/blue
  // sofas, the terrarium, totems, big black-pot plants, frosted glass and the closed wall doors.
  'intFloorOak', 'intWallPeach', 'intWallPeachEndL', 'intWallPeachEndR',
  'intWallFaceSkirt', 'intWallFaceSkirtEndL', 'intWallFaceSkirtEndR', 'intSofaRed', 'intSofaBlue',
  'intTerrariumTL', 'intTerrariumTR', 'intTerrariumML', 'intTerrariumMR', 'intTerrariumBL', 'intTerrariumBR',
  'intTotemTop', 'intTotemBase', 'intBigPlantTop', 'intBigPlantBase', 'intGlassPanel', 'intGlassPanelB',
  'intGlassDoor', 'intDoorOffice', 'intDoorFlush', 'intDoorDarkL', 'intDoorDarkR', 'intStairsUp',
];
for (const name of REQUIRED_TILES) {
  if (!(name in TILE)) throw new Error(`assets/tiles.json has no tile "${name}". Run npm run assets first.`);
}

// Wall tile kits (the ring tiles of addRect): the sand BITS wall the Library/Mechanical Block still use, the
// real LimeZu Room_Builder cream wall (quality loop, Interior art run 1), and ADR 0020's two ground-floor
// variants -- the cream wall with a wood skirting (corridors) and the peach lower wall (auditorium/sports ends).
const WALL_DEFAULT = { plain: 'bitsWallPlain', endL: 'bitsWallEndL', endR: 'bitsWallEndR' };
const WALL_KITS = {
  roomBuilder: { plain: 'intWallFace', endL: 'intWallFaceEndL', endR: 'intWallFaceEndR' },
  skirt: { plain: 'intWallFaceSkirt', endL: 'intWallFaceSkirtEndL', endR: 'intWallFaceSkirtEndR' },
  peach: { plain: 'intWallPeach', endL: 'intWallPeachEndL', endR: 'intWallPeachEndR' },
};

// Ground floor tile per room type. Everything not listed gets 'intFloorCarpet'.
const TYPE_FLOOR = {
  office: 'intFloorCarpet', service: 'intFloorCarpet', discussion: 'intFloorCarpet', locker: 'intFloorCarpet', club: 'intFloorCarpet',
  classroom: 'intFloorClassroom', classroom60: 'intFloorClassroom',
  lab: 'intFloorLabVinyl', labHeavy: 'intFloorLabVinyl',
  reception: 'intFloorFoyer', lobby: 'intFloorFoyer', lounge: 'intFloorFoyer', foyer: 'intFloorOak', stairwell: 'intFloorFoyer',
  mart: 'intFloorClassroom', medical: 'intFloorFoyer',
  badminton: 'intFloorCourt', tabletennis: 'intFloorCourt',
  auditorium: 'intFloorCarpet',
  library: 'intFloorLibrary', stack: 'intFloorLibrary', reading: 'intFloorLibrary',
  canteen: 'intFloorClassroom', workshop: 'asphalt',
  // Quality loop (Interior art run 1: "corridors are bare"): a real tiled floor instead of the plain
  // foyer fleck reuse.
  corridor: 'intFloorTiled',
  // FB-0030/0031: the ICVL/Physics Lab key rooms get their own light floor (matches the ICL/lab
  // photos, docs/research/campus-visual-reference.md), distinct from the shared 'lab' type
  // Mechanical Block's own labs still use.
  labIcvl: 'intFloorLabLight', labPhysics: 'intFloorLabLight',
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
    // Quality loop (Interior art run 1): a chandelier "(overhead layer) over the landing" -- the
    // exact same idea as the outdoor tree-canopy overhead layer (ADR 0008), a 3rd tile layer that
    // always draws above every character. Left entirely empty (and so entirely absent from the
    // Tiled JSON, see toTiledJSON()) for any floor that never calls placeOverhead() -- Library and
    // Mechanical Block's own maps are byte-for-byte unaffected by this.
    this.overhead = new Int32Array(this.W * this.H).fill(-1);
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
  // `wallKit: 'roomBuilder'` (quality loop, Interior art run 1 -- Main Block only, see plans.js)
  // swaps in the real LimeZu Room_Builder face/end tiles instead, and bleeds a matching cap tile one
  // row above the room's own top wall wherever that row is still open void (capTopWall() below) --
  // Library/Mechanical Block never pass this, so their walls/maps are completely unchanged.
  addRect(id, { name, type, x0, y0, x1, y1, isCorridor = false, floorTile, wallKit }) {
    if (x1 <= x0 || y1 <= y0) throw new Error(`${this.key}: room "${id}" has a non-positive size (${x0},${y0})-(${x1},${y1})`);
    const floor = TILE[floorTile || TYPE_FLOOR[type] || 'intFloorCarpet'];
    if (wallKit && !WALL_KITS[wallKit]) throw new Error(`${this.key}: room "${id}" has an unknown wallKit "${wallKit}"`);
    const kit = WALL_KITS[wallKit] || WALL_DEFAULT;
    const wallPlain = kit.plain;
    const wallEndL = kit.endL;
    const wallEndR = kit.endR;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = this.idx(x, y);
        this.ground[i] = floor;
        const onBorder = x === x0 || x === x1 || y === y0 || y === y1;
        this.structures[i] = onBorder ? TILE[x === x0 || x === x1 ? (x === x0 ? wallEndL : wallEndR) : wallPlain] : -1;
      }
    }
    const rect = { id, name, type, x0, y0, x1, y1, isCorridor };
    this.rects.set(id, rect);
    if (!isCorridor && name) this.areaRooms.push(rect);
    if (wallKit) this.capTopWall(rect);
    return rect;
  }

  // Bleeds a wall-cap tile one row *above* a room's own top wall (quality loop: "a top edge... 2+
  // rows tall") -- only where that row is still the untouched default void (`edge`, always solid),
  // the same "art may extend above a building's own footprint" trick outdoor buildings already use
  // (ADR 0015) rather than reserving an extra row of canvas for every room. A room packed directly
  // against another room's own wall above it (no clearance) just doesn't get a cap there -- still a
  // correct, if slightly shorter, wall; never overwrites another room's own tiles.
  capTopWall(rect) {
    const y = rect.y0 - 1;
    if (y < 0) return;
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (this.ground[this.idx(x, y)] === TILE.edge && this.structures[this.idx(x, y)] === -1) {
        this.structures[this.idx(x, y)] = TILE.intWallCap;
      }
    }
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

  setDoor(x, y, tileName = 'intDoorway') {
    this.ground[this.idx(x, y)] = TILE[tileName];
    this.structures[this.idx(x, y)] = -1;
  }

  // Clears a door-width opening in the wall the two rects share. Throws if they don't share one
  // (fails loudly on a plan mistake, per docs/ARCHITECTURE.md rule 1), so a typo'd id or a pair of
  // rects that don't actually touch is caught immediately by running the generator.
  // `openTile` (ADR 0020): the floor laid in the opening -- the wings' wide, door-less mouths continue the floor
  // instead of showing the dark `intDoorway` threshold.
  connect(idA, idB, { width = 2, openTile } = {}) {
    const a = this.get(idA);
    const b = this.get(idB);
    if (a.x1 === b.x0 || b.x1 === a.x0) {
      const wallX = a.x1 === b.x0 ? a.x1 : a.x0;
      const y0 = Math.max(a.y0, b.y0) + 1;
      const y1 = Math.min(a.y1, b.y1) - 1;
      if (y1 < y0) throw new Error(`${this.key}: "${idA}" and "${idB}" touch but share no open wall for a door`);
      const w = Math.min(width, y1 - y0 + 1);
      const start = y0 + Math.floor((y1 - y0 + 1 - w) / 2);
      for (let y = start; y < start + w; y++) this.setDoor(wallX, y, openTile);
      return;
    }
    if (a.y1 === b.y0 || b.y1 === a.y0) {
      const wallY = a.y1 === b.y0 ? a.y1 : a.y0;
      const x0 = Math.max(a.x0, b.x0) + 1;
      const x1 = Math.min(a.x1, b.x1) - 1;
      if (x1 < x0) throw new Error(`${this.key}: "${idA}" and "${idB}" touch but share no open wall for a door`);
      const w = Math.min(width, x1 - x0 + 1);
      const start = x0 + Math.floor((x1 - x0 + 1 - w) / 2);
      for (let x = start; x < start + w; x++) this.setDoor(x, wallY, openTile);
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

  // A single structures-layer tile placed at an explicit position (locked/dead-end doors, a poster
  // wall's several tiles, the foyer's mezzanine-fascia wordmark) -- the general form wallFeature's
  // "one feature at a wall's own midpoint" can't express. Never overwrites an actual doorway opening
  // (same guard as wallFeature), so it's always safe to sprinkle along a wall a door also uses.
  placeStructure(x, y, tileName) {
    if (this.ground[this.idx(x, y)] === TILE.intDoorway) return;
    this.structures[this.idx(x, y)] = TILE[tileName];
  }

  // A left-to-right run of placeStructure calls, one tile name per position starting at (x,y) --
  // used for the foyer's "BITS Pilani, Dubai Campus" wordmark (a row of bitsSignSeg tiles).
  placeStructureRow(x, y, tileNames) {
    tileNames.forEach((name, i) => this.placeStructure(x + i, y, name));
  }

  // Re-skins the wall tiles inside a rectangle with another wall kit (ADR 0020: the ramp's stretch of corridor
  // gets peach lower walls while the rest of the same corridor keeps the skirted cream wall). Only cells that
  // already hold a wall tile of some kit change; their role (plain / left end / right end) is kept.
  repaintWalls(x0, y0, x1, y1, kitName) {
    const kit = WALL_KITS[kitName];
    if (!kit) throw new Error(`${this.key}: unknown wall kit "${kitName}"`);
    const roleOf = new Map();
    for (const k of [WALL_DEFAULT, ...Object.values(WALL_KITS)]) {
      roleOf.set(TILE[k.plain], 'plain'); roleOf.set(TILE[k.endL], 'endL'); roleOf.set(TILE[k.endR], 'endR');
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const role = roleOf.get(this.structures[this.idx(x, y)]);
        if (role) this.structures[this.idx(x, y)] = TILE[kit[role]];
      }
    }
  }

  // A wall door that never opens (ADR 0020 owner decision: every wing destination is a closed, nameplated door).
  // A walkable door-art tile in the wall plus a `door` object marked `closed` with no `to`: stepping into it
  // runs the locked-door machinery (src/scenes/world.js computeWarpPoints(): toast + thud + rattle), and the
  // line it says is the map def's `doorLocks` entry of the same name (src/maps.js). Nothing is behind it: the
  // tile past the doorway is void, so it never opens onto nothing.
  closedDoor(x, y, tileName, name) {
    if (this.ground[this.idx(x, y)] === TILE.intDoorway) throw new Error(`${this.key}: closed door "${name}" sits on a doorway`);
    this.structures[this.idx(x, y)] = TILE[tileName];
    this.pointObject('door', name, x, y, { closed: true });
  }

  // A 1x2 big plant in a black pot, walk-behind (ADR 0015).
  bigPlant(x, y) {
    this.placeStructure(x, y, 'intBigPlantTop');
    this.placeStructure(x, y + 1, 'intBigPlantBase');
    this.depthGroupRect(x, y, x, y + 1);
  }

  // A tile on the `overhead` layer (quality loop: "a chandelier (overhead layer) over the landing")
  // -- always drawn above every character, the same layer/depth outdoor tree canopies already use
  // (ADR 0008). Never solid, purely visual.
  placeOverhead(x, y, tileName) {
    this.overhead[this.idx(x, y)] = TILE[tileName];
  }

  // A rectangle marked as a y-sorted `depthGroup` (ADR 0015, docs/ARCHITECTURE.md "Depth groups and
  // door entry"): tall things (columns, the staircase, big plants) that should draw in front of her
  // when she's below them on screen, behind when she's above -- baked and sorted by the engine at
  // load, never by hand-tuned per-tile depth. `baseOffset` (rows above the rect's own bottom edge
  // where the base line sits) defaults to 0, the rect's own bottom row.
  depthGroupRect(x0, y0, x1, y1, baseOffset = 0) {
    this.rectObject('depthGroup', '', x0, y0, x1, y1, { baseOffset });
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
  // `at` (ADR 0020): the door's own first cell along the wall, for a hall whose wall length is even so the
  // default rounded midpoint would leave a 2-wide door half a tile off the centre line.
  exteriorDoor(id, side, { name, to, toId, facing, openTiles, at }) {
    const r = this.get(id);
    const mid = at !== undefined ? at : side === 'top' || side === 'bottom' ? Math.round((r.x0 + r.x1) / 2) : Math.round((r.y0 + r.y1) / 2);
    const horizontal = side === 'top' || side === 'bottom';
    const [x, y] = side === 'top' ? [mid, r.y0] : side === 'bottom' ? [mid, r.y1] : side === 'left' ? [r.x0, mid] : [r.x1, mid];
    this.setDoor(x, y);
    this.setDoor(x + (horizontal ? 1 : 0), y + (horizontal ? 0 : 1));
    const props = { to, toId, facing };
    if (openTiles) props.openTiles = openTiles;
    this.pointObject('door', name, x, y, props);
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
    // The `overhead` layer only exists in the output when a floor actually used placeOverhead() --
    // Library/Mechanical Block (and every other floor that never calls it) get byte-for-byte the
    // same 3-layer JSON as before this quality-loop pass.
    const hasOverhead = this.overhead.some((t) => t >= 0);
    const layers = [
      { id: 1, name: 'ground', type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true, data: gids(this.ground) },
      { id: 2, name: 'structures', type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true, data: gids(this.structures) },
    ];
    if (hasOverhead) layers.push({ id: 4, name: 'overhead', type: 'tilelayer', width: this.W, height: this.H, x: 0, y: 0, opacity: 1, visible: true, data: gids(this.overhead) });
    layers.push({ id: 3, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: this.objects });
    return {
      type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down',
      infinite: false, width: this.W, height: this.H, tilewidth: TILE_PX, tileheight: TILE_PX,
      nextlayerid: hasOverhead ? 5 : 4, nextobjectid: this.nextObjectId,
      properties: [
        { name: 'name', type: 'string', value: this.plan.name },
        { name: 'metersPerTile', type: 'float', value: 1 },
        { name: 'indoors', type: 'bool', value: true },
        { name: 'generatedBy', type: 'string', value: 'tools/interiors/build-interiors.js' },
      ],
      tilesets: [
        { firstgid: 1, name: 'tiles', image: '../tiles.png', imagewidth: columns * TILE_PX, imageheight: tilesetRows * TILE_PX, tilewidth: TILE_PX, tileheight: TILE_PX, tilecount: tileInfo.tiles.length, columns, margin: 0, spacing: 0 },
      ],
      layers,
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
  lounge: (put, ix0, iy0, ix1, iy1, ctx) => {
    put(ix0 + 1, iy0 + 1, 'intSofa');
    put(ix1 - 1, iy0 + 1, 'intSofa');
    put(ix0 + 1, iy1 - 1, 'plant');
    // FB-0031 (the 2nd floor's own "transit corridor/landing... a lounge corner, notice boards"):
    // a couple of notice boards along the room's own front wall, not just the lone corner sofa.
    if (ctx && ctx.floor) {
      const r = ctx.floor.get(ctx.id);
      ctx.floor.placeStructure(Math.round((r.x0 + r.x1) / 2) - 3, r.y0, 'intNoticeboard');
      ctx.floor.placeStructure(Math.round((r.x0 + r.x1) / 2) + 3, r.y0, 'intNoticeboard');
    }
  },
  // The Main Block reception foyer (map `main-block-g`), rebuilt for ADR 0020 to follow the official 3D virtual
  // tour (docs/research/tour-ground-floor.md) instead of the owner's older photo. Read the plan from the
  // entrance (bottom wall) looking in; LEFT/RIGHT are the player's. Everything below is placed on the shared
  // 40x40 canvas by absolute coordinates, mirrored about the hall's centre line (x = 20.0) where the tour is
  // symmetric. Hall interior is x 11..28, y 15..36.
  //   - Pale oak floor, no runner. Cream walls, the lit wordmark on the back wall above a mezzanine railing.
  //   - TWO curved white reception desks, one each side of the entrance, each with a frosted-glass partition
  //     behind it and a glass side door (a closed wall door) between it and the entrance doors, plus a big
  //     black-pot plant.
  //   - A glass terrarium on a round plinth on the central axis, 6 rows in from the entrance, flanked by two
  //     pairs of back-lit totem pillars (no portraits).
  //   - A split staircase against the LEFT side towards the back: a wide lower flight, a landing, two upper
  //     flights with a dark wall between them; two round columns frame its foot. The `stairs` object sits at the
  //     foot. The LUG stall is the nook BEHIND the staircase.
  //   - A spiral chandelier on the overhead layer over the middle of the hall (not over the stairs).
  //   - Low red and blue sofas with small tables on the left and right back walls.
  //   - Library and Career Services: closed doors in the left wall beside the staircase.
  // Approximations (nothing in the free packs matches): the spiral gold-ring chandelier is two tiers of the
  // existing chandelier; the terrarium is the pack's glass pane + ficus on a masked wood plinth; the totems
  // are plain rectangles; the "round" sofas are the pack's low pouf recoloured.
  foyer: (put, ix0, iy0, ix1, iy1, ctx) => {
    if (!ctx || !ctx.floor) return;
    const { floor, id } = ctx;
    const r = floor.get(id);
    const S = (x, y, name) => floor.placeStructure(x, y, name);
    const mirror = (x) => floor.W - 1 - x; // about the hall's centre line (the canvas is 40 wide)
    const wallTop = r.y0; // the back wall's row

    // ---- the back wall: the lit wordmark, and the mezzanine railing in front of the right-hand half ----
    const segs = Array.from({ length: 9 }, (_, i) => `bitsSignSeg${i}`);
    floor.placeStructureRow(15, wallTop, segs);
    for (let x = 22; x <= 27; x++) S(x, wallTop + 1, 'intAtriumRailing');
    floor.depthGroupRect(22, wallTop + 1, 27, wallTop + 1);
    floor.bigPlant(21, wallTop + 1); // a plant at each end of the railing
    floor.bigPlant(28, wallTop + 1);

    // ---- the LUG stall, in the nook behind the staircase ----
    const top = r.y0 + 1; // the hall's first interior row (iy0 is one further in)
    for (const x of [13, 14, 15]) S(x, top, 'intCanteenCounter');
    S(16, top, 'intNoticeboard'); // the LUG banner
    floor.rectObject('area', 'LUG Stall', 11, top, 19, top + 2, { kind: 'stall' });

    // ---- the split staircase (x 13..18), against the left side towards the back ----
    const sx0 = 13, sx1 = 18;
    const upperY0 = top + 3; // 18
    const landingY = upperY0 + 3; // 21
    const lowerY0 = landingY + 1; // 22
    const lowerY1 = lowerY0 + 2; // 24
    const treadAt = (x) => (x === sx0 ? 'intFoyerStairsL' : x === sx1 ? 'intFoyerStairsR' : 'intFoyerTreadPlain');
    for (let y = upperY0; y < landingY; y++) {
      for (let x = sx0; x <= sx1; x++) {
        const inUpperFlight = x <= sx0 + 1 || x >= sx1 - 1;
        S(x, y, inUpperFlight ? treadAt(x) : 'intAtriumVoid'); // the dark plain wall between the two upper flights
      }
    }
    for (let x = sx0; x <= sx1; x++) S(x, landingY, 'intFoyerLanding');
    for (let y = lowerY0; y <= lowerY1; y++) for (let x = sx0; x <= sx1; x++) S(x, y, treadAt(x));
    floor.depthGroupRect(sx0, upperY0, sx1, lowerY1);
    // the `stairs` object itself sits on a walkable stair mat at the foot, between the two round columns
    const footY = lowerY1 + 1; // 25
    floor.paintFloor(15, footY, 16, footY, 'intStairsUp');
    floor.pointObject('stairs', 'Main Block Stairs G (up)', 15, footY, { to: 'main-block-1', toId: 'Main Block Stairs 1 (down)', facing: 'down' });
    // two round columns (a 2-wide x 3-tall cap/shaft/base block each) frame the foot
    for (const cx0 of [sx0, sx1 - 1]) {
      for (let i = 0; i < 3; i++) {
        const band = i === 0 ? 'Cap' : i === 2 ? 'Base' : 'Shaft';
        S(cx0, footY + i, `intColumn${band}L`);
        S(cx0 + 1, footY + i, `intColumn${band}R`);
      }
      floor.depthGroupRect(cx0, footY, cx0 + 1, footY + 2);
    }

    // ---- the spiral chandelier: two tiers of the existing chandelier, over the middle of the hall ----
    const chandelier = (x, y) => {
      floor.placeOverhead(x, y, 'intChandelier');
      floor.placeOverhead(x + 1, y, 'intChandelierTR');
      floor.placeOverhead(x, y + 1, 'intChandelierBL');
      floor.placeOverhead(x + 1, y + 1, 'intChandelierBR');
    };
    chandelier(19, footY);
    chandelier(21, footY - 3);

    // ---- the terrarium on its round plinth, on the central axis, and the totem pillars either side ----
    const tx = 19, ty = 29;
    const terrarium = [['TL', 'TR'], ['ML', 'MR'], ['BL', 'BR']];
    terrarium.forEach((row, j) => row.forEach((part, i) => S(tx + i, ty + j, `intTerrarium${part}`)));
    floor.depthGroupRect(tx, ty, tx + 1, ty + 2);
    for (const x of [15, 17, mirror(17), mirror(15)]) {
      S(x, ty, 'intTotemTop');
      S(x, ty + 1, 'intTotemBase');
      floor.depthGroupRect(x, ty, x, ty + 1);
    }

    // ---- sofas and small tables on the right and left back walls ----
    for (const x of [23, 24]) { S(x, 18, 'intSofaRed'); S(x, 20, 'intSofaBlue'); }
    S(25, 18, 'table');
    S(25, 20, 'table');
    S(11, 20, 'intSofaRed');
    S(11, 21, 'table');
    S(11, 22, 'intSofaBlue');

    // ---- reception: two desks, one each side of the entrance ----
    for (const x0 of [11, mirror(13)]) {
      S(x0, 34, 'intReceptionDeskL');
      S(x0 + 1, 34, 'intReceptionDesk');
      S(x0 + 2, 34, 'intReceptionDeskR');
    }
    // a frosted-glass partition behind each desk (4 panes, alternating the two edge variants)
    for (const px0 of [11, mirror(14)]) {
      for (let i = 0; i < 4; i++) S(px0 + i, 32, i % 2 ? 'intGlassPanelB' : 'intGlassPanel');
    }
    // the glass side doors (closed wall doors) between each desk and the entrance doors, and a big plant
    for (const dx of [15, mirror(16)]) {
      floor.closedDoor(dx, r.y1, 'intGlassDoor', dx < 20 ? 'Glass side door (left)' : 'Glass side door (right)');
      floor.closedDoor(dx + 1, r.y1, 'intGlassDoor', dx < 20 ? 'Glass side door (left)' : 'Glass side door (right)');
    }
    floor.bigPlant(17, 35);
    floor.bigPlant(mirror(17), 35);

    // ---- Library and Career Services: closed doors in the left wall, beside the staircase ----
    floor.closedDoor(r.x0, 17, 'intDoorFlush', 'Library door');
    S(r.x0, 18, 'intNameplate');
    floor.closedDoor(r.x0, 25, 'intDoorFlush', 'Career Services door');
    S(r.x0, 26, 'intNameplate');
  },
  classroom: (put, ix0, iy0, ix1, iy1, ctx) => {
    put(Math.round((ix0 + ix1) / 2), iy0, 'intTeacherDesk');
    // Quality loop ("Room 195 is fine, but... target less than ~40% plain floor"): desks packed
    // side by side (stepX 1, was 2) in every row (stepY 1, was 2) -- a genuinely dense classroom,
    // not a sparse quarter-filled grid.
    rowGrid(put, ix0, iy0, ix1, iy1, 'intDesk', { topMargin: 1, stepX: 1, stepY: 1 });
    // A few extra desks on the RIGHT-hand 1-tile walkway ring furnish() leaves along the side wall,
    // alternating with a clear tile, for density. The left ring stays fully clear: desks on both rings
    // used to cut each ring into pieces at every desk row (a ring tile with a desk in it is a wall to
    // a 1-wide path), which walled the whole top of Room 195 -- the teacher's desk, where the key
    // station is -- off from the door (found by tests/unit/story-clearance.test.js, 2026-10-03, ERR-0013).
    if (ctx && ctx.floor) {
      for (let y = iy0 + 1; y <= iy1; y += 2) ctx.floor.placeStructure(ix1 + 1, y, 'intDesk');
    }
    // A whiteboard mounted on the room's own front wall, above the teacher's desk (owner brief:
    // "classrooms with desks facing a whiteboard") -- wallFeature overrides one wall tile, it can
    // never block the doorway ring furniture already respects.
    if (ctx && ctx.floor) {
      ctx.floor.wallFeature(ctx.id, 'top', 'intWhiteboardWall');
      // FB-0030/0031 (Room 195, docs/research/campus-visual-reference.md "4. Classroom": "a
      // full-width whiteboard plus a pull-down projector screen"), a few tiles over so it never
      // collides with the whiteboard at the room's own midpoint.
      const r = ctx.floor.get(ctx.id);
      const mid = Math.round((r.x0 + r.x1) / 2);
      if (mid + 3 <= r.x1 - 1) ctx.floor.placeStructure(mid + 3, r.y0, 'intProjectorScreen');
    }
  },
  // ICVL (docs/research/campus-visual-reference.md "5. Computer lab / ICL"): royal-blue built-in
  // benches along both ends, a server rack, and a poster-covered wall -- distinct from the shared
  // `lab` type Mechanical Block's own labs use, so that furniture never changes here.
  // Quality loop (docs/quality/scorecard.md, Interior art run 1: "a big pale empty floor... no rows
  // of desks with monitors, no blue cabinetry or poster wall") -- 3-4 full rows of benches (not just
  // the top/bottom edge), a server-rack corner (2 tiles, its own depthGroup) and a poster wall
  // covering most of the front wall.
  // Quality loop run 2 (docs/quality/scorecard.md, 2026-09-28: "Over-corrected: a solid wall-to-wall
  // grid of identical blue desks, no aisles, she stands among them... about 50% walkable floor").
  // 4 desk rows (monitors + a chair alternating) with a 1-tile aisle between each, blue cabinets
  // along the left wall, a 1-tile walkway along the right wall (plus the always-clear ring beyond
  // it -- 2 tiles of walking space along that side), a teacher/instructor desk + whiteboard at the
  // front, and server racks in the front-right corner.
  labIcvl: (put, ix0, iy0, ix1, iy1, ctx) => {
    const mid = Math.round((ix0 + ix1) / 2);
    put(mid, iy0, 'intTeacherDesk');
    // Cabinets along the rest of the front wall too, either side of the teacher's desk.
    for (let x = ix0; x <= ix1 - 2; x++) if (x !== mid) put(x, iy0, 'intIcvlCabinet');
    const deskRows = [iy0 + 1, iy0 + 3, iy0 + 5, iy0 + 7].filter((y) => y <= iy1);
    const aisleRows = [iy0 + 2, iy0 + 4, iy0 + 6].filter((y) => y <= iy1);
    for (const y of deskRows) {
      put(ix0, y, 'intIcvlCabinet'); // blue cabinets along the left wall
      for (let x = ix0 + 1; x <= ix1 - 1; x++) put(x, y, (x - ix0) % 2 === 1 ? 'intIcvlBench' : 'intChair');
      // ix1 itself stays clear: a walkway down the right side, alongside the ring furnish() always
      // leaves just beyond it.
    }
    for (const y of aisleRows) {
      // Quality loop run 3 ("plants sit on brick-tile pedestals"): `intPottedPlant`, not `plant`.
      put(ix0 + 3, y, 'intPottedPlant');
      put(ix0 + 6, y, 'intPottedPlant');
      put(ix0 + 8, y, 'intBin');
    }
    if (ctx && ctx.floor) {
      const rackX0 = ix1 - 1, rackX1 = ix1;
      put(rackX0, iy0, 'intServerRack');
      put(rackX1, iy0, 'intServerRack');
      ctx.floor.depthGroupRect(rackX0, iy0, rackX1, iy0);
      ctx.floor.wallFeature(ctx.id, 'top', 'intWhiteboardWall');
      const r = ctx.floor.get(ctx.id);
      for (let x = r.x0 + 1; x <= r.x1 - 1; x += 3) ctx.floor.placeStructure(x, r.y0, 'intNoticeboard');
    }
  },
  // The Physics Lab (docs/research/campus-visual-reference.md "6. Physics/science lab") -- quality
  // loop run 2 ("[was] uniform rows of identical benches, like a warehouse"): exactly 3 long bench
  // rows (not a repeated grid), each a mix of the 3 differently-topped bench tiles (a scope, flasks,
  // a laptop) plus stools, clear multi-row aisles between them, apparatus shelves along a wall, a
  // sink + fume hood, and a whiteboard at the front.
  // Quality loop run 3 (docs/quality/scorecard.md, 2026-09-29: "still a uniform grid, sparse wall
  // decoration... vary the bench layout: 2 long benches plus an island bench... posters/periodic
  // table and diagrams on walls, an equipment trolley, a demo desk at the front"). 3 different bench
  // shapes now instead of 3 repeats of the same full-width row: a long bench along the top (under
  // the demo desk + whiteboard), a second long bench running down the left wall, and a short
  // freestanding island bench in the middle of the room.
  labPhysics: (put, ix0, iy0, ix1, iy1, ctx) => {
    const mid = Math.round((ix0 + ix1) / 2);
    const benchTiles = ['intLabBenchWood', 'intLabBenchScope', 'intLabBenchFlask', 'intLabBenchLaptop'];

    // The demo desk at the front, under the whiteboard.
    put(mid, iy0, 'intTeacherDesk');

    // Long bench 1: the full width, just past the demo desk, with a row of stools.
    const topBenchY = iy0 + 2;
    for (let x = ix0; x <= ix1; x++) put(x, topBenchY, benchTiles[(x - ix0) % benchTiles.length]);
    for (let x = ix0 + 1; x <= ix1 - 1; x++) put(x, topBenchY + 1, x % 2 === 1 ? 'intChair' : 'intBooksStack');

    // Long bench 2: down the left wall.
    const sideBenchY0 = iy0 + 5, sideBenchY1 = iy1 - 3;
    for (let y = sideBenchY0; y <= sideBenchY1; y++) {
      put(ix0, y, benchTiles[(y - sideBenchY0) % benchTiles.length]);
      put(ix0 + 1, y, 'intChair');
    }

    // The island bench: short, freestanding, not touching any wall.
    const islandY = iy1 - 1;
    const islandX0 = mid - 2, islandX1 = mid + 2;
    for (let x = islandX0; x <= islandX1; x++) put(x, islandY, benchTiles[(x - islandX0) % benchTiles.length]);
    for (let x = islandX0; x <= islandX1; x++) put(x, islandY - 1, 'intChair');
    put(islandX1 + 2, islandY, 'intEquipmentTrolley');

    // Apparatus shelves down *both* walls (tall furniture, its own walk-behind depthGroup, ADR
    // 0015), in whichever rows aren't already a bench/stool/island row.
    const midY = Math.round((iy0 + iy1) / 2);
    const isFreeRow = (y) => !(y === topBenchY || y === topBenchY + 1 || y === islandY || y === islandY - 1 || (y >= sideBenchY0 && y <= sideBenchY1));
    for (let y = iy0 + 1; y <= iy1; y++) {
      if (!isFreeRow(y)) continue;
      put(ix1, y, 'intLabRack');
      if (ctx && ctx.floor) ctx.floor.depthGroupRect(ix1, y, ix1, y);
      if (y > sideBenchY1) { // the left wall's own free rows below the 2nd long bench
        put(ix0, y, 'intLabTank');
        if (ctx && ctx.floor) ctx.floor.depthGroupRect(ix0, y, ix0, y);
      }
    }
    put(ix1 - 1, iy0 + 1, 'intLabTank');
    if (ctx && ctx.floor) ctx.floor.depthGroupRect(ix1 - 1, iy0 + 1, ix1 - 1, iy0 + 1);
    put(ix1, midY, 'intSink');
    put(ix1, midY + 1 <= iy1 ? midY + 1 : midY, 'intFumeHood');
    // Extra apparatus in the gap between the demo desk and the first long bench.
    for (let x = ix0 + 2; x <= ix1 - 2; x += 2) put(x, iy0 + 1, x % 4 === 0 ? 'intLabTank' : 'intBooksStack');
    put(ix1 - 2, iy0 + 1, 'intEquipmentTrolley');

    // The room reads spacious with just the 3 bench clusters (a 16x13 room, "2 long benches + an
    // island" alone leaves most of the floor open) -- a light scatter of stools/apparatus across the
    // *rest* of the open floor, every 3rd column, still leaves 2 clear tiles out of 3 as a real
    // aisle in both directions.
    const scatter = ['intChair', 'intLabTank', 'intBooksStack'];
    let s = 0;
    for (let y = iy0 + 1; y <= iy1; y++) {
      if (y === topBenchY || y === topBenchY + 1) continue;
      const inSideBenchRow = y >= sideBenchY0 && y <= sideBenchY1;
      const inIslandRow = y === islandY || y === islandY - 1;
      const xStart = inSideBenchRow ? ix0 + 4 : ix0 + 1; // stay clear of the side bench + its chair
      for (let x = xStart; x <= ix1 - 1; x += 2) {
        if (inIslandRow && x >= islandX0 - 1 && x <= islandX1 + 1) continue; // the island + its own chairs/trolley
        put(x, y, scatter[s++ % scatter.length]);
      }
    }

    if (ctx && ctx.floor) {
      ctx.floor.wallFeature(ctx.id, 'top', 'intWhiteboardWall');
      // Posters/periodic table/diagrams on both the front and back walls.
      const r = ctx.floor.get(ctx.id);
      ctx.floor.placeStructure(mid - 4, r.y0, 'intWallPoster');
      ctx.floor.placeStructure(mid + 4, r.y0, 'intWallPoster');
      ctx.floor.placeStructure(mid - 3, r.y1, 'intWallPoster');
      ctx.floor.placeStructure(mid + 3, r.y1, 'intWallPoster');
    }
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
  // The two wing-end lobbies (ADR 0020): dressed by mainBlockG's own plan (tools/interiors/plans.js), so no
  // generic furniture here.
  wingLobby: () => {},
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
