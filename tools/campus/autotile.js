// Autotile rules for campus roads, kerbs and pavements (FB-0048 / FB-0054 / FB-0055).
//
// One pure rule set, applied once to the finished ground layer, instead of every painter in
// build-campus.js drawing its own kerb ring. Painters only say WHAT a cell is (road, pavement, island
// pavement, other paved ground); this file derives WHICH TILE each pavement cell gets from its eight
// neighbours, so every junction, corner, dead end, splitter island and road/pavement join comes out
// the same way no matter which painter laid the cells down or in what order.
//
// Cell classes (a `cls(x, y)` function returns one of these, anything out of the map is 'O'):
//   'R'  road carriageway (asphalt, lane markings, crossings)
//   'P'  pavement (sidewalk) beside a road. The kerb line sits on the sides that face open ground ('O').
//   'I'  island pavement (roundabout island, splitter). The kerb line sits on the sides that face a road.
//   'C'  other hard ground the pavement flows into without a kerb (walkway, plaza, parking bays, steps)
//   'O'  everything else (lawn, sand, track, court...): the kerb separates pavement from it.
//
// The kerb art is the Kenney sidewalk 9-slice (tools/make-assets.js): straight edge T/B/L/R, outer corner
// TL/TR/BL/BR, plus tiles built from the same pack pieces for the cases the 9-slice lacks: inner corners
// (kerbIn*), strips and caps for one-tile-wide pavement (splitters, narrow islands) and a lone island.

const KERB_TILE_NAMES = [
  'kerbT', 'kerbB', 'kerbL', 'kerbR', 'kerbTL', 'kerbTR', 'kerbBL', 'kerbBR',
  'kerbInTL', 'kerbInTR', 'kerbInBL', 'kerbInBR',
  'kerbCapT', 'kerbCapB', 'kerbCapL', 'kerbCapR', 'kerbStripV', 'kerbStripH', 'kerbIsland', 'kerbFill',
];

const DIRS = {
  N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0],
  NE: [1, -1], SE: [1, 1], SW: [-1, 1], NW: [-1, -1],
};

// flags: { N, E, S, W, NE, SE, SW, NW } -> true where the neighbour on that side is something the kerb
// must face. Returns the tile name for a pavement cell with that neighbourhood.
function kerbTileName(f) {
  const { N, E, S, W } = f;
  const sides = (N ? 1 : 0) + (E ? 1 : 0) + (S ? 1 : 0) + (W ? 1 : 0);
  if (sides === 4) return 'kerbIsland';
  if (sides === 3) {
    if (!S) return 'kerbCapT'; // kerb on top, left, right: the top end of a vertical strip
    if (!N) return 'kerbCapB';
    if (!E) return 'kerbCapL'; // kerb on left, top, bottom: the left end of a horizontal strip
    return 'kerbCapR';
  }
  if (sides === 2) {
    if (N && W) return 'kerbTL';
    if (N && E) return 'kerbTR';
    if (S && W) return 'kerbBL';
    if (S && E) return 'kerbBR';
    return W ? 'kerbStripV' : 'kerbStripH'; // opposite sides: a pavement one tile wide
  }
  if (sides === 1) return N ? 'kerbT' : S ? 'kerbB' : W ? 'kerbL' : 'kerbR';
  // No straight side faces anything: a diagonal-only neighbour is an inner (concave) corner.
  if (f.NW) return 'kerbInTL';
  if (f.NE) return 'kerbInTR';
  if (f.SW) return 'kerbInBL';
  if (f.SE) return 'kerbInBR';
  return 'kerbFill';
}

// True if the neighbour class `c` is something a kerb on a `mode` cell ('P' or 'I') faces.
function facesKerb(c, mode) {
  return mode === 'I' ? c === 'R' : c === 'O';
}

function neighbourFlags(cls, x, y, mode) {
  const out = {};
  for (const [name, [dx, dy]] of Object.entries(DIRS)) out[name] = facesKerb(cls(x + dx, y + dy) || 'O', mode);
  return out;
}

