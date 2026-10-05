// Talkable campus life (decisions/0018): every ambient student can be talked to, and cats and birds live
// on the campus. The content and the behaviour rules are checked without a browser in
// tests/unit/{ambient,campus-facts,animals}.test.js; this exercises the Phaser side in a real scene
// (src/scenes/world.js interact()/createAnimals()/updateAnimals()).
//
// Written but NOT run in the build phase (docs/QUALITY_LOOP.md: unit tests only). The first real
// execution is the next full test round.
const { test, expect } = require('@playwright/test');
const { openGame, waitForMap, teleport, state, startGame, finishDialog, holdKey, skipWorldScript } = require('./helpers');

// What the live scene knows about an ambient student, by id.
function student(page, id) {
  return page.evaluate((wanted) => {
    const a = game.scene.getScene('world').ambientNpcs.find((n) => n.def.id === wanted);
    return {
      x: a.sprite.x, y: a.sprite.y, tileX: Math.floor(a.sprite.x / 16), tileY: Math.floor(a.sprite.y / 16),
      talking: a.talking, facing: a.facing, role: a.def.role, speed: a.sprite.body.speed, kind: a.def.kind,
    };
  }, id);
}

function dialogNow(page) {
  return page.evaluate(() => {
    const dialog = game.scene.getScene('ui').dialog;
    return { open: dialog.isOpen, speaker: dialog.name.text, lines: [...(dialog.lines || [])] };
  });
}

function animalNow(page, id) {
  return page.evaluate((wanted) => {
    const a = game.scene.getScene('world').animals.find((n) => n.def.id === wanted);
    const s = a.state;
    return { state: s.state, x: s.x, y: s.y, homeX: s.homeX, homeY: s.homeY, away: s.away, visible: a.sprite.visible, alt: s.alt, talking: s.talking, tame: s.tame };
  }, id);
}

test.describe('Talkable campus students (ADR 0018)', () => {
  test('E next to an idle student opens a role-labelled dialog with a real campus fact, then she can walk on', async ({ page }) => {
    const { errors } = await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const id = 'campus-amb-hostel-1'; // an idle boys'-hostel resident at (101,61)
    const before = await student(page, id);
    await teleport(page, before.tileX, before.tileY + 1);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);

    const talk = await dialogNow(page);
    const expected = await page.evaluate((role) => ({ label: CAMPUS_ROLES[role].label, facts: campusFactsFor(role).map((f) => f.text) }), before.role);
    expect(talk.speaker).toBe(expected.label); // a role label, never a person's name
    expect(expected.facts).toContain(talk.lines[talk.lines.length - 1]); // the last page is a real fact from the role's pool
    expect(talk.lines.length).toBe(2); // first visit: an opener, then the fact

    const during = await student(page, id);
    expect(during.talking).toBe(true);
    expect(during.facing).toBe('down'); // turned toward her (she is one tile below)
    expect(during.speed).toBe(0);

    await finishDialog(page);
    expect((await student(page, id)).talking).toBe(false);
    // She is free to walk on.
    const start = await state(page);
    await holdKey(page, 'd', 300);
    expect((await state(page)).x).toBeGreaterThan(start.x + 4);
    expect(errors).toEqual([]);
  });

  test('a second visit goes straight to the next fact, and the rotation does not repeat before the pool is used', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const id = 'campus-amb-hostel-1';
    const s = await student(page, id);
    const heard = [];
    for (let i = 0; i < 3; i++) {
      await teleport(page, s.tileX, s.tileY + 1);
      await page.keyboard.press('e');
      await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
      const talk = await dialogNow(page);
      heard.push(talk.lines[talk.lines.length - 1]);
      if (i > 0) expect(talk.lines.length).toBe(1);
      await finishDialog(page);
    }
    expect(new Set(heard).size).toBe(3); // the hostel-resident pool has 3 facts: all before any repeat
  });

  test('a patrolling student stops and faces her while talking, then walks on', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const id = 'campus-amb-hostel-2'; // patrols the long hostel path
    const here = await student(page, id);
    await teleport(page, here.tileX, here.tileY + 1);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
    await page.waitForTimeout(400);
    const during = await student(page, id);
    expect(during.talking).toBe(true);
    expect(during.speed).toBe(0);
    expect(Math.abs(during.x - here.x)).toBeLessThan(6); // it did not wander off mid-sentence
    await finishDialog(page);
    await teleport(page, here.tileX, here.tileY + 6); // step away so its "yield to her" pause is not the reason it waits
    await expect.poll(async () => (await student(page, id)).speed, { timeout: 5000 }).toBeGreaterThan(0);
  });

  test('every ambient student on the campus has a role and a name tag that is a role label', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const bad = await page.evaluate(() => game.scene.getScene('world').ambientNpcs
      .filter((a) => !CAMPUS_ROLES[a.def.role] || a.sprite.def.name !== CAMPUS_ROLES[a.def.role].label)
      .map((a) => a.def.id));
    expect(bad).toEqual([]);
  });

  test('a talkable student near a story object never takes the key station\'s E', async ({ page }) => {
    await openGame(page, { map: 'main-block-1' });
    await waitForMap(page, 'main-block-1');
    await startGame(page);
    // P5c (FB-0071): the ICL is a sealed lab now and its students wait in the corridor outside. Teleported beside the lab's core console (the key
    // station, (6,11)) and Alice, E there is the console's or Alice's, never a talkable student's.
    await teleport(page, 6, 12);
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
    const talk = await dialogNow(page);
    const roleLabels = await page.evaluate(() => Object.values(CAMPUS_ROLES).map((r) => r.label));
    expect(roleLabels).not.toContain(talk.speaker);
  });
});

