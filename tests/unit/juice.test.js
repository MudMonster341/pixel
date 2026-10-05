// The juice pass (src/juice.js, wow idea W5): key-pickup sparkle, mini-game hit/win feedback, "!" and heart emotes. Without a browser this covers the
// pure plans (particle caps, durations, shake clamps, the screen position, the emote rules) and, as source assertions, the wiring (event names,
// failsafe, teardown, the silent-safe guards). What it looks like needs the running game: see the coordinator's checklist.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadGameData, ROOT } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const g = loadGameData();
const ev = (name) => g.evaluate(name);
const plain = (v) => JSON.parse(JSON.stringify(v)); // sandbox objects have another realm's prototype
const seeded = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

const JUICE = plain(ev('JUICE'));
const keySparklePlan = ev('keySparklePlan');
const confettiPlan = ev('confettiPlan');
const clampShake = ev('clampShake');
const worldToScreen = ev('worldToScreen');
const arcPoint = ev('arcPoint');
const talkEmote = ev('talkEmote');
const isNamedFriend = ev('isNamedFriend');
const juiceEnabled = ev('juiceEnabled');

const FROM = { x: 300, y: 260 };
const TO = { x: 800, y: 40 };

test('JUICE: the key sparkle plan stays under 24 particles and 1.2 s for any random source', () => {
  for (const seed of [1, 2, 3, 42, 99999]) {
    const plan = plain(keySparklePlan(FROM, TO, seeded(seed)));
    assert.ok(plan.count <= 24, `seed ${seed}: ${plan.count} particles`);
    assert.equal(plan.count, plan.burst.length + plan.flyers.length);
    assert.ok(plan.totalMs <= 1200, `seed ${seed}: ${plan.totalMs} ms`);
    assert.ok(plan.popAtMs > 0 && plan.popAtMs + JUICE.keyPopMs <= plan.totalMs, 'the counter pops at the end, inside the total');
    for (const f of plan.flyers) assert.ok(f.delayMs + f.ms <= plan.popAtMs + 1e-9, 'no flyer lands after the pop');
  }
  // the extreme random sources (all 0 / just under 1) are the worst cases for the jitter
  for (const rng of [() => 0, () => 0.999999]) {
    const plan = plain(keySparklePlan(FROM, TO, rng));
    assert.ok(plan.count <= 24 && plan.totalMs <= 1200);
  }
});

test('JUICE: the constants themselves respect the brief (<= 24 particles, <= 1.2 s, shake <= 150 ms)', () => {
  assert.ok(JUICE.keyBurstCount + JUICE.keyFlyCount <= JUICE.keyMaxParticles && JUICE.keyMaxParticles <= 24);
  assert.ok(JUICE.confettiCount <= 24);
  assert.ok(JUICE.keyTotalMaxMs <= 1200);
  const longestFlyer = (JUICE.keyFlyCount - 1) * JUICE.keyFlyStaggerMs + JUICE.keyFlyMs + 60 + JUICE.keyPopMs;
  assert.ok(longestFlyer <= JUICE.keyTotalMaxMs, `the slowest flyer plus the pop (${longestFlyer} ms) fits the total`);
  assert.ok(JUICE.shakeMaxMs <= 150 && JUICE.shakeMaxIntensity <= 0.005);
});

test('JUICE: a flyer arcs from the pickup to the HUD counter and ends exactly on it, bowed upwards', () => {
  const plan = plain(keySparklePlan(FROM, TO, seeded(7)));
  for (const f of plan.flyers) {
    const start = plain(arcPoint(FROM, f.ctrl, TO, 0));
    const end = plain(arcPoint(FROM, f.ctrl, TO, 1));
    assert.deepEqual(start, FROM);
    assert.deepEqual(end, TO);
    const mid = plain(arcPoint(FROM, f.ctrl, TO, 0.5));
    assert.ok(mid.y < (FROM.y + TO.y) / 2 - 20, 'the middle of the arc is well above the straight line between the ends (a lob)');
  }
  assert.ok(plan.flyers.length >= 3 && plan.burst.length >= 6, 'a visible burst and a few flyers');
});

