// Golden hour (src/daylight.js, wow idea W4/W9): the light moves from morning to dusk as the keys are found. Without a browser this covers the
// pure rules (the phases, the parameters, the brightness floor, the blend, the lamp scan on the real maps, the dust motes) and, as source
// assertions, the wiring in src/scenes/world.js (what the renderers do with it needs a real browser: see the coordinator's checklist).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadGameData, ROOT } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const g = loadGameData();
const ev = (name) => g.evaluate(name);
const PHASES = ['morning', 'midday', 'golden', 'dusk'];

test('daylight: dayPhase maps keys and stage to morning, midday, golden hour, dusk', () => {
  const dayPhase = ev('dayPhase');
  assert.deepEqual(JSON.parse(JSON.stringify(dayPhase(0, 'arrival'))), { id: 'morning', index: 0 });
  assert.equal(dayPhase(0, 'hunting').id, 'morning');
  assert.equal(dayPhase(1, 'hunting').id, 'midday');
  assert.equal(dayPhase(2, 'hunting').id, 'golden');
  assert.equal(dayPhase(3, 'hunting').id, 'dusk');
  assert.equal(dayPhase(3, 'hunting').index, 3);
  assert.equal(dayPhase(0, 'rewarded').id, 'dusk', 'the box handed over is dusk whatever the key count says');
  assert.equal(dayPhase(7, 'hunting').id, 'dusk', 'more than 3 is still dusk');
  for (const odd of [undefined, null, NaN, -2, 'x']) assert.equal(dayPhase(odd, undefined).id, 'morning', `odd input ${odd} is the bright morning`);
});

test('daylight: dayPhaseFromQuest derives the phase from GameState.quest alone (no save field needed), Continue included', () => {
  const fromQuest = ev('dayPhaseFromQuest');
  assert.equal(fromQuest(g.GameState.quest).id, 'morning', 'a new game');
  assert.equal(fromQuest({ stage: 'hunting', keys: { physicsLab: true, icl: false, room195: false } }).id, 'midday');
  assert.equal(fromQuest({ stage: 'hunting', keys: { physicsLab: true, icl: true, room195: false } }).id, 'golden');
  assert.equal(fromQuest({ stage: 'hunting', keys: { physicsLab: true, icl: true, room195: true } }).id, 'dusk');
  assert.equal(fromQuest({ stage: 'rewarded', keys: { physicsLab: false, icl: false, room195: false } }).id, 'dusk');
  assert.equal(fromQuest(undefined).id, 'morning');
  // an old save (no new fields at all) round-trips through the real save code to the same phase
  g.GameState.quest.stage = 'hunting';
  g.GameState.quest.keys.icl = true;
  g.GameState.quest.keys.room195 = true;
  g.saveGame('daylight-test');
  g.resetGameState();
  assert.equal(fromQuest(g.GameState.quest).id, 'morning');
  g.loadGame('daylight-test');
  assert.equal(fromQuest(g.GameState.quest).id, 'golden');
  assert.ok(!JSON.stringify(g.snapshotState(g.GameState)).includes('daylight'), 'no new save field');
});

test('daylight: parameters are deterministic and the table has the shape the scene reads', () => {
  const params = ev('daylightParams');
  for (const id of PHASES) {
    for (const indoors of [false, true]) {
      const a = params(id, indoors);
      assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(params(id, indoors))));
      assert.deepEqual(Object.keys(a).sort(), ['alpha', 'halo', 'motes', 'tint', 'vignette', 'warm']);
      assert.ok(Number.isInteger(a.tint) && a.tint >= 0 && a.tint <= 0xffffff);
      for (const key of ['alpha', 'vignette', 'halo', 'warm']) assert.ok(a[key] >= 0 && a[key] <= 1, `${id} ${key}`);
      assert.ok(Number.isInteger(a.motes) && a.motes >= 0 && a.motes <= ev('DAYLIGHT_MOTE_MAX'));
    }
  }
  // the phase may be given as an id, an index or the dayPhase() object
  assert.deepEqual(JSON.parse(JSON.stringify(params(2, false))), JSON.parse(JSON.stringify(params('golden', false))));
  assert.deepEqual(JSON.parse(JSON.stringify(params(ev('dayPhase')(2, 'hunting'), false))), JSON.parse(JSON.stringify(params('golden', false))));
  // each call hands out a new object: the table cannot be changed by a caller
  const first = params('golden', false);
  first.alpha = 0.99;
  assert.notEqual(params('golden', false).alpha, 0.99);
});

