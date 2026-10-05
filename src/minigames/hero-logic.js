// Pure rules of the Physics Lab key mini-game (FB-0066, docs/plans/2026-10-04-moments-and-small-touches.md "hero vs villain"):
// a small white kitten in a mask and cape (a hero-vs-villain game with GENERIC stand-ins for two protected characters, ADR 0021) fights a
// dark, bat-eared, caped "shadow bat" on a lab rooftop. He shoots at her, a little robot-bat minion patrols the roof, and she
// beats him with star bolts, then he drops the key and she walks over and takes it. No Phaser in this file: src/minigames/hero.js
// only reads the state below to draw it and forwards the keys, and tests/unit/hero-logic.test.js drives the real thing headless.
//
// Everything is deterministic and nothing is random: the whole round is a function of the inputs per step. The villain works
// through one fixed plan (an aimed bolt, another aimed bolt, a 3-bolt fan, a slow sweep, repeat), every volley is announced by a
// wind-up of HV_WINDUP_MS first (the scene flashes him), so a retry is a pattern she can learn and nothing hits her unseen.
// "Gentle shooter" (docs/plans/...-moments..., settled item 9): 3 hearts, about 9 hits to beat him, slow bolts, plenty of time to
// react; the framework gives the skip after 3 losses, Esc quits, and a round always ends (failsafe below).
//
// World: the same 960x540 pixel space as the scene. Y grows downward; every y of a character is where its FEET are. The floor is
// the roof; three one-tile-thick platforms hang above it (land from above, jump up through them). Her hitbox is small and
// forgiving (16 x 36, the sprite is bigger).
//
// Reuses the platformer's pure feel helpers (src/minigames/platformer-physics.js: coyote time, jump buffering). Names here start
// with HV_ because framework-scene.js already owns the HERO_* names (the lead's sprite frames), and plain script tags share one scope.

const HV_W = 960;
const HV_H = 540;
const HV_FLOOR_Y = 470; // the roof: top surface
const HV_LEFT = 28; // her walls
const HV_RIGHT = 932;
// Platforms (one-way: you land on top, you jump up through them). 74 px above the roof: well under the jump apex (~92).
const HV_PLATFORMS = [
  { x0: 110, x1: 250, y: HV_FLOOR_Y - 74 },
  { x0: 340, x1: 480, y: HV_FLOOR_Y - 74 },
  { x0: 580, x1: 700, y: HV_FLOOR_Y - 74 },
];
const HV_EDGE_SLACK = 4; // a platform holds her up this far past its end

// She
const HV_PLAYER_W = 16;
const HV_PLAYER_H = 36;
const HV_RUN_SPEED = 200; // px/s
const HV_GRAVITY = 1700; // px/s^2
const HV_JUMP_VELOCITY = -560; // px/s, fixed height
const HV_JUMP_APEX = (HV_JUMP_VELOCITY * HV_JUMP_VELOCITY) / (2 * HV_GRAVITY); // ~92 px
const HV_NO_COYOTE_MS = PLATFORMER_COYOTE_MS + 1; // already past coyote time: no second jump out of nothing
const HV_HEARTS = 3;
const HV_INVULN_MS = 1500; // after a hit (the scene blinks her at 2.5 Hz)
const HV_MAX_STEP_MS = 40; // a stalled frame (hidden tab) never skips through a bolt or a floor
// Nobody may be stuck in a game (docs/STORY.md): a round that lasts longer than this counts as a WIN (he gives up the key).
const HV_FAILSAFE_MS = 150000;

// Her star bolts: straight, fast, short range (she has to come within reach of him, and he can hit back).
const HV_SHOT_SPEED = 480; // px/s
const HV_SHOT_COOLDOWN_MS = 260; // holding the key (or the mouse button) fires at this rate
const HV_POINTER_BUFFER_MS = 120; // a click that lands during the cooldown still fires if the cooldown ends within this long (FB-0081)
const HV_SHOT_RANGE = 520; // px
const HV_SHOT_MAX = 4; // on screen at once
const HV_SHOT_H = 20; // a bolt leaves her at this height above her feet
const HV_SHOT_BOX = { w: 12, h: 8 };

