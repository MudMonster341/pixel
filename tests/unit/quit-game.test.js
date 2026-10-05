// FB-0075 ("add in a way to quit the game"). The pause menu (Esc) already had "Quit to Title" but nothing told the player.
// Now: a first-time in-fiction hint "ESC FOR THE MENU" (the existing HintBanner mechanism, shown once, saved in seenHints), a
// "Quit" entry on the title menu and a "Quit Game" entry in the pause menu, both going to a small goodbye screen ("Thanks for
// playing! You can close this tab or window now." plus a way back to the title) after trying window.close(). The scenes need
// a browser to run; their menus, hand-over rules and layout numbers are plain code, evaluated here on stand-in objects.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n'); // checkouts on Windows have CRLF

const game = loadGameData();
for (const file of ['src/scenes/ui.js', 'src/scenes/goodbye.js', 'src/scenes/title.js']) game.runScript(file);
const { evaluate } = game;

// A stand-in Phaser scene with a scene manager that records what it is asked to do, in order.
function fakeScene(key, alive = []) {
  const log = [];
  const scene = {
    sys: { settings: { key } },
    scene: {
      isActive: (k) => alive.includes(k),
      isPaused: () => false,
      isSleeping: () => false,
      stop: (k) => log.push(`stop:${k}`),
      start: (k) => log.push(`start:${k}`),
    },
  };
  return { scene, log };
}

// ---------- the hint ----------

test('FB-0075: "ESC FOR THE MENU" is one more in-fiction hint: shown once, remembered in seenHints (so it saves), queued behind the map hint', () => {
  const HINTS = evaluate('HINTS');
  assert.equal(HINTS.menu, 'ESC FOR THE MENU');
  const HintBanner = evaluate('HintBanner');
  const GameState = evaluate('GameState');
  assert.equal(GameState.seenHints.has('menu'), false);
  const banner = { queue: [], pump() {} };
  HintBanner.prototype.trigger.call(banner, 'menu');
  assert.deepEqual(banner.queue, ['menu'], 'queued the first time');
  assert.equal(GameState.seenHints.has('menu'), true, 'remembered, so a save keeps it from showing again');
  HintBanner.prototype.trigger.call(banner, 'menu');
  assert.deepEqual(banner.queue, ['menu'], 'never a second time');
  // It travels through the same save path as the other hints.
  assert.match(read('src', 'save.js'), /seenHints: \[\.\.\.state\.seenHints\]/);
  // world.js fires it right behind the map hint, the first time she leaves her start area.
  assert.match(read('src', 'scenes', 'world.js'), /emit\('hint', 'map'\);[^\n]*\n\s*this\.game\.events\.emit\('hint', 'menu'\);/);
  // The banner is wide enough for it (320 px box, 12 px monospace font).
  assert.ok(HINTS.menu.length * 12 <= 320 - 2 * 8, 'the hint text fits its banner');
});

// ---------- the title menu ----------

test('FB-0075: the title menu ends with "Quit" whatever else is on it (Play stays first)', () => {
  const TitleScene = evaluate('TitleScene');
  const { GameState, saveGame } = game;
  const idsNow = () => plain(TitleScene.prototype.buildMenuItems.call({}).map((item) => item.id));

  assert.deepEqual(idsNow(), ['play', 'controls', 'credits', 'quit'], 'no save yet');

  GameState.map = 'campus';
  saveGame('default', GameState);
  assert.deepEqual(idsNow(), ['play', 'continue', 'controls', 'credits', 'quit'], 'a save adds Continue');

  GameState.quest.stage = 'rewarded';
  saveGame('default', GameState);
  assert.deepEqual(idsNow(), ['play', 'continue', 'watch-card', 'controls', 'credits', 'quit'], 'a finished game adds Watch the Card Again');
});

