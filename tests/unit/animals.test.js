// Campus animals (decisions/0018, cats and birds only): the content in src/animals.js checked against the
// real committed map, the sheets against the generator, and the behaviour (reaction distances, flee,
// the bird's takeoff/return cycle) as the pure functions they are. The drawing side (sprites, depth,
// the heart, the meow dialog) is Phaser-facing: tests/e2e/campus-life.spec.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, loadGameData } = require('../helpers/game-data');

const {
  ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS, ANIMAL_RULES, ANIMAL_CAP_PER_MAP, ANIMAL_TALK_LINES, MAPS, AMBIENT,
  gridFromTiled, tiledObjects, isWalkableTile, tileInfo,
  animalReaction, animalFleePoint, animalWanderPoint, animalLineWalkable, animalTileBlocked, animalFacing,
  makeAnimal, stepAnimal, animalAnim, animalSheets,
} = loadGameData();

const plain = (value) => JSON.parse(JSON.stringify(value));

function loadMap(mapKey) {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${MAPS[mapKey].tiled}.json`), 'utf8'));
  return { json, grid: gridFromTiled(json), objects: tiledObjects(json) };
}

const ALL = Object.entries(ANIMALS).flatMap(([map, list]) => list.map((a) => ({ map, ...a })));

// ---------- content ----------

test('ANIMALS: every map key is a real outdoor map with a tiled floor plan (never indoors)', () => {
  for (const key of Object.keys(ANIMALS)) {
    assert.ok(MAPS[key], `unknown map "${key}"`);
    assert.ok(MAPS[key].tiled, `${key}: animals need a decoded map to be checked against`);
    assert.ok(!MAPS[key].indoors, `${key}: animals never appear indoors`);
  }
  assert.ok(ANIMALS.campus, 'the campus has animals');
});

test('ANIMALS: species and behaviour are known; ids are unique slugs', () => {
  const ids = new Set();
  for (const a of ALL) {
    assert.match(a.id, /^[a-z0-9-]+$/);
    assert.ok(!ids.has(a.id), `duplicate animal id ${a.id}`);
    ids.add(a.id);
    const info = ANIMAL_SPECIES[a.species];
    assert.ok(info, `${a.id}: unknown species "${a.species}"`);
    assert.ok(['cat', 'bird'].includes(info.kind), `${a.id}: only cats and birds`);
    const allowed = info.kind === 'bird' ? ['hop'] : (info.layout === 'cat-side' ? ['sit', 'sleep'] : ['sit']);
    assert.ok(allowed.includes(a.behaviour), `${a.id}: behaviour "${a.behaviour}" isn't one of ${allowed.join('/')} for ${a.species}`);
    if (a.talk) assert.equal(info.kind, 'cat', `${a.id}: only cats are talkable`);
  }
});

test('ANIMALS: 3-6 cats and 3-6 birds on the campus, at most 8 sprites per map', () => {
  for (const [key, list] of Object.entries(ANIMALS)) {
    assert.ok(list.length <= ANIMAL_CAP_PER_MAP, `${key}: ${list.length} animals, cap is ${ANIMAL_CAP_PER_MAP}`);
  }
  assert.equal(ANIMAL_CAP_PER_MAP, 8);
  const cats = ANIMALS.campus.filter((a) => ANIMAL_SPECIES[a.species].kind === 'cat').length;
  const birds = ANIMALS.campus.filter((a) => ANIMAL_SPECIES[a.species].kind === 'bird').length;
  assert.ok(cats >= 3 && cats <= 6, `${cats} cats`);
  assert.ok(birds >= 3 && birds <= 6, `${birds} birds`);
});

test('ANIMALS: a couple of cats are talkable and the meow line is a soft one-liner', () => {
  const talkable = ALL.filter((a) => a.talk);
  assert.ok(talkable.length >= 2, 'a couple of cats should be talkable');
  assert.deepEqual(plain(ANIMAL_TALK_LINES), ['Meow.']);
});

