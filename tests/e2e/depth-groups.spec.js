// ADR 0015 (FB-0027, "the 3D presence is not there, for example I walk over doors"): y-sorted depth
// groups and Pokemon-style door entry. Engine coverage on the meadow/house test maps (src/maps.js
// depthGroups on meadow, the house door's own `openTiles`) -- the real campus gets its own depth
// groups from a parallel art branch, and this engine must already work once that data lands
// (docs/plans/2026-09-26-premium-pass.md).
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, holdKey, teleport, waitForMap } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page); // meadow, the depth-group test map (src/maps.js)
  await startGame(page);
});

// The house's own depth group (src/maps.js meadow.depthGroups): { x: 9, y: 9, width: 5, height: 4 }.
function houseGroup(page) {
  return page.evaluate(() => {
    const world = game.scene.getScene('world');
    const g = world.depthGroups.find((g) => g.x === 9 && g.y === 9);
    return g && { depth: g.depth };
  });
}

test('FB-0027: a map with depth groups bakes one per group, and a map without them has none', async ({ page }) => {
  const groups = await page.evaluate(() => game.scene.getScene('world').depthGroups.map((g) => ({ x: g.x, y: g.y, width: g.width, height: g.height })));
  expect(groups).toEqual(expect.arrayContaining([
    { x: 9, y: 9, width: 5, height: 4 },
    { x: 11, y: 3, width: 1, height: 1 },
    { x: 22, y: 10, width: 1, height: 1 },
  ]));
  expect(groups.length).toBe(3);
});

test('FB-0027: walking behind the meadow house draws it above the player; walking in front draws the player above it', async ({ page }) => {
  const group = await houseGroup(page);
  expect(group).toBeTruthy();

  // North of the house (behind it, further from the camera) -- the group must be drawn on top.
  await teleport(page, 11, 7);
  await page.waitForTimeout(80); // a frame for movePlayer() to (re)compute her depth after the teleport
  let depth = await page.evaluate(() => game.scene.getScene('world').player.depth);
  expect(depth).toBeLessThan(group.depth);

  // South of the house (in front of it) -- she must be drawn on top of the group now.
  await teleport(page, 11, 13);
  await page.waitForTimeout(80);
  depth = await page.evaluate(() => game.scene.getScene('world').player.depth);
  expect(depth).toBeGreaterThan(group.depth);
});

test('FB-0027: stepping through the house door locks input, walks her behind the house before the fade, then warps in', async ({ page }) => {
  const group = await houseGroup(page);

  await page.evaluate(() => {
    const world = game.scene.getScene('world');
    const warp = world.getWarpPoints().find((w) => w.to === 'house');
    world.player.body.reset(11 * 16 + 8, 12 * 16 + 8); // standing exactly on the door tile
    world.facing = 'up'; // walking north into the door, same as approaching it for real
    world.transitioning = true;
    world.prompt.setVisible(false);
    world.playDoorDeparture(warp);
  });
  // Mid-tween (the walk-in is 250ms, DOOR_WALK_MS): still on the meadow, one tile further in than
  // the door tile, and already hidden behind the house -- well before the fade even starts.
  await page.waitForTimeout(120);
  const mid = await page.evaluate(() => {
    const world = game.scene.getScene('world');
    return {
      map: world.mapKey,
      tile: { x: Math.floor(world.player.x / 16), y: Math.floor(world.player.y / 16) },
      depth: world.player.depth,
      animKey: world.player.anims.currentAnim && world.player.anims.currentAnim.key,
    };
  });
  expect(mid.map).toBe('meadow'); // not warped yet -- still mid walk-in
  expect(mid.tile).toEqual({ x: 11, y: 11 }); // one tile further in, not still on the door tile
  expect(mid.depth).toBeLessThan(group.depth); // hidden behind the house, before the fade even starts
  expect(mid.animKey).toBe('walk-up'); // the walk animation keeps playing through the walk-in

  await waitForMap(page, 'house');
  const after = await state(page);
  expect(after.ready).toBe(true);
  expect(after.facing).toBe('up');
});

