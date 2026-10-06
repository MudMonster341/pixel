// Pure rules of "EDI Madness" (decisions/0025, docs/plans/2026-10-06-edi-madness.md, phase E1): the ICL scanner's mini-game is a top-down
// garage-parking lesson. Taru drives a small learner car, a driving instructor sits in the passenger seat and comments, and she parks
// in three stages (an easy bay in an open lot, reversing in between two parked cars, a tight garage with pillars). No Phaser in this
// file: src/minigames/edi.js (phase E3) only reads the state below to draw it and forwards the keys, and tests/unit/edi-logic.test.js
// drives the real thing headless, with a scripted reference driver that parks every stage (so no stage is unwinnable).
//
// Everything is deterministic and nothing is random: a stage is a function of the inputs per step. Physics runs in FIXED steps of
// EDI_STEP_MS whatever the frame rate (stepEdiParking() feeds them from an accumulator), so 16 ms and 33 ms frames give the same drive.
//
// World: the 960x540 pixel space of the scene (a tile is 32 px), y grows downward, heading 0 = pointing right, a positive turn is clockwise
// on screen ("right"). The car is a 44 x 22 rectangle around (x, y) (its centre). A kinematic bicycle model (wheelbase 28): the steering wheel
// eases toward the input (no snap), turns the car only while it moves (the yaw rate is speed / wheelbase * tan(steer), so at standstill
// nothing happens) and gets less steering lock the faster it goes. Speeds are slow on purpose (max about 2.2 tiles/s forward, 1.2 in
// reverse), there is no skidding and no drifting. Gas while rolling backwards brakes first; brake at a standstill goes into reverse; the
// handbrake (Space) stops hard.
//
// Collision: the car is an oriented rectangle, every wall, pillar and parked car is one too (SAT, minimum translation vector), so a parked
// car may be rotated. Each fixed step moves the car by at most EDI_MAX_FWD * 8 ms = 0.56 px, far below the thinnest obstacle, so nothing can
// be tunnelled through; the car is pushed back out along the minimum translation vector. "Gentle, it is a gift": 3 hearts. Hitting something
// at EDI_BUMP_SPEED px/s or more (the speed INTO the obstacle) costs one heart (event `bump`), then 1 s of invulnerability and a small
// push-back; a gentler touch is a `scrape` (the car just stops against it, no heart). Hearts at 0 end the stage as 'lost' (reason 'hearts').
//
// Parked = all four corners inside the bay rectangle grown by EDI_PARK_TOLERANCE, the heading within EDI_PARK_ANGLE of the bay's axis (the
// opposite direction counts too unless a stage says `anyDirection: false`: nose-in and reverse-in are both fine) and the speed under
// EDI_PARK_SPEED for EDI_PARK_HOLD_MS in a row. `aligned` and `parkProgress` (0..1) are exposed so the scene can glow the bay and fill a ring.
//
// One ATTEMPT is the three stages in a row. A state is ONE stage: createEdiParking(stageIndex) starts it; on 'stageWon' the scene starts
// ediNextStage(state); on 'lost' the shell reports a loss (the skip rule: 3 losses -> skip offered) and the retry is ediRetryStage(state), the
// same stage again with a fresh clock. Status: 'playing' | 'stageWon' | 'won' (stage 3 parked, or the failsafe) | 'lost'. A stage has
// EDI_STAGE_LIMIT_MS (status 'lost', reason 'time', event `timeout`); an attempt has EDI_FAILSAFE_MS in total, after which it counts as
// WON with `failsafe: true`, like hero-logic's failsafe (the soft-lock guard: nobody is ever stuck). Esc quitting is the shell's job.
//
// The instructor (data below + ediInstructorLine) is warm and a little funny and never mean. The state emits `line` events and keeps
// `state.instructor = { kind, text, ms }` (ms left to show) for the HUD bubble. Names here start with EDI_/edi so they cannot clash with
// the other games' globals (plain script tags share one scope). Every number is a tuning knob for phase E5.

