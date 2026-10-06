// "EDI Madness", phase E4 (decisions/0025, docs/plans/2026-10-06-edi-madness.md): the ICL scanner now starts the parking game instead of the flyer,
// and every player-visible ICL text says parking, not fingerprints or hacking. Source and data assertions only (no Phaser under node:test); the door,
// flag, key and soft-lock behaviour itself is pinned for `edi` in tests/unit/fb-0071-icl.test.js (ported from the flyer, not deleted).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const g = loadGameData();
const { STORY, MINIGAMES, AMBIENT, GameState, recordAttempt, pickDialogEntry, applyDialogActions, gameEvents } = g;
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\/.*$/gm, ''); // comments out: only what the player can read is scanned

// The words that belonged to the fingerprint scanner / flyer story. `scan` only as a noun ("scan required"), so "scanner" the object name
// (kept as an identifier) is checked separately below, in strings only.
const OLD_WORDING = /fingerprint|hack|crack|firewall|server dash|\bscan\b|\bscanned\b|time to crack/i;

// Every player-visible ICL string: the gate, Alice, the key station, the ambient lines of the corridor outside the lab, the EDI card wording.
function iclStrings() {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  const gate = STORY.iclGate;
  walk([gate.lockedLine, gate.doorDialog.map((e) => e.lines), gate.scannerDialog.map((e) => [e.lines, (e.actions || []).map((a) => a.journal || a.toast || '')])]);
  walk(STORY.alice.map((e) => [e.lines, (e.actions || []).map((a) => a.journal || a.toast || '')]));
  walk(STORY.keyStations.icl);
  walk(AMBIENT['main-block-1'].map((e) => e.lines || []));
  walk([MINIGAMES.edi.name, MINIGAMES.edi.instructions, MINIGAMES.edi.cards, MINIGAMES.edi.story.pages]);
  return out.filter((t) => t);
}

test('EDI wiring: the story\'s scanner action starts "edi" (and the gate names it), the flyer is only the rollback', () => {
  const gate = STORY.iclGate;
  assert.equal(gate.minigame, 'edi');
  const scan = gate.scannerDialog.find((e) => e.id === 'scan');
  const launches = scan.actions.filter((a) => 'minigame' in a);
  assert.deepEqual(plain(launches.map((a) => a.minigame)), ['edi'], 'exactly one mini-game action, and it is EDI Madness');
  // a win and the skip both end in the same flag the door reads
  assert.equal(MINIGAMES.edi.opens, gate.flag);
  assert.equal(gate.flag, 'iclDoorOpen');
  assert.ok(scan.actions.some((a) => a.setFlag === gate.flag), 'the scanner dialog sets iclDoorOpen after the game reports');
  // nothing in the story names the flyer any more (the rollback is a one-line change, commented at the scanner)
  const storySrc = read('src', 'story.js');
  assert.equal(code(storySrc).includes("'flappy'"), false, 'story.js starts no flyer');
  assert.match(storySrc, /ROLLBACK[^\n]*'flappy'/, 'the scanner line says how to roll back');
  for (const station of Object.values(STORY.keyStations)) assert.notEqual(station.minigame, 'flappy');
});

