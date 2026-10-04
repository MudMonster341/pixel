// Package P3b: the Dubai RTA bus stop (FB-0044, FB-0049), the lowered gate barrier (FB-0052) and the new tree set
// (FB-0053 palm, FB-0056 leafy tree). Everything is read from the committed generated data (assets/maps/campus.json,
// assets/tiles.json, assets/tiles.png) and the generators' source, no browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { decodePNG } = require('../../tools/lib/png-decode');
const TreeArt = require('../../tools/lib/tree-art');

const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const tileInfo = JSON.parse(read('assets/tiles.json'));
const map = JSON.parse(read('assets/maps/campus.json'));
const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
const T = 16;
const W = map.width;
const H = map.height;
const layer = (name) => map.layers.find((l) => l.name === name).data;
const [ground, structures, overhead] = ['ground', 'structures', 'overhead'].map(layer);
const objects = map.layers.find((l) => l.type === 'objectgroup').objects;
const names = tileInfo.tiles.map((t) => t.name);
const nameOf = (gid) => (gid > 0 ? names[gid - 1] : null);
const groundAt = (x, y) => nameOf(ground[y * W + x]);
const structAt = (x, y) => nameOf(structures[y * W + x]);
const overheadAt = (x, y) => nameOf(overhead[y * W + x]);
const solidAt = (x, y) => {
  const s = structures[y * W + x];
  return s > 0 ? tileInfo.tiles[s - 1].solid : tileInfo.tiles[ground[y * W + x] - 1].solid;
};
const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !solidAt(x, y);
const gate = objects.find((o) => o.type === 'gate' && /Gate 2/.test(o.name));
const gateX = Math.floor(gate.x / T);
const gateY = Math.floor(gate.y / T);
const spawn = objects.find((o) => o.type === 'spawn');

// BUS_STOP_X / BUS_STOP_Y / BUS_LANE_Y from src/scripts.js (top-level consts, not exported to the shared sandbox helper)
const scriptCtx = vm.createContext({ console });
vm.runInContext(read('src/scripts.js'), scriptCtx, { filename: 'src/scripts.js' });
const [BUS_STOP_X, BUS_STOP_Y, BUS_LANE_Y] = ['BUS_STOP_X', 'BUS_STOP_Y', 'BUS_LANE_Y'].map((n) => vm.runInContext(n, scriptCtx));
const stopTileX = Math.floor(gate.x / T + BUS_STOP_X); // the bus's centre column (and where she steps out)
const FEET = 19 / 16; // the bus sprite's wheel line below its centre, tiles
const bayRow = Math.floor(gate.y / T + BUS_STOP_Y + FEET - 0.1); // the row the bus's wheels sit in, in the bay
const laneRow = Math.floor(gate.y / T + BUS_LANE_Y + FEET - 0.1); // ...and in the road's south lane

