// Builds the BITS Pilani Dubai campus map from OpenStreetMap + tools/campus/layout.js (ADR 0009):
// real positions and shapes (the campus strip along D54, real building footprints, hostel row, the
// real DIAC Park/ring), straightened and cleaned up so everything inside the fence is rectilinear.
// Run:   npm run assets && npm run campus
// Output: assets/maps/campus.json   Tiled map (layers: ground, structures, overhead, objects)
//         docs/research/campus-greybox.png   preview, 2 px per tile
// `--out <dir>` writes both files into <dir> instead (tests use this to check the map is up to date).
// Map data (c) OpenStreetMap contributors (ODbL).
const fs = require('fs');
const path = require('path');
const layout = require('./layout');
const { encodePNG } = require('../lib/png');

const ROOT = path.join(__dirname, '..', '..');
const TILE_PX = 16;
const MPT = layout.metersPerTile;

const outFlag = process.argv.indexOf('--out');
const outDir = outFlag !== -1 ? path.resolve(process.argv[outFlag + 1]) : null;
const MAP_OUT = outDir ? path.join(outDir, 'campus.json') : path.join(ROOT, 'assets', 'maps', 'campus.json');
const PREVIEW_OUT = outDir ? path.join(outDir, 'campus-greybox.png') : path.join(ROOT, 'docs', 'research', 'campus-greybox.png');

const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const TILE = Object.fromEntries(tileInfo.tiles.map((tile, i) => [tile.name, i]));
const REQUIRED_TILES = [
  'sand', 'lawn', 'lawn2', 'hedge', 'bush', 'flowerbed', 'signboard',
  'treeTrunk', 'treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR',
  'palmTrunk', 'palmCanopyTL', 'palmCanopyTR', 'palmCanopyBL', 'palmCanopyBR',
  'asphalt', 'paving', 'parking', 'track', 'turf', 'walkway',
  'kerbT', 'kerbB', 'kerbL', 'kerbR', 'kerbTL', 'kerbTR', 'kerbBL', 'kerbBR', 'roadLineH', 'roadLineV', 'crossingH', 'crossingV',
  'court', 'courtLineH', 'courtLineV', 'courtCornerTL', 'courtCornerTR', 'courtCornerBL', 'courtCornerBR', 'courtCenterMark', 'courtNet', 'courtNetPostT', 'courtNetPostB',
  'bitsRoof', 'bitsRoofT', 'bitsRoofL', 'bitsRoofR', 'bitsRoofTL', 'bitsRoofTR', 'bitsWallPlain', 'bitsWall', 'bitsWallEndL', 'bitsWallEndR', 'bitsEntranceL', 'bitsEntranceR', 'bitsPillar', 'bitsDoor',
  'otherRoof', 'otherRoofT', 'otherRoofL', 'otherRoofR', 'otherRoofTL', 'otherRoofTR', 'otherWallPlain', 'otherWall', 'otherWallEndL', 'otherWallEndR',
  'fenceH', 'fenceV', 'fenceCornerTL', 'fenceCornerTR', 'fenceCornerBL', 'fenceCornerBR', 'fenceGate',
];
for (const name of REQUIRED_TILES) {
  if (!(name in TILE)) throw new Error(`assets/tiles.json has no tile "${name}". Run npm run assets first.`);
}

// ================= 1. read OpenStreetMap into the frame =================

const xml = fs.readFileSync(path.join(__dirname, layout.osmFile), 'utf8');
const nodes = new Map();
for (const m of xml.matchAll(/<node id="(\d+)"[^>]*?lat="([-\d.]+)" lon="([-\d.]+)"/g)) nodes.set(m[1], [Number(m[2]), Number(m[3])]);

const mPerLat = 111320;
const mPerLon = 111320 * Math.cos((layout.origin.lat * Math.PI) / 180);
const FRAME_A = (layout.frameAngleDeg * Math.PI) / 180;
const FRAME_SIGN = layout.flip ? -1 : 1;

function toFrame([lat, lon]) {
  const e = (lon - layout.origin.lon) * mPerLon;
  const n = (lat - layout.origin.lat) * mPerLat;
  return [FRAME_SIGN * (e * Math.cos(FRAME_A) + n * Math.sin(FRAME_A)), FRAME_SIGN * (e * Math.sin(FRAME_A) - n * Math.cos(FRAME_A))];
}

const ways = [];
for (const m of xml.matchAll(/<way id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g)) {
  const tags = Object.fromEntries([...m[2].matchAll(/<tag k="([^"]+)" v="([^"]*)"/g)].map((t) => [t[1], t[2]]));
  const points = [...m[2].matchAll(/<nd ref="(\d+)"\/>/g)].map((r) => nodes.get(r[1])).filter(Boolean).map(toFrame);
  if (points.length >= 2) ways.push({ id: Number(m[1]), tags, points });
}
const wayById = new Map(ways.map((w) => [w.id, w]));
const need = (id) => {
  const way = wayById.get(id);
  if (!way) throw new Error(`OSM way ${id} (from layout.js) is not in ${layout.osmFile}`);
  return way;
};

// ================= 2. geometry helpers =================

function isClosed(points) {
  const a = points[0];
  const b = points[points.length - 1];
  return points.length > 3 && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
}
function ringPoints(points) {
  return isClosed(points) ? points.slice(0, -1) : points;
}
function centroid(points) {
  const pts = ringPoints(points);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
}
function bbox(points) {
  const us = points.map((p) => p[0]);
  const vs = points.map((p) => p[1]);
  return { u0: Math.min(...us), v0: Math.min(...vs), u1: Math.max(...us), v1: Math.max(...vs) };
}
function rotateAround(points, [cu, cv], deg) {
  const t = (deg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return points.map(([u, v]) => [cu + (u - cu) * c - (v - cv) * s, cv + (u - cu) * s + (v - cv) * c]);
}
// Dominant wall direction, folded into (-45, 45] degrees (0 = lined up with the grid)
function dominantAngle(points) {
  const bins = new Array(90).fill(0);
  for (let i = 0; i < points.length - 1; i++) {
    const du = points[i + 1][0] - points[i][0];
    const dv = points[i + 1][1] - points[i][1];
    const deg = (((Math.atan2(dv, du) * 180) / Math.PI) % 90 + 90) % 90;
    bins[Math.floor(deg) % 90] += Math.hypot(du, dv);
  }
  const best = bins.indexOf(Math.max(...bins)) + 0.5;
  return best > 45 ? best - 90 : best;
}
function pointInPolygon(u, v, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ui, vi] = poly[i];
    const [uj, vj] = poly[j];
    if (vi > v !== vj > v && u < ((uj - ui) * (v - vi)) / (vj - vi) + ui) inside = !inside;
  }
  return inside;
}
function distToSegment(pu, pv, [au, av], [bu, bv]) {
  const du = bu - au;
  const dv = bv - av;
  const len2 = du * du + dv * dv || 1e-9;
  const t = Math.max(0, Math.min(1, ((pu - au) * du + (pv - av) * dv) / len2));
  return Math.hypot(pu - (au + t * du), pv - (av + t * dv));
}

// Cleans a polygon's outline into a rectilinear shape (no diagonals), preserving real wings: nearby
// coordinates are clustered together (removes OSM digitisation noise and small chamfers), then any
// edge that is still diagonal is squared off with the corner point closest to the polygon's centre
// (a conservative cut, so the footprint never grows). Used on every building and on the fence.
function clusterCoords(values, tol) {
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  for (const v of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && v - last.sum / last.n <= tol) {
      last.sum += v;
      last.n++;
    } else clusters.push({ sum: v, n: 1 });
  }
  return clusters.map((c) => c.sum / c.n);
}
function snapTo(v, centers) {
  let best = centers[0];
  let bestD = Infinity;
  for (const c of centers) {
    const d = Math.abs(v - c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}
function dedupe(points) {
  const out = [];
  for (const p of points) {
    if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 1e-6) out.push(p);
  }
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-6) out.pop();
  return out;
}
function squareOffDiagonals(points) {
  const cx = points.reduce((s, p) => s + p[0], 0) / points.length;
  const cy = points.reduce((s, p) => s + p[1], 0) / points.length;
  const out = [];
  const eps = 0.5;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push(a);
    if (Math.abs(a[0] - b[0]) > eps && Math.abs(a[1] - b[1]) > eps) {
      const c1 = [a[0], b[1]];
      const c2 = [b[0], a[1]];
      const d1 = Math.hypot(c1[0] - cx, c1[1] - cy);
      const d2 = Math.hypot(c2[0] - cx, c2[1] - cy);
      out.push(d1 < d2 ? c1 : c2);
    }
  }
  return out;
}
function rectilinearize(points, tol) {
  const pts = ringPoints(points);
  const us = clusterCoords(pts.map((p) => p[0]), tol);
  const vs = clusterCoords(pts.map((p) => p[1]), tol);
  const snapped = pts.map(([u, v]) => [snapTo(u, us), snapTo(v, vs)]);
  return dedupe(squareOffDiagonals(dedupe(snapped)));
}

