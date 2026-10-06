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
const { doorProps, DOOR_KINDS } = require('../lib/door-kinds');

const ROOT = path.join(__dirname, '..', '..');
const TILE_PX = 16;

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : null;
const MAPS_OUT = outDir ? outDir : path.join(ROOT, 'assets', 'maps');
const PREVIEW_OUT = outDir ? outDir : path.join(ROOT, 'docs', 'research', 'interiors');

const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const TILE = Object.fromEntries(tileInfo.tiles.map((tile, i) => [tile.name, i]));
const TILE_NAMES = tileInfo.tiles.map((tile) => tile.name);

const REQUIRED_TILES = [
  'intDoorway', 'intStairsUp', 'intStairsDown', 'intLift', 'intAtriumVoid', 'intAtriumVoidEdge', 'intAtriumRailing',
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
  'intFoyerLanding', 'intChandelier', 'intGlassDoorOpen', 'intDoorClosed', 'intIclBench',
  'intServerRack', 'intLabBenchWood', 'intProjectorScreen',
  ...Array.from({ length: 9 }, (_, i) => `bitsSignSeg${i}`), // "BITS PILANI, DUBAI CAMPUS" wordmark
  // Quality loop (docs/quality/scorecard.md, Interior art run 1, 2026-09-28): real LimeZu
  // Room_Builder walls (cap + face) and floors.
  'intWallCap', 'intWallFace', 'intWallFaceEndL', 'intWallFaceEndR', 'intWallWindow',
  'intFloorTiled', 'intFloorLabLight',
  // Quality loop, Interior art run 2 (2026-09-28): plain stair treads, the chandelier's other 3
  // quadrants, and the ICL/Physics Lab's extra furniture variety.
  'intFoyerTreadPlain', 'intChandelierTR', 'intChandelierBL', 'intChandelierBR', 'intChair',
  'intIclCabinet', 'intFumeHood', 'intLabBenchScope', 'intLabBenchFlask', 'intLabBenchLaptop',
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
  // P4a (FB-0058/0059/0060/0062/0065): the black void, and the side-on doorway/doors/window for vertical walls.
  'intVoid', 'intDoorwaySide', 'intDoorClosedSideL', 'intDoorClosedSideR', 'intGlassDoorSideL', 'intGlassDoorSideR',
  'intDoorOfficeSideL', 'intDoorOfficeSideR', 'intDoorFlushSideL', 'intDoorFlushSideR', 'intDoorDarkSideL', 'intDoorDarkSideR',
  'intWallWindowSideL', 'intWallWindowSideR', 'libSignSeg0', 'libSignSeg1', 'libSignSeg2',
  // P4b (FB-0061/0063/0064/0069): the Main Block's stairs (LimeZu's stepped flight with gold rails) and the lift.
  ...['M', 'EL', 'ER', 'WL', 'WR'].flatMap((kind) => [0, 1, 2, 3].map((row) => `intStairs${kind}${row}`)),
  'intStairsFootM', 'intStairsFootWL', 'intStairsFootWR', 'intStairsLandL', 'intStairsLandM', 'intStairsLandR',
  ...['L', 'R'].flatMap((side) => [0, 1, 2].map((row) => `intStairsWall${side}${row}`)),
  'intStairsSignUp', 'intStairsSignDown', 'intLiftDoorL', 'intLiftDoorR', 'intLiftOpenL', 'intLiftOpenR', 'intLiftPanel',
  // P5c (FB-0071): the ICL's spaceship / super-computing lab kit (tools/lib/icl-tech-art.js).
  'intTechFloor', 'intTechFloorB', 'intTechFloorStripH', 'intTechFloorStripV', 'intTechFloorStripSE', 'intTechFloorStripSW',
  'intTechFloorStripNE', 'intTechFloorStripNW', 'intTechFloorStripTS', 'intTechPad', 'intTechTrunkH', 'intTechTrunkV',
  'intWallTech', 'intWallTechEndL', 'intWallTechEndR', 'intWallTechCap', 'intWallScanner',
  ...[0, 1, 2, 3].flatMap((col) => [`intWallDisplay${col}`, `intTechDisplayBase${col}`]),
  ...DOOR_KINDS.iclHatch.closed, ...DOOR_KINDS.iclHatch.half, ...DOOR_KINDS.iclHatch.open,
  'intTechRackTopA', 'intTechRackBaseA', 'intTechRackTopB', 'intTechRackBaseB', 'intTechLedsTopA', 'intTechLedsTopB', 'intTechLedsBaseA', 'intTechLedsBaseB',
  'intTechConsoleL', 'intTechConsoleM', 'intTechConsoleR', 'intTechConsoleS', 'intTechCoreConsole', 'intTechChair', 'intTechCoffee', 'intTechPlanter', 'intTechPylon',
  ...[0, 1, 2, 3].flatMap((col) => [0, 1].map((row) => `intHoloTable${col}${row}`)),
  ...[0, 1, 2].flatMap((frame) => [`intHoloGlobe${frame}L`, `intHoloGlobe${frame}R`]),
  'intTechLightBarL', 'intTechLightBarM', 'intTechLightBarR', 'intScannerGlow0', 'intScannerGlow1', 'intScannerGlow2', 'intScannerOk',
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
  // P5c (FB-0071): the ICL's navy bulkhead with a glowing cyan light band; `cap` is the steel top face bled in one row above its top wall
  // (the cream kits use `intWallCap`).
  tech: { plain: 'intWallTech', endL: 'intWallTechEndL', endR: 'intWallTechEndR', cap: 'intWallTechCap' },
};

