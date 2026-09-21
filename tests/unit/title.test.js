// FB-0023/0024: the title screen's own pure logic -- `?title=0`, resetGameState() ("Play" = new
// game), and peekSave()/hasSaveFile() (title's "Continue" needs to know a save exists, and roughly
// where it left off, without applying it). The scene itself (src/scenes/title.js) needs a browser,
// so that's covered by tests/e2e/title.spec.js instead (docs/TESTING.md: unit tests are for rules
// and data, not drawing).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

test('titleEnabled() defaults on, ?title=0 turns it off', () => {
  const { titleEnabled } = loadGameData();
  assert.equal(titleEnabled(''), true);
  assert.equal(titleEnabled(), true); // no `location` in this sandbox, same as cutscenesEnabled()/saveEnabled()
  assert.equal(titleEnabled('?title=0'), false);
  assert.equal(titleEnabled('?map=campus&title=0'), false);
  assert.equal(titleEnabled('?title=1'), true);
});

test('resetGameState() puts a played-in state back to fresh-boot defaults', () => {
  const { GameState, resetGameState } = loadGameData();
  GameState.map = 'house';
  GameState.position = { x: 3, y: 4 };
  GameState.facing = 'left';
  GameState.inventory.add('sword');
  GameState.inventory.select(0);
  GameState.flags.tomasGaveSword = true;
  GameState.flags.tomasChats = 2;
  GameState.quest.stage = 'hunting';
  GameState.quest.keys.icvl = true;
  GameState.collected.add('meadow-apple-1');
  GameState.seenCutscenes.add('gate2');
  GameState.seenDialog.add('tomas:give-sword');
  GameState.seenHints.add('move');

  resetGameState(GameState);

  assert.equal(GameState.map, null);
  assert.equal(GameState.position, null);
  assert.equal(GameState.facing, 'down');
  assert.deepEqual(plain(GameState.inventory.slots), [null, null, null, null, null]);
  assert.equal(GameState.inventory.selected, 0);
  assert.equal(GameState.flags.tomasGaveSword, false);
  assert.equal(GameState.flags.tomasChats, 0);
  assert.equal(GameState.quest.stage, 'arrival');
  assert.equal(GameState.quest.keys.icvl, false);
  assert.equal(GameState.collected.size, 0);
  assert.equal(GameState.seenCutscenes.size, 0);
  assert.equal(GameState.seenDialog.size, 0);
  assert.equal(GameState.seenHints.size, 0);
  // The same live Inventory instance, not a replacement -- anything already listening to it
  // (hotbar, tutorial checklist) must keep working after a "Play" from the title screen.
  assert.equal(typeof GameState.inventory.on, 'function');
});

test('resetGameState() never touches localStorage: an existing save survives a "Play"', () => {
  const { GameState, resetGameState, saveGame, loadGame, localStorage } = loadGameData();
  GameState.map = 'campus';
  saveGame('default', GameState);
  const before = localStorage.getItem('pixelquest.save.v1.default');

  resetGameState(GameState);

  assert.equal(localStorage.getItem('pixelquest.save.v1.default'), before);
  assert.equal(loadGame('default', GameState), true);
  assert.equal(GameState.map, 'campus'); // the old save is still there, just not applied by Play
});

test('peekSave()/hasSaveFile() see a save without applying it', () => {
  const { GameState, saveGame, peekSave, hasSaveFile } = loadGameData();
  assert.equal(hasSaveFile('default'), false);
  assert.equal(peekSave('default'), null);

  GameState.map = 'house';
  GameState.position = { x: 5, y: 6 };
  saveGame('default', GameState);
  GameState.map = 'campus'; // peekSave must not be fooled by the live state changing afterward

  assert.equal(hasSaveFile('default'), true);
  const peeked = peekSave('default');
  assert.equal(peeked.map, 'house');
  assert.equal(GameState.map, 'campus'); // peeking never applies anything
});

test('peekSave() returns null for corrupt or unreadable-version saves, like loadGame() does', () => {
  const { peekSave, hasSaveFile, localStorage } = loadGameData();
  localStorage.setItem('pixelquest.save.v1.default', '{ not valid json');
  assert.equal(peekSave('default'), null);
  assert.equal(hasSaveFile('default'), false);

  localStorage.setItem('pixelquest.save.v1.default', JSON.stringify({ version: 999, state: { map: 'campus' } }));
  assert.equal(peekSave('default'), null);
});
