// The Physics Lab key's hero fight (FB-0066, src/minigames/hero-logic.js): the pure rules, driven headless. The Phaser scene
// (src/minigames/hero.js) only draws this state, so these tests are the game: the arena is reachable, the shadow bat's volleys are fair,
// deterministic and always announced by a wind-up, hearts and invulnerability, the minion, the beat after the fight, the key, the win,
// and the failsafe that stops anyone being stuck. A skilled bot proves the fight is winnable; a bot that never dodges proves it is not trivial.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const g = loadGameData();
const L = plain(g.evaluate('HV_LEVEL'));
const create = g.evaluate('createHeroFight');
const step = g.evaluate('stepHeroFight');
const c = (name) => g.evaluate(name); // a constant by name
const feetY = g.evaluate('heroVillainFeetY');
const hitsLanded = g.evaluate('heroHitsLanded');
const DT = 16;

// Puts one of her star bolts right on the villain (so the next step lands it).
function shotAtVillain(state) {
  state.shots.push({ id: state.nextId++, x: state.villain.x - 4, y: feetY(state) - 30, dir: 1, travelled: 0 });
}

function putBoltOnPlayer(state) {
  const p = state.player;
  state.bolts.push({ id: state.nextId++, x: p.x, y: p.y - 18, vx: 0, vy: 0 });
}

function runUntil(state, bot, maxMs, stop = () => false) {
  const events = [];
  let t = 0;
  while (state.status === 'playing' && t < maxMs && !stop(state)) {
    for (const e of step(state, bot(state), DT)) events.push({ ...plain(e), at: state.t });
    t += DT;
  }
  return { events, t };
}

// ---------- a lookahead bot that plays like a careful person ----------
// It keeps a distance from the villain on the roof and holds the shoot key; when he is up high it hops onto the nearest platform
// under him and shoots from there; and when a bolt (or the minion) would hit her it jumps, if jumping saves her (it asks the real
// rules, on a copy of the state, instead of guessing).
const clone = (s) => JSON.parse(JSON.stringify(s));
function hitWithin(s, input, ms) {
  const copy = clone(s);
  const hearts = copy.hearts;
  let first = { ...input };
  for (let t = 0; t < ms; t += DT) {
    step(copy, first, DT);
    first = { left: input.left, right: input.right };
    if (copy.hearts < hearts || copy.status === 'lost') return true;
  }
  return false;
}
function makeBot({ range = 400, dodge = false, shoot = true } = {}) {
  return (s) => {
    const p = s.player;
    const v = s.villain;
    const input = {};
    if (shoot) input.shoot = true;
    if (s.phase === 'key' && s.key) { // walk to the key
      const d = s.key.x - p.x;
      if (d > 8) input.right = true; else if (d < -8) input.left = true;
      delete input.shoot;
      return input;
    }
    if (s.phase !== 'fight') return input;
    const go = (tx, tol = 10) => {
      const d = tx - p.x;
      if (d > tol) input.right = true; else if (d < -tol) input.left = true;
      return Math.abs(d) <= tol;
    };
    const threat = s.bolts.length > 0 || (s.minion.alive && Math.abs(s.minion.x - p.x) < 140);
    if (!(dodge && threat && p.grounded)) {
      if (v.hoverTo > 40) { // he is up: shoot from the platform nearest to him (the last one)
        if (p.surface === 2) go(650);
        else if (p.grounded && go(645, 12)) input.jumpPressed = true;
      } else if (p.surface !== -1 && p.grounded) {
        input.right = true; // walk off the platform
      } else if (p.grounded) {
        const there = go(v.x - range, 12);
        if (there && p.facing !== Math.sign(v.x - p.x)) { input.right = v.x > p.x; input.left = v.x < p.x; } // a tap to face him
      }
    }
    if (dodge && threat && p.grounded && hitWithin(s, {}, 700) && !hitWithin(s, { jumpPressed: true }, 900)) input.jumpPressed = true;
    return input;
  };
}

// ---------- the arena ----------

