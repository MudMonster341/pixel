// FB-0077: "See if you can add in animation of this opening when we near it so it opens and stays open." (the red/white boom barrier across the Gate 2
// avenue, lowered since FB-0052). It now starts LOWERED exactly as before, and when she comes within a few tiles it plays the P4c door animation
// (lowered -> half-raised -> fully raised, about 0.6 s, with the door sound and a latch click) and then STAYS up: the open frame goes into the
// structures layer and the saved flag `gateBarrierOpen` keeps it up after a reload.
//
// Pinned here, against the REAL generated campus (assets/maps/campus.json), the real tile sheet and the real data:
//   - the `gateBarrier` objects (three parts) carry closed/half/open frames that match tools/lib/door-kinds.js gateBarrierParts(), the closed frame is
//     what the map shows, the new tiles were appended at the end (no earlier gid moved), they are drawn and not solid, and the lowered art is untouched;
//   - the pure rules (box, range, saved-state migration) and the save round trip, including old saves;
//   - the engine's own methods (createGateBarrier / updateGateBarrier / setGateBarrierOpen / showDoorOverlay) on a stand-in scene (the scene needs a
//     browser; its barrier rules do not): it starts lowered, opens in range, never closes, builds open at once when the flag is set;
//   - she can walk the same way through the barrier row before and after it opens, the Gate 2 welcome / RTA bus opening / M1 keep their places.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');
const { gateBarrierParts } = require('../../tools/lib/door-kinds');

const game = loadGameData();
game.runScript('src/scenes/world.js');
const { MAPS, STORY, SCRIPTS, MOMENTS, tileInfo, tiledObjects, doorFrames, doorFrameAt, doorAnimDuration, DOOR_FRAME_MS, DOOR_ANIM_FAILSAFE_MS } = game;
const evaluate = game.evaluate;
const WorldScene = evaluate('WorldScene');
const [gateBarrierBox, gateBarrierNear, isGateBarrierOpen, doorCellAt, parseDoorCells, BLANK] = ['gateBarrierBox', 'gateBarrierNear', 'isGateBarrierOpen', 'doorCellAt', 'parseDoorCells', 'BLANK_TILE_NAME'].map(evaluate);
const T = 16;
const NAMES = tileInfo.tiles.map((t) => t.name);
const INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const json = JSON.parse(read('assets', 'maps', 'campus.json'));
const W = json.width;
const layer = (name) => json.layers.find((l) => l.name === name).data;
const ground = layer('ground');
const structures = layer('structures');
const objects = tiledObjects(json);
const parts = objects.filter((o) => o.type === 'gateBarrier');
const gate = objects.find((o) => o.type === 'gate' && /Gate 2/.test(o.name));
const gateX = Math.floor(gate.x);
const gateY = Math.floor(gate.y);
const spawn = objects.find((o) => o.type === 'spawn');
const nameAt = (arr, x, y) => (arr[y * W + x] > 0 ? NAMES[arr[y * W + x] - 1] : null);
const NEW_TILES = ['barrierRestOpen', 'barrierPivotHalf', 'barrierHalfMast', 'barrierHalfElbow', 'barrierPivotUp', 'barrierUpMid', 'barrierUpTop'];

// The barrier as the map has it: the row part's first cell is the support post, its last the pivot housing.
const rowPart = parts.find((o) => o.name === 'Gate 2 barrier');
const restX = Math.floor(rowPart.x);
const row = Math.floor(rowPart.y);
const armCount = parseDoorCells(rowPart.props.cells).w - 2;
const pivotX = restX + armCount + 1;

// The parts as the engine builds them (world.js createGateBarrier()).
function enginePart(o) {
  const cells = parseDoorCells(o.props.cells);
  return { name: o.name, x: Math.floor(o.x), y: Math.floor(o.y), cellsW: cells.w, cellsH: cells.h, frames: doorFrames(o.props) };
}
const barrierParts = parts.map(enginePart);

// The structures layer with the barrier in one of its states.
function structuresIn(state) {
  const copy = Array.from(structures);
  for (const part of barrierParts) {
    const names = part.frames[{ closed: 0, half: 1, open: 2 }[state]];
    names.forEach((name, i) => {
      const cell = doorCellAt(part, i);
      copy[cell.y * W + cell.x] = name === BLANK ? 0 : INDEX[name] + 1;
    });
  }
  return copy;
}
const solidIn = (struct, x, y) => tileInfo.tiles[(struct[y * W + x] > 0 ? struct[y * W + x] : ground[y * W + x]) - 1].solid;
function reach(struct, from) {
  const seen = new Uint8Array(W * json.height);
  const stack = [from];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= json.height || seen[y * W + x] || solidIn(struct, x, y)) continue;
    seen[y * W + x] = 1;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