// The shadow bat: hovers low above the roof, steps along the right of the arena, shoots in volleys.
const HV_VILLAIN_HP = 9; // = MINIGAMES.hero.scoreTarget: the HUD counts the hits she has landed
const HV_VILLAIN_HIT_INVULN_MS = 1800; // after a hit he is shielded (and blinks) so a hit is a moment, not a stream; he is also shielded while he winds up and fires
const HV_VILLAIN_RAGE_HP = 4; // at this health or less he is "angry": shorter rests, longer fans and sweeps
const HV_VILLAIN_W = 36;
const HV_VILLAIN_H = 64;
const HV_VILLAIN_ZONE = { x0: 640, x1: 880 }; // he walks between these, slowly, and stands still to shoot
const HV_VILLAIN_SPEED = 42; // px/s
const HV_VILLAIN_EDGE_PAUSE_MS = 600;
// He hovers low (her shots from the roof hit him) while he fires aimed bolts, and rises high for the fan and the sweep (then only a
// shot from a platform, or in mid-jump, reaches him): the platforms matter, and she has to move. Feet height above the roof, plus a slow bob.
const HV_VILLAIN_HOVER_LOW = 14;
const HV_VILLAIN_HOVER_HIGH = 62;
const HV_VILLAIN_RISE_SPEED = 90; // px/s
const HV_VILLAIN_BOB = 6;
const HV_VILLAIN_BOB_MS = 700; // the bob's sine divisor: a ~4.4 s bob
const HV_VILLAIN_MUZZLE_H = 40; // bolts leave him at this height above his feet

// The volley plan: `aimed` = one bolt, `fan` = three bolts spread round the aim, `sweep` = five bolts in a row (the aim sweeps
// across her one bolt at a time). Rests are the calm before the wind-up; a whole volley is rest + HV_WINDUP_MS (~2 s for an
// aimed one, as the brief says).
const HV_PLAN = ['aimed', 'aimed', 'fan', 'sweep'];
const HV_FIRST_REST_MS = 1800; // a calm start
const HV_REST_MS = { aimed: 1400, fan: 1700, sweep: 1500 };
const HV_RAGE_REST_FACTOR = 0.75;
const HV_WINDUP_MS = 600; // the visible wind-up flash before every volley (the scene's telegraph)
const HV_BOLT_SPEED = { aimed: 230, fan: 210, sweep: 190 }; // px/s: slow on purpose
const HV_BOLT_BOX = 10;
const HV_FAN_DEGREES = [-26, 0, 26];
const HV_FAN_DEGREES_RAGE = [-52, -26, 0, 26, 52];
const HV_SWEEP_DEGREES = [-30, -15, 0, 15, 30];
const HV_SWEEP_DEGREES_RAGE = [-36, -24, -12, 0, 12, 24, 36];
const HV_SWEEP_INTERVAL_MS = 220;

// The roaming minion: a small robot-bat that patrols the roof on the left and centre, one hit and it is down. It drops ONE heart
// (the first time it falls, never more in a round) and comes back, without a heart, after HV_MINION_RESPAWN_MS.
const HV_MINION = { w: 20, h: 22, speed: 60, x0: 100, x1: 540 };
const HV_MINION_RESPAWN_MS = 9000;
const HV_PICKUP_MS = 10000; // the heart waits this long
const HV_PICKUP_REACH = 20;

// After the villain falls: a beat (he slumps and gives the key up: the scene shows his line), then the key drops and she walks to it.
const HV_DEFEAT_BEAT_MS = 1800;
const HV_KEY_GRAVITY = 900;
const HV_KEY_REACH = 26;
const HV_KEY_MAGNET_MS = 8000; // if she has not taken it by then it slides toward her
const HV_KEY_MAGNET_SPEED = 140;
const HV_KEY_FAILSAFE_MS = 20000; // ...and after this the key is hers anyway

function buildHeroLevel() {
  return {
    floorY: HV_FLOOR_Y,
    platforms: HV_PLATFORMS,
    spawn: { x: 120, y: HV_FLOOR_Y, facing: 1 },
    villainZone: HV_VILLAIN_ZONE,
    minion: HV_MINION,
    keyY: HV_FLOOR_Y,
  };
}
const HV_LEVEL = buildHeroLevel();

// ---------- state ----------