test('daylight: warmth and strength rise monotonically from midday to dusk, morning is almost neutral, dusk is the strongest', () => {
  const params = ev('daylightParams');
  const strength = ev('daylightStrength');
  const warm = PHASES.map((id) => params(id, false).warm);
  for (let i = 1; i < warm.length; i++) assert.ok(warm[i] >= warm[i - 1], `warmth rises: ${PHASES[i - 1]} -> ${PHASES[i]}`);
  const s = PHASES.map((id) => strength(params(id, false)));
  assert.ok(s[0] < 0.02, `morning is almost nothing (${s[0]})`);
  assert.ok(s[1] < 0.005, `midday is neutral and crisp (${s[1]})`);
  assert.ok(s[1] < s[2] && s[2] < s[3], 'midday < golden hour < dusk');
  assert.ok(s[3] === Math.max(...s), 'dusk is the strongest');
  assert.ok(s[2] > 0.05, 'golden hour is visible');
  // the extras follow the same ladder: glow and dust only from golden hour on, more at dusk
  const halo = PHASES.map((id) => params(id, false).halo);
  const motes = PHASES.map((id) => params(id, false).motes);
  const vignette = PHASES.map((id) => params(id, false).vignette);
  assert.deepEqual([halo[0], halo[1]], [0, 0]);
  assert.ok(halo[2] > 0 && halo[3] > halo[2]);
  assert.deepEqual([motes[0], motes[1]], [0, 0]);
  assert.ok(motes[2] >= 6 && motes[3] > motes[2] && motes[3] <= 10, 'a handful of motes: 6 at golden hour, up to 10 at dusk');
  assert.ok(vignette[2] > vignette[1] && vignette[3] > vignette[2], 'the vignette deepens at golden hour and dusk');
});

test('daylight: never darker than the 85% floor at any phase, indoors or out, and the corners stay readable too', () => {
  const params = ev('daylightParams');
  const bright = ev('daylightBrightness');
  const edge = ev('daylightEdgeBrightness');
  const factor = ev('overlayFactor');
  assert.equal(ev('DAYLIGHT_MIN_BRIGHTNESS'), 0.85);
  for (const id of PHASES) {
    for (const indoors of [false, true]) {
      const p = params(id, indoors);
      assert.ok(bright(p) >= ev('DAYLIGHT_MIN_BRIGHTNESS'), `${id} ${indoors ? 'indoors' : 'outdoors'} brightness ${bright(p)}`);
      assert.ok(edge(p) >= ev('DAYLIGHT_EDGE_BRIGHTNESS'), `${id} ${indoors ? 'indoors' : 'outdoors'} corner brightness ${edge(p)}`);
      for (const f of factor(p)) assert.ok(f >= 0.7 && f <= 1, `${id}: no single colour channel is cut below 70%`);
    }
  }
  // the maths is the renderers' MULTIPLY: alpha 0 or a white tint changes nothing
  assert.deepEqual(Array.from(factor({ tint: 0xffffff, alpha: 1, vignette: 0, halo: 0, motes: 0, warm: 0 })), [1, 1, 1]);
  assert.deepEqual(Array.from(factor({ tint: 0x000000, alpha: 0, vignette: 0, halo: 0, motes: 0, warm: 0 })), [1, 1, 1]);
  assert.deepEqual(Array.from(factor({ tint: 0x808080, alpha: 1, vignette: 0, halo: 0, motes: 0, warm: 0 }), (v) => Math.round(v * 255)), [128, 128, 128]);
});

