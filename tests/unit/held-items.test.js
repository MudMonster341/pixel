// FB-0002: holding an item shows it on the character, so every item needs both a hotbar icon
// (assets/items.png) and a small in-hand sprite (assets/held-items.png), at the same frame index.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('FB-0002: every item has an icon frame and a held-item frame', () => {
  const { ITEMS, TILE } = loadGameData();
  const items = pngSize(path.join(ROOT, 'assets', 'items.png'));
  const held = pngSize(path.join(ROOT, 'assets', 'held-items.png'));
  const iconFrames = items.width / TILE;
  const heldFrames = held.width / held.height; // held-items.png is one row of square frames

  for (const [id, item] of Object.entries(ITEMS)) {
    assert.ok(item.frame >= 0 && item.frame < iconFrames, `item "${id}" uses frame ${item.frame}, which isn't in items.png`);
    assert.ok(item.frame < heldFrames, `item "${id}" uses frame ${item.frame}, which isn't in held-items.png`);
  }
});

test('FB-0002: apple and sword are kept, potion and gem are gone', () => {
  const { ITEMS } = loadGameData();
  assert.ok(ITEMS.apple, 'apple should still exist');
  assert.ok(ITEMS.sword, 'sword should still exist');
  assert.equal(ITEMS.potion, undefined, 'potion should be removed');
  assert.equal(ITEMS.gem, undefined, 'gem should be removed');
});

test('FB-0002: a few basic university items exist', () => {
  const { ITEMS } = loadGameData();
  for (const id of ['keycard', 'phone', 'idCard', 'notebook', 'laptop', 'coffee']) {
    assert.ok(ITEMS[id], `expected a university item "${id}"`);
  }
});
