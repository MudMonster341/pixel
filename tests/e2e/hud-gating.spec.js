// FB-0035: UIScene used to keep handling Esc/J/N/M, the number keys and the mouse wheel even while
// something else owned the screen -- a cutscene, a mini-game, or a warp's own black-screen fade
// (`world.transitioning`). Confirmed in the browser: Esc to skip a cutscene also opened the pause
// menu, Esc to quit a mini-game also opened the pause menu, and J opened the journal behind a
// mini-game. Every UIScene key/wheel handler is now gated on `UIScene.worldHasControl()` (src/scenes/
// ui.js) -- world running and not mid-warp-fade -- and the hotbar's number keys/wheel additionally
// check `isBlocking()` (dialog/pause/journal/full map).
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport, waitForMap } = require('./helpers');

const triggerCenter = (page) =>
  page.evaluate(() => {
    const t = game.scene.getScene('world').mapObjects.find((o) => o.type === 'cutscene');
    return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
  });

function keyStationTile(page, id) {
  return page.evaluate((ksId) => {
    const ks = game.scene.getScene('world').keyStations.find((k) => k.def.id === ksId);
    return ks ? { x: Math.floor(ks.x / 16), y: Math.floor(ks.y / 16) } : null;
  }, id);
}

function mgActive(page, sceneKey) {
  return page.evaluate((key) => game.scene.isActive(key), sceneKey);
}

async function talkToStation(page, id, sceneKey) {
  const tile = await keyStationTile(page, id);
  await teleport(page, tile.x, tile.y + 1);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  for (let i = 0; i < 10; i++) {
    if (await mgActive(page, sceneKey)) return;
    await page.keyboard.press('e');
    await page.waitForTimeout(80);
  }
}

test('FB-0035: Esc skips a cutscene instead of also opening the pause menu underneath it', async ({ page }) => {
  await openGame(page, { map: null, cutscene: true });
  await startGame(page);

  const { x, y } = await triggerCenter(page);
  await teleport(page, x, y);
  await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);

  await page.keyboard.press('Escape');
  // While the cutscene is still fading out, the pause menu must never have opened.
  expect((await state(page)).pause.visible).toBe(false);
  await expect.poll(async () => (await state(page)).cutsceneActive, { timeout: 5000 }).toBe(false);
  expect((await state(page)).pause.visible).toBe(false);
});

test('FB-0035: Esc quits a mini-game instead of also opening the pause menu underneath it', async ({ page }) => {
  await openGame(page, { map: 'main-block-1', minigames: true });
  await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
  await talkToStation(page, 'room195', 'minigame-tetris');
  await expect.poll(async () => mgActive(page, 'minigame-tetris')).toBe(true);

  await page.keyboard.press('Escape');
  expect((await state(page)).pause.visible).toBe(false);
  await expect.poll(async () => mgActive(page, 'minigame-tetris')).toBe(false);
  expect((await state(page)).pause.visible).toBe(false);
});

test('FB-0035: J does not open the journal while a mini-game owns the screen', async ({ page }) => {
  await openGame(page, { map: 'main-block-1', minigames: true });
  await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
  await talkToStation(page, 'room195', 'minigame-tetris');
  await expect.poll(async () => mgActive(page, 'minigame-tetris')).toBe(true);

  await page.keyboard.press('j');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => game.scene.getScene('ui').journal.visible)).toBe(false);

  await page.keyboard.press('Escape'); // clean up: back to the world
  await expect.poll(async () => mgActive(page, 'minigame-tetris')).toBe(false);
});

test('FB-0035: M does not toggle the minimap while a mini-game owns the screen', async ({ page }) => {
  await openGame(page, { map: 'main-block-1', minigames: true });
  await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
  const before = await page.evaluate(() => game.scene.getScene('ui').minimap.visible);
  await talkToStation(page, 'room195', 'minigame-tetris');
  await expect.poll(async () => mgActive(page, 'minigame-tetris')).toBe(true);

  await page.keyboard.press('m');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => game.scene.getScene('ui').minimap.visible)).toBe(before);

  await page.keyboard.press('Escape');
  await expect.poll(async () => mgActive(page, 'minigame-tetris')).toBe(false);
});

test('FB-0035: a warp fade blocks HUD keys the same way a cutscene does', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  const before = await page.evaluate(() => game.scene.getScene('ui').minimap.visible);

  await page.evaluate(() => { game.scene.getScene('world').transitioning = true; });
  await page.keyboard.press('m');
  await page.keyboard.press('j');
  await page.keyboard.press('n');
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => game.scene.getScene('ui').minimap.visible)).toBe(before);
  expect(await page.evaluate(() => game.scene.getScene('ui').journal.visible)).toBe(false);
  expect(await page.evaluate(() => game.scene.getScene('ui').fullMap.visible)).toBe(false);

  await page.evaluate(() => { game.scene.getScene('world').transitioning = false; }); // leave clean
});

test('FB-0035: number keys and the wheel do not change the hotbar slot while a dialog is open', async ({ page }) => {
  await openGame(page);
  await startGame(page);
  await teleport(page, 11, 13);
  await holdKey(page, 'w', 500);
  await waitForMap(page, 'house');
  await teleport(page, 8, 5);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);

  const before = (await state(page)).selected;
  await page.keyboard.press('3');
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(100);
  expect((await state(page)).selected).toBe(before);
});