// `opts.hazards: false` switches the villain's bolts and the minion off (tests use it to prove the fight itself is winnable).
function createHeroFight(opts = {}) {
  const hazards = opts.hazards !== false;
  return {
    t: 0, // ms into this round
    status: 'playing', // 'playing' | 'won' | 'lost'
    failsafe: false, // true when the round was "won" by a timer
    phase: 'fight', // 'fight' | 'defeated' (the beat) | 'key' (walk to the key)
    hazardsEnabled: hazards,
    hearts: HV_HEARTS,
    invulnMs: 0,
    player: {
      x: HV_LEVEL.spawn.x,
      y: HV_LEVEL.spawn.y,
      vx: 0,
      vy: 0,
      grounded: true,
      surface: -1, // -1 the roof, 0.. a platform, null in the air
      facing: HV_LEVEL.spawn.facing, // +1 right, -1 left
      sinceGroundMs: 0,
      jumpBufferMs: null, // ms since the jump key went down, while it still counts (platformer-physics.js)
      shootCdMs: 0,
      shotMs: 0, // > 0 right after a shot: the scene shows the firing pose
    },
    villain: {
      x: 780,
      dir: -1, // the way he is stepping: -1 left, +1 right
      pauseMs: 0,
      hp: HV_VILLAIN_HP,
      invulnMs: 0,
      phase: 'rest', // 'rest' | 'windup' | 'fire' (a sweep in progress) | 'down'
      phaseMs: 0,
      restMs: HV_FIRST_REST_MS,
      plan: 0, // index into HV_PLAN (mod its length): the volley coming up
      hover: HV_VILLAIN_HOVER_LOW, // feet height above the roof right now (without the bob)
      hoverTo: HV_VILLAIN_HOVER_LOW,
      sweepIndex: 0,
      sweepMs: 0,
    },
    bolts: [], // his
    shots: [], // hers
    nextId: 1,
    minion: { alive: hazards, x: 420, dir: -1, respawnMs: 0, kills: 0 },
    pickup: null, // { x, ms }
    heartDropped: false,
    beatMs: 0,
    key: null, // { x, y, vy, landed }
    keyMs: 0,
  };
}

function heroHitsLanded(state) {
  return HV_VILLAIN_HP - state.villain.hp;
}

function heroVillainFeetY(state) {
  if (state.villain.phase === 'down') return HV_FLOOR_Y;
  return HV_FLOOR_Y - (state.villain.hover + HV_VILLAIN_BOB * Math.sin(state.t / HV_VILLAIN_BOB_MS));
}

function heroVillainRage(state) {
  return state.villain.hp <= HV_VILLAIN_RAGE_HP;
}

// Shots do nothing to him while he is blinking after a hit, or while he winds up and fires (the cue to dodge, not to shoot).
function heroVillainShielded(state) {
  const v = state.villain;
  return v.invulnMs > 0 || v.phase === 'windup' || v.phase === 'fire';
}

function heroVillainPattern(state) {
  return HV_PLAN[state.villain.plan % HV_PLAN.length];
}

function heroPlayerBox(state) {
  const p = state.player;
  return { x0: p.x - HV_PLAYER_W / 2, x1: p.x + HV_PLAYER_W / 2, y0: p.y - HV_PLAYER_H, y1: p.y };
}

function heroVillainBox(state) {
  const v = state.villain;
  const feet = heroVillainFeetY(state);
  return { x0: v.x - HV_VILLAIN_W / 2, x1: v.x + HV_VILLAIN_W / 2, y0: feet - HV_VILLAIN_H, y1: feet };
}

function heroMinionBox(state) {
  const m = state.minion;
  return { x0: m.x - HV_MINION.w / 2, x1: m.x + HV_MINION.w / 2, y0: HV_FLOOR_Y - HV_MINION.h, y1: HV_FLOOR_Y };
}

function heroBoltBox(b) {
  return { x0: b.x - HV_BOLT_BOX / 2, x1: b.x + HV_BOLT_BOX / 2, y0: b.y - HV_BOLT_BOX / 2, y1: b.y + HV_BOLT_BOX / 2 };
}

function heroShotBox(s) {
  return { x0: s.x - HV_SHOT_BOX.w / 2, x1: s.x + HV_SHOT_BOX.w / 2, y0: s.y - HV_SHOT_BOX.h / 2, y1: s.y + HV_SHOT_BOX.h / 2 };
}

function heroBoxesOverlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

