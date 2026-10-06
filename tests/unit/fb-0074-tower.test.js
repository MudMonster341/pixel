// FB-0074 ("remove tetris, too slow and too many lines") and the owner's follow-up decision (2026-10-04): Room 195's key game is a
// tower climb, a "reverse Rapunzel" (src/minigames/tower.js, tower-logic.js; docs/plans/2026-10-04-moments-and-small-touches.md M8).
// The rules of the climb itself are tests/unit/tower-logic.test.js; this file pins what the swap must not break: Tetris is gone
// everywhere, the tower is the registered Room 195 game, and the key station, its dialog and the story around it are unchanged.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const exists = (...parts) => fs.existsSync(path.join(ROOT, ...parts));
const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

test('FB-0074: Tetris is gone: no source, logic, test or art file is left', () => {
  assert.equal(exists('src', 'minigames', 'tetris.js'), false);
  assert.equal(exists('src', 'minigames', 'tetris-logic.js'), false);
  assert.equal(exists('tests', 'unit', 'tetris-logic.test.js'), false);
  assert.equal(exists('assets', 'minigames', 'tetris-bg.png'), false);
  const all = [...walk('src'), ...walk('tools'), ...walk('tests'), ...walk('assets/minigames')];
  assert.deepEqual(all.filter((file) => /tetris/i.test(file)), []);
});

test('FB-0074: no script tag, scene registration, offline-bundle list or code mentions Tetris any more', () => {
  const files = [...walk('src'), ...walk('tools'), ...walk('tests'), 'index.html', 'package.json']
    .filter((file) => /\.(js|json|html|mjs)$/.test(file) && !file.endsWith('fb-0074-tower.test.js'));
  const hits = files.filter((file) => /tetris|stack-off|stack off/i.test(read(file)));
  assert.deepEqual(hits, [], 'files still naming the old game');
  const html = read('index.html');
  assert.doesNotMatch(html, /tetris/i);
  assert.match(html, /<script src="src\/minigames\/tower-logic\.js"><\/script>/);
  assert.match(html, /<script src="src\/minigames\/tower\.js"><\/script>/);
});

test('FB-0074: the current docs say tower climb (the story table, the architecture notes, the README); dated plan and history docs are left alone', () => {
  assert.match(read('docs', 'STORY.md'), /\| 3 \| Room 195 \| [^|]*[Tt]ower/);
  assert.doesNotMatch(read('docs', 'STORY.md'), /tetris/i);
  for (const doc of ['docs/ARCHITECTURE.md', 'docs/GAME_PLAN.md', 'docs/STYLE_GUIDE.md', 'README.md', 'docs/QUALITY_LOOP.md']) {
    assert.doesNotMatch(read(...doc.split('/')), /tetris/i, `${doc} still names Tetris as the current game`);
  }
  assert.match(read('docs', 'ARCHITECTURE.md'), /tower\.js/);
  assert.match(read('index.html'), /tower-logic\.js/);
});

test('FB-0074: the Room 195 game is the tower: id tower, registered with the framework and the scene list, no tetris id anywhere', () => {
  const { MINIGAMES, STORY } = loadGameData();
  assert.equal(MINIGAMES.tetris, undefined);
  assert.deepEqual(Object.keys(MINIGAMES).sort(), ['edi', 'flappy', 'hero', 'tower']); // 'edi' since the EDI Madness scene (ADR 0025, phase E3)
  const def = MINIGAMES.tower;
  assert.equal(def.id, 'tower');
  assert.equal(def.sceneKey, 'minigame-tower');
  assert.equal(def.name, 'Room 195 Tower Rescue');
  assert.equal(def.item, 'keyRoom195');
  assert.equal(def.scoreLabel, 'FLOOR');
  assert.equal(def.scoreTarget, 5, 'the tower has five floors');
  assert.equal(STORY.keyStations.room195.minigame, 'tower');
  // the scene is created and the gameplay-scene list (HUD/hotbar gating) knows its key
  assert.match(read('src', 'main.js'), /HeroScene, FlappyScene, TowerScene,/);
  assert.match(read('src', 'scenes', 'ui.js'), /'minigame-flappy', 'minigame-tower'\]/);
  assert.match(read('src', 'minigames', 'tower.js'), /super\('minigame-tower'\)/);
});

test('FB-0074: the tower\'s intro card is at most three lines: a title, a controls line and a goal line', () => {
  const { MINIGAMES, MG_INSTRUCTION_LINES, MG_INSTRUCTION_MAX_CHARS } = loadGameData();
  const def = MINIGAMES.tower;
  assert.ok(1 + def.instructions.length <= 3, 'title + instructions');
  assert.equal(def.instructions.length, MG_INSTRUCTION_LINES);
  const [controls, goal] = def.instructions;
  assert.match(controls, /ARROWS/);
  assert.match(controls, /SPACE: JUMP/);
  assert.match(goal, /PRINCE/);
  for (const line of def.instructions) assert.ok(line.length <= MG_INSTRUCTION_MAX_CHARS, `"${line}" fits the card`);
  assert.ok(def.name.length <= 28, 'the title fits on one row of the card');
});

