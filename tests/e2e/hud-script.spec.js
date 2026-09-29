// Quality-loop category 4 run 1 (docs/QUALITY_LOOP.md), from a live capture of the Gate 2 beat
// (qa-shots/cutscene-02-dialog.png): the first-time hint banner drew on top of the dialog box mid
// script, the always-on HUD (minimap/quest tracker/hotbar) stayed fully visible during an in-world
// cutscene, and the dialog box was clipped by the bottom letterbox bar. Fixed in src/scenes/ui.js
// (HintBanner.blocked()/tick()/interrupt(), UIScene.setHudScriptHidden(), Letterbox playIn/playOut/
// snap, DialogBox.setLetterboxed()/applyBox(), Toast.setLetterboxed()) and src/maplogic.js
// (hudLayout()'s own `dialogBox`, reserved for by `hint`). These specs use the 3 key-room beats
// (src/scripts.js keyRoomPhysicsLab/Icvl/Room195) as a simple, reliable letterboxed script -- same
// shape as the Gate 2/entrance beats, without the bus-arrival setup those need.
const { test, expect } = require('@playwright/test');
const { openGame, state, teleport, waitForMap, skipWorldScript } = require('./helpers');

async function jumpToHuntingOn(page, map) {
  await page.evaluate((m) => {
    GameState.quest.stage = 'hunting';
    game.scene.getScene('world').scene.restart({ map: m });
  }, map);
  await waitForMap(page, map);
}

async function keyStationTile(page, id) {
  return page.evaluate((ksId) => {
    const w = game.scene.getScene('world');
    const ks = w.keyStations.find((k) => k.def.id === ksId);
    return { x: ks.x / 16, y: ks.y / 16 };
  }, id);
}

// Walks her up to the Physics Lab desk (main-block-3), triggering SCRIPTS.keyRoomPhysicsLab: lockInput
// -> letterbox in -> camera pan -> sparkle -> a `say: { speaker: null, ... }` line -> letterbox out ->
// unlockInput. Returns once the script is confirmed running (cutsceneActive), before it has a chance
// to finish on its own.
async function triggerKeyRoomScript(page) {
  await jumpToHuntingOn(page, 'main-block-3');
  const tile = await keyStationTile(page, 'physicsLab');
  await teleport(page, Math.round(tile.x), Math.round(tile.y) + 4);
  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 5000 }).toBe(true);
}

// openGame(map: null) boots on the real (outdoor) campus, whose own WorldScene.create() emits the
// real "move"/"run" hints immediately (src/scenes/world.js) -- unseen at the start of a fresh test,
// so they land in the very same HintBanner queue/showing slot these tests force 'talk' into. Left
// alone, that real hint (not yet shown, or mid-show) is FIFO-ahead of 'talk' and wins the show slot
// first -- not a bug (the queue is genuinely FIFO, one at a time, by design), just noise these tests
// need cleared so 'talk' is the only hint in play. Kills any in-flight fade tween too, so `showing`
// flips to null immediately rather than after its own multi-second hold.
async function resetHints(page) {
  await page.evaluate(() => {
    const hints = game.scene.getScene('ui').hints;
    if (hints.holdTimer) { hints.holdTimer.remove(); hints.holdTimer = null; }
    game.scene.getScene('ui').tweens.killTweensOf(hints.parts);
    hints.parts.forEach((part) => part.setAlpha(0));
    hints.queue = [];
    hints.showing = null;
  });
}

test('bug 1: a hint queued while a script is running never shows until it ends', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await triggerKeyRoomScript(page);
  await resetHints(page);

  // Force a fresh hint id mid-script, the same event world.js itself would emit.
  await page.evaluate(() => {
    GameState.seenHints.delete('talk');
    game.events.emit('hint', 'talk');
  });
  await page.waitForTimeout(150);
  const midScript = await page.evaluate(() => {
    const h = game.scene.getScene('ui').hints;
    return { showing: h.showing, queued: h.queue.includes('talk') };
  });
  expect(midScript.showing).toBeNull();
  expect(midScript.queued).toBe(true);

  await skipWorldScript(page);
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').hints.showing)).toBe('talk');
});

