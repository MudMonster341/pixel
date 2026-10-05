// Room 195's tower climb (FB-0074, src/minigames/tower-logic.js): the pure rules, driven headless. The Phaser scene
// (src/minigames/tower.js) only draws this state, so these tests are the game: the level is always completable, the gargoyle's
// throws are fair and deterministic, hearts and invulnerability, the win, and the failsafe that stops anyone being stuck.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const g = loadGameData();
const L = plain(g.evaluate('TOWER_LEVEL'));
const create = g.evaluate('createTowerState');
const step = g.evaluate('stepTower');
const schedule = g.evaluate('towerSchedule');
const c = (name) => g.evaluate(name); // a constant by name
const DT = 16;

// A plain scripted player: climbs straight to the top without ever dodging (what a bot needs to prove the level is climbable
// when no hazards are in the way).
function climbBot(state) {
  const p = state.player;
  const input = {};
  if (p.mode === 'ladder') input.up = true;
  else if (p.mode === 'ground') {
    if (p.floor === L.topFloor) input.left = true;
    else {
      const ladder = L.ladders[p.floor];
      if (Math.abs(p.x - ladder.x) > 4) { if (p.x < ladder.x) input.right = true; else input.left = true; } else input.up = true;
    }
  }
  return input;
}

function runBot(state, bot, maxMs = 200000) {
  const events = [];
  let t = 0;
  while (state.status === 'playing' && t < maxMs) { events.push(...step(state, bot(state), DT)); t += DT; }
  return { t, events };
}

// Puts her on a floor at x (grounded), as if she had walked there.
function standOn(state, floor, x) {
  const p = state.player;
  p.mode = 'ground';
  p.floor = floor;
  p.ladder = null;
  p.x = x;
  p.y = L.floors[floor].y;
  p.vx = 0;
  p.vy = 0;
  if (floor > state.best) state.best = floor;
}

// ---------- the level ----------

test('tower level: five floors, evenly spaced, alternating which way things roll, the top floor rolling right toward the open end', () => {
  assert.equal(L.floors.length, c('TOWER_FLOOR_COUNT'));
  assert.equal(L.floors.length, 5);
  L.floors.forEach((floor, i) => {
    assert.equal(floor.index, i);
    assert.equal(floor.y, c('TOWER_GROUND_Y') - i * c('TOWER_FLOOR_SPACING'));
    if (i > 0) assert.equal(floor.flow, -L.floors[i - 1].flow, `floor ${i} rolls the opposite way to the one below`);
  });
  assert.equal(L.floors[L.topFloor].flow, 1);
  assert.ok(L.floors[L.topFloor].y - c('TOWER_PLAYER_H') > 60, 'her head on the top floor stays clear of the HUD strip');
  // every floor above the ground one is open at the end its hazards roll toward, and only there
  for (const f of L.floors.slice(1)) {
    if (f.flow > 0) { assert.equal(f.x0, c('TOWER_LEFT')); assert.equal(f.x1, c('TOWER_RIGHT') - c('TOWER_DROP_GAP')); }
    else { assert.equal(f.x0, c('TOWER_LEFT') + c('TOWER_DROP_GAP')); assert.equal(f.x1, c('TOWER_RIGHT')); }
  }
  assert.equal(L.floors[0].x0, c('TOWER_LEFT'));
  assert.equal(L.floors[0].x1, c('TOWER_RIGHT'));
});

test('tower level: ladders alternate sides, sit toward the side the floor above rolls to, and stand on solid beam at both ends', () => {
  assert.equal(L.ladders.length, L.floors.length - 1);
  L.ladders.forEach((ladder, j) => {
    assert.equal(ladder.bottomFloor, j);
    assert.equal(ladder.topFloor, j + 1);
    assert.equal(ladder.yBottom, L.floors[j].y);
    assert.equal(ladder.yTop, L.floors[j + 1].y);
    const side = ladder.x > (c('TOWER_LEFT') + c('TOWER_RIGHT')) / 2 ? 1 : -1;
    assert.equal(side, L.floors[j + 1].flow, `ladder ${j} is on the side the floor above rolls toward`);
    if (j > 0) assert.notEqual(side, L.ladders[j - 1].x > 480 ? 1 : -1, 'ladders alternate left and right');
    for (const floor of [L.floors[j], L.floors[j + 1]]) {
      assert.ok(ladder.x - c('TOWER_LADDER_GRAB') > floor.x0 + 10 && ladder.x + c('TOWER_LADDER_GRAB') < floor.x1 - 10, `ladder ${j} stands well inside floor ${floor.index}'s beam, not on an open end`);
    }
  });
});

