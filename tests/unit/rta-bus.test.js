// Birthday sprint, package D: the RTA (Dubai) bus arrival. Covers, without a browser: the sheet constants
// (src/scripts.js RTA_BUS_SHEET) against what tools/make-cutscenes.js really draws, the generated art's
// shape (frame size, the baked shadow staying under the body), the script data (every step type exists in
// the runner, every sprite/sound/frame it names exists), the new runner steps (`frame`, `anim`, the
// `spawnActor` frame/shadow/feet options) on a fake scene, the bus's stop against the real Gate 2 map,
// and that no ambient line mentions a food truck.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const { execFileSync } = require('child_process');
const { ROOT, loadGameData } = require('../helpers/game-data');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));

// The sheet constants live in src/scripts.js as a top-level `const`, which the shared helper doesn't export.
function loadSheet() {
  const context = vm.createContext({ console });
  vm.runInContext(read('src/scripts.js'), context, { filename: 'src/scripts.js' });
  return plain(vm.runInContext('RTA_BUS_SHEET', context));
}
const SHEET = loadSheet();
const FRAME_COUNT = Object.keys(SHEET.frames).length;

// Generates the cutscene art into a temp dir (it needs no vendor art) and decodes the bus sheet.
function generateBusSheet() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-rta-bus-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-cutscenes.js'), '--out', out], { stdio: 'pipe' });
    const buf = fs.readFileSync(path.join(out, path.basename(SHEET.file)));
    let pos = 8;
    let width = 0;
    let height = 0;
    const idat = [];
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos);
      const type = buf.toString('ascii', pos + 4, pos + 8);
      const data = buf.subarray(pos + 8, pos + 8 + len);
      if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
      if (type === 'IDAT') idat.push(data);
      pos += 12 + len;
    }
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const rgba = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) raw.copy(rgba, y * width * 4, y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1));
    return { width, height, rgba, committed: buf.equals(fs.readFileSync(path.join(ROOT, SHEET.file))) };
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

// ---------- the sheet ----------

test('RTA bus sheet: the src/scripts.js constants match the generator (name list, frame size, file)', () => {
  const generator = read('tools/make-cutscenes.js');
  const names = generator.match(/const BUS_FRAME_NAMES = \[([^\]]+)\]/)[1].split(',').map((n) => n.trim().replace(/'/g, ''));
  const w = Number(generator.match(/const BUS_FRAME_W = (\d+)/)[1]);
  const h = Number(generator.match(/const BUS_FRAME_H = (\d+)/)[1]);
  assert.deepEqual(names, Object.keys(SHEET.frames), 'frame names (and their order) differ between generator and RTA_BUS_SHEET');
  Object.values(SHEET.frames).forEach((index, i) => assert.equal(index, i, 'frame indexes must be 0..n-1 in sheet order'));
  assert.equal(w, SHEET.frameWidth);
  assert.equal(h, SHEET.frameHeight);
  assert.ok(generator.includes(`write('${path.basename(SHEET.file)}'`), 'the generator does not write the sheet file RTA_BUS_SHEET names');
  assert.equal(FRAME_COUNT, 5, 'closed, halfOpen, open, closing, driving');
  for (const name of ['closed', 'halfOpen', 'open', 'closing', 'driving']) assert.ok(name in SHEET.frames, `missing frame ${name}`);
});

test('RTA bus sheet: the generated PNG is frameWidth*frames x frameHeight and the committed file is current', () => {
  const sheet = generateBusSheet();
  assert.equal(sheet.width, SHEET.frameWidth * FRAME_COUNT);
  assert.equal(sheet.height, SHEET.frameHeight);
  assert.ok(sheet.committed, `${SHEET.file} is out of date: run \`node tools/make-cutscenes.js\``);
});

test('RTA bus sheet: every frame is different, and the baked shadow never reaches past the body', () => {
  const { width, rgba } = generateBusSheet();
  const fw = SHEET.frameWidth;
  const fh = SHEET.frameHeight;
  const frameBytes = (i) => {
    const rows = [];
    for (let y = 0; y < fh; y++) rows.push(rgba.subarray((y * width + i * fw) * 4, (y * width + (i + 1) * fw) * 4));
    return Buffer.concat(rows);
  };
  for (let a = 0; a < FRAME_COUNT; a++) {
    for (let b = a + 1; b < FRAME_COUNT; b++) assert.ok(!frameBytes(a).equals(frameBytes(b)), `frames ${a} and ${b} are identical`);
  }
  for (let i = 0; i < FRAME_COUNT; i++) {
    let bodyMin = fw; let bodyMax = -1; let shadowMin = fw; let shadowMax = -1; let shadowPixels = 0;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const alpha = rgba[(y * width + i * fw + x) * 4 + 3];
        if (alpha === 255) { bodyMin = Math.min(bodyMin, x); bodyMax = Math.max(bodyMax, x); }
        else if (alpha > 0) { shadowMin = Math.min(shadowMin, x); shadowMax = Math.max(shadowMax, x); shadowPixels++; }
      }
    }
    assert.equal(bodyMax - bodyMin + 1, 96, `frame ${i}: the body (with its outline) should be 96px wide`);
    assert.ok(shadowPixels > 40, `frame ${i}: no baked shadow`);
    assert.ok(shadowMin >= bodyMin && shadowMax <= bodyMax, `frame ${i}: the shadow (${shadowMin}..${shadowMax}) overshoots the body (${bodyMin}..${bodyMax})`);
  }
});

