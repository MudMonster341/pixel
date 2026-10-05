// P4c (FB-0067 "all doors should have an opening and closing animation"): the door-animation data, one table.
//
// Every enterable door (a Tiled `door` object with a `to`, a text map's `warps` entry) and every lift (a Tiled `lift` object) plays
// the same three-frame sequence, closed -> half -> open (opening, forward) and open -> half -> closed (closing, backward).
// A door KIND names the tile of each frame per cell of the doorway, left to right (a two-tile door has one tile per leaf):
//   closed  what the door looks like at rest (the tile the map already shows there, so the first frame matches the picture)
//   half    the in-between frame (a swinging leaf foreshortened and slanted; panes or lift doors slid a third of the way)
//   open    the frame she walks through (the existing open art where there was one, derived from the closed pixels otherwise)
// The generators (tools/campus/build-campus.js, tools/interiors/build-interiors.js, src/maps.js by hand for the two text maps) write
// doorProps(kind) onto the door object as `closedTiles` / `halfTiles` / `openTiles` (comma-separated tile names, the shape
// src/maplogic.js parseOpenTiles() reads), and tools/make-assets.js draws every `half` tile (and the interior exit's closed/open
// tiles) from the pixels of the tiles named here: no freehand art. The engine only ever reads the three properties, never this file.
//
// A door that never opens (a `closed` wing door, a locked door) simply has no frames: it keeps rattling (world.js rattleDoor()).

const DOOR_KINDS = {
  // The campus glass entrance (BITS Main Block): the two glass leaves slide apart, the dark doorway behind them.
  campusGlass: {
    closed: ['bitsEntranceGrandL', 'bitsEntranceGrandR'],
    half: ['bitsEntranceHalfL', 'bitsEntranceHalfR'],
    open: ['bitsEntranceGrandLOpen', 'bitsEntranceGrandROpen'],
  },
  // The same picture on the Library and Mechanical blocks (their closed tiles are the plain `bitsEntranceL/R`, drawn identically).
  campusGlassPlain: {
    closed: ['bitsEntranceL', 'bitsEntranceR'],
    half: ['bitsEntranceHalfL', 'bitsEntranceHalfR'],
    open: ['bitsEntranceGrandLOpen', 'bitsEntranceGrandROpen'],
  },
  // An interior building's exit to the campus: a glass double door in the wooden doorway frame, each leaf hinged on its outer jamb.
  exitGlass: {
    closed: ['intExitGlassL', 'intExitGlassR'],
    half: ['intExitGlassHalfL', 'intExitGlassHalfR'],
    open: ['intExitGlassOpenL', 'intExitGlassOpenR'],
  },
  // The Main Block's lift (P4b): the stainless doors slide apart in two stages, a third of the way (half), then fully open.
  lift: {
    closed: ['intLiftDoorL', 'intLiftDoorR'],
    half: ['intLiftThirdL', 'intLiftThirdR'],
    open: ['intLiftOpenL', 'intLiftOpenR'],
  },
  // The test maps' house door, at both ends (a text map, hand-authored in src/maps.js with the same names): the house's front door
  // outside, and the same wood door in the interior's back wall.
  houseDoor: { closed: ['door'], half: ['doorHalf'], open: ['doorOpen'] },
  // P5c (FB-0071): the ICL's fingerprint-locked hatch, a sliding blast door in the corridor wall. Unlike every door above it never warps:
  // it is a Tiled `sealedDoor` object (tools/interiors/build-interiors.js sealedDoor()) that stays closed and solid until the scanner beside it
  // has been used (the `iclDoorOpen` flag), then plays closed -> half -> open and stays open for good.
  iclHatch: { closed: ['intDoorHatchL', 'intDoorHatchR'], half: ['intDoorHatchHalfL', 'intDoorHatchHalfR'], open: ['intDoorHatchOpenL', 'intDoorHatchOpenR'] },
};

// The three door-object properties for a kind (strings, as Tiled stores them).
function doorProps(kind) {
  const k = DOOR_KINDS[kind];
  if (!k) throw new Error(`unknown door kind "${kind}"`);
  return { closedTiles: k.closed.join(','), halfTiles: k.half.join(','), openTiles: k.open.join(',') };
}

// FB-0077 ("add in animation of this opening when we near it so it opens and stays open"): the Gate 2 boom barrier is door-like too, but
// it is not one doorway: lowered it is a row of tiles across the whole road, raised it stands up beside its pivot housing, so the
// frames are a handful of PARTS (each a point object of type `gateBarrier` with the same three properties a door carries, plus `cells`):
//   row    the pivot-post row: the support post, the arm tiles, the pivot housing        (armCount + 2 cells wide)
//   mast   the two tiles above the housing: nothing while lowered, the raised arm's mid and top once open (1 x 2 cells, top row first)
//   elbow  the tile left of the one above the housing: only the half-raised arm's upper end   (1 x 1)
// BLANK ('-') is "nothing there": the overlay hides that cell and, once the barrier has opened, the engine clears the structure tile.
// `armCount` is the number of lowered arm tiles between the support post and the housing (build-campus.js lays them); the three parts'
// offsets are from the support post's tile and the pivot's row. Closed = the picture the map already shows; half = the arm at ~45
// degrees rising from the housing; open = the arm vertical beside it and the road clear. tools/make-assets.js draws the new tiles.
const BLANK = '-';
function gateBarrierParts(armCount) {
  const blanks = (n) => Array(n).fill(BLANK);
  return [
    {
      suffix: '', dx: 0, dy: 0, cells: `${armCount + 2}x1`,
      closed: ['barrierRest', ...Array(armCount).fill('barrierArm'), 'barrierPivot'],
      half: ['barrierRestOpen', ...blanks(armCount), 'barrierPivotHalf'],
      open: ['barrierRestOpen', ...blanks(armCount), 'barrierPivotUp'],
    },
    { suffix: ' mast', dx: armCount + 1, dy: -2, cells: '1x2', closed: blanks(2), half: [BLANK, 'barrierHalfMast'], open: ['barrierUpTop', 'barrierUpMid'] },
    { suffix: ' elbow', dx: armCount, dy: -1, cells: '1x1', closed: [BLANK], half: ['barrierHalfElbow'], open: [BLANK] },
  ];
}

module.exports = { DOOR_KINDS, doorProps, gateBarrierParts, GATE_BARRIER_BLANK: BLANK };
