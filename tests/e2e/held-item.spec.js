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

// The held-item sprite is only (re)drawn inside WorldScene.update() -> updateHeldItem(), once per
// Phaser tick, not synchronously when the hotbar selection changes. Reading it right after a
// keypress (with no wait, or a fixed wait) is a timing assumption: it bets a tick has already run.
// Under a loaded/throttled machine a tick can be delayed well past a short fixed wait (ERR-0002),
// so `expect.poll` re-reads until the sprite catches up, without weakening what's actually checked.
async function pollVisible(page, expected) {
  await expect.poll(async () => (await heldItem(page)).visible).toBe(expected);
}

test('FB-0002: selecting a slot with an item shows a held-item sprite near the player, and none for an empty slot', async ({ page }) => {
  await page.evaluate(() => GameState.inventory.add('apple'));
  await page.keyboard.press('1');
  await pollVisible(page, true);
  let held = await heldItem(page);
  expect(held.visible).toBe(true);
  expect(Math.hypot(held.x - held.playerX, held.y - held.playerY)).toBeLessThan(16);

  // An empty slot shows no held-item sprite.
  await page.keyboard.press('5');
  await pollVisible(page, false);
  held = await heldItem(page);
  expect(held.visible).toBe(false);
});

test('FB-0002: the held item follows the player while walking in all 4 directions', async ({ page }) => {
  await page.evaluate(() => GameState.inventory.add('sword'));
  await page.keyboard.press('1');
  await pollVisible(page, true);

  for (const [key, facing] of [['d', 'right'], ['a', 'left'], ['w', 'up'], ['s', 'down']]) {
    await page.keyboard.down(key);
    // Wait for the facing the movement should produce, rather than a fixed sleep: this is exactly
    // the state the assertions below depend on, so polling it directly can't be too short or too
    // long the way a guessed `waitForTimeout` can.
    await expect.poll(() => page.evaluate(() => game.scene.getScene('world').facing)).toBe(facing);
    const held = await heldItem(page);
    expect(held.visible).toBe(true);
    expect(Math.hypot(held.x - held.playerX, held.y - held.playerY)).toBeLessThan(16);
    await page.keyboard.up(key);
  }
});
