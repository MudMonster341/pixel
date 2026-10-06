// "EDI Madness", the ICL scanner's garage-parking game (decisions/0025, src/minigames/edi-logic.js): the pure rules, driven headless. The
// Phaser scene (phase E3) will only draw this state, so these tests are the game: the car physics, the rotated-rectangle collision, the
// bump / scrape rule, parked detection, the three stages as data, the time limits and the failsafe, and the instructor's lines. A scripted
// reference driver (below, working from the state only) PARKS every stage well inside the time limit, so no stage is unwinnable.
// If a stage's geometry is tuned in phase E5, the driver's plan for it (edi plans, below) is the thing to adjust, never the assertions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

const g = loadGameData();
const c = (name) => g.evaluate(name); // a constant or function by name
const STAGES = c('EDI_STAGES');
const create = c('createEdiParking');
const step = c('stepEdiParking');
const nextStage = c('ediNextStage');
const retryStage = c('ediRetryStage');
const line = c('ediInstructorLine');
const carHits = c('ediCarHitsStage');
const obstacleBoxes = c('ediObstacleBoxes');
const sat = c('ediSat');
const diff = c('ediAngleDiff');
const parkedPose = c('ediCarParkedPose');
const DT = 16;
const FWD = c('EDI_MAX_FWD');
const REV = c('EDI_MAX_REV');
const CAR_LEN = c('EDI_CAR_LEN');
const CAR_WID = c('EDI_CAR_WID');
const HALF_PI = Math.PI / 2;
const deg = (d) => (d * Math.PI) / 180;
const clone = (s) => JSON.parse(JSON.stringify(s));

function run(state, input, ms, dt = DT) {
  const events = [];
  for (let t = 0; t < ms && state.status === 'playing'; t += dt) events.push(...plain(step(state, typeof input === 'function' ? input(state) : input, dt)));
  return events;
}

// ---------- the reference driver: pure pursuit on the REAR AXLE along a polyline, from the state only ----------
// (the model's centre is mid-wheelbase, so the rear axle is 14 px behind it; reversing uses the same point with the steering sign flipped).
// A plan is a list of segments { gear: 'f' | 'r', speed, pts }: it drives one to its end, stops, then switches gear for the next.
const lineTo = (p, q, n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 8))) => Array.from({ length: n + 1 }, (_, i) => ({ x: p.x + ((q.x - p.x) * i) / n, y: p.y + ((q.y - p.y) * i) / n }));
const arcTo = (m, R, a0, a1) => {
  const n = Math.max(1, Math.ceil((Math.abs(a1 - a0) * R) / 6));
  return Array.from({ length: n + 1 }, (_, i) => ({ x: m.x + R * Math.cos(a0 + ((a1 - a0) * i) / n), y: m.y + R * Math.sin(a0 + ((a1 - a0) * i) / n) }));
};
const polyline = (...parts) => parts.flat();

function makeDriver(segs) {
  const L = c('EDI_WHEELBASE');
  let si = 0, k = 0, acc = 0;
  return (s) => {
    const car = s.car;
    const rear = { x: car.x - (L / 2) * Math.cos(car.heading), y: car.y - (L / 2) * Math.sin(car.heading) };
    if (si >= segs.length) return { handbrake: true };
    const seg = segs[si], pts = seg.pts, rev = seg.gear === 'r', end = pts[pts.length - 1];
    if ((rev && car.speed > 0.5) || (!rev && car.speed < -0.5)) return { handbrake: true }; // stop before changing gear
    const dEnd = Math.hypot(end.x - rear.x, end.y - rear.y);
    if (dEnd < 6 && k >= pts.length - 3) { si++; k = 0; acc = 0; return { handbrake: true }; }
    const dist = (p) => Math.hypot(p.x - rear.x, p.y - rear.y);
    while (k < pts.length - 1 && dist(pts[k + 1]) <= dist(pts[k])) k++;
    let j = k;
    while (j < pts.length - 1 && dist(pts[j]) < 36) j++; // the look-ahead point
    const alpha = diff(Math.atan2(pts[j].y - rear.y, pts[j].x - rear.x), rev ? car.heading + Math.PI : car.heading);
    const steer = Math.atan((2 * L * Math.sin(alpha)) / (dist(pts[j]) || 1)) * (rev ? -1 : 1);
    const lock = c('EDI_MAX_STEER') * (1 - c('EDI_STEER_SPEED_FALLOFF') * Math.min(1, Math.abs(car.speed) / FWD));
    acc += Math.max(-1, Math.min(1, steer / lock)); // the keys are on/off: a steering FRACTION is a share of the frames
    const input = {};
    if (acc > 0.5) { input.right = true; acc -= 1; } else if (acc < -0.5) { input.left = true; acc += 1; }
    const target = Math.min(seg.speed, 8 + 1.3 * dEnd), sp = Math.abs(car.speed);
    if (sp < target) { if (rev) input.brake = true; else input.gas = true; } else if (sp > target + 6) { if (rev) input.gas = true; else input.brake = true; }
    return input;
  };
}

