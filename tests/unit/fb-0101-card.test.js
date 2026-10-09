// FB-0101: the owner's own final message on the card, the matching credits wishes, and the colourful party behind the card.
// The scene needs a browser (e2e/ending.spec.js plays it); here the words are pinned as data and the scene by reading its source,
// the way tests/unit/card.test.js already does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const scene = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'card.js'), 'utf8');
const code = scene.replace(/\/\/.*$/gm, '');

test('FB-0101: the seven card messages keep the owner\'s key phrases and fit the card box', () => {
  const { DEFAULT_CARD_MESSAGES } = loadGameData();
  assert.equal(DEFAULT_CARD_MESSAGES.length, 7);
  const all = DEFAULT_CARD_MESSAGES.join(' ');
  for (const phrase of ['pookie', '3 years', '4th birthday', 'cutest', 'sweetest', 'laugh', 'dreams come true', 'blessed and lovely']) {
    assert.ok(all.includes(phrase), `missing "${phrase}"`);
  }
  for (const line of DEFAULT_CARD_MESSAGES) assert.ok(line.length <= 75, `too long (${line.length}): ${line}`);
  assert.match(DEFAULT_CARD_MESSAGES[0], /pookie/);
  assert.match(DEFAULT_CARD_MESSAGES[6], /Happy birthday, pookie/);
});

test('FB-0101: the credits wishes echo the card without repeating its lines, and end on the sign-off', () => {
  const { DEFAULT_CREDITS, DEFAULT_CARD_MESSAGES, buildCreditsConfig } = loadGameData();
  assert.equal(DEFAULT_CREDITS.wishes.length, 8);
  for (const wish of DEFAULT_CREDITS.wishes) {
    assert.ok(wish.length < 70, `wish too long (${wish.length}): ${wish}`);
    assert.doesNotMatch(wish, /—|--|journey|adventure/i);
    assert.ok(!DEFAULT_CARD_MESSAGES.includes(wish), `repeats a card line: ${wish}`);
  }
  assert.ok(DEFAULT_CREDITS.wishes[7].includes('{name}'));
  assert.equal(buildCreditsConfig(null).wishes[7], 'Happy birthday, Taru. I love you.');
  const all = DEFAULT_CREDITS.wishes.join(' ');
  for (const phrase of ['game', 'fourth birthday', 'cutest', 'sweetest', 'laugh', 'dreams', 'blessed']) assert.ok(all.includes(phrase), `missing "${phrase}"`);
});

test('FB-0101: the card is narrower (720 wide, centred) and everything inside still fits', () => {
  assert.match(code, /const CARD_X = 120;/);
  assert.match(code, /const CARD_W = 720;/);
  assert.match(code, /const MESSAGE_BOX = \{ x: CARD_CENTER_X - 300, y: 368, w: 600, h: 104 \};/);
  // the message box (600 wide) keeps a 60 px margin inside the 720 px card; the cover is still scaled from CARD_W/CARD_H
  assert.ok(600 + 2 * 60 <= 720);
  assert.match(code, /Math\.max\(CARD_W \/ 400, CARD_H \/ 260\)/);
});