function tilePixels(name) {
  const i = INDEX[name];
  assert.ok(i >= 0, `no tile named "${name}"`);
  const out = Buffer.alloc(T * T * 4);
  const x0 = (i % tileInfo.columns) * T;
  const y0 = Math.floor(i / tileInfo.columns) * T;
  for (let y = 0; y < T; y++) png.data.copy(out, y * T * 4, ((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + T) * 4);
  return out;
}
const opaqueCount = (name) => { const px = tilePixels(name); let n = 0; for (let a = 3; a < px.length; a += 4) if (px[a] === 255) n++; return n; };
const colourCount = (name, [r, g, b]) => { const px = tilePixels(name); let n = 0; for (let k = 0; k < px.length; k += 4) if (px[k] === r && px[k + 1] === g && px[k + 2] === b && px[k + 3] === 255) n++; return n; };

// ======================================================================================================
// 1. The generated data
// ======================================================================================================

test('FB-0077: the campus carries the Gate 2 barrier as three door-like `gateBarrier` parts (the row, the mast above the housing, the elbow), each with closed/half/open frames from door-kinds.js', () => {
  assert.equal(parts.length, 3);
  assert.deepEqual(parts.map((p) => p.name), ['Gate 2 barrier', 'Gate 2 barrier mast', 'Gate 2 barrier elbow']);
  const want = gateBarrierParts(armCount);
  parts.forEach((o, i) => {
    assert.equal(o.props.cells, want[i].cells, o.name);
    assert.deepEqual([o.props.closedTiles, o.props.halfTiles, o.props.openTiles], [want[i].closed.join(','), want[i].half.join(','), want[i].open.join(',')], o.name);
    assert.equal(doorFrames(o.props).length, 3, `${o.name}: closed, half and open`);
    const cells = parseDoorCells(o.props.cells);
    for (const names of doorFrames(o.props)) assert.equal(names.length, cells.w * cells.h, `${o.name}: one tile name per cell`);
    for (const name of doorFrames(o.props).flat()) assert.ok(name === BLANK || name in INDEX, `${o.name}: "${name}" is not a tile`);
  });
  // where they stand: the row from the support post to the pivot housing on the gate line, the mast above the housing, the elbow above-left of it
  assert.equal(row, gateY - 1, 'the gate line');
  assert.deepEqual([Math.floor(parts[1].x), Math.floor(parts[1].y)], [pivotX, row - 2]);
  assert.deepEqual([Math.floor(parts[2].x), Math.floor(parts[2].y)], [pivotX - 1, row - 1]);
  assert.equal(nameAt(structures, restX, row), 'barrierRest');
  assert.equal(nameAt(structures, pivotX, row), 'barrierPivot');
  assert.ok(armCount >= 7, 'the boom still crosses the whole road');
});

test('FB-0077: it STARTS LOWERED: the map still shows the whole lowered boom (post, arm tiles, housing), each part\'s closed frame is exactly what the map shows, and no raised-arm tile is on the map', () => {
  for (const part of barrierParts) {
    part.frames[0].forEach((name, i) => {
      const cell = doorCellAt(part, i);
      assert.equal(nameAt(structures, cell.x, cell.y) ?? BLANK, name, `${part.name}: the map shows something else at ${cell.x},${cell.y}`);
    });
  }
  for (let x = restX + 1; x < pivotX; x++) assert.equal(nameAt(structures, x, row), 'barrierArm', `a gap in the lowered boom at ${x},${row}`);
  const used = new Set([...structures, ...ground, ...layer('overhead')].filter((g) => g > 0).map((g) => NAMES[g - 1]));
  for (const name of NEW_TILES) assert.ok(!used.has(name), `${name} is already on the map: the barrier must start lowered`);
  // the cells the raised boom will stand in are empty lawn / pavement at the start
  for (const [x, y] of [[pivotX, row - 1], [pivotX, row - 2], [pivotX - 1, row - 1]]) assert.equal(nameAt(structures, x, y), null, `${x},${y} must be free for the raised boom`);
});

test('FB-0077: the seven new tiles were APPENDED at the end of the sheet (no earlier gid moved), are not solid, and are really drawn; the lowered pieces are unchanged', () => {
  assert.equal(NAMES.length, 498);
  assert.deepEqual(NAMES.slice(-7), NEW_TILES, 'the new tiles are the last seven, in this order');
  assert.equal(NAMES[490], 'intTechLightBarR', 'the last tile before them is still where it was');
  assert.equal(INDEX.intTechFloor, 422, 'an earlier appended kit has not moved');
  assert.deepEqual(['barrierArm', 'barrierPivot', 'barrierRest'].map((n) => INDEX[n]), [251, 342, 343], 'the lowered barrier\'s own tiles keep their gids');
  for (const name of NEW_TILES) {
    assert.equal(tileInfo.tiles[INDEX[name]].solid, false, `${name} must not block her (the gate stays passable on foot)`);
    assert.ok(opaqueCount(name) > 10, `${name} is not drawn`);
  }
  // the lowered boom's picture is untouched: the stripes of FB-0052 (red c0392b, white) on row 6 of the arm tile and its pivot housing
  const px = tilePixels('barrierArm');
  const at = (x, y) => [...px.subarray((y * T + x) * 4, (y * T + x) * 4 + 4)];
  assert.deepEqual(at(0, 0), [0, 0, 0, 0], 'transparent above the lowered boom');
  assert.deepEqual(at(0, 6), [0xc0, 0x39, 0x2b, 255], 'a red band');
  assert.deepEqual(at(2, 6), [255, 255, 255, 255], 'then a white one');
  assert.ok(opaqueCount('barrierPivot') > 80 && opaqueCount('barrierRest') > 40);
});

test('FB-0077: the raised boom reads as a real boom barrier: red AND white stripes (outlined), standing up in the mast tiles beside the pivot housing; the half-raised boom is a slanted red/white bar; the post is empty', () => {
  const RED = [0xc0, 0x39, 0x2b];
  const WHITE = [255, 255, 255];
  for (const name of ['barrierUpMid', 'barrierUpTop']) {
    const least = name === 'barrierUpMid' ? 8 : 3; // the top tile holds only the boom's last 8 rows
    assert.ok(colourCount(name, RED) >= least && colourCount(name, WHITE) >= least, `${name}: red and white stripes`);
    // vertical: a whole column band with the same x range on every opaque row of the mid tile
    const px = tilePixels(name);
    const xs = new Set();
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) if (px[(y * T + x) * 4 + 3] === 255 && !(name === 'barrierUpTop' && y < 8)) xs.add(x);
    assert.ok(xs.size <= 7, `${name}: a vertical bar, not a blob (${[...xs]})`);
  }
  assert.ok(colourCount('barrierUpMid', RED) > colourCount('barrierUpMid', [0x1a, 0x1c, 0x2c]) / 4, 'the outline does not swamp the stripes');
  for (const name of ['barrierPivotHalf', 'barrierHalfMast', 'barrierHalfElbow']) assert.ok(colourCount(name, RED) + colourCount(name, WHITE) >= 4, `${name}: part of the red/white boom`);
  // the half-raised boom rises towards the west: its pixels in the elbow tile (above-left) sit further up as they go left
  const elbow = tilePixels('barrierHalfElbow');
  const topRowOf = (x) => { for (let y = 0; y < T; y++) if (elbow[(y * T + x) * 4 + 3] === 255) return y; return null; };
  const colsDrawn = [...Array(T).keys()].filter((x) => topRowOf(x) !== null);
  assert.ok(colsDrawn.length >= 4, 'the elbow tile holds the boom\'s upper end');
  assert.ok(topRowOf(colsDrawn[0]) < topRowOf(colsDrawn[colsDrawn.length - 1]), 'a slanted boom: higher at its tip (west) than where it meets the mast tile');
  // the support post after it opens has no boom tip on it: the boom\'s white stripe pixels of `barrierRest` are gone
  assert.ok(colourCount('barrierRest', WHITE) > colourCount('barrierRestOpen', WHITE), 'the open post carries no boom tip');
  // the pivot housing is still there in both raised poses (the grey body and the red cap at the same place as the lowered one)
  for (const name of ['barrierPivot', 'barrierPivotHalf', 'barrierPivotUp']) assert.ok(colourCount(name, [0x9a, 0x9a, 0x9a]) >= 20, `${name}: the grey housing`);
});

