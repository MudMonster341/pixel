// Juice pass (wow idea W5): the small, code-drawn polish that makes the game feel alive -- the key-pickup sparkle that flies to the HUD, the
// gentle shake/flash/confetti of the mini-games, and the "!" / heart emotes over campus people. Plain script, no build step. The first half is
// PURE (the numbers and plans, unit-tested in tests/unit/juice.test.js); the second half draws them with shapes only (no textures, so Canvas and
// WebGL agree) and touches Phaser only when it is CALLED, so loading this file needs nothing. Every effect is cosmetic: it never blocks input,
// never waits on anything, destroys everything it made (its own tweens first) and has a wall-clock failsafe, so a scene change can't leave a
// sparkle behind. `?juice=0` (dev and tests: tests/e2e/helpers.js sets it for every spec) turns the whole pass off.

const JUICE = {
  keyMaxParticles: 24, // the most sparkle sprites one key pickup may ever have alive (burst + flyers)
  keyBurstCount: 10, // golden sparks popping out at the pickup spot
  keyFlyCount: 6, // sparkles that arc across to the HUD's key counter
  keyTotalMaxMs: 1200, // the whole effect, pickup to the counter's pop, is never longer than this
  keyFlyMs: 560, // one flyer's trip (plus up to 60 ms of jitter)
  keyFlyStaggerMs: 50, // each flyer leaves this much after the one before
  keyPopMs: 140, // the counter's little scale pulse (up and back)
  keyFailsafeSlackMs: 250, // on top of the effect's own length: if anything is still alive by then it is destroyed
  shakeMaxMs: 150, // no camera shake is ever longer...
  shakeMaxIntensity: 0.004, // ...or stronger than this (Phaser's fraction of the view: ~4 px on a 960 px screen), a cute game, not a rattle
  confettiCount: 22, // a win's burst of paper bits (never above keyMaxParticles)
  confettiMs: 1000, // one piece's whole flight
  alertMs: 800, // the "!" over a person who stops and turns to her
  heartMs: 1000, // the heart over a friend when the talk ends (the cat's heart uses the same)
};

const JUICE_GOLD = [0xffd23f, 0xfff1a8, 0xffffff, 0xffb347]; // the key sparkle's golds (the box-opening sparks' and the unicorn trail's family)
const JUICE_CONFETTI = [0xffb3d1, 0xffe3a3, 0xbfe0ff, 0xd9c3ff, 0xc9f0c4]; // the card's and the credits' pastels (no white: it vanishes on the win card)

// ---------- pure ----------

// `?juice=0` turns the pass off. `search` is injectable, the same pattern as daylightEnabled() in src/daylight.js.
function juiceEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('juice') !== '0';
}

// A camera shake request clamped to the gentle range: { ms, intensity } (NaN or negative = no shake at all).
function clampShake(ms, intensity) {
  const m = Number.isFinite(ms) ? Math.max(0, Math.min(JUICE.shakeMaxMs, ms)) : 0;
  const i = Number.isFinite(intensity) ? Math.max(0, Math.min(JUICE.shakeMaxIntensity, intensity)) : 0;
  return { ms: m, intensity: i };
}

// A world point on the screen: the camera shows the world rectangle `view` ({ x, y } its top-left, i.e. camera.worldView) magnified by `zoom`.
// Clamped to the screen (with a margin) so a pickup at the edge still sparkles where it can be seen.
function worldToScreen(x, y, view, zoom, width = 960, height = 540, margin = 12) {
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  const vx = view && Number.isFinite(view.x) ? view.x : 0;
  const vy = view && Number.isFinite(view.y) ? view.y : 0;
  return {
    x: Math.max(margin, Math.min(width - margin, (x - vx) * z)),
    y: Math.max(margin, Math.min(height - margin, (y - vy) * z)),
  };
}

// The point at t (0..1) on the quadratic curve p0 -> ctrl -> p1: a sparkle's arc through the air.
function arcPoint(p0, ctrl, p1, t) {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * ctrl.x + t * t * p1.x,
    y: u * u * p0.y + 2 * u * t * ctrl.y + t * t * p1.y,
  };
}

