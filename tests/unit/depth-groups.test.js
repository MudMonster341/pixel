// ADR 0015 (depth groups and door entry): unit coverage for the pure parts -- assigning tiles to
// groups (smallest group wins, a tile outside every group is left untouched), the door tile a
// given arrival spawn point came from, and parsing a door's `openTiles` property. The Phaser-side
// baking/animation itself (src/scenes/world.js) needs a browser, so that's covered by
// tests/e2e/depth-groups.spec.js instead (docs/TESTING.md rule 1: "new feature -> tests in the same
// change", both layers).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

const { depthGroupAt, doorTileFromSpawn, parseOpenTiles, DIRECTION_OFFSET } = loadGameData();

test('depthGroupAt: a tile outside every group is untouched (null)', () => {
  const groups = [{ x: 0, y: 0, width: 4, height: 4 }, { x: 10, y: 10, width: 2, height: 2 }];
  assert.equal(depthGroupAt(groups, 5, 5), null);
  assert.equal(depthGroupAt(groups, 100, 100), null);
});

test('depthGroupAt: a tile inside exactly one group returns that group', () => {
  const house = { x: 9, y: 9, width: 5, height: 4 };
  const tree = { x: 20, y: 20, width: 1, height: 1 };
  const groups = [house, tree];
  assert.equal(depthGroupAt(groups, 11, 12), house); // the house's own door tile
  assert.equal(depthGroupAt(groups, 20, 20), tree);
  // Right on the rect's own far edge (x + width, y + height) is *outside* it (half-open interval).
  assert.equal(depthGroupAt(groups, 9 + 5, 9), null);
});

test('depthGroupAt: a tile inside more than one group belongs to the smallest', () => {
  const building = { x: 0, y: 0, width: 10, height: 10 }; // area 100
  const lampPost = { x: 4, y: 4, width: 1, height: 1 }; // area 1, nested inside the building
  const groups = [building, lampPost];
  assert.equal(depthGroupAt(groups, 4, 4), lampPost);
  assert.equal(depthGroupAt([lampPost, building], 4, 4), lampPost); // order in the array doesn't matter
  assert.equal(depthGroupAt(groups, 1, 1), building); // still the building everywhere else inside it
});

test('doorTileFromSpawn: the exact inverse of resolveSpawnAt\'s forward math (target + offset)', () => {
  for (const facing of Object.keys(plain(DIRECTION_OFFSET))) {
    const target = { x: 5, y: 5 };
    const [dx, dy] = DIRECTION_OFFSET[facing];
    const spawn = { x: target.x + dx, y: target.y + dy, facing };
    assert.deepEqual(plain(doorTileFromSpawn(spawn, facing)), target);
  }
});

test('doorTileFromSpawn: rounds a half-tile spawn back to the door\'s own whole tile', () => {
  // src/maps.js house's own doorway: two 1-wide warp tiles (9,11) and (10,11), the meadow-side spawn
  // centers her at x=9.5 between them -- the door she came from is still a whole tile.
  assert.deepEqual(plain(doorTileFromSpawn({ x: 9.5, y: 10, facing: 'up' }, 'up')), { x: 10, y: 11 });
  assert.deepEqual(plain(doorTileFromSpawn({ x: 11, y: 13, facing: 'down' }, 'down')), { x: 11, y: 12 });
});

test('parseOpenTiles: missing/empty -> null (the graceful "no overlay" fallback)', () => {
  assert.equal(parseOpenTiles(undefined), null);
  assert.equal(parseOpenTiles(''), null);
  assert.equal(parseOpenTiles('  ,  ,'), null);
});

test('parseOpenTiles: a comma-separated list of tile names, trimmed, left to right', () => {
  assert.deepEqual(plain(parseOpenTiles('doorway')), ['doorway']);
  assert.deepEqual(plain(parseOpenTiles('doorL, doorR')), ['doorL', 'doorR']);
});
