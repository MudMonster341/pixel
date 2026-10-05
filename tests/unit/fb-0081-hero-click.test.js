// FB-0081 ("the hello kitty game: the shoot button should be z ... make the shoot button the mouse left click"): the hero fight (Physics Lab)
// is shot with the LEFT MOUSE CLICK (a touch tap too); Z stays as an alternative. The rules are the pure heroPointer*() helpers in
// src/minigames/hero-logic.js (a click is one shot, holding the button fires at the cooldown rate, the click that confirms START / RETRY /
// CONTINUE never fires); src/minigames/hero.js forwards the pointer events. Phaser is not available here, so the scene is checked as source.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const g = loadGameData();
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const create = g.evaluate('createHeroFight');
const step = g.evaluate('stepHeroFight');
const pointerCreate = g.evaluate('heroPointerCreate');
const pointerReset = g.evaluate('heroPointerReset');
const pointerDown = g.evaluate('heroPointerDown');
const pointerUp = g.evaluate('heroPointerUp');
const pointerShoot = g.evaluate('heroPointerShoot');
const pointerShotFired = g.evaluate('heroPointerShotFired');
const COOLDOWN = g.evaluate('HV_SHOT_COOLDOWN_MS');
const DT = 16;

// One frame the way hero.js playUpdate() does it: the pointer's answer is `input.shoot` (with `keyHeld` for Z), the step decides the shot.
// Returns how many shots left this frame. The on-screen shot list is emptied so the 4-at-once cap never hides what the cooldown does.
function frame(state, pf, keyHeld = false) {
  const pointer = pointerShoot(pf, DT);
  const events = plain(step(state, { left: false, right: false, jumpPressed: false, shoot: keyHeld || pointer }, DT));
  const fired = events.filter((e) => e.type === 'shoot').length;
  if (fired) pointerShotFired(pf);
  state.shots.length = 0;
  return fired;
}

// A fight with the villain's volleys off, so nothing but her own shots matters.
const practice = () => create({ hazards: false });
// A pointer state that has been up for a frame (as on a keyboard-confirmed start).
function armedPointer() {
  const pf = pointerCreate();
  pointerShoot(pf, DT);
  return pf;
}

test('FB-0081: one click is one shot', () => {
  const state = practice();
  const pf = armedPointer();
  let shots = 0;
  pointerDown(pf, true);
  shots += frame(state, pf);
  pointerUp(pf);
  for (let t = 0; t < 1000; t += DT) shots += frame(state, pf);
  assert.equal(shots, 1);
});

test('FB-0081: a quick tap that is pressed and released between two frames still fires once', () => {
  const state = practice();
  const pf = armedPointer();
  pointerDown(pf, true);
  pointerUp(pf); // both events arrive before the next frame
  let shots = 0;
  for (let t = 0; t < 600; t += DT) shots += frame(state, pf);
  assert.equal(shots, 1);
});

test('FB-0081: holding the button keeps firing, no faster than holding Z does (the same cooldown)', () => {
  const stateMouse = practice();
  const stateKey = practice();
  const pf = armedPointer();
  const pfKey = armedPointer();
  pointerDown(pf, true);
  const at = [];
  let mouseShots = 0;
  let keyShots = 0;
  for (let t = 0; t < 2000; t += DT) {
    const fired = frame(stateMouse, pf);
    if (fired) at.push(stateMouse.t);
    mouseShots += fired;
    keyShots += frame(stateKey, pfKey, true);
  }
  assert.ok(mouseShots >= 5, 'it fires repeatedly while held');
  assert.equal(mouseShots, keyShots, 'exactly the rate Z has');
  for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] >= COOLDOWN, `shots ${i - 1} and ${i} are at least the cooldown (${COOLDOWN} ms) apart`);
});

test('FB-0081: clicking during the cooldown never fires faster than the cooldown, and a click just before it ends is not lost', () => {
  const state = practice();
  const pf = armedPointer();
  pointerDown(pf, true);
  frame(state, pf); // shot 1
  pointerUp(pf);
  const times = [];
  for (let t = 0; t < 1000; t += DT) { // spam a click every 80 ms for a second
    if (t % 80 < DT) { pointerDown(pf, true); pointerUp(pf); }
    if (frame(state, pf)) times.push(state.t);
  }
  assert.ok(times.length >= 3, 'the buffered clicks do fire once the cooldown is over');
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= COOLDOWN);
  // a click 60 ms before the cooldown ends fires when it ends
  const s2 = practice();
  const p2 = armedPointer();
  pointerDown(p2, true);
  frame(s2, p2);
  pointerUp(p2);
  for (let t = 0; t < COOLDOWN - 60; t += DT) frame(s2, p2);
  pointerDown(p2, true);
  pointerUp(p2);
  let fired = 0;
  for (let t = 0; t < 200; t += DT) fired += frame(s2, p2);
  assert.equal(fired, 1);
});

