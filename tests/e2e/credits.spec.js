// The credits phase after the card (decisions/0019-credits-ending-and-recipient.md, src/scenes/credits.js):
// card -> credits -> title. NOT yet run (owner's build-phase rule: unit tests only until the whole flow
// is built); written against the same helpers and conventions as tests/e2e/ending.spec.js.
//
// Jumps straight to the ending the cheap way (the ending spec already walks the whole hunt and the box):
// start the 'card' scene directly with the quest marked rewarded, the same way "Watch the Card Again"
// reaches it. This checkout has no assets/card/card.json, so the recipient is the default "Taru" and the
// wishes are the built-in placeholders: that is also the "missing card.json must not break anything" check.
const { test, expect } = require('@playwright/test');
const { openGame, startGame } = require('./helpers');

// The browser logs "Failed to load resource: 404" for the optional files this checkout doesn't have
// (assets/card/card.json, the closing video): the network layer's own log, not a JS exception.
const withoutExpected404s = (errors) => errors.filter((message) => !/Failed to load resource.*404/.test(message));

async function jumpToCard(page) {
  await page.evaluate(() => {
    GameState.quest.stage = 'rewarded';
    game.scene.stop('ui');
    game.scene.stop('world');
    game.scene.start('card');
  });
  await expect.poll(() => page.evaluate(() => game.scene.isActive('card')), { timeout: 10_000 }).toBe(true);
}

function creditsState(page) {
  return page.evaluate(() => {
    const scene = game.scene.getScene('credits');
    if (!scene || !game.scene.isActive('credits')) return { active: false };
    return {
      active: true,
      phase: scene.phase,
      recipient: scene.config.recipient,
      age: scene.config.age,
      wishes: scene.config.wishes,
      titleAlpha: scene.title.alpha,
      ageAlpha: scene.ageText.alpha,
      titleText: scene.title.text,
      ageTextValue: scene.ageText.text,
      wishAlphas: scene.wishObjects.map(([heart, text]) => text.alpha),
      theEndAlpha: scene.theEndText ? scene.theEndText.alpha : 0,
      madeBy: scene.madeByText ? scene.madeByText.text : null,
    };
  });
}

test('credits: card -> credits -> title', async ({ page }) => {
  const { errors } = await openGame(page, { map: 'main-block-g', save: true, profile: 'credits-e2e' });
  await startGame(page);
  await page.evaluate(() => { GameState.playerName = 'Zara'; });

  await jumpToCard(page);
  // Esc on the card skips what is left of it and hands on to the credits (not straight to the title).
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await creditsState(page)).active, { timeout: 10_000 }).toBe(true);

  const first = await creditsState(page);
  expect(first.recipient).toBe('Taru'); // the card's recipient, never the typed name 'Zara'
  expect(first.age).toBe(22);
  expect(first.wishes.length).toBe(8);
  expect(first.titleText).toBe('Happy Birthday, Taru');
  expect(first.ageTextValue).toBe('Happy 22');
  expect(first.phase).toBe('running');

  // Skip keys are ignored for the first moment, so a stray key from the card can't skip the credits.
  await page.keyboard.press('Escape');
  expect((await creditsState(page)).phase).toBe('running');

  // After the grace period, Esc skips to THE END; the title and wishes fade away and "Made for you by" follows.
  await page.waitForTimeout(1400);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await creditsState(page)).phase, { timeout: 5_000 }).toBe('end');
  await expect.poll(async () => (await creditsState(page)).theEndAlpha, { timeout: 5_000 }).toBeGreaterThan(0.9);
  await expect.poll(async () => (await creditsState(page)).madeBy, { timeout: 5_000 }).toBe('Made for you by Mustafa');

  // Another key after THE END's own short grace period returns to the title.
  await page.waitForTimeout(1700);
  await page.keyboard.press('Escape');
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('title')), { timeout: 10_000 }).toBe(true);
  expect(await page.evaluate(() => game.scene.isActive('credits'))).toBe(false);

  // The save is untouched and the player name is still whatever was typed (it is only the card/credits
  // that always say Taru).
  expect(await page.evaluate(() => GameState.playerName)).toBe('Zara');
  expect(withoutExpected404s(errors)).toEqual([]);
});

test('credits: left alone, it shows the title, the age, every wish one at a time, THE END, then returns to the title', async ({ page }) => {
  test.setTimeout(120_000); // the full schedule is about 42 s
  const { errors } = await openGame(page, { map: 'main-block-g', save: true, profile: 'credits-e2e-full' });
  await startGame(page);
  await jumpToCard(page);
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await creditsState(page)).active, { timeout: 10_000 }).toBe(true);

  const seenWishes = new Set();
  let sawTitle = false;
  let sawAge = false;
  let maxVisibleAtOnce = 0;
  let sawTheEnd = false;
  const deadline = Date.now() + 70_000;
  while (Date.now() < deadline) {
    const s = await creditsState(page);
    if (!s.active) break;
    if (s.titleAlpha > 0.9) sawTitle = true;
    if (s.ageAlpha > 0.9) sawAge = true;
    s.wishAlphas.forEach((alpha, i) => { if (alpha > 0.9) seenWishes.add(i); });
    // Wishes come one at a time: at most the outgoing and the incoming one are visible during a cross-fade.
    maxVisibleAtOnce = Math.max(maxVisibleAtOnce, s.wishAlphas.filter((alpha) => alpha > 0.05).length);
    if (s.theEndAlpha > 0.9) sawTheEnd = true;
    await page.waitForTimeout(200);
  }

  expect(sawTitle).toBe(true);
  expect(sawAge).toBe(true);
  expect([...seenWishes].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(maxVisibleAtOnce).toBeLessThanOrEqual(2);
  expect(sawTheEnd).toBe(true);
  await expect.poll(async () => page.evaluate(() => game.scene.isActive('title')), { timeout: 15_000 }).toBe(true);
  expect(withoutExpected404s(errors)).toEqual([]);
});
