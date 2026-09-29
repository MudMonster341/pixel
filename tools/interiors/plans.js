// The interior floor plans (data), consumed by build-interiors.js (code). See
// docs/INTERIORS_PLAN.md for the room list, sources and rough spots. Room names are the real
// virtual-tour scene names where known (docs/research/bits-dubai-tour-scenes.json); floors the tour
// doesn't specify are a sensible guess, noted in the plan doc. Every building's floors share one
// canvas size and the same stairwell rectangle, so stairs line up between floors.

// ---------- Main Block: 4 floors, right-sized (FB-0030/0031, premium pass stage 5) ----------
// Rebuilt compact per the owner's own words (FB-0031: "we don't need a proper map, make it nice as
// per how a university campus looks from the top"): today's huge 136x84 floors, mostly empty cream
// floor, are replaced with a small, furnished Pokemon-style building -- the foyer (the flagship
// room, built to the owner's photo below) + the LUG stall nook + a short corridor to the (locked,
// but visible) rest of the ground floor; then one corridor per upper floor carrying the 3 key rooms
// and a couple of transit stops (docs/STORY.md's own room list -- see docs/INTERIORS_PLAN.md "Story
// rooms" for why ICVL/Room 195/Physics Lab live where they do). Every floor shares one canvas size
// and one fixed stairwell rectangle (MAIN_STAIRWELL), so stairs line up between floors (tested).
const MAIN_W = 40;
const MAIN_H = 40;
const MAIN_STAIRWELL = { x0: 30, y0: 12, x1: 37, y1: 21 };

function stairwell(floor, name, { up, down } = {}) {
  floor.addRect('stairwell', { name, type: 'stairwell', wallKit: 'roomBuilder', ...MAIN_STAIRWELL });
  floor.liftFeature('stairwell', MAIN_STAIRWELL.x0 + 1, MAIN_STAIRWELL.y1 - 1);
  if (up) floor.stairsObject('stairwell', { name: `${name} (up)`, to: up.to, toId: up.toId, facing: 'left', dir: 'up', offset: [-2, 0] });
  if (down) floor.stairsObject('stairwell', { name: `${name} (down)`, to: down.to, toId: down.toId, facing: 'right', dir: 'down', offset: [2, 0] });
}

// Quality loop (docs/quality/scorecard.md, Interior art run 1, "corridors are bare"): a corridor
// rect furnished directly (corridors are `isCorridor: true`, skipped by the generic furnish() pass)
// with the props the brief named -- benches, plants, notice boards, bins, spaced every few tiles
// along its own length, never on the door openings connect() already carved.
// Quality loop run 3 (docs/quality/scorecard.md, 2026-09-29: "Corridors: doors with small name
// plates beside them, and wall posters/notice boards") -- `intWallPoster` in the regular prop cycle
// (a diagram/chart, distinct from `intNoticeboard`'s corkboard), and `doorNameplate()` below places
// the actual nameplates next to each of the 3 key-room doors.
function dressCorridor(floor, rect, { axis }) {
  const props = ['bench', 'intPottedPlant', 'intNoticeboard', 'intWallPoster', 'intBin'];
  const place = (x, y, name) => {
    floor.placeStructure(x, y, name);
    if (name === 'intPottedPlant') floor.depthGroupRect(x, y, x, y); // a "big plant" too, walk-behind (ADR 0015)
  };
  if (axis === 'h') {
    const y = rect.y0 + 1;
    let i = 0;
    for (let x = rect.x0 + 2; x <= rect.x1 - 2; x += 3) place(x, y, props[i++ % props.length]);
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

const mainBlockG = {
  name: 'Main Block · Ground Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 14, y: 18, facing: 'up' },
  build(floor) {
    // The foyer (FB-0030: "the main reception foyer -- make it look like that", the owner's photo),
    // quality-loop-sized to fill the screen at zoom 3 (a 20x12 play area): glossy marble, 4 big
    // columns, a twin staircase to a full-width mezzanine, the wordmark, an overhead chandelier,
    // reception seating and the LUG Stall nook behind the stairs -- all in the `foyer` furnisher
    // (build-interiors.js FURNISHERS.foyer), since it's one continuous composed room rather than a
    // grid of repeated props like every other room type. `wallKit: 'roomBuilder'` (quality loop,
    // Interior art run 1): real LimeZu Room_Builder walls (a cap + a 2-tile-tall face) instead of
    // the flat hand-drawn BITS wall -- Main Block only, Library/Mechanical Block keep the old wall.
    floor.addRect('foyer', { name: 'Foyer', type: 'foyer', wallKit: 'roomBuilder', x0: 2, y0: 6, x1: 25, y1: 21 });
    floor.exteriorDoor('foyer', 'bottom', {
      name: 'Main Block Ground Floor entrance', to: 'campus', toId: 'Main Block entrance', facing: 'up',
      openTiles: 'intGlassDoorOpen,intGlassDoorOpen',
    });
    floor.wallFeature('foyer', 'left', 'intWallWindow');
    floor.wallFeature('foyer', 'right', 'intWallWindow');

    // A short corridor to the rest of the ground floor -- locked, but visible (docs/STORY.md:
    // "everywhere else in the building is blocked off for now") -- and the stairwell up.
    const corridor = floor.addRect('corridor', { name: 'Corridor', type: 'corridor', wallKit: 'roomBuilder', x0: 25, y0: 13, x1: 30, y1: 21, isCorridor: true });
    floor.connect('foyer', 'corridor');
    floor.placeStructure(27, 13, 'intDoorClosed');
    floor.placeStructure(28, 21, 'intDoorClosed');
    dressCorridor(floor, corridor, { axis: 'v' });

    stairwell(floor, 'Main Block Stairs G', { up: { to: 'main-block-1', toId: 'Main Block Stairs 1 (down)' } });
    floor.connect('corridor', 'stairwell');
  },
};

const mainBlock1 = {
  name: 'Main Block · 1st Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 16, y: 18, facing: 'up' },
  build(floor) {
    // docs/STORY.md key rooms (M3): ICVL (a computing lab, `labIcvl`) and Room 195 (a classroom),
    // both off one corridor -- see docs/INTERIORS_PLAN.md "Story rooms" for why they're here (no
    // sourced real floor plan for either).
    floor.addRect('icvl', { name: 'ICVL', type: 'labIcvl', wallKit: 'roomBuilder', x0: 3, y0: 3, x1: 16, y1: 14 });
    floor.addRect('room195', { name: 'Room 195', type: 'classroom', wallKit: 'roomBuilder', x0: 18, y0: 3, x1: 29, y1: 14 });

    const corridor = floor.addRect('corridor', { name: 'Corridor', type: 'corridor', wallKit: 'roomBuilder', x0: 3, y0: 14, x1: 30, y1: 21, isCorridor: true });
    floor.connect('icvl', 'corridor');
    floor.connect('room195', 'corridor');
    doorNameplate(floor, 'icvl', 'corridor');
    doorNameplate(floor, 'room195', 'corridor');
    // A couple of locked classroom doors further down the corridor -- visible, not walkable
    // (docs/STORY.md: only the route to the 3 key rooms stays open).
    floor.placeStructure(10, 21, 'intDoorClosed');
    floor.placeStructure(22, 21, 'intDoorClosed');
    dressCorridor(floor, corridor, { axis: 'h' });

    stairwell(floor, 'Main Block Stairs 1', {
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

    stairwell(floor, 'Main Block Stairs 3', { down: { to: 'main-block-2', toId: 'Main Block Stairs 2 (up)' } });
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
