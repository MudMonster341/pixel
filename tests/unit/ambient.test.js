// Ambient campus/Main Block life (quality loop, Characters and depth run 1, 2026-09-29: "the world
// is empty"). src/ambient.js is pure content (docs/ARCHITECTURE.md); this checks that content against
// the *real*, committed maps (assets/maps/<key>.json) the same way tests/unit/campus-layout.test.js
// checks hand-picked constants elsewhere -- so a future map regeneration that moves a wall, a door or
// a bench can't silently strand an ambient NPC on an unwalkable tile, on top of a door/stairs/key
// station, or inside the volunteer's own LUG Stall nook, without a test failing loudly here first.
// The engine that actually runs one of these (src/scenes/world.js createAmbient()/updateAmbient()) is
// Phaser-facing and covered by tests/e2e/ambient.spec.js instead (written, not run -- build-only,
// docs/QUALITY_LOOP.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { AMBIENT, CAMPUS_ROLES, campusFactsFor, MAPS, gridFromTiled, tiledObjects, isWalkableTile, tileInfo } = loadGameData();

// One decoded map per AMBIENT key, exactly like campus-layout.test.js's own single campus.json load,
// just for every tiled map that carries ambient content instead of only the campus.
function loadMap(mapKey) {
  const tiled = MAPS[mapKey].tiled;
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${tiled}.json`), 'utf8'));
  return { json, grid: gridFromTiled(json), objects: tiledObjects(json) };
}

const MAP_KEYS = Object.keys(AMBIENT);
const maps = Object.fromEntries(MAP_KEYS.map((key) => [key, loadMap(key)]));

// Every point an entry actually stands/passes through: idle/chat's own {x,y}, or every waypoint of a
// patrol -- the one shape updateAmbientPatrol()/buildAmbientNpc() (world.js) ever reads a coordinate
// from is either `def` itself (idle/chat) or `def.waypoints[i]` (patrol).
function pointsOf(def) {
  return def.kind === 'patrol' ? def.waypoints : [{ x: def.x, y: def.y }];
}

test('AMBIENT: every map key matches a real MAPS entry with a tiled map', () => {
  for (const key of MAP_KEYS) {
    assert.ok(MAPS[key], `AMBIENT has an entry for unknown map "${key}"`);
    assert.ok(MAPS[key].tiled, `map "${key}" has no tiled map to check ambient content against`);
    assert.equal(MAPS[key].ambient, AMBIENT[key], `map "${key}"'s def.ambient doesn't point at AMBIENT["${key}"]`);
  }
});

test('AMBIENT: every entry has a valid kind, a real character texture, and a stable id', () => {
  const seenIds = new Set();
  for (const key of MAP_KEYS) {
    for (const entry of AMBIENT[key]) {
      assert.match(entry.id, /^[a-z0-9-]+$/, `${key}: id "${entry.id}" should be a plain slug`);
      assert.ok(!seenIds.has(entry.id), `duplicate ambient id "${entry.id}" across maps`);
      seenIds.add(entry.id);
      assert.ok(['patrol', 'idle', 'chat'].includes(entry.kind), `${entry.id}: unknown kind "${entry.kind}"`);
      assert.match(entry.character, /^(ambient-[a-f]|student-[ab]|adam|alex|bob|amelia)$/,
        `${entry.id}: "${entry.character}" isn't one of the ambient/student character textures`);
    }
  }
});

test('AMBIENT: every waypoint/idle/chat coordinate is a walkable tile on the real map', () => {
  for (const key of MAP_KEYS) {
    const { grid, json } = maps[key];
    for (const entry of AMBIENT[key]) {
      for (const p of pointsOf(entry)) {
        assert.ok(
          isWalkableTile(grid, tileInfo, p.x, p.y),
          `${key}/${entry.id}: (${p.x},${p.y}) is not walkable on the real map`,
        );
      }
    }
  }
});

test('AMBIENT: patrol routes have at least 2 waypoints, and a loop route at least 3 (a real lap, not a line)', () => {
  for (const key of MAP_KEYS) {
    for (const entry of AMBIENT[key].filter((e) => e.kind === 'patrol')) {
      assert.ok(entry.waypoints.length >= 2, `${entry.id}: patrol needs at least 2 waypoints`);
      if (entry.loop) assert.ok(entry.waypoints.length >= 3, `${entry.id}: loop:true with only ${entry.waypoints.length} waypoints isn't a real lap`);
      assert.ok(entry.speed > 0, `${entry.id}: patrol speed must be positive`);
    }
  }
});

