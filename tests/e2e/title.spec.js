// FB-0023 (UI: the controls card overflowed and blocked the start of the game) and FB-0024 (game
// design: study Pokemon's own flow -- title, loading, in-fiction hints, pause). See docs/GAME_FEEL.md
// for the rules this whole file checks against. Every other spec skips this flow with `?title=0`
// (tests/e2e/helpers.js openGame() default); this file is the one place that turns it back on.
const { test, expect } = require('@playwright/test');
const {
  openGame, openTitle, titleState, chooseTitleMenu, waitForBoot, state, startGame, holdKey, teleport, waitForMap,
  pressUntil,
} = require('./helpers');

test('FB-0024: the title screen appears first, and Play starts a new game through a real loading screen', async ({ page }) => {
  const { errors } = await openTitle(page, { map: null });
  const before = await titleState(page);
  expect(before.menuItems).toEqual(['play', 'controls', 'credits', 'quit']); // no save yet: no Continue; Quit is always last (FB-0075)

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

test('FB-0023: Quit to Title (from pause) stops the world and returns to the title screen', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  // Resume -> Controls -> Save -> Quit to Title.
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  // Once quit, world/ui may have torn down their own objects on shutdown -- check via scene
  // activity and the title scene itself, not state() (which reaches into ui/world internals).
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('title'))).toBe(true);
  expect(await page.evaluate(() => game.scene.isActive('world'))).toBe(false);
  expect(await page.evaluate(() => game.scene.isActive('ui'))).toBe(false);
  expect((await titleState(page)).stage).toBe('intro'); // a fresh title, not mid-menu from before

  // And it's a real, working title screen afterward: Play works from here too.
  await chooseTitleMenu(page, 'play');
  await waitForBoot(page);
  expect((await state(page)).map).toBe('campus');
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

// FB-0037: the in-game Credits used to falsely claim "All art and code original, made for this
// game" -- rewritten from CREDITS.md's own wording. Every author CREDITS.md names for a pack that's
// actually wired into the game must show up in the panel's text, and the panel itself must never
// overflow the fixed 960x540 internal canvas (docs/GAME_FEEL.md rule 2), whether or not its content
// needs to scroll to fit.
test('FB-0037: Credits names every third-party pack/author and never overflows 960x540', async ({ page }) => {
  await openTitle(page, { map: null });
  await chooseTitleMenu(page, 'credits');
  await expect.poll(async () => (await titleState(page)).creditsVisible).toBe(true);

  const info = await page.evaluate(() => {
    const c = game.scene.getScene('title').credits;
    return { box: c.box, text: c.body.text };
  });

  // Every pack/author CREDITS.md lists for something actually used, per the task brief.
  for (const needle of [
    'OpenStreetMap', 'ODbL', 'Phaser', 'Press Start 2P', 'Open Font License',
    'Kenney', 'LimeZu', 'Assets - From: Sprout Lands - By: Cup Nooble', 'Kyrise',
    'NettySvit', 'marceles', 'Cougarmint', 'gift, never sold',
    // M5 sound (feature/audio merge): the audio packs CREDITS.md's own "Character, icon, and audio
    // survey" section names for something actually wired in (footsteps/menu/story sfx, jingles,
    // music beds) -- kept consistent with CREDITS.md the same way every art pack above already is.
    'Kenney Vleugels', 'Aureolus_Omicron',
  ]) {
    expect(info.text).toContain(needle);
  }
  // The false old claim must be gone.
  expect(info.text).not.toContain('All art and code original');

  // The panel's own box never overflows the fixed internal 960x540 canvas.
  expect(info.box.x).toBeGreaterThanOrEqual(0);
  expect(info.box.y).toBeGreaterThanOrEqual(0);
  expect(info.box.x + info.box.w).toBeLessThanOrEqual(960);
  expect(info.box.y + info.box.h).toBeLessThanOrEqual(540);

  // Esc closes it back to the menu.
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await titleState(page)).creditsVisible).toBe(false);
});

