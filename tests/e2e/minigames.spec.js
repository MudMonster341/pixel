// Mini-games (docs/ROADMAP.md M4, src/minigames/): interacting with a key station launches the right
// game, losing offers a one-keypress retry, the after-3-losses skip gift works, winning awards the
// key and hands control back to the world with the quest tracker updated, and Esc quits back cleanly
// without the key. `minigames: true` (tests/e2e/helpers.js) turns the real Phaser scenes on -- every
// other spec plays with `?minigames=0` (the default), which bypasses straight to 'won' so it can
// focus on the *quest* reacting correctly, not on replaying a hero-fight/flyer/tower-climb session.
//
// Forcing a loss/win uses the exact same internal calls real gameplay reaches (the shell's own
// `lose()` / `win()`, which the hero fight calls when her hearts run out or she takes the key), teleporting the
// player the same way every other spec's `teleport()` helper already does (tests/e2e/helpers.js) -- this proves the
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

// P5c (FB-0071): the flyer is the ICL's fingerprint hack now: E at the scanner beside the sealed door starts it (the key is handed over inside the lab).
async function talkToScanner(page, sceneKey) {
  const tile = await page.evaluate(() => { const sc = game.scene.getScene('world').scanners[0]; return { x: Math.floor(sc.x / 16), y: Math.floor(sc.y / 16) }; });
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
  test('the room195 key station launches the tower climb; Esc from its intro card quits cleanly, no key', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });

    await talkToStation(page, 'room195', 'minigame-tower');
    await expect.poll(async () => (await mgInfo(page, 'minigame-tower')).active).toBe(true);
    let info = await mgInfo(page, 'minigame-tower');
    expect(info.mgState).toBe('intro');
    expect(info.worldActive).toBe(false, 'the world is paused underneath the mini-game');

    await page.keyboard.press('Escape');
    await expect.poll(async () => (await mgInfo(page, 'minigame-tower')).active).toBe(false);
    await expect.poll(async () => (await mgInfo(page, 'minigame-tower')).worldActive).toBe(true);
    expect((await state(page)).quest.keys.room195).toBe(false);
  });

  test('the ICL scanner launches the flyer and Esc leaves the door sealed; the physicsLab station launches the hero fight (FB-0066, FB-0071)', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToScanner(page, 'minigame-flappy');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).active).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).active).toBe(false);
    expect((await state(page)).flags.iclDoorOpen).toBeFalsy(); // quitting leaves the ICL door sealed; the scanner can be tried again

    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-hero');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).active).toBe(true);
  });

  // Art pass (coordinator brief, 2026-09-22): "the hero is the lead, not a pink rectangle... her
  // chosen clothes colour". BootScene loads that colour's own sheet under the single texture key
  // 'player' (src/main.js), so the regression this guards against is a mini-game quietly drawing its
  // own stand-in shape or a separately-loaded texture instead of reusing that one real, already-
  // colour-correct texture -- proven by checking the mini-game's hero is literally the same texture
  // object the world player uses, not just a same-named one.
  test('the flyer hero uses the same real player texture as the world (her saved clothes colour); the hero fight draws its own kitten stand-in (FB-0066)', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    // Captured fresh per page load: a texture's blob URL isn't stable across navigations even for
    // the exact same underlying image file, so each openGame() needs its own reference to compare
    // the mini-game's hero against, not one captured before the later reload.
    let worldTextureSource = await page.evaluate(() => game.scene.getScene('world').player.texture.source[0].image.src);

    await talkToStation(page, 'physicsLab', 'minigame-hero');
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');
    const fightHero = await page.evaluate(() => game.scene.getScene('minigame-hero').hero.texture.key);
    expect(fightHero).toBe('hero-sprites');
    await page.keyboard.press('Escape');

    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    worldTextureSource = await page.evaluate(() => game.scene.getScene('world').player.texture.source[0].image.src);
    await talkToScanner(page, 'minigame-flappy');
    await waitCardReady(page, 'minigame-flappy');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).mgState).toBe('playing');
    // P5c: the flyer is a glowing data packet now (flappy-sprites.png), no longer the lead's own sheet
    const flappyHero = await page.evaluate(() => game.scene.getScene('minigame-flappy').bird.texture.key);
    expect(flappyHero).toBe('flappy-sprites');
  });

  test('losing the hero fight offers a one-keypress retry, and the skip gift appears on the 3rd loss', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-hero');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).active).toBe(true);

    // Start (ENTER is the intro card's default, highlighted item -- one keypress).
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');

    const fall = async () => {
      await page.evaluate(() => game.scene.getScene('minigame-hero').lose());
      await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('gameover');
    };

    // 1st loss: no skip offered yet, Retry is the default (one keypress) and returns to play.
    await fall();
    let info = await mgInfo(page, 'minigame-hero');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'QUIT']);
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');
    expect((await mgInfo(page, 'minigame-hero')).score).toBe(0);

    // 2nd loss: still no skip.
    await fall();
    info = await mgInfo(page, 'minigame-hero');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'QUIT']);
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');

    // 3rd loss: the skip offer appears (docs/STORY.md "nobody may be locked out") -- select it and
    // take the key anyway.
    await fall();
    info = await mgInfo(page, 'minigame-hero');
    expect(info.cardItems).toEqual(['RETRY (ENTER)', 'SKIP -- TAKE THE KEY ANYWAY', 'QUIT']);
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('win');

    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter'); // "CONTINUE"
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).active).toBe(false);
    await expect.poll(async () => (await state(page)).quest.keys.physicsLab).toBe(true);
    const tracker = await questTrackerText(page);
    expect(tracker.keys).toBe('Keys: 1 / 3');
  });

  test('winning for real awards the key and hands control back to the world, tracker updated', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-hero');
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter'); // start
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');

    // Beat him and take the key -- the exact same win() the scene calls on its 'win' event in real gameplay, just
    // triggered directly instead of scripting a whole fight (covered by tests/unit/hero-logic.test.js).
    await page.evaluate(() => {
      const s = game.scene.getScene('minigame-hero');
      s.setScore(s.def.scoreTarget);
      s.win();
    });
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('win');
    expect((await mgInfo(page, 'minigame-hero')).cardItems).toEqual(['CONTINUE (ENTER)']);

    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).active).toBe(false);
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).worldActive).toBe(true);

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
      game.scene.getScene('world').launchMinigame('flappy', () => {}); // (the tower opens with its backstory first, FB-0082: tested below)
    });
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).active).toBe(true);
    expect((await mgInfo(page, 'minigame-flappy')).mgState).toBe('intro');

    // Mash Enter the instant the card appears: still on the intro card a beat later.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    expect((await mgInfo(page, 'minigame-flappy')).mgState).toBe('intro');

    // Once the debounce has passed, a real Enter does start it.
    await waitCardReady(page, 'minigame-flappy');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-flappy')).mgState).toBe('playing');
  });

  test('FB-0082: the tower opens with its backstory (Enter turns each page), then the intro card, then play; a retry skips the story', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => {
      GameState.quest.stage = 'hunting';
      game.scene.getScene('world').launchMinigame('tower', () => {});
    });
    await expect.poll(async () => (await mgInfo(page, 'minigame-tower')).active).toBe(true);
    const pageCount = await page.evaluate(() => game.scene.getScene('minigame-tower').storyPages.length);
    expect(pageCount).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < pageCount; i++) {
      await waitCardReady(page, 'minigame-tower');
      expect((await mgInfo(page, 'minigame-tower')).cardItems[0]).toBe('NEXT (ENTER)');
      await page.keyboard.press('Enter');
    }
    await waitCardReady(page, 'minigame-tower');
    expect((await mgInfo(page, 'minigame-tower')).cardItems[0]).toBe('START (ENTER)'); // the usual intro card follows the story
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-tower')).mgState).toBe('playing');

    // after a loss, RETRY goes straight back to play: no story again
    await page.evaluate(() => game.scene.getScene('minigame-tower').lose());
    await waitCardReady(page, 'minigame-tower');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-tower')).mgState).toBe('playing');
    expect(await page.evaluate(() => game.scene.getScene('minigame-tower').story)).toBe(null);
  });

  test('FB-0042: confirming Retry with Space does not also make her jump on the first frame', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-hero');
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Space'); // Space also confirms the intro card's default "START"
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');

    await page.evaluate(() => game.scene.getScene('minigame-hero').lose());
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('gameover');

    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Space'); // confirms "RETRY (ENTER)" -- Space is also the jump key
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');

    // The very next frame: she must not already be rising from a jump this same Space triggered.
    const vy = await page.evaluate(() => game.scene.getScene('minigame-hero').hv.player.vy);
    expect(vy).toBeGreaterThanOrEqual(0);
  });

  test('FB-0066: the hero fight shows its hint on the first try, and Z fires a star bolt (the card keys are untouched)', async ({ page }) => {
    await openGame(page, { map: 'main-block-3', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToStation(page, 'physicsLab', 'minigame-hero');
    await waitCardReady(page, 'minigame-hero');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-hero')).mgState).toBe('playing');
    const message = await page.evaluate(() => game.scene.getScene('minigame-hero').message?.label.text);
    expect(message).toMatch(/BUBBLE/);
    await page.keyboard.down('z');
    await expect.poll(async () => page.evaluate(() => game.scene.getScene('minigame-hero').hv.shots.length)).toBeGreaterThan(0);
    await page.keyboard.up('z');
  });

  test('FB-0042: the flyer hovers with a "press space to flap" prompt, and gravity/scrolling wait for the first flap', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => { GameState.quest.stage = 'hunting'; });
    await talkToScanner(page, 'minigame-flappy');
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

  // ADR 0025 (EDI Madness, phase E3): the garage-parking scene, launched directly (the ICL scanner still starts the flyer until phase E4). The drive is real
  // keys; the debug hook only puts the car a short way out from stage 1's bay, facing it. Gas until she is over the bay, then the handbrake (Space) holds her still.
  test('EDI Madness: story, intro, a scripted drive that parks stage 1, the banner, stage 2, Esc quits', async ({ page }) => {
    await openGame(page, { map: 'main-block-1', minigames: true });
    await page.evaluate(() => {
      GameState.quest.stage = 'hunting';
      game.scene.getScene('world').launchMinigame('edi', () => {});
    });
    await expect.poll(async () => (await mgInfo(page, 'minigame-edi')).active).toBe(true);
    const pageCount = await page.evaluate(() => game.scene.getScene('minigame-edi').storyPages.length);
    expect(pageCount).toBe(3);
    for (let i = 0; i < pageCount; i++) {
      await waitCardReady(page, 'minigame-edi');
      expect((await mgInfo(page, 'minigame-edi')).cardItems[0]).toBe('NEXT (ENTER)');
      await page.keyboard.press('Enter');
    }
    await waitCardReady(page, 'minigame-edi');
    expect((await mgInfo(page, 'minigame-edi')).cardItems[0]).toBe('START (ENTER)');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await mgInfo(page, 'minigame-edi')).mgState).toBe('playing');

    await page.evaluate(() => game.scene.getScene('minigame-edi').debugSetStage(0, { pose: true }));
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => game.scene.getScene('minigame-edi').edi.car.y <= 76); // over the bay (its centre is y 68)
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('Space'); // the handbrake stops her inside the bay; she holds still for 0.8 s
    await expect.poll(async () => (await mgInfo(page, 'minigame-edi')).score).toBe(1);
    await page.keyboard.up('Space');
    expect(await page.evaluate(() => game.scene.getScene('minigame-edi').bannerText.text)).toBe('STAGE 1 PARKED!');
    // the banner (input off) gives way to stage 2
    await expect.poll(async () => page.evaluate(() => game.scene.getScene('minigame-edi').edi.stageIndex)).toBe(1);
    expect((await mgInfo(page, 'minigame-edi')).mgState).toBe('playing');

    await page.keyboard.press('Escape'); // Esc quits at any time, no key, no flag
    await expect.poll(async () => (await mgInfo(page, 'minigame-edi')).active).toBe(false);
    await expect.poll(async () => (await mgInfo(page, 'minigame-edi')).worldActive).toBe(true);
  });
});
