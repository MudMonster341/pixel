// The birthday card's content (src/card.js, docs/STORY.md "the ending"): buildCardConfig() is the
// only thing standing between the owner's hand-edited assets/card/card.json (or nothing at all, on a
// fresh checkout -- that file is gitignored, see .gitignore) and a playable card. These tests are
// what make "a half-written card.json can't break the ending" a checked fact, not a hope.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

test('buildCardConfig(null): no card.json at all falls back to placeholder messages addressed to Taru', () => {
  const { buildCardConfig, DEFAULT_CARD_MESSAGES } = loadGameData();
  const config = buildCardConfig(null);
  assert.equal(config.recipient, 'Taru');
  assert.equal(config.messages.length, DEFAULT_CARD_MESSAGES.length);
  assert.equal(config.messages[0], 'Happy Birthday, Taru!'); // {name} templated
  assert.deepEqual(plain(config.photos), []);
});

test('decisions/0019: the card recipient is never the typed player name (a stray 2nd argument is ignored)', () => {
  const { buildCardConfig } = loadGameData();
  assert.equal(buildCardConfig(null, 'Zara').recipient, 'Taru');
  assert.equal(buildCardConfig({}, 'Zara').messages[0], 'Happy Birthday, Taru!');
  assert.equal(buildCardConfig({ recipient: '   ' }).recipient, 'Taru'); // a blank recipient falls back too
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
  const config = buildCardConfig(raw);
  assert.equal(config.recipient, 'Amina'); // an explicit recipient wins over the default
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
    assert.equal(config.recipient, 'Taru');
    assert.deepEqual(plain(config.photos), []);
  }
});

test('renderCardText: replaces every {name} occurrence', () => {
  const { renderCardText } = loadGameData();
  assert.equal(renderCardText('Hi {name}, bye {name}!', 'Sam'), 'Hi Sam, bye Sam!');
  assert.equal(renderCardText('No placeholder here', 'Sam'), 'No placeholder here');
});

// buildCardSlides(): the pure decision of *which* slides to show. There is no placeholder or temporary slideshow any more (owner, 2026-10-07):
// with no usable photo it is [] and the scene shows the cake instead. The on-screen images and the "a photo whose file failed to load is
// dropped" texture check are src/scenes/card.js's own job (needs a real Phaser/texture cache): pinned below by reading the scene source,
// and run for real by tests/e2e/ending.spec.js.
test('no-photo card: buildCardSlides: no real photos at all means NO slides (no placeholder, no temporary slideshow)', () => {
  const { buildCardSlides, TEMP_CARD_SLIDES } = loadGameData();
  const resolvePhotoKey = () => { throw new Error('should not be called with an empty photo list'); };
  assert.deepEqual(plain(buildCardSlides([], resolvePhotoKey)), []);
  assert.deepEqual(plain(buildCardSlides(undefined, resolvePhotoKey)), []);
  assert.deepEqual(plain(buildCardSlides(null, resolvePhotoKey)), []);
  assert.equal(TEMP_CARD_SLIDES, undefined, 'the temporary slideshow is gone');
});

test('no-photo card: a fresh checkout (no card.json) has zero slides from the real config path too', () => {
  const game = loadGameData();
  const { buildCardConfig, buildCardSlides } = game;
  const cardSlidePhotos = game.evaluate('cardSlidePhotos');
  const photos = cardSlidePhotos(buildCardConfig(null), { physicsLab: true, icl: true, room195: true });
  assert.deepEqual(plain(buildCardSlides(photos, (i) => `card-photo-${i}`)), []);
});

test('no-photo card: the card scene draws no placeholder or temporary art, and shows the cake + glow only when there are no usable photos', () => {
  const fs = require('fs');
  const path = require('path');
  const { ROOT } = require('../helpers/game-data');
  const scene = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'card.js'), 'utf8');
  const code = scene.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /card-temp|card-placeholder-photo|TEMP_CARD_SLIDES/);
  // a photo whose file failed to load is dropped, never swapped for a stand-in
  assert.match(code, /filter\(\(\{ i \}\) => !isMissing\(i\)\)/);
  assert.match(code, /\(n\) => `card-photo-\$\{usable\[n\]\.i\}`/);
  // buildInterior: frame + corner cake only with photos; centre cake + glow otherwise
  assert.match(code, /this\.hasPhotos = this\.slides\.length > 0;\s*if \(this\.hasPhotos\) \{\s*this\.buildFrame\(\);\s*this\.buildCake\(CAKE_SPOT, CAKE_SCALE, \{ w: 4, h: 5 \}\);\s*\} else \{\s*this\.buildCakeGlow\(\);\s*this\.buildCake\(CAKE_CENTER, CAKE_BIG_SCALE,/);
  assert.match(code, /const CAKE_BIG_SCALE = 5;/);
  assert.match(code, /const CAKE_CENTER = \{ x: CARD_CENTER_X, y: 232 \};/);
  // the cake is centred in the frame's old area (y 100..350) and fits it at the integer scale (56x40 art)
  assert.ok(232 - (40 * 5) / 2 >= 100 && 232 + (40 * 5) / 2 <= 350);
  // the scene fields the e2e / qa hooks read stay defined without a photo frame
  assert.match(code, /this\.slides = \[\];/);
  assert.match(code, /this\.frameParts = \[\];/);
  // interiorParts stays complete (the closing-video hide logic walks it) even when glow/frame parts are absent
  assert.match(code, /this\.interiorParts = \[this\.panel, this\.titleGlow, this\.cakeGlow, this\.title, this\.cakeParts, this\.frameParts, this\.heartParts, this\.messagePanel\]\.flat\(\)\.filter\(Boolean\)/);
});

