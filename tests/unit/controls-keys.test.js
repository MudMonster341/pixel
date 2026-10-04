// FB-0045 ("for messages, both E and enter should work, i don't want to press E for the next message"). E, Space and
// Enter all advance / close a message box and pick a dialog choice, everywhere a box advances: the game's own dialogs (the
// world scene), the cutscene / greeting / card scenes that reuse the same DialogBox, and the mini-game cards. The world
// scene's key handler is evaluated for real here (its methods are plain code; only RUNNING the scene needs a browser) on a
// stand-in `this`, so the "one press is used exactly once" rules are tested as behaviour, not just as source text.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n'); // checkouts on Windows have CRLF

const game = loadGameData();
game.runScript('src/scenes/world.js');
game.runScript('src/scenes/ui.js');
const WorldScene = game.evaluate('WorldScene');
const DialogBox = game.evaluate('DialogBox');

// A stand-in WorldScene `this` plus the UI scene it talks to, with spies for the two things a key press can do.
function harness({ dialogOpen = false, blocking = false, transitioning = false, active = true, advanceCloses = false } = {}) {
  const calls = { advance: 0, interact: 0 };
  const ui = {
    tutorial: {},
    isBlocking: () => blocking,
    dialog: {
      isOpen: dialogOpen,
      advance() {
        calls.advance += 1;
        if (advanceCloses) this.isOpen = false; // the last line: pressing the key closes the box
      },
    },
  };
  const world = {
    sys: { isActive: () => active },
    scene: { get: () => ui },
    transitioning,
    interact() { calls.interact += 1; },
  };
  const press = (event = {}) => WorldScene.prototype.onInteractKey.call(world, { repeat: false, ...event });
  return { calls, ui, world, press };
}

test('FB-0045: the world scene sends E, Space and Enter to the same handler', () => {
  const source = read('src', 'scenes', 'world.js');
  assert.match(source, /for \(const key of \['E', 'SPACE', 'ENTER'\]\) this\.input\.keyboard\.on\(`keydown-\$\{key\}`, \(event\) => this\.onInteractKey\(event\)\);/);
});

test('FB-0045: with a message box open, one key press advances it exactly once and never also starts a conversation', () => {
  for (const key of ['e', ' ', 'Enter']) {
    const h = harness({ dialogOpen: true });
    h.press({ key });
    assert.deepEqual(h.calls, { advance: 1, interact: 0 }, `${JSON.stringify(key)} must only advance the box`);
  }
});

test('FB-0045: the press that CLOSES a box (its last line) does not re-open it or interact in the same press', () => {
  for (const key of ['e', ' ', 'Enter']) {
    const h = harness({ dialogOpen: true, advanceCloses: true });
    h.press({ key });
    assert.equal(h.ui.dialog.isOpen, false, 'the box closed');
    assert.deepEqual(h.calls, { advance: 1, interact: 0 }, `${JSON.stringify(key)} closed the box and must stop there`);
  }
});

test('FB-0045: with no box open, Enter talks to whoever is nearby exactly like E (once per press)', () => {
  for (const key of ['e', ' ', 'Enter']) {
    const h = harness();
    h.press({ key });
    assert.deepEqual(h.calls, { advance: 0, interact: 1 }, `${JSON.stringify(key)} should start the conversation`);
  }
});

test('FB-0045: Enter is ignored while another screen owns the game, mid-door/script, in a paused scene, or when held down', () => {
  for (const [label, options, event] of [
    ['a modal (journal / map / pause menu) is open', { blocking: true }, {}],
    ['a door walk or script is running (a new conversation may not start)', { transitioning: true }, {}],
    ['the world scene is paused under a mini-game or cutscene', { active: false }, {}],
    ['the key is held down (auto-repeat)', {}, { repeat: true }],
    ['the UI scene already used this very press (pause-menu "Resume")', {}, { uiConsumed: true }],
  ]) {
    const h = harness(options);
    h.press({ key: 'Enter', ...event });
    assert.deepEqual(h.calls, { advance: 0, interact: 0 }, label);
  }
  // ...but a script's own `say` box still advances mid-script (transitioning is set for the whole script).
  const h = harness({ dialogOpen: true, transitioning: true });
  h.press({ key: 'Enter' });
  assert.deepEqual(h.calls, { advance: 1, interact: 0 });
});