// ======================================================================================================
// 2. The pure rules
// ======================================================================================================

test('FB-0077: gateBarrierBox / gateBarrierNear / doorCellAt: the barrier\'s box covers all its parts, "near" is within `range` tiles on either axis, cells lay out like the door overlay does', () => {
  const box = gateBarrierBox(barrierParts);
  assert.deepEqual(plain(box), { x0: restX, y0: row - 2, x1: pivotX, y1: row });
  const range = STORY.gateBarrier.range;
  assert.ok(range >= 3 && range <= 5, 'about 4 tiles');
  assert.equal(gateBarrierNear(box, gateX, row + range, range), true, 'four tiles south of the gate line (just outside the fence): it starts to rise');
  assert.equal(gateBarrierNear(box, gateX, row + range + 1, range), false, 'five tiles south: still lowered');
  assert.equal(gateBarrierNear(box, restX - range, row, range), true);
  assert.equal(gateBarrierNear(box, restX - range - 1, row, range), false);
  assert.equal(gateBarrierNear(box, pivotX + range, row - 2, range), true);
  assert.equal(gateBarrierNear(box, gateX, row - 2 - range, range), true, 'inside the gate, walking away: still in range');
  assert.equal(gateBarrierNear(box, gateX, row - 2 - range - 1, range), false);
  assert.equal(gateBarrierNear(null, 0, 0, 4), false);
  // the spawn (and the bus stop) are nowhere near
  assert.equal(gateBarrierNear(box, Math.floor(spawn.x), Math.floor(spawn.y), range), false, 'the spawn is far south of the barrier');
  assert.deepEqual([0, 1, 2].map((i) => plain(doorCellAt({ x: 5, y: 7, cellsW: 3, cellsH: 1 }, i))), [{ x: 5, y: 7 }, { x: 6, y: 7 }, { x: 7, y: 7 }]);
  assert.deepEqual([0, 1].map((i) => plain(doorCellAt({ x: 5, y: 7, cellsW: 1, cellsH: 2 }, i))), [{ x: 5, y: 7 }, { x: 5, y: 8 }]);
  assert.equal(BLANK, '-');
});

