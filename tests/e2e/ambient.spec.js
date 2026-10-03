// Ambient campus/Main Block life (quality loop, Characters and depth run 1, 2026-09-29): the engine
// side of src/ambient.js -- src/scenes/world.js createAmbient()/updateAmbient() -- needs a real Phaser
// scene, unlike the content itself (checked without a browser in tests/unit/ambient.test.js). Written
// per this task's own brief ("write e2e tests (NOT run) that ambient NPCs never block the story
// route") but NOT run this session: docs/QUALITY_LOOP.md's build-only phase allows unit tests only,
// no Playwright runs. Whoever runs the next `npm test` (or the quality-loop review pass) is the first
// real execution of this file.
const { test, expect } = require('@playwright/test');
const { openGame, waitForMap, teleport, state, startGame, skipWorldScript } = require('./helpers');

// Every ambient sprite's tile position + its def's kind/id, read straight from the live scene rather
// than re-deriving it, so this is checking the *engine's* placement (createAmbient()/toPixel()), not
// just re-checking src/ambient.js's own numbers a second time (that's tests/unit/ambient.test.js's job).
function ambientTiles(page) {
  return page.evaluate(() => {
    const world = game.scene.getScene('world');
    return (world.ambientNpcs || []).map((a) => ({
      id: a.def.id,
      kind: a.def.kind,
      x: a.sprite.x / 16,
      y: a.sprite.y / 16,
      visible: a.sprite.visible,
    }));
  });
}

function doorAndStairsTiles(page) {
  return page.evaluate(() => {
    const world = game.scene.getScene('world');
    return (world.mapObjects || [])
      .filter((o) => o.type === 'door' || o.type === 'stairs')
      .map((o) => ({ name: o.name, x: o.x, y: o.y, width: o.width, height: o.height }));
  });
}