// The largest all-filled axis-aligned rectangle anywhere in a w*h boolean grid (the classic
// "maximal rectangle in a binary matrix" algorithm, via a per-row histogram + stack: O(w*h)).
function largestRectInGrid(cell, w, h) {
  const heights = new Int32Array(w);
  let best = null;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) heights[x] = cell[y * w + x] ? heights[x] + 1 : 0;
    const stack = [];
    for (let x = 0; x <= w; x++) {
      const height = x < w ? heights[x] : 0;
      while (stack.length && heights[stack[stack.length - 1]] >= height) {
        const top = stack.pop();
        const topHeight = heights[top];
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = topHeight * (x - left);
        if (!best || area > best.area) best = { area, x0: left, x1: x - 1, y1: y, height: topHeight };
      }
      stack.push(x);
    }
  }
  if (!best) return null;
  return { x0: best.x0, x1: best.x1, y0: best.y1 - best.height + 1, y1: best.y1, area: best.area };
}

// Simplifies a real (possibly stepped) building outline into a small number of large rectangles
// (ADR 0009 review: OpenStreetMap facades have small setbacks that stay individually rectilinear
// but read as a staircase when there are many of them in a row -- greedily covering the footprint
// with its largest all-filled rectangle, repeated a few times, keeps only the big simple shapes a
// building actually reads as and drops that noise). Returns null if the footprint is already small
// enough that one rectangle wouldn't lose much (callers fall back to the polygon in that case).
function decomposeIntoRects(poly, maxRects, minTiles) {
  const box = bbox(poly);
  const w = Math.round((box.u1 - box.u0) / MPT);
  const h = Math.round((box.v1 - box.v0) / MPT);
  if (w < minTiles || h < minTiles || w * h > 40000) return null;
  const cell = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = box.u0 + (x + 0.5) * MPT;
      const v = box.v0 + (y + 0.5) * MPT;
      cell[y * w + x] = pointInPolygon(u, v, poly) ? 1 : 0;
    }
  }
  const rects = [];
  for (let i = 0; i < maxRects; i++) {
    const best = largestRectInGrid(cell, w, h);
    if (!best || best.area < minTiles * minTiles) break;
    rects.push(best);
    for (let y = best.y0; y <= best.y1; y++) for (let x = best.x0; x <= best.x1; x++) cell[y * w + x] = 0;
  }
  if (!rects.length) return null;
  return rects.map((r) => ({
    u0: box.u0 + r.x0 * MPT,
    v0: box.v0 + r.y0 * MPT,
    u1: box.u0 + (r.x1 + 1) * MPT,
    v1: box.v0 + (r.y1 + 1) * MPT,
  }));
}
function rectsBBox(rects) {
  return {
    u0: Math.min(...rects.map((r) => r.u0)),
    v0: Math.min(...rects.map((r) => r.v0)),
    u1: Math.max(...rects.map((r) => r.u1)),
    v1: Math.max(...rects.map((r) => r.v1)),
  };
}
// A building's real footprint: a handful of large rectangles if it was decomposed (BITS buildings,
// which is what's actually drawn), otherwise its cleaned polygon (smaller "other" buildings).
function buildingBBox(b) {
  return b.rects ? rectsBBox(b.rects) : bbox(b.poly);
}

// ================= 3. straighten the academic complex onto the grid =================

const straightenedIds = new Set();
let complexCenter = null;
let complexTurnDeg = 0;
for (const group of layout.straighten) {
  const anchorWays = group.anchors.map(need);
  complexCenter = centroid(anchorWays.flatMap((w) => w.points));
  const angle = dominantAngle(anchorWays.flatMap((w) => w.points));
  const entrance = centroid(need(group.entranceWay).points);

  // Of the four grid-aligned rotations, pick the one that puts the entrance most directly below.
  let best = null;
  for (const turn of [0, 90, -90, 180]) {
    const deg = -angle + turn;
    const [[eu, ev]] = rotateAround([entrance], complexCenter, deg);
    const du = eu - complexCenter[0];
    const dv = ev - complexCenter[1];
    const score = dv > 0 ? Math.abs(du) / dv : Infinity;
    if (!best || score < best.score) best = { deg, score };
  }
  complexTurnDeg = best.deg;

  const members = ways.filter((w) => {
    if (group.anchors.includes(w.id)) return true;
    const [u, v] = centroid(w.points);
    const inside = Math.hypot(u - complexCenter[0], v - complexCenter[1]) <= group.radiusMeters;
    return inside && Math.abs(dominantAngle(w.points)) > 20 && !w.tags.barrier && !layout.buildings[w.id];
  });
  for (const w of members) {
    w.points = rotateAround(w.points, complexCenter, best.deg);
    straightenedIds.add(w.id);
  }
  const after = dominantAngle(anchorWays.flatMap((w) => w.points));
  console.log(`${group.name}: walls were ${angle.toFixed(1)} deg off grid -> rotated ${best.deg.toFixed(1)} deg (${members.length} ways), now ${after.toFixed(1)} deg`);
}

// Other off-grid buildings (neighbouring campuses) are squared up around their own centre.
for (const w of ways) {
  if (!w.tags.building || straightenedIds.has(w.id) || layout.buildings[w.id]) continue;
  const angle = dominantAngle(w.points);
  if (Math.abs(angle) > 8) w.points = rotateAround(w.points, centroid(w.points), -angle);
}

// ================= 4. buildings: rectilinear footprints =================

const buildingList = [];
for (const w of ways) {
  if (!w.tags.building || !isClosed(w.points)) continue;
  const meta = layout.buildings[w.id];
  const poly = rectilinearize(w.points, layout.rectilinearizeToleranceMeters);
  // BITS buildings get simplified into a handful of large rectangles (see decomposeIntoRects):
  // real OpenStreetMap facades have small setbacks that read as a staircase in a row, even though
  // each one is individually rectilinear. "Other" (not enterable, further away) buildings keep the
  // plain cleaned polygon -- they're smaller and much less prominent on screen.
  const rects = meta ? decomposeIntoRects(poly, layout.maxRectsPerBuilding, layout.minBuildingRectTiles) : null;
  buildingList.push({
    id: w.id,
    name: meta?.name || w.tags.name || null,
    style: meta?.style || 'other',
    wallTiles: meta?.wallTiles ?? layout.otherBuildingWallTiles,
    door: Boolean(meta?.door),
    to: meta?.to || null,
    unverified: Boolean(meta?.unverified),
    isBits: Boolean(meta),
    poly,
    rects,
  });
}

// ================= 5. the campus fence: one closed rectilinear rectangle =================
// The raw fence polygon has a rounded/chamfered notch by the entrance driveway (where Gate 2's
// drop-off loop is in the source data) that pokes out well past the fence's real east side; using
// its east/west extent directly used to pull the fence out far enough to overlap the DIAC ring
// (owner review). East/west come from the real BITS buildings only, padded; north/south still use
// the raw fence, which is where the true entrance/plaza depth (south of the Main Block) is captured.
const rawFenceBox = bbox(need(layout.campusFence).points);
const bitsBoxes = buildingList.filter((b) => b.isBits).map((b) => buildingBBox(b));
const pad = layout.fencePaddingMeters;
const fenceFrame = {
  u0: Math.min(...bitsBoxes.map((b) => b.u0)) - pad,
  v0: Math.min(rawFenceBox.v0, ...bitsBoxes.map((b) => b.v0)) - pad,
  u1: Math.max(...bitsBoxes.map((b) => b.u1)) + pad,
  v1: Math.max(rawFenceBox.v1, ...bitsBoxes.map((b) => b.v1)) + pad,
};

