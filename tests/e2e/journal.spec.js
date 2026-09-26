// FB-0041a: JournalPanel.build() used to draw a fresh panel onto the same Graphics object every time
// it opened without clearing it first, and never capped its own height -- with enough (or long
// enough) entries it would just grow past the screen. Fixed with `panel.clear()` plus a capped,
// scrollable viewport (up/down).
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame } = require('./helpers');

const journalInfo = (page) => page.evaluate(() => {
  const j = game.scene.getScene('ui').journal;
  return { visible: j.visible, box: j.box, maxScroll: j.maxScroll, viewportH: j.viewportH, rowCount: j.rowTexts.length, panelCommands: j.panel.commandBuffer.length };
});

test('FB-0041a: opening the journal repeatedly does not redraw the panel on top of itself each time', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.evaluate(() => { GameState.journal.push('A clue.'); });

  await page.keyboard.press('j');
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(true);
  const first = (await journalInfo(page)).panelCommands;

  await page.keyboard.press('j'); // close
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(false);
  await page.keyboard.press('j'); // open again -> rebuild()
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(true);
  const second = (await journalInfo(page)).panelCommands;

  // Same number of draw commands every time -- proves clear() actually ran instead of piling another
  // copy of the panel's rectangles/border on top of the last one.
  expect(second).toBe(first);

  await page.keyboard.press('j'); // close
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(false);
  await page.keyboard.press('j'); // open a third time
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(true);
  const third = (await journalInfo(page)).panelCommands;
  expect(third).toBe(first);
});

test('FB-0041a: with 15 long entries, the journal panel stays inside 960x540 and becomes scrollable', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.evaluate(() => {
    for (let i = 0; i < 15; i++) {
      GameState.journal.push(`This is a fairly long journal entry number ${i}, written to force real wrapping across several lines so the whole list cannot possibly fit on one screen.`);
    }
  });

  await page.keyboard.press('j');
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(true);
  const info = await journalInfo(page);

  expect(info.rowCount).toBe(15);
  expect(info.maxScroll).toBeGreaterThan(0); // 15 long entries can't all fit -- it must scroll
  expect(info.box.y).toBeGreaterThanOrEqual(0);
  expect(info.box.x).toBeGreaterThanOrEqual(0);
  expect(info.box.y + info.box.h).toBeLessThanOrEqual(540);
  expect(info.box.x + info.box.w).toBeLessThanOrEqual(960);

  // Scrolling actually moves the rows: the first row's y decreases as we scroll down.
  const firstRowYBefore = await page.evaluate(() => game.scene.getScene('ui').journal.rowTexts[0].y);
  await page.keyboard.press('ArrowDown');
  const firstRowYAfter = await page.evaluate(() => game.scene.getScene('ui').journal.rowTexts[0].y);
  expect(firstRowYAfter).toBeLessThan(firstRowYBefore);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(false);
});