test.describe('Ambient campus/Main Block life', () => {
  test('campus spawns the authored ambient NPCs, none of them sitting on a door/stairs tile', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    const tiles = await ambientTiles(page);
    // src/ambient.js AMBIENT.campus: the original Gate 2/avenue group plus (ADR 0018) people at the
    // library and mechanical fronts, hostels, parking, sports and DIAC Park. The whole list exists;
    // only the ones near the camera are updated each frame (tests/unit/ambient.test.js caps one screen).
    const authored = await page.evaluate(() => AMBIENT.campus.length);
    expect(tiles.length).toBe(authored);
    expect(tiles.length).toBeGreaterThanOrEqual(30);

    const doors = await doorAndStairsTiles(page);
    for (const t of tiles) {
      const onDoor = doors.some((d) => t.x >= d.x && t.x < d.x + Math.max(d.width, 1) && t.y >= d.y && t.y < d.y + Math.max(d.height, 1));
      expect(onDoor, `${t.id} at (${t.x},${t.y}) sits on a door/stairs tile`).toBe(false);
    }
  });

  test('a patrolling ambient NPC yields (stops moving) rather than blocking her when she walks up to it', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    const patrol = (await ambientTiles(page)).find((t) => t.kind === 'patrol');
    expect(patrol).toBeTruthy();

    // Stand right next to it and give updateAmbient() a few frames to react -- AMBIENT_PAUSE_RANGE
    // (world.js) is 20px (1.25 tiles), well inside this.
    await teleport(page, Math.round(patrol.x), Math.round(patrol.y));
    await page.waitForTimeout(300);
    const stillMoving = await page.evaluate((id) => {
      const world = game.scene.getScene('world');
      const a = world.ambientNpcs.find((n) => n.def.id === id);
      return a.sprite.body.speed > 0;
    }, patrol.id);
    expect(stillMoving, 'a patrol NPC should hold still (yield) rather than push through the player').toBe(false);
  });

  test('ambient NPCs never occupy the exact spawn tile or the volunteer\'s own tile on main-block-g', async ({ page }) => {
    await openGame(page, { map: 'main-block-g' });
    const tiles = await ambientTiles(page);
    const { spawn, volunteer } = await page.evaluate(() => {
      const world = game.scene.getScene('world');
      const s = world.mapObjects.find((o) => o.type === 'spawn');
      const v = world.npcs.find((n) => n.def.id === 'lug-volunteer');
      return { spawn: { x: s.x, y: s.y }, volunteer: { x: v.x / 16, y: v.y / 16 } };
    });
    for (const t of tiles) {
      expect(Math.round(t.x) === Math.round(spawn.x) && Math.round(t.y) === Math.round(spawn.y),
        `${t.id} stands on the spawn tile`).toBe(false);
      expect(Math.round(t.x) === Math.round(volunteer.x) && Math.round(t.y) === Math.round(volunteer.y),
        `${t.id} stands on the volunteer`).toBe(false);
    }
  });

  test('talking to an ambient student shows a campus fact line, never story information', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    // A stationary (idle/chat) NPC, never a 'patrol' one: updateAmbientPatrol() (world.js) keeps
    // moving a patrol NPC every frame, so its position read here would already be stale by the time
    // teleport() lands the player next to it a round-trip later -- this test cares about the dialog
    // a chat produces, not about chasing a moving target, so it picks one that never goes stale.
    const target = (await ambientTiles(page)).find((t) => t.kind !== 'patrol');
    // ambientTiles() reads a sprite's pixel position back into tile units (`sprite.x / 16`), which for
    // any tile-centered sprite (toPixel(), src/maplogic.js) is always exactly N.5 -- Math.round() on an
    // exact .5 rounds *up* (JS's own convention), silently landing a whole tile past the one the NPC
    // is actually standing on and outside INTERACT_RANGE, unlike Math.floor() (what state()'s own
    // `tile` field already uses for the same pixel-to-tile conversion, tests/e2e/helpers.js).
    await teleport(page, Math.floor(target.x), Math.floor(target.y) + 1);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
    const line = await page.evaluate(() => game.scene.getScene('ui').dialog.body.text);
    expect(line.toLowerCase()).not.toMatch(/key|volunteer|treasure|physics lab|icvl|room 195|\bbox\b/);
  });

  test('ambient NPCs hide for the whole opening script and reappear once it ends', async ({ page }) => {
    // `intro: true` on a direct openGame() boot can never actually start SCRIPTS.opening: that script
    // only ever runs from `playOpening: true` on WorldScene's own init data (src/scenes/world.js),
    // which is set exactly once, by CustomizeScene's hand-off at the end of the real title -> greeting
    // -> name-entry -> customize flow (src/scenes/intro-customize.js) -- a flow openGame()'s own
    // `?title=0` fast path boots straight past. Written-but-never-run assumption (this file's own
    // header comment); the fix runs a real script instead, the Gate 2 one (cutscene.spec.js's own
    // trigger), which shares the exact same setAmbientVisible() hide/reveal code path (playScript(),
    // world.js) as the opening does, so this still proves the promise ("ambient NPCs hide for the
    // whole of ANY script and reappear once it ends") end to end.
    await openGame(page, { map: 'campus', cutscene: true });
    await startGame(page);
    const trigger = await page.evaluate(() => {
      const t = game.scene.getScene('world').mapObjects.find((o) => o.type === 'cutscene' && o.props.cutscene === 'gate2');
      return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
    });
    await teleport(page, trigger.x, trigger.y);
    await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);
    // Every ambient sprite should be invisible (setAmbientVisible(false) in playScript()), not just
    // "not updating".
    const duringScript = await ambientTiles(page);
    expect(duringScript.every((t) => t.visible === false)).toBe(true);

    // Skip to the end of the script and confirm they're back.
    await skipWorldScript(page);
    const afterScript = await ambientTiles(page);
    expect(afterScript.every((t) => t.visible === true)).toBe(true);
  });
});