// ---------- shooting with the mouse (FB-0081) ----------
// Left click / a touch tap fires, exactly like holding Z does: a click is one shot, holding the button keeps firing at the cooldown rate
// (HV_SHOT_COOLDOWN_MS, enforced by the step below, never here). The scene forwards its pointer events to these pure functions and sends
// heroPointerShoot() as `input.shoot` every frame. The click that confirms START / RETRY / CONTINUE must not also fire a shot, so the state
// starts "unarmed" (heroPointerReset(), called by startAttempt()) and only arms once the pointer has been up: on a frame where it is not
// held, or on a release. A pointerdown that arrives while unarmed is ignored (it is still remembered as held, so the release arms it).
function heroPointerCreate() {
  return { armed: false, down: false, queuedMs: 0 };
}

function heroPointerReset(pf) {
  pf.armed = false;
  pf.down = false;
  pf.queuedMs = 0;
  return pf;
}

// A pointer went down (left button or a touch). `playing`: the scene is in its 'playing' state, as for the jump keys (FB-0042).
function heroPointerDown(pf, playing) {
  pf.down = true;
  if (playing && pf.armed) pf.queuedMs = HV_POINTER_BUFFER_MS;
}

function heroPointerUp(pf) {
  pf.down = false;
  pf.armed = true;
}

// Once per frame, before stepHeroFight: is the pointer asking for a shot this frame? (held, or a click not yet answered)
function heroPointerShoot(pf, dtMs) {
  if (!pf.armed) {
    if (!pf.down) pf.armed = true;
    pf.queuedMs = 0;
    return false;
  }
  const shoot = pf.down || pf.queuedMs > 0;
  pf.queuedMs = Math.max(0, pf.queuedMs - Math.max(dtMs, 0));
  return shoot;
}

// A shot actually left (the step's 'shoot' event): the click that asked for it is answered.
function heroPointerShotFired(pf) {
  pf.queuedMs = 0;
}

// ---------- one step ----------

// Advances the round by dtMs. `input`: { left, right } held now, `jumpPressed` true on the frame the jump key went down, `shoot` held.
// Returns the events of this step (objects with a `type`): jump, land, shoot, windup, volley, hit, heal, villainHit, clink, splat,
// minionDown, minionBack, defeated, keyDrop, keyLand, win, lose.
function stepHeroFight(state, input, dtMs) {
  const events = [];
  if (state.status !== 'playing') return events;
  const dt = Math.min(Math.max(dtMs, 0), HV_MAX_STEP_MS);
  state.t += dt;
  state.invulnMs = Math.max(0, state.invulnMs - dt);

  heroStepPlayer(state, input || {}, dt, events);

  if (state.phase === 'fight') {
    heroStepVillain(state, dt, events);
    heroStepMinion(state, dt, events);
    heroStepShots(state, dt, events);
    heroStepBolts(state, dt, events);
    heroCollideMinion(state, events);
    if (state.status !== 'playing') return events;
  }
  heroStepPickup(state, dt, events);
  if (state.phase === 'defeated') heroStepBeat(state, dt, events);
  else if (state.phase === 'key') heroStepKey(state, dt, events);
  if (state.status !== 'playing') return events;

  if (state.t >= HV_FAILSAFE_MS) {
    state.status = 'won';
    state.failsafe = true;
    events.push({ type: 'win', failsafe: true });
  }
  return events;
}

function heroSupports(surface, x) {
  if (surface === -1) return true;
  const plat = HV_PLATFORMS[surface];
  return x >= plat.x0 - HV_EDGE_SLACK && x <= plat.x1 + HV_EDGE_SLACK;
}

function heroSurfaceY(surface) {
  return surface === -1 ? HV_FLOOR_Y : HV_PLATFORMS[surface].y;
}