function floodFrom(sx, sy) {
  const seen = new Uint8Array(W * H);
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (!walkable(x, y) || seen[y * W + x]) continue;
    seen[y * W + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}
const isKerb = (n) => typeof n === 'string' && n.startsWith('kerb');
const find = (pred, x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1) => {
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (pred(x, y)) out.push([x, y]);
  return out;
};

// ---------- FB-0044 / FB-0049: the RTA bus stop ----------

test('FB-0044: the bus drops her in a bay (a lay-by) that is a tapered notch south of the road, with kerbed pavement behind and beside it', () => {
  assert.equal(groundAt(stopTileX, bayRow), 'asphalt', 'no carriageway under the bus in the bay');
  assert.ok(bayRow > laneRow, 'the bay is south of the south lane');
  // the road's own south edge is a pavement row everywhere EXCEPT the bay: find the bay span on its first row
  const firstBayRow = bayRow - 1;
  let x0 = stopTileX;
  while (groundAt(x0 - 1, firstBayRow) === 'asphalt') x0--;
  let x1 = stopTileX;
  while (groundAt(x1 + 1, firstBayRow) === 'asphalt') x1++;
  assert.ok(x1 - x0 + 1 >= 10 && x1 - x0 + 1 <= 18, `the bay is ${x1 - x0 + 1} tiles long on its road-side row`);
  // its second row is shorter at each end (the tapered mouth) and the bus (6 tiles) fits inside it
  let y0 = stopTileX;
  while (groundAt(y0 - 1, bayRow) === 'asphalt') y0--;
  let y1 = stopTileX;
  while (groundAt(y1 + 1, bayRow) === 'asphalt') y1++;
  assert.ok(y0 > x0 && y1 < x1, 'the bay\'s second row is not shorter than its first (no tapered mouth)');
  assert.ok(y0 <= stopTileX - 3 && y1 >= stopTileX + 3, 'the 6-tile bus does not fit in the bay');
  // pavement either side of the mouth and behind the bay, kerb tiles round its outside edge
  assert.ok(isKerb(groundAt(x0 - 1, firstBayRow)), 'no pavement beside the bay\'s west end');
  assert.ok(isKerb(groundAt(x1 + 1, firstBayRow)), 'no pavement beside the bay\'s east end');
  for (let x = y0; x <= y1; x++) assert.ok(isKerb(groundAt(x, bayRow + 1)), `no pavement behind the bay at ${x},${bayRow + 1}`);
  const deepest = find((x, y) => isKerb(groundAt(x, y)), stopTileX - 10, stopTileX + 10, bayRow + 1, bayRow + 8).reduce((m, [, y]) => Math.max(m, y), 0);
  assert.ok(deepest - bayRow >= 3, 'the pavement behind the bay is less than 3 rows deep');
  assert.ok(find((x, y) => groundAt(x, y) === 'sand', stopTileX - 10, stopTileX + 10, deepest + 1, deepest + 1).length >= 10, 'the pavement does not end in a kerb facing the sand');
});

test('FB-0044: a modern RTA shelter stands on the pavement beside the stop: four solid glass/advert/screen tiles under a four-tile canopy', () => {
  const row = find((x, y) => structAt(x, y) === 'busShelterL', stopTileX - 12, stopTileX + 12, bayRow, bayRow + 8);
  assert.equal(row.length, 1, 'expected exactly one RTA shelter beside the stop');
  const [sx, sy] = row[0];
  ['L', 'G', 'M', 'R'].forEach((w, i) => {
    assert.equal(structAt(sx + i, sy), `busShelter${w}`, `shelter tile ${i} is not busShelter${w}`);
    assert.ok(solidAt(sx + i, sy), `busShelter${w} must be solid`);
    assert.equal(overheadAt(sx + i, sy - 1), `busShelterRoof${w}`, `the canopy over busShelter${w} is missing`);
    assert.equal(tileInfo.tiles[names.indexOf(`busShelterRoof${w}`)].overhead, true);
    assert.ok(!solidAt(sx + i, sy - 1), 'the waiting row under the canopy must stay walkable');
  });
  assert.ok(sx + 3 < stopTileX && stopTileX - sx <= 8, 'the shelter is beside the bus\'s landing column, not on it');
  assert.ok(sy > bayRow, 'the shelter is behind the bay, on the pavement');
  assert.ok(objects.some((o) => o.type === 'depthGroup' && o.name === 'busStopShelter' && o.x === sx * T && o.y === (sy - 1) * T), 'the shelter is not a depth group (she would sort wrongly behind it)');
  // the shelter's art: RTA red fascia on the canopy, an advert lightbox, a route-information screen
  const colours = (name) => {
    const i = names.indexOf(name);
    const set = new Set();
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const o = ((Math.floor(i / 8) * T + y) * png.width + (i % 8) * T + x) * 4;
        if (png.data[o + 3] === 255) set.add(`#${[0, 1, 2].map((c) => png.data[o + c].toString(16).padStart(2, '0')).join('')}`);
      }
    }
    return set;
  };
  assert.ok(colours('busShelterRoofM').has('#d3232a'), 'the canopy fascia is not RTA red');
  assert.ok(colours('busShelterM').has('#9fd3ff'), 'no advert lightbox on the middle panel');
  assert.ok(colours('busShelterR').has('#2f4a7a'), 'no route-information screen on the right panel');
});

