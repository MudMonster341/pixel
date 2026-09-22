// The LUG treasure hunt playthrough (docs/STORY.md, M3): a real new game, named, walking in, talking
// to the volunteer, reaching all three key rooms, taking each key, and returning for the reward --
// asserting the quest stage, key count, quest tracker text and journal at every step. Locked
// doors/stairs are covered here too (the ones this story actually gates) plus a dedicated regression
// in tests/e2e/interiors.spec.js ("locked doors", the Library Block's permanent lock).
//
// Real key-driven navigation for the name entry and the campus walk-in (so the M3a opening and the
// {name} substitution are genuinely exercised); teleport() for the rest, the same shortcut
// tests/e2e/interiors.spec.js already uses to reach doors/stairs without a multi-minute walk through
// two floors of corridors.
const { test, expect } = require('@playwright/test');
const {
  openTitle, chooseTitleMenu, waitForBoot, state, holdKey, teleport, waitForMap, finishDialog, countItem, pressUntil,
} = require('./helpers');

const isActive = (page, key) => page.evaluate((k) => game.scene.isActive(k), key);

function findDoor(page, building) {
  return page.evaluate((b) => {
    const o = game.scene.getScene('world').mapObjects.find((obj) => obj.type === 'door' && obj.props.building === b);
    return { x: Math.floor(o.x), y: Math.floor(o.y) };
  }, building);
}

// Exact name match (not a substring) so "Main Block Stairs 1 (up)" is never confused with "Main
// Block Stairs 1 (down)" or another floor's own stairs sharing part of the same name.
function findStairsNamed(page, name) {
  return page.evaluate((n) => {
    const o = game.scene.getScene('world').mapObjects.find((obj) => obj.type === 'stairs' && obj.name === n);
    return o ? { x: Math.floor(o.x), y: Math.floor(o.y) } : null;
  }, name);
}

// Warp objects fire as soon as the player's feet tile matches (docs/INTERIORS_PLAN.md); standing on
// one and letting a few frames pass is enough, exactly like tests/e2e/interiors.spec.js's stepOnto().
async function stepOnto(page, tile) {
  await teleport(page, tile.x, tile.y);
  await page.waitForTimeout(400);
}

function npcTile(page, id) {
  return page.evaluate((npcId) => {
    const npc = game.scene.getScene('world').npcs.find((n) => n.def.id === npcId);
    return { x: Math.floor(npc.x / 16), y: Math.floor(npc.y / 16) };
  }, id);
}

function keyStationTile(page, id) {
  return page.evaluate((ksId) => {
    const ks = game.scene.getScene('world').keyStations.find((k) => k.def.id === ksId);
    return ks ? { x: Math.floor(ks.x / 16), y: Math.floor(ks.y / 16) } : null;
  }, id);
}

function questTrackerText(page) {
  return page.evaluate(() => {
    const t = game.scene.getScene('ui').questTracker;
    return { objective: t.objective.text, keys: t.keysText.text };
  });
}

// Talks to whoever/whatever is nearest (NPC or key station -- both use the "E" bubble and the same
// dialog box, src/scenes/world.js nearestInteractable()) and runs the conversation to its end.
async function talk(page) {
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  await finishDialog(page);
}