test('AMBIENT: chat entries come in pairs (exactly 2 per pairId), standing next to each other', () => {
  for (const key of MAP_KEYS) {
    const chats = AMBIENT[key].filter((e) => e.kind === 'chat');
    const byPair = new Map();
    for (const entry of chats) {
      assert.ok(entry.pairId, `${entry.id}: chat entry needs a pairId`);
      (byPair.get(entry.pairId) || byPair.set(entry.pairId, []).get(entry.pairId)).push(entry);
    }
    for (const [pairId, pair] of byPair) {
      assert.equal(pair.length, 2, `chat pair "${pairId}" should have exactly 2 entries, found ${pair.length}`);
      const [a, b] = pair;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      assert.ok(dist <= 1.5, `chat pair "${pairId}" isn't standing next to each other (${dist.toFixed(2)} tiles apart)`);
    }
  }
});

// Doors/stairs/gates are real Tiled objects; a patrol that grazes one is fine (it's how she reaches
// either end of her route) but an ambient NPC's own STANDING points -- idle/chat, and a patrol's
// endpoints where it lingers for `pauseMs` -- should never sit inside one, or she'd never be able to
// use that door/stairs without shoving through someone parked in the doorway.
function blocksTransit(objects, x, y) {
  return objects.some((o) => ['door', 'stairs', 'gate'].includes(o.type)
    && x >= o.x && x < o.x + Math.max(o.width, 1) && y >= o.y && y < o.y + Math.max(o.height, 1));
}

test('AMBIENT: no stand/sit/chat point or patrol endpoint blocks a door, stairs or gate', () => {
  for (const key of MAP_KEYS) {
    const { objects } = maps[key];
    for (const entry of AMBIENT[key]) {
      const standingPoints = entry.kind === 'patrol'
        ? [entry.waypoints[0], entry.waypoints[entry.waypoints.length - 1]]
        : [{ x: entry.x, y: entry.y }];
      for (const p of standingPoints) {
        assert.ok(!blocksTransit(objects, p.x, p.y), `${key}/${entry.id}: (${p.x},${p.y}) sits on a door/stairs/gate`);
      }
    }
  }
});

test('AMBIENT: main-block-g keeps every ambient NPC clear of the LUG Stall nook (the volunteer\'s own spot)', () => {
  // The volunteer's own npc def (src/maps.js) and its stall area -- checked directly against the real
  // object instead of a hand-copied rectangle, so a future stall move can't silently stop meaning
  // anything here.
  const volunteer = MAPS['main-block-g'].npcs.find((n) => n.id === 'lug-volunteer');
  assert.ok(volunteer, 'expected the LUG volunteer NPC to still exist on main-block-g');
  const { objects } = maps['main-block-g'];
  const stall = objects.find((o) => o.name === 'LUG Stall');
  assert.ok(stall, 'expected a "LUG Stall" area object on main-block-g');
  for (const entry of AMBIENT['main-block-g']) {
    for (const p of pointsOf(entry)) {
      const inStall = p.x >= stall.x && p.x < stall.x + stall.width && p.y >= stall.y && p.y < stall.y + stall.height;
      assert.ok(!inStall, `${entry.id}: (${p.x},${p.y}) is inside the LUG Stall nook`);
      const onVolunteer = Math.round(p.x) === Math.round(volunteer.x) && Math.round(p.y) === Math.round(volunteer.y);
      assert.ok(!onVolunteer, `${entry.id}: (${p.x},${p.y}) stands exactly where the volunteer stands`);
    }
  }
});

test('AMBIENT: no idle/chat point or patrol endpoint sits exactly on a key station\'s own tile', () => {
  for (const key of ['main-block-1', 'main-block-3']) {
    const stations = MAPS[key].keyStations || [];
    for (const entry of AMBIENT[key]) {
      const standingPoints = entry.kind === 'patrol'
        ? [entry.waypoints[0], entry.waypoints[entry.waypoints.length - 1]]
        : [{ x: entry.x, y: entry.y }];
      for (const p of standingPoints) {
        for (const ks of stations) {
          const onStation = Math.round(p.x) === Math.round(ks.x) && Math.round(p.y) === Math.round(ks.y);
          assert.ok(!onStation, `${key}/${entry.id}: (${p.x},${p.y}) sits exactly on key station "${ks.id}"`);
        }
      }
    }
  }
});

// ---------- ADR 0018: every ambient student is talkable ----------