test('FB-0044: a tall bus-stop sign pole (red head, bus pictogram), a litter bin and flower boxes stand on the pavement; palms and a tree behind it', () => {
  const poles = find((x, y) => structAt(x, y) === 'busStopPole', stopTileX - 12, stopTileX + 12, bayRow, bayRow + 8);
  assert.equal(poles.length, 1, 'expected one stop sign');
  const [px, py] = poles[0];
  assert.ok(solidAt(px, py), 'the sign pole must be solid');
  assert.equal(overheadAt(px, py - 1), 'busStopPoleTop', 'the sign plate (overhead) is missing above the pole');
  assert.ok(Math.abs(px - stopTileX) <= 5, 'the sign is not by the bus\'s doors');
  assert.ok(find((x, y) => structAt(x, y) === 'streetBin', stopTileX - 12, stopTileX + 12, bayRow, bayRow + 8).length >= 1, 'no litter bin at the stop');
  assert.ok(find((x, y) => structAt(x, y) === 'streetPlanter', stopTileX - 12, stopTileX + 12, bayRow, bayRow + 8).length >= 2, 'no flower boxes at the stop');
  const near = (re) => find((x, y) => re.test(structAt(x, y) || ''), stopTileX - 12, stopTileX + 12, bayRow + 3, bayRow + 14);
  assert.ok(near(/^palm\dTrunk$/).length >= 2, 'no date palms behind the stop');
  assert.ok(near(/^leafy\dTrunk$/).length >= 1, 'no leafy tree behind the stop');
  // her sign is generic (no copied logo): the plate is red, white and dark only
  const head = [];
  const i = names.indexOf('busStopPoleTop');
  for (let y = 1; y <= 9; y++) for (let x = 1; x <= 14; x++) {
    const o = ((Math.floor(i / 8) * T + y) * png.width + (i % 8) * T + x) * 4;
    head.push(`#${[0, 1, 2].map((c) => png.data[o + c].toString(16).padStart(2, '0')).join('')}`);
  }
  assert.ok(head.includes('#d3232a') && head.includes('#e8e8e8'), 'the sign plate is not RTA red and white');
});

test('FB-0044: the bus anchor and her landing tile are walkable, on the pavement, never inside a collider, and a clear path leads to the campus', () => {
  const feetY = gate.y / T + BUS_STOP_Y + FEET;
  const landX = stopTileX;
  const landY = Math.floor(gate.y / T + BUS_STOP_Y + 2.6); // where her walk ends (src/scripts.js)
  assert.ok(isKerb(groundAt(landX, landY)), `her landing tile is ${groundAt(landX, landY)}, not pavement`);
  assert.ok(!structAt(landX, landY), `her landing tile holds ${structAt(landX, landY)}`);
  assert.ok(walkable(landX, landY));
  // pavement beside it (the pavement is one surface), a kerb-free walkable neighbour on at least two sides
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isKerb(groundAt(landX + dx, landY + dy)) && walkable(landX + dx, landY + dy));
  assert.ok(around.length >= 2, 'her landing tile is not on open pavement');
  // the tile where she steps out of the door is the bay's asphalt (below the bus's wheel line), also walkable
  assert.ok(walkable(landX, Math.floor(feetY + 0.2)));
  // and from there she can reach the campus spawn on foot
  const seen = floodFrom(landX, landY);
  assert.ok(seen[Math.floor(spawn.y / T) * W + Math.floor(spawn.x / T)], 'the campus is not reachable on foot from the bus stop');
  // the waiting row in front of the shelter and the pavement beside the bay stay open end to end
  const shelterRow = find((x, y) => structAt(x, y) === 'busShelterL', stopTileX - 12, stopTileX + 12, bayRow, bayRow + 8)[0];
  for (let x = shelterRow[0] - 3; x <= stopTileX + 7; x++) assert.ok(walkable(x, shelterRow[1] - 2), `the walkway between the bay and the shelter/sign is blocked at ${x},${shelterRow[1] - 2}`);
  // under the canopy (the waiting row) it is open from the shelter's west end to her landing column
  for (let x = shelterRow[0]; x <= stopTileX; x++) assert.ok(walkable(x, shelterRow[1] - 1), `the waiting row under the canopy is blocked at ${x},${shelterRow[1] - 1}`);
});

