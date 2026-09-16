const { test, expect } = require('@playwright/test');
const { openGame, startGame, teleport, holdKeys, waitForMap } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await startGame(page);
});

function speed(page) {
  return page.evaluate(() => {
    const { velocity } = game.scene.getScene('world').player.body;
    return Math.hypot(velocity.x, velocity.y);
  });
}

test('FB-0017: holding Shift runs outdoors, at about 1.75x walking speed', async ({ page }) => {
  await page.keyboard.down('d');
  await page.waitForTimeout(100);
  expect(await speed(page)).toBeCloseTo(80, 0);
  await page.keyboard.up('d');

  await page.keyboard.down('Shift');
  await page.keyboard.down('d');
  await page.waitForTimeout(100);
  expect(await speed(page)).toBeCloseTo(140, 0);
  await page.keyboard.up('d');
  await page.keyboard.up('Shift');
});

test('FB-0017: Shift has no effect indoors', async ({ page }) => {
  await teleport(page, 11, 13); // just below the house door
  await holdKeys(page, ['w'], 500);
  await waitForMap(page, 'house');
  await teleport(page, 10, 6); // open floor, away from any wall

  await page.keyboard.down('Shift');
  await page.keyboard.down('d');
  await page.waitForTimeout(100);
  expect(await speed(page)).toBeCloseTo(80, 0);
  await page.keyboard.up('d');
  await page.keyboard.up('Shift');
});

test('FB-0017: running diagonally is still normalised', async ({ page }) => {
  await page.keyboard.down('Shift');
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await page.waitForTimeout(100);
  expect(await speed(page)).toBeCloseTo(140, 0);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await page.keyboard.up('Shift');
});
