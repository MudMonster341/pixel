// FB-0071 (P5c): "the ICL is a closed lab with a fingerprint so make it such that I have to play the game to enter the lab and then I get the key... a super
// computing lab with a robot called Alice there as well... modern and like a space ship sort of interior".
//
// What is pinned here, all against the REAL generated map (assets/maps/main-block-1.json), the real tile sheet and the real data:
//   - the door is a sealed hatch (two solid door-leaf tiles + a `sealedDoor` object) with a fingerprint scanner pad beside it, both reachable from the
//     corridor, and the lab, its key and Alice are reachable ONLY once the door is open;
//   - the scanner's dialog runs the mini-game and then sets the saved flag `iclDoorOpen` (a win and the framework's skip both report 'won'; Esc/quit
//     leaves it sealed and she can retry); the key is no longer a mini-game prize: the core console and Alice hand it over, inside;
//   - old saves never soft-lock (a save with the ICL key, one past the hunt, one standing in the lab all start with the door open);
//   - the lab has the new tile kit (cyan strips, racks, holo table, wall display, consoles, a ceiling light bar), Alice's sheet exists and is preloaded;
//   - the engine's own door code (world.js createGates()/setGateOpen()/checkGateBump()/nearestInteractable()) run on a stand-in scene;
//   - the objective route leads to the scanner first, then to the key; the flyer is "ICL Fingerprint Hack" with an intro of at most 3 lines.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain, openSealedDoors } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');
const { DOOR_KINDS } = require('../../tools/lib/door-kinds');

const game = loadGameData();
game.runScript('src/scenes/world.js');
const {
  MAPS, AMBIENT, STORY, MINIGAMES, tileInfo, tiledObjects, gridFromTiled, isWalkableTile, isGateOpen, tileInGateRoom, gateBumped, tileAnimFrame,
  objectiveTarget, resolveAnchor, characterSheets, SCRIPTS, parseOpenTiles, doorFrames, parseDoorCells,
} = game;
const WorldScene = game.evaluate('WorldScene');
const T = 16;
const NAMES = tileInfo.tiles.map((t) => t.name);
const INDEX = Object.fromEntries(NAMES.map((n, i) => [n, i]));
const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', 'main-block-1.json'), 'utf8'));
const objects = tiledObjects(json);
const layer = (name) => json.layers.find((l) => l.name === name).data;
const nameAt = (layerName, x, y) => { const gid = layer(layerName)[y * json.width + x]; return gid ? NAMES[gid - 1] : null; };
const sealedGrid = gridFromTiled(json);
const openGrid = openSealedDoors(sealedGrid, objects, tileInfo);
const door = objects.find((o) => o.type === 'sealedDoor');
const scanner = objects.find((o) => o.type === 'scanner');
const spawn = objects.find((o) => o.type === 'spawn');
const gate = STORY.iclGate;

// Flood fill (4-neighbour) from the floor spawn over a grid; returns a lookup.
function reach(grid, from = { x: Math.floor(spawn.x), y: Math.floor(spawn.y) }) {
  const seen = new Uint8Array(json.width * json.height);
  const stack = [[from.x, from.y]];
  seen[from.y * json.width + from.x] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= json.width || ny >= json.height || seen[ny * json.width + nx]) continue;
      if (!isWalkableTile(grid, tileInfo, nx, ny)) continue;
      seen[ny * json.width + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  return (x, y) => x >= 0 && y >= 0 && x < json.width && y < json.height && seen[y * json.width + x] === 1;
}
const iclArea = objects.find((o) => o.type === 'area' && o.name === 'ICL');
const inLab = (x, y) => x >= iclArea.x && x < iclArea.x + iclArea.width && y >= iclArea.y && y < iclArea.y + iclArea.height;

// ======================================================================================================
// 1. The sealed hatch and the scanner, in the generated map
// ======================================================================================================

test('FB-0071: the ICL door is a sealed hatch: a `sealedDoor` object over two SOLID door-leaf tiles on the lab\'s doorway, with closed/half/open frames', () => {
  assert.ok(door, 'main-block-1 has no sealedDoor object');
  assert.equal(door.name, 'ICL door');
  assert.equal(door.props.flag, 'iclDoorOpen');
  const cells = parseDoorCells(door.props.cells);
  assert.deepEqual({ w: cells.w, h: cells.h }, { w: 2, h: 1 });
  const x = Math.floor(door.x);
  const y = Math.floor(door.y);
  assert.deepEqual([x, y], [9, 14], 'the lab\'s doorway on the corridor wall');
  DOOR_KINDS.iclHatch.closed.forEach((name, i) => {
    assert.equal(nameAt('structures', x + i, y), name, 'the closed leaf stands on the doorway');
    assert.equal(tileInfo.tiles[INDEX[name]].solid, true, `${name} is solid: she cannot walk through a sealed door`);
    assert.ok(!isWalkableTile(sealedGrid, tileInfo, x + i, y));
  });
  const frames = doorFrames(door.props);
  assert.equal(frames.length, 3, 'closed, half, open');
  assert.deepEqual(plain(frames[0]), DOOR_KINDS.iclHatch.closed);
  assert.deepEqual(plain(frames[2]), DOOR_KINDS.iclHatch.open);
  for (const name of DOOR_KINDS.iclHatch.open) assert.equal(tileInfo.tiles[INDEX[name]].solid, false, `${name} is walkable: the open door lets her in`);
  // every frame tile is a real, fully opaque picture (the overlay hides the leaf beneath it), and the three frames differ
  const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
  const pixels = (name) => {
    const i = INDEX[name];
    const out = Buffer.alloc(T * T * 4);
    for (let yy = 0; yy < T; yy++) png.data.copy(out, yy * T * 4, ((Math.floor(i / tileInfo.columns) * T + yy) * png.width + (i % tileInfo.columns) * T) * 4, ((Math.floor(i / tileInfo.columns) * T + yy) * png.width + (i % tileInfo.columns) * T + T) * 4);
    return out;
  };
  for (let c = 0; c < 2; c++) {
    const [a, b, d] = frames.map((names) => pixels(names[c]));
    for (const px of [a, b, d]) for (let k = 3; k < px.length; k += 4) assert.equal(px[k], 255, 'door frames are opaque');
    assert.ok(!a.equals(b) && !b.equals(d) && !a.equals(d), `cell ${c}: closed, half and open are three different pictures`);
  }
});