// The DIAC ring's centre (radius kept from ADR 0007's measurement) is placed a fixed gap east of
// the fence's real east edge, rather than at ADR 0007's old hand-measured centre: that number
// predates the fence being derived from real building positions and, combined with them, overlapped
// the campus (owner review). This guarantees a clean gap regardless of exactly where the fence ends.
const RING_GAP_METERS = 30;
const RING_CENTER = [fenceFrame.u1 + RING_GAP_METERS + layout.diacRing.radius, layout.diacRing.center[1]];
const RING_SHIFT = [RING_CENTER[0] - layout.diacRing.center[0], RING_CENTER[1] - layout.diacRing.center[1]];
// Moves a point towards RING_SHIFT the closer it is to the ring's original position -- a smooth
// falloff (full shift inside RING_SHIFT_INNER, none beyond RING_SHIFT_OUTER, linear between), not a
// hard cutoff. Several real roads and buildings run from well outside the ring to well inside it (or
// sit right at a distance that's borderline either way); a hard "shift this point or don't" cutoff
// turns any such feature into a visible seam or gap exactly where it crosses the cutoff distance. A
// continuous falloff never has that seam, at the cost of a gentle stretch in the transition band.
const RING_SHIFT_INNER = layout.diacRing.radius + 40;
const RING_SHIFT_OUTER = layout.diacRing.radius + 160;
function ringShift([u, v]) {
  const d = Math.hypot(u - layout.diacRing.center[0], v - layout.diacRing.center[1]);
  const t = d <= RING_SHIFT_INNER ? 1 : d >= RING_SHIFT_OUTER ? 0 : 1 - (d - RING_SHIFT_INNER) / (RING_SHIFT_OUTER - RING_SHIFT_INNER);
  return [u + RING_SHIFT[0] * t, v + RING_SHIFT[1] * t];
}
// Non-BITS buildings anywhere near the ring (e.g. Manipal University's hostel, right by it) move
// with it too, so none ends up sitting on a road that moved out from under it. Real BITS buildings
// are always far outside the falloff band, so this is a no-op for them.
for (const b of buildingList) {
  if (b.isBits) continue;
  b.poly = b.poly.map(ringShift);
}

// Drop any building not on the BITS list whose footprint overlaps the fence at all (FB-0003: no
// stray non-BITS structures inside the campus -- checked as a bbox overlap, not just its centre, so
// a building straddling the boundary is dropped too).
// A small buffer beyond the padded fence box: a building whose real gap to the fence is under a
// couple of metres can still round onto/inside the fence line once snapped to the 2 m tile grid.
const DROP_BUFFER = MPT * 2;
for (let i = buildingList.length - 1; i >= 0; i--) {
  const b = buildingList[i];
  if (b.isBits) continue;
  const box = bbox(b.poly);
  const overlaps = box.u0 < fenceFrame.u1 + DROP_BUFFER && box.u1 > fenceFrame.u0 - DROP_BUFFER && box.v0 < fenceFrame.v1 + DROP_BUFFER && box.v1 > fenceFrame.v0 - DROP_BUFFER;
  if (overlaps) buildingList.splice(i, 1);
}
for (const b of buildingList) if (!b.name) b.name = `Building ${b.id}`;

// Hostel clusters (boys west of the complex, girls east), used to route the walkway network.
const hostels = buildingList.filter((b) => b.isBits && /Hostel/.test(b.name));
const hostelCenter = (u) => hostels.filter((h) => (u === 'w' ? centroid(h.poly)[0] < complexCenter[0] : centroid(h.poly)[0] >= complexCenter[0]));
const westHostels = hostelCenter('w');
const eastHostels = hostelCenter('e');
const clusterPoint = (list) => {
  const pts = list.map((b) => centroid(b.poly));
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
};

// ================= 6. Gate 2 + Side Gate positions (frame metres) =================

const mainBlock = buildingList.find((b) => b.name === 'Main Block');
const libraryBlock = buildingList.find((b) => b.name === 'Library Block');
const mechanicalBlock = buildingList.find((b) => b.name === 'Mechanical Block');
if (!mainBlock || !libraryBlock || !mechanicalBlock) throw new Error('Main Block, Library Block and Mechanical Block must all be on the map');

// A building's "front door" anchor, bbox-based: the middle of its southmost (largest-v) side, one
// wall past the roof edge. Only used to place Gate 2 before any tiles are drawn; the walkway
// network (section 12) instead uses each building's real drawn door cell (section 9), which can
// differ slightly when a real neighbour blocks the bbox-predicted side (see drawBuilding).
function approxDoorAnchor(b) {
  const box = buildingBBox(b);
  return [(box.u0 + box.u1) / 2, box.v1 + b.wallTiles * MPT];
}
const approxMainDoor = approxDoorAnchor(mainBlock);

const gate2U = approxMainDoor[0];
const gate2V = fenceFrame.v1; // south edge
const gate2 = { u: gate2U, v: gate2V };

const sideGateV = clusterPoint(westHostels)[1];
const sideGate = { u: fenceFrame.u0, v: sideGateV };

// ================= 7. work out the map's bounding box =================

const ringBox = {
  u0: RING_CENTER[0] - layout.diacRing.radius,
  v0: RING_CENTER[1] - layout.diacRing.radius,
  u1: RING_CENTER[0] + layout.diacRing.radius,
  v1: RING_CENTER[1] + layout.diacRing.radius,
};
const outerApproachV1 = fenceFrame.v1 + layout.gate2.outerApproachMeters;

// D54 runs the full length of Academic City Road, far past the map on both ends; only the stretch
// near the campus (within its u-range, a bit either side) belongs in the map's bounds -- the old
// C1 generator (ADR 0007) did the same with an explicit boundsExtend, which this restores.
let d54Box = null;
for (const w of ways) {
  if (w.tags.ref !== 'D54' && !/Zayed bin Hamdan/.test(w.tags.name || '')) continue;
  for (const [u, v] of w.points) {
    if (u < fenceFrame.u0 - 150 || u > fenceFrame.u1 + 150) continue;
    if (!d54Box) d54Box = { u0: u, v0: v, u1: u, v1: v };
    d54Box.u0 = Math.min(d54Box.u0, u);
    d54Box.v0 = Math.min(d54Box.v0, v);
    d54Box.u1 = Math.max(d54Box.u1, u);
    d54Box.v1 = Math.max(d54Box.v1, v);
  }
}
if (!d54Box) console.warn('D54 (Academic City Road) was not found near the campus in the OSM extract');

const margin = layout.boundsMarginMeters;
const allBoxes = [fenceFrame, ringBox, { u0: gate2U, v0: fenceFrame.v1, u1: gate2U, v1: outerApproachV1 }, ...(d54Box ? [d54Box] : [])];
const minU = Math.floor((Math.min(...allBoxes.map((b) => b.u0)) - margin) / MPT) * MPT;
const minV = Math.floor((Math.min(...allBoxes.map((b) => b.v0)) - margin) / MPT) * MPT;
const maxU = Math.ceil((Math.max(...allBoxes.map((b) => b.u1)) + margin) / MPT) * MPT;
const maxV = Math.ceil((Math.max(...allBoxes.map((b) => b.v1)) + margin) / MPT) * MPT;
const W = Math.round((maxU - minU) / MPT);
const H = Math.round((maxV - minV) / MPT);
if (W > 600 || H > 600) throw new Error(`campus map is ${W}x${H} tiles, over the 600-tile limit`);

const gx = (u) => Math.round((u - minU) / MPT);
const gy = (v) => Math.round((v - minV) / MPT);
const inGrid = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

const ground = new Int32Array(W * H).fill(TILE.sand);
const structures = new Int32Array(W * H).fill(-1);
const overhead = new Int32Array(W * H).fill(-1);
const roofOwner = new Int32Array(W * H).fill(-1);

