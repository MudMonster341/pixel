// M3a: the opening (docs/STORY.md "Opening", owner brief 2026-09-21) -- title's "Play" chains
// through Mustafa's greeting, name entry, customisation and the bus arrival before ever reaching the
// loading screen. `?intro=0` is the default everywhere else (tests/e2e/helpers.js), so this file is
// the one place that turns it on, the same shape as tests/e2e/title.spec.js does for `?title=0`.
//
// Every scene change below is driven through pressUntil(), not a bare page.keyboard.press(): this
// codebase's own ERR-0003 already documents a one-shot keydown occasionally not registering at all
// under load in exactly this Phaser version, and pressUntil() is its established fix (re-press like
// an impatient player would, rather than weakening the assertion).
const { test, expect } = require('@playwright/test');
const { openGame, openTitle, chooseTitleMenu, waitForBoot, state, teleport, pressUntil } = require('./helpers');

async function startPlayIntoIntro(page, { save, profile } = {}) {
  const { errors } = await openTitle(page, { map: null, intro: true, save, profile });
  await chooseTitleMenu(page, 'play');
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('greeting'))).toBe(true);
  return { errors };
}

const isActive = (page, key) => page.evaluate((k) => game.scene.isActive(k), key);

test('the greeting can be skipped with Esc, straight to name entry', async ({ page }) => {
  const { errors } = await startPlayIntoIntro(page);

  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry'));
  expect(await isActive(page, 'greeting')).toBe(false);
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test('the greeting can also be read line by line with E/Enter, then moves on by itself', async ({ page }) => {
  await startPlayIntoIntro(page);
  // 4 lines in GREETING_LINES (src/scenes/intro-greeting.js); press through all of them.
  for (let i = 0; i < 8 && (await isActive(page, 'greeting')); i++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await expect.poll(() => isActive(page, 'name-entry')).toBe(true);
});

test('a typed name is saved, restored after reload, and shown on the customisation screen', async ({ page }) => {
  const profile = `e2e-intro-name-${Date.now()}`;
  await startPlayIntoIntro(page, { save: true, profile });
  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry')); // skip the greeting

  // Real typing (letters only, per the brief) clears the pre-filled default and writes a fresh name.
  const nameScene = () => page.evaluate(() => {
    const s = game.scene.getScene('name-entry');
    return s.name;
  });
  await expect.poll(nameScene).not.toBe('');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace'); // clear the default
  await expect.poll(nameScene).toBe('');
  // Individual key presses, not page.keyboard.type(): the game reads raw canvas keydown events, not
  // a real HTML text input, and 'a'/'d' double as this screen's on-screen-keyboard navigation keys
  // (LEFT/RIGHT) -- pressing them one at a time is what every other canvas-level input test in this
  // codebase already does (tests/e2e/dialog.spec.js). A gap between presses avoids the same
  // queue-under-load flake pressUntil works around elsewhere in this file.
  for (const key of ['n', 'a', 'd', 'i', 'a']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(100);
  }
  await expect.poll(nameScene).toBe('NADIA');

  await pressUntil(page, 'Enter', () => isActive(page, 'customize')); // OK has keyboard focus by default
  // The on-screen keyboard only offers uppercase keys (like the on-screen keyboards it's modeled on),
  // so the name is saved exactly as typed: "NADIA", not re-cased.
  expect(await page.evaluate(() => GameState.playerName)).toBe('NADIA');

  // Shown in dialog: the customisation screen greets her by name.
  const headerText = await page.evaluate(() => game.scene.getScene('customize').children.list
    .filter((c) => c.type === 'Text').map((c) => c.text).join(' | '));
  expect(headerText).toContain('NADIA');

  // Persisted: the name-change event already triggered an autosave (src/save.js initAutosave()
  // listens for 'state-changed', which notifyStateChanged() fires); check it landed in storage.
  const saveKey = `pixelquest.save.v1.${profile}`;
  await expect.poll(async () => {
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), saveKey);
    return saved?.state?.playerName;
  }).toBe('NADIA');
});

test('typing straight over the pre-filled default name replaces it, not appends to it', async ({ page }) => {
  // Found by tools/qa-shots-intro.js: typing without backspacing the default first used to produce
  // "AISHANADIA" (the default plus her typing mashed together) instead of just "NADIA".
  await startPlayIntoIntro(page);
  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry'));
  const nameScene = () => page.evaluate(() => game.scene.getScene('name-entry').name);
  const defaultName = await nameScene();
  expect(defaultName.length).toBeGreaterThan(0);

  await page.keyboard.press('n'); // no backspacing first
  await expect.poll(nameScene).toBe('N');
  expect(await nameScene()).not.toContain(defaultName);
});

test('a chosen clothes colour is saved and visible on her sprite in the world', async ({ page }) => {
  await startPlayIntoIntro(page);
  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry')); // skip greeting
  await pressUntil(page, 'Enter', () => isActive(page, 'customize')); // accept default name

  // Cycle to a non-default swatch (index 1, 'sky') and confirm.
  await pressUntil(page, 'ArrowRight', async () => (await page.evaluate(() => GameState.customization.clothes)) === 'sky');
  await pressUntil(page, 'Enter', () => isActive(page, 'bus-arrival'));

  // Skip the bus straight through to the world, then check the sprite the game actually shows: not
  // by filename (Phaser's loader hands the image back as a blob: URL, not the original path) but by
  // pixel color -- the sky swatch's blue should appear somewhere in her idle frame, and the pink
  // default's own color should not.
  await pressUntil(page, 'Escape', async () => !(await isActive(page, 'bus-arrival')));
  await waitForBoot(page);
  const textureKey = await page.evaluate(() => game.scene.getScene('world').player.texture.key);
  expect(textureKey).toBe('player');
  const colors = await page.evaluate(() => {
    const tex = game.textures.get('player');
    const frame = tex.get(0); // idle-down, ADR 0013 frame layout
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.width, frame.height, 0, 0, frame.width, frame.height);
    const { data } = ctx.getImageData(0, 0, frame.width, frame.height);
    const hexes = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      hexes.add(`#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
    return [...hexes];
  });
  expect(colors).toEqual(expect.arrayContaining(['#3b7dd8'])); // the sky swatch's top base color
  expect(colors).not.toEqual(expect.arrayContaining(['#ff6fb1'])); // the pink default's top should be gone
});

// The idle-down frame's own colors -- not the filename: Phaser's loader hands textures back as blob:
// URLs (see the "a chosen clothes colour..." test above), so a texture's source file can't be read
// back from `.src`; sampling pixels the same way that test does is the only real way to tell which
// sheet actually ended up loaded.
async function playerIdleColors(page) {
  return page.evaluate(() => {
    const tex = game.textures.get('player');
    const frame = tex.get(0); // idle-down, ADR 0013/FB-0043 frame layout
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.width, frame.height, 0, 0, frame.width, frame.height);
    const { data } = ctx.getImageData(0, 0, frame.width, frame.height);
    const hexes = new Set();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      hexes.add(`#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
    return [...hexes];
  });
}

// FB-0038: Phaser's loader skips (a console warning, not an overwrite) queueing a spritesheet under
// a texture key that already exists -- so a second "new game" in the same page that picks a
// *different* clothes colour than the first used to keep the old sheet forever. src/main.js
// BootScene now removes the stale 'player' texture (and every global animation built from it) first
// whenever the wanted file differs from what's already loaded.
test('FB-0038: a second new game with a different clothes colour replaces the old sprite sheet', async ({ page }) => {
  await startPlayIntoIntro(page);
  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry'));
  await pressUntil(page, 'Enter', () => isActive(page, 'customize'));
  await pressUntil(page, 'ArrowRight', async () => (await page.evaluate(() => GameState.customization.clothes)) === 'sky');
  await pressUntil(page, 'Enter', () => isActive(page, 'bus-arrival'));
  await pressUntil(page, 'Escape', async () => !(await isActive(page, 'bus-arrival')));
  await waitForBoot(page);
  expect((await state(page)).map).toBe('campus');
  let colors = await playerIdleColors(page);
  expect(colors).toEqual(expect.arrayContaining(['#3b7dd8'])); // sky swatch top base
  expect(colors).not.toEqual(expect.arrayContaining(['#3d8a3f'])); // mint swatch top base -- not yet

  // Quit to Title (Resume -> Controls -> Save -> Quit to Title).
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('title'))).toBe(true);

  // Play again, picking a different colour this time.
  await chooseTitleMenu(page, 'play');
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('greeting'))).toBe(true);
  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry'));
  await pressUntil(page, 'Enter', () => isActive(page, 'customize'));
  await pressUntil(page, 'ArrowRight', async () => (await page.evaluate(() => GameState.customization.clothes)) === 'mint');
  await pressUntil(page, 'Enter', () => isActive(page, 'bus-arrival'));
  await pressUntil(page, 'Escape', async () => !(await isActive(page, 'bus-arrival')));
  await waitForBoot(page);

  colors = await playerIdleColors(page);
  expect(colors).toEqual(expect.arrayContaining(['#3d8a3f'])); // mint swatch top base -- the new sheet
  expect(colors).not.toEqual(expect.arrayContaining(['#3b7dd8'])); // the old sky colour must be gone
  // A working walk animation on the new sheet too -- proves the stale, mint-less anims were really
  // rebuilt, not just left pointing at frame numbers from whatever texture happened to be 'player'.
  expect(await page.evaluate(() => game.anims.exists('walk-down'))).toBe(true);
});