test('tower level: every floor is reachable from the first through the ladders (a graph search over floors and ladders)', () => {
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const f = queue.shift();
    for (const ladder of L.ladders) {
      for (const [from, to] of [[ladder.bottomFloor, ladder.topFloor], [ladder.topFloor, ladder.bottomFloor]]) {
        if (from === f && !seen.has(to)) { seen.add(to); queue.push(to); }
      }
    }
  }
  assert.equal(seen.size, L.floors.length, 'every floor can be reached');
  // and within each floor she can walk between where she arrives and where the next ladder starts, and to the prince
  for (let f = 1; f < L.floors.length; f++) {
    const arrive = L.ladders[f - 1].x;
    const depart = f < L.floors.length - 1 ? L.ladders[f].x : (L.winZone.x0 + L.winZone.x1) / 2;
    for (const x of [arrive, depart]) assert.ok(x >= L.floors[f].x0 && x <= L.floors[f].x1, `floor ${f} beam holds x=${x}`);
  }
  assert.ok(L.winZone.floor === L.topFloor && L.winZone.x0 > L.floors[L.topFloor].x0 && L.winZone.x1 < L.floors[L.topFloor].x1);
  assert.ok(L.spawn.x >= L.floors[0].x0 && L.spawn.x <= L.floors[0].x1 && L.spawn.y === L.floors[0].y, 'she starts on the ground floor');
});

test('tower level: a bot without hazards gets from the start to the prince through the real state machine, floor by floor', () => {
  const state = create(195, { hazards: false });
  const { t, events } = runBot(state, climbBot);
  assert.equal(state.status, 'won');
  assert.equal(state.failsafe, false, 'a real win, not the timer');
  assert.deepEqual(events.filter((e) => e.type === 'floor').map((e) => e.floor), [1, 2, 3, 4]);
  assert.ok(t > 15000 && t < 60000, `a clean run takes ${t} ms: well short of the failsafe, long enough to be a climb`);
  assert.equal(c('TOWER_FAILSAFE_MS') > t * 2, true);
});

test('tower physics: the jump clears a barrel but can never reach the next floor or bump the beam above', () => {
  const apex = c('TOWER_JUMP_APEX');
  const kinds = plain(g.evaluate('TOWER_HAZARD_KINDS'));
  const tallest = Math.max(...Object.values(kinds).map((k) => k.h));
  assert.ok(apex > tallest + 20, `the apex (${apex.toFixed(1)}) clears the tallest hazard (${tallest}) with room`);
  assert.ok(apex < c('TOWER_HEAD_ROOM') - c('TOWER_PLAYER_H'), 'her head stays under the next beam at the top of a jump');
  assert.ok(apex < c('TOWER_FLOOR_SPACING') / 2, 'a jump is nowhere near a floor: the ladders matter');
  // simulate a standing jump on floor 1 and watch the highest point she reaches
  const state = create(1, { hazards: false });
  standOn(state, 1, 480);
  let minY = state.player.y;
  step(state, { jumpPressed: true }, DT);
  for (let i = 0; i < 100; i++) { step(state, {}, DT); minY = Math.min(minY, state.player.y); }
  assert.ok(L.floors[1].y - minY > apex - 3 && L.floors[1].y - minY <= apex + 1, 'she rises to about the apex');
  assert.equal(state.player.mode, 'ground');
  assert.equal(state.player.floor, 1, 'and lands on the same floor');
});

// ---------- the climb ----------