test('FB-0077: isGateBarrierOpen: the flag, a seen Gate 2 welcome or a begun hunt keep it up; a fresh game does not; no data means nothing to lower', () => {
  const b = STORY.gateBarrier;
  const fresh = () => ({ flags: {}, seenCutscenes: new Set(), quest: { stage: 'arrival', keys: {} } });
  assert.equal(isGateBarrierOpen(b, fresh()), false);
  assert.equal(isGateBarrierOpen(b, { ...fresh(), flags: { gateBarrierOpen: true } }), true);
  assert.equal(isGateBarrierOpen(b, { ...fresh(), seenCutscenes: new Set(['gate2']) }), true);
  assert.equal(isGateBarrierOpen(b, { ...fresh(), seenCutscenes: new Set(['entrance']) }), false);
  assert.equal(isGateBarrierOpen(b, { ...fresh(), quest: { stage: 'hunting', keys: {} } }), true);
  assert.equal(isGateBarrierOpen(b, { ...fresh(), quest: { stage: 'rewarded', keys: {} } }), true);
  assert.equal(isGateBarrierOpen(null, fresh()), true);
  assert.equal(isGateBarrierOpen(b, { flags: {}, quest: { stage: 'arrival' } }), false, 'a state with no seenCutscenes does not throw');
  assert.deepEqual(plain(MAPS.campus.gateBarrier), plain(b), 'the campus def points at the story data');
  assert.equal(b.flag, 'gateBarrierOpen');
  assert.equal(b.map, 'campus');
  assert.ok(b.frameMs * 2 >= 500 && b.frameMs * 2 <= 700, `closed -> half -> open takes ${b.frameMs * 2} ms: about 0.6 s`);
});

// ======================================================================================================
// 3. Saves: the flag is kept, old saves migrate
// ======================================================================================================

test('FB-0077: the flag is saved and restored; a new game starts with the barrier lowered', () => {
  const { GameState, saveGame, loadGame, resetGameState } = loadGameData();
  assert.equal(GameState.flags.gateBarrierOpen, undefined);
  GameState.flags.gateBarrierOpen = true;
  saveGame('default', GameState);
  GameState.flags = {};
  loadGame('default', GameState);
  assert.equal(GameState.flags.gateBarrierOpen, true, 'still up after a reload / Continue');
  resetGameState(GameState);
  assert.equal(GameState.flags.gateBarrierOpen, undefined, 'a new game: lowered again');
});

function oldSave(over) {
  return {
    version: 1, savedAt: 1, profile: 'default',
    state: { map: 'campus', position: { x: 245, y: 171 }, facing: 'up', inventory: { slots: [null, null, null, null, null], selected: 0 }, flags: { tomasGaveSword: false, tomasChats: 0 },
      quest: { stage: 'arrival', keys: { physicsLab: false, icl: false, room195: false } }, minigames: {}, journal: [], collected: [], seenCutscenes: [], seenDialog: [], seenHints: [], ...over },
  };
}
function loadOld(over) {
  const g = loadGameData();
  g.localStorage.setItem('pixelquest.save.v1.default', JSON.stringify(oldSave(over)));
  assert.equal(g.loadGame('default', g.GameState), true);
  return g.GameState;
}

test('FB-0077 migration: an old save that has seen the Gate 2 welcome, begun the hunt or stands inside a building loads with the barrier UP; one still outside the gate loads lowered', () => {
  assert.equal(loadOld({ seenCutscenes: ['gate2'] }).flags.gateBarrierOpen, true, 'the Gate 2 welcome has played');
  assert.equal(loadOld({ quest: { stage: 'hunting', keys: { physicsLab: false, icl: false, room195: false } } }).flags.gateBarrierOpen, true, 'the hunt has begun');
  assert.equal(loadOld({ quest: { stage: 'rewarded', keys: { physicsLab: true, icl: true, room195: true } } }).flags.gateBarrierOpen, true, 'the hunt is over');
  assert.equal(loadOld({ map: 'main-block-g', position: { x: 15, y: 20 } }).flags.gateBarrierOpen, true, 'she is inside the Main Block');
  assert.equal(loadOld({ seenCutscenes: ['gate2'], flags: { gateBarrierOpen: true } }).flags.gateBarrierOpen, true, 'an already-set flag stays set');
  assert.equal(loadOld({}).flags.gateBarrierOpen, undefined, 'still outside the gate, nothing seen: it will open when she gets there');
  assert.equal(loadOld({ seenCutscenes: ['entrance'] }).flags.gateBarrierOpen, undefined, 'another cutscene alone does not raise it');
});

test('FB-0077 migration: it goes through the same load path as every other legacy id (migrate() -> renameLegacyIds() -> applyState()), and a legacy-named save still loads', () => {
  const src = read('src', 'save.js');
  assert.match(src, /if \(payload\.version === SAVE_VERSION\) return \{ \.\.\.payload, state: renameLegacyIds\(payload\.state\) \};/);
  assert.match(src, /const barrier = typeof STORY !== 'undefined' \? STORY\.gateBarrier : null;/);
  assert.match(src, /isGateBarrierOpen\(barrier, state\)/);
  // the migration only ever ADDS the flag: nothing else of the save is touched, and the saved copy of a migrated state carries it forward
  const g = loadGameData();
  g.localStorage.setItem('pixelquest.save.v1.default', JSON.stringify(oldSave({ seenCutscenes: ['gate2'] })));
  g.loadGame('default', g.GameState);
  assert.deepEqual(plain(g.GameState.flags), { tomasGaveSword: false, tomasChats: 0, gateBarrierOpen: true });
  assert.deepEqual([...g.GameState.seenCutscenes], ['gate2']);
  g.saveGame('default', g.GameState);
  assert.equal(JSON.parse(g.localStorage.getItem('pixelquest.save.v1.default')).state.flags.gateBarrierOpen, true, 'the next autosave keeps it');
});