test('FB-0101: the card scene builds a dusk sky, string lights and ground behind the card, below its depth', () => {
  assert.match(code, /buildInterior\(\) \{\s*this\.buildBackdrop\(\);/);
  assert.match(code, /const SKY_STOPS = /);
  assert.match(code, /function skyColorAt\(t\)/);
  assert.match(code, /sky\.fillStyle\(skyColorAt\(/);
  assert.match(code, /BULB_COUNT/);
  assert.match(code, /GROUND_TOP/);
  // every backdrop depth is below the card panel's depth 1 (the dark veil too); confetti stays at 90
  const backdrop = code.slice(code.indexOf('buildBackdrop() {'), code.indexOf('fireCannon() {'));
  for (const m of backdrop.matchAll(/setDepth\(([^)]+)\)/g)) {
    const depth = m[1] === 'BACKDROP_VEIL_DEPTH' ? 0.95 : Number(m[1].replace(/ - 0\.05$/, ''));
    assert.ok(Number.isNaN(depth) || depth < 1, `backdrop depth ${m[1]} is not below the card`);
  }
  assert.match(code, /const BACKDROP_VEIL_DEPTH = 0\.95;/);
  assert.match(code, /setDepth\(90\)/);
});

test('FB-0101: the cast uses existing character sheets, guards every load, and skips what failed to load', () => {
  for (const key of ['npc-mustafa', 'npc-friend-sid', 'npc-friend-akshit', 'npc-friend-satvik']) {
    assert.ok(scene.includes(key), `${key} is in the cast`);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', `${key}.png`)), `assets/${key}.png exists`);
  }
  assert.match(code, /if \(!this\.textures\.exists\(key\)\) this\.load\.spritesheet\(key, file, sheet\);/);
  assert.match(code, /GameState\.customization\.clothes/);
  assert.match(code, /this\.textures\.exists\('player'\) \? 'player' : `card-taru-\$\{clothes\}`/);
  assert.match(code, /if \(!member\.key \|\| !this\.textures\.exists\(member\.key\)\) return;/);
  assert.match(code, /const CAST_SCALE = 3;/);
  assert.match(code, /this\.tweens\.add\(\{ targets: sprite, y: member\.y - member\.hop/); // they bob on the spot
});

test('FB-0101: balloons are drawn once as textures and recycled; a confetti cannon fires on a looping timer', () => {
  assert.match(code, /g\.generateTexture\(key, 16, 40\)/);
  assert.match(code, /const BALLOON_COUNT = 10;/);
  assert.match(code, /onComplete: \(\) => this\.launchBalloon\(balloon,/); // recycled, not re-created
  assert.match(code, /this\.cannonTimer = this\.time\.addEvent\(\{ delay: CANNON_EVERY_MS, loop: true/);
  assert.match(code, /this\.addTimer\(this\.cannonTimer\);/); // so skipToEnd() -> killTimers() stops it
  assert.match(code, /fireCannon\(\) \{\s*if \(this\.ended\) return;/);
  assert.match(code, /killTimers\(\) \{[\s\S]*this\.tweens\.killAll\(\);/);
});

test('FB-0101: the backdrop is in interiorParts (hidden with the closing video), veiled until the cover opens, and the cannon stops for the video', () => {
  assert.match(code, /this\.interiorParts = \[this\.backdropParts, /);
  assert.match(code, /this\.veil = this\.add\.rectangle\(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a1610\)/);
  assert.match(code, /runInterior\(\) \{[\s\S]*?if \(this\.veil\)/);
  assert.match(code, /if \(this\.cannonTimer\) this\.cannonTimer\.remove\(\);/);
  // the photo / no-photo split is untouched
  assert.match(code, /this\.hasPhotos = this\.slides\.length > 0;\s*if \(this\.hasPhotos\) \{\s*this\.buildFrame\(\);/);
});

test('FB-0101: the backdrop keeps the live object count modest', () => {
  const nums = (name) => Number((code.match(new RegExp(`const ${name} = (\\d+);`)) || [])[1]);
  const count = (name) => (code.match(new RegExp(`const ${name} = \\[(.*)\\];`))[1].match(/\[/g) || []).length; // the [x, y] pairs
  const stars = count('STAR_SPOTS');
  const sparkles = count('SPARKLE_SPOTS');
  // sky + ground + wire + veil + 3 clouds, two objects per bulb, cast (shadow + sprite) x5, balloons, stars, sparkles
  const total = 4 + 3 + 2 * nums('BULB_COUNT') + 10 + nums('BALLOON_COUNT') + stars + sparkles;
  assert.ok(total < 90, `backdrop persistent objects: ${total}`);
});