test('FB-0066 level: three platforms inside the walls, a jump clears the platform height with room, the gaps are crossable, the villain stands to her right', () => {
  assert.equal(L.platforms.length, 3);
  const apex = c('HV_JUMP_APEX');
  const airtime = (2 * -c('HV_JUMP_VELOCITY')) / c('HV_GRAVITY');
  const reach = airtime * c('HV_RUN_SPEED');
  L.platforms.forEach((plat, i) => {
    assert.ok(plat.x0 > c('HV_LEFT') && plat.x1 < c('HV_RIGHT'), `platform ${i} is inside the walls`);
    assert.ok(plat.x1 - plat.x0 >= 100, `platform ${i} is wide enough to land on`);
    const rise = L.floorY - plat.y;
    assert.ok(rise <= apex - 12, `platform ${i} (${rise} px up) is within a jump (apex ${apex.toFixed(0)}) with margin`);
    assert.ok(rise >= apex / 2, `platform ${i} is high enough to matter`);
    if (i > 0) assert.ok(plat.x0 - L.platforms[i - 1].x1 < reach - 20, `the gap before platform ${i} is crossable (${reach.toFixed(0)} px of jump)`);
  });
  assert.ok(L.spawn.x < L.villainZone.x0 && L.spawn.y === L.floorY, 'she starts on the roof, on the left');
  assert.ok(L.villainZone.x0 > L.platforms[2].x0, 'the villain walks beyond the last platform');
  assert.ok(L.villainZone.x1 < c('HV_RIGHT'));
  assert.ok(L.minion.x0 >= c('HV_LEFT') && L.minion.x1 < L.villainZone.x0, 'the minion patrols the left and centre');
});

test('FB-0066 physics: a jump from the roof lands on a platform when she is under it, and she can walk off its edge and drop', () => {
  const state = create({ hazards: false });
  const plat = L.platforms[1];
  state.player.x = (plat.x0 + plat.x1) / 2;
  step(state, { jumpPressed: true }, DT);
  for (let i = 0; i < 100 && !(state.player.grounded && state.player.surface === 1); i++) step(state, {}, DT);
  assert.equal(state.player.surface, 1);
  assert.equal(state.player.y, plat.y);
  for (let i = 0; i < 200 && !(state.player.grounded && state.player.surface === -1); i++) step(state, { right: true }, DT);
  assert.equal(state.player.surface, -1, 'she walked off the right end and landed on the roof');
  assert.equal(state.player.y, L.floorY);
  assert.equal(state.hearts, c('HV_HEARTS'));
  // jumping straight up under a platform passes through it (one-way) and lands on the roof again if she is clear of it
  const s2 = create({ hazards: false });
  s2.player.x = L.platforms[0].x0 - 40;
  step(s2, { jumpPressed: true }, DT);
  for (let i = 0; i < 100; i++) step(s2, {}, DT);
  assert.equal(s2.player.surface, -1);
});

test('FB-0066 physics: jump buffering and coyote time reuse the platformer helpers (a press just before landing fires on landing)', () => {
  const state = create({ hazards: false });
  state.player.x = 60; // on the roof, clear of the platforms
  step(state, { jumpPressed: true }, DT);
  let pressed = false;
  let jumps = 0;
  for (let i = 0; i < 120; i++) {
    const p = state.player;
    const press = !pressed && !p.grounded && p.vy > 0 && L.floorY - p.y < 12;
    if (press) pressed = true;
    jumps += step(state, { jumpPressed: press }, DT).filter((e) => e.type === 'jump').length;
  }
  assert.equal(pressed, true);
  assert.equal(jumps, 1, 'the early press fired as a second jump on landing');
  // coyote: walk off a platform's end and press jump within the window
  const s2 = create({ hazards: false });
  const plat = L.platforms[2];
  s2.player.x = plat.x1 + c('HV_EDGE_SLACK') - 1;
  s2.player.y = plat.y;
  s2.player.surface = 2;
  step(s2, { right: true }, DT);
  assert.equal(s2.player.grounded, false);
  assert.ok(step(s2, { jumpPressed: true }, DT).some((e) => e.type === 'jump'), 'a jump a moment after leaving the platform still works');
  assert.ok(!step(s2, { jumpPressed: true }, 300).some((e) => e.type === 'jump'), 'but not twice in mid-air');
});

test('FB-0066 stepHeroFight: a stalled frame never skips through a bolt or a floor (the step is clamped), a finished round stops', () => {
  const state = create({ hazards: false });
  const before = state.t;
  step(state, {}, 10000);
  assert.equal(state.t - before, c('HV_MAX_STEP_MS'));
  state.status = 'lost';
  const t = state.t;
  assert.equal(step(state, { right: true }, DT).length, 0);
  assert.equal(state.t, t);
});

// ---------- the shadow bat: health, volleys, wind-up ----------

test('FB-0066 villain: he takes 9 hits (8 to 10 as designed), the HUD target is the same number, and each hit shields him for a moment', () => {
  const { MINIGAMES } = g;
  assert.equal(c('HV_VILLAIN_HP'), 9);
  assert.ok(c('HV_VILLAIN_HP') >= 8 && c('HV_VILLAIN_HP') <= 10);
  assert.equal(MINIGAMES.hero.scoreTarget, c('HV_VILLAIN_HP'));
  const state = create({ hazards: false });
  assert.equal(state.villain.hp, 9);
  shotAtVillain(state);
  const events = step(state, {}, DT);
  assert.deepEqual(plain(events.filter((e) => e.type === 'villainHit').map((e) => [e.hp, e.hits])), [[8, 1]]);
  assert.equal(hitsLanded(state), 1);
  assert.ok(state.villain.invulnMs >= 1500, 'a hit shields him for 1.5 s or more');
  shotAtVillain(state);
  const again = step(state, {}, DT);
  assert.ok(again.some((e) => e.type === 'clink') && !again.some((e) => e.type === 'villainHit'), 'a shot at his shield does nothing');
  assert.equal(state.villain.hp, 8);
  assert.equal(state.shots.length, 0, 'the shot is used up');
});

