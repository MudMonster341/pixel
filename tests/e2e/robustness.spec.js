// P5 QA: robustness checks from docs/QA_PLAN.md section 4 (performance and robustness) that had no
// automated coverage yet -- resizing the window, mashing keys during a fade/warp/cutscene, and
// walking into a map's edges.
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, holdKeys, teleport, waitForMap } = require('./helpers');

// ---------- Resizing keeps the game letterboxed (Phaser.Scale.FIT + CENTER_BOTH, src/main.js) ----------

test.describe('window resize', () => {
  test.afterEach(async ({ page }) => {
    // Leave the shared browser context at a normal size for any test that runs after this file.
    await page.setViewportSize({ width: 960, height: 540 }).catch(() => {});
  });

  test('resizing to a wider and a taller window keeps the canvas at the game aspect ratio, centered', async ({ page }) => {
    await openGame(page, { map: null });
    await startGame(page);
    const GAME_RATIO = 960 / 540;

    for (const size of [{ width: 1400, height: 600 }, { width: 500, height: 900 }, { width: 960, height: 540 }]) {
      await page.setViewportSize(size);
      // Phaser's Scale Manager refits on the browser's own resize event; give it a moment.
      await page.waitForTimeout(150);
      const box = await page.evaluate(() => document.querySelector('canvas').getBoundingClientRect());
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
      expect(box.width / box.height).toBeCloseTo(GAME_RATIO, 1);
      // Letterboxed = centered in the viewport, not stretched to fill it off-ratio.
      const leftGap = box.left;
      const rightGap = size.width - box.right;
      const topGap = box.top;
      const bottomGap = size.height - box.bottom;
      expect(Math.abs(leftGap - rightGap)).toBeLessThan(2);
      expect(Math.abs(topGap - bottomGap)).toBeLessThan(2);
    }

    // The game itself is still playable after being resized (not stuck/broken by the resize).
    const before = await state(page);
    await holdKey(page, 'd', 400);
    expect((await state(page)).x).toBeGreaterThan(before.x);
  });
});

// ---------- Rapid key mashing during a fade/warp/cutscene doesn't soft-lock the player ----------

test.describe('rapid key mashing does not soft-lock', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page);
    await startGame(page);
  });

  // Every UI/interact key a bored/impatient player might hammer during a fade or cutscene: run,
  // interact, minimap, full map, controls card and Esc. Deliberately *not* the movement keys here --
  // mashing those at a door threshold would just legitimately walk the player back and forth through
  // it, which is a test-design artifact (repeated real warps), not the soft-lock this checks for.
  // The Gate 2 cutscene test below does mash movement too, safely, because the cutscene fully pauses
  // the world scene first, so movement input has nothing to act on until control returns.
  async function mashKeys(page, times, keys = ['Shift', 'e', 'Space', 'Enter', 'm', 'n', 'h', 'Escape']) {
    for (let i = 0; i < times; i++) {
      for (const key of keys) await page.keyboard.down(key);
      for (const key of keys) await page.keyboard.up(key);
    }
  }

  test('mashing keys during the house door fade does not soft-lock movement afterward', async ({ page }) => {
    // Walk into the door for real first, so the warp actually triggers (world.js sets
    // `transitioning = true` and starts the 250ms camera fade) -- then hammer every other key while
    // that fade/restart is in flight, which is the moment a soft-lock would show up.
    await teleport(page, 11, 13); // just below the house door
    await holdKey(page, 'w', 500); // the same approach house.spec.js's enterHouse() uses, reliably
    await expect.poll(async () => (await state(page)).map === 'house' || !(await state(page)).ready).toBe(true);
    await mashKeys(page, 8);
    await waitForMap(page, 'house');

    await expect.poll(async () => (await state(page)).ready).toBe(true);
    // Not soft-locked: any toggle key mashing left open (tutorial card, full map) is closed first,
    // exactly as a player recovering from a panic-mash would do, then ordinary movement must work.
    for (const key of ['Escape', 'Enter']) await page.keyboard.press(key);
    await expect.poll(async () => {
      const s = await state(page);
      return !s.tutorial.cardOpen && !s.fullMapVisible && !s.dialogOpen;
    }).toBe(true);
    const before = await state(page);
    await holdKey(page, 's', 400);
    expect((await state(page)).y).toBeGreaterThan(before.y);
  });

  test('mashing keys during the Gate 2 cutscene does not soft-lock it or the player afterward', async ({ page }) => {
    // This test wants the cutscene, unlike the default helper (which turns it off for every other
    // spec so an incidental walk through Gate 2 doesn't interrupt it).
    await openGame(page, { map: null, cutscene: true });
    await startGame(page);
    const { x, y } = await page.evaluate(() => {
      const t = game.scene.getScene('world').mapObjects.find((o) => o.type === 'cutscene');
      return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
    });
    await teleport(page, x, y);
    await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);

    await mashKeys(page, 10);

    // Mashing must not soft-lock it: it still ends and hands control back.
    await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 10_000 }).toBe(false);
    const after = await state(page);
    expect(after.worldActive).toBe(true);
    expect(after.cutsceneDialogOpen).toBe(false);

    // And the world responds to input normally afterward.
    const before = await state(page);
    await holdKey(page, 's', 400);
    expect((await state(page)).y).toBeGreaterThan(before.y);
  });
});

// ---------- Walking into a map's edges never leaves the map or gets the player stuck ----------

test('walking into every edge of the campus never leaves the map or gets the player stuck', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  const bounds = await page.evaluate(() => {
    const world = game.scene.getScene('world');
    return { w: world.map.widthInPixels, h: world.map.heightInPixels };
  });

  const nearEdgeTile = { x: 2, y: 2 };
  const farEdgeTile = { x: Math.floor(bounds.w / 16) - 3, y: Math.floor(bounds.h / 16) - 3 };
  const corners = [
    { tile: nearEdgeTile, keys: ['w', 'a'] },
    { tile: { x: farEdgeTile.x, y: nearEdgeTile.y }, keys: ['w', 'd'] },
    { tile: { x: nearEdgeTile.x, y: farEdgeTile.y }, keys: ['s', 'a'] },
    { tile: farEdgeTile, keys: ['s', 'd'] },
  ];

  for (const corner of corners) {
    await teleport(page, corner.tile.x, corner.tile.y);
    await holdKeys(page, corner.keys, 500);
    const s = await state(page);
    // Never outside the world bounds Phaser itself was given (setCollideWorldBounds, world.js create()).
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(bounds.w);
    expect(s.y).toBeLessThanOrEqual(bounds.h);
    // Not stuck: still controllable, and moving away from the edge actually moves.
    expect(s.ready).toBe(true);
    const before = await state(page);
    const away = corner.keys.map((k) => (k === 'w' ? 's' : k === 's' ? 'w' : k === 'a' ? 'd' : 'a'));
    await holdKeys(page, away, 300);
    const after = await state(page);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(5);
  }
});