// ======================================================================================================
// 4. The engine, on a stand-in scene
// ======================================================================================================

function standIn({ player = { x: spawn.x * T, y: spawn.y * T }, flag = false } = {}) {
  const { GameState } = game;
  GameState.flags = flag ? { gateBarrierOpen: true } : {};
  const scene = Object.create(WorldScene.prototype);
  const calls = [];
  const overlays = [];
  scene.def = MAPS.campus;
  scene.mapKey = 'campus';
  scene.mapObjects = objects;
  scene.tileInfo = tileInfo;
  scene.player = { x: player.x, y: player.y };
  scene.solidLayers = [
    { layer: { name: 'ground' } },
    { layer: { name: 'structures' }, putTileAt: (gid, x, y) => calls.push({ put: gid, x, y }), removeTileAt: (x, y) => calls.push({ removed: true, x, y }) },
  ];
  scene.showDoorOverlay = (warp) => {
    const o = { warp, opened: false, destroyed: false, finish: null, open(cb) { o.opened = true; o.finish = cb; }, destroy() { o.destroyed = true; } };
    overlays.push(o);
    return o;
  };
  const sounds = [];
  game.AudioManager.play = (name) => sounds.push(name);
  return { scene, calls, overlays, sounds, GameState };
}
const atTile = (x, y) => ({ x: (x + 0.5) * T, y: (y + 0.5) * T });
const openFrameOf = (part) => part.frames[2];
const cellsOfAll = () => barrierParts.flatMap((part) => part.frames[2].map((name, i) => ({ part, name, cell: doorCellAt(part, i) })));

test('FB-0077: createGateBarrier() builds the barrier from the map\'s objects and leaves it LOWERED for a fresh game: no tile changes, no flag, not open', () => {
  const { scene, calls, overlays, GameState } = standIn();
  scene.createGateBarrier();
  assert.ok(scene.gateBarrier, 'the campus has a barrier');
  assert.equal(scene.gateBarrier.parts.length, 3);
  assert.equal(scene.gateBarrier.open, false);
  assert.equal(calls.length, 0, 'the lowered boom stays as drawn');
  assert.equal(overlays.length, 0);
  assert.equal(GameState.flags.gateBarrierOpen, undefined);
  // a map with no barrier objects (an interior) or no data builds nothing and never throws
  const none = standIn();
  none.scene.mapObjects = [];
  none.scene.createGateBarrier();
  assert.equal(none.scene.gateBarrier, null);
  none.scene.updateGateBarrier();
  const noDef = standIn();
  noDef.scene.def = MAPS['main-block-g'];
  noDef.scene.createGateBarrier();
  assert.equal(noDef.scene.gateBarrier, null);
});

test('FB-0077: far away it stays lowered; within range it plays closed -> half -> open on EVERY part (slow pace, ground level), the door sound at the start and the latch click at the end', () => {
  const { scene, calls, overlays, sounds, GameState } = standIn();
  scene.createGateBarrier();
  const range = STORY.gateBarrier.range;
  scene.player = atTile(gateX, row + range + 1);
  scene.updateGateBarrier();
  assert.equal(scene.gateBarrier.open, false, 'five tiles out: nothing happens');
  assert.equal(overlays.length, 0);
  scene.player = atTile(gateX, row + range); // walks up to four tiles from it
  scene.updateGateBarrier();
  assert.equal(scene.gateBarrier.open, true);
  assert.equal(GameState.flags.gateBarrierOpen, true, 'the flag is set the moment it starts: it never lowers again, even if she warps away mid-way');
  assert.equal(overlays.length, 3, 'one overlay per part');
  assert.deepEqual(overlays.map((o) => o.warp.name), barrierParts.map((p) => p.name));
  for (const o of overlays) {
    assert.deepEqual(plain(o.warp.frames), plain(barrierParts.find((p) => p.name === o.warp.name).frames), 'the full closed/half/open frames');
    assert.equal(o.warp.frameMs, STORY.gateBarrier.frameMs, 'slower than a door');
    assert.equal(o.warp.depth, 1, 'right over the tile layers, under every character');
    assert.equal(o.opened, true);
  }
  assert.deepEqual(sounds, ['doorOpen']);
  // the lowered tiles were cleared as it began (the overlay's first frame is that very picture); nothing is placed until it ends
  const cleared = calls.filter((c) => c.removed);
  assert.equal(cleared.length, cellsOfAll().length, 'every cell of every part is cleared');
  assert.equal(calls.filter((c) => c.put).length, 0);
  assert.ok(overlays.every((o) => !o.destroyed));
  // two parts finish: still waiting; the last one: the open frame goes into the layer, the overlays go, the latch clicks
  overlays[0].finish(); overlays[1].finish();
  assert.equal(calls.filter((c) => c.put).length, 0, 'not before every part has finished');
  overlays[2].finish();
  const puts = calls.filter((c) => c.put);
  const wantPuts = cellsOfAll().filter((c) => c.name !== BLANK);
  assert.deepEqual(puts.map((c) => [c.x, c.y, c.put]).sort(), wantPuts.map((c) => [c.cell.x, c.cell.y, INDEX[c.name] + 1]).sort(), 'the open frame: the open post, the raised boom (housing, mid, top)');
  assert.deepEqual(puts.map((c) => NAMES[c.put - 1]).sort(), ['barrierPivotUp', 'barrierRestOpen', 'barrierUpMid', 'barrierUpTop']);
  assert.ok(overlays.every((o) => o.destroyed));
  assert.deepEqual(sounds, ['doorOpen', 'doorClose']);
});