test('climb: UP at a ladder grabs it (gravity off, sideways locked, snapped to the rungs), then climbs to the floor above and stands there', () => {
  const state = create(7, { hazards: false });
  const ladder = L.ladders[0];
  standOn(state, 0, ladder.x + 5);
  let events = step(state, { up: true }, DT);
  assert.equal(state.player.mode, 'ladder');
  assert.equal(state.player.ladder, 0);
  assert.equal(state.player.x, ladder.x, 'snapped to the ladder');
  for (let i = 0; i < 20; i++) step(state, { up: true, right: true }, DT);
  assert.equal(state.player.x, ladder.x, 'left/right do nothing on a ladder');
  assert.ok(state.player.y < ladder.yBottom && state.player.y > ladder.yTop, 'she is partway up');
  for (let i = 0; i < 20; i++) step(state, {}, DT);
  const yHeld = state.player.y;
  step(state, {}, DT);
  assert.equal(state.player.y, yHeld, 'no gravity and no input: she hangs on the ladder');
  events = [];
  for (let i = 0; i < 200 && state.player.mode === 'ladder'; i++) events.push(...step(state, { up: true }, DT));
  assert.equal(state.player.mode, 'ground');
  assert.equal(state.player.floor, 1);
  assert.equal(state.player.y, ladder.yTop);
  assert.deepEqual(plain(events.filter((e) => e.type === 'floor')), [{ type: 'floor', floor: 1 }]);
  assert.equal(state.best, 1);
});

test('climb: DOWN at the top of a ladder climbs back down; DOWN where no ladder ends does nothing', () => {
  const state = create(7, { hazards: false });
  const ladder = L.ladders[0];
  standOn(state, 1, 600);
  step(state, { down: true }, DT);
  assert.equal(state.player.mode, 'ground', 'no ladder under her here');
  standOn(state, 1, ladder.x);
  step(state, { down: true }, DT);
  assert.equal(state.player.mode, 'ladder');
  for (let i = 0; i < 300 && state.player.mode === 'ladder'; i++) step(state, { down: true }, DT);
  assert.equal(state.player.mode, 'ground');
  assert.equal(state.player.floor, 0);
  assert.equal(state.player.y, ladder.yBottom);
  assert.equal(state.best, 1, 'best floor is remembered');
});

test('climb: a ladder only starts from the floor it stands on (UP at the top end or a far-away ladder does nothing)', () => {
  const state = create(7, { hazards: false });
  standOn(state, 0, L.ladders[0].x + c('TOWER_LADDER_GRAB') + 3);
  step(state, { up: true }, DT);
  assert.equal(state.player.mode, 'ground', 'just out of reach');
  standOn(state, 1, L.ladders[0].x);
  step(state, { up: true }, DT);
  assert.equal(state.player.mode, 'ground', 'UP at the top of a ladder has nowhere to go');
});

test('climb: SPACE on a ladder jumps off (to the pressed side, or straight up) and she cannot re-grab at once', () => {
  const state = create(7, { hazards: false });
  const ladder = L.ladders[0];
  standOn(state, 0, ladder.x);
  for (let i = 0; i < 30; i++) step(state, { up: true }, DT);
  assert.equal(state.player.mode, 'ladder');
  const events = step(state, { right: true, jumpPressed: true }, DT);
  assert.ok(events.some((e) => e.type === 'jump'));
  assert.equal(state.player.mode, 'air');
  assert.ok(state.player.vx > 0, 'she hops to the right');
  step(state, { up: true }, DT);
  assert.equal(state.player.mode, 'air', 'pressing UP right after the jump does not snatch the ladder back');
  for (let i = 0; i < 100 && state.player.mode === 'air'; i++) step(state, {}, DT);
  assert.equal(state.player.mode, 'ground', 'she lands on a beam again');
});

test('floors: walking off the open end drops her to the floor below, no harm done', () => {
  const state = create(7, { hazards: false });
  const f = L.floors[2]; // rolls right: open at the right end
  standOn(state, 2, f.x1 - 10);
  for (let i = 0; i < 200 && !(state.player.mode === 'ground' && state.player.floor !== 2); i++) step(state, { right: true }, DT);
  assert.equal(state.player.mode, 'ground');
  assert.equal(state.player.floor, 1, 'she dropped one floor and the beam below caught her');
  assert.equal(state.hearts, c('TOWER_HEARTS'));
  assert.equal(state.status, 'playing');
});

