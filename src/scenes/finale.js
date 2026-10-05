// The birthday finale (W3, docs/plans/2026-10-04-day3-feedback-and-wow.md, docs/STORY.md "the ending"): the scene between the box
// and the card. The chain is box opening -> FINALE -> card -> credits -> title; this scene never returns to 'world'.
//   1. The warm light the box opening ends on fades into a dusk over a Dubai skyline: a table, a tiered cake with 22 candles, her
//      (idle, 3x), soft hearts and sparkles, "Make a wish, <name>!".
//   2. HOLD Space / E / Enter (or the mouse, or a finger) to blow: a breath meter fills and the flames go out ONE BY ONE (about 3 s
//      of holding for all 22; the flames lean away and flicker harder; thin smoke rises from each one that goes out; a soft "pff").
//      Releasing pauses it; blown-out candles stay out. Soft-lock guards: after 8 s without progress "Hold SPACE to blow!" pulses,
//      after 20 s the rest go out by themselves.
//   3. The last flame out: a beat of silence and "Make a wish...", a warm flash, then ~15 s of fireworks over the skyline (the
//      windows flicker) with the chiptune "Happy Birthday to You" and "Happy Birthday, <name>!".
//   4. A camera fade-out to the card, with a failsafe timer (a missed fade event can never stall it). A skip key / click works from
//      2 s into the fireworks; during the candles the held key is the interaction, never a skip (nothing needs a key to END: the
//      guards above finish every run).
// The rules, the schedule and the fireworks are pure (src/finale.js, unit-tested); the drawing is shape lists (src/finale-art.js)
// replayed here onto Phaser Graphics, the static parts baked into three textures once. Everything is driven from update(), not from
// tweens, so nothing can be left half-animated; the scene works fully silent (every AudioManager call is a guarded no-op).

const FINALE_TEXT_COLOR = '#fff1d8';
const FINALE_ACCENT_COLOR = '#ffc2d9';
const FINALE_STROKE_COLOR = '#3a2160';
const FINALE_HEART_COLORS = [0xffa3c6, 0xffc4a3, 0xcdb6ff, 0xffe29a];
const FINALE_HEART_PATTERN = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const FINALE_BALLOONS = [
  { x: 58, y: 250, color: 0xffa3c6 }, { x: 112, y: 306, color: 0xbfe0ff }, { x: 26, y: 336, color: 0xffe29a },
  { x: 902, y: 246, color: 0xcdb6ff }, { x: 850, y: 300, color: 0xffa3c6 }, { x: 936, y: 330, color: 0xc9f0c4 },
];
const FINALE_HARD_STOP_MS = 60000; // whatever happens, the scene hands to the card by now
const FINALE_METER = { x: 380, y: 516, w: 200, h: 12 }; // the breath meter

// Replays a shape list (src/finale-art.js) onto a Graphics object.
function finaleReplay(g, shapes) {
  for (const s of shapes) {
    g.fillStyle(s.c, s.a);
    if (s.k === 'r') g.fillRect(s.x, s.y, s.w, s.h);
    else if (s.k === 'e') g.fillEllipse(s.x, s.y, s.w, s.h);
    else g.fillCircle(s.x, s.y, s.r);
  }
}

class FinaleScene extends Phaser.Scene {
  constructor() {
    super('finale');
  }

  init() {
    this.phase = 'candles'; // 'candles' -> 'wish' -> 'flash' -> 'celebration' -> 'leaving'
    this.elapsed = 0; // scene clock in ms, advanced in update()
    this.clockNow = 0; // Phaser's own clock (for the throttled sounds)
    this.progress = 0; // blowing progress 0..1
    this.candlesOut = 0;
    this.blow = 0; // how hard she is blowing right now, smoothed 0..1 (the flames lean by it)
    this.lastProgressAt = 0;
    this.keysHeld = new Set();
    this.pointerHeld = false;
    this.schedule = null; // finaleSchedule(), set when the last flame is out
    this.leaving = false;
    this.outAt = new Array(FINALE.candleCount).fill(null);
    this.whooshIndex = 0;
    this.popIndex = 0;
    this.crackleAt = [];
    this.windowBucket = '';
    this.lastMeter = -1;
    this.celebrationMs = 0;
  }

