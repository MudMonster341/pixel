// Defect sweep 2026-10-04 (docs/quality/defect-sweep-2026-10-04.md): D05 (broken tree), D11 (campus
// entrances), D13 (mixed car scales in lots), D14 (palm over the Gate 2 booth). Everything here is read
// from the committed generated data (assets/maps/campus.json, assets/tiles.json, assets/tiles.png).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { decodePNG } = require('../../tools/lib/png-decode');

const ROOT = path.join(__dirname, '..', '..');
const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', 'campus.json'), 'utf8'));
const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
const T = 16;
const W = map.width;
const H = map.height;
const layer = (name) => map.layers.find((l) => l.name === name).data;
const ground = layer('ground');
const structures = layer('structures');
const overhead = layer('overhead');
const nameOf = (gid) => (gid > 0 ? tileInfo.tiles[gid - 1].name : null);
const infoOf = (gid) => (gid > 0 ? tileInfo.tiles[gid - 1] : null);
const struct = (x, y) => nameOf(structures[y * W + x]);
const objects = map.layers.find((l) => l.type === 'objectgroup').objects;

function pixel(name, x, y) {
  const i = tileInfo.tiles.findIndex((t) => t.name === name);
  assert.ok(i !== -1, `no tile ${name}`);
  const px = (i % tileInfo.columns) * T + x;
  const py = Math.floor(i / tileInfo.columns) * T + y;
  const o = (py * png.width + px) * 4;
  return [png.data[o], png.data[o + 1], png.data[o + 2], png.data[o + 3]];
}
const isOrange = ([r, g, b, a]) => a > 0 && r > 200 && g > 90 && g < 150 && b < 100;
const isOutline = ([r, g, b]) => r + g + b < 150;

// ---------- D05 ----------

test('D05: the tree canopy tiles carry only canopy pixels (no orange log/trunk pixels swept in from the atlas)', () => {
  for (const name of ['treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR']) {
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const p = pixel(name, x, y);
        if (p[3] === 0 || isOutline(p)) continue;
        assert.ok(!isOrange(p), `${name} has an orange (log/crate) pixel at ${x},${y}: ${p}`);
        assert.ok(p[1] >= p[0] - 10, `${name} pixel ${x},${y} is not green-dominant: ${p}`);
      }
    }
  }
});

test('D05: the canopy silhouette is closed and symmetric about its own centre (no stray outline ring on one side)', () => {
  // Rebuild the 32x32 silhouette from the four quadrants and check that every opaque row is one
  // contiguous run that starts and ends on an outline pixel (a "second ring" would add a gap).
  const q = { TL: [0, 0], TR: [1, 0], BL: [0, 1], BR: [1, 1] };
  const sil = Array.from({ length: 32 }, () => Array(32).fill(false));
  const outline = Array.from({ length: 32 }, () => Array(32).fill(false));
  for (const [k, [qx, qy]] of Object.entries(q)) {
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const p = pixel(`treeCanopy${k}`, x, y);
        sil[qy * T + y][qx * T + x] = p[3] !== 0;
        outline[qy * T + y][qx * T + x] = p[3] !== 0 && isOutline(p);
      }
    }
  }
  for (let y = 0; y < 32; y++) {
    const xs = sil[y].map((v, x) => (v ? x : -1)).filter((x) => x >= 0);
    if (!xs.length) continue;
    for (let x = xs[0]; x <= xs[xs.length - 1]; x++) assert.ok(sil[y][x], `canopy row ${y} has a gap at column ${x}`);
    assert.ok(outline[y][xs[0]] && outline[y][xs[xs.length - 1]], `canopy row ${y} does not start/end on an outline pixel`);
  }
});