test('jump feel reuses the platformer helpers: a jump pressed just before landing still fires on landing; coyote time after a ledge', () => {
  const state = create(7, { hazards: false });
  standOn(state, 1, 480);
  step(state, { jumpPressed: true }, DT);
  // fall back; press jump again about 50 ms before she touches down
  let pressed = false;
  let jumpsAfter = 0;
  for (let i = 0; i < 120; i++) {
    const p = state.player;
    const press = !pressed && p.mode === 'air' && p.vy > 0 && L.floors[1].y - p.y < 12;
    if (press) pressed = true;
    jumpsAfter += step(state, { jumpPressed: press }, DT).filter((e) => e.type === 'jump').length;
  }
  assert.equal(pressed, true);
  assert.equal(jumpsAfter, 1, 'the early press fired as a second jump on landing');
  // coyote: walk off the open end and press jump within the coyote window
  const s2 = create(7, { hazards: false });
  standOn(s2, 2, L.floors[2].x1 + c('TOWER_EDGE_SLACK') - 1);
  step(s2, { right: true }, DT); // steps off: now in the air
  assert.equal(s2.player.mode, 'air');
  const ev = step(s2, { jumpPressed: true }, DT);
  assert.ok(ev.some((e) => e.type === 'jump'), 'a jump a moment after leaving the beam still works');
  const ev2 = step(s2, { jumpPressed: true }, 300);
  assert.ok(!ev2.some((e) => e.type === 'jump'), 'but not twice in mid-air');
});

test('stepTower: a stalled frame never skips through a floor or a hazard (the step is clamped)', () => {
  const state = create(7, { hazards: false });
  standOn(state, 1, 480);
  step(state, { jumpPressed: true }, DT);
  const before = state.t;
  step(state, {}, 10000);
  assert.equal(state.t - before, c('TOWER_MAX_STEP_MS'));
  for (let i = 0; i < 100; i++) step(state, {}, 10000);
  assert.equal(state.player.mode, 'ground');
  assert.equal(state.player.floor, 1);
});

// ---------- the gargoyle: a seeded, fair schedule ----------

test('throws: seeded and deterministic, one every 2.5 to 3.5 s after the first, both barrels and pots, and a dice roll per ladder', () => {
  const a = plain(schedule(195));
  assert.deepEqual(plain(schedule(195)), a, 'the same seed gives the same throws');
  assert.notDeepEqual(plain(schedule(196)), a, 'another seed gives other throws');
  assert.ok(a.length >= 60, 'enough throws for the whole failsafe round');
  assert.equal(a[0].wait, c('TOWER_FIRST_THROW_MS'));
  assert.ok(c('TOWER_FIRST_THROW_MS') >= c('TOWER_THROW_MIN_MS'), 'a calm start');
  for (const throwAt of a.slice(1)) assert.ok(throwAt.wait >= 2500 && throwAt.wait <= 3500, `wait ${throwAt.wait}`);
  assert.deepEqual([...new Set(a.map((x) => x.kind))].sort(), ['barrel', 'pot']);
  assert.ok(a.filter((x) => x.kind === 'pot').length < a.length / 2, 'mostly barrels');
  for (const throwAt of a) {
    assert.equal(throwAt.ladderRoll.length, L.ladders.length);
    for (const r of throwAt.ladderRoll) assert.ok(r >= 0 && r < 1);
  }
  assert.ok(150000 / 3500 < a.length, '150 s of throws at the slowest rate fit in the schedule');
});

test('throws: identical rounds replay identically (the whole state is a function of the seed and the inputs)', () => {
  const run = (seed) => {
    const state = create(seed);
    const log = [];
    for (let i = 0; i < 1500; i++) {
      const input = { left: i % 90 < 30, right: i % 90 >= 60, up: i % 200 > 150, jumpPressed: i % 70 === 0 };
      log.push(...step(state, input, DT).map((e) => e.type));
    }
    return JSON.stringify([state, log]);
  };
  assert.equal(run(195), run(195));
  assert.notEqual(run(195), run(5));
});

test('throws: hazards only ever appear at the gargoyle on the top floor, never before 3 s, never on the floor she starts on', () => {
  const state = create(195);
  state.hearts = 99; // keep her alive: this is about where hazards start, not about her
  state.invulnMs = 1e9;
  const g0 = L.gargoyle;
  let firstAt = null;
  const seenIds = new Set();
  for (let i = 0; i < 4000; i++) {
    const events = step(state, {}, DT);
    for (const h of state.hazards) {
      if (seenIds.has(h.id)) continue;
      seenIds.add(h.id);
      assert.ok(Math.abs(h.x - g0.throwX) < 3, 'it starts at the gargoyle (it has rolled one step by now)');
      assert.equal(h.y, L.floors[L.topFloor].y, 'on the top floor');
      assert.equal(h.floor, L.topFloor);
      assert.notEqual(h.floor, state.player.floor, 'not on the floor she stands on (the ground floor)');
      if (firstAt === null) firstAt = state.t;
    }
    if (events.some((e) => e.type === 'throw')) assert.equal(state.sinceThrowMs, 0);
  }
  assert.ok(firstAt >= 3000 && firstAt <= 3300, `first throw at ${firstAt} ms`);
  assert.ok(seenIds.size >= 15, 'a steady stream over a minute');
});

