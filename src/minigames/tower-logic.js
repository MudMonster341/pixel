// Pure rules of Room 195's key mini-game (docs/STORY.md, docs/plans/2026-10-04-moments-and-small-touches.md "The tower climb
// (M8)"): a "reverse Rapunzel". Taru climbs a tower of TOWER_FLOOR_COUNT floors to the short-haired prince waiting at the top
// window while a grumpy stone gargoyle throws barrels and flower pots down. No Phaser in this file: src/minigames/tower.js only
// reads the state below to draw it and forwards the keys, and tests/unit/tower-logic.test.js drives the real thing headless.
//
// Everything is deterministic: the whole round is a function of (seed, the inputs per step). The gargoyle's throws come from a
// seeded schedule (towerSchedule), never from Math.random, so a test can replay a round exactly and a retry plays the same pattern.
//
// World: the same 960x540 pixel space as the scene. Y grows downward; a "floor" is the top surface of a wooden beam, and every
// y below is where a character's FEET are. Floors alternate which way things roll (TOWER_LEVEL.floors[i].flow): the top floor
// rolls right (the gargoyle stands at its left end, the prince's window is in the middle), the floor under it rolls left, and
// so on down. A floor's rolling end is open (TOWER_DROP_GAP): a hazard that reaches it drops to the floor below and rolls back
// the other way; the ground floor just lets them break against the wall. Ladders alternate sides and always sit on the side the
// floor ABOVE rolls toward, so a hazard coming along the upper floor passes over the ladder's top (and now and then climbs down it).
//
// Reuses the platformer's pure feel helpers (src/minigames/platformer-physics.js: coyote time, jump buffering). The jump height is
// fixed (no release-to-clip), and gravity/jump are the tower's own numbers: the whole jump (TOWER_JUMP_APEX) has to stay below
// the head room under the next beam (TOWER_HEAD_ROOM), or she would bump her head on the floor above, and far below a floor spacing,
// so a jump can never replace a ladder.

const TOWER_W = 960;
const TOWER_H = 540;
const TOWER_LEFT = 130; // the tower's inner walls
const TOWER_RIGHT = 830;
const TOWER_FLOOR_COUNT = 5; // the HUD counts floors reached, 1..TOWER_FLOOR_COUNT (MINIGAMES.tower.scoreTarget)
const TOWER_FLOOR_SPACING = 98;
const TOWER_GROUND_Y = 506; // top of the ground floor
const TOWER_SLAB_H = 14; // beam thickness (drawn by tools/make-minigame-art.js)
const TOWER_DROP_GAP = 56; // the open end of every floor above the ground one
const TOWER_LADDER_INSET = 86; // ladder centre, in from the wall on its side
const TOWER_LADDER_GRAB = 14; // how far from a ladder's centre she can still grab it
const TOWER_EDGE_SLACK = 6; // a beam holds her up this far past its end (centre of her body)
const TOWER_HEAD_ROOM = TOWER_FLOOR_SPACING - TOWER_SLAB_H; // clear height under the next beam

// She: a hitbox of 12 x 38 around the feet-centre point (the sprite is the lead's 16x24 frame drawn at 2x).
const TOWER_PLAYER_W = 12;
const TOWER_PLAYER_H = 38;
const TOWER_RUN_SPEED = 130; // px/s
const TOWER_CLIMB_SPEED = 70; // px/s up or down a ladder
const TOWER_GRAVITY = 900; // px/s^2
const TOWER_JUMP_VELOCITY = -280; // px/s, fixed height
const TOWER_JUMP_APEX = (TOWER_JUMP_VELOCITY * TOWER_JUMP_VELOCITY) / (2 * TOWER_GRAVITY); // ~43.6 px
const TOWER_LADDER_JUMP_COOLDOWN_MS = 300; // after jumping off a ladder she cannot re-grab at once
// A sinceGroundMs that is already past coyote time (platformer-physics.js PLATFORMER_COYOTE_MS): a jump cannot repeat in mid-air.
const TOWER_NO_COYOTE_MS = PLATFORMER_COYOTE_MS + 1;

