// The mini-game framework's data side (src/minigames/framework-data.js, docs/ROADMAP.md M4): the
// MINIGAMES registry, attempt/skip/score bookkeeping, and how a `minigame` dialog action's outcome
// routes back into the story (src/dialog.js) -- all pure/data-driven, no Phaser or browser involved
// (the actual on-screen shell, src/minigames/framework-scene.js, needs a browser and is covered by
// tests/e2e/minigames.spec.js instead).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData, plain } = require('../helpers/game-data');

const countItem = (slots, item) => slots.filter((slot) => slot && slot.item === item).length;

// ---------- the registry itself ----------

test('MINIGAMES: one entry per key station in docs/STORY.md, each fully specified', () => {
  const { MINIGAMES, STORY } = loadGameData();
  const storyIds = Object.values(STORY.keyStations).map((ks) => ks.minigame);
  assert.deepEqual(Object.keys(MINIGAMES).sort(), [...new Set(storyIds)].sort());
  for (const [id, def] of Object.entries(MINIGAMES)) {
    assert.equal(def.id, id);
    assert.equal(typeof def.name, 'string');
    assert.ok(def.name.length > 0);
    assert.equal(typeof def.sceneKey, 'string');
    assert.ok(def.sceneKey.startsWith('minigame-'));
    assert.ok(Array.isArray(def.instructions) && def.instructions.length > 0);
    assert.ok(Number.isInteger(def.scoreTarget) && def.scoreTarget > 0);
  }
});

test('MINIGAMES: scene keys are unique (no two games would fight over the same Phaser scene)', () => {
  const { MINIGAMES } = loadGameData();
  const keys = Object.values(MINIGAMES).map((def) => def.sceneKey);
  assert.deepEqual(keys.length, new Set(keys).size);
});

// ---------- attempt counting, the 3-fail skip offer, and score persistence ----------

test('recordAttempt: a fresh mini-game starts at zero attempts, no skip offered', () => {
  const { GameState, minigameProgress } = loadGameData();
  const progress = minigameProgress(GameState, 'tetris');
  assert.deepEqual(plain(progress), { attempts: 0, bestScore: 0, won: false, skipped: false });
});

test('recordAttempt: attempts increase on "lost", and canSkip only turns true on the 3rd loss', () => {
  const { GameState, recordAttempt } = loadGameData();
  let result = recordAttempt(GameState, 'flappy', 'lost', 2);
  assert.equal(result.progress.attempts, 1);
  assert.equal(result.canSkip, false);

  result = recordAttempt(GameState, 'flappy', 'lost', 4);
  assert.equal(result.progress.attempts, 2);
  assert.equal(result.canSkip, false);

  result = recordAttempt(GameState, 'flappy', 'lost', 1);
  assert.equal(result.progress.attempts, 3);
  assert.equal(result.canSkip, true, 'the 3rd loss offers the skip, right on that same game-over card');
});

test('recordAttempt: bestScore is the max across every attempt, win or lose', () => {
  const { GameState, recordAttempt } = loadGameData();
  recordAttempt(GameState, 'platformer', 'lost', 2);
  recordAttempt(GameState, 'platformer', 'lost', 5);
  const { progress } = recordAttempt(GameState, 'platformer', 'lost', 3);
  assert.equal(progress.bestScore, 5);
});

test('recordAttempt: "won" sets won=true and stops counting attempts; canSkip is false once won', () => {
  const { GameState, recordAttempt } = loadGameData();
  recordAttempt(GameState, 'tetris', 'lost', 1);
  recordAttempt(GameState, 'tetris', 'lost', 2);
  recordAttempt(GameState, 'tetris', 'lost', 3);
  const { progress, canSkip } = recordAttempt(GameState, 'tetris', 'won', 10);
  assert.equal(progress.won, true);
  assert.equal(progress.skipped, false);
  assert.equal(progress.attempts, 3, 'a win does not count as another failed attempt');
  assert.equal(canSkip, false, 'already won -- nothing left to skip');
});

