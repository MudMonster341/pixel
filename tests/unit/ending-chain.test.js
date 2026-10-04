// FB-0076 ("after the end just take user back to the main screen"). The ending is box opening -> card -> credits -> title
// (and "Watch the Card Again" enters at the card). Today's credits already return to the title on their own, so this pins the
// whole chain as one rule: nothing in it ever needs a key press to carry on after THE END, nothing in it can stall (a video
// that never answers, a camera fade event that never arrives), and no scene of it leaves the player in the world -- the world
// used to stay paused underneath the title with her foyer position, which the feedback overlay and a later "Continue" saw.
// The scene methods are evaluated on stand-in objects (running a scene needs a browser; these rules are plain code).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n'); // checkouts on Windows have CRLF

const game = loadGameData();
for (const file of ['src/scenes/ui.js', 'src/scenes/box-opening.js', 'src/scenes/card.js', 'src/scenes/credits.js', 'src/scenes/title.js']) game.runScript(file);
const { evaluate } = game;
const flush = () => new Promise((resolve) => setImmediate(resolve));

// A scene manager that records calls in order, and stand-in camera / clock that hand their callbacks back to the test.
function fakeScene(key, alive = []) {
  const log = [];
  const timers = [];
  const fades = [];
  const scene = {
    sys: { settings: { key } },
    scene: {
      isActive: (k) => alive.includes(k), isPaused: () => false, isSleeping: () => false,
      stop: (k) => log.push(`stop:${k}`), start: (k, data) => log.push(data === undefined ? `start:${k}` : `start:${k}:data`),
    },
    cameras: { main: { fadeOut: (ms) => log.push(`fadeOut:${ms}`), once: (event, fn) => fades.push({ event, fn }) } },
    time: { delayedCall: (ms, fn) => { timers.push({ ms, fn }); return { remove() {} }; } },
  };
  return { scene, log, timers, fades };
}

// ---------- the credits ----------

test('FB-0076: the credits return to the title by themselves a few seconds after THE END appears, with no key press', () => {
  const { creditsTimeline } = game;
  const t = creditsTimeline(8);
  assert.ok(t.total - t.theEnd.start <= 7000, `THE END stays ${t.total - t.theEnd.start} ms before the return`);
  assert.ok(t.total - t.theEnd.start >= 3000, 'long enough to read "Made for you by"');
  const source = read('src', 'scenes', 'credits.js');
  assert.match(source, /this\.at\(t\.theEnd\.start, \(\) => this\.showTheEnd\(false\)\);/);
  assert.match(source, /this\.at\(t\.total, \(\) => this\.returnToTitle\(\)\);/, 'the natural schedule hands back by itself');
  const hold = Number(/const CREDITS_SKIP_END_HOLD_MS = (\d+);/.exec(source)[1]);
  assert.ok(hold <= 7000, `after a skip THE END stays ${hold} ms`);
  assert.match(source, /this\.at\(CREDITS_SKIP_END_HOLD_MS, \(\) => this\.returnToTitle\(\)\);/, 'a skip lands on a timed return as well');
});

test('FB-0076: a key still leaves sooner, behind the same grace timers (a stray key from the card cannot skip the credits)', () => {
  const CreditsScene = evaluate('CreditsScene');
  const grace = evaluate('CREDITS_SKIP_GRACE_MS');
  const endGrace = evaluate('CREDITS_END_LEAVE_GRACE_MS');
  const run = (state) => {
    const calls = [];
    const credits = { ...state, showTheEnd: (skipped) => calls.push(`showTheEnd:${skipped}`), returnToTitle: () => calls.push('returnToTitle') };
    CreditsScene.prototype.onSkipKey.call(credits, { repeat: false });
    return calls;
  };
  assert.deepEqual(run({ elapsed: grace - 1, phase: 'running', endShownAt: 0 }), [], 'ignored in the first moments');
  assert.deepEqual(run({ elapsed: grace + 1, phase: 'running', endShownAt: 0 }), ['showTheEnd:true'], 'then it skips to THE END');
  assert.deepEqual(run({ elapsed: 50_000 + endGrace - 1, phase: 'end', endShownAt: 50_000 }), [], 'THE END is not left by a key press that just skipped to it');
  assert.deepEqual(run({ elapsed: 50_000 + endGrace + 1, phase: 'end', endShownAt: 50_000 }), ['returnToTitle'], 'a key then leaves sooner');
  const held = [];
  CreditsScene.prototype.onSkipKey.call({ elapsed: 99_999, phase: 'end', endShownAt: 0, returnToTitle: () => held.push(1) }, { repeat: true });
  assert.deepEqual(held, [], 'a held key does nothing');
});

