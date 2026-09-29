// Ambient campus/Main Block life (quality loop, Characters and depth run 1, 2026-09-29): the engine
// side of src/ambient.js -- src/scenes/world.js createAmbient()/updateAmbient() -- needs a real Phaser
// scene, unlike the content itself (checked without a browser in tests/unit/ambient.test.js). Written
// per this task's own brief ("write e2e tests (NOT run) that ambient NPCs never block the story
// route") but NOT run this session: docs/QUALITY_LOOP.md's build-only phase allows unit tests only,
// no Playwright runs. Whoever runs the next `npm test` (or the quality-loop review pass) is the first
// real execution of this file.
const { test, expect } = require('@playwright/test');
const { openGame, waitForMap, teleport, state } = require('./helpers');

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
    // src/ambient.js AMBIENT.campus: 3 patrol walkers + 1 jogger + 3 sitting + 2 chatting + 1 by the
    // bus stop -- "8-12 students" (this task's own brief).
    expect(tiles.length).toBeGreaterThanOrEqual(8);
    expect(tiles.length).toBeLessThanOrEqual(12);

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

  test('talking to an ambient student shows a short neutral line, never story information', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    const target = (await ambientTiles(page))[0];
    await teleport(page, Math.round(target.x), Math.round(target.y) + 1);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
    const line = await page.evaluate(() => game.scene.getScene('ui').dialog.body.text);
    expect(line.toLowerCase()).not.toMatch(/key|volunteer|treasure|physics lab|icvl|room 195|\bbox\b/);
  });

  test('ambient NPCs hide for the whole opening script and reappear once it ends', async ({ page }) => {
    await openGame(page, { map: 'campus', cutscene: true, intro: true });
    // Right after boot the opening script (SCRIPTS.opening) is running: every ambient sprite should be
    // invisible (setAmbientVisible(false) in playOpeningSequence()), not just "not updating".
    const duringScript = await ambientTiles(page);
    expect(duringScript.every((t) => t.visible === false)).toBe(true);

    // Skip to the end of the script and confirm they're back.
    await page.evaluate(async () => {
      const world = game.scene.getScene('world');
      while (world.scriptRunner.isRunning) {
        world.scriptRunner.skip?.();
        await new Promise((r) => setTimeout(r, 50));
      }
    });
    const afterScript = await ambientTiles(page);
    expect(afterScript.every((t) => t.visible === true)).toBe(true);
  });
});