// The plans. Bays are all on the top wall, long axis vertical, nose up (heading -90 degrees) or tail up; the rear axle ends 14 px behind the centre.
const bayX = (stage) => stage.bay.x + stage.bay.w / 2;
const PLANS = [
  (st) => { // 1: forward, a left turn into the bay
    const R = 62, bx = bayX(st), y = st.start.y;
    return [{ gear: 'f', speed: 44, pts: polyline(lineTo({ x: st.start.x - 14, y }, { x: bx - R, y }), arcTo({ x: bx - R, y: y - R }, R, HALF_PI, 0), lineTo({ x: bx, y: y - R }, { x: bx, y: st.bay.y + 42 })) }];
  },
  (st) => { // 2: drive past the bay along the aisle, then back in on a quarter circle and straight
    const R = 62, bx = bayX(st), y0 = 168;
    return [
      { gear: 'f', speed: 44, pts: polyline(lineTo({ x: st.start.x - 14, y: st.start.y }, { x: 300, y: y0 }), lineTo({ x: 300, y: y0 }, { x: bx + R, y: y0 })) },
      { gear: 'r', speed: 30, pts: polyline(arcTo({ x: bx + R, y: y0 - R }, R, HALF_PI, Math.PI), lineTo({ x: bx, y: y0 - R }, { x: bx, y: st.bay.y + 14 })) },
    ];
  },
  (st) => { // 3: east under the divider, north through the gap by the pillar, west along the upper aisle, then north into the bay between the pillars
    const R = 62, yl = st.start.y, xc = 602, y1 = 270, bx = bayX(st), yu = y1 - R, P = Math.PI;
    return [{ gear: 'f', speed: 44, pts: polyline(
      lineTo({ x: st.start.x - 14, y: yl }, { x: xc - R, y: yl }), arcTo({ x: xc - R, y: yl - R }, R, HALF_PI, 0), lineTo({ x: xc, y: yl - R }, { x: xc, y: y1 }),
      arcTo({ x: xc - R, y: y1 }, R, 0, -HALF_PI), lineTo({ x: xc - R, y: yu }, { x: bx + R, y: yu }),
      arcTo({ x: bx + R, y: yu - R }, R, HALF_PI, P), lineTo({ x: bx, y: yu - R }, { x: bx, y: st.bay.y + 42 })) }];
  },
];

function driveStage(state, maxMs = c('EDI_STAGE_LIMIT_MS')) {
  const driver = makeDriver(PLANS[state.stageIndex](STAGES[state.stageIndex]));
  const events = [];
  while (state.status === 'playing' && state.t < maxMs) events.push(...plain(step(state, driver(state), DT)));
  return events;
}

// ---------- the stages as data ----------

test('EDI stages: three of them, as data, each with a start pose, a bay, obstacles inside the 960x540 arena, a 75 s limit and a unique id', () => {
  assert.equal(STAGES.length, 3);
  assert.equal(c('EDI_STAGE_COUNT'), 3);
  assert.equal(c('EDI_STAGE_LIMIT_MS'), 75000);
  assert.equal(c('EDI_FAILSAFE_MS'), 150000);
  assert.equal(new Set(STAGES.map((s) => s.id)).size, 3);
  for (const s of STAGES) {
    assert.ok(s.name && s.id, 'named');
    assert.equal(s.limitMs, c('EDI_STAGE_LIMIT_MS'));
    assert.equal(s.anyDirection, true, `${s.id}: nose-in or reverse-in both count`);
    assert.ok(s.start.x > 0 && s.start.x < 960 && s.start.y > 0 && s.start.y < 540 && typeof s.start.heading === 'number');
    assert.ok(Array.isArray(s.arrows) && s.arrows.every((a) => typeof a.x === 'number' && typeof a.y === 'number' && typeof a.angle === 'number'));
    for (const o of s.obstacles) {
      assert.ok(['wall', 'pillar', 'car'].includes(o.kind), `${s.id}: obstacle kind ${o.kind}`);
      assert.ok(o.w > 0 && o.h > 0);
      if (!o.angle) assert.ok(o.x >= 0 && o.y >= 0 && o.x + o.w <= 960 && o.y + o.h <= 540, `${s.id}: ${o.kind} inside the arena`);
    }
    // the bay is a rectangle with its long side along the axis, big enough for the car with the tolerance, and inside the arena
    assert.ok(s.bay.x >= 0 && s.bay.y >= 0 && s.bay.x + s.bay.w <= 960 && s.bay.y + s.bay.h <= 540);
    assert.ok(Math.max(s.bay.w, s.bay.h) >= CAR_LEN && Math.min(s.bay.w, s.bay.h) >= CAR_WID);
  }
  assert.ok(STAGES[2].obstacles.filter((o) => o.kind === 'pillar').length >= 2 && STAGES[2].obstacles.filter((o) => o.kind === 'pillar').length <= 3 + 0, 'the garage has two or three pillars');
  assert.ok(STAGES[2].arrows.length >= 1, 'the garage has a one-way arrow');
  assert.ok(STAGES[1].obstacles.filter((o) => o.kind === 'car').length >= 2, 'stage 2 has parked cars beside the bay');
});

test('EDI stages: the start pose is collision-free, the car fits the bay at either heading along its axis, and nothing stands in the bay', () => {
  for (const s of STAGES) {
    assert.equal(carHits(s, s.start), false, `${s.id}: start pose is free`);
    const bay = { x: s.bay.x + s.bay.w / 2, y: s.bay.y + s.bay.h / 2 };
    for (const heading of [s.bay.axis, s.bay.axis + Math.PI]) {
      const pose = { ...bay, heading };
      assert.equal(carHits(s, pose), false, `${s.id}: the parked pose is free`);
      assert.equal(parkedPose(s, pose), true, `${s.id}: the centred pose counts as parked (heading ${heading.toFixed(2)})`);
    }
    assert.equal(parkedPose(s, { ...s.start, speed: 0 }), false, `${s.id}: she does not start parked`);
  }
});