test('FB-0066 villain: he is also shielded while he winds up and fires, so shooting then is wasted (the cue is to dodge)', () => {
  for (const phase of ['windup', 'fire']) {
    const state = create();
    state.villain.phase = phase;
    shotAtVillain(state);
    const events = step(state, {}, DT);
    assert.ok(events.some((e) => e.type === 'clink'), phase);
    assert.equal(state.villain.hp, c('HV_VILLAIN_HP'));
  }
  const rest = create();
  rest.villain.phase = 'rest';
  shotAtVillain(rest);
  assert.ok(step(rest, {}, DT).some((e) => e.type === 'villainHit'), 'resting, he can be hit');
});

test('FB-0066 shots: straight, fast, a limited range and a limited number in the air; a shot misses a villain who is above its line', () => {
  const state = create({ hazards: false });
  const p = state.player;
  step(state, { shoot: true }, DT);
  assert.equal(state.shots.length, 1);
  assert.equal(state.shots[0].dir, 1);
  assert.ok(Math.abs(state.shots[0].y - (p.y - c('HV_SHOT_H'))) < 1, 'it leaves her at waist height');
  for (let i = 0; i < 20; i++) step(state, { shoot: true }, DT);
  assert.ok(state.shots.length <= c('HV_SHOT_MAX'));
  for (let i = 0; i < 200; i++) step(state, {}, DT);
  assert.equal(state.shots.length, 0, 'out of range they vanish');
  // she cannot hit him from the far left (out of range) ...
  const far = create({ hazards: false });
  far.villain.x = 760;
  for (let i = 0; i < 120; i++) step(far, { shoot: true }, DT);
  assert.equal(far.villain.hp, 9, 'he is beyond the shot range from the spawn');
  assert.ok(760 - L.spawn.x > c('HV_SHOT_RANGE'));
  // ... and when he hovers high a roof shot passes under him but a shot from a platform hits
  const high = create({ hazards: false });
  high.villain.hover = c('HV_VILLAIN_HOVER_HIGH');
  high.villain.hoverTo = c('HV_VILLAIN_HOVER_HIGH');
  high.player.x = high.villain.x - 300;
  for (let i = 0; i < 60; i++) step(high, { shoot: true }, DT);
  assert.equal(high.villain.hp, 9, 'from the roof the shots go under him');
  const onPlatform = create({ hazards: false });
  onPlatform.villain.hover = c('HV_VILLAIN_HOVER_HIGH');
  onPlatform.villain.hoverTo = c('HV_VILLAIN_HOVER_HIGH');
  onPlatform.player.x = 650;
  onPlatform.player.y = L.platforms[2].y;
  onPlatform.player.surface = 2;
  for (let i = 0; i < 60; i++) step(onPlatform, { shoot: true }, DT);
  assert.ok(onPlatform.villain.hp < 9, 'from the last platform they hit');
});

test('FB-0066 volleys: the plan is aimed, aimed, fan, sweep and round again, the same on every run (nothing random)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'hero-logic.js'), 'utf8');
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /Math\.random/, 'no randomness in the rules');
  assert.deepEqual(plain(c('HV_PLAN')), ['aimed', 'aimed', 'fan', 'sweep']);
  const run = () => {
    const state = create();
    state.hearts = 999;
    const log = [];
    for (let i = 0; i < 3000; i++) for (const e of step(state, { right: i % 200 < 50 }, DT)) log.push([e.type, e.pattern || '', Math.round(state.t)]);
    return JSON.stringify([state, log]);
  };
  assert.equal(run(), run(), 'identical rounds replay identically');
  const state = create();
  state.hearts = 999;
  const patterns = [];
  for (let i = 0; i < 3500; i++) for (const e of step(state, {}, DT)) if (e.type === 'volley') patterns.push(e.pattern);
  assert.deepEqual(patterns.slice(0, 8), ['aimed', 'aimed', 'fan', 'sweep', 'aimed', 'aimed', 'fan', 'sweep']);
});