test('FB-0081: the click that confirms START / RETRY / CONTINUE does not fire a shot', () => {
  const state = practice();
  const pf = pointerCreate();
  pointerDown(pf, false); // pointerdown on the card while mgState is still 'intro' / 'gameover'
  pointerReset(pf); // startAttempt() runs from the card's handler
  pointerDown(pf, true); // the scene-level pointerdown of the same click, which arrives after the state turned 'playing'
  let shots = 0;
  for (let t = 0; t < 400; t += DT) shots += frame(state, pf); // she is still holding the button
  assert.equal(shots, 0, 'held through the first frames: nothing');
  pointerUp(pf);
  for (let t = 0; t < 400; t += DT) shots += frame(state, pf);
  assert.equal(shots, 0, 'and the release does not fire either');
  pointerDown(pf, true); // the next, deliberate click does
  shots += frame(state, pf);
  assert.equal(shots, 1);
});

test('FB-0081: the other order of events (the scene hears the click before the card does) does not fire either', () => {
  const state = practice();
  const pf = armedPointer();
  pointerDown(pf, false); // scene-level handler first: mgState is still not playing, so it queues nothing
  pointerReset(pf); // then the card starts the attempt
  let shots = 0;
  for (let t = 0; t < 400; t += DT) shots += frame(state, pf);
  assert.equal(shots, 0);
});

test('FB-0081: a keyboard start (Enter) leaves the pointer free, so the very first click fires', () => {
  const state = practice();
  const pf = pointerCreate();
  pointerReset(pf); // startAttempt() after pressing Enter on the card: no pointer involved
  frame(state, pf); // first frame: the pointer is up, so it arms
  pointerDown(pf, true);
  assert.equal(frame(state, pf), 1);
});

test('FB-0081: a pointerdown while the game is not playing (a game-over card) never queues a shot', () => {
  const state = practice();
  const pf = armedPointer();
  pointerDown(pf, false);
  pointerUp(pf);
  let shots = 0;
  for (let t = 0; t < 600; t += DT) shots += frame(state, pf);
  assert.equal(shots, 0);
});

test('FB-0081: Z still fires (the pointer helpers do not get in its way, even while the pointer is unarmed)', () => {
  const state = practice();
  const pf = armedPointer();
  let shots = 0;
  for (let t = 0; t < 300; t += DT) shots += frame(state, pf, true);
  assert.ok(shots >= 1);
  assert.equal(frame(practice(), pointerCreate(), true), 1);
});

test('FB-0081: the intro card and the docs that told her Z fires now say CLICK (Z kept as the alternative)', () => {
  const { MINIGAMES, MG_INSTRUCTION_MAX_CHARS } = loadGameData();
  const controls = MINIGAMES.hero.instructions[0];
  assert.match(controls, /CLICK/);
  assert.match(controls, /\bZ\b/, 'Z is still offered');
  assert.doesNotMatch(controls, /Z: BOLT/);
  assert.ok(controls.length <= MG_INSTRUCTION_MAX_CHARS, 'it still fits the card');
  const hero = read('src', 'minigames', 'hero.js');
  assert.match(hero, /LEFT MOUSE CLICK/);
  assert.doesNotMatch(hero, /shoots star bolts \(Z\)/, 'the header no longer says only Z fires');
  assert.match(read('docs', 'ARCHITECTURE.md'), /left mouse click shoots/);
  assert.match(read('docs', 'GAME_FEEL.md'), /left mouse click shoots/);
});

test('FB-0081 scene: the pointer events feed the pure state, only the left button counts, Z is kept, and start/retry resets it', () => {
  const src = read('src', 'minigames', 'hero.js');
  assert.match(src, /this\.pointerFire = heroPointerCreate\(\)/);
  assert.match(src, /this\.input\.on\('pointerdown', \(pointer\) => \{ if \(!pointer\.button\) heroPointerDown\(this\.pointerFire, this\.mgState === 'playing'\); \}\)/,
    'left button only, and only while playing (the same guard as the jump listeners)');
  assert.match(src, /this\.input\.on\('pointerup', pointerReleased\)/);
  assert.match(src, /this\.input\.on\('pointerupoutside', pointerReleased\)/, 'releasing outside the canvas stops the fire');
  assert.match(src, /this\.input\.on\('gameout'/);
  assert.match(src, /heroPointerReset\(this\.pointerFire\)/, 'startAttempt() resets it: the confirming click never fires');
  assert.match(src, /shoot: this\.shootKey\.isDown \|\| pointerShoot/);
  assert.match(src, /addKey\('Z'\)/, 'Z still fires');
  assert.match(src, /case 'shoot':\s*heroPointerShotFired\(this\.pointerFire\)/);
  // the jump listeners keep their FB-0042 guard
  assert.match(src, /!event\.repeat && this\.mgState === 'playing'\) this\.jumpQueued = true/);
});
