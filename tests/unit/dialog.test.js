const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

function tomas(data) {
  return data.MAPS.house.npcs.find((npc) => npc.id === 'tomas');
}

const countItem = (slots, item) => slots.filter((slot) => slot && slot.item === item).reduce((n, slot) => n + slot.count, 0);

test('Tomas gives the Old Sword on the first talk, and only once', () => {
  const data = loadGameData();
  const { GameState } = data;

  const first = tomas(data).talk(GameState);
  assert.ok(first.lines.length > 0);
  assert.equal(first.onEnd(), 'You got the Old Sword!');
  assert.equal(GameState.flags.tomasGaveSword, true);

  const second = tomas(data).talk(GameState);
  assert.equal(second.onEnd, undefined);
  assert.equal(countItem(GameState.inventory.slots, 'sword'), 1);
});

test('Tomas keeps the sword if the bag is full, and offers it again later', () => {
  const data = loadGameData();
  const { GameState } = data;
  const { slots } = GameState.inventory;
  for (let i = 0; i < slots.length; i++) slots[i] = { item: 'notebook', count: 3 }; // every slot full

  assert.equal(tomas(data).talk(GameState).onEnd(), 'Your bag is full!');
  assert.equal(GameState.flags.tomasGaveSword, false);
  assert.ok(tomas(data).talk(GameState).onEnd, 'the sword should still be on offer');
});

test('after the sword, Tomas cycles through different chats', () => {
  const data = loadGameData();
  const { GameState } = data;
  GameState.flags.tomasGaveSword = true;
  const first = tomas(data).talk(GameState).lines.join(' ');
  const second = tomas(data).talk(GameState).lines.join(' ');
  assert.notEqual(first, second);
});
