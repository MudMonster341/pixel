// The interior floor plans (data), consumed by build-interiors.js (code). See
// docs/INTERIORS_PLAN.md for the room list, sources and rough spots. Room names are the real
// virtual-tour scene names where known (docs/research/bits-dubai-tour-scenes.json); floors the tour
// doesn't specify are a sensible guess, noted in the plan doc. Every building's floors share one
// canvas size and the same stairwell rectangle, so stairs line up between floors.
const { layoutRow } = require('./layout-helpers');

// ---------- Main Block: 4 floors, one shared spine corridor + stairwell ----------

const MAIN_W = 136;
const MAIN_H = 84;
const MAIN_SPINE = { x0: 4, y0: 42, x1: 120, y1: 46 };
const MAIN_STAIRWELL = { x0: 72, y0: 34, x1: 79, y1: 42 }; // attaches to the spine's top, same on every floor

function addSpine(floor) {
  floor.addRect('spine', { type: 'corridor', x0: MAIN_SPINE.x0, y0: MAIN_SPINE.y0, x1: MAIN_SPINE.x1, y1: MAIN_SPINE.y1, isCorridor: true });
}
function addStairwell(floor, name, { to, toId, dir, up, down }) {
  floor.addRect('stairwell', { name, type: 'stairwell', ...MAIN_STAIRWELL });
  floor.connect('spine', 'stairwell');
  floor.liftFeature('stairwell', MAIN_STAIRWELL.x0 + 1, MAIN_STAIRWELL.y1 - 1);
  if (up) floor.stairsObject('stairwell', { name: `${name} (up)`, to: up.to, toId: up.toId, facing: 'left', dir: 'up', offset: [-2, 0] });
  if (down) floor.stairsObject('stairwell', { name: `${name} (down)`, to: down.to, toId: down.toId, facing: 'right', dir: 'down', offset: [2, 0] });
}
// Attaches every room in `specs` to the spine, on `side` ('top'|'bottom'), starting at `startX`.
function spineRow(floor, side, startX, specs) {
  const { rooms } = layoutRow(startX, side === 'top' ? MAIN_SPINE.y0 : MAIN_SPINE.y1, side === 'bottom', specs);
  for (const r of rooms) {
    floor.addRect(r.id, r);
    floor.connect('spine', r.id);
  }
  return rooms;
}

const mainBlockG = {
  name: 'Main Block · Ground Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 56, y: 74, facing: 'up' },
  build(floor) {
    addSpine(floor);
    addStairwell(floor, 'Main Block Stairs G', { up: { to: 'main-block-1', toId: 'Main Block Stairs 1 (down)' } });

    floor.addRect('foyer', { name: 'Foyer', type: 'foyer', x0: 42, y0: 58, x1: 71, y1: 79 });
    floor.addRect('foyer2', { name: 'Foyer 2', type: 'lobby', x0: 42, y0: 46, x1: 71, y1: 58 });
    floor.connect('foyer2', 'foyer');
    floor.connect('spine', 'foyer2');
    floor.exteriorDoor('foyer', 'bottom', { name: 'Main Block Ground Floor entrance', to: 'campus', toId: 'Main Block entrance', facing: 'up' });

    floor.addRect('auditoriumLobby', { name: 'Auditorium Lobby', type: 'lobby', x0: 80, y0: 46, x1: 95, y1: 57 });
    floor.addRect('auditorium', { name: 'Auditorium', type: 'auditorium', x0: 80, y0: 57, x1: 107, y1: 79 });
    floor.addRect('parentsLounge', { name: 'Parents-Visitor Lounge', type: 'lounge', x0: 95, y0: 46, x1: 107, y1: 57 });
    floor.connect('spine', 'auditoriumLobby');
    floor.connect('auditoriumLobby', 'auditorium');
    floor.connect('auditoriumLobby', 'parentsLounge');
    floor.paintFloor(88, 74, 99, 78, 'intFloorStage'); // stage at the far end of the auditorium

    floor.addRect('incubation', { name: 'Incubation Centre', type: 'club', x0: 8, y0: 6, x1: 29, y1: 20 });
    floor.addRect('icl', { name: 'Intelligent Computing Lab', type: 'lab', x0: 8, y0: 20, x1: 33, y1: 42 });
    floor.connect('icl', 'incubation');
    floor.connect('spine', 'icl');

    floor.addRect('reception', { name: 'Reception', type: 'reception', x0: 35, y0: 30, x1: 46, y1: 42 });
    floor.connect('spine', 'reception');

    spineRow(floor, 'top', 46, [
      { id: 'careerServices', name: 'Career Services', type: 'office', w: 12 },
      { id: 'admissions', name: 'Admissions Office', type: 'office', w: 8 },
    ]);
    spineRow(floor, 'top', 80, [
      { id: 'augsd', name: 'Academic Undergraduate Studies Division', type: 'office', w: 9 },
      { id: 'directors', name: "Director's Office", type: 'office', w: 8 },
      { id: 'deputyRegistrar', name: 'Deputy Registrar Office', type: 'office', w: 8 },
      { id: 'studentWelfare', name: 'Student Welfare Division', type: 'office', w: 8 },
      { id: 'telepresence', name: 'Telepresence Classroom', type: 'classroom', w: 9 },
    ]);

    // West of Foyer 2 (x < 42), so the sports hub never overlaps the foyer's own footprint.
    const [miniMart, badminton, tableTennis] = spineRow(floor, 'bottom', 4, [
      { id: 'miniMart', name: 'Mini Mart', type: 'mart', w: 7 },
      { id: 'badminton', name: 'Badminton', type: 'badminton', w: 11 },
      { id: 'tableTennis', name: 'Table Tennis', type: 'tabletennis', w: 7 },
    ]);
    floor.connect('badminton', 'tableTennis');
    // The 9-tile gap between Foyer 2 and the Auditorium Lobby is just enough for the medical centre
    // (its own "Doctor's Room" is simplified to a curtained bay inside it -- see INTERIORS_PLAN.md).
    spineRow(floor, 'bottom', 71, [{ id: 'medical', name: 'Prime Medical Centre', type: 'medical', w: 6 }]);
  },
};

