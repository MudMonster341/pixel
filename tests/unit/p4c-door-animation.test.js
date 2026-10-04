// P4c (FB-0067 "all doors should have an opening and closing animation"): every door and lift opens and closes.
// A door's frames are three comma-separated tile lists on its object (`closedTiles`, `halfTiles`, `openTiles`, one tile name per cell of the
// doorway), played closed -> half -> open when it opens and backward when it closes (src/maplogic.js doorFrames()/doorFrameAt(); the
// engine side is world.js showDoorOverlay(), playDoorDeparture(), playDoorArrival(), warpTo(), playLiftArrival()). Pinned against the REAL
// generated maps and the real tiles.png, and the engine's own methods run on a stand-in scene (the scenes need a browser; their door logic
// does not). tools/lib/door-kinds.js is the one table the generators and make-assets.js take the tile names from.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');
const { DOOR_KINDS, doorProps } = require('../../tools/lib/door-kinds');

const game = loadGameData();
game.runScript('src/scenes/world.js');
const { MAPS, SOUNDS, tileInfo, tiledObjects, buildTileGrid, doorFrames, doorFrameAt, doorAnimDuration, DOOR_FRAME_MS, DOOR_ANIM_FAILSAFE_MS } = game;
const WorldScene = game.evaluate('WorldScene');
const T = 16;
const NAMES = tileInfo.tiles.map((t) => t.name);
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));

// The pixels of one tile of the real sheet.
function tilePixels(name) {
  const i = NAMES.indexOf(name);
  assert.ok(i >= 0, `no tile named "${name}" in assets/tiles.json`);
  const x0 = (i % tileInfo.columns) * T;
  const y0 = Math.floor(i / tileInfo.columns) * T;
  assert.ok(x0 + T <= png.width && y0 + T <= png.height, `${name} lies outside tiles.png (${png.width}x${png.height})`);
  const out = Buffer.alloc(T * T * 4);
  for (let y = 0; y < T; y++) png.data.copy(out, y * T * 4, ((y0 + y) * png.width + x0) * 4, ((y0 + y) * png.width + x0 + T) * 4);
  return out;
}