test('AMBIENT: every entry has a role with a fact pool (every ambient student can be talked to), and no custom dialog', () => {
  for (const key of MAP_KEYS) {
    for (const entry of AMBIENT[key]) {
      assert.ok(entry.role, `${entry.id}: needs a "role" (src/campus-facts.js CAMPUS_ROLES)`);
      assert.ok(CAMPUS_ROLES[entry.role], `${entry.id}: unknown role "${entry.role}"`);
      // A role with no sourced facts yet (FB-0057 'mtc-member') talks from its placeholder `smallTalk` pool instead.
      const pool = campusFactsFor(entry.role).length || (CAMPUS_ROLES[entry.role].smallTalk || []).length;
      assert.ok(pool >= 2, `${entry.id}: role "${entry.role}" has no fact pool`);
      assert.equal(entry.dialog, undefined, `${entry.id}: the old per-entry "dialog" is gone, talk comes from the role (ADR 0018)`);
    }
  }
});

test('AMBIENT: the old generic AMBIENT_DEFAULT_LINES small-talk pool is gone from the game code', () => {
  for (const file of ['src/ambient.js', 'src/scenes/world.js']) {
    assert.doesNotMatch(fs.readFileSync(path.join(ROOT, file), 'utf8'), /AMBIENT_DEFAULT_LINES/, `${file} still uses the retired pool`);
  }
});

// A flood fill over walkable tiles from the map's spawn: an ambient student must be somewhere she can actually reach.
function reachableFromSpawn(map) {
  const { json, grid, objects } = map;
  const spawn = objects.find((o) => o.type === 'spawn');
  const seen = new Uint8Array(json.width * json.height);
  const stack = [[Math.floor(spawn.x), Math.floor(spawn.y)]];
  seen[stack[0][1] * json.width + stack[0][0]] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= json.width || ny >= json.height || seen[ny * json.width + nx]) continue;
      if (!isWalkableTile(grid, tileInfo, nx, ny)) continue;
      seen[ny * json.width + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  return (x, y) => Boolean(seen[y * json.width + x]);
}

test('AMBIENT: every stand/waypoint tile is reachable from the map\'s spawn (nobody is stranded in a walled-off yard)', () => {
  for (const key of MAP_KEYS) {
    const reachable = reachableFromSpawn(maps[key]);
    for (const entry of AMBIENT[key]) {
      for (const p of pointsOf(entry)) assert.ok(reachable(p.x, p.y), `${key}/${entry.id}: (${p.x},${p.y}) can't be reached from the spawn`);
    }
  }
});

test('AMBIENT: the straight line between two neighbouring waypoints is walkable (patrols have no pathfinding)', () => {
  for (const key of MAP_KEYS) {
    const { grid } = maps[key];
    for (const entry of AMBIENT[key].filter((e) => e.kind === 'patrol')) {
      const w = entry.waypoints;
      const legs = w.slice(1).map((p, i) => [w[i], p]);
      if (entry.loop) legs.push([w[w.length - 1], w[0]]);
      for (const [a, b] of legs) {
        const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 8);
        for (let i = 0; i <= steps; i++) {
          const x = Math.floor(a.x + 0.5 + (b.x - a.x) * (i / steps));
          const y = Math.floor(a.y + 0.5 + (b.y - a.y) * (i / steps));
          assert.ok(isWalkableTile(grid, tileInfo, x, y), `${key}/${entry.id}: the leg (${a.x},${a.y}) -> (${b.x},${b.y}) crosses a blocked tile at (${x},${y})`);
        }
      }
    }
  }
});

// ---------- completeness: everywhere she can roam has people ----------

const inRect = (p, r) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
const anyPoint = (entry, rect) => pointsOf(entry).some((p) => inRect(p, rect));

// The outdoor areas of the campus map (rects in tiles, from the real named areas/buildings in
// assets/maps/campus.json plus the gate/forecourt/avenue the story walks through), each wanting 2-3 people.
const CAMPUS_AREAS = {
  'Gate 2 and the avenue': { x: 215, y: 138, w: 40, h: 40, min: 3 },
  'Main Block forecourt': { x: 205, y: 128, w: 45, h: 12, min: 3 },
  'Library front (courtyard)': { x: 224, y: 99, w: 15, h: 10, min: 2 },
  'Mechanical front': { x: 239, y: 75, w: 10, h: 22, min: 2 },
  'Boys hostels': { x: 79, y: 57, w: 90, h: 20, min: 3 },
  'Girls hostels': { x: 222, y: 56, w: 60, h: 20, min: 2 },
  Courts: { x: 168, y: 59, w: 56, h: 9, min: 2 },
  'Tennis courts': { x: 86, y: 91, w: 19, h: 19, min: 2 },
  'Athletics track and infield': { x: 110, y: 82, w: 67, h: 32, min: 2 },
  'Student parking': { x: 124, y: 112, w: 50, h: 8, min: 2 },
  'Gate parking': { x: 222, y: 141, w: 46, h: 5, min: 2 },
  'DIAC Park': { x: 290, y: 104, w: 80, h: 50, min: 3 },
  'Side Gate': { x: 76, y: 59, w: 6, h: 14, min: 1 },
};