test('FB-0071: a fingerprint scanner pad is mounted beside the door (a solid wall fitting, named for the door), with its pulse and "accepted" overlay frames', () => {
  assert.ok(scanner, 'main-block-1 has no scanner object');
  assert.equal(scanner.name, 'ICL scanner');
  assert.equal(scanner.props.door, door.name);
  assert.deepEqual([Math.floor(scanner.x), Math.floor(scanner.y)], [11, 14], 'on the wall right of the hatch');
  assert.equal(nameAt('structures', 11, 14), 'intWallScanner');
  assert.equal(tileInfo.tiles[INDEX.intWallScanner].solid, true);
  const glow = parseOpenTiles(scanner.props.glow);
  assert.ok(glow.length >= 3, 'a pulse: at least three frames');
  for (const name of [...glow, scanner.props.ok]) assert.ok(name in INDEX, `${name} is a real tile`);
  assert.ok(Number(scanner.props.ms) >= 450, 'the pulse never changes faster than about twice a second');
  // the "nameplate, hatch, scanner" run is one wall line, and the corridor floor in front of all three is free
  for (const x of [9, 10, 11]) {
    assert.ok(isWalkableTile(sealedGrid, tileInfo, x, 15), `(${x},15) in front of the hatch/scanner is walkable`);
    assert.equal(nameAt('structures', x, 15), null, `nothing stands in front of the hatch/scanner at (${x},15)`);
  }
});

test('FB-0071: the scanner and the hatch are reachable from the corridor; the lab, its key console and Alice are NOT while the door is sealed, and ARE once it is open', () => {
  const sealed = reach(sealedGrid);
  assert.ok(sealed(11, 15), 'the tile in front of the scanner');
  assert.ok(sealed(9, 15) && sealed(10, 15), 'the tiles in front of the hatch');
  const key = MAPS['main-block-1'].keyStations.find((k) => k.id === 'icl');
  const alice = MAPS['main-block-1'].npcs.find((n) => n.id === 'alice');
  assert.ok(!sealed(key.x, key.y + 1) && !sealed(key.x + 1, key.y) && !sealed(key.x, key.y - 1), 'the key console cannot be reached while sealed');
  assert.ok(!sealed(alice.x, alice.y + 1) && !sealed(alice.x - 1, alice.y), 'Alice cannot be reached while sealed');
  for (let y = Math.floor(iclArea.y); y < iclArea.y + iclArea.height; y++) {
    for (let x = Math.floor(iclArea.x); x < iclArea.x + iclArea.width; x++) assert.ok(!sealed(x, y), `lab tile (${x},${y}) is reachable through the wall`);
  }
  const open = reach(openGrid);
  // every walkable lab tile is reachable once open (no furniture seals a pocket off), and so are the console's and Alice's neighbours
  let walkableTiles = 0;
  for (let y = Math.floor(iclArea.y); y < iclArea.y + iclArea.height; y++) {
    for (let x = Math.floor(iclArea.x); x < iclArea.x + iclArea.width; x++) {
      if (!isWalkableTile(openGrid, tileInfo, x, y)) continue;
      walkableTiles++;
      assert.ok(open(x, y), `walkable lab tile (${x},${y}) is cut off from the door even when it is open`);
    }
  }
  assert.ok(walkableTiles >= 40, 'a roomy lab');
  assert.ok(open(key.x, key.y + 1) || open(key.x, key.y - 1) || open(key.x + 1, key.y) || open(key.x - 1, key.y), 'the key console is reachable once open');
  assert.ok(open(alice.x, alice.y + 1) || open(alice.x - 1, alice.y) || open(alice.x + 1, alice.y) || open(alice.x, alice.y - 1), 'Alice is reachable once open');
});

test('FB-0071: the lab is roomy and Alice and the key stay clear of the door lane (the lit way in, x 9..10): at least two tiles away', () => {
  assert.ok(iclArea.width >= 10 && iclArea.height >= 7, `the lab is ${iclArea.width}x${iclArea.height}: about 10-12 wide and 7-9 deep or more`);
  const key = MAPS['main-block-1'].keyStations.find((k) => k.id === 'icl');
  const alice = MAPS['main-block-1'].npcs.find((n) => n.id === 'alice');
  for (const p of [key, alice]) {
    assert.ok(inLab(p.x, p.y), 'inside the lab');
    assert.ok(Math.min(Math.abs(p.x - 9), Math.abs(p.x - 10)) >= 2, `(${p.x},${p.y}) is on or beside the door lane`);
  }
  assert.equal(nameAt('structures', key.x, key.y), 'intTechCoreConsole', 'the key sits on the core console');
  assert.ok(Math.hypot(alice.x - key.x, alice.y - key.y) <= 2, 'Alice hovers right beside the core console');
});

// ======================================================================================================
// 2. The new look: the tile kit
// ======================================================================================================