function forRectFrame(u0, v0, u1, v1, fn) {
  const x0 = Math.max(0, gx(Math.min(u0, u1)));
  const y0 = Math.max(0, gy(Math.min(v0, v1)));
  const x1 = Math.min(W - 1, gx(Math.max(u0, u1)));
  const y1 = Math.min(H - 1, gy(Math.max(v0, v1)));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y);
}
function fillPolygonFrame(poly, fn) {
  const box = bbox(poly);
  forRectFrame(box.u0, box.v0, box.u1, box.v1, (x, y) => {
    const u = minU + (x + 0.5) * MPT;
    const v = minV + (y + 0.5) * MPT;
    if (pointInPolygon(u, v, poly)) fn(x, y);
  });
}
// A building's actual drawn footprint: the union of its simplified rectangles if it has any
// (BITS buildings, decomposeIntoRects), otherwise its cleaned polygon ("other" buildings).
function footprintCells(b, fn) {
  if (!b.rects) return fillPolygonFrame(b.poly, fn);
  const seen = new Set();
  for (const r of b.rects) {
    forRectFrame(r.u0, r.v0, r.u1 - 0.001, r.v1 - 0.001, (x, y) => {
      const key = y * W + x;
      if (seen.has(key)) return;
      seen.add(key);
      fn(x, y);
    });
  }
}
const isLawn = (x, y) => inGrid(x, y) && (ground[y * W + x] === TILE.lawn || ground[y * W + x] === TILE.lawn2) && structures[y * W + x] === -1;
function structOnLawn(x, y, tile) {
  if (isLawn(x, y)) structures[y * W + x] = tile;
}
const frameOfCell = (x, y) => [minU + (x + 0.5) * MPT, minV + (y + 0.5) * MPT];
console.log(`campus frame: fence ${((fenceFrame.u1 - fenceFrame.u0)).toFixed(0)}x${(fenceFrame.v1 - fenceFrame.v0).toFixed(0)} m; map ${W}x${H} tiles`);

// ================= 8. ground fill: lawn inside the fence + DIAC ring, sand (desert) elsewhere =================

function lawnPatch(x, y) {
  return (Math.floor(x / 6) + Math.floor(y / 6)) % 2 === 0 ? TILE.lawn : TILE.lawn2;
}
forRectFrame(fenceFrame.u0, fenceFrame.v0, fenceFrame.u1, fenceFrame.v1, (x, y) => (ground[y * W + x] = lawnPatch(x, y)));
{
  const [cu, cv] = RING_CENTER;
  const r = layout.diacRing.radius;
  forRectFrame(cu - r, cv - r, cu + r, cv + r, (x, y) => {
    const u = minU + (x + 0.5) * MPT;
    const v = minV + (y + 0.5) * MPT;
    if (Math.hypot(u - cu, v - cv) < r - 6) ground[y * W + x] = lawnPatch(x, y);
  });
}

// ================= 9. buildings: parapet roof, wall(s), small windows, entrance where marked =================

for (const b of buildingList) footprintCells(b, (x, y) => (roofOwner[y * W + x] = buildingList.indexOf(b)));

function drawBuilding(b, index) {
  const bits = b.style === 'bits';
  const roofFlat = bits ? TILE.bitsRoof : TILE.otherRoof;
  const roofT = bits ? TILE.bitsRoofT : TILE.otherRoofT;
  const roofL = bits ? TILE.bitsRoofL : TILE.otherRoofL;
  const roofR = bits ? TILE.bitsRoofR : TILE.otherRoofR;
  const roofTL = bits ? TILE.bitsRoofTL : TILE.otherRoofTL;
  const roofTR = bits ? TILE.bitsRoofTR : TILE.otherRoofTR;
  const wallPlain = bits ? TILE.bitsWallPlain : TILE.otherWallPlain;
  const wallWindow = bits ? TILE.bitsWall : TILE.otherWall;
  const wallEndL = bits ? TILE.bitsWallEndL : TILE.otherWallEndL;
  const wallEndR = bits ? TILE.bitsWallEndR : TILE.otherWallEndR;

  const cells = [];
  footprintCells(b, (x, y) => cells.push([x, y]));
  const inBuilding = (x, y) => inGrid(x, y) && roofOwner[y * W + x] === index;

  for (const [x, y] of cells) {
    const topEdge = !inBuilding(x, y - 1);
    const leftEdge = !inBuilding(x - 1, y);
    const rightEdge = !inBuilding(x + 1, y);
    let tile = roofFlat;
    if (topEdge && leftEdge) tile = roofTL;
    else if (topEdge && rightEdge) tile = roofTR;
    else if (topEdge) tile = roofT;
    else if (leftEdge) tile = roofL;
    else if (rightEdge) tile = roofR;
    structures[y * W + x] = tile;
  }

  // Wall runs: group the columns whose south neighbour is open (the building's local bottom edge)
  // into contiguous horizontal runs, so an L-shaped footprint gets a wall along each of its edges.
  const wallStarts = cells.filter(([x, y]) => !inBuilding(x, y + 1)).sort((a, b2) => a[1] - b2[1] || a[0] - b2[0]);
  const byRow = new Map();
  for (const [x, y] of wallStarts) {
    if (!byRow.has(y)) byRow.set(y, []);
    byRow.get(y).push(x);
  }
  const runs = [];
  for (const [y, xs] of byRow) {
    xs.sort((a, b2) => a - b2);
    let runStart = xs[0];
    let prev = xs[0];
    for (let i = 1; i <= xs.length; i++) {
      if (i === xs.length || xs[i] !== prev + 1) {
        runs.push({ y, x0: runStart, x1: prev });
        if (i < xs.length) runStart = xs[i];
      }
      if (i < xs.length) prev = xs[i];
    }
  }
  // The front (door) run: the one facing the entrance approach (largest y = furthest south), widest
  // first, but only among runs whose wall area isn't blocked by a real neighbouring building close
  // enough that the two footprints' walls would otherwise collide (real BITS buildings are
  // sometimes only a few metres apart, e.g. Mechanical Block and Hostel H).
  const isRunOpen = (run) => {
    for (let k = 1; k <= b.wallTiles; k++) {
      const wy = run.y + k;
      for (let x = run.x0; x <= run.x1; x++) {
        if (!inGrid(x, wy) || roofOwner[wy * W + x] !== -1) return false;
      }
    }
    return true;
  };
  const doorCandidates = runs.filter((r) => r.x1 > r.x0 && isRunOpen(r));
  const frontRun = (doorCandidates.length ? doorCandidates : runs).sort((a, b2) => b2.y - a.y || b2.x1 - b2.x0 - (a.x1 - a.x0))[0];

  for (const run of runs) {
    const doorX0 = Math.round((run.x0 + run.x1) / 2);
    const doorX1 = doorX0 + 1;
    const isFront = bits && b.door && run === frontRun && run.x1 > run.x0;
    for (let k = 1; k <= b.wallTiles; k++) {
      const wy = run.y + k;
      if (!inGrid(run.x0, wy)) break;
      const isBottomRow = k === b.wallTiles;
      for (let x = run.x0; x <= run.x1; x++) {
        if (!inGrid(x, wy) || roofOwner[wy * W + x] !== -1) continue;
        let tile;
        if (x === run.x0) tile = wallEndL;
        else if (x === run.x1) tile = wallEndR;
        else tile = (x - run.x0) % 4 === 2 ? wallWindow : wallPlain;
        if (isFront && isBottomRow && (x === doorX0 || x === doorX1)) tile = x === doorX0 ? TILE.bitsEntranceL : TILE.bitsEntranceR;
        structures[wy * W + x] = tile;
      }
    }
    if (isFront) {
      const doorY = run.y + b.wallTiles;
      structOnLawn(doorX0 - 2, doorY, TILE.bitsPillar);
      structOnLawn(doorX1 + 2, doorY, TILE.bitsPillar);
      structOnLawn(doorX0 - 1, doorY + 1, TILE.signboard);
      b.doorCell = [doorX0, doorY];
    }
  }
}
buildingList.forEach(drawBuilding);

