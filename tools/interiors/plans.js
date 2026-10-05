// The interior floor plans (data), consumed by build-interiors.js (code). See
// docs/INTERIORS_PLAN.md for the room list, sources and rough spots. Room names are the real
// virtual-tour scene names where known (docs/research/bits-dubai-tour-scenes.json); floors the tour
// doesn't specify are a sensible guess, noted in the plan doc. Every building's floors share one
// canvas size and the same stairwell rectangle, so stairs line up between floors (one exception: the Main
// Block's ground floor, ADR 0020, has the foyer's visible split staircase instead).

// ---------- Main Block: 4 floors, right-sized (FB-0030/0031, premium pass stage 5; ground floor ADR 0020) ----------
// Rebuilt compact per the owner's own words (FB-0031: "we don't need a proper map, make it nice as
// per how a university campus looks from the top"): today's huge 136x84 floors, mostly empty cream
// floor, are replaced with small, furnished Pokemon-style floors. The GROUND floor is the reception foyer
// plus two long wings, rebuilt to match the official 3D virtual tour (ADR 0020, see mainBlockG below);
// then one corridor per upper floor carrying the 3 key rooms and a couple of transit stops
// (docs/STORY.md's own room list -- see docs/INTERIORS_PLAN.md "Story rooms" for why ICL/Room 195/Physics
// Lab live where they do). All four floors share one canvas size. The three UPPER floors also share one fixed
// stairwell rectangle (MAIN_STAIRWELL), so their stairs line up (tested); the ground floor's staircase is the
// visible split stair on the left of the foyer (the tour), so it no longer lines up with that rectangle.
const MAIN_W = 40;
const MAIN_H = 40;
const MAIN_STAIRWELL = { x0: 30, y0: 12, x1: 37, y1: 21 };

// P4b (FB-0061/0063/0064/0069): the stairwell, rebuilt around LimeZu's stepped flight with gold handrails (tools/make-assets.js
// stairsTile()). Two 2-wide flights stand against the side walls, rising up the screen (steps shrink and darken towards the far end,
// a blue arrow plate on the wall over each says UP or DOWN), and the lift sits between them in the middle of the top wall, so the
// room is symmetric about its centre line (x 34.0). Each flight is four tile rows of treads (solid) over a walkable foot slab on the
// row of its `stairs` object (y 17); the gold handrail is on the open (lane) side, a plain stringer on the wall side. The stairs
// objects, their destinations, arrival tiles and approach tiles are exactly what they were: (32,17) up and (36,17) down, both
// `facing: left`. `lift` is the name of this floor's lift object (its tile and the choice list's arrival are in src/maps.js).
function stairwell(floor, name, { up, down, lift } = {}) {
  floor.addRect('stairwell', { name, type: 'stairwell', wallKit: 'roomBuilder', ...MAIN_STAIRWELL });
  const { x0, x1, y0 } = MAIN_STAIRWELL;
  const mid = (x0 + x1 + 1) / 2; // 34.0: the room's centre line, an edge coordinate
  floor.liftDoor(mid - 1, y0, lift); // doors on x 33..34, the call plate on x 35
  if (up) {
    floor.stairBlock(x0 + 1, y0 + 1, ['WL', 'ER'], [0, 1, 2, 3]); // x 31..32, y 13..16
    floor.paintFloor(x0 + 1, 17, x0 + 1, 17, 'intStairsFootWL');
    floor.paintFloor(x0 + 2, 17, x0 + 2, 17, 'intStairsFootM');
    floor.placeStructure(x0 + 1, y0, 'intStairsSignUp');
    floor.pointObject('stairs', `${name} (up)`, x0 + 2, 17, { to: up.to, toId: up.toId, facing: 'left' });
  }
  // The "(down)" flight sits at x 35..36, one tile from the stairwell's east wall (x 37). `facing` is the direction the player
  // faces on ARRIVAL and the arrival tile is one step that way (world.js resolveSpawnAt), so 'right' landed her inside the
  // wall (D07, 2026-10-04). 'left' puts her on the flight's own tile (35, 17), facing away from the wall.
  if (down) {
    floor.stairBlock(x1 - 2, y0 + 1, ['EL', 'WR'], [0, 1, 2, 3]); // x 35..36, y 13..16
    floor.paintFloor(x1 - 2, 17, x1 - 2, 17, 'intStairsFootM');
    floor.paintFloor(x1 - 1, 17, x1 - 1, 17, 'intStairsFootWR');
    floor.placeStructure(x1 - 1, y0, 'intStairsSignDown');
    floor.pointObject('stairs', `${name} (down)`, x1 - 1, 17, { to: down.to, toId: down.toId, facing: 'left' });
  }
}

