// FB-0066 ("add students to the lab and make the mini game in the physics lab a bit more intense ... she is Hello Kitty fighting Batman
// and she beats Batman who is shooting at her and then leaves") and the owner's follow-ups (docs/plans/2026-10-04-moments-and-small-
// touches.md items 9 and M5, ADR 0021: protected characters get GENERIC stand-ins). The rules of the fight are tests/unit/hero-logic.test.js;
// this file pins what the swap must not break and what the owner asked for around it: the Physics Lab game is the hero fight (registered
// with the framework, the old platformer gone), the key station and its dialog are unchanged, the intro card is short and sits on the
// cover picture, the art files exist, no protected name is in the game, and the lab has students who obey the clearance rules.
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
const pngSize = (...parts) => { const b = fs.readFileSync(path.join(ROOT, ...parts)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

// ---------- the Physics Lab game is the hero fight ----------

test('FB-0066: the Physics Lab game is the hero fight: id hero, registered with the framework and the scene list, no platformer id any more', () => {
  const { MINIGAMES, STORY } = loadGameData();
  assert.equal(MINIGAMES.platformer, undefined);
  assert.deepEqual(Object.keys(MINIGAMES).sort(), ['edi', 'flappy', 'hero', 'tower']); // 'edi' since the EDI Madness scene (ADR 0025, phase E3)
  const def = MINIGAMES.hero;
  assert.equal(def.id, 'hero');
  assert.equal(def.sceneKey, 'minigame-hero');
  assert.equal(def.item, 'keyPhysicsLab', 'the same key item as before');
  assert.equal(def.scoreLabel, 'HITS');
  assert.equal(def.scoreTarget, 9, 'he takes 9 hits (8 to 10 as designed)');
  assert.equal(STORY.keyStations.physicsLab.minigame, 'hero');
  assert.match(read('src', 'main.js'), /CutsceneScene, HeroScene, FlappyScene, TowerScene,/);
  assert.match(read('src', 'scenes', 'ui.js'), /'minigame-hero', 'minigame-flappy', 'minigame-tower'\]/);
  assert.match(read('src', 'minigames', 'hero.js'), /super\('minigame-hero'\)/);
  const html = read('index.html');
  assert.match(html, /<script src="src\/minigames\/hero-logic\.js"><\/script>/);
  assert.match(html, /<script src="src\/minigames\/hero\.js"><\/script>/);
  assert.ok(html.indexOf('hero-logic.js') < html.indexOf('minigames/hero.js'), 'the rules load before the scene');
  assert.ok(html.indexOf('platformer-physics.js') < html.indexOf('hero-logic.js'), 'the rules need the platformer feel helpers first');
});

test('FB-0066: the old platformer game is gone (scene, art, tests, names), but platformer-physics.js stays for the games that use it', () => {
  assert.equal(exists('src', 'minigames', 'platformer.js'), false);
  assert.equal(exists('assets', 'minigames', 'platformer-bg-far.png'), false);
  assert.equal(exists('assets', 'minigames', 'platformer-bg-mid.png'), false);
  assert.equal(exists('src', 'minigames', 'platformer-physics.js'), true);
  assert.equal(exists('tests', 'unit', 'platformer-physics.test.js'), true);
  assert.match(read('index.html'), /platformer-physics\.js/);
  assert.match(read('src', 'minigames', 'hero-logic.js'), /PLATFORMER_COYOTE_MS/, 'the hero fight reuses the platformer feel helpers');
  const files = [...walk('src'), ...walk('tools'), ...walk('tests'), 'index.html', 'package.json']
    .filter((file) => /\.(js|json|html|mjs)$/.test(file) && !file.endsWith('fb-0066-hero.test.js') && !file.startsWith('tools/campus/data')
      && !/platformer-physics/.test(file) && file !== 'tools/make-minigame-art.js'); // the physics helpers keep their history; the generator names the stale files it deletes
  const dead = /PlatformerScene|minigame-platformer|src\/minigames\/platformer\.js|platformer-bg|Physics Lab Trial|collect all the charge cells|GRAB ALL 6 CELLS|PF_PLATFORMS|PF_COINS|buildPlatformer/;
  const hits = files.filter((file) => dead.test(read(...file.split('/'))));
  assert.deepEqual(hits, [], 'files still naming the old game');
  // the generator no longer writes its backdrops
  const generator = read('tools', 'make-minigame-art.js');
  assert.doesNotMatch(generator, /write\('platformer/);
  assert.match(generator, /write\('hero-bg\.png'/);
  assert.match(generator, /write\('hero-cover\.png'/);
});

test('FB-0066: the intro card is at most three lines (a title and two short lines), names the keys and the goal, and the shoot key does not clash with the shell\'s', () => {
  const { MINIGAMES, MG_INSTRUCTION_LINES, MG_INSTRUCTION_MAX_CHARS } = loadGameData();
  const def = MINIGAMES.hero;
  assert.ok(1 + def.instructions.length <= 3, 'title + instructions');
  assert.equal(def.instructions.length, MG_INSTRUCTION_LINES);
  const [controls, goal] = def.instructions;
  assert.match(controls, /ARROWS: MOVE/);
  assert.match(controls, /SPACE: JUMP/);
  assert.match(controls, /CLICK\/Z: SHOOT/, 'the shoot controls are shown on the card (FB-0081: the click shoots, Z too)');
  assert.match(goal, /SHADOW BAT/);
  assert.match(goal, /\b9\b/);
  for (const line of def.instructions) assert.ok(line.length <= MG_INSTRUCTION_MAX_CHARS, `"${line}" fits the card`);
  assert.ok(def.name.length <= 28, 'the title fits on one row of the card');
  // Z is not a key the shared card (or the Esc handling) uses
  const shell = read('src', 'minigames', 'framework-scene.js');
  const cardKeys = [...shell.matchAll(/for \(const key of \[([^\]]*)\]\) this\.on\(/g)].flatMap((m) => [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1]));
  assert.ok(cardKeys.includes('ENTER') && cardKeys.includes('SPACE'), 'found the shell\'s card keys');
  assert.ok(!cardKeys.includes('Z'));
  assert.match(shell, /keydown-ESC/);
  assert.match(read('src', 'minigames', 'hero.js'), /addKey\('Z'\)/);
});

test('FB-0066 cover (M5): the intro card sits on a cover picture: the registry names it, the shell draws it behind a bottom card, the file is 480x270 for a 2x stretch', () => {
  const { MINIGAMES } = loadGameData();
  const cover = MINIGAMES.hero.cover;
  assert.deepEqual(plain(cover), { key: 'hero-cover', file: 'assets/minigames/hero-cover.png' });
  assert.ok(exists(...cover.file.split('/')));
  assert.deepEqual(pngSize(...cover.file.split('/')), [480, 270]);
  assert.match(read('src', 'minigames', 'hero.js'), /assets\/minigames\/hero-cover\.png/);
  for (const other of ['tower', 'flappy']) assert.equal(MINIGAMES[other].cover, undefined, 'only the hero game has a cover');
  const shell = read('src', 'minigames', 'framework-scene.js');
  assert.match(shell, /cover: def\.cover,/, 'the intro passes the cover on');
  assert.match(shell, /const y = cover \? GAME_HEIGHT - h - 16 : Math\.round\(\(GAME_HEIGHT - h\) \/ 2\);/, 'the card sits at the bottom so the picture shows above it');
  assert.match(shell, /scene\.add\.image\(0, 0, cover\.key\)\.setOrigin\(0, 0\)\.setDisplaySize\(GAME_WIDTH, GAME_HEIGHT\)\.setDepth\(199\)/);
  assert.match(shell, /pinToScreen\(\[coverImage\]\)/);
  // the card (title + 2 lines + button + footer) is short enough to stay inside the dark ledge at the bottom of the cover (cover y >= 175 of 270)
  const card = 56 + 2 * 22 + 14 + 30 + 30; // MG_CARD_HEADER_H + lines + gap + one button + footer (framework-scene.js show())
  assert.ok(540 - 16 - card >= 340, `the card starts at screen y ${540 - 16 - card}: below the two characters' feet (y 352 on the cover)`);
});

test('FB-0066 art: the generator wrote the arena, the sprite sheet, the health bar and the cover at the sizes the scene loads them at', () => {
  assert.deepEqual(pngSize('assets', 'minigames', 'hero-bg.png'), [480, 270], 'half scale: the scene stretches it 2x to 960x540');
  assert.deepEqual(pngSize('assets', 'minigames', 'hero-sprites.png'), [256, 128], '8 x 4 cells of 32 px');
  assert.deepEqual(pngSize('assets', 'minigames', 'hero-bar.png'), [80, 10]);
  assert.deepEqual(pngSize('assets', 'minigames', 'hero-cover.png'), [480, 270]);
  const src = read('src', 'minigames', 'hero.js');
  for (const file of ['hero-bg', 'hero-sprites', 'hero-bar', 'hero-cover']) assert.match(src, new RegExp(`assets/minigames/${file}\\.png`));
  assert.match(src, /frameWidth: HVS_CELL, frameHeight: HVS_CELL/);
  assert.equal(Number(/const HVS_CELL = (\d+)/.exec(src)[1]), 32);
  assert.equal(Number(/const HVS_SCALE = (\d+)/.exec(src)[1]), 2, 'drawn at the same 2x as the tower: a 32 px cell is 64 px on screen, the villain\'s hitbox is 64 tall');
  const { evaluate } = loadGameData();
  assert.equal(evaluate('HV_VILLAIN_H'), 64);
  // the arena's platforms are painted from the rules (read from hero-logic.js), so art and rules cannot drift
  assert.match(read('tools', 'make-minigame-art.js'), /HV_PLATFORMS/);
});

test('FB-0066 stand-ins: no protected character name is anywhere in the game code or the art generators (ADR 0021: generic stand-ins only)', () => {
  const protectedNames = /hello\s*kitty|batman|batwoman|bat-?woman|sanrio|gotham|wayne|joker|robin\b/i;
  const files = [...walk('src'), ...walk('tools'), 'index.html', 'package.json']
    .filter((file) => /\.(js|json|html|mjs)$/.test(file) && !file.startsWith('tools/campus/data'));
  const hits = files.filter((file) => protectedNames.test(read(...file.split('/'))));
  assert.deepEqual(hits, []);
  // the generic look the brief asked for: a kitten with a pink bow, a mask and a cape; a bat-eared shadow figure with no emblem
  const generator = read('tools', 'make-minigame-art.js');
  assert.match(generator, /SHADOW BAT/);
  assert.match(generator, /VS KITTEN HERO/);
  assert.match(generator, /drawKitten/);
  assert.match(generator, /drawVillain/);
  assert.match(generator, /no emblem/);
  const { MINIGAMES } = loadGameData();
  assert.doesNotMatch(JSON.stringify(MINIGAMES), protectedNames);
  assert.equal(MINIGAMES.hero.name, 'Physics Lab Showdown');
});

// ---------- the key station and its dialog are unchanged ----------

test('FB-0066: the Physics Lab key station and its dialog are unchanged (only the game behind it changed)', () => {
  const { STORY, keyStationDialog, ITEMS, MAPS } = loadGameData();
  const station = STORY.keyStations.physicsLab;
  assert.equal(station.name, 'Physics Lab');
  assert.equal(station.item, 'keyPhysicsLab');
  assert.equal(station.takenLine, 'A small brass key sits on the lab bench, tagged "LUG hunt".');
  assert.equal(station.journal, 'Found a key on a bench in the Physics Lab.');
  assert.equal(station.doneLine, 'The bench is empty now — you already took this key.');
  assert.ok(ITEMS.keyPhysicsLab);
  const entries = plain(keyStationDialog('physicsLab'));
  const take = entries[0];
  const order = take.actions.map((a) => Object.keys(a)[0]);
  assert.equal(order[0], 'minigame', 'the mini-game runs first');
  assert.deepEqual([...order.slice(1)].sort(), ['give', 'journal', 'key', 'toast'], 'then the key, the item, the journal line and the toast');
  assert.equal(take.actions[0].minigame, 'hero');
  assert.ok(take.actions.some((a) => a.key === 'physicsLab'));
  assert.ok(take.actions.some((a) => a.toast === 'You got the Physics Lab key!'));
  const ks = MAPS['main-block-3'].keyStations.find((k) => k.id === 'physicsLab');
  assert.deepEqual([ks.x, ks.y], [5, 7], 'the key bench has not moved');
});

test('FB-0066: winning the hero fight (or the after-3-losses skip) awards the Physics Lab key through the unchanged dialog action; quitting does not', () => {
  const { GameState, keyStationDialog, applyDialogActions, gameEvents, recordAttempt, minigameProgress } = loadGameData();
  const [take] = keyStationDialog('physicsLab');
  let payload = null;
  gameEvents.on('minigame:requested', (p) => { payload = p; });
  let done;
  applyDialogActions(take.actions, GameState, (result) => { done = result; });
  assert.equal(payload.id, 'hero');
  assert.equal(GameState.quest.keys.physicsLab, false);
  let result = recordAttempt(GameState, 'hero', 'lost', 3);
  assert.equal(result.canSkip, false);
  recordAttempt(GameState, 'hero', 'lost', 4);
  result = recordAttempt(GameState, 'hero', 'lost', 1);
  assert.equal(result.canSkip, true, 'the 3rd loss offers the skip, like every game');
  assert.equal(recordAttempt(GameState, 'hero', 'skipped', 0).progress.skipped, true);
  assert.equal(minigameProgress(GameState, 'hero').won, true);
  payload.onResult('won');
  assert.equal(GameState.quest.keys.physicsLab, true);
  assert.equal(done, 'done');
  // quitting never awards it
  const q = loadGameData();
  const [take2] = q.keyStationDialog('physicsLab');
  let p2 = null;
  q.gameEvents.on('minigame:requested', (p) => { p2 = p; });
  q.applyDialogActions(take2.actions, q.GameState, () => {});
  p2.onResult('quit');
  assert.equal(q.GameState.quest.keys.physicsLab, false);
});

test('FB-0066: a save from before the swap (old platformer progress, Physics Lab key already won) still loads and keeps its key', () => {
  const { GameState, saveGame, loadGame, minigameProgress } = loadGameData();
  GameState.quest.keys.physicsLab = true;
  GameState.minigames = { platformer: { attempts: 2, bestScore: 4, won: true, skipped: false } };
  assert.equal(saveGame('default', GameState), true);
  GameState.quest.keys.physicsLab = false;
  GameState.minigames = {};
  assert.equal(loadGame('default', GameState), true);
  assert.equal(GameState.quest.keys.physicsLab, true, 'the key she already earned stays earned');
  assert.deepEqual(plain(minigameProgress(GameState, 'hero')), { attempts: 0, bestScore: 0, won: false, skipped: false }, 'the hero fight starts fresh (and is moot: the key is hers)');
});

test('FB-0066: Mustafa\'s lines near the lab hint at gravity, not at the old collect-the-cells game', () => {
  const { AMBIENT } = loadGameData();
  const mustafa = AMBIENT['main-block-3'].find((e) => e.id === 'mb3-amb-mustafa-lab');
  assert.ok(mustafa && mustafa.x === 9 && mustafa.y === 4, 'Mustafa stays at (9,4)');
  for (const line of mustafa.lines) assert.doesNotMatch(line, /cell|coin|collect/i);
});

// ---------- students in the lab ----------

const LAB_IDS = ['mb3-amb-lab-bench', 'mb3-amb-lab-chat-1', 'mb3-amb-lab-chat-2', 'mb3-amb-lab-walk'];

test('FB-0066 students: the Physics Lab has a student at a bench, a chatting pair and one walking a short patrol (3 to 4 more people)', () => {
  const { AMBIENT } = loadGameData();
  const lab = AMBIENT['main-block-3'];
  const added = LAB_IDS.map((id) => lab.find((e) => e.id === id));
  assert.ok(added.every(Boolean), 'all four are there');
  assert.equal(added.length, 4);
  assert.deepEqual(added.map((e) => e.kind), ['idle', 'chat', 'chat', 'patrol']);
  assert.equal(added[1].pairId, added[2].pairId);
  assert.ok(Math.abs(added[1].x - added[2].x) + Math.abs(added[1].y - added[2].y) === 1, 'the pair stands next to each other');
  assert.ok(added[3].waypoints.length === 2 && Math.hypot(added[3].waypoints[1].x - added[3].waypoints[0].x, added[3].waypoints[1].y - added[3].waypoints[0].y) <= 8, 'a short patrol');
  for (const e of added) assert.ok(e.role && e.character, `${e.id} has a role and a body`);
  assert.ok(lab.some((e) => e.id === 'mb3-amb-mustafa-lab'), 'Mustafa is still there');
  assert.ok(lab.length <= 8);
});

test('FB-0066 students: every lab student keeps 3 tiles from the key bench and Mustafa\'s spot, stands in the open (never in a one-tile lane, doorway or on stairs) and seals nothing', () => {
  const { AMBIENT, MAPS, gridFromTiled, isWalkableTile, tileInfo, tiledObjects } = loadGameData();
  const json = JSON.parse(read('assets', 'maps', `${MAPS['main-block-3'].tiled}.json`));
  const grid = gridFromTiled(json);
  const open = (x, y) => x >= 0 && y >= 0 && x < json.width && y < json.height && isWalkableTile(grid, tileInfo, x, y);
  const objects = tiledObjects(json).filter((o) => ['door', 'stairs', 'gate', 'lift'].includes(o.type));
  const ks = MAPS['main-block-3'].keyStations[0];
  const lab = AMBIENT['main-block-3'].filter((e) => LAB_IDS.includes(e.id));
  for (const e of lab) {
    const spots = e.kind === 'patrol' ? e.waypoints : [{ x: e.x, y: e.y }];
    for (const s of spots) {
      assert.ok(open(s.x, s.y), `${e.id} at (${s.x},${s.y}) is a walkable tile`);
      assert.ok(Math.hypot(s.x - ks.x, s.y - ks.y) >= 3, `${e.id} is at least 2 interact ranges from the key bench`);
      for (const o of objects) {
        const w = Math.max(o.width, 1);
        const h = Math.max(o.height, 1);
        assert.ok(!(s.x > o.x - 2 && s.x < o.x + w + 1 && s.y > o.y - 2 && s.y < o.y + h + 1), `${e.id} is clear of ${o.type} "${o.name}"`);
      }
    }
    if (e.kind !== 'patrol') {
      const lane = (!open(e.x - 1, e.y) && !open(e.x + 1, e.y)) || (!open(e.x, e.y - 1) && !open(e.x, e.y + 1));
      assert.equal(lane, false, `${e.id} at (${e.x},${e.y}) is in the open, not in a one-tile lane`);
    }
  }
  // sealing: with every standing student (all of them, the old ones too) blocked, the key bench is still reachable from the spawn
  const spawn = tiledObjects(json).find((o) => o.type === 'spawn');
  const blocked = new Set(AMBIENT['main-block-3'].filter((e) => e.kind !== 'patrol').map((e) => `${e.x},${e.y}`));
  const seen = new Set([`${Math.floor(spawn.x)},${Math.floor(spawn.y)}`]);
  const stack = [[Math.floor(spawn.x), Math.floor(spawn.y)]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const key = `${x + dx},${y + dy}`;
      if (seen.has(key) || !open(x + dx, y + dy) || blocked.has(key)) continue;
      seen.add(key);
      stack.push([x + dx, y + dy]);
    }
  }
  const reach = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]].some(([dx, dy]) => seen.has(`${ks.x + dx},${ks.y + dy}`));
  assert.ok(reach, 'the key bench can still be reached');
  // and the walkers' straight legs are open floor (patrols have no pathfinding)
  const walker = lab.find((e) => e.kind === 'patrol');
  const [a, b] = walker.waypoints;
  for (let s = 0; s <= 10; s++) assert.ok(open(Math.round(a.x + ((b.x - a.x) * s) / 10), Math.round(a.y + ((b.y - a.y) * s) / 10)));
});