test('throws: the gargoyle wobbles first (a windup event ahead of every throw) and waits while she stands at its feet', () => {
  const state = create(195);
  state.invulnMs = 1e9;
  const log = [];
  for (let i = 0; i < 1000; i++) for (const e of step(state, {}, DT)) log.push([e.type, state.t]);
  const windups = log.filter(([type]) => type === 'windup');
  const throws = log.filter(([type]) => type === 'throw');
  assert.ok(windups.length >= throws.length && throws.length >= 3);
  throws.forEach(([, at], i) => {
    const lead = at - windups[i][1];
    assert.ok(lead >= c('TOWER_WINDUP_MS') - 2 * DT && lead <= c('TOWER_WINDUP_MS') + 2 * DT, `throw ${i}: windup ${lead} ms ahead`);
  });
  // standing next to the gargoyle's spot on the top floor blocks the throw until she steps away
  const s2 = create(195);
  standOn(s2, L.topFloor, L.gargoyle.throwX + 10);
  s2.player.invulnMs = 0;
  for (let i = 0; i < 400; i++) step(s2, {}, DT); // 6.4 s: well past the first throw time
  assert.equal(s2.hazards.length, 0, 'nothing thrown on top of her');
  for (let i = 0; i < 400; i++) step(s2, { right: true }, DT);
  assert.ok(s2.nextThrow >= 1, 'once she walks away it throws');
});

test('throws: never two at once even after a long wait (a delayed throw pushes the next ones back), at least 2.5 s apart', () => {
  const state = create(195);
  state.invulnMs = 1e9;
  state.hearts = 99;
  standOn(state, L.topFloor, L.gargoyle.throwX); // blocks the spot for 20 s
  for (let i = 0; i < 1250; i++) step(state, {}, DT);
  assert.equal(state.hazards.length, 0);
  const times = [];
  for (let i = 0; i < 5000; i++) {
    const p = state.player;
    p.x = 700; // gone
    if (step(state, {}, DT).some((e) => e.type === 'throw')) times.push(state.t);
  }
  assert.ok(times.length >= 5);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] - times[i - 1] >= c('TOWER_THROW_MIN_MS') - DT, `throws ${i - 1}/${i} are ${times[i] - times[i - 1]} ms apart`);
});

// ---------- hazards ----------

test('hazards: slow (gentle), roll along their floor the way it flows, drop at the open end onto the next floor and roll back', () => {
  const kinds = plain(g.evaluate('TOWER_HAZARD_KINDS'));
  for (const kind of Object.values(kinds)) assert.ok(kind.speed <= 100 && kind.speed >= 50, `speed ${kind.speed} is slow, not a crawl`);
  const state = create(195, { hazards: false });
  state.hazards.push({ id: 1, kind: 'barrel', x: 400, y: L.floors[4].y, dir: 1, mode: 'roll', floor: 4, vy: 0, ladderRoll: [1, 1, 1, 1] });
  state.player.y = 9999; // out of the way
  const floorsSeen = [];
  for (let i = 0; i < 4000 && state.hazards.length; i++) {
    step(state, {}, DT);
    const h = state.hazards[0];
    if (h && h.mode === 'roll' && floorsSeen[floorsSeen.length - 1] !== h.floor) {
      floorsSeen.push(h.floor);
      assert.equal(h.dir, L.floors[h.floor].flow, `on floor ${h.floor} it rolls the way the floor flows`);
      assert.equal(h.y, L.floors[h.floor].y, 'and it sits on the beam');
    }
  }
  assert.deepEqual(floorsSeen, [4, 3, 2, 1, 0], 'it works its way down the whole tower');
  assert.equal(state.hazards.length, 0, 'and vanishes at the end of the ground floor');
});