// The whole key-pickup effect as data: `burst` (sparks that pop out of `from` and fade), `flyers` (sparkles that leave `from` one after the
// other and arc to `to` along a quadratic curve bowed upwards), `popAtMs` (when the last flyer lands: the HUD counter pulses) and `totalMs`.
// The caps are enforced here, not trusted from the constants: at most keyMaxParticles sprites, never longer than keyTotalMaxMs.
function keySparklePlan(from, to, rng = Math.random) {
  const burstN = Math.max(0, Math.min(JUICE.keyBurstCount, JUICE.keyMaxParticles));
  const flyN = Math.max(0, Math.min(JUICE.keyFlyCount, JUICE.keyMaxParticles - burstN));
  const pick = () => JUICE_GOLD[Math.floor(rng() * JUICE_GOLD.length) % JUICE_GOLD.length];
  const burst = [];
  for (let i = 0; i < burstN; i++) {
    const angle = (i / Math.max(1, burstN)) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const dist = 16 + rng() * 22;
    burst.push({ dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist - 6, size: 2.5 + rng() * 2, color: pick(), ms: 380 + rng() * 140 });
  }
  const flyers = [];
  let popAtMs = 0;
  const midX = (from.x + to.x) / 2;
  const topY = Math.min(from.y, to.y);
  for (let i = 0; i < flyN; i++) {
    const delayMs = i * JUICE.keyFlyStaggerMs;
    const ms = JUICE.keyFlyMs + rng() * 60;
    flyers.push({ delayMs, ms, size: 3 + rng() * 2, color: pick(), ctrl: { x: midX + (rng() - 0.5) * 50, y: topY - 50 - rng() * 30 } });
    popAtMs = Math.max(popAtMs, delayMs + ms);
  }
  const totalMs = Math.min(JUICE.keyTotalMaxMs, Math.max(popAtMs + JUICE.keyPopMs, ...burst.map((b) => b.ms)));
  return { burst, flyers, popAtMs: Math.min(popAtMs, totalMs - JUICE.keyPopMs), totalMs, count: burst.length + flyers.length };
}

// A win's confetti as data: pieces thrown up and out from `origin`, then falling and fading. Capped at confettiCount (itself <= 24).
function confettiPlan(origin, rng = Math.random) {
  const n = Math.max(0, Math.min(JUICE.confettiCount, JUICE.keyMaxParticles));
  const pieces = [];
  for (let i = 0; i < n; i++) {
    pieces.push({
      x: origin.x, y: origin.y,
      dx: (rng() - 0.5) * 300, rise: 40 + rng() * 60, fall: 70 + rng() * 80,
      w: 3 + Math.floor(rng() * 3), h: 5 + Math.floor(rng() * 3),
      color: JUICE_CONFETTI[Math.floor(rng() * JUICE_CONFETTI.length) % JUICE_CONFETTI.length],
      spin: (rng() - 0.5) * 6, delayMs: Math.floor(rng() * 80),
    });
  }
  return { pieces, riseMs: 330, fallMs: JUICE.confettiMs - 330 - 80 };
}

// A named friend (src/ambient.js `name`) who is not a professor: the heart over a talk's end is theirs. Professors keep their composure.
function isNamedFriend(def) {
  return Boolean(def && def.name) && !/^npc-prof-/.test(def.sheet || '');
}

// The emote over an ambient person: 'start' (E pressed, she stopped and turned to her) is a "!" once per talk; 'end' (the dialog closed) is a
// heart over a named friend. Never while a script or a moment owns the screen, never twice. Returns { kind, holdMs } or null.
function talkEmote(phase, def, { scriptRunning = false, alertShown = false } = {}) {
  if (scriptRunning) return null;
  if (phase === 'start') return alertShown ? null : { kind: '!', holdMs: JUICE.alertMs };
  if (phase === 'end') return isNamedFriend(def) ? { kind: 'heart', holdMs: JUICE.heartMs } : null;
  return null;
}

// ---------- drawing (shapes only; Phaser is read when called) ----------

// Gentle camera shake, silent-safe: nothing happens with juice off, with the OS asking for reduced motion, or with no camera.
function shakeCamera(scene, ms, intensity) {
  try {
    if (!juiceEnabled()) return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const s = clampShake(ms, intensity);
    if (s.ms > 0 && s.intensity > 0 && scene.cameras && scene.cameras.main) scene.cameras.main.shake(s.ms, s.intensity);
  } catch (error) { /* decoration only */ }
}

