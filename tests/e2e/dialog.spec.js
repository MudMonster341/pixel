// Data-driven dialog (roadmap M1): the interaction bubble (E / !) and dialog choices, played out
// against the meadow's "Guide" NPC (src/maps.js) -- a test-map fixture the same way Tomas is, built
// specifically to have a choice in its dialog. Tomas's own end-to-end flow (sword hand-over, then
// chats) is covered by tests/e2e/house.spec.js and didn't need to change: converting him to the new
// data format kept the same observable behaviour.
const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, teleport, finishDialog } = require('./helpers');

test.beforeEach(async ({ page }) => {
  await openGame(page); // meadow (default test map): the Guide NPC lives at (14, 12)
  await startGame(page);
});

// Presses E until the choice list is showing (typing a line first takes a couple of presses).
async function openGuideChoice(page) {
  await teleport(page, 15, 12);
  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  for (let i = 0; i < 20 && !(await state(page)).dialogChoices; i++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(80);
  }
  expect((await state(page)).dialogChoices).toEqual(['Yes, please!', 'No thanks.']);
}

test('the interaction bubble shows "!" for unseen dialog, hides during it, then shows "E"', async ({ page }) => {
  await teleport(page, 15, 12); // next to the Guide, never spoken to yet
  await expect.poll(async () => (await state(page)).promptVisible).toBe(true);
  expect((await state(page)).promptFrame).toBe(1); // "!" -- something new to say

  await page.keyboard.press('e');
  await expect.poll(async () => (await state(page)).dialogOpen).toBe(true);
  expect((await state(page)).promptVisible).toBe(false); // hidden while the dialog is open

  await finishDialog(page);
  await expect.poll(async () => (await state(page)).promptVisible).toBe(true);
  expect((await state(page)).promptFrame).toBe(0); // now just "E": it's been seen
});

test('choice dialog: the default (first) option runs its own actions', async ({ page }) => {
  await openGuideChoice(page);
  expect((await state(page)).dialogChoiceIndex).toBe(0);

  await page.keyboard.press('e'); // confirm "Yes, please!"
  await finishDialog(page); // plays the choice's own follow-up line; actions run once it closes
  await expect.poll(async () => (await state(page)).toast).toBe('Hint received!');

  const s = await state(page);
  expect(s.flags.guideHintYes).toBe(true);
  expect(s.flags.guideHintNo).toBeUndefined();
});

test('choice dialog: up/down (or W/S) moves the highlight, and the other branch runs its own actions', async ({ page }) => {
  await openGuideChoice(page);

  await page.keyboard.press('ArrowDown');
  await expect.poll(async () => (await state(page)).dialogChoiceIndex).toBe(1);
  await page.keyboard.press('ArrowUp');
  await expect.poll(async () => (await state(page)).dialogChoiceIndex).toBe(0);
  await page.keyboard.press('s');
  await expect.poll(async () => (await state(page)).dialogChoiceIndex).toBe(1);

  await page.keyboard.press('e'); // confirm "No thanks."
  await finishDialog(page);

  const s = await state(page);
  expect(s.flags.guideHintNo).toBe(true);
  expect(s.flags.guideHintYes).toBeUndefined();
  expect(s.toast).not.toBe('Hint received!'); // only the "Yes" branch shows this toast
});

test('the player cannot walk while a choice list is open', async ({ page }) => {
  await openGuideChoice(page);
  const before = await state(page);
  await page.keyboard.down('d');
  await page.waitForTimeout(300);
  await page.keyboard.up('d');
  expect((await state(page)).x).toBe(before.x);
});
