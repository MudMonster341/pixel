// Building interiors (P3, docs/INTERIORS_PLAN.md): walking from the campus into the Main Block and
// the Library Block, taking the stairs, and walking back out. Uses the real key presses/timings the
// other specs use; teleports the player near a door/stairs object (found by reading
// `world.mapObjects`, the same way tests/e2e/campus.spec.js finds the Main Block door).
const { test, expect } = require('@playwright/test');
const { openGame, startGame, state, holdKey, teleport, waitForMap } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page, { map: null }); // start on the campus
  await startGame(page);
});

// A door/stairs object's tile position, on the CURRENT map.
function findDoor(page, building) {
  return page.evaluate((building) => {
    const world = game.scene.getScene('world');
    const o = world.mapObjects.find((o) => o.type === 'door' && o.props.building === building);
    return { x: Math.floor(o.x), y: Math.floor(o.y) };
  }, building);
}

function findExit(page) {
  return page.evaluate(() => {
    const world = game.scene.getScene('world');
    const o = world.mapObjects.find((o) => o.type === 'door' && o.props.to === 'campus');
    return { x: Math.floor(o.x), y: Math.floor(o.y), facing: o.props.facing };
  });
}

function findStairs(page, dir) {
  return page.evaluate((dir) => {
    const world = game.scene.getScene('world');
    const o = world.mapObjects.find((o) => o.type === 'stairs' && o.name.toLowerCase().includes(`(${dir})`));
    return o ? { x: Math.floor(o.x), y: Math.floor(o.y) } : null;
  }, dir);
}

function speed(page) {
  return page.evaluate(() => {
    const { velocity } = game.scene.getScene('world').player.body;
    return Math.hypot(velocity.x, velocity.y);
  });
}

// Warp trigger objects (doors/stairs) fire as soon as the player's feet tile matches, regardless of
// which key (if any) is held, so standing exactly on one and letting a few frames pass is enough.
async function stepOnto(page, tile) {
  await teleport(page, tile.x, tile.y);
  await page.waitForTimeout(400);
}

test('walking into the Main Block leads to the ground floor, up and back down the stairs, and back out to campus', async ({ page }) => {
  const door = await findDoor(page, 'Main Block');
  await teleport(page, door.x, door.y + 2); // just south of the door, campus side
  await holdKey(page, 'w', 800);
  await waitForMap(page, 'main-block-g');
  expect((await state(page)).ready).toBe(true);

  // docs/STORY.md "Rules for the world": the stairs up are locked until the volunteer has actually
  // given the quest (interiors.spec.js covers the *locked* case) -- simulate having talked to
  // him already, the same way tests/e2e/story.spec.js's own playthrough does it for real.
  await page.evaluate(() => { GameState.quest.stage = 'hunting'; });

  // FB-0017: no running indoors.
  await page.keyboard.down('Shift');
  await page.keyboard.down('d');
  await page.waitForTimeout(100);
  expect(await speed(page)).toBeCloseTo(80, 0);
  await page.keyboard.up('d');
  await page.keyboard.up('Shift');

  // Up the stairs to the 1st floor.
  const up = await findStairs(page, 'up');
  expect(up).toBeTruthy();
  await stepOnto(page, up);
  await waitForMap(page, 'main-block-1');
  expect((await state(page)).ready).toBe(true);

  // Back down to the ground floor.
  const down = await findStairs(page, 'down');
  expect(down).toBeTruthy();
  await stepOnto(page, down);
  await waitForMap(page, 'main-block-g');

  // And back out through the entrance onto the campus, in front of the Main Block.
  const exit = await findExit(page);
  await stepOnto(page, exit);
  await waitForMap(page, 'campus');
  const back = await state(page);
  // The campus door's `facing` ('down') is the direction landed players face, so the interior exit
  // lands one tile further along that direction from the door itself (world.js `resolveSpawnAt`).
  expect(back.tile).toEqual({ x: door.x, y: door.y + 1 });
  expect(back.facing).toBe('down');
});

// locked doors: docs/STORY.md "Rules for the world" -- the Library Block isn't part of the LUG
// treasure hunt at all, so it's permanently blocked (src/maps.js campus `doorLocks`), not just
// gated behind a stage. This replaces the old "walk in and back out" coverage from before the story
// existed: walking in should now fail, with a toast saying why, and no map change at all.
test('locked doors: the Library Block entrance is permanently locked, with a toast, not a silent wall', async ({ page }) => {
  const door = await findDoor(page, 'Library Block');
  await teleport(page, door.x, door.y + 2);
  await holdKey(page, 'w', 800);
  const after = await state(page);
  expect(after.map).toBe('campus'); // never actually transitioned
  expect(after.toast).toBe('Locked for the event');
});
