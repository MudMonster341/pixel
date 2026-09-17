// P4: the Gate 2 welcome cutscene. Cutscenes are off by default in openGame() (`?cutscene=0`, see
// helpers.js) so every other test's walk through Gate 2 isn't interrupted; these tests turn them
// back on explicitly with `cutscene: true`.
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, teleport } = require('./helpers');

// The trigger's centre tile, in the coordinate space teleport() expects.
const triggerCenter = (page) =>
  page.evaluate(() => {
    const t = game.scene.getScene('world').mapObjects.find((o) => o.type === 'cutscene');
    return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  });

test('walking into the Gate 2 trigger starts the cutscene and blocks movement until it ends', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);

  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);
  const during = await state(page);
  expect(during.worldActive).toBe(false);

  // The player can't move while it plays: try, then check nothing changed.
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  expect((await state(page)).x).toBe(during.x);
  expect((await state(page)).y).toBe(during.y);

  // Enter advances the typed lines (same feel as ordinary dialog): press until it closes.
  await expect.poll(async () => (await state(page)).cutsceneDialogOpen, { timeout: 10_000 }).toBe(true);
  for (let i = 0; i < 20 && (await state(page)).cutsceneActive; i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
  }

  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 10_000 }).toBe(false);
  const after = await state(page);
  expect(after.worldActive).toBe(true);
  expect(after.cutsceneDialogOpen).toBe(false);
  expect(after.seenCutscenes).toContain('gate2');
});

test('Esc skips the cutscene straight through to the end', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);
  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 5_000 }).toBe(false);
  const after = await state(page);
  expect(after.worldActive).toBe(true);
  expect(after.seenCutscenes).toContain('gate2');
});

test("it doesn't replay once seen", async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);
  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(false);

  // Step out of the trigger, then back in: it should not start a second time.
  await teleport(page, x, y - 20);
  await page.waitForTimeout(150);
  await teleport(page, x, y);
  await page.waitForTimeout(400);
  expect((await state(page)).cutsceneActive).toBe(false);
});

test('?cutscene=0 turns the cutscene off entirely', async ({ page }) => {
  await openGame(page, { map: null, cutscene: false });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);
  await page.waitForTimeout(500);
  expect((await state(page)).cutsceneActive).toBe(false);
});
