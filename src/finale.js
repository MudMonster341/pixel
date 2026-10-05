// The birthday finale's pure logic (W3, docs/plans/2026-10-04-day3-feedback-and-wow.md): the cake with 22 candles she blows
// out by HOLDING a key, then fireworks over the Dubai skyline and a chiptune "Happy Birthday to You". The chain is
// box opening -> FINALE -> card -> credits -> title (docs/STORY.md "the ending"). No Phaser here: src/scenes/finale.js only
// draws and plays what these functions decide, and src/finale-art.js holds the drawing (as plain shape lists), so the
// blow rules, the soft-lock failsafes, the phase times and the whole firework show are unit-tested without a browser
// (tests/unit/finale.test.js) and everything is deterministic: no Math.random() anywhere in the schedule.
//
// Loaded after src/card.js (the name text goes through renderCardText, the same helper the card and the credits use).

const FINALE = {
  candleCount: 22,
  blowMs: 3000, // holding the key this long blows out ALL the candles (about 136 ms per candle)
  hintAfterMs: 8000, // no progress for this long: "Hold SPACE to blow!" starts to pulse
  autoBlowAtMs: 20000, // this long after the scene started the rest of the flames go out by themselves
  fadeInMs: 900, // from the warm light the box opening ends on into the scene
  wishMs: 1500, // the silence and "Make a wish..." once the last flame is out
  flashMs: 450, // the warm flash that opens the fireworks
  celebrationMs: 15600, // fireworks + the song + "Happy Birthday, <name>!" (the song is songMs long, the rest is its ring-out)
  songMs: 14900, // tools/make-audio.js synthHappyBirthday(); tests/unit/finale.test.js checks the WAV is this long
  fireworksMs: 12000, // the bursts all happen inside this window of the celebration
  skipAfterMs: 2000, // a skip key works this long after the fireworks begin (never during the candles)
  leaveFadeMs: 500, // camera fade-out to the card
  leaveFailsafeMs: 1300, // the hand-off to the card happens at the latest this long after the fade began
};

const FINALE_BLOW_KEYS = ['SPACE', 'E', 'ENTER']; // HOLD any of these (or the mouse / a finger) to blow

// {name} is the recipient, resolved by buildCardConfig() (src/card.js), "Taru" unless card.json says otherwise.
const FINALE_TEXT = {
  wish: 'Make a wish, {name}!',
  sub: 'Hold SPACE (or the mouse) to blow out the candles',
  hint: 'Hold SPACE to blow!',
  silence: 'Make a wish...',
  birthday: 'Happy Birthday, {name}!',
  skip: 'PRESS ENTER TO CONTINUE',
};

function finaleText(key, name) {
  return renderCardText(FINALE_TEXT[key] || '', name);
}

// Where the cake's candles stand: one ring on the top tier's whipped-cream surface (an ellipse, because the table is
// seen from a little above), cx/cy the ring's centre. Screen coordinates of the 960x540 scene.
const FINALE_CAKE = { cx: 480, cy: 382, rx: 108, ry: 11, candleH: 20 };

// Seeded random numbers (mulberry32): the same stream on every run, so the show, the skyline and the tests never drift.
function finaleRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A small integer hash -> 0..1, for per-window / per-candle choices that must not depend on call order.
function finaleHash(a, b) {
  let h = Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return ((h >>> 0) % 100000) / 100000;
}

// ---------- the candles ----------

// Candle i's base (where the stick meets the cake), evenly spaced round the ring, the first one just right of the back.
function candlePositions(count = FINALE.candleCount) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI * 2 - Math.PI / 2;
    out.push({ index: i, x: Math.round(FINALE_CAKE.cx + Math.cos(a) * FINALE_CAKE.rx), y: Math.round(FINALE_CAKE.cy + Math.sin(a) * FINALE_CAKE.ry) });
  }
  return out;
}