// Real door positions (falls back to the bbox estimate for buildings without a drawn door, e.g.
// hostels), used to route the walkway network in section 12 so the last few metres always connect.
const realAnchor = (b) => (b.doorCell ? frameOfCell(b.doorCell[0], b.doorCell[1]) : approxDoorAnchor(b));
const mainDoor = realAnchor(mainBlock);
const libraryDoor = realAnchor(libraryBlock);
const mechDoor = realAnchor(mechanicalBlock);

// ================= 10. roads outside the fence: real OpenStreetMap routes, constant width =================
// Inside the fence, OpenStreetMap footways/service roads are dropped entirely (FB-0007): the small
// hand-picked walkway network (section 11) replaces them. Outside, real routes are kept (diagonals
// and curves allowed, ADR 0009) but drawn with a constant width and a rounded brush so edges stay
// clean instead of a ragged one-tile staircase.
function insideFence(u, v) {
  return u > fenceFrame.u0 && u < fenceFrame.u1 && v > fenceFrame.v0 && v < fenceFrame.v1;
}
// Segments are skipped individually (not just whole ways by their centroid): a long OSM road can
// dip inside the fence bbox even when most of it, and its centroid, sit outside.
function strokePolylineFrame(points, widthMeters, fn) {
  const r = widthMeters / 2;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    // Checked per cell, not just at the segment's ends and midpoint: a long, mostly-outside segment
    // can still clip through a corner of the (rectangular) fence without either end or its exact
    // midpoint landing inside it.
    forRectFrame(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, (x, y) => {
      const u = minU + (x + 0.5) * MPT;
      const v = minV + (y + 0.5) * MPT;
      if (insideFence(u, v)) return;
      if (distToSegment(u, v, a, b) <= r) fn(x, y);
    });
  }
}
const PAVED_HIGHWAYS = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway']);
const externalRoadSamples = []; // sampled points, for connecting Gate 2's approach (section 10)
const isD54Way = (w) => w.tags.ref === 'D54' || /Zayed bin Hamdan/.test(w.tags.name || '');
// The DIAC ring/park keeps its real design (ring road + radial paths) but is moved as one rigid
// group, per-point, by ringShift (defined in section 5): translating only the ring's centre and not
// its real OpenStreetMap roads/paths would leave them misaligned with each other, which looks worse
// than the overlap it was meant to fix.
for (const w of ways) {
  if (!w.tags.highway || !layout.roadWidths[w.tags.highway]) continue;
  const width = w.tags.service === 'parking_aisle' ? 5 : layout.roadWidths[w.tags.highway];
  const paved = PAVED_HIGHWAYS.has(w.tags.highway);
  const points = w.points.map(ringShift);
  strokePolylineFrame(points, width, (x, y) => (ground[y * W + x] = paved ? TILE.paving : TILE.asphalt));
  // D54's own points are excluded from the samples used to connect other dead ends to "the network"
  // -- D54 needs its own connector (below), not to be treated as already part of it.
  if (!paved && !isD54Way(w)) for (const p of points) if (!insideFence(...p)) externalRoadSamples.push(p);
}

// ================= 11. Gate 2: booth + straight approach, connected into the outside road network =================

function paveRectFrame(u0, v0, u1, v1, fillName, laneAxis) {
  const x0 = gx(Math.min(u0, u1));
  const y0 = gy(Math.min(v0, v1));
  const x1 = gx(Math.max(u0, u1));
  const y1 = gy(Math.max(v0, v1));
  const midX = Math.round((x0 + x1) / 2);
  const midY = Math.round((y0 + y1) / 2);
  const kerbSide = (x, y) => {
    const top = y === y0;
    const bottom = y === y1;
    const left = x === x0;
    const right = x === x1;
    if (top && left) return 'kerbTL';
    if (top && right) return 'kerbTR';
    if (bottom && left) return 'kerbBL';
    if (bottom && right) return 'kerbBR';
    if (top) return 'kerbT';
    if (bottom) return 'kerbB';
    if (left) return 'kerbL';
    if (right) return 'kerbR';
    return null;
  };
  forRectFrame(u0, v0, u1, v1, (x, y) => {
    const side = kerbSide(x, y);
    if (side) {
      structures[y * W + x] = -1;
      ground[y * W + x] = TILE[side];
      return;
    }
    let tile = TILE[fillName];
    if (laneAxis === 'v' && x === midX && (y - y0) % 4 < 2) tile = TILE.roadLineV;
    if (laneAxis === 'h' && y === midY && (x - x0) % 4 < 2) tile = TILE.roadLineH;
    ground[y * W + x] = tile;
  });
}
// A plain fill with no kerb border, for pedestrian walkways (their own tile art carries a border,
// STYLE_GUIDE "Campus kit") and for short road spurs that merge into an existing kerbed road --
// giving a merging spur its own kerb ring would cut a seam right where two roads are meant to join.
function fillRectFrame(u0, v0, u1, v1, tileName, skipInsideFence) {
  forRectFrame(u0, v0, u1, v1, (x, y) => {
    const u = minU + (x + 0.5) * MPT;
    const v = minV + (y + 0.5) * MPT;
    if (skipInsideFence && insideFence(u, v)) return;
    structures[y * W + x] = -1;
    ground[y * W + x] = TILE[tileName];
  });
}
// Two axis-aligned segments joining (u0,v0) to (u1,v1) with a right-angle bend, so any two points
// connect with an orthogonal path regardless of their real relative position (ADR 0009: no diagonal
// walkways/roads). `bend` picks which segment goes first. `avoidFence`: for connectors meant to stay
// entirely outside the campus fence (e.g. linking Gate 2's or D54's dead end into the wider road
// network) -- skips any cell that would otherwise land inside the fence, so a segment routed close
// along one side of it can never clip through a solid fence wall that isn't a gate.
function connectRect(p0, p1, widthMeters, tileName, bend = 'h', avoidFence = false) {
  const corner = bend === 'h' ? [p1[0], p0[1]] : [p0[0], p1[1]];
  const r = widthMeters / 2;
  fillRectFrame(p0[0] - r, p0[1] - r, corner[0] + r, corner[1] + r, tileName, avoidFence);
  fillRectFrame(corner[0] - r, corner[1] - r, p1[0] + r, p1[1] + r, tileName, avoidFence);
}
function connectWalkway(p0, p1, bend = 'h') {
  connectRect(p0, p1, layout.walkwayWidthMeters, 'walkway', bend);
}

const AVENUE_W = layout.gate2.approachWidthMeters;
// Outside the fence: a straight approach road south from the gate.
paveRectFrame(gate2U - AVENUE_W / 2, fenceFrame.v1, gate2U + AVENUE_W / 2, outerApproachV1, 'asphalt', 'v');
// Connect that dead end into the real external road network (no dead ends, ADR 0009 step 3): the
// nearest sampled point on any drawn external road.
let gate2NetworkPoint = null;
{
  let best = null;
  const end = [gate2U, outerApproachV1];
  for (const p of externalRoadSamples) {
    const d = Math.hypot(p[0] - end[0], p[1] - end[1]);
    if (!best || d < best.d) best = { d, p };
  }
  // bend 'h' always: the horizontal leg stays at `end`'s v (already south of the whole fence, safe
  // for any u), then the vertical leg approaches at the sample's own u. Picking the bend by which
  // delta is larger (the more "direct" choice) can send the horizontal leg through the fence's own
  // v-range instead, clipping a solid fence wall where it isn't a gate.
  if (best) {
    connectRect(end, best.p, AVENUE_W * 0.6, 'asphalt', 'h', true);
    gate2NetworkPoint = best.p;
  }
}
// D54 itself, near the campus, has no real connecting road in this OpenStreetMap extract (its
// nearest interchange is well outside the extracted area) -- without one it would sit on the map
// disconnected from everything else, which is worse than the straight, unlabelled service road this
// draws down to the same real local road Gate 2's own approach connects to just above: the nearest
// sample overall is often some other short, unrelated road near D54 itself (real streets are dense),
// not necessarily anything that leads back to the campus/roundabout network.
if (d54Box && gate2NetworkPoint) {
  // West of the fence, not above it: a connector at gate2U would run its whole length straight over
  // the fenced campus (gate2U sits within the fence's u-range).
  const d54Anchor = [fenceFrame.u0 - 40, (d54Box.v0 + d54Box.v1) / 2];
  connectRect(d54Anchor, gate2NetworkPoint, 9, 'asphalt', 'h', true);
}
// Inside the fence: the straight entrance avenue up to the Main Block door (kerbed like a road, per
// ADR 0008's "straight approach", straight because gate2U === mainDoor's u by construction).
paveRectFrame(gate2U - AVENUE_W / 2, mainDoor[1], gate2U + AVENUE_W / 2, fenceFrame.v1, 'asphalt', 'v');