// One full-screen colour pulse that fades out and destroys itself (a single fade, never a repeating flash: GAME_FEEL.md).
function flashOverlay(scene, color, alpha, ms, depth) {
  try {
    if (!juiceEnabled()) return;
    const flash = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, color, alpha).setOrigin(0, 0).setDepth(depth).setScrollFactor(0);
    scene.tweens.add({ targets: flash, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
  } catch (error) { /* decoration only */ }
}

// Owns a bunch of cosmetic objects and tweens: destroy() stops every tween first (a tween left running on a destroyed object throws), then
// destroys the objects; calling it twice is harmless. A wall-clock timer and the scene's shutdown both call it, so nothing can linger.
function juiceBag(scene, lifeMs) {
  const objects = [];
  const tweens = [];
  let done = false;
  let timer = null;
  const bag = {
    get done() { return done; },
    object(o) { objects.push(o); return o; },
    tween(config) { const t = scene.tweens.add(config); tweens.push(t); return t; },
    destroy() {
      if (done) return;
      done = true;
      if (timer) { try { timer.remove(false); } catch (error) { /* gone */ } }
      for (const t of tweens) { try { t.stop(); } catch (error) { /* gone */ } }
      for (const o of objects) { try { o.destroy(); } catch (error) { /* gone */ } }
      try { scene.events.off('shutdown', bag.destroy); } catch (error) { /* gone */ }
    },
  };
  timer = scene.time.delayedCall(lifeMs, bag.destroy); // the failsafe
  scene.events.once('shutdown', bag.destroy);
  return bag;
}

// The key-pickup sparkle, drawn in `scene` (the UI scene, so the positions are screen pixels): a burst at `from`, then flyers arcing to `to`;
// `onArrive` fires once when the last one lands (the HUD counter's pulse). Returns the bag (destroy() cuts it short) or null if it can't run.
function playKeySparkle(scene, from, to, onArrive, rng = Math.random) {
  try {
    if (!juiceEnabled() || !scene || !scene.add || !scene.tweens) return null;
    const plan = keySparklePlan(from, to, rng);
    const bag = juiceBag(scene, plan.totalMs + JUICE.keyFailsafeSlackMs);
    const star = (x, y, size, color) => bag.object(scene.add.star(x, y, 4, size * 0.4, size, color).setDepth(1000));
    for (const b of plan.burst) {
      const s = star(from.x, from.y, b.size, b.color);
      bag.tween({ targets: s, x: from.x + b.dx, y: from.y + b.dy, alpha: 0, scale: 0.3, duration: b.ms, ease: 'Cubic.easeOut', onComplete: () => s.destroy() });
    }
    for (const f of plan.flyers) {
      const s = star(from.x, from.y, f.size, f.color).setAlpha(0);
      const proxy = { t: 0 };
      bag.tween({
        targets: proxy, t: 1, delay: f.delayMs, duration: f.ms, ease: 'Sine.easeInOut',
        onStart: () => s.setAlpha(1),
        onUpdate: () => { const p = arcPoint(from, f.ctrl, to, proxy.t); s.setPosition(p.x, p.y).setScale(1 - 0.5 * proxy.t); },
        onComplete: () => s.destroy(),
      });
    }
    if (onArrive) bag.object(scene.time.delayedCall(plan.popAtMs, () => { if (!bag.done) onArrive(); }));
    return bag;
  } catch (error) {
    return null;
  }
}

// A win's confetti burst, in screen pixels, pinned to the screen (a scrolling mini-game camera must not carry it away).
function playConfettiBurst(scene, origin, depth = 204, rng = Math.random) {
  try {
    if (!juiceEnabled() || !scene || !scene.add || !scene.tweens) return null;
    const plan = confettiPlan(origin, rng);
    const bag = juiceBag(scene, JUICE.confettiMs + 400);
    for (const p of plan.pieces) {
      const piece = bag.object(scene.add.rectangle(p.x, p.y, p.w, p.h, p.color).setDepth(depth).setScrollFactor(0));
      bag.tween({
        targets: piece, x: p.x + p.dx, y: p.y - p.rise, angle: p.spin * 60, delay: p.delayMs, duration: plan.riseMs, ease: 'Quad.easeOut',
        onComplete: () => {
          if (bag.done) return;
          bag.tween({ targets: piece, x: p.x + p.dx * 1.15, y: p.y - p.rise + p.fall, angle: p.spin * 140, alpha: 0, duration: plan.fallMs, ease: 'Quad.easeIn', onComplete: () => piece.destroy() });
        },
      });
    }
    return bag;
  } catch (error) {
    return null;
  }
}
