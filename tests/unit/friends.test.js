// FB-0051 / P2b (decisions/0021 addendum): the owner's friends, Mustafa in his black and orange LUG hoodie, three professors,
// and the funnier CS-student openers. All of it is data (src/ambient.js, src/campus-facts.js) plus generator art
// (tools/make-assets.js); the mechanism (name / lines / sheet / factIds on an ambient entry) is read by src/campus-facts.js.
// Where people may stand is already pinned by tests/unit/ambient.test.js and story-clearance.test.js (they cover every entry).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const {
  AMBIENT, MAPS, CAMPUS_ROLES, CAMPUS_FACTS, GameState, renderLines, newCampusTalkState, campusTalkLines, ambientSheetKey, characterSheets, SCRIPTS,
} = loadGameData();
const plain = (v) => JSON.parse(JSON.stringify(v)); // sandbox arrays/objects have another realm's prototype

const ALL = Object.entries(AMBIENT).flatMap(([map, list]) => list.map((entry) => ({ map, entry })));
const named = (name) => ALL.filter(({ entry }) => entry.name === name);

const FRIENDS = ['Sid', 'Akshit', 'Varun', 'Mitul', 'Karthik', 'Siva', 'Shamsuddin', 'Najam', 'Satvik'];
const PROFESSORS = { 'Prof. Elakkiya': 'CF23', 'Prof. Angel': 'CF22', 'Prof. Raja': 'CF12' };