// The order the flames go out in: a breath sweeping across the cake from the side she stands on (left) to the far side,
// ties (same column) front before back. Deterministic: a list of candle indices.
function candleOutOrder(count = FINALE.candleCount) {
  return candlePositions(count)
    .sort((a, b) => a.x - b.x || b.y - a.y || a.index - b.index)
    .map((c) => c.index);
}

// Blowing progress 0..1. Holding fills it at 1/blowMs per millisecond; releasing keeps it where it is (the blown-out
// candles stay out). `dtMs` is capped by the caller (a long frame must not blow half the cake in one go).
function blowStep(progress, holding, dtMs, blowMs = FINALE.blowMs) {
  if (!holding) return progress;
  return Math.min(1, progress + Math.max(0, dtMs) / blowMs);
}

// How many flames are out at this progress: 0 at the start, all of them exactly at 1.
function candlesOutCount(progress, count = FINALE.candleCount) {
  if (progress >= 1) return count;
  return Math.max(0, Math.min(count, Math.floor(progress * count + 1e-9)));
}

// Which candles are out: the first `candlesOutCount` of the order. -> a Set of candle indices.
function candlesOutSet(progress, order = candleOutOrder(), count = order.length) {
  return new Set(order.slice(0, candlesOutCount(progress, count)));
}

// The soft-lock guards: `elapsedMs` since the scene started, `sinceProgressMs` since the progress last rose (or the start).
// hint: show the pulsing "Hold SPACE to blow!"; autoBlow: the flames go out by themselves from now on.
function blowFailsafe(elapsedMs, sinceProgressMs, progress) {
  if (progress >= 1) return { hint: false, autoBlow: false };
  return { hint: sinceProgressMs >= FINALE.hintAfterMs, autoBlow: elapsedMs >= FINALE.autoBlowAtMs };
}

// One flame's look this instant. `blow` 0..1 is how hard she is blowing right now (smoothed by the scene): the flames lean
// away from her (to the right) and flicker harder; `index` offsets each flame's phase so they never move in step.
function flameShape(index, tMs, blow) {
  const phase = index * 1.7;
  const flick = (Math.sin(tMs / 90 + phase) + Math.sin(tMs / 37 + phase * 2.1)) / 2; // -1..1
  const amp = 0.08 + 0.35 * blow;
  const lean = blow * (4 + 3 * (0.5 + 0.5 * Math.sin(tMs / 70 + phase)));
  return {
    lean,
    h: 13 * (1 + flick * amp) * (1 - 0.25 * blow),
    w: 7 * (1 - flick * amp * 0.5) * (1 - 0.2 * blow),
    glow: 1 + flick * amp * 0.5,
  };
}

// A few rising wisps of smoke from a candle that went out `ageMs` ago; empty once they have faded (about 2 s).
const SMOKE_LIFE_MS = 2000;
function smokeWisps(index, ageMs) {
  if (ageMs < 0 || ageMs >= SMOKE_LIFE_MS) return [];
  const out = [];
  for (let w = 0; w < 4; w++) {
    const age = ageMs - w * 160;
    if (age <= 0) continue;
    const u = age / (SMOKE_LIFE_MS - 480);
    if (u >= 1) continue;
    out.push({
      dx: Math.sin(age / 260 + index + w) * (3 + u * 5) + u * 4, // drifts a little right, with the breath
      dy: -u * 46,
      r: 1.5 + u * 3,
      a: 0.5 * (1 - u) * (u < 0.1 ? u / 0.1 : 1),
    });
  }
  return out;
}

// ---------- the schedule (milliseconds from the scene's start) ----------

// Everything after the last flame went out (`allOutAtMs`): the silence and "Make a wish...", the warm flash, then the
// celebration (fireworks + song + the big text). The skip is allowed from `skipFrom`; the scene hands to the card at `end`.
function finaleSchedule(allOutAtMs) {
  const wishStart = allOutAtMs;
  const flashStart = wishStart + FINALE.wishMs;
  const celebrationStart = flashStart + FINALE.flashMs;
  return {
    wishStart,
    flashStart,
    celebrationStart,
    skipFrom: celebrationStart + FINALE.skipAfterMs,
    celebrationEnd: celebrationStart + FINALE.celebrationMs,
  };
}

