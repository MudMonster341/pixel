// FB-0073 ("why is the text box cut off the right, instructions look messy, too much text"). The border half of that is
// tests/unit/ui-frame.test.js; this is the other half: a mini-game's intro card is a TITLE, one CONTROLS line and one GOAL
// line (e.g. "ARROWS / WASD: MOVE   SPACE: JUMP"), no paragraphs, in a box that is only as wide as that text needs.
// The shared card code (src/minigames/framework-scene.js) needs a browser to run; its rules are data and source here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n'); // checkouts on Windows have CRLF
const { MINIGAMES, MG_INSTRUCTION_LINES, MG_INSTRUCTION_MAX_CHARS, MG_CARD_MAX_W, MG_CARD_MIN_W, MG_CARD_SIDE_PAD } = loadGameData();

test('FB-0073: every mini-game\'s intro is two short lines under its title: a controls line and a goal line', () => {
  assert.equal(MG_INSTRUCTION_LINES, 2);
  assert.ok(Object.keys(MINIGAMES).length >= 3);
  for (const def of Object.values(MINIGAMES)) {
    assert.equal(def.instructions.length, MG_INSTRUCTION_LINES, `${def.id}: title + ${def.instructions.length} lines is a paragraph, not an at-a-glance card`);
    const [controls, goal] = def.instructions;
    assert.match(controls, /^[A-Z0-9 \/:-]+$/, `${def.id}: the controls line is "KEYS: ACTION" in capitals, not a sentence: ${controls}`);
    assert.ok(controls.includes(':'), `${def.id}: the controls line names a key and what it does: ${controls}`);
    assert.ok(!/[.!?]$/.test(controls) && !/[.!?]$/.test(goal), `${def.id}: no sentence punctuation, these are labels`);
    assert.match(goal, new RegExp(`\\b${def.scoreTarget}\\b`), `${def.id}: the goal line names the target (${def.scoreTarget}), the separate TARGET line is gone`);
    for (const line of def.instructions) {
      assert.ok(line.trim().length > 0 && line === line.trim(), `${def.id}: blank or padded line`);
      assert.ok(line.length <= MG_INSTRUCTION_MAX_CHARS, `${def.id}: "${line}" is ${line.length} chars (max ${MG_INSTRUCTION_MAX_CHARS})`);
      // At the card's 12 px monospace font a line must fit on one row, so it never wraps into a paragraph.
      assert.ok(line.length * 12 <= MG_CARD_MAX_W - MG_CARD_SIDE_PAD, `${def.id}: "${line}" would wrap`);
    }
  }
});

test('FB-0073: the intro card is built from the title and those lines alone (no blank spacer, no TARGET line, no paragraphs)', () => {
  const source = read('src', 'minigames', 'framework-scene.js');
  const intro = /showIntro\(def, onStart\) \{([\s\S]*?)\n  \}\n/.exec(source)[1];
  assert.match(intro, /title: def\.name\.toUpperCase\(\),/);
  assert.match(intro, /paragraphs: \[\.\.\.def\.instructions\],/);
  assert.doesNotMatch(intro, /TARGET|''/);
  assert.match(intro, /label: 'START \(ENTER\)'/);
});

test('FB-0073: the shared card is only as wide as its content needs, clamped between a minimum and the old fixed width', () => {
  assert.equal(MG_CARD_MAX_W, 640, 'the widest card is the old fixed 640 px');
  assert.ok(MG_CARD_MIN_W >= 360 && MG_CARD_MIN_W < MG_CARD_MAX_W);
  assert.ok(MG_CARD_MAX_W <= 960, 'inside the 960 px canvas');
  const source = read('src', 'minigames', 'framework-scene.js');
  assert.match(source, /const w = Math\.min\(MG_CARD_MAX_W, Math\.max\(MG_CARD_MIN_W, Math\.ceil\(contentW\) \+ MG_CARD_SIDE_PAD\)\);/);
  // Paragraphs still wrap at the widest card's text width (a long game-over line must never run past the panel).
  assert.match(source, /setWordWrapWidth\(MG_CARD_MAX_W - MG_CARD_SIDE_PAD\)/);
  // The width counts the title, the footer, every wrapped line and every button label (plus its cursor).
  assert.match(source, /widthOf\(title, 16\),\s*widthOf\(footerLabel, 8\),\s*\.\.\.lines\.map\(\(line\) => widthOf\(line, 12\)\),\s*\.\.\.items\.map\(\(item\) => widthOf\(item\.label, 12\) \+ 36\)/);
  // Everything is placed from the measured box, so a narrower card stays centred and fully bordered.
  assert.match(source, /const x = Math\.round\(\(GAME_WIDTH - w\) \/ 2\);/);
  assert.match(source, /const panel = makePanel\(scene, x, y, w, h\)\.setDepth\(201\);/);
});

test('FB-0073: Tetris (being replaced) keeps working with the shorter text: its HUD target still comes from scoreTarget', () => {
  assert.equal(MINIGAMES.tetris.scoreTarget, 10);
  assert.match(MINIGAMES.tetris.instructions[1], /10/);
  assert.equal(MINIGAMES.tetris.scoreLabel, 'LINES');
});