test('FB-0071: the lab has the new "spaceship / super-computing" tile kit: navy panels with cyan light strips, bulkhead walls, tall racks, a holo table, a wall display, consoles, a ceiling light bar', () => {
  const used = (layerName) => {
    const found = new Set();
    for (let y = Math.floor(iclArea.y) - 2; y <= iclArea.y + iclArea.height; y++) { // (one more row above: the wall cap sits over the top wall)
      for (let x = Math.floor(iclArea.x) - 1; x <= iclArea.x + iclArea.width; x++) { const n = nameAt(layerName, x, y); if (n) found.add(n); }
    }
    return found;
  };
  const ground = used('ground');
  const structures = used('structures');
  assert.ok(ground.has('intTechFloor') && ground.has('intTechFloorB'), 'the dark navy and brushed-steel floor panels');
  assert.ok(['H', 'V', 'SE', 'SW', 'NE', 'NW', 'TS'].every((k) => ground.has(`intTechFloorStrip${k}`)), 'the glowing cyan light strips (a ring and the way in)');
  assert.ok(ground.has('intTechPad') && ground.has('intTechTrunkH'), 'Alice\'s charging pad and the cable trunking');
  assert.ok(structures.has('intWallTech') && structures.has('intWallTechEndL') && structures.has('intWallTechEndR') && structures.has('intWallTechCap'), 'the bulkhead walls with the light band, and their steel cap');
  assert.ok(structures.has('intTechRackTopA') && structures.has('intTechRackBaseB'), 'tall server racks (two tiles each)');
  assert.ok(structures.has('intHoloTable00') && structures.has('intHoloTable31'), 'the holographic table');
  assert.ok(structures.has('intWallDisplay0') && structures.has('intTechDisplayBase3'), 'the big wall display');
  assert.ok(structures.has('intTechConsoleS') && structures.has('intTechCoreConsole'), 'the curved consoles with screens');
  const overhead = json.layers.find((l) => l.name === 'overhead');
  assert.ok(overhead && overhead.data.some((g) => g && NAMES[g - 1].startsWith('intTechLightBar')), 'the ceiling light bar is on the overhead layer');
  // the old royal-blue desk grid is gone
  for (const old of ['intIclBench', 'intIclCabinet', 'intServerRack', 'intTeacherDesk']) assert.ok(!structures.has(old), `${old} is gone from the ICL`);
  // new tiles were appended: every earlier tile keeps its index
  assert.equal(INDEX.intTechFloor, INDEX.intExitGlassOpenR + 1, 'the kit starts right after the last earlier tile');
  // the new tile PNG cells are drawn
  const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
  for (const name of NAMES.slice(INDEX.intTechFloor)) {
    const i = INDEX[name];
    let drawn = false;
    for (let yy = 0; yy < T && !drawn; yy++) for (let xx = 0; xx < T; xx++) if (png.data[((Math.floor(i / tileInfo.columns) * T + yy) * png.width + (i % tileInfo.columns) * T + xx) * 4 + 3] > 0) { drawn = true; break; }
    assert.ok(drawn, `${name} is fully transparent in tiles.png`);
  }
});

test('FB-0071: the racks blink and the holo globe turns: `tileAnim` objects name real overlay tiles, never flash faster than about twice a second, and tileAnimFrame() cycles them', () => {
  const anims = objects.filter((o) => o.type === 'tileAnim');
  assert.ok(anims.filter((a) => parseOpenTiles(a.props.frames).some((n) => /^intTechLeds/.test(n))).length >= 8, 'LEDs on every rack');
  assert.ok(anims.some((a) => /^intHoloGlobe/.test(parseOpenTiles(a.props.frames)[0])), 'the holo globe');
  const phases = new Set();
  for (const a of anims) {
    const frames = parseOpenTiles(a.props.frames);
    assert.ok(frames.length >= 2, 'an animation has at least two frames');
    for (const name of frames) assert.ok(name in INDEX, `${name} is a real tile`);
    assert.ok(Number(a.props.ms) >= 450, `${a.props.frames}: ${a.props.ms} ms a frame is too fast a flash`);
    phases.add(a.props.phase);
  }
  assert.ok(phases.size > 3, 'the racks blink out of step');
  assert.equal(tileAnimFrame(0, 3, 500, 0), 0);
  assert.equal(tileAnimFrame(499, 3, 500, 0), 0);
  assert.equal(tileAnimFrame(500, 3, 500, 0), 1);
  assert.equal(tileAnimFrame(1500, 3, 500, 0), 0, 'it wraps');
  assert.equal(tileAnimFrame(0, 3, 500, 500), 1, 'a phase starts it part-way round');
  assert.equal(tileAnimFrame(100, 0, 500), 0, 'no frames: frame 0');
});

// ======================================================================================================
// 3. Alice
// ======================================================================================================

test('FB-0071: Alice is a named story NPC with a name tag, a 4x8-frame sheet that exists, is preloaded, and bobs (hover), and stays out of the door lane', () => {
  const alice = MAPS['main-block-1'].npcs.find((n) => n.id === 'alice');
  assert.ok(alice, 'main-block-1 has no Alice');
  assert.equal(alice.name, 'Alice', 'the name tag');
  assert.equal(alice.character, 'alice');
  assert.equal(alice.hover, true, 'the idle bob');
  assert.equal(alice.dialog, STORY.alice);
  const sheet = characterSheets(MAPS, AMBIENT, SCRIPTS).find((s) => s.key === 'npc-alice');
  assert.ok(sheet, 'npc-alice is in the preload list (characterSheets())');
  const file = path.join(ROOT, sheet.file);
  assert.ok(fs.existsSync(file), `${sheet.file} exists (run npm run assets)`);
  const png = decodePNG(fs.readFileSync(file));
  assert.equal(png.width, 8 * 16, '8 frames a row');
  assert.equal(png.height, 4 * 24, '4 rows (down, up, left, right) of 24 px');
  // the idle bob: frame 0 and frame 7 of each row (the two poses her animation alternates) are different pictures
  const cell = (frame, row) => {
    const out = [];
    for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) out.push(png.data[((row * 24 + y) * png.width + frame * 16 + x) * 4 + 3] ? png.data.slice(((row * 24 + y) * png.width + frame * 16 + x) * 4, ((row * 24 + y) * png.width + frame * 16 + x) * 4 + 4).join(',') : '-');
    return out.join('|');
  };
  for (let row = 0; row < 4; row++) {
    assert.notEqual(cell(0, row), cell(7, row), `row ${row}: the bob has two poses`);
    assert.ok(cell(0, row).split('|').some((p) => p !== '-'), `row ${row}: she is drawn`);
  }
  const src = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  assert.match(src, /if \(def\.hover && def\.character\) this\.playHoverAnim\(npc, textureKey, def\.facing \|\| 'down'\);/, 'createNpcs() plays the hover bob');
});

