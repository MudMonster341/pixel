const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport, countItem } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await startGame(page);
});

test('walking over an item picks it up', async ({ page }) => {
  await teleport(page, 19, 12); // the apple is at 20,12
  await holdKey(page, 'd', 400);
  await expect.poll(async () => (await state(page)).slots[0]).toEqual({ item: 'apple', count: 1 });
  const s = await state(page);
  expect(s.toast).toBe('+1 Apple');
  expect(s.tutorial.completed).toContain('pickup');
});

test('picked-up items do not come back after leaving the map', async ({ page }) => {
  await teleport(page, 20, 12);
  await expect.poll(async () => countItem((await state(page)).slots, 'apple')).toBe(1);
  await page.evaluate(() => game.scene.getScene('world').scene.restart({ map: 'meadow' }));
  await expect.poll(() => page.evaluate(() => game.scene.getScene('world').pickups?.length)).toBe(3);
});

test('the same item stacks in one slot', async ({ page }) => {
  await teleport(page, 20, 12);
  await expect.poll(async () => countItem((await state(page)).slots, 'apple')).toBe(1);
  await teleport(page, 6, 17);
  await expect.poll(async () => (await state(page)).slots[0]).toEqual({ item: 'apple', count: 2 });
});

test('number keys, the mouse wheel and clicks select slots', async ({ page }) => {
  await page.keyboard.press('3');
  await expect.poll(async () => (await state(page)).selected).toBe(2);

  await page.mouse.move(480, 270);
  await page.mouse.wheel(0, 100);
  await expect.poll(async () => (await state(page)).selected).toBe(3);

  await page.mouse.click(368, 496); // center of slot 1 on the 960x540 canvas (48px slots, FB-0001)
  await expect.poll(async () => (await state(page)).selected).toBe(0);
  expect((await state(page)).tutorial.completed).toContain('select');
});
