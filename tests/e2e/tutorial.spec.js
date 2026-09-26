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

// FB-0036: `npc-talked` used to fire before DialogBox.open() ran, so Tutorial.complete('talk') (and
// therefore finish()'s "has the conversation actually closed" check) could run while dialog.isOpen
// was still false -- a beat *before* the box even opened, not after it closed. Talking to Tomas is
// only "done" once the box is actually open.
test('FB-0036: talking to an NPC only counts as done once the dialog box is actually open', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await holdKey(page, 'd', 1000);
  await page.keyboard.press('2');
  await teleport(page, 11, 13);
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
  await teleport(page, 8, 5);
  expect((await state(page)).tutorial.completed).not.toContain('talk');
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  expect((await state(page)).tutorial.completed).toContain('talk');
});

// FB-0036: Toast used to be a single overwrite-in-place slot -- a second message landing while the
// first was still on screen silently ate it before the player could read it (the tutorial's own
// "Tutorial complete!" clobbering Tomas's "You got the Old Sword!", or vice versa). It's a queue now:
// each message gets its own turn.
test('FB-0036: toast is a queue -- messages show one after another instead of clobbering each other', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    ui.toast.show('First message');
    ui.toast.show('Second message');
  });
  expect((await state(page)).toast).toBe('First message');
  await expect.poll(async () => (await state(page)).toast, { timeout: 4000 }).toBe('Second message');
});

test('FB-0036: identical consecutive toasts collapse instead of queuing duplicates', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    ui.toast.show('Repeat me');
    ui.toast.show('Repeat me');
    ui.toast.show('Repeat me');
  });
  expect((await state(page)).toast).toBe('Repeat me');
  const queueLength = await page.evaluate(() => game.scene.getScene('ui').toast.queue.length);
  expect(queueLength).toBe(0); // nothing queued -- they all collapsed into the one already showing
});

test('FB-0036: the toast queue is capped so it can never grow unbounded', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    for (let i = 0; i < 10; i++) ui.toast.show(`Message ${i}`);
  });
  const queueLength = await page.evaluate(() => game.scene.getScene('ui').toast.queue.length);
  expect(queueLength).toBeLessThanOrEqual(4);
});