test('FB-0049: the Gate 2 road continues west of the avenue as a kerbed road, and the stop is on it', () => {
  const roadRow = laneRow; // the south lane's row
  // asphalt for at least 20 tiles west of the avenue, and east of it to the plain external road
  let westEnd = gateX;
  while (groundAt(westEnd - 1, roadRow) === 'asphalt' || groundAt(westEnd - 1, roadRow) === 'roadLineH') westEnd--;
  assert.ok(gateX - westEnd >= 20, `the road only continues ${gateX - westEnd} tiles west of the avenue`);
  // pavement with a kerb on both sides of that stretch
  const north = find((x, y) => isKerb(groundAt(x, y)), gateX - 15, gateX - 8, roadRow - 6, roadRow - 4).length;
  const south = find((x, y) => isKerb(groundAt(x, y)), gateX - 15, gateX - 8, roadRow + 1, roadRow + 3).length;
  assert.ok(north >= 6 && south >= 6, 'the west stretch has no pavement on both sides');
  // the stop is on the east part of that road, beside the avenue's mouth
  assert.ok(stopTileX > gateX && stopTileX - gateX <= 8);
  // the bus's whole path: lane asphalt from far west to the bay, so it never drives over pavement or sand
  const moves = vm.runInContext('SCRIPTS.opening', scriptCtx).filter((s) => s.move && s.move.actor === 'bus');
  assert.equal(moves.length, 4);
  const first = vm.runInContext('SCRIPTS.opening', scriptCtx).find((s) => s.spawnActor && s.spawnActor.id === 'bus').spawnActor.at.offset;
  for (let x = Math.floor(gate.x / T + first[0]); x <= stopTileX; x++) {
    assert.ok(/asphalt|roadLine/.test(groundAt(x, laneRow)), `no road under the bus's lane at ${x},${laneRow}: ${groundAt(x, laneRow)}`);
  }
});

// ---------- FB-0052: the gate barrier ----------

test('FB-0052: the lowered barrier arm spans the WHOLE road width, from the pivot housing by the booth to a support post on the far side', () => {
  const row = gateY - 1; // the gate line (build-campus.js gateLineRow)
  const pivots = find((x, y) => structAt(x, y) === 'barrierPivot', gateX - 20, gateX + 20, row, row);
  const rests = find((x, y) => structAt(x, y) === 'barrierRest', gateX - 20, gateX + 20, row, row);
  assert.equal(pivots.length, 1, 'expected one barrier pivot housing');
  assert.equal(rests.length, 1, 'expected one barrier support post');
  const [px] = pivots[0];
  const [rx] = rests[0];
  assert.ok(rx < px, 'the support post is on the far (west) side from the booth');
  for (let x = rx + 1; x < px; x++) assert.equal(structAt(x, row), 'barrierArm', `a gap in the lowered boom at ${x},${row}`);
  // the pivot stands beside the security booth
  assert.ok(find((x, y) => structAt(x, y) === 'securityBooth', px - 2, px + 2, row, row).length === 1, 'the pivot housing is not beside the security booth');
  // every road/pavement cell on the gate line (the avenue's carriageway and both pavements) is covered by the boom
  const road = find((x, y) => /^(asphalt|roadLine|crossing)/.test(groundAt(x, y) || '') || isKerb(groundAt(x, y)), gateX - 12, gateX + 12, row, row);
  assert.ok(road.length >= 7, 'the avenue is not on the gate line?');
  for (const [x] of road) assert.ok(x > rx && x < px, `the avenue at ${x} is outside the boom (${rx}..${px})`);
  assert.ok(px - rx - 1 >= road.length, 'the boom is shorter than the road width');
});

test('FB-0052: the lowered barrier is not solid, so the gate stays passable on foot exactly as before (the story walks through it)', () => {
  for (const name of ['barrierArm', 'barrierPivot', 'barrierRest']) {
    assert.equal(tileInfo.tiles[names.indexOf(name)].solid, false, `${name} must not block her`);
  }
  const row = gateY - 1;
  const seen = floodFrom(Math.floor(spawn.x / T), Math.floor(spawn.y / T));
  for (let x = gateX - 2; x <= gateX + 2; x++) assert.ok(seen[row * W + x], `the gate line tile ${x},${row} is not reachable from spawn on foot`);
  // and she can get from outside the gate (south) to inside (north) through the avenue
  assert.ok(seen[(gateY + 4) * W + gateX], 'outside the gate is not reachable from spawn');
  assert.ok(seen[(gateY - 8) * W + gateX], 'inside the gate is not reachable from spawn');
  // the arm tile art: red and white stripes with a shadow, transparent elsewhere
  const i = names.indexOf('barrierArm');
  const px = (x, y) => { const o = ((Math.floor(i / 8) * T + y) * png.width + (i % 8) * T + x) * 4; return [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]]; };
  assert.equal(px(0, 0)[3], 0, 'the arm tile is not transparent above the boom');
  const reds = [0, 1, 2, 3, 4, 5, 6, 7].filter((x) => px(x, 6)[0] === 0xc0 && px(x, 6)[3] === 255).length;
  const whites = [0, 1, 2, 3, 4, 5, 6, 7].filter((x) => px(x, 6)[0] === 0xff && px(x, 6)[3] === 255).length;
  assert.ok(reds >= 2 && whites >= 2, 'the boom is not striped red and white');
});

