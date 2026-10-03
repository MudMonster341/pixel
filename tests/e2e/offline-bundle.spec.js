// ADR 0017 / docs/OFFLINE_BUNDLE.md: the double-click bundle (`npm run pack:offline` -> dist/offline/)
// must boot from file:// with no server. This spec builds it, opens dist/offline/index.html by its
// file:// URL and checks the title scene comes up with zero console errors. (The Playwright config's
// dev server is running anyway but this test never talks to it.) Chromium only; Safari is checked by
// hand (docs/OFFLINE_BUNDLE.md "Checking it").
const { test, expect } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..');
const INDEX = path.join(ROOT, 'dist', 'offline', 'index.html');

test.beforeAll(() => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'pack-offline.js')], { cwd: ROOT, stdio: 'inherit' });
});

test('ADR 0017: dist/offline/index.html boots to the title screen from file:// with no console errors', async ({ page }) => {
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => errors.push(`request failed: ${request.url()}`));
  page.on('request', (request) => requests.push(request.url()));

  await page.goto(pathToFileURL(INDEX).href);
  await page.waitForFunction(() => window.game && window.game.scene.isActive('title'), null, { timeout: 20_000 });
  await page.waitForTimeout(1000); // let the title's preload (UI kit, art, audio) finish

  expect(await page.evaluate(() => window.__OFFLINE_BUNDLE)).toBe(true);
  const dev = await page.evaluate(() => ({ overlay: Boolean(document.querySelector('[class*="dfb-"]')), scripts: [...document.scripts].map((s) => s.src).filter((s) => s.includes('/dev/')) }));
  expect(dev.scripts).toEqual([]);
  expect(dev.overlay).toBe(false);
  // the embedded registry served the loader: the title's art and the pixel font are really there
  expect(await page.evaluate(() => game.textures.exists('title-fg'))).toBe(true);
  expect(await page.evaluate(() => document.fonts.check('16px "Press Start 2P"'))).toBe(true);
  expect(requests.filter((url) => /^https?:/.test(url))).toEqual([]); // nothing left the machine
  expect(errors).toEqual([]);
});

test('ADR 0017: even ?dev=1 does not turn the dev overlay on in the bundle', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${pathToFileURL(INDEX).href}?dev=1`);
  await page.waitForFunction(() => window.game && window.game.scene.isActive('title'), null, { timeout: 20_000 });
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => [...document.scripts].some((s) => s.src.includes('/dev/')))).toBe(false);
  expect(errors).toEqual([]);
});

test('ADR 0017: a blocked localStorage never crashes the bundle (it just cannot save)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); }, configurable: true });
  });
  await page.goto(pathToFileURL(INDEX).href);
  await page.waitForFunction(() => window.game && window.game.scene.isActive('title'), null, { timeout: 20_000 });
  expect(errors).toEqual([]);
});