function heroStepPlayer(state, input, dtMs, events) {
  const p = state.player;
  const sec = dtMs / 1000;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) p.facing = dir;
  p.vx = dir * HV_RUN_SPEED;
  p.shootCdMs = Math.max(0, p.shootCdMs - dtMs);
  p.shotMs = Math.max(0, p.shotMs - dtMs);

  // jump buffer (src/minigames/platformer-physics.js): the key pressed a moment before she can jump still counts
  if (input.jumpPressed) p.jumpBufferMs = 0;
  else if (p.jumpBufferMs !== null) p.jumpBufferMs += dtMs;
  if (p.jumpBufferMs !== null && !shouldBufferedJumpFire(p.jumpBufferMs)) p.jumpBufferMs = null;
  const wantsJump = p.jumpBufferMs !== null;

  p.x = Math.min(Math.max(p.x + p.vx * sec, HV_LEFT), HV_RIGHT);
  if (p.grounded && !heroSupports(p.surface, p.x)) { // walked off the end of a platform: she drops
    p.grounded = false;
    p.surface = null;
    p.vy = 0;
    p.sinceGroundMs = 0;
  }
  if (wantsJump && (p.grounded || canCoyoteJump(p.sinceGroundMs))) {
    p.grounded = false;
    p.surface = null;
    p.vy = HV_JUMP_VELOCITY;
    p.sinceGroundMs = HV_NO_COYOTE_MS;
    p.jumpBufferMs = null;
    events.push({ type: 'jump' });
  }
  if (!p.grounded) {
    p.sinceGroundMs += dtMs;
    const prevY = p.y;
    p.vy = integrateGravity(p.vy, sec, HV_GRAVITY);
    p.y += p.vy * sec;
    if (p.vy >= 0) {
      const order = [...HV_PLATFORMS.keys(), -1]; // platforms first (they are higher), the roof last
      for (const surface of order) {
        const y = heroSurfaceY(surface);
        if (prevY <= y && p.y >= y && heroSupports(surface, p.x)) {
          p.y = y;
          p.vy = 0;
          p.grounded = true;
          p.surface = surface;
          p.sinceGroundMs = 0;
          events.push({ type: 'land' });
          break;
        }
      }
    }
  }

  if (input.shoot && state.phase === 'fight' && p.shootCdMs <= 0 && state.shots.length < HV_SHOT_MAX) {
    state.shots.push({ id: state.nextId++, x: p.x + p.facing * 12, y: p.y - HV_SHOT_H, dir: p.facing, travelled: 0 });
    p.shootCdMs = HV_SHOT_COOLDOWN_MS;
    p.shotMs = 160;
    events.push({ type: 'shoot' });
  }
}

// ---------- the villain ----------

function heroRestMsFor(state) {
  const pattern = heroVillainPattern(state);
  return Math.round(HV_REST_MS[pattern] * (heroVillainRage(state) ? HV_RAGE_REST_FACTOR : 1));
}

function heroStepVillain(state, dtMs, events) {
  const v = state.villain;
  v.invulnMs = Math.max(0, v.invulnMs - dtMs);
  if (v.phase === 'down') return;
  if (v.hover !== v.hoverTo) { // rising or sinking to the height of the next volley
    const step = HV_VILLAIN_RISE_SPEED * (dtMs / 1000);
    v.hover = Math.abs(v.hoverTo - v.hover) <= step ? v.hoverTo : v.hover + Math.sign(v.hoverTo - v.hover) * step;
  }

  // he steps along his zone while he rests; he stands still to wind up and shoot (readable)
  if (v.phase === 'rest') {
    if (v.pauseMs > 0) v.pauseMs = Math.max(0, v.pauseMs - dtMs);
    else {
      v.x += v.dir * HV_VILLAIN_SPEED * (dtMs / 1000);
      if (v.x <= HV_VILLAIN_ZONE.x0) { v.x = HV_VILLAIN_ZONE.x0; v.dir = 1; v.pauseMs = HV_VILLAIN_EDGE_PAUSE_MS; }
      else if (v.x >= HV_VILLAIN_ZONE.x1) { v.x = HV_VILLAIN_ZONE.x1; v.dir = -1; v.pauseMs = HV_VILLAIN_EDGE_PAUSE_MS; }
    }
  }
  if (!state.hazardsEnabled) return; // practice mode for the tests: he strolls, he never shoots

  v.phaseMs += dtMs;
  if (v.phase === 'rest') {
    if (v.phaseMs >= v.restMs) {
      v.phase = 'windup';
      v.phaseMs = 0;
      events.push({ type: 'windup', pattern: heroVillainPattern(state) });
    }
  } else if (v.phase === 'windup') {
    if (v.phaseMs >= HV_WINDUP_MS) heroFireVolley(state, events);
  } else if (v.phase === 'fire') {
    v.sweepMs += dtMs;
    const degrees = heroVillainRage(state) ? HV_SWEEP_DEGREES_RAGE : HV_SWEEP_DEGREES;
    while (v.sweepIndex < degrees.length && v.sweepMs >= v.sweepIndex * HV_SWEEP_INTERVAL_MS) {
      heroFireBolt(state, degrees[v.sweepIndex], HV_BOLT_SPEED.sweep);
      v.sweepIndex++;
    }
    if (v.sweepIndex >= degrees.length) heroEndVolley(state);
  }
}