// Which phase the clock is in: 'candles' until the last flame is out, then 'wish', 'flash', 'celebration', 'leaving'.
function finalePhaseAt(schedule, elapsedMs) {
  if (!schedule) return 'candles';
  if (elapsedMs >= schedule.celebrationEnd) return 'leaving';
  if (elapsedMs >= schedule.celebrationStart) return 'celebration';
  if (elapsedMs >= schedule.flashStart) return 'flash';
  return 'wish';
}

// May a skip key / click leave the finale now? Never while the candles are the interaction; only after the grace period of the fireworks.
function finaleCanSkip(schedule, elapsedMs) {
  return Boolean(schedule) && elapsedMs >= schedule.skipFrom && elapsedMs < schedule.celebrationEnd + FINALE.leaveFadeMs;
}

// ---------- the fireworks ----------

const FIREWORK_SEED = 2210;
const FIREWORK_COLORS = [0xffa3c6, 0xffc4a3, 0xcdb6ff, 0xffe29a, 0xbfe0ff, 0xc9f0c4, 0xffb3d1, 0xfff0cf]; // the credits' pastels (CREDITS_HEART_COLORS / CONFETTI)
const FIREWORK_LAUNCH_MS = 650; // the rocket's rise before the burst
const FIREWORK_DRAG = 1.8; // 1/s: a spark's speed decays by this much, so it settles at a distance
const FIREWORK_GRAVITY = 70; // px/s^2 pulling the sparks down gently
const FIREWORK_LAUNCH_Y = 372; // the skyline's base: the rockets rise from behind the buildings
const FIREWORK_MAX_LIFE_MS = 1800;

// The show, in celebration time (ms after the flash). A hand-written cadence (slow start, a steady middle, a triple
// finale) with seeded positions and colours; every burst: when it explodes, where, what shape.
const FIREWORK_TIMES = [
  { t: 800, kind: 'sparks' }, { t: 1700, kind: 'ring' }, { t: 2500, kind: 'sparks' }, { t: 3300, kind: 'heart' },
  { t: 4200, kind: 'sparks' }, { t: 4900, kind: 'ring' }, { t: 5700, kind: 'sparks' }, { t: 6500, kind: 'heart' },
  { t: 7300, kind: 'ring' }, { t: 8100, kind: 'sparks' }, { t: 8800, kind: 'sparks' }, { t: 9600, kind: 'heart' },
  { t: 10400, kind: 'sparks' }, { t: 10750, kind: 'ring' }, { t: 11100, kind: 'heart', crackle: true },
];
const FIREWORK_SLOTS_X = [130, 240, 350, 480, 590, 700, 810, 220, 420, 640, 330, 760]; // spread over the sky, picked in a seeded order

