// Checks the generated interior maps (tools/interiors/build-interiors.js, docs/INTERIORS_PLAN.md)
// are up to date and playable: axis-aligned, every room reachable (including up/down stairs
// between floors), every door/stairs object valid and reversible, stairs aligned between floors,
// every room named, every tile name real, and every map marked indoors.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { tileInfo, gridFromTiled, tiledObjects, isWalkableTile } = loadGameData();

const KEYS = [
  'main-block-g', 'main-block-1', 'main-block-2', 'main-block-3',
  'library-block-g', 'library-block-1', 'mechanical-block-g', 'mechanical-block-1',
];

const maps = {};
for (const key of KEYS) {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${key}.json`), 'utf8'));
  maps[key] = { json, grid: gridFromTiled(json), objects: tiledObjects(json) };
}
const campusJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', 'campus.json'), 'utf8'));
const campusObjects = tiledObjects(campusJson);

const walkableAt = (key, x, y) => isWalkableTile(maps[key].grid, tileInfo, x, y);

function reachableFrom(key, start) {
  const { json } = maps[key];
  const seen = new Uint8Array(json.width * json.height);
  const queue = [start];
  seen[start.y * json.width + start.x] = 1;
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= json.width || ny >= json.height) continue;
      if (seen[ny * json.width + nx] || !walkableAt(key, nx, ny)) continue;
      seen[ny * json.width + nx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return (x, y) => seen[y * json.width + x] === 1;
}

test('every generated interior map (assets/maps/<key>.json) is up to date (run `npm run interiors` if this fails)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-interiors-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'interiors', 'build-interiors.js'), '--out', out], { stdio: 'pipe' });
    for (const key of KEYS) {
      assert.ok(
        fs.readFileSync(path.join(out, `${key}.json`)).equals(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${key}.json`))),
        `assets/maps/${key}.json is out of date`,
      );
      assert.ok(fs.existsSync(path.join(out, `${key}.png`)), `preview PNG for ${key} was not generated`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

for (const key of KEYS) {
  const { json, objects } = maps[key];

  test(`${key}: uses the shared tileset, 1 m per tile, and is marked indoors`, () => {
    assert.equal(json.tilewidth, 16);
    assert.equal(json.tilesets[0].tilecount, tileInfo.tiles.length);
    const props = Object.fromEntries(json.properties.map((p) => [p.name, p.value]));
    assert.equal(props.metersPerTile, 1);
    assert.equal(props.indoors, true);
    for (const layer of json.layers.filter((l) => l.type === 'tilelayer')) {
      assert.equal(layer.data.length, json.width * json.height);
      assert.ok(layer.data.every((gid) => gid >= 0 && gid <= tileInfo.tiles.length), `${layer.name} has an unknown tile gid`);
    }
  });

  test(`${key}: every wall tile is axis-aligned (no diagonal-only staircase joins)`, () => {
    const WALL_FAMILY = new Set(['bitsWallPlain', 'bitsWall', 'bitsWallEndL', 'bitsWallEndR', 'intWhiteboardWall']);
    const structLayer = json.layers.find((l) => l.name === 'structures').data;
    const nameAt = (x, y) => {
      const gid = structLayer[y * json.width + x];
      return gid ? tileInfo.tiles[gid - 1].name : null;
    };
    const isWall = (x, y) => WALL_FAMILY.has(nameAt(x, y));
    let staircases = 0;
    for (let y = 0; y < json.height - 1; y++) {
      for (let x = 0; x < json.width - 1; x++) {
        if (isWall(x, y) && isWall(x + 1, y + 1) && !isWall(x + 1, y) && !isWall(x, y + 1)) staircases++;
        if (isWall(x + 1, y) && isWall(x, y + 1) && !isWall(x, y) && !isWall(x + 1, y + 1)) staircases++;
      }
    }
    assert.equal(staircases, 0, `found ${staircases} diagonal-only wall joins in ${key}`);
  });

  test(`${key}: has a spawn on walkable ground, and every named room has an area object`, () => {
    const spawn = objects.find((o) => o.type === 'spawn');
    assert.ok(spawn, `${key} has no spawn object`);
    assert.ok(walkableAt(key, Math.floor(spawn.x), Math.floor(spawn.y)), `${key} spawn is on a solid tile`);
    const areas = objects.filter((o) => o.type === 'area');
    assert.ok(areas.length > 0, `${key} has no named rooms`);
    for (const area of areas) assert.ok(area.name && area.name.length > 0, `${key} has an unnamed area object`);
  });

  test(`${key}: every room is reachable from the spawn`, () => {
    const spawn = objects.find((o) => o.type === 'spawn');
    const reachable = reachableFrom(key, { x: Math.floor(spawn.x), y: Math.floor(spawn.y) });
    for (const area of objects.filter((o) => o.type === 'area')) {
      const x0 = Math.round(area.x);
      const y0 = Math.round(area.y);
      const x1 = x0 + Math.round(area.width) - 1;
      const y1 = y0 + Math.round(area.height) - 1;
      let ok = false;
      for (let y = y0; y <= y1 && !ok; y++) for (let x = x0; x <= x1 && !ok; x++) if (reachable(x, y)) ok = true;
      assert.ok(ok, `${key}: room "${area.name}" can't be reached from the spawn (furniture may be blocking it)`);
    }
  });

  test(`${key}: every door/stairs object is on walkable ground and reachable from the spawn`, () => {
    const spawn = objects.find((o) => o.type === 'spawn');
    const reachable = reachableFrom(key, { x: Math.floor(spawn.x), y: Math.floor(spawn.y) });
    for (const o of objects.filter((o) => o.type === 'door' || o.type === 'stairs')) {
      const x = Math.floor(o.x);
      const y = Math.floor(o.y);
      assert.ok(walkableAt(key, x, y), `${key}: "${o.name}" sits on a solid tile`);
      assert.ok(reachable(x, y), `${key}: "${o.name}" can't be reached from the spawn`);
    }
  });
}

// ---------- cross-map: every door/stairs target exists, is walkable, and links back ----------

const allMaps = { campus: { json: campusJson, objects: campusObjects, grid: gridFromTiled(campusJson) }, ...maps };
const KNOWN_MAP_KEYS = new Set(['campus', ...KEYS]);

test('every interior/campus door or stairs object points at a real map, a real object there, on walkable ground, that links back', () => {
  for (const [key, { objects }] of Object.entries(allMaps)) {
    for (const o of objects.filter((o) => o.type === 'door' || o.type === 'stairs')) {
      if (!o.props.to) continue;
      assert.ok(KNOWN_MAP_KEYS.has(o.props.to), `${key}: "${o.name}" points at unknown map "${o.props.to}"`);
      const target = allMaps[o.props.to];
      const dest = target.objects.find((t) => t.name === o.props.toId);
      assert.ok(dest, `${key}: "${o.name}" -> ${o.props.to} has no object named "${o.props.toId}"`);
      assert.ok(
        isWalkableTile(target.grid, tileInfo, Math.floor(dest.x), Math.floor(dest.y)),
        `${key}: "${o.name}" lands on a solid tile in ${o.props.to}`,
      );
      assert.ok(dest.props.to, `${key}: "${o.name}" -> "${dest.name}" in ${o.props.to} has no way back`);
      const back = allMaps[dest.props.to];
      assert.ok(back, `${dest.name} in ${o.props.to} points back at unknown map "${dest.props.to}"`);
      assert.ok(
        back.objects.some((t) => t.name === dest.props.toId),
        `${dest.name} in ${o.props.to} points back at a missing object "${dest.props.toId}" in ${dest.props.to}`,
      );
    }
  }
});

// ---------- stairs line up between floors of the same building ----------

test('stairs line up between floors (same x,y stairwell on every floor of a building)', () => {
  const buildingsByFloors = {
    main: ['main-block-g', 'main-block-1', 'main-block-2', 'main-block-3'],
    library: ['library-block-g', 'library-block-1'],
    mechanical: ['mechanical-block-g', 'mechanical-block-1'],
  };
  for (const floors of Object.values(buildingsByFloors)) {
    // Compare the stairwell *room*'s rect (identical on every floor by construction), not an
    // individual stairs object's tile -- a floor's "up" and "down" objects sit a couple of tiles
    // apart inside the same stairwell, so comparing points directly would be comparing apples to
    // oranges between a ground floor (only "up") and a top floor (only "down").
    const rects = floors.map((key) => {
      const room = maps[key].objects.find((o) => o.type === 'area' && /stairs/i.test(o.name));
      assert.ok(room, `${key} has no named stairwell room`);
      return { x: Math.round(room.x), y: Math.round(room.y), w: Math.round(room.width), h: Math.round(room.height) };
    });
    for (let i = 1; i < rects.length; i++) {
      assert.deepEqual(rects[i], rects[0], `the stairwell on ${floors[i]} doesn't line up with ${floors[0]}`);
    }
  }
});

// ---------- every interior room reachable across floors, following stairs (flood fill) ----------

test('every room in every building is reachable on foot from that building\'s ground-floor entrance, walking through doors and up/down stairs', () => {
  const buildingsByFloors = {
    'Main Block': ['main-block-g', 'main-block-1', 'main-block-2', 'main-block-3'],
    'Library Block': ['library-block-g', 'library-block-1'],
    'Mechanical Block': ['mechanical-block-g', 'mechanical-block-1'],
  };
  for (const floors of Object.values(buildingsByFloors)) {
    // Seed reachable cells per floor from that floor's spawn, then repeatedly hop through any
    // stairs object whose own tile is reachable, seeding the target floor at the landing tile,
    // until nothing new is reachable anywhere.
    const reachableSets = {};
    const seedQueues = {};
    for (const key of floors) {
      const spawn = maps[key].objects.find((o) => o.type === 'spawn');
      seedQueues[key] = [{ x: Math.floor(spawn.x), y: Math.floor(spawn.y) }];
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const key of floors) {
        if (!seedQueues[key].length) continue;
        const before = reachableSets[key];
        const seeds = seedQueues[key];
        seedQueues[key] = [];
        const seen = before ? before.seen : new Uint8Array(maps[key].json.width * maps[key].json.height);
        const queue = [];
        for (const s of seeds) {
          const i = s.y * maps[key].json.width + s.x;
          if (!seen[i] && walkableAt(key, s.x, s.y)) { seen[i] = 1; queue.push(s); changed = true; }
        }
        for (let i = 0; i < queue.length; i++) {
          const { x, y } = queue[i];
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= maps[key].json.width || ny >= maps[key].json.height) continue;
            const idx = ny * maps[key].json.width + nx;
            if (!seen[idx] && walkableAt(key, nx, ny)) { seen[idx] = 1; queue.push({ x: nx, y: ny }); }
          }
        }
        reachableSets[key] = { seen };
        // Any stairs standing on now-reachable ground seeds the destination floor.
        for (const o of maps[key].objects.filter((o) => o.type === 'stairs')) {
          const ox = Math.floor(o.x), oy = Math.floor(o.y);
          if (seen[oy * maps[key].json.width + ox] && o.props.to && floors.includes(o.props.to)) {
            const dest = maps[o.props.to].objects.find((t) => t.name === o.props.toId);
            if (dest) seedQueues[o.props.to].push({ x: Math.floor(dest.x), y: Math.floor(dest.y) });
          }
        }
      }
    }
    for (const key of floors) {
      const { seen } = reachableSets[key];
      for (const area of maps[key].objects.filter((o) => o.type === 'area')) {
        const x0 = Math.round(area.x), y0 = Math.round(area.y);
        const x1 = x0 + Math.round(area.width) - 1, y1 = y0 + Math.round(area.height) - 1;
        let ok = false;
        for (let y = y0; y <= y1 && !ok; y++) for (let x = x0; x <= x1 && !ok; x++) if (seen[y * maps[key].json.width + x]) ok = true;
        assert.ok(ok, `${key}: room "${area.name}" isn't reachable from the ground floor via doors and stairs`);
      }
    }
  }
});