// Every lane is at least 1.6 car widths: a disc of that diameter (the car's width x 1.6) can roll from the start to the bay's centre without
// touching anything (a flood fill on a 4 px grid over the obstacle boxes).
function discReaches(stage, radius, from, to) {
  const boxes = obstacleBoxes(stage).map(plain);
  const free = (x, y) => {
    if (x < radius || y < radius || x > 960 - radius || y > 540 - radius) return false;
    return boxes.every((b) => {
      const dx = x - b.cx, dy = y - b.cy;
      const lx = Math.abs(dx * b.c + dy * b.s), ly = Math.abs(-dx * b.s + dy * b.c);
      return Math.hypot(Math.max(lx - b.hw, 0), Math.max(ly - b.hh, 0)) >= radius;
    });
  };
  const G = 4, key = (x, y) => `${x},${y}`;
  const gx = Math.round(from.x / G), gy = Math.round(from.y / G);
  const seen = new Set([key(gx, gy)]), queue = [[gx, gy]];
  if (!free(gx * G, gy * G)) return false;
  while (queue.length) {
    const [x, y] = queue.pop();
    if (Math.hypot(x * G - to.x, y * G - to.y) <= G) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (seen.has(key(nx, ny)) || !free(nx * G, ny * G)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return false;
}

test('EDI stages: every lane from the start to the bay is at least 1.6 car widths wide (and a 96 px disc cannot, so the test can fail)', () => {
  for (const s of STAGES) {
    const from = { x: s.start.x, y: s.start.y };
    const to = { x: s.bay.x + s.bay.w / 2, y: s.bay.y + s.bay.h / 2 };
    assert.equal(discReaches(s, (1.6 * CAR_WID) / 2, from, to), true, `${s.id}: reachable with 1.6 car widths of clearance`);
  }
  // the checker is not vacuous: a fat disc (wider than the bay's gap between its neighbours) is stopped on every stage
  for (const s of STAGES) {
    assert.equal(discReaches(s, 48, { x: s.start.x, y: s.start.y }, { x: s.bay.x + s.bay.w / 2, y: s.bay.y + s.bay.h / 2 }), false, `${s.id}: a disc of 96 px cannot reach the bay`);
  }
});

// ---------- the reference driver parks every stage ----------

test('EDI driver: the scripted reference driver parks every stage, well inside the time limit, without losing a heart', () => {
  for (let i = 0; i < 3; i++) {
    const s = create(i);
    const events = driveStage(s);
    assert.ok(['stageWon', 'won'].includes(s.status), `stage ${i + 1}: parked (status ${s.status}, car ${s.car.x.toFixed(0)},${s.car.y.toFixed(0)}, ${((s.car.heading * 180) / Math.PI).toFixed(0)} deg)`);
    assert.equal(s.hearts, 3, `stage ${i + 1}: no heart lost`);
    assert.ok(s.t < 45000, `stage ${i + 1}: parked in ${s.t} ms, under 60 % of the limit`);
    assert.equal(s.status, i === 2 ? 'won' : 'stageWon');
    assert.equal(events.filter((e) => e.type === 'parked').length, 1);
    assert.equal(events.some((e) => e.type === 'bump'), false);
    assert.equal(s.parkProgress, 1);
  }
});

test('EDI driver: stage 2 really needs the reverse gear or a turn-round (the driver backs in), and stage 1 parks nose-in', () => {
  const s = create(1);
  let reversed = false;
  const driver = makeDriver(PLANS[1](STAGES[1]));
  while (s.status === 'playing' && s.t < 75000) {
    step(s, driver(s), DT);
    if (s.car.speed < -5) reversed = true;
  }
  assert.equal(s.status, 'stageWon');
  assert.ok(reversed);
  const diffToAxis = Math.abs(diff(s.car.heading, STAGES[1].bay.axis));
  assert.ok(diffToAxis > Math.PI - c('EDI_PARK_ANGLE') - 1e-9, 'backed in: the nose points out of the bay (the opposite of the axis)');
  const one = create(0);
  driveStage(one);
  assert.ok(Math.abs(diff(one.car.heading, STAGES[0].bay.axis)) <= c('EDI_PARK_ANGLE'), 'stage 1: nose in');
});

test('EDI driver: the three stages in a row make one attempt: the clock carries over, the status ends "won" (not a failsafe) well under 150 s', () => {
  let s = create(0, { name: 'Mina' });
  let total = 0;
  for (let i = 0; i < 3; i++) {
    assert.equal(s.stageIndex, i);
    assert.equal(s.attemptMs, total, 'the attempt clock carries over into the next stage');
    driveStage(s);
    total = s.attemptMs;
    assert.equal(c('ediStagesParked')(s), i + 1);
    if (i < 2) { assert.equal(s.status, 'stageWon'); s = nextStage(s); assert.equal(s.playerName, 'Mina'); assert.equal(s.hearts, 3); assert.equal(s.t, 0); }
  }
  assert.equal(s.status, 'won');
  assert.equal(s.failsafe, false);
  assert.equal(nextStage(s), null, 'nothing after stage 3');
  assert.ok(total < 120000, `a whole attempt in ${total} ms`);
});

// ---------- losing: a car that only holds gas, one that sits still ----------

test('EDI loss: a car that only holds gas into the nearest wall loses a heart on the first hard hit, then sits against it, and the stage still ends (time)', () => {
  const s = create(0);
  const events = run(s, { gas: true }, 200000);
  assert.ok(s.bumps >= 1 && s.hearts < 3, 'the first hit costs a heart');
  assert.ok(events.some((e) => e.type === 'bump'));
  assert.equal(s.status, 'lost', 'it never hangs');
  assert.ok(['hearts', 'time'].includes(s.reason));
  assert.ok(s.t <= c('EDI_STAGE_LIMIT_MS') + DT);
  assert.equal(carHits(STAGES[0], s.car), false, 'it never ends up inside the wall');
  assert.ok(s.car.x < 960 - 32, 'it did not drive through the wall');
});

test('EDI loss: a car that rams the wall again and again runs out of hearts: status "lost", reason "hearts", events bump 2, 1, 0 then lost', () => {
  const s = create(0);
  s.car.x = 700;
  const bot = (st) => ((st.t % 3200) < 1600 ? { gas: true } : { brake: true }); // forward, back off, forward again...
  const events = run(s, bot, 60000);
  const bumps = events.filter((e) => e.type === 'bump');
  assert.deepEqual(bumps.map((e) => e.heartsLeft), [2, 1, 0]);
  assert.equal(s.status, 'lost');
  assert.equal(s.reason, 'hearts');
  assert.equal(s.hearts, 0);
  assert.deepEqual(events.filter((e) => e.type === 'lost').map((e) => e.reason), ['hearts']);
  assert.ok(s.t < 60000);
});

test('EDI loss: a car that sits still hits the stage timeout at 75 s: status "lost", reason "time", one timeout event, and the stage can be retried', () => {
  const s = create(1);
  const events = run(s, {}, 100000);
  assert.equal(s.status, 'lost');
  assert.equal(s.reason, 'time');
  assert.equal(s.t, 75000);
  assert.equal(events.filter((e) => e.type === 'timeout').length, 1);
  assert.deepEqual(events.filter((e) => e.type === 'lost').map((e) => e.reason), ['time']);
  assert.equal(step(s, { gas: true }, DT).length, 0, 'a finished stage stays finished');
  const again = retryStage(s);
  assert.equal(again.stageIndex, 1);
  assert.equal(again.status, 'playing');
  assert.equal(again.hearts, 3);
  assert.equal(again.t, 0);
  assert.equal(again.attemptMs, 0, 'a retry is a new attempt');
  assert.equal(again.car.x, STAGES[1].start.x);
});

test('EDI failsafe: an attempt that has lasted 150 s counts as won with failsafe true (the soft-lock guard), a normal stage does not', () => {
  const s = create(2, { attemptMs: 149980 });
  const events = run(s, {}, 100);
  assert.equal(s.status, 'won');
  assert.equal(s.failsafe, true);
  assert.deepEqual(events.filter((e) => e.type === 'win'), [{ type: 'win', failsafe: true }]);
  const t = create(0, { attemptMs: 140000 });
  run(t, {}, 5000);
  assert.equal(t.status, 'playing');
  assert.equal(t.failsafe, false);
  const normal = create(0);
  run(normal, {}, 75000);
  assert.equal(normal.failsafe, false);
  assert.equal(normal.status, 'lost');
  // the failsafe is checked before the stage timeout: a stage that is out of time AND an attempt that is out of time is a win
  const both = create(0, { attemptMs: 149995 });
  both.t = 74999;
  run(both, {}, 100);
  assert.equal(both.status, 'won');
});

// ---------- determinism, the fixed step, a stalled frame ----------

test('EDI step: deterministic (the same inputs give the same result), independent of the frame rate, and a stalled frame is clamped', () => {
  const a = create(2), b = create(2);
  const da = makeDriver(PLANS[2](STAGES[2])), db = makeDriver(PLANS[2](STAGES[2]));
  while (a.status === 'playing') step(a, da(a), DT);
  while (b.status === 'playing') step(b, db(b), DT);
  assert.deepEqual(clone(a), clone(b));
  // the same keys over the same time: 16 ms frames, 40 ms frames and 8 ms frames give the very same drive
  const frames = (dt) => { const s = create(0); run(s, { gas: true, right: true }, 2000, dt); return clone(s.car); };
  assert.deepEqual(frames(16), frames(40));
  assert.deepEqual(frames(8), frames(40));
  const slow = create(0);
  step(slow, { gas: true }, 5000);
  assert.ok(slow.t <= c('EDI_MAX_STEP_MS'), 'a 5 s stall advances at most one clamped frame');
  const zero = create(0);
  assert.deepEqual(plain(step(zero, { gas: true }, 0)), []);
  assert.equal(zero.t, 0);
});

test('EDI source: no Phaser, no randomness, EDI_-prefixed constants, registered in index.html and in the test loader, under 700 lines', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'minigames', 'edi-logic.js'), 'utf8');
  assert.ok(!/Math\.random|Phaser|this\.scene|document\.|window\./.test(src.replace(/\/\/.*$/gm, '')));
  assert.ok(src.split('\n').length < 700);
  const consts = [...src.matchAll(/^const ([A-Za-z_]\w*)/gm)].map((m) => m[1]);
  assert.ok(consts.every((n) => /^(EDI_|edi)/.test(n)), `all top-level names start with EDI_ / edi: ${consts.filter((n) => !/^(EDI_|edi)/.test(n))}`);
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(html.includes('src/minigames/edi-logic.js'));
  assert.ok(html.indexOf('edi-logic.js') < html.indexOf('src/scenes/world.js'), 'loaded with the other pure files, before the scenes');
  assert.ok(fs.readFileSync(path.join(ROOT, 'tests', 'helpers', 'game-data.js'), 'utf8').includes('src/minigames/edi-logic.js'));
  assert.equal(fs.existsSync(path.join(ROOT, 'src', 'minigames', 'edi.js')), false, 'the scene is phase E3');
});