test('AMBIENT completeness: every outdoor area of the campus has its quota of people', () => {
  for (const [name, rect] of Object.entries(CAMPUS_AREAS)) {
    const count = AMBIENT.campus.filter((e) => anyPoint(e, rect)).length;
    assert.ok(count >= rect.min, `${name}: ${count} ambient student(s), want at least ${rect.min}`);
  }
});

test('AMBIENT completeness: every map with ambient life has at least 3 students, every Main Block floor on the story route at least 2', () => {
  assert.ok(AMBIENT.campus.length >= 3);
  // The 4 Main Block floors are the story route's interiors.
  const storyFloors = Object.keys(MAPS).filter((k) => /^main-block-/.test(k));
  assert.deepEqual([...storyFloors].sort(), ['main-block-1', 'main-block-2', 'main-block-3', 'main-block-g']);
  for (const key of storyFloors) {
    assert.ok(MAPS[key].ambient, `${key} has no ambient list`);
    assert.ok(MAPS[key].ambient.length >= 2, `${key}: only ${MAPS[key].ambient.length} ambient student(s)`);
    // ADR 0020: the ground floor is now a hall plus two long wings (about 6 in the hall, a few more in the wings).
    // FB-0066: the 3rd floor is the Physics Lab, which got four students of its own (a bench, a chatting pair, a walker): up to 8.
    const cap = key === 'main-block-g' ? 9 : key === 'main-block-3' ? 8 : 6;
    assert.ok(MAPS[key].ambient.length <= cap, `${key}: ${MAPS[key].ambient.length} students is crowded (max ${cap})`);
  }
});

// A camera shows about 20 x 12 tiles (320x180 world px at zoom 3). Performance: never more than ~14 moving
// sprites on one screen, counting everyone whose area (a patrol's bounding box, or a point) touches it.
test('AMBIENT performance: no camera-sized window on any map holds more than 14 ambient students', () => {
  const W = 22;
  const H = 14;
  const box = (e) => {
    const pts = pointsOf(e);
    return { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
  };
  for (const key of MAP_KEYS) {
    const boxes = AMBIENT[key].map(box);
    for (const anchor of boxes) {
      for (const [wx, wy] of [[anchor.x0, anchor.y0], [anchor.x1 - W + 1, anchor.y1 - H + 1], [anchor.x0, anchor.y1 - H + 1], [anchor.x1 - W + 1, anchor.y0]]) {
        const inside = boxes.filter((b) => b.x1 >= wx && b.x0 < wx + W && b.y1 >= wy && b.y0 < wy + H).length;
        assert.ok(inside <= 14, `${key}: ${inside} ambient students within one screen around (${wx},${wy})`);
      }
    }
  }
});

// FB-0050: `name` / `lines` are optional on an entry (the named-character mechanism, documented in the src/ambient.js header).
test('FB-0050: an ambient entry\'s optional name / lines are well-formed', () => {
  for (const key of MAP_KEYS) {
    for (const entry of AMBIENT[key]) {
      if (entry.name !== undefined) assert.ok(typeof entry.name === 'string' && entry.name.length > 0 && entry.name.length <= 24, `${entry.id}: name is a short string`);
      if (entry.lines !== undefined) {
        assert.ok(Array.isArray(entry.lines) && entry.lines.length >= 1 && entry.lines.length <= 4, `${entry.id}: lines is a short array`);
        for (const line of entry.lines) assert.ok(typeof line === 'string' && line.length > 0 && line.length <= 160, `${entry.id}: a line is 1-160 chars`);
        assert.ok(entry.name, `${entry.id}: fixed lines belong to a named character`);
      }
    }
  }
});

// FB-0057: the new MTC members are ordinary entries, so the clearance / walkability / reachability tests above and
// below already cover where they stand (re-roled from tech-club-member entries, same tiles).
test('FB-0057: the three MTC members are the former tech-club entries at the Mechanical front, the Main Block hall and the 1st-floor classroom row', () => {
  const ids = Object.values(AMBIENT).flat().filter((e) => e.role === 'mtc-member').map((e) => e.id).sort();
  assert.deepEqual(ids, ['campus-amb-mech-1', 'mb1-amb-icl-1', 'mbg-amb-wing-3']);
});
