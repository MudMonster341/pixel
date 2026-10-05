// The credits phase after the birthday card (src/credits.js, src/scenes/credits.js,
// decisions/0019-credits-ending-and-recipient.md): the data and the schedule are pure and tested
// here; the scene itself needs a browser and is covered by tests/e2e/credits.spec.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

// ---------- DEFAULT_CREDITS ----------

test('DEFAULT_CREDITS: recipient Taru, age 22, eight short generic wishes, made by Mustafa', () => {
  const { DEFAULT_CREDITS } = loadGameData();
  assert.equal(DEFAULT_CREDITS.recipient, 'Taru');
  assert.equal(DEFAULT_CREDITS.age, 22);
  assert.equal(DEFAULT_CREDITS.madeBy, 'Mustafa');
  assert.equal(DEFAULT_CREDITS.wishes.length, 8);
  for (const wish of DEFAULT_CREDITS.wishes) {
    assert.equal(typeof wish, 'string');
    assert.ok(wish.trim().length > 0, 'a wish is empty');
    assert.ok(wish.length <= 70, `wish too long (${wish.length}): ${wish}`);
  }
  assert.equal(new Set(DEFAULT_CREDITS.wishes).size, 8, 'wishes should be distinct');
});

// ---------- buildCreditsConfig: the merge with card.json ----------

test('buildCreditsConfig(null/garbage): everything falls back to the defaults, {name} resolved to Taru', () => {
  const { buildCreditsConfig, DEFAULT_CREDITS } = loadGameData();
  for (const raw of [null, undefined, 'nonsense', 42, [], true, {}]) {
    const config = buildCreditsConfig(raw);
    assert.equal(config.recipient, 'Taru');
    assert.equal(config.age, 22);
    assert.equal(config.madeBy, 'Mustafa');
    assert.equal(config.wishes.length, DEFAULT_CREDITS.wishes.length);
    for (const wish of config.wishes) assert.ok(!wish.includes('{name}'), `unresolved {name}: ${wish}`);
  }
});

test('buildCreditsConfig: a partial card.json overrides only what it names', () => {
  const { buildCreditsConfig, DEFAULT_CREDITS } = loadGameData();
  const onlyAge = buildCreditsConfig({ age: 23, messages: ['x'], photos: [] });
  assert.equal(onlyAge.age, 23);
  assert.equal(onlyAge.recipient, 'Taru');
  assert.deepEqual(plain(onlyAge.wishes), plain(buildCreditsConfig(null).wishes));

  const onlyRecipient = buildCreditsConfig({ recipient: '  Amina ' });
  assert.equal(onlyRecipient.recipient, 'Amina'); // trimmed
  assert.equal(onlyRecipient.age, DEFAULT_CREDITS.age);

  const onlyWishes = buildCreditsConfig({ wishes: ['One.', 'Two.'] });
  assert.deepEqual(plain(onlyWishes.wishes), ['One.', 'Two.']);
  assert.equal(onlyWishes.recipient, 'Taru');
});

test('buildCreditsConfig: wrong types fall back to the defaults field by field', () => {
  const { buildCreditsConfig, DEFAULT_CREDITS } = loadGameData();
  const config = buildCreditsConfig({ recipient: 7, age: '22', wishes: 'not an array' });
  assert.equal(config.recipient, 'Taru');
  assert.equal(config.age, 22);
  assert.equal(config.wishes.length, DEFAULT_CREDITS.wishes.length);

  for (const age of [0, -3, 22.5, NaN, Infinity, 500, null, {}]) {
    assert.equal(buildCreditsConfig({ age }).age, 22, `age ${String(age)} should fall back`);
  }
  assert.equal(buildCreditsConfig({ recipient: '   ' }).recipient, 'Taru');

  // An array of junk is no wishes at all -> defaults; junk mixed with real wishes just drops the junk.
  assert.equal(buildCreditsConfig({ wishes: [] }).wishes.length, 8);
  assert.equal(buildCreditsConfig({ wishes: ['', '   ', 42, null, {}] }).wishes.length, 8);
  assert.deepEqual(plain(buildCreditsConfig({ wishes: ['Real.', 42, '  ', ' Also real. '] }).wishes), ['Real.', 'Also real.']);
});

test('buildCreditsConfig: {name} in a wish becomes the recipient (the card.json one if given)', () => {
  const { buildCreditsConfig } = loadGameData();
  const config = buildCreditsConfig({ recipient: 'Amina', wishes: ['Happy day, {name}!', '{name} and {name}.', 'No token.'] });
  assert.deepEqual(plain(config.wishes), ['Happy day, Amina!', 'Amina and Amina.', 'No token.']);
  const defaulted = buildCreditsConfig({ wishes: ['For {name}.'] });
  assert.deepEqual(plain(defaulted.wishes), ['For Taru.']);
});