test('D05: the trunk is the pack trunk, runs the whole tile, and meets the canopy skirt directly above it', () => {
  const trunkCols = [];
  for (let x = 0; x < T; x++) if (isOrange(pixel('treeTrunk', x, 8))) trunkCols.push(x);
  assert.ok(trunkCols.length >= 4, 'treeTrunk shows no bark pixels');
  for (let y = 0; y < T; y++) {
    for (const x of trunkCols) assert.ok(isOrange(pixel('treeTrunk', x, y)), `trunk bark is broken at ${x},${y}`);
  }
  // The canopy's bottom pixel row is opaque across every bark column, so trunk and canopy touch.
  for (const x of trunkCols) assert.ok(pixel('treeCanopyBL', x, T - 1)[3] !== 0, `canopy has a gap above the trunk at column ${x}`);
  // And the trunk sits under the canopy's middle: the canopy's widest row is centred on the bark.
  const mid = trunkCols.reduce((a, b) => a + b, 0) / trunkCols.length;
  const widest = [];
  for (let x = 0; x < 2 * T; x++) {
    const p = x < T ? pixel('treeCanopyTL', x, T - 1) : pixel('treeCanopyTR', x - T, T - 1);
    if (p[3] !== 0) widest.push(x);
  }
  const canopyMid = (widest[0] + widest[widest.length - 1]) / 2;
  assert.ok(Math.abs(canopyMid - mid) <= 2, `canopy centre ${canopyMid} is not over the trunk centre ${mid}`);
});

// ---------- D14 ----------

const CANOPY = new Set(['treeCanopyTL', 'treeCanopyTR', 'treeCanopyBL', 'treeCanopyBR', 'palmCanopyTL', 'palmCanopyTR', 'palmCanopyBL', 'palmCanopyBR']);
const GATE_FURNITURE = new Set(['gateSign', 'securityBooth', 'bitsPillar', 'planter', 'flowerbed', 'busShelter', 'busStopSign', 'bollard']);