test('JUICE: the burst sparks are golden and stay near the pickup', () => {
  const plan = plain(keySparklePlan(FROM, TO, seeded(5)));
  const golds = new Set(plain(ev('JUICE_GOLD')));
  for (const b of plan.burst) {
    assert.ok(golds.has(b.color));
    assert.ok(Math.hypot(b.dx, b.dy) < 60, 'a small burst, not a firework');
    assert.ok(b.ms <= 520);
  }
});

test('JUICE: camera shake is clamped to <= 150 ms and a small amplitude; nonsense means no shake', () => {
  assert.deepEqual(plain(clampShake(220, 0.006)), { ms: 150, intensity: 0.004 });
  assert.deepEqual(plain(clampShake(90, 0.003)), { ms: 90, intensity: 0.003 });
  assert.deepEqual(plain(clampShake(NaN, 0.003)), { ms: 0, intensity: 0.003 });
  assert.deepEqual(plain(clampShake(100, -1)), { ms: 100, intensity: 0 });
  assert.deepEqual(plain(clampShake(undefined, undefined)), { ms: 0, intensity: 0 });
});

test('JUICE: a world point lands on the right screen pixel through the camera, clamped to the screen', () => {
  // zoom 3, the camera shows the world from (100, 50): world (110, 60) is 30 px right and 30 px down of the screen's corner
  assert.deepEqual(plain(worldToScreen(110, 60, { x: 100, y: 50 }, 3)), { x: 30, y: 30 });
  assert.deepEqual(plain(worldToScreen(100 + 160, 50 + 90, { x: 100, y: 50 }, 3)), { x: 480, y: 270 });
  const off = plain(worldToScreen(5000, -5000, { x: 0, y: 0 }, 3));
  assert.deepEqual(off, { x: 948, y: 12 }, 'an off-screen pickup is pulled to the nearest visible edge');
  assert.deepEqual(plain(worldToScreen(10, 20, null, undefined, 960, 540, 0)), { x: 10, y: 20 }, 'no camera information means zoom 1 at the origin');
});

test('JUICE: the win confetti is capped, gentle and lands inside a second', () => {
  const plan = plain(confettiPlan({ x: 480, y: 200 }, seeded(3)));
  assert.ok(plan.pieces.length > 0 && plan.pieces.length <= 24);
  assert.ok(plan.riseMs + plan.fallMs + Math.max(...plan.pieces.map((p) => p.delayMs)) <= JUICE.confettiMs, 'every piece is done within confettiMs');
  const colors = new Set(plain(ev('JUICE_CONFETTI')));
  for (const p of plan.pieces) {
    assert.ok(colors.has(p.color));
    assert.notEqual(p.color, 0xffffff, 'no white confetti: it vanishes on the cream win card');
    assert.ok(p.w <= 6 && p.h <= 8, 'little bits');
  }
});

test('JUICE: the "!" comes once per talk, the heart only for a named friend, and neither during a script or a moment', () => {
  const stranger = { id: 'a1', role: 'student' };
  const friend = { id: 'sid', role: 'student', name: 'Sid', sheet: 'npc-friend-sid' };
  const prof = { id: 'p', role: 'prof', name: 'Prof. Raja', sheet: 'npc-prof-raja' };
  assert.deepEqual(plain(talkEmote('start', stranger)), { kind: '!', holdMs: 800 });
  assert.equal(talkEmote('start', stranger, { alertShown: true }), null, 'once per talk');
  assert.equal(talkEmote('start', stranger, { scriptRunning: true }), null);
  assert.equal(talkEmote('end', stranger), null, 'no heart for a stranger');
  assert.deepEqual(plain(talkEmote('end', friend)), { kind: 'heart', holdMs: 1000 });
  assert.equal(talkEmote('end', friend, { scriptRunning: true }), null);
  assert.equal(talkEmote('end', prof), null, 'a professor keeps her composure');
  assert.equal(talkEmote('middle', friend), null);
  assert.doesNotThrow(() => talkEmote('end', null), 'no def is still safe');
});

