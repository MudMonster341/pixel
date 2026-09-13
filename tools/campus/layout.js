// Campus map plan for tools/campus/build-campus.js (see ADR 0008).
//
// This is a hand-designed schematic: every building, road, path, gate, fence and green area is an
// axis-aligned rectangle or straight line with a fixed width, placed using the measurements in
// docs/research/bits-dubai-campus.md and tools/campus/diac.osm (kept as the measurement reference,
// no longer parsed at build time). Positions are rounded to the tile grid (1 tile = 2 m) and are
// approximate (roughly +/-15 m), per ADR 0008.
//
// Coordinate frame: local tiles, x = east/right, y = south/down. The campus fence's north-west
// corner is (0, 0). The main gate (Gate 2) sits on the SOUTH edge (large y) so walking into campus
// means walking up/north on screen, matching ADR 0007's "gate at the bottom" convention. Everything
// outside the fence (D54, the DIAC ring, neighbouring buildings) is placed in the same frame using
// negative or >FENCE_W/FENCE_H coordinates; build-campus.js works out the map's bounding box itself.
//
// Gate 2 research (2026-09-13): BITS Pilani Dubai is confirmed (official site, reviews) to have two
// gates with security, but no source names which one is "Gate 2" or pins its exact location -- see
// docs/research/bits-dubai-campus.md "Entrances" section for sources checked. Per the owner's
// fallback instruction, this plan ASSUMES Gate 2 is the main entrance off the DIAC road on the
// campus's south/entrance side, next to the Main Block drop-off (i.e. where the C1 test map already
// put its one gate). The second entrance is placed on the west fence, near the hostels/Library
// side, and is named "Side Gate" (no source confirms it as "Gate 1").

const FENCE_W = 206; // 412 m
const FENCE_H = 172; // 344 m

// ---- Gate 2 (main entrance, south fence) and the entrance avenue ----
const GATE2 = { x0: 99, x1: 106, side: 'S' }; // 8 tiles wide, centred left-right
const AVENUE = { x0: 97, x1: 108 }; // entrance avenue: kerb at x0/x1, asphalt x0+1..x1-1
const AVENUE_INNER_Y1 = 100; // avenue runs from the gate (FENCE_H - 1) up to the plaza
const OUTER_APPROACH_Y1 = FENCE_H + 13; // outside the fence, road continues a bit further south
const SPAWN = { x: 102, y: FENCE_H + 8, facing: 'up' };

// ---- Side Gate (second entrance, west fence, near the hostels/Library) ----
const SIDE_GATE = { y0: 66, y1: 71, side: 'W' };
const SIDE_PATH_X1 = 25; // walkway from the side gate to the internal path spine

// ---- Plaza / drop-off in front of the Main Block ----
const PLAZA = { x0: 64, y0: 88, x1: 141, y1: 100 };

// ---- Academic complex: Main Block, Library Block, Mechanical Block ----
// wallTiles = 2 for every BITS building per the owner's "modest, not bloated" note.
const MAIN_BLOCK = { name: 'Main Block', style: 'bits', x0: 74, y0: 30, x1: 131, y1: 80, wallTiles: 2, door: true };
const LIBRARY_BLOCK = { name: 'Library Block', style: 'bits', x0: 38, y0: 40, x1: 63, y1: 63, wallTiles: 2, door: true };
const MECHANICAL_BLOCK = { name: 'Mechanical Block', style: 'bits', x0: 142, y0: 40, x1: 169, y1: 58, wallTiles: 2, door: true };

// ---- Hostels (outside only; each a separate footprint with gaps between) ----
const HOSTELS = [
  { name: 'Hostel A', style: 'bits', x0: 8, y0: 25, x1: 22, y1: 35, wallTiles: 2, unverified: true },
  { name: 'Hostel B', style: 'bits', x0: 8, y0: 42, x1: 22, y1: 52, wallTiles: 2, unverified: true },
  { name: 'Hostel C', style: 'bits', x0: 8, y0: 59, x1: 22, y1: 69, wallTiles: 2, unverified: true },
  { name: 'Hostel D', style: 'bits', x0: 8, y0: 76, x1: 22, y1: 86, wallTiles: 2, unverified: true },
  { name: 'Hostel G (Girls)', style: 'bits', x0: 184, y0: 25, x1: 198, y1: 35, wallTiles: 2, unverified: true },
  { name: 'Hostel H (Girls)', style: 'bits', x0: 184, y0: 52, x1: 198, y1: 62, wallTiles: 2 },
];
const BUILDINGS = [MAIN_BLOCK, LIBRARY_BLOCK, MECHANICAL_BLOCK, ...HOSTELS];