const EDI_W = 960;
const EDI_H = 540;
const EDI_TILE = 32;
const EDI_CAR_LEN = 44;
const EDI_CAR_WID = 22;
const EDI_WHEELBASE = 28;
const EDI_MAX_STEER = (32 * Math.PI) / 180; // lock of the front wheels
const EDI_STEER_EASE_MS = 90; // time constant of the steering wheel easing toward the key
const EDI_STEER_SPEED_FALLOFF = 0.4; // at full speed the lock is this much smaller
const EDI_MAX_FWD = 70; // px/s, about 2.2 tiles/s
const EDI_MAX_REV = 38; // px/s, about 1.2 tiles/s
const EDI_ACCEL = 120; // px/s^2
const EDI_BRAKE = 220; // px/s^2
const EDI_FRICTION = 60; // rolling friction when nothing is pressed
const EDI_HANDBRAKE = 700; // px/s^2: stops hard
const EDI_STEP_MS = 8; // the fixed physics step
const EDI_MAX_STEP_MS = 40; // a stalled frame (hidden tab) never skips ahead more than this

const EDI_HEARTS = 3;
const EDI_BUMP_SPEED = 25; // px/s INTO an obstacle: at or above this a touch is a bump (a heart), below it a scrape
const EDI_SCRAPE_MIN_SPEED = 6; // a touch gentler than this is silent
const EDI_SCRAPE_COOLDOWN_MS = 900; // between two scrape events (and lines)
const EDI_INVULN_MS = 1000; // after a bump nothing costs another heart
const EDI_PUSHBACK_PX = 6;

const EDI_PARK_TOLERANCE = 6; // px the bay rectangle is grown by
const EDI_PARK_ANGLE = (12 * Math.PI) / 180;
const EDI_PARK_SPEED = 6; // px/s
const EDI_PARK_HOLD_MS = 800;
const EDI_STAGE_LIMIT_MS = 75000;
const EDI_FAILSAFE_MS = 150000; // a whole attempt that lasts this long counts as won
const EDI_STAGE_COUNT = 3;
const EDI_LINE_MS = 3600; // how long the instructor's bubble shows a line

// ---------- the art (phase E2, tools/lib/edi-art.js writes these; the scene in phase E3 preloads from this table) ----------
// The paths are literals on purpose: tools/pack-offline.js finds every 'assets/...' string in src/, so listing them here puts them in the offline bundle.
const EDI_ART = {
  bg: ['assets/minigames/edi-bg-1.png', 'assets/minigames/edi-bg-2.png', 'assets/minigames/edi-bg-3.png'], // 960 x 540 each, one per stage, drawn 1:1
  cars: 'assets/minigames/edi-cars.png', // 448 x 392: 8 x 7 cells of EDI_CAR_CELL; a row per colour (EDI_CAR_ROWS), a column per heading
  sprites: 'assets/minigames/edi-sprites.png', // 256 x 32: 8 cells of 32 (EDI_SPRITE_FRAME)
  instructor: 'assets/minigames/edi-instructor.png', // 96 x 48: two 48 x 48 frames (0 neutral, 1 wincing)
  cover: 'assets/minigames/edi-cover.png', // 480 x 270, stretched 2x behind the intro card
};
const EDI_CAR_CELL = 56;
const EDI_CAR_ROWS = ['learner', 'green', 'grey', 'orange', 'red', 'yellow', 'blue']; // the learner car is the player's; the others are parked cars
const EDI_SPRITE_FRAME = { heartFull: 0, heartEmpty: 1, spark: 2, stars: 3, tick: 4, stop: 5, dust: 6, sparkle: 7 };
// The column of the car sheet for a heading (radians, 0 = east, clockwise): E SE S SW W NW N NE = 0..7.
function ediCarFrame(heading) {
  return ((Math.round(heading / (Math.PI / 4)) % 8) + 8) % 8;
}