test('FB-0066 volleys: every volley is announced by a wind-up of 600 ms first, nothing is fired before the first one, and bolts are slow', () => {
  assert.equal(c('HV_WINDUP_MS'), 600);
  const state = create();
  state.hearts = 999;
  const log = [];
  let firstBoltAt = null;
  for (let i = 0; i < 4000; i++) {
    for (const e of step(state, {}, DT)) log.push({ type: e.type, at: state.t });
    if (firstBoltAt === null && state.bolts.length) firstBoltAt = state.t;
  }
  const windups = log.filter((e) => e.type === 'windup');
  const volleys = log.filter((e) => e.type === 'volley');
  assert.ok(volleys.length >= 6);
  volleys.forEach((volley, i) => {
    const lead = volley.at - windups[i].at;
    assert.ok(lead >= c('HV_WINDUP_MS') - 2 * DT && lead <= c('HV_WINDUP_MS') + 2 * DT, `volley ${i}: wind-up ${lead} ms ahead`);
  });
  assert.ok(firstBoltAt >= c('HV_FIRST_REST_MS') + c('HV_WINDUP_MS') - DT, `the first bolt appears at ${firstBoltAt} ms: a calm start`);
  for (const speed of Object.values(plain(c('HV_BOLT_SPEED')))) assert.ok(speed <= 240 && speed >= 150, `bolt speed ${speed}: slow, not a crawl`);
  // an aimed volley comes about every 2 s (rest 1.4 s + wind-up 0.6 s): the brief's "about every 2 s"
  const aimedGap = windups[1].at - windups[0].at; // wind-up to wind-up, both aimed
  assert.ok(aimedGap >= 1900 && aimedGap <= 2100, `two aimed volleys ${aimedGap} ms apart`);
});

test('FB-0066 volleys: an aimed volley is one bolt at her; a fan is three (five when he is angry), spread round the aim; a sweep is five, one at a time', () => {
  const countBolts = (hp, pattern) => {
    const state = create();
    state.hearts = 999;
    state.invulnMs = 1e9;
    state.villain.hp = hp;
    state.villain.restMs = 100;
    state.villain.plan = ['aimed', 'fan', 'sweep'].indexOf(pattern) === 0 ? 0 : pattern === 'fan' ? 2 : 3;
    const startId = state.nextId;
    const perStep = [];
    for (let i = 0; i < 400; i++) {
      const before = state.nextId;
      const events = step(state, {}, DT);
      if (state.nextId > before) perStep.push([state.nextId - before, state.t]);
      if (events.some((e) => e.type === 'volley') && pattern !== 'sweep') break;
      if (pattern === 'sweep' && state.villain.phase === 'rest' && state.nextId > startId) break;
    }
    return { total: state.nextId - startId, perStep, bolts: plain(state.bolts) };
  };
  assert.equal(countBolts(9, 'aimed').total, 1);
  assert.equal(countBolts(9, 'fan').total, 3);
  assert.equal(countBolts(c('HV_VILLAIN_RAGE_HP'), 'fan').total, 5, 'angry: a wider fan');
  const sweep = countBolts(9, 'sweep');
  assert.equal(sweep.total, 5);
  assert.ok(sweep.perStep.every(([n]) => n === 1), 'the sweep fires one bolt at a time');
  const gaps = sweep.perStep.slice(1).map(([, t], i) => t - sweep.perStep[i][1]);
  for (const gap of gaps) assert.ok(gap >= c('HV_SWEEP_INTERVAL_MS') - 2 * DT && gap <= c('HV_SWEEP_INTERVAL_MS') + 2 * DT, `sweep gap ${gap}`);
  // the aimed bolt really heads for her chest
  const state = create();
  state.villain.restMs = 50;
  state.villain.plan = 0;
  state.player.x = 300;
  for (let i = 0; i < 200 && !state.bolts.length; i++) step(state, {}, DT);
  const b = state.bolts[0];
  assert.ok(b.vx < 0, 'it flies toward her (she is to his left)');
  const t = Math.abs((state.player.x - b.x) / b.vx);
  assert.ok(Math.abs(b.y + b.vy * t - (state.player.y - 18)) < 6, 'and arrives at her chest if she stays put');
});

test('FB-0066 villain: he hovers low for the aimed bolts and rises for the fan and the sweep (so the platforms matter), and angry he rests less', () => {
  const state = create();
  state.hearts = 999;
  const heights = [];
  let last = null;
  for (let i = 0; i < 3500; i++) {
    step(state, {}, DT);
    if (state.villain.hoverTo !== last) { last = state.villain.hoverTo; heights.push(last); }
  }
  assert.deepEqual(heights.slice(0, 4), [c('HV_VILLAIN_HOVER_LOW'), c('HV_VILLAIN_HOVER_HIGH'), c('HV_VILLAIN_HOVER_LOW'), c('HV_VILLAIN_HOVER_HIGH')]);
  assert.ok(c('HV_VILLAIN_HOVER_HIGH') > c('HV_VILLAIN_HOVER_LOW') + 30);
  const calm = create();
  const angry = create();
  angry.villain.hp = c('HV_VILLAIN_RAGE_HP');
  const rest = g.evaluate('heroRestMsFor');
  assert.ok(rest(angry) < rest(calm));
  assert.equal(rest(angry), Math.round(rest(calm) * c('HV_RAGE_REST_FACTOR')));
});

