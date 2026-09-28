// P5 QA: docs/QA_PLAN.md section 4's "campus loads in under 5s, no frame drops while walking".
// Bounds are deliberately loose (headless Chromium on shared/CI hardware is not a real player's
// machine) -- this is a smoke test for a severe regression (a load that hangs, a frame rate that
// collapses), not a tight performance budget. Both numbers are logged so a human can eyeball the
// trend over time even though the assertion itself stays generous.
const { test, expect } = require('@playwright/test');
const { openGame, startGame, holdKey, waitForMap } = require('./helpers');

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

// ADR 0015 (FB-0027, depth groups): the campus art rebuild has since given the real campus its own
// ~244 real `depthGroup` objects (buildings, trees, palms, signboards, ...) -- this test predates
// that and still injects 250 MORE synthetic ones on top of them, proving the baking pass (src/
// scenes/world.js buildDepthGroups()) stays cheap at a realistic-or-bigger group count, on the
// actual 534x341-tile map, not just on the small meadow/house test maps. Bounded by "tiles inside a
// group" x "groups", never by map size, so this should track the plain load above.
test('FB-0027: baking 250 synthetic depth groups does not visibly slow the campus load', async ({ page }) => {
  await page.route('**/assets/maps/campus.json', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const objectLayer = json.layers.find((layer) => layer.type === 'objectgroup');
    const nextId = Math.max(0, ...objectLayer.objects.map((o) => o.id)) + 1;
    for (let i = 0; i < 250; i++) {
      objectLayer.objects.push({
        id: nextId + i, name: `synthetic-group-${i}`, type: 'depthGroup', class: 'depthGroup',
        x: (i % 20) * 4 * 16, y: Math.floor(i / 20) * 4 * 16, width: 3 * 16, height: 3 * 16,
        rotation: 0, visible: true, properties: [],
      });
    }
    await route.fulfill({ response, json });
  });

  const start = Date.now();
  await openGame(page, { map: null });
  const loadMs = Date.now() - start;
  console.log(`[perf] campus load time with 250 synthetic depth groups: ${loadMs}ms`);
  expect(loadMs).toBeLessThan(15_000); // same generous budget as the plain campus load above

  const groupCount = await page.evaluate(() => game.scene.getScene('world').depthGroups.length);
  expect(groupCount).toBeGreaterThanOrEqual(250);
});

// Regression for a real bug this same round found: buildDepthGroups() baked each tile with
// RenderTexture.drawFrame(), which does its own beginDraw()/batchDrawFrame()/endDraw() (a full
// render-target bind/flush/unbind) *per call* -- fine for a handful of calls, but the real campus's
// ~244 groups (~28k baked cells across 2 layers, ~56k individual blits) measured at 5+ real seconds
// of synchronous main-thread work, on *every* load and *every* door/stairs transition landing back
// on campus (`this.scene.restart()` re-runs buildMap() -> buildDepthGroups() from scratch) -- a
// multi-second freeze on every door in and out of a building, and (since tests/e2e/helpers.js's
// `waitForMap()` only polls 5s) the root cause behind several e2e failures that looked unrelated
// (interiors.spec.js's Main Block round trip, scripts.spec.js/story.spec.js's fuller playthroughs).
// The fix batches each group's blits with beginDraw()/batchDrawFrame()/endDraw() instead -- one real
// draw per group, not one per tile. The test above's generous 15s full-page-load budget already
// included this cost without ever isolating it, so it stayed green throughout; this measures
// buildDepthGroups() itself, on the real (unmodified) campus map, against a budget that's still a
// generous multiple of the ~100-200ms it actually takes post-fix, but nowhere near the old 5s+.
test('the real campus depth groups (art rebuild, ~244 of them) bake in well under a second', async ({ page }) => {
  await openGame(page, { map: null }); // first boot, unpatched/unmeasured -- just gets a live 'world' scene
  await startGame(page);

  // Patch *after* the scene already exists (avoids racing WorldScene's own first create(), which
  // can run before an injected addInitScript gets a chance to reach into the scene manager), then
  // force exactly the real-world case this bug hid in: a scene restart landing back on campus
  // (`this.scene.restart()`, the same call every door/stairs warp makes) rebuilds the map, and with
  // it every depth group, from scratch -- measure *that* run, not the initial boot.
  await page.evaluate(() => {
    const world = game.scene.getScene('world');
    const orig = world.buildDepthGroups.bind(world);
    world.buildDepthGroups = (...args) => {
      const t0 = performance.now();
      const r = orig(...args);
      window.__depthGroupMs = performance.now() - t0;
      return r;
    };
    world.scene.restart({ map: 'campus' });
  });
  await waitForMap(page, 'campus');

  const ms = await page.evaluate(() => window.__depthGroupMs);
  console.log(`[perf] campus buildDepthGroups() time (on scene restart): ${ms}ms`);
  expect(ms).not.toBeUndefined();
  expect(ms).toBeLessThan(2_000);
});