test('no-photo card: the scene still loads the cover, frame (real-photo mode), cake and heart art', () => {
  const fs = require('fs');
  const path = require('path');
  const { ROOT } = require('../helpers/game-data');
  const scene = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'card.js'), 'utf8');
  for (const key of ['card-cover', 'card-frame', 'card-cake', 'card-heart']) assert.ok(scene.includes(`'${key}'`), `${key} is still loaded`);
});

test('no-photo card: the default card messages are the new plain lines, short enough for the card box, no em dashes or stock phrases', () => {
  const { DEFAULT_CARD_MESSAGES, buildCardConfig } = loadGameData();
  assert.deepEqual(plain(DEFAULT_CARD_MESSAGES), [
    'Happy Birthday, {name}!',
    'You found all three keys.',
    'I hope today feels as warm as a sunset.',
    'I hope someone makes you laugh until your cheeks hurt.',
    'Eat the cake. Take the long way home. Do what you like.',
    'Twenty-two looks good on you.',
    'I made this for you. I hope it made you smile.',
  ]);
  for (const line of DEFAULT_CARD_MESSAGES) {
    assert.ok(line.length <= 60, `too long for about two lines in the card's box: ${line}`);
    assert.doesNotMatch(line, /—|--|journey|adventure|tapestry/i);
  }
  const config = buildCardConfig(null);
  assert.equal(config.messages[0], 'Happy Birthday, Taru!');
  assert.ok(config.messages.every((line) => !line.includes('{name}')));
});

test('buildCardSlides: real photos produce one slide each, whenever any exist at all', () => {
  const { buildCardSlides } = loadGameData();
  const photos = [
    { file: '1.jpg', caption: 'The first day' },
    { file: '2.jpg', caption: 'A little later' },
  ];
  const slides = buildCardSlides(photos, (i) => `card-photo-${i}`);
  assert.deepEqual(plain(slides), [
    { key: 'card-photo-0', caption: 'The first day' },
    { key: 'card-photo-1', caption: 'A little later' },
  ]);
});

test('buildCardSlides: a single real photo is a one-slide slideshow', () => {
  const { buildCardSlides } = loadGameData();
  const photos = [{ file: 'only.jpg', caption: 'Just one' }];
  const slides = buildCardSlides(photos, () => 'card-photo-0');
  assert.deepEqual(plain(slides), [{ key: 'card-photo-0', caption: 'Just one' }]);
});

// The card's message box typed nothing in the whole game until 2026-10-04: DialogBox only types and bobs its arrow
// from DialogBox.update(time, delta), and the card scene (unlike the cutscene scene) never called it, so the box
// stayed blank while reporting "typing". Any scene that owns a DialogBox must drive it.
test('every scene that builds its own DialogBox calls dialog.update from its own update()', () => {
  const fs = require('fs');
  const path = require('path');
  const dir = path.join(__dirname, '..', '..', 'src', 'scenes');
  const owners = fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'ui.js')
    .filter((f) => /new DialogBox\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  assert.ok(owners.includes('card.js') && owners.includes('cutscene.js'), `expected card.js and cutscene.js to own a DialogBox, saw ${owners}`);
  for (const file of owners) {
    const src = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.match(src, /^\s*update\(time, delta\) \{[\s\S]*?this\.dialog\.update\(time, delta\)/m, `${file} builds a DialogBox but never calls this.dialog.update(time, delta) from update()`);
  }
});

// W3 (the finale): the card is unchanged by it. It still opens from the same dark colour with its own fade-in, which is what the finale's
// fade-to-black hands over to, and it never depends on the finale having run ("Watch the Card Again" starts the card directly).
test('W3: the card still starts from black on its own (the finale fades to black into it), and does not need the finale', () => {
  const fs = require('fs');
  const path = require('path');
  const { ROOT } = require('../helpers/game-data');
  const source = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'card.js'), 'utf8');
  assert.match(source, /beginSequence\(\) \{\s*this\.cameras\.main\.setBackgroundColor\('#1a1610'\);\s*this\.cameras\.main\.fadeIn\(250, 0, 0, 0\);/);
  assert.match(fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'finale.js'), 'utf8'), /this\.cameras\.main\.fadeOut\(FINALE\.leaveFadeMs, 0, 0, 0\)/);
  assert.match(source, /this\.scene\.start\('credits', \{ raw \}\)/, 'the card still hands off to the credits');
  assert.doesNotMatch(source.replace(/\/\/.*$/gm, ''), /finale/i, 'no code in the card refers to the finale');
});