test('FB-0071: Alice greets her, explains the lab in a couple of short lines and hands over the key (the same actions as the console); later talks are light chat, in order, then a last line on repeat', () => {
  const { pickDialogEntry, applyDialogActions, GameState, renderLines } = loadGameData();
  const alice = { id: 'alice', name: 'Alice', dialog: STORY.alice };
  const first = pickDialogEntry(alice, GameState);
  assert.equal(first.entry.id, 'welcome');
  assert.ok(first.entry.lines.length >= 3 && first.entry.lines.length <= 4, 'a greeting, two lines about the lab, the key');
  for (const line of first.entry.lines) assert.ok(line.length <= 110, `a short line: "${line}"`);
  assert.match(first.entry.lines[0], /Alice/);
  assert.match(first.entry.lines[0], /4,096 threads/, 'the coffee machine joke');
  assert.ok(renderLines(first.entry.lines, { playerName: 'Zara' }).join(' ').includes('Zara'));
  const take = first.entry.actions;
  assert.ok(take.some((a) => a.key === 'icl') && take.some((a) => a.give === 'keyIcl'), 'she gives the ICL key');
  applyDialogActions(take, GameState);
  assert.equal(GameState.quest.keys.icl, true);
  assert.equal(GameState.inventory.slots.filter((s) => s && s.item === 'keyIcl').length, 1);
  // later talks: each chat line once (marked seen as it is shown, like interact() does), then the closing line, forever
  const said = [];
  for (let i = 0; i < 7; i++) {
    const picked = pickDialogEntry(alice, GameState);
    said.push(picked.entry.id);
    GameState.seenDialog.add(picked.key);
  }
  assert.deepEqual(said, ['chat-1', 'chat-2', 'chat-3', 'chat-end', 'chat-end', 'chat-end', 'chat-end']);
});

test('FB-0071: no ambient student stands inside the lab or its door lane, and the students who used to be in the closet wait in the corridor outside', () => {
  const room = gate.room;
  for (const e of AMBIENT['main-block-1']) {
    const pts = e.kind === 'patrol' ? e.waypoints : [{ x: e.x, y: e.y }];
    for (const p of pts) {
      assert.ok(!tileInGateRoom(gate, Math.floor(p.x), Math.floor(p.y)), `${e.id} stands inside the sealed lab at (${p.x},${p.y})`);
      assert.ok(!(p.y >= 13 && p.y <= 16 && p.x >= 8 && p.x <= 12), `${e.id} stands in the hatch/scanner lane at (${p.x},${p.y})`);
    }
  }
  assert.deepEqual([room.x0, room.y0, room.x1, room.y1], [Math.floor(iclArea.x), Math.floor(iclArea.y), Math.floor(iclArea.x + iclArea.width) - 1, Math.floor(iclArea.y + iclArea.height) - 1], 'the gate\'s room rect is the lab\'s interior');
  const icl1 = AMBIENT['main-block-1'].find((e) => e.id === 'mb1-amb-icl-1');
  const mustafa = AMBIENT['main-block-1'].find((e) => e.id === 'mb1-amb-icl-2');
  assert.ok(icl1.y >= 15 && mustafa.y >= 15, 'in the corridor');
  assert.equal(mustafa.name, 'Mustafa');
  assert.equal(mustafa.sheet, 'npc-mustafa');
});

// ======================================================================================================
// 4. The door's story: scan -> flag -> door; the key inside; Esc/quit; retry
// ======================================================================================================

test('FB-0071: the data wiring: the map def points at STORY.iclGate, whose door and scanner are real objects of the generated map, and the key station has no mini-game of its own', () => {
  const def = MAPS['main-block-1'];
  assert.deepEqual(plain(def.gates), [plain(gate)]);
  assert.ok(objects.some((o) => o.type === 'sealedDoor' && o.name === gate.door));
  assert.ok(objects.some((o) => o.type === 'scanner' && o.name === gate.scanner));
  assert.equal(gate.flag, 'iclDoorOpen');
  assert.equal(gate.minigame, 'flappy');
  assert.equal(STORY.keyStations.icl.minigame, undefined, 'the key is not a mini-game prize any more');
  assert.equal(STORY.keyStations.icl.item, 'keyIcl', 'the key id and item are unchanged');
  assert.equal(def.keyStations.find((k) => k.id === 'icl').item, 'keyIcl');
});