test('ANIMALS: every home tile is walkable, reachable from the spawn, and clear of doors, stairs and gates', () => {
  for (const key of Object.keys(ANIMALS)) {
    const { json, grid, objects } = loadMap(key);
    const spawn = objects.find((o) => o.type === 'spawn');
    const seen = new Uint8Array(json.width * json.height);
    const stack = [[Math.floor(spawn.x), Math.floor(spawn.y)]];
    seen[stack[0][1] * json.width + stack[0][0]] = 1;
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
    for (const a of ANIMALS[key]) {
      assert.ok(isWalkableTile(grid, tileInfo, a.x, a.y), `${a.id}: (${a.x},${a.y}) is not walkable`);
      assert.ok(seen[a.y * json.width + a.x], `${a.id}: (${a.x},${a.y}) can't be reached from the spawn`);
      assert.ok(!animalTileBlocked(objects, a.x, a.y), `${a.id}: (${a.x},${a.y}) is on/next to a door, stairs or gate`);
    }
  }
});

test('ANIMALS: never on top of an ambient student\'s tile or a key station, and spread out (no two homes within 3 tiles)', () => {
  for (const a of ANIMALS.campus) {
    for (const e of AMBIENT.campus) {
      const pts = e.kind === 'patrol' ? e.waypoints : [e];
      for (const p of pts) assert.ok(Math.hypot(p.x - a.x, p.y - a.y) >= 1, `${a.id} shares a tile with ${e.id}`);
    }
    for (const ks of MAPS.campus.keyStations || []) assert.ok(!(ks.x === a.x && ks.y === a.y));
    for (const b of ANIMALS.campus) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 3, `${a.id} and ${b.id} are too close`);
  }
});

test('animalTileBlocked: within a tile of a door/stairs/gate object, nowhere else', () => {
  const objects = [{ type: 'door', x: 10.5, y: 5.5, width: 0, height: 0 }, { type: 'stairs', x: 20, y: 20, width: 2, height: 1 }, { type: 'area', x: 0, y: 0, width: 99, height: 99 }];
  assert.equal(animalTileBlocked(objects, 10, 5), true);
  assert.equal(animalTileBlocked(objects, 11, 6), true);
  assert.equal(animalTileBlocked(objects, 12, 5), false);
  assert.equal(animalTileBlocked(objects, 21, 21), true);
  assert.equal(animalTileBlocked(objects, 23, 20), false);
  assert.equal(animalTileBlocked(objects, 50, 50), false);
});

// ---------- sheets: layouts, files, preload ----------

test('layouts: every animation uses frames that exist in the sheet', () => {
  for (const [name, layout] of Object.entries(ANIMAL_LAYOUTS)) {
    const total = layout.cols * layout.rows;
    assert.ok(layout.footY > 0 && layout.footY < layout.frameH, `${name}: footY inside the frame`);
    for (const [animName, anim] of Object.entries(layout.anims)) {
      assert.ok(anim.frames.length > 0 && anim.fps > 0, `${name}/${animName}`);
      for (const f of anim.frames) assert.ok(f >= 0 && f < total, `${name}/${animName}: frame ${f} is outside the ${total}-frame sheet`);
    }
  }
});

test('species: every species has its PNG (right size for its layout) and is used, so the preload list covers it', () => {
  const used = new Set(ALL.map((a) => a.species));
  for (const [species, info] of Object.entries(ANIMAL_SPECIES)) {
    assert.ok(ANIMAL_LAYOUTS[info.layout], `${species}: unknown layout`);
    const layout = ANIMAL_LAYOUTS[info.layout];
    const file = path.join(ROOT, 'assets', `${info.sheet}.png`);
    assert.ok(fs.existsSync(file), `assets/${info.sheet}.png is missing (npm run assets)`);
    const png = fs.readFileSync(file);
    assert.equal(png.readUInt32BE(16), layout.cols * layout.frameW, `${info.sheet}: width`);
    assert.equal(png.readUInt32BE(20), layout.rows * layout.frameH, `${info.sheet}: height`);
    assert.ok(used.has(species), `species "${species}" is defined but no animal uses it (dead art)`);
  }
});