// ---------- physics ----------

test('EDI physics: gas accelerates at about 120 px/s^2 up to 70 px/s; brake at a standstill reverses, up to 38 px/s; both are slow on purpose', () => {
  const s = create(0);
  run(s, { gas: true }, 500);
  assert.ok(Math.abs(s.car.speed - 60) < 3, `after 0.5 s: ${s.car.speed}`);
  run(s, { gas: true }, 3000);
  assert.equal(s.car.speed, FWD);
  assert.ok(FWD / 32 > 2 && FWD / 32 < 2.4, 'about 2.2 tiles/s');
  const r = create(0);
  r.car.x = 800;
  r.car.heading = 0;
  const x0 = r.car.x;
  run(r, { brake: true }, 3000);
  assert.equal(r.car.speed, -REV);
  assert.ok(REV / 32 > 1.1 && REV / 32 < 1.3, 'about 1.2 tiles/s');
  assert.ok(r.car.x < x0 - 50, 'reversing moves the car backwards (against its heading)');
});

test('EDI physics: gas while rolling backwards brakes first (never a jump to forward), brake while rolling forward stops before reversing, and with no key friction slows the car', () => {
  const s = create(0);
  s.car.speed = -30;
  const speeds = [];
  for (let i = 0; i < 60; i++) { step(s, { gas: true }, DT); speeds.push(s.car.speed); }
  assert.ok(speeds.every((v, i) => i === 0 || v >= speeds[i - 1]), 'rises steadily');
  const firstZero = speeds.findIndex((v) => v >= 0);
  assert.ok(firstZero >= 0 && firstZero <= 10, 'braked to zero in about 140 ms');
  assert.equal(speeds[firstZero], 0, 'it stops AT zero first');
  assert.ok(speeds[59] > 0, 'then it drives forward');
  const f = create(0);
  f.car.speed = 40;
  const fs2 = [];
  for (let i = 0; i < 80; i++) { step(f, { brake: true }, 8); fs2.push(f.car.speed); }
  assert.ok(Math.abs(fs2[0] - (40 - 220 * 0.008)) < 1e-9, 'braking from 40 px/s starts at 220 px/s^2');
  assert.ok(fs2.some((v) => v === 0) && fs2[79] < 0, 'it passes through a standstill and then reverses');
  const roll = create(0);
  roll.car.speed = 40;
  run(roll, {}, 300);
  assert.ok(roll.car.speed < 40 && roll.car.speed > 0, 'rolling friction slows it gently');
  run(roll, {}, 3000);
  assert.equal(roll.car.speed, 0);
});