test('RTA bus sheet: only the doc palette is used (ten colours plus the outline and the shadow)', () => {
  const { width, height, rgba } = generateBusSheet();
  const allowed = new Set(['E4E6EC', 'C4C7D0', 'EDE8E0', 'B9B3AB', 'D3232A', '8E2021', '2B2A30', '4A5160', '14131A', '9AA0A8']);
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3];
    if (a === 0) continue;
    const hex = [0, 1, 2].map((c) => rgba[i * 4 + c].toString(16).padStart(2, '0')).join('').toUpperCase();
    if (a < 255) assert.equal(hex, '000000', 'a translucent pixel that is not shadow');
    else assert.ok(allowed.has(hex), `colour #${hex} is outside docs/research/rta-bus-reference.md's palette`);
  }
});

// ---------- the script data ----------

test('SCRIPTS: every step type exists in the runner, and the bus steps only name real sprites, sounds and frames', () => {
  const { SCRIPTS, MAPS, AMBIENT } = loadGameData();
  const runner = read('src/scripts-runtime.js');
  const implemented = new Set([...runner.matchAll(/^\s+(?:async )?step_(\w+)\(/gm)].map((m) => m[1]));
  for (const needed of ['frame', 'anim', 'spawnActor', 'despawnActor', 'move', 'placeActor', 'setActorVisible', 'sound']) assert.ok(implemented.has(needed), `runner lacks step_${needed}`);
  const soundIds = new Set(Object.keys(vm.runInContext('SOUNDS', (() => { const c = vm.createContext({ console }); vm.runInContext(read('src/audio.js'), c); return c; })())));

  const actors = new Map(); // id -> sprite key, as the script spawns them
  const check = (step, where) => {
    const type = Object.keys(step)[0];
    assert.ok(implemented.has(type), `${where}: step "${type}" has no step_${type} in src/scripts-runtime.js`);
    const body = step[type];
    if (type === 'parallel') body.forEach((s, i) => check(s, `${where}.parallel[${i}]`));
    if (type === 'sound') assert.ok(soundIds.has(body), `${where}: unknown sound "${body}"`);
    if (type === 'spawnActor' && body.kind === 'image') {
      assert.equal(body.sprite, SHEET.key, `${where}: an image actor that is not the bus sheet`);
      assert.ok(body.frame >= 0 && body.frame < FRAME_COUNT, `${where}: spawn frame ${body.frame} is outside the sheet`);
      actors.set(body.id, body.sprite);
    }
    if (type === 'frame') {
      assert.equal(actors.get(body.actor), SHEET.key, `${where}: frame step on an actor that is not a spawned sheet actor`);
      assert.ok(Number.isInteger(body.frame) && body.frame >= 0 && body.frame < FRAME_COUNT, `${where}: frame ${body.frame} outside the sheet`);
    }
    if (type === 'anim') {
      assert.equal(actors.get(body.actor), SHEET.key, `${where}: anim step on an actor that is not a spawned sheet actor`);
      assert.ok(body.frames.length > 0 && body.frameMs > 0, `${where}: empty anim`);
      for (const f of body.frames) assert.ok(Number.isInteger(f) && f >= 0 && f < FRAME_COUNT, `${where}: anim frame ${f} outside the sheet`);
    }
  };
  for (const [key, steps] of Object.entries(SCRIPTS)) {
    actors.clear();
    steps.forEach((step, i) => check(step, `SCRIPTS.${key}[${i}]`));
  }
  assert.ok(MAPS && AMBIENT);
});

test('SCRIPTS.opening: the bus drives in, opens, she steps out, it closes and pulls away, then Mustafa continues', () => {
  const { SCRIPTS } = loadGameData();
  const steps = plain(SCRIPTS.opening);
  const at = (pred) => steps.findIndex(pred);
  const spawn = at((s) => s.spawnActor && s.spawnActor.id === 'bus');
  const arrive = at((s) => s.move && s.move.actor === 'bus');
  const open = at((s) => s.anim && s.anim.frames.at(-1) === SHEET.frames.open);
  const reveal = at((s) => s.setActorVisible && s.setActorVisible.actor === 'player' && s.setActorVisible.visible === true);
  const close = at((s) => s.anim && s.anim.frames.at(-1) === SHEET.frames.closed);
  const leave = steps.findIndex((s, i) => i > close && s.move && s.move.actor === 'bus');
  const despawn = at((s) => s.despawnActor === 'bus');
  const mustafa = at((s) => s.spawnActor && s.spawnActor.id === 'mustafa');
  const order = [spawn, arrive, open, reveal, close, leave, despawn, mustafa];
  assert.ok(order.every((i) => i >= 0), `missing beat: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'beats out of order');
  assert.deepEqual(steps[open].anim.frames, [SHEET.frames.halfOpen, SHEET.frames.open]);
  assert.deepEqual(steps[close].anim.frames, [SHEET.frames.closing, SHEET.frames.closed]);
  assert.equal(steps.filter((s) => s.sound === 'doorOpen').length, 2, 'a soft door sound on opening and on closing');
  assert.equal(steps[spawn].spawnActor.shadow, false, 'the sheet has its own baked shadow');
  // She is hidden before the bus arrives and her input stays locked/letterboxed for the whole thing.
  assert.deepEqual(steps[0], { lockInput: true });
  assert.deepEqual(steps[1], { letterbox: 'in' });
  assert.ok(steps.findIndex((s) => s.setActorVisible && s.setActorVisible.visible === false) < spawn);
});

// ---------- the runner steps on a fake scene ----------

function makeRunner() {
  const context = vm.createContext({
    console,
    Phaser: { Events: { EventEmitter: class { on() { return this; } emit() { return true; } } } },
    URLSearchParams,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    window: { game: { events: { on() {}, emit() {} } } },
    toPixel: (tiles) => tiles * 16,
  });
  for (const file of ['src/state.js', 'src/audio.js', 'src/scripts-runtime.js']) vm.runInContext(read(file), context, { filename: file });
  const ScriptRunner = vm.runInContext('ScriptRunner', context);
  const made = [];
  const scene = {
    transitioning: false,
    time: { delayedCall(ms, cb) { const h = setTimeout(cb, ms); return { remove: () => clearTimeout(h) }; } },
    add: {
      image(x, y, key, frame) {
        const s = { x, y, key, frame, displayHeight: 48, displayWidth: 104, depth: 0, frames: [], setDepth(d) { this.depth = d; return this; }, setFrame(f) { this.frames.push(f); this.frame = f; return this; } };
        made.push(s);
        return s;
      },
      ellipse() { const e = { setDepth() { return e; } }; made.push({ ellipse: true }); return e; },
    },
  };
  return { runner: new ScriptRunner(scene), made };
}

test('runner: spawnActor on a sheet takes a frame, can skip the ellipse shadow, and sorts by its own ground line', async () => {
  const { runner, made } = makeRunner();
  await runner.run([{ spawnActor: { id: 'bus', sprite: 'rta-bus', kind: 'image', frame: 4, shadow: false, feet: 19, at: { x: 10, y: 20 } } }]);
  const sprite = made.find((m) => m.key === 'rta-bus');
  assert.equal(sprite.frame, 4);
  assert.ok(!made.some((m) => m.ellipse), 'shadow:false must not create the generated ellipse');
  assert.equal(sprite.depth, 20 * 16 + 19, 'depth uses `feet`, not the bottom of the transparent margin');
  assert.equal(runner.actorFeetOffset(runner.actors.get('bus')), 19);
  // Without the options, the old behaviour (shadow, bottom edge) is unchanged.
  const other = makeRunner();
  await other.runner.run([{ spawnActor: { id: 'x', sprite: 'plain', kind: 'image', at: { x: 1, y: 1 } } }]);
  assert.ok(other.made.some((m) => m.ellipse));
  assert.equal(other.runner.actorFeetOffset(other.runner.actors.get('x')), 24);
});

test('runner: `frame` sets one frame at once; `anim` shows each frame for frameMs and keeps the last', async () => {
  const { runner, made } = makeRunner();
  await runner.run([{ spawnActor: { id: 'bus', sprite: 'rta-bus', kind: 'image', frame: 4, at: { x: 0, y: 0 } } }]);
  const sprite = made.find((m) => m.key === 'rta-bus');
  await runner.run([{ frame: { actor: 'bus', frame: 0 } }]);
  assert.deepEqual(sprite.frames, [0]);
  const start = Date.now();
  await runner.run([{ anim: { actor: 'bus', frames: [1, 2], frameMs: 25 } }]);
  assert.deepEqual(sprite.frames, [0, 1, 2]);
  assert.ok(Date.now() - start >= 45, 'two frames of 25ms should take about 50ms');
  assert.equal(sprite.frame, 2, 'the last frame stays up');
  // An unknown actor or an empty frame list is a quiet no-op, never a throw.
  await runner.run([{ anim: { actor: 'nobody', frames: [1] } }, { anim: { actor: 'bus', frames: [] } }, { frame: { actor: 'nobody', frame: 1 } }]);
  assert.deepEqual(sprite.frames, [0, 1, 2]);
});

test('runner: Esc during an anim snaps to its last frame at once, and a later anim does the same while skipping', async () => {
  const { runner, made } = makeRunner();
  await runner.run([{ spawnActor: { id: 'bus', sprite: 'rta-bus', kind: 'image', frame: 0, at: { x: 0, y: 0 } } }]);
  const sprite = made.find((m) => m.key === 'rta-bus');
  const start = Date.now();
  const running = runner.run([
    { anim: { actor: 'bus', frames: [1, 2], frameMs: 5_000 } },
    { anim: { actor: 'bus', frames: [3, 0], frameMs: 5_000 } }, // not reached yet when Esc lands
  ]);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(sprite.frame, 1);
  runner.skip();
  await running;
  assert.ok(Date.now() - start < 1_000, 'skip must not wait out the frames');
  assert.equal(sprite.frame, 0, 'ends on the final state of the last anim');
});

// ---------- the real map ----------

test('the bus stop sits on the real Gate 2 road: asphalt under the wheels, sand to step onto, the road end off-screen', () => {
  const { SCRIPTS } = loadGameData();
  const map = JSON.parse(read('assets/maps/campus.json'));
  const names = JSON.parse(read('assets/tiles.json')).tiles.map((t) => t.name);
  const layer = (name) => map.layers.find((l) => l.name === name).data;
  const [ground, structures] = [layer('ground'), layer('structures')];
  const tileAt = (x, y) => {
    const s = structures[y * map.width + x] - 1;
    return s >= 0 ? names[s] : names[ground[y * map.width + x] - 1];
  };
  const gate = map.layers.find((l) => l.type === 'objectgroup').objects.find((o) => o.name === 'Gate 2 (Main Entrance)');
  const gx = gate.x / 16;
  const gy = gate.y / 16;

  const steps = plain(SCRIPTS.opening);
  const busSpawn = steps.find((s) => s.spawnActor && s.spawnActor.id === 'bus').spawnActor;
  const stops = steps.filter((s) => s.move && s.move.actor === 'bus').map((s) => s.move.path.at(-1).offset);
  const [stop, exit] = stops;
  const spawnOffset = busSpawn.at.offset;
  const frameW = SHEET.frameWidth / 16;
  const feetY = gy + stop[1] + busSpawn.feet / 16; // the wheel line, in tiles
  const row = Math.floor(feetY - 0.1); // the road row the wheels sit in
  const bodyHalf = 96 / 2 / 16;
  for (let x = Math.floor(gx + stop[0] - bodyHalf); x <= Math.floor(gx + stop[0] + bodyHalf); x++) {
    assert.equal(tileAt(x, row), 'asphalt', `no road under the bus at (${x}, ${row}): ${tileAt(x, row)}`);
  }
  // Where she steps out and walks to: open sand, not a wall, fence, tree or kerb.
  const playerSteps = steps.filter((s) => (s.placeActor || (s.move && s.move.actor === 'player')));
  const standPoints = [playerSteps[0].placeActor.at.offset, playerSteps[1].move.path.at(-1).offset];
  const sandRow = Math.floor(gy + standPoints[1][1]);
  // FB-0049: the road now has a kerbed pavement on both sides, so the first step south of it is pavement (kerb tile) or sand.
  const landing = tileAt(Math.floor(gx + standPoints[1][0]), sandRow);
  assert.ok(landing === 'sand' || landing.startsWith('kerb'), `she should land on the pavement/sand, not ${landing}`);
  // Her feet (8px below her origin) start below the bus's ground line, so she is drawn in front of it.
  assert.ok(gy + standPoints[0][1] + 0.5 > feetY, 'she would be hidden behind the bus when she steps out');
  // Camera: centred 6 tiles east of the gate, 10 tiles to each side. The bus starts fully off the left
  // edge and ends fully off the right edge, so it is never seen on the sand beyond the road's west end.
  const pan = steps.find((s) => s.cameraPan).cameraPan.to.offset;
  const left = gx + pan[0] - 10;
  const right = gx + pan[0] + 10;
  assert.ok(gx + spawnOffset[0] + frameW / 2 <= left, 'the bus starts visibly on screen');
  assert.ok(gx + exit[0] - frameW / 2 >= right, 'the bus does not drive fully off screen');
  // The road runs east of the avenue's mouth, so a bus on this road in this stretch is on asphalt.
  assert.equal(tileAt(Math.floor(gx + stop[0]), row), 'asphalt');
});

// ---------- the ambient dialogue ----------

test('no ambient line mentions a food truck (there is none on the campus)', () => {
  // ADR 0018: the old generic AMBIENT_DEFAULT_LINES pool is gone; what ambient students say now is the
  // role openers and campus facts (src/campus-facts.js), so that is the text checked here.
  const { AMBIENT, CAMPUS_ROLES, CAMPUS_FACTS } = loadGameData();
  const text = JSON.stringify([AMBIENT, CAMPUS_ROLES, CAMPUS_FACTS]).toLowerCase();
  assert.ok(!text.includes('food truck'));
  assert.ok(CAMPUS_FACTS.length >= 30, 'the talk pool is intact');
  assert.ok(!read('src/ambient.js').includes('AMBIENT_DEFAULT_LINES'), 'the retired generic pool stays gone');
});