// Quality loop (docs/quality/scorecard.md, Interior art run 1, "corridors are bare"): a corridor
// rect furnished directly (corridors are `isCorridor: true`, skipped by the generic furnish() pass)
// with the props the brief named -- benches, plants, notice boards, bins, spaced every few tiles
// along its own length, never on the door openings connect() already carved.
// Quality loop run 3 (docs/quality/scorecard.md, 2026-09-29: "Corridors: doors with small name
// plates beside them, and wall posters/notice boards") -- `intWallPoster` in the regular prop cycle
// (a diagram/chart, distinct from `intNoticeboard`'s corkboard), and `doorNameplate()` below places
// the actual nameplates next to each of the 3 key-room doors.
function dressCorridor(floor, rect, { axis, skip = [] }) {
  const props = ['bench', 'intPottedPlant', 'intNoticeboard', 'intWallPoster', 'intBin'];
  const place = (x, y, name) => {
    floor.placeStructure(x, y, name);
    if (name === 'intPottedPlant') floor.depthGroupRect(x, y, x, y); // a "big plant" too, walk-behind (ADR 0015)
  };
  if (axis === 'h') {
    const y = rect.y0 + 1;
    let i = 0;
    // `skip` (P5c): columns to leave clear (the ICL's hatch and scanner need the corridor floor in front of them free)
    for (let x = rect.x0 + 2; x <= rect.x1 - 2; x += 3) { const name = props[i++ % props.length]; if (!skip.includes(x)) place(x, y, name); }
  } else {
    const x = rect.x0 + 1;
    let i = 0;
    for (let y = rect.y0 + 2; y <= rect.y1 - 2; y += 3) place(x, y, props[i++ % props.length]);
  }
}

// A small nameplate beside a door -- computed the same way Floor.connect() itself centres a door in
// the wall the two rects share, so it's placed accurately without duplicating that geometry by hand.
function doorNameplate(floor, roomA, roomB) {
  const a = floor.get(roomA);
  const b = floor.get(roomB);
  if (a.x1 === b.x0 || b.x1 === a.x0) {
    const wallX = a.x1 === b.x0 ? a.x1 : a.x0;
    const y0 = Math.max(a.y0, b.y0) + 1, y1 = Math.min(a.y1, b.y1) - 1;
    const start = y0 + Math.floor((y1 - y0 + 1 - 2) / 2);
    floor.placeStructure(wallX, start - 1, 'intNameplate');
    return;
  }
  const wallY = a.y1 === b.y0 ? a.y1 : a.y0;
  const x0 = Math.max(a.x0, b.x0) + 1, x1 = Math.min(a.x1, b.x1) - 1;
  const start = x0 + Math.floor((x1 - x0 + 1 - 2) / 2);
  floor.placeStructure(start - 1, wallY, 'intNameplate');
}