test('daylight: indoors is a gentler version of outdoors: about 40% overlay, no dust, softer vignette, same warm tint', () => {
  const params = ev('daylightParams');
  const strength = ev('daylightStrength');
  assert.equal(ev('DAYLIGHT_INDOOR_STRENGTH'), 0.4);
  for (const id of PHASES) {
    const out = params(id, false);
    const inn = params(id, true);
    assert.equal(inn.tint, out.tint, `${id}: the same colour`);
    assert.ok(Math.abs(inn.alpha - out.alpha * 0.4) < 1e-9, `${id}: overlay at 40%`);
    assert.ok(inn.vignette <= out.vignette && inn.halo <= out.halo, `${id}: softer`);
    assert.equal(inn.motes, 0, `${id}: no dust indoors`);
    assert.ok(strength(inn) <= strength(out) + 1e-12, `${id}: indoors is not stronger`);
  }
  assert.ok(strength(params('dusk', true)) < strength(params('golden', false)), 'dusk indoors is gentler than golden hour outdoors');
  assert.ok(params('golden', true).halo > 0 && params('dusk', true).halo > params('golden', true).halo, 'the chandeliers glow from golden hour');
});

test('daylight: lerpParams blends tint channel by channel, hits both ends exactly, clamps t, and can reuse an object (no per-frame allocation)', () => {
  const params = ev('daylightParams');
  const lerp = ev('lerpParams');
  const a = params('midday', false);
  const b = params('dusk', false);
  assert.deepEqual(JSON.parse(JSON.stringify(lerp(a, b, 0))), JSON.parse(JSON.stringify(a)));
  assert.deepEqual(JSON.parse(JSON.stringify(lerp(a, b, 1))), JSON.parse(JSON.stringify(b)));
  assert.deepEqual(JSON.parse(JSON.stringify(lerp(a, b, -3))), JSON.parse(JSON.stringify(a)));
  assert.deepEqual(JSON.parse(JSON.stringify(lerp(a, b, 9))), JSON.parse(JSON.stringify(b)));
  const mid = lerp({ ...a, tint: 0x000000 }, { ...b, tint: 0xfefefe }, 0.5);
  assert.equal(mid.tint, 0x7f7f7f);
  const half = lerp(a, b, 0.5);
  assert.ok(Math.abs(half.alpha - (a.alpha + b.alpha) / 2) < 1e-9 && Number.isInteger(half.motes));
  const out = { stale: true };
  assert.equal(lerp(a, b, 0.3, out), out, 'writes into the given object');
  assert.deepEqual(Object.keys(out).filter((k) => k !== 'stale').sort(), ['alpha', 'halo', 'motes', 'tint', 'vignette', 'warm']);
  // every blended step in a transition keeps the brightness floor (golden hour -> dusk and midday -> golden hour, in 50 steps)
  const bright = ev('daylightBrightness');
  for (const [from, to] of [['morning', 'midday'], ['midday', 'golden'], ['golden', 'dusk']]) {
    const scratch = {};
    for (let i = 0; i <= 50; i++) assert.ok(bright(lerp(params(from, false), params(to, false), ev('daylightEase')(i / 50), scratch)) >= 0.85, `${from} -> ${to} step ${i}`);
  }
  // copyParams
  const copy = ev('copyParams')(b, {});
  assert.deepEqual(JSON.parse(JSON.stringify(copy)), JSON.parse(JSON.stringify(b)));
});

test('daylight: the transition ease is a smooth 0..1 and the fade is about 2.5 s with a failsafe behind it', () => {
  const ease = ev('daylightEase');
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(ease(-1), 0);
  assert.equal(ease(2), 1);
  assert.equal(ease(0.5), 0.5);
  let last = -1;
  for (let i = 0; i <= 20; i++) { const v = ease(i / 20); assert.ok(v >= last); last = v; }
  assert.equal(ev('DAYLIGHT_FADE_MS'), 2500);
  assert.ok(ev('DAYLIGHT_FAILSAFE_MS') > ev('DAYLIGHT_FADE_MS'), 'the failsafe only fires after the fade should have ended');
});