test('EDI wiring: a win and the skip after 3 losses both open the door; Esc does not; the key still comes from Alice and the console', () => {
  // the 3rd loss offers the skip for edi exactly as for every game, and the skip is a win
  let r = recordAttempt(GameState, 'edi', 'lost', 1);
  assert.equal(r.canSkip, false);
  r = recordAttempt(GameState, 'edi', 'lost', 1);
  assert.equal(r.canSkip, false);
  r = recordAttempt(GameState, 'edi', 'lost', 2);
  assert.equal(r.canSkip, true, 'skip offered after the 3rd loss');
  assert.ok(MINIGAMES.edi.cards.skipLabel && MINIGAMES.edi.cards.skipHint, 'the door-style skip card wording exists');
  const fw = read('src', 'minigames', 'framework-scene.js');
  assert.match(fw, /onSkip: \(\) => this\.win\(true\)/);
  assert.match(fw, /this\.finish\(this\.mgState === 'win' \? 'won' : 'quit'\)/);
  // the dialog layer: only a 'won' result (win or skip) sets the flag
  const scannerDef = { id: 'scanner:ICL scanner', dialog: STORY.iclGate.scannerDialog };
  for (const [result, opens] of [['won', true], ['quit', false]]) {
    GameState.flags = {};
    let requested = null;
    gameEvents.on('minigame:requested', (p) => { requested = p; });
    applyDialogActions(pickDialogEntry(scannerDef, GameState).entry.actions, GameState);
    assert.equal(requested.id, 'edi');
    requested.onResult(result);
    assert.equal(GameState.flags.iclDoorOpen === true, opens, `result "${result}"`);
  }
  // the key: Alice's first talk gives it, like the console, with no game in between
  const welcome = STORY.alice.find((e) => e.id === 'welcome');
  assert.ok(welcome.actions.some((a) => a.give === 'keyIcl') && welcome.actions.some((a) => a.key === 'icl'));
  assert.equal(welcome.actions.some((a) => 'minigame' in a), false);
});

test('EDI wiring: the guide route keeps its shape (the scanner while the door is shut, then the key station inside)', () => {
  const src = read('src', 'objective-routes.js');
  assert.match(src, /\{ map: 'main-block-1', anchor: 'ICL scanner', whileFlagOff: 'iclDoorOpen' \}/);
});

test('EDI wiring: no player-visible ICL text talks about fingerprints, scans, hacking, firewalls or "Server Dash" any more; the door wants a parking test', () => {
  const bad = iclStrings().filter((t) => OLD_WORDING.test(t));
  assert.deepEqual(plain(bad), [], 'old scanner/hack wording is still visible');
  const all = iclStrings().join('\n');
  assert.match(all, /Sealed\. Parking test required\./);
  assert.match(all, /EDI/);
  // the object is still called the scanner in the data, but never in a line the player reads about "the scanner" as a fingerprint pad
  assert.doesNotMatch(all, /fingerprint scanner/i);
  // the source scan: strings in story.js, ambient.js and campus-facts.js (comments stripped) keep clear of the old wording
  for (const file of ['story.js', 'ambient.js', 'campus-facts.js']) {
    const lines = code(read('src', file)).split('\n').filter((l) => /(['"`]).*\1/.test(l));
    const hits = lines.filter((l) => /fingerprint|server dash|firewall|time to crack|cracked/i.test(l));
    assert.deepEqual(plain(hits), [], `${file} still has old ICL wording`);
  }
  // the three places the owner will read first
  assert.equal(STORY.iclGate.lockedLine, 'Sealed. Parking test required.');
  assert.match(STORY.iclGate.scannerDialog[0].actions.find((a) => a.journal).journal, /EDI parking test/);
  assert.match(STORY.alice.find((e) => e.id === 'welcome').lines.join(' '), /parked your way through my front door/);
  assert.match(AMBIENT['main-block-1'].find((e) => e.id === 'mb1-amb-icl-2').lines.join(' '), /parking test/);
});

test('EDI wiring: no new ICL / EDI line mentions a birthday (the gift stays a surprise until the box)', () => {
  assert.deepEqual(plain(iclStrings().filter((t) => /birthday|b-day|bday/i.test(t))), []);
  for (const file of ['edi.js', 'edi-logic.js']) {
    assert.doesNotMatch(code(read('src', 'minigames', file)), /birthday/i, `${file} never says birthday`);
  }
});

test('EDI wiring: the flyer files still exist and stay registered (the one-line rollback)', () => {
  for (const file of ['src/minigames/flappy.js', 'src/minigames/flappy-logic.js', 'assets/minigames/flappy-sprites.png', 'assets/minigames/flappy-bg.png']) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} stays for the rollback`);
  }
  assert.ok(MINIGAMES.flappy, 'MINIGAMES.flappy stays');
  assert.equal(MINIGAMES.flappy.opens, 'iclDoorOpen', 'pointing the scanner back at it would still open the same door');
  assert.match(read('src', 'main.js'), /FlappyScene/);
  assert.match(read('index.html'), /src\/minigames\/flappy\.js/);
});