test('bug 1: a hint already showing is hidden the instant a dialog opens on top of it', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await resetHints(page);
  // Trigger and let it actually start showing, in the clear (not blocked yet).
  await page.evaluate(() => {
    GameState.seenHints.delete('talk');
    game.events.emit('hint', 'talk');
  });
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').hints.showing)).toBe('talk');

  await triggerKeyRoomScript(page);
  // interrupt() runs every frame (UIScene.update()) -- give it a couple of frames, then it must be gone.
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').hints.showing)).toBeNull();
  expect(await page.evaluate(() => game.scene.getScene('ui').hints.queue)).toContain('talk');

  await skipWorldScript(page);
});

test('bug 2: the HUD fades out during a script and returns after an Esc skip', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await jumpToHuntingOn(page, 'main-block-3');
  expect(await page.evaluate(() => game.scene.getScene('ui').minimap.scriptHidden)).toBe(false);
  expect(await page.evaluate(() => game.scene.getScene('ui').hotbar.scriptHidden)).toBe(false);

  const tile = await keyStationTile(page, 'physicsLab');
  await teleport(page, Math.round(tile.x), Math.round(tile.y) + 4);
  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 5000 }).toBe(true);

  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').minimap.scriptHidden)).toBe(true);
  expect(await page.evaluate(() => game.scene.getScene('ui').questTracker.scriptHidden ?? true)).toBeTruthy();
  expect(await page.evaluate(() => game.scene.getScene('ui').hotbar.scriptHidden)).toBe(true);
  // The actual rendered alpha, not just the flag -- past HUD_SCRIPT_FADE_MS (~200ms).
  await page.waitForTimeout(300);
  const alphas = await page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    return { minimapPanel: ui.minimap.parts[0].alpha, hotbarPanel: ui.hotbar.panel.alpha };
  });
  expect(alphas.minimapPanel).toBeLessThan(0.05);
  expect(alphas.hotbarPanel).toBeLessThan(0.05);

  // Esc-skip must restore it, not just end the script.
  await skipWorldScript(page);
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').minimap.scriptHidden)).toBe(false);
  expect(await page.evaluate(() => game.scene.getScene('ui').hotbar.scriptHidden)).toBe(false);
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').minimap.parts[0].alpha)).toBeGreaterThan(0.9);
});

test('bug 3: the dialog box lifts clear of the bottom letterbox bar while a script plays', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await triggerKeyRoomScript(page);
  await expect.poll(async () => (await state(page)).cutsceneDialogOpen, { timeout: 5000 }).toBe(true);

  const info = await page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    return { dialogBox: ui.dialog.box, letterboxed: ui.dialog.letterboxed, barH: ui.letterbox.h };
  });
  expect(info.letterboxed).toBe(true);
  expect(info.dialogBox.y + info.dialogBox.h).toBeLessThanOrEqual(540 - info.barH);
  // The name plate (hidden here -- key-room beats use `speaker: null`) never being *cut off* matters
  // more for the Gate 2/entrance beats, which do name a speaker; confirmed structurally instead by
  // tests/unit/hud-layout.test.js's own "letterboxed lifts the dialog box" case, run at every size.

  await skipWorldScript(page);
  // Restored once the script's own `letterbox: 'out'` step runs.
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').dialog.letterboxed)).toBe(false);
  const restored = await page.evaluate(() => game.scene.getScene('ui').dialog.box);
  expect(restored.y).toBe(382); // src/maplogic.js DIALOG_BOX's own default
});

test('bug 4: a toast fired mid-script never lands on the (letterboxed) dialog box', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await triggerKeyRoomScript(page);
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').toast.y)).toBeLessThan(360);

  await page.evaluate(() => { game.events.emit('toast', 'Test toast'); });
  await page.waitForTimeout(100);
  const positions = await page.evaluate(() => {
    const ui = game.scene.getScene('ui');
    return { toastY: ui.toast.text.y, dialogTop: ui.dialog.box.y, dialogBottom: ui.dialog.box.y + ui.dialog.box.h };
  });
  // The toast's own text sits above the (letterboxed) dialog box's top edge, clear of it.
  expect(positions.toastY).toBeLessThan(positions.dialogTop);

  await skipWorldScript(page);
});