// ================= 12. internal walkway network: a small set of constant-width orthogonal paths =================
// Connects Gate 2 -> Main Block, the three academic blocks to each other, the hostel rows, parking,
// the track and the courts (ADR 0009 step 2). Every connector is axis-aligned by construction.

connectWalkway(mainDoor, libraryDoor);
connectWalkway(mainDoor, mechDoor);
if (westHostels.length) connectWalkway(libraryDoor, clusterPoint(westHostels));
if (eastHostels.length) connectWalkway(mechDoor, clusterPoint(eastHostels));
for (const h of westHostels) connectWalkway(approxDoorAnchor(h), clusterPoint(westHostels));
for (const h of eastHostels) connectWalkway(approxDoorAnchor(h), clusterPoint(eastHostels));

const REFERENCE_NODES = [mainDoor, libraryDoor, mechDoor, gate2 && [gate2.u, gate2.v]].concat(
  westHostels.length ? [clusterPoint(westHostels)] : [],
  eastHostels.length ? [clusterPoint(eastHostels)] : [],
);
function nearestReference(point) {
  let best = null;
  for (const node of REFERENCE_NODES) {
    const d = Math.hypot(node[0] - point[0], node[1] - point[1]);
    if (!best || d < best.d) best = { d, node };
  }
  return best.node;
}
connectWalkway([sideGate.u + layout.walkwayWidthMeters, sideGate.v], nearestReference([sideGate.u, sideGate.v]));

const trackFeature = layout.manual.track;
const trackAnchor = [trackFeature.center[0], trackFeature.center[1] - trackFeature.width / 2];
connectWalkway(trackAnchor, nearestReference(trackAnchor));

const tennisFeature = layout.manual.tennis;
const tennisAnchor = [tennisFeature.rect[0] + tennisFeature.rect[2] / 2, tennisFeature.rect[1]];
connectWalkway(tennisAnchor, nearestReference(tennisAnchor));

const otherCourtsFeature = layout.manual.otherCourts;
const courtsAnchor = [otherCourtsFeature.rect[0] + otherCourtsFeature.rect[2] / 2, otherCourtsFeature.rect[1]];
connectWalkway(courtsAnchor, nearestReference(courtsAnchor));

const parkingFeature = layout.manual.parking;
// The connector leaves from the south edge of the parking rectangle (clear of the athletics track,
// which sits just north of it) so the spur to the avenue never gets painted over by the track/turf
// drawn afterwards (section 13).
const parkingAnchor = [parkingFeature.rect[0] + parkingFeature.rect[2] / 2, parkingFeature.rect[1] + parkingFeature.rect[3]];
// "Parking connects to a road": a direct asphalt spur to the entrance avenue itself (not just a
// pedestrian walkway node), clamped to the avenue's actual drawn extent so it lands on real asphalt.
// bend 'v' (vertical leg first, at parking's own column) keeps the long run of the spur off to one
// side, rather than running the full width of the campus immediately alongside the avenue itself.
{
  const avenueV = Math.max(mainDoor[1], Math.min(fenceFrame.v1, parkingAnchor[1]));
  connectRect(parkingAnchor, [gate2U, avenueV], 5, 'asphalt', 'v');
}

// A crossing where the entrance avenue meets the Main-Block/Library walkway.
paveRectFrame(gate2U - AVENUE_W / 2 + 1, mainDoor[1] - layout.walkwayWidthMeters / 2, gate2U + AVENUE_W / 2 - 1, mainDoor[1] + layout.walkwayWidthMeters / 2, 'asphalt');

// ================= 13. parking / courts / track =================

paveRectFrame(parkingFeature.rect[0], parkingFeature.rect[1], parkingFeature.rect[0] + parkingFeature.rect[2], parkingFeature.rect[1] + parkingFeature.rect[3], 'parking');

function otherCourt(x0, y0, x1, y1) {
  forRectFrame(x0, y0, x1, y1, (x, y) => (ground[y * W + x] = TILE.court));
}
{
  const r = otherCourtsFeature.rect;
  const gap = 4;
  const halfW = (r[2] - gap) / 2;
  otherCourt(r[0], r[1], r[0] + halfW, r[1] + r[3]);
  otherCourt(r[0] + halfW + gap, r[1], r[0] + r[2], r[1] + r[3]);
}

{
  const { center, length, width, laneWidth } = trackFeature;
  const r = width / 2;
  const a = [center[0] - length / 2 + r, center[1]];
  const b = [center[0] + length / 2 - r, center[1]];
  forRectFrame(center[0] - length / 2, center[1] - r, center[0] + length / 2, center[1] + r, (x, y) => {
    const u = minU + (x + 0.5) * MPT;
    const v = minV + (y + 0.5) * MPT;
    const d = distToSegment(u, v, a, b);
    if (d <= r - laneWidth) ground[y * W + x] = TILE.turf;
    else if (d <= r) ground[y * W + x] = TILE.track;
  });
}

// Tennis courts: the standard 18x9 kit (STYLE_GUIDE "Campus kit"); the real measured area (35.6 x
// 35.5 m) holds two courts stacked. A thin net (FB-0020) plus a green apron + hedge surround instead
// of bare sand around the court (owner note on FB-0020's screenshot).
function tennisCourt(x0, y0) {
  const at = (dx, dy, name, onlyIfEmpty) => {
    const gx0 = gx(x0) + dx;
    const gy0 = gy(y0) + dy;
    if (!inGrid(gx0, gy0)) return;
    if (onlyIfEmpty && ground[gy0 * W + gx0] !== TILE.sand && ground[gy0 * W + gx0] !== TILE.lawn && ground[gy0 * W + gx0] !== TILE.lawn2) return;
    ground[gy0 * W + gx0] = TILE[name];
  };
  for (let dx = 3; dx <= 14; dx++) {
    at(dx, 1, 'courtLineH');
    at(dx, 7, 'courtLineH');
  }
  for (let dy = 2; dy <= 6; dy++) {
    at(2, dy, 'courtLineV');
    at(15, dy, 'courtLineV');
    at(5, dy, 'courtLineV');
    at(12, dy, 'courtLineV');
  }
  at(8, 2, 'courtNetPostT');
  at(8, 3, 'courtNet');
  at(8, 4, 'courtNet');
  at(8, 5, 'courtNet');
  at(8, 6, 'courtNetPostB');
  at(6, 4, 'courtLineH');
  at(7, 4, 'courtLineH');
  at(10, 4, 'courtLineH');
  at(11, 4, 'courtLineH');
  at(2, 1, 'courtCornerTL');
  at(15, 1, 'courtCornerTR');
  at(2, 7, 'courtCornerBL');
  at(15, 7, 'courtCornerBR');
  at(2, 4, 'courtCenterMark');
  at(15, 4, 'courtCenterMark');
  for (let dx = 3; dx <= 14; dx++) for (let dy = 2; dy <= 6; dy++) at(dx, dy, 'court', true);
  // hedge surround, one tile outside the 18x9 court box (only where it's still open lawn)
  for (let dx = -1; dx <= 18; dx++) {
    structOnLawn(gx(x0) + dx, gy(y0) - 1, TILE.hedge);
    structOnLawn(gx(x0) + dx, gy(y0) + 9, TILE.hedge);
  }
  for (let dy = -1; dy <= 9; dy++) {
    structOnLawn(gx(x0) - 1, gy(y0) + dy, TILE.hedge);
    structOnLawn(gx(x0) + 18, gy(y0) + dy, TILE.hedge);
  }
}
{
  const r = tennisFeature.rect;
  tennisCourt(r[0], r[1]);
  tennisCourt(r[0], r[1] + 18);
}

// ================= 14. campus fence: a closed straight loop, broken only by the two gates =================

