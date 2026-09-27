// P4 / ADR 0016: the Gate 2 welcome. Cutscenes are off by default in openGame() (`?cutscene=0`, see
// helpers.js) so every other test's walk through Gate 2 isn't interrupted; these tests turn them
// back on explicitly with `cutscene: true`.
//
// FB-0032 rework: Gate 2 no longer cuts to a static illustration in a separate Phaser scene -- it now
// plays "Mustafa meets her" in-world (src/scripts.js SCRIPTS.gate2, run by WorldScene's own
// script runner, src/scripts-runtime.js). The trigger, the play-once bookkeeping (GameState.
// seenCutscenes) and the general shape ("something else owns the screen until it's done") are
// unchanged from before this ADR -- only what actually plays changed, so these tests keep asserting
// the same promises the old CutsceneScene-based version did, just through `worldScriptActive()`/
// `skipWorldScript()` (tests/e2e/helpers.js) instead of a second scene's own state.
const { test, expect } = require('@playwright/test');
const {
  openGame, state, startGame, teleport, worldScriptActive, skipWorldScript, pressUntil,
} = require('./helpers');

// The trigger's centre tile, in the coordinate space teleport() expects.
const triggerCenter = (page) =>
  page.evaluate(() => {
    const t = game.scene.getScene('world').mapObjects.find((o) => o.type === 'cutscene' && o.props.cutscene === 'gate2');
    return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  });

test('walking into the Gate 2 trigger starts the script and blocks movement until it ends', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);

  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);
  const during = await state(page);
  // Unlike the old CutsceneScene (which paused 'world' entirely), the world scene keeps running so
  // the camera can pan and Mustafa can walk -- but she still can't move herself.
  expect(during.worldActive).toBe(true);

  // The player can't move while it plays: try, then check nothing changed.
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  expect((await state(page)).x).toBe(during.x);
  expect((await state(page)).y).toBe(during.y);

  // E advances the typed lines (WorldScene's own dialog key, src/scenes/world.js onInteractKey() --
  // not Enter, which only drives the intro-*.js menu screens and DialogBox's own choice list). This
  // script has two separate `say` steps with a walk + camera pan in between (several real seconds
  // where no dialog is open at all and E is a harmless no-op) -- pressing for long enough to clear
  // both, not just the first.
  await expect.poll(async () => (await state(page)).cutsceneDialogOpen, { timeout: 10_000 }).toBe(true);
  for (let i = 0; i < 60 && (await state(page)).cutsceneActive; i++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(150);
  }

  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 10_000 }).toBe(false);
  const after = await state(page);
  expect(after.worldActive).toBe(true);
  expect(after.cutsceneDialogOpen).toBe(false);
  expect(after.seenCutscenes).toContain('gate2');
});

test('Esc skips the script straight through to the end', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);
  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);

  await skipWorldScript(page);
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
  await skipWorldScript(page);

  // Step out of the trigger, then back in: it should not start a second time.
  await teleport(page, x, y - 20);
  await page.waitForTimeout(150);
  await teleport(page, x, y);
  await page.waitForTimeout(400);
  expect((await state(page)).cutsceneActive).toBe(false);
});

test('?cutscene=0 turns the script off entirely', async ({ page }) => {
  await openGame(page, { map: null, cutscene: false });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);
  await page.waitForTimeout(500);
  expect((await state(page)).cutsceneActive).toBe(false);
  expect(await worldScriptActive(page)).toBe(false);
});

test('mashing keys during the script does not soft-lock it or the player afterward', async ({ page }) => {
  // Same shape as tests/e2e/robustness.spec.js's own mash test, kept here too since it's specific to
  // this exact trigger's own timing (dialog opening mid-camera-pan, an actor spawning/despawning).
  await openGame(page, { map: null, cutscene: true });
  await startGame(page);
  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);
  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);

  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift');
    await page.keyboard.press('e');
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await page.keyboard.press('m');
    await page.keyboard.press('n');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(30);
  }

  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 10_000 }).toBe(false);
  const after = await state(page);
  expect(after.worldActive).toBe(true);
  expect(after.cutsceneDialogOpen).toBe(false);
  expect(after.ready).toBe(true);

  // Still recoverable and playable afterward -- a real key press actually moves her.
  await pressUntil(page, 'Escape', async () => (await state(page)).pause.visible === false || (await state(page)).pause.visible === true);
  // Whatever state the mash left the pause menu in, Esc from here always resolves to "not blocking".
  for (let i = 0; i < 3 && (await state(page)).pause.visible; i++) await page.keyboard.press('Escape');
  const before = await state(page);
  await page.keyboard.down('s');
  await page.waitForTimeout(200);
  await page.keyboard.up('s');
  expect((await state(page)).y).toBeGreaterThanOrEqual(before.y);
});