test('FB-0071: the scanner asks the mini-game, and only a win (or the 3-loss skip, which reports "won") sets iclDoorOpen and opens the door; the key is NOT given by it', () => {
  const { pickDialogEntry, applyDialogActions, GameState, gameEvents } = loadGameData();
  const scannerDef = { id: 'scanner:ICL scanner', dialog: gate.scannerDialog };
  let requested = null;
  const toasts = [];
  gameEvents.on('minigame:requested', (p) => { requested = p; });
  gameEvents.on('toast', (t) => toasts.push(t));
  const picked = pickDialogEntry(scannerDef, GameState);
  assert.equal(picked.entry.id, 'scan');
  let done = null;
  applyDialogActions(picked.entry.actions, GameState, (r) => { done = r; });
  assert.equal(requested.id, 'flappy', 'it launches the flyer');
  assert.equal(GameState.flags.iclDoorOpen, undefined, 'nothing is set until the mini-game reports');
  requested.onResult('won'); // a real win, or the framework's skip after 3 losses (framework-scene.js reports both as 'won')
  assert.equal(GameState.flags.iclDoorOpen, true, 'the door flag is set');
  assert.equal(done, 'done');
  assert.equal(GameState.quest.keys.icl, false, 'no key from the scanner');
  assert.equal(GameState.inventory.slots.filter((s) => s && s.item === 'keyIcl').length, 0);
  assert.ok(toasts.some((t) => /scan accepted/i.test(t)));
  assert.ok(GameState.journal.some((j) => /ICL door is open/.test(j)));
  // once open, E at the scanner only says so (the game is not offered again)
  assert.equal(pickDialogEntry(scannerDef, GameState).entry.id, 'done');
});

test('FB-0071: Esc / quitting the hack leaves the door sealed, and she can retry any time (nobody is locked out)', () => {
  const { pickDialogEntry, applyDialogActions, GameState, gameEvents } = loadGameData();
  const scannerDef = { id: 'scanner:ICL scanner', dialog: gate.scannerDialog };
  let requested = null;
  gameEvents.on('minigame:requested', (p) => { requested = p; });
  let done = null;
  applyDialogActions(pickDialogEntry(scannerDef, GameState).entry.actions, GameState, (r) => { done = r; });
  requested.onResult('quit');
  assert.equal(done, 'quit');
  assert.equal(GameState.flags.iclDoorOpen, undefined, 'still sealed');
  assert.equal(pickDialogEntry(scannerDef, GameState).entry.id, 'scan', 'the scan is offered again');
  requested = null;
  applyDialogActions(pickDialogEntry(scannerDef, GameState).entry.actions, GameState);
  assert.equal(requested.id, 'flappy', 'the retry launches it again');
  requested.onResult('won');
  assert.equal(GameState.flags.iclDoorOpen, true);
  // and the framework side: Esc is a quit, the skip is a win (src/minigames/framework-scene.js)
  const fw = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'framework-scene.js'), 'utf8');
  assert.match(fw, /this\.finish\(this\.mgState === 'win' \? 'won' : 'quit'\)/);
  assert.match(fw, /onSkip: \(\) => this\.win\(true\)/);
});

test('FB-0071: the sealed door says "Sealed. Fingerprint scan required." (pushing at it and E at it) until the flag is set', () => {
  const { pickDialogEntry, GameState } = loadGameData();
  assert.equal(gate.lockedLine, 'Sealed. Fingerprint scan required.');
  const doorDef = { id: 'gate:ICL door', dialog: gate.doorDialog };
  const sealed = pickDialogEntry(doorDef, GameState).entry;
  assert.equal(sealed.id, 'sealed');
  assert.equal(sealed.lines[0], 'Sealed. Fingerprint scan required.');
  assert.ok(!sealed.actions, 'E at the hatch never starts the game: the scanner is the thing to use');
  GameState.flags.iclDoorOpen = true;
  assert.equal(pickDialogEntry(doorDef, GameState).entry.id, 'open');
});

test('FB-0071: the key is collected inside: the console\'s "take" entry runs no mini-game and gives keyIcl, key `icl` and the journal line; "done" after', () => {
  const { keyStationDialog, pickDialogEntry, applyDialogActions, GameState, gameEvents } = loadGameData();
  let asked = false;
  gameEvents.on('minigame:requested', () => { asked = true; });
  const console_ = { id: 'icl', dialog: keyStationDialog('icl') };
  const take = pickDialogEntry(console_, GameState);
  assert.equal(take.entry.id, 'take');
  assert.ok(!take.entry.actions.some((a) => 'minigame' in a));
  applyDialogActions(take.entry.actions, GameState);
  assert.equal(asked, false);
  assert.equal(GameState.quest.keys.icl, true);
  assert.equal(GameState.inventory.slots.filter((s) => s && s.item === 'keyIcl').length, 1);
  assert.deepEqual(plain(GameState.journal), ['Found a key in the core console of the ICL.']);
  assert.equal(pickDialogEntry(console_, GameState).entry.id, 'done');
  // Alice no longer offers a second key
  assert.notEqual(pickDialogEntry({ id: 'alice', dialog: STORY.alice }, GameState).entry.id, 'welcome');
});

// ======================================================================================================
// 5. Saves: nobody is locked out
// ======================================================================================================

test('FB-0071: the door flag is saved and restored; a fresh game starts with the door sealed', () => {
  const { GameState, saveGame, loadGame, resetGameState } = loadGameData();
  assert.equal(GameState.flags.iclDoorOpen, undefined);
  GameState.flags.iclDoorOpen = true;
  saveGame('default', GameState);
  GameState.flags = {};
  loadGame('default', GameState);
  assert.equal(GameState.flags.iclDoorOpen, true);
  resetGameState(GameState);
  assert.equal(GameState.flags.iclDoorOpen, undefined, 'a new game: sealed again');
});