// ADR 0020 (2026-10-03): the ground floor follows the official 3D virtual tour (docs/research/tour-ground-floor.md),
// not the owner's older photo. A central reception foyer (a double-height atrium: oak floor, the glass terrarium on
// its plinth, two curved reception desks flanking the entrance, a split staircase on the left towards the back with
// the LUG stall behind it, red and blue sofas on the back walls -- all in the `foyer` furnisher,
// build-interiors.js FURNISHERS.foyer) and TWO LONG WINGS, one off each side wall, drawn here:
//   - Right wing: an office corridor (Academic Undergraduate Studies Division, Student Welfare Division, Deputy
//     Registrar's Office) to the Auditorium lobby and the Parents-Visitor Lounge.
//   - Left wing: Admissions Office, Director's Office, a shallow ramp (peach lower walls, centre rail) up to the
//     Sports Complex lobby: Sports Complex, Prime Medical Centre, Mini Mart, Telepresence Classroom.
//   - Library and Career Services are closed doors in the foyer's left wall (placed by the foyer furnisher).
// The shared 40x40 canvas can't hold two straight wings, so each wing runs out sideways off the hall's front
// corner, then north along the canvas edge (a U round the atrium void), ending in its lobby: about 35 tiles long.
// OWNER DECISION: every wing destination is a CLOSED, nameplated door (no new enterable rooms). Each closed door is
// a `door` object marked `closed` (Floor.closedDoor); the line it says is its `doorLocks` entry in src/maps.js.
// The upper floors (below) are not rebuilt now. Their stairwell rectangle (MAIN_STAIRWELL) is therefore no longer
// shared with the ground floor: the visible staircase is on the left, the upper floors' stairwell stays right
// (docs/INTERIORS_PLAN.md "Ground floor").
const mainBlockG = {
  name: 'Main Block · Ground Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 19, y: 34, facing: 'up' },
  build(floor) {
    // Wing end lobbies first (cream tile floor, peach lower walls, as in the auditorium and sports ends).
    floor.addRect('lobbyL', { name: 'Sports Complex Lobby', type: 'wingLobby', wallKit: 'peach', floorTile: 'intFloorTiled', x0: 2, y0: 5, x1: 10, y1: 14 });
    floor.addRect('lobbyR', { name: 'Auditorium Lobby', type: 'wingLobby', wallKit: 'peach', floorTile: 'intFloorTiled', x0: 29, y0: 5, x1: 37, y1: 14 });
    // The wings: a short run out of the hall (H), then north along the canvas edge (V). Oak floor, wood skirting.
    const wing = { type: 'corridor', wallKit: 'skirt', floorTile: 'intFloorOak', isCorridor: true };
    floor.addRect('wingLH', { ...wing, name: 'Left wing', x0: 2, y0: 28, x1: 10, y1: 32 });
    floor.addRect('wingLV', { ...wing, name: 'Left wing', x0: 2, y0: 14, x1: 6, y1: 28 });
    floor.addRect('wingRH', { ...wing, name: 'Right wing', x0: 29, y0: 28, x1: 37, y1: 32 });
    floor.addRect('wingRV', { ...wing, name: 'Right wing', x0: 33, y0: 14, x1: 37, y1: 28 });

    // FB-0062: the Library lobby, straight ahead of the entrance (tour-06: the Library is past the foyer, not off its
    // left wall). 8 wide x 4 deep, same oak floor and wall kit as the foyer, centred on the hall's axis (x 19..20);
    // it shares the foyer's back wall (y 14), where the open double door goes. Added before the foyer so the foyer's
    // own wall ring wins along that shared wall.
    floor.addRect('libraryLobby', { name: 'Library Lobby', type: 'wingLobby', wallKit: 'roomBuilder', floorTile: 'intFloorOak', x0: 15, y0: 9, x1: 24, y1: 14 });

    // The foyer last, so its own wall ring wins where it shares a wall with a wing.
    floor.addRect('foyer', { name: 'Foyer', type: 'foyer', wallKit: 'roomBuilder', x0: 10, y0: 14, x1: 29, y1: 37 });
    floor.exteriorDoor('foyer', 'bottom', {
      name: 'Main Block Ground Floor entrance', to: 'campus', toId: 'Main Block entrance', facing: 'up', at: 19,
    });

    // The open double door from the foyer's back wall into the Library lobby (a 2-wide doorway at x 19..20, y 14).
    floor.connect('libraryLobby', 'foyer', { width: 2 });

    // Wide, door-less mouths: foyer <-> wings <-> lobbies.
    floor.connect('wingLH', 'foyer', { width: 3, openTile: 'intFloorOak' });
    floor.connect('wingLV', 'wingLH', { width: 3, openTile: 'intFloorOak' });
    floor.connect('lobbyL', 'wingLV', { width: 3, openTile: 'intFloorTiled' });
    floor.connect('wingRH', 'foyer', { width: 3, openTile: 'intFloorOak' });
    floor.connect('wingRV', 'wingRH', { width: 3, openTile: 'intFloorOak' });
    floor.connect('lobbyR', 'wingRV', { width: 3, openTile: 'intFloorTiled' });

    // The left wing's ramp (y 14..22): grey/white tile, peach lower walls, a centre rail (the tour's "shallow ramp").
    floor.paintFloor(3, 14, 5, 22, 'intFloorTiled');
    floor.repaintWalls(2, 14, 6, 22, 'peach');
    for (let y = 16; y <= 20; y++) floor.placeStructure(4, y, 'intAtriumRailing');
    floor.depthGroupRect(4, 16, 4, 20);

    // ---- closed doors, every one with a nameplate beside it and a line in src/maps.js doorLocks ----
    const closed = (x, y, tile, name, plate) => {
      floor.closedDoor(x, y, tile, name);
      if (plate) floor.placeStructure(plate[0], plate[1], 'intNameplate');
    };
    // left wing
    closed(6, 32, 'intDoorOffice', 'Admissions Office door', [7, 32]);
    closed(2, 24, 'intDoorOffice', "Director's Office door", [2, 25]);
    // the Sports Complex lobby (x 3..9, y 6..13)
    closed(5, 5, 'intDoorDarkL', 'Sports Complex door', [4, 5]);
    closed(6, 5, 'intDoorDarkR', 'Sports Complex door', [7, 5]);
    closed(10, 8, 'intDoorOffice', 'Prime Medical Centre door', [10, 7]);
    closed(10, 11, 'intDoorFlush', 'Mini Mart door', [10, 10]);
    closed(2, 10, 'intDoorOffice', 'Telepresence Classroom door', [2, 11]);
    // right wing
    closed(33, 32, 'intDoorOffice', 'Academic Undergraduate Studies Division door', [32, 32]);
    closed(37, 25, 'intDoorOffice', 'Student Welfare Division door', [37, 24]);
    closed(33, 21, 'intDoorOffice', "Deputy Registrar's Office door", [33, 22]);
    // the Auditorium lobby (x 30..36, y 6..13)
    closed(33, 5, 'intDoorDarkL', 'Auditorium door', [32, 5]);
    closed(34, 5, 'intDoorDarkR', 'Auditorium door', [35, 5]);
    closed(29, 9, 'intDoorDarkR', 'Parents-Visitor Lounge door', [29, 8]);

    // ---- the Library lobby (FB-0062): a "LIBRARY" sign and the Library's own double door on its back wall (y 9, x 19..20,
    // closed like every other destination, `Library door` in src/maps.js doorLocks), a nameplate, two big plants and a bench.
    floor.placeStructureRow(16, 9, ['libSignSeg0', 'libSignSeg1', 'libSignSeg2']);
    floor.closedDoor(19, 9, 'intDoorDarkL', 'Library door');
    floor.closedDoor(20, 9, 'intDoorDarkR', 'Library door');
    floor.placeStructure(21, 9, 'intNameplate');
    floor.bigPlant(16, 10);
    floor.bigPlant(23, 10);
    floor.placeStructure(17, 10, 'bench');
    floor.placeStructure(22, 10, 'bench');

    // ---- dressing: big black-pot plants at the corners, a water dispenser by the auditorium doors ----
    for (const [x, y] of [[3, 30], [36, 30], [3, 6], [9, 6], [30, 6], [36, 12]]) floor.bigPlant(x, y);
    floor.placeStructure(36, 6, 'intWaterCooler');
  },
};

