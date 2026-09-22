// Mini-games (docs/ROADMAP.md M4, src/minigames/): interacting with a key station launches the right
// game, losing offers a one-keypress retry, the after-3-losses skip gift works, winning awards the
// key and hands control back to the world with the quest tracker updated, and Esc quits back cleanly
// without the key. `minigames: true` (tests/e2e/helpers.js) turns the real Phaser scenes on -- every
// other spec plays with `?minigames=0` (the default), which bypasses straight to 'won' so it can
// focus on the *quest* reacting correctly, not on replaying a platformer/flyer/Tetris session.
//
// Forcing a loss/win uses the exact same internal calls real gameplay reaches (the platformer's own
// `tryFinish()`/fall-through-the-floor check), teleporting the player the same way every other spec's
// `teleport()` helper already does (`player.body.reset(...)`, tests/e2e/helpers.js) -- this proves the
// framework's own retry/skip/outcome wiring end to end without needing to script a perfect run of
// each game's real controls (already covered per-game by the pure-logic unit tests).
const { test, expect } = require('@playwright/test');
const { openGame, teleport, state } = require('./helpers');

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

function mgInfo(page, sceneKey) {
  return page.evaluate((key) => {
    const active = game.scene.isActive(key);
    const s = active ? game.scene.getScene(key) : null;
    return {
      active,
      worldActive: game.scene.isActive('world'),
      mgState: s ? s.mgState : null,
      score: s ? s.score : null,
      cardItems: s && s.card ? s.card.items.map((item) => item.label) : null,
    };
  }, sceneKey);
}

// Talks to whoever/whatever is nearest and runs the conversation forward -- stops itself the instant
// a mini-game scene takes over (the dialog box closes as part of that handoff, same as it does for a
// cutscene), so it never over-presses E into the mini-game's own intro card.
async function talkToStation(page, id, sceneKey) {
  const tile = await keyStationTile(page, id);
  await teleport(page, tile.x, tile.y + 1);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  for (let i = 0; i < 10; i++) {
    if ((await mgInfo(page, sceneKey)).active) return;
    await page.keyboard.press('e');
    await page.waitForTimeout(80);
  }
}

test.describe('mini-games (docs/ROADMAP.md M4)', () => {
  test('the room195 key station launches Tetris; Esc from its intro card quits cleanly, no key', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });

    await talkToStation(page, 'room195', 'minigame-tetris');
    await expect.poll(async () => (await mgInfo(page, 'minigame-tetris')).active).toBe(true);
    let info = await mgInfo(page, 'minigame-tetris');
    expect(info.mgState).toBe('intro');
    expect(info.worldActive).toBe(false, 'the world is paused underneath the mini-game');

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await mgInfo(page, 'minigame-tetris')).active).toBe(false);
    await expect.poll(async () => (await mgInfo(page, 'minigame-tetris')).worldActive).toBe(true);
    expect((await state(page)).quest.keys.room195).toBe(false);
  });

  test('the icvl key station launches the flyer; the physicsLab station launches the platformer', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'icvl', 'minigame-flappy');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).active).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).active).toBe(false);

    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-platformer');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).active).toBe(true);
  });

  // Art pass (coordinator brief, 2026-09-22): "the hero is the lead, not a pink rectangle... her
  // chosen clothes colour". BootScene loads that colour's own sheet under the single texture key
  // 'player' (src/main.js), so the regression this guards against is a mini-game quietly drawing its
  // own stand-in shape or a separately-loaded texture instead of reusing that one real, already-
  // colour-correct texture -- proven by checking the mini-game's hero is literally the same texture
  // object the world player uses, not just a same-named one.
  test('the platformer and flyer heroes use the same real "player" texture as the world (her saved clothes colour)', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    // Captured fresh per page load: a texture's blob URL isn't stable across navigations even for
    // the exact same underlying image file, so each openGame() needs its own reference to compare
    // the mini-game's hero against, not one captured before the later reload.
    let worldTextureSource = await page.evaluate(() => game.scene.getScene('world').player.texture.source[0].image.src);

    await talkToStation(page, 'physicsLab', 'minigame-platformer');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');
    const platformerHero = await page.evaluate(() => {
      const hero = game.scene.getScene('minigame-platformer').hero;
      return { key: hero.texture.key, src: hero.texture.source[0].image.src };
    });
    expect(platformerHero.key).toBe('player');
    expect(platformerHero.src).toBe(worldTextureSource);
    await page.keyboard.press('Escape');

    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    worldTextureSource = await page.evaluate(() => game.scene.getScene('world').player.texture.source[0].image.src);
    await talkToStation(page, 'icvl', 'minigame-flappy');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).mgState).toBe('playing');
    const flappyHero = await page.evaluate(() => {
      const bird = game.scene.getScene('minigame-flappy').bird;
      return { key: bird.texture.key, src: bird.texture.source[0].image.src };
    });
    expect(flappyHero.key).toBe('player');
    expect(flappyHero.src).toBe(worldTextureSource);
  });

  test('losing the platformer offers a one-keypress retry, and the skip gift appears on the 3rd loss', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-platformer');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).active).toBe(true);

    // Start (ENTER is the intro card's default, highlighted item -- one keypress).
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');

    const fall = async () => {
      await page.evaluate(() => game.scene.getScene('minigame-platformer').player.body.reset(60, 700));
      await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('gameover');
    };

    // 1st loss: no skip offered yet, Retry is the default (one keypress) and returns to play.
    await fall();
    let info = await mgInfo(page, 'minigame-platformer');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'QUIT']);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');
    expect((await mgInfo(page, 'minigame-platformer')).score).toBe(0);

    // 2nd loss: still no skip.
    await fall();
    info = await mgInfo(page, 'minigame-platformer');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'QUIT']);
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');

    // 3rd loss: the skip offer appears (docs/STORY.md "nobody may be locked out") -- select it and
    // take the key anyway.
    await fall();
    info = await mgInfo(page, 'minigame-platformer');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'SKIP -- TAKE THE KEY ANYWAY', 'QUIT']);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('win');

    await page.keyboard.press('Enter'); // "CONTINUE"
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).active).toBe(false);
    await expect.poll(async () => (await state(page)).quest.keys.physicsLab).toBe(true);
    const tracker = await questTrackerText(page);
    expect(tracker.keys).toBe('Keys: 1 / 3');
  });

  test('winning for real awards the key and hands control back to the world, tracker updated', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-platformer');
    await page.keyboard.press('Enter'); // start
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');

    // Reach the flag with the score target already met -- the exact same win check the flag's own
    // overlap callback runs in real gameplay (tryFinish()), just triggered directly instead of
    // scripting a full run-and-jump playthrough of the level (covered by the platformer's own pure
    // physics unit tests).
    await page.evaluate(() => {
      const s = game.scene.getScene('minigame-platformer');
      s.setScore(s.def.scoreTarget);
      s.tryFinish();
    });
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('win');
    expect((await mgInfo(page, 'minigame-platformer')).cardItems).toEqual(['CONTINUE (ENTER)']);

    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).active).toBe(false);
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).worldActive).toBe(true);

    const s = await state(page);
    expect(s.quest.keys.physicsLab).toBe(true);
    expect(s.slots.some((slot) => slot && slot.item === 'keyPhysicsLab')).toBe(true);
    const tracker = await questTrackerText(page);
    expect(tracker.keys).toBe('Keys: 1 / 3');
    expect(tracker.objective).not.toContain('Physics Lab');
  });
});
