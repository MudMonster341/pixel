// P5 QA: docs/QA_PLAN.md section 4's "campus loads in under 5s, no frame drops while walking".
// Bounds are deliberately loose (headless Chromium on shared/CI hardware is not a real player's
// machine) -- this is a smoke test for a severe regression (a load that hangs, a frame rate that
// collapses), not a tight performance budget. Both numbers are logged so a human can eyeball the
// trend over time even though the assertion itself stays generous.
const { test, expect } = require('@playwright/test');
const { openGame, startGame, holdKey } = require('./helpers');

test('the campus loads promptly', async ({ page }) => {
  const start = Date.now();
  await openGame(page, { map: null });
  const loadMs = Date.now() - start;
  console.log(`[perf] campus load time: ${loadMs}ms`);
  // QA_PLAN's own target is 5s on the owner's machine; this test runs on whatever machine happens
  // to be running the suite, so it allows a generous multiple of that before calling it a regression.
  expect(loadMs).toBeLessThan(15_000);
});

test('the frame rate holds up while walking the campus for a few seconds', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  // Average FPS = frames actually rendered / wall time elapsed, measured from Phaser's own frame
  // counter (game.loop.frame) rather than sampling game.loop.actualFps at a moment in time, so the
  // number reflects the whole walk instead of whichever instant happened to be sampled.
  const before = await page.evaluate(() => ({ frame: game.loop.frame, time: performance.now() }));
  await holdKey(page, 'd', 3000);
  const after = await page.evaluate(() => ({ frame: game.loop.frame, time: performance.now() }));

  const fps = (after.frame - before.frame) / ((after.time - before.time) / 1000);
  console.log(`[perf] average FPS while walking the campus for 3s: ${fps.toFixed(1)}`);
  // A real player's machine runs this at ~60fps; a loose floor here only catches a severe stall
  // (e.g. an accidental O(n^2) added to the per-frame update), not ordinary machine variance.
  expect(fps).toBeGreaterThan(20);
});