const TOWER_HEARTS = 3;
const TOWER_INVULN_MS = 1800; // after a hit
const TOWER_MAX_STEP_MS = 40; // a stalled frame (hidden tab) never skips through a floor or a hazard
// Nobody may be stuck in a game (docs/STORY.md): a round that lasts longer than this counts as a WIN (the prince lets her up).
const TOWER_FAILSAFE_MS = 150000;

// The gargoyle's throws: the first after TOWER_FIRST_THROW_MS, then one every TOWER_THROW_MIN_MS..TOWER_THROW_MAX_MS.
const TOWER_FIRST_THROW_MS = 3200;
const TOWER_THROW_MIN_MS = 2500;
const TOWER_THROW_MAX_MS = 3500;
const TOWER_WINDUP_MS = 700; // the gargoyle wobbles and puffs this long before every throw (the scene's telegraph)
const TOWER_SPAWN_CLEAR_PX = 90; // a throw waits while she stands this close to the gargoyle's spot
const TOWER_POT_SHARE = 0.35; // about a third of the throws are flower pots

// Hazards (roll along a floor): hitbox size around the bottom-centre point, and the roll speed (slow on purpose: gentle).
const TOWER_HAZARD_KINDS = {
  barrel: { w: 12, h: 14, speed: 80 },
  pot: { w: 10, h: 16, speed: 76 },
};
const TOWER_HAZARD_GRAVITY = 900; // when one drops off a floor end
const TOWER_HAZARD_ARC = 0.6; // it keeps this share of its roll speed while it falls (a small arc)
const TOWER_LADDER_FALL_SPEED = 110; // a hazard going down a ladder
const TOWER_LADDER_CHANCE = 0.3; // chance that a hazard passing a ladder's top climbs down it (never the first ladder)
const TOWER_LADDER_SAFE_PX = 110; // ...and never while she is on that ladder or standing this close to its foot

function buildTowerLevel() {
  const top = TOWER_FLOOR_COUNT - 1;
  const floors = [];
  for (let i = 0; i < TOWER_FLOOR_COUNT; i++) {
    const flow = (top - i) % 2 === 0 ? 1 : -1; // +1 rolls right, -1 left
    const ground = i === 0;
    floors.push({
      index: i,
      y: TOWER_GROUND_Y - i * TOWER_FLOOR_SPACING,
      flow,
      ground, // hazards just break at the end of the ground floor
      x0: ground || flow > 0 ? TOWER_LEFT : TOWER_LEFT + TOWER_DROP_GAP,
      x1: ground || flow < 0 ? TOWER_RIGHT : TOWER_RIGHT - TOWER_DROP_GAP,
    });
  }
  const ladders = [];
  for (let j = 0; j < TOWER_FLOOR_COUNT - 1; j++) {
    const side = floors[j + 1].flow; // the side the floor above rolls toward
    ladders.push({
      index: j,
      bottomFloor: j,
      topFloor: j + 1,
      x: side > 0 ? TOWER_RIGHT - TOWER_LADDER_INSET : TOWER_LEFT + TOWER_LADDER_INSET,
      yBottom: floors[j].y,
      yTop: floors[j + 1].y,
    });
  }
  const topFloor = floors[top];
  return {
    floors,
    ladders,
    topFloor: top,
    spawn: { x: TOWER_RIGHT - 100, y: floors[0].y, facing: -1 }, // she starts on the ground floor, facing the first ladder
    gargoyle: { x: TOWER_LEFT + 40, y: topFloor.y, throwX: TOWER_LEFT + 90 },
    winZone: { x0: 420, x1: 548, floor: top }, // the prince's window; he stands at princeX, the chameleon on the sill
    princeX: 474,
    sillX: 548,
    sillY: topFloor.y - 14,
    // Torches on the inner wall (the scene lights a flame on each; the backdrop paints the bracket). Between two floors, away
    // from ladders and the window.
    torches: floors.flatMap((f) => [{ x: 330, y: f.y - 58 }, { x: 650, y: f.y - 58 }]),
  };
}
const TOWER_LEVEL = buildTowerLevel();

