// FB-0079 (Aakar, the ACM member in the Main Block foyer, a Dr. Evil style tech villain in sky blue) and
// FB-0080 (Mahin, the badminton player at the campus courts). Data in src/ambient.js, art in tools/make-assets.js FRIEND_LOOKS.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const { AMBIENT, MAPS, SCRIPTS, characterSheets, ambientSheetKey, newCampusTalkState, campusTalkLines, CAMPUS_FACTS } = loadGameData();
const plain = (v) => JSON.parse(JSON.stringify(v));
const ALL = Object.entries(AMBIENT).flatMap(([map, list]) => list.map((entry) => ({ map, entry })));
const named = (name) => ALL.filter(({ entry }) => entry.name === name);
const sheetPng = (key) => decodePNG(fs.readFileSync(path.join(ROOT, 'assets', `${key}.png`)));
const px = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]; };

// Is a pixel sky blue (blue clearly the largest channel, light enough)?
const isSky = ([r, g, b, a]) => a > 0 && b > 180 && b > g && g > r + 30;

test('FB-0079: Aakar is the one ACM member in the Main Block foyer, named, with his own sheet and 3 villain lines about ACM', () => {
  const found = named('Aakar');
  assert.equal(found.length, 1);
  const { map, entry } = found[0];
  assert.equal(map, 'main-block-g');
  assert.equal(entry.role, 'acm-member');
  assert.equal(entry.sheet, 'npc-friend-aakar');
  assert.equal(ambientSheetKey(entry), 'npc-friend-aakar');
  assert.equal(entry.lines.length, 3);
  const text = entry.lines.join(' ');
  assert.match(text, /ACM/);
  assert.match(text, /evil|muahaha|domination/i);
  assert.match(text, /code|merge|deprecated/i);
  for (const l of entry.lines) assert.ok(l.length <= 160 && l.replace(/\{name\}/g, 'MMMMMMMMMM').length <= 170);
  assert.doesNotMatch(JSON.stringify(entry).toLowerCase(), /birthday|bday/);
  // the foyer's ACM member patrols row 33 (the owner stood at 18,34 beside him)
  const acm = AMBIENT['main-block-g'].filter((e) => e.role === 'acm-member');
  assert.equal(acm.length, 1);
  assert.ok(entry.waypoints.every((w) => w.y === 33) && entry.waypoints[0].x <= 18 && entry.waypoints[1].x >= 18);
  // his lines first, then the sourced ACM facts (CF41-CF43)
  const state = newCampusTalkState();
  const first = campusTalkLines(entry.role, entry.id, state, entry);
  assert.equal(first.name, 'Aakar');
  assert.deepEqual(plain(first.lines), plain(entry.lines));
  const second = campusTalkLines(entry.role, entry.id, state, entry);
  assert.ok(['CF41', 'CF42', 'CF43'].includes(second.factId), `afterwards an ACM fact, got ${second.factId}`);
  assert.equal(CAMPUS_FACTS.filter((f) => f.role === 'acm-member').length, 3);
});

test('FB-0079: Aakar\'s sheet exists (16x24 frames, 4 rows), is preloaded and in the offline bundle, and his torso is sky blue', () => {
  const key = 'npc-friend-aakar';
  const preload = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  assert.ok(preload.has(key), 'not in the preload list');
  const img = sheetPng(key);
  assert.equal(img.height, 4 * 24);
  assert.equal(img.width % 16, 0);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'npc-ambient-c.png')), 'fallback body');
  const have = new Set(require('../../tools/pack-offline').collectRuntimeAssets().assets.map((a) => a.path));
  assert.ok(have.has(`assets/${key}.png`), 'not in the offline manifest');
  // torso rows 15-19 of the first (facing us) frame: sky blue dominates the body pixels
  let sky = 0; let body = 0;
  for (let y = 15; y <= 19; y++) for (let x = 3; x <= 12; x++) { const p = px(img, x, y); if (p[3]) { body++; if (isSky(p)) sky++; } }
  assert.ok(body > 0 && sky / body > 0.4, `sky blue torso: ${sky}/${body}`);
  // his look is his own
  const sig = (k) => Buffer.from(sheetPng(k).data).toString('base64');
  for (const other of ['npc-friend-najam', 'npc-friend-akshit', 'npc-friend-mevin', 'npc-mustafa']) assert.notEqual(sig(key), sig(other));
  const tool = fs.readFileSync(path.join(ROOT, 'tools', 'make-assets.js'), 'utf8');
  assert.match(tool, /'friend-aakar':/);
});