test('EDI physics: the handbrake stops hard (from full speed in about 100 ms and under 8 px) and gas does not fight it', () => {
  const s = create(0);
  s.car.speed = FWD;
  const x0 = s.car.x;
  run(s, { handbrake: true, gas: true }, 160);
  assert.equal(s.car.speed, 0);
  assert.ok(s.car.x - x0 < 8, `stopped in ${s.car.x - x0} px`);
});

test('EDI physics: the car only turns while it moves; the steering wheel eases (no snap); right turns clockwise forwards and the other way in reverse; slower speeds steer sharper', () => {
  const s = create(0);
  const { x, y, heading } = s.car;
  step(s, { right: true }, 8);
  const lock = c('EDI_MAX_STEER');
  assert.ok(s.car.steer > 0 && s.car.steer < lock * 0.2, `one tick of steering is only the start of the swing (${s.car.steer})`);
  run(s, { right: true }, 2000);
  assert.ok(Math.abs(s.car.steer - lock) < 1e-6, 'it reaches full lock at standstill');
  assert.deepEqual([s.car.x, s.car.y, s.car.heading], [x, y, heading], 'a standing car does not turn or move');
  run(s, { right: false }, 1000);
  assert.ok(Math.abs(s.car.steer) < lock * 0.01, 'the wheel eases back to centre when the key is released');
  const fwd = create(0);
  fwd.car.speed = 30;
  run(fwd, { right: true, gas: true }, 500);
  assert.ok(fwd.car.heading > 0.2, 'forward + right turns clockwise (heading grows, y is down)');
  const back = create(0);
  back.car.speed = -30;
  back.car.x = 700;
  run(back, { right: true, brake: true }, 500);
  assert.ok(back.car.heading < -0.1, 'reverse + right swings the other way, as a real car does');
  const curvature = (speed) => { // heading change per px driven, holding the speed at full lock
    const k = create(0);
    k.car.x = 480; k.car.y = 270;
    let dist = 0;
    for (let i = 0; i < 100; i++) { k.car.speed = speed; const before = { x: k.car.x, y: k.car.y }; step(k, { right: true }, DT); dist += Math.hypot(k.car.x - before.x, k.car.y - before.y); }
    return Math.abs(k.car.heading) / dist;
  };
  assert.ok(curvature(10) > curvature(70) * 1.2, 'less lock at full speed: the car turns wider when it is fast');
  // the tightest circle: a car at full lock and a crawl turns round in a circle about 100 px wide (2 to 3 car lengths)
  const circle = create(0);
  circle.car.x = 480; circle.car.y = 270; circle.car.speed = 10; circle.car.heading = 0;
  let minX = 1e9, maxX = -1e9, turned = 0, prev = 0;
  for (let i = 0; i < 2400; i++) {
    step(circle, { right: true, gas: false }, DT);
    circle.car.speed = 10; // hold a crawl
    turned += diff(circle.car.heading, prev); prev = circle.car.heading;
    minX = Math.min(minX, circle.car.x); maxX = Math.max(maxX, circle.car.x);
  }
  assert.ok(turned > Math.PI * 2, 'it goes round');
  assert.ok(maxX - minX < 3 * CAR_LEN, `the turning circle is ${(maxX - minX).toFixed(0)} px wide`);
  assert.ok(maxX - minX > 2 * CAR_LEN, 'but not unrealistically tight');
});

// ---------- collision ----------

test('EDI collision: SAT of oriented boxes finds the minimum translation vector, also for rotated boxes (a parked car may be rotated), and is symmetric', () => {
  const box = (cx, cy, hw, hh, a) => ({ cx, cy, hw, hh, c: Math.cos(a), s: Math.sin(a) });
  const a = box(0, 0, 22, 11, 0);
  assert.equal(sat(a, box(100, 0, 22, 11, 0)), null, 'apart');
  const m = plain(sat(a, box(40, 0, 22, 11, 0)));
  assert.ok(Math.abs(m.depth - 4) < 1e-9 && m.nx === -1 && Math.abs(m.ny) < 1e-9, 'a overlaps b by 4 px along x; the normal points from b to a');
  const n = plain(sat(box(40, 0, 22, 11, 0), a));
  assert.ok(Math.abs(n.depth - 4) < 1e-9 && n.nx === 1, 'swapped: the normal flips');
  // a box turned 45 degrees: its corner reaches 11 * sqrt(2) = 15.6 px; the diamond's corner poking at the car's long side
  const diamond = box(0, 11 + 10, 11, 11, Math.PI / 4);
  assert.ok(sat(a, diamond), 'the rotated corner overlaps');
  const free = box(0, 11 + 15.6 + 0.5, 11, 11, Math.PI / 4);
  assert.equal(sat(a, free), null, 'just clear of the corner');
  const d = plain(sat(a, box(0, -(11 + 11 * Math.SQRT2 - 3), 11, 11, Math.PI / 4)));
  assert.ok(Math.abs(d.depth - 3) < 1e-6 && Math.abs(d.ny - 1) < 1e-6, 'a corner 3 px in pushes the other way');
  // the same rectangle given as a turned obstacle works: a parked car at 90 degrees is a 22 x 44 upright box
  const upright = plain(obstacleBoxes({ obstacles: [{ kind: 'car', x: 100, y: 100, w: 44, h: 22, angle: HALF_PI }] })[0]);
  assert.ok(Math.abs(upright.cx - 122) < 1e-9 && Math.abs(upright.cy - 111) < 1e-9 && Math.abs(upright.s - 1) < 1e-9);
});