test('FB-0074: the Room 195 key station and its dialog are unchanged (only the game behind it changed)', () => {
  const { STORY, keyStationDialog, ITEMS, MAPS } = loadGameData();
  const station = STORY.keyStations.room195;
  assert.equal(station.name, 'Room 195');
  assert.equal(station.item, 'keyRoom195');
  assert.equal(station.takenLine, "A key rests on the teacher's desk at the front of Room 195.");
  assert.equal(station.journal, "Found a key on the teacher's desk in Room 195.");
  assert.equal(station.doneLine, 'The desk is bare now — you already have this key.');
  assert.ok(ITEMS.keyRoom195);
  const entries = plain(keyStationDialog('room195'));
  const take = entries[0];
  const order = take.actions.map((a) => Object.keys(a)[0]);
  assert.equal(order[0], 'minigame', 'the mini-game runs first');
  assert.deepEqual([...order.slice(1)].sort(), ['give', 'journal', 'key', 'toast'], 'then the key, the item, the journal line and the toast');
  assert.equal(take.actions[0].minigame, 'tower', 'the mini-game runs first');
  assert.ok(take.actions.some((a) => a.key === 'room195'), 'and the key it hands over is still room195');
  // the station still stands on the map (completeness and story-clearance tests walk to it)
  assert.ok(JSON.stringify(MAPS).includes('room195'), 'the Room 195 key station is still on a map');
});

test('FB-0074: winning the tower (or the after-3-losses skip) awards the Room 195 key through the unchanged dialog action', () => {
  const { GameState, keyStationDialog, applyDialogActions, gameEvents, recordAttempt, minigameProgress } = loadGameData();
  const [take] = keyStationDialog('room195');
  let payload = null;
  gameEvents.on('minigame:requested', (p) => { payload = p; });
  let done;
  applyDialogActions(take.actions, GameState, (result) => { done = result; });
  assert.equal(payload.id, 'tower');
  assert.equal(GameState.quest.keys.room195, false);
  for (let i = 0; i < 3; i++) recordAttempt(GameState, 'tower', 'lost', i);
  assert.equal(recordAttempt(GameState, 'tower', 'skipped', 0).progress.skipped, true, 'the skip gift works for the tower like for every game');
  assert.equal(minigameProgress(GameState, 'tower').won, true);
  payload.onResult('won');
  assert.equal(GameState.quest.keys.room195, true);
  assert.equal(done, 'done');
});

test('FB-0074: a save from before the swap (Tetris progress, Room 195 key already won) still loads and keeps its key', () => {
  const { GameState, saveGame, loadGame, minigameProgress } = loadGameData();
  GameState.quest.keys.room195 = true;
  GameState.minigames = { tetris: { attempts: 2, bestScore: 4, won: true, skipped: false } };
  assert.equal(saveGame('default', GameState), true);
  GameState.quest.keys.room195 = false;
  GameState.minigames = {};
  assert.equal(loadGame('default', GameState), true);
  assert.equal(GameState.quest.keys.room195, true, 'the key she already earned stays earned');
  assert.deepEqual(plain(minigameProgress(GameState, 'tower')), { attempts: 0, bestScore: 0, won: false, skipped: false }, 'the tower starts fresh (and is moot: the key is hers)');
});

test('FB-0074: Mustafa\'s line near Room 195 is a light hint about climbing, not about stacking', () => {
  const { AMBIENT } = loadGameData();
  assert.match(JSON.stringify(AMBIENT), /mb1-amb-mustafa-195/);
  const source = read('src', 'ambient.js');
  const block = /id: 'mb1-amb-mustafa-195'[\s\S]*?lines: \[([\s\S]*?)\] \},/.exec(source);
  assert.ok(block, 'Mustafa\'s Room 195 entry is still there');
  const lines = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(lines.length, 2);
  assert.ok(lines.some((line) => /climb|up/i.test(line)), 'one line hints at the climb');
  for (const line of lines) {
    assert.doesNotMatch(line, /stack|pieces?|rows?|tetris/i, `"${line}" still talks about the old game`);
    assert.ok(line.length <= 160);
    assert.doesNotMatch(line, /barrel|gargoyle|prince|rescue/i, 'a hint, not a spoiler');
  }
});

test('FB-0074: the tower\'s sounds are all registered ones (jump, floor chime, hit thud, win), nothing new to load', () => {
  const { SOUNDS } = loadGameData();
  const src = read('src', 'minigames', 'tower.js');
  const used = [...src.matchAll(/AudioManager\.play\('(\w+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 3);
  for (const id of used) assert.ok(SOUNDS[id], `${id} is a registered sound`);
});