// ---------- the stages (data) ----------
// A stage: { id, name, start: {x, y, heading}, obstacles: [{kind: 'wall'|'pillar'|'car', x, y, w, h, angle?}] (x, y = top-left corner, `angle`
// turns it about its centre), bay: {x, y, w, h, axis} (the target rectangle and the heading of its long axis), anyDirection, arrows (painted
// one-way markers, decoration only: {x, y, angle}), limitMs }. Geometry rule: every lane the route uses is at least 1.6 car widths wide.

function ediWall(x, y, w, h) {
  return { kind: 'wall', x, y, w, h };
}
function ediPillar(x, y) {
  return { kind: 'pillar', x, y, w: 28, h: 28 };
}
// A parked car centred on (cx, cy) with its nose along `heading`.
function ediParkedCar(cx, cy, heading) {
  return { kind: 'car', x: cx - EDI_CAR_LEN / 2, y: cy - EDI_CAR_WID / 2, w: EDI_CAR_LEN, h: EDI_CAR_WID, angle: heading };
}
function ediBorderWalls() {
  return [ediWall(0, 0, EDI_W, EDI_TILE), ediWall(0, EDI_H - EDI_TILE, EDI_W, EDI_TILE), ediWall(0, 0, EDI_TILE, EDI_H), ediWall(EDI_W - EDI_TILE, 0, EDI_TILE, EDI_H)];
}
const EDI_UP = -Math.PI / 2;
const EDI_DOWN = Math.PI / 2;

// A bay on the top wall: 34 wide, 56 deep (the car's centre ends 28 px from the wall's inner face + 12), long axis vertical.
function ediTopBay(cx) {
  return { x: cx - 17, y: 40, w: 34, h: 56, axis: EDI_UP };
}

const EDI_STAGES = [
  { // 1: an easy bay in an open lot: drive right, turn left, straight in
    id: 'open-lot',
    name: 'Open Lot',
    start: { x: 140, y: 400, heading: 0 },
    obstacles: [
      ...ediBorderWalls(),
      ediParkedCar(348, 64, EDI_UP), ediParkedCar(484, 64, EDI_UP), ediParkedCar(756, 64, EDI_UP), ediParkedCar(892, 64, EDI_UP),
      ediParkedCar(300, 476, EDI_DOWN), ediParkedCar(700, 476, EDI_DOWN),
    ],
    bay: ediTopBay(620),
    anyDirection: true,
    arrows: [{ x: 300, y: 400, angle: 0 }, { x: 560, y: 400, angle: 0 }, { x: 620, y: 220, angle: EDI_UP }],
    limitMs: EDI_STAGE_LIMIT_MS,
  },
  { // 2: a bay between two parked cars on the top row; she comes along the aisle, so she backs in (or turns round and noses in)
    id: 'between-cars',
    name: 'Between Two Cars',
    start: { x: 110, y: 230, heading: 0 },
    obstacles: [
      ...ediBorderWalls(),
      // the top row: the bay (x 480) sits between the cars at 446 and 514, the row goes on both sides, 68 px apart (a 46 px gap each)
      ...[242, 310, 378, 446, 514, 582, 650, 718].map((x) => ediParkedCar(x, 64, EDI_UP)),
      // a row of parked cars further down the aisle's far side
      ...[242, 310, 378, 446, 514, 582, 650, 718].map((x) => ediParkedCar(x, 330, EDI_DOWN)),
    ],
    bay: ediTopBay(480),
    anyDirection: true,
    arrows: [{ x: 150, y: 200, angle: 0 }],
    limitMs: EDI_STAGE_LIMIT_MS,
  },
  { // 3: a tight garage: a divider wall, a hanging wall, pillars, a one-way arrow, and a bay between two pillars on the top wall
    id: 'garage',
    name: 'Tight Garage',
    start: { x: 110, y: 410, heading: 0 },
    obstacles: [
      ...ediBorderWalls(),
      ediWall(32, 300, 520, 32), // the divider: the lower aisle runs east under it
      ediWall(360, 32, 32, 120), // hangs from the top wall over the upper aisle
      ediPillar(662, 300), // in the turn-round column east of the divider
      ediPillar(134, 32), ediPillar(218, 32), // the bay's two pillars (a 56 px gap)
      ediParkedCar(430, 484, 0), // a car in the lower aisle's far corner
    ],
    bay: ediTopBay(190),
    anyDirection: true,
    arrows: [{ x: 250, y: 410, angle: 0 }, { x: 460, y: 226, angle: Math.PI }],
    limitMs: EDI_STAGE_LIMIT_MS,
  },
];