// A pose in front of stage 3's lone pillar (x 662..690, y 300..328), the car facing it, ready to be hit.
function facingPillar(speed, dtGap = 0.3) {
  const s = create(2);
  const pillar = STAGES[2].obstacles.find((o) => o.kind === 'pillar' && o.x === 662);
  s.car.x = pillar.x - CAR_LEN / 2 - dtGap;
  s.car.y = pillar.y + pillar.h / 2;
  s.car.heading = 0;
  s.car.speed = speed;
  return { s, pillar };
}

test('EDI bump: at 25 px/s into an obstacle or more it costs one heart (event bump with heartsLeft), below that it is a scrape: the car just stops, no heart', () => {
  assert.equal(c('EDI_BUMP_SPEED'), 25);
  const hit = (speed) => { const { s } = facingPillar(speed); const events = run(s, {}, 100); return { s, events: events.filter((e) => e.type !== 'line') }; };
  const hard = hit(27);
  assert.equal(hard.s.hearts, 2);
  assert.equal(hard.events[0].type, 'bump');
  assert.equal(hard.events[0].heartsLeft, 2);
  assert.equal(hard.s.car.speed, 0);
  const soft = hit(24);
  assert.equal(soft.s.hearts, 3, 'a gentle touch costs nothing');
  assert.deepEqual(soft.events.map((e) => e.type), ['scrape']);
  assert.equal(soft.s.car.speed, 0, 'the car just stops against it');
  assert.equal(soft.s.scrapes, 1);
  const barely = hit(4);
  assert.equal(barely.s.hearts, 3);
  assert.deepEqual(barely.events, [], 'a touch under 6 px/s is silent');
  assert.equal(carHits(STAGES[2], hard.s.car), false);
  assert.equal(carHits(STAGES[2], soft.s.car), false);
});

test('EDI bump: after a bump there are 1000 ms of invulnerability and a small push-back; a second hit inside the window is free, one after it costs a heart', () => {
  assert.equal(c('EDI_INVULN_MS'), 1000);
  const { s, pillar } = facingPillar(60);
  const front = () => pillar.x - (s.car.x + CAR_LEN / 2);
  run(s, {}, 40);
  assert.equal(s.hearts, 2);
  assert.ok(s.invulnMs > 900 && s.invulnMs <= 1000);
  assert.ok(front() > 0.5 && front() <= c('EDI_PUSHBACK_PX') + 1.1, `pushed back ${front().toFixed(1)} px`);
  s.car.speed = 60;
  const early = run(s, {}, 100).filter((e) => e.type === 'bump');
  assert.equal(early.length, 0);
  assert.equal(s.hearts, 2, 'a hit inside the window is free');
  assert.equal(s.car.speed, 0, 'but the pillar still stops the car');
  run(s, {}, 1000);
  assert.equal(s.invulnMs, 0);
  s.car.speed = 60;
  const late = run(s, {}, 100).filter((e) => e.type === 'bump');
  assert.equal(late.length, 1);
  assert.equal(late[0].heartsLeft, 1);
  assert.equal(s.hearts, 1);
});

test('EDI bump: hitting a ROTATED parked car works the same way (the car stops, a bump is a heart) and nothing penetrates it', () => {
  const stage = { ...clone(STAGES[0]), obstacles: [...clone(STAGES[0].obstacles), { kind: 'car', x: 400, y: 300, w: 44, h: 22, angle: deg(30) }] };
  const s = create(0, { stage });
  s.car.x = 300; s.car.y = 311; s.car.heading = 0; s.car.speed = 40;
  const events = run(s, { gas: true }, 3000);
  assert.ok(events.some((e) => e.type === 'bump'));
  assert.equal(carHits(stage, s.car), false, 'the pushed-out car is free of the rotated box');
  assert.ok(s.car.x < 400);
});

