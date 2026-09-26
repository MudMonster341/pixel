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

// FB-0043 ("I look like I'm walking left when I'm walking right"): the sheet used to have only 3
// real rows (down/up/left) and mirror "left" for "right" with flipX -- but the row it mirrored was
// actually the pack's *right*-facing block mislabeled "left" (ERR-0007), so both directions ended up
// wrong. Now there are 4 real rows and the player sprite is never flipped at all: walking right must
// play the real 'walk-right' animation with flipX false, and walking left must play 'walk-left', also
// unflipped.
// Read the animation *while still holding the key*, not after holdKey() has already released it --
// releasing switches her straight to the idle animation (still facing the same way), so reading
// afterward would just be checking idle-right/idle-left, not the walk row this is actually about.
async function animWhileHolding(page, key) {
  await page.keyboard.down(key);
  await expect.poll(() => page.evaluate(() => game.scene.getScene('world').player.anims.currentAnim?.key))
    .toMatch(/^walk-/);
  const info = await page.evaluate(() => {
    const { player } = game.scene.getScene('world');
    return { flipX: player.flipX, anim: player.anims.currentAnim && player.anims.currentAnim.key };
  });
  await page.keyboard.up(key);
  return info;
}

test('FB-0043: walking right plays the real walk-right row, not a flipped walk-left', async ({ page }) => {
  const info = await animWhileHolding(page, 'd');
  expect(info.flipX).toBe(false);
  expect(info.anim).toBe('walk-right');
});

test('FB-0043: walking left plays the real walk-left row, unflipped', async ({ page }) => {
  const info = await animWhileHolding(page, 'a');
  expect(info.flipX).toBe(false);
  expect(info.anim).toBe('walk-left');
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

test('FB-0025: the lead\'s physics body still only covers her feet on the taller 16x24 frame', async ({ page }) => {
  const body = await page.evaluate(() => {
    const { player } = game.scene.getScene('world');
    return { width: player.body.width, height: player.body.height, offsetY: player.body.offset.y, frameHeight: player.height };
  });
  expect(body.frameHeight).toBe(24);
  // A small box (feet only), sitting in the lower part of the 24-tall frame -- the head and torso
  // above it don't collide (docs/STYLE_GUIDE.md, "only the feet collide" in world.js createPlayer()).
  expect(body.height).toBeLessThanOrEqual(8);
  expect(body.offsetY).toBeGreaterThan(body.frameHeight / 2);
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
