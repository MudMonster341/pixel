// Shared helpers for the browser tests. They play the real game with real key presses, and read
// its state through window.game / GameState (the same hooks you can use in the browser console).
const path = require('path');
const { execFileSync } = require('child_process');
const { expect } = require('@playwright/test');
const { FEEDBACK_DIR } = require('./paths');

// `map` defaults to the meadow test map; pass `map: null` for the real start map (the campus).
async function openGame(page, { dev = false, map = 'meadow' } = {}) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`/?dev=${dev ? 1 : 0}${map ? `&map=${map}` : ''}`);
  await page.waitForFunction(() => {
    const world = window.game?.scene.getScene('world');
    const ui = window.game?.scene.getScene('ui');
    return Boolean(world?.player?.active && ui?.tutorial);
  });
  return { errors };
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
    };
  });
}

// Presses Enter on the controls card so the player can move.
async function startGame(page) {
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).tutorial.cardOpen).toBe(false);
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

module.exports = { openGame, state, startGame, holdKey, holdKeys, teleport, waitForMap, finishDialog, countItem, feedbackCli };