test('FB-0075: choosing Quit on the title tries to close the window, then fades to the goodbye screen with nothing of the game left alive', () => {
  const TitleScene = evaluate('TitleScene');
  const log = [];
  evaluate('window').close = () => log.push('window.close');
  const { scene, log: sceneLog } = fakeScene('title', ['world']); // a world left paused behind the title
  let faded = null;
  const title = {
    ...scene,
    menuItems: [{ id: 'quit' }],
    menuIndex: 0,
    cameras: { main: { fadeOut: () => log.push('fadeOut'), once: (event, fn) => { faded = fn; } } },
    quitGame: TitleScene.prototype.quitGame,
  };
  TitleScene.prototype.confirmMenu.call(title);
  assert.deepEqual(log, ['window.close', 'fadeOut'], 'close is tried straight away, inside the key press');
  faded(); // the camera fade finished
  assert.deepEqual(plain(sceneLog), ['stop:world', 'start:goodbye']);
});

test('FB-0075: the title menu layout keeps every button on screen for 3 to 6 buttons, and the usual size up to 4', () => {
  const { titleMenuLayout, TITLE_MENU } = game;
  for (const n of [3, 4, 5, 6]) {
    const l = titleMenuLayout(n);
    assert.ok(l.buttonH >= 36, `${n} buttons: ${l.buttonH} px tall is too squashed`);
    assert.ok(l.y >= TITLE_MENU.topMin, `${n} buttons: the menu crowds the subtitle (y ${l.y})`);
    assert.ok(l.y + l.h <= TITLE_MENU.bottom, `${n} buttons: the menu runs past its bottom anchor (${l.y + l.h})`);
    assert.ok(l.y + l.h <= 540, `${n} buttons: off the 540 px screen`);
    assert.equal(l.h, n * l.buttonH + (n - 1) * l.gap);
  }
  for (const n of [3, 4]) assert.deepEqual({ ...titleMenuLayout(n) }.buttonH, 52, `${n} buttons keep the original 52 px`);
  assert.equal(titleMenuLayout(4).gap, 12);
  // The title scene builds its buttons from it.
  assert.match(read('src', 'scenes', 'title.js'), /const layout = titleMenuLayout\(this\.menuItems\.length\);/);
});

// ---------- the pause menu ----------

test('FB-0075: the pause menu has "Quit Game" right after "Quit to Title", and choosing it quits the game, not to the title', () => {
  const PAUSE_ITEMS = evaluate('PAUSE_ITEMS');
  const ids = plain(PAUSE_ITEMS.map((item) => item.id));
  assert.deepEqual(ids, ['resume', 'controls', 'save', 'quit', 'quitGame']);
  assert.equal(PAUSE_ITEMS[3].label, 'Quit to Title');
  assert.equal(PAUSE_ITEMS[4].label, 'Quit Game');

  const PauseMenu = evaluate('PauseMenu');
  for (const [index, expected] of [[3, 'quitToTitle'], [4, 'quitGame']]) {
    const calls = [];
    const menu = {
      view: 'menu', index,
      quitToTitle: () => calls.push('quitToTitle'), quitGame: () => calls.push('quitGame'),
      close: () => calls.push('close'), showControls() {}, doSave() {},
    };
    PauseMenu.prototype.confirm.call(menu);
    assert.deepEqual(calls, [expected]);
  }
  // Esc still backs out of the menu (the existing keyboard rule is untouched).
  const esc = [];
  PauseMenu.prototype.onEscape.call({ visible: true, view: 'menu', close: () => esc.push('close'), backToMenu: () => esc.push('back') });
  assert.deepEqual(esc, ['close']);
});

test('FB-0075: "Quit Game" from the pause menu closes the menu, tries to close the window, and shows the goodbye screen with the world and HUD stopped', () => {
  const PauseMenu = evaluate('PauseMenu');
  const log = [];
  evaluate('window').close = () => log.push('window.close');
  const { scene, log: sceneLog } = fakeScene('ui', ['world', 'ui']);
  PauseMenu.prototype.quitGame.call({ scene, close: () => log.push('menu.close') });
  assert.deepEqual(log, ['menu.close', 'window.close']);
  assert.deepEqual(sceneLog, ['stop:world', 'start:goodbye'], 'ui is the calling scene: starting the next one stops it');
});

test('FB-0075: "Quit to Title" still works, and now stops every gameplay scene (a paused cutscene or mini-game too)', () => {
  const PauseMenu = evaluate('PauseMenu');
  const { scene, log } = fakeScene('ui', ['world', 'ui', 'cutscene', 'minigame-flappy']);
  PauseMenu.prototype.quitToTitle.call({ scene, close() {} });
  assert.deepEqual(log, ['stop:world', 'stop:cutscene', 'stop:minigame-flappy', 'start:title']);
});