test('FB-0077: it STAYS open: once up, walking away, coming back, or any later update changes nothing and plays nothing', () => {
  const { scene, calls, overlays, sounds } = standIn();
  scene.createGateBarrier();
  scene.player = atTile(gateX, row + 3);
  scene.updateGateBarrier();
  overlays.forEach((o) => o.finish());
  const callsAfter = calls.length;
  const soundsAfter = sounds.length;
  for (const p of [atTile(gateX, row + 30), atTile(gateX, row - 20), atTile(gateX, row + 2), atTile(restX, row)]) {
    scene.player = p;
    scene.updateGateBarrier();
    scene.setGateBarrierOpen(true);
  }
  assert.equal(calls.length, callsAfter, 'no tile is touched again');
  assert.equal(overlays.length, 3, 'no second animation');
  assert.equal(sounds.length, soundsAfter);
  assert.equal(scene.gateBarrier.open, true);
  // and there is no code path that lowers it: no `close` call for the barrier in the scene
  const src = read('src', 'scenes', 'world.js');
  const body = src.slice(src.indexOf('  createGateBarrier() {'), src.indexOf('  // A key station whose key is now held'));
  assert.doesNotMatch(body, /\.close\(/, 'the barrier never plays its closing');
  assert.doesNotMatch(body, /flags\[[^\]]+\]\s*=\s*(false|undefined|null)/, 'nothing clears the flag');
});

test('FB-0077: a scene that finds the flag already set (a reload / Continue, or coming back out of a building) builds the barrier UP at once: the open tiles are in the layer, no animation, no sound', () => {
  const { scene, calls, overlays, sounds } = standIn({ flag: true });
  scene.createGateBarrier();
  assert.equal(scene.gateBarrier.open, true);
  assert.equal(overlays.length, 0, 'no animation on load');
  assert.equal(sounds.length, 0);
  const puts = calls.filter((c) => c.put);
  assert.deepEqual(puts.map((c) => NAMES[c.put - 1]).sort(), ['barrierPivotUp', 'barrierRestOpen', 'barrierUpMid', 'barrierUpTop']);
  const removed = calls.filter((c) => c.removed);
  assert.equal(removed.length, armCount + 1, 'the arm tiles are cleared (and the elbow cell, which is empty again once it is up)');
  for (const c of removed) assert.ok(c.y === row || (c.x === pivotX - 1 && c.y === row - 1), `unexpected clear at ${c.x},${c.y}`);
  // the cells of the open frame are exactly the ones planned in the generated data
  assert.deepEqual(puts.map((c) => `${c.x},${c.y}`).sort(), [`${restX},${row}`, `${pivotX},${row}`, `${pivotX},${row - 1}`, `${pivotX},${row - 2}`].sort());
  // she is not standing anywhere special: the scene without a player yet never throws
  const early = standIn();
  early.scene.player = null;
  early.scene.createGateBarrier();
  early.scene.updateGateBarrier();
});