test('EDI collision: no tunnelling at maximum speed with 16 ms or 40 ms frames (thin pillars, walls and parked cars) and a random-ish drive never ends inside anything', () => {
  for (const dt of [16, 40]) {
    // a pillar (28 px) and the wall end, head on
    const { s, pillar } = facingPillar(FWD, 20);
    for (let i = 0; i < 400; i++) {
      step(s, { gas: true }, dt);
      assert.equal(carHits(STAGES[2], s.car), false, `dt ${dt}: never overlapping a pillar`);
      assert.ok(s.car.x + CAR_LEN / 2 <= pillar.x + 0.5, `dt ${dt}: still west of the pillar`);
    }
    // a rotated-by-90 parked car (stage 2's row), from below
    const r = create(1);
    r.car.x = 446; r.car.y = 200; r.car.heading = -HALF_PI; r.car.speed = FWD;
    for (let i = 0; i < 400; i++) {
      step(r, { gas: true }, dt);
      assert.equal(carHits(STAGES[1], r.car), false);
      assert.ok(r.car.y - CAR_LEN / 2 >= 85.5, `dt ${dt}: did not enter the parked car (nose y ${r.car.y - CAR_LEN / 2})`);
    }
    // the east wall at full speed
    const w = create(0);
    w.car.x = 800; w.car.y = 300; w.car.speed = FWD;
    for (let i = 0; i < 300; i++) { step(w, { gas: true }, dt); assert.ok(w.car.x + CAR_LEN / 2 <= 928.5); }
  }
  // a long, jittery drive (a fixed pseudo-random key pattern, no Math.random) in every stage
  for (let i = 0; i < 3; i++) {
    const s = create(i);
    let seed = 12345 + i;
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    let input = {};
    for (let n = 0; n < 5000 && s.status === 'playing'; n++) {
      if (n % 25 === 0) input = { gas: rnd() < 0.6, brake: rnd() < 0.25, left: rnd() < 0.4, right: rnd() < 0.4 };
      step(s, input, DT);
      assert.equal(carHits(STAGES[i], s.car), false, `stage ${i + 1}, step ${n}: never inside an obstacle`);
      assert.ok(s.car.x > 0 && s.car.x < 960 && s.car.y > 0 && s.car.y < 540, 'never out of the arena');
    }
  }
});

// ---------- parking ----------

// A car standing still, centred in stage 1's bay (long axis vertical, heading up), `dx`, `dy` px off and `dh` radians off axis.
function standing(dx = 0, dy = 0, dh = 0, stage) {
  const s = create(0, stage ? { stage } : {});
  const st = stage || STAGES[0];
  s.car.x = st.bay.x + st.bay.w / 2 + dx;
  s.car.y = st.bay.y + st.bay.h / 2 + dy;
  s.car.heading = st.bay.axis + dh;
  s.car.speed = 0;
  return s;
}

test('EDI parking: standing in the bay for 800 ms parks (event parked, status stageWon, parkProgress fills 0..1); one tick short does not', () => {
  assert.equal(c('EDI_PARK_HOLD_MS'), 800);
  const s = standing();
  assert.equal(s.parkProgress, 0);
  run(s, {}, 400);
  assert.equal(s.status, 'playing');
  assert.equal(s.aligned, true);
  assert.ok(Math.abs(s.parkProgress - 0.5) < 0.02, `halfway: ${s.parkProgress}`);
  const events = run(s, {}, 800);
  assert.equal(s.status, 'stageWon');
  assert.deepEqual(events.filter((e) => e.type === 'parked' || e.type === 'stageWon').map((e) => e.type), ['parked', 'stageWon']);
  const t = standing();
  run(t, {}, 792, 8);
  assert.equal(t.status, 'playing', '99 ticks of 100 is not parked yet');
  assert.ok(t.parkProgress > 0.98 && t.parkProgress < 1);
});

test('EDI parking: the tolerance edges: a corner just inside the bay grown by 6 px is parked, just outside is not; same along the other axis', () => {
  const tol = c('EDI_PARK_TOLERANCE');
  assert.equal(tol, 6);
  const bay = STAGES[0].bay;
  const sideSlack = bay.w / 2 + tol - CAR_WID / 2; // the car (axis vertical) may shift this far sideways
  const endSlack = bay.h / 2 + tol - CAR_LEN / 2;
  const aligned = (dx, dy) => { const s = standing(dx, dy); step(s, {}, DT); return s.aligned; };
  assert.equal(aligned(sideSlack - 0.5, 0), true);
  assert.equal(aligned(-(sideSlack - 0.5), 0), true);
  assert.equal(aligned(sideSlack + 0.5, 0), false);
  assert.equal(aligned(-(sideSlack + 0.5), 0), false);
  assert.equal(aligned(0, endSlack - 0.5), true);
  assert.equal(aligned(0, -(endSlack - 0.5)), true);
  assert.equal(aligned(0, endSlack + 0.5), false);
  assert.equal(aligned(0, -(endSlack + 0.5)), false);
  const out = standing(sideSlack + 0.5, 0);
  run(out, {}, 3000);
  assert.equal(out.status, 'playing', 'outside the bay it never parks');
  assert.equal(out.parkProgress, 0);
});

test('EDI parking: the heading must be within 12 degrees of the axis (either end of it); a wrong heading is rejected; anyDirection false only takes the nose-in way', () => {
  assert.equal(c('EDI_PARK_ANGLE'), deg(12));
  const ok = (dh) => { const s = standing(0, 0, dh); step(s, {}, DT); return s.aligned; };
  assert.equal(ok(deg(11)), true);
  assert.equal(ok(deg(-11)), true);
  assert.equal(ok(deg(13)), false);
  assert.equal(ok(deg(-13)), false);
  assert.equal(ok(deg(45)), false);
  assert.equal(ok(HALF_PI), false, 'across the bay');
  assert.equal(ok(Math.PI), true, 'tail-in (reversed in) counts');
  assert.equal(ok(Math.PI + deg(11)), true);
  assert.equal(ok(Math.PI + deg(13)), false);
  const nose = { ...clone(STAGES[0]), anyDirection: false };
  const only = (dh) => { const s = standing(0, 0, dh, nose); step(s, {}, DT); return s.aligned; };
  assert.equal(only(0), true);
  assert.equal(only(Math.PI), false, 'with anyDirection false only the nose-in way counts');
  const wrong = standing(0, 0, deg(20));
  run(wrong, {}, 3000);
  assert.equal(wrong.status, 'playing');
});