test('preload: animalSheets() is derived from the content, so a new animal can\'t be forgotten', () => {
  const sheets = animalSheets(ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS);
  const expected = [...new Set(ALL.map((a) => ANIMAL_SPECIES[a.species].sheet))].sort();
  assert.deepEqual(plain(sheets.map((s) => s.key)), expected);
  for (const s of sheets) {
    assert.equal(s.file, `assets/${s.key}.png`);
    assert.ok(s.frameWidth > 0 && s.frameHeight > 0);
  }
  // A new species in new content reaches the preload list without touching main.js.
  const more = animalSheets({ m: [{ id: 'x', species: 'crow' }] }, ANIMAL_SPECIES, ANIMAL_LAYOUTS);
  assert.deepEqual(plain(more.map((s) => s.key)), ['animal-bird-crow']);
  assert.throws(() => animalSheets({ m: [{ id: 'y', species: 'dragon' }] }, ANIMAL_SPECIES, ANIMAL_LAYOUTS), /unknown species/);
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  assert.match(main, /animalSheets\(ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS\)/, 'src/main.js preload must iterate animalSheets()');
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.indexOf('src/campus-facts.js') > 0 && html.indexOf('src/animals.js') > 0, 'index.html loads the two data scripts');
  assert.ok(html.indexOf('src/animals.js') < html.indexOf('src/maps.js'), 'animals.js loads before maps.js');
});

test('generator: assets/animal-*.png match tools/make-animals.js (needs the git-ignored art packs)', (t) => {
  if (!fs.existsSync(path.join(ROOT, 'assets', 'External Tilesets', 'Zeenaz-Cat'))) {
    t.skip('assets/External Tilesets/ packs not present in this checkout');
    return;
  }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-animals-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-animals.js'), '--out', out], { stdio: 'pipe' });
    const names = fs.readdirSync(out);
    assert.ok(names.length >= 7);
    for (const name of names) {
      const committed = path.join(ROOT, 'assets', name);
      assert.ok(fs.existsSync(committed), `assets/${name} is missing`);
      assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(committed)), `assets/${name} is out of date (npm run assets)`);
    }
    for (const info of Object.values(ANIMAL_SPECIES)) assert.ok(names.includes(`${info.sheet}.png`), `generator doesn't write ${info.sheet}.png`);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('credits: the three animal credit lines are in CREDITS.md', () => {
  const credits = fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8');
  assert.match(credits, /Zeenaz/);
  assert.match(credits, /CC0/);
  assert.match(credits, /bluecarrot16/);
  assert.match(credits, /opengameart\.org\/content\/lpc-birds/);
  assert.match(credits, /CC BY 4\.0/);
  assert.match(credits, /Animals Asset Pack/i);
  assert.match(credits, /NFT/);
});

