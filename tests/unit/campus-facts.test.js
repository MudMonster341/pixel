// Talkable campus students (decisions/0018): the roles and facts in src/campus-facts.js, checked against
// the research they must come from (docs/research/campus-facts.md) and against the people rule (only the
// CS professors that file lists may be named; the two with conflicting titles get no title at all).
// The engine side (the student stops, turns, talks, walks on) is Phaser-facing: tests/e2e/campus-life.spec.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const {
  AMBIENT, CAMPUS_ROLES, CAMPUS_FACTS, campusFactsFor, newCampusTalkState, campusTalkLines, pickInteractable, INTERACT_PRIORITY,
} = loadGameData();

// ---------- the research file, parsed ----------
const DOC = fs.readFileSync(path.join(ROOT, 'docs', 'research', 'campus-facts.md'), 'utf8');
// The main table only (stop before "## Left out"): { 'F001': { category, fact, confidence } }
const RESEARCH = {};
for (const line of DOC.split('\n')) {
  if (/^## Left out/.test(line)) break;
  const cells = line.split('|').map((c) => c.trim());
  if (/^F\d{3}$/.test(cells[1] || '')) RESEARCH[cells[1]] = { category: cells[2], fact: cells[3], confidence: cells[cells.length - 2] };
}
// The faculty rows (category "CS faculty"): the people who may be named.
const PROFESSORS = Object.values(RESEARCH)
  .filter((r) => r.category === 'CS faculty')
  .map((r) => r.fact.match(/^Dr\.\s+(.+?)\s+(?:is|are)\s/)[1]);
const TITLE_CONFLICT = ['Elakkiya', 'Angel Arul Jothi'];
const TITLE_WORDS = /\b(Dr|Prof|Professor|Associate|Assistant|Head)\b\.?/i;
// Faculty the research could not verify ("Left out"): must never appear.
const UNVERIFIED_PEOPLE = ['Urolagin', 'Razia', 'Sulthana', 'Vadivel', 'Vijayakumar', 'Chegot', 'Sankaramenon', 'Gaur'];

test('research file: the parser found the facts table and the faculty rows', () => {
  assert.ok(Object.keys(RESEARCH).length >= 70, `expected F001..F077 in the table, found ${Object.keys(RESEARCH).length}`);
  assert.ok(PROFESSORS.length >= 8, `expected the CS faculty rows, found ${PROFESSORS.length}`);
  assert.ok(PROFESSORS.includes('Pranav Mothabhau Pawar'));
});

test('roles: about 12-16 roles, each with a label and 1-2 role-flavoured openers that state no fact', () => {
  const ids = Object.keys(CAMPUS_ROLES);
  assert.ok(ids.length >= 12 && ids.length <= 16, `expected about 12 roles, found ${ids.length}`);
  for (const id of ids) {
    const role = CAMPUS_ROLES[id];
    assert.ok(role.label && role.label.length <= 24, `${id}: needs a short label`);
    assert.ok(role.openers.length >= 1 && role.openers.length <= 2, `${id}: 1-2 openers`);
    for (const opener of role.openers) {
      assert.ok(opener.length <= 80, `${id}: opener too long: "${opener}"`);
      assert.doesNotMatch(opener, /\d/, `${id}: an opener is small talk, not a fact: "${opener}"`);
    }
  }
});

test('roles: the name tag is a role label, never a person (no title, no first name)', () => {
  const professorWords = PROFESSORS.flatMap((p) => p.split(' '));
  for (const [id, role] of Object.entries(CAMPUS_ROLES)) {
    assert.doesNotMatch(role.label, TITLE_WORDS, `${id}: "${role.label}" looks like a title`);
    for (const word of professorWords) assert.ok(!role.label.includes(word), `${id}: label "${role.label}" contains a real name`);
  }
});

test('roles: every role has at least 2 facts (a pool to rotate through), and every fact belongs to a known role', () => {
  for (const id of Object.keys(CAMPUS_ROLES)) {
    const pool = campusFactsFor(id);
    assert.ok(pool.length >= 2, `role "${id}" has only ${pool.length} fact(s)`);
    assert.ok(pool.length <= 4, `role "${id}" has ${pool.length} facts: keep pools small (2-4)`);
  }
  for (const fact of CAMPUS_FACTS) assert.ok(CAMPUS_ROLES[fact.role], `fact ${fact.id}: unknown role "${fact.role}"`);
});

test('facts: 30-45 facts, unique ids, every one with a text and a source', () => {
  assert.ok(CAMPUS_FACTS.length >= 30 && CAMPUS_FACTS.length <= 45, `expected 30-45 facts, found ${CAMPUS_FACTS.length}`);
  assert.equal(new Set(CAMPUS_FACTS.map((f) => f.id)).size, CAMPUS_FACTS.length, 'duplicate fact ids');
  for (const fact of CAMPUS_FACTS) {
    assert.match(fact.id, /^CF\d{2}$/);
    assert.equal(typeof fact.text, 'string');
    assert.ok(fact.text.length >= 20, `${fact.id}: too short`);
  }
});

test('facts: no line is longer than 160 characters (the dialog box shows short lines)', () => {
  for (const fact of CAMPUS_FACTS) assert.ok(fact.text.length <= 160, `${fact.id} is ${fact.text.length} chars: "${fact.text}"`);
  for (const role of Object.values(CAMPUS_ROLES)) for (const opener of role.openers) assert.ok(opener.length <= 160);
});

test('facts: every source is a row of docs/research/campus-facts.md, and never an unsure one', () => {
  for (const fact of CAMPUS_FACTS) {
    const row = RESEARCH[fact.source];
    assert.ok(row, `${fact.id}: source "${fact.source}" is not in docs/research/campus-facts.md`);
    assert.ok(['verified', 'single-source'].includes(row.confidence), `${fact.id}: source ${fact.source} is marked "${row.confidence}"`);
  }
});

test('facts: nothing is invented -- every number in a line is in its source row, and it never repeats a source twice', () => {
  const seen = new Set();
  for (const fact of CAMPUS_FACTS) {
    const source = RESEARCH[fact.source].fact;
    for (const num of fact.text.match(/\d[\d,.]*\d|\d/g) || []) {
      assert.ok(source.replace(/\.(?=\s|$)/g, '').includes(num.replace(/[.,]$/, '')), `${fact.id}: "${num}" is not in ${fact.source} ("${source}")`);
    }
    assert.ok(!seen.has(fact.source), `${fact.id}: source ${fact.source} is used by another fact too`);
    seen.add(fact.source);
  }
});

test('facts: every capitalised name in a line comes from its source row or a short list of campus words', () => {
  const COMMON = new Set(['We', 'The', 'There', 'Our', 'This', 'Over', 'At', 'A', 'Boys', 'Students', 'Free', 'Hostel', 'Practice', 'School', 'Campus',
    'Student', 'Welfare', 'Division', 'CS', 'UAE', 'Wi-Fi', 'IoT', 'AI', 'ML', 'EV', 'B.E.', 'M.E.', 'ID', 'Dubai', 'Academic', 'City', 'Sports', 'Festival',
    'Daan', 'Utsav', 'Proscenium', 'Flummoxed', 'Supernova', 'Trebel', 'Shades', 'Paribhasha', 'Jashn', 'Spectrum', 'Make', 'Difference', 'Wall', 'Street',
    'Club', 'F1', 'IEEE', 'Student', 'Branch', 'Gulf', 'SAE', 'ASHRAE', 'Dot-Net', 'Linux', 'Users', 'Group', 'LUG', 'ACM', 'BPDC', 'ACM-W', 'BITS',
    'MAHASAT', 'Earth', 'Day', 'Computer', 'Science', 'Information', 'Systems', 'Software', 'Electronics', 'Associate', 'Dean', 'Industry', 'Engagement',
    'Assistant', 'Professor', 'Head', 'Dr.', 'Sunday', 'Ajman', 'Sharjah', 'Practice', 'Jashn', 'Cybersecurity']);
  for (const fact of CAMPUS_FACTS) {
    const source = RESEARCH[fact.source].fact;
    // Sentence-initial words are capitalised anyway: only look at the words after the first of each sentence.
    const words = fact.text.split(/(?<=[.!?])\s+/)
      .flatMap((sentence) => (sentence.match(/[A-Z][A-Za-z0-9.\-]*/g) || []).filter((w) => !sentence.startsWith(w)));
    for (const word of words) {
      const bare = word.replace(/\.$/, '');
      assert.ok(COMMON.has(word) || COMMON.has(bare) || source.includes(bare), `${fact.id}: "${word}" is neither in ${fact.source} nor a known campus word`);
    }
  }
});

test('people: only the CS professors listed in the research file are named, and in the listed form', () => {
  let named = 0;
  for (const fact of CAMPUS_FACTS) {
    for (const word of UNVERIFIED_PEOPLE) assert.ok(!fact.text.includes(word), `${fact.id}: names "${word}", whom the research could not verify`);
    if (/Dr\./.test(fact.text)) {
      const professor = PROFESSORS.find((p) => fact.text.includes(p));
      assert.ok(professor, `${fact.id}: "Dr." with a name that is not a listed CS professor: "${fact.text}"`);
      assert.ok(RESEARCH[fact.source].fact.includes(professor), `${fact.id}: its source ${fact.source} is not about ${professor}`);
      named++;
    }
  }
  assert.ok(named >= 5, `expected several professors named (the owner asked for them), found ${named}`);
});

test('people: the two names whose titles conflict appear with no title at all', () => {
  let found = 0;
  for (const name of TITLE_CONFLICT) {
    for (const fact of CAMPUS_FACTS.filter((f) => f.text.includes(name))) {
      found++;
      assert.doesNotMatch(fact.text, TITLE_WORDS, `${fact.id}: "${name}" must not appear with a title: "${fact.text}"`);
    }
  }
  assert.ok(found >= 2, 'expected both title-conflict names to appear (as plain names)');
});

test('people: no opener or label names anyone, and no line is an opinion about a person', () => {
  const professorWords = PROFESSORS.flatMap((p) => p.split(' ')).filter((w) => w.length > 3);
  for (const role of Object.values(CAMPUS_ROLES)) {
    for (const opener of role.openers) for (const word of professorWords) assert.ok(!opener.includes(word), `opener names a person: "${opener}"`);
  }
  for (const fact of CAMPUS_FACTS) {
    assert.doesNotMatch(fact.text, /\b(best|worst|strict|boring|nicest|favou?rite|hate|great teacher|funny)\b/i, `${fact.id}: an opinion: "${fact.text}"`);
  }
});

test('talk: the first visit is opener + fact, later visits are just the next fact, and the label is the role', () => {
  const state = newCampusTalkState();
  const first = campusTalkLines('lug-member', 'someone', state);
  assert.equal(first.name, 'LUG member');
  assert.equal(first.lines.length, 2);
  assert.ok(CAMPUS_ROLES['lug-member'].openers.includes(first.lines[0]));
  assert.equal(first.lines[1], CAMPUS_FACTS.find((f) => f.id === first.factId).text);
  const second = campusTalkLines('lug-member', 'someone', state);
  assert.equal(second.lines.length, 1);
  assert.notEqual(second.factId, first.factId);
});

test('talk: the rotation says every fact in the pool before any repeats (one student, and a whole role)', () => {
  for (const role of Object.keys(CAMPUS_ROLES)) {
    const pool = campusFactsFor(role).map((f) => f.id);
    const one = newCampusTalkState();
    const heard = [];
    for (let i = 0; i < pool.length; i++) heard.push(campusTalkLines(role, 'student-1', one).factId);
    assert.deepEqual([...heard].sort(), [...pool].sort(), `${role}: one student repeated before finishing the pool`);
    // The next talk starts over (a repeat only after all were heard).
    assert.ok(pool.includes(campusTalkLines(role, 'student-1', one).factId));

    const many = newCampusTalkState();
    const spread = [];
    for (let i = 0; i < pool.length; i++) spread.push(campusTalkLines(role, `other-${i}`, many).factId);
    assert.deepEqual([...spread].sort(), [...pool].sort(), `${role}: different students of one role repeated before the pool ran out`);
  }
});

test('talk: it is deterministic per student, so two runs from a fresh state agree', () => {
  const a = campusTalkLines('senior', 'campus-amb-hostel-2', newCampusTalkState());
  const b = campusTalkLines('senior', 'campus-amb-hostel-2', newCampusTalkState());
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('talk: an unknown role still answers safely (a plain greeting), never throws', () => {
  const talk = campusTalkLines('no-such-role', 'x', newCampusTalkState());
  assert.equal(talk.name, 'Student');
  assert.deepEqual(JSON.parse(JSON.stringify(talk.lines)), ['Hi there!']);
});

test('priority: a talkable student never outranks a story object', () => {
  assert.ok(INTERACT_PRIORITY.ambientNpc < INTERACT_PRIORITY.questNpc);
  assert.ok(INTERACT_PRIORITY.ambientNpc < INTERACT_PRIORITY.keyStation);
  assert.ok(INTERACT_PRIORITY.animal < INTERACT_PRIORITY.questNpc);
  // A student standing right next to a key station / the volunteer: the story object is the one E talks to.
  const student = { role: 'ambientNpc', distance: 10, id: 'student' };
  assert.equal(pickInteractable([student, { role: 'keyStation', distance: 13, id: 'key' }]).id, 'key');
  assert.equal(pickInteractable([student, { role: 'questNpc', distance: 12, id: 'volunteer' }]).id, 'volunteer');
  assert.equal(pickInteractable([{ role: 'animal', distance: 10, id: 'cat' }, { role: 'keyStation', distance: 12, id: 'key' }]).id, 'key');
});

test('coverage: every role is used by at least one ambient student', () => {
  const used = new Set(Object.values(AMBIENT).flat().map((e) => e.role));
  for (const id of Object.keys(CAMPUS_ROLES)) assert.ok(used.has(id), `role "${id}" is not used by any ambient student`);
});

test('talk lines are campus atmosphere, never story information (no keys, volunteer, box, room names)', () => {
  const lines = [...CAMPUS_FACTS.map((f) => f.text), ...Object.values(CAMPUS_ROLES).flatMap((r) => r.openers)];
  for (const line of lines) {
    assert.doesNotMatch(line.toLowerCase(), /\bkeys?\b|volunteer|treasure|physics lab|icvl|room 195|\bbox\b/, `story vocabulary in "${line}"`);
  }
});

test('docs/research/campus-lines-review.md lists every fact and opener (the owner reviews this file)', () => {
  const review = fs.readFileSync(path.join(ROOT, 'docs', 'research', 'campus-lines-review.md'), 'utf8');
  for (const fact of CAMPUS_FACTS) {
    assert.ok(review.includes(fact.id) && review.includes(fact.text.replace(/\|/g, '\|')), `the review doc is missing ${fact.id} (re-generate it from src/campus-facts.js)`);
    assert.ok(review.includes(fact.source), `the review doc is missing source ${fact.source}`);
  }
  for (const role of Object.values(CAMPUS_ROLES)) for (const opener of role.openers) assert.ok(review.includes(opener), `the review doc is missing the opener "${opener}"`);
});