function oldSave(over) {
  return {
    version: 1, savedAt: 1, profile: 'default',
    state: { map: 'main-block-1', position: { x: 16, y: 18 }, facing: 'up', inventory: { slots: [null, null, null, null, null], selected: 0 }, flags: { tomasGaveSword: false, tomasChats: 0 },
      quest: { stage: 'hunting', keys: { physicsLab: false, icl: false, room195: false } }, minigames: {}, journal: [], collected: [], seenCutscenes: [], seenDialog: [], seenHints: [], ...over },
  };
}
function loadOld(over) {
  const g = loadGameData();
  g.localStorage.setItem('pixelquest.save.v1.default', JSON.stringify(oldSave(over)));
  assert.equal(g.loadGame('default', g.GameState), true);
  return g.GameState;
}

test('FB-0071 soft-lock guard: an old save that already HAS the ICL key starts with the door open; so does one past the ICL (stage rewarded); one standing inside the lab too', () => {
  assert.equal(loadOld({ quest: { stage: 'hunting', keys: { physicsLab: false, icl: true, room195: false } } }).flags.iclDoorOpen, true, 'holds the key');
  assert.equal(loadOld({ quest: { stage: 'rewarded', keys: { physicsLab: true, icl: true, room195: true } } }).flags.iclDoorOpen, true, 'the hunt is over');
  assert.equal(loadOld({ quest: { stage: 'rewarded', keys: { physicsLab: false, icl: false, room195: false } } }).flags.iclDoorOpen, true, 'past the ICL by stage alone');
  assert.equal(loadOld({ position: { x: 10, y: 8 } }).flags.iclDoorOpen, true, 'she was standing in the old ICL: never shut in');
});

test('FB-0071: an old save in the middle of the hunt (the ICL not reached yet) loads with the door sealed and still progresses: scan, then the key inside', () => {
  const { pickDialogEntry, applyDialogActions, keyStationDialog, gameEvents, GameState } = (() => {
    const g = loadGameData();
    g.localStorage.setItem('pixelquest.save.v1.default', JSON.stringify(oldSave({ quest: { stage: 'hunting', keys: { physicsLab: true, icl: false, room195: false } } })));
    g.loadGame('default', g.GameState);
    return g;
  })();
  assert.equal(GameState.flags.iclDoorOpen, undefined, 'the door is sealed for a save that never reached the ICL');
  assert.equal(isGateOpen(gate, GameState), false);
  gameEvents.on('minigame:requested', (p) => p.onResult('won'));
  applyDialogActions(pickDialogEntry({ id: 's', dialog: gate.scannerDialog }, GameState).entry.actions, GameState);
  assert.equal(isGateOpen(gate, GameState), true);
  applyDialogActions(pickDialogEntry({ id: 'icl', dialog: keyStationDialog('icl') }, GameState).entry.actions, GameState);
  assert.deepEqual(plain(GameState.quest.keys), { physicsLab: true, icl: true, room195: false });
  assert.equal(GameState.quest.stage, 'hunting');
});

test('FB-0071: isGateOpen / tileInGateRoom / gateBumped / objectiveTarget: the pure rules', () => {
  const fresh = { flags: {}, quest: { stage: 'hunting', keys: { icl: false } } };
  assert.equal(isGateOpen(gate, fresh), false);
  assert.equal(isGateOpen(gate, { ...fresh, flags: { iclDoorOpen: true } }), true);
  assert.equal(isGateOpen(gate, { flags: {}, quest: { stage: 'hunting', keys: { icl: true } } }), true);
  assert.equal(isGateOpen(gate, { flags: {}, quest: { stage: 'rewarded', keys: { icl: false } } }), true);
  assert.equal(isGateOpen(null, fresh), true, 'no gate data: nothing is locked');
  assert.equal(tileInGateRoom(gate, 6, 11), true);
  assert.equal(tileInGateRoom(gate, 6, 15), false, 'the corridor is outside');
  assert.equal(tileInGateRoom(gate, 16, 8), false, 'the wall is not the room');
  const g = { x: 9, y: 14, cellsW: 2 };
  assert.equal(gateBumped(g, 9, 15, true), true);
  assert.equal(gateBumped(g, 10, 15, true), true);
  assert.equal(gateBumped(g, 11, 15, true), false, 'in front of the scanner is not the hatch');
  assert.equal(gateBumped(g, 9, 16, true), false, 'a tile further back');
  assert.equal(gateBumped(g, 9, 15, false), false, 'not pushing up');
  // the guide: the scanner while sealed, the key station inside once open
  const quest = { stage: 'hunting', keys: { physicsLab: true, icl: false, room195: false } };
  assert.deepEqual(plain(objectiveTarget('main-block-1', quest, {})), { map: 'main-block-1', anchor: 'ICL scanner', whileFlagOff: 'iclDoorOpen' });
  assert.deepEqual(plain(objectiveTarget('main-block-1', quest, { iclDoorOpen: true })), { map: 'main-block-1', keyStation: 'icl' });
  assert.ok(resolveAnchor(objects, 'ICL scanner'), 'the scanner anchor resolves on the real map');
  assert.deepEqual(plain(objectiveTarget('main-block-g', quest, {})), { map: 'main-block-g', anchor: 'Main Block Stairs G (up)' }, 'other floors are unchanged');
});

// ======================================================================================================
// 6. The engine's door code, on a stand-in scene (the scene needs a browser; its door rules do not)
// ======================================================================================================