test('FB-0076: returning to the title stops the world and every other gameplay scene first, exactly once, even if the fade event never arrives', () => {
  const CreditsScene = evaluate('CreditsScene');
  const { scene, log, timers, fades } = fakeScene('credits', ['credits', 'world', 'ui', 'card']);
  const credits = { ...scene, phase: 'end' };
  CreditsScene.prototype.returnToTitle.call(credits);
  assert.equal(credits.phase, 'leaving');
  assert.equal(timers.length, 1, 'a failsafe timer is armed');
  assert.ok(timers[0].ms <= 1500, 'and it is short');
  fades[0].fn(); // the camera fade finished
  timers[0].fn(); // ...and the failsafe fires as well (or alone, if the event never came)
  assert.deepEqual(plain(log), ['fadeOut:500', 'stop:world', 'stop:ui', 'stop:card', 'start:title'], 'one hand-over, with nothing of the game left behind it');
  CreditsScene.prototype.returnToTitle.call(credits);
  assert.equal(log.length, 5, 'calling it again does nothing');

  // The failsafe alone does the same job.
  const alone = fakeScene('credits', ['credits', 'world']);
  CreditsScene.prototype.returnToTitle.call({ ...alone.scene, phase: 'end' });
  alone.timers[0].fn();
  assert.deepEqual(plain(alone.log), ['fadeOut:500', 'stop:world', 'start:title']);
});

// ---------- the title ----------

test('FB-0076: the title stops any gameplay scene left alive under it, whichever way she arrived (credits, Quit to Title, the goodbye screen)', () => {
  const source = read('src', 'scenes', 'title.js');
  assert.match(source, /create\(\) \{[^}]*?stopGameplayScenes\(this\);\s*this\.cameras\.main\.setBackgroundColor/);
  // The helper itself (src/scenes/ui.js) never stops the scene that calls it.
  assert.match(read('src', 'scenes', 'ui.js'), /if \(key === scene\.sys\.settings\.key\) continue;/);
});

// ---------- the card ----------

test('FB-0076: the card hands off to the credits exactly once, even if the fade event never arrives, and never returns to the title itself', async () => {
  const CardScene = evaluate('CardScene');
  const { scene, log, timers, fades } = fakeScene('card');
  const card = {
    ...scene, ended: false, endingVideo: null, killTimers() { log.push('killTimers'); },
    cache: { json: { get: () => ({ recipient: 'Taru' }) } },
  };
  CardScene.prototype.showEnding.call(card);
  assert.equal(card.ended, true);
  fades[0].fn();
  timers[0].fn();
  assert.deepEqual(plain(log), ['killTimers', 'fadeOut:400', 'start:credits:data'], 'one hand-over to the credits');
  CardScene.prototype.showEnding.call(card);
  assert.equal(log.length, 3, 'a second call is a no-op');
  const source = read('src', 'scenes', 'card.js');
  assert.doesNotMatch(source, /this\.scene\.start\('title'\)/);
  await flush();
});

test('FB-0076: the card\'s optional closing video can never stall the ending: a probe that never answers, or a load that never finishes, moves on to the credits', async () => {
  const CardScene = evaluate('CardScene');
  const setGlobal = evaluate('(name, value) => { globalThis[name] = value; }');
  const timeouts = [];
  setGlobal('setTimeout', (fn, ms) => { timeouts.push({ fn, ms }); });

  // (a) the request never answers
  setGlobal('fetch', () => new Promise(() => {}));
  let ended = 0;
  const hung = { ended: false, showEnding: () => { ended += 1; } };
  CardScene.prototype.playEndingVideoOrFinish.call(hung);
  assert.equal(timeouts.length, 1, 'a probe timeout is armed');
  assert.ok(timeouts[0].ms <= 5000);
  timeouts[0].fn();
  await flush();
  assert.equal(ended, 1, 'no video: straight on to the end');

  // (b) the file is there but never finishes loading
  setGlobal('fetch', () => Promise.resolve({ ok: true }));
  const delayed = [];
  let finished = 0;
  const slow = {
    ended: false, endingVideo: null, showEnding: () => { finished += 1; },
    load: { video() {}, once() {}, start() {} }, time: { delayedCall: (ms, fn) => delayed.push({ ms, fn }) },
  };
  CardScene.prototype.playEndingVideoOrFinish.call(slow);
  await flush();
  assert.equal(delayed.length, 1, 'a load deadline is armed');
  assert.ok(delayed[0].ms <= 10_000);
  delayed[0].fn();
  assert.equal(finished, 1, 'a clip that has not loaded by the deadline is given up on');
  slow.endingVideo = {}; // ...but a clip that IS playing is never cut off by that deadline
  delayed[0].fn();
  assert.equal(finished, 1);
});