test('daylight: haloColor runs from cream to amber and stays a valid colour', () => {
  const halo = ev('haloColor');
  assert.equal(halo(0), 0xfff1c9);
  assert.equal(halo(1), 0xffb268);
  assert.equal(halo(-4), halo(0));
  assert.equal(halo(4), halo(1));
});

test('daylight: ?daylight=0 switches it off, anything else leaves it on', () => {
  const enabled = ev('daylightEnabled');
  assert.equal(enabled('?daylight=0'), false);
  assert.equal(enabled('?dev=0&daylight=0&map=campus'), false);
  assert.equal(enabled(''), true);
  assert.equal(enabled('?daylight=1'), true);
  assert.equal(enabled('?moments=0'), true);
});

test('daylight: the lamp scan finds the real street lamps and chandeliers, and ignores the lab light bars', () => {
  const scan = ev('findLightSpots');
  const names = g.tileInfo.tiles.map((t) => t.name);
  const layersOf = (key) => {
    const json = JSON.parse(read('assets', 'maps', `${key}.json`));
    return json.layers.filter((l) => l.type === 'tilelayer').map((l) => ({ data: l.data, width: json.width, offset: 1 }));
  };
  const campus = scan(layersOf('campus'), names, 16);
  assert.ok(campus.length >= 2 && campus.every((s) => s.kind === 'lamp'), `the campus has street lamps (${campus.length})`);
  // a lamp's glow sits on its head tile: the overhead lampPostTop tile (centre of the tile)
  const campusJson = JSON.parse(read('assets', 'maps', 'campus.json'));
  const overhead = campusJson.layers.find((l) => l.name === 'overhead');
  for (const s of campus) {
    const tx = Math.floor(s.x / 16);
    const ty = Math.floor(s.y / 16);
    assert.equal(names[overhead.data[ty * campusJson.width + tx] - 1], 'lampPostTop');
    assert.equal(s.x % 16, 8);
    assert.equal(s.y % 16, 8);
  }
  const foyer = scan(layersOf('main-block-g'), names, 16);
  assert.ok(foyer.length >= 1 && foyer.every((s) => s.kind === 'chandelier'), 'the foyer chandeliers glow');
  for (const key of ['library-block-g', 'mechanical-block-1', 'main-block-3']) {
    assert.ok(scan(layersOf(key), names, 16).every((s) => s.kind !== 'lamp'), `${key}: no cyan light bar is picked up as a lamp`);
  }
  // a plain grid (offset 0, the text maps), empty cells and flip bits
  const light = names.indexOf('lampPostTop');
  assert.deepEqual(JSON.parse(JSON.stringify(scan([{ data: [-1, 0, light, -1], width: 2, offset: 0 }], names, 16))), [{ kind: 'lamp', x: 8, y: 24, size: 56 }]);
  assert.equal(scan([{ data: [(light + 1) + 0x80000000], width: 1, offset: 1 }], names, 16).length, 1, 'a flipped tile still counts');
});

test('daylight: dust motes are deterministic, drift slowly, wrap, and fade in one by one with the count', () => {
  const init = ev('moteInit');
  const step = ev('moteStep');
  const alpha = ev('moteAlpha');
  const a = init(3);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(init(3))), 'the same mote every run');
  assert.notDeepEqual(JSON.parse(JSON.stringify(init(1))), JSON.parse(JSON.stringify(init(2))));
  for (let i = 0; i < ev('DAYLIGHT_MOTE_MAX'); i++) {
    const m = init(i);
    assert.ok(m.x >= 0 && m.x < 1 && m.y >= 0 && m.y < 1 && m.vx > 0 && m.vy < 0 && m.scale > 0);
    assert.ok(m.vx < 0.05 && Math.abs(m.vy) < 0.02, 'slow: well under a view width per second');
    // 10 minutes of 16 ms frames: it never leaves the (wrapped) view
    for (let f = 0; f < 37500; f++) step(m, 16);
    assert.ok(m.x > -0.05 && m.x < 1.05 && m.y > -0.05 && m.y < 1.05, `mote ${i} stays in view`);
  }
  const big = init(0);
  const before = big.x;
  step(big, 60000); // a stalled frame is capped: it cannot jump across the screen
  assert.ok(Math.abs(big.x - before) < 0.05);
  const m = init(0);
  assert.equal(alpha(m, 5, 3), 0, 'beyond the count: invisible');
  assert.ok(alpha(m, 0, 3) >= 0 && alpha(m, 0, 3) <= 1);
  assert.ok(alpha(m, 2, 2.5) < alpha(m, 2, 3) + 1e-9, 'a half-counted mote is dimmer');
});

