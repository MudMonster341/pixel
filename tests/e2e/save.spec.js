// src/save.js: autosave to localStorage and continuing from it. Each test uses its own `profile`
// (a separate localStorage key, see src/save.js SAVE_KEY_PREFIX) so tests never see each other's saves.
const { test, expect } = require('@playwright/test');
const { openGame, waitForBoot, state, startGame, holdKey, countItem } = require('./helpers');

const savedState = (page, profile) =>
  page.evaluate((p) => {
    const raw = localStorage.getItem(`pixelquest.save.v1.${p}`);
    return raw ? JSON.parse(raw).state : null;
  }, profile);

const spawnTile = (page) =>
  page.evaluate(() => {
    const spawn = game.scene.getScene('world').mapObjects.find((o) => o.type === 'spawn');
    return { x: Math.floor(spawn.x), y: Math.floor(spawn.y) };
  });

test('FB-M1-save: walking somewhere and reloading resumes at the same spot with the same inventory', async ({ page }) => {
  const profile = 'e2e-walk-and-reload';
  await openGame(page, { map: null, save: true, profile }); // real campus start map, save on
  await startGame(page);

  await holdKey(page, 'w', 800); // walk away from the gate spawn
  await page.evaluate(() => GameState.inventory.add('apple'));
  const before = await state(page);
  expect(before.tile).not.toEqual(await spawnTile(page));
  expect(countItem(before.slots, 'apple')).toBe(1);

  // Autosave is debounced (src/save.js AUTOSAVE_DEBOUNCE_MS): wait for the write itself, not a
  // guessed sleep (docs/TESTING.md rule 5), by polling the actual localStorage save it produces.
  await expect.poll(async () => (await savedState(page, profile))?.position).toEqual(before.tile);

  await page.reload();
  await waitForBoot(page);
  const after = await state(page);
  expect(after.map).toBe(before.map);
  expect(after.tile).toEqual(before.tile);
  expect(after.facing).toBe(before.facing);
  expect(countItem(after.slots, 'apple')).toBe(1);
});

test('FB-M1-save: ?save=0 starts fresh and never touches the stored save', async ({ page }) => {
  const profile = 'e2e-save-disabled';
  // Build up a save to make sure a later ?save=0 boot both ignores it and leaves it alone.
  await openGame(page, { map: null, save: true, profile });
  await startGame(page);
  await holdKey(page, 'w', 800);
  await page.evaluate(() => GameState.inventory.add('coffee'));
  await expect.poll(async () => Boolean(await savedState(page, profile))).toBe(true);
  const savedBefore = await savedState(page, profile);

  // openGame()'s default is already save:false (?save=0); spelled out here for clarity.
  await openGame(page, { map: null, save: false, profile });
  const fresh = await state(page);
  expect(fresh.tile).toEqual(await spawnTile(page));
  expect(countItem(fresh.slots, 'coffee')).toBe(0);

  // Playing a bit under ?save=0 must not write anything either.
  await startGame(page);
  await holdKey(page, 'w', 800);
  await page.waitForTimeout(900); // longer than the autosave debounce, to give a wrongful write a chance
  expect(await savedState(page, profile)).toEqual(savedBefore);
});

test('FB-M1-save: deleting a profile clears its save, so the next boot starts fresh', async ({ page }) => {
  const profile = 'e2e-delete-profile';
  await openGame(page, { map: null, save: true, profile });
  await startGame(page);
  await holdKey(page, 'w', 800);
  await expect.poll(async () => Boolean(await savedState(page, profile))).toBe(true);

  await page.evaluate((p) => deleteProfile(p), profile);
  expect(await savedState(page, profile)).toBeNull();

  await page.reload();
  await waitForBoot(page);
  const s = await state(page);
  expect(s.tile).toEqual(await spawnTile(page));
});

test('FB-M1-save: profiles keep independent saves', async ({ page }) => {
  await openGame(page, { map: null, save: true, profile: 'e2e-profile-a' });
  await startGame(page);
  await holdKey(page, 'w', 800);
  await page.evaluate(() => GameState.inventory.add('phone'));
  await expect.poll(async () => Boolean(await savedState(page, 'e2e-profile-a'))).toBe(true);

  await openGame(page, { map: null, save: true, profile: 'e2e-profile-b' });
  const bState = await state(page);
  expect(bState.tile).toEqual(await spawnTile(page)); // profile b has never saved, so it's a fresh start
  expect(countItem(bState.slots, 'phone')).toBe(0);

  await expect.poll(async () => Boolean(await savedState(page, 'e2e-profile-b'))).toBe(true);
  const a = await savedState(page, 'e2e-profile-a');
  const b = await savedState(page, 'e2e-profile-b');
  expect(a.position).not.toEqual(b.position);
});