// The aim: from his muzzle to her chest, right now.
function heroAimAngle(state) {
  const v = state.villain;
  const p = state.player;
  const side = p.x < v.x ? -1 : 1;
  const ox = v.x + side * 16;
  const oy = heroVillainFeetY(state) - HV_VILLAIN_MUZZLE_H;
  return Math.atan2(p.y - 18 - oy, p.x - ox);
}

function heroFireBolt(state, offsetDegrees, speed) {
  const v = state.villain;
  const p = state.player;
  const side = p.x < v.x ? -1 : 1;
  const angle = heroAimAngle(state) + (offsetDegrees * Math.PI) / 180;
  state.bolts.push({
    id: state.nextId++,
    x: v.x + side * 16,
    y: heroVillainFeetY(state) - HV_VILLAIN_MUZZLE_H,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  });
}

function heroFireVolley(state, events) {
  const v = state.villain;
  const pattern = heroVillainPattern(state);
  const rage = heroVillainRage(state);
  if (pattern === 'aimed') {
    heroFireBolt(state, 0, HV_BOLT_SPEED.aimed);
  } else if (pattern === 'fan') {
    for (const degrees of rage ? HV_FAN_DEGREES_RAGE : HV_FAN_DEGREES) heroFireBolt(state, degrees, HV_BOLT_SPEED.fan);
  } else { // sweep: the bolts go out one at a time (heroStepVillain's 'fire' phase)
    v.phase = 'fire';
    v.phaseMs = 0;
    v.sweepIndex = 0;
    v.sweepMs = 0;
    events.push({ type: 'volley', pattern });
    return;
  }
  events.push({ type: 'volley', pattern });
  heroEndVolley(state);
}

function heroEndVolley(state) {
  const v = state.villain;
  v.plan++;
  v.phase = 'rest';
  v.phaseMs = 0;
  v.restMs = heroRestMsFor(state);
  v.hoverTo = heroVillainPattern(state) === 'aimed' ? HV_VILLAIN_HOVER_LOW : HV_VILLAIN_HOVER_HIGH;
}

// ---------- the minion ----------

function heroStepMinion(state, dtMs, events) {
  const m = state.minion;
  if (!state.hazardsEnabled) return;
  if (!m.alive) {
    if (m.respawnMs > 0) {
      m.respawnMs = Math.max(0, m.respawnMs - dtMs);
      if (m.respawnMs === 0) { // it comes back at the end of its beat that is farther from her
        const fromLeft = Math.abs(state.player.x - HV_MINION.x0) > Math.abs(state.player.x - HV_MINION.x1);
        m.alive = true;
        m.x = fromLeft ? HV_MINION.x0 : HV_MINION.x1;
        m.dir = fromLeft ? 1 : -1;
        events.push({ type: 'minionBack', x: m.x });
      }
    }
    return;
  }
  m.x += m.dir * HV_MINION.speed * (dtMs / 1000);
  if (m.x <= HV_MINION.x0) { m.x = HV_MINION.x0; m.dir = 1; }
  else if (m.x >= HV_MINION.x1) { m.x = HV_MINION.x1; m.dir = -1; }
}

function heroMinionDown(state, events) {
  const m = state.minion;
  m.alive = false;
  m.kills++;
  m.respawnMs = HV_MINION_RESPAWN_MS;
  events.push({ type: 'minionDown', x: m.x });
  if (!state.heartDropped) { // at most one heart per round
    state.heartDropped = true;
    state.pickup = { x: m.x, ms: HV_PICKUP_MS };
  }
}

function heroCollideMinion(state, events) {
  if (!state.minion.alive || state.invulnMs > 0) return;
  if (heroBoxesOverlap(heroPlayerBox(state), heroMinionBox(state))) heroHurtPlayer(state, events, 'minion', state.minion.x, HV_FLOOR_Y - 10);
}

function heroStepPickup(state, dtMs, events) {
  const pick = state.pickup;
  if (!pick) return;
  pick.ms -= dtMs;
  if (pick.ms <= 0) { state.pickup = null; return; }
  const p = state.player;
  if (state.hearts < HV_HEARTS && Math.abs(p.x - pick.x) <= HV_PICKUP_REACH && p.y >= HV_FLOOR_Y - 60) {
    state.hearts++;
    state.pickup = null;
    events.push({ type: 'heal', hearts: state.hearts });
  }
}