test('engine: animals have no physics body or collider (they can never block her), and are not created indoors', () => {
  const world = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  const start = world.indexOf('createAnimals() {');
  const end = world.indexOf('// A small floating heart');
  assert.ok(start > 0 && end > start);
  const block = world.slice(start, end);
  assert.doesNotMatch(block, /physics|collider|setImmovable/, 'animals must stay collision-free');
  assert.match(block, /this\.def\.indoors \? \[\]/, 'no animals indoors');
  assert.match(block, /ANIMAL_CAP_PER_MAP/, 'the per-map cap is enforced at runtime too');
  assert.match(block, /animalAnim\(/, 'the animation comes from the pure animalAnim()');
});

// ---------- behaviour: pure functions ----------

const open = () => true; // every tile walkable
const rngOf = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const at = (x, y) => ({ x, y });
const ctx = (over = {}) => ({ now: 0, dt: 0.05, player: at(100, 100), rng: rngOf(0.5), isWalkable: open, ...over });
const home = { x: 50, y: 50 };

const cat = (over = {}) => ({ ...makeAnimal({ id: 'c', species: 'cat-orange', x: home.x, y: home.y, behaviour: 'sit', facing: 'down' }), ...over });
const bird = (over = {}) => ({ ...makeAnimal({ id: 'b', species: 'pigeon', x: home.x, y: home.y, behaviour: 'hop', facing: 'left' }), ...over });

// Steps `animal` repeatedly, advancing the clock; `stop(animal)` ends early. Returns the final state.
function run(animal, seconds, options = {}) {
  let state = animal;
  const dt = 0.05;
  for (let t = 0; t < seconds; t += dt) {
    state = stepAnimal(state, { now: (options.start || 0) + t * 1000, dt, player: options.player || at(500, 500), rng: options.rng || rngOf(0.5, 0.2, 0.8), isWalkable: options.isWalkable || open });
    if (options.stop && options.stop(state)) break;
  }
  return state;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('reaction: a cat notices her within 3 tiles and a shy one flees within 1.5; a tame one never flees', () => {
  assert.equal(animalReaction('cat', 5, false), 'ignore');
  assert.equal(animalReaction('cat', 3.01, false), 'ignore');
  assert.equal(animalReaction('cat', 3, false), 'notice');
  assert.equal(animalReaction('cat', 1.6, false), 'notice');
  assert.equal(animalReaction('cat', 1.5, false), 'flee');
  assert.equal(animalReaction('cat', 0.2, false), 'flee');
  assert.equal(animalReaction('cat', 0.2, true), 'notice');
  assert.equal(animalReaction('cat', 5, true), 'ignore');
  assert.equal(ANIMAL_RULES.cat.noticeTiles, 3);
  assert.equal(ANIMAL_RULES.cat.fleeTiles, 1.5);
});

test('reaction: a bird takes off within 2.5 tiles, and a tame flag changes nothing for birds', () => {
  assert.equal(animalReaction('bird', 4, false), 'ignore');
  assert.equal(animalReaction('bird', 2.5, false), 'takeoff');
  assert.equal(animalReaction('bird', 1, true), 'takeoff');
});

test('animalFacing: the dominant axis wins', () => {
  assert.equal(animalFacing(3, 1), 'right');
  assert.equal(animalFacing(-3, 1), 'left');
  assert.equal(animalFacing(1, -3), 'up');
  assert.equal(animalFacing(1, 3), 'down');
});

test('cat: resting far away, it stays put and relaxed', () => {
  const next = run(cat({ until: 1e9 }), 2);
  assert.equal(next.state, 'rest');
  assert.equal(dist(next, { x: home.x + 0.5, y: home.y + 0.5 }), 0);
});

test('cat: it turns toward her within 3 tiles, and relaxes again once she leaves', () => {
  const c = cat({ until: 1e9, facing: 'down' });
  const near = stepAnimal(c, ctx({ player: at(c.x + 2.5, c.y) }));
  assert.equal(near.state, 'alert');
  assert.equal(near.facing, 'right');
  const west = stepAnimal(c, ctx({ player: at(c.x - 2.5, c.y) }));
  assert.equal(west.facing, 'left');
  assert.equal(west.hFacing, 'left');
  const above = stepAnimal(c, ctx({ player: at(c.x, c.y - 2) }));
  assert.equal(above.facing, 'up');
  // Still alert while she stays near; calm again after she walks off.
  assert.equal(stepAnimal(near, ctx({ player: at(c.x + 2.5, c.y) })).state, 'alert');
  assert.equal(stepAnimal(near, ctx({ player: at(c.x + 10, c.y) })).state, 'rest');
});

test('cat: a shy cat startles, then runs straight away from her and ends up farther off', () => {
  const c = cat({ until: 1e9 });
  const player = at(c.x - 1.2, c.y);
  const startled = stepAnimal(c, ctx({ player, now: 1000 }));
  assert.equal(startled.state, 'startle');
  assert.equal(startled.facing, 'left');
  assert.equal(dist(startled, c), 0, 'it freezes for a beat first');
  // Not yet: still startled a moment later; then it runs.
  assert.equal(stepAnimal(startled, ctx({ player, now: 1100 })).state, 'startle');
  const running = stepAnimal(startled, ctx({ player, now: 1000 + ANIMAL_RULES.cat.startleMs + 1 }));
  assert.equal(running.state, 'flee');
  assert.ok(dist(running, player) > 1.2 || running.tx > c.x, 'the target is on the far side of the cat');
  const end = run(running, 5, { player, stop: (s) => s.state !== 'flee' });
  assert.equal(end.state, 'rest');
  assert.equal(end.away, true);
  assert.ok(dist(end, player) > 1.5 + 1.5, `ran off to ${dist(end, player).toFixed(1)} tiles from her`);
  assert.ok(dist(end, c) <= ANIMAL_RULES.cat.fleeRunTiles + 0.01, 'a short run, not across the map');
});

test('cat: after running off it strolls back home and settles again', () => {
  const c = cat({ until: 1e9 });
  const player = at(c.x - 1.2, c.y);
  let s = stepAnimal(c, ctx({ player, now: 0 }));
  s = run(s, 4, { player, start: 0, stop: (x) => x.state === 'rest' });
  assert.equal(s.away, true);
  const away = s;
  // She is long gone; once its wait is over it walks home.
  const back = run(away, 30, { player: at(900, 900), start: away.until + 1, stop: (x) => x.state === 'rest' && !x.away });
  assert.equal(back.away, false);
  assert.equal(back.state, 'rest');
  assert.ok(dist(back, { x: home.x + 0.5, y: home.y + 0.5 }) < 0.05, 'it is home again');
});

test('cat: a tame (talkable) cat turns toward her but never runs, however close she gets', () => {
  const c = cat({ tame: true, until: 1e9 });
  const close = stepAnimal(c, ctx({ player: at(c.x + 0.3, c.y) }));
  assert.equal(close.state, 'alert');
  assert.equal(stepAnimal(close, ctx({ player: at(c.x + 0.3, c.y) })).state, 'alert');
});

test('cat: while she is talking to it, it stays put and faces her', () => {
  const c = cat({ tame: true, until: 0, state: 'wander', tx: 52.5, ty: 50.5, talking: true });
  const next = stepAnimal(c, ctx({ player: at(c.x, c.y + 1) }));
  assert.equal(next.state, 'alert');
  assert.equal(next.facing, 'down');
  assert.equal(next.x, c.x);
  assert.equal(next.y, c.y);
});

test('cat: now and then it wanders a few tiles from home and comes to rest on a walkable tile', () => {
  const walkableOnlyEven = (tx, ty) => (tx + ty) % 2 === 0 || (tx === 50 && ty === 50);
  const c = cat({ until: 0 });
  // rng: wander (0.1 < chance), then angle/distance values.
  const wandering = stepAnimal(c, ctx({ now: 5, rng: rngOf(0.1, 0.3, 0.9), isWalkable: open }));
  assert.equal(wandering.state, 'wander');
  assert.ok(dist({ x: wandering.tx, y: wandering.ty }, { x: c.homeX, y: c.homeY }) <= ANIMAL_RULES.cat.wanderTiles + 0.8);
  const end = run(wandering, 20, { stop: (s) => s.state === 'rest' });
  assert.equal(end.state, 'rest');
  assert.ok(end.until > 0);
  // Every tile blocked: no point to wander to, it just rests again.
  const stuck = stepAnimal(c, ctx({ now: 5, rng: rngOf(0.1), isWalkable: () => false }));
  assert.equal(stuck.state, 'rest');
  assert.ok(typeof walkableOnlyEven === 'function');
});

test('flee point: straight away from her, on a fully walkable line; shortened by walls; null when boxed in', () => {
  const from = at(50.5, 50.5);
  const p = animalFleePoint(from, at(48.5, 50.5), 4, open);
  assert.ok(p && p.x > from.x && Math.abs(p.y - from.y) < 1e-6 && Math.abs(dist(p, from) - 4) < 1e-6);
  // A wall at x >= 53: the run is shortened to stay inside the walkable side.
  const wall = (tx) => tx < 53;
  const short = animalFleePoint(from, at(48.5, 50.5), 4, wall);
  assert.ok(short.x < 53 && short.x > from.x, `shortened to x=${short.x}`);
  // A wall on all sides but a gap: a rotated direction is found.
  assert.equal(animalFleePoint(from, at(48.5, 50.5), 4, (tx, ty) => tx === 50 && ty === 50), null);
  // Standing exactly on her still picks a direction.
  assert.ok(animalFleePoint(from, from, 4, open));
});

test('wander point: within the radius of home, walkable, and null when nothing is walkable', () => {
  const rng = rngOf(0.2, 0.6, 0.9, 0.1);
  for (let i = 0; i < 20; i++) {
    const p = animalWanderPoint({ x: 50.5, y: 50.5 }, 3, rng, open);
    assert.ok(p && dist(p, { x: 50.5, y: 50.5 }) <= 3.8);
    assert.equal(p.x % 1, 0.5);
  }
  assert.equal(animalWanderPoint({ x: 50.5, y: 50.5 }, 3, rngOf(0.4), () => false), null);
  assert.equal(animalLineWalkable(0.5, 0.5, 4.5, 0.5, (tx) => tx !== 2), false);
  assert.equal(animalLineWalkable(0.5, 0.5, 4.5, 0.5, open), true);
});

test('bird: it hops a little around its perch while she is away', () => {
  let b = bird({ until: 0 });
  b = stepAnimal(b, ctx({ now: 10, rng: rngOf(0.3, 0.5, 0.5), player: at(500, 500) }));
  assert.equal(b.state, 'hop');
  const end = run(b, 10, { stop: (s) => s.state === 'perch' });
  assert.equal(end.state, 'perch');
  assert.ok(dist(end, { x: home.x + 0.5, y: home.y + 0.5 }) <= ANIMAL_RULES.bird.hopTiles + 1);
});

test('bird: it takes off away from her when she comes within 2.5 tiles, rising and flying off', () => {
  const b = bird();
  const player = at(b.x - 2, b.y);
  const lifted = stepAnimal(b, ctx({ player }));
  assert.equal(lifted.state, 'fly');
  assert.ok(lifted.tx > b.x, 'flies to the side away from her');
  assert.ok(dist({ x: lifted.tx, y: lifted.ty }, b) > ANIMAL_RULES.bird.flyAwayTiles - 0.01);
  const rising = stepAnimal(lifted, ctx({ player }));
  assert.ok(rising.alt > 0 && rising.alt <= ANIMAL_RULES.bird.liftPx);
  assert.equal(animalAnim(rising).anim.startsWith('fly-'), true);
  // Just outside the radius it stays on the ground.
  assert.equal(stepAnimal(bird({ until: 1e9 }), ctx({ player: at(b.x - 2.6, b.y) })).state, 'perch');
});

test('bird: full takeoff / away / return cycle -- flies off, vanishes, comes back later and lands on its perch', () => {
  const b = bird({ until: 1e9 });
  const near = at(b.x - 2, b.y);
  let s = stepAnimal(b, ctx({ player: near, now: 0 }));
  assert.equal(s.state, 'fly');
  // She stays put at the perch: it flies off until out of sight.
  let now = 0;
  const tick = (player) => { now += 50; s = stepAnimal(s, { now, dt: 0.05, player, rng: rngOf(0.5, 0.3, 0.7), isWalkable: open }); };
  for (let i = 0; i < 400 && s.state === 'fly'; i++) tick(near);
  assert.equal(s.state, 'gone');
  assert.equal(s.visible, false, 'out of sight');
  assert.ok(dist(s, b) >= ANIMAL_RULES.bird.flyAwayTiles - 0.01);
  // It does not come back while she is still standing at its perch, however long she waits.
  const waitUntil = now + ANIMAL_RULES.bird.goneMs[1] + 1000;
  while (now < waitUntil) tick(near);
  assert.equal(s.state, 'gone');
  // Once she has moved away it returns from a few tiles out, flying, then lands.
  tick(at(b.x + 30, b.y));
  assert.equal(s.state, 'land');
  assert.equal(s.visible, true);
  assert.ok(Math.abs(dist(s, { x: b.homeX, y: b.homeY }) - ANIMAL_RULES.bird.returnFromTiles) < 0.2, 'reappears at the return distance');
  assert.ok(s.alt > 0);
  for (let i = 0; i < 400 && s.state === 'land'; i++) tick(at(b.x + 30, b.y));
  assert.equal(s.state, 'perch');
  assert.equal(s.alt, 0);
  assert.equal(s.x, b.homeX);
  assert.equal(s.y, b.homeY);
  assert.equal(s.visible, true);
});

test('bird: it flies over walls (no walkable check), unlike the cat\'s run', () => {
  const b = bird();
  const lifted = stepAnimal(b, ctx({ player: at(b.x - 2, b.y), isWalkable: () => false }));
  assert.equal(lifted.state, 'fly');
});

test('animalAnim: every state of every species maps to an animation that exists in its layout', () => {
  const states = ['rest', 'alert', 'wander', 'return', 'startle', 'flee', 'perch', 'hop', 'fly', 'gone', 'land'];
  for (const species of Object.keys(ANIMAL_SPECIES)) {
    const info = ANIMAL_SPECIES[species];
    for (const state of states) {
      for (const facing of ['down', 'up', 'left', 'right']) {
        for (const rest of ['sit', 'sleep']) {
          for (const alt of [0, 14]) {
            const a = { ...makeAnimal({ id: 'z', species, x: 5, y: 5, behaviour: info.kind === 'bird' ? 'hop' : 'sit' }), state, facing, hFacing: facing === 'left' ? 'left' : 'right', rest, alt };
            const { anim, flipX, timeScale } = animalAnim(a);
            assert.ok(ANIMAL_LAYOUTS[info.layout].anims[anim], `${species}/${state}/${facing}: "${anim}" isn't an animation of ${info.layout}`);
            assert.equal(typeof flipX, 'boolean');
            assert.ok(timeScale >= 1);
          }
        }
      }
    }
  }
});

test('animalAnim: the side-view cat faces left in the art, so it flips to face right; a sleeping cat sleeps', () => {
  const ginger = (over) => ({ ...makeAnimal({ id: 'g', species: 'catside-ginger', x: 5, y: 5, behaviour: 'sleep' }), ...over });
  assert.equal(animalAnim(ginger({ hFacing: 'left' })).flipX, false);
  assert.equal(animalAnim(ginger({ hFacing: 'right' })).flipX, true);
  assert.equal(animalAnim(ginger({})).anim, 'sleep');
  assert.equal(animalAnim(ginger({ state: 'alert' })).anim, 'stand');
  assert.equal(animalAnim(ginger({ state: 'startle' })).anim, 'scared');
  assert.equal(animalAnim(ginger({ state: 'flee' })).anim, 'walk');
  assert.ok(animalAnim(ginger({ state: 'flee' })).timeScale > 1, 'a fleeing cat\'s legs go faster');
});

test('animalAnim: the 4-direction cat walks in the direction it moves and sits when resting facing the camera', () => {
  const orange = (over) => ({ ...makeAnimal({ id: 'o', species: 'cat-orange', x: 5, y: 5, behaviour: 'sit' }), ...over });
  assert.equal(animalAnim(orange({ state: 'wander', facing: 'left' })).anim, 'walk-left');
  assert.equal(animalAnim(orange({ state: 'return', facing: 'up' })).anim, 'walk-up');
  assert.equal(animalAnim(orange({ facing: 'down' })).anim, 'sit');
  assert.equal(animalAnim(orange({ state: 'alert', facing: 'right' })).anim, 'idle-right');
});