test('FB-0077: showDoorOverlay() plays a part at its own pace (frameMs), at the depth it is given, and a blank "-" frame hides that cell without a warning', () => {
  const images = [];
  const counters = [];
  const timers = [];
  const scene = Object.create(WorldScene.prototype);
  scene.tileInfo = tileInfo;
  scene.depthGroups = [];
  scene.doorAnims = new Map();
  scene.ensureTileFrames = () => {};
  scene.add = { image(x, y, texture, frame) { const img = { x, y, frame, visible: true, depth: 0, setOrigin() { return this; }, setDepth(d) { this.depth = d; return this; }, setFrame(f) { this.frame = f; return this; }, setVisible(v) { this.visible = v; return this; }, destroy() {} }; images.push(img); return img; } };
  scene.tweens = { addCounter(config) { const c = { config, value: 0, stop() {}, getValue() { return this.value; } }; counters.push(c); return c; } };
  scene.time = { delayedCall(ms, fn) { const t = { ms, fn, remove() {} }; timers.push(t); return t; } };
  const warns = [];
  const realWarn = console.warn;
  console.warn = (m) => warns.push(m);
  try {
    const row = barrierParts[0];
    const overlay = scene.showDoorOverlay({ name: row.name, x: row.x, y: row.y, cellsW: row.cellsW, cellsH: row.cellsH, frames: row.frames, frameMs: 300, depth: 1 });
    assert.equal(images.length, row.cellsW, 'one image per cell of the row');
    assert.ok(images.every((i) => i.depth === 1), 'the given depth, not the door rule');
    assert.equal(images[1].visible, true);
    assert.equal(images[1].frame, INDEX.barrierArm, 'frame 0 is the lowered boom as drawn');
    overlay.open(() => {});
    const c = counters[0];
    assert.equal(c.config.duration, 2 * 300, 'three frames, 300 ms apiece: 0.6 s');
    assert.equal(timers[0].ms, 2 * 300 + DOOR_ANIM_FAILSAFE_MS);
    c.value = 300; c.config.onUpdate(c); // the half frame: the arm tiles are gone, the pivot is the half-raised housing
    assert.equal(images[1].visible, false, 'an arm cell is blank in the half frame');
    assert.equal(images[0].frame, INDEX.barrierRestOpen);
    assert.equal(images.at(-1).frame, INDEX.barrierPivotHalf);
    c.value = 599; c.config.onUpdate(c);
    assert.equal(images.at(-1).frame, INDEX.barrierPivotHalf, 'still the half frame just before 600 ms');
    c.config.onComplete();
    assert.equal(images.at(-1).frame, INDEX.barrierPivotUp, 'ends fully raised');
    assert.equal(images[1].visible, false);
    // a mast part stacks its two cells top to bottom; the closed frame is blank (nothing to show until it rises)
    const mast = barrierParts[1];
    const m = scene.showDoorOverlay({ name: mast.name, x: mast.x, y: mast.y, cellsW: mast.cellsW, cellsH: mast.cellsH, frames: mast.frames, frameMs: 300, depth: 1 });
    const mastImages = images.slice(row.cellsW);
    assert.deepEqual(mastImages.map((i) => [i.x, i.y]), [[mast.x * T, mast.y * T], [mast.x * T, (mast.y + 1) * T]]);
    assert.ok(mastImages.every((i) => i.visible === false), 'nothing visible at rest');
    m.open(() => {});
    const mc = counters[1];
    mc.value = 600; mc.config.onUpdate(mc);
    assert.deepEqual(mastImages.map((i) => [i.visible, i.frame]), [[true, INDEX.barrierUpTop], [true, INDEX.barrierUpMid]]);
  } finally {
    console.warn = realWarn;
  }
  assert.deepEqual(warns, [], 'a blank frame is not an unknown tile');
  // a door with no frameMs/depth still plays at the door pace (the P4c tests pin the rest)
  assert.equal(doorAnimDuration(3), 2 * DOOR_FRAME_MS);
  assert.equal(doorFrameAt(300, 3, 300, false), 1);
});

