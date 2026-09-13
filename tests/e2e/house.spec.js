const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport, waitForMap, finishDialog, countItem } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await startGame(page);
});

async function enterHouse(page) {
  await teleport(page, 11, 13); // just below the door
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
}

test('the door leads into the house and back out', async ({ page }) => {
  await enterHouse(page);
  const inside = await state(page);
  expect(inside).toMatchObject({ x: 160, y: 168, facing: 'up' });

  await holdKey(page, 's', 600);
  await waitForMap(page, 'meadow');
  expect((await state(page)).tile).toEqual({ x: 11, y: 13 });
});

test('walking at the door slightly off-center still goes in', async ({ page }) => {
  await page.evaluate(() => game.scene.getScene('world').player.body.reset(190, 216)); // 6px right of center
  await holdKey(page, 'w', 800);
  await waitForMap(page, 'house');
});

test('the E prompt shows only near Tomas', async ({ page }) => {
  await enterHouse(page);
  expect((await state(page)).promptVisible).toBe(false);
  await teleport(page, 8, 5);
  await expect.poll(async () => (await state(page)).promptVisible).toBe(true);
});

test('Tomas gives the Old Sword once, then just chats', async ({ page }) => {
  await enterHouse(page);
  await teleport(page, 8, 5);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  await finishDialog(page);

  let s = await state(page);
  expect(countItem(s.slots, 'sword')).toBe(1);
  expect(s.toast).toBe('You got the Old Sword!');
  expect(s.tutorial.completed).toContain('talk');

  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  await finishDialog(page);
  s = await state(page);
  expect(countItem(s.slots, 'sword')).toBe(1);
});

test('the player cannot walk while talking', async ({ page }) => {
  await enterHouse(page);
  await teleport(page, 8, 5);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  const before = await state(page);
  await holdKey(page, 's', 300);
  expect((await state(page)).y).toBe(before.y);
});
