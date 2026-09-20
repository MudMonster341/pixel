// Shared helpers for the browser tests. They play the real game with real key presses, and read
// its state through window.game / GameState (the same hooks you can use in the browser console).
const path = require('path');
const { execFileSync } = require('child_process');
const { expect } = require('@playwright/test');
const { FEEDBACK_DIR } = require('./paths');

// `map` defaults to the meadow test map; pass `map: null` for the real start map (the campus).
// Cutscenes are off by default (`?cutscene=0`) so a test walking through Gate 2 for some other
// reason isn't interrupted; tests/e2e/cutscene.spec.js passes `cutscene: true` to turn them back on.
// Saving defaults off (`?save=0`, src/save.js): most tests reload/re-navigate within a test and must
// not continue from whatever autosave a previous step wrote, or start from a leftover save at all.
// tests/e2e/save.spec.js passes `save: true` to opt back in, and `profile` to pick a save slot.
async function openGame(page, { dev = false, map = 'meadow', cutscene = false, save = false, profile } = {}) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const params = new URLSearchParams({ dev: dev ? '1' : '0' });
  if (map) params.set('map', map);
  if (!cutscene) params.set('cutscene', '0');
  if (!save) params.set('save', '0');
  if (profile) params.set('profile', profile);
  await page.goto(`/?${params.toString()}`);
  await waitForBoot(page);
  return { errors };
}

// Waits for the world + UI scenes to be up and running. openGame() calls this after page.goto();
// tests/e2e/save.spec.js also calls it directly after page.reload(), which doesn't go through openGame.
async function waitForBoot(page) {
  await page.waitForFunction(() => {
    const world = window.game?.scene.getScene('world');
    const ui = window.game?.scene.getScene('ui');
    return Boolean(world?.player?.active && ui?.tutorial);
  });
}

function state(page) {
  return page.evaluate(() => {
    const world = game.scene.getScene('world');
    const ui = game.scene.getScene('ui');
    return {
      map: world.mapKey,
      x: world.player.x,
      y: world.player.y,
      tile: { x: Math.floor(world.player.x / 16), y: Math.floor(world.player.y / 16) },
      facing: world.facing,
      ready: world.player.active && !world.transitioning && world.sys.isActive(),
      slots: GameState.inventory.slots,
      selected: GameState.inventory.selected,
      tutorial: { stage: ui.tutorial.stage, completed: [...ui.tutorial.completed], cardOpen: ui.tutorial.cardOpen },
      dialogOpen: ui.dialog.isOpen,
      promptVisible: world.prompt.visible,
      minimapVisible: ui.minimap.visible,
      toast: ui.toast.text.text,
      worldActive: world.sys.isActive(),
      cutsceneActive: game.scene.isActive('cutscene'),
      cutsceneDialogOpen: (() => {
        const cs = game.scene.getScene('cutscene');
        return Boolean(cs && cs.dialog && cs.dialog.isOpen);
      })(),
      seenCutscenes: [...GameState.seenCutscenes],
      locationBanner: { visible: ui.locationBanner.visible, text: ui.locationBanner.text.text },
      fullMapVisible: ui.fullMap.visible,
    };
  });
}

// Presses Enter on the controls card so the player can move.
async function startGame(page) {
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).tutorial.cardOpen).toBe(false);
}

// Presses a key and waits for `check()` to become true, re-pressing (like an impatient player
// would) if it doesn't happen quickly. ERR-0002: a keydown-driven UI toggle (the minimap's M key,
// notably) occasionally sees its event not take effect somewhere in the browser/Phaser input
// pipeline under load -- not merely delayed a frame (which a plain `expect.poll` already tolerates)
// but not landing within several seconds at all. Resending the same key a player would keep tapping
// recovers from that without weakening the check: a state that genuinely never arrives still fails.
async function pressUntil(page, key, check, { attempts = 5, attemptTimeout = 700 } = {}) {
  for (let i = 0; i < attempts; i++) {
    await page.keyboard.press(key);
    try {
      await expect.poll(check, { timeout: attemptTimeout }).toBe(true);
      return;
    } catch (error) {
      if (i === attempts - 1) throw error;
    }
  }
}

async function holdKey(page, key, ms) {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

async function holdKeys(page, keys, ms) {
  for (const key of keys) await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  for (const key of keys) await page.keyboard.up(key);
}

// Places the player at the center of a tile (fractions allowed, e.g. 9.5).
async function teleport(page, tileX, tileY) {
  await page.evaluate(([x, y]) => game.scene.getScene('world').player.body.reset(x * 16 + 8, y * 16 + 8), [tileX, tileY]);
}

async function waitForMap(page, key) {
  await expect.poll(async () => {
    const s = await state(page);
    return s.map === key && s.ready;
  }).toBe(true);
}

// Presses E until the conversation is over.
async function finishDialog(page) {
  for (let i = 0; i < 40 && (await state(page)).dialogOpen; i++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(80);
  }
  expect((await state(page)).dialogOpen).toBe(false);
}

const countItem = (slots, item) => slots.filter((slot) => slot && slot.item === item).reduce((n, slot) => n + slot.count, 0);

// Runs the agent's feedback command line against the test feedback folder.
function feedbackCli(args) {
  return execFileSync(process.execPath, [path.join(__dirname, '..', '..', 'tools', 'feedback.js'), ...args], {
    env: { ...process.env, FEEDBACK_DIR },
    encoding: 'utf8',
  });
}

module.exports = {
  openGame, waitForBoot, state, startGame, holdKey, holdKeys, pressUntil, teleport, waitForMap, finishDialog,
  countItem, feedbackCli,
};
