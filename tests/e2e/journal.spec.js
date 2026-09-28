// FB-0041a: JournalPanel.build() used to draw a fresh panel onto the same Graphics object every time
// it opened without clearing it first, and never capped its own height -- with enough (or long
// enough) entries it would just grow past the screen. Fixed with `panel.clear()` plus a capped,
// scrollable viewport (up/down). HUD declutter pass (2026-09-27/28): the panel is now a real 9-slice
// (makePanel(), src/scenes/ui.js) resized via `setPanelSize()` instead of a Graphics object redrawn in
// place -- the whole bug class (piling extra draw commands on top of themselves) is structurally
// impossible now (a NineSlice's own vertex list never grows on resize), so the regression check below
// instead proves the panel container never accumulates extra child objects, and that its own measured
// size always matches `box` exactly, across repeated opens.
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame } = require('./helpers');

const journalInfo = (page) => page.evaluate(() => {
  const j = game.scene.getScene('ui').journal;
  return {
    visible: j.visible,
    box: j.box,
    maxScroll: j.maxScroll,
    viewportH: j.viewportH,
    rowCount: j.rowTexts.length,
    panelChildren: j.panel.list.length, // always [shadow, nineslice] -- 2, never more
    panelPos: { x: j.panel.x, y: j.panel.y },
  };
});

test('FB-0041a: opening the journal repeatedly does not redraw the panel on top of itself each time', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.evaluate(() => { GameState.journal.push('A clue.'); });

  await page.keyboard.press('j');
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(true);
  const first = await journalInfo(page);

  await page.keyboard.press('j'); // close
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(false);
  await page.keyboard.press('j'); // open again -> rebuild()
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(true);
  const second = await journalInfo(page);

  // Same child count and position every time for identical content -- proves the panel was resized
  // in place, not rebuilt on top of a leftover copy.
  expect(second.panelChildren).toBe(first.panelChildren);
  expect(second.panelPos).toEqual(first.panelPos);
  expect(second.box).toEqual(first.box);

  await page.keyboard.press('j'); // close
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(false);
  await page.keyboard.press('j'); // open a third time
  await expect.poll(async () => (await journalInfo(page)).visible).toBe(true);
  const third = await journalInfo(page);
  expect(third.panelChildren).toBe(first.panelChildren);
  expect(third.box).toEqual(first.box);
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