// ---- Internal walkway spine (constant width, connects hostels + academic complex + plaza) ----
const WALKWAY_WIDTH = 3;
const WALKWAYS = [
  // west hostel column <-> east hostel column, passing just south of the academic complex
  { x0: 25, y0: 84, x1: 181, y1: 84 + WALKWAY_WIDTH - 1 },
  // vertical spurs serving each hostel column
  { x0: 25, y0: 20, x1: 25 + WALKWAY_WIDTH - 1, y1: 86 },
  { x0: 181, y0: 20, x1: 181 + WALKWAY_WIDTH - 1, y1: 86 },
  // side gate spur, from the west fence to the hostel spine
  { x0: SIDE_PATH_X1, y0: (SIDE_GATE.y0 + SIDE_GATE.y1) / 2 - 1, x1: 25 + WALKWAY_WIDTH - 1, y1: (SIDE_GATE.y0 + SIDE_GATE.y1) / 2 + 1 },
];

// ---- Sports ----
const TRACK = { center: [45, 130], length: 66, width: 32, laneWidth: 5 }; // athletics track + football field
const TENNIS_COURTS = [
  { x0: 112, y0: 150 }, // each is the standard 18x9 kit (see STYLE_GUIDE "Campus kit")
  { x0: 131, y0: 150 },
];
const OTHER_COURTS = [
  { name: 'Basketball Court', x0: 112, y0: 160, x1: 127, y1: 167 },
  { name: 'Volleyball Court', x0: 131, y0: 160, x1: 148, y1: 167 },
];
const PARKING = { x0: 30, y0: 90, x1: 58, y1: 104 };

// ---- Green: palm avenue along the entrance road, scattered shade trees on the lawn ----
const PALM_AVENUE = { leftCol: 93, rightCol: 110, y0: 105, y1: 168, step: 10 };
const TREE_SCATTER = { stepX: 9, stepY: 9, seed: 20260913, keepOneIn: 3 }; // deterministic, see build-campus.js

// ---- DIAC ring + park, and the road connecting the campus to it ----
const DIAC_RING = { center: [356, 150], radius: 111 };
const RING_ROAD = { x0: AVENUE.x1, x1: DIAC_RING.center[0] - DIAC_RING.radius, y0: 176, y1: 181 };

// ---- D54 (Academic City Road): a straight edge along the north side, for context only ----
const D54 = { x0: -40, x1: 502, y0: -34, y1: -28 };

// ---- Other campuses / buildings: simple, straight, not enterable, and OUTSIDE the campus fence ----
const OTHER_BUILDINGS = [
  { name: 'Neighbouring Campus', style: 'other', x0: -10, y0: -22, x1: 44, y1: -12, wallTiles: 2 },
  { name: 'University of Birmingham Dubai', style: 'other', x0: 212, y0: 45, x1: 244, y1: 83, wallTiles: 2 },
  { name: 'Student Apartments', style: 'other', x0: 475, y0: 175, x1: 500, y1: 205, wallTiles: 2 },
];

// ---- DIAC Park internal walkways: a straight cross through the ring ----
const PARK_PATHS = [
  { x0: DIAC_RING.center[0] - DIAC_RING.radius + 6, y0: DIAC_RING.center[1] - 1, x1: DIAC_RING.center[0] + DIAC_RING.radius - 6, y1: DIAC_RING.center[1] + 1 },
  { x0: DIAC_RING.center[0] - 1, y0: DIAC_RING.center[1] - DIAC_RING.radius + 6, x1: DIAC_RING.center[0] + 1, y1: DIAC_RING.center[1] + DIAC_RING.radius - 6 },
];

module.exports = {
  metersPerTile: 2,
  fence: { width: FENCE_W, height: FENCE_H },
  gate2: GATE2,
  sideGate: SIDE_GATE,
  avenue: AVENUE,
  avenueInnerY1: AVENUE_INNER_Y1,
  outerApproachY1: OUTER_APPROACH_Y1,
  spawn: SPAWN,
  sidePathX1: SIDE_PATH_X1,
  plaza: PLAZA,
  buildings: BUILDINGS,
  mainBlock: MAIN_BLOCK,
  libraryBlock: LIBRARY_BLOCK,
  mechanicalBlock: MECHANICAL_BLOCK,
  hostels: HOSTELS,
  walkwayWidth: WALKWAY_WIDTH,
  walkways: WALKWAYS,
  track: TRACK,
  tennisCourts: TENNIS_COURTS,
  otherCourts: OTHER_COURTS,
  parking: PARKING,
  palmAvenue: PALM_AVENUE,
  treeScatter: TREE_SCATTER,
  diacRing: DIAC_RING,
  ringRoad: RING_ROAD,
  d54: D54,
  otherBuildings: OTHER_BUILDINGS,
  parkPaths: PARK_PATHS,
  boundsMargin: 15,
};