test('FB-0077: world.js wires it: created with the gates, updated every frame BEFORE the transitioning early-return, and the barrier has no close path', () => {
  const src = read('src', 'scenes', 'world.js');
  assert.match(src, /this\.createGates\(\);\s*this\.createTileAnims\(\);\s*this\.createGateBarrier\(\);/);
  assert.match(src, /this\.updateGateBarrier\(\);[^\n]*\n\s*if \(this\.transitioning\) return;/);
  assert.match(src, /const depth = warp\.depth \?\? this\.doorOverlayDepth\(warp\);/);
  assert.match(src, /doorAnimDuration\(n, frameMs\)/);
  assert.match(src, /doorFrameAt\(tween\.getValue\(\), n, frameMs, reverse\)/);
  assert.match(src, /if \(name === BLANK_TILE_NAME\) return -1;/);
  const gen = read('tools', 'campus', 'build-campus.js');
  assert.match(gen, /gateBarrierParts\(gateBarrier\.armCount\)/);
  assert.match(gen, /pointObject\('gateBarrier'/);
  assert.match(read('index.html'), /src\/maplogic\.js/);
});

// ======================================================================================================
// 5. She can still walk everywhere, before and after
// ======================================================================================================

test('FB-0077: collision: every barrier tile, in all three states, is walkable ground-wise: she walks the SAME old path through the barrier row before and after it opens', () => {
  for (const state of ['closed', 'half', 'open']) {
    const s = structuresIn(state);
    for (const part of barrierParts) {
      part.frames[{ closed: 0, half: 1, open: 2 }[state]].forEach((name, i) => {
        const c = doorCellAt(part, i);
        assert.equal(solidIn(s, c.x, c.y), false, `${state}: ${name} at ${c.x},${c.y} blocks her`);
      });
    }
    // straight through the gate: from outside the fence up the avenue, over the whole barrier row
    for (let y = gateY + 6; y >= gateY - 8; y--) {
      for (const x of [gateX - 2, gateX, gateX + 2]) assert.equal(solidIn(s, x, y), false, `${state}: (${x},${y}) is blocked`);
    }
    for (let x = restX; x <= pivotX; x++) assert.equal(solidIn(s, x, row), false, `${state}: the barrier row is blocked at ${x}`);
  }
  // the reachable area from the spawn is the same set of tiles lowered, half-raised and raised
  const from = [Math.floor(spawn.x), Math.floor(spawn.y)];
  const base = reach(structures, from);
  const count = (arr) => arr.reduce((a, b) => a + b, 0);
  for (const state of ['closed', 'half', 'open']) {
    const seen = reach(structuresIn(state), from);
    assert.equal(count(seen), count(base), `${state}: a different area is reachable`);
    assert.deepEqual([...seen], [...base], `${state}: the reachable tiles differ`);
  }
  // and it includes the Gate 2 welcome trigger, the road to the Main Block and its door
  const cutscene = json.layers.find((l) => l.type === 'objectgroup').objects.find((o) => o.type === 'cutscene' && o.name === 'Gate 2 entrance');
  assert.ok(base[Math.floor(cutscene.y / T) * W + Math.floor(cutscene.x / T) + 1], 'the Gate 2 welcome trigger is reachable');
  const door = objects.find((o) => o.type === 'door' && o.name === 'Main Block entrance');
  assert.ok(base[(Math.floor(door.y) + 1) * W + Math.floor(door.x)], 'the Main Block door is reachable');
});

test('FB-0077: the raised boom stands clear of everything else at the gate: the booth, the pillars, the planters and the bollard keep their tiles, and no script/moment actor stands in its cells', () => {
  const cells = new Set(cellsOfAll().map((c) => `${c.cell.x},${c.cell.y}`));
  const barrierCells = new Set();
  for (const part of barrierParts) for (let i = 0; i < part.cellsW * part.cellsH; i++) { const c = doorCellAt(part, i); barrierCells.add(`${c.x},${c.y}`); }
  // every structure beside the barrier (booth, planter, bollard, flowerbed, pillar, sign) is still on its own tile and not one of the barrier's cells
  const furniture = new Set(['securityBooth', 'planter', 'bollard', 'flowerbed', 'bitsPillar', 'gateSign']);
  let seen = 0;
  for (let y = row - 3; y <= row + 1; y++) {
    for (let x = restX - 3; x <= pivotX + 4; x++) {
      const n = nameAt(structures, x, y);
      if (furniture.has(n)) { seen++; assert.ok(!barrierCells.has(`${x},${y}`), `${n} sits in a barrier cell at ${x},${y}`); }
    }
  }
  assert.ok(seen >= 5, `expected the booth, planters, bollard and pillar by the barrier, saw ${seen}`);
  // the scripted actors (the RTA bus opening, the Gate 2 welcome, M1) never stand on the barrier's tiles; they are in or around the avenue's lanes
  const gateTileOf = (point) => ({ x: gateX + Math.round(point.offset[0] + 0.5), y: gateY + Math.round(point.offset[1] + 0.5) });
  const points = [];
  const collect = (steps) => steps.forEach((s) => {
    if (s.spawnActor && s.spawnActor.at && s.spawnActor.at.anchor === 'Gate 2 (Main Entrance)') points.push(s.spawnActor.at);
    if (s.move) for (const p of s.move.path) if (p.anchor === 'Gate 2 (Main Entrance)') points.push(p);
    if (s.parallel) collect(s.parallel);
  });
  for (const key of ['opening', 'gate2', 'momentUnicorn', 'momentMevin', 'momentFriends']) collect(SCRIPTS[key]);
  assert.ok(points.length >= 8, 'the bus and unicorn points were collected');
  for (const p of points) {
    const t = gateTileOf(p);
    assert.ok(!barrierCells.has(`${t.x},${t.y}`), `a scripted actor ends on the barrier at ${t.x},${t.y}`);
  }
  // M1's trigger (the unicorn, once she is inside) starts north of the barrier's rows: opening the barrier never overlaps it
  const m1 = MOMENTS.find((m) => m.id === 'm1');
  assert.ok(gateY + m1.trigger.dy1 < row - 2, 'M1 starts north of the barrier\'s cells');
  assert.equal(barrierCells.size, armCount + 2 + 2 + 1, 'the row, the two mast cells and the elbow: nothing else');
  assert.equal(cells.size, barrierCells.size);
});

test('FB-0077: the Gate 2 welcome and the opening do not wait on, or depend on, the barrier: they are still data only (no barrier, tile or flag in any script step)', () => {
  const text = JSON.stringify([SCRIPTS.opening, SCRIPTS.gate2, SCRIPTS.momentUnicorn, SCRIPTS.momentMevin, SCRIPTS.momentChariot, SCRIPTS.momentFriends]);
  assert.doesNotMatch(text, /barrier|gateBarrier/i);
  const trigger = json.layers.find((l) => l.type === 'objectgroup').objects.find((o) => o.type === 'cutscene' && o.name === 'Gate 2 entrance');
  const triggerRows = [Math.floor(trigger.y / T), Math.floor((trigger.y + trigger.height - 1) / T)];
  assert.ok(row >= triggerRows[0] && row <= triggerRows[1], 'the Gate 2 welcome\'s trigger still spans the barrier row: she is welcomed as she walks through it, raised or not');
  // the opening starts far from the barrier: it is lowered while the bus arrives and she is led up, and rises as she nears it
  assert.ok(gateY + 23 > row + STORY.gateBarrier.range + 10, 'the bus stop is nowhere near the barrier');
});
