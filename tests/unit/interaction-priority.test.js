// Interaction tie-break (src/maplogic.js pickInteractable(), used by src/scenes/world.js
// nearestInteractable()): an exact distance tie used to go to an ambient NPC over a key station, so E
// near a key desk could give a student's small talk instead of the key (the ambient.js shifts of
// 2026-09-29 worked around it by moving students away). Priority is data now (INTERACT_PRIORITY), and
// the story object wins ties and near-ties; ambient students stay interactable on their own.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

const { pickInteractable, INTERACT_PRIORITY, INTERACT_TIE_MARGIN } = loadGameData();

const ks = (distance, id = 'ks') => ({ role: 'keyStation', distance, id });
const quest = (distance, id = 'quest') => ({ role: 'questNpc', distance, id });
const amb = (distance, id = 'amb') => ({ role: 'ambientNpc', distance, id });

test('priority table: key station > quest giver > ambient student', () => {
  assert.ok(INTERACT_PRIORITY.keyStation > INTERACT_PRIORITY.questNpc);
  assert.ok(INTERACT_PRIORITY.questNpc > INTERACT_PRIORITY.ambientNpc);
  assert.ok(INTERACT_PRIORITY.ambientNpc > 0);
  assert.ok(INTERACT_TIE_MARGIN > 0 && INTERACT_TIE_MARGIN < 16, 'a "small" margin: well under one tile');
});

test('nothing in range -> null (and a missing list is tolerated)', () => {
  assert.equal(pickInteractable([]), null);
  assert.equal(pickInteractable(undefined), null);
});

test('exact tie: the key station beats an ambient NPC, whatever the listing order', () => {
  assert.equal(pickInteractable([amb(16), ks(16)]).id, 'ks');
  assert.equal(pickInteractable([ks(16), amb(16)]).id, 'ks');
});

test('exact tie: a quest giver beats an ambient NPC; a key station beats a quest giver', () => {
  assert.equal(pickInteractable([amb(10), quest(10)]).id, 'quest');
  assert.equal(pickInteractable([quest(10), ks(10), amb(10)]).id, 'ks');
});

test('near tie: a story object slightly farther than an ambient NPC (within the margin) still wins', () => {
  assert.equal(pickInteractable([amb(14), ks(14 + INTERACT_TIE_MARGIN)]).id, 'ks');
  assert.equal(pickInteractable([amb(14), quest(14 + INTERACT_TIE_MARGIN - 1)]).id, 'quest');
});

test('beyond the margin the nearer interactable wins, story object or not', () => {
  assert.equal(pickInteractable([amb(10), ks(10 + INTERACT_TIE_MARGIN + 0.5)]).id, 'amb');
  assert.equal(pickInteractable([ks(8), amb(20)]).id, 'ks');
});

test('a story object nearer than an ambient NPC wins outright (no regression)', () => {
  assert.equal(pickInteractable([ks(6), amb(12)]).id, 'ks');
  assert.equal(pickInteractable([quest(6), amb(12)]).id, 'quest');
});

test('ambient-only: an ambient NPC is still interactable, and the nearest of several wins', () => {
  assert.equal(pickInteractable([amb(20, 'far')]).id, 'far');
  assert.equal(pickInteractable([amb(20, 'far'), amb(9, 'near')]).id, 'near');
});

test('same priority: the nearer wins, the first listed on an exact tie', () => {
  assert.equal(pickInteractable([quest(12, 'q1'), quest(10, 'q2')]).id, 'q2');
  assert.equal(pickInteractable([ks(10, 'k1'), ks(10, 'k2')]).id, 'k1');
});

test('priority is data: a new kind is one table row, and an unknown kind ranks last', () => {
  const priorities = { ...INTERACT_PRIORITY, talkableStudent: 1.5 };
  const student = { role: 'talkableStudent', distance: 10, id: 'student' };
  assert.equal(pickInteractable([amb(10), student], INTERACT_TIE_MARGIN, priorities).id, 'student');
  assert.equal(pickInteractable([student, quest(10)], INTERACT_TIE_MARGIN, priorities).id, 'quest');
  assert.equal(pickInteractable([{ role: 'mystery', distance: 10, id: 'm' }, amb(10)]).id, 'amb');
});

test('the returned candidate is the same object that was passed in (world.js reads target/def/kind off it)', () => {
  const target = ks(10);
  assert.equal(pickInteractable([amb(10), target]), target);
});