// Every enterable door and lift of every map, as the engine sees it: { map, name, kind, cells, frames, x, y }.
function allDoors() {
  const found = [];
  for (const [key, def] of Object.entries(MAPS)) {
    const scene = Object.create(WorldScene.prototype);
    scene.def = def;
    scene.mapKey = key;
    scene.mapObjects = [];
    if (def.tiled) {
      const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.tiled}.json`), 'utf8'));
      scene.mapObjects = tiledObjects(json);
    }
    for (const w of scene.getWarpPoints()) {
      if (w.kind === 'door' && !w.closed) found.push({ map: key, name: w.name || `warp ${w.x},${w.y}`, kind: 'door', cells: w.cellsW * w.cellsH, frames: w.frames, x: w.x, y: w.y });
    }
    scene.createLifts();
    for (const l of scene.lifts) found.push({ map: key, name: l.name, kind: 'lift', cells: l.door.cellsW * l.door.cellsH, frames: l.door.frames, x: l.door.x, y: l.door.y });
  }
  return found;
}

// ---------- the pure parts ----------

test('FB-0067: doorFrames: closed, half, open in order; a missing stage is skipped; no open frame (or no door) is null', () => {
  assert.deepEqual(plain(doorFrames({ closedTiles: 'a,b', halfTiles: 'c,d', openTiles: 'e,f' })), [['a', 'b'], ['c', 'd'], ['e', 'f']]);
  assert.deepEqual(plain(doorFrames({ halfTiles: 'c', openTiles: 'e' })), [['c'], ['e']]);
  assert.deepEqual(plain(doorFrames({ openTiles: ' e , f ' })), [['e', 'f']], 'data from before P4c (only openTiles) is a single frame');
  assert.equal(doorFrames({ closedTiles: 'a', halfTiles: 'c' }), null, 'no open frame: nothing to play');
  assert.equal(doorFrames({}), null);
  assert.equal(doorFrames(undefined), null);
  assert.equal(doorFrames({ closed: true }), null, 'a closed wing door has no frames');
});

test('FB-0067: doorFrameAt: the frame showing t ms into an opening (forward) and a closing (reverse), clamped at both ends', () => {
  assert.equal(DOOR_FRAME_MS >= 70 && DOOR_FRAME_MS <= 90, true, 'a frame lasts about 70-90 ms');
  const at = (t, reverse) => doorFrameAt(t, 3, DOOR_FRAME_MS, reverse);
  assert.deepEqual([0, DOOR_FRAME_MS - 1, DOOR_FRAME_MS, 2 * DOOR_FRAME_MS - 1, 2 * DOOR_FRAME_MS].map((t) => at(t, false)), [0, 0, 1, 1, 2]);
  assert.deepEqual([0, DOOR_FRAME_MS - 1, DOOR_FRAME_MS, 2 * DOOR_FRAME_MS - 1, 2 * DOOR_FRAME_MS].map((t) => at(t, true)), [2, 2, 1, 1, 0]);
  assert.equal(at(100000, false), 2, 'a late tick stays on the last frame');
  assert.equal(at(100000, true), 0);
  assert.equal(at(-50, false), 0, 'a negative time is the first frame');
  assert.equal(at(-50, true), 2);
  assert.equal(doorFrameAt(500, 1), 0, 'a single frame is always frame 0');
  assert.equal(doorFrameAt(500, 0), 0);
  assert.equal(doorFrameAt(DOOR_FRAME_MS, 4, DOOR_FRAME_MS, false), 1);
  assert.equal(doorFrameAt(DOOR_FRAME_MS, 4, DOOR_FRAME_MS, true), 2);
});

test('FB-0067: doorAnimDuration: (frames - 1) steps, so closed -> half -> open is two steps and one frame is instant', () => {
  assert.equal(doorAnimDuration(3), 2 * DOOR_FRAME_MS);
  assert.equal(doorAnimDuration(2), DOOR_FRAME_MS);
  assert.equal(doorAnimDuration(1), 0);
  assert.equal(doorAnimDuration(0), 0);
  assert.equal(doorAnimDuration(3, 50), 100);
  assert.ok(DOOR_ANIM_FAILSAFE_MS > 0);
});

// ---------- the data: every enterable door of every map ----------

test('FB-0067: every enterable door and lift of every map has a closed, half and open frame, one tile per cell, all real tiles of the right size', () => {
  const doors = allDoors();
  const byKind = (kind) => doors.filter((d) => d.kind === kind).length;
  assert.equal(doors.filter((d) => d.map === 'campus').length, 3, 'the Main Block, Library and Mechanical entrances');
  assert.equal(doors.filter((d) => d.kind === 'door' && d.map !== 'campus' && MAPS[d.map].tiled).length, 3, 'the three interior exits');
  assert.equal(byKind('lift'), 4, 'the Main Block lift on all four floors');
  assert.equal(doors.filter((d) => !MAPS[d.map].tiled).length, 3, 'the test maps: the meadow house door and the house\'s two exit tiles');
  for (const d of doors) {
    const label = `${d.map}/${d.name}`;
    assert.ok(d.frames, `${label}: no frames`);
    assert.equal(d.frames.length, 3, `${label}: closed, half and open`);
    for (const [i, names] of d.frames.entries()) {
      assert.equal(names.length, d.cells, `${label}: frame ${i} must have one tile per cell (${d.cells})`);
      for (const name of names) {
        const px = tilePixels(name); // throws if the tile is not in tiles.json / tiles.png
        for (let a = 3; a < px.length; a += 4) assert.equal(px[a], 255, `${label}: ${name} must be fully opaque (the overlay hides the door tile beneath it)`);
      }
    }
  }
});

test('FB-0067: the three frames of every door cell are different pictures (the motion reads), and the door is two leaves where its cells are two', () => {
  for (const d of allDoors()) {
    for (let cell = 0; cell < d.cells; cell++) {
      const [closed, half, open] = d.frames.map((names) => tilePixels(names[cell]));
      assert.ok(!closed.equals(half), `${d.map}/${d.name} cell ${cell}: closed and half are the same picture`);
      assert.ok(!half.equals(open), `${d.map}/${d.name} cell ${cell}: half and open are the same picture`);
      assert.ok(!closed.equals(open), `${d.map}/${d.name} cell ${cell}: closed and open are the same picture`);
    }
    if (d.map === 'campus' || d.kind === 'lift' || (MAPS[d.map].tiled && d.kind === 'door')) assert.equal(d.cells, 2, `${d.map}/${d.name}: a real doorway is two leaves`);
  }
});

test('FB-0067: the closed frame of every door is the tile the map already shows there (the door looks the same until it plays)', () => {
  const restTile = (key, x, y) => {
    const def = MAPS[key];
    if (!def.tiled) return tileInfo.tiles[buildTileGrid(def, tileInfo)[y][x]].name;
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.tiled}.json`), 'utf8'));
    const layer = (n) => json.layers.find((l) => l.name === n).data;
    const gid = layer('structures')[y * json.width + x] || layer('ground')[y * json.width + x];
    return NAMES[gid - 1];
  };
  for (const d of allDoors()) {
    d.frames[0].forEach((name, i) => assert.equal(restTile(d.map, d.x + i, d.y), name, `${d.map}/${d.name}: the map shows ${restTile(d.map, d.x + i, d.y)} at rest, its closed frame says ${name}`));
  }
});

