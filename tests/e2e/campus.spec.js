const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport } = require('./helpers');

const areaCenter = (page, name) =>
  page.evaluate((n) => {
    const o = game.scene.getScene('world').mapObjects.find((obj) => obj.type === 'area' && obj.name === n);
    return { x: o.x + o.width / 2, y: o.y + o.height / 2 };
  }, name);

const spawnTile = (page) =>
  page.evaluate(() => {
    const spawn = game.scene.getScene('world').mapObjects.find((o) => o.type === 'spawn');
    return { x: Math.floor(spawn.x), y: Math.floor(spawn.y) };
  });

test('the game starts on the campus at the main gate, without errors', async ({ page }) => {
  const { errors } = await openGame(page, { map: null });
  const s = await state(page);
  expect(s.map).toBe('campus');
  expect(s.tile).toEqual(await spawnTile(page));
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('the player can walk from the gate into campus', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  const before = await state(page);
  await holdKey(page, 'w', 800);
  expect((await state(page)).y).toBeLessThan(before.y - 20);
});

test('the campus has no test-map tutorial checklist', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  const s = await state(page);
  expect(s.tutorial.stage).toBe('done');
  expect(await page.evaluate(() => game.scene.getScene('ui').tutorial.checklist.visible)).toBe(false);
});

// FB-0008/FB-0010: Gate 2's straight approach avenue actually leads a walking player to the Main
// Block. Walks the first stretch for real from the spawn, then (to keep the test fast) teleports
// the rest of the way up the same straight avenue and walks the final approach into the door.
test('the player can walk from the Gate 2 spawn up to the Main Block entrance', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  const door = await page.evaluate(() => {
    const world = game.scene.getScene('world');
    const d = world.mapObjects.find((o) => o.type === 'door' && o.props.building === 'Main Block');
    return { x: Math.floor(d.x), y: Math.floor(d.y) };
  });

  const before = await state(page);
  await holdKey(page, 'w', 1500);
  expect((await state(page)).y).toBeLessThan(before.y - 30);

  await teleport(page, door.x, door.y + 8);
  await holdKey(page, 'w', 3000);
  const after = await state(page);
  expect(after.tile.y).toBeLessThanOrEqual(door.y + 2);
  expect(Math.abs(after.tile.x - door.x)).toBeLessThanOrEqual(3);
});

// P4: location banner (Pokemon-style name plate). Shown on map start, and again when the player
// crosses into a differently-named area object, but not a second time while still inside it.
test('the location banner announces the campus on start, then a specific area when you enter it', async ({ page }) => {
  await openGame(page, { map: null });
  await expect.poll(async () => (await state(page)).locationBanner).toEqual({ visible: true, text: 'BITS DUBAI CAMPUS' });

  await startGame(page);
  const { x, y } = await areaCenter(page, 'Student Parking');
  await teleport(page, x, y);
  await expect.poll(async () => (await state(page)).locationBanner).toEqual({ visible: true, text: 'STUDENT PARKING' });

  // It hides itself after a couple of seconds, and doesn't come back while the player never left.
  await expect.poll(async () => (await state(page)).locationBanner.visible, { timeout: 5_000 }).toBe(false);
  await page.waitForTimeout(600);
  expect((await state(page)).locationBanner).toEqual({ visible: false, text: 'STUDENT PARKING' });
});

test('the minimap shows the campus and follows the player', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  const label = await page.evaluate(() => game.scene.getScene('ui').minimap.label.text);
  expect(label).toBe('BITS DUBAI CAMPUS');
  const before = await page.evaluate(() => game.scene.getScene('ui').minimap.scrollY);
  await holdKey(page, 'w', 1500);
  await expect.poll(() => page.evaluate(() => game.scene.getScene('ui').minimap.scrollY)).toBeLessThan(before);
});
