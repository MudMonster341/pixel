// M6 (docs/decisions/0010-ship-as-windows-exe-and-web-build.md): the packaged .exe has no internet,
// so the game must load entirely from local files -- Phaser and the Press Start 2P font used to come
// from cdnjs/Google Fonts (ADR 0003), now vendored under vendor/ (see vendor/README.md). This test
// blocks every request that isn't to the test server itself and confirms the game still boots clean.
const { test, expect } = require('@playwright/test');
const { openGame, state } = require('./helpers');

test('M6: the game boots with no errors when every non-local network request is blocked', async ({ page, baseURL }) => {
  const localOrigin = new URL(baseURL).origin;
  const blocked = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(localOrigin) || url.startsWith('data:')) return route.continue();
    blocked.push(url);
    return route.abort('internetdisconnected');
  });

  const { errors } = await openGame(page);
  const s = await state(page);
  expect(s.map).toBe('meadow');
  await page.waitForTimeout(500);

  expect(blocked, `expected no requests to leave ${localOrigin}, but saw: ${blocked.join(', ')}`).toEqual([]);
  expect(errors).toEqual([]);
});

test('M6: the vendored Press Start 2P font actually loads (not the fallback), with the network blocked', async ({ page, baseURL }) => {
  const localOrigin = new URL(baseURL).origin;
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(localOrigin) || url.startsWith('data:')) return route.continue();
    return route.abort('internetdisconnected');
  });

  await openGame(page);
  const loaded = await page.evaluate(() => document.fonts.check('16px "Press Start 2P"'));
  expect(loaded).toBe(true);
});