// ---------- shots and bolts ----------

function heroStepShots(state, dtMs, events) {
  const sec = dtMs / 1000;
  const keep = [];
  for (const s of state.shots) {
    const step = HV_SHOT_SPEED * sec;
    s.x += s.dir * step;
    s.travelled += step;
    let alive = s.travelled <= HV_SHOT_RANGE && s.x > -20 && s.x < HV_W + 20;
    if (alive && state.minion.alive && heroBoxesOverlap(heroShotBox(s), heroMinionBox(state))) {
      heroMinionDown(state, events);
      alive = false;
    } else if (alive && state.villain.phase !== 'down' && heroBoxesOverlap(heroShotBox(s), heroVillainBox(state))) {
      alive = false;
      const v = state.villain;
      if (heroVillainShielded(state)) {
        events.push({ type: 'clink', x: s.x, y: s.y });
      } else {
        v.hp -= 1;
        v.invulnMs = HV_VILLAIN_HIT_INVULN_MS;
        events.push({ type: 'villainHit', hp: v.hp, hits: heroHitsLanded(state), x: s.x, y: s.y });
        if (v.hp <= 0) heroDefeat(state, events);
      }
    }
    if (alive) keep.push(s);
  }
  state.shots = state.phase === 'fight' ? keep : [];
}

function heroStepBolts(state, dtMs, events) {
  const sec = dtMs / 1000;
  const keep = [];
  for (const b of state.bolts) {
    b.x += b.vx * sec;
    b.y += b.vy * sec;
    if (b.y >= HV_FLOOR_Y - 2) { events.push({ type: 'splat', x: b.x, y: HV_FLOOR_Y }); continue; }
    if (b.x < -30 || b.x > HV_W + 30 || b.y < -30) continue;
    if (state.invulnMs <= 0 && heroBoxesOverlap(heroBoltBox(b), heroPlayerBox(state))) {
      heroHurtPlayer(state, events, 'bolt', b.x, b.y);
      continue; // it breaks on her
    }
    keep.push(b);
  }
  state.bolts = keep;
}

function heroHurtPlayer(state, events, source, x, y) {
  state.hearts -= 1;
  state.invulnMs = HV_INVULN_MS;
  events.push({ type: 'hit', hearts: state.hearts, source, x, y });
  if (state.hearts <= 0) {
    state.status = 'lost';
    events.push({ type: 'lose' });
  }
}

// ---------- the end of the fight: the beat, the key, the win ----------

function heroDefeat(state, events) {
  const v = state.villain;
  const x = v.x;
  const y = heroVillainFeetY(state);
  v.phase = 'down';
  state.phase = 'defeated';
  state.bolts = [];
  state.shots = [];
  state.minion.alive = false;
  state.beatMs = 0;
  events.push({ type: 'defeated', x, y });
}

function heroStepBeat(state, dtMs, events) {
  state.beatMs += dtMs;
  if (state.beatMs < HV_DEFEAT_BEAT_MS) return;
  const v = state.villain;
  state.phase = 'key';
  state.key = { x: v.x, y: HV_FLOOR_Y - 70, vy: 0, landed: false };
  state.keyMs = 0;
  events.push({ type: 'keyDrop', x: v.x });
}

function heroStepKey(state, dtMs, events) {
  const key = state.key;
  const sec = dtMs / 1000;
  state.keyMs += dtMs;
  if (!key.landed) {
    key.vy += HV_KEY_GRAVITY * sec;
    key.y += key.vy * sec;
    if (key.y >= HV_FLOOR_Y) {
      key.y = HV_FLOOR_Y;
      key.vy = 0;
      key.landed = true;
      events.push({ type: 'keyLand', x: key.x });
    }
  } else if (state.keyMs >= HV_KEY_MAGNET_MS) { // she is slow: it comes to her
    const toward = Math.sign(state.player.x - key.x);
    key.x += toward * Math.min(Math.abs(state.player.x - key.x), HV_KEY_MAGNET_SPEED * sec);
  }
  const p = state.player;
  const taken = Math.abs(p.x - key.x) <= HV_KEY_REACH && p.y - key.y >= -60 && p.y - key.y <= 4;
  if (taken || state.keyMs >= HV_KEY_FAILSAFE_MS) {
    state.status = 'won';
    state.failsafe = !taken;
    events.push({ type: 'win', failsafe: !taken });
  }
}