// Mirrors chooseTitleMenu()'s own "move the highlight to this item" half, but stops short of
// confirming it -- chooseTitleMenu()'s own confirm loop assumes a bare Enter always leaves the title
// scene, which isn't true anymore for "play" once a save exists (FB-0040's confirm dialog opens
// instead), so these tests drive the final Enter themselves.
async function selectTitleMenuItem(page, id) {
  if ((await titleState(page)).stage === 'intro') {
    await pressUntil(page, 'Enter', async () => (await titleState(page)).stage === 'menu');
  }
  for (let i = 0; i < 10; i++) {
    const { menuItems, menuIndex } = await titleState(page);
    if (menuItems[menuIndex] === id) break;
    await pressUntil(page, 'ArrowDown', async () => (await titleState(page)).menuIndex !== menuIndex);
  }
  expect((await titleState(page)).menuItems[(await titleState(page)).menuIndex]).toBe(id);
}

const newGameConfirmVisible = (page) => page.evaluate(() => game.scene.getScene('title').newGameConfirm.visible);

// FB-0040: "Play" used to silently reset the game state (which the next autosave would then use to
// overwrite an existing save) with no confirmation at all.
test('FB-0040: Play asks before overwriting an existing save -- No cancels, back to the title untouched', async ({ page }) => {
  const profile = `e2e-newgame-confirm-${Date.now()}`;
  // Build a save on the house map via the fast (title-off) path every other spec uses.
  await openGame(page, { map: 'meadow', save: true, profile });
  await startGame(page);
  await teleport(page, 11, 13);
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
  await page.evaluate((p) => saveGame(p), profile);

  await openTitle(page, { save: true, profile });
  await selectTitleMenuItem(page, 'play');
  await page.keyboard.press('Enter');
  await expect.poll(() => newGameConfirmVisible(page)).toBe(true);
  // 'No' is the default, highlighted item (FB-0040 brief) -- a bare Enter picks it.
  const index = await page.evaluate(() => game.scene.getScene('title').newGameConfirm.index);
  expect(index).toBe(0);

  await page.keyboard.press('Enter');
  await expect.poll(() => newGameConfirmVisible(page)).toBe(false);
  // Still on the title screen -- no new game was started, and the save is exactly as it was.
  expect(await page.evaluate(() => game.scene.isActive('title'))).toBe(true);
  const saved = await page.evaluate((p) => JSON.parse(localStorage.getItem(`pixelquest.save.v1.${p}`) || 'null'), profile);
  expect(saved.state.map).toBe('house');
});

test('FB-0040: Play asks before overwriting an existing save -- Yes proceeds to a new game', async ({ page }) => {
  const profile = `e2e-newgame-confirm-yes-${Date.now()}`;
  await openGame(page, { map: 'meadow', save: true, profile });
  await startGame(page);
  await teleport(page, 11, 13);
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
  await page.evaluate((p) => saveGame(p), profile);

  await openTitle(page, { save: true, profile });
  await selectTitleMenuItem(page, 'play');
  await page.keyboard.press('Enter');
  await expect.poll(() => newGameConfirmVisible(page)).toBe(true);

  await page.keyboard.press('ArrowDown'); // move the highlight to 'Yes'
  const index = await page.evaluate(() => game.scene.getScene('title').newGameConfirm.index);
  expect(index).toBe(1);
  await page.keyboard.press('Enter');
  await expect.poll(() => newGameConfirmVisible(page)).toBe(false);

  await waitForBoot(page);
  // A real new game: the fresh default spawn, not the saved house position.
  expect((await state(page)).map).toBe('campus');
});

