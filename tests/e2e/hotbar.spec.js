const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport, waitForMap } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await startGame(page);
});

test('FB-0001: the hotbar becomes translucent when the player is behind it', async ({ page }) => {
  await teleport(page, 11, 13); // just below the house door
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');

  // The house room is only a little taller than the camera view, so standing on its bottom row
  // puts the player's on-screen position right behind the hotbar at the foot of the screen.
  await teleport(page, 10, 10);
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').hotbar.alpha)).toBeLessThan(1);

  // Walk away from the bottom of the room: the bar should return to full opacity.
  await teleport(page, 10, 2);
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').hotbar.alpha)).toBe(1);
});

test('the hotbar stays fully visible outdoors, away from its own footprint', async ({ page }) => {
  const s = await state(page);
  expect(s.map).toBe('meadow');
  expect(await page.evaluate(() => game.scene.getScene('ui').hotbar.alpha)).toBe(1);
});