const mainBlock1 = {
  name: 'Main Block · 1st Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 16, y: 18, facing: 'up' },
  build(floor) {
    // docs/STORY.md key rooms (M3): ICL (a computing lab, `labIcl`) and Room 195 (a classroom),
    // both off one corridor -- see docs/INTERIORS_PLAN.md "Story rooms" for why they're here (no
    // sourced real floor plan for either).
    // P5c (FB-0071): the ICL is a sealed, spaceship-like super-computing lab (the `tech` wall kit, FURNISHERS.labIcl): its door is a fingerprint-
    // locked hatch with a scanner pad beside it (below) that the mini-game opens. Room interior x 4..15, y 4..13.
    floor.addRect('icl', { name: 'ICL', type: 'labIcl', wallKit: 'tech', x0: 3, y0: 3, x1: 16, y1: 14 });
    floor.addRect('room195', { name: 'Room 195', type: 'classroom', wallKit: 'roomBuilder', x0: 18, y0: 3, x1: 29, y1: 14 });

    const corridor = floor.addRect('corridor', { name: 'Corridor', type: 'corridor', wallKit: 'roomBuilder', x0: 3, y0: 14, x1: 30, y1: 21, isCorridor: true });
    floor.connect('icl', 'corridor');
    floor.connect('room195', 'corridor');
    doorNameplate(floor, 'icl', 'corridor');
    doorNameplate(floor, 'room195', 'corridor');
    // P5c: the ICL's doorway (connect() above carved it at x 9..10, y 14) is the sealed hatch, with the scanner pad on the wall right of it, a
    // nameplate left of it (doorNameplate) and the navy bulkhead wall either side, so the lab's front reads as one module.
    if (floor.ground[floor.idx(9, 14)] !== floor.tileIndex('intDoorway') || floor.ground[floor.idx(10, 14)] !== floor.tileIndex('intDoorway')) {
      throw new Error('mainBlock1: the ICL doorway is not at x 9..10 any more: move the hatch and scanner with it');
    }
    floor.sealedDoor(9, 14, 'ICL door', 'iclDoorOpen');
    floor.scannerPad(11, 14, 'ICL scanner', 'ICL door');
    // the lab's whole front wall is the navy bulkhead with its cyan light band, except the nameplate (8), the hatch (9..10) and the scanner (11); the two
    // corner tiles stay the corridor's own cream wall
    for (let x = 4; x <= 15; x++) if (x < 8 || x > 11) floor.placeStructure(x, 14, 'intWallTech');
    // A couple of locked classroom doors further down the corridor -- visible, not walkable
    // (docs/STORY.md: only the route to the 3 key rooms stays open).
    floor.placeStructure(10, 21, 'intDoorClosed');
    floor.placeStructure(22, 21, 'intDoorClosed');
    dressCorridor(floor, corridor, { axis: 'h', skip: [8, 11] }); // P5c: nothing standing in front of the ICL's hatch and scanner

    stairwell(floor, 'Main Block Stairs 1', {
      lift: 'Main Block Lift 1',
      down: { to: 'main-block-g', toId: 'Main Block Stairs G (up)' },
      up: { to: 'main-block-2', toId: 'Main Block Stairs 2 (down)' },
    });
    floor.connect('corridor', 'stairwell');
  },
};

