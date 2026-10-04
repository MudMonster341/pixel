// The birthday credits (decisions/0019-credits-ending-and-recipient.md): the last scene of the game.
// Plays after the card (src/scenes/card.js hands off here, also after the optional closing video),
// then returns to the title screen exactly like the card used to. Sequence, on a calm dusk sky with
// twinkling stars and slowly drifting hearts and confetti:
//   fade in -> "Happy Birthday, Taru" (big, bobbing, with a soft halo) -> "Happy 22" -> about eight
//   short wishes, one at a time, each cross-fading into the next -> "THE END" -> "Made for you by
//   Mustafa" -> back to the title.
// Content and timing are data (src/credits.js: DEFAULT_CREDITS, buildCreditsConfig(), creditsTimeline()),
// so the owner's wishes in assets/card/card.json and the pacing are unit-tested without Phaser.
//
// Esc/Space/Enter skip ahead to THE END (after a short grace period so the key that closes the card
// can't skip this by accident); once THE END is up, the same keys go straight back to the title. The
// scene also always returns to the title on its own timer, so it can never soft-lock.
//
// Art is drawn here from Phaser primitives plus two tiny generated textures (a pixel heart in four
// pastel colours): no new PNG files. The ambient motion runs in update() rather than in tweens, so
// skipping (which kills the scene's tweens) can't freeze the sky.

const CREDITS_SKIP_GRACE_MS = 1200; // ignore skip keys this long after the scene starts
const CREDITS_END_LEAVE_GRACE_MS = 1500; // ...and this long after THE END appears, before a key leaves
const CREDITS_SKIP_END_HOLD_MS = 5200; // how long THE END stays after a skip, before auto-return
const CREDITS_TEXT_FADE_MS = 750;

// Pastel palette, all warm and soft (docs/STYLE_GUIDE.md: bright and cute, never harsh).
const CREDITS_SKY_STOPS = [0x14113a, 0x241b57, 0x3d2a73, 0x6a3b86, 0xa9548c, 0xdb7a90, 0xf3a58f];
const CREDITS_TEXT_COLOR = '#fff1d8';
const CREDITS_ACCENT_COLOR = '#ffc2d9';
const CREDITS_STROKE_COLOR = '#3a2160';
const CREDITS_HEART_COLORS = [0xffa3c6, 0xffc4a3, 0xcdb6ff, 0xffe29a];
const CREDITS_CONFETTI_COLORS = [0xffb3d1, 0xffe3a3, 0xbfe0ff, 0xd9c3ff, 0xc9f0c4];
const CREDITS_HEART_PATTERN = [
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
];
const CREDITS_HORIZON_Y = 400;

class CreditsScene extends Phaser.Scene {
  constructor() {
    super('credits');
  }

  // `data.raw` is the card.json the card scene already parsed (or null if it had none). When this
  // scene is started directly (no data at all), preload() reads card.json itself.
  init(data) {
    this.startData = data || {};
    this.phase = 'running'; // 'running' -> 'end' -> 'leaving'
    this.elapsed = 0; // scene-clock ms, advanced in update()
    this.endShownAt = 0;
    this.content = []; // every title/age/wish object, so a skip can fade them all out at once
    this.stars = [];
    this.drifters = [];
    this.theEndText = null;
    this.madeByText = null;
  }

  preload() {
    if (this.startData.raw === undefined && !this.cache.json.exists('card-config')) {
      this.load.json('card-config', CARD_CONFIG_URL);
    }
  }

  create() {
    const raw = this.startData.raw !== undefined ? this.startData.raw : this.cache.json.get('card-config');
    this.config = buildCreditsConfig(raw);
    this.timeline = creditsTimeline(this.config.wishes.length);

    this.cameras.main.setBackgroundColor('#14113a');
    this.cameras.main.fadeIn(this.timeline.fadeIn.end, 0, 0, 0);
    // The card's own music keeps going (a no-op when it is already playing; starts it when this scene
    // is reached directly). No new sting: the audio registry has no fitting one.
    AudioManager.playMusic('cardMusic');

    // E too (FB-0045: E and Enter do the same everywhere a message advances) -- but no key is ever REQUIRED:
    // the timeline below returns to the title on its own a few seconds after THE END (FB-0076).
    for (const key of ['ESC', 'SPACE', 'ENTER', 'E']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => this.onSkipKey(event));
    }

