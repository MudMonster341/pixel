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

// FB-0042: a card ignores confirm keys (and the up/down highlight move) for a short beat after it
// appears (MinigameCard's own CARD_INPUT_DELAY_MS, src/minigames/framework-scene.js) -- mashing
// Space/Enter while actually playing (Space also jumps/flaps, Enter also clears a line of dialog)
// must not carry straight through into an instant Retry/Continue on whatever card pops up next. Every
// test below that drives a card now waits for `card.acceptInput` first (docs/TESTING.md rule 5: wait
// for real state, never a fixed sleep) instead of pressing a key the instant the card's own mgState
// changes.
async function waitCardReady(page, sceneKey) {
  await expect.poll(async () => page.evaluate(
    (key) => Boolean(game.scene.getScene(key)?.card?.acceptInput),
    sceneKey,
  )).toBe(true);
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
    await waitCardReady(page, 'minigame-platformer');
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
    await waitCardReady(page, 'minigame-flappy');
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
    await waitCardReady(page, 'minigame-platformer');
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
    await waitCardReady(page, 'minigame-platformer');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');
    expect((await mgInfo(page, 'minigame-platformer')).score).toBe(0);

    // 2nd loss: still no skip.
    await fall();
    info = await mgInfo(page, 'minigame-platformer');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'QUIT']);
    await waitCardReady(page, 'minigame-platformer');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');

    // 3rd loss: the skip offer appears (docs/STORY.md "nobody may be locked out") -- select it and
    // take the key anyway.
    await fall();
    info = await mgInfo(page, 'minigame-platformer');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'SKIP -- TAKE THE KEY ANYWAY', 'QUIT']);
    await waitCardReady(page, 'minigame-platformer');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('win');

    await waitCardReady(page, 'minigame-platformer');
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
    await waitCardReady(page, 'minigame-platformer');
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

    await waitCardReady(page, 'minigame-platformer');
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

  // ---------- FB-0042: mini-game input polish ----------

  test('FB-0042: a card ignores confirm keys for a short beat, so mashing Enter cannot skip past it instantly', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    // Launched directly (not through the real talk-to-station dialog flow, which itself takes long
    // enough in real wall-clock time -- several keypresses and waits -- that the debounce window this
    // test means to catch could already have quietly elapsed before the test ever mashed a key,
    // making the assertion below meaningless rather than wrong): the card's own creation is what
    // starts CARD_INPUT_DELAY_MS, so the fewer round-trips between that and the mash, the better this
    // actually tests the debounce instead of testing incidental Playwright/IPC timing.
    await page.evaluate(() => {
      GameState.quest.stage = 'hunting';
      game.scene.getScene('world').launchMinigame('tetris', () => {});
    });
    await expect.poll(async () => (await mgInfo(page, 'minigame-tetris')).active).toBe(true);
    expect((await mgInfo(page, 'minigame-tetris')).mgState).toBe('intro');

    // Mash Enter the instant the card appears: still on the intro card a beat later.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    expect((await mgInfo(page, 'minigame-tetris')).mgState).toBe('intro');

    // Once the debounce has passed, a real Enter does start it.
    await waitCardReady(page, 'minigame-tetris');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-tetris')).mgState).toBe('playing');
  });

  test('FB-0042: confirming Retry with Space does not also make her jump on the first frame', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-platformer');
    await waitCardReady(page, 'minigame-platformer');
    await page.keyboard.press('Space'); // Space also confirms the intro card's default "START"
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');

    await page.evaluate(() => game.scene.getScene('minigame-platformer').player.body.reset(60, 700));
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('gameover');

    await waitCardReady(page, 'minigame-platformer');
    await page.keyboard.press('Space'); // confirms "RETRY (ENTER)" -- Space is also the jump key
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');

    // The very next frame: she must not already be rising from a jump this same Space triggered.
    const vy = await page.evaluate(() => game.scene.getScene('minigame-platformer').player.body.velocity.y);
    expect(vy).toBeGreaterThanOrEqual(0);
  });

  test('FB-0042: reaching the platformer\'s exit door without enough charge cells shows a message, not nothing', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-platformer');
    await waitCardReady(page, 'minigame-platformer');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');

    await page.evaluate(() => {
      const s = game.scene.getScene('minigame-platformer');
      s.tryFinish(); // score is still 0 -- reaching the door with nothing collected
    });
    // Still playing (not a loss, not a win) -- a message shown instead of silence.
    expect((await mgInfo(page, 'minigame-platformer')).mgState).toBe('playing');
    const message = await page.evaluate(() => game.scene.getScene('minigame-platformer').message?.label.text);
    expect(message).toMatch(/charge cells/i);
  });

  test('FB-0042: the flyer hovers with a "press space to flap" prompt, and gravity/scrolling wait for the first flap', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'icvl', 'minigame-flappy');
    await waitCardReady(page, 'minigame-flappy');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).mgState).toBe('playing');

    const before = await page.evaluate(() => {
      const s = game.scene.getScene('minigame-flappy');
      return { promptVisible: s.hoverPrompt.visible, flying: s.flying, pipeX: s.pipes[0] ? s.pipes[0].x : null };
    });
    expect(before.flying).toBe(false);
    expect(before.promptVisible).toBe(true);

    await page.waitForTimeout(300); // long enough that real gravity/scrolling would have visibly moved something
    const stillHovering = await page.evaluate(() => {
      const s = game.scene.getScene('minigame-flappy');
      return { pipeX: s.pipes[0] ? s.pipes[0].x : null, flying: s.flying };
    });
    expect(stillHovering.flying).toBe(false);
    expect(stillHovering.pipeX).toBe(before.pipeX); // the racks never scrolled while she hasn't flapped

    await page.keyboard.press('Space'); // the first flap
    const after = await page.evaluate(() => {
      const s = game.scene.getScene('minigame-flappy');
      return { flying: s.flying, promptVisible: s.hoverPrompt.visible };
    });
    expect(after.flying).toBe(true);
    expect(after.promptVisible).toBe(false);
  });
});
