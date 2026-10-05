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

module.exports = { DOOR_KINDS, doorProps };