test('FB-0066 villain: he steps along the right of the arena (never leaves his zone), standing still while he winds up and fires', () => {
  const state = create();
  state.hearts = 999;
  const zone = L.villainZone;
  let minX = 1e9;
  let maxX = -1e9;
  let wasStill = true;
  for (let i = 0; i < 6000; i++) {
    const x0 = state.villain.x;
    const phase0 = state.villain.phase;
    step(state, {}, DT);
    minX = Math.min(minX, state.villain.x);
    maxX = Math.max(maxX, state.villain.x);
    if (phase0 === 'windup' || phase0 === 'fire') wasStill = wasStill && state.villain.x === x0;
  }
  assert.ok(minX >= zone.x0 && maxX <= zone.x1);
  assert.ok(maxX - minX > 100, 'he does move');
  assert.equal(wasStill, true);
});

// ---------- hearts, invulnerability ----------

test('FB-0066 hearts: three; a bolt costs one and breaks on her, and starts an invulnerability of 1.5 s in which bolts pass through', () => {
  assert.equal(c('HV_HEARTS'), 3);
  assert.equal(c('HV_INVULN_MS'), 1500);
  const state = create({ hazards: false });
  putBoltOnPlayer(state);
  const events = step(state, {}, DT);
  assert.equal(state.hearts, 2);
  assert.ok(events.some((e) => e.type === 'hit' && e.hearts === 2 && e.source === 'bolt'));
  assert.equal(state.bolts.length, 0, 'it broke on her');
  assert.ok(state.invulnMs > 0 && state.invulnMs <= 1500);
  putBoltOnPlayer(state);
  step(state, {}, DT);
  assert.equal(state.hearts, 2, 'no second hit while invulnerable');
  assert.equal(state.bolts.length, 1, 'the bolt flies on');
  state.bolts = [];
  for (let i = 0; i < Math.ceil(1500 / DT) + 3; i++) step(state, {}, DT);
  assert.equal(state.invulnMs, 0);
  putBoltOnPlayer(state);
  step(state, {}, DT);
  assert.equal(state.hearts, 1, 'hit again once it has worn off');
});

test('FB-0066 hearts: the third hit loses the round (a lose event, then nothing more happens)', () => {
  const state = create({ hazards: false });
  for (let hit = 0; hit < 3; hit++) {
    state.invulnMs = 0;
    putBoltOnPlayer(state);
    const events = step(state, {}, DT);
    assert.equal(events.some((e) => e.type === 'lose'), hit === 2);
  }
  assert.equal(state.hearts, 0);
  assert.equal(state.status, 'lost');
  assert.equal(step(state, { right: true }, DT).length, 0);
});

test('FB-0066 hearts: a bolt that passes above or beside her does not hurt (the hitbox is the bolt, not the sprite)', () => {
  const state = create({ hazards: false });
  const p = state.player;
  state.bolts.push({ id: 1, x: p.x + 40, y: p.y - 18, vx: 0, vy: 0 });
  state.bolts.push({ id: 2, x: p.x, y: p.y - 70, vx: 0, vy: 0 });
  step(state, {}, DT);
  assert.equal(state.hearts, 3);
});

test('FB-0066 dodging: a standing jump timed within a window of at least 300 ms clears an aimed bolt, and not jumping gets hit', () => {
  let hitWithoutJump = false;
  let cleared = 0;
  for (const jumpAt of [null, ...Array.from({ length: 160 }, (_, i) => i * 10)]) {
    const state = create();
    state.villain.restMs = 1e9; // he stays out of it: this is one bolt we fire by hand
    state.minion.alive = false;
    state.player.x = 300;
    const b = { id: 1, x: 640, y: L.floorY - 40, vx: 0, vy: 0 };
    const t = (b.x - state.player.x) / c('HV_BOLT_SPEED').aimed;
    b.vx = -c('HV_BOLT_SPEED').aimed;
    b.vy = ((L.floorY - 18 - b.y) / t);
    state.bolts.push(b);
    for (let ms = 0; ms < 3000 && state.bolts.length; ms += 10) step(state, { jumpPressed: jumpAt !== null && ms === jumpAt }, 10);
    if (jumpAt === null) hitWithoutJump = state.hearts < 3;
    else if (state.hearts === 3) cleared++;
  }
  assert.equal(hitWithoutJump, true, 'standing still gets hit');
  assert.ok(cleared * 10 >= 300, `the clearing window is ${cleared * 10} ms wide`);
});