const mainBlock1 = {
  name: 'Main Block · 1st Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 56, y: 51, facing: 'down' },
  build(floor) {
    addSpine(floor);
    addStairwell(floor, 'Main Block Stairs 1', {
      down: { to: 'main-block-g', toId: 'Main Block Stairs G (up)' },
      up: { to: 'main-block-2', toId: 'Main Block Stairs 2 (down)' },
    });

    // The mezzanine: overlooks the foyer below through a railing-bordered void (same footprint as
    // the foyer + Foyer 2 on the ground floor, so the void lines up with the real atrium below).
    floor.addRect('connectingLobby', { name: 'Connecting Lobby', type: 'lobby', x0: 42, y0: 46, x1: 71, y1: 79 });
    floor.connect('spine', 'connectingLobby');
    floor.atriumVoid(48, 58, 65, 73);

    spineRow(floor, 'top', 46, [
      { id: 'classroom50a', name: '50 Seater Classroom', type: 'classroom', w: 9 },
      { id: 'classroom50b', name: '50 Seater Classroom (2)', type: 'classroom', w: 9 },
    ]);
    spineRow(floor, 'top', 80, [
      { id: 'classroom50c', name: '50 Seater Classroom (3)', type: 'classroom', w: 9 },
      { id: 'classroom60a', name: '60 Seater Classroom', type: 'classroom60', w: 11 },
      { id: 'classroom60b', name: '60 Seater Classroom (2)', type: 'classroom60', w: 11 },
    ]);
    // West of Connecting Lobby (x < 42), so this row never overlaps the mezzanine's own footprint.
    spineRow(floor, 'bottom', 4, [
      { id: 'lockerArea', name: 'Locker Area', type: 'locker', w: 10 },
      { id: 'counselling', name: 'Counselling Centre', type: 'office', w: 9 },
      { id: 'counsellingGroup', name: 'Counselling Center - Group Session Room', type: 'office', w: 7 },
    ]);
    // The 9-tile gap between Connecting Lobby and the (unbuilt, below the auditorium void) east
    // side is just enough for the therapy room.
    spineRow(floor, 'bottom', 71, [
      { id: 'counsellingTherapy', name: 'Counselling Center - Therapy Room', type: 'office', w: 6 },
    ]);
    spineRow(floor, 'bottom', 80, [
      { id: 'internationalServices', name: 'International Student Services', type: 'office', w: 9 },
      { id: 'meetingRoom', name: 'Meeting Room', type: 'office', w: 7 },
      { id: 'guestMeetingRoom', name: 'Guest Meeting Room', type: 'office', w: 7 },
    ]);
  },
};