test('recordAttempt: "skipped" is a win too (the gift), flagged separately for the record', () => {
  const { GameState, recordAttempt } = loadGameData();
  recordAttempt(GameState, 'flappy', 'lost', 0);
  recordAttempt(GameState, 'flappy', 'lost', 0);
  recordAttempt(GameState, 'flappy', 'lost', 0);
  const { progress } = recordAttempt(GameState, 'flappy', 'skipped', 0);
  assert.equal(progress.won, true);
  assert.equal(progress.skipped, true);
});

test('recordAttempt: notifies state-changed, so autosave (src/save.js) picks it up', () => {
  const { GameState, recordAttempt, gameEvents } = loadGameData();
  let changed = 0;
  gameEvents.on('state-changed', () => changed++);
  recordAttempt(GameState, 'tetris', 'lost', 1);
  assert.equal(changed, 1);
});

test('resetMinigameProgress: puts one game back to a fresh record without touching the others', () => {
  const { GameState, recordAttempt, resetMinigameProgress, minigameProgress, freshMinigameProgress } = loadGameData();
  recordAttempt(GameState, 'tetris', 'lost', 5);
  recordAttempt(GameState, 'flappy', 'won', 8);
  resetMinigameProgress(GameState, 'tetris');
  assert.deepEqual(minigameProgress(GameState, 'tetris'), freshMinigameProgress());
  assert.equal(minigameProgress(GameState, 'flappy').won, true, 'untouched');
});

test('score/attempt progress round-trips through save/load like the rest of GameState', () => {
  const { GameState, recordAttempt, saveGame, loadGame } = loadGameData();
  recordAttempt(GameState, 'platformer', 'lost', 3);
  recordAttempt(GameState, 'platformer', 'won', 6);
  assert.equal(saveGame('default', GameState), true);

  GameState.minigames.platformer = { attempts: 0, bestScore: 0, won: false, skipped: false };
  assert.equal(loadGame('default', GameState), true);
  assert.deepEqual(plain(GameState.minigames.platformer), { attempts: 1, bestScore: 6, won: true, skipped: false });
});

// ---------- outcome routing: how a `minigame` dialog action's result reaches the story ----------
// (the mechanics of *suspending* the action list live in src/dialog.js and are covered in
// tests/unit/dialog.test.js; these tests are about the real key-station data, src/story.js, actually
// withholding/awarding the key based on that outcome.)

test('outcome routing: quitting a key station\'s mini-game never awards the key', () => {
  const { GameState, keyStationDialog, applyDialogActions, gameEvents } = loadGameData();
  const [take] = keyStationDialog('room195');
  let payload = null;
  gameEvents.on('minigame:requested', (p) => { payload = p; });
  let done;

  applyDialogActions(take.actions, GameState, (result) => { done = result; });
  assert.equal(payload.id, 'tetris');
  assert.equal(GameState.quest.keys.room195, false, 'not given until the mini-game actually resolves');

  payload.onResult('quit');
  assert.equal(GameState.quest.keys.room195, false);
  assert.equal(done, 'quit');
});

test('outcome routing: winning a key station\'s mini-game runs the rest of the list and awards the key', () => {
  const { GameState, keyStationDialog, applyDialogActions, gameEvents } = loadGameData();
  const [take] = keyStationDialog('icvl');
  let payload = null;
  gameEvents.on('minigame:requested', (p) => { payload = p; });
  let done;

  applyDialogActions(take.actions, GameState, (result) => { done = result; });
  payload.onResult('won');

  assert.equal(GameState.quest.keys.icvl, true);
  assert.equal(done, 'done');
  assert.equal(countItem(GameState.inventory.slots, 'keyIcvl'), 1);
});

test('outcome routing: a skip (the 3-fail gift) reaches the story exactly like a real win', () => {
  const { GameState, keyStationDialog, applyDialogActions, gameEvents } = loadGameData();
  const [take] = keyStationDialog('physicsLab');
  let payload = null;
  gameEvents.on('minigame:requested', (p) => { payload = p; });
  let done;

  applyDialogActions(take.actions, GameState, (result) => { done = result; });
  payload.onResult('won'); // src/minigames/framework-scene.js reports a skip as 'won' too
  assert.equal(GameState.quest.keys.physicsLab, true);
  assert.equal(done, 'done');
});
