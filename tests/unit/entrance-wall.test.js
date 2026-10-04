// FB-0046 ("the running animation at the entrance looks weird, make sure I can't walk over the door and the wall"). The
// owner's screenshot shows the player standing ON the Main Block's facade next to the glass door while the entrance
// message is open. Three causes, each pinned here:
//   1. the glass panels either side of the door (bitsPorticoGlassBase) were walkable, so she could stand on the wall line
//      (data: tiles.json / campus.json -- every campus door's neighbours along the wall are now solid);
//   2. a doorway is two tiles wide but only its first tile triggered the door, so she could stand on the other leaf without
//      entering (the generators now write `cells` ("2x1") and the engine honours it: maplogic.js doorCoversTile());
//   3. a script (the entrance beat) or a door walk that began while she RAN kept her running -- up the steps and over the
//      door -- with the run animation; the door walk itself now uses the walk animation at walking speed, straight at the
//      middle of the doorway (world.js walkThroughDoor()/playDoorDeparture(); the halt on `transitioning` is in
//      tests/unit/player-halt.test.js).
// Doors that open and close visually are a different package; this changes no door art.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const readJson = (...parts) => JSON.parse(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n'); // checkouts on Windows have CRLF

const game = loadGameData();
game.runScript('src/scenes/world.js');
const { tileInfo, parseDoorCells, doorCoversTile, doorCenterPx, tiledObjects, MAPS } = game;
const WorldScene = game.evaluate('WorldScene');
const T = 16;

// A map's collision as the engine sees it: a structures tile decides if there is one, else the ground tile does.
function loadMap(key) {
  const json = readJson('assets', 'maps', `${key}.json`);
  const layer = (name) => json.layers.find((l) => l.name === name).data;
  const ground = layer('ground');
  const structures = layer('structures');
  const W = json.width;
  const name = (gid) => (gid > 0 ? tileInfo.tiles[gid - 1].name : null);
  const solidGid = (gid) => gid > 0 && tileInfo.tiles[gid - 1].solid;
  return {
    json,
    W,
    objects: tiledObjects(json),
    structName: (x, y) => name(structures[y * W + x]),
    walkable: (x, y) => {
      if (x < 0 || y < 0 || x >= W || y >= json.height) return false;
      const s = structures[y * W + x];
      return s > 0 ? !solidGid(s) : !solidGid(ground[y * W + x]);
    },
  };
}
const campus = loadMap('campus');

// ---------- 1. the wall line beside every campus door is solid ----------

test('FB-0046: the glass panels beside a door are wall now (solid), like every other facade tile', () => {
  const glass = tileInfo.tiles.find((t) => t.name === 'bitsPorticoGlassBase');
  assert.equal(glass.solid, true);
  for (const t of tileInfo.tiles) {
    if (/^bitsPortico|^bitsEntranceColumn|^bitsFacade(Cap|Window|Body|Base)/.test(t.name)) assert.equal(t.solid, true, `${t.name} must be solid`);
  }
});

test('FB-0046: along the facade row of every campus door, the door itself is the only way through: everything beside it is solid', () => {
  const doors = campus.objects.filter((o) => o.type === 'door' && o.props.to);
  assert.equal(doors.length, 3, 'the Main, Library and Mechanical Block doors');
  const WALL = /^bits(Portico|Entrance(Column)?|Facade|Wall)/;
  for (const door of doors) {
    const x = Math.floor(door.x);
    const y = Math.floor(door.y);
    // The two leaves are the door: both walkable, both entrance tiles.
    for (const dx of [0, 1]) {
      assert.match(campus.structName(x + dx, y) || '', /^bitsEntrance(Grand)?[LR]$/, `${door.name}: leaf ${dx}`);
      assert.ok(campus.walkable(x + dx, y), `${door.name}: leaf ${dx} must be walkable (it is the doorway)`);
      assert.ok(!campus.walkable(x + dx, y - 1), `${door.name}: no way past the door row above leaf ${dx}`);
    }
    // Walk out along the wall line either way: every tile of it, as far as the facade goes, is solid.
    for (const step of [-1, 1]) {
      let tested = 0;
      for (let cx = step < 0 ? x - 1 : x + 2; WALL.test(campus.structName(cx, y) || ''); cx += step) {
        assert.ok(!campus.walkable(cx, y), `${door.name}: ${campus.structName(cx, y)} at ${cx},${y} is walkable, she could stand on the wall line`);
        tested += 1;
      }
      assert.ok(tested >= 1, `${door.name}: no wall tile beside the door on the ${step < 0 ? 'left' : 'right'}`);
    }
    // The plaza in front of the door is where she approaches from.
    assert.ok(campus.walkable(x, y + 1) && campus.walkable(x + 1, y + 1), `${door.name}: no walkable ground in front of the door`);
  }
});

