// "EDI Madness", phase E3 (decisions/0025, docs/plans/2026-10-06-edi-madness.md): the Phaser scene src/minigames/edi.js, its MINIGAMES entry and
// the QA flows. No Phaser runs under node:test, so (like tests/unit/fb-0066-hero.test.js and fb-0074-tower.test.js) the scene is pinned as source
// and data, and everything the scene decides is a small pure function in src/minigames/edi-logic.js, driven for real here (the key mapping, the
// HUD texts, the bay glow, the retry rule, the speech bubble's free spot). The rules themselves are tests/unit/edi-logic.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');
const pack = require('../../tools/pack-offline');

const g = loadGameData();
const c = (name) => g.evaluate(name);
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const pngSize = (...parts) => { const b = fs.readFileSync(path.join(ROOT, ...parts)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const scene = read('src', 'minigames', 'edi.js');
const logic = read('src', 'minigames', 'edi-logic.js');
const code = (src) => src.replace(/\/\/.*$/gm, ''); // comments out, so a word in a comment never satisfies an assertion
const STAGES = c('EDI_STAGES');
const ART = plain(c('EDI_ART'));
const create = c('createEdiParking');
const step = c('stepEdiParking');

// ---------- registration ----------

test('EDI scene: minigame-edi is a MinigameBaseScene, loaded by index.html after the shell and its rules, listed in main.js, in the scenes Quit stops, in the offline bundle and the test loader', () => {
  assert.match(scene, /class EdiScene extends MinigameBaseScene \{/);
  assert.match(scene, /super\('minigame-edi'\)/);
  const html = read('index.html');
  assert.match(html, /<script src="src\/minigames\/edi\.js"><\/script>/);
  assert.ok(html.indexOf('minigames/edi-logic.js') < html.indexOf('src/scenes/world.js'), 'the rules load with the other pure files');
  assert.ok(html.indexOf('minigames/framework-scene.js') < html.indexOf('minigames/edi.js'), 'the shell loads before the scene that extends it');
  assert.match(read('src', 'main.js'), /CutsceneScene, HeroScene, FlappyScene, TowerScene, EdiScene,/);
  assert.match(read('src', 'scenes', 'ui.js'), /'minigame-edi'/);
  // (tests/unit/quit-game.test.js checks every MINIGAMES sceneKey against that list)
  // the offline packer lists the page's own scripts and every 'assets/...' literal in src/ (so the EDI_ART paths in edi-logic.js)
  const bundleHtml = pack.buildIndexHtml(html, { dataFiles: ['data/assets-01.js'], fontCss: '@font-face{}' });
  assert.ok(pack.scriptSrcs(bundleHtml).includes('src/minigames/edi.js'));
  const refs = pack.scanSourceAssetRefs().filter((r) => r.kind === 'static').map((r) => r.value);
  for (const file of [...ART.bg, ART.cars, ART.sprites, ART.instructor, ART.cover]) assert.ok(refs.includes(file), `${file} is in the offline bundle`);
  assert.ok(fs.readFileSync(path.join(ROOT, 'tests', 'helpers', 'game-data.js'), 'utf8').includes('src/minigames/edi-logic.js'));
  // the flyer stays reachable until E4: its scene and entry are untouched
  assert.match(read('index.html'), /src\/minigames\/flappy\.js/);
  assert.ok(c('MINIGAMES').flappy);
});

// ---------- the MINIGAMES entry ----------

test('EDI scene: the MINIGAMES entry is "EDI MADNESS", opens the ICL door, scores stages parked, and its intro, door cards and story are short and complete', () => {
  const { MINIGAMES, MG_INSTRUCTION_LINES, MG_INSTRUCTION_MAX_CHARS } = g;
  const def = MINIGAMES.edi;
  assert.equal(def.id, 'edi');
  assert.equal(def.name, 'EDI MADNESS');
  assert.equal(def.sceneKey, 'minigame-edi');
  assert.equal(def.opens, 'iclDoorOpen', 'the same saved flag as the flyer: the door animation, Alice and the console are unchanged');
  assert.equal(def.item, undefined, 'a door, not a key: no key icon on the win card');
  assert.equal(def.scoreTarget, 3);
  assert.equal(def.scoreTarget, c('EDI_STAGE_COUNT'), 'the score is the stages parked');
  assert.equal(def.scoreLabel, 'PARKED');
  assert.deepEqual(plain(def.cover), { key: 'edi-cover', file: 'assets/minigames/edi-cover.png' });
  assert.equal(def.cover.file, ART.cover);
  assert.deepEqual(plain(def.instructions), ['ARROWS/WASD: DRIVE  SPACE: HANDBRAKE', 'PARK 3 TIMES WITHOUT HITTING A PILLAR']);
  assert.equal(def.instructions.length, MG_INSTRUCTION_LINES);
  for (const line of def.instructions) assert.ok(line.length <= MG_INSTRUCTION_MAX_CHARS, `"${line}" fits the card`);
  assert.deepEqual(plain(def.cards), {
    winTitle: 'PERFECT PARKING!',
    winLine: 'Your instructor would pass you. The ICL door opens!',
    skipTitle: 'DOOR UNLOCKED!',
    skipLine: 'The lab door opens anyway -- nice try.',
    skipLabel: 'SKIP -- OPEN THE DOOR ANYWAY',
    skipHint: "You've tried 3 times -- open the door anyway if you'd rather move on.",
  });
  // the backstory (FB-0082 mechanism): three short pages over the intro cover
  assert.deepEqual(plain(c('minigameStoryPages')(def, 'Taru')), [
    "The ICL's sealed door wants proof of EDI-level parking skills.",
    'Your instructor has strapped himself in. He looks nervous.',
    'Park three times without crushing a pillar. Ready?',
  ]);
  assert.equal(def.story.cover.key, def.cover.key, 'the story is told over the intro cover, which the scene preloads');
  for (const page of def.story.pages) assert.doesNotMatch(page, /birthday|cake|candle|gift|present|happy/i, 'no birthday mentions');
  // the intro card has no subtitle slot: nothing was added for one (the cover picture says GARAGE PARKING under the title)
  assert.doesNotMatch(read('src', 'minigames', 'framework-scene.js'), /subtitle/i);
});

// ---------- the art ----------

test('EDI scene: preload() loads every EDI_ART file under the texture keys the scene and the cover use, at the sizes the generator wrote them', () => {
  const body = code(scene);
  assert.match(body, /EDI_ART\.bg\.forEach/, 'the three backdrops');
  assert.match(body, /load\.image\('edi-cover', EDI_ART\.cover\)/);
  assert.match(body, /load\.spritesheet\('edi-cars', EDI_ART\.cars, \{ frameWidth: EDI_CAR_CELL, frameHeight: EDI_CAR_CELL \}\)/);
  assert.match(body, /load\.spritesheet\('edi-sprites', EDI_ART\.sprites, \{ frameWidth: 32, frameHeight: 32 \}\)/);
  assert.match(body, /load\.spritesheet\('edi-instructor', EDI_ART\.instructor, \{ frameWidth: 48, frameHeight: 48 \}\)/);
  assert.equal(c('MINIGAMES').edi.cover.key, 'edi-cover');
  for (const file of ART.bg) assert.deepEqual(pngSize(...file.split('/')), [960, 540], `${file} is drawn 1:1`);
  assert.deepEqual(pngSize(...ART.cars.split('/')), [8 * c('EDI_CAR_CELL'), 7 * c('EDI_CAR_CELL')], '8 headings x 7 colours of 56 px');
  assert.equal(plain(c('EDI_CAR_ROWS'))[0], 'learner', 'the player is row 0');
  assert.deepEqual(pngSize(...ART.sprites.split('/')), [8 * 32, 32]);
  assert.deepEqual(pngSize(...ART.instructor.split('/')), [96, 48], 'two 48 px frames: neutral and wincing');
  assert.deepEqual(pngSize(...ART.cover.split('/')), [480, 270]);
  assert.match(code(scene), /file\.split\('\/'\)\.pop\(\)\.replace\(\/\\\.png\$\/, ''\)/, 'the texture key is the file name: edi-bg-1 ...');
  // the car is drawn from the sheet at the logic's heading, centred on the logic's position; parked cars are in the backdrops, never sprites
  assert.match(body, /setFrame\(ediLearnerFrame\(c\.heading\)\)/);
  assert.match(body, /setPosition\(Math\.round\(c\.x\), Math\.round\(c\.y\)\)/);
  assert.doesNotMatch(body, /kind === 'car'/);
  assert.match(body, /setTexture\(ediTextureKey\(EDI_ART\.bg\[this\.edi\.stageIndex\]\)\)/, 'the backdrop follows the stage');
});

// ---------- the events ----------

test('EDI scene: handleEvent() has a case for every event type the logic emits, and each does its job', () => {
  const emitted = [...new Set([...logic.matchAll(/events\.push\(\{ type: '(\w+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(emitted, ['bump', 'line', 'lost', 'parked', 'scrape', 'stageWon', 'timeout', 'win']);
  const body = code(scene);
  for (const type of emitted) assert.match(body, new RegExp(`case '${type}':`), `the scene handles ${type}`);
  const handle = (type) => new RegExp(`case '${type}':([\\s\\S]*?)(?=\\n      case '|\\n      default)`).exec(body)[1];
  assert.match(handle('bump'), /AudioManager\.play\('lockedDoorThud'\)/, 'the hurt sound');
  assert.match(handle('bump'), /this\.hurtHit\(\)/, 'the red pulse and the small screen shake (src/juice.js, clamped to 150 ms)');
  assert.match(handle('bump'), /this\.sparkAt\(event\.x, event\.y\)/, 'a spark sprite from edi-sprites');
  assert.match(handle('bump'), /this\.winceMs = EDI_WINCE_MS/, 'the instructor winces');
  assert.match(handle('scrape'), /playThrottled\('doorClose'/);
  assert.doesNotMatch(handle('scrape'), /hurtHit|refreshHearts|sparkAt|winceMs/, 'a scrape is a small thud only');
  assert.match(handle('line'), /nearPark/);
  assert.match(handle('parked'), /minigameLineClear/, 'the stage chime');
  assert.match(handle('parked'), /popSprite\(EDI_SPRITE_FRAME\.tick/, 'a green tick');
  assert.match(handle('parked'), /this\.setScore\(ediStagesParked\(s\)\)/, 'the score is the stages parked');
  assert.match(handle('stageWon'), /kind: 'banner'/);
  assert.match(handle('stageWon'), /ediBannerText\(event\.stage\)/);
  assert.match(handle('stageWon'), /playConfettiBurst\(this,/, 'the existing confetti helper');
  assert.match(handle('timeout'), /this\.say\('TIME IS UP!'\)/);
  assert.match(handle('lost'), /kind: 'lose'/);
  assert.match(handle('win'), /event\.failsafe\) this\.win\(\)/, 'the failsafe goes straight to the shell win');
  // every case is a no-op for input: the sprites, state and sounds exist
  for (const sound of [...body.matchAll(/AudioManager\.play(?:Throttled)?\('(\w+)'/g)].map((m) => m[1])) assert.ok(c('SOUNDS')[sound], `sound ${sound} exists`);
  for (const key of [...body.matchAll(/EDI_SPRITE_FRAME\.(\w+)/g)].map((m) => m[1])) assert.ok(key in plain(c('EDI_SPRITE_FRAME')), `sprite frame ${key} exists`);
});

test('EDI scene: the shell\'s win() and lose() end every path, Esc is the shell\'s (never overridden), and the 75 s stage limit and the 150 s failsafe are still in the rules', () => {
  const body = code(scene);
  assert.match(body, /else if \(b\.kind === 'lose'\) this\.lose\(\);/, 'a lost stage is one loss for the skip-after-3 rule');
  assert.match(body, /else this\.win\(\);/);
  assert.match(body, /if \(!next\) \{ this\.win\(\); return; \}/);
  assert.doesNotMatch(body, /onEsc|keydown-ESC|AudioManager\.play\('minigame(Win|Lose)'\)/, 'Esc and the win/lose jingles stay the shell\'s');
  const shell = read('src', 'minigames', 'framework-scene.js');
  assert.match(shell, /keydown-ESC/);
  assert.match(shell, /this\.finish\(this\.mgState === 'win' \? 'won' : 'quit'\)/);
  // the soft-lock guards (never remove): the stage limit and the whole-attempt failsafe, both enforced in the step
  assert.equal(c('EDI_STAGE_LIMIT_MS'), 75000);
  assert.equal(c('EDI_FAILSAFE_MS'), 150000);
  assert.match(code(logic), /state\.attemptMs >= EDI_FAILSAFE_MS/);
  assert.match(code(logic), /events\.push\(\{ type: 'win', failsafe: true \}\)/);
  assert.match(code(logic), /state\.t >= \(ediStageOf\(state\)\.limitMs \|\| EDI_STAGE_LIMIT_MS\)/);
  // both beats are short and run off the frame time: nothing can hang
  assert.ok(c('EDI_BANNER_MS') <= 1500 && c('EDI_END_BEAT_MS') <= 1000);
  assert.match(code(scene), /b\.ms \+= delta;/);
  // an attempt that never parks still ends: the real step times a stage out, then the beat, then lose() (the shell's card)
  const s = create(0);
  const events = [];
  for (let t = 0; t < 80000 && s.status === 'playing'; t += 16) events.push(...plain(step(s, {}, 16)).map((e) => e.type));
  assert.deepEqual(events.filter((e) => e !== 'line'), ['timeout', 'lost']);
});

// ---------- stages, retry, fresh opening ----------

test('EDI scene: a retry restarts the SAME stage with fresh hearts and a fresh clock, and a fresh opening of the game starts at stage 1 (nothing leaks)', () => {
  const attemptStart = c('ediAttemptStart');
  // a stage-2 loss (time): the retry is stage 2 again
  let state = create(0);
  state = c('ediNextStage')(state);
  state = c('ediNextStage')(state);
  assert.equal(state.stageIndex, 2);
  const events = [];
  for (let t = 0; t < 80000 && state.status === 'playing'; t += 16) events.push(...plain(step(state, {}, 16)));
  assert.equal(state.status, 'lost');
  const again = attemptStart(state, 'Taru');
  assert.equal(again.stageIndex, 2, 'the stage that was lost, not stage 1');
  assert.equal(again.status, 'playing');
  assert.equal(again.hearts, c('EDI_HEARTS'));
  assert.equal(again.t, 0, 'a fresh stage clock');
  assert.equal(again.attemptMs, 0, 'a fresh attempt clock for the failsafe');
  assert.deepEqual(plain(again.car), { x: STAGES[2].start.x, y: STAGES[2].start.y, heading: STAGES[2].start.heading, speed: 0, steer: 0 });
  // a stage lost by hearts too
  const rammed = create(1);
  rammed.status = 'lost';
  assert.equal(attemptStart(rammed, 'Taru').stageIndex, 1);
  // a fresh opening: nothing before it; or a finished (won) attempt
  assert.equal(attemptStart(null, 'Taru').stageIndex, 0);
  assert.equal(attemptStart(undefined, '').stageIndex, 0);
  assert.equal(attemptStart(null, '').playerName, 'Taru', 'no name yet: the instructor still has someone to talk to');
  const won = create(2);
  won.status = 'won';
  assert.equal(attemptStart(won, 'Taru').stageIndex, 0);
  // the scene: init() runs on every opening and clears the state; startAttempt() asks the rule, it keeps no stage number of its own
  const init = /init\(data\) \{([\s\S]*?)\n  \}/.exec(code(scene))[1];
  assert.match(init, /super\.init\(data\)/);
  assert.match(init, /this\.edi = null;/);
  assert.match(init, /this\.beat = null;/);
  assert.match(code(scene), /this\.edi = ediAttemptStart\(this\.edi, GameState\.playerName\)/);
  assert.doesNotMatch(code(scene), /stageIndex = \d|retryStage|this\.stage = /, 'no second copy of the stage number');
  // the next stage keeps the attempt clock (the failsafe counts the whole attempt) and the scene advances through the logic
  assert.match(code(scene), /const next = ediNextStage\(this\.edi\)/);
  const second = c('ediNextStage')(create(0));
  assert.equal(second.stageIndex, 1);
  assert.equal(c('ediNextStage')(create(2)), null);
});

test('EDI scene: the score is the stages parked (0 on a fresh start, stage n on a retry of stage n, 3 after the last)', () => {
  const parked = c('ediStagesParked');
  assert.equal(parked(create(0)), 0);
  assert.equal(parked(create(1)), 1);
  const s = create(0);
  s.status = 'stageWon';
  assert.equal(parked(s), 1);
  const last = create(2);
  last.status = 'won';
  assert.equal(parked(last), 3);
  assert.match(code(scene), /this\.score = ediStagesParked\(this\.edi\);/, 'a retry sets the score without a pop');
  assert.match(code(scene), /this\.setScore\(ediStagesParked\(s\)\)/);
});

// ---------- input ----------

test('EDI scene: W/Up gas, S/Down brake, A/Left and D/Right steer, Space handbrake, read from the held keys every frame and cleared on blur', () => {
  const fromKeys = c('ediInputFromKeys');
  assert.deepEqual(plain(fromKeys({})), { gas: false, brake: false, left: false, right: false, handbrake: false });
  assert.deepEqual(plain(fromKeys(undefined)), { gas: false, brake: false, left: false, right: false, handbrake: false });
  assert.equal(fromKeys({ UP: true }).gas, true);
  assert.equal(fromKeys({ W: true }).gas, true);
  assert.equal(fromKeys({ DOWN: true }).brake, true);
  assert.equal(fromKeys({ S: true }).brake, true);
  assert.equal(fromKeys({ LEFT: true }).left, true);
  assert.equal(fromKeys({ A: true }).left, true);
  assert.equal(fromKeys({ RIGHT: true }).right, true);
  assert.equal(fromKeys({ D: true }).right, true);
  assert.equal(fromKeys({ SPACE: true }).handbrake, true);
  assert.deepEqual(plain(fromKeys({ UP: true, A: true, SPACE: true })), { gas: true, brake: false, left: true, right: false, handbrake: true });
  const body = code(scene);
  assert.match(body, /const k = this\.mgKeys;/);
  for (const key of ['UP', 'W', 'DOWN', 'S', 'LEFT', 'A', 'RIGHT', 'D', 'SPACE']) assert.match(body, new RegExp(`${key}: k\\.${key}\\.isDown`), `${key} is read as a held key`);
  assert.match(body, /game\.events\.on\('blur', this\.releaseKeys, this\)/);
  assert.match(body, /game\.events\.off\('blur', this\.releaseKeys, this\)/);
  assert.match(body, /key\.reset\(\)/);
  assert.match(body, /stepEdiParking\(this\.edi, input, delta\)/, 'the logic clamps long frames itself');
  // a drive through the real step: the mapped keys steer the car
  const s = create(0);
  for (let t = 0; t < 1500; t += 16) step(s, fromKeys({ UP: true, D: true }), 16);
  assert.ok(s.car.speed > 50 && s.car.heading > 0.2, 'gas and right turned the car clockwise');
});

// ---------- the HUD ----------

test('EDI scene: the HUD texts and effects come from the rules: STAGE n/3, the clock, the banner, the bay glow, the blink, the car frame', () => {
  assert.equal(c('ediStageLabel')(0), 'STAGE 1/3');
  assert.equal(c('ediStageLabel')(2), 'STAGE 3/3');
  assert.equal(c('ediBannerText')(0), 'STAGE 1 PARKED!');
  assert.equal(c('ediBannerText')(1), 'STAGE 2 PARKED!');
  const clock = c('ediClockText');
  assert.equal(clock(75000), '1:15');
  assert.equal(clock(74001), '1:15', 'rounded up');
  assert.equal(clock(9500), '0:10');
  assert.equal(clock(0), '0:00');
  assert.equal(clock(-5), '0:00');
  const s = create(0);
  assert.equal(c('ediTimeLeftMs')(s), 75000);
  step(s, {}, 40);
  assert.ok(c('ediTimeLeftMs')(s) < 75000);
  s.t = 1e9;
  assert.equal(c('ediTimeLeftMs')(s), 0);
  const glow = c('ediBayAlpha');
  const idle = create(0);
  assert.ok(glow(idle) > 0 && glow(idle) < 0.2, 'a faint outline all the time');
  const aligned = { aligned: true, parkProgress: 0 };
  assert.ok(glow(aligned) > glow(idle) + 0.15, 'brighter once she is in the bay');
  assert.ok(glow({ aligned: true, parkProgress: 1 }) > glow(aligned), 'brighter still while she holds still');
  assert.ok(glow({ aligned: true, parkProgress: 1 }) <= 1);
  const blink = c('ediBlinkAlpha');
  assert.equal(blink(0), 1);
  assert.deepEqual([blink(1000), blink(900), blink(700), blink(500), blink(300), blink(100)], [0.35, 1, 0.35, 1, 0.35, 1], 'a slow blink while the invulnerability lasts');
  assert.ok(c('EDI_BLINK_MS') >= 200, 'at most 2.5 blinks a second: under the 3 Hz flash limit');
  // the learner car: row 0, the column is the heading
  assert.equal(c('ediLearnerFrame')(0), 0);
  assert.equal(c('ediLearnerFrame')(Math.PI / 2), 2);
  assert.equal(c('ediLearnerFrame')(-Math.PI / 2), 6);
  // the scene draws the hearts, the stage, the clock, the portrait, the name tag and the bubble from these
  const body = code(scene);
  assert.match(body, /EDI_SPRITE_FRAME\.heartFull : EDI_SPRITE_FRAME\.heartEmpty/);
  assert.match(body, /ediStageLabel\(s\.stageIndex\)/);
  assert.match(body, /ediClockText\(left\)/);
  assert.match(body, /'edi-instructor'/);
  assert.match(body, /'Instructor'/);
  assert.match(body, /this\.portrait\.setFrame\(this\.winceMs > 0 \? 1 : 0\)/, 'frame 1 of the portrait is the wince');
  assert.match(body, /fillRoundedRect\(bay\.x, bay\.y, bay\.w, bay\.h, 6\)/, 'the bay is a green rounded rectangle');
  assert.match(body, /ediBayAlpha\(s\)/);
  assert.match(body, /s\.parkProgress/, 'the progress ring');
  assert.match(body, /\.arc\(/);
  assert.match(body, /ediBlinkAlpha\(this\.edi\.invulnMs\)/);
  assert.equal(c('EDI_WINCE_MS'), 1000, 'about a second');
});

test('EDI scene: the instructor\'s bubble is never wider than 380 px, wraps its text, and never covers the car, its start spot, the bay, a pillar or the portrait', () => {
  assert.equal(c('EDI_BUBBLE_MAX_W'), 380);
  assert.match(code(scene), /setWordWrapWidth\(EDI_BUBBLE_MAX_W - 2 \* EDIS_BUBBLE_PAD\)/);
  assert.match(code(scene), /w: Math\.min\(EDI_BUBBLE_MAX_W, /);
  const pick = c('ediPickBubbleRect');
  const keep = c('ediKeepClearRects');
  const overlap = c('ediRectsOverlap');
  const P = plain(c('EDI_PORTRAIT'));
  assert.equal(P.size, 48);
  for (let i = 0; i < STAGES.length; i++) {
    const state = create(i);
    // the portrait itself (and its name tag) is clear of every stage's start, bay and obstacles
    const portrait = { x: P.x - 4, y: P.y - 4, w: P.size + 8, h: P.size + 22 };
    assert.ok(portrait.x + portrait.w <= 928 && portrait.y + portrait.h <= 508, 'inside the floor, above the bottom wall');
    for (const k of keep(state).filter((r, n) => n < keep(state).length - 1)) assert.ok(!overlap(portrait, k), `stage ${i + 1}: the portrait covers something`);
    for (const [w, h] of [[380, 70], [380, 48], [250, 32], [120, 32]]) {
      const rect = pick(state, w, h, null);
      assert.equal(rect.w, w);
      assert.ok(rect.w <= 380);
      assert.ok(rect.x >= 32 && rect.x + rect.w <= 928 && rect.y >= 32 && rect.y + rect.h <= 508, `stage ${i + 1}: ${w}x${h} stays on the floor: ${JSON.stringify(rect)}`);
      for (const k of keep(state)) assert.ok(!overlap(rect, k), `stage ${i + 1}: a ${w}x${h} bubble at ${JSON.stringify(rect)} covers ${JSON.stringify(k)}`);
      // in particular the car's start spot
      const start = STAGES[i].start;
      assert.ok(!overlap(rect, { x: start.x - 30, y: start.y - 30, w: 60, h: 60 }), `stage ${i + 1}: the bubble covers the start spot`);
    }
    // it stays where it is while it is still clear, and moves out of the way of the car when the car drives into it
    const first = pick(state, 380, 48, null);
    assert.deepEqual(plain(pick(state, 380, 48, first)), plain(first), 'no jumping about');
    state.car.x = first.x + first.w / 2;
    state.car.y = first.y + first.h / 2;
    const moved = pick(state, 380, 48, first);
    assert.notDeepEqual(plain(moved), plain(first), `stage ${i + 1}: the car is under the bubble, so it moves`);
    assert.ok(!overlap(moved, { x: state.car.x - 40, y: state.car.y - 40, w: 80, h: 80 }));
  }
  // every line the instructor can say fits a bubble of at most 3 wrapped lines at the 10 px font (35 characters a line)
  const lines = plain(c('EDI_LINES'));
  for (const [kind, list] of Object.entries(lines)) for (const text of list) assert.ok(text.replace(/\{name\}/g, 'Taru').length <= 35 * 3, `${kind}: "${text}" fits`);
});

test('EDI scene: the shell\'s "PARKED: n / 3" panel stays hidden (it sat on the bays), and the hint / timeout strip lands where it covers no parked car, bay or pillar in any stage', () => {
  const body = code(scene);
  // an opt-out in the scene, nothing in the shell: hero and tower keep their HUD
  assert.match(body, /setHudVisible\(\) \{\s*this\.hud\.parts\.forEach\(\(part\) => part\.setVisible\(false\)\);/);
  assert.doesNotMatch(code(read('src', 'minigames', 'hero.js')) + code(read('src', 'minigames', 'tower.js')), /setHudVisible/);
  assert.match(read('src', 'minigames', 'framework-scene.js'), /setHudVisible\(visible\) \{\s*this\.hud\.parts\.forEach\(\(part\) => part\.setVisible\(visible\)\);/, 'the shell is unchanged');
  assert.match(body, /this\.refreshHud\(\);/, 'score bookkeeping (the shell\'s HUD text, setScore, recordAttempt) is untouched');
  // the stage label sits clear of the P signs (x 178-202 in stage 3, about 468-492 in stage 2, 608-632 in stage 1) and the hearts (x 38-126)
  const labelX = Number(/this\.stageText = hud\(uiText\(this, (\d+), 16/.exec(body)[1]);
  assert.ok(labelX >= 210 && labelX + 9 * 10 <= 460, `STAGE n/3 spans x ${labelX}-${labelX + 90}`);
  // the strip is only ever shown through say(), which places it with ediPickBubbleRect()
  assert.deepEqual([...body.matchAll(/this\.showMessage\(/g)].length, 1, 'only say() calls the shell\'s showMessage');
  assert.match(body, /ediPickBubbleRect\(this\.edi, EDIS_MESSAGE_W, EDIS_MESSAGE_H, null, \[bubble\]\)/);
  assert.match(body, /this\.message\.panel\.setPosition\(r\.x, r\.y\)/);
  assert.equal(Number(/EDIS_MESSAGE_W = (\d+)/.exec(body)[1]), 380);
  assert.equal(Number(/EDIS_MESSAGE_H = (\d+)/.exec(body)[1]), 34);
  const pick = c('ediPickBubbleRect');
  const keep = c('ediKeepClearRects');
  const overlap = c('ediRectsOverlap');
  for (let i = 0; i < STAGES.length; i++) {
    const state = create(i);
    const bubble = pick(state, 380, 70, null);
    const strip = pick(state, 380, 34, null, [bubble]);
    for (const k of keep(state)) assert.ok(!overlap(strip, k), `stage ${i + 1}: the strip at ${JSON.stringify(strip)} covers ${JSON.stringify(k)}`);
    assert.ok(!overlap(strip, bubble), `stage ${i + 1}: the strip and the instructor's bubble do not overlap`);
    for (const o of STAGES[i].obstacles) assert.ok(!overlap(strip, { x: o.x, y: o.y, w: o.w, h: o.h }), `stage ${i + 1}: the strip covers an obstacle`);
  }
});

// ---------- parking from the debug pose (what the QA shots and the e2e spec do) ----------

test('EDI scene: the pose near the bay is clear of everything, faces the bay, and holding gas then the handbrake parks every stage', () => {
  const near = c('ediPoseNearBay');
  for (let i = 0; i < STAGES.length; i++) {
    const pose = near(STAGES[i]);
    assert.equal(c('ediCarHitsStage')(STAGES[i], pose), false, `stage ${i + 1}: the approach pose is on open floor`);
    assert.equal(c('ediCarHitsStage')(STAGES[i], near(STAGES[i], 0)), false, `stage ${i + 1}: so is the pose in the bay`);
    assert.equal(c('ediCarParkedPose')(STAGES[i], near(STAGES[i], 0)), true, `stage ${i + 1}: the pose in the bay is a parked pose`);
    const state = create(i);
    Object.assign(state.car, pose);
    const bayCentreY = STAGES[i].bay.y + STAGES[i].bay.h / 2;
    const types = [];
    for (let t = 0; t < 20000 && state.car.y > bayCentreY + 8 && state.status === 'playing'; t += 16) types.push(...plain(step(state, { gas: true }, 16)).map((e) => e.type));
    for (let t = 0; t < 4000 && state.status === 'playing'; t += 16) types.push(...plain(step(state, { handbrake: true }, 16)).map((e) => e.type));
    assert.equal(state.bumps, 0);
    assert.ok(types.includes('parked'), `stage ${i + 1}: parked (${types})`);
    assert.equal(state.status, i === 2 ? 'won' : 'stageWon');
  }
});

// ---------- the QA flows and the e2e spec ----------

test('EDI scene: qa-shots has the edi flows (story, intro, play x3, bump, game over, skip offer, win, banner), in the main sequence and covered by --only', () => {
  const shots = read('tools', 'qa-shots.js');
  for (const name of ['edi-00-story', 'edi-01-intro', 'edi-02-play-1', 'edi-03-play-2', 'edi-04-play-3', 'edi-05-bump', 'edi-06-gameover', 'edi-07-skip-offer', 'edi-08-win', 'edi-09-banner']) {
    assert.match(shots, new RegExp(`shoot\\(page, '${name}'\\)`), `${name} is shot`);
  }
  assert.match(shots, /async function shootEdi\(browser\)/);
  assert.match(shots, /\['EDI Madness', shootEdi, \['edi', 'minigame-edi'\]\]/, 'in the flows table, matched by --only edi, --only edi-05 and --only minigame');
  assert.ok(shots.indexOf('shootMinigames, [') < shots.indexOf('shootEdi, ['), 'after the other mini-games');
  assert.ok(shots.indexOf('shootEdi, [') < shots.indexOf('shootEnding, ['), 'the ending stays the last flow');
  const flow = shots.slice(shots.indexOf('async function shootEdi'), shots.indexOf('async function shootEnding'));
  assert.match(flow, /tryStep\(page, 'edi'/);
  assert.match(flow, /moments=0/, 'moments are off');
  assert.match(flow, /launchMinigame\('edi'/);
  assert.match(flow, /skipStory\(\)/, 'the story page is shot, then skipped like a SKIP STORY press');
  assert.match(flow, /debugSetStage\(0\)/);
  assert.match(flow, /debugSetStage\(1, \{ inBay: true \}\)/);
  assert.match(flow, /debugSetStage\(2, \{ pose: true \}\)/);
  assert.match(flow, /debugFreeze/);
  for (const m of flow.matchAll(/timeout: (\d+)/g)) assert.ok(Number(m[1]) <= 25000, 'bounded waits');
  // the scene's debug hooks exist
  assert.match(code(scene), /debugSetStage\(index, \{ pose = null, inBay = false, invulnerable = false \} = \{\}\)/);
  assert.match(code(scene), /this\.debugFreeze/);
  // and each name stays unique among the mini-game shots
  const names = [...shots.matchAll(/shoot\(page, '(edi-[\w-]+)'\)/g)].map((m) => m[1]);
  assert.equal(names.length, new Set(names).size);
});

test('EDI scene: the e2e spec drives the real scene: story, intro, a scripted park of stage 1 into the stage banner, stage 2, Esc quits', () => {
  const spec = read('tests', 'e2e', 'minigames.spec.js');
  assert.match(spec, /EDI Madness: story, intro, a scripted drive that parks stage 1, the banner, stage 2, Esc quits/);
  assert.match(spec, /launchMinigame\('edi'/);
  assert.match(spec, /debugSetStage\(0, \{ pose: true \}\)/);
  assert.match(spec, /keyboard\.down\('ArrowUp'\)/);
  assert.match(spec, /keyboard\.down\('Space'\)/, 'the handbrake holds her in the bay');
  assert.match(spec, /STAGE 1 PARKED!/);
  assert.match(spec, /keyboard\.press\('Escape'\)/);
});