// ---------------------------------------------------------------- wiring (source assertions: the renderers need a browser)

const world = read('src', 'scenes', 'world.js');
const daylightSource = world.slice(world.indexOf('// ---------- Golden hour'), world.indexOf('  update(time, delta) {'));

test('daylight wiring: world.js builds it in create() after the camera is zoomed, only when ?daylight=0 is not set', () => {
  assert.ok(daylightSource.length > 500, 'the Golden hour section exists');
  const create = world.slice(world.indexOf('  create() {'), world.indexOf('  buildMap() {'));
  assert.ok(create.indexOf('.setZoom(ZOOM)') > -1 && create.indexOf('this.createDaylight()') > create.indexOf('.setZoom(ZOOM)'), 'createDaylight() runs after setZoom');
  assert.match(daylightSource, /if \(!daylightEnabled\(\)\) return;/);
  assert.ok(read('index.html').indexOf('src/daylight.js') > -1 && read('index.html').indexOf('src/daylight.js') < read('index.html').indexOf('src/scenes/world.js'), 'index.html loads daylight.js before world.js');
  assert.ok(read('tests', 'helpers', 'game-data.js').includes("'src/daylight.js'"));
  assert.ok(require('../../tools/pack-offline').DATA_SCRIPTS.includes('src/daylight.js'));
});

test('daylight wiring: the overlay is a non-interactive, camera-fixed MULTIPLY rectangle above the world and the canopies, in the world scene (so below the UI)', () => {
  assert.match(world, /const DAYLIGHT_OVERLAY_DEPTH = 2_000_000;/);
  assert.ok(2_000_000 > 1_000_000, 'above OVERHEAD_DEPTH');
  assert.match(world, /const OVERHEAD_DEPTH = 1_000_000;/);
  assert.match(daylightSource, /this\.add\.rectangle\([^)]*\)\.setScrollFactor\(0\)\.setDepth\(DAYLIGHT_OVERLAY_DEPTH\)\s*\.setBlendMode\(Phaser\.BlendModes\.MULTIPLY\)/);
  assert.ok(!/setInteractive|input\.enable/.test(daylightSource), 'nothing in the daylight code takes pointer input');
  assert.match(daylightSource, /vignette = this\.add\.image\([^;]*setScrollFactor\(0\)/);
  assert.match(daylightSource, /setBlendMode\(Phaser\.BlendModes\.ADD\)/, 'halos and motes glow additively');
  // UIScene is registered after WorldScene, so everything above is drawn under the whole UI
  const main = read('src', 'main.js');
  assert.ok(main.indexOf('WorldScene, UIScene') > -1);
  assert.ok(!read('src', 'scenes', 'ui.js').includes('daylight'), 'the UI is untouched');
  for (const file of ['src/minigames/framework-scene.js', 'src/scenes/card.js', 'src/scenes/box-opening.js', 'src/scenes/cutscene.js']) {
    assert.ok(!read(...file.split('/')).includes('daylight'), `${file} (mini-games, ending, cutscenes) is untouched`);
  }
});

