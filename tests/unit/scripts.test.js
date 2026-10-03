// ADR 0016 (in-world cutscene scripts) + FB-0033 (onboarding): the pure helpers -- resolveAnchor(),
// objectiveId()/objectiveTarget() (src/maplogic.js), OBJECTIVE_ROUTES (src/objective-routes.js) and
// the SCRIPTS content itself (src/scripts.js) -- checked without a browser. The engine that actually
// runs a script (src/scripts-runtime.js ScriptRunner) is covered separately in
// tests/unit/scripts-runtime.test.js (its control flow: sequencing, parallel, Esc fast-forward) and by
// the e2e specs (its Phaser-facing steps: camera pans, actor sprites, dialog).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

test('resolveAnchor: finds a named map object (point or rect) and returns its center in tiles', () => {
  const { resolveAnchor } = loadGameData();
  const objects = [
    { id: 1, name: 'spawn', type: 'spawn', x: 10, y: 20, width: 0, height: 0, props: {} },
    { id: 2, name: 'Main Block entrance', type: 'door', x: 40, y: 50, width: 2, height: 1, props: {} },
  ];
  assert.deepEqual(plain(resolveAnchor(objects, 'spawn')), { x: 10, y: 20 });
  assert.deepEqual(plain(resolveAnchor(objects, 'Main Block entrance')), { x: 41, y: 50.5 });
  assert.equal(resolveAnchor(objects, 'nonexistent'), null);
  assert.equal(resolveAnchor([], 'spawn'), null);
});

test('objectiveId: the current objective, in docs/STORY.md room order', () => {
  const { objectiveId } = loadGameData();
  const keys = () => ({ physicsLab: false, icvl: false, room195: false });
  assert.equal(objectiveId({ stage: 'arrival', keys: keys() }), 'find-stall');
  assert.equal(objectiveId({ stage: 'hunting', keys: keys() }), 'key-physicsLab');
  assert.equal(objectiveId({ stage: 'hunting', keys: { ...keys(), physicsLab: true } }), 'key-icvl');
  assert.equal(objectiveId({ stage: 'hunting', keys: { ...keys(), physicsLab: true, icvl: true } }), 'key-room195');
  assert.equal(objectiveId({ stage: 'hunting', keys: { physicsLab: true, icvl: true, room195: true } }), 'return-stall');
  assert.equal(objectiveId({ stage: 'rewarded', keys: { physicsLab: true, icvl: true, room195: true } }), null);
  // Collected out of order (FB-0039's own concern, now shared by the tracker text and the arrow/marker
  // routing alike): the *specific* missing key, not a count.
  assert.equal(objectiveId({ stage: 'hunting', keys: { ...keys(), room195: true } }), 'key-physicsLab');
});

test('objectiveTarget: the current objective route\'s stop on a given map, or null off-route', () => {
  const { objectiveTarget, OBJECTIVE_ROUTES } = loadGameData();
  const quest = { stage: 'hunting', keys: { physicsLab: false, icvl: false, room195: false } };
  assert.deepEqual(plain(objectiveTarget('campus', quest)), { map: 'campus', anchor: 'Main Block entrance' });
  assert.deepEqual(plain(objectiveTarget('main-block-3', quest)), { map: 'main-block-3', keyStation: 'physicsLab' });
  // The library block isn't part of this route at all -- off-route, no on-screen destination there.
  assert.equal(objectiveTarget('library-block-g', quest), null);
  // No active objective (rewarded) -> null everywhere, regardless of map.
  const rewarded = { stage: 'rewarded', keys: { physicsLab: true, icvl: true, room195: true } };
  assert.equal(objectiveTarget('campus', rewarded), null);

  // Every route only ever points at a map this game's own MAPS registry actually has (a typo'd map
  // key would otherwise silently mean "off-route" forever, never a loud failure).
  const { MAPS } = loadGameData();
  for (const [id, route] of Object.entries(OBJECTIVE_ROUTES)) {
    for (const step of route) assert.ok(MAPS[step.map], `${id}: route step's map "${step.map}" is not a real map`);
  }
});

