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
  inventory.add('keycard');
  inventory.add('apple');
  assert.deepEqual(plain(inventory.slots), [{ item: 'apple', count: 2 }, { item: 'keycard', count: 1 }, null, null, null]);
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
  inventory.add('keycard');
  inventory.select(2);
  assert.deepEqual(events, [['added', 'keycard', 0], ['changed'], ['selected', 2]]);
});

test('select ignores slots that do not exist', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(5);
  inventory.select(3);
  inventory.select(5);
  inventory.select(-1);
  assert.equal(inventory.selected, 3);
});

// FB-0041b: remove() backs the `{ take: itemId }` dialog action (src/dialog.js) -- e.g. the LUG
// volunteer "collecting" the 3 key items back when the reward box is handed over (docs/STORY.md).
test('remove() takes one of a stacked item off, freeing the slot once it hits zero', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(5);
  inventory.add('apple');
  inventory.add('apple');
  assert.equal(inventory.remove('apple'), 1);
  assert.deepEqual(plain(inventory.slots), [{ item: 'apple', count: 1 }, null, null, null, null]);
  assert.equal(inventory.remove('apple'), 1);
  assert.deepEqual(plain(inventory.slots), [null, null, null, null, null]);
});

test('remove() with a count removes more than one, capped at what is actually held', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(5);
  for (let i = 0; i < 3; i++) inventory.add('apple');
  assert.equal(inventory.remove('apple', 2), 2);
  assert.deepEqual(plain(inventory.slots), [{ item: 'apple', count: 1 }, null, null, null, null]);
  // Asking for more than she holds only removes what's really there, never goes negative.
  assert.equal(inventory.remove('apple', 5), 1);
  assert.deepEqual(plain(inventory.slots), [null, null, null, null, null]);
});

test('remove() is a safe no-op (returns 0, no event) when she is not holding the item at all', () => {
  const { Inventory } = loadGameData();
  const inventory = new Inventory(5);
  const events = [];
  inventory.on('changed', () => events.push('changed'));
  assert.equal(inventory.remove('sword'), 0);
  assert.deepEqual(events, []);
});