// Owner report 2026-10-07: "I cannot start a new game, it takes me back to the main page". The confirm's No / Yes buttons were painted at depth 0, under
// the dim layer and panel (depth 118): the player saw an empty dialog, pressed Enter (the default is 'No') and landed on the menu again.
test('the "start a new game?" confirm draws its No / Yes buttons above its own panel, and a click on Yes starts the new game', async ({ page }) => {
  const profile = `e2e-newgame-confirm-depth-${Date.now()}`;
  await openGame(page, { map: 'meadow', save: true, profile });
  await startGame(page);
  await teleport(page, 11, 13);
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
  await page.evaluate((p) => saveGame(p), profile);

  await openTitle(page, { save: true, profile });
  await selectTitleMenuItem(page, 'play');
  await page.keyboard.press('Enter');
  await expect.poll(() => newGameConfirmVisible(page)).toBe(true);

  const layers = await page.evaluate(() => {
    const c = game.scene.getScene('title').newGameConfirm;
    const panelDepth = Math.max(...c.parts.map((p) => p.depth));
    return { panelDepth, buttons: c.buttons.map((b) => ({ shadow: b.shadow.depth, nine: b.nine.depth, text: b.text.depth, zone: b.zone.depth, box: b.box })) };
  });
  for (const b of layers.buttons) {
    expect(b.shadow).toBeGreaterThan(layers.panelDepth);
    expect(b.nine).toBeGreaterThan(layers.panelDepth);
    expect(b.text).toBeGreaterThan(layers.panelDepth);
    expect(b.zone).toBeGreaterThan(layers.panelDepth);
  }

  const yes = layers.buttons[1].box; // a real mouse click on the Yes button
  await page.mouse.move(yes.x + yes.w / 2, yes.y + yes.h / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => newGameConfirmVisible(page)).toBe(false);
  await waitForBoot(page);
  expect((await state(page)).map).toBe('campus');
});

test('FB-0040: Esc while the confirm is open always means "No"', async ({ page }) => {
  const profile = `e2e-newgame-confirm-esc-${Date.now()}`;
  await openGame(page, { map: 'meadow', save: true, profile });
  await startGame(page);
  await page.evaluate((p) => saveGame(p), profile);

  await openTitle(page, { save: true, profile });
  await selectTitleMenuItem(page, 'play');
  await page.keyboard.press('Enter');
  await expect.poll(() => newGameConfirmVisible(page)).toBe(true);

  await page.keyboard.press('ArrowDown'); // highlight 'Yes' first, to prove Esc still says No
  await page.keyboard.press('Escape');
  await expect.poll(() => newGameConfirmVisible(page)).toBe(false);
  expect(await page.evaluate(() => game.scene.isActive('title'))).toBe(true);
});

// Continue never touches the save, so it must never show the confirm at all.
test('FB-0040: Continue never asks for confirmation', async ({ page }) => {
  const profile = `e2e-newgame-confirm-continue-${Date.now()}`;
  await openGame(page, { map: 'meadow', save: true, profile });
  await startGame(page);
  await page.evaluate((p) => saveGame(p), profile);

  await openTitle(page, { save: true, profile });
  await chooseTitleMenu(page, 'continue');
  await waitForBoot(page);
  expect(await newGameConfirmVisible(page).catch(() => false)).toBeFalsy();
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

// Quality-loop category 4 run 2: the title/greeting/name/customize backdrop used to be a 1px-per-tile
// canvas (a blurry schematic); it's now a real Phaser Tilemap built from the same 'tiles' tileset/
// campus map the actual game uses (src/scenes/opening-backdrop.js), with no physics bodies or NPCs.
test('quality-loop category 4 run 2: the title backdrop is a real tilemap, not the old 1px-per-tile canvas', async ({ page }) => {
  const { errors } = await openTitle(page, { map: null });
  const backdrop = await page.evaluate(() => {
    const t = game.scene.getScene('title');
    return {
      layerCount: t.bg.length,
      layerNames: t.bg.map((l) => l.layer.name),
      scale: t.bg[0].scaleX,
      oldTextureStillExists: game.textures.exists('campus-pan'),
    };
  });
  expect(backdrop.layerCount).toBeGreaterThanOrEqual(2); // ground + structures at least
  expect(backdrop.layerNames).toEqual(expect.arrayContaining(['ground', 'structures']));
  expect(backdrop.scale).toBe(3); // ZOOM -- "the real zoom", not a scaled-up thumbnail
  expect(backdrop.oldTextureStillExists).toBe(false);
  expect(errors).toEqual([]);
});
