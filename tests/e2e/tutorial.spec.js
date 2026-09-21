const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport, waitForMap, finishDialog } = require('./helpers');

test('completing every step finishes the tutorial', async ({ page }) => {
  await openGame(page);
  await startGame(page);

  await holdKey(page, 'd', 1000); // walks far enough and over the apple at 20,12
  await page.keyboard.press('2');
  await teleport(page, 11, 13);
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
  await teleport(page, 8, 5);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  await finishDialog(page);

  const s = await state(page);
  expect([...s.tutorial.completed].sort()).toEqual(['enter', 'move', 'pickup', 'select', 'talk']);
  expect(s.tutorial.stage).toBe('done');
  await expect.poll(async () => (await state(page)).toast, { timeout: 8000 }).toBe('Tutorial complete!');
});

// FB-0023: Escape used to skip the tutorial checklist directly; it now opens the pause menu instead
// (tests/e2e/title.spec.js covers pause itself), so the checklist just keeps running in the
// background until its own steps are completed or the map changes away from it.
test('Escape opens the pause menu instead of skipping the tutorial', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  expect((await state(page)).tutorial.stage).toBe('steps');
});