test('FB-0046: the Main Block\'s own door row is exactly: wall, wall, GLASS (solid), door, door, GLASS (solid), wall, wall', () => {
  const door = campus.objects.find((o) => o.type === 'door' && o.props.building === 'Main Block');
  const x = Math.floor(door.x);
  const y = Math.floor(door.y);
  assert.deepEqual(
    [-3, -2, -1, 0, 1, 2, 3, 4].map((dx) => campus.walkable(x + dx, y)),
    [false, false, false, true, true, false, false, false],
  );
  assert.equal(campus.structName(x - 1, y), 'bitsPorticoGlassBase');
  assert.equal(campus.structName(x + 2, y), 'bitsPorticoGlassBase');
});

// ---------- 2. a doorway is two tiles and both trigger it ----------

test('FB-0046: every real door the generators write says how many cells it spans, and those cells are the walkable doorway', () => {
  const maps = ['campus', 'main-block-g', 'library-block-g', 'mechanical-block-g'];
  let seen = 0;
  for (const key of maps) {
    const m = key === 'campus' ? campus : loadMap(key);
    for (const o of m.objects.filter((d) => d.type === 'door' && d.props.to)) {
      seen += 1;
      const raw = o.props.cells;
      assert.match(raw, /^[12]x[12]$/, `${key}/${o.name}: cells "${raw}"`);
      const { w, h } = parseDoorCells(raw);
      assert.equal(w * h, 2, `${key}/${o.name}: a doorway is two tiles`);
      for (let dy = 0; dy < h; dy++) {
        for (let dx = 0; dx < w; dx++) assert.ok(m.walkable(Math.floor(o.x) + dx, Math.floor(o.y) + dy), `${key}/${o.name}: cell ${dx},${dy} is not walkable`);
      }
      // And the wall line continues solid on both sides of it (so there is no gap to stand in beside the doorway).
      const before = w > 1 ? [Math.floor(o.x) - 1, Math.floor(o.y)] : [Math.floor(o.x), Math.floor(o.y) - 1];
      const after = w > 1 ? [Math.floor(o.x) + w, Math.floor(o.y)] : [Math.floor(o.x), Math.floor(o.y) + h];
      assert.ok(!m.walkable(...before) && !m.walkable(...after), `${key}/${o.name}: the wall beside the doorway has a gap`);
    }
  }
  assert.equal(seen, 6, 'the three campus doors plus the three ground-floor doors that lead back out onto the campus');
});

test('FB-0046: parseDoorCells / doorCoversTile / doorCenterPx: one tile by default, every cell of a two-tile door, its middle', () => {
  assert.deepEqual(plain(parseDoorCells(undefined)), { w: 1, h: 1 });
  assert.deepEqual(plain(parseDoorCells('')), { w: 1, h: 1 });
  assert.deepEqual(plain(parseDoorCells('garbage')), { w: 1, h: 1 });
  assert.deepEqual(plain(parseDoorCells('0x0')), { w: 1, h: 1 });
  assert.deepEqual(plain(parseDoorCells('2x1')), { w: 2, h: 1 });
  assert.deepEqual(plain(parseDoorCells(' 1 x 2 ')), { w: 1, h: 2 });

  const one = { x: 10, y: 5 };
  assert.equal(doorCoversTile(one, 10, 5), true);
  assert.equal(doorCoversTile(one, 11, 5), false);
  const wide = { x: 225, y: 128, cellsW: 2, cellsH: 1 };
  assert.deepEqual([224, 225, 226, 227].map((tx) => doorCoversTile(wide, tx, 128)), [false, true, true, false]);
  assert.equal(doorCoversTile(wide, 225, 127), false);
  assert.equal(doorCoversTile(wide, 225, 129), false);
  const tall = { x: 4, y: 7, cellsW: 1, cellsH: 2 };
  assert.deepEqual([6, 7, 8, 9].map((ty) => doorCoversTile(tall, 4, ty)), [false, true, true, false]);

  assert.deepEqual(plain(doorCenterPx(one)), { x: 10 * T + T / 2, y: 5 * T + T / 2 }, 'a one-tile door: the centre of its tile, as before');
  assert.deepEqual(plain(doorCenterPx(wide)), { x: 226 * T, y: 128 * T + T / 2 }, 'a two-tile door: the line between its leaves');
});

