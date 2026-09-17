// Checks the cutscene data is well-formed, and the pure helpers world.js relies on to trigger it:
// the ?cutscene=0 URL param, the smallest-object-at-a-point lookup (also used for the location
// banner), and the play-once check. See src/cutscenes.js, src/maplogic.js, src/scenes/world.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

const { CUTSCENES, cutscenesEnabled, objectAt, notSeenCutscene } = loadGameData();

test('every cutscene has an image key and at least one non-empty line', () => {
  const keys = Object.keys(CUTSCENES);
  assert.ok(keys.length > 0, 'CUTSCENES should not be empty');
  for (const key of keys) {
    const def = CUTSCENES[key];
    assert.equal(typeof def.image, 'string');
    assert.ok(def.image.length > 0, `${key}: image key is empty`);
    assert.ok(Array.isArray(def.lines) && def.lines.length > 0, `${key}: needs at least one line`);
    for (const line of def.lines) {
      assert.equal(typeof line, 'string');
      assert.ok(line.trim().length > 0, `${key}: has an empty line`);
    }
  }
});

test('gate2 is a real cutscene, with a short, neutral second line (the owner writes the story later)', () => {
  const gate2 = CUTSCENES.gate2;
  assert.ok(gate2, 'CUTSCENES.gate2 should exist (the Gate 2 welcome cutscene)');
  assert.equal(gate2.image, 'cutscene-gate2');
  assert.ok(gate2.lines.length <= 3, 'keep cutscene lines short, Pokemon-style');
});

test('?cutscene=0 disables cutscenes; anything else (or nothing) leaves them on', () => {
  assert.equal(cutscenesEnabled('?cutscene=0'), false);
  assert.equal(cutscenesEnabled('?map=campus&cutscene=0'), false);
  assert.equal(cutscenesEnabled('?cutscene=1'), true);
  assert.equal(cutscenesEnabled('?map=campus'), true);
  assert.equal(cutscenesEnabled(''), true);
  assert.equal(cutscenesEnabled(), true); // no `location` in this sandbox, and none in the browser tests either
});

test('objectAt: finds the object of a matching type containing the point', () => {
  const objects = [
    { type: 'area', name: 'Campus', x: 0, y: 0, width: 100, height: 100 },
    { type: 'cutscene', name: 'Trigger', x: 10, y: 10, width: 2, height: 2, props: { cutscene: 'gate2' } },
  ];
  assert.equal(objectAt(objects, ['cutscene'], 11, 11)?.name, 'Trigger');
  assert.equal(objectAt(objects, ['cutscene'], 50, 50), null); // outside the trigger, even though inside the area
  assert.equal(objectAt(objects, ['area'], 50, 50)?.name, 'Campus');
});

test('objectAt: the smallest (most specific) match wins when areas are nested', () => {
  const objects = [
    { type: 'area', name: 'BITS Pilani, Dubai Campus', x: 0, y: 0, width: 200, height: 200 },
    { type: 'area', name: 'Athletics Track', x: 20, y: 20, width: 10, height: 10 },
  ];
  assert.equal(objectAt(objects, ['area'], 25, 25).name, 'Athletics Track');
  assert.equal(objectAt(objects, ['area'], 5, 5).name, 'BITS Pilani, Dubai Campus');
});

test('objectAt: a point on the edge counts as inside; one tile beyond does not', () => {
  const objects = [{ type: 'area', name: 'Box', x: 5, y: 5, width: 4, height: 4 }]; // covers x/y 5..8
  assert.equal(objectAt(objects, ['area'], 5, 5)?.name, 'Box');
  assert.equal(objectAt(objects, ['area'], 8.99, 8.99)?.name, 'Box');
  assert.equal(objectAt(objects, ['area'], 9, 9), null);
});

test('notSeenCutscene: only true for a real key not already in the seen set', () => {
  const seen = new Set(['gate2']);
  assert.equal(notSeenCutscene('gate2', seen), false, 'already seen');
  assert.equal(notSeenCutscene('other', seen), true, 'a different, unseen key');
  assert.equal(notSeenCutscene(undefined, seen), false, 'no key at all (not a cutscene trigger)');
  assert.equal(notSeenCutscene('', seen), false, 'empty key');
});

test('GameState starts with an empty seenCutscenes set', () => {
  const { GameState } = loadGameData(); // fresh load, not the one above, matching this file's own style
  assert.equal(GameState.seenCutscenes.size, 0);
});