test('FB-0045: the pause menu marks the Enter/Space press it uses, so "Resume" cannot also start a conversation', () => {
  const ui = read('src', 'scenes', 'ui.js');
  assert.match(ui, /for \(const key of \['ENTER', 'SPACE'\]\) \{\s*scene\.input\.keyboard\.on\(`keydown-\$\{key\}`, \(e\) => \{\s*if \(e\.repeat \|\| !this\.visible\) return;[\s\S]*?e\.uiConsumed = true;\s*this\.confirm\(\);/);
  assert.match(read('src', 'scenes', 'world.js'), /if \(event\.uiConsumed\) return;/);
});

test('FB-0045: the message box owns no confirm key of its own (a second Enter handler would double-fire next to the scene\'s)', () => {
  const ui = read('src', 'scenes', 'ui.js');
  const box = ui.slice(ui.indexOf('class DialogBox {'), ui.indexOf('// ---------- toast'));
  assert.ok(box.length > 1000, 'found the DialogBox class');
  assert.doesNotMatch(box, /keydown-ENTER|'ENTER'/, 'DialogBox must not listen for Enter itself; the owning scene routes E/Space/Enter to advance()');
});

test('FB-0045: advance() is the one entry point: it picks the highlighted choice, finishes a typing line, then moves on or closes', () => {
  const make = (state) => {
    const box = Object.create(DialogBox.prototype);
    Object.assign(box, { lines: ['a', 'b'], index: 0, typing: false, choices: null, pendingChoices: null, fullText: 'abc', shown: 0 }, state);
    const log = [];
    box.confirmChoice = () => log.push('confirmChoice');
    box.startLine = () => log.push('startLine');
    box.showChoices = () => log.push('showChoices');
    box.close = () => log.push('close');
    return { box, log };
  };
  let t = make({ choices: [{ text: 'Yes' }] });
  t.box.advance();
  assert.deepEqual(t.log, ['confirmChoice'], 'a choice list: Enter / E / Space pick the highlighted one');

  t = make({ typing: true });
  t.box.advance();
  assert.equal(t.box.shown, 3, 'a typing line completes first');
  assert.deepEqual(t.log, []);

  t = make({});
  t.box.advance();
  assert.deepEqual(t.log, ['startLine'], 'then the next line');

  t = make({ index: 1 });
  t.box.advance();
  assert.deepEqual(t.log, ['close'], 'the last line closes the box');

  t = make({ index: 1, pendingChoices: [{ text: 'Yes' }] });
  t.box.advance();
  assert.deepEqual(t.log, ['showChoices'], 'the last line with choices waiting shows them');
});

test('FB-0045: every other scene that shows a message box advances it on Enter, Space AND E', () => {
  const keysOf = (file, pattern) => {
    const match = pattern.exec(read(...file));
    assert.ok(match, `${file.join('/')}: no key list found`);
    return match[1];
  };
  for (const file of [['src', 'scenes', 'cutscene.js'], ['src', 'scenes', 'card.js'], ['src', 'scenes', 'intro-greeting.js']]) {
    const keys = keysOf(file, /for \(const key of \[([^\]]*)\]\) \{\s*this\.input\.keyboard\.on\(`keydown-\$\{key\}`/);
    for (const k of ['ENTER', 'SPACE', 'E']) assert.ok(keys.includes(`'${k}'`), `${file.join('/')} misses ${k}`);
  }
  // The mini-game cards (intro / game over / win messages): Enter and Space always worked, E joins them (FB-0045).
  const card = read('src', 'minigames', 'framework-scene.js');
  assert.match(card, /for \(const key of \['ENTER', 'SPACE', 'E'\]\) this\.on\(`keydown-\$\{key\}`, \(e\) => \{ if \(!e\.repeat\) this\.confirm\(\); \}\);/);
  assert.match(card, /label: 'START \(ENTER\)'/, 'the intro card still says START (ENTER)');
  // The credits and the goodbye screen take E too.
  assert.match(read('src', 'scenes', 'credits.js'), /for \(const key of \['ESC', 'SPACE', 'ENTER', 'E'\]\)/);
  assert.match(read('src', 'scenes', 'goodbye.js'), /for \(const key of \['ENTER', 'SPACE', 'E', 'ESC'\]\)/);
});

test('FB-0045: the Controls panel lists all three keys for talk / next line', () => {
  assert.match(read('src', 'scenes', 'ui.js'), /\['E \/ ENTER \/ SPACE', 'Talk, next line'\]/);
});
