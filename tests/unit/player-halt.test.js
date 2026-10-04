// FB-0072 ("character should stop when the screen shows up, because then the character is running all the time").
// The owner's screenshot: a script's message box ("Room 195.") open over a player still drawn mid-run. The cause: every
// scripted moment (the opening, the Gate 2 welcome, the Main Block entrance, the key-room beats) and every door walk sets
// WorldScene.transitioning, and update() returns at its top while it is set -- so movePlayer() never ran again to zero her
// velocity or swap the animation, and she kept sliding on at run speed under the dialog. The fix is one choke point: the flag
// is now an accessor that halts her the instant it turns on. These tests evaluate the real WorldScene methods and the real
// ScriptRunner on stand-in objects (running the scenes needs a browser; their rules are plain code).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n'); // checkouts on Windows have CRLF

const game = loadGameData();
game.runScript('src/scenes/world.js');
game.runScript('src/scripts-runtime.js');
const WorldScene = game.evaluate('WorldScene');
const ScriptRunner = game.evaluate('ScriptRunner');
const PLAYER_IDLE = game.evaluate('PLAYER_IDLE');

// A player sprite stand-in that records what a halt does to it. Starts mid-run, facing right.
function runningPlayer() {
  const p = {
    active: true,
    body: {},
    velocity: { x: 140, y: 0 },
    frame: 27,
    animKey: 'walk-right',
    anims: {
      timeScale: 140 / 80, // RUN_ANIM_SCALE: the run animation plays faster
      stop() { p.animKey = null; },
      play(key) { p.animKey = key; },
    },
    setVelocity(x, y) { p.velocity = { x, y }; return p; },
    setFrame(f) { p.frame = f; return p; },
  };
  return p;
}

function sceneWith(player, facing = 'right') {
  const scene = Object.create(WorldScene.prototype);
  scene.player = player;
  scene.facing = facing;
  return scene;
}

test('FB-0072: turning transitioning on stops the player at once -- no velocity, animation stopped and its run rate reset, idle frame facing her way', () => {
  for (const facing of ['down', 'up', 'left', 'right']) {
    const p = runningPlayer();
    const scene = sceneWith(p, facing);
    assert.equal(scene.transitioning, false);
    scene.transitioning = true;
    assert.equal(scene.transitioning, true);
    assert.deepEqual(p.velocity, { x: 0, y: 0 }, `${facing}: still moving`);
    assert.equal(p.animKey, null, `${facing}: the run/walk animation is still playing`);
    assert.equal(p.anims.timeScale, 1, `${facing}: the faster run animation rate carried over`);
    assert.equal(p.frame, PLAYER_IDLE[facing], `${facing}: not on the idle frame of her facing`);
  }
});

test('FB-0072: the idle frames are the four direction rows of the character sheet (down, up, left, right)', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(PLAYER_IDLE)), { down: 0, up: 8, left: 16, right: 24 });
});

test('FB-0072: only the moment the flag turns ON halts her -- a script or door walk that animates her itself is not interrupted', () => {
  const p = runningPlayer();
  const scene = sceneWith(p, 'up');
  scene.transitioning = true;
  p.anims.play('walk-up'); // a door walk / script `move` step takes over her animation
  scene.transitioning = true; // e.g. the script's own `lockInput` step, already locked
  assert.equal(p.animKey, 'walk-up', 'setting it again while it is already on must not stop the walk the sequence started');
  scene.transitioning = false;
  assert.equal(p.animKey, 'walk-up', 'turning it off leaves her animation to movePlayer(), which takes over next frame');
  p.setVelocity(80, 0);
  scene.transitioning = true; // a new sequence starts later
  assert.deepEqual(p.velocity, { x: 0, y: 0 }, 'a later sequence halts her again');
});

test('FB-0072: a restarted scene can reset the flag before it has a player, and a destroyed old sprite is left alone', () => {
  const scene = Object.create(WorldScene.prototype);
  assert.doesNotThrow(() => { scene.transitioning = false; });
  assert.doesNotThrow(() => scene.haltPlayer(), 'no player yet');
  scene.player = { active: false, body: null };
  assert.doesNotThrow(() => { scene.transitioning = true; }, 'a destroyed sprite from the previous map');
  assert.equal(scene.transitioning, true);
});

