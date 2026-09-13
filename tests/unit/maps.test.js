// Checks every map is well-formed and playable: tiles resolve, things sit on walkable ground,
// doors lead somewhere sensible, and everything can actually be reached from the spawn point.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

const data = loadGameData();
const { MAPS, ITEMS, START_MAP, TILE, tileInfo, buildTileGrid, isWalkableTile } = data;

// Tiles under the player's feet when standing at a (possibly fractional) tile position.
// Mirrors the feet hitbox in src/scenes/world.js: 10px wide, bottom edge 8px below the center.
function feetTiles({ x, y }) {
  const px = x * TILE + TILE / 2;
  const py = y * TILE + TILE / 2;
  const row = Math.floor((py + 7) / TILE);
  const left = Math.floor((px - 5) / TILE);
  const right = Math.floor((px + 4) / TILE);
  return left === right ? [{ x: left, y: row }] : [{ x: left, y: row }, { x: right, y: row }];
}

function reachableFrom(grid, start) {
  const key = (x, y) => `${x},${y}`;
  const seen = new Set([key(start.x, start.y)]);
  const queue = [start];
  while (queue.length) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!seen.has(key(nx, ny)) && isWalkableTile(grid, tileInfo, nx, ny)) {
        seen.add(key(nx, ny));
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return (x, y) => seen.has(key(x, y));
}

test('the start map exists', () => {
  assert.ok(MAPS[START_MAP], `START_MAP "${START_MAP}" is not in MAPS`);
});

test('pickup ids are unique across all maps', () => {
  const ids = Object.values(MAPS).flatMap((def) => (def.pickups || []).map((p) => p.id));
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(duplicates, []);
});

for (const [key, def] of Object.entries(MAPS)) {
  test(`${key}: rows form a rectangle`, () => {
    const width = def.rows[0].length;
    def.rows.forEach((row, y) => assert.equal(row.length, width, `row ${y} is ${row.length} wide, expected ${width}`));
  });

  test(`${key}: every character and building resolves to a real tile`, () => {
    assert.doesNotThrow(() => buildTileGrid(def, tileInfo));
  });

  const grid = buildTileGrid(def, tileInfo);
  const walkable = (x, y) => isWalkableTile(grid, tileInfo, x, y);
  const spawnTile = feetTiles(def.spawn)[0];
  const reachable = reachableFrom(grid, spawnTile);

  test(`${key}: spawn point is on walkable ground`, () => {
    for (const tile of feetTiles(def.spawn)) assert.ok(walkable(tile.x, tile.y), `spawn feet on solid tile ${tile.x},${tile.y}`);
  });

  test(`${key}: pickups use real items, on reachable ground`, () => {
    for (const pickup of def.pickups || []) {
      assert.ok(ITEMS[pickup.item], `${pickup.id} uses unknown item "${pickup.item}"`);
      assert.ok(walkable(pickup.x, pickup.y), `${pickup.id} is on a solid tile`);
      assert.ok(reachable(pickup.x, pickup.y), `${pickup.id} can't be reached from the spawn`);
    }
  });

  test(`${key}: NPCs stand on walkable ground and can be walked up to`, () => {
    for (const npc of def.npcs || []) {
      assert.ok(walkable(npc.x, npc.y), `${npc.id} stands on a solid tile`);
      const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => reachable(npc.x + dx, npc.y + dy));
      assert.ok(neighbours.length > 0, `${npc.id} can't be reached from the spawn`);
      assert.equal(typeof npc.talk, 'function', `${npc.id} has no talk()`);
    }
  });

  test(`${key}: doors are reachable and lead to walkable ground on a real map`, () => {
    for (const warp of def.warps || []) {
      const where = `door at ${warp.x},${warp.y}`;
      assert.ok(walkable(warp.x, warp.y), `${where} is on a solid tile`);
      assert.ok(reachable(warp.x, warp.y), `${where} can't be reached from the spawn`);

      const target = MAPS[warp.to];
      assert.ok(target, `${where} leads to unknown map "${warp.to}"`);
      const targetGrid = buildTileGrid(target, tileInfo);
      for (const tile of feetTiles(warp.spawn)) {
        assert.ok(isWalkableTile(targetGrid, tileInfo, tile.x, tile.y), `${where} lands on a solid tile in ${warp.to}`);
        const bounce = (target.warps || []).some((w) => w.x === tile.x && w.y === tile.y);
        assert.ok(!bounce, `${where} lands on a door in ${warp.to}, which would send the player straight back`);
      }
    }
  });
}
