// FB-0083..FB-0098: the owner's play-test pass over who the NPCs are and what they say. Pure content in src/ambient.js
// (name = the name tag, lines = said the first time), plus Mustafa's opening (src/scenes/intro-greeting.js, src/scripts.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { AMBIENT, SCRIPTS, campusTalkLines, newCampusTalkState } = loadGameData();

const entry = (mapKey, id) => {
  const found = AMBIENT[mapKey].find((e) => e.id === id);
  assert.ok(found, `${mapKey}/${id} is missing`);
  return found;
};

// Checks the name, that the first line holds the key idea, and that every line is short and has no em dash.
function check(mapKey, id, name, keyPattern) {
  const e = entry(mapKey, id);
  assert.equal(e.name, name, `${id} should be named ${name}`);
  if (keyPattern) {
    assert.ok(Array.isArray(e.lines) && e.lines.length >= 1, `${id} needs its own lines`);
    assert.match(e.lines[0], keyPattern, `${id}: first line`);
  }
  for (const line of e.lines || []) {
    assert.ok(line.length <= 160, `${id}: line over 160 chars: ${line}`);
    assert.ok(!line.includes('—'), `${id}: no em dash`);
  }
  return e;
}

test('FB-0083: Mustafa opens excited and cute, with the owner\'s wording, before the name entry and in the world', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'intro-greeting.js'), 'utf8');
  const block = src.match(/const GREETING_LINES = \[([\s\S]*?)\n\];/);
  assert.ok(block, 'GREETING_LINES not found');
  const lines = [...block[1].matchAll(/^\s*(['"])(.*)\1,\s*$/gm)].map((m) => m[2]);
  assert.equal(lines.length, 4, 'four lines (the e2e intro spec presses through four)');
  assert.match(lines[0], /pookie/i);
  assert.match(lines[0], /lil concoction/i);
  assert.match(lines[1], /happy birthdayy+/i);
  assert.match(lines[1], /!!!/);
  assert.match(lines[2], /alone/i);
  assert.match(lines[3], /name/i, 'the last line leads into the name entry');
  for (const line of lines) assert.ok(line.length <= 160 && !line.includes('—'), line);
  const say = SCRIPTS.gate2.find((s) => s.say).say;
  assert.equal(say.speaker, 'Mustafa');
  assert.equal(say.lines[0], 'Welcome to our world, where it all started!');
});

test('FB-0084: Sid says the owner\'s one victim line', () => {
  const e = check('campus', 'campus-amb-walk-3', 'Sid', /Muahaha/);
  assert.equal(e.lines.length, 1);
  assert.match(e.lines[0], /victim/);
});

test('FB-0085: Vedant is the wise old man at the bus stop, and introduces himself first', () => {
  const e = check('campus', 'campus-amb-busstop', 'Vedant', /I'm Vedant/);
  assert.ok(e.lines.length >= 2 && e.lines.length <= 3);
});

test('FB-0086: Akshay is sneaking into campus', () => {
  check('campus', 'campus-amb-sit-1', 'Akshay', /sneak into campus/);
});

test('FB-0087: Akshit asks if you have seen Mustafa', () => {
  const e = check('campus', 'campus-amb-sit-3', 'Akshit', /Mustafa/);
  assert.equal(e.lines.length, 1);
});

test('FB-0088: the campus chat pair are Nishit and Shryk (names only, they keep their role facts)', () => {
  const a = check('campus', 'campus-amb-chat-1', 'Nishit');
  const b = check('campus', 'campus-amb-chat-2', 'Shryk');
  assert.equal(a.lines, undefined);
  assert.equal(b.lines, undefined);
  const talk = campusTalkLines(a.role, a.id, newCampusTalkState(), a);
  assert.equal(talk.name, 'Nishit');
  assert.ok(talk.lines.length >= 1);
});

test('FB-0089: Utkarsh invites her to a party', () => {
  const e = check('main-block-g', 'mbg-amb-sit-2', 'Utkarsh', /Utkarsh/);
  assert.ok(e.lines.some((l) => /party/i.test(l)));
});

test('FB-0090: Venn asks for "they" with SLAYYY, Cijo cannot understand OS', () => {
  const venn = check('main-block-g', 'mbg-amb-chat-1', 'Venn', /they/);
  assert.ok(venn.lines.join(' ').includes('SLAYYY'));
  const cijo = check('main-block-g', 'mbg-amb-chat-2', 'Cijo', /OS/);
  assert.match(cijo.lines[0], /operating systems/);
});

test('FB-0091: Shamsuddin is the vice president and warns about face-scan attendance', () => {
  const e = check('main-block-g', 'mbg-amb-walk-1', 'Shamsuddin', /vice president/);
  assert.match(e.lines.join(' '), /face-scan attendance/);
  assert.equal(e.lines.length, 2);
});

test('FB-0092: Laya offers a ride home', () => {
  check('main-block-3', 'mb3-amb-landing-1', 'Laya', /ride/);
});

test('FB-0093: Karthik is scared and looking for a job', () => {
  const e = check('main-block-3', 'mb3-amb-corridor-1', 'Karthik', /job/);
  assert.match(e.lines[0], /scared/);
});

test('FB-0094: Krishna Maloo asks about the weekend show', () => {
  check('main-block-3', 'mb3-amb-bench', 'Krishna Maloo', /show/);
});

test('FB-0095: Aimy and Stephen argue about ACM-W', () => {
  const stephen = check('main-block-3', 'mb3-amb-lab-chat-1', 'Stephen', /ACM-W/);
  const aimy = check('main-block-3', 'mb3-amb-lab-chat-2', 'Aimy', /ACM-W/);
  assert.match(stephen.lines[0], /hate/);
  assert.equal(stephen.lines.length, 1);
  assert.equal(aimy.lines.length, 1);
});

test('FB-0096: Roop Kumar is the lab assistant', () => {
  const e = check('main-block-3', 'mb3-amb-lab-bench', 'Roop Kumar', /Hohoho/);
  assert.match(e.lines[0], /experiment/);
  assert.match(e.lines[0], /assistant/i);
});

test('FB-0097: Niel offers a ride in his Dodge to volunteer', () => {
  const e = check('main-block-1', 'mb1-amb-icl-1', 'Niel', /volunteer/);
  assert.match(e.lines[0], /Dodge/);
});

test('FB-0098: Krishna Nagpal, the first-floor corridor walker, is building a rocket to the moon', () => {
  const e = check('main-block-1', 'mb1-amb-corridor-1', 'Krishna Nagpal', /rocket/);
  assert.match(e.lines[0], /moon/);
  // the other corridor walker is still Prof. Elakkiya
  assert.equal(entry('main-block-1', 'mb1-amb-corridor-2').name, 'Prof. Elakkiya');
});

test('FB-0083..FB-0098: names are unique on every map and every fixed line is short', () => {
  for (const [mapKey, list] of Object.entries(AMBIENT)) {
    const names = list.filter((e) => e.name).map((e) => e.name);
    // Mustafa deliberately stands at several stations on the same map; every other name appears once per map.
    const others = names.filter((n) => n !== 'Mustafa');
    assert.equal(new Set(others).size, others.length, `${mapKey}: duplicate names ${others.join(', ')}`);
    for (const e of list) for (const line of e.lines || []) assert.ok(line.length <= 160, `${e.id}: ${line}`);
  }
  // Across the whole game, a name other than Mustafa belongs to one person only.
  const all = Object.values(AMBIENT).flat().filter((e) => e.name && e.name !== 'Mustafa').map((e) => e.name);
  assert.equal(new Set(all).size, all.length, 'two different characters share a name');
});
