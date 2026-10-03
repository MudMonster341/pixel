// HUD declutter pass (docs/GAME_FEEL.md "One UI kit, HUD declutter and dialog polish", roadmap M2,
// docs/QUALITY_LOOP.md category 4 "UI and menus"): src/maplogic.js's hudLayout() is unit-tested
// (tests/unit/hud-layout.test.js) for no overlap/off-screen at 3 sizes in isolation; these specs prove
// the *real* HUD elements (built from that same layout, src/scenes/ui.js) actually land where the
// layout says, and that the two new interactive behaviours (the quest tracker's pill/expand, the
// hotbar's idle auto-hide) work end to end.
const { test, expect } = require('@playwright/test');
const { openGame, startGame, teleport, waitForMap, holdKey } = require('./helpers');

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

// Reads every top-level HUD element's own on-screen box, the same `{x, y, w, h}` shape hudLayout()
// itself returns (GAME_FEEL.md rule: "read the panel's own box back in a test, don't eyeball a
// screenshot"). The hotbar and minimap already store `.bounds`/`.width`+`.height`+area on themselves;
// the quest tracker exposes whichever of pillBox/expandedBox is currently showing.
function readHudBoxes(page) {
  return page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    const m = ui.minimap;
    const qt = ui.questTracker;
    return {
      minimap: { x: 16, y: 16, w: m.width, h: m.height },
      tracker: qt.expanded
        ? { x: qt.expandedBox.x, y: qt.expandedBox.y, w: qt.expandedBox.w, h: qt.expandedBox.h }
        : { x: qt.pillBox.x, y: qt.pillBox.y, w: qt.pillBox.w, h: qt.pillBox.h },
      hotbar: { ...ui.hotbar.bounds },
    };
  });
}

test('HUD declutter: the minimap, quest tracker pill and hotbar never overlap at 3 viewport sizes', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  try {
    for (const size of [{ width: 960, height: 540 }, { width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(100); // let Phaser's Scale Manager refit (Scale.FIT keeps the UI at 960x540 logically)
      const boxes = await readHudBoxes(page);
      const names = Object.keys(boxes);
      for (const name of names) {
        const b = boxes[name];
        expect(b.x, `${name} off-screen (left) at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);
        expect(b.y, `${name} off-screen (top) at ${size.width}x${size.height}`).toBeGreaterThanOrEqual(0);
      }
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          expect(overlaps(boxes[names[i]], boxes[names[j]]), `${names[i]} overlaps ${names[j]} at ${size.width}x${size.height}`).toBe(false);
        }
      }
    }
  } finally {
    await page.setViewportSize({ width: 960, height: 540 }).catch(() => {});
  }
});

test('the quest tracker is a compact pill by default, and expands only when the objective changes', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  // Give it a moment to settle past its very first (construction-time) expand: it must collapse by
  // itself and stay a pill. ERR-0012: Phaser's delayedCall clock runs ~10-15% slower than the wall
  // clock at the ~50 fps this headless Chromium manages, so a fixed 3.2 s sleep against the 3 s timer
  // was a coin flip (it flaked on commit 10dd30f too); wait for the state instead (TESTING.md rule 5).
  await expect.poll(
    async () => page.evaluate(() => game.scene.getScene('ui').questTracker.expanded),
    { timeout: 8000 },
  ).toBe(false);

  // Finding a key changes the objective text -- the tracker should expand, then collapse again on
  // its own after a few seconds without needing anything else to happen.
  await page.evaluate(() => {
    GameState.quest.stage = 'hunting';
    GameState.quest.keys.physicsLab = true;
    game.events.emit('state-changed');
  });
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').questTracker.expanded)).toBe(true);
  await expect.poll(
    async () => page.evaluate(() => game.scene.getScene('ui').questTracker.expanded),
    { timeout: 8000 }, // 3 s timer on a clock that lags the wall clock, sampled at <= 1 s steps (ERR-0012)
  ).toBe(false);
});

test('FB-XXXX: the hotbar auto-hides after being idle while empty, and returns on activity', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  // Force an empty bag (a fresh campus start may or may not already be empty) and wait past the idle
  // window -- the bar should fade itself out without anything else happening.
  await page.evaluate(() => {
    GameState.inventory.slots.fill(null);
    GameState.inventory.emit('changed');
  });
  await expect.poll(
    async () => page.evaluate(() => game.scene.getScene('ui').hotbar.autoHidden),
    { timeout: 8000 }, // 3 s idle timer on a lagging clock, sampled at <= 1 s steps: 4 s was razor thin (ERR-0012)
  ).toBe(true);

  // A number key is "activity" even with nothing to select -- the bar should return immediately.
  await page.keyboard.press('1');
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').hotbar.autoHidden)).toBe(false);
});

test('the hint banner sits above the hotbar, not stacked under the location banner', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  const boxes = await page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    const layout = hudLayout(GAME_WIDTH, GAME_HEIGHT);
    return { hint: layout.hint, hotbar: ui.hotbar.bounds, banner: layout.banner };
  });
  // The hint sits above the hotbar (never overlapping it) and well clear of the banner up top.
  expect(overlaps(boxes.hint, boxes.hotbar)).toBe(false);
  expect(overlaps(boxes.hint, boxes.banner)).toBe(false);
  expect(boxes.hint.y).toBeGreaterThan(boxes.banner.y + boxes.banner.h);
});