// P4a (FB-0058/0060/0065): the front-on door/window tiles each have a side-on twin for a wall that runs up and down the
// screen (tools/make-assets.js sideDoorTile). `L`: the wall is on the tile's left (the room is to its right), `R` the
// mirror; `both` is symmetric (a doorway between two rooms). useSideVariants() applies the swap after a floor is built.
const SIDE_VARIANTS = {
  intDoorway: { both: 'intDoorwaySide' }, // the only one that lives on the ground layer
  intDoorClosed: { L: 'intDoorClosedSideL', R: 'intDoorClosedSideR' },
  intGlassDoor: { L: 'intGlassDoorSideL', R: 'intGlassDoorSideR' },
  intDoorOffice: { L: 'intDoorOfficeSideL', R: 'intDoorOfficeSideR' },
  intDoorFlush: { L: 'intDoorFlushSideL', R: 'intDoorFlushSideR' },
  intDoorDarkL: { L: 'intDoorDarkSideL', R: 'intDoorDarkSideR' },
  intDoorDarkR: { L: 'intDoorDarkSideL', R: 'intDoorDarkSideR' },
  intWallWindow: { L: 'intWallWindowSideL', R: 'intWallWindowSideR' },
};
// Structures-layer tiles that are part of a wall's line (so a door's neighbours along the wall are one of these):
// every wall kit, the wall dressing, and every door/window tile in either orientation.
const WALL_LINE_TILES = new Set([
  ...[WALL_DEFAULT, ...Object.values(WALL_KITS)].flatMap((k) => [k.plain, k.endL, k.endR]), 'bitsWall',
  'intNameplate', 'intWallPoster', 'intWhiteboardWall', 'intProjectorScreen', 'intNoticeboard', 'intLift', 'intWallWindow',
  'intLiftDoorL', 'intLiftDoorR', 'intLiftPanel', 'intStairsSignUp', 'intStairsSignDown',
  'intWallFaceSkirt', 'intGlassPanel', 'intGlassPanelB',
  // P5c: the scanner pad and the tech bulkhead pieces stand in a wall line too (a door beside them must still read as being in a wall)
  'intWallScanner', 'intWallTech', 'intWallTechEndL', 'intWallTechEndR', ...[0, 1, 2, 3].map((col) => `intWallDisplay${col}`),
  ...DOOR_KINDS.iclHatch.closed, ...DOOR_KINDS.iclHatch.open,
  ...Object.keys(SIDE_VARIANTS), ...Object.values(SIDE_VARIANTS).flatMap((v) => Object.values(v)),
  ...Array.from({ length: 9 }, (_, i) => `bitsSignSeg${i}`), 'libSignSeg0', 'libSignSeg1', 'libSignSeg2',
]);

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
  // FB-0030/0031: the ICL/Physics Lab key rooms get their own light floor (matches the ICL/lab
  // photos, docs/research/campus-visual-reference.md), distinct from the shared 'lab' type
  // Mechanical Block's own labs still use.
  labIcl: 'intTechFloor', labPhysics: 'intFloorLabLight', // P5c: the ICL is the navy spaceship lab now
};