test('JUICE: every named friend in ambient.js gets the heart; the unnamed crowd and the professors do not', () => {
  const { AMBIENT } = g;
  const all = Object.values(AMBIENT).flat();
  const named = all.filter((e) => e.name);
  assert.ok(named.length >= 9, 'the friends are there');
  for (const e of named) assert.equal(isNamedFriend(e), !/^npc-prof-/.test(e.sheet || ''), `${e.name}`);
  for (const e of all.filter((x) => !x.name)) assert.equal(isNamedFriend(e), false);
  assert.equal(isNamedFriend(null), false);
});

test('JUICE: ?juice=0 switches the whole pass off; anything else leaves it on', () => {
  assert.equal(juiceEnabled('?juice=0'), false);
  assert.equal(juiceEnabled('?dev=0&juice=0'), false);
  assert.equal(juiceEnabled(''), true);
  assert.equal(juiceEnabled('?juice=1'), true);
  assert.match(read('tests', 'e2e', 'helpers.js'), /params\.set\('juice', '0'\)/, 'the e2e specs run with it off by default, like the daylight');
});

test('JUICE: the sparkle code is silent-safe, owns its tweens, and has a failsafe plus a shutdown teardown', () => {
  const src = read('src', 'juice.js');
  assert.match(src, /function juiceBag\(scene, lifeMs\)/);
  assert.match(src, /scene\.time\.delayedCall\(lifeMs, bag\.destroy\)/, 'a wall-clock failsafe destroys whatever is still alive');
  assert.match(src, /scene\.events\.once\('shutdown', bag\.destroy\)/, 'a scene change destroys it too');
  assert.match(src, /t\.stop\(\)/, 'tweens are stopped before their objects are destroyed');
  assert.match(src, /plan\.totalMs \+ JUICE\.keyFailsafeSlackMs/);
  for (const fn of ['playKeySparkle', 'playConfettiBurst', 'shakeCamera', 'flashOverlay']) {
    const body = src.slice(src.indexOf(`function ${fn}(`));
    assert.ok(body.slice(0, body.indexOf('\n}\n')).includes('catch (error)'), `${fn} swallows its own errors (decoration only)`);
  }
  assert.match(src, /prefers-reduced-motion: reduce/, 'the OS reduced-motion setting is honoured for the shake');
  // it never reads Phaser or the DOM at load time: nothing at top level but constants and functions
  assert.doesNotMatch(src.replace(/function[\s\S]*$/m, ''), /Phaser\./);
});