function inSpan(v, a, b) {
  return v >= Math.min(a, b) && v <= Math.max(a, b);
}
{
  const x0 = gx(fenceFrame.u0);
  const y0 = gy(fenceFrame.v0);
  const x1 = gx(fenceFrame.u1);
  const y1 = gy(fenceFrame.v1);
  const gateX0 = gx(gate2U - AVENUE_W / 2);
  const gateX1 = gx(gate2U + AVENUE_W / 2);
  const sideY0 = gy(sideGateV - layout.sideGate.spanMeters / 2);
  const sideY1 = gy(sideGateV + layout.sideGate.spanMeters / 2);
  for (let x = x0; x <= x1; x++) {
    const gate = inSpan(x, gateX0, gateX1);
    structures[y0 * W + x] = x === x0 ? TILE.fenceCornerTL : x === x1 ? TILE.fenceCornerTR : TILE.fenceH;
    structures[y1 * W + x] = x === x0 ? TILE.fenceCornerBL : x === x1 ? TILE.fenceCornerBR : gate ? TILE.fenceGate : TILE.fenceH;
  }
  for (let y = y0 + 1; y < y1; y++) {
    const gate = inSpan(y, sideY0, sideY1);
    structures[y * W + x0] = gate ? TILE.fenceGate : TILE.fenceV;
    structures[y * W + x1] = TILE.fenceV;
  }
  // Clear the ground under the fence line so sand/lawn seams don't show through the fence sprite --
  // except at the two gate spans, where the road/walkway must carry on through unbroken (a lawn
  // strip there would cut the avenue's asphalt in two right at the one tile that matters most).
  for (let x = x0; x <= x1; x++) {
    if (!inSpan(x, gateX0, gateX1)) ground[y0 * W + x] = TILE.lawn;
    if (!inSpan(x, gateX0, gateX1)) ground[y1 * W + x] = TILE.lawn;
  }
  for (let y = y0; y <= y1; y++) {
    if (!inSpan(y, sideY0, sideY1)) ground[y * W + x0] = TILE.lawn;
    ground[y * W + x1] = TILE.lawn;
  }
}

// ================= 15. green: hedges near the gates/Main Block, then trees and palms =================

structOnLawn(gx(gate2U - AVENUE_W / 2 - 3), gy(fenceFrame.v1 - 2), TILE.flowerbed);
structOnLawn(gx(gate2U + AVENUE_W / 2 + 3), gy(fenceFrame.v1 - 2), TILE.flowerbed);

function plantTree(cx, topY, kind) {
  const cells = [
    [cx, topY], [cx + 1, topY], [cx, topY + 1], [cx + 1, topY + 1],
    [cx, topY + 2],
  ];
  if (!cells.every(([x, y]) => isLawn(x, y))) return false;
  const canopy = kind === 'palm'
    ? ['palmCanopyTL', 'palmCanopyTR', 'palmCanopyBL', 'palmCanopyBR']
    : ['treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR'];
  overhead[topY * W + cx] = TILE[canopy[0]];
  overhead[topY * W + cx + 1] = TILE[canopy[1]];
  overhead[(topY + 1) * W + cx] = TILE[canopy[2]];
  overhead[(topY + 1) * W + cx + 1] = TILE[canopy[3]];
  structures[(topY + 2) * W + cx] = TILE[kind === 'palm' ? 'palmTrunk' : 'treeTrunk'];
  return true;
}

// Date palms lining the entrance avenue.
for (let y = gy(mainDoor[1]); y <= gy(fenceFrame.v1) - 3; y += 5) {
  plantTree(gx(gate2U - AVENUE_W / 2) - 3, y, 'palm');
  plantTree(gx(gate2U + AVENUE_W / 2) + 1, y, 'palm');
}

// Shade trees scattered across the lawn: a deterministic hash so the map is reproducible, jittered
// (not a visible grid, FB-0015): each cell of a coarse grid gets a tree at a randomised offset
// within it, instead of every tree sitting on the same grid line.
function hash(x, y) {
  let h = (x * 73856093) ^ (y * 19349663) ^ 20260916;
  h = Math.imul(h ^ (h >>> 16), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return (h ^ (h >>> 16)) >>> 0;
}
let treeCount = 0;
function scatterTrees(x0, y0, x1, y1) {
  const STEP = 8;
  for (let gy0 = y0; gy0 < y1; gy0 += STEP) {
    for (let gx0 = x0; gx0 < x1; gx0 += STEP) {
      const h = hash(gx0, gy0);
      if (h % 3 !== 0) continue;
      const jx = gx0 + (h >> 2) % (STEP - 2);
      const jy = gy0 + (h >> 5) % (STEP - 2);
      const kind = (h >> 8) % 5 === 0 ? 'palm' : 'tree';
      if (plantTree(jx, jy, kind)) treeCount++;
    }
  }
}
scatterTrees(gx(fenceFrame.u0) + 3, gy(fenceFrame.v0) + 3, gx(fenceFrame.u1) - 3, gy(fenceFrame.v1) - 3);
{
  const [cu, cv] = RING_CENTER;
  const r = layout.diacRing.radius;
  scatterTrees(gx(cu - r) + 3, gy(cv - r) + 3, gx(cu + r) - 3, gy(cv + r) - 3);
}

// ================= 16. DIAC Park: real paths only =================
// C1.5 drew a straight hand-made cross through the ring here; the real DIAC Park paths (curved,
// radial) already come from OpenStreetMap in section 10 (they're outside the campus fence, so real
// routes are kept), and the invented cross just overdrew them (owner review). Nothing to do here.

// A neighbouring ("other") building can still end up sitting on a real road/path: it's drawn before
// the roads that pass near it (section 9 runs before 10-13), and the DIAC ring's real roads/paths
// are moved a little to clear the fence (RING_SHIFT) while the neighbouring buildings near them are
// moved by the same smooth falloff, which isn't pixel-exact. These buildings aren't enterable or
// named landmarks, so where the two still overlap, the roa/path wins and the building tile is
// cleared rather than leaving a solid tile blocking a road.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const s = structures[y * W + x];
    if (s === -1) continue;
    const sName = tileInfo.tiles[s].name;
    if (!sName.startsWith('other')) continue;
    const gName = tileInfo.tiles[ground[y * W + x]].name;
    if (gName === 'asphalt' || gName === 'paving' || gName === 'walkway' || gName.startsWith('kerb') || gName.startsWith('roadLine') || gName.startsWith('crossing')) {
      structures[y * W + x] = -1;
    }
  }
}

// ================= 17. objects: spawn, gates, doors, cutscene, buildings, areas, signboards =================

const objects = [];
let nextObjectId = 1;
const pointObject = (type, name, x, y, properties = []) =>
  objects.push({ id: nextObjectId++, name, type, x: (x + 0.5) * TILE_PX, y: (y + 0.5) * TILE_PX, width: 0, height: 0, rotation: 0, visible: true, point: true, properties });
const rectObjectGrid = (type, name, x0, y0, x1, y1, properties = []) =>
  objects.push({ id: nextObjectId++, name, type, x: x0 * TILE_PX, y: y0 * TILE_PX, width: (x1 - x0 + 1) * TILE_PX, height: (y1 - y0 + 1) * TILE_PX, rotation: 0, visible: true, properties });
const rectObjectFrame = (type, name, u0, v0, u1, v1, properties = []) => rectObjectGrid(type, name, gx(u0), gy(v0), gx(u1), gy(v1), properties);

const walkable = (x, y) => inGrid(x, y) && (structures[y * W + x] !== -1 ? !tileInfo.tiles[structures[y * W + x]].solid : !tileInfo.tiles[ground[y * W + x]].solid);

let [sx, sy] = [gx(gate2U), gy(outerApproachV1) - 6];
if (!walkable(sx, sy)) {
  let found = null;
  for (let r = 1; r < 30 && !found; r++) {
    for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) if (walkable(sx + dx, sy + dy)) found = [sx + dx, sy + dy];
  }
  if (!found) throw new Error('No walkable spawn near Gate 2');
  [sx, sy] = found;
}
pointObject('spawn', 'spawn', sx, sy, [{ name: 'facing', type: 'string', value: 'up' }]);