// ---------- FB-0053 / FB-0056: the new trees ----------

const PALETTE_HEXES = (() => {
  const src = read('tools/make-assets.js');
  const body = src.slice(src.indexOf('const PALETTE = {'), src.indexOf('\n};', src.indexOf('const PALETTE = {')));
  return new Set([...body.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0].toLowerCase()));
})();
const FAMILIES = ['palm1', 'palm2', 'leafy1', 'leafy2', 'leafy3'];
const tilesOf = (family) => [`${family}Trunk`, ...['TL', 'TR', 'BL', 'BR'].map((q) => `${family}Canopy${q}`)];

test('FB-0053/FB-0056: the old tree and palm tile names are gone from the tile sheet and from the generated map', () => {
  const OLD = ['treeTrunk', 'treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR', 'palmTrunk', 'palmCanopyTL', 'palmCanopyTR', 'palmCanopyBL', 'palmCanopyBR', 'busStopSign', 'busShelter'];
  for (const name of OLD) assert.ok(!names.includes(name), `the old tile "${name}" is still in assets/tiles.json`);
  const used = new Set([...structures, ...overhead, ...ground].filter((g) => g > 0).map((g) => names[g - 1]));
  for (const name of OLD) assert.ok(!used.has(name), `the generated campus still uses the old tile "${name}"`);
  const buildSrc = read('tools/campus/build-campus.js');
  for (const name of OLD) assert.ok(!new RegExp(`['"\`]${name}['"\`]`).test(buildSrc), `tools/campus/build-campus.js still names "${name}"`);
});

test('FB-0053/FB-0056: both tree families exist with their tiles, are used all over the campus with variety, and every trunk has its crown above it', () => {
  for (const family of FAMILIES) {
    for (const name of tilesOf(family)) assert.ok(names.includes(name), `missing tile ${name}`);
    assert.equal(tileInfo.tiles[names.indexOf(`${family}Trunk`)].solid, true, `${family}Trunk must be solid (collision at the trunk only)`);
    for (const q of ['TL', 'TR', 'BL', 'BR']) {
      const t = tileInfo.tiles[names.indexOf(`${family}Canopy${q}`)];
      assert.equal(t.overhead, true);
      assert.equal(t.solid, false, 'the canopy is drawn above her and never blocks');
    }
  }
  const counts = {};
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = structAt(x, y);
      const m = /^(palm\d|leafy\d)Trunk$/.exec(s || '');
      if (!m) continue;
      counts[m[1]] = (counts[m[1]] || 0) + 1;
      assert.equal(overheadAt(x, y - 2), `${m[1]}CanopyTL`, `${s} at ${x},${y} has no crown above it`);
      assert.equal(overheadAt(x + 1, y - 1), `${m[1]}CanopyBR`);
      assert.ok(objects.some((o) => o.type === 'depthGroup' && o.x === x * T && o.y === (y - 2) * T && o.height === 3 * T), `${s} at ${x},${y} is not a depth group`);
    }
  }
  for (const family of ['palm1', 'palm2', 'leafy1', 'leafy2', 'leafy3']) assert.ok(counts[family] >= 1, `${family} is not used anywhere on the map`);
  assert.ok(counts.leafy1 + counts.leafy2 + counts.leafy3 >= 40, 'too few leafy trees');
  assert.ok(counts.leafy1 >= 5 && counts.leafy2 >= 5, 'the two round-tree variants are not both common');
});