const mainBlock2 = {
  name: 'Main Block · 2nd Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 75, y: 44, facing: 'up' },
  build(floor) {
    addSpine(floor);
    addStairwell(floor, 'Main Block Stairs 2', {
      down: { to: 'main-block-1', toId: 'Main Block Stairs 1 (up)' },
      up: { to: 'main-block-3', toId: 'Main Block Stairs 3 (down)' },
    });

    spineRow(floor, 'top', 46, [
      { id: 'eeeAnalog', name: 'Analog and Digital Electronics (EEE)', type: 'lab', w: 8 },
      { id: 'eeeComms', name: 'Communication Systems Lab (EEE)', type: 'lab', w: 8 },
      { id: 'eeeMachines', name: 'Electrical Machines Lab (EEE)', type: 'lab', w: 8 },
    ]);
    spineRow(floor, 'top', 80, [
      { id: 'eeeInstrumentation', name: 'Instrumentation Lab (EEE)', type: 'lab', w: 8 },
      { id: 'eeePower', name: 'Power Electronics Lab (EEE)', type: 'lab', w: 8 },
      { id: 'chemEng', name: 'Chemical Engineering Lab (CHEM)', type: 'lab', w: 8 },
      { id: 'petroleum', name: 'Petroleum Lab (CHEM)', type: 'lab', w: 8 },
    ]);
    spineRow(floor, 'bottom', 4, [
      { id: 'computerLab', name: 'Computer Lab (CS)', type: 'lab', w: 8 },
      { id: 'dbSystems', name: 'Database System & Algorithms Lab (CS)', type: 'lab', w: 8 },
      { id: 'networkDist', name: 'Network & Distributed System Lab (CS)', type: 'lab', w: 8 },
      { id: 'signalProcessing', name: 'Signal Processing and Simulation Lab (CS)', type: 'lab', w: 8 },
      { id: 'advMolecularBio', name: 'Advanced Molecular Biology (BIOT)', type: 'lab', w: 8 },
      { id: 'biotechResearch', name: 'Biotechnology-Research Lab (BIOT)', type: 'lab', w: 8 },
      { id: 'microbiology', name: 'Microbiology Lab (BIOT)', type: 'lab', w: 8 },
      { id: 'chemistryGS', name: 'Chemistry Lab (GS)', type: 'lab', w: 8 },
      { id: 'physicsGS', name: 'Physics Lab (GS)', type: 'lab', w: 8 },
      { id: 'soilMechanics', name: 'Soil Mechanics Lab (Civil)', type: 'lab', w: 8 },
      { id: 'transportEng', name: 'Transport Engineering Lab (Civil)', type: 'lab', w: 8 },
      { id: 'thermoFluids', name: 'Thermo-Fluids Lab (Workshop)', type: 'lab', w: 8 },
    ]);
  },
};

const mainBlock3 = {
  name: 'Main Block · 3rd Floor',
  width: MAIN_W,
  height: MAIN_H,
  spawn: { x: 75, y: 44, facing: 'up' },
  build(floor) {
    addSpine(floor);
    addStairwell(floor, 'Main Block Stairs 3', { down: { to: 'main-block-2', toId: 'Main Block Stairs 2 (up)' } });

    spineRow(floor, 'top', 46, [
      { id: 'acm', name: 'ACM (Association for Computing Machinery)', type: 'club', w: 7 },
      { id: 'acmw', name: 'ACM-W (Association of Computing Machinery Women)', type: 'club', w: 7 },
      { id: 'gdg', name: 'Google Developers Groups', type: 'club', w: 7 },
    ]);
    spineRow(floor, 'top', 80, [
      { id: 'mtc', name: 'MTC (Microsoft Tech Club)', type: 'club', w: 7 },
      { id: 'ieee', name: 'IEEE (Institution Electrical and Electronic Engineers)', type: 'club', w: 7 },
      { id: 'ifor', name: 'IFOR Club (Intelligent Flying Object and Reconnaissance)', type: 'club', w: 7 },
      { id: 'supernova', name: 'Supernova (The Astronomy Club)', type: 'club', w: 7 },
    ]);
    spineRow(floor, 'bottom', 4, [
      { id: 'music', name: 'Music Club', type: 'club', w: 7 },
      { id: 'shadesArt', name: 'Shades Art Club', type: 'club', w: 7 },
      { id: 'swe', name: 'SWE (Society of Women Engineers)', type: 'club', w: 7 },
      { id: 'wie', name: 'WIE (Women in Engineering)', type: 'club', w: 7 },
      { id: 'chimera', name: 'Chimera (Biotech Association)', type: 'club', w: 7 },
      { id: 'studentCouncil', name: 'Student Council', type: 'club', w: 7 },
      { id: 'vcOffice', name: 'Vice Chancellor Office', type: 'office', w: 9 },
      { id: 'telepresenceConf', name: 'Telepresence Conference Room', type: 'office', w: 9 },
      { id: 'guestRoom1', name: 'Guest Meeting Room (3rd Floor)', type: 'office', w: 7 },
      { id: 'guestRoom2', name: 'Guest Meeting Room (3rd Floor) 2', type: 'office', w: 7 },
    ]);
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
