// Birthday sprint, package D (not run during the build phase, docs/QUALITY_LOOP.md): the opening's RTA bus
// plays its door animation, and Esc fast-forwards the whole thing to control with the bus gone.
const { test, expect } = require('@playwright/test');
const { openTitle, chooseTitleMenu, pressUntil, waitForBoot, skipWorldScript, worldScriptActive, state } = require('./helpers');

// Same route into the opening as tests/e2e/intro.spec.js: title -> Play -> name -> clothes -> world.
async function startOpening(page) {
  await openTitle(page, { map: null, intro: true });
  await chooseTitleMenu(page, 'play');
  const isActive = (key) => page.evaluate((k) => game.scene.isActive(k), key);
  await pressUntil(page, 'Escape', () => isActive('name-entry')); // skip the greeting
  await pressUntil(page, 'Enter', () => isActive('customize')); // accept the name
  await page.keyboard.press('Enter'); // accept the clothes -> boot -> world, the opening starts
  await waitForBoot(page);
}

const busFrame = (page) => page.evaluate(() => {
  const bus = game.scene.getScene('world').scriptRunner.actors.get('bus');
  return bus ? { frame: Number(bus.sprite.frame.name), key: bus.sprite.texture.key, visible: bus.sprite.visible } : null;
});

test('the opening bus is the RTA sheet and its door animation steps through the frames', async ({ page }) => {
  await startOpening(page);
  await expect.poll(() => worldScriptActive(page)).toBe(true);
  await expect.poll(() => busFrame(page), { timeout: 10_000 }).not.toBeNull();
  expect((await busFrame(page)).key).toBe('rta-bus');

  // Sample the bus frame until it has opened and closed again: driving(4) -> closed(0) -> half(1) -> open(2)
  // -> closing(3) -> closed(0) -> driving(4). The frame must change at least through the open frame.
  const seen = new Set();
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const bus = await busFrame(page);
    if (!bus) break; // despawned: the bus has left
    seen.add(bus.frame);
    await page.waitForTimeout(40);
  }
  expect([...seen]).toEqual(expect.arrayContaining([0, 2])); // closed after stopping, and fully open
  expect(seen.size).toBeGreaterThanOrEqual(3); // the frame really changed during the scene
});

test('Esc skips the bus arrival straight to control: bus gone, input unlocked, she is on the road', async ({ page }) => {
  await startOpening(page);
  await expect.poll(() => busFrame(page), { timeout: 10_000 }).not.toBeNull();
  await skipWorldScript(page);
  expect(await busFrame(page)).toBeNull(); // despawned by the script's own last bus step
  const after = await state(page);
  expect(after.map).toBe('campus');
  expect(after.ready).toBe(true);
});
