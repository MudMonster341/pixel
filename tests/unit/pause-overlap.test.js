// D16 (defect sweep 2026-10-04): the "WASD / ARROWS TO MOVE" hint and the hotbar were drawn over the Pause > Controls
// panel. The decision "is the hotbar drawn this frame" is pure (src/maplogic.js hotbarShouldShow) and tested here; the
// hint banner and the pause menu are Phaser objects, so for those the test pins the source that implements the fix.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { hotbarShouldShow } = loadGameData();
const ui = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'ui.js'), 'utf8');

test('D16: the hotbar shows normally, and hides while a dialog or the pause menu (with its Controls page) is open', () => {
  assert.equal(hotbarShouldShow({}), true);
  assert.equal(hotbarShouldShow({ dialogOpen: false, pauseOpen: false }), true);
  assert.equal(hotbarShouldShow({ dialogOpen: true }), false, 'the dialog box replaces the hotbar (unchanged)');
  assert.equal(hotbarShouldShow({ pauseOpen: true }), false, 'the pause menu / Controls panel covers it');
  assert.equal(hotbarShouldShow({ dialogOpen: true, pauseOpen: true }), false);
});

test('D16: UIScene.update() asks hotbarShouldShow() with the pause menu state, and a hint is held back while pause is open', () => {
  assert.match(ui, /this\.hotbar\.setVisible\(hotbarShouldShow\(\{ dialogOpen: this\.dialog\.isOpen, pauseOpen: this\.pause\.visible \}\)\)/);
  const blocked = /blocked\(\) \{([\s\S]*?)\n  \}/.exec(ui.slice(ui.indexOf('class HintBanner')));
  assert.ok(blocked, 'HintBanner.blocked() not found');
  assert.match(blocked[1], /this\.scene\.pause/, 'blocked() must consider the pause menu');
  assert.match(blocked[1], /dialog\.isOpen/);
  assert.match(blocked[1], /worldHasControl\(\)/);
});

test('D16: the pause menu\'s Controls page counts as the pause menu being open (PauseMenu.visible stays true on that page)', () => {
  const pause = ui.slice(ui.indexOf('class PauseMenu'));
  assert.match(pause, /this\.view = 'menu'; \/\/ 'menu' \| 'controls'/, 'the Controls page is a view of the same menu, not a second visible flag');
  const showControls = /showControls\(\) \{([\s\S]*?)\n  \}/.exec(pause);
  assert.ok(showControls, 'PauseMenu.showControls() not found');
  assert.doesNotMatch(showControls[1], /this\.visible = false/, 'opening Controls must not clear PauseMenu.visible');
});
