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

const { AMBIENT, AMBIENT_DEFAULT_LINES, MAPS, gridFromTiled, tiledObjects, isWalkableTile, tileInfo } = loadGameData();

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

test('AMBIENT_DEFAULT_LINES: a pool of short, neutral lines, no story info leaking through', () => {
  assert.ok(AMBIENT_DEFAULT_LINES.length >= 4, 'expected a real pool, not just one or two lines');
  for (const line of AMBIENT_DEFAULT_LINES) {
    assert.equal(typeof line, 'string');
    assert.ok(line.length > 0 && line.length <= 60, `line too long for a one-liner: "${line}"`);
    // None of the hunt's own vocabulary (keys, the volunteer, the box, room names) -- "no story
    // information" (this task's own brief) -- checked directly rather than trusted.
    assert.doesNotMatch(line.toLowerCase(), /\bkey\b|volunteer|treasure|physics lab|icvl|room 195|box\b/);
  }
});

test('AMBIENT: any entry with its own custom dialog uses the same {id, lines} shape as every other NPC', () => {
  for (const key of MAP_KEYS) {
    for (const entry of AMBIENT[key].filter((e) => e.dialog)) {
      assert.ok(Array.isArray(entry.dialog) && entry.dialog.length > 0, `${entry.id}: dialog must be a non-empty array`);
      for (const d of entry.dialog) {
        assert.ok(Array.isArray(d.lines) && d.lines.length > 0, `${entry.id}: dialog entry needs non-empty lines`);
      }
    }
  }
});
