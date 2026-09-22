// The birthday card's content (src/card.js, docs/STORY.md "the ending"): buildCardConfig() is the
// only thing standing between the owner's hand-edited assets/card/card.json (or nothing at all, on a
// fresh checkout -- that file is gitignored, see .gitignore) and a playable card. These tests are
// what make "a half-written card.json can't break the ending" a checked fact, not a hope.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

test('buildCardConfig(null, name): no card.json at all falls back to placeholder messages and the player name', () => {
  const { buildCardConfig, DEFAULT_CARD_MESSAGES } = loadGameData();
  const config = buildCardConfig(null, 'Zara');
  assert.equal(config.recipient, 'Zara');
  assert.equal(config.messages.length, DEFAULT_CARD_MESSAGES.length);
  assert.equal(config.messages[0], 'Happy Birthday, Zara!'); // {name} templated
  assert.deepEqual(plain(config.photos), []);
});

test('buildCardConfig(null, name): falls back to a generic word if even the player name is missing', () => {
  const { buildCardConfig } = loadGameData();
  const config = buildCardConfig(null, '');
  assert.equal(config.recipient, 'you');
  assert.ok(config.messages[0].includes('you'));
});

test('buildCardConfig: a valid card.json is used as-is, with {name} templated to the configured recipient', () => {
  const { buildCardConfig } = loadGameData();
  const raw = {
    recipient: 'Amina',
    messages: ['Happy Birthday, {name}!', 'From everyone at LUG.'],
    photos: [
      { file: '1.jpg', caption: 'The first day' },
      { file: '2.png', caption: '' },
    ],
  };
  const config = buildCardConfig(raw, 'FallbackName');
  assert.equal(config.recipient, 'Amina'); // explicit recipient wins over the player's typed name
  assert.deepEqual(plain(config.messages), ['Happy Birthday, Amina!', 'From everyone at LUG.']);
  assert.deepEqual(plain(config.photos), [
    { file: '1.jpg', caption: 'The first day' },
    { file: '2.png', caption: '' },
  ]);
});

test('buildCardConfig: an empty/missing photos list is tolerated (the slideshow just has nothing real to show yet)', () => {
  const { buildCardConfig } = loadGameData();
  assert.deepEqual(plain(buildCardConfig({ recipient: 'A' }, 'A').photos), []);
  assert.deepEqual(plain(buildCardConfig({ recipient: 'A', photos: [] }, 'A').photos), []);
  assert.deepEqual(plain(buildCardConfig({ recipient: 'A', photos: 'not-an-array' }, 'A').photos), []);
});

test('buildCardConfig: malformed photo entries are dropped, not the whole list', () => {
  const { buildCardConfig } = loadGameData();
  const config = buildCardConfig({
    photos: [
      { file: 'good.jpg', caption: 'Fine' },
      { caption: 'Missing a file name' },
      null,
      'just a string',
      42,
      { file: '   ', caption: 'Blank file name' },
      { file: 'also-good.jpg' }, // caption is optional
    ],
  }, 'Name');
  assert.deepEqual(plain(config.photos), [
    { file: 'good.jpg', caption: 'Fine' },
    { file: 'also-good.jpg', caption: '' },
  ]);
});

test('buildCardConfig: an empty/whitespace-only messages list falls back to the placeholder messages', () => {
  const { buildCardConfig, DEFAULT_CARD_MESSAGES } = loadGameData();
  assert.equal(buildCardConfig({ messages: [] }, 'N').messages.length, DEFAULT_CARD_MESSAGES.length);
  assert.equal(buildCardConfig({ messages: ['', '   ', 42, null] }, 'N').messages.length, DEFAULT_CARD_MESSAGES.length);
});

test('buildCardConfig: garbage top-level input (a string, a number, an array) never throws', () => {
  const { buildCardConfig } = loadGameData();
  for (const garbage of ['nonsense', 42, [], true, undefined]) {
    assert.doesNotThrow(() => buildCardConfig(garbage, 'Name'));
    const config = buildCardConfig(garbage, 'Name');
    assert.equal(config.recipient, 'Name');
    assert.deepEqual(plain(config.photos), []);
  }
});

test('renderCardText: replaces every {name} occurrence', () => {
  const { renderCardText } = loadGameData();
  assert.equal(renderCardText('Hi {name}, bye {name}!', 'Sam'), 'Hi Sam, bye Sam!');
  assert.equal(renderCardText('No placeholder here', 'Sam'), 'No placeholder here');
});