test('SCRIPTS: every script is a non-empty list of well-formed, single-key steps', () => {
  const { SCRIPTS } = loadGameData();
  const KNOWN_STEPS = new Set([
    'lockInput', 'unlockInput', 'letterbox', 'fade', 'cameraPan', 'cameraFollow', 'spawnActor',
    'despawnActor', 'move', 'face', 'emote', 'say', 'wait', 'sound', 'setFlag', 'parallel',
    'placeActor', 'setActorVisible',
    'frame', 'anim', // the RTA bus's sheet-frame steps (tests/unit/rta-bus.test.js covers their data)
  ]);
  const checkStep = (step, where) => {
    const keys = Object.keys(step);
    assert.equal(keys.length, 1, `${where}: a step should have exactly one key, got [${keys}]`);
    assert.ok(KNOWN_STEPS.has(keys[0]), `${where}: unknown step type "${keys[0]}"`);
    if (keys[0] === 'parallel') step.parallel.forEach((s, i) => checkStep(s, `${where}.parallel[${i}]`));
    if (keys[0] === 'say') {
      assert.ok(Array.isArray(step.say.lines) && step.say.lines.length > 0, `${where}: say needs at least one line`);
      for (const line of step.say.lines) assert.ok(line.length > 0 && line.length < 200, `${where}: an empty/absurdly long line`);
    }
  };

  for (const [key, steps] of Object.entries(SCRIPTS)) {
    assert.ok(Array.isArray(steps) && steps.length > 0, `SCRIPTS.${key} should be a non-empty list`);
    steps.forEach((step, i) => checkStep(step, `SCRIPTS.${key}[${i}]`));
  }
});

test('every trigger-played script (gate2/opening/entrance/the 3 key rooms) locks input and letterboxes in first, then out and unlocks last', () => {
  const { SCRIPTS } = loadGameData();
  for (const key of ['gate2', 'opening', 'entrance', 'keyRoomPhysicsLab', 'keyRoomIcvl', 'keyRoomRoom195']) {
    const steps = plain(SCRIPTS[key]);
    assert.deepEqual(steps[0], { lockInput: true }, `${key}[0]`);
    assert.deepEqual(steps[1], { letterbox: 'in' }, `${key}[1]`);
    assert.deepEqual(steps.at(-2), { letterbox: 'out' }, `${key} second-to-last step`);
    assert.deepEqual(steps.at(-1), { unlockInput: true }, `${key} last step`);
  }
});

test('the 3 key-room scripts each target a real key station id and end control back on the player', () => {
  const { SCRIPTS } = loadGameData();
  const byId = { keyRoomPhysicsLab: 'physicsLab', keyRoomIcvl: 'icvl', keyRoomRoom195: 'room195' };
  for (const [scriptKey, keyStationId] of Object.entries(byId)) {
    const steps = SCRIPTS[scriptKey];
    const pan = steps.find((s) => s.cameraPan);
    assert.deepEqual(plain(pan.cameraPan.to), { keyStation: keyStationId }, scriptKey);
    const emote = steps.find((s) => s.emote);
    assert.equal(emote.emote.actor, keyStationId, scriptKey);
    assert.ok(steps.some((s) => s.cameraFollow === 'player'), `${scriptKey}: never resumes following the player`);
  }
});

// The two lines reused verbatim from the retired static cutscenes must not have silently drifted
// from what CUTSCENES itself still says (src/cutscenes.js) -- if that ever changes, this script's own
// "reused verbatim" claim (src/scripts.js's own header) should be revisited deliberately, not silently.
test('SCRIPTS.gate2/entrance reuse the exact lines the old CUTSCENES data still has, where claimed', () => {
  const { SCRIPTS, CUTSCENES } = loadGameData();
  const gate2Say = SCRIPTS.gate2.find((s) => s.say)?.say;
  assert.equal(gate2Say.lines[0], CUTSCENES.gate2.lines[0]);
  const entranceSay = SCRIPTS.entrance.find((s) => s.say)?.say;
  assert.equal(entranceSay.lines[0], CUTSCENES.entrance.lines[0]);
});
