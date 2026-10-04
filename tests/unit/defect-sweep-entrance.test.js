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

// ---------- D05 (the broken tree), redone for FB-0053 / FB-0056 ----------
// The old round tree and palm were replaced by a tools/lib/tree-art.js set: date palms palm1/palm2 and leafy trees leafy1-3.

const LEAFY = ['leafy1', 'leafy2', 'leafy3'];
const PALMS = ['palm1', 'palm2'];
// A bark/trunk pixel is brown (red > green > blue, moderate saturation), never the old orange (r > 200, g 90-150) and never green.
const isBark = ([r, g, b, a]) => a > 0 && r > g && g > b && r < 215 && !isOrange([r, g, b, a]);
const isGreen = ([r, g, b, a]) => a > 0 && g >= r && g >= b;

test('D05: the leafy tree canopy tiles carry only leaf pixels (no brown trunk or orange pixels swept in)', () => {
  for (const family of LEAFY) {
    for (const k of ['TL', 'TR', 'BL', 'BR']) {
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          const p = pixel(`${family}Canopy${k}`, x, y);
          if (p[3] === 0 || p[3] < 255) continue; // transparent or a soft shadow
          assert.ok(!isOrange(p), `${family}Canopy${k} has an orange pixel at ${x},${y}: ${p}`);
          // the canopy quadrants may reach down into the first trunk rows (the trunk starts inside BL/BR); only the top row
          // of quadrants must be pure leaf
          if (k === 'TL' || k === 'TR') assert.ok(isGreen(p), `${family}Canopy${k} pixel ${x},${y} is not green: ${p}`);
        }
      }
    }
  }
});

test('D05: a leafy tree\'s crown is one closed shape (every opaque row is a single run, no stray ring or hole)', () => {
  for (const family of LEAFY) {
    const q = { TL: [0, 0], TR: [1, 0], BL: [0, 1], BR: [1, 1] };
    const sil = Array.from({ length: 32 }, () => Array(32).fill(false));
    for (const [k, [qx, qy]] of Object.entries(q)) {
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) sil[qy * T + y][qx * T + x] = pixel(`${family}Canopy${k}`, x, y)[3] === 255;
    }
    for (let y = 0; y < 32; y++) {
      const xs = sil[y].map((v, x) => (v ? x : -1)).filter((x) => x >= 0);
      if (!xs.length) continue;
      for (let x = xs[0]; x <= xs[xs.length - 1]; x++) assert.ok(sil[y][x], `${family} canopy row ${y} has a gap at column ${x}`);
    }
  }
});

test('D05: every tree is one connected picture: brown bark in the left column, crown touching the trunk, foot on the tile bottom', () => {
  for (const family of [...LEAFY, ...PALMS]) {
    // bark in the trunk tile (the solid left tile), at least 3 columns wide in some row
    const barkWidths = [];
    for (let y = 0; y < T; y++) {
      let n = 0;
      for (let x = 0; x < T; x++) if (isBark(pixel(`${family}Trunk`, x, y))) n++;
      barkWidths.push(n);
    }
    assert.ok(Math.max(...barkWidths) >= 3, `${family}Trunk shows no bark`);
    // the whole 32x48 picture has no empty row between its first opaque row and its foot (no floating crown)
    const rowOpaque = [];
    for (let py = 0; py < 3 * T; py++) {
      let any = false;
      for (let px = 0; px < 2 * T; px++) {
        const tile = py < T ? (px < T ? 'CanopyTL' : 'CanopyTR') : py < 2 * T ? (px < T ? 'CanopyBL' : 'CanopyBR') : (px < T ? 'Trunk' : null);
        if (!tile) continue;
        if (pixel(`${family}${tile}`, px % T, py % T)[3] !== 0) any = true;
      }
      rowOpaque.push(any);
    }
    const first = rowOpaque.indexOf(true);
    assert.ok(first >= 0 && first < 24, `${family} has no crown pixels in its upper rows`);
    for (let y = first; y < 3 * T; y++) assert.ok(rowOpaque[y], `${family}: row ${y} of the tree is empty between the crown and the foot`);
  }
});

// ---------- D14 ----------

const CANOPY = { has: (name) => /^(palm|leafy)\dCanopy(TL|TR|BL|BR)$/.test(name || '') };
const GATE_FURNITURE = new Set(['gateSign', 'securityBooth', 'bitsPillar', 'planter', 'flowerbed', 'barrierPivot', 'barrierRest', 'bollard']);

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
// bitsPorticoGlassBase is the glass panel flanking a portico door; it is part of the facade line, so it counts as wall
// here (and since FB-0046 it is solid too, see tests/unit/entrance-wall.test.js). Everything else must be a solid
// facade/portico/column tile.
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

// ---------- FB-0046 (owner: "make sure I can't walk over the door and the wall") ----------

test('FB-0046: the wall beside every real campus door is SOLID, not just drawn: only the door\'s own two tiles can be walked on in that row', () => {
  const walkable = (x, y) => {
    const s = structures[y * W + x];
    return s > 0 ? !infoOf(s).solid : !infoOf(ground[y * W + x]).solid;
  };
  const doors = objects.filter((o) => o.type === 'door' && o.properties.some((p) => p.name === 'to'));
  assert.equal(doors.length, 3);
  for (const d of doors) {
    const x = Math.floor(d.x / T);
    const y = Math.floor(d.y / T);
    assert.ok(walkable(x, y) && walkable(x + 1, y), `${d.name}: both leaves of the doorway are walkable`);
    for (const cx of [x - 1, x + 2]) {
      assert.ok(WALLISH(cx, y), `${d.name}: ${struct(cx, y)} at ${cx},${y} is not wall`);
      assert.ok(!walkable(cx, y), `${d.name}: ${struct(cx, y)} at ${cx},${y} is walkable: she could stand on the wall line beside the door`);
    }
  }
});