function fireworkSchedule(seed = FIREWORK_SEED) {
  const rng = finaleRng(seed);
  const slots = FIREWORK_SLOTS_X.slice();
  for (let i = slots.length - 1; i > 0; i--) { // seeded shuffle
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return FIREWORK_TIMES.map((entry, i) => {
    const colorA = Math.floor(rng() * FIREWORK_COLORS.length);
    const colorB = (colorA + 2 + Math.floor(rng() * 4)) % FIREWORK_COLORS.length;
    const kind = entry.kind;
    return {
      index: i,
      t: entry.t,
      launchMs: FIREWORK_LAUNCH_MS,
      x: slots[i % slots.length] + Math.round((rng() - 0.5) * 30),
      y: 90 + Math.round(rng() * 110),
      kind,
      color: FIREWORK_COLORS[colorA],
      color2: FIREWORK_COLORS[colorB],
      count: kind === 'ring' ? 24 + 4 * Math.floor(rng() * 3) : kind === 'heart' ? 36 : 26 + Math.floor(rng() * 15),
      crackle: Boolean(entry.crackle) || (kind === 'sparks' && rng() < 0.4),
      seed: Math.floor(rng() * 1e9),
    };
  });
}

// The sparks of one burst, each with a velocity (px/s), a life (ms), a size and which of the two colours it has.
function burstParticles(burst) {
  const rng = finaleRng(burst.seed);
  const out = [];
  for (let i = 0; i < burst.count; i++) {
    let vx;
    let vy;
    if (burst.kind === 'ring') {
      const a = (i / burst.count) * Math.PI * 2;
      vx = Math.cos(a) * 190;
      vy = Math.sin(a) * 190;
    } else if (burst.kind === 'heart') {
      const a = (i / burst.count) * Math.PI * 2;
      vx = 16 * Math.pow(Math.sin(a), 3) * 15;
      vy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * 15;
    } else {
      const a = rng() * Math.PI * 2;
      const speed = 60 + rng() * 160;
      vx = Math.cos(a) * speed;
      vy = Math.sin(a) * speed;
    }
    out.push({
      vx, vy,
      life: Math.round(1100 + rng() * (FIREWORK_MAX_LIFE_MS - 1100)),
      size: rng() < 0.3 ? 4 : 3,
      second: rng() < 0.3,
    });
  }
  return out;
}

// Where a spark is `ageMs` after the burst, relative to the burst point, and how visible: closed form (drag + gravity), so
// nothing has to be stepped or stored. -> { x, y, alpha, size } or null when the spark has faded out.
function sparkAt(particle, ageMs) {
  if (ageMs < 0 || ageMs >= particle.life) return null;
  const t = ageMs / 1000;
  const travel = (1 - Math.exp(-FIREWORK_DRAG * t)) / FIREWORK_DRAG;
  const u = ageMs / particle.life;
  const alpha = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
  return {
    x: particle.vx * travel,
    y: particle.vy * travel + 0.5 * FIREWORK_GRAVITY * t * t,
    alpha: alpha * (0.75 + 0.25 * Math.sin(ageMs / 45 + particle.vx)), // a slight twinkle
    size: u > 0.8 ? Math.max(1, particle.size - 1) : particle.size,
  };
}

// The rising rocket of a burst at celebration time `ms` (before the burst): its head and a short trail. null outside the launch.
function rocketAt(burst, ms) {
  const start = burst.t - burst.launchMs;
  if (ms < start || ms >= burst.t) return null;
  const pos = (m) => {
    const u = Math.min(1, Math.max(0, (m - start) / burst.launchMs));
    const e = 1 - (1 - u) * (1 - u); // ease out: fast, then slowing near the top
    return { x: burst.x - 14 * (1 - e), y: FIREWORK_LAUNCH_Y + (burst.y - FIREWORK_LAUNCH_Y) * e };
  };
  const head = pos(ms);
  const trail = [];
  for (let i = 1; i <= 5; i++) {
    if (ms - i * 28 < start) break;
    const p = pos(ms - i * 28);
    trail.push({ x: p.x, y: p.y, a: 0.7 - i * 0.12 });
  }
  return { x: head.x, y: head.y, trail };
}

// The moment a burst is brightest: a short flash at the burst point (alpha 0..1 over the first 160 ms).
function burstFlash(burst, ms) {
  const age = ms - burst.t;
  if (age < 0 || age > 160) return 0;
  return 1 - age / 160;
}

// The end of the last spark of the show, in celebration time.
function fireworkShowEndMs(schedule = fireworkSchedule()) {
  return Math.max(...schedule.map((b) => b.t + Math.max(...burstParticles(b).map((p) => p.life))));
}

// ---------- the skyline's windows ----------

// Is this window lit right now? `base` is its resting state (from the skyline's own seed); during the celebration a share of
// the windows flicker (they change state every ~220 ms in a window-specific rhythm), otherwise they only twinkle very rarely.
function windowLit(index, base, tMs, excited) {
  const bucket = Math.floor(tMs / (excited ? 220 : 2200));
  const flips = finaleHash(index, bucket) < (excited ? 0.22 : 0.025);
  return flips ? !base : base;
}
