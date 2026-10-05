// FB-0077 (not run during the build phase, docs/QUALITY_LOOP.md): the Gate 2 boom barrier starts lowered across the road, rises when she comes within a
// few tiles (the real Phaser tiles and overlays, which the unit tests only stand in for), and stays up, also after a restart of the scene.
const { test, expect } = require('@playwright/test');
const { openGame, teleport, waitForMap } = require('./helpers');

// The tile the barrier's arm lies on at the middle of the avenue, and the one two tiles west of the housing's column (above-left of the pivot).
const probe = (page) => page.evaluate(() => {
  const world = game.scene.getScene('world');
  const b = world.gateBarrier;
  const structures = world.solidLayers.find((l) => l.layer.name === 'structures');
  const name = (x, y) => {
    const tile = structures.getTileAt(x, y);
    return tile && tile.index >= 0 ? world.tileInfo.tiles[tile.index - 1].name : null;
  };
  const gate = world.mapObjects.find((o) => o.type === 'gate' && /Gate 2/.test(o.name));
  const row = Math.floor(gate.y) - 1;
  const gx = Math.floor(gate.x);
  const pivotX = b.box.x1;
  return { open: b.open, flag: GameState.flags.gateBarrierOpen === true, arm: name(gx, row), up: name(pivotX, row - 1), post: name(b.box.x0, row), row, gx, box: b.box };
});

test('the Gate 2 barrier starts lowered, rises as she walks up to it and stays up', async ({ page }) => {
  await openGame(page, { map: null });
  await waitForMap(page, 'campus');
  const first = await probe(page);
  expect(first.open).toBe(false);
  expect(first.arm).toBe('barrierArm');
  expect(first.up).toBeNull();

  await teleport(page, first.gx, first.row + 12); // well outside: still lowered
  await page.waitForTimeout(300);
  expect((await probe(page)).arm).toBe('barrierArm');

  await teleport(page, first.gx, first.row + 3); // within range: it rises (about 0.6 s)
  await expect.poll(async () => (await probe(page)).flag).toBe(true);
  await expect.poll(async () => (await probe(page)).up, { timeout: 5000 }).toBe('barrierUpMid'); // the frames play first, then the open tiles land
  const raised = await probe(page);
  expect(raised.up).toBe('barrierUpMid');
  expect(raised.post).toBe('barrierRestOpen');

  await teleport(page, first.gx, first.row + 20); // walking away does not lower it
  await page.waitForTimeout(500);
  expect((await probe(page)).arm).toBeNull();

  // a restart of the scene (a door round trip, a reload with Continue) builds it up at once
  await page.evaluate(() => { game.scene.getScene('world').scene.restart({ map: 'campus' }); }); // (a block: the returned plugin is not serialisable)
  await waitForMap(page, 'campus');
  const again = await probe(page);
  expect(again.open).toBe(true);
  expect(again.arm).toBeNull();
  expect(again.up).toBe('barrierUpMid');
});