test('FB-0072: an in-world script that starts while she runs (the key-room beat, the entrance, the opening) stops her first', async () => {
  const p = runningPlayer();
  const scene = sceneWith(p, 'up');
  const runner = new ScriptRunner(scene);
  const done = runner.run([]); // `run()` sets scene.transitioning synchronously, before its first await
  assert.equal(scene.transitioning, true);
  assert.deepEqual(p.velocity, { x: 0, y: 0 }, 'she must not keep sliding under the script\'s message box');
  assert.equal(p.animKey, null);
  assert.equal(p.frame, PLAYER_IDLE.up);
  await done;
  assert.equal(scene.transitioning, false, 'and control comes back when the script ends');
});

test('FB-0072: a door that triggers while she runs stops her before the walk-in starts', () => {
  const p = runningPlayer();
  p.body = { center: { x: 8 }, bottom: 17 };
  const scene = sceneWith(p, 'up');
  const warp = { x: 0, y: 1, to: 'house', kind: 'door', locked: false, name: 'Test door', cellsW: 1, cellsH: 1 };
  scene.getWarpPoints = () => [warp];
  scene.prompt = { setVisible() {} };
  let seen = null;
  scene.playDoorDeparture = () => { seen = { velocity: { ...p.velocity }, frame: p.frame, scale: p.anims.timeScale }; };
  scene.checkWarps();
  assert.ok(seen, 'the door sequence started');
  assert.deepEqual(seen.velocity, { x: 0, y: 0 });
  assert.equal(seen.frame, PLAYER_IDLE.up);
  assert.equal(seen.scale, 1);
});

test('FB-0072: starting a mini-game, a cutscene or the box opening halts her too (the world is paused under them)', () => {
  for (const [method, args] of [['launchMinigame', ['platformer', () => {}]], ['playCutscene', ['gate2']], ['playBoxOpening', []]]) {
    const p = runningPlayer();
    const scene = sceneWith(p, 'left');
    const log = [];
    scene.prompt = { setVisible() {} };
    scene.game = { events: { emit() {} } };
    scene.scene = { pause: () => log.push('pause'), launch: () => log.push('launch'), stop: () => log.push('stop') };
    scene[method](...args);
    assert.ok(log.includes('pause'), `${method} pauses the world`);
    assert.deepEqual(p.velocity, { x: 0, y: 0 }, `${method}: still moving`);
    assert.equal(p.frame, PLAYER_IDLE.left, `${method}: not on the idle frame`);
    assert.equal(p.anims.timeScale, 1, `${method}: the run animation rate carried over`);
  }
});

test('FB-0072: every overlay that blocks input (dialog, journal, full map, pause menu) already zeroes her movement every frame, and keys held across them resume after', () => {
  const ui = read('src', 'scenes', 'ui.js');
  assert.match(ui, /isBlocking\(\) \{\s*return this\.dialog\.isOpen \|\| this\.fullMap\.visible \|\| this\.pause\.visible \|\| this\.journal\.visible;\s*\}/);
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /const blocked = !ui\.tutorial \|\| ui\.isBlocking\(\);\s*this\.movePlayer\(blocked, time, delta\);/);
  // blocked -> no direction, no running; held keys are read fresh each frame, so they resume the moment it closes.
  const move = /movePlayer\(blocked, time, delta\) \{([\s\S]*?)\n  \}\n/.exec(world)[1];
  assert.match(move, /if \(!blocked\) \{\s*dx = [^;]*isDown[^;]*;\s*dy = [^;]*isDown[^;]*;\s*\}/);
  assert.match(move, /const running = !blocked && !this\.def\.indoors && k\.SHIFT\.isDown;/);
  assert.match(move, /p\.anims\.play\(`idle-\$\{this\.facing\}`, true\)/);
});

test('FB-0072: the feedback overlay stops her before it pauses the game, unless a sequence is moving her itself', () => {
  const source = read('src', 'dev', 'feedback.js');
  assert.match(source, /if \(!world\.transitioning && typeof world\.haltPlayer === 'function'\) world\.haltPlayer\(\);\s*for \(const scene of gameScenes\(\)\) \{/);
});