test('D14: no canopy is drawn over the Gate 2 booth, pillars, plaque, planters or any other gate furniture', () => {
  const bad = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!CANOPY.has(nameOf(overhead[y * W + x]))) continue;
      if (GATE_FURNITURE.has(struct(x, y))) bad.push(`${nameOf(overhead[y * W + x])} over ${struct(x, y)} at ${x},${y}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('D14: the Gate 2 cluster (within 6 tiles of the gate point) has no canopy at all, and the cutscene lane is clear', () => {
  const gate = objects.find((o) => o.type === 'gate' && o.name === 'Gate 2 (Main Entrance)');
  const gx = Math.floor(gate.x / T);
  const gy = Math.floor(gate.y / T);
  for (let y = gy - 4; y <= gy + 1; y++) {
    for (let x = gx - 8; x <= gx + 8; x++) {
      assert.ok(!CANOPY.has(nameOf(overhead[y * W + x])), `canopy at ${x},${y} near Gate 2`);
    }
  }
  // The booth and the BITS plaque are still there.
  const near = (name) => { for (let y = gy - 4; y <= gy + 1; y++) for (let x = gx - 8; x <= gx + 8; x++) if (struct(x, y) === name) return true; return false; };
  assert.ok(near('securityBooth'), 'security booth missing');
  assert.ok(near('gateSign'), 'gate sign missing');
});

// ---------- D13 ----------

test('D13: parked cars use one family (Urban Pack front view, one tile): no side-view Pixel Vehicle Pack cars anywhere', () => {
  const found = new Set();
  for (let i = 0; i < structures.length; i++) {
    const n = nameOf(structures[i]);
    if (n && n.startsWith('car')) found.add(n);
  }
  assert.ok(found.size > 0, 'no cars at all');
  for (const n of found) assert.match(n, /^carFront(Yellow|Red|Green)$/, `${n} is not one of the front-view cars`);
});

test('D13: every car sits in a bay (on a parking cell) and a front-view car fills a whole tile', () => {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = struct(x, y);
      if (!n || !n.startsWith('car')) continue;
      assert.equal(nameOf(ground[y * W + x]), 'parking', `${n} at ${x},${y} is not on a parking cell`);
    }
  }
  for (const n of ['carFrontYellow', 'carFrontRed', 'carFrontGreen']) {
    let minX = T; let maxX = -1;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (pixel(n, x, y)[3] !== 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    assert.ok(maxX - minX + 1 >= 12, `${n} is only ${maxX - minX + 1} px wide: smaller than the player`);
  }
});

// ---------- D11 ----------

const ENTRANCE_L = new Set(['bitsEntranceL', 'bitsEntranceGrandL']);
const ENTRANCE_R = new Set(['bitsEntranceR', 'bitsEntranceGrandR']);
// bitsPorticoGlassBase is the (walkable, as for the Main Block) glass panel flanking a portico door; it is part
// of the facade line, so it counts as wall here. Everything else must be a solid facade/portico/column tile.
const WALLISH = (x, y) => {
  const g = structures[y * W + x];
  if (g <= 0) return false;
  if (nameOf(g) === 'bitsPorticoGlassBase') return true;
  return infoOf(g).solid && /^bitsFacade|^bitsPortico|^bitsEntranceColumn|^bitsWall/.test(nameOf(g));
};

test('D11: every campus entrance is a door set INTO the facade: wall tile above it, walkable plaza below it', () => {
  let doors = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!ENTRANCE_L.has(struct(x, y))) continue;
      doors++;
      assert.ok(ENTRANCE_R.has(struct(x + 1, y)), `entrance at ${x},${y} has no right half`);
      for (const dx of [0, 1]) {
        assert.ok(WALLISH(x + dx, y - 1), `no facade wall above the door at ${x + dx},${y - 1} (${struct(x + dx, y - 1)})`);
        assert.ok(!infoOf(structures[y * W + x + dx]).solid, 'the door tile must stay walkable');
      }
      // wall tiles to the side of the door (not bare paving): the door is in the wall line
      assert.ok(WALLISH(x - 1, y), `no wall beside the door on its left at ${x - 1},${y} (${struct(x - 1, y)})`);
      assert.ok(WALLISH(x + 2, y), `no wall beside the door on its right at ${x + 2},${y} (${struct(x + 2, y)})`);
    }
  }
  assert.ok(doors >= 7, `expected the Main/Library/Mechanical doors and the hostels, found ${doors}`);
});

test('D11: every campus door object is still reachable on foot from the spawn point', () => {
  const walkable = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const s = structures[y * W + x];
    return s > 0 ? !infoOf(s).solid : !infoOf(ground[y * W + x]).solid;
  };
  const spawn = objects.find((o) => o.type === 'spawn');
  const start = [Math.floor(spawn.x / T), Math.floor(spawn.y / T)];
  const seen = new Uint8Array(W * H);
  const queue = [start];
  seen[start[1] * W + start[0]] = 1;
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy;
      if (walkable(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; queue.push([nx, ny]); }
    }
  }
  const doors = objects.filter((o) => o.type === 'door');
  assert.ok(doors.length >= 3);
  for (const d of doors) {
    const x = Math.floor(d.x / T); const y = Math.floor(d.y / T);
    assert.ok(seen[y * W + x], `door "${d.name}" at ${x},${y} is not reachable from the spawn`);
  }
});

test('D11: the door objects keep their names, targets and landing ids', () => {
  const prop = (o, n) => (o.properties.find((p) => p.name === n) || {}).value;
  const want = {
    'Main Block entrance': ['main-block-g', 'Main Block Ground Floor entrance'],
    'Library Block entrance': ['library-block-g', 'Library Block Ground Floor entrance'],
    'Mechanical Block entrance': ['mechanical-block-g', 'Mechanical Block Ground Floor entrance'],
  };
  for (const [name, [to, toId]] of Object.entries(want)) {
    const o = objects.find((d) => d.type === 'door' && d.name === name);
    assert.ok(o, `missing ${name}`);
    assert.equal(prop(o, 'to'), to);
    assert.equal(prop(o, 'toId'), toId);
  }
});