function standIn({ spawnTile = { x: 9, y: 16 }, state } = {}) {
  const GameState = state || game.GameState;
  const scene = Object.create(WorldScene.prototype);
  const placed = [];
  const events = [];
  scene.def = MAPS['main-block-1'];
  scene.mapKey = 'main-block-1';
  scene.mapObjects = objects;
  scene.tileInfo = tileInfo;
  scene.player = { x: (spawnTile.x + 0.5) * T, y: (spawnTile.y + 0.5) * T, body: { center: { x: (spawnTile.x + 0.5) * T }, bottom: spawnTile.y * T + T } };
  scene.keys = { UP: { isDown: true }, W: { isDown: false } };
  scene.solidLayers = [{ layer: { name: 'ground' } }, { layer: { name: 'structures' }, putTileAt: (gid, x, y) => placed.push({ gid, x, y }) }];
  scene.game = { events: { emit: (...args) => events.push(args) } };
  scene.scanners = [];
  scene.gates = [];
  scene.tileAnims = [];
  scene.rattled = [];
  scene.rattleDoor = (g) => scene.rattled.push(g.name);
  scene.overlays = [];
  scene.showDoorOverlay = (w) => { const o = { opened: false, destroyed: false, open(cb) { o.opened = true; cb(); }, destroy() { o.destroyed = true; } }; scene.overlays.push({ warp: w, o }); return o; };
  scene.tileImage = () => ({ setDepth() { return this; }, setFrame() { return this; } });
  scene.doorOverlayDepth = () => 1;
  scene.tweens = { add() {} };
  return { scene, placed, events };
}

test('FB-0071: createGates() leaves a fresh game\'s door SEALED (no tile swapped); the flag then opens it with the P4c animation and swaps its two tiles to the open frame', () => {
  const { GameState } = game;
  GameState.flags = {};
  GameState.quest = { stage: 'hunting', keys: { physicsLab: false, icl: false, room195: false } };
  const { scene, placed } = standIn();
  scene.createScanners();
  scene.createGates();
  assert.equal(scene.gates.length, 1);
  assert.equal(scene.gates[0].open, false);
  assert.equal(placed.length, 0, 'nothing changed: the closed, solid leaves stay');
  assert.equal(scene.scanners.length, 1);
  assert.equal(scene.scanners[0].def.dialog, gate.scannerDialog);
  scene.syncGates();
  assert.equal(scene.gates[0].open, false, 'no flag, still sealed');
  GameState.flags.iclDoorOpen = true; // what the scanner dialog's `setFlag` does
  scene.syncGates();
  assert.equal(scene.gates[0].open, true);
  assert.deepEqual(placed, DOOR_KINDS.iclHatch.open.map((name, i) => ({ gid: INDEX[name] + 1, x: 9 + i, y: 14 })), 'the two cells become the open (walkable) frame');
  assert.equal(scene.overlays.length, 1, 'the opening animation played');
  assert.deepEqual(plain(scene.overlays[0].warp.frames), plain(doorFrames(door.props)));
  assert.equal(scene.overlays[0].o.destroyed, true, 'and its overlay is cleaned up');
  assert.equal(scene.scanners[0].accepted, true, 'the scanner went green');
  scene.syncGates();
  assert.equal(placed.length, 2, 'opening twice changes nothing more');
});

test('FB-0071: createGates() opens the door at once, with no animation, for a save that already has the key, is past the ICL, or is standing in the lab', () => {
  const cases = [
    ['holds the ICL key', { stage: 'hunting', keys: { physicsLab: false, icl: true, room195: false } }, { x: 9, y: 16 }],
    ['the hunt is over', { stage: 'rewarded', keys: { physicsLab: true, icl: true, room195: true } }, { x: 9, y: 16 }],
    ['spawns inside the lab', { stage: 'hunting', keys: { physicsLab: false, icl: false, room195: false } }, { x: 8, y: 8 }],
  ];
  for (const [label, quest, spawnTile] of cases) {
    const { GameState } = game;
    GameState.flags = {};
    GameState.quest = quest;
    const { scene, placed } = standIn({ spawnTile });
    scene.createScanners();
    scene.createGates();
    assert.equal(scene.gates[0].open, true, label);
    assert.equal(placed.length, 2, `${label}: the open frame is in place`);
    assert.equal(scene.overlays.length, 0, `${label}: no animation on load`);
    assert.equal(GameState.flags.iclDoorOpen, true, `${label}: and the flag is recorded`);
  }
});

test('FB-0071: pushing up at the sealed hatch toasts "Sealed. Fingerprint scan required.", thuds and rattles once per approach; not when open, blocked, or in front of the scanner', () => {
  const { GameState } = game;
  GameState.flags = {};
  GameState.quest = { stage: 'hunting', keys: { physicsLab: false, icl: false, room195: false } };
  const { scene, events } = standIn({ spawnTile: { x: 10, y: 15 } });
  scene.createScanners();
  scene.createGates();
  scene.checkGateBump(false);
  scene.checkGateBump(false);
  assert.deepEqual(events.filter((e) => e[0] === 'toast').map((e) => e[1]), ['Sealed. Fingerprint scan required.'], 'once, not every frame');
  assert.deepEqual(scene.rattled, ['ICL door']);
  // walking away re-arms it
  scene.player.body = { center: { x: 10.5 * T }, bottom: 17 * T };
  scene.checkGateBump(false);
  scene.player.body = { center: { x: 10.5 * T }, bottom: 15 * T + T };
  scene.checkGateBump(false);
  assert.equal(scene.rattled.length, 2);
  // blocked (a dialog is open), not pushing up, in front of the scanner, or open: nothing
  const quiet = (setup) => { const s = standIn({ spawnTile: { x: 10, y: 15 } }); s.scene.createScanners(); s.scene.createGates(); setup(s.scene); s.scene.checkGateBump(setup.blocked === true); return s.scene.rattled.length; };
  assert.equal(quiet((s) => { s.keys = { UP: { isDown: false }, W: { isDown: false } }; }), 0, 'not pushing up');
  assert.equal(quiet((s) => { s.player.body = { center: { x: 11.5 * T }, bottom: 16 * T }; }), 0, 'in front of the scanner');
  GameState.flags.iclDoorOpen = true;
  assert.equal(quiet(() => {}), 0, 'an open door is not pushed at');
});