test('the LUG treasure hunt: a named playthrough from the gate to the reward box', async ({ page }) => {
  // ---------- the M3a opening: name entry, so {name} substitution is real, not simulated ----------
  await openTitle(page, { map: null, intro: true });
  await chooseTitleMenu(page, 'play');
  await expect.poll(async () => isActive(page, 'greeting')).toBe(true);
  await pressUntil(page, 'Escape', () => isActive(page, 'name-entry'));

  const nameScene = () => page.evaluate(() => game.scene.getScene('name-entry').name);
  await expect.poll(nameScene).not.toBe('');
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  await expect.poll(nameScene).toBe('');
  for (const key of ['z', 'a', 'r', 'a']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(100);
  }
  await expect.poll(nameScene).toBe('ZARA');
  await pressUntil(page, 'Enter', () => isActive(page, 'customize'));
  await pressUntil(page, 'Enter', () => isActive(page, 'bus-arrival'));
  await pressUntil(page, 'Escape', async () => !(await isActive(page, 'bus-arrival')));
  await waitForBoot(page);

  let s = await state(page);
  expect(s.map).toBe('campus');
  expect(await page.evaluate(() => GameState.playerName)).toBe('ZARA');
  expect(s.quest).toEqual({ stage: 'arrival', keys: { physicsLab: false, icvl: false, room195: false } });

  // ---------- walk in ----------
  const door = await findDoor(page, 'Main Block');
  await teleport(page, door.x, door.y + 2);
  await holdKey(page, 'w', 800);
  await waitForMap(page, 'main-block-g');

  // ---------- the LUG volunteer: first talk sets the hunt going, using her real chosen name ----------
  const volunteerTile = await npcTile(page, 'lug-volunteer');
  await teleport(page, volunteerTile.x, volunteerTile.y + 1);
  await expect.poll(async () => (await state(page)).promptVisible).toBe(true);
  expect((await state(page)).promptFrame).toBe(1); // "!": never talked to before

  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  // Let the first line finish typing, then check her own name actually appears in it.
  await expect.poll(async () => page.evaluate(() => !game.scene.getScene('ui').dialog.typing)).toBe(true);
  const firstLine = await page.evaluate(() => game.scene.getScene('ui').dialog.body.text);
  expect(firstLine).toContain('ZARA');
  await finishDialog(page);

  s = await state(page);
  expect(s.quest.stage).toBe('hunting');
  expect(s.journal).toEqual(['The LUG volunteer asked me to find 3 keys hidden around campus.']);
  let tracker = await questTrackerText(page);
  expect(tracker.objective).toContain('Physics Lab');
  expect(tracker.keys).toBe('Keys: 0 / 3');

  // ---------- up to the 1st floor (now unlocked) for the ICVL and Room 195 keys ----------
  const upG = await findStairsNamed(page, 'Main Block Stairs G (up)');
  await stepOnto(page, upG);
  await waitForMap(page, 'main-block-1');

  const icvlTile = await keyStationTile(page, 'icvl');
  await teleport(page, icvlTile.x, icvlTile.y + 1);
  await talk(page);
  s = await state(page);
  expect(s.quest.keys).toEqual({ physicsLab: false, icvl: true, room195: false });
  expect(countItem(s.slots, 'keyIcvl')).toBe(1);
  expect(s.journal).toContain('Found a key taped under a bench in the ICVL.');
  tracker = await questTrackerText(page);
  expect(tracker.objective).toContain('Physics Lab'); // still the first missing key, not "next by count"
  expect(tracker.keys).toBe('Keys: 1 / 3');

  const room195Tile = await keyStationTile(page, 'room195');
  await teleport(page, room195Tile.x, room195Tile.y + 1);
  await talk(page);
  s = await state(page);
  expect(s.quest.keys).toEqual({ physicsLab: false, icvl: true, room195: true });
  expect(countItem(s.slots, 'keyRoom195')).toBe(1);
  tracker = await questTrackerText(page);
  expect(tracker.objective).toContain('Physics Lab');
  expect(tracker.keys).toBe('Keys: 2 / 3');

  // Talking to the key station again shows the "already taken" line, not another key.
  await teleport(page, room195Tile.x, room195Tile.y + 1);
  await talk(page);
  expect((await state(page)).quest.keys.room195).toBe(true);
  expect(countItem((await state(page)).slots, 'keyRoom195')).toBe(1); // not given twice

  // ---------- up through the 2nd floor (a through-route, no key) to the 3rd for the Physics Lab ----------
  const up1 = await findStairsNamed(page, 'Main Block Stairs 1 (up)');
  await stepOnto(page, up1);
  await waitForMap(page, 'main-block-2');
  const up2 = await findStairsNamed(page, 'Main Block Stairs 2 (up)');
  await stepOnto(page, up2);
  await waitForMap(page, 'main-block-3');

  const physicsLabTile = await keyStationTile(page, 'physicsLab');
  await teleport(page, physicsLabTile.x, physicsLabTile.y + 1);
  await talk(page);
  s = await state(page);
  expect(s.quest.keys).toEqual({ physicsLab: true, icvl: true, room195: true });
  expect(countItem(s.slots, 'keyPhysicsLab')).toBe(1);
  tracker = await questTrackerText(page);
  expect(tracker.objective).toContain('Bring all 3 keys');
  expect(tracker.keys).toBe('Keys: 3 / 3');

  // ---------- back down to the ground floor and the stall, for the reward ----------
  const down3 = await findStairsNamed(page, 'Main Block Stairs 3 (down)');
  await stepOnto(page, down3);
  await waitForMap(page, 'main-block-2');
  const down2 = await findStairsNamed(page, 'Main Block Stairs 2 (down)');
  await stepOnto(page, down2);
  await waitForMap(page, 'main-block-1');
  const down1 = await findStairsNamed(page, 'Main Block Stairs 1 (down)');
  await stepOnto(page, down1);
  await waitForMap(page, 'main-block-g');

  const volunteerTile2 = await npcTile(page, 'lug-volunteer');
  await teleport(page, volunteerTile2.x, volunteerTile2.y + 1);
  await talk(page);

  s = await state(page);
  expect(s.quest.stage).toBe('rewarded');
  expect(countItem(s.slots, 'lugBox')).toBe(1);
  // One journal line for the quest start, one per key found, one for the reward.
  expect(s.journal.length).toBe(5);
  expect(s.journal[s.journal.length - 1]).toMatch(/first to finish/);
  tracker = await questTrackerText(page);
  expect(tracker.objective).toMatch(/complete/i);

  // ---------- the journal (J) lists every clue given so far ----------
  await page.keyboard.press('j');
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').journal.visible)).toBe(true);
  expect(await page.evaluate(() => game.scene.getScene('ui').isBlocking())).toBe(true); // movement blocked while it's open
  const journalRows = await page.evaluate(() => game.scene.getScene('ui').journal.rowTexts.map((t) => t.text));
  expect(journalRows.length).toBe(5);
  expect(journalRows[0]).toContain('3 keys hidden around campus');
  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => game.scene.getScene('ui').journal.visible)).toBe(false);
});