const mainBlock2 = {
  name: 'Main Block · 2nd Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 16, y: 16, facing: 'down' },
  build(floor) {
    // No key here -- a transit corridor/landing between the 1st and 3rd floors, with a lounge
    // corner and notice boards (FURNISHERS.lounge) so it doesn't read as bare hallway.
    floor.addRect('landing', { name: 'Landing', type: 'lounge', wallKit: 'roomBuilder', x0: 3, y0: 12, x1: 30, y1: 21 });

    stairwell(floor, 'Main Block Stairs 2', {
      lift: 'Main Block Lift 2',
      down: { to: 'main-block-1', toId: 'Main Block Stairs 1 (up)' },
      up: { to: 'main-block-3', toId: 'Main Block Stairs 3 (down)' },
    });
    floor.connect('landing', 'stairwell');
  },
};

const mainBlock3 = {
  name: 'Main Block · 3rd Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 10, y: 19, facing: 'up' },
  build(floor) {
    // docs/STORY.md key room: "the Physics Lab, 3rd floor" -- one corridor leading straight to it,
    // matching the story's own "she goes up and to the right."
    floor.addRect('physicsLab', { name: 'Physics Lab', type: 'labPhysics', wallKit: 'roomBuilder', x0: 3, y0: 3, x1: 20, y1: 17 });

    const corridor = floor.addRect('corridor', { name: 'Corridor', type: 'corridor', wallKit: 'roomBuilder', x0: 3, y0: 17, x1: 30, y1: 21, isCorridor: true });
    floor.connect('physicsLab', 'corridor');
    doorNameplate(floor, 'physicsLab', 'corridor');
    dressCorridor(floor, corridor, { axis: 'h' });

    stairwell(floor, 'Main Block Stairs 3', { lift: 'Main Block Lift 3', down: { to: 'main-block-2', toId: 'Main Block Stairs 2 (up)' } });
    floor.connect('corridor', 'stairwell');
  },
};

// ---------- Library Block: 2 floors ----------

const LIB_W = 74;
const LIB_H = 74;
const LIB_STAIRWELL = { x0: 60, y0: 24, x1: 68, y1: 44 };