// ---------- geometry: oriented boxes and SAT ----------

function ediBoxOf(o) {
  const a = o.angle || 0;
  return { cx: o.x + o.w / 2, cy: o.y + o.h / 2, hw: o.w / 2, hh: o.h / 2, c: Math.cos(a), s: Math.sin(a) };
}

const ediBoxCache = new WeakMap();
// The oriented boxes of a stage's obstacles (built once per stage object).
function ediObstacleBoxes(stage) {
  let boxes = ediBoxCache.get(stage);
  if (!boxes) {
    boxes = stage.obstacles.map(ediBoxOf);
    ediBoxCache.set(stage, boxes);
  }
  return boxes;
}

function ediCarBox(car) {
  return { cx: car.x, cy: car.y, hw: EDI_CAR_LEN / 2, hh: EDI_CAR_WID / 2, c: Math.cos(car.heading), s: Math.sin(car.heading) };
}

function ediCarCorners(car) {
  const b = ediCarBox(car);
  const out = [];
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
    out.push({ x: b.cx + b.c * b.hw * sx - b.s * b.hh * sy, y: b.cy + b.s * b.hw * sx + b.c * b.hh * sy });
  }
  return out;
}

// Separating-axis test of two oriented boxes. null when apart, else { nx, ny, depth }: the minimum translation vector, a unit normal
// pointing from b toward a and the overlap along it (move a by n * depth to separate).
function ediSat(a, b) {
  let best = null;
  for (const box of [a, b]) {
    for (const [ax, ay] of [[box.c, box.s], [-box.s, box.c]]) {
      const ra = a.hw * Math.abs(a.c * ax + a.s * ay) + a.hh * Math.abs(-a.s * ax + a.c * ay);
      const rb = b.hw * Math.abs(b.c * ax + b.s * ay) + b.hh * Math.abs(-b.s * ax + b.c * ay);
      const d = (a.cx - b.cx) * ax + (a.cy - b.cy) * ay;
      const overlap = ra + rb - Math.abs(d);
      if (overlap <= 0) return null;
      if (!best || overlap < best.depth) best = { nx: d < 0 ? -ax : ax, ny: d < 0 ? -ay : ay, depth: overlap };
    }
  }
  return best;
}

// Does a car at `pose` ({x, y, heading}) touch anything in the stage?
function ediCarHitsStage(stage, pose) {
  const box = ediCarBox(pose);
  return ediObstacleBoxes(stage).some((b) => ediSat(box, b) !== null);
}

// Pushes the car out of every obstacle (a few passes, in case it is squeezed by two). Returns the first contact's normal, or null.
function ediResolve(stage, car) {
  const boxes = ediObstacleBoxes(stage);
  let first = null;
  for (let pass = 0; pass < 6; pass++) {
    let any = false;
    for (const b of boxes) {
      const m = ediSat(ediCarBox(car), b);
      if (!m) continue;
      car.x += m.nx * (m.depth + 0.01);
      car.y += m.ny * (m.depth + 0.01);
      if (!first) first = { nx: m.nx, ny: m.ny };
      any = true;
    }
    if (!any) break;
  }
  return first;
}