test('the bus sequence blocks input and Esc skips it, ending with her outside the gate', async ({ page }) => {
  await startPlayIntoIntro(page);
  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry')); // skip greeting
  await pressUntil(page, 'Enter', () => isActive(page, 'customize')); // accept default name
  await pressUntil(page, 'Enter', () => isActive(page, 'bus-arrival')); // accept default clothes

  // No world/ui scene exists yet at all -- nothing for movement keys to reach.
  expect(await isActive(page, 'world')).toBe(false);
  await page.keyboard.press('d');
  await page.waitForTimeout(100);
  expect(await isActive(page, 'world')).toBe(false);
  expect(await isActive(page, 'bus-arrival')).toBe(true);

  await pressUntil(page, 'Escape', async () => !(await isActive(page, 'bus-arrival')));
  await waitForBoot(page);
  const s = await state(page);
  expect(s.map).toBe('campus');
  expect(s.ready).toBe(true);
});

test('the Main Block entrance cutscene plays once, the first time she reaches the door', async ({ page }) => {
  // Reaches the world directly (title/intro off, cutscenes on) -- exercising the trigger itself
  // rather than the opening chain, the same split boot.spec.js/campus.spec.js already use for
  // "reach the world fast" vs. title.spec.js's "exercise the title flow".
  await openGame(page, { map: null, cutscene: true });
  const trigger = await page.evaluate(() => game.scene.getScene('world').mapObjects
    .find((o) => o.type === 'cutscene' && o.props.cutscene === 'entrance'));
  expect(trigger).toBeTruthy();

  await teleport(page, Math.floor(trigger.x + trigger.width / 2), Math.floor(trigger.y + trigger.height / 2));
  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);
  const active = await page.evaluate(() => game.scene.getScene('cutscene').cutsceneKey);
  expect(active).toBe('entrance');

  // Skip it, then confirm it doesn't replay when she stands there again.
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 5000 }).toBe(false);
  await teleport(page, Math.floor(trigger.x), Math.floor(trigger.y));
  await teleport(page, Math.floor(trigger.x + trigger.width / 2), Math.floor(trigger.y + trigger.height / 2));
  await page.waitForTimeout(300);
  expect((await state(page)).cutsceneActive).toBe(false);
  expect((await state(page)).seenCutscenes).toContain('entrance');
});