test('FB-0071: E picks the scanner or the sealed hatch by distance (the story priority beats a student), and an open hatch is no longer interactable', () => {
  const { GameState } = game;
  GameState.flags = {};
  GameState.quest = { stage: 'hunting', keys: { physicsLab: false, icl: false, room195: false } };
  const at = (x, y) => { const { scene } = standIn({ spawnTile: { x, y } }); scene.createScanners(); scene.createGates(); scene.npcs = []; scene.ambientNpcs = []; scene.keyStations = []; scene.lifts = []; scene.animals = []; scene.player.x = x * T + 8; scene.player.y = y * T + 8; return scene; };
  const front = at(11, 15).nearestInteractable();
  assert.equal(front.kind, 'scanner', 'in front of the scanner');
  assert.equal(front.def.name, 'Fingerprint scanner');
  const hatch = at(9, 15).nearestInteractable();
  assert.equal(hatch.kind, 'gate', 'in front of the hatch');
  assert.equal(hatch.def.dialog, gate.doorDialog);
  assert.equal(at(5, 18).nearestInteractable(), null, 'nothing out in the corridor');
  const scene = at(9, 15);
  scene.gates[0].open = true;
  assert.equal(scene.nearestInteractable(), null, 'open: nothing to use at the hatch any more');
  assert.equal(game.INTERACT_PRIORITY.scanner >= game.INTERACT_PRIORITY.questNpc, true);
});

test('FB-0071: whatever a dialog ran, syncKeyStations() drops the floating key icon once its key is held (Alice can hand it over too)', () => {
  const { GameState } = game;
  GameState.quest = { stage: 'hunting', keys: { physicsLab: false, icl: true, room195: false } };
  const { scene } = standIn();
  const collected = [];
  scene.collectKeyStation = (ks) => { ks.taken = true; collected.push(ks.def.id); };
  scene.keyStations = [{ def: { id: 'icl' }, taken: false }, { def: { id: 'room195' }, taken: false }];
  scene.syncKeyStations();
  assert.deepEqual(collected, ['icl'], 'only the key she holds');
});

test('FB-0071: world.js wires the new code: the creators run in create(), E interactions sync gates and keys after any dialog, the ICL route reads the flags', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  assert.match(src, /this\.createScanners\(\);\s*this\.createGates\(\);\s*this\.createTileAnims\(\);/);
  assert.match(src, /this\.syncGates\(\);\s*this\.syncKeyStations\(\);/);
  assert.match(src, /this\.checkGateBump\(blocked\);/);
  assert.match(src, /objectiveTarget\(this\.mapKey, GameState\.quest, GameState\.flags\)/);
  assert.match(src, /consider\('scanner', 'scanner', scanner, scanner\.def\)/);
});

// ======================================================================================================
// 7. The flyer, re-skinned as the fingerprint hack
// ======================================================================================================

test('FB-0071: the flyer is "ICL Fingerprint Hack": same target and rules, no key (no item, door wording on its cards), an intro card of at most 3 lines (title + 2)', () => {
  const def = MINIGAMES.flappy;
  assert.equal(def.name, 'ICL Fingerprint Hack');
  assert.equal(def.id, 'flappy', 'the id and scene key are kept: old saves\' progress (GameState.minigames.flappy) still applies');
  assert.equal(def.sceneKey, 'minigame-flappy');
  assert.equal(def.scoreTarget, 8, 'scoreTarget unchanged');
  assert.equal(def.item, undefined);
  assert.equal(def.opens, 'iclDoorOpen');
  const card = [def.name, ...def.instructions];
  assert.ok(card.length <= 3, `the intro card is ${card.length} lines`);
  assert.deepEqual(plain(def.instructions), ['SPACE: FLAP', 'SLIP THROUGH 8 FIREWALLS TO CRACK THE SCAN']);
  for (const line of def.instructions) assert.ok(line.length <= game.MG_INSTRUCTION_MAX_CHARS, `"${line}" fits the card`);
  for (const text of Object.values(def.cards)) assert.doesNotMatch(text, /\bkey\b/i, `"${text}" talks about a key, but this game opens a door`);
  // the scene: firewalls (not racks), a data packet (not the lead), the scan fills with the score, the old rules are untouched
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'flappy.js'), 'utf8');
  assert.match(src, /drawWall\(/);
  assert.doesNotMatch(src, /drawRack\(/);
  assert.match(src, /'flappy-sprites'/);
  assert.match(src, /setScore\(score\) \{\s*super\.setScore\(score\);\s*this\.drawScan\(\);/, 'the scan ring fills as the score rises');
  assert.match(src, /flappyHitsPipe\(FL_BIRD_X, this\.bird\.y, FLAPPY_BIRD_RADIUS, pipe\)/, 'the collision rules are flappy-logic.js\'s own');
  for (const file of ['flappy-bg.png', 'flappy-sprites.png']) assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'minigames', file)), `${file} exists`);
  const sprites = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'minigames', 'flappy-sprites.png')));
  assert.deepEqual([sprites.width, sprites.height], [64, 16], 'four 16x16 packet frames');
});

test('FB-0071: the win and skip cards of a door game use their own wording and reserve no key-icon gap; a key game keeps the key wording', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'framework-scene.js'), 'utf8');
  assert.match(src, /cards\.skipLabel \|\| 'SKIP -- TAKE THE KEY ANYWAY'/);
  assert.match(src, /cards\.winTitle \|\| 'YOU GOT IT!'/);
  assert.match(src, /hasKey \? \[\.\.\.Array\(MG_WIN_BLANK_LINES\)\.fill\(''\)\] : \[''\]/);
  for (const id of ['hero', 'tower']) assert.equal(MINIGAMES[id].cards, undefined, `${id} keeps the key wording`);
});