function ediAngleDiff(a, b) { // a - b wrapped to (-PI, PI]
  let d = (a - b) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

// ---------- the instructor ----------

const EDI_LINES = {
  start: [
    'Mirror, signal, then gently on the pedal, {name}.',
    'Back in, or turn round and nose in. I will not judge. Out loud.',
    'Pillars, {name}. They do not move. You do. Slowly, please.',
  ],
  bump: [
    'Careful! That pillar has been there since the nineties.',
    'Oof. That one counts, {name}. Gently on the pedal.',
    'Careful, {name}. The car is rented. My nerves are not.',
  ],
  scrape: ['Just a scrape. We call that character.', 'A little kiss on the paint. Fine. Fine.', 'Gentle, {name}. Gentle.'],
  nearPark: ['Lovely. Now stop. STOP. Stooop...', 'You are in! Now do nothing. Nothing is the hard part.'],
  parked: ['Perfect parking! I would pass you.', 'Beautiful, {name}. I almost cried.', 'Straight as a ruler. A ruler with feelings.'],
  timeout: ['Take a breath. Again.', 'Time is up, {name}. The bay will wait. It always does.'],
  lost: ['Handbrake, deep breath, and we go again.', 'Right. Let us restart with confidence, {name}.'],
};

// The line of `kind`, with {name} replaced. `n` picks the variant (it wraps), so the caller's counter makes the rotation deterministic;
// for 'start' it is the stage index.
function ediInstructorLine(kind, name, n = 0) {
  const lines = EDI_LINES[kind];
  if (!lines || lines.length === 0) return '';
  const text = lines[((n % lines.length) + lines.length) % lines.length];
  return text.replace(/\{name\}/g, name || 'Taru');
}

function ediSay(state, kind, events, n) {
  const count = n === undefined ? (state.lineCounts[kind] = (state.lineCounts[kind] || 0) + 1) - 1 : n;
  const text = ediInstructorLine(kind, state.playerName, count);
  state.instructor = { kind, text, ms: EDI_LINE_MS };
  if (events) events.push({ type: 'line', kind, text });
}

// ---------- state ----------

// `opts`: { name (the player's name for {name}), attemptMs (time already spent in this attempt, for the failsafe), stage (a stage object to
// use instead of EDI_STAGES[stageIndex]: tests), lineCounts }.
function createEdiParking(stageIndex = 0, opts = {}) {
  const stage = opts.stage || EDI_STAGES[stageIndex];
  const state = {
    t: 0, // ms into this stage
    accMs: 0, // physics time not yet spent (below one fixed step)
    attemptMs: opts.attemptMs || 0, // ms into this attempt (all stages so far)
    status: 'playing', // 'playing' | 'stageWon' | 'won' | 'lost'
    reason: null, // why 'lost': 'hearts' | 'time'
    failsafe: false, // true when the attempt was "won" by the timer
    stageIndex,
    stageData: opts.stage || null, // only set when a test brings its own stage
    hearts: EDI_HEARTS,
    invulnMs: 0,
    scrapeCdMs: 0,
    bumps: 0,
    scrapes: 0,
    car: { x: stage.start.x, y: stage.start.y, heading: stage.start.heading, speed: 0, steer: 0 }, // speed > 0 forward, < 0 reverse
    aligned: false, // inside the bay with the right heading (the bay glows green)
    parkMs: 0,
    parkProgress: 0, // 0..1
    nearParkSaid: false,
    playerName: opts.name || 'Taru',
    lineCounts: { ...(opts.lineCounts || {}) },
    instructor: null,
  };
  ediSay(state, 'start', null, stageIndex);
  return state;
}

function ediStageOf(state) {
  return state.stageData || EDI_STAGES[state.stageIndex];
}

// The next stage of the same attempt (after 'stageWon'): the attempt clock and the instructor's rotation carry on. null after the last stage.
function ediNextStage(state) {
  if (state.stageIndex + 1 >= EDI_STAGE_COUNT) return null;
  return createEdiParking(state.stageIndex + 1, { name: state.playerName, attemptMs: state.attemptMs, lineCounts: state.lineCounts });
}

// The same stage again after a loss: a new attempt (fresh hearts, fresh clocks).
function ediRetryStage(state) {
  return createEdiParking(state.stageIndex, { name: state.playerName, lineCounts: state.lineCounts, stage: state.stageData || undefined });
}

// How many stages are parked so far (the HUD's "stage n / 3" progress): the finished ones, plus this one if it is won.
function ediStagesParked(state) {
  return state.stageIndex + (state.status === 'stageWon' || state.status === 'won' ? 1 : 0);
}

// ---------- one step ----------

// Advances the stage by dtMs. `input`: { gas, brake, left, right, handbrake } held now. Returns the events of this step (objects with a
// `type`): line {kind, text}, bump {heartsLeft}, scrape, parked, stageWon, win {failsafe}, timeout, lost {reason}.
function stepEdiParking(state, input, dtMs) {
  const events = [];
  if (state.status !== 'playing') return events;
  state.accMs += Math.min(Math.max(dtMs, 0), EDI_MAX_STEP_MS);
  while (state.accMs >= EDI_STEP_MS && state.status === 'playing') {
    state.accMs -= EDI_STEP_MS;
    ediTick(state, input || {}, events);
  }
  return events;
}

function ediTick(state, input, events) {
  const dt = EDI_STEP_MS;
  state.t += dt;
  state.attemptMs += dt;
  state.invulnMs = Math.max(0, state.invulnMs - dt);
  state.scrapeCdMs = Math.max(0, state.scrapeCdMs - dt);
  if (state.instructor) state.instructor.ms = Math.max(0, state.instructor.ms - dt);

  ediDrive(state.car, input, dt / 1000);
  ediMoveCar(state, dt / 1000, events);
  if (state.status !== 'playing') return;
  ediCheckPark(state, dt, events);
  if (state.status !== 'playing') return;

  if (state.attemptMs >= EDI_FAILSAFE_MS) { // the soft-lock guard: an attempt that long counts as won
    state.status = 'won';
    state.failsafe = true;
    events.push({ type: 'win', failsafe: true });
  } else if (state.t >= (ediStageOf(state).limitMs || EDI_STAGE_LIMIT_MS)) {
    state.status = 'lost';
    state.reason = 'time';
    events.push({ type: 'timeout' });
    ediSay(state, 'timeout', events);
    events.push({ type: 'lost', reason: 'time' });
  }
}

function ediApproach(v, target, amount) {
  return v < target ? Math.min(target, v + amount) : Math.max(target, v - amount);
}

// Steering wheel and speed from the keys.
function ediDrive(car, input, sec) {
  const turn = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const lock = EDI_MAX_STEER * (1 - EDI_STEER_SPEED_FALLOFF * Math.min(1, Math.abs(car.speed) / EDI_MAX_FWD));
  car.steer += (turn * lock - car.steer) * (1 - Math.exp(-(sec * 1000) / EDI_STEER_EASE_MS));
  car.steer = Math.max(-EDI_MAX_STEER, Math.min(EDI_MAX_STEER, car.steer));

  let v = car.speed;
  if (input.handbrake) v = ediApproach(v, 0, EDI_HANDBRAKE * sec);
  else if (input.gas && !input.brake) v = v < 0 ? Math.min(0, v + EDI_BRAKE * sec) : Math.min(EDI_MAX_FWD, v + EDI_ACCEL * sec); // gas while rolling back brakes first
  else if (input.brake && !input.gas) v = v > 0 ? Math.max(0, v - EDI_BRAKE * sec) : Math.max(-EDI_MAX_REV, v - EDI_ACCEL * sec); // brake, then reverse
  else v = ediApproach(v, 0, EDI_FRICTION * sec);
  car.speed = Math.abs(v) < 1e-9 ? 0 : v;
}

// Moves the car one fixed step (bicycle model), then pushes it out of whatever it touched and applies the bump / scrape rule.
function ediMoveCar(state, sec, events) {
  const car = state.car;
  if (car.speed === 0) return; // at a standstill nothing turns and nothing moves
  const tanS = Math.tan(car.steer);
  const beta = Math.atan(0.5 * tanS); // slip angle of the car's centre
  const dir = car.heading + beta;
  car.x += car.speed * Math.cos(dir) * sec;
  car.y += car.speed * Math.sin(dir) * sec;
  car.heading = ediAngleDiff(car.heading + ((car.speed * Math.cos(beta)) / EDI_WHEELBASE) * tanS * sec, 0);

  const stage = ediStageOf(state);
  const contact = ediResolve(stage, car);
  if (!contact) return;
  const into = -car.speed * (Math.cos(dir) * contact.nx + Math.sin(dir) * contact.ny); // speed INTO the obstacle (> 0: driving at it)
  if (into <= 0) return; // brushing past, or turning on the spot of the contact: just pushed out
  car.speed = 0;
  if (into >= EDI_BUMP_SPEED && state.invulnMs <= 0) {
    state.hearts -= 1;
    state.bumps += 1;
    state.invulnMs = EDI_INVULN_MS;
    car.x += contact.nx * EDI_PUSHBACK_PX;
    car.y += contact.ny * EDI_PUSHBACK_PX;
    ediResolve(stage, car);
    events.push({ type: 'bump', heartsLeft: state.hearts, x: car.x, y: car.y, speed: into });
    if (state.hearts <= 0) {
      state.status = 'lost';
      state.reason = 'hearts';
      ediSay(state, 'lost', events);
      events.push({ type: 'lost', reason: 'hearts' });
    } else {
      ediSay(state, 'bump', events);
    }
  } else if (into >= EDI_SCRAPE_MIN_SPEED && state.invulnMs <= 0 && state.scrapeCdMs <= 0) {
    state.scrapes += 1;
    state.scrapeCdMs = EDI_SCRAPE_COOLDOWN_MS;
    events.push({ type: 'scrape', x: car.x, y: car.y, speed: into });
    ediSay(state, 'scrape', events);
  }
}

// Is the car in the bay (all four corners inside the grown rectangle, heading along the axis)? Used by the step and by the tests.
function ediCarParkedPose(stage, car) {
  const bay = stage.bay;
  const t = EDI_PARK_TOLERANCE + 1e-6;
  const inside = ediCarCorners(car).every((p) => p.x >= bay.x - t && p.x <= bay.x + bay.w + t && p.y >= bay.y - t && p.y <= bay.y + bay.h + t);
  const diff = Math.abs(ediAngleDiff(car.heading, bay.axis));
  const headingOk = diff <= EDI_PARK_ANGLE || (stage.anyDirection !== false && Math.PI - diff <= EDI_PARK_ANGLE);
  return inside && headingOk;
}

function ediCheckPark(state, dt, events) {
  const stage = ediStageOf(state);
  const car = state.car;
  state.aligned = ediCarParkedPose(stage, car);
  if (state.aligned && Math.abs(car.speed) <= EDI_PARK_SPEED) state.parkMs += dt;
  else state.parkMs = 0;
  state.parkProgress = Math.min(1, state.parkMs / EDI_PARK_HOLD_MS);
  if (state.aligned && !state.nearParkSaid && Math.abs(car.speed) > EDI_PARK_SPEED) { // in, but still rolling: the instructor wants it stopped
    state.nearParkSaid = true;
    ediSay(state, 'nearPark', events);
  }
  if (state.parkMs < EDI_PARK_HOLD_MS) return;
  events.push({ type: 'parked', stage: state.stageIndex });
  ediSay(state, 'parked', events);
  if (state.stageIndex >= EDI_STAGE_COUNT - 1) {
    state.status = 'won';
    events.push({ type: 'win', failsafe: false });
  } else {
    state.status = 'stageWon';
    events.push({ type: 'stageWon', stage: state.stageIndex });
  }
}