const sheetPng = (key) => decodePNG(fs.readFileSync(path.join(ROOT, 'assets', `${key}.png`)));
const colorsOf = (img) => {
  const set = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    set.add(`#${[img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  }
  return set;
};
const opaque = (img, x, y) => img.data[(y * img.width + x) * 4 + 3] !== 0;

test('FB-0051: every friend and professor exists exactly once, with the right name tag, 2-4 fixed lines and their own sheet', () => {
  const sheets = new Set();
  for (const name of [...FRIENDS, ...Object.keys(PROFESSORS)]) {
    const found = named(name);
    assert.equal(found.length, 1, `${name} should be on the map exactly once (found ${found.length})`);
    const { entry } = found[0];
    // FB-0084/0087/0093: the owner replaced some friends' lines by one line of his own wording, so 1-4.
    assert.ok(entry.lines.length >= 1 && entry.lines.length <= 4, `${name}: 1-4 fixed lines`);
    assert.match(entry.sheet, /^npc-(friend|prof)-[a-z]+$/, `${name}: its own sheet`);
    assert.ok(!sheets.has(entry.sheet), `${name}: the sheet ${entry.sheet} is shared with another person`);
    sheets.add(entry.sheet);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', `${entry.sheet}.png`)), `${entry.sheet}.png is missing (npm run assets)`);
    assert.equal(ambientSheetKey(entry), entry.sheet, `${name}: draws with its own sheet`);
    assert.ok(entry.name.length <= 24);
  }
  for (const name of Object.keys(PROFESSORS)) assert.match(name, /^Prof\. [A-Z][a-z]+$/, `${name}: the tag is "Prof." and a first name only (ADR 0018)`);
  // The people the owner listed for later packages are not here yet.
  for (const later of ['Sana', 'Shraddha', 'Palak', 'Mevin', 'Narda']) assert.equal(named(later).length, 0, `${later} is a later package`);
});

test('FB-0051: the roster\'s sheets are preloaded (characterSheets) and the sheets are 16x24 frames, 4 rows', () => {
  const preload = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  const keys = [...FRIENDS, ...Object.keys(PROFESSORS), 'Mustafa'].flatMap(named).map(({ entry }) => entry.sheet);
  for (const key of new Set(keys)) {
    assert.ok(preload.has(key), `${key} is not in the preload list`);
    const png = sheetPng(key);
    assert.equal(png.height, 4 * 24, `${key}: 4 rows of 24px`);
    assert.equal(png.width % 16, 0);
    // the plain fallback body world.js uses if the sheet never loaded
    const { entry } = ALL.find(({ entry: e }) => e.sheet === key);
    assert.ok(fs.existsSync(path.join(ROOT, 'assets', `npc-${entry.character}.png`)), `${key}: fallback body npc-${entry.character} is missing`);
  }
});

test('FB-0051: Mustafa stands near each of the three mini-game key stations, with a different fixed line each, and only those lines', () => {
  const stations = [['main-block-3', 'physicsLab'], ['main-block-1', 'icl'], ['main-block-1', 'room195']];
  const mustafas = named('Mustafa');
  assert.equal(mustafas.length, 3);
  const seen = new Set();
  for (const [map, id] of stations) {
    const station = MAPS[map].keyStations.find((k) => k.id === id);
    assert.ok(station, `${map} has no key station ${id}`);
    const near = mustafas.filter(({ map: m, entry }) => m === map && Math.hypot(entry.x - station.x, entry.y - station.y) <= 8);
    assert.equal(near.length, 1, `exactly one Mustafa near ${id}`);
    const { entry } = near[0];
    const d = Math.hypot(entry.x - station.x, entry.y - station.y);
    assert.ok(d >= 3, `Mustafa is ${d.toFixed(2)} tiles from ${id}: story objects keep 2 interact ranges (3 tiles) clear`);
    assert.equal(entry.kind, 'idle', 'Mustafa stands still near the game');
    assert.equal(entry.sheet, 'npc-mustafa');
    const key = JSON.stringify(entry.lines);
    assert.ok(!seen.has(key), 'every Mustafa says something different');
    seen.add(key);
    // fixed: he says exactly his lines, on every talk
    const state = newCampusTalkState();
    for (let i = 0; i < 3; i++) assert.deepEqual(plain(campusTalkLines(entry.role, entry.id, state, entry).lines), plain(entry.lines));
    assert.equal(campusTalkLines(entry.role, entry.id, newCampusTalkState(), entry).name, 'Mustafa');
  }
});

test('FB-0051: Mustafa\'s sheet (also the opening\'s script actor) is a black and orange hoodie, not the old maroon polo', () => {
  const colors = colorsOf(sheetPng('npc-mustafa'));
  assert.ok(colors.has('#1e1e24'), 'a black hoodie');
  assert.ok(colors.has('#f28c1e'), 'orange (the LUG colour)');
  assert.ok(!colors.has('#a33b4a') && !colors.has('#c8637a'), 'the old maroon polo is gone');
  // the opening still uses this sheet
  assert.ok(JSON.stringify(SCRIPTS).includes('"npc-mustafa"'));
  const tool = fs.readFileSync(path.join(ROOT, 'tools', 'make-assets.js'), 'utf8');
  assert.match(tool, /write\('npc-mustafa\.png', buildFriendCharacter\(FRIEND_LOOKS\['friend-mustafa'\]\)\)/);
});

test('FB-0051: Prof. Angel has white wings, Satvik has a camera, and the others do not (the props are in the generator)', () => {
  const tool = fs.readFileSync(path.join(ROOT, 'tools', 'make-assets.js'), 'utf8');
  assert.match(tool, /prop: WINGS/);
  assert.match(tool, /prop: CAMERA/);
  const angel = sheetPng('npc-prof-angel');
  const elakkiya = sheetPng('npc-prof-elakkiya');
  // facing us (row 0, idle frame): wing tips poke out above the ears, where the body is not
  assert.ok(opaque(angel, 1, 2) && !opaque(elakkiya, 1, 2), 'wing tips beside the head');
  // facing away (row 1): the wings cover the back with white
  let white = 0;
  for (let y = 24; y < 48; y++) for (let x = 0; x < 16; x++) {
    const i = (y * angel.width + x) * 4;
    if (angel.data[i] === 255 && angel.data[i + 1] === 255 && angel.data[i + 2] === 255 && angel.data[i + 3] === 255) white++;
  }
  assert.ok(white >= 20, `wings from behind: ${white} white pixels`);
  // Satvik's camera lens
  const satvik = sheetPng('npc-friend-satvik');
  assert.ok(colorsOf(satvik).has('#6fc3ff'), 'a camera lens');
  for (const other of ['npc-friend-sid', 'npc-friend-akshit', 'npc-prof-raja']) assert.ok(!colorsOf(sheetPng(other)).has('#6fc3ff'), `${other} carries no camera`);
  // Satvik has a deeper skin tone than the others (the default light skin colour is gone from his sheet)
  assert.ok(!colorsOf(satvik).has('#ffcbb0') && colorsOf(sheetPng('npc-friend-najam')).has('#ffcbb0'), 'Satvik\'s skin is deeper than the pack default');
});

test('FB-0051: the friends and professors look different from each other (no two share a recolour)', () => {
  const keys = ['npc-mustafa', ...[...FRIENDS, ...Object.keys(PROFESSORS)].map((n) => named(n)[0].entry.sheet)];
  const sigs = keys.map((k) => sheetPng(k)).map((img) => Buffer.from(img.data).toString('base64'));
  assert.equal(new Set(sigs).size, keys.length, 'two people have identical sheets');
  // grey or black hair and a jacket for the professors: the pack's default light brown hair is not used
  for (const prof of ['npc-prof-elakkiya', 'npc-prof-angel', 'npc-prof-raja']) assert.ok(!colorsOf(sheetPng(prof)).has('#ba8d5e'), `${prof}: adult hair colour`);
});

test('FB-0051: a professor says the jokes first, then only the sourced fact about them; Raja hints that a ride is coming', () => {
  for (const [name, factId] of Object.entries(PROFESSORS)) {
    const { entry } = named(name)[0];
    assert.deepEqual(plain(entry.factIds), [factId]);
    const state = newCampusTalkState();
    const first = campusTalkLines(entry.role, entry.id, state, entry);
    assert.equal(first.name, name);
    assert.deepEqual(plain(first.lines), plain(entry.lines));
    const second = campusTalkLines(entry.role, entry.id, state, entry);
    assert.equal(second.factId, factId, `${name}: afterwards only the fact about them`);
    assert.equal(campusTalkLines(entry.role, entry.id, state, entry).factId, factId);
  }
  assert.match(named('Prof. Raja')[0].entry.lines.join(' '), /ride coming/i);
  assert.match(named('Prof. Elakkiya')[0].entry.lines.join(' '), /quiz/i);
  assert.match(named('Prof. Elakkiya')[0].entry.lines.join(' '), /goated/i);
  assert.match(named('Prof. Angel')[0].entry.lines.join(' '), /wings/i);
  assert.match(named('Satvik')[0].entry.lines.join(' '), /photo|camera|cheese/i);
});

test('FB-0051: {name} in a line becomes the player\'s name ("Taru" by default); no line is left with a raw token', () => {
  const lines = ALL.flatMap(({ entry }) => entry.lines || []);
  assert.ok(lines.some((l) => l.includes('{name}')), 'some friends greet her by name');
  const rendered = plain(renderLines(lines, GameState));
  assert.equal(GameState.playerName, 'Taru');
  for (const line of rendered) assert.ok(!line.includes('{name}'));
  assert.ok(rendered.some((l) => l.includes('Taru')));
  assert.deepEqual(plain(renderLines(['Hi {name}!'], { playerName: 'Zara' })), ['Hi Zara!']);
  // rendered lines with the longest plausible name still fit the dialog box's line budget
  for (const line of lines) assert.ok(line.replace(/\{name\}/g, 'MMMMMMMMMM').length <= 170, `too long once named: "${line}"`);
});

test('FB-0051: the CS-flavoured roles have a funnier pool of 4-6 openers, and every fact is still sourced', () => {
  // The plain openers the CS roles had before FB-0051 (git history): at least 3 of each role's pool are new.
  const OLD = new Set(["Hi! It's only my first few weeks, everything is still new.", 'Oh hey! Still finding my way around, honestly.', 'Hey! Have you tried Linux yet? Just asking.',
    'Penguins are underrated, you know.', 'Shh... just kidding, hi! I practically live in the library.', 'Hello! Quiet campus day, the way I like it.',
    'Hi! Sorry, I was thinking about a circuit.', "Hey! I'm on my way to the lab.", 'Hey! Give me a second, my code is compiling.', 'Hi! Do you know any good debugging tricks?',
    "Hello! I've been reading about machine learning all day.", 'Hi! Ask me anything about AI. Well, almost anything.', 'Hi! Quick question: how good is your trivia?',
    "Hey! I'm in a quizzing mood today.", "Hi! Final stretch for me, can't wait.", "Hey! I've been around campus a while now.", 'Hi! Got a minute? I could talk about computing all day.',
    "Hey! I'm heading to a chapter meeting.", 'Hi! Black and white, always. It saves time in the morning.', "Hey! I'm off to a club meeting."]);
  for (const id of ['cs-student', 'ai-student', 'tech-club-member', 'lug-member', 'mtc-member', 'quiz-club-member', 'first-year', 'senior', 'library-regular', 'acm-member']) {
    const openers = CAMPUS_ROLES[id].openers;
    assert.ok(openers.length >= 4 && openers.length <= 6, `${id}: ${openers.length} openers, want 4-6`);
    assert.equal(new Set(openers).size, openers.length, `${id}: duplicate opener`);
    for (const opener of openers) assert.ok(opener.length <= 160, `${id}: opener over 160 chars`);
    assert.ok(openers.filter((o) => !OLD.has(o)).length >= 3, `${id}: at least 3 new, funnier openers`);
  }
  const text = CAMPUS_ROLES['cs-student'].openers.join(' ') + CAMPUS_ROLES['lug-member'].openers.join(' ') + CAMPUS_ROLES['acm-member'].openers.join(' ');
  for (const joke of [/works on my machine/i, /semicolon/i, /vim/i, /sudo/i, /git push --force/i]) assert.match(text, joke);
  for (const fact of CAMPUS_FACTS) assert.match(fact.source, /^F\d{3}$/, `${fact.id}: still traced to a research row`);
  // the old, plain openers are gone from the CS roles
  assert.ok(!CAMPUS_ROLES['cs-student'].openers.includes('Hey! Give me a second, my code is compiling.'));
  // the review doc lists them (the owner reads it)
  const review = fs.readFileSync(path.join(ROOT, 'docs', 'research', 'campus-lines-review.md'), 'utf8');
  assert.match(review, /FB-0051/);
});

test('FB-0051: nobody says anything about a birthday (it is the surprise at the end)', () => {
  const everything = JSON.stringify([AMBIENT, CAMPUS_ROLES, CAMPUS_FACTS]).toLowerCase();
  assert.doesNotMatch(everything, /birthday|bday|b-day|turning \d|happy 2\d/);
  const review = fs.readFileSync(path.join(ROOT, 'docs', 'research', 'campus-lines-review.md'), 'utf8');
  // FB-0083: the owner asked for Mustafa's opening (the greeting scene, not an NPC line) to be excited about the birthday; its doc row is the only other mention.
  const reviewNoOpening = review.split(/\r?\n/).filter((l) => !/FB-0083/.test(l)).join('\n');
  assert.doesNotMatch(reviewNoOpening.toLowerCase().replace(/no line mentions a birthday[^.]*\./, ''), /birthday/);
});

test('FB-0051: every person is on a real map of the Main Block or the campus, the crowd stays sensible (at most 6 new entries)', () => {
  const roster = [...FRIENDS, ...Object.keys(PROFESSORS), 'Mustafa'].flatMap(named);
  assert.equal(roster.length, FRIENDS.length + 3 + 3);
  for (const { map } of roster) assert.ok(map === 'campus' || /^main-block-/.test(map), map);
  // friends outdoors and on the Main Block floors, professors inside the Main Block
  const where = (name) => named(name)[0].map;
  for (const prof of Object.keys(PROFESSORS)) assert.match(where(prof), /^main-block-/);
  for (const floor of ['main-block-g', 'main-block-1', 'main-block-2', 'main-block-3']) {
    assert.ok(roster.some(({ map }) => map === floor), `nobody from the roster on ${floor}`);
  }
  assert.ok(roster.filter(({ map }) => map === 'campus').length >= 5, 'friends are out on the campus too');
  // two brand-new entries only (the two Mustafas by the games); the rest were existing students made into people
  const fresh = ALL.filter(({ entry }) => /mustafa-(lab|195)$/.test(entry.id));
  assert.equal(fresh.length, 2);
});

test('FB-0051: the mechanism is documented (sheet / factIds in the headers) and the sheets loop is in the generator', () => {
  const header = fs.readFileSync(path.join(ROOT, 'src', 'ambient.js'), 'utf8').split('const AMBIENT')[0];
  assert.match(header, /sheet\?/);
  assert.match(header, /factIds\?/);
  const facts = fs.readFileSync(path.join(ROOT, 'src', 'campus-facts.js'), 'utf8');
  assert.match(facts, /if \(entry\.sheet\) return entry\.sheet;/);
  assert.match(facts, /named\.factIds/);
});