test('daylight wiring: it is applied at create, on a key collected / any state change, and the box stage; torn down on shutdown', () => {
  assert.match(daylightSource, /this\.applyDaylight\(this\.daylight\.cur\);/, 'applied at create');
  assert.match(daylightSource, /this\.game\.events\.on\('state-changed', this\.daylightListener\)/, 'the stage and keys change through state-changed');
  assert.match(daylightSource, /this\.events\.once\('shutdown', \(\) => this\.destroyDaylight\(\)\)/);
  assert.match(daylightSource, /this\.game\.events\.off\('state-changed', this\.daylightListener\)/, 'the listener is removed again');
  assert.match(daylightSource, /for \(const object of \[d\.overlay, d\.vignette, \.\.\.d\.halos, \.\.\.d\.motes\]\) object\.destroy\(\)/);
  const collect = world.slice(world.indexOf('  collectKeyStation(ks) {'), world.indexOf('  updatePickups() {'));
  assert.ok(collect.includes('this.refreshDaylight()'), 'collecting a key refreshes the light');
  // the phase comes from the quest (pure), the target from the parameters; the transition has the fade and the failsafe
  assert.match(daylightSource, /dayPhaseFromQuest\(GameState\.quest\)/);
  assert.match(daylightSource, /DAYLIGHT_FADE_MS/);
  assert.match(daylightSource, /DAYLIGHT_FAILSAFE_MS/);
  assert.match(daylightSource, /if \(d\.t >= 1\) copyParams\(d\.to, d\.cur\);/, 'a finished transition lands exactly on the target');
  // update() advances it BEFORE the transitioning early-return, so a key-room beat does not freeze the light
  const update = world.slice(world.indexOf('  update(time, delta) {'), world.indexOf('  syncGameState() {'));
  assert.ok(update.indexOf('this.updateDaylight(delta)') > -1 && update.indexOf('this.updateDaylight(delta)') < update.indexOf('if (this.transitioning) return;'));
});

test('daylight wiring: cheap: textures are cached, no per-frame allocation in the update path, dust only outdoors', () => {
  assert.match(daylightSource, /if \(this\.textures\.exists\(key\)\) return;/, 'canvas textures are made once per game');
  assert.match(daylightSource, /FilterMode\.LINEAR/);
  assert.match(daylightSource, /if \(!indoors\) \{\s*for \(let i = 0; i < DAYLIGHT_MOTE_MAX; i\+\+\)/, 'no motes indoors');
  const hot = daylightSource.slice(daylightSource.indexOf('  updateDaylight(delta) {'), daylightSource.indexOf('  // Scene shutdown'));
  assert.ok(!/new |\.map\(|\.filter\(|\{ \.\.\./.test(hot.replace(/\/\/.*$/gm, '')), 'the per-frame path allocates nothing');
  assert.match(hot, /lerpParams\(d\.from, d\.to, daylightEase\(d\.t\), d\.cur\)/, 'it blends into one reused object');
  // the lab's cyan light bars are never given a halo
  assert.ok(!ev('DAYLIGHT_LIGHT_TILES').intTechLightBarL);
});

test('daylight wiring: the e2e helpers switch it off by default and a spec can opt in', () => {
  const helpers = read('tests', 'e2e', 'helpers.js');
  assert.match(helpers, /daylight = false/);
  assert.equal((helpers.match(/if \(!daylight\) params\.set\('daylight', '0'\);/g) || []).length, 2, 'openGame() and openTitle() both');
  assert.match(read('tests', 'e2e', 'ending.spec.js'), /daylight: '0'/, 'the spec that builds its own URL');
});

test('daylight: the preview tool renders four phases into one strip', () => {
  const tool = require('../../tools/preview-daylight');
  const day = tool.loadDaylight();
  assert.deepEqual(Array.from(day.DAY_PHASES), PHASES);
  const crop = { width: 4, height: 4, rgba: Buffer.alloc(4 * 4 * 4, 200) };
  const none = tool.applyLight(day, crop, day.daylightParams('midday', false), [], 1);
  const centre = (1 * 4 + 1) * 4;
  assert.deepEqual([none.rgba[centre], none.rgba[centre + 1], none.rgba[centre + 2]], [200, 200, 200], 'midday leaves the middle of the picture untouched (its tiny vignette only touches the corners)');
  const dusk = tool.applyLight(day, crop, { ...day.daylightParams('dusk', false), motes: 0 }, [], 1);
  assert.ok(dusk.rgba[centre] > dusk.rgba[centre + 1] && dusk.rgba[centre + 1] < 200, 'dusk warms and pinks the middle');
});