// ---------- the minion ----------

test('FB-0066 minion: it patrols the roof between its two ends at a walking pace, and touching it costs a heart', () => {
  const state = create();
  state.villain.restMs = 1e9;
  state.player.y = 9999; // out of the way
  state.player.grounded = false;
  const seen = [];
  let last = state.minion.dir;
  for (let i = 0; i < 2000; i++) {
    step(state, {}, DT);
    seen.push(state.minion.x);
    if (state.minion.dir !== last) last = state.minion.dir;
  }
  assert.ok(Math.min(...seen) >= L.minion.x0 && Math.max(...seen) <= L.minion.x1);
  assert.ok(Math.max(...seen) - Math.min(...seen) > 300, 'it walks a long way');
  assert.ok(L.minion.speed <= 80, 'at a gentle pace');
  const touch = create();
  touch.villain.restMs = 1e9;
  touch.minion.x = touch.player.x;
  const events = step(touch, {}, DT);
  assert.ok(events.some((e) => e.type === 'hit' && e.source === 'minion'));
  assert.equal(touch.hearts, 2);
});

test('FB-0066 minion: one shot downs it; the first time it drops a heart (at most one per round), and it comes back after 9 s without another', () => {
  const state = create();
  state.villain.restMs = 1e9;
  state.hearts = 2;
  const m = state.minion;
  m.x = 300;
  m.dir = 1;
  state.player.x = 200;
  state.shots.push({ id: state.nextId++, x: 290, y: L.floorY - 20, dir: 1, travelled: 0 });
  const events = step(state, {}, DT);
  assert.ok(events.some((e) => e.type === 'minionDown'));
  assert.equal(state.minion.alive, false);
  assert.ok(state.pickup && Math.abs(state.pickup.x - 290) < 30, 'a heart where it fell');
  // she picks it up: back to 3 hearts, never more
  state.player.x = state.pickup.x;
  const heal = step(state, {}, DT);
  assert.ok(heal.some((e) => e.type === 'heal'));
  assert.equal(state.hearts, 3);
  assert.equal(state.pickup, null);
  // a full-health Taru leaves the heart where it is
  const full = create();
  full.villain.restMs = 1e9;
  full.minion.x = 300;
  full.player.x = 200;
  full.shots.push({ id: 5, x: 290, y: L.floorY - 20, dir: 1, travelled: 0 });
  step(full, {}, DT);
  full.player.x = full.pickup.x;
  step(full, {}, DT);
  assert.equal(full.hearts, 3);
  assert.ok(full.pickup, 'not taken at full health: it waits');
  // it respawns after 9 s, at the end of its beat farther from her, and a second kill drops nothing
  let back = false;
  state.player.x = L.minion.x0 + 20;
  for (let ms = 0; ms < 9000 + 200 && !back; ms += DT) back = step(state, {}, DT).some((e) => e.type === 'minionBack');
  assert.equal(back, true);
  assert.ok(state.minion.alive && state.minion.x === L.minion.x1, 'it came back at the far end');
  state.minion.x = 400;
  state.player.x = 300;
  state.shots.push({ id: state.nextId++, x: 392, y: L.floorY - 20, dir: 1, travelled: 0 });
  step(state, {}, DT);
  assert.equal(state.minion.kills, 2);
  assert.equal(state.pickup, null, 'one heart per round');
});

test('FB-0066 minion: a heart waits 10 s and then goes', () => {
  const state = create();
  state.villain.restMs = 1e9;
  state.minion.x = 300;
  state.player.x = 100;
  state.shots.push({ id: 9, x: 292, y: L.floorY - 20, dir: 1, travelled: 0 });
  step(state, {}, DT);
  assert.ok(state.pickup);
  for (let ms = 0; ms < 10200; ms += DT) step(state, {}, DT);
  assert.equal(state.pickup, null);
});

// ---------- the end of the fight ----------

test('FB-0066 win: nine hits end the fight, a beat follows, then the key drops, lands and she takes it: the round is won, for real', () => {
  const state = create({ hazards: false });
  const { events } = runUntil(state, makeBot({ range: 400 }), 200000);
  assert.equal(state.status, 'won');
  assert.equal(state.failsafe, false);
  const types = events.map((e) => e.type);
  assert.equal(types.filter((t) => t === 'villainHit').length, 9);
  const hitTimes = events.filter((e) => e.type === 'villainHit').map((e) => e.at);
  for (let i = 1; i < hitTimes.length; i++) assert.ok(hitTimes[i] - hitTimes[i - 1] >= c('HV_VILLAIN_HIT_INVULN_MS') - DT, 'hits are at least 1.8 s apart');
  const idx = (type) => types.indexOf(type);
  assert.ok(idx('defeated') > types.lastIndexOf('villainHit') - 1 && idx('keyDrop') > idx('defeated') && idx('keyLand') > idx('keyDrop') && idx('win') > idx('keyLand'), 'defeated, keyDrop, keyLand, win in order');
  const beat = events.find((e) => e.type === 'keyDrop').at - events.find((e) => e.type === 'defeated').at;
  assert.ok(Math.abs(beat - c('HV_DEFEAT_BEAT_MS')) <= 2 * DT, `the beat lasts ${beat} ms`);
  assert.equal(events.filter((e) => e.type === 'win').length, 1);
  assert.equal(events.find((e) => e.type === 'win').failsafe, false);
  assert.equal(state.phase, 'key');
});