test('EDI parking: it has to stand still (under 6 px/s) for 800 ms in a row: rolling gives no progress, a nudge resets the ring, and the instructor says "nearPark" once', () => {
  const rolling = standing(0, 6); // a little behind the middle, nose up, rolling forward at 20 px/s
  rolling.car.speed = 20;
  const ev = run(rolling, {}, 160); // friction slows it, still above 6 px/s
  assert.ok(rolling.aligned);
  assert.equal(rolling.parkProgress, 0, 'moving: no progress');
  assert.equal(ev.filter((e) => e.type === 'line' && e.kind === 'nearPark').length, 1, 'the near-park line is said once');
  const more = run(rolling, {}, 3000);
  assert.equal(more.filter((e) => e.type === 'line' && e.kind === 'nearPark').length, 0, 'and not again');
  assert.equal(rolling.status, 'stageWon', 'once it has rolled to a stop it parks');
  const nudge = standing();
  run(nudge, {}, 600);
  assert.ok(nudge.parkProgress > 0.7);
  nudge.car.speed = 30;
  step(nudge, {}, DT);
  assert.equal(nudge.parkProgress, 0);
  const slowPark = standing();
  assert.equal(run(slowPark, {}, 1000).filter((e) => e.kind === 'nearPark').length, 0, 'arriving already still: no "stop!" line');
});

// ---------- the instructor ----------

test('EDI instructor: warm lines for every kind, {name} replaced, no birthday, nothing mean, the opening lines are the briefed ones', () => {
  const lines = c('EDI_LINES');
  assert.equal(line('start', 'Mina', 0), 'Mirror, signal, then gently on the pedal, Mina.');
  assert.equal(line('bump', 'Mina', 0), 'Careful! That pillar has been there since the nineties.');
  assert.equal(line('nearPark', 'Mina', 0), 'Lovely. Now stop. STOP. Stooop...');
  assert.equal(line('parked', 'Mina', 0), 'Perfect parking! I would pass you.');
  assert.equal(line('timeout', 'Mina', 0), 'Take a breath. Again.');
  for (const kind of ['start', 'bump', 'scrape', 'nearPark', 'parked', 'timeout', 'lost']) {
    assert.ok(lines[kind].length >= (kind === 'start' ? 3 : 1), kind);
    for (let n = 0; n < lines[kind].length + 1; n++) {
      const text = line(kind, 'Mina', n);
      assert.ok(text.length > 4 && text.length <= 70, `${kind} ${n}: "${text}" is a short line (a HUD bubble)`);
      assert.ok(!/birthday|bday|cake|candle/i.test(text), `${kind} ${n}: no birthday`);
      assert.ok(!text.includes('{name}'), 'the placeholder is replaced');
      assert.ok(!/stupid|idiot|dumb|useless|hopeless/i.test(text), 'nothing mean');
    }
  }
  assert.ok(Object.values(lines).flat().some((t) => t.includes('{name}')));
  assert.equal(line('bump', 'Mina', 3), line('bump', 'Mina', 0), 'the variants wrap');
  assert.equal(line('bump', 'Mina', -1), line('bump', 'Mina', 2));
  assert.equal(line('nonsense', 'Mina'), '');
  assert.equal(line('start', '', 0), 'Mirror, signal, then gently on the pedal, Taru.', 'no name: the default name');
  assert.ok(/Mina/.test(line('start', 'Mina', 0)));
});

test('EDI instructor: the state emits `line` events and keeps { kind, text, ms } for the HUD; the bump variants rotate deterministically; start lines per stage', () => {
  const lineMs = c('EDI_LINE_MS');
  for (let i = 0; i < 3; i++) {
    const s = create(i, { name: 'Mina' });
    assert.equal(s.instructor.kind, 'start');
    assert.equal(s.instructor.text, line('start', 'Mina', i));
    assert.equal(s.instructor.ms, lineMs);
  }
  assert.notEqual(create(0).instructor.text, create(1).instructor.text);
  // three bumps in a row (separated by the invulnerability): three different lines, then it wraps
  const { s } = facingPillar(60);
  s.playerName = 'Mina';
  const texts = [];
  for (let k = 0; k < 4; k++) {
    s.hearts = 3; // keep her alive for the test
    s.car.speed = 60;
    const ev = run(s, {}, 100);
    const lines = ev.filter((e) => e.type === 'line' && e.kind === 'bump');
    assert.equal(lines.length, 1);
    assert.equal(s.instructor.text, lines[0].text);
    assert.equal(s.instructor.kind, 'bump');
    texts.push(lines[0].text);
    run(s, {}, 1100);
  }
  assert.deepEqual(texts, [0, 1, 2, 3].map((n) => line('bump', 'Mina', n)));
  assert.equal(new Set(texts.slice(0, 3)).size, 3);
  assert.equal(texts[3], texts[0]);
  // the bubble's time runs down to 0 and the text stays
  const t = create(0);
  run(t, {}, lineMs + 100);
  assert.equal(t.instructor.ms, 0);
  assert.ok(t.instructor.text.length > 0);
});

test('EDI instructor: lines for parked, the timeout and a lost stage come with the events', () => {
  const p = standing();
  const parked = run(p, {}, 1000);
  assert.deepEqual(parked.filter((e) => e.type === 'line').map((e) => e.kind), ['parked']);
  assert.equal(p.instructor.kind, 'parked');
  const t = create(0);
  const timeout = run(t, {}, 80000);
  assert.deepEqual(timeout.filter((e) => e.type === 'line').map((e) => e.kind), ['timeout']);
  assert.equal(t.instructor.text, line('timeout', 'Taru', 0));
  const rammed = create(0);
  rammed.car.x = 700;
  const ev = run(rammed, (st) => ((st.t % 3200) < 1600 ? { gas: true } : { brake: true }), 60000);
  const kinds = ev.filter((e) => e.type === 'line').map((e) => e.kind);
  assert.equal(kinds.filter((k) => k === 'bump').length, 2, 'a line per bump, until the last heart');
  assert.equal(kinds[kinds.length - 1], 'lost');
  const s = create(0);
  s.car.x = 880;
  s.car.speed = 5;
  const sc = run(s, {}, 400).filter((e) => e.type === 'line').map((e) => e.kind);
  assert.ok(sc.length <= 1);
});