test('hazards: only a hazard passing a ladder top may climb down it: never the first ladder, never one she is on or standing near', () => {
  const makeState = () => {
    const state = create(195, { hazards: false });
    state.player.y = 9999;
    return state;
  };
  const putHazard = (state, floor, x) => state.hazards.push({
    id: state.nextHazardId++, kind: 'barrel', x, y: L.floors[floor].y, dir: L.floors[floor].flow, mode: 'roll', floor, vy: 0, ladderRoll: [0, 0, 0, 0],
  });
  // ladder 0 (floor 1 -> 0): never, even with a winning dice roll
  let state = makeState();
  putHazard(state, 1, L.ladders[0].x + 20);
  for (let i = 0; i < 200; i++) { step(state, {}, DT); assert.ok(state.hazards.every((h) => h.mode !== 'ladder'), 'the first ladder never carries a hazard'); }
  // ladder 2 (floor 3 -> 2): a roll of 0 climbs down
  state = makeState();
  putHazard(state, 3, L.ladders[2].x + 20);
  let climbed = false;
  for (let i = 0; i < 200; i++) { step(state, {}, DT); if (state.hazards.some((h) => h.mode === 'ladder')) climbed = true; }
  assert.equal(climbed, true, 'a hazard passing the top of ladder 2 takes it');
  // ...but not while she is on that ladder
  state = makeState();
  state.player.mode = 'ladder'; state.player.ladder = 2; state.player.y = 260; state.player.x = L.ladders[2].x; state.player.floor = null;
  putHazard(state, 3, L.ladders[2].x + 20);
  for (let i = 0; i < 200; i++) { step(state, {}, DT); state.player.y = 260; state.player.mode = 'ladder'; assert.ok(state.hazards.every((h) => h.mode !== 'ladder' || h.ladderIndex !== 2), 'not onto her'); }
  // ...nor while she waits at its foot
  state = makeState();
  standOn(state, 2, L.ladders[2].x + 40);
  putHazard(state, 3, L.ladders[2].x + 20);
  for (let i = 0; i < 200; i++) { step(state, {}, DT); standOn(state, 2, L.ladders[2].x + 40); state.invulnMs = 1e9; assert.ok(state.hazards.every((h) => h.mode !== 'ladder'), 'not onto her at the foot'); }
  // and after a climb it rolls on along the floor below the way that floor flows
  state = makeState();
  putHazard(state, 3, L.ladders[2].x + 20);
  for (let i = 0; i < 300; i++) step(state, {}, DT);
  const down = state.hazards.find((h) => h.mode === 'roll' && h.floor === 2);
  assert.ok(down, 'it reached floor 2');
  assert.equal(down.dir, L.floors[2].flow);
});

// ---------- hearts, invulnerability ----------

function putHazardOnPlayer(state, kind = 'barrel') {
  const p = state.player;
  state.hazards.push({ id: state.nextHazardId++, kind, x: p.x, y: p.y, dir: -p.facing, mode: 'roll', floor: p.floor, vy: 0, ladderRoll: [1, 1, 1, 1] });
}

test('hearts: three of them; a touch costs one, breaks the hazard, and starts a short invulnerability', () => {
  assert.equal(c('TOWER_HEARTS'), 3);
  const state = create(195, { hazards: false });
  assert.equal(state.hearts, 3);
  putHazardOnPlayer(state);
  const events = step(state, {}, DT);
  assert.equal(state.hearts, 2);
  assert.ok(events.some((e) => e.type === 'hit' && e.hearts === 2));
  assert.ok(events.some((e) => e.type === 'smash'));
  assert.equal(state.hazards.length, 0);
  assert.equal(state.invulnMs > 0, true);
  assert.equal(state.status, 'playing');
  assert.equal(state.player.floor, 0, 'no knockback to the start: she stays where she was');
});

test('invulnerability: hazards pass through her for about 2 s (and are not consumed), then she can be hit again', () => {
  const state = create(195, { hazards: false });
  putHazardOnPlayer(state);
  step(state, {}, DT);
  assert.ok(c('TOWER_INVULN_MS') >= 1500 && c('TOWER_INVULN_MS') <= 2500);
  putHazardOnPlayer(state);
  step(state, {}, DT);
  assert.equal(state.hearts, 2, 'no second hit while invulnerable');
  assert.equal(state.hazards.length, 1, 'the hazard rolls on');
  state.hazards = [];
  for (let i = 0; i < Math.ceil(c('TOWER_INVULN_MS') / DT) + 3; i++) step(state, {}, DT);
  assert.equal(state.invulnMs, 0);
  putHazardOnPlayer(state);
  step(state, {}, DT);
  assert.equal(state.hearts, 1, 'hit again once it has worn off');
});

