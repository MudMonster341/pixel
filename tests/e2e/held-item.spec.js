const { test, expect } = require('@playwright/test');
const { openGame, startGame } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page);
  await startGame(page);
});

function heldItem(page) {
  return page.evaluate(() => {
    const { heldItem, player } = game.scene.getScene('world');
    return { visible: heldItem.visible, x: heldItem.x, y: heldItem.y, playerX: player.x, playerY: player.y };
  });
}

test('FB-0002: selecting a slot with an item shows a held-item sprite near the player, and none for an empty slot', async ({ page }) => {
  await page.evaluate(() => GameState.inventory.add('apple'));
  await page.keyboard.press('1');
  let held = await heldItem(page);
  expect(held.visible).toBe(true);
  expect(Math.hypot(held.x - held.playerX, held.y - held.playerY)).toBeLessThan(16);

  // An empty slot shows no held-item sprite.
  await page.keyboard.press('5');
  held = await heldItem(page);
  expect(held.visible).toBe(false);
});

test('FB-0002: the held item follows the player while walking in all 4 directions', async ({ page }) => {
  await page.evaluate(() => GameState.inventory.add('sword'));
  await page.keyboard.press('1');

  for (const [key, facing] of [['d', 'right'], ['a', 'left'], ['w', 'up'], ['s', 'down']]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(120);
    await page.keyboard.up(key);
    const held = await heldItem(page);
    expect(held.visible).toBe(true);
    expect(Math.hypot(held.x - held.playerX, held.y - held.playerY)).toBeLessThan(16);
    const world = await page.evaluate(() => game.scene.getScene('world').facing);
    expect(world).toBe(facing);
  }
});