// The engine's door code, run for real against the real campus data on a stand-in scene.
function campusScene() {
  const scene = Object.create(WorldScene.prototype);
  scene.def = MAPS.campus;
  scene.mapObjects = campus.objects;
  scene.player = {
    active: true, body: {}, anims: { timeScale: 1, stop() {}, play() {} }, x: 0, y: 0,
    setVelocity() { return this; }, setFrame() { return this; },
  };
  scene.facing = 'up';
  scene.prompt = { setVisible() {} };
  return scene;
}

test('FB-0046: standing on EITHER leaf of the Main Block door goes in; the glass beside it and the plaza in front do not', () => {
  const scene = campusScene();
  const warps = scene.getWarpPoints();
  const main = warps.find((w) => w.name === 'Main Block entrance');
  assert.ok(main && main.cellsW === 2 && main.cellsH === 1, 'the engine reads cells from the door object');
  const departures = [];
  scene.playDoorDeparture = (warp) => departures.push(warp.name);
  const standAt = (tx, ty) => {
    scene.transitioning = false;
    scene.player.body = { center: { x: tx * T + T / 2 }, bottom: (ty + 1) * T };
    scene.checkWarps();
  };
  standAt(main.x, main.y); // left leaf
  standAt(main.x + 1, main.y); // right leaf
  assert.deepEqual(departures, ['Main Block entrance', 'Main Block entrance']);
  standAt(main.x - 1, main.y); // the glass panel (also solid now: she cannot get there anyway)
  standAt(main.x + 2, main.y);
  standAt(main.x, main.y + 1); // the step in front of the door
  standAt(main.x + 1, main.y + 1);
  assert.equal(departures.length, 2, 'only the doorway cells trigger the door');
});

test('FB-0046: door assist lines her up on the MIDDLE of a two-tile doorway (it used to aim at the left leaf\'s centre)', () => {
  const scene = campusScene();
  const main = scene.getWarpPoints().find((w) => w.name === 'Main Block entrance');
  const centre = doorCenterPx(main).x;
  const approach = (centerX) => {
    scene.player.body = { top: main.y * T + 12, bottom: main.y * T + 18, center: { x: centerX } };
    return scene.doorAssist(-1, 80);
  };
  assert.ok(approach(centre + 10) < 0, 'on the right leaf she is steered left, towards the middle');
  assert.ok(approach(centre - 10) > 0, 'on the left leaf she is steered right, towards the middle');
  assert.ok(Math.abs(approach(centre)) < 1e-9, 'on the middle she is not pushed');
  assert.equal(approach(centre + 40), null, 'well off to the side (past the glass) there is nothing to steer into');
});

// ---------- 3. the door walk: walking speed, the walk animation, straight in ----------

function doorWalker(player) {
  const scene = campusScene();
  Object.assign(scene.player, player);
  const tweens = [];
  scene.tweens = { add: (config) => tweens.push(config) };
  scene.syncDoorVisuals = () => {};
  return { scene, tweens };
}