test('FB-0066 win: after he falls his bolts and the minion are gone, she cannot be hurt, and she cannot shoot any more', () => {
  const state = create();
  putBoltOnPlayer(state);
  state.bolts[0].x += 300;
  state.villain.hp = 1;
  state.villain.phase = 'rest';
  shotAtVillain(state);
  const events = step(state, { shoot: true }, DT);
  assert.ok(events.some((e) => e.type === 'defeated'));
  assert.equal(state.phase, 'defeated');
  assert.equal(state.bolts.length, 0);
  assert.equal(state.shots.length, 0);
  assert.equal(state.minion.alive, false);
  for (let i = 0; i < 200; i++) step(state, { shoot: true }, DT);
  assert.equal(state.shots.length, 0, 'no more shooting in the beat');
  assert.equal(state.hearts, 3);
  assert.equal(state.status, 'playing', 'she still has to take the key');
});

test('FB-0066 key: it drops where he fell, lands on the roof, is taken by walking over it, and slides to her if she dawdles', () => {
  const state = create();
  state.villain.hp = 1;
  state.villain.phase = 'rest';
  state.villain.x = 700;
  state.villain.pauseMs = 5000; // he stands still
  shotAtVillain(state);
  step(state, {}, DT);
  for (let i = 0; i < 400 && state.phase !== 'key'; i++) step(state, {}, DT);
  assert.equal(state.phase, 'key');
  assert.equal(Math.round(state.key.x), 700);
  for (let i = 0; i < 200 && !state.key.landed; i++) step(state, {}, DT);
  assert.equal(state.key.landed, true);
  assert.equal(state.key.y, L.keyY);
  // on a platform above it she does not take it; she must come down and walk over
  const up = clone(state);
  up.player.x = 700;
  up.player.y = L.platforms[2].y;
  up.player.surface = 2;
  step(up, {}, DT);
  assert.equal(up.status, 'playing');
  // the magnet: after 8 s it comes to her
  const idle = clone(state);
  idle.player.x = 300;
  idle.player.y = L.floorY;
  idle.player.surface = -1;
  idle.player.grounded = true;
  let events = [];
  for (let ms = 0; ms < 20000 && idle.status === 'playing'; ms += DT) events = step(idle, {}, DT);
  assert.equal(idle.status, 'won');
  assert.equal(idle.failsafe, false, 'she was reached by the key: a real win');
  assert.ok(idle.keyMs >= c('HV_KEY_MAGNET_MS') && idle.keyMs < c('HV_KEY_FAILSAFE_MS'));
  assert.ok(events.some((e) => e.type === 'win'));
  // and walking to it wins at once
  const walk = clone(state);
  walk.player.x = 640;
  for (let i = 0; i < 200 && walk.status === 'playing'; i++) step(walk, { right: true }, DT);
  assert.equal(walk.status, 'won');
});

test('FB-0066 failsafe: a round that lasts past 150 s counts as a win, so nobody is ever stuck in the game', () => {
  assert.equal(c('HV_FAILSAFE_MS'), 150000);
  const state = create({ hazards: false });
  let events = [];
  for (let t = 0; t < 150000 + 200 && state.status === 'playing'; t += 40) events = step(state, {}, 40);
  assert.equal(state.status, 'won');
  assert.equal(state.failsafe, true);
  assert.ok(state.t >= 150000 && state.t <= 150040);
  assert.deepEqual(plain(events.filter((e) => e.type === 'win')), [{ type: 'win', failsafe: true }]);
  // the key phase has its own failsafe: 20 s and the key is hers
  const key = create();
  key.phase = 'key';
  key.villain.phase = 'down';
  key.key = { x: 900, y: L.floorY, vy: 0, landed: true };
  key.player.x = 100;
  key.keyMs = c('HV_KEY_FAILSAFE_MS') - 20;
  step(key, {}, DT);
  step(key, {}, DT);
  assert.equal(key.status, 'won');
  assert.equal(key.failsafe, true);
});

// ---------- bots: neither trivial nor impossible ----------

