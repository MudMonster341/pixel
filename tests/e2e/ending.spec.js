// The ending (docs/STORY.md "the box opens...", docs/ROADMAP.md M3): the reward box's opening
// sequence, then the birthday card, skippable, ending back on the title screen with the save kept.
// Reaches the reward the same shortcut tests/e2e/interiors.spec.js and tests/e2e/minigames.spec.js
// already use (setting GameState.quest directly) rather than replaying the whole 3-key hunt --
// tests/e2e/story.spec.js already covers that walk in full, this spec starts from its very last step.
//
// This repo's checkout has no assets/card/ at all (gitignored, docs/STORY.md) -- so every test here
// doubles as the "a missing video or empty photo folder must not break anything" check the ending's
// own brief asks for: there is nothing else this suite could run against.
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, teleport, chooseTitleMenu } = require('./helpers');

// The browser logs a "Failed to load resource: 404" console error for every optional file this
// checkout doesn't have (assets/card/card.json, its photos, assets/card/video.mp4, assets/cutscenes/
// video/box-opening.mp4) -- that's the network layer's own log, not a JS exception, and it's the
// expected, tolerated shape of "missing photos/video" this ending is built to survive (see the file
// header). Filtering it out keeps this check meaningful for anything else going wrong.
const withoutExpected404s = (errors) => errors.filter((message) => !/Failed to load resource.*404/.test(message));

function volunteerTile(page) {
  return page.evaluate(() => {
    const npc = game.scene.getScene('world').npcs.find((n) => n.def.id === 'lug-volunteer');
    return { x: Math.floor(npc.x / 16), y: Math.floor(npc.y / 16) };
  });
}

// Reads the box-opening/card scenes' own small bits of state; only ever called while that scene is
// the active one, mirroring how tests/e2e/minigames.spec.js reads a mini-game scene's own state.
function boxState(page) {
  return page.evaluate(() => {
    const scene = game.scene.getScene('box-opening');
    return { active: game.scene.isActive('box-opening'), canSkip: scene ? scene.canSkip : null };
  });
}

function cardState(page) {
  return page.evaluate(() => {
    const scene = game.scene.getScene('card');
    if (!scene) return { active: false };
    return {
      active: game.scene.isActive('card'),
      dialogOpen: Boolean(scene.dialog && scene.dialog.isOpen),
      coverOpening: scene.coverOpening,
      slideCount: scene.slides ? scene.slides.length : null,
      slideKey: scene.photoA ? scene.photoA.texture.key : null,
      recipient: scene.config ? scene.config.recipient : null,
    };
  });
}

// Talks to the volunteer and presses through however many lines his current entry has (docs/STORY.md
// "reward"), the same "press E/Enter until the box closes" idea tests/e2e/story.spec.js's own
// finishDialog() uses, but stopping the instant the box-opening sequence has actually started --
// pressing on into it could otherwise land a stray Enter mid-sequence.
async function talkUntilRewarded(page) {
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  for (let i = 0; i < 20; i++) {
    const active = await page.evaluate(() => game.scene.isActive('box-opening'));
    if (active) return;
    await page.keyboard.press('e');
    await page.waitForTimeout(100);
  }
  throw new Error('box-opening never started after talking to the volunteer');
}

