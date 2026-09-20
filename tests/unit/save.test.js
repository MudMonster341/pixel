const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

const SAVE_KEY = 'pixelquest.save.v1.default';

test('round trip: save then load restores an identical, plain-data state', () => {
  const { GameState, saveGame, loadGame, localStorage } = loadGameData();
  GameState.map = 'campus';
  GameState.position = { x: 12, y: 34 };
  GameState.facing = 'left';
  GameState.inventory.add('sword');
  GameState.inventory.add('apple');
  GameState.inventory.select(1);
  GameState.flags.tomasGaveSword = true;
  GameState.flags.tomasChats = 3;
  GameState.quest.stage = 'hunting';
  GameState.quest.keys.icvl = true;
  GameState.collected.add('meadow-apple-1');
  GameState.seenCutscenes.add('gate2-welcome');

  assert.equal(saveGame('default', GameState), true);
  assert.ok(localStorage.getItem(SAVE_KEY));

  // Mutate the live state afterwards so the assertions below can only pass if load() actually put
  // the saved values back, not because they were already sitting there.
  GameState.map = 'house';
  GameState.position = { x: 0, y: 0 };
  GameState.facing = 'down';
  GameState.inventory.select(0);
  GameState.flags.tomasGaveSword = false;
  GameState.quest.stage = 'arrival';
  GameState.quest.keys.icvl = false;
  GameState.collected.clear();
  GameState.seenCutscenes.clear();

  assert.equal(loadGame('default', GameState), true);
  assert.equal(GameState.map, 'campus');
  assert.deepEqual(plain(GameState.position), { x: 12, y: 34 });
  assert.equal(GameState.facing, 'left');
  assert.equal(GameState.inventory.selected, 1);
  assert.deepEqual(plain(GameState.inventory.slots), [
    { item: 'sword', count: 1 }, { item: 'apple', count: 1 }, null, null, null,
  ]);
  assert.equal(GameState.flags.tomasGaveSword, true);
  assert.equal(GameState.flags.tomasChats, 3);
  assert.equal(GameState.quest.stage, 'hunting');
  assert.equal(GameState.quest.keys.icvl, true);
  // GameState.collected/.seenCutscenes come from the vm sandbox's own realm, so `instanceof Set`
  // (checking against *this* file's Set) isn't reliable -- check by behaviour instead: a real Set
  // has a working `.has()`, and JSON.stringify on a Set (unlike a plain object/array) yields '{}'.
  assert.equal(typeof GameState.collected.has, 'function', 'collected should be restored as a real Set');
  assert.ok(GameState.collected.has('meadow-apple-1'));
  assert.notEqual(JSON.stringify(GameState.collected), '["meadow-apple-1"]');
  assert.equal(typeof GameState.seenCutscenes.has, 'function', 'seenCutscenes should be restored as a real Set');
  assert.ok(GameState.seenCutscenes.has('gate2-welcome'));
});

test('a save version this build does not understand is ignored, not crashed on', () => {
  const { GameState, loadGame, localStorage } = loadGameData();
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: 999, savedAt: Date.now(), profile: 'default', state: { map: 'campus' },
  }));
  const before = plain({ map: GameState.map, flags: GameState.flags, quest: GameState.quest });

  assert.equal(loadGame('default', GameState), false);
  assert.deepEqual(plain({ map: GameState.map, flags: GameState.flags, quest: GameState.quest }), before);
});

test('corrupt JSON in storage is ignored, not crashed on', () => {
  const { GameState, loadGame, localStorage } = loadGameData();
  localStorage.setItem(SAVE_KEY, '{ not valid json');
  assert.doesNotThrow(() => loadGame('default', GameState));
  assert.equal(loadGame('default', GameState), false);
});

test('no save yet: loadGame returns false and leaves the fresh state alone', () => {
  const { GameState, loadGame } = loadGameData();
  assert.equal(loadGame('default', GameState), false);
  assert.equal(GameState.map, null);
  assert.equal(GameState.quest.stage, 'arrival');
});

test('profiles are independent', () => {
  const { GameState, saveGame, loadGame } = loadGameData();
  GameState.map = 'campus';
  GameState.flags.tomasChats = 1;
  assert.equal(saveGame('alice', GameState), true);

  GameState.map = 'house';
  GameState.flags.tomasChats = 9;
  assert.equal(saveGame('bob', GameState), true);

  assert.equal(loadGame('alice', GameState), true);
  assert.equal(GameState.map, 'campus');
  assert.equal(GameState.flags.tomasChats, 1);

  assert.equal(loadGame('bob', GameState), true);
  assert.equal(GameState.map, 'house');
  assert.equal(GameState.flags.tomasChats, 9);
});

test('deleteProfile clears just that profile, leaving others alone', () => {
  const { GameState, saveGame, loadGame, deleteProfile, listProfiles } = loadGameData();
  saveGame('alice', GameState);
  saveGame('bob', GameState);
  assert.deepEqual(plain(listProfiles().sort()), ['alice', 'bob']);

  deleteProfile('alice');
  assert.deepEqual(plain(listProfiles()), ['bob']);
  assert.equal(loadGame('alice', GameState), false);
  assert.equal(loadGame('bob', GameState), true);
});

test('unknown/extra fields in a save do not crash loading', () => {
  const { GameState, loadGame, localStorage } = loadGameData();
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    profile: 'default',
    state: {
      map: 'campus',
      position: { x: 1, y: 2 },
      facing: 'down',
      inventory: { slots: [{ item: 'sword', count: 1 }], selected: 0 },
      flags: { tomasGaveSword: true, futureFlag: 'ignored' },
      quest: { stage: 'briefed', keys: { icvl: true }, futureQuestField: 42 },
      collected: ['x'],
      seenCutscenes: ['y'],
      somethingFromTheFuture: { nested: true },
    },
    extraTopLevelField: 'also ignored',
  }));

  assert.doesNotThrow(() => loadGame('default', GameState));
  assert.equal(GameState.map, 'campus');
  assert.equal(GameState.flags.tomasGaveSword, true);
  assert.equal(GameState.quest.stage, 'briefed');
  assert.equal(GameState.quest.keys.icvl, true);
});

test('an inventory slot referencing an item that no longer exists is dropped, not crashed on', () => {
  const { GameState, loadGame, localStorage } = loadGameData();
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: 1,
    savedAt: Date.now(),
    profile: 'default',
    state: {
      inventory: { slots: [{ item: 'discontinuedItem', count: 1 }], selected: 0 },
      flags: {}, quest: {}, collected: [], seenCutscenes: [],
    },
  }));

  assert.doesNotThrow(() => loadGame('default', GameState));
  assert.equal(GameState.inventory.slots[0], null);
});

test('saveGame reports failure instead of throwing when localStorage itself is broken', () => {
  const { GameState, saveGame, localStorage } = loadGameData();
  localStorage.setItem = () => { throw new Error('quota exceeded'); };
  assert.equal(saveGame('default', GameState), false);
});