test('buildCreditsConfig: does not mutate DEFAULT_CREDITS', () => {
  const { buildCreditsConfig, DEFAULT_CREDITS } = loadGameData();
  const before = plain(DEFAULT_CREDITS);
  buildCreditsConfig({ recipient: 'Amina', wishes: ['x'] });
  buildCreditsConfig(null).wishes.push('extra');
  assert.deepEqual(plain(DEFAULT_CREDITS), before);
});

// ---------- creditsTimeline ----------

test('creditsTimeline(8): monotonic, in order, wishes back to back, total within 30-45 s', () => {
  const { creditsTimeline } = loadGameData();
  const t = creditsTimeline(8);
  assert.equal(t.wishes.length, 8);
  // Phase order: fade in, title, age (inside the title window), wishes, THE END, made-by (inside THE END).
  assert.equal(t.fadeIn.start, 0);
  assert.ok(t.title.start >= t.fadeIn.start && t.title.start <= t.fadeIn.end);
  assert.ok(t.age.start > t.title.start && t.age.start < t.title.end, 'age line joins the title partway through');
  assert.equal(t.age.end, t.title.end);
  assert.equal(t.wishes[0].start, t.title.end, 'the first wish starts as the title leaves');
  for (let i = 0; i < t.wishes.length; i++) {
    assert.ok(t.wishes[i].end > t.wishes[i].start);
    if (i > 0) assert.equal(t.wishes[i].start, t.wishes[i - 1].end, 'wishes are back to back, one at a time');
  }
  assert.equal(t.theEnd.start, t.wishes[7].end);
  assert.ok(t.madeBy.start > t.theEnd.start && t.madeBy.start < t.theEnd.end);
  assert.equal(t.total, t.theEnd.end);
  assert.ok(t.total >= 30000 && t.total <= 45000, `total ${t.total} ms outside 30-45 s`);
  // The wishes phase itself is about 30-35 s (decisions/0019: ~3 s per wish plus the cross-fade).
  const wishesPhase = t.wishesEnd - t.wishesStart;
  assert.ok(wishesPhase >= 28000 && wishesPhase <= 35000, `wishes phase ${wishesPhase} ms`);
  // Each wish is on screen about 3 s (fade in + hold), within the slot.
  for (const w of t.wishes) assert.ok(w.end - w.start >= 3000 && w.end - w.start <= 4500);

  // Every start/end, flattened in schedule order, never goes backwards.
  const starts = [t.fadeIn.start, t.title.start, t.age.start, t.wishes[0].start, t.theEnd.start, t.madeBy.start, t.total];
  for (let i = 1; i < starts.length; i++) assert.ok(starts[i] >= starts[i - 1], `phase ${i} starts before phase ${i - 1}`);
});

test('creditsTimeline: scales with the number of wishes, and survives 0 and nonsense', () => {
  const { creditsTimeline, CREDITS_DEFAULT_TIMING } = loadGameData();
  const t4 = creditsTimeline(4);
  const t8 = creditsTimeline(8);
  const t12 = creditsTimeline(12);
  assert.equal(t4.wishes.length, 4);
  assert.equal(t12.wishes.length, 12);
  assert.equal(t8.total - t4.total, 4 * CREDITS_DEFAULT_TIMING.wishMs);
  assert.equal(t12.total - t8.total, 4 * CREDITS_DEFAULT_TIMING.wishMs);

  for (const bad of [0, -2, NaN, undefined, null, 'x']) {
    const t = creditsTimeline(bad);
    assert.equal(t.wishes.length, 0);
    assert.equal(t.theEnd.start, t.wishesStart);
    assert.ok(t.total > t.theEnd.start);
  }
  assert.equal(creditsTimeline(2.9).wishes.length, 2); // whole wishes only
});

test('creditsTimeline: options override the pacing without losing the structure', () => {
  const { creditsTimeline } = loadGameData();
  const t = creditsTimeline(3, { wishMs: 1000, titleMs: 2000, endMs: 1000 });
  assert.equal(t.wishes[0].end - t.wishes[0].start, 1000);
  assert.equal(t.title.end - t.title.start, 2000);
  assert.equal(t.theEnd.end - t.theEnd.start, 1000);
  assert.equal(t.total, t.fadeIn.end + 2000 + 3 * 1000 + 1000);
});

// ---------- the name field starts as Taru ----------

