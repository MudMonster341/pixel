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
// Title defaults off (`?title=0`, FB-0023/0024, src/scenes/title.js): almost every spec here plays
// the world/UI directly and has no reason to sit through the title/loading screens first; only
// tests/e2e/title.spec.js passes `title: true` to exercise that flow itself.
// `intro` (the M3a opening chain, src/maplogic.js introEnabled()) also defaults off here, not just in
// openTitle() below: a spec can reach the title screen at runtime without ever navigating through
// openTitle() (title.spec.js's "Quit to Title" test does exactly this), and the URL's query string --
// set once, here, at the very first page.goto() -- is what every later scene transition still reads,
// since none of them reload the page. Defaulting it off here too means "Play" from a
// runtime-reached title screen behaves the same as everywhere else in this file: straight to 'boot'.
// Mini-games (docs/ROADMAP.md M4) default off (`?minigames=0`, src/maplogic.js minigamesEnabled()),
// the same way cutscenes/title/intro do: a `minigame` dialog action resolves straight to 'won'
// without ever launching the real Phaser scene, so most specs (the LUG-hunt playthrough, dialog and
// save tests, ...) see a key change hands the instant she wins it, without having to actually play a
// platformer/flyer/Tetris session headlessly. tests/e2e/minigames.spec.js passes `minigames: true` to
// turn the real thing back on.
async function openGame(page, { dev = false, map = 'meadow', cutscene = false, save = false, profile, title = false, intro = false, minigames = false } = {}) {
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
  if (!title) params.set('title', '0');
  if (!intro) params.set('intro', '0');
  if (!minigames) params.set('minigames', '0');
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
      flags: GameState.flags,
      quest: GameState.quest,
      journal: [...GameState.journal],
      tutorial: { stage: ui.tutorial.stage, completed: [...ui.tutorial.completed] },
      seenHints: [...GameState.seenHints],
      pause: { visible: ui.pause.visible, view: ui.pause.view, controlsVisible: ui.pause.controls.visible },
      dialogOpen: ui.dialog.isOpen,
      // `choices` is set only while a choice list is on screen (src/scenes/ui.js DialogBox); each
      // entry's own `text`, and the currently highlighted index (up/down or W/S move it).
      dialogChoices: ui.dialog.choices ? ui.dialog.choices.map((choice) => choice.text) : null,
      dialogChoiceIndex: ui.dialog.choiceIndex,
      promptVisible: world.prompt.visible,
      // 0 = "E" (talk), 1 = "!" (something new to say) -- see src/dialog.js hasNewDialog().
      promptFrame: world.prompt.frame ? Number(world.prompt.frame.name) : null,
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

// FB-0023: the old blocking "controls card" is gone -- movement is available the instant the
// world/ui scenes are ready, which openGame()'s waitForBoot() already confirmed. Kept as a named
// step (most specs read "open the game, then start playing, then act") even though there's nothing
// left to press; it also doubles as a sanity check that the tutorial state machine actually moved
// off its old 'intro' stage (removed entirely -- see src/scenes/ui.js Tutorial).
async function startGame(page) {
  await expect.poll(async () => (await state(page)).tutorial.stage).not.toBe('intro');
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

// ---------- title screen (FB-0023/0024, tests/e2e/title.spec.js) ----------

// Like openGame(), but leaves the title screen ON (openGame() defaults it off with `?title=0` for
// every other spec) and waits for the title scene itself instead of the world/ui scenes, which
// don't exist yet at this point -- they're only started once Play/Continue is chosen.
// `intro` defaults off (`?intro=0`, src/maplogic.js introEnabled()) the same way `cutscene`/`save`
// do: most title-flow specs want Play to land straight on 'boot', same as before the M3a opening
// (Mustafa's greeting/name entry/customisation/bus arrival) existed. tests/e2e/intro.spec.js passes
// `intro: true` to exercise that chain of scenes itself.
async function openTitle(page, { map, save = false, profile, intro = false, minigames = false } = {}) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const params = new URLSearchParams({ dev: '0', cutscene: '0' });
  if (map) params.set('map', map);
  if (!save) params.set('save', '0');
  if (profile) params.set('profile', profile);
  if (!intro) params.set('intro', '0');
  if (!minigames) params.set('minigames', '0');
  await page.goto(`/?${params.toString()}`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('title')?.menuItems));
  return { errors };
}

function titleState(page) {
  return page.evaluate(() => {
    const t = game.scene.getScene('title');
    return {
      stage: t.stage, // 'intro' (just the blinking prompt) or 'menu' (the prompt's been pressed)
      menuItems: t.menuItems.map((item) => item.id),
      menuIndex: t.menuIndex,
      controlsVisible: t.controls.visible,
      creditsVisible: t.credits.visible,
    };
  });
}

// Moves the highlight to the given menu item with real ArrowDown presses (keyboard-driven, per
// docs/GAME_FEEL.md), then presses Enter to confirm it. The menu only exists once the "PRESS ENTER"
// intro prompt has been pressed once (docs/GAME_FEEL.md: never both on screen at once), so this
// presses it first if needed. Every press goes through pressUntil (ERR-0003: a one-shot keydown
// occasionally never fires at all under load, not just late) rather than a bare `press()`, since a
// title-flow test can easily fire several of these keydowns back to back with little real time
// between them.
async function chooseTitleMenu(page, id) {
  if ((await titleState(page)).stage === 'intro') {
    await pressUntil(page, 'Enter', async () => (await titleState(page)).stage === 'menu');
  }
  for (let i = 0; i < 10; i++) {
    const { menuItems, menuIndex } = await titleState(page);
    if (menuItems[menuIndex] === id) break;
    await pressUntil(page, 'ArrowDown', async () => (await titleState(page)).menuIndex !== menuIndex);
  }
  expect((await titleState(page)).menuItems[(await titleState(page)).menuIndex]).toBe(id);

  // What "confirmed" means depends on which item it was: Controls/Credits open their own overlay;
  // Play/Continue fade out and hand off to the loading screen, stopping this scene.
  const confirmed = async () => {
    if (id === 'controls') return (await titleState(page)).controlsVisible;
    if (id === 'credits') return (await titleState(page)).creditsVisible;
    return !(await page.evaluate(() => game.scene.isActive('title')));
  };
  await pressUntil(page, 'Enter', confirmed);
}

module.exports = {
  openGame, waitForBoot, state, startGame, holdKey, holdKeys, pressUntil, teleport, waitForMap, finishDialog,
  countItem, feedbackCli, openTitle, titleState, chooseTitleMenu,
};
