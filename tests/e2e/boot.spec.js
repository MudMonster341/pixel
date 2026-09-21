const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, pressUntil } = require('./helpers');

test('boots on the meadow ready to play immediately, with no errors', async ({ page }) => {
  const { errors } = await openGame(page);
  const s = await state(page);
  expect(s.map).toBe('meadow');
  // FB-0023: no more blocking "controls card" -- the meadow's own tutorial checklist starts
  // straight in 'steps', and the player can already move (see the next test).
  expect(s.tutorial.stage).toBe('steps');
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('FB-0023: the player can move immediately, with no card to dismiss first', async ({ page }) => {
  await openGame(page);
  const before = await state(page);
  await holdKey(page, 'd', 400);
  expect((await state(page)).x).toBeGreaterThan(before.x);
});

test('M hides and shows the minimap', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await pressUntil(page, 'm', async () => (await state(page)).minimapVisible === false);
  await pressUntil(page, 'm', async () => (await state(page)).minimapVisible === true);
});
