// FB-0018: "I want it to show the whole map in full screen when I click on it." Clicking the
// minimap or pressing N opens a full-screen map overlay; Esc, N or clicking it again closes it.
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey } = require('./helpers');

// The minimap's own play area (see ui.js Minimap: x+12..x+12+160, y+12..y+12+120 from (16,16)),
// in page coordinates — the 960x540 viewport matches canvas pixels 1:1 (playwright.config.js).
const MINIMAP_CLICK = { x: 108, y: 88 };

test('FB-0018: clicking the minimap opens the full-screen map, N/Esc closes it', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  expect((await state(page)).fullMapVisible).toBe(false);

  await page.mouse.click(MINIMAP_CLICK.x, MINIMAP_CLICK.y);
  await expect.poll(async () => (await state(page)).fullMapVisible).toBe(true);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).fullMapVisible).toBe(false);

  await page.mouse.click(MINIMAP_CLICK.x, MINIMAP_CLICK.y);
  await expect.poll(async () => (await state(page)).fullMapVisible).toBe(true);

  await page.keyboard.press('n');
  await expect.poll(async () => (await state(page)).fullMapVisible).toBe(false);
});

test('N opens and closes the full-screen map, and blocks movement while open', async ({ page }) => {
  await openGame(page); // meadow
  await startGame(page);

  await page.keyboard.press('n');
  await expect.poll(async () => (await state(page)).fullMapVisible).toBe(true);

  const before = await state(page);
  await holdKey(page, 'd', 300);
  const after = await state(page);
  expect(after.x).toBe(before.x);
  expect(after.y).toBe(before.y);

  await page.keyboard.press('n');
  await expect.poll(async () => (await state(page)).fullMapVisible).toBe(false);
});

test('M keeps toggling the minimap show/hide (unaffected by the N full-screen map)', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).minimapVisible).toBe(false);
  await page.keyboard.press('m');
  await expect.poll(async () => (await state(page)).minimapVisible).toBe(true);
  expect((await state(page)).fullMapVisible).toBe(false);
});