test('FB-0046: a door walk plays the WALK animation at its normal rate and takes one tile at walking speed, however she arrived (running)', () => {
  const WALK_SPEED = game.evaluate('WALK_SPEED');
  assert.equal(game.evaluate('DOOR_WALK_MS'), Math.round((T / WALK_SPEED) * 1000), 'a door step is one tile at WALK_SPEED, not a slower or faster fixed time');
  const keys = [];
  const { scene, tweens } = doorWalker({ x: 100, y: 100 });
  scene.player.anims.timeScale = 140 / 80; // she ran to the door
  scene.player.anims.play = (key) => keys.push(key);
  scene.walkThroughDoor('up', 'door', () => {});
  assert.deepEqual(keys, ['walk-up']);
  assert.equal(scene.player.anims.timeScale, 1, 'the run animation rate must not carry into the door walk');
  assert.equal(tweens.length, 1);
  assert.equal(tweens[0].duration, game.evaluate('DOOR_WALK_MS'));
  assert.equal(tweens[0].y, 100 - T, 'one tile on, in the direction she was heading');
  assert.equal(tweens[0].x, 100, 'straight');
  assert.equal(tweens[0].ease, 'Linear');

  // A longer arrival walk (the doorway to her spawn point) takes proportionally longer, at the same speed.
  const long = doorWalker({ x: 100, y: 100 });
  long.scene.walkThroughDoor('down', 'door', () => {}, { x: 100, y: 100 + 2 * T });
  assert.equal(long.tweens[0].duration, 2 * game.evaluate('DOOR_WALK_MS'));
  // Stairs keep their own short step, but also at the walk animation's normal rate.
  const stairs = doorWalker({ x: 100, y: 100 });
  stairs.scene.player.anims.timeScale = 1.75;
  stairs.scene.walkThroughDoor('up', 'stairs', () => {});
  assert.equal(stairs.tweens[0].duration, game.evaluate('STAIRS_WALK_MS'));
  assert.equal(stairs.scene.player.anims.timeScale, 1);
});

test('FB-0046: departing through a two-tile door she walks straight into its middle; a one-tile door is the plain step', () => {
  const run = (warp, player) => {
    const scene = campusScene();
    Object.assign(scene.player, player);
    scene.facing = 'up';
    scene.showDoorOverlay = () => null;
    let seen = null;
    scene.walkThroughDoor = (facing, kind, onComplete, to) => { seen = { facing, kind, to }; };
    scene.playDoorDeparture(warp);
    return seen;
  };
  const wide = { x: 225, y: 128, cellsW: 2, cellsH: 1, kind: 'door', openTiles: null };
  const onRightLeaf = run(wide, { x: 226 * T + 12, y: 128 * T + 8 });
  assert.equal(onRightLeaf.facing, 'up');
  assert.deepEqual(plain(onRightLeaf.to), { x: 226 * T, y: 128 * T + 8 - T }, 'x on the door\'s centre line, one tile further in');
  const single = run({ x: 11, y: 12, cellsW: 1, cellsH: 1, kind: 'door', openTiles: null }, { x: 11 * T + 8, y: 12 * T + 8 });
  assert.equal(single.to, undefined, 'a one-tile door keeps the plain straight step');
  // Entering a door in a vertical wall (sideways) is also a plain step: it is the along-the-wall axis that is lined up only for horizontal doors.
  const side = run({ x: 4, y: 7, cellsW: 1, cellsH: 2, kind: 'door', openTiles: null }, { x: 4 * T + 8, y: 7 * T + 8 });
  assert.equal(side.to, undefined);
});

test('FB-0046: the door-walk source: both halves (leaving and arriving) go through walkThroughDoor(), which owns the walk animation and speed', () => {
  const source = read('src', 'scenes', 'world.js');
  assert.match(source, /const duration = kind === 'stairs' \? STAIRS_WALK_MS : Math\.max\(DOOR_WALK_MIN_MS, Math\.round\(\(distance \/ TILE\) \* DOOR_WALK_MS\)\);/);
  assert.match(source, /p\.anims\.timeScale = 1;[^\n]*\n\s*p\.anims\.play\(`walk-\$\{facing\}`, true\);/);
  assert.equal((source.match(/this\.walkThroughDoor\(/g) || []).length, 2, 'departure and arrival, nothing else animates a door walk');
  assert.match(source, /const warp = this\.getWarpPoints\(\)\.find\(\(w\) => doorCoversTile\(w, tileX, tileY\)\);/);
});

test('FB-0046: the generators write the cells (campus doors and interior exterior-doors), and the maps on disk are the generators\' output', () => {
  assert.match(read('tools', 'campus', 'build-campus.js'), /\{ name: 'cells', type: 'string', value: '2x1' \},/);
  assert.match(read('tools', 'interiors', 'build-interiors.js'), /const props = \{ to, toId, facing, cells: horizontal \? '2x1' : '1x2' \};/);
  // (that the committed maps equal a fresh build is tests/unit/campus.test.js / interiors.test.js)
});