test('the name entry prefill: a fresh game and a reset both start with the player name "Taru"', () => {
  const { GameState, DEFAULT_PLAYER_NAME, resetGameState } = loadGameData();
  assert.equal(DEFAULT_PLAYER_NAME, 'Taru');
  assert.equal(GameState.playerName, 'Taru');
  GameState.playerName = 'ZARA';
  resetGameState(GameState);
  assert.equal(GameState.playerName, 'Taru'); // what src/scenes/intro-name.js shows prefilled
});

test('the name entry keeps its validation: letters and spaces, up to 10, replace-on-first-key, Enter accepts', () => {
  const source = read('src', 'scenes', 'intro-name.js');
  assert.match(source, /const NAME_MAX = 10;/);
  assert.match(source, /this\.name = \(GameState\.playerName \|\| DEFAULT_PLAYER_NAME\)\.toUpperCase\(\);/, 'the field is prefilled from the player name');
  assert.match(source, /if \(!this\.touched\) \{ this\.name = ''; this\.touched = true; \}/, 'typing replaces the prefill cleanly');
  assert.match(source, /\/\[a-zA-Z\]\//, 'letters only');
  assert.match(source, /trimmed\.length \? trimmed : GameState\.playerName/, 'an empty field keeps the default instead of saving a blank');
});

test('the typed player name does not leak into the card or the credits', () => {
  const { GameState, buildCardConfig, buildCreditsConfig } = loadGameData();
  GameState.playerName = 'ZARA';
  assert.equal(buildCardConfig(null).recipient, 'Taru');
  assert.equal(buildCreditsConfig(null).recipient, 'Taru');
});

// ---------- scene registration and the chain box -> card -> credits -> title ----------

test('CreditsScene is registered: script tags in order, scene list, scene key', () => {
  const html = read('index.html');
  const main = read('src', 'main.js');
  const dataTag = html.indexOf('<script src="src/credits.js"></script>');
  const cardTag = html.indexOf('<script src="src/card.js"></script>');
  const sceneTag = html.indexOf('<script src="src/scenes/credits.js"></script>');
  const cardSceneTag = html.indexOf('<script src="src/scenes/card.js"></script>');
  assert.ok(dataTag > cardTag && cardTag >= 0, 'src/credits.js must load after src/card.js (it reuses DEFAULT_RECIPIENT)');
  assert.ok(sceneTag > cardSceneTag && cardSceneTag >= 0, 'the credits scene loads after the card scene');
  assert.ok(sceneTag > dataTag, 'the scene loads after its data');
  assert.match(main, /BoxOpeningScene, FinaleScene, CardScene, CreditsScene/, 'CreditsScene must be in the game config scene list');
  assert.match(read('src', 'scenes', 'credits.js'), /class CreditsScene extends Phaser\.Scene[\s\S]*?super\('credits'\)/);
});

test('the ending chain: box-opening -> finale -> card -> credits -> title, and "Watch the Card Again" enters at the card', () => {
  assert.match(read('src', 'scenes', 'box-opening.js'), /this\.scene\.start\('finale'\)/);
  assert.match(read('src', 'scenes', 'finale.js'), /this\.scene\.start\('card'\)/, 'the finale hands off to the card');
  assert.match(read('src', 'scenes', 'card.js'), /this\.scene\.start\('credits'/, 'the card hands off to the credits');
  assert.doesNotMatch(read('src', 'scenes', 'card.js'), /this\.scene\.start\('title'\)/, 'the card no longer returns to the title itself');
  assert.match(read('src', 'scenes', 'credits.js'), /this\.scene\.start\('title'\)/, 'the credits return to the title');
  assert.match(read('src', 'scenes', 'title.js'), /this\.scene\.start\('card'\)/, 'Watch the Card Again plays the card, then (via it) the credits');
});

test('the credits scene cannot soft-lock: skip keys, a grace period, and an automatic return to the title', () => {
  const source = read('src', 'scenes', 'credits.js');
  for (const key of ['ESC', 'SPACE', 'ENTER']) assert.ok(source.includes(`'${key}'`), `no ${key} skip key`);
  assert.match(source, /this\.at\(t\.total, \(\) => this\.returnToTitle\(\)\)/, 'the natural schedule ends by returning to the title');
  assert.match(source, /CREDITS_SKIP_END_HOLD_MS/, 'a skip lands on a timed return too');
  assert.match(source, /this\.time\.delayedCall\(900, go\)/, 'failsafe if the camera fade event never fires');
});

test('card.example.json shows the recipient, age and wishes fields', () => {
  const example = JSON.parse(read('assets', 'card', 'card.example.json'));
  assert.equal(typeof example.recipient, 'string');
  assert.equal(typeof example.age, 'number');
  assert.ok(Array.isArray(example.wishes) && example.wishes.length >= 1);
  assert.ok(Array.isArray(example.messages));
});