pointObject('gate', 'Gate 2 (Main Entrance)', gx(gate2U), gy(fenceFrame.v1), [{ name: 'main', type: 'bool', value: true }]);
pointObject('gate', 'Side Gate', gx(fenceFrame.u0), gy(sideGateV), [{ name: 'main', type: 'bool', value: false }]);

// A cutscene trigger a few tiles inside Gate 2, spanning the avenue width (a parallel agent wires
// up the cutscene engine that reads this; the game must not crash before that exists).
rectObjectFrame('cutscene', 'Gate 2 entrance', gate2U - AVENUE_W / 2, fenceFrame.v1 - 3 * MPT, gate2U + AVENUE_W / 2, fenceFrame.v1 - 1 * MPT, [
  { name: 'cutscene', type: 'string', value: 'gate2' },
]);

// Interior door format (docs/INTERIORS_PLAN.md, P3): a point object, type: 'door', named
// "<Building> entrance", with properties `to` (interior map key, from layout.buildings[id].to),
// `toId` (the name of the door/stairs object to land on in that map -- every interior's exterior
// door is named "<Building> Ground Floor entrance", see tools/interiors/plans.js) and `facing`
// (the direction the player faces once they arrive AT THIS object, i.e. when exiting the building
// back onto campus). world.js resolves `to`/`toId` generically for any Tiled door/stairs object;
// an unknown `to` map logs a warning and shows a toast instead of crashing.
for (const b of buildingList.filter((b) => b.doorCell)) {
  pointObject('door', `${b.name} entrance`, b.doorCell[0], b.doorCell[1], [
    { name: 'building', type: 'string', value: b.name },
    { name: 'to', type: 'string', value: b.to },
    { name: 'toId', type: 'string', value: `${b.name} Ground Floor entrance` },
    { name: 'facing', type: 'string', value: 'down' }, // arriving here (exiting the building) faces away from it, into the avenue/plaza
  ]);
}

for (const b of buildingList) {
  const box = buildingBBox(b);
  rectObjectFrame('building', b.name, box.u0, box.v0, box.u1, box.v1 + b.wallTiles * MPT, [
    { name: 'style', type: 'string', value: b.style },
    { name: 'unverified', type: 'bool', value: Boolean(b.unverified) },
  ]);
}

rectObjectFrame('area', layout.manual.centralLawn.name, ...layout.manual.centralLawn.rect.slice(0, 2), layout.manual.centralLawn.rect[0] + layout.manual.centralLawn.rect[2], layout.manual.centralLawn.rect[1] + layout.manual.centralLawn.rect[3], [{ name: 'kind', type: 'string', value: 'lawn' }]);
rectObjectFrame('area', trackFeature.name, trackFeature.center[0] - trackFeature.length / 2, trackFeature.center[1] - trackFeature.width / 2, trackFeature.center[0] + trackFeature.length / 2, trackFeature.center[1] + trackFeature.width / 2, [{ name: 'kind', type: 'string', value: 'track' }]);
rectObjectFrame('area', tennisFeature.name, tennisFeature.rect[0], tennisFeature.rect[1], tennisFeature.rect[0] + 18 * MPT, tennisFeature.rect[1] + 2 * 9 * MPT, [{ name: 'kind', type: 'string', value: 'court' }]);
rectObjectFrame('area', otherCourtsFeature.name, otherCourtsFeature.rect[0], otherCourtsFeature.rect[1], otherCourtsFeature.rect[0] + otherCourtsFeature.rect[2], otherCourtsFeature.rect[1] + otherCourtsFeature.rect[3], [{ name: 'kind', type: 'string', value: 'court' }]);
rectObjectFrame('area', parkingFeature.name, parkingFeature.rect[0], parkingFeature.rect[1], parkingFeature.rect[0] + parkingFeature.rect[2], parkingFeature.rect[1] + parkingFeature.rect[3], [{ name: 'kind', type: 'string', value: 'parking' }]);
rectObjectFrame('area', 'DIAC Park', ringBox.u0, ringBox.v0, ringBox.u1, ringBox.v1, [{ name: 'kind', type: 'string', value: 'park' }]);
rectObjectFrame('area', 'BITS Pilani, Dubai Campus', fenceFrame.u0, fenceFrame.v0, fenceFrame.u1, fenceFrame.v1, [{ name: 'kind', type: 'string', value: 'campus' }]);
for (const h of hostels) {
  const box = buildingBBox(h);
  rectObjectFrame('area', h.name, box.u0, box.v0, box.u1, box.v1, [{ name: 'kind', type: 'string', value: 'hostel' }]);
}
rectObjectFrame('area', 'Gate 2', gate2U - AVENUE_W / 2, fenceFrame.v1 - MPT, gate2U + AVENUE_W / 2, fenceFrame.v1 + MPT, [{ name: 'kind', type: 'string', value: 'gate' }]);
rectObjectFrame('area', 'Side Gate', fenceFrame.u0 - MPT, sideGateV - layout.sideGate.spanMeters / 2, fenceFrame.u0 + MPT, sideGateV + layout.sideGate.spanMeters / 2, [{ name: 'kind', type: 'string', value: 'gate' }]);

// ================= 18. write Tiled JSON =================

const columns = tileInfo.columns;
const tilesetRows = Math.ceil(tileInfo.tiles.length / columns);
const gids = (arr) => Array.from(arr, (t) => (t < 0 ? 0 : t + 1));
const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  infinite: false,
  width: W,
  height: H,
  tilewidth: TILE_PX,
  tileheight: TILE_PX,
  nextlayerid: 5,
  nextobjectid: nextObjectId,
  properties: [
    { name: 'name', type: 'string', value: 'BITS Pilani, Dubai Campus' },
    { name: 'metersPerTile', type: 'float', value: MPT },
    { name: 'generatedBy', type: 'string', value: 'tools/campus/build-campus.js' },
    { name: 'attribution', type: 'string', value: 'Map data (c) OpenStreetMap contributors (ODbL); rebuilt from OSM and straightened per ADR 0009' },
  ],
  tilesets: [
    { firstgid: 1, name: 'tiles', image: '../tiles.png', imagewidth: columns * TILE_PX, imageheight: tilesetRows * TILE_PX, tilewidth: TILE_PX, tileheight: TILE_PX, tilecount: tileInfo.tiles.length, columns, margin: 0, spacing: 0 },
  ],
  layers: [
    { id: 1, name: 'ground', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(ground) },
    { id: 2, name: 'structures', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(structures) },
    { id: 4, name: 'overhead', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: gids(overhead) },
    { id: 3, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects },
  ],
};

fs.mkdirSync(path.dirname(MAP_OUT), { recursive: true });
fs.writeFileSync(MAP_OUT, JSON.stringify(map) + '\n');

// ================= 19. preview PNG (2 px per tile) =================

const SCALE = 2;
const rgba = Buffer.alloc(W * SCALE * H * SCALE * 4);
const colors = tileInfo.tiles.map((t) => [parseInt(t.color.slice(1, 3), 16), parseInt(t.color.slice(3, 5), 16), parseInt(t.color.slice(5, 7), 16)]);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const t = overhead[y * W + x] !== -1 ? overhead[y * W + x] : structures[y * W + x] !== -1 ? structures[y * W + x] : ground[y * W + x];
    const [r, g, b] = colors[t];
    for (let dy = 0; dy < SCALE; dy++) {
      for (let dx = 0; dx < SCALE; dx++) {
        const i = ((y * SCALE + dy) * W * SCALE + x * SCALE + dx) * 4;
        rgba[i] = r;
        rgba[i + 1] = g;
        rgba[i + 2] = b;
        rgba[i + 3] = 255;
      }
    }
  }
}
fs.mkdirSync(path.dirname(PREVIEW_OUT), { recursive: true });
fs.writeFileSync(PREVIEW_OUT, encodePNG(W * SCALE, H * SCALE, rgba));

console.log(`campus: ${W}x${H} tiles (${W * MPT}x${H * MPT} m), ${buildingList.length} buildings, ${treeCount} trees/palms, ${objects.length} objects, spawn at ${sx},${sy}`);
console.log(`wrote ${path.relative(ROOT, MAP_OUT)} and ${path.relative(ROOT, PREVIEW_OUT)}`);