test('FB-0053: the date palm has a crown of 7-9 clear fronds, a ringed curved trunk and a few dates; two variants', () => {
  assert.deepEqual(TreeArt.PALM_NAMES, ['palm1', 'palm2']);
  for (const name of TreeArt.PALM_NAMES) {
    assert.ok(TreeArt.PALM_FROND_COUNT[name] >= 7 && TreeArt.PALM_FROND_COUNT[name] <= 9, `${name} has ${TreeArt.PALM_FROND_COUNT[name]} fronds`);
    const rows = TreeArt.buildPalm(name);
    assert.equal(rows.length, 48);
    assert.ok(rows.every((r) => r.length === 32));
    const text = rows.join('');
    assert.ok(text.includes('j') && text.includes('x'), `${name} shows no dates`);
    // ring marks: the trunk's dark ring colour appears on many rows, in the lower 32 rows
    const ringRows = rows.slice(20).filter((r) => /dN{2,}/.test(r) || /N{3,}/.test(r)).length;
    assert.ok(ringRows >= 5, `${name}'s trunk has no ring marks`);
    // curved: the trunk's centre moves sideways down its length
    const centre = (r) => { const xs = [...r].map((k, x) => ('dDNn'.includes(k) ? x : -1)).filter((x) => x >= 0); return xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : null; };
    assert.ok(Math.abs(centre(rows[44]) - centre(rows[24])) >= 1.5, `${name}'s trunk is straight`);
    // the crown is wide: fronds reach at least 24 columns across
    const crownCols = new Set();
    rows.slice(0, 24).forEach((r) => [...r].forEach((k, x) => { if ('GltTe'.includes(k)) crownCols.add(x); }));
    assert.ok(Math.max(...crownCols) - Math.min(...crownCols) >= 24, `${name}'s crown is narrow`);
  }
  assert.ok(TreeArt.buildPalm('palm1').join('') !== TreeArt.buildPalm('palm2').join(''), 'the two palms are identical');
});

test('FB-0056: leafy trees have a brown (not orange) trunk, soft multi-tone shading and a shadow; variants differ', () => {
  const atlas = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'vendor', TreeArt.SPROUT_FILE)));
  const pics = TreeArt.LEAFY_NAMES.map((n) => TreeArt.buildLeafy(n, atlas));
  assert.equal(TreeArt.LEAFY_NAMES.length, 3);
  for (const rows of pics) {
    const text = rows.join('');
    assert.ok(['F', 'f', 'N', 'n'].filter((key) => text.includes(key)).length >= 3, 'a leafy tree has fewer than 3 brown trunk tones');
    const greens = ['l', 'G', 't', 'T', 'e'].filter((k) => text.includes(k)).length;
    assert.ok(greens >= 3, 'a leafy tree has fewer than 3 leaf tones');
    assert.ok(text.includes('S'), 'a leafy tree has no ground shadow');
  }
  assert.equal(new Set(pics.map((p) => p.join(''))).size, 3, 'the leafy variants are not all different');
  // the trunk tiles in the sheet contain no orange (the old tree's orange trunk was the complaint)
  for (const family of ['leafy1', 'leafy2', 'leafy3', 'palm1', 'palm2']) {
    const i = names.indexOf(`${family}Trunk`);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const o = ((Math.floor(i / 8) * T + y) * png.width + (i % 8) * T + x) * 4;
        const [r, g, b, a] = [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]];
        if (a !== 255) continue;
        assert.ok(!(r > 200 && g > 90 && g < 150 && b < 100), `${family}Trunk has an orange pixel at ${x},${y}`);
      }
    }
  }
});

test('FB-0053/FB-0056: the new tree tiles use only palette colours (plus translucent ground shadow)', () => {
  for (const family of FAMILIES) {
    for (const name of tilesOf(family)) {
      const i = names.indexOf(name);
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          const o = ((Math.floor(i / 8) * T + y) * png.width + (i % 8) * T + x) * 4;
          const a = png.data[o + 3];
          if (a === 0) continue;
          const hex = `#${[0, 1, 2].map((c) => png.data[o + c].toString(16).padStart(2, '0')).join('')}`;
          if (a < 255) assert.equal(hex, '#1a1c2c', `${name}: a translucent pixel that is not the shadow colour`);
          else assert.ok(PALETTE_HEXES.has(hex), `${name} pixel ${x},${y} is ${hex}, outside the project palette`);
        }
      }
    }
  }
});

test('FB-0053/FB-0056: the new trees keep clear of paths, doors and the gate furniture (no tree on a walkway, road or pavement)', () => {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!/^(palm|leafy)\dTrunk$/.test(structAt(x, y) || '')) continue;
      for (let yy = y - 3; yy <= y; yy++) for (let xx = x; xx <= x + 1; xx++) {
        const g = groundAt(xx, yy);
        assert.ok(!/^(walkway|asphalt|paving|parking|roadLine|crossing)/.test(g) && !isKerb(g), `a tree at ${x},${y} stands on ${g} at ${xx},${yy}`);
      }
      assert.ok(!['bitsEntranceL', 'bitsEntranceR', 'bitsEntranceGrandL', 'bitsEntranceGrandR', 'securityBooth', 'gateSign'].includes(structAt(x, y - 1)));
    }
  }
});