test('FB-0080: Mahin is the badminton player at the campus courts (one of the two court players), named, with 3 fixed badminton lines', () => {
  const found = named('Mahin');
  assert.equal(found.length, 1);
  const { map, entry } = found[0];
  assert.equal(map, 'campus');
  assert.equal(entry.id, 'campus-amb-court-2');
  assert.equal(entry.role, 'sports-player');
  assert.equal(entry.sheet, 'npc-friend-mahin');
  assert.equal(ambientSheetKey(entry), 'npc-friend-mahin');
  assert.equal(entry.lines.length, 3);
  const text = entry.lines.join(' ');
  assert.match(text, /badminton/i);
  assert.match(text, /shuttlecock|smash/i);
  assert.match(text, /footwork/i);
  assert.match(text, /racket/i);
  for (const l of entry.lines) assert.ok(l.length <= 160);
  assert.doesNotMatch(JSON.stringify(entry).toLowerCase(), /birthday|bday/);
  // only one of the two court players is named (the other, court-1, is Mitul)
  const courts = AMBIENT.campus.filter((e) => /^campus-amb-court-[12]$/.test(e.id));
  assert.deepEqual(plain(courts.map((e) => e.name)), ['Mitul', 'Mahin']);
  // lines first, then the sports-player facts
  const state = newCampusTalkState();
  assert.deepEqual(plain(campusTalkLines(entry.role, entry.id, state, entry).lines), plain(entry.lines));
  const second = campusTalkLines(entry.role, entry.id, state, entry);
  assert.ok(['CF13', 'CF14', 'CF15'].includes(second.factId), `afterwards a sports fact, got ${second.factId}`);
  // the owner's screenshot was taken in main-block-g beside a CS student: no sports player lives there
  assert.equal(AMBIENT['main-block-g'].filter((e) => e.role === 'sports-player').length, 0);
});

test('FB-0080: Mahin\'s sheet exists, is preloaded and in the offline bundle, with a red jersey and a white sweatband', () => {
  const key = 'npc-friend-mahin';
  const preload = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  assert.ok(preload.has(key));
  const img = sheetPng(key);
  assert.equal(img.height, 4 * 24);
  assert.equal(img.width % 16, 0);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'npc-ambient-d.png')), 'fallback body');
  const have = new Set(require('../../tools/pack-offline').collectRuntimeAssets().assets.map((a) => a.path));
  assert.ok(have.has(`assets/${key}.png`));
  // jersey: red dominates the torso; sweatband: a white row across the head (row 7, facing us)
  let red = 0; let body = 0;
  for (let y = 15; y <= 19; y++) for (let x = 3; x <= 12; x++) { const p = px(img, x, y); if (p[3]) { body++; if (p[0] > 180 && p[1] < 150 && p[2] < 150) red++; } }
  assert.ok(red / body > 0.4, `red jersey: ${red}/${body}`);
  for (let x = 2; x <= 13; x++) assert.deepEqual(px(img, x, 7).slice(0, 3), [255, 255, 255], `sweatband pixel ${x}`);
  const tool = fs.readFileSync(path.join(ROOT, 'tools', 'make-assets.js'), 'utf8');
  assert.match(tool, /'friend-mahin':[^\n]*prop: MAHIN_SWEATBAND/);
});

test('FB-0079/FB-0080: the review doc lists Aakar and Mahin', () => {
  const review = fs.readFileSync(path.join(ROOT, 'docs', 'research', 'campus-lines-review.md'), 'utf8');
  assert.match(review, /\| Aakar/);
  assert.match(review, /\| Mahin/);
});