// ---------- the goodbye screen ----------

test('FB-0075: closing the window is a best effort that never throws (a plain browser tab refuses)', () => {
  const closeGameWindow = evaluate('closeGameWindow');
  const w = evaluate('window');
  delete w.close;
  assert.doesNotThrow(() => closeGameWindow(), 'no window.close at all');
  w.close = () => { throw new Error('Scripts may close only the windows that were opened by them.'); };
  assert.doesNotThrow(() => closeGameWindow(), 'a refusal');
  let closed = 0;
  w.close = () => { closed += 1; };
  closeGameWindow();
  assert.equal(closed, 1);
});

test('FB-0075: the goodbye screen says thanks, says the tab can be closed, and offers Back to title on Enter / E / Space / Esc / click', () => {
  const source = read('src', 'scenes', 'goodbye.js');
  assert.match(source, /class GoodbyeScene extends Phaser\.Scene[\s\S]*?super\('goodbye'\)/);
  assert.match(source, /'THANKS FOR PLAYING!'/);
  assert.match(source, /'You can close this tab or window now\.'/);
  assert.match(source, /'Back to title'/);
  assert.match(source, /for \(const key of \['ENTER', 'SPACE', 'E', 'ESC'\]\)/);
  assert.match(source, /this\.scene\.start\('title'\)/);
  assert.match(source, /try \{\s*window\.close\(\);\s*\} catch \(error\)/, 'window.close() is wrapped in try/catch');
  // Nothing touches the save on the way out.
  assert.doesNotMatch(source, /saveGame|resetGameState|localStorage/);
});

test('FB-0075: the goodbye scene is registered (script tag after the scenes it uses, scene list) and mini-games still say ESC TO QUIT', () => {
  const html = read('index.html');
  const goodbyeTag = html.indexOf('<script src="src/scenes/goodbye.js"></script>');
  assert.ok(goodbyeTag > html.indexOf('<script src="src/scenes/ui.js"></script>'), 'goodbye.js loads after ui.js (Button, makePanel, leaveGameTo)');
  assert.ok(goodbyeTag > 0 && goodbyeTag < html.indexOf('<script src="src/main.js"></script>'));
  assert.match(read('src', 'main.js'), /CreditsScene,[\s\S]*?GoodbyeScene,\s*\], \/\/ later scenes draw on top/);
  assert.match(read('src', 'minigames', 'framework-scene.js'), /'ENTER TO CHOOSE -- ESC TO QUIT'/);
});

// ---------- the shared hand-over ----------

test('FB-0075/FB-0076: stopGameplayScenes() stops exactly the gameplay scenes that are alive, never the calling scene, and leaveGameTo() then starts the next', () => {
  const stopGameplayScenes = evaluate('stopGameplayScenes');
  const leaveGameTo = evaluate('leaveGameTo');
  const { scene, log } = fakeScene('credits', ['credits', 'world', 'card']);
  stopGameplayScenes(scene);
  assert.deepEqual(log, ['stop:world', 'stop:card'], 'the calling scene is left to scene.start(), nothing dead is stopped');
  log.length = 0;
  leaveGameTo(scene, 'title');
  assert.deepEqual(log, ['stop:world', 'stop:card', 'start:title']);
  // Nothing alive: a plain start.
  const idle = fakeScene('title', []);
  leaveGameTo(idle.scene, 'goodbye');
  assert.deepEqual(idle.log, ['start:goodbye']);
});

test('FB-0075/FB-0076: the gameplay scene list covers the world, HUD, cutscene, the ending chain and every mini-game scene', () => {
  const GAMEPLAY_SCENES = evaluate('GAMEPLAY_SCENES');
  const MINIGAMES = evaluate('MINIGAMES');
  for (const key of ['world', 'ui', 'cutscene', 'box-opening', 'finale', 'card', 'credits']) assert.ok(GAMEPLAY_SCENES.includes(key), key);
  for (const def of Object.values(MINIGAMES)) assert.ok(GAMEPLAY_SCENES.includes(def.sceneKey), `${def.sceneKey} would be left running`);
});