    this.buildSky();
    this.buildMoon();
    this.buildStars();
    this.buildHills();
    this.buildDrifters();
    this.buildTitleBlock();
    this.hint = uiText(this, GAME_WIDTH / 2, GAME_HEIGHT - 22, 'ESC TO SKIP', 8, '#cbb8e8')
      .setOrigin(0.5).setDepth(20).setAlpha(0);

    this.scheduleTimeline();
  }

  // ---------- the schedule (src/credits.js creditsTimeline()) ----------

  at(ms, callback) {
    this.time.delayedCall(ms, callback);
  }

  scheduleTimeline() {
    const t = this.timeline;
    this.at(t.title.start, () => this.showTitle());
    this.at(t.age.start, () => this.showAge());
    this.at(t.wishesStart, () => this.fadeOutObjects([this.title, this.titleHalo, this.ageText], CREDITS_TEXT_FADE_MS));
    this.config.wishes.forEach((wish, i) => {
      this.at(t.wishes[i].start, () => this.showWish(i));
      this.at(t.wishes[i].end, () => this.fadeOutObjects(this.wishObjects[i], CREDITS_TEXT_FADE_MS));
    });
    this.at(t.theEnd.start, () => this.showTheEnd(false));
    this.at(t.madeBy.start, () => this.showMadeBy());
    this.at(t.total, () => this.returnToTitle());
    this.at(3000, () => this.tweens.add({ targets: this.hint, alpha: 0.55, duration: 600 }));
  }

  // ---------- the sky and the ambient life ----------

  buildSky() {
    const g = this.add.graphics().setDepth(0);
    const bands = 28;
    const bandH = Math.ceil(CREDITS_HORIZON_Y / bands);
    for (let i = 0; i < bands; i++) {
      g.fillStyle(creditsSkyColor(i / (bands - 1)), 1).fillRect(0, i * bandH, GAME_WIDTH, bandH + 1);
    }
    // Below the horizon is hidden by the hills, but the sky colour must reach the bottom of the screen.
    g.fillStyle(CREDITS_SKY_STOPS[CREDITS_SKY_STOPS.length - 1], 1).fillRect(0, bands * bandH, GAME_WIDTH, GAME_HEIGHT - bands * bandH);
    // A faint warm glow where the sky meets the hills.
    const glow = this.add.graphics().setDepth(1);
    glow.fillStyle(0xffc29a, 0.10).fillEllipse(GAME_WIDTH / 2, CREDITS_HORIZON_Y, 1300, 260);
    glow.fillStyle(0xffd7a8, 0.10).fillEllipse(GAME_WIDTH / 2, CREDITS_HORIZON_Y, 800, 150);
  }

  buildMoon() {
    const x = 790;
    const y = 112;
    const g = this.add.graphics().setDepth(2);
    g.fillStyle(0xfff0cf, 0.05).fillCircle(x, y, 74);
    g.fillStyle(0xfff0cf, 0.08).fillCircle(x, y, 54);
    g.fillStyle(0xfff3d9, 1).fillCircle(x, y, 28);
    g.fillStyle(0xf1dcbc, 1).fillCircle(x - 9, y - 6, 5).fillCircle(x + 8, y + 8, 4).fillCircle(x + 6, y - 11, 3);
    this.tweens.add({ targets: g, alpha: { from: 0.85, to: 1 }, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // Three depth layers of stars: far (small, dim, slow), mid, near (bigger, brighter, a touch faster).
  // Drawn into one Graphics every frame (cheap) so they twinkle without a tween each.
  buildStars() {
    this.starGfx = this.add.graphics().setDepth(1.5);
    const layers = [
      { count: 60, size: 1, drift: 1.2, base: 0.35 },
      { count: 36, size: 2, drift: 2.4, base: 0.5 },
      { count: 14, size: 3, drift: 3.6, base: 0.7 },
    ];
    for (const layer of layers) {
      for (let i = 0; i < layer.count; i++) {
        this.stars.push({
          x: Phaser.Math.Between(0, GAME_WIDTH),
          y: Phaser.Math.Between(6, CREDITS_HORIZON_Y - 70),
          size: layer.size,
          drift: layer.drift,
          base: layer.base,
          speed: Phaser.Math.FloatBetween(0.8, 2.4),
          phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
          color: Phaser.Utils.Array.GetRandom([0xfff6e0, 0xffe3ef, 0xe6ecff]),
          sparkle: layer.size === 3 && i % 2 === 0, // some of the nearest ones are little plus-shaped glints
        });
      }
    }
  }

  buildHills() {
    const far = this.add.graphics().setDepth(3);
    const near = this.add.graphics().setDepth(5);
    const step = 6; // stepped columns keep the silhouette pixel-blocky
    for (let x = 0; x < GAME_WIDTH; x += step) {
      const farTop = Math.round(CREDITS_HORIZON_Y - 8 + Math.sin(x * 0.011 + 1.1) * 22 + Math.sin(x * 0.027) * 8);
      far.fillStyle(0x5a3a82, 1).fillRect(x, farTop, step, GAME_HEIGHT - farTop);
      const nearTop = Math.round(CREDITS_HORIZON_Y + 48 + Math.sin(x * 0.014 + 3.4) * 16 + Math.sin(x * 0.04 + 1) * 6);
      near.fillStyle(0x2f1f55, 1).fillRect(x, nearTop, step, GAME_HEIGHT - nearTop);
    }
  }

  buildHeartTextures() {
    CREDITS_HEART_COLORS.forEach((color, i) => {
      const key = `credits-heart-${i}`;
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0, add: false });
      CREDITS_HEART_PATTERN.forEach((row, ry) => {
        [...row].forEach((cell, rx) => {
          if (cell === '#') g.fillStyle(color, 1).fillRect(rx, ry, 1, 1);
        });
      });
      g.fillStyle(0xffffff, 0.55).fillRect(1, 1, 1, 1); // a tiny shine pixel
      g.generateTexture(key, 7, 6);
      g.destroy();
    });
  }

  // Hearts float up, confetti sinks, each in a far / middle / near layer: nearer ones are bigger,
  // brighter and faster, which gives the soft sense of depth. Moved in update().
  buildDrifters() {
    this.buildHeartTextures();
    const heartLayers = [
      { count: 7, scale: 2, alpha: 0.38, speed: [7, 12], depth: 4 },
      { count: 6, scale: 3, alpha: 0.6, speed: [12, 19], depth: 6 },
      { count: 3, scale: 4, alpha: 0.5, speed: [19, 26], depth: 12 },
    ];
    for (const layer of heartLayers) {
      for (let i = 0; i < layer.count; i++) {
        const key = `credits-heart-${Phaser.Math.Between(0, CREDITS_HEART_COLORS.length - 1)}`;
        const obj = this.add.image(0, 0, key).setScale(layer.scale).setAlpha(layer.alpha).setDepth(layer.depth);
        this.addDrifter(obj, { vy: -Phaser.Math.FloatBetween(layer.speed[0], layer.speed[1]), spin: 0 }, true);
      }
    }
    const confettiLayers = [
      { count: 12, w: 3, h: 6, alpha: 0.55, speed: [9, 16], depth: 4 },
      { count: 10, w: 4, h: 8, alpha: 0.85, speed: [15, 26], depth: 6 },
    ];
    for (const layer of confettiLayers) {
      for (let i = 0; i < layer.count; i++) {
        const color = Phaser.Utils.Array.GetRandom(CREDITS_CONFETTI_COLORS);
        const obj = this.add.rectangle(0, 0, layer.w, layer.h, color).setAlpha(layer.alpha).setDepth(layer.depth);
        this.addDrifter(obj, { vy: Phaser.Math.FloatBetween(layer.speed[0], layer.speed[1]), spin: Phaser.Math.FloatBetween(-40, 40) }, true);
      }
    }
  }

  addDrifter(obj, { vy, spin }, scatterY) {
    const drifter = {
      obj, vy, spin,
      baseX: Phaser.Math.Between(0, GAME_WIDTH),
      swayAmp: Phaser.Math.Between(6, 22),
      swayFreq: Phaser.Math.FloatBetween(0.4, 1.0),
      phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
    };
    obj.y = scatterY ? Phaser.Math.Between(0, GAME_HEIGHT) : (vy < 0 ? GAME_HEIGHT + 16 : -16);
    obj.x = drifter.baseX;
    this.drifters.push(drifter);
  }

  update(time, delta) {
    const dt = Math.min(delta, 100) / 1000;
    this.elapsed += delta;
    const t = this.elapsed / 1000;

    const g = this.starGfx;
    g.clear();
    for (const s of this.stars) {
      s.x -= s.drift * dt;
      if (s.x < -4) s.x += GAME_WIDTH + 8;
      const twinkle = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase);
      const alpha = s.base * (0.35 + 0.65 * twinkle);
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      g.fillStyle(s.color, alpha).fillRect(x, y, s.size, s.size);
      if (s.sparkle && twinkle > 0.6) {
        g.fillStyle(s.color, alpha * 0.7)
          .fillRect(x - 2, y + 1, s.size + 4, 1)
          .fillRect(x + 1, y - 2, 1, s.size + 4);
      }
    }

    for (const d of this.drifters) {
      d.obj.y += d.vy * dt;
      d.obj.x = d.baseX + Math.sin(t * d.swayFreq + d.phase) * d.swayAmp;
      if (d.spin) d.obj.angle += d.spin * dt;
      if (d.vy < 0 && d.obj.y < -16) { d.obj.y = GAME_HEIGHT + 16; d.baseX = Phaser.Math.Between(0, GAME_WIDTH); }
      else if (d.vy > 0 && d.obj.y > GAME_HEIGHT + 16) { d.obj.y = -16; d.baseX = Phaser.Math.Between(0, GAME_WIDTH); }
    }
  }

  // ---------- the title block, the wishes, THE END ----------

  buildTitleBlock() {
    const cx = GAME_WIDTH / 2;
    const titleY = 205;
    const ageY = 280;

    // A soft halo behind the title (the card's old "ghosted duplicate" glow, scorecard 2026-09-22, was
    // a second copy of the text: this is plain ellipses, no text at all, so it cannot double the letters).
    this.titleHalo = this.add.graphics().setDepth(9).setAlpha(0);
    this.titleHalo.fillStyle(0xffc6dd, 0.06).fillEllipse(cx, titleY, 760, 120);
    this.titleHalo.fillStyle(0xffd3b0, 0.09).fillEllipse(cx, titleY, 580, 90);
    this.titleHalo.fillStyle(0xfff0cf, 0.12).fillEllipse(cx, titleY, 400, 62);

    this.title = uiText(this, cx, titleY, `Happy Birthday, ${this.config.recipient}`, 28, CREDITS_TEXT_COLOR)
      .setOrigin(0.5).setAlign('center').setWordWrapWidth(900).setStroke(CREDITS_STROKE_COLOR, 8).setDepth(10).setAlpha(0);
    this.ageText = uiText(this, cx, ageY, `Happy ${this.config.age}`, 22, CREDITS_ACCENT_COLOR)
      .setOrigin(0.5).setAlign('center').setStroke(CREDITS_STROKE_COLOR, 7).setDepth(10).setAlpha(0);
    this.titleY = titleY;
    this.ageY = ageY;

    // Wishes are created up front (alpha 0) so a skip can find and fade every one of them.
    this.wishObjects = this.config.wishes.map((wish) => {
      const heart = this.add.image(cx, GAME_HEIGHT / 2 - 62, 'credits-heart-0').setScale(4).setDepth(10).setAlpha(0);
      const text = uiText(this, cx, GAME_HEIGHT / 2, wish, 14, CREDITS_TEXT_COLOR)
        .setOrigin(0.5).setAlign('center').setWordWrapWidth(760).setStroke(CREDITS_STROKE_COLOR, 6).setDepth(10).setAlpha(0);
      return [heart, text];
    });
    this.content = [this.title, this.titleHalo, this.ageText, ...this.wishObjects.flat()];
  }

  showTitle() {
    if (this.phase !== 'running') return;
    this.tweens.add({ targets: this.title, alpha: 1, duration: 1000, ease: 'Sine.easeOut' });
    // The soft bob: the text drifts a few pixels up and down; the halo behind it stays put and breathes
    // (alpha only: scaling a Graphics would slide it, since its origin is the scene's top-left corner).
    this.tweens.add({ targets: this.title, y: this.titleY - 5, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({
      targets: this.titleHalo, alpha: 1, duration: 1000, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({ targets: this.titleHalo, alpha: 0.6, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      },
    });
  }

  showAge() {
    if (this.phase !== 'running') return;
    this.tweens.add({ targets: this.ageText, alpha: 1, duration: 900 });
    this.tweens.add({ targets: this.ageText, y: this.ageY - 4, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 300 });
  }

  showWish(index) {
    if (this.phase !== 'running') return;
    this.tweens.add({ targets: this.wishObjects[index], alpha: 1, duration: CREDITS_TEXT_FADE_MS, ease: 'Sine.easeOut' });
  }

  fadeOutObjects(objects, ms) {
    for (const obj of objects) {
      if (!obj) continue;
      this.tweens.killTweensOf(obj);
      this.tweens.add({ targets: obj, alpha: 0, duration: ms, ease: 'Sine.easeIn' });
    }
  }

  showTheEnd(skipped) {
    if (this.phase !== 'running') return;
    this.phase = 'end';
    this.endShownAt = this.elapsed;
    this.fadeOutObjects([...this.content, this.hint], skipped ? 350 : CREDITS_TEXT_FADE_MS);

    const cx = GAME_WIDTH / 2;
    this.theEndText = uiText(this, cx, GAME_HEIGHT / 2 - 24, 'THE END', 36, CREDITS_TEXT_COLOR)
      .setOrigin(0.5).setStroke(CREDITS_STROKE_COLOR, 8).setDepth(10).setAlpha(0);
    this.tweens.add({
      targets: this.theEndText, alpha: 1, duration: 900, delay: skipped ? 350 : 0, ease: 'Sine.easeOut',
      onComplete: () => this.spawnEndSparkles(),
    });
    this.tweens.add({ targets: this.theEndText, y: GAME_HEIGHT / 2 - 29, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 900 });

    if (skipped) {
      // The natural timers (madeBy, the return) are replaced: a skip lands on a fresh, shorter schedule.
      this.time.removeAllEvents();
      this.at(1700, () => this.showMadeBy());
      this.at(CREDITS_SKIP_END_HOLD_MS, () => this.returnToTitle());
    }
  }

  showMadeBy() {
    if (this.phase !== 'end' || this.madeByText) return;
    this.madeByText = uiText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, `Made for you by ${this.config.madeBy}`, 12, CREDITS_ACCENT_COLOR)
      .setOrigin(0.5).setStroke(CREDITS_STROKE_COLOR, 6).setDepth(10).setAlpha(0);
    this.tweens.add({ targets: this.madeByText, alpha: 1, duration: 1000, ease: 'Sine.easeOut' });
  }

  // One small, finite burst of pastel motes as THE END settles (never a loop), like the card's old ending.
  spawnEndSparkles() {
    if (this.phase !== 'end') return;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2 - 24;
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist = Phaser.Math.Between(90, 170);
      const mote = this.add.rectangle(cx + Math.cos(angle) * 40, cy + Math.sin(angle) * 20, 4, 4, Phaser.Utils.Array.GetRandom([0xfff0cf, 0xffc2d9, 0xffe29a]), 0.95).setDepth(11);
      this.tweens.add({
        targets: mote,
        x: cx + Math.cos(angle) * dist * 1.6,
        y: cy + Math.sin(angle) * dist * 0.7,
        alpha: 0,
        duration: 1100,
        ease: 'Cubic.easeOut',
        onComplete: () => mote.destroy(),
      });
    }
  }

  // ---------- skipping and leaving ----------

  onSkipKey(event) {
    if (event.repeat) return;
    if (this.elapsed < CREDITS_SKIP_GRACE_MS) return;
    if (this.phase === 'running') this.showTheEnd(true);
    else if (this.phase === 'end' && this.elapsed - this.endShownAt > CREDITS_END_LEAVE_GRACE_MS) this.returnToTitle();
  }

  // Back to the title, exactly like the card did: fade out, then start 'title' (the save is untouched).
  // A failsafe timer guarantees the hand-off even if the camera fade event never arrives.
  // FB-0076: it is the END of the game, so nothing of the game is left behind the title: the world that was
  // paused when the box opened (and its HUD) are stopped first (src/scenes/ui.js stopGameplayScenes();
  // the title itself does the same in its own create(), belt and braces).
  returnToTitle() {
    if (this.phase === 'leaving') return;
    this.phase = 'leaving';
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      stopGameplayScenes(this);
      this.scene.start('title');
    };
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', go);
    this.time.delayedCall(900, go);
  }
}

// Linear blend across CREDITS_SKY_STOPS: 0 is the top of the sky, 1 the horizon.
function creditsSkyColor(t) {
  const stops = CREDITS_SKY_STOPS;
  const scaled = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(scaled), stops.length - 2);
  const f = scaled - i;
  const a = stops[i];
  const b = stops[i + 1];
  const mix = (shift) => Math.round(((a >> shift) & 255) * (1 - f) + ((b >> shift) & 255) * f);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