  preload() {
    // The recipient comes from card.json like the card's and the credits'; a missing file just means "Taru" (a 404 is tolerated).
    if (!this.cache.json.exists('card-config')) this.load.json('card-config', CARD_CONFIG_URL);
  }

  create() {
    this.recipient = buildCardConfig(this.cache.json.get('card-config')).recipient;
    this.candles = candlePositions();
    this.outOrder = candleOutOrder();
    this.show = fireworkSchedule();
    this.burstParticlesByIndex = {};
    for (const burst of this.show) this.burstParticlesByIndex[burst.index] = burstParticles(burst);

    this.cameras.main.setBackgroundColor('#fff1a8'); // the colour the box opening ends on: no hard cut
    AudioManager.playMusic('cardMusic'); // a no-op when the box opening already started it

    this.buildLayers();
    this.buildCharacter();
    this.buildBalloonsAndHearts();
    this.buildTexts();
    this.bindInput();

    // The warm light of the box opening: fully opaque at first, fading out over FINALE.fadeInMs (driven from update()).
    this.warm = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xfff1a8, 1).setOrigin(0, 0).setDepth(30);
    this.flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xfff6dc, 1).setOrigin(0, 0).setDepth(25).setAlpha(0);

    // The last-resort guard: whatever else goes wrong, the scene hands over to the card.
    this.time.delayedCall(FINALE_HARD_STOP_MS, () => this.leave());
    this.events.once('shutdown', () => this.unbindGlobalInput());
  }

  // ---------- building ----------

  bakeTexture(key, shapes) {
    if (this.textures.exists(key)) return;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    finaleReplay(g, shapes);
    g.generateTexture(key, GAME_WIDTH, GAME_HEIGHT);
    g.destroy();
  }

  buildLayers() {
    this.skyline = finaleSkyline();
    this.bakeTexture('finale-sky', finaleSkyShapes());
    this.bakeTexture('finale-city', finaleCityShapes(this.skyline));
    this.bakeTexture('finale-front', [...finaleTableShapes(), ...finaleCakeShapes(), ...finaleCandleShapes()]);
    this.add.image(0, 0, 'finale-sky').setOrigin(0, 0).setDepth(0);
    this.fireworkGfx = this.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(0, 0, 'finale-city').setOrigin(0, 0).setDepth(2);
    this.windowGfx = this.add.graphics().setDepth(2.5);
    this.drawWindows(true);
    // (her sprite is depth 3, built next) the table, the cake and the candle sticks stand in front of her:
    this.add.image(0, 0, 'finale-front').setOrigin(0, 0).setDepth(4);
    this.glowGfx = this.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.flameGfx = this.add.graphics().setDepth(6.5);
    this.smokeGfx = this.add.graphics().setDepth(7);
    this.sparkleGfx = this.add.graphics().setDepth(11);
    this.meterGfx = this.add.graphics().setDepth(12);
  }

  buildCharacter() {
    this.player = null;
    if (!this.textures.exists('player')) return; // no sheet (a dev jump straight to this scene): the cake is the star
    this.player = this.add.sprite(FINALE_PLAYER_POS.x, FINALE_PLAYER_POS.y, 'player', 0).setOrigin(0.5, 1).setScale(3).setDepth(3);
    try {
      if (this.anims.exists('idle-down')) this.player.play('idle-down');
    } catch (error) { /* a static idle frame is fine */ }
  }

  buildBalloonsAndHearts() {
    FINALE_HEART_COLORS.forEach((color, i) => {
      const key = `finale-heart-${i}`;
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      FINALE_HEART_PATTERN.forEach((row, ry) => [...row].forEach((cell, rx) => { if (cell === '#') g.fillStyle(color, 1).fillRect(rx, ry, 1, 1); }));
      g.fillStyle(0xffffff, 0.55).fillRect(1, 1, 1, 1);
      g.generateTexture(key, 7, 6);
      g.destroy();
    });
    FINALE_BALLOONS.forEach((balloon, i) => {
      const key = `finale-balloon-${i}`;
      if (!this.textures.exists(key)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        finaleReplay(g, finaleBalloonShapes(balloon.color));
        g.generateTexture(key, 24, 48);
        g.destroy();
      }
    });
    this.balloons = FINALE_BALLOONS.map((balloon, i) => ({ obj: this.add.image(balloon.x, balloon.y, `finale-balloon-${i}`).setScale(1.5).setDepth(5).setAlpha(0.95), x: balloon.x, y: balloon.y, phase: i * 1.3 }));

    const rng = finaleRng(99);
    this.hearts = [];
    for (let i = 0; i < 9; i++) {
      const obj = this.add.image(0, 0, `finale-heart-${i % FINALE_HEART_COLORS.length}`).setScale(i % 3 === 0 ? 4 : 3).setAlpha(0.55).setDepth(8);
      this.hearts.push({ obj, baseX: 30 + rng() * 900, y: 40 + rng() * 480, vy: 9 + rng() * 14, swayAmp: 6 + rng() * 16, swayFreq: 0.4 + rng() * 0.6, phase: rng() * 6.28 });
    }
    this.sparkles = [];
    for (let i = 0; i < 16; i++) this.sparkles.push({ x: 20 + rng() * 920, y: 20 + rng() * 330, phase: rng() * 6.28, speed: 1.4 + rng() * 2, color: [0xfff6e0, 0xffe3ef, 0xffe29a][i % 3] });
    this.confetti = [];
    for (let i = 0; i < 26; i++) {
      const color = FIREWORK_COLORS[i % FIREWORK_COLORS.length];
      const obj = this.add.rectangle(0, 0, 4, 8, color, 0.9).setDepth(9).setVisible(false);
      this.confetti.push({ obj, baseX: rng() * GAME_WIDTH, y: -rng() * 540, vy: 40 + rng() * 50, spin: -120 + rng() * 240, swayAmp: 8 + rng() * 18, swayFreq: 0.5 + rng(), phase: rng() * 6.28 });
    }
  }

  buildTexts() {
    const cx = GAME_WIDTH / 2;
    this.titleText = uiText(this, cx, 62, finaleText('wish', this.recipient), 20, FINALE_TEXT_COLOR)
      .setOrigin(0.5).setAlign('center').setWordWrapWidth(900).setStroke(FINALE_STROKE_COLOR, 7).setDepth(10);
    this.subText = uiText(this, cx, 98, finaleText('sub', this.recipient), 8, '#e6d8f5')
      .setOrigin(0.5).setAlign('center').setStroke(FINALE_STROKE_COLOR, 4).setDepth(10).setAlpha(0.9);
    this.hintText = uiText(this, cx, 318, finaleText('hint', this.recipient), 12, FINALE_ACCENT_COLOR)
      .setOrigin(0.5).setStroke(FINALE_STROKE_COLOR, 5).setDepth(10).setAlpha(0);
    this.bigText = uiText(this, cx, 150, finaleText('birthday', this.recipient), 28, FINALE_TEXT_COLOR)
      .setOrigin(0.5).setAlign('center').setWordWrapWidth(900).setStroke(FINALE_STROKE_COLOR, 8).setDepth(10).setAlpha(0);
    this.skipText = uiText(this, cx, 514, finaleText('skip', this.recipient), 8, FINALE_ACCENT_COLOR)
      .setOrigin(0.5).setStroke(FINALE_STROKE_COLOR, 4).setDepth(10).setAlpha(0);
  }

  // ---------- input: hold-to-blow (key up/down state, never key repeat) ----------

  bindInput() {
    for (const key of FINALE_BLOW_KEYS) {
      this.input.keyboard.on(`keydown-${key}`, (event) => this.onKeyDown(key, event));
      this.input.keyboard.on(`keyup-${key}`, () => this.onKeyUp(key));
    }
    this.input.keyboard.on('keydown-ESC', (event) => this.onKeyDown('ESC', event));
    this.input.on('pointerdown', () => this.onPointerDown());
    this.input.on('pointerup', () => this.onPointerUp());
    // A key or button released while the window was not focused sends no keyup/mouseup: never stay "held" through a blur.
    this.game.events.on('blur', this.releaseAll, this);
    this.game.events.on('hidden', this.releaseAll, this);
  }

  // The state of the held keys, not the key-repeat stream: a Set of key names (Safari, Chrome and Firefox repeat differently,
  // and some start repeating only after a delay), so a repeat event does nothing but re-add the same name.
  onKeyDown(name, event) {
    if (this.phase === 'candles') {
      if (name !== 'ESC') this.keysHeld.add(name); // Esc is no skip here and does not blow either
      return;
    }
    if (!(event && event.repeat)) this.trySkip(); // a fresh press, not a key still held down from the candles
  }

  onKeyUp(name) {
    this.keysHeld.delete(name);
  }

  onPointerDown() {
    if (this.phase === 'candles') this.pointerHeld = true;
    else this.trySkip();
  }

  onPointerUp() {
    this.pointerHeld = false;
  }

  releaseAll() {
    this.keysHeld.clear();
    this.pointerHeld = false;
  }

  unbindGlobalInput() {
    if (!this.game || !this.game.events) return;
    this.game.events.off('blur', this.releaseAll, this);
    this.game.events.off('hidden', this.releaseAll, this);
  }

  isHolding() {
    return this.keysHeld.size > 0 || this.pointerHeld;
  }

  trySkip() {
    if (this.phase !== 'celebration' || !finaleCanSkip(this.schedule, this.elapsed)) return;
    this.leave();
  }

  // ---------- the clock ----------

  update(time, delta) {
    const dt = Math.min(delta, 100);
    this.elapsed += dt;
    this.clockNow = time;
    const t = this.elapsed;

    this.warm.setAlpha(Math.max(0, 1 - t / FINALE.fadeInMs));
    if (this.schedule) this.celebrationMs = Math.max(0, this.elapsed - this.schedule.celebrationStart);
    if (!this.leaving) { // once she is leaving, the picture keeps moving but the show's logic no longer changes
      if (this.phase === 'candles') this.updateCandles(dt);
      else this.updateAfterCandles();
    }

    this.drawCandles(t);
    this.drawWindows(false);
    this.drawFireworks();
    this.updateAmbient(dt, t);
    this.updateTexts(t);
    this.drawMeter();
  }

  updateCandles(dt) {
    const failsafe = blowFailsafe(this.elapsed, this.elapsed - this.lastProgressAt, this.progress);
    const blowing = this.isHolding() || failsafe.autoBlow;
    const before = this.progress;
    this.progress = blowStep(this.progress, blowing, dt);
    if (this.progress > before) this.lastProgressAt = this.elapsed;
    this.blow += ((blowing && this.progress < 1 ? 1 : 0) - this.blow) * Math.min(1, dt / 90);
    this.showHint = failsafe.hint;

    const out = candlesOutCount(this.progress);
    while (this.candlesOut < out) {
      this.outAt[this.outOrder[this.candlesOut]] = this.elapsed;
      this.candlesOut += 1;
      AudioManager.playThrottled('blowPff', 'finale-blow', 100, this.clockNow); // a soft "pff", at most one per 100 ms
    }
    if (this.progress >= 1 && this.candlesOut >= FINALE.candleCount) this.onAllOut();
  }

  // The last flame is out: silence, "Make a wish...", then (on the schedule) the flash and the show.
  onAllOut() {
    this.schedule = finaleSchedule(this.elapsed);
    this.phase = 'wish';
    this.blow = 0;
    this.showHint = false;
    this.keysHeld.clear();
    this.pointerHeld = false;
    AudioManager.stopMusic(400); // the bed fades away: a short silence
    this.titleText.setText(finaleText('silence', this.recipient));
  }

  updateAfterCandles() {
    const next = finalePhaseAt(this.schedule, this.elapsed);
    if (next !== this.phase) this.enterPhase(next);
    if (this.phase === 'flash') {
      const u = (this.elapsed - this.schedule.flashStart) / FINALE.flashMs; // 0..1: up fast, down slow
      this.flash.setAlpha(u < 0.3 ? u / 0.3 : Math.max(0, 1 - (u - 0.3) / 0.7));
    }
    if (this.phase === 'celebration') this.playFireworkSounds(this.celebrationMs);
  }

  enterPhase(next) {
    this.phase = next;
    if (next === 'flash') {
      AudioManager.play('cardWhoosh');
    } else if (next === 'celebration') {
      this.flash.setAlpha(0);
      AudioManager.playMusic('happyBirthday', { crossfadeMs: 0 }); // the chiptune song, once (a no-op without audio)
      for (const c of this.confetti) c.obj.setVisible(true);
    } else if (next === 'leaving') {
      this.leave();
    }
  }

  // Whooshes when a rocket leaves, a pop at each burst, a crackle after the bigger ones: all from the same schedule that draws them.
  playFireworkSounds(ms) {
    const show = this.show;
    while (this.whooshIndex < show.length && ms >= show[this.whooshIndex].t - show[this.whooshIndex].launchMs) {
      AudioManager.playThrottled('fireworkWhoosh', 'finale-whoosh', 150, this.clockNow);
      this.whooshIndex += 1;
    }
    while (this.popIndex < show.length && ms >= show[this.popIndex].t) {
      AudioManager.playThrottled('fireworkPop', 'finale-pop', 120, this.clockNow);
      if (show[this.popIndex].crackle) this.crackleAt.push(show[this.popIndex].t + 250);
      this.popIndex += 1;
    }
    while (this.crackleAt.length && ms >= this.crackleAt[0]) {
      AudioManager.playThrottled('fireworkCrackle', 'finale-crackle', 200, this.clockNow);
      this.crackleAt.shift();
    }
  }

  // Fade to the card; a failsafe timer guarantees the hand-off even if the camera fade event never arrives.
  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.phase = 'leaving';
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      this.scene.start('card');
    };
    this.cameras.main.fadeOut(FINALE.leaveFadeMs, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', go);
    this.time.delayedCall(FINALE.leaveFailsafeMs, go);
  }

  // ---------- drawing ----------

  // The flames (each leaning and flickering by how hard she blows), their halos, the smoke of the ones that are out, her breath.
  drawCandles(t) {
    this.glowGfx.clear();
    this.flameGfx.clear();
    this.smokeGfx.clear();
    const glow = [];
    const flame = [];
    const smoke = [];
    for (const base of this.candles) {
      const outAt = this.outAt[base.index];
      if (outAt === null) {
        const lit = finaleFlameShapes(base, flameShape(base.index, t, this.blow));
        glow.push(...lit.glow);
        flame.push(...lit.flame);
      } else {
        smoke.push(...finaleSmokeShapes(base, base.index, t - outAt));
      }
    }
    finaleReplay(this.glowGfx, glow);
    finaleReplay(this.flameGfx, flame);
    if (this.phase === 'candles') smoke.push(...finaleBreathShapes(t, this.blow));
    finaleReplay(this.smokeGfx, smoke);
  }

  // The skyline's windows: redrawn only when their flicker bucket changes (every 220 ms during the show, 2.2 s otherwise).
  drawWindows(force) {
    const excited = this.phase === 'celebration';
    const bucket = `${excited ? 'x' : 'n'}${Math.floor(this.elapsed / (excited ? 220 : 2200))}`;
    if (!force && bucket === this.windowBucket) return;
    this.windowBucket = bucket;
    const g = this.windowGfx;
    g.clear();
    for (const win of this.skyline.windows) {
      if (!windowLit(win.i, win.base, this.elapsed, excited)) continue;
      g.fillStyle(finaleWindowColor(win), 0.92).fillRect(win.x, win.y, win.w, win.h);
    }
  }

  drawFireworks() {
    const g = this.fireworkGfx;
    g.clear();
    if (this.phase !== 'celebration' && this.phase !== 'leaving') return;
    finaleReplay(g, finaleFireworkShapes(this.celebrationMs, this.show, this.burstParticlesByIndex));
  }

  // Hearts and sparkles drift all through; balloons bob; confetti falls during the show; she hops a little when it starts.
  updateAmbient(dt, t) {
    const sec = t / 1000;
    for (const h of this.hearts) {
      h.y -= h.vy * (dt / 1000);
      if (h.y < -12) { h.y = GAME_HEIGHT + 12; }
      h.obj.setPosition(h.baseX + Math.sin(sec * h.swayFreq + h.phase) * h.swayAmp, h.y);
    }
    for (const b of this.balloons) b.obj.setPosition(b.x + Math.sin(sec * 0.7 + b.phase) * 4, b.y + Math.sin(sec * 0.9 + b.phase) * 6);
    const g = this.sparkleGfx;
    g.clear();
    for (const s of this.sparkles) {
      const tw = 0.5 + 0.5 * Math.sin(sec * s.speed + s.phase);
      if (tw < 0.35) continue;
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      g.fillStyle(s.color, 0.8 * tw).fillRect(x, y, 2, 2).fillRect(x - 2, y + 1, 6, 1).fillRect(x + 1, y - 2, 1, 6);
    }
    if (this.phase === 'celebration' || this.phase === 'leaving') {
      for (const c of this.confetti) {
        c.y += c.vy * (dt / 1000);
        if (c.y > GAME_HEIGHT + 10) c.y = -10;
        c.obj.setPosition(c.baseX + Math.sin(sec * c.swayFreq + c.phase) * c.swayAmp, c.y).setAngle(c.obj.angle + c.spin * (dt / 1000));
      }
      // The big text sparkles: little plus-shaped glints twinkling round "Happy Birthday, <name>!".
      const half = this.bigText.width / 2 + 24;
      for (let i = 0; i < 12; i++) {
        const tw = 0.5 + 0.5 * Math.sin(sec * (2 + (i % 4)) + i * 1.9);
        if (tw < 0.4) continue;
        const x = Math.round(GAME_WIDTH / 2 + (finaleHash(i, 5) * 2 - 1) * half);
        const y = Math.round(150 + (finaleHash(i, 9) * 2 - 1) * 30);
        g.fillStyle(0xfff6e0, 0.9 * tw).fillRect(x, y, 2, 2).fillRect(x - 2, y + 1, 6, 1).fillRect(x + 1, y - 2, 1, 6);
      }
    }
    if (this.player) {
      const hop = this.phase === 'celebration' ? Math.abs(Math.sin(sec * 5.5)) * 9 : 0;
      this.player.setY(FINALE_PLAYER_POS.y - hop);
    }
  }

  updateTexts(t) {
    const candles = this.phase === 'candles';
    this.subText.setAlpha(candles ? Math.min(0.9, t / 600) : 0);
    this.hintText.setAlpha(candles && this.showHint ? 0.65 + 0.35 * Math.sin(t / 180) : 0);
    this.titleText.setY(62 + (candles ? 0 : Math.sin(t / 400) * 2));
    if (this.phase === 'celebration' || this.phase === 'leaving') {
      const u = Math.min(1, this.celebrationMs / 700);
      this.titleText.setAlpha(1 - u);
      this.bigText.setAlpha(u).setY(150 + Math.sin(this.celebrationMs / 350) * 4);
      const canSkip = finaleCanSkip(this.schedule, this.elapsed);
      this.skipText.setAlpha(canSkip && this.phase === 'celebration' ? 0.55 : 0);
    }
  }

  // The breath meter: a small bar at the bottom while the candles are the interaction.
  drawMeter() {
    const shown = this.phase === 'candles' ? Math.round(this.progress * 1000) : -1;
    if (shown === this.lastMeter) return;
    this.lastMeter = shown;
    const g = this.meterGfx;
    g.clear();
    if (shown < 0) return;
    const m = FINALE_METER;
    g.fillStyle(0x000000, 0.35).fillRect(m.x - 3, m.y - 3, m.w + 6, m.h + 6);
    g.fillStyle(0x3a2160, 1).fillRect(m.x, m.y, m.w, m.h);
    g.fillStyle(0xffc2d9, 1).fillRect(m.x, m.y, Math.round(m.w * this.progress), m.h);
    g.fillStyle(0xffffff, 0.35).fillRect(m.x, m.y, Math.round(m.w * this.progress), 3);
    g.lineStyle(2, 0xfff1d8, 1).strokeRect(m.x - 1, m.y - 1, m.w + 2, m.h + 2);
  }
}