// A sidewalk cell with road straight on both opposite sides is not a sidewalk: it is a kerb strip
// left across a junction by two overlapping road rectangles (FB-0055), so it becomes road. Island
// cells are exempt (a splitter is meant to sit between two lanes). Repeats until nothing changes.
function junctionCleanup(w, h, cls, maxPasses = 4) {
  const cleaned = [];
  const override = new Map();
  const get = (x, y) => override.get(`${x},${y}`) || cls(x, y) || 'O';
  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (get(x, y) !== 'P') continue;
        const n = get(x, y - 1) === 'R';
        const s = get(x, y + 1) === 'R';
        const e = get(x + 1, y) === 'R';
        const wv = get(x - 1, y) === 'R';
        if ((n && s) || (e && wv)) {
          override.set(`${x},${y}`, 'R');
          cleaned.push([x, y]);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return { cleaned, cls: get };
}

// Derives the kerb tile name for every 'P' / 'I' cell. Returns { tiles: Map("x,y" -> name), toRoad: [[x,y]...] }
// where toRoad lists the cells junctionCleanup turned from sidewalk into road (the caller paints asphalt).
function autotileKerbs(w, h, cls) {
  const { cleaned, cls: fixed } = junctionCleanup(w, h, cls);
  const tiles = new Map();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fixed(x, y);
      if (c !== 'P' && c !== 'I') continue;
      tiles.set(`${x},${y}`, kerbTileName(neighbourFlags(fixed, x, y, c)));
    }
  }
  return { tiles, toRoad: cleaned };
}

// Lane-marking filter. `isRoad(x, y)` says whether a cell is carriageway. A dash on a horizontal
// ('h') or vertical ('v') road is kept only where the road is a plain straight strip: the same width
// for the dash cell and its two neighbours across the road, and carriageway on both sides of it
// along the road for two cells. That makes dashes stop one cell short of every junction, side road,
// splitter island, roundabout and road end instead of running into them.
function laneLineKept(isRoad, x, y, axis) {
  const across = axis === 'h' ? [0, 1] : [1, 0]; // direction across the road
  const along = axis === 'h' ? [1, 0] : [0, 1];
  const span = (cx, cy) => {
    let n = 1; // the contiguous run of carriageway through (cx, cy) across the road
    for (const sign of [1, -1]) {
      for (let k = 1; k <= 16 && isRoad(cx + across[0] * k * sign, cy + across[1] * k * sign); k++) n++;
    }
    return n;
  };
  const here = span(x, y);
  for (let k = -2; k <= 2; k++) {
    const ax = x + along[0] * k;
    const ay = y + along[1] * k;
    if (!isRoad(ax, ay)) return false;
    if (span(ax, ay) !== here) return false;
  }
  return true;
}

// Zebra crossings where a path runs straight over a road. Along a column (axis 'v': the walker goes
// north-south over an east-west road) or a row ('h'), a run of 2-8 carriageway cells that has a pavement
// cell and then a path cell at BOTH ends is a crossing; every cell of the run is returned. Needs the path
// to continue on the far side, so a walkway that stops at a kerb is not turned into a crossing.
function findCrossings(w, h, isRoad, isPad, isPath, maxRun = 8) {
  const out = [];
  const scan = (axis) => {
    const [dx, dy] = axis === 'v' ? [0, 1] : [1, 0];
    const lines = axis === 'v' ? w : h;
    const length = axis === 'v' ? h : w;
    for (let line = 0; line < lines; line++) {
      for (let t = 0; t < length; t++) {
        const at = (k) => (axis === 'v' ? [line, k] : [k, line]);
        const [x, y] = at(t);
        if (!isRoad(x, y) || (t > 0 && isRoad(...at(t - 1)))) continue; // start of a run
        let end = t;
        while (end + 1 < length && isRoad(...at(end + 1))) end++;
        const run = end - t + 1;
        if (run < 2 || run > maxRun) continue;
        if (isPad(...at(t - 1)) && isPath(...at(t - 2)) && isPad(...at(end + 1)) && isPath(...at(end + 2))) {
          for (let k = t; k <= end; k++) out.push({ x: at(k)[0], y: at(k)[1], axis });
        }
      }
    }
  };
  scan('v');
  scan('h');
  return out;
}

module.exports = { findCrossings, KERB_TILE_NAMES, kerbTileName, neighbourFlags, junctionCleanup, autotileKerbs, laneLineKept, facesKerb };
