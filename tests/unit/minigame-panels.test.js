// Mini-game panel defects from the 2026-10-04 sweep: D09 (win card key icon over the message), D08 (Flappy's in-play
// furniture behind the cards) and D02/D03 (platformer HUD/cards following the scrolled camera). The win card's spacing is
// pure data (src/minigames/framework-data.js winCardLayout) and is tested for real. The scenes themselves need Phaser and a
// browser, so for D08/D02/D03 the checks below pin the source that implements the fix (the same approach
// story-clearance.test.js uses to read a constant out of world.js); the visual result is for the coordinator to look at.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { MINIGAMES, winCardLayout, MG_CARD_LINE_H, MG_CARD_HEADER_H, MG_WIN_BLANK_LINES } = loadGameData();
const src = (file) => fs.readFileSync(path.join(ROOT, 'src', 'minigames', file), 'utf8');

test('D09: the win card icon ends clear of the message line, for every mini-game and any panel position', () => {
  assert.equal(MG_WIN_BLANK_LINES, 3, 'three blank rows above the message (two left the icon on the text)');
  for (const boxY of [0, 120, 163]) {
    const l = winCardLayout(boxY);
    assert.ok(l.iconBottom + 6 <= l.messageTop, `icon bottom ${l.iconBottom} is within 6 px of the message top ${l.messageTop}`);
    assert.ok(l.iconTop >= boxY + 40, 'the icon must also clear the title above it (title row ends about 40 px down)');
    // even with the icon's Back.easeOut overshoot (scale about 3.4 instead of 3) it must not reach the text
    assert.ok(l.iconCenterY + 24 * (3.4 / 3) < l.messageTop, 'the bounce overshoot reaches the message');
  }
  assert.equal(MG_CARD_LINE_H * MG_WIN_BLANK_LINES + MG_CARD_HEADER_H, winCardLayout(0).messageCenterY);
  assert.ok(Object.keys(MINIGAMES).length >= 3);
});

test('D09: the win card is built from the shared layout (blank rows and icon position both come from framework-data.js)', () => {
  const s = src('framework-scene.js');
  assert.match(s, /\.\.\.Array\(MG_WIN_BLANK_LINES\)\.fill\(''\)/);
  assert.match(s, /winCardLayout\(this\.box\.y\)\.iconCenterY/);
  assert.match(s, /const lineH = MG_CARD_LINE_H;/);
  assert.match(s, /const headerH = MG_CARD_HEADER_H;/);
});

test('D08: Flappy hides its "press space" prompt and the bird whenever a card is shown, and shows them again for a new attempt', () => {
  const flappy = src('flappy.js');
  const hook = /onPanelShown\(\) \{([^}]*)\}/.exec(flappy);
  assert.ok(hook, 'flappy.js must override onPanelShown()');
  assert.match(hook[1], /this\.hoverPrompt\.setVisible\(false\)/);
  assert.match(hook[1], /this\.bird\.setVisible\(false\)/);
  const start = /startAttempt\(\) \{([\s\S]*?)\n  \}/.exec(flappy)[1];
  assert.match(start, /this\.hoverPrompt\.setVisible\(true\)/);
  assert.match(start, /this\.bird\.setVisible\(true\)/);
  const base = src('framework-scene.js');
  // both the game-over card (lose) and the win card (win) go through the hook, before the card is created
  assert.match(/lose\(\) \{[\s\S]*?this\.onPanelShown\(\);[\s\S]*?showGameOver/.exec(base)[0], /onPanelShown/);
  assert.match(/win\(skipped = false\) \{[\s\S]*?this\.onPanelShown\(\);[\s\S]*?showWin/.exec(base)[0], /onPanelShown/);
});

test('D02/D03: every shared mini-game UI object (HUD, cards, dim overlay, win icon, message, win flash) is pinned to the screen', () => {
  const s = src('framework-scene.js');
  assert.match(s, /function pinToScreen\(parts\) \{[\s\S]*?setScrollFactor\(0\)/);
  assert.match(s, /const parts = pinToScreen\(\[panel, text\]\)/, 'HUD');
  assert.match(s, /this\.parts = pinToScreen\(\[dim, panel, titleText/, 'card incl. the dim overlay');
  assert.match(s, /this\.parts\.push\(\.\.\.pinToScreen\(\[shadow, icon\]\)\)/, 'win key icon');
  assert.match(s, /pinToScreen\(\[panel, label\]\);\s*\n\s*this\.message = /, 'in-game message');
  assert.match(s, /const flash = [^\n]*setScrollFactor\(0\)/, 'win flash');
});

test('D02/D03: the platformer really does scroll its camera (so the pinning above is needed), while the tower and Flappy never do', () => {
  assert.match(src('platformer.js'), /cameras\.main\.startFollow\(/);
  assert.doesNotMatch(src('flappy.js'), /startFollow|scrollX\s*=/);
  assert.doesNotMatch(src('tower.js'), /startFollow|scrollX\s*=/);
});