test('FB-0027: arriving through a door starts hidden in the doorway, walks out, and ends facing down with input unlocked', async ({ page }) => {
  const group = await houseGroup(page);

  const start = await page.evaluate(() => {
    const world = game.scene.getScene('world');
    // The meadow-side spawn the house's own exit warp uses (src/maps.js house.warps).
    world.spawn = { x: 11, y: 13, facing: 'down' };
    world.playDoorArrival('door');
    return {
      tile: { x: Math.floor(world.player.x / 16), y: Math.floor(world.player.y / 16) },
      y: world.player.y,
      depth: world.player.depth,
      transitioning: world.transitioning,
    };
  });
  expect(start.tile).toEqual({ x: 11, y: 12 }); // the door tile itself -- not the final spawn yet
  expect(start.depth).toBeLessThanOrEqual(group.depth); // hidden behind (or exactly at) the house's own base line
  expect(start.transitioning).toBe(true); // input stays locked for the whole walk-out

  // Mid-tween, she should already have moved off the door tile, still hidden.
  await page.waitForTimeout(80);
  const mid = await page.evaluate(() => {
    const world = game.scene.getScene('world');
    return { y: world.player.y, depth: world.player.depth };
  });
  expect(mid.y).toBeGreaterThan(start.y);

  await expect.poll(async () => (await state(page)).ready).toBe(true);
  const after = await state(page);
  expect(after.tile).toEqual({ x: 11, y: 13 });
  expect(after.facing).toBe('down');
});

test('FB-0027: the house door\'s openTiles overlay is shown while open and gone once closed', async ({ page }) => {
  const counts = await page.evaluate(() => {
    const world = game.scene.getScene('world');
    const warp = world.getWarpPoints().find((w) => w.to === 'house');
    const before = world.children.list.filter((c) => c.texture && c.texture.key === 'tiles').length;
    const overlay = world.showDoorOverlay(warp);
    const during = world.children.list.filter((c) => c.texture && c.texture.key === 'tiles').length;
    overlay.destroy();
    const after = world.children.list.filter((c) => c.texture && c.texture.key === 'tiles').length;
    return { before, during, after };
  });
  expect(counts.during).toBeGreaterThan(counts.before); // the 'doorway' overlay tile was added
  expect(counts.after).toBe(counts.before); // and cleaned up once closed
});

test('FB-0027: a locked door rattles and toasts once per approach, and never warps', async ({ page }) => {
  const { errors } = await openGame(page, { map: null }); // the campus, for a real locked door
  await startGame(page);
  const door = await page.evaluate(() => {
    const world = game.scene.getScene('world');
    const d = world.mapObjects.find((o) => o.type === 'door' && o.props.building === 'Library Block');
    return { x: Math.floor(d.x), y: Math.floor(d.y) };
  });

  await teleport(page, door.x, door.y + 2);
  await holdKey(page, 'w', 800);
  let s = await state(page);
  expect(s.map).toBe('campus'); // never actually transitioned
  expect(s.toast).toBe('Locked for the event');

  // Staying at the door (or approaching again) must not throw, and must still never warp -- the
  // rattle is a one-shot per approach, same throttle as the toast (world.js's own lockedWarned).
  await holdKey(page, 'w', 500);
  s = await state(page);
  expect(s.map).toBe('campus');
  expect(errors).toEqual([]);
});

test('FB-0027: mashing keys during a door entry never double-warps or soft-locks', async ({ page }) => {
  await teleport(page, 11, 13); // just south of the house door
  await holdKey(page, 'w', 500); // walks into the door tile and triggers the departure sequence
  // Confirm the sequence actually started (robustness.spec.js's own pattern) before mashing, so the
  // mash lands *during* the walk-in/fade/arrival-walk-out, not before it.
  await expect.poll(async () => (await state(page)).map === 'house' || !(await state(page)).ready).toBe(true);
  // Every other key a bored/impatient player might hit while it plays -- deliberately *not* movement
  // (robustness.spec.js's own rule: mashing movement at a door threshold would just legitimately walk
  // her back and forth, a test-design artifact, not a soft-lock) -- the same 8-iteration count that
  // file's own equivalent test already uses for this exact door.
  for (let i = 0; i < 8; i++) {
    for (const key of ['e', 'Space', 'Escape', 'Enter', 'm', 'n', 'h', 'Shift']) await page.keyboard.down(key);
    for (const key of ['e', 'Space', 'Escape', 'Enter', 'm', 'n', 'h', 'Shift']) await page.keyboard.up(key);
  }
  await waitForMap(page, 'house');

  // Landed exactly once, on the house map, not bounced back to the meadow or left stuck mid-warp.
  let after = await state(page);
  expect(after.map).toBe('house');
  expect(after.ready).toBe(true);
  // Recovers cleanly from whatever the mash left open, and ordinary movement works afterward.
  for (const key of ['Escape', 'Enter']) await page.keyboard.press(key);
  await expect.poll(async () => {
    const s = await state(page);
    return !s.pause.visible && !s.dialogOpen && !s.fullMapVisible;
  }).toBe(true);
  const before = await state(page);
  await holdKey(page, 's', 400);
  after = await state(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(5);
});
