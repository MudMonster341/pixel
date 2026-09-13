const { test, expect } = require('@playwright/test');
const { openGame, state, startGame, feedbackCli } = require('./helpers');

const getItem = async (page, id) => (await (await page.request.get('/api/feedback')).json()).find((item) => item.id === id);

test('dev tools are not loaded when dev mode is off', async ({ page }) => {
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await openGame(page, { dev: false });
  await startGame(page);
  await page.keyboard.press('Backquote');

  await expect(page.locator('#dev-feedback')).toHaveCount(0);
  await expect(page.locator('#dev-feedback-button')).toHaveCount(0);
  expect(requested.filter((url) => url.includes('/src/dev/'))).toEqual([]);
});

test('the overlay pauses the game, captures context and saves feedback', async ({ page }) => {
  await openGame(page, { dev: true });
  await startGame(page);
  await expect(page.locator('#dev-feedback-button')).toBeVisible();

  await page.keyboard.press('Backquote');
  const panel = page.locator('#dev-feedback');
  await expect(panel).toBeVisible();
  // Scene pause/resume are applied on the next game step, so wait for them rather than reading once.
  await expect.poll(() => page.evaluate(() => game.scene.isPaused('world'))).toBe(true);

  const before = await state(page);
  await page.getByLabel('Title').click();
  await page.keyboard.type('wasd wasd'); // typing must not move the player
  expect((await state(page)).x).toBe(before.x);

  await page.getByLabel('Title').fill('Tree near the house looks odd');
  await page.getByLabel('Details').fill('The canopy is too dark.');
  await panel.getByText('Change', { exact: true }).click();
  await page.getByLabel('Priority').selectOption('high');
  await page.locator('#dfb-preview').click({ position: { x: 120, y: 80 } });
  await expect(page.locator('#dfb-marker-info')).toContainText('Pointing at tile');

  await page.getByRole('button', { name: 'Send & close' }).click();
  await expect(panel).toBeHidden();
  await expect.poll(() => page.evaluate(() => game.scene.isPaused('world'))).toBe(false);

  const items = await (await page.request.get('/api/feedback')).json();
  const item = items.find((i) => i.title === 'Tree near the house looks odd');
  expect(item).toMatchObject({ type: 'change', priority: 'high', status: 'new', details: 'The canopy is too dark.' });
  expect(item.context).toMatchObject({ map: 'meadow', tile: before.tile });
  expect(item.marker.tile).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  expect(item.screenshot).toMatch(/^screenshots\/FB-\d+\.jpg$/);
  expect((await page.request.get(`/api/feedback/${item.id}/screenshot`)).ok()).toBe(true);
});

test('"Send & add another" keeps the panel open for the next item', async ({ page }) => {
  await openGame(page, { dev: true });
  await startGame(page);
  await page.keyboard.press('Backquote');
  await page.getByLabel('Title').fill('First of several');
  await page.getByRole('button', { name: 'Send & add another' }).click();
  await expect(page.locator('#dev-feedback .dfb-status')).toContainText('Saved as FB-');
  await expect(page.locator('#dev-feedback')).toBeVisible();
  await expect(page.getByLabel('Title')).toHaveValue('');
});

test('a title is required', async ({ page }) => {
  await openGame(page, { dev: true });
  await startGame(page);
  await page.keyboard.press('Backquote');
  await page.getByRole('button', { name: 'Send & close' }).click();
  await expect(page.locator('#dev-feedback .dfb-status')).toContainText('Add a short title');
  await expect(page.locator('#dev-feedback')).toBeVisible();
});

test('Escape closes the overlay without skipping the tutorial', async ({ page }) => {
  await openGame(page, { dev: true });
  await startGame(page);
  await page.keyboard.press('Backquote');
  await page.keyboard.press('Escape');
  await expect(page.locator('#dev-feedback')).toBeHidden();
  await page.waitForTimeout(200);
  expect((await state(page)).tutorial.stage).toBe('steps');
});

test('questions from the agent can be answered, and fixes confirmed, in the inbox', async ({ page }) => {
  await openGame(page, { dev: true });
  await startGame(page);
  const created = await (await page.request.post('/api/feedback', { data: { title: 'Make the lake bigger', type: 'change' } })).json();
  feedbackCli(['ask', created.id, 'How much bigger, and should it cover the path?']);

  await page.keyboard.press('Backquote');
  await page.getByRole('tab', { name: /Inbox/ }).click();
  const card = page.locator(`#dev-feedback [data-id="${created.id}"]`);
  await expect(card).toContainText('How much bigger');
  await card.getByLabel('Your answer').fill('Twice as wide, keep the path.');
  await card.getByRole('button', { name: 'Send answer' }).click();
  await expect.poll(async () => (await getItem(page, created.id)).status).toBe('answered');

  feedbackCli(['fix', created.id, '--test', 'tests/unit/maps.test.js › lake size', 'Lake is now twice as wide.']);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Backquote');
  await page.getByRole('tab', { name: /Inbox/ }).click();
  await expect(card).toContainText('Covered by test');
  await card.getByRole('button', { name: 'It works' }).click();
  await expect.poll(async () => (await getItem(page, created.id)).status).toBe('verified');
});