const libraryBlockG = {
  name: 'Library Block · Ground Floor',
  width: LIB_W,
  height: LIB_H,
  spawn: { x: 34, y: 62, facing: 'up' },
  build(floor) {
    floor.addRect('circulation', { name: 'Library - Circulation Reception', type: 'reception', x0: 20, y0: 44, x1: 49, y1: 63 });
    floor.exteriorDoor('circulation', 'bottom', { name: 'Library Block Ground Floor entrance', to: 'campus', toId: 'Library Block entrance', facing: 'up' });

    floor.addRect('readingArea', { name: 'Library - Reading Area', type: 'reading', x0: 20, y0: 24, x1: 49, y1: 44 });
    floor.connect('circulation', 'readingArea');

    floor.addRect('stackArea', { name: 'Library - Stack Area', type: 'stack', x0: 4, y0: 24, x1: 20, y1: 44 });
    floor.connect('readingArea', 'stackArea');

    floor.addRect('textbookArea', { name: 'Library - Textbook Area', type: 'stack', x0: 49, y0: 24, x1: 60, y1: 44 });
    floor.connect('readingArea', 'textbookArea');

    floor.addRect('stairwell', { name: 'Library Block Stairs G', type: 'stairwell', ...LIB_STAIRWELL });
    floor.connect('textbookArea', 'stairwell');
    floor.stairsObject('stairwell', { name: 'Library Block Stairs G (up)', to: 'library-block-1', toId: 'Library Block Stairs 1 (down)', facing: 'left', dir: 'up' });

    floor.addRect('canteen', { name: 'Canteen', type: 'canteen', x0: 4, y0: 4, x1: 35, y1: 24 });
    floor.connect('canteen', 'stackArea');
    floor.addRect('activityRoom', { name: 'Activity Room', type: 'club', x0: 35, y0: 4, x1: 55, y1: 24 });
    floor.connect('activityRoom', 'canteen');
    floor.connect('activityRoom', 'readingArea');
  },
};

const libraryBlock1 = {
  name: 'Library Block · 1st Floor',
  width: LIB_W,
  height: LIB_H,
  spawn: { x: 55, y: 34, facing: 'left' },
  build(floor) {
    floor.addRect('stairwell', { name: 'Library Block Stairs 1', type: 'stairwell', ...LIB_STAIRWELL });
    floor.stairsObject('stairwell', { name: 'Library Block Stairs 1 (down)', to: 'library-block-g', toId: 'Library Block Stairs G (up)', facing: 'right', dir: 'down' });

    floor.addRect('centreHigherEd', { name: 'Centre for Higher Education', type: 'office', x0: 49, y0: 24, x1: 60, y1: 44 });
    floor.connect('stairwell', 'centreHigherEd');

    floor.addRect('openReadingHall', { name: 'Library 1st Floor', type: 'reading', x0: 20, y0: 24, x1: 49, y1: 54 });
    floor.connect('centreHigherEd', 'openReadingHall');

    floor.addRect('discussion1', { name: 'Discussion Room 1', type: 'discussion', x0: 4, y0: 24, x1: 20, y1: 34 });
    floor.connect('discussion1', 'openReadingHall');
    floor.addRect('discussion2', { name: 'Discussion Room 2', type: 'discussion', x0: 4, y0: 34, x1: 20, y1: 44 });
    floor.connect('discussion1', 'discussion2');
    floor.connect('discussion2', 'openReadingHall');

    floor.addRect('groove', { name: 'Groove (Dance Club)', type: 'club', x0: 20, y0: 54, x1: 35, y1: 70 });
    floor.connect('groove', 'openReadingHall');
    floor.addRect('ohCrop', { name: 'Oh Crop! Design club', type: 'club', x0: 35, y0: 54, x1: 49, y1: 70 });
    floor.connect('ohCrop', 'groove');
    floor.connect('ohCrop', 'openReadingHall');
    floor.addRect('reflexions', { name: 'Reflexions (Photography Club)', type: 'club', x0: 49, y0: 54, x1: 60, y1: 70 });
    floor.connect('reflexions', 'ohCrop');
  },
};

// ---------- Mechanical Block: 2 floors ----------