test.describe('Campus animals (ADR 0018)', () => {
  test('the campus has cats and birds (at most 8), all drawn from loaded sheets, none with a physics body', async ({ page }) => {
    const { errors } = await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const info = await page.evaluate(() => {
      const world = game.scene.getScene('world');
      return {
        count: world.animals.length,
        authored: ANIMALS.campus.length,
        kinds: world.animals.map((a) => a.state.kind),
        missing: world.animals.filter((a) => a.sprite.texture.key === '__MISSING').map((a) => a.def.id),
        bodies: world.animals.filter((a) => a.sprite.body).map((a) => a.def.id),
      };
    });
    expect(info.count).toBe(info.authored);
    expect(info.count).toBeLessThanOrEqual(8);
    expect(info.kinds.filter((k) => k === 'cat').length).toBeGreaterThanOrEqual(3);
    expect(info.kinds.filter((k) => k === 'bird').length).toBeGreaterThanOrEqual(3);
    expect(info.missing).toEqual([]);
    expect(info.bodies).toEqual([]); // they can never block her
    expect(errors).toEqual([]);
  });

  test('there are no animals indoors', async ({ page }) => {
    await openGame(page, { map: 'main-block-g' });
    await waitForMap(page, 'main-block-g');
    expect(await page.evaluate(() => game.scene.getScene('world').animals.length)).toBe(0);
  });

  test('a talkable cat turns to her, says "Meow.", shows a heart and stays put', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const id = 'campus-cat-gate';
    const cat = await animalNow(page, id);
    await teleport(page, Math.floor(cat.x), Math.floor(cat.y) + 1);
    await page.waitForTimeout(300);
    expect((await animalNow(page, id)).state).not.toBe('flee'); // a tame cat never runs
    await page.keyboard.press('e');
    await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
    const talk = await dialogNow(page);
    expect(talk.speaker).toBe('Cat');
    expect(talk.lines).toEqual(['Meow.']);
    expect((await animalNow(page, id)).talking).toBe(true);
    await finishDialog(page);
    expect((await animalNow(page, id)).talking).toBe(false);
  });

  test('a shy cat runs a short way off when she gets within a tile or two, then wanders back later', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const id = 'campus-cat-parking';
    const home = await animalNow(page, id);
    await teleport(page, Math.floor(home.x) - 1, Math.floor(home.y));
    await expect.poll(async () => (await animalNow(page, id)).state, { timeout: 4000 }).toMatch(/startle|flee/);
    await expect.poll(async () => (await animalNow(page, id)).away, { timeout: 6000 }).toBe(true);
    const away = await animalNow(page, id);
    expect(Math.hypot(away.x - home.x, away.y - home.y)).toBeGreaterThan(1.5);
    expect(Math.hypot(away.x - home.x, away.y - home.y)).toBeLessThan(6); // a short run, not across the map
  });

  test('a bird takes off when she comes close, and is out of sight or flying, not blocking anything', async ({ page }) => {
    await openGame(page, { map: 'campus' });
    await waitForMap(page, 'campus');
    const id = 'campus-bird-plaza-1';
    const bird = await animalNow(page, id);
    await teleport(page, Math.floor(bird.x) - 1, Math.floor(bird.y));
    await expect.poll(async () => (await animalNow(page, id)).state, { timeout: 3000 }).toMatch(/fly|gone/);
    await expect.poll(async () => (await animalNow(page, id)).alt >= 0).toBe(true);
  });

  test('animals hide for the whole of a cutscene script and reappear after it', async ({ page }) => {
    await openGame(page, { map: 'campus', cutscene: true });
    await startGame(page);
    const trigger = await page.evaluate(() => {
      const t = game.scene.getScene('world').mapObjects.find((o) => o.type === 'cutscene' && o.props.cutscene === 'gate2');
      return { x: t.x + t.width / 2, y: t.y + t.height / 2 };
    });
    await teleport(page, trigger.x, trigger.y);
    await expect.poll(async () => (await state(page)).cutsceneActive).toBe(true);
    expect(await page.evaluate(() => game.scene.getScene('world').animals.every((a) => !a.sprite.visible))).toBe(true);
    await skipWorldScript(page);
    expect(await page.evaluate(() => game.scene.getScene('world').animals.some((a) => a.sprite.visible))).toBe(true);
  });
});
