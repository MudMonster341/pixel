// Defect sweep 2026-10-04: D07 (Main Block stairs landed inside a wall) and D19 (locked doors had no line of their own).
// completeness.test.js checks the same things for every map generically; this file pins the exact Main Block story
// route, in both directions, so a future change to the stairwell plan cannot quietly bring D07 back.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { MAPS, tileInfo, gridFromTiled, tiledObjects, isWalkableTile, DIRECTION_OFFSET, doorLockRule, isDoorLocked } = loadGameData();

const load = (key) => {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${MAPS[key].tiled}.json`), 'utf8'));
  return { key, grid: gridFromTiled(json), objects: tiledObjects(json) };
};
const FLOORS = ['main-block-g', 'main-block-1', 'main-block-2', 'main-block-3'];
const maps = Object.fromEntries(FLOORS.map((k) => [k, load(k)]));
const walkable = (m, x, y) => isWalkableTile(m.grid, tileInfo, x, y);
const tileOf = (o) => ({ x: Math.floor(o.x), y: Math.floor(o.y) });

// every stairs object that has a destination, with where the player arrives and which way she faces (world.js resolveSpawnAt)
const trips = [];
for (const key of FLOORS) {
  for (const o of maps[key].objects.filter((x) => x.type === 'stairs' && x.props.to)) {
    const dest = maps[o.props.to].objects.find((t) => t.name === o.props.toId);
    trips.push({ from: key, via: o.name, to: o.props.to, dest });
  }
}

test('D07: the Main Block stairs make 6 trips (3 up, 3 down) and every one is covered below', () => {
  assert.equal(trips.length, 6, trips.map((t) => `${t.from} ${t.via}`).join('; '));
  assert.ok(trips.some((t) => t.from === 'main-block-g' && t.via === 'Main Block Stairs G (up)' && t.dest.name === 'Main Block Stairs 1 (down)'), 'the foyer staircase must reach floor 1 "(down)"');
});

for (const t of trips) {
  test(`D07: ${t.from} "${t.via}" -> ${t.to} "${t.dest.name}": arrive on a walkable tile beside the stairs, facing away from any wall`, () => {
    const target = maps[t.to];
    const facing = t.dest.props.facing;
    const [dx, dy] = DIRECTION_OFFSET[facing];
    const stairs = tileOf(t.dest);
    const land = { x: stairs.x + dx, y: stairs.y + dy };
    assert.ok(walkable(target, land.x, land.y), `lands on (${land.x},${land.y}), which is solid`);
    // the tile she walks onto next, in the direction she faces, is open floor too (she is not facing a wall)
    assert.ok(walkable(target, land.x + dx, land.y + dy), `faces a solid tile at (${land.x + dx},${land.y + dy})`);
    // she must not arrive standing on another warp (that would bounce her straight back)
    assert.ok(!target.objects.some((o) => (o.type === 'door' || o.type === 'stairs') && o.props.to && tileOf(o).x === land.x && tileOf(o).y === land.y), 'arrives on top of a warp tile');
  });
}

// ---------- D19 ----------

const LOCK_LINES = [
  ['campus', 'Library Block entrance', 'The Library is closed today.'],
  ['campus', 'Mechanical Block entrance', 'The Mechanical Block is closed today.'],
  ['main-block-g', 'Main Block Stairs G (up)', 'The stairs are roped off. Talk to the LUG volunteer first.'],
  ['main-block-1', 'Main Block Stairs 1 (up)', 'The stairs are roped off. Talk to the LUG volunteer first.'],
  ['main-block-2', 'Main Block Stairs 2 (up)', 'The stairs are roped off. Talk to the LUG volunteer first.'],
];
for (const [mapKey, door, line] of LOCK_LINES) {
  test(`D19: ${mapKey} "${door}" says its own line when locked`, () => {
    const rule = doorLockRule(MAPS[mapKey].doorLocks, door);
    assert.ok(rule, `no doorLocks rule for "${door}"`);
    assert.equal(rule.reason, line);
  });
}

test('D19: the stairs line is only ever shown while the hunt has not been given (it unlocks for good after the volunteer)', () => {
  for (const [mapKey, door] of LOCK_LINES.filter((l) => /Stairs/.test(l[1]))) {
    const rule = doorLockRule(MAPS[mapKey].doorLocks, door);
    assert.equal(isDoorLocked(rule, 'arrival'), true, `${door} must be roped off before the task is given`);
    assert.equal(isDoorLocked(rule, 'hunting'), false, `${door} must open once the volunteer set the task`);
    assert.equal(isDoorLocked(rule, 'rewarded'), false, `${door} must stay open after the reward`);
  }
  for (const door of ['Library Block entrance', 'Mechanical Block entrance']) {
    const rule = doorLockRule(MAPS.campus.doorLocks, door);
    for (const stage of ['arrival', 'hunting', 'rewarded']) assert.equal(isDoorLocked(rule, stage), true, `${door} is locked for the whole game (${stage})`);
  }
});
