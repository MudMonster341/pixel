const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey } = require('./helpers');

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

test('the minimap shows the campus and follows the player', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  const label = await page.evaluate(() => game.scene.getScene('ui').minimap.label.text);
  expect(label).toBe('BITS DUBAI CAMPUS');
  const before = await page.evaluate(() => game.scene.getScene('ui').minimap.scrollY);
  await holdKey(page, 'w', 1500);
  await expect.poll(() => page.evaluate(() => game.scene.getScene('ui').minimap.scrollY)).toBeLessThan(before);
});
