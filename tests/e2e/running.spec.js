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

// A fixed `waitForTimeout` before reading the physics body's velocity is a timing assumption: it
// bets that at least one Phaser update tick has run inside that wall-clock window. Under a loaded
// or throttled machine (seen in CI and when running many tests back to back, ERR-0002) a frame can
// take much longer than 100ms to land, so the read races the engine and occasionally catches the
// stale (pre-keypress) velocity. `expect.poll` re-reads the velocity until it settles on the
// expected speed (or the assertion's own timeout expires for a real bug), which is exactly as
// strict about the end value but never depends on how fast frames happen to arrive.
async function expectSpeed(page, target) {
  await expect.poll(() => speed(page)).toBeCloseTo(target, 0);
}

test('FB-0017: holding Shift runs outdoors, at about 1.75x walking speed', async ({ page }) => {
  await page.keyboard.down('d');
  await expectSpeed(page, 80);
  await page.keyboard.up('d');

  await page.keyboard.down('Shift');
  await page.keyboard.down('d');
  await expectSpeed(page, 140);
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
  await expectSpeed(page, 80);
  await page.keyboard.up('d');
  await page.keyboard.up('Shift');
});

test('FB-0017: running diagonally is still normalised', async ({ page }) => {
  await page.keyboard.down('Shift');
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await expectSpeed(page, 140);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  await page.keyboard.up('Shift');
});