const MECH_W = 76;
const MECH_H = 54;
const MECH_STAIRWELL = { x0: 44, y0: 6, x1: 58, y1: 26 };

const mechanicalBlockG = {
  name: 'Mechanical Block · Ground Floor',
  width: MECH_W,
  height: MECH_H,
  spawn: { x: 21, y: 47, facing: 'up' },
  build(floor) {
    floor.addRect('workshop1', { name: 'Workshop 1', type: 'workshop', x0: 6, y0: 26, x1: 35, y1: 49 });
    floor.exteriorDoor('workshop1', 'bottom', { name: 'Mechanical Block Ground Floor entrance', to: 'campus', toId: 'Mechanical Block entrance', facing: 'up' });

    floor.addRect('workshop2', { name: 'Workshop 2', type: 'workshop', x0: 35, y0: 26, x1: 58, y1: 49 });
    floor.connect('workshop1', 'workshop2');

    floor.addRect('cncRoom', { name: 'Workshop - CNC Room', type: 'lab', x0: 6, y0: 6, x1: 24, y1: 26 });
    floor.connect('workshop1', 'cncRoom');

    floor.addRect('surveyingLab', { name: 'Surveying Lab (Civil)', type: 'lab', x0: 24, y0: 6, x1: 44, y1: 26 });
    floor.connect('cncRoom', 'surveyingLab');
    floor.connect('workshop1', 'surveyingLab');

    floor.addRect('stairwell', { name: 'Mechanical Block Stairs G', type: 'stairwell', ...MECH_STAIRWELL });
    floor.connect('surveyingLab', 'stairwell');
    floor.connect('workshop2', 'stairwell');
    floor.stairsObject('stairwell', { name: 'Mechanical Block Stairs G (up)', to: 'mechanical-block-1', toId: 'Mechanical Block Stairs 1 (down)', facing: 'down', dir: 'up' });
  },
};

const mechanicalBlock1 = {
  name: 'Mechanical Block · 1st Floor',
  width: MECH_W,
  height: MECH_H,
  spawn: { x: 50, y: 16, facing: 'down' },
  build(floor) {
    floor.addRect('stairwell', { name: 'Mechanical Block Stairs 1', type: 'stairwell', ...MECH_STAIRWELL });
    floor.stairsObject('stairwell', { name: 'Mechanical Block Stairs 1 (down)', to: 'mechanical-block-g', toId: 'Mechanical Block Stairs G (up)', facing: 'up', dir: 'down' });

    floor.addRect('primeMovers', { name: 'Prime Movers & Fluid Machinery Lab (Workshop)', type: 'lab', x0: 6, y0: 6, x1: 29, y1: 26 });
    floor.addRect('structuresConstruction', { name: 'Structures and Construction Material Lab (Workshop)', type: 'lab', x0: 29, y0: 6, x1: 44, y1: 26 });
    floor.connect('primeMovers', 'structuresConstruction');
    floor.connect('structuresConstruction', 'stairwell');

    floor.addRect('mechatronics', { name: 'Mechatronics Lab (Workshop)', type: 'labHeavy', x0: 6, y0: 26, x1: 29, y1: 49 });
    floor.connect('primeMovers', 'mechatronics');
    floor.addRect('composite', { name: 'Composite Manufacturing Lab (Workshop)', type: 'labHeavy', x0: 29, y0: 26, x1: 50, y1: 49 });
    floor.connect('mechatronics', 'composite');
    floor.connect('composite', 'structuresConstruction');
    floor.addRect('heatTransfer', { name: 'Heat Transfer Lab (MECH)', type: 'lab', x0: 50, y0: 26, x1: 64, y1: 49 });
    floor.connect('composite', 'heatTransfer');
    floor.addRect('advCharacterization', { name: 'Advanced Characterization Lab (MECH)', type: 'lab', x0: 64, y0: 26, x1: 74, y1: 49 });
    floor.connect('heatTransfer', 'advCharacterization');
  },
};

module.exports = {
  'main-block-g': mainBlockG,
  'main-block-1': mainBlock1,
  'main-block-2': mainBlock2,
  'main-block-3': mainBlock3,
  'library-block-g': libraryBlockG,
  'library-block-1': libraryBlock1,
  'mechanical-block-g': mechanicalBlockG,
  'mechanical-block-1': mechanicalBlock1,
};