// ---------- the box opening ----------

test('FB-0076: the box opening plays its drawn version when the optional clip never answers or never loads, and only ever one version', async () => {
  const BoxOpeningScene = evaluate('BoxOpeningScene');
  const setGlobal = evaluate('(name, value) => { globalThis[name] = value; }');
  const timeouts = [];
  setGlobal('setTimeout', (fn, ms) => { timeouts.push({ fn, ms }); });

  setGlobal('fetch', () => new Promise(() => {}));
  const log = [];
  const hung = { playDrawnSequence: () => log.push('drawn'), playVideoSequence: () => log.push('video') };
  BoxOpeningScene.prototype.checkVideoThenPlay.call(hung);
  timeouts[0].fn();
  await flush();
  assert.deepEqual(log, ['drawn']);

  setGlobal('fetch', () => Promise.resolve({ ok: true }));
  const delayed = [];
  const listeners = {};
  const log2 = [];
  const slow = {
    playDrawnSequence: () => log2.push('drawn'), playVideoSequence: () => log2.push('video'),
    load: { video() {}, once: (event, fn) => { listeners[event] = fn; }, start() {} }, time: { delayedCall: (ms, fn) => delayed.push({ ms, fn }) },
  };
  BoxOpeningScene.prototype.checkVideoThenPlay.call(slow);
  await flush();
  assert.ok(delayed[0].ms <= 10_000);
  listeners.complete(); // the clip loaded in time
  delayed[0].fn(); // the deadline fires afterwards: must not also play the drawn version
  listeners.loaderror();
  assert.deepEqual(log2, ['video'], 'exactly one version plays');
});

// ---------- the whole chain ----------

test('FB-0076: the chain is box opening -> card -> credits -> title, "Watch the Card Again" enters at the card, and nothing in it returns to the world', () => {
  assert.match(read('src', 'scenes', 'box-opening.js'), /this\.scene\.start\('card'\)/);
  assert.match(read('src', 'scenes', 'card.js'), /this\.scene\.start\('credits', \{ raw \}\)/);
  assert.match(read('src', 'scenes', 'credits.js'), /this\.scene\.start\('title'\)/);
  assert.match(read('src', 'scenes', 'title.js'), /this\.scene\.start\('card'\)/, 'Watch the Card Again plays the card, then (via it) the credits, then ends on the title');
  for (const file of ['box-opening.js', 'card.js', 'credits.js']) {
    const source = read('src', 'scenes', file);
    assert.doesNotMatch(source, /scene\.(start|launch|resume|wake|run)\(\s*'(world|ui|boot)'/, `${file} must never hand control back to the world`);
  }
  // The world is stopped (HUD first) before the box opens and only paused, never resumed, until the title cleans up.
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /playBoxOpening\(\) \{[\s\S]*?this\.scene\.stop\('ui'\);\s*this\.scene\.pause\(\);\s*this\.scene\.launch\('box-opening'\);/);
});

test('FB-0076: no step of the chain waits for a key to carry on after THE END (every phase after it is on a timer)', () => {
  const source = read('src', 'scenes', 'credits.js');
  // showTheEnd() / showMadeBy() / returnToTitle() never gate on a key: the only key handler is onSkipKey, which only SHORTENS the wait.
  const showTheEnd = /showTheEnd\(skipped\) \{([\s\S]*?)\n  \}\n/.exec(source)[1];
  assert.doesNotMatch(showTheEnd, /keyboard|isDown|once\('keydown/);
  assert.match(source, /this\.at\(t\.madeBy\.start, \(\) => this\.showMadeBy\(\)\);/);
  assert.equal((source.match(/keyboard\.on\(/g) || []).length, 1, 'one key handler, for skipping ahead only');
});