test('finishing the story opens the box, then the card, skippable, and returns to the title keeping the save', async ({ page }) => {
  const { errors } = await openGame(page, { map: 'main-block-g', save: true, profile: 'ending-e2e' });
  await startGame(page);
  await page.evaluate(() => {
    GameState.playerName = 'Zara';
    GameState.quest.stage = 'hunting';
    GameState.quest.keys = { physicsLab: true, icvl: true, room195: true };
  });

  const tile = await volunteerTile(page);
  await teleport(page, tile.x, tile.y + 1);
  await talkUntilRewarded(page);

  // ---------- the box: reached, and a stray Esc right at the start doesn't rob the moment ----------
  await expect.poll(async () => (await state(page)).quest.stage).toBe('rewarded');
  expect((await boxState(page)).active).toBe(true);
  expect((await boxState(page)).canSkip).toBe(false);

  await page.keyboard.press('Escape'); // too early -- must be ignored
  await page.waitForTimeout(200);
  expect((await boxState(page)).active).toBe(true); // still playing, not skipped away

  // Wait for the lid to actually finish opening (canSkip flips true), then skip the rest of the
  // sequence -- this is also the "Esc skips it" check for the box half of the ending.
  await expect.poll(async () => (await boxState(page)).canSkip, { timeout: 10_000 }).toBe(true);
  await page.keyboard.press('Escape');

  // ---------- the card ----------
  await expect.poll(async () => (await cardState(page)).active, { timeout: 10_000 }).toBe(true);
  const card = await cardState(page);
  expect(card.recipient).toBe('Zara'); // {name} comes from GameState.playerName with no card.json
  // No assets/card/photos/ in this checkout -- the slideshow falls back to exactly one placeholder
  // slide instead of breaking (docs/ROADMAP.md M3 "a missing video or empty photo folder must not
  // break anything").
  expect(card.slideCount).toBe(1);
  expect(card.slideKey).toBe('card-placeholder-photo');

  // The cover hasn't been dismissed yet -- Enter opens it (same key that would otherwise advance a
  // line of dialog, docs/ROADMAP.md M3's own dialog-box reuse).
  expect(card.coverOpening).toBe(false);
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await cardState(page)).dialogOpen, { timeout: 5_000 }).toBe(true);

  // Skippable: Esc jumps straight through to "THE END" and back to the title, from mid-message.
  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('title')), { timeout: 10_000 }).toBe(true);

  // The save was kept (not reset), so "Continue"/"Watch the Card Again" both see the finished quest.
  const saved = await page.evaluate(() => peekSave('ending-e2e'));
  expect(saved.quest.stage).toBe('rewarded');
  expect(saved.playerName).toBe('Zara');
  const menuIds = await page.evaluate(() => game.scene.getScene('title').menuItems.map((item) => item.id));
  expect(menuIds).toContain('watch-card');

  expect(withoutExpected404s(errors)).toEqual([]);
});

test('"Watch the Card Again" from the title jumps straight to the card, skipping the box and the world', async ({ page }) => {
  const { errors } = await openGame(page, { map: 'main-block-g', save: true, profile: 'ending-e2e-watch' });
  await startGame(page);
  await page.evaluate(() => {
    GameState.playerName = 'Nadia';
    GameState.quest.stage = 'hunting';
    GameState.quest.keys = { physicsLab: true, icvl: true, room195: true };
  });
  const tile = await volunteerTile(page);
  await teleport(page, tile.x, tile.y + 1);
  await talkUntilRewarded(page);
  await expect.poll(async () => (await boxState(page)).canSkip, { timeout: 10_000 }).toBe(true);
  await page.keyboard.press('Escape'); // straight through the box
  await expect.poll(async () => (await cardState(page)).active, { timeout: 10_000 }).toBe(true);
  await page.keyboard.press('Escape'); // straight through the card, back to the title
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('title')), { timeout: 10_000 }).toBe(true);

  // Reload straight to the title (a fresh page, same save) and pick "Watch the Card Again".
  const params = new URLSearchParams({ dev: '0', cutscene: '0', save: '1', profile: 'ending-e2e-watch', intro: '0' });
  await page.goto(`/?${params.toString()}`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('title')?.menuItems));
  await page.waitForFunction(() => game.scene.getScene('title').menuItems.some((item) => item.id === 'watch-card'));

  await chooseTitleMenu(page, 'watch-card');

  await expect.poll(async () => (await cardState(page)).active, { timeout: 10_000 }).toBe(true);
  expect((await cardState(page)).recipient).toBe('Nadia');
  // 'world'/'ui' were never (re)started -- Watch the Card Again never re-enters the game itself.
  expect(await page.evaluate(() => game.scene.isActive('world'))).toBe(false);

  expect(withoutExpected404s(errors)).toEqual([]);
});