// A room type this small (walkable interior) skips furniture rather than risk blocking itself.
const MIN_FURNISHABLE = 4;

class Floor {
  constructor(key, plan) {
    this.key = key;
    this.plan = plan;
    this.W = plan.width;
    this.H = plan.height;
    // P4a (FB-0059): every cell no room claims is the solid black `intVoid`, not the dirt-brown `edge` tile.
    this.ground = new Int32Array(this.W * this.H).fill(TILE.intVoid);
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
    if (wallKit) this.capTopWall(rect, kit.cap || 'intWallCap');
    return rect;
  }

  // Bleeds a wall-cap tile one row *above* a room's own top wall (quality loop: "a top edge... 2+
  // rows tall") -- only where that row is still the untouched default void (`intVoid`, always solid),
  // the same "art may extend above a building's own footprint" trick outdoor buildings already use
  // (ADR 0015) rather than reserving an extra row of canvas for every room. A room packed directly
  // against another room's own wall above it (no clearance) just doesn't get a cap there -- still a
  // correct, if slightly shorter, wall; never overwrites another room's own tiles.
  capTopWall(rect, capTile = 'intWallCap') {
    const y = rect.y0 - 1;
    if (y < 0) return;
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (this.ground[this.idx(x, y)] === TILE.intVoid && this.structures[this.idx(x, y)] === -1) {
        this.structures[this.idx(x, y)] = TILE[capTile];
      }
    }
  }

  // The tile index of a tile name (plans use it to check the ground they are about to build on).
  tileIndex(name) {
    if (!(name in TILE)) throw new Error(`${this.key}: no tile named "${name}"`);
    return TILE[name];
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
  exteriorDoor(id, side, { name, to, toId, facing, at }) {
    const r = this.get(id);
    const mid = at !== undefined ? at : side === 'top' || side === 'bottom' ? Math.round((r.x0 + r.x1) / 2) : Math.round((r.y0 + r.y1) / 2);
    const horizontal = side === 'top' || side === 'bottom';
    const [x, y] = side === 'top' ? [mid, r.y0] : side === 'bottom' ? [mid, r.y1] : side === 'left' ? [r.x0, mid] : [r.x1, mid];
    this.setDoor(x, y);
    this.setDoor(x + (horizontal ? 1 : 0), y + (horizontal ? 0 : 1));
    // P4c (FB-0067, every door opens and closes): the doorway is not an empty opening at rest any more but a closed glass double door
    // (the `exitGlass` kind's closed pair, walkable like every door tile) standing over the lit threshold, so the engine has a door to
    // open when she walks out and to close behind her when she walks in (tools/lib/door-kinds.js). A door in a vertical wall (1x2) keeps
    // the bare doorway: no map has one, and the kind's art is front-on.
    if (horizontal) DOOR_KINDS.exitGlass.closed.forEach((tileName, i) => { this.structures[this.idx(x + i, y)] = TILE[tileName]; });
    // FB-0046: the doorway is two tiles wide (the two setDoor() cells above) while the object is a point on the
    // first one -- `cells` ("2x1", or "1x2" for a door in a vertical wall) makes every cell of it the door
    // (src/maplogic.js parseDoorCells()), so she can't stand in the second half of a doorway without entering.
    const props = { to, toId, facing, cells: horizontal ? '2x1' : '1x2' };
    if (horizontal) Object.assign(props, doorProps('exitGlass'));
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

  // P4b (FB-0061/0063): a block of the Main Block's stair tiles, `kinds` one per column (left to right) and `rows` one per tile row
  // (top to bottom), each row 0 (far end of a flight, darkest) .. 3 (near end). Kinds: M plain treads, EL/ER gold handrail on the
  // left/right, WL/WR a plain stringer against a wall (tools/make-assets.js stairsTile()).
  stairBlock(x, y, kinds, rows) {
    rows.forEach((row, j) => kinds.forEach((kind, i) => this.placeStructure(x + i, y + j, `intStairs${kind}${row}`)));
  }

  // P4b (FB-0064/0069): a working lift in a horizontal wall -- two stainless door tiles with the floor-indicator lamp over them
  // (the `lift` object's own cells), the call-button plate on the wall just right of them, and the `lift` object itself. Like a
  // door it is a point on the first tile with `cells` "2x1", `facing` is the way she faces on arrival (the front tile is one
  // step that way, resolveSpawnAt()) and `closedTiles` / `halfTiles` / `openTiles` name the frames the door animation plays (P4c, the `lift` kind in tools/lib/door-kinds.js).
  // Pressing E in front of it opens the floor-choice list (src/maps.js `lift`, src/maplogic.js liftDialog()).
  liftDoor(x, y, name) {
    this.placeStructure(x, y, 'intLiftDoorL');
    this.placeStructure(x + 1, y, 'intLiftDoorR');
    this.placeStructure(x + 2, y, 'intLiftPanel');
    this.pointObject('lift', name, x, y, { facing: 'down', cells: '2x1', ...doorProps('lift') });
  }

  // P5c (FB-0071): the ICL's fingerprint-locked hatch. Two door-leaf tiles (solid while sealed) laid over the doorway the room's connect() carved
  // in a horizontal wall, plus a `sealedDoor` object: a point on the first tile with `cells` "2x1", `flag` (the GameState flag that opens it)
  // and the door-animation frames (the `iclHatch` kind of tools/lib/door-kinds.js, the same closed/half/open properties a door carries). It
  // never warps. The engine (src/scenes/world.js createGates()) keeps it sealed until the flag is set, plays the opening, and leaves it open.
  sealedDoor(x, y, name, flag) {
    DOOR_KINDS.iclHatch.closed.forEach((tileName, i) => { this.structures[this.idx(x + i, y)] = TILE[tileName]; });
    this.pointObject('sealedDoor', name, x, y, { cells: '2x1', facing: 'down', flag, ...doorProps('iclHatch') });
  }

  // P5c: a wall-mounted fingerprint scanner (a solid wall fitting) and its `scanner` object, which names the door it opens. The engine lays the
  // pulsing glow over the pad (src/scenes/world.js createScanners()); E in front of it starts the ICL's mini-game (EDI Madness, ADR 0025).
  scannerPad(x, y, name, door) {
    this.structures[this.idx(x, y)] = TILE.intWallScanner;
    this.pointObject('scanner', name, x, y, { door, glow: 'intScannerGlow0,intScannerGlow1,intScannerGlow2,intScannerGlow1', ok: 'intScannerOk', ms: '450' });
  }

  // P5c: a tile animation (a `tileAnim` object): the engine cycles the listed overlay tiles over the cell (blinking rack LEDs, the holo globe).
  // `ms` is how long each frame shows (never under 450 ms for a blink: nothing flashes faster than about 3 times a second, STYLE_GUIDE.md), `phase`
  // shifts where in the cycle it starts so a row of racks does not blink in step.
  tileAnim(x, y, frames, { ms = 500, phase = 0 } = {}) {
    this.pointObject('tileAnim', '', x, y, { frames: frames.join(','), ms: String(ms), phase: String(phase) });
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

  // P4a (FB-0058/0060/0065): swaps every front-on door/window tile that stands in a VERTICAL wall (a wall running up
  // and down the screen) for its side-on twin (SIDE_VARIANTS), choosing the left or right form by which side the room
  // is on. Called once after a floor is fully built and furnished, so plans and furnishers just place `intDoorOffice`
  // etc. and never think about orientation. Orientation comes from the neighbours: a door is in a vertical wall when
  // the cells above and below it are wall line, and in a horizontal wall when the cells left and right of it are.
  // A door it cannot place either way is a plan mistake and throws (docs/ARCHITECTURE.md rule 1).
  useSideVariants() {
    const nameOf = (layer, x, y) => {
      if (!this.inBounds(x, y)) return null;
      const t = layer[y * this.W + x];
      return t < 0 ? null : TILE_NAMES[t];
    };
    const wallLine = (x, y) => WALL_LINE_TILES.has(nameOf(this.structures, x, y)) || WALL_LINE_TILES.has(nameOf(this.ground, x, y));
    const isOpen = (x, y) => this.inBounds(x, y) && this.ground[y * this.W + x] !== TILE.intVoid && !wallLine(x, y) && this.structures[y * this.W + x] !== TILE.intWallCap;
    for (let y = 0; y < this.H; y++) {
      for (let x = 0; x < this.W; x++) {
        for (const layerName of ['structures', 'ground']) {
          const layer = this[layerName];
          const name = nameOf(layer, x, y);
          const variants = name && SIDE_VARIANTS[name];
          if (!variants) continue;
          if ((layerName === 'ground') !== Boolean(variants.both)) continue; // doorways live on the ground, the rest on structures
          const horizontal = wallLine(x - 1, y) && wallLine(x + 1, y);
          const vertical = wallLine(x, y - 1) && wallLine(x, y + 1);
          if (!horizontal && !vertical) throw new Error(`${this.key}: "${name}" at (${x},${y}) is not in a wall line (cannot tell which way the wall runs)`);
          if (horizontal && !vertical) continue; // a wall across the screen: the front-on tile is right
          if (variants.both) { layer[y * this.W + x] = TILE[variants.both]; continue; }
          const roomRight = isOpen(x + 1, y);
          const roomLeft = isOpen(x - 1, y);
          if (!roomRight && !roomLeft) throw new Error(`${this.key}: "${name}" at (${x},${y}) is in a vertical wall with no floor on either side`);
          layer[y * this.W + x] = TILE[roomRight ? variants.L : variants.R];
        }
      }
    }
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
  // The Main Block 2nd-floor landing (the only `lounge`). 2026-10-04 (defect sweep D06): it was 85% bare floor on the
  // route to the Physics Lab, so it is now a furnished student lounge laid out in three bands inside the 26 x 8
  // interior (local lx 0..25, ly 0..7): wall-side props along the top row (benches, a vending machine, a water cooler,
  // plants, a bin), conversation sets (sofa-table-sofa or chair-table-chair) two rows below, a clear 2-wide lane
  // down the middle (ly 3..4: the stairwell door and the spawn are on it), a lower row of sets, and wall-side props
  // along the bottom row. Row ly 6 stays free for the ambient student's patrol. Everything is existing tiles; the
  // density/bare-floor limits are in tests/unit/completeness.test.js. Posters and the two notice boards are mounted on
  // the front wall. All placement is relative to the room's own interior, so it follows the rect if it ever moves.
  lounge: (put, ix0, iy0, ix1, iy1, ctx) => {
    if (!ctx || !ctx.floor) return;
    const { floor, id } = ctx;
    const r = floor.get(id);
    const ox = r.x0 + 1;
    const oy = r.y0 + 1;
    const S = (lx, ly, name) => floor.placeStructure(ox + lx, oy + ly, name);
    const potted = (lx, ly) => { S(lx, ly, 'intPottedPlant'); floor.depthGroupRect(ox + lx, oy + ly, ox + lx, oy + ly); };
    // wall-side props, top row
    potted(1, 0);
    S(3, 0, 'intBench'); S(4, 0, 'intBench');
    S(7, 0, 'intVendingMachine'); S(8, 0, 'intWaterCooler');
    S(12, 0, 'intBench'); S(13, 0, 'intBench');
    S(17, 0, 'intBin'); potted(18, 0);
    S(21, 0, 'intBench'); S(22, 0, 'intBench');
    potted(24, 0);
    // upper conversation sets
    S(2, 2, 'intSofaRed'); S(3, 2, 'table'); S(4, 2, 'intSofaBlue');
    S(10, 2, 'intChair'); S(11, 2, 'table'); S(12, 2, 'intChair');
    S(18, 2, 'intSofaBlue'); S(19, 2, 'table'); S(20, 2, 'intSofaRed');
    // lower conversation sets
    S(5, 5, 'intBench'); S(6, 5, 'intBench');
    S(10, 5, 'intChair'); S(11, 5, 'table'); S(12, 5, 'intChair');
    S(17, 5, 'intSofaRed'); S(18, 5, 'table'); S(19, 5, 'intSofaBlue');
    S(23, 5, 'intVendingMachine');
    // wall-side props, bottom row
    potted(1, 7);
    S(4, 7, 'intBin');
    S(8, 7, 'intBench'); S(9, 7, 'intBench');
    potted(14, 7);
    S(20, 7, 'intBench'); S(21, 7, 'intBench');
    potted(24, 7);
    // wall-mounted: two posters between the two notice boards and one over the east end
    const midX = Math.round((r.x0 + r.x1) / 2);
    for (const x of [midX - 8, midX, midX + 8]) floor.placeStructure(x, r.y0, 'intWallPoster');
    floor.placeStructure(midX - 3, r.y0, 'intNoticeboard');
    floor.placeStructure(midX + 3, r.y0, 'intNoticeboard');
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
  //   - Career Services: a closed door in the left wall beside the staircase. The Library is straight ahead: a double
  //     door in the back wall (x 19..20) opens into a small bright lobby, and the Library door is on ITS back wall.
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
    // FB-0062: the library lobby's double door now sits in the middle of this wall (x 19..20), so the wordmark is
    // split round it: "BITS PILANI," (segments 0..3) left of the door, "DUBAI CAMPUS" (segments 4..8) right of it.
    const segs = Array.from({ length: 9 }, (_, i) => `bitsSignSeg${i}`);
    floor.placeStructureRow(15, wallTop, segs.slice(0, 4));
    floor.placeStructureRow(21, wallTop, segs.slice(4));
    for (let x = 22; x <= 27; x++) S(x, wallTop + 1, 'intAtriumRailing');
    floor.depthGroupRect(22, wallTop + 1, 27, wallTop + 1);
    floor.bigPlant(21, wallTop + 1); // a plant at each end of the railing
    floor.bigPlant(28, wallTop + 1);

    // ---- P4b (FB-0064/0069): the lift, in the back wall's left corner beside the staircase ----
    // Doors on x 11..12 of the back wall, the call plate on x 13 above the stall counter; she steps out onto (11,15) in front of it.
    floor.liftDoor(11, wallTop, 'Main Block Lift G');

    // ---- the LUG stall, in the nook behind the staircase ----
    const top = r.y0 + 1; // the hall's first interior row (iy0 is one further in)
    for (const x of [13, 14, 15]) S(x, top, 'intCanteenCounter');
    S(16, top, 'intNoticeboard'); // the LUG banner
    floor.rectObject('area', 'LUG Stall', 11, top, 19, top + 2, { kind: 'stall' });

    // ---- the split staircase (x 13..18), against the left side towards the back ----
    // P4b (FB-0061): rebuilt from LimeZu's stepped flight with gold handrails (tools/make-assets.js stairsTile()). Everything is
    // mirrored about the staircase's own centre line (x 16.0, an edge coordinate): the wide lower flight (x 13..18, three tile
    // rows, rail on both outer edges), a landing, and two 2-wide upper flights (rail on the outer edge, a plain stringer against the
    // dark wood wall between them, which carries the blue UP plate). The foot opening between the two round columns (x 15..16) is
    // the walkable foot slab, centred under the flight, and the `stairs` object stands on its left tile (cells "2x1": both tiles take her up).
    const sx0 = 13, sx1 = 18;
    const upperY0 = top + 3; // 18
    const landingY = upperY0 + 3; // 21
    const lowerY0 = landingY + 1; // 22
    const lowerY1 = lowerY0 + 2; // 24
    floor.stairBlock(sx0, upperY0, ['EL', 'WR'], [0, 1, 2]); // the left upper flight, x 13..14
    floor.stairBlock(sx1 - 1, upperY0, ['WL', 'ER'], [0, 1, 2]); // the right upper flight, x 17..18
    for (let j = 0; j < 3; j++) { // the wall between them, x 15..16
      S(sx0 + 2, upperY0 + j, `intStairsWallL${j}`);
      S(sx0 + 3, upperY0 + j, `intStairsWallR${j}`);
    }
    S(sx0, landingY, 'intStairsLandL');
    for (let x = sx0 + 1; x < sx1; x++) S(x, landingY, 'intStairsLandM');
    S(sx1, landingY, 'intStairsLandR');
    floor.stairBlock(sx0, lowerY0, ['EL', 'M', 'M', 'M', 'M', 'ER'], [1, 2, 3]);
    floor.depthGroupRect(sx0, upperY0, sx1, lowerY1);
    // the `stairs` object itself sits on the walkable foot slab at the foot, between the two round columns
    const footY = lowerY1 + 1; // 25
    floor.paintFloor(15, footY, 16, footY, 'intStairsFootM');
    floor.pointObject('stairs', 'Main Block Stairs G (up)', 15, footY, { to: 'main-block-1', toId: 'Main Block Stairs 1 (down)', facing: 'down', cells: '2x1' });
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

    // ---- Career Services: a closed door in the left wall, beside the staircase. The Library is no longer here: its
    // lobby is straight ahead through the double door in the back wall (FB-0062, plans.js mainBlockG 'libraryLobby').
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
  // P5c (FB-0071): the ICL is a fingerprint-locked, spaceship-like super-computing lab ("a super computing lab with a robot called Alice...
  // modern and like a space ship sort of interior"). It replaces the old royal-blue desk grid. Room interior x 4..15, y 4..13 of the 1st floor
  // (local lx 0..11, ly 0..9); the doorway is on the bottom wall at x 9..10 (tools/interiors/plans.js mainBlock1), so the plan is mirrored about
  // x 10.0. From the back wall forward:
  //   - the wall display (4 tiles wide, the screen on the wall row and a console lip under it) between two banks of tall server racks
  //     (4 racks a side, each two tiles tall, alternating chassis, their LEDs blinking: `tileAnim` objects);
  //   - a lane of floor trunking along the rack fronts, and a ceiling light bar (overhead layer) over the display's lane;
  //   - the holographic table in the middle (4 x 2, a rotating globe over it), ringed by a glowing cyan floor strip that also runs down the
  //     middle of the room to the door (two strips, one per door cell: the way in is lit);
  //   - three curved-console workstations with chairs along each side wall, a row of consoles/coffee/planters along the front wall;
  //   - Alice's charging pad and, beside it, the core console where the key sits (the `icl` key station, src/maps.js).
  // Everything is placed by absolute tile coordinates on the shared canvas (like the foyer), and kept off the door lane (x 9..10, y 10..13) and the
  // lane along the rack fronts (y 6).
  labIcl: (put, ix0, iy0, ix1, iy1, ctx) => {
    if (!ctx || !ctx.floor) return;
    const { floor, id } = ctx;
    const r = floor.get(id);
    const ox = r.x0 + 1;
    const oy = r.y0 + 1;
    const S = (lx, ly, name) => floor.placeStructure(ox + lx, oy + ly, name);
    const G = (lx, ly, name) => floor.paintFloor(ox + lx, oy + ly, ox + lx, oy + ly, name);

    // the floor: panels, a few brushed ones, then the light strips, trunking and Alice's pad on top
    for (let ly = 0; ly < 10; ly++) for (let lx = 0; lx < 12; lx++) if ((lx * 7 + ly * 3) % 5 === 0) G(lx, ly, 'intTechFloorB');
    // the ring round the holo table: local x 3..8, y 2..5 (the table is x 4..7, y 3..4 inside it); the way in comes up the middle at x 5..6
    for (const [lx, ly, arms] of [[3, 2, 'SE'], [8, 2, 'SW'], [3, 5, 'NE'], [8, 5, 'NW']]) G(lx, ly, `intTechFloorStrip${arms}`);
    for (let lx = 4; lx <= 7; lx++) { G(lx, 2, 'intTechFloorStripH'); G(lx, 5, lx === 5 || lx === 6 ? 'intTechFloorStripTS' : 'intTechFloorStripH'); }
    for (const ly of [3, 4]) { G(3, ly, 'intTechFloorStripV'); G(8, ly, 'intTechFloorStripV'); }
    for (let ly = 6; ly <= 9; ly++) { G(5, ly, 'intTechFloorStripV'); G(6, ly, 'intTechFloorStripV'); }
    for (let lx = 0; lx <= 2; lx++) { G(lx, 2, 'intTechTrunkH'); G(9 + lx, 2, 'intTechTrunkH'); } // cables from the rack bases to the ring
    G(3, 6, 'intTechPad'); // Alice's charging pad

    // the wall display, with its console lip under it
    for (let i = 0; i < 4; i++) {
      floor.placeStructure(ox + 4 + i, r.y0, `intWallDisplay${i}`);
      S(4 + i, 0, `intTechDisplayBase${i}`);
    }

    // two banks of server racks, 4 each side, 2 tiles tall, walk-behind (ADR 0015); the LEDs blink out of step
    for (const bankX of [0, 8]) {
      for (let i = 0; i < 4; i++) {
        const lx = bankX + i;
        const v = (lx + (bankX ? 1 : 0)) % 2 === 0 ? 'A' : 'B';
        S(lx, 0, `intTechRackTop${v}`);
        S(lx, 1, `intTechRackBase${v}`);
        floor.tileAnim(ox + lx, oy, ['intTechLedsTopA', 'intTechLedsTopB'], { ms: 640, phase: lx * 7 });
        floor.tileAnim(ox + lx, oy + 1, ['intTechLedsBaseB', 'intTechLedsBaseA'], { ms: 760, phase: lx * 5 });
      }
      floor.depthGroupRect(ox + bankX, oy, ox + bankX + 3, oy + 1);
    }

    // the holographic table (4 x 2) and its globe (an overlay over the two middle tiles of its top row)
    for (let col = 0; col < 4; col++) for (let row = 0; row < 2; row++) S(4 + col, 3 + row, `intHoloTable${col}${row}`);
    floor.depthGroupRect(ox + 4, oy + 3, ox + 7, oy + 4);
    floor.tileAnim(ox + 5, oy + 3, ['intHoloGlobe0L', 'intHoloGlobe1L', 'intHoloGlobe2L', 'intHoloGlobe1L'], { ms: 450 });
    floor.tileAnim(ox + 6, oy + 3, ['intHoloGlobe0R', 'intHoloGlobe1R', 'intHoloGlobe2R', 'intHoloGlobe1R'], { ms: 450 });

    // workstations: a curved console against each side wall with its chair beside it
    for (const ly of [4, 6, 8]) {
      S(0, ly, 'intTechConsoleS'); S(1, ly, 'intTechChair');
      S(11, ly, 'intTechConsoleS'); S(10, ly, 'intTechChair');
    }
    // the core console (the key station sits on it, next to Alice) and the front wall's row
    S(2, 6, 'intTechCoreConsole');
    S(0, 9, 'intTechPlanter'); S(11, 9, 'intTechPlanter');
    S(1, 9, 'intTechConsoleS'); S(2, 9, 'intTechConsoleS'); S(3, 9, 'intTechCoffee');
    S(8, 9, 'intTechPylon'); S(9, 9, 'intTechConsoleS'); S(10, 9, 'intTechConsoleS');
    S(8, 6, 'intTechPylon'); // (kept off the right workstations' lane: x 13, rows 9/11/7 are the only ways into the 2-wide pockets between their chairs)

    // the ceiling light bar over the lane in front of the display (the overhead layer, drawn over everything)
    ['L', 'M', 'M', 'R'].forEach((end, i) => floor.placeOverhead(ox + 4 + i, oy + 1, `intTechLightBar${end}`));
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

  // Doors/windows in a wall that runs up and down the screen get their side-on art (FB-0058/0060/0065).
  floor.useSideVariants();

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
