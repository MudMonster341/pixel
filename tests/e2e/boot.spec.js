const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey } = require('./helpers');

test('boots on the meadow with the controls card and no errors', async ({ page }) => {
  const { errors } = await openGame(page);
  const s = await state(page);
  expect(s.map).toBe('meadow');
  expect(s.tutorial).toMatchObject({ stage: 'intro', cardOpen: true });
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('the player cannot move until the controls card is closed', async ({ page }) => {
  await openGame(page);
  const before = await state(page);
  await holdKey(page, 'd', 400);
  expect((await state(page)).x).toBe(before.x);

  await startGame(page);
  expect((await state(page)).tutorial.stage).toBe('steps');
});

test('H reopens the controls card and Enter closes it again', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.keyboard.press('h');
  await expect.poll(async () => (await state(page)).tutorial.cardOpen).toBe(true);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).tutorial.cardOpen).toBe(false);
  expect((await state(page)).tutorial.stage).toBe('steps');
});

test('M hides and shows the minimap', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).minimapVisible).toBe(false);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).minimapVisible).toBe(true);
});