test('FB-0067: a door that never opens has no frames: every `closed` wing door and locked door keeps rattling', () => {
  let closedDoors = 0;
  for (const [key, def] of Object.entries(MAPS)) {
    if (!def.tiled) continue;
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.tiled}.json`), 'utf8'));
    for (const o of tiledObjects(json).filter((o) => o.type === 'door' && o.props.closed)) {
      closedDoors++;
      for (const prop of ['closedTiles', 'halfTiles', 'openTiles']) assert.equal(o.props[prop], undefined, `${key}/${o.name}: a door that never opens must not carry ${prop}`);
      assert.equal(doorFrames(o.props), null);
    }
    // and no Tiled door carries frames unless it can be entered
    for (const o of tiledObjects(json).filter((o) => o.type === 'door' && o.props.openTiles)) assert.ok(o.props.to && !o.props.closed, `${key}/${o.name}: frames on a door that is not enterable`);
  }
  assert.ok(closedDoors >= 15, `expected the wing/classroom/glass doors of the Main Block, found ${closedDoors}`);
  // the engine: a locked door rattles and NEVER plays the opening
  const scene = Object.create(WorldScene.prototype);
  scene.player = { body: { center: { x: 5 * T + 8 }, bottom: 6 * T }, active: true, anims: { stop() {} } };
  scene.prompt = { setVisible() {} };
  scene.game = { events: { emit() {} } };
  const log = [];
  scene.getWarpPoints = () => [{ x: 5, y: 5, cellsW: 2, cellsH: 1, name: 'Library Block entrance', kind: 'door', locked: true, lockedReason: 'Shut.', frames: [['a', 'b'], ['c', 'd'], ['e', 'f']] }];
  scene.rattleDoor = () => log.push('rattle');
  scene.showDoorOverlay = () => { log.push('overlay'); return null; };
  scene.playDoorDeparture = () => log.push('departure');
  scene.checkWarps();
  assert.deepEqual(log, ['rattle']);
});

test('FB-0067: the frame names on every door object are exactly their kind in tools/lib/door-kinds.js (campus, interior exits, lifts, test maps)', () => {
  for (const d of allDoors()) {
    const kind = d.kind === 'lift' ? 'lift'
      : d.map === 'campus' ? (d.name === 'Main Block entrance' ? 'campusGlass' : 'campusGlassPlain')
        : MAPS[d.map].tiled ? 'exitGlass' : 'houseDoor';
    const want = DOOR_KINDS[kind];
    assert.deepEqual(plain(d.frames), [want.closed, want.half, want.open], `${d.map}/${d.name}`);
  }
  assert.deepEqual(doorProps('lift'), { closedTiles: 'intLiftDoorL,intLiftDoorR', halfTiles: 'intLiftThirdL,intLiftThirdR', openTiles: 'intLiftOpenL,intLiftOpenR' });
  assert.throws(() => doorProps('nope'), /unknown door kind/);
  // the open art that existed before P4c still names the same open tiles
  assert.deepEqual(DOOR_KINDS.campusGlass.open, ['bitsEntranceGrandLOpen', 'bitsEntranceGrandROpen']);
  assert.deepEqual(DOOR_KINDS.lift.open, ['intLiftOpenL', 'intLiftOpenR']);
});

test('FB-0067: the timings are bounded: an opening is two frames of 70-90 ms and every door\'s blocking time stays under about 250 ms', () => {
  for (const d of allDoors()) {
    const ms = doorAnimDuration(d.frames.length);
    assert.ok(ms >= 2 * 70 && ms <= 250, `${d.map}/${d.name}: opening takes ${ms} ms`);
  }
  // the closing never adds time: on a departure it runs inside the 250 ms fade, on an arrival the player already has the controls
  assert.ok(doorAnimDuration(3) < 250);
  assert.ok(doorAnimDuration(3) + DOOR_ANIM_FAILSAFE_MS < 1000, 'the failsafe finishes a stuck animation within a second');
});

// ---------- the engine: showDoorOverlay() on a stand-in scene ----------

function fakeScene() {
  const scene = Object.create(WorldScene.prototype);
  scene.tileInfo = tileInfo;
  scene.depthGroups = [];
  scene.doorAnims = new Map();
  scene.ensureTileFrames = () => {};
  const images = [];
  const counters = [];
  const timers = [];
  scene.add = {
    image(x, y, texture, frame) {
      const img = {
        x, y, texture, frame, visible: true, depth: 0, destroyed: false,
        setOrigin() { return this; }, setDepth(d) { this.depth = d; return this; },
        setFrame(f) { this.frame = f; return this; }, setVisible(v) { this.visible = v; return this; },
        destroy() { this.destroyed = true; },
      };
      images.push(img);
      return img;
    },
  };
  scene.tweens = {
    addCounter(config) {
      const counter = { config, stopped: false, value: 0, stop() { this.stopped = true; }, getValue() { return this.value; } };
      counters.push(counter);
      return counter;
    },
  };
  scene.time = {
    delayedCall(ms, fn) {
      const timer = { ms, fn, removed: false, remove() { this.removed = true; } };
      timers.push(timer);
      return timer;
    },
  };
  return { scene, images, counters, timers };
}
const idx = (name) => NAMES.indexOf(name);
const mainWarp = (extra = {}) => ({
  name: 'Main Block entrance', x: 225, y: 128, cellsW: 2, cellsH: 1, kind: 'door',
  frames: plain([DOOR_KINDS.campusGlass.closed, DOOR_KINDS.campusGlass.half, DOOR_KINDS.campusGlass.open]), ...extra,
});

test('FB-0067: a two-tile door animates BOTH leaves: two images, each stepping closed -> half -> open on the way up and back on the way down', () => {
  const { scene, images, counters } = fakeScene();
  const overlay = scene.showDoorOverlay(mainWarp());
  assert.equal(images.length, 2, 'one image per leaf');
  assert.deepEqual(images.map((i) => [i.x, i.y]), [[225 * T, 128 * T], [226 * T, 128 * T]]);
  assert.deepEqual(images.map((i) => i.frame), DOOR_KINDS.campusGlass.closed.map(idx), 'it starts on the closed frame: the door as drawn at rest');
  let done = 0;
  overlay.open(() => done++);
  assert.equal(counters.length, 1);
  const c = counters[0];
  assert.equal(c.config.duration, doorAnimDuration(3));
  const seen = [];
  for (const t of [0, DOOR_FRAME_MS, 2 * DOOR_FRAME_MS]) { c.value = t; c.config.onUpdate(c); seen.push(images.map((i) => i.frame)); }
  assert.deepEqual(seen, [DOOR_KINDS.campusGlass.closed, DOOR_KINDS.campusGlass.half, DOOR_KINDS.campusGlass.open].map((names) => names.map(idx)));
  assert.equal(done, 0, 'not done until the counter completes');
  c.config.onComplete();
  assert.equal(done, 1);
  assert.deepEqual(images.map((i) => i.frame), DOOR_KINDS.campusGlass.open.map(idx), 'it ends on the open frame');
  // closing: the same frames backward
  overlay.close(() => done++);
  const back = counters[1];
  const seenBack = [];
  for (const t of [0, DOOR_FRAME_MS, 2 * DOOR_FRAME_MS]) { back.value = t; back.config.onUpdate(back); seenBack.push(images.map((i) => i.frame)); }
  assert.deepEqual(seenBack, [DOOR_KINDS.campusGlass.open, DOOR_KINDS.campusGlass.half, DOOR_KINDS.campusGlass.closed].map((names) => names.map(idx)));
  back.config.onComplete();
  assert.equal(done, 2);
  assert.deepEqual(images.map((i) => i.frame), DOOR_KINDS.campusGlass.closed.map(idx), 'it ends closed again');
  overlay.destroy();
  assert.ok(images.every((i) => i.destroyed));
  assert.equal(scene.doorAnims.size, 0);
});

test('FB-0067: the overlay sits above the door\'s own depth group (the door row of the building), like the open overlay always did', () => {
  const { scene, images } = fakeScene();
  scene.depthGroups = [{ x: 220, y: 120, width: 12, height: 9, depth: 129 * T }];
  scene.showDoorOverlay(mainWarp());
  assert.ok(images.every((i) => i.depth === 129 * T + 1));
});

test('FB-0067: a stuck animation is finished by its failsafe timer: the door ends on its final frame and onDone fires exactly once', () => {
  const { scene, images, counters, timers } = fakeScene();
  const overlay = scene.showDoorOverlay(mainWarp());
  let done = 0;
  overlay.open(() => done++);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, doorAnimDuration(3) + DOOR_ANIM_FAILSAFE_MS);
  timers[0].fn(); // the counter never reported in
  assert.equal(done, 1);
  assert.deepEqual(images.map((i) => i.frame), DOOR_KINDS.campusGlass.open.map(idx));
  assert.ok(counters[0].stopped, 'the counter is stopped');
  counters[0].config.onComplete(); // a late report must not run onDone twice
  assert.equal(done, 1);
});

test('FB-0067: destroying a door mid-animation (she cancels, the scene shuts down) removes images, counter and timer, and never calls onDone', () => {
  const { scene, images, counters, timers } = fakeScene();
  const overlay = scene.showDoorOverlay(mainWarp());
  let done = 0;
  overlay.open(() => done++);
  overlay.destroy();
  assert.ok(images.every((i) => i.destroyed));
  assert.ok(counters[0].stopped);
  assert.ok(timers[0].removed);
  timers[0].fn();
  counters[0].config.onUpdate(counters[0]);
  counters[0].config.onComplete();
  assert.equal(done, 0);
  assert.equal(scene.doorAnims.size, 0);
  overlay.open(() => done++); // a destroyed overlay is inert
  assert.equal(counters.length, 1);
});

test('FB-0067: scene shutdown sweeps every door overlay, and a second animation on the same door replaces the first (never two copies)', () => {
  const { scene, images } = fakeScene();
  const first = scene.showDoorOverlay(mainWarp());
  const second = scene.showDoorOverlay(mainWarp());
  assert.ok(images.slice(0, 2).every((i) => i.destroyed), 'the first overlay was replaced');
  assert.ok(images.slice(2).every((i) => !i.destroyed));
  assert.equal(scene.doorAnims.size, 1);
  second.open(() => {});
  const other = scene.showDoorOverlay({ ...mainWarp(), name: 'Library Block entrance', x: 234 });
  assert.equal(scene.doorAnims.size, 2);
  scene.destroyDoorAnims();
  assert.ok(images.every((i) => i.destroyed));
  assert.equal(scene.doorAnims.size, 0);
  first.destroy(); other.destroy(); // idempotent
  assert.match(read('src', 'scenes', 'world.js'), /this\.events\.once\('shutdown', \(\) => this\.destroyDoorAnims\(\)\);/);
});

test('FB-0067: a door with no frames has no overlay; one with only the old `openTiles` just shows its open art (no animation, no wait)', () => {
  const { scene, images, counters } = fakeScene();
  assert.equal(scene.showDoorOverlay({ name: 'x', x: 1, y: 1, kind: 'door', frames: null, openTiles: null }), null);
  assert.equal(scene.showDoorOverlay({ name: 'x', x: 1, y: 1, kind: 'door' }), null);
  const legacy = scene.showDoorOverlay({ name: 'old', x: 3, y: 4, kind: 'door', frames: null, openTiles: ['doorway'] });
  assert.equal(images.length, 1);
  let done = 0;
  legacy.open(() => done++);
  assert.equal(done, 1, 'a single frame is instant: onDone runs straight away');
  assert.equal(counters.length, 0);
  assert.equal(images[0].frame, idx('doorway'));
});

test('FB-0067: an unknown tile name in a door\'s frames warns and hides that leaf instead of throwing', () => {
  const { scene, images } = fakeScene();
  const warns = [];
  const realWarn = console.warn;
  console.warn = (m) => warns.push(m);
  try {
    const overlay = scene.showDoorOverlay(mainWarp({ frames: [['bitsEntranceGrandL', 'noSuchTile'], ['bitsEntranceHalfL', 'noSuchTile'], ['bitsEntranceGrandLOpen', 'bitsEntranceGrandROpen']] }));
    overlay.open(() => {});
    assert.ok(warns.some((m) => /unknown door tile "noSuchTile"/.test(m)));
    assert.equal(images.length, 2);
  } finally {
    console.warn = realWarn;
  }
});

// ---------- the engine: the whole sequence (departure, arrival, lift) on a stand-in scene ----------

function sequenceScene() {
  const scene = Object.create(WorldScene.prototype);
  scene.def = MAPS.campus;
  scene.mapObjects = [];
  scene.player = {
    active: true, body: { reset() {} }, x: 225 * T + 8, y: 128 * T + 8, anims: { timeScale: 1, stop() {}, play() {} },
    setVelocity() { return this; }, setFrame() { return this; }, setPosition(x, y) { this.x = x; this.y = y; return this; },
  };
  scene.facing = 'up';
  scene.prompt = { setVisible() {} };
  const log = [];
  const cbs = {};
  scene.cameras = { main: { fadeOut: () => log.push('fade'), once: (event, cb) => { cbs.fade = cb; } } };
  scene.scene = { restart: (data) => log.push(`restart:${data.map}${data.viaWarpKind ? `:${data.viaWarpKind}` : ''}`) };
  scene.syncDoorVisuals = () => {};
  scene.walkThroughDoor = (facing, kind, onComplete) => { log.push('walk'); cbs.walked = onComplete; };
  scene.time = { delayedCall: (ms, fn) => { log.push(`wait:${ms}`); cbs.waited = fn; return { remove() {} }; } };
  const overlay = {
    open: (cb) => { log.push('open'); cbs.opened = cb; },
    close: (cb) => { log.push('close'); cbs.closed = cb; },
    destroy: () => log.push('destroy'),
  };
  scene.showDoorOverlay = () => overlay;
  return { scene, log, cbs };
}

test('FB-0067: departing: the door OPENS, then she walks in, then it CLOSES behind her as the screen fades, then the map changes', () => {
  const { scene, log, cbs } = sequenceScene();
  scene.playDoorDeparture({ name: 'Main Block entrance', x: 225, y: 128, cellsW: 2, cellsH: 1, kind: 'door', to: 'main-block-g', spawnAt: 'Main Block Ground Floor entrance' });
  assert.deepEqual(log, ['open'], 'nothing moves until the door is open (input is off the whole time: checkWarps set `transitioning`)');
  cbs.opened();
  assert.deepEqual(log, ['open', 'walk']);
  cbs.walked();
  assert.deepEqual(log, ['open', 'walk', 'close', 'fade'], 'the closing runs inside the fade');
  cbs.fade();
  assert.deepEqual(log, ['open', 'walk', 'close', 'fade', 'destroy', 'restart:main-block-g:door']);
});

test('FB-0067: departing through a door with no overlay (frames missing) is the plain walk-in, as before', () => {
  const { scene, log, cbs } = sequenceScene();
  scene.showDoorOverlay = () => null;
  scene.playDoorDeparture({ name: 'x', x: 225, y: 128, cellsW: 1, cellsH: 1, kind: 'door', to: 'main-block-g' });
  assert.deepEqual(log, ['walk']);
  cbs.walked();
  cbs.fade();
  assert.deepEqual(log, ['walk', 'fade', 'restart:main-block-g:door']);
});

test('FB-0067: stairs never get a door overlay (nothing to open), only the short walk', () => {
  const { scene, log, cbs } = sequenceScene();
  scene.showDoorOverlay = () => { log.push('overlay'); return null; };
  scene.playDoorDeparture({ name: 's', x: 5, y: 5, cellsW: 1, cellsH: 1, kind: 'stairs', to: 'main-block-1' });
  assert.deepEqual(log, ['walk']);
  cbs.walked();
  assert.ok(!log.includes('overlay'));
});

test('FB-0067: arriving: she appears behind the CLOSED door, it opens, she steps out and gets the controls, and it closes behind her', () => {
  const { scene, log, cbs } = sequenceScene();
  scene.spawn = { x: 225, y: 129, facing: 'down' };
  scene.getWarpPoints = () => [{ name: 'Main Block entrance', x: 225, y: 128, cellsW: 2, cellsH: 1, kind: 'door' }];
  scene.playDoorArrival('door');
  assert.equal(scene.transitioning, true, 'input is off for the whole walk-out');
  assert.deepEqual(log, ['open']);
  cbs.opened();
  assert.deepEqual(log, ['open', 'walk']);
  cbs.walked();
  assert.equal(scene.transitioning, false, 'the controls are back the moment she has stepped out');
  assert.deepEqual(log, ['open', 'walk', 'close']);
  cbs.closed();
  assert.deepEqual(log, ['open', 'walk', 'close', 'destroy'], 'the closing removes its own overlay');
});

test('FB-0067: the lift ride: the lift doors open, then the fade starts and they close inside it, then the next floor loads', () => {
  const { scene, log, cbs } = sequenceScene();
  scene.lifts = [{ x: 34 * T, y: 12 * T + 8, name: 'Main Block Lift 1', door: { x: 33, y: 12, cellsW: 2, cellsH: 1, kind: 'lift', frames: plain([['a', 'b'], ['c', 'd'], ['e', 'f']]) } }];
  scene.player.x = 34 * T; scene.player.y = 13 * T;
  scene.warpTo({ to: 'main-block-2', spawnAt: 'Main Block Lift 2' });
  assert.equal(scene.transitioning, true);
  assert.deepEqual(log, ['open']);
  cbs.opened();
  assert.deepEqual(log, ['open', 'close', 'fade']);
  cbs.fade();
  assert.deepEqual(log, ['open', 'close', 'fade', 'restart:main-block-2:lift']);
});

test('FB-0067: arriving by lift: the doors of the lift she was sent to open, stay open a beat and close, with her free the whole time', () => {
  const { scene, log, cbs } = sequenceScene();
  scene.spawnAt = 'Main Block Lift 2';
  scene.lifts = [
    { name: 'Main Block Lift 1', door: { frames: [['x']], x: 1, y: 1 } },
    { name: 'Main Block Lift 2', door: { x: 33, y: 12, cellsW: 2, cellsH: 1, kind: 'lift', frames: plain([['a', 'b'], ['c', 'd'], ['e', 'f']]) } },
  ];
  scene.playLiftArrival();
  assert.deepEqual(log, ['open']);
  cbs.opened();
  assert.deepEqual(log, ['open', `wait:${game.evaluate('LIFT_ARRIVAL_HOLD_MS')}`]);
  cbs.waited();
  assert.deepEqual(log, ['open', `wait:${game.evaluate('LIFT_ARRIVAL_HOLD_MS')}`, 'close']);
  cbs.closed();
  assert.equal(log.at(-1), 'destroy');
  assert.notEqual(scene.transitioning, true, 'a lift arrival never blocks input');
  // a lift with no frames, or none by that name: nothing happens
  const none = sequenceScene();
  none.scene.spawnAt = 'No such lift';
  none.scene.lifts = [];
  none.scene.playLiftArrival();
  assert.deepEqual(none.log, []);
});

test('FB-0067: the engine wires it: the close click is a registered, generated sound, the lift ding line is untouched, and the generators write the frames', () => {
  assert.ok(SOUNDS.doorClose && SOUNDS.doorClose.category === 'sfx');
  assert.ok(fs.existsSync(path.join(ROOT, SOUNDS.doorClose.file)), `${SOUNDS.doorClose.file} is missing (npm run audio)`);
  assert.match(read('tools', 'make-audio.js'), /generated\/door-close\.wav/);
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /if \(this\.viaWarpKind === 'lift'\) AudioManager\.play\('liftDing'\);/);
  assert.match(world, /if \(this\.viaWarpKind === 'lift'\) this\.playLiftArrival\(\);/);
  assert.equal((world.match(/this\.walkThroughDoor\(/g) || []).length, 2, 'departure and arrival still the only two door walks');
  assert.match(read('tools', 'campus', 'build-campus.js'), /doorProps\(b\.grand \? 'campusGlass' : 'campusGlassPlain'\)/);
  assert.match(read('tools', 'interiors', 'build-interiors.js'), /doorProps\('exitGlass'\)/);
  assert.match(read('tools', 'interiors', 'build-interiors.js'), /\.\.\.doorProps\('lift'\)/);
  // the test maps' literal names are the houseDoor kind
  const house = DOOR_KINDS.houseDoor;
  const warps = [...MAPS.meadow.warps, ...MAPS.house.warps];
  assert.equal(warps.length, 3);
  for (const w of warps) assert.deepEqual([w.closedTiles, w.halfTiles, w.openTiles], [house.closed[0], house.half[0], house.open[0]]);
});