test('hearts: the third hit loses the round (a lose event, nothing more happens after); a pot hurts like a barrel', () => {
  const state = create(195, { hazards: false });
  for (let hit = 0; hit < 3; hit++) {
    state.invulnMs = 0;
    putHazardOnPlayer(state, hit === 1 ? 'pot' : 'barrel');
    const events = step(state, {}, DT);
    assert.equal(events.some((e) => e.type === 'lose'), hit === 2);
  }
  assert.equal(state.hearts, 0);
  assert.equal(state.status, 'lost');
  const t = state.t;
  assert.equal(step(state, { right: true }, DT).length, 0);
  assert.equal(state.t, t, 'a finished round stops');
});

test('a hazard that only passes close above or beside her does not hurt (the hitbox is the barrel, not the whole sprite)', () => {
  const state = create(195, { hazards: false });
  const p = state.player;
  // 40 px to the side, and one level above her head
  state.hazards.push({ id: 1, kind: 'barrel', x: p.x + 40, y: p.y, dir: -1, mode: 'roll', floor: 0, vy: 0, ladderRoll: [1, 1, 1, 1] });
  state.hazards.push({ id: 2, kind: 'barrel', x: p.x, y: p.y - 90, dir: -1, mode: 'roll', floor: 1, vy: 0, ladderRoll: [1, 1, 1, 1] });
  step(state, {}, DT);
  assert.equal(state.hearts, 3);
});

test('dodging: a standing jump timed within a window of at least 150 ms clears a rolling barrel or pot, and not jumping gets hit', () => {
  const kinds = plain(g.evaluate('TOWER_HAZARD_KINDS'));
  for (const kind of ['barrel', 'pot']) {
    let hitWithoutJump = false;
    let cleared = 0;
    for (const jumpAt of [null, ...Array.from({ length: 241 }, (_, i) => i * 10)]) {
      const state = create(195, { hazards: false });
      standOn(state, 1, 400); // floor 1 rolls left: a head-on pass
      const h = { id: 1, kind, x: 560, y: L.floors[1].y, dir: -1, mode: 'roll', floor: 1, vy: 0, ladderRoll: [1, 1, 1, 1] };
      state.hazards.push(h);
      for (let t = 0; t < 4000 && state.hazards.length && h.x > 300; t += 10) step(state, { jumpPressed: jumpAt !== null && t === jumpAt }, 10);
      if (jumpAt === null) hitWithoutJump = state.hearts < 3;
      else if (state.hearts === 3) cleared++;
    }
    assert.equal(hitWithoutJump, true, kind + ': standing still gets hit');
    assert.ok(cleared * 10 >= 150, kind + ' (speed ' + kinds[kind].speed + '): the clearing window is ' + cleared * 10 + ' ms wide');
  }
});

// ---------- the win and the failsafe ----------

test('win: reaching the prince on the top floor wins (a win event, the round stops); the same x on another floor does not', () => {
  const x = (L.winZone.x0 + L.winZone.x1) / 2;
  const state = create(195);
  standOn(state, 3, x);
  step(state, {}, DT);
  assert.equal(state.status, 'playing');
  standOn(state, L.topFloor, L.winZone.x1 + 30);
  step(state, {}, DT);
  assert.equal(state.status, 'playing', 'near the zone, not in it');
  standOn(state, L.topFloor, L.winZone.x1 - 2);
  const events = step(state, {}, DT);
  assert.equal(state.status, 'won');
  assert.deepEqual(plain(events.filter((e) => e.type === 'win')), [{ type: 'win', failsafe: false }]);
  assert.equal(step(state, { left: true }, DT).length, 0);
});

test('win: only standing counts: a jump over the prince in mid-air does not win until she is down in the zone', () => {
  const state = create(195, { hazards: false });
  standOn(state, L.topFloor, L.winZone.x1 + 20);
  state.player.mode = 'air';
  state.player.floor = null;
  state.player.y = L.floors[L.topFloor].y - 30;
  state.player.x = (L.winZone.x0 + L.winZone.x1) / 2;
  state.player.vy = -10;
  step(state, {}, DT);
  assert.equal(state.status, 'playing');
});