test('FB-0066 bots: with the villain\'s fire switched off a plain shooter wins in well under a minute, taking about 20 s', () => {
  const state = create({ hazards: false });
  const { t } = runUntil(state, makeBot({ range: 400 }), 200000);
  assert.equal(state.status, 'won');
  assert.equal(state.failsafe, false);
  assert.equal(hitsLanded(state), 9);
  assert.ok(t > 15000 && t < 60000, `a clean fight takes ${t} ms`);
});

test('FB-0066 bots: a careful dodger who shoots wins the real fight (it is fair), in 20 to 90 s and not for free', () => {
  const state = create();
  const { t, events } = runUntil(state, makeBot({ range: 400, dodge: true }), 200000);
  assert.equal(state.status, 'won', `lost after ${t} ms`);
  assert.equal(state.failsafe, false);
  assert.equal(hitsLanded(state), 9);
  assert.ok(t >= 20000 && t <= 90000, `the fight took ${t} ms`);
  assert.ok(events.filter((e) => e.type === 'windup').length >= 4, 'he got to fire plenty of volleys');
});

test('FB-0066 bots: a shooter who never dodges loses before she can win (it is not trivial); so does standing still', () => {
  const shooter = create();
  const { t } = runUntil(shooter, makeBot({ range: 400 }), 200000);
  assert.equal(shooter.status, 'lost');
  assert.ok(shooter.villain.hp > 0, 'he is still standing');
  assert.ok(t < 30000, `she is out of hearts after ${t} ms`);
  const idle = create();
  runUntil(idle, () => ({}), 200000);
  assert.equal(idle.status, 'lost');
  assert.equal(idle.villain.hp, 9);
});

test('FB-0066 bots: every round ends, whatever she does (a rule-following random player reaches won or lost within the failsafe)', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const state = create();
    let a = seed * 7919;
    const rand = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
    let held = {};
    let t = 0;
    while (state.status === 'playing' && t < 160000) {
      if (t % 320 === 0) held = { left: rand() < 0.3, right: rand() < 0.35, shoot: rand() < 0.6 };
      step(state, { ...held, jumpPressed: rand() < 0.03 }, DT);
      t += DT;
    }
    assert.notEqual(state.status, 'playing', `seed ${seed} ended`);
  }
});

// ---------- the scene and its art (source assertions: Phaser is not available here) ----------

test('FB-0066 hero scene: built on the shared shell, steps the pure state, a click or Z shoots, jump keys are gated on playing, the camera never moves', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'hero.js'), 'utf8');
  assert.match(src, /class HeroScene extends MinigameBaseScene/);
  assert.match(src, /super\('minigame-hero'\)/);
  assert.match(src, /createHeroFight\(\)/);
  assert.match(src, /stepHeroFight\(this\.hv, input, delta\)/);
  assert.match(src, /addKey\('Z'\)/, 'the shoot key is Z: not one of the shell\'s card keys (Enter, Space, E, Up, Down, W, S)');
  assert.match(src, /shoot: this\.shootKey\.isDown \|\| pointerShoot/, 'Z or the mouse click (FB-0081)');
  assert.match(src, /!event\.repeat && this\.mgState === 'playing'\) this\.jumpQueued = true/, 'FB-0042: the press that confirms START or RETRY must not jump');
  assert.match(src, /case 'lose':[\s\S]*?this\.lose\(\);/);
  assert.match(src, /case 'win':[\s\S]*?this\.win\(\);/);
  assert.doesNotMatch(src, /startFollow|scrollX\s*=/);
  assert.doesNotMatch(src, /delayedCall/, 'no timers that could fire after the scene is gone: everything runs off the frame clock');
  // the sprite frames the scene uses all exist in the generated sheet (8 columns x 4 rows of 32 px cells) and none is used twice
  const frames = new Function(`return ${/const HVS_FRAME = (\{[\s\S]*?\n\});/.exec(src)[1]}`)();
  const flat = Object.values(frames).flat();
  assert.ok(Math.max(...flat) < 32, 'every frame is inside the 8 x 4 sheet');
  assert.equal(new Set(flat).size, flat.length, 'no two sprites share a frame');
  assert.equal(frames.run.length, 4);
  // the blink is slower than the 3 Hz flash limit (docs/GAME_FEEL.md)
  assert.ok(Number(/HVS_BLINK_MS = (\d+)/.exec(src)[1]) >= 167);
  // the villain's line, as in the brief
  assert.match(src, /'Fine, fine\. Take it\.'/);
});

test('FB-0066 hero scene: its sounds are all registered ones, nothing new to load', () => {
  const { SOUNDS } = g;
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'hero.js'), 'utf8');
  const used = [...src.matchAll(/AudioManager\.play\('(\w+)'\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 4);
  for (const id of used) assert.ok(SOUNDS[id], `${id} is a registered sound`);
});