test('JUICE: the key sparkle is wired: world emits it when a key is given, the UI draws it and pulses the counter, and tears it down', () => {
  const world = read('src', 'scenes', 'world.js');
  const ui = read('src', 'scenes', 'ui.js');
  const collect = world.slice(world.indexOf('  collectKeyStation(ks) {'), world.indexOf('  emitKeySparkle(x, y) {'));
  assert.ok(collect.includes('this.emitKeySparkle(ks.sprite.x, ks.sprite.y)'), 'taking a key from its station sparkles at the station');
  assert.match(world, /this\.game\.events\.emit\('key-sparkle', \{ x, y \}\)/);
  assert.match(world, /countKeysHeld\(GameState\) > keysBefore/, 'a key handed over by a person (no station) sparkles at them too');
  assert.match(ui, /this\.game\.events\.on\('key-sparkle', this\.onKeySparkle\)/);
  assert.match(ui, /this\.game\.events\.off\('key-sparkle', this\.onKeySparkle\)/, 'unsubscribed again on teardown');
  assert.match(ui, /if \(this\.keySparkle\) this\.keySparkle\.destroy\(\);\s*this\.keySparkle = null;/);
  assert.match(ui, /worldToScreen\(point\.x, point\.y, cam\.worldView, cam\.zoom/);
  assert.match(ui, /playKeySparkle\(this, from, this\.questTracker\.keyTarget\(\), \(\) => this\.questTracker\.pop\(\)\)/);
  assert.match(ui, /keyTarget\(\) \{[\s\S]*?this\.expanded \? this\.keysText : this\.pillKeys/);
  assert.match(ui, /pop\(\) \{[\s\S]*?scale: 1\.35[\s\S]*?label\.setScale\(1\)/, 'the counter pops and always returns to exactly 1');
});

test('JUICE: mini-games: a hit flashes and shakes, a win throws confetti, and nothing is doubled on a lethal hit', () => {
  const base = read('src', 'minigames', 'framework-scene.js');
  const hero = read('src', 'minigames', 'hero.js');
  const tower = read('src', 'minigames', 'tower.js');
  assert.match(base, /hurtHit\(\) \{[\s\S]*?flashOverlay\(this, 0xff4a4a[\s\S]*?shakeCamera\(this, 120, 0\.004\)/);
  assert.match(base, /if \(this\.time\.now - \(this\.hurtHitAt \?\? -1e9\) > 400\) this\.hurtHit\(\);/, 'lose() does not double a hit that just flashed');
  assert.match(base, /this\.winConfetti\(\);/);
  assert.match(base, /playConfettiBurst\(this, \{ x: GAME_WIDTH \/ 2/);
  assert.doesNotMatch(base, /cameras\.main\.shake\(/, 'every shake goes through the clamped shakeCamera()');
  assert.doesNotMatch(hero, /cameras\.main\.shake\(/);
  assert.doesNotMatch(tower, /cameras\.main\.shake\(/);
  assert.match(hero, /case 'hit':[\s\S]*?this\.hurtHit\(\);/);
  assert.match(tower, /case 'hit':[\s\S]*?this\.hurtHit\(\);/);
  // the flyer's firewall hit and a fall end in lose(), which now shakes and flashes through the same helper
  assert.match(base, /lose\(\) \{[\s\S]*?this\.hurtHit\(\)/);
});

test('JUICE: ambient talk emotes are wired into interact(): "!" at the start, heart at the end, one shared bubble renderer', () => {
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /this\.beginAmbientTalk\(ambientTalker\);\s*this\.talkEmoteFor\('start', ambientTalker\);/);
  assert.match(world, /this\.endAmbientTalk\(ambientTalker\);[^\n]*\n\s*this\.talkEmoteFor\('end', ambientTalker\);/);
  assert.match(world, /talkEmote\(phase, ambient\.def, \{ scriptRunning: this\.scriptRunner\.isRunning, alertShown: ambient\.alertShown \}\)/);
  assert.match(world, /spawnAmbientEmote\(x, y, glyph = '\.\.\.', holdMs = 700\)/, 'the existing bubble renderer is reused, not duplicated');
  assert.match(world, /this\.spawnHeartEmote\(s\.x, s\.y - 22\)/, 'the existing heart renderer is reused');
  assert.match(world, /ambient\.alertShown = false;/, 'a new talk gets its "!" again');
  const emoteFn = world.slice(world.indexOf('  talkEmoteFor(phase, ambient) {'));
  assert.ok(emoteFn.slice(0, emoteFn.indexOf('\n  }\n')).includes('catch (error)'), 'decoration only: it never throws into the conversation');
});

test('JUICE: src/juice.js is loaded by index.html before the scenes that use it, and ships in the offline bundle', () => {
  const html = read('index.html');
  const at = (file) => html.indexOf(`src="${file}"`);
  assert.ok(at('src/juice.js') > -1);
  for (const user of ['src/scenes/world.js', 'src/scenes/ui.js', 'src/minigames/framework-scene.js']) assert.ok(at('src/juice.js') < at(user), `juice.js loads before ${user}`);
  assert.ok(g.evaluate('typeof playKeySparkle') === 'function', 'loads cleanly in a sandbox with no browser');
});