// ---------- the seeded schedule ----------

// mulberry32: a tiny seeded generator, the same sequence on every machine.
function towerRandom(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The gargoyle's throws, in order: `wait` is the time after the PREVIOUS throw actually left (the first: after the round
// starts), so a throw that had to wait for her to step away (towerSpawnBlocked) pushes everything after it back instead of
// bunching two throws together. `ladderRoll[j]` is the dice a hazard uses at ladder j (it climbs down when the roll is below
// TOWER_LADDER_CHANCE), fixed here so the schedule alone decides it: independent of anything she does.
function towerSchedule(seed, count = 80) {
  const rand = towerRandom(seed);
  const out = [];
  for (let i = 0; i < count; i++) {
    const wait = i === 0 ? TOWER_FIRST_THROW_MS : TOWER_THROW_MIN_MS + Math.floor(rand() * (TOWER_THROW_MAX_MS - TOWER_THROW_MIN_MS + 1));
    const kind = rand() < TOWER_POT_SHARE ? 'pot' : 'barrel';
    const ladderRoll = TOWER_LEVEL.ladders.map(() => rand());
    out.push({ wait, kind, ladderRoll });
  }
  return out;
}

// ---------- state ----------

function createTowerState(seed = 195, opts = {}) {
  const spawn = TOWER_LEVEL.spawn;
  return {
    seed,
    t: 0, // ms into this round
    status: 'playing', // 'playing' | 'won' | 'lost'
    failsafe: false, // true when the round was "won" by the timer
    hearts: TOWER_HEARTS,
    invulnMs: 0,
    best: 0, // the highest floor index she has stood on
    hazardsEnabled: opts.hazards !== false, // tests switch the gargoyle off to prove the level itself is climbable
    hazards: [],
    nextHazardId: 1,
    schedule: towerSchedule(seed),
    nextThrow: 0, // index into the schedule
    sinceThrowMs: 0, // ms since the last throw left (or since the start)
    windup: false, // the telegraph is running
    player: {
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      mode: 'ground', // 'ground' | 'air' | 'ladder'
      floor: 0, // the floor she stands on (ground mode), else null
      ladder: null, // the ladder she is on (ladder mode)
      facing: spawn.facing,
      climbing: false, // moving on a ladder this step
      sinceGroundMs: 0,
      jumpBufferMs: null, // ms since SPACE was pressed, while it is still valid (platformer-physics.js)
      ladderCooldownMs: 0,
    },
  };
}

function towerFloorSupports(floor, x) {
  return x >= floor.x0 - TOWER_EDGE_SLACK && x <= floor.x1 + TOWER_EDGE_SLACK;
}

function towerPlayerBox(state) {
  const p = state.player;
  return { x0: p.x - TOWER_PLAYER_W / 2, x1: p.x + TOWER_PLAYER_W / 2, y0: p.y - TOWER_PLAYER_H, y1: p.y };
}

function towerHazardBox(h) {
  const k = TOWER_HAZARD_KINDS[h.kind];
  return { x0: h.x - k.w / 2, x1: h.x + k.w / 2, y0: h.y - k.h, y1: h.y };
}

function towerBoxesOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// How many floors she has reached (what the HUD counts): 1..TOWER_FLOOR_COUNT.
function towerFloorsReached(state) {
  return state.best + 1;
}

// ---------- one step ----------

// Advances the round by dtMs. `input`: { left, right, up, down } held now, `jumpPressed` true on the frame SPACE went down.
// Returns the events of this step (objects with a `type`): jump, land, floor, windup, throw, hit, smash, poof, win, lose.
function stepTower(state, input, dtMs) {
  const events = [];
  if (state.status !== 'playing') return events;
  const dt = Math.min(Math.max(dtMs, 0), TOWER_MAX_STEP_MS);
  state.t += dt;
  state.invulnMs = Math.max(0, state.invulnMs - dt);

  towerStepPlayer(state, input || {}, dt, events);

  if (towerInWinZone(state)) {
    state.status = 'won';
    events.push({ type: 'win', failsafe: false });
    return events;
  }

  towerStepGargoyle(state, dt, events);
  towerStepHazards(state, dt, events);
  towerCollide(state, events);
  if (state.status !== 'playing') return events;

  if (state.t >= TOWER_FAILSAFE_MS) {
    state.status = 'won';
    state.failsafe = true;
    events.push({ type: 'win', failsafe: true });
  }
  return events;
}

function towerInWinZone(state) {
  const p = state.player;
  const z = TOWER_LEVEL.winZone;
  return p.mode === 'ground' && p.floor === z.floor && p.x >= z.x0 && p.x <= z.x1;
}

function towerLandOn(state, floorIndex, events) {
  const p = state.player;
  const wasAir = p.mode === 'air';
  p.mode = 'ground';
  p.floor = floorIndex;
  p.ladder = null;
  p.y = TOWER_LEVEL.floors[floorIndex].y;
  p.vy = 0;
  p.sinceGroundMs = 0;
  if (wasAir) events.push({ type: 'land' });
  if (floorIndex > state.best) {
    state.best = floorIndex;
    events.push({ type: 'floor', floor: floorIndex });
  }
}

function towerGrab(state, ladder) {
  const p = state.player;
  p.mode = 'ladder';
  p.ladder = ladder.index;
  p.floor = null;
  p.x = ladder.x;
  p.vx = 0;
  p.vy = 0;
}

// The ladder she may grab from where she stands on the ground: UP takes the ladder that starts on this floor, DOWN the one that ends here.
function towerLadderFromGround(p, vert) {
  const ladders = TOWER_LEVEL.ladders;
  const ladder = vert > 0 ? ladders[p.floor] : ladders[p.floor - 1];
  return ladder && Math.abs(p.x - ladder.x) <= TOWER_LADDER_GRAB ? ladder : null;
}

// In the air she can catch a ladder she is beside (UP or DOWN), anywhere along its length.
function towerLadderInAir(p) {
  for (const ladder of TOWER_LEVEL.ladders) {
    if (Math.abs(p.x - ladder.x) <= TOWER_LADDER_GRAB && p.y > ladder.yTop + 4 && p.y < ladder.yBottom - 4) return ladder;
  }
  return null;
}

function towerStepPlayer(state, input, dtMs, events) {
  const p = state.player;
  const dt = dtMs / 1000;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const vert = (input.up ? 1 : 0) - (input.down ? 1 : 0); // +1 up
  if (dir !== 0) p.facing = dir;
  p.ladderCooldownMs = Math.max(0, p.ladderCooldownMs - dtMs);
  p.climbing = false;

  // jump buffer (src/minigames/platformer-physics.js): SPACE pressed a moment before she can jump still counts
  if (input.jumpPressed) p.jumpBufferMs = 0;
  else if (p.jumpBufferMs !== null) p.jumpBufferMs += dtMs;
  if (p.jumpBufferMs !== null && !shouldBufferedJumpFire(p.jumpBufferMs)) p.jumpBufferMs = null;
  const wantsJump = p.jumpBufferMs !== null;

  if (p.mode === 'ladder') {
    const ladder = TOWER_LEVEL.ladders[p.ladder];
    p.x = ladder.x;
    if (wantsJump) { // jump off: a hop to the side she is pressing, or straight up
      p.mode = 'air';
      p.ladder = null;
      p.vy = TOWER_JUMP_VELOCITY;
      p.vx = dir * TOWER_RUN_SPEED;
      p.sinceGroundMs = TOWER_NO_COYOTE_MS;
      p.ladderCooldownMs = TOWER_LADDER_JUMP_COOLDOWN_MS;
      p.jumpBufferMs = null;
      events.push({ type: 'jump' });
      return;
    }
    if (vert !== 0) {
      p.climbing = true;
      p.y -= vert * TOWER_CLIMB_SPEED * dt;
      if (vert > 0 && p.y <= ladder.yTop) { p.y = ladder.yTop; towerLandOn(state, ladder.topFloor, events); }
      else if (vert < 0 && p.y >= ladder.yBottom) { p.y = ladder.yBottom; towerLandOn(state, ladder.bottomFloor, events); }
    }
    return;
  }

  p.vx = dir * TOWER_RUN_SPEED;

  if (p.mode === 'ground') {
    const floor = TOWER_LEVEL.floors[p.floor];
    if (vert !== 0) {
      const ladder = towerLadderFromGround(p, vert);
      if (ladder) { towerGrab(state, ladder); return; }
    }
    if (wantsJump) {
      p.mode = 'air';
      p.floor = null;
      p.vy = TOWER_JUMP_VELOCITY;
      p.sinceGroundMs = TOWER_NO_COYOTE_MS; // coyote time is spent: no second jump out of nothing
      p.jumpBufferMs = null;
      events.push({ type: 'jump' });
    } else {
      p.x = Math.min(Math.max(p.x + p.vx * dt, TOWER_LEFT + TOWER_PLAYER_W / 2), TOWER_RIGHT - TOWER_PLAYER_W / 2);
      if (!towerFloorSupports(floor, p.x)) { // walked off the open end: she drops to the floor below
        p.mode = 'air';
        p.floor = null;
        p.vy = 0;
        p.sinceGroundMs = 0;
      }
      return;
    }
  }

  // air (including the frame a jump just started)
  p.sinceGroundMs += dtMs;
  if (wantsJump && canCoyoteJump(p.sinceGroundMs)) { // walked off a ledge a moment ago and pressed jump
    p.vy = TOWER_JUMP_VELOCITY;
    p.sinceGroundMs = TOWER_NO_COYOTE_MS;
    p.jumpBufferMs = null;
    events.push({ type: 'jump' });
  }
  const prevY = p.y;
  p.vy = integrateGravity(p.vy, dt, TOWER_GRAVITY);
  p.y += p.vy * dt;
  p.x = Math.min(Math.max(p.x + p.vx * dt, TOWER_LEFT + TOWER_PLAYER_W / 2), TOWER_RIGHT - TOWER_PLAYER_W / 2);

  if (vert !== 0 && p.ladderCooldownMs <= 0) {
    const ladder = towerLadderInAir(p);
    if (ladder) { towerGrab(state, ladder); return; }
  }
  if (p.vy >= 0) {
    for (const floor of TOWER_LEVEL.floors) { // top floor first: the highest beam she crossed
      if (prevY <= floor.y && p.y >= floor.y && towerFloorSupports(floor, p.x)) { towerLandOn(state, floor.index, events); return; }
    }
  }
}

// ---------- the gargoyle ----------

// A throw waits while she stands close to the gargoyle's spot on the top floor, so a hazard never appears on top of her.
function towerSpawnBlocked(state) {
  const p = state.player;
  const g = TOWER_LEVEL.gargoyle;
  const nearTopFloor = p.y > g.y - 60 && p.y < g.y + 60;
  return nearTopFloor && Math.abs(p.x - g.throwX) < TOWER_SPAWN_CLEAR_PX;
}

function towerStepGargoyle(state, dtMs, events) {
  if (!state.hazardsEnabled) return;
  const next = state.schedule[state.nextThrow];
  if (!next) return;
  state.sinceThrowMs += dtMs;
  if (!state.windup && state.sinceThrowMs >= next.wait - TOWER_WINDUP_MS) {
    state.windup = true;
    events.push({ type: 'windup' });
  }
  if (state.sinceThrowMs < next.wait || towerSpawnBlocked(state)) return;
  const g = TOWER_LEVEL.gargoyle;
  const top = TOWER_LEVEL.floors[TOWER_LEVEL.topFloor];
  state.hazards.push({
    id: state.nextHazardId++,
    kind: next.kind,
    x: g.throwX,
    y: top.y,
    dir: top.flow,
    mode: 'roll', // 'roll' | 'fall' | 'ladder'
    floor: top.index,
    vy: 0,
    ladderRoll: next.ladderRoll,
  });
  state.nextThrow++;
  state.sinceThrowMs = 0;
  state.windup = false;
  events.push({ type: 'throw', kind: next.kind });
}

// ---------- hazards ----------

// She is on this ladder, or standing near its foot: a hazard does not climb down it then (it would land on her unseen).
function towerLadderBusy(state, ladder) {
  const p = state.player;
  if (p.mode === 'ladder' && p.ladder === ladder.index) return true;
  return p.mode !== 'ladder' && p.y > ladder.yBottom - 60 && p.y <= ladder.yBottom + 1 && Math.abs(p.x - ladder.x) < TOWER_LADDER_SAFE_PX;
}

function towerStepHazards(state, dtMs, events) {
  const dt = dtMs / 1000;
  const keep = [];
  for (const h of state.hazards) {
    const kind = TOWER_HAZARD_KINDS[h.kind];
    let alive = true;
    if (h.mode === 'roll') {
      const floor = TOWER_LEVEL.floors[h.floor];
      const prevX = h.x;
      h.x += h.dir * kind.speed * dt;
      const ladder = h.floor >= 2 ? TOWER_LEVEL.ladders[h.floor - 1] : null; // the first ladder (to the floor she starts on) never carries one
      if (ladder && (prevX - ladder.x) * (h.x - ladder.x) <= 0 && h.ladderRoll[ladder.index] < TOWER_LADDER_CHANCE && !towerLadderBusy(state, ladder)) {
        h.mode = 'ladder';
        h.x = ladder.x;
        h.ladderIndex = ladder.index;
      } else if (floor.ground) {
        if (h.dir > 0 ? h.x >= TOWER_RIGHT - 34 : h.x <= TOWER_LEFT + 34) {
          alive = false;
          events.push({ type: 'poof', x: h.x, y: h.y });
        }
      } else if (h.dir > 0 ? h.x > floor.x1 : h.x < floor.x0) {
        h.mode = 'fall';
        h.vy = 0;
      }
    } else if (h.mode === 'ladder') {
      const ladder = TOWER_LEVEL.ladders[h.ladderIndex];
      h.y += TOWER_LADDER_FALL_SPEED * dt;
      if (h.y >= ladder.yBottom) {
        h.y = ladder.yBottom;
        h.mode = 'roll';
        h.floor = ladder.bottomFloor;
        h.dir = TOWER_LEVEL.floors[ladder.bottomFloor].flow;
      }
    } else { // fall
      const prevY = h.y;
      h.vy += TOWER_HAZARD_GRAVITY * dt;
      h.y += h.vy * dt;
      h.x += h.dir * kind.speed * TOWER_HAZARD_ARC * dt;
      for (let f = h.floor - 1; f >= 0; f--) {
        const floor = TOWER_LEVEL.floors[f];
        if (prevY <= floor.y && h.y >= floor.y && towerFloorSupports(floor, h.x)) {
          h.y = floor.y;
          h.floor = f;
          h.mode = 'roll';
          h.dir = floor.flow;
          break;
        }
      }
      if (h.mode === 'fall' && h.y > TOWER_H + 40) alive = false;
    }
    if (alive) keep.push(h);
  }
  state.hazards = keep;
}

function towerCollide(state, events) {
  if (state.invulnMs > 0) return;
  const box = towerPlayerBox(state);
  for (let i = 0; i < state.hazards.length; i++) {
    const h = state.hazards[i];
    if (!towerBoxesOverlap(box, towerHazardBox(h))) continue;
    state.hazards.splice(i, 1); // it breaks on her
    state.hearts -= 1;
    state.invulnMs = TOWER_INVULN_MS;
    events.push({ type: 'hit', hearts: state.hearts });
    events.push({ type: 'smash', x: h.x, y: h.y, kind: h.kind });
    if (state.hearts <= 0) {
      state.status = 'lost';
      events.push({ type: 'lose' });
    }
    return;
  }
}
