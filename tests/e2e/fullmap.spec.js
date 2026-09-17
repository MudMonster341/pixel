// FB-0018: "I want it to show the whole map in full screen when I click on it." Clicking the
// minimap or pressing N opens a full-screen map overlay; Esc, N or clicking it again closes it.
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, pressUntil } = require('./helpers');

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
  await pressUntil(page, 'm', async () => (await state(page)).minimapVisible === false);
  await pressUntil(page, 'm', async () => (await state(page)).minimapVisible === true);
  expect((await state(page)).fullMapVisible).toBe(false);
});

// P5 QA: the campus has dozens of neighbouring OSM buildings with no real name, which
// tools/campus/build-campus.js falls back to labelling "Building <osm id>" (so they still render
// and collide correctly) -- the full-screen map used to label every one of those too, burying real
// names (Main Block, Gate 2, DIAC Park...) under a wall of illegible overlapping "Building
// 519043987"-style text. ui.js's FullMap now skips that exact placeholder pattern.
test('the full-screen map never labels a nameless neighbouring building, but keeps real names', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  await page.keyboard.press('n');
  await expect.poll(async () => (await state(page)).fullMapVisible).toBe(true);

  const labelTexts = await page.evaluate(() => game.scene.getScene('ui').fullMap.labels.list.map((t) => t.text));
  expect(labelTexts.some((text) => /^Building \d+$/.test(text))).toBe(false);
  expect(labelTexts).toContain('Main Block');
  expect(labelTexts).toContain('Gate 2');
});

// QA P5: on interior maps, a long caption like "MECHANICAL BLOCK - GROUND FLOOR" ran past the right
// edge of the minimap panel (see qa-shots/indoor-main-block-g-auditorium.png). Minimap.setLabel
// (ui.js) now shrinks the font (and truncates as a last resort) until the caption's own rendered
// bounds fit -- checked here against every real map name, not just the one or two visited in a
// normal playthrough.
test('the minimap caption always stays inside the panel, for every map in MAPS (no overflow past the right edge)', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  const results = await page.evaluate(() => {
    const mm = game.scene.getScene('ui').minimap;
    const panelRight = mm.area.x - 12 + mm.width; // the panel's own absolute right edge
    return Object.values(MAPS).map((def) => {
      mm.setLabel(def.name.toUpperCase());
      return { name: def.name, right: mm.label.x + mm.label.width, panelRight };
    });
  });

  expect(results.length).toBeGreaterThan(5); // sanity: MAPS actually resolved in the page
  for (const r of results) {
    expect(r.right, `"${r.name}"'s caption (right edge ${r.right}) overflows the minimap panel (right edge ${r.panelRight})`).toBeLessThanOrEqual(r.panelRight);
  }
});