test('failsafe: a round that lasts past 150 s counts as a win, so nobody is ever stuck in the game', () => {
  assert.equal(c('TOWER_FAILSAFE_MS'), 150000);
  const state = create(195, { hazards: false });
  let events = [];
  for (let t = 0; t < 150000 + 200 && state.status === 'playing'; t += 40) events = step(state, {}, 40);
  assert.equal(state.status, 'won');
  assert.equal(state.failsafe, true);
  assert.ok(state.t >= 150000 && state.t <= 150040);
  assert.deepEqual(plain(events.filter((e) => e.type === 'win')), [{ type: 'win', failsafe: true }]);
  // and with the gargoyle on and a player who never moves, she loses hearts long before: also an ending
  const idle = create(195);
  let ended = 0;
  for (let t = 0; t < 160000 && idle.status === 'playing'; t += 40) { step(idle, {}, 40); ended = t; }
  assert.notEqual(idle.status, 'playing', `an idle round ends by itself (after ${ended} ms)`);
});

test('every round ends: a rule-following random player always reaches won or lost within the failsafe', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const state = create(seed);
    const rand = g.evaluate('towerRandom')(seed * 31);
    let t = 0;
    let held = {};
    while (state.status === 'playing' && t < 160000) {
      if (t % 480 === 0) held = { left: rand() < 0.3, right: rand() < 0.3, up: rand() < 0.4, down: rand() < 0.15 };
      step(state, { ...held, jumpPressed: rand() < 0.02 }, DT);
      t += DT;
    }
    assert.notEqual(state.status, 'playing', `seed ${seed} ended`);
  }
});

test('score helper: the HUD counts floors reached, 1 to 5', () => {
  const state = create(195, { hazards: false });
  assert.equal(g.evaluate('towerFloorsReached')(state), 1);
  standOn(state, 3, 400);
  assert.equal(g.evaluate('towerFloorsReached')(state), 4);
});

// ---------- the scene and its art (source assertions: Phaser is not available here) ----------

test('tower scene: built on the shared shell, steps the pure state, ends its closing beat by itself, and never moves the camera', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'tower.js'), 'utf8');
  assert.match(src, /class TowerScene extends MinigameBaseScene/);
  assert.match(src, /super\('minigame-tower'\)/);
  assert.match(src, /createTowerState\(TW_SEED\)/);
  assert.match(src, /stepTower\(this\.tw, input, delta\)/);
  assert.match(src, /this\.mgState === 'playing' && !this\.beat/, 'SPACE is gated on playing (FB-0042: the confirming press must not jump)');
  assert.match(src, /case 'lose':\s*this\.lose\(\);/);
  assert.match(src, /TW_BEAT_END_MS && !this\.finished\) \{\s*this\.beat = null;\s*this\.win\(\);/, 'the beat hands over to the framework win card by itself');
  assert.doesNotMatch(src, /startFollow|scrollX\s*=/);
  assert.doesNotMatch(src, /delayedCall/, 'no timers that could fire after the scene is gone: everything runs off the frame clock');
  const beatEnd = Number(/TW_BEAT_END_MS = (\d+)/.exec(src)[1]);
  assert.ok(beatEnd >= 1500 && beatEnd <= 3500, `the closing beat is ${beatEnd} ms`);
  // the sprite frames the scene uses all exist in the generated sheet (8 columns x 3 rows of 32 px cells)
  const frames = new Function(`return ${/const TW_FRAME = (\{[\s\S]*?\n\});/.exec(src)[1]}`)();
  const flat = Object.values(frames).flat();
  assert.ok(Math.max(...flat) < 24, 'every frame is inside the 8 x 3 sheet');
  assert.equal(new Set(flat).size, flat.length, 'no two sprites share a frame');
  assert.equal(frames.chameleon.length, 3, 'the chameleon has green, pink, green');
});

test('tower art: the generator wrote the backdrop, the sprite sheet and the prince at the sizes the scene loads them at', () => {
  const size = (file) => { const b = fs.readFileSync(path.join(ROOT, 'assets', 'minigames', file)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(size('tower-bg.png'), [480, 270], 'half scale: the scene stretches it 2x to 960x540');
  assert.deepEqual(size('tower-sprites.png'), [256, 96]);
  assert.deepEqual(size('tower-prince.png'), [64, 24]);
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'tower.js'), 'utf8');
  assert.match(src, /assets\/minigames\/tower-bg\.png/);
  assert.match(src, /assets\/minigames\/tower-sprites\.png/);
  assert.match(src, /assets\/minigames\/tower-prince\.png/);
});
