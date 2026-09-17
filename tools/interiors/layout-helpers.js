// Pure geometry helpers shared by tools/interiors/plans.js (the data) and build-interiors.js (the
// generator). No tile drawing here, just rectangle arithmetic, so a room list in plans.js can say
// "these rooms, in this order, this wide" and get back real, non-overlapping, axis-aligned rects
// without anyone doing the addition by hand.

// Interior depth (walkable, perpendicular to the corridor) per room type. `w` (walkable width,
// along the corridor) is given per room in plans.js since it varies room to room.
const DEPTH = {
  office: 6,
  club: 6,
  locker: 6,
  service: 6,
  discussion: 6,
  classroom: 9,
  classroom60: 10,
  lab: 9,
  labHeavy: 11,
  reception: 8,
  lobby: 10,
  lounge: 8,
  mart: 7,
  medical: 7,
  badminton: 12,
  tabletennis: 8,
  stairwell: 7,
  workshop: 14,
};

function depthOf(type) {
  return DEPTH[type] ?? 7;
}

// Lays out a row of rooms edge to edge (each shares its wall with the next, per addRoom's
// wall-ring convention), all opening onto the same straight corridor wall.
// `growDown`: true = corridor is above the row (room's near wall is its own y0, at `wallY`);
//             false = corridor is below the row (room's near wall is its own y1, at `wallY`).
// Returns the rooms with `x0,y0,x1,y1` filled in, plus `right` (the x just past the last room),
// so the caller can size the corridor or continue the row.
function layoutRow(startX, wallY, growDown, specs) {
  let x = startX;
  const rooms = specs.map((spec) => {
    const outerH = depthOf(spec.type) + 2;
    const x0 = x;
    const x1 = x + spec.w + 1;
    x = x1;
    const rect = growDown ? { y0: wallY, y1: wallY + outerH - 1 } : { y0: wallY - outerH + 1, y1: wallY };
    return { ...spec, x0, x1, ...rect };
  });
  return { rooms, right: x };
}

// Same idea, stacked vertically along a wall running north-south.
// `growRight`: true = corridor is to the left (room's near wall is its own x0, at `wallX`);
//              false = corridor is to the right (room's near wall is its own x1, at `wallX`).
function layoutColumn(startY, wallX, growRight, specs) {
  let y = startY;
  const rooms = specs.map((spec) => {
    const outerW = depthOf(spec.type) + 2;
    const y0 = y;
    const y1 = y + spec.w + 1;
    y = y1;
    const rect = growRight ? { x0: wallX, x1: wallX + outerW - 1 } : { x0: wallX - outerW + 1, x1: wallX };
    return { ...spec, y0, y1, ...rect };
  });
  return { rooms, bottom: y };
}

module.exports = { DEPTH, depthOf, layoutRow, layoutColumn };
