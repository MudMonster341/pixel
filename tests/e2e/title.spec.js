// FB-0023 (UI: the controls card overflowed and blocked the start of the game) and FB-0024 (game
// design: study Pokemon's own flow -- title, loading, in-fiction hints, pause). See docs/GAME_FEEL.md
// for the rules this whole file checks against. Every other spec skips this flow with `?title=0`
// (tests/e2e/helpers.js openGame() default); this file is the one place that turns it back on.
const { test, expect } = require('@playwright/test');
const {
  openGame, openTitle, titleState, chooseTitleMenu, waitForBoot, state, startGame, holdKey, teleport, waitForMap,
} = require('./helpers');

test('FB-0024: the title screen appears first, and Play starts a new game through a real loading screen', async ({ page }) => {
  const { errors } = await openTitle(page, { map: null });
  const before = await titleState(page);
  expect(before.menuItems).toEqual(['play', 'controls', 'credits']); // no save yet: no Continue

  await chooseTitleMenu(page, 'play');
  // The branded loading screen (src/main.js BootScene) actually runs -- this isn't just "boot"
  // finishing so fast nothing shows: the campus map alone is a real, non-trivial load.
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('boot'))).toBe(true);
  await waitForBoot(page);

  const s = await state(page);
  expect(s.map).toBe('campus');
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('FB-0024: Continue only appears once a save exists, and resumes on the saved map', async ({ page }) => {
  const profile = `e2e-title-continue-${Date.now()}`;

  // No save yet for a brand new profile.
  const fresh = await openTitle(page, { save: true, profile });
  expect((await titleState(page)).menuItems).not.toContain('continue');

  // Build a save on the house map, via the fast (title-off) path every other spec uses.
  await openGame(page, { map: 'meadow', save: true, profile });
  await startGame(page);
  await teleport(page, 11, 13);
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
  await expect.poll(async () => page.evaluate(
    (p) => JSON.parse(localStorage.getItem(`pixelquest.save.v1.${p}`) || 'null')?.state?.map,
    profile,
  )).toBe('house');

  // Fresh navigation, title on, no explicit ?map= -- Continue must land on the saved map, not
  // whatever a map default would otherwise pick.
  await openTitle(page, { save: true, profile });
  expect((await titleState(page)).menuItems).toContain('continue');

  await chooseTitleMenu(page, 'continue');
  await waitForBoot(page);
  expect((await state(page)).map).toBe('house');
});

test('FB-0023: Esc opens the pause menu; Resume closes it and movement still works', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  expect((await state(page)).pause.view).toBe('menu');

  await page.keyboard.press('Enter'); // Resume is the default highlighted item
  await expect.poll(async () => (await state(page)).pause.visible).toBe(false);

  const before = await state(page);
  await holdKey(page, 'd', 300);
  expect((await state(page)).x).toBeGreaterThan(before.x);
});

test('FB-0023: the controls panel fits inside its own frame at 960x540 and two other window sizes', async ({ page }) => {
  test.info().annotations.push({ type: 'issue', description: 'FB-0023' });
  await openGame(page, { map: null });
  await startGame(page);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  await page.keyboard.press('ArrowDown'); // Resume -> Controls
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).pause.controlsVisible).toBe(true);

  try {
    for (const size of [{ width: 960, height: 540 }, { width: 1400, height: 800 }, { width: 700, height: 1000 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(100); // let Phaser's Scale Manager refit
      const fit = await page.evaluate(() => {
        const cp = game.scene.getScene('ui').pause.controls;
        const bounds = [cp.title, ...cp.rowTexts, cp.footer].map((t) => t.getBounds());
        return {
          box: cp.box,
          maxRight: Math.max(...bounds.map((b) => b.right)),
          maxBottom: Math.max(...bounds.map((b) => b.bottom)),
          minLeft: Math.min(...bounds.map((b) => b.left)),
          minTop: Math.min(...bounds.map((b) => b.top)),
        };
      });
      // Internal UI coordinates never depend on the real window size (Phaser Scale.FIT, fixed
      // 960x540 canvas) -- this holds identically at every size, which is exactly the point.
      expect(fit.minLeft).toBeGreaterThanOrEqual(fit.box.x);
      expect(fit.minTop).toBeGreaterThanOrEqual(fit.box.y);
      expect(fit.maxRight).toBeLessThanOrEqual(fit.box.x + fit.box.w);
      expect(fit.maxBottom).toBeLessThanOrEqual(fit.box.y + fit.box.h);
    }
  } finally {
    await page.setViewportSize({ width: 960, height: 540 }).catch(() => {});
  }
});

test('FB-0023: each first-time hint shows once, is remembered in the save, and never shows again after a reload', async ({ page }) => {
  const profile = `e2e-hints-${Date.now()}`;
  await openGame(page, { map: 'meadow', save: true, profile });
  await startGame(page);

  // "WASD to move" fires the moment she's placed into a controllable world (world.js create()).
  await expect.poll(async () => (await state(page)).seenHints).toContain('move');
  await expect.poll(async () => (await state(page)).seenHints).toContain('run'); // meadow is outdoors
  const shownOnce = (await state(page)).seenHints;
  expect(shownOnce.filter((id) => id === 'move')).toHaveLength(1); // a Set under the hood: never twice

  // Persisted, not just in-memory for this page.
  await expect.poll(async () => {
    const saved = await page.evaluate((p) => JSON.parse(localStorage.getItem(`pixelquest.save.v1.${p}`) || 'null'), profile);
    return saved?.state?.seenHints || [];
  }).toEqual(expect.arrayContaining(['move', 'run']));

  await page.reload();
  await waitForBoot(page);
  // world.js unconditionally re-emits 'hint':'move'/'run' on every map load; HintBanner must have
  // swallowed both as already-seen, so nothing is queued or showing this time around.
  const after = await page.evaluate(() => {
    const hints = game.scene.getScene('ui').hints;
    return { showing: hints.showing, queueLength: hints.queue.length, alpha: hints.panel.alpha };
  });
  expect(after.showing).toBeNull();
  expect(after.queueLength).toBe(0);
  expect(after.alpha).toBe(0);
  expect((await state(page)).seenHints).toEqual(expect.arrayContaining(['move', 'run']));
});
