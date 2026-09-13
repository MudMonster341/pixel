const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await startGame(page);
});

test('walks right and faces right', async ({ page }) => {
  const before = await state(page);
  await holdKey(page, 'd', 500);
  const after = await state(page);
  // 80 px/s for 0.5s ≈ 40px; wide margin because test machines have uneven frame timing
  expect(after.x - before.x).toBeGreaterThan(15);
  expect(after.x - before.x).toBeLessThan(70);
  expect(after.y).toBe(before.y);
  expect(after.facing).toBe('right');
});

test('arrow keys move too', async ({ page }) => {
  const before = await state(page);
  await holdKey(page, 'ArrowDown', 300);
  const after = await state(page);
  expect(after.y).toBeGreaterThan(before.y);
  expect(after.facing).toBe('down');
});

test('trees block the player', async ({ page }) => {
  await teleport(page, 17, 2); // on the path, just below the tree border
  await holdKey(page, 'w', 1200);
  const s = await state(page);
  expect(s.y).toBeGreaterThanOrEqual(13);
  expect(s.y).toBeLessThanOrEqual(15);
});

test('water blocks the player', async ({ page }) => {
  await teleport(page, 10, 17); // just above the lake
  await holdKey(page, 's', 1200);
  expect((await state(page)).y).toBeLessThan(19 * 16);
});

test('moving diagonally is not faster than straight', async ({ page }) => {
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await page.waitForTimeout(150);
  const speed = await page.evaluate(() => {
    const { velocity } = game.scene.getScene('world').player.body;
    return Math.hypot(velocity.x, velocity.y);
  });
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  expect(speed).toBeCloseTo(80, 0);
});
