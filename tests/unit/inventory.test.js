const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

test('stacks the same item up to its max, then starts a new slot', () => {
  const { Inventory, ITEMS } = loadGameData();
  const inventory = new Inventory(5);
  const max = ITEMS.apple.maxStack;
  for (let i = 0; i < max + 1; i++) assert.equal(inventory.add('apple'), true);
  assert.deepEqual(plain(inventory.slots), [{ item: 'apple', count: max }, { item: 'apple', count: 1 }, null, null, null]);
});

test('different items go into different slots', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(5);
  inventory.add('apple');
  inventory.add('gem');
  inventory.add('apple');
  assert.deepEqual(plain(inventory.slots), [{ item: 'apple', count: 2 }, { item: 'gem', count: 1 }, null, null, null]);
});

test('returns false and changes nothing when the bag is full', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(2);
  inventory.add('sword');
  inventory.add('sword');
  const before = plain(inventory.slots);
  assert.equal(inventory.add('sword'), false);
  assert.deepEqual(plain(inventory.slots), before);
});

test('emits added, changed and selected events', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(3);
  const events = [];
  inventory.on('added', (item, slot) => events.push(['added', item, slot]));
  inventory.on('changed', () => events.push(['changed']));
  inventory.on('selected', (slot) => events.push(['selected', slot]));
  inventory.add('gem');
  inventory.select(2);
  assert.deepEqual(events, [['added', 'gem', 0], ['changed'], ['selected', 2]]);
});

test('select ignores slots that do not exist', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(5);
  inventory.select(3);
  inventory.select(5);
  inventory.select(-1);
  assert.equal(inventory.selected, 3);
});
