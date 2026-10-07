// The ICL scanner's mini-game, "EDI Madness" (decisions/0025, docs/plans/2026-10-06-edi-madness.md, phase E3): a garage-parking lesson.
// Taru drives a small learner car, her driving instructor sits beside her and comments, and she parks three times (an open lot, backing in
// between two cars, a tight garage with pillars) without hitting anything hard. Every rule (the car physics, the collisions, bump and scrape,
// parked detection, the stages, the time limits, the instructor's lines and the 150 s failsafe) lives in src/minigames/edi-logic.js as pure,
// unit-tested functions; this file only draws that state and forwards the keys, the same split as hero.js / hero-logic.js and tower.js.
// The shared shell (intro card with the COVER picture and the backstory pages, HUD "PARKED: n / 3", game over with the skip after 3 losses,
// win card, Esc to quit) is MinigameBaseScene (framework-scene.js): a stage ends within 75 s, an attempt within 150 s, and nobody is ever locked out.
//
// Controls: W / UP gas, S / DOWN brake and reverse, A D / LEFT RIGHT steer, SPACE handbrake. The held keys are read every frame from the shell's
// mgKeys (a held state, so there is no key-repeat to worry about) and cleared when the window loses focus, so a key released while the tab was
// hidden never keeps driving. None of these is a card key that matters: ENTER / SPACE / E confirm a card, but a card is only up while nothing drives.
//
// Flow: the stage in play is `this.edi` (one stage of the logic). Parking it shows "STAGE n PARKED!" for EDI_BANNER_MS with the input off, then
// ediNextStage() starts the next one. A lost stage (3 bumps, or 75 s) waits one short beat (so the last bump and the instructor's line can be
// seen) and then the shell's game-over card counts it as one loss; RETRY restarts THAT stage (ediAttemptStart(): the lost state, again) with
// fresh hearts and a fresh clock, while a fresh opening of the game (init() clears `this.edi`) starts at stage 1. Stage 3 parked (or the failsafe)
// ends in the shell's win card.
//
// Art (tools/lib/edi-art.js, listed in EDI_ART): a backdrop per stage at 1:1 (the parked cars, pillars and bay markings are painted into it), the
// car sheet (56 px cells, a row per colour, a column per heading: the learner car is the player's), small sprites (hearts, spark, tick, stop),
// the instructor's portrait (48 px, frame 1 = wincing) and the intro cover.

const EDIS_CAR_DEPTH = 10;
const EDIS_HUD_DEPTH = 90;
const EDIS_BUBBLE_PAD = 12; // inside the speech bubble
const EDIS_BUBBLE_FONT = 10;
const EDIS_MESSAGE_W = 380; // the shell's showMessage() panel (framework-scene.js)
const EDIS_MESSAGE_H = 34;
const EDIS_BAY_GREEN = 0x4cd964;
const EDIS_RING_R = 30;
const EDIS_HINT = 'PARK IN THE GREEN BAY, HOLD STILL'; // shown once, on the very first try (the shell's message panel is 380 px wide: 36 characters)

// 'assets/minigames/edi-bg-1.png' -> 'edi-bg-1' (the texture key is the file's own name)
function ediTextureKey(file) {
  return file.split('/').pop().replace(/\.png$/, '');
}

class EdiScene extends MinigameBaseScene {
  constructor() {
    super('minigame-edi');
  }

  // Runs on every opening of the game: nothing of an earlier opening may leak into this one (a fresh opening starts at stage 1).
  init(data) {
    super.init(data);
    this.edi = null; // the stage in play; ediAttemptStart() reads it to decide between "again" and "stage 1"
    this.beat = null; // { kind: 'banner' | 'lose' | 'win', ms, end }: a short pause with the input off
    this.winceMs = 0;
    this.hintShown = false;
    this.debugFreeze = false;
  }

  preload() {
    EDI_ART.bg.forEach((file) => {
      if (!this.textures.exists(ediTextureKey(file))) this.load.image(ediTextureKey(file), file);
    });
    if (!this.textures.exists('edi-cover')) this.load.image('edi-cover', EDI_ART.cover);
    if (!this.textures.exists('edi-cars')) this.load.spritesheet('edi-cars', EDI_ART.cars, { frameWidth: EDI_CAR_CELL, frameHeight: EDI_CAR_CELL });
    if (!this.textures.exists('edi-sprites')) this.load.spritesheet('edi-sprites', EDI_ART.sprites, { frameWidth: 32, frameHeight: 32 });
    if (!this.textures.exists('edi-instructor')) this.load.spritesheet('edi-instructor', EDI_ART.instructor, { frameWidth: 48, frameHeight: 48 });
  }

  buildScene() {
    this.bg = this.add.image(0, 0, ediTextureKey(EDI_ART.bg[0])).setOrigin(0, 0).setDepth(-10);
    this.bayGfx = this.add.graphics().setDepth(-5);
    this.car = this.add.sprite(0, 0, 'edi-cars', ediLearnerFrame(0)).setDepth(EDIS_CAR_DEPTH);
    this.ringGfx = this.add.graphics().setDepth(12);

    // The HUD: a dark strip over the garage's top wall with the hearts, the stage and the clock (the shell's own HUD, "PARKED: n / 3", sits in the middle).
    this.hudParts = [];
    const hud = (part) => { this.hudParts.push(part); return part; };
    hud(this.add.rectangle(0, 0, GAME_WIDTH, EDI_TILE, 0x000000, 0.55).setOrigin(0, 0).setDepth(EDIS_HUD_DEPTH - 2));
    this.hearts = [];
    for (let i = 0; i < EDI_HEARTS; i++) {
      this.hearts.push(hud(this.add.sprite(52 + i * 30, 16, 'edi-sprites', EDI_SPRITE_FRAME.heartFull).setScale(2).setDepth(EDIS_HUD_DEPTH)));
    }
    this.stageText = hud(uiText(this, 260, 16, '', 10, COLORS.text).setOrigin(0, 0.5).setDepth(EDIS_HUD_DEPTH + 1));
    this.timeText = hud(uiText(this, GAME_WIDTH - 44, 16, '', 10, COLORS.highlight).setOrigin(1, 0.5).setDepth(EDIS_HUD_DEPTH + 1));

    // The instructor: a framed portrait in the bottom-right corner of the floor (clear of every stage's start, bay and pillars), a name tag under it
    // and a speech bubble that sits beside it (or wherever it covers nothing important: ediPickBubbleRect()).
    const p = EDI_PORTRAIT;
    hud(this.add.rectangle(p.x + p.size / 2, p.y + p.size / 2, p.size + 8, p.size + 8, COLORS.panel).setStrokeStyle(2, COLORS.border).setDepth(EDIS_HUD_DEPTH));
    this.portrait = hud(this.add.sprite(p.x, p.y, 'edi-instructor', 0).setOrigin(0, 0).setDepth(EDIS_HUD_DEPTH + 1));
    hud(uiText(this, p.x + p.size / 2, p.y + p.size + 7, 'Instructor', 8, '#1a1c2c').setOrigin(0.5, 0).setDepth(EDIS_HUD_DEPTH + 1));
    this.bubblePanel = makePanel(this, 0, 0, 100, 40).setDepth(EDIS_HUD_DEPTH + 2).setVisible(false);
    this.bubbleText = uiText(this, 0, 0, '', EDIS_BUBBLE_FONT, COLORS.text).setDepth(EDIS_HUD_DEPTH + 3).setVisible(false);
    this.bubbleText.setWordWrapWidth(EDI_BUBBLE_MAX_W - 2 * EDIS_BUBBLE_PAD);
    this.bubbleShown = null; // the text the bubble is sized for
    this.bubbleRect = null;
    pinToScreen([...this.hudParts, this.bubblePanel, this.bubbleText]);

    // "STAGE n PARKED!" between two stages.
    this.banner = [makePanel(this, (GAME_WIDTH - 360) / 2, 108, 360, 56).setDepth(EDIS_HUD_DEPTH + 5), uiText(this, GAME_WIDTH / 2, 136, '', 16, COLORS.highlight).setOrigin(0.5).setDepth(EDIS_HUD_DEPTH + 6)];
    this.bannerText = this.banner[1];
    pinToScreen(this.banner);
    this.banner.forEach((part) => part.setVisible(false));

    // A key released while the window was not focused sends no keyup: never stay "held" through a blur.
    this.game.events.on('blur', this.releaseKeys, this);
    this.events.once('shutdown', () => this.game.events.off('blur', this.releaseKeys, this));
  }

  // EDI draws its own HUD (hearts, stage, clock), and the shell's centre-top "PARKED: n / 3" panel would sit on the bays along the top wall: it stays hidden.
  // The score bookkeeping (setScore / refreshHud / recordAttempt) is the shell's and unchanged.
  setHudVisible() {
    this.hud.parts.forEach((part) => part.setVisible(false));
  }

  // The shell's message strip (a hint, "TIME IS UP!"), moved to a spot that covers no parked car, bay, pillar, the car, or the instructor's bubble.
  say(text) {
    this.showMessage(text);
    const bubble = this.bubbleText.visible ? this.bubbleRect : null;
    const r = ediPickBubbleRect(this.edi, EDIS_MESSAGE_W, EDIS_MESSAGE_H, null, [bubble]);
    this.message.panel.setPosition(r.x, r.y);
    this.message.label.setPosition(r.x + EDIS_MESSAGE_W / 2, r.y + EDIS_MESSAGE_H / 2);
  }

  releaseKeys() {
    if (!this.mgKeys) return;
    for (const key of Object.values(this.mgKeys)) if (key && typeof key.reset === 'function') key.reset();
  }

  startAttempt() {
    this.edi = ediAttemptStart(this.edi, GameState.playerName); // the stage she lost, again; stage 1 on a fresh opening
    this.releaseKeys(); // the press that confirmed START / RETRY must not carry into the drive
    this.setEdiHudVisible(true);
    this.resetStageView();
    this.score = ediStagesParked(this.edi); // not setScore(): a retry of stage 2 starts at 1 parked without a score pop
    this.refreshHud();
    if (!this.hintShown) {
      this.hintShown = true;
      this.say(EDIS_HINT);
    }
  }

  // Everything that belongs to "the stage in play" is redrawn from this.edi: the backdrop, hearts, car, bay, bubble, portrait.
  resetStageView() {
    this.beat = null;
    this.winceMs = 0;
    this.bg.setTexture(ediTextureKey(EDI_ART.bg[this.edi.stageIndex]));
    this.tweens.killTweensOf([this.car, ...this.banner]);
    this.banner.forEach((part) => part.setVisible(false));
    this.ringGfx.clear();
    this.bubbleShown = null;
    this.bubbleRect = null;
    this.bubblePanel.setVisible(false);
    this.bubbleText.setVisible(false);
    this.refreshHearts(false);
    this.syncAll();
  }

  setEdiHudVisible(visible) {
    this.hudParts.forEach((part) => part.setVisible(visible)); // the car and the bay stay: they are the picture behind a card
  }

  // ---------- one frame ----------

  playUpdate(time, delta) {
    if (this.debugFreeze) { // QA only: time stands still, the drawing follows the state
      this.syncAll();
      return;
    }
    if (this.beat) {
      this.updateBeat(delta);
      if (this.mgState === 'playing') this.syncAll();
      return;
    }
    const k = this.mgKeys;
    const input = ediInputFromKeys({
      UP: k.UP.isDown, W: k.W.isDown, DOWN: k.DOWN.isDown, S: k.S.isDown,
      LEFT: k.LEFT.isDown, A: k.A.isDown, RIGHT: k.RIGHT.isDown, D: k.D.isDown, SPACE: k.SPACE.isDown,
    });
    const events = stepEdiParking(this.edi, input, delta);
    for (const event of events) this.handleEvent(event);
    this.winceMs = Math.max(0, this.winceMs - delta);
    if (this.mgState === 'playing') this.syncAll();
  }

  handleEvent(event) {
    const s = this.edi;
    switch (event.type) {
      case 'bump':
        AudioManager.play('lockedDoorThud');
        this.hurtHit(); // juice: a red pulse and a small shake (framework-scene.js)
        this.refreshHearts(true);
        this.sparkAt(event.x, event.y);
        this.winceMs = EDI_WINCE_MS;
        break;
      case 'scrape':
        AudioManager.playThrottled('doorClose', 'edi-scrape', 300, this.time.now); // a small thud, nothing else: a scrape costs nothing
        break;
      case 'line': // the bubble follows state.instructor every frame; only the "hold still" line has a sign of its own
        if (event.kind === 'nearPark') this.popSprite(EDI_SPRITE_FRAME.stop, s.car.x, s.car.y - 34, 1.1, 900);
        break;
      case 'parked':
        AudioManager.play('minigameLineClear'); // the win chime of a stage (the shell's own jingle is for the whole game)
        this.setScore(ediStagesParked(s));
        this.popSprite(EDI_SPRITE_FRAME.tick, s.car.x, s.car.y - 30, 2, 1000);
        break;
      case 'stageWon':
        this.beat = { kind: 'banner', ms: 0, end: EDI_BANNER_MS };
        this.bannerText.setText(ediBannerText(event.stage));
        this.banner.forEach((part) => part.setVisible(true));
        playConfettiBurst(this, { x: GAME_WIDTH / 2, y: 140 }); // src/juice.js: a small burst, nothing waits on it
        break;
      case 'timeout':
        this.say('TIME IS UP!');
        break;
      case 'lost':
        this.beat = { kind: 'lose', ms: 0, end: EDI_END_BEAT_MS };
        break;
      case 'win':
        if (event.failsafe) this.win(); // the 150 s soft-lock guard: straight to the win card
        else this.beat = { kind: 'win', ms: 0, end: EDI_END_BEAT_MS }; // stage 3 parked: the tick and the instructor's line first
        break;
      default:
    }
  }

  // The pause after a stage is parked (the banner, then the next stage), after the last stage (then the win card) or after a loss (then the game-over card).
  // It runs off the frame time, so it can never hang, and Esc still quits during it (the shell's own key handler).
  updateBeat(delta) {
    const b = this.beat;
    b.ms += delta;
    this.winceMs = Math.max(0, this.winceMs - delta);
    if (b.ms < b.end) return;
    this.beat = null;
    if (b.kind === 'banner') this.advanceStage();
    else if (b.kind === 'lose') this.lose(); // one loss for the skip-after-3 rule; RETRY restarts this same stage
    else this.win();
  }

  advanceStage() {
    const next = ediNextStage(this.edi);
    if (!next) { this.win(); return; }
    this.edi = next;
    this.resetStageView();
  }

  // For tools and tests (tools/qa-shots.js, tests/e2e/minigames.spec.js): jumps to stage `index` (0-based). `pose`: true puts the car a short way out
  // from the bay facing it, or a { x, y, heading } of your own; `inBay`: in the bay (frozen shots of the glow and the ring); `invulnerable`: no hearts lost.
  debugSetStage(index, { pose = null, inBay = false, invulnerable = false } = {}) {
    this.edi = createEdiParking(index, { name: GameState.playerName });
    const stage = ediStageOf(this.edi);
    if (inBay) Object.assign(this.edi.car, ediPoseNearBay(stage, 0));
    else if (pose) Object.assign(this.edi.car, pose === true ? ediPoseNearBay(stage) : pose);
    if (invulnerable) this.edi.invulnMs = 60000;
    this.resetStageView();
    this.score = ediStagesParked(this.edi);
    this.refreshHud();
  }

  // ---------- drawing the state ----------

  syncAll() {
    this.syncCar();
    this.syncBay();
    this.syncHud();
    this.syncInstructor();
  }

  syncCar() {
    const c = this.edi.car;
    this.car.setPosition(Math.round(c.x), Math.round(c.y)).setFrame(ediLearnerFrame(c.heading));
    this.car.setAlpha(this.beat ? 1 : ediBlinkAlpha(this.edi.invulnMs)); // it blinks while a bump's invulnerability lasts
  }

  // The bay: a green rounded rectangle that glows once she is in it with the right heading, and a ring that fills while she holds still.
  syncBay() {
    const s = this.edi;
    const bay = ediStageOf(s).bay;
    const a = ediBayAlpha(s);
    this.bayGfx.clear();
    this.bayGfx.fillStyle(EDIS_BAY_GREEN, a).fillRoundedRect(bay.x, bay.y, bay.w, bay.h, 6);
    this.bayGfx.lineStyle(2, 0xc9f0c4, Math.min(1, a + 0.3)).strokeRoundedRect(bay.x, bay.y, bay.w, bay.h, 6);
    this.ringGfx.clear();
    if (s.parkProgress > 0 && s.status === 'playing') {
      const start = -Math.PI / 2;
      this.ringGfx.lineStyle(4, 0xffffff, 0.9).beginPath();
      this.ringGfx.arc(Math.round(s.car.x), Math.round(s.car.y), EDIS_RING_R, start, start + 2 * Math.PI * s.parkProgress, false);
      this.ringGfx.strokePath();
    }
  }

  syncHud() {
    const s = this.edi;
    this.stageText.setText(ediStageLabel(s.stageIndex));
    const left = ediTimeLeftMs(s);
    this.timeText.setText(ediClockText(left)).setColor(left <= 10000 ? '#ff7a7a' : COLORS.highlight); // red in the last 10 s (a colour, not a flash)
  }

  syncInstructor() {
    this.portrait.setFrame(this.winceMs > 0 ? 1 : 0);
    const ins = this.edi.instructor;
    if (!ins || ins.ms <= 0 || !ins.text) {
      this.bubblePanel.setVisible(false);
      this.bubbleText.setVisible(false);
      return;
    }
    if (this.bubbleShown !== ins.text) { // a new line: measure it once
      this.bubbleShown = ins.text;
      this.bubbleRect = null;
      this.bubbleText.setText(ins.text);
      this.bubbleSize = {
        w: Math.min(EDI_BUBBLE_MAX_W, Math.ceil(this.bubbleText.width) + 2 * EDIS_BUBBLE_PAD),
        h: Math.ceil(this.bubbleText.height) + 2 * EDIS_BUBBLE_PAD,
      };
      this.bubblePanel.setPanelSize(this.bubbleSize.w, this.bubbleSize.h);
    }
    const rect = ediPickBubbleRect(this.edi, this.bubbleSize.w, this.bubbleSize.h, this.bubbleRect);
    this.bubbleRect = rect;
    this.bubblePanel.setPosition(rect.x, rect.y).setVisible(true);
    this.bubbleText.setPosition(rect.x + EDIS_BUBBLE_PAD, rect.y + EDIS_BUBBLE_PAD).setVisible(true);
    const alpha = Math.min(1, ins.ms / 300); // fades out over its last 300 ms
    this.bubblePanel.setAlpha(alpha);
    this.bubbleText.setAlpha(alpha);
  }

  refreshHearts(pulse = false) {
    const left = this.edi.hearts;
    this.hearts.forEach((heart, i) => {
      heart.setFrame(i < left ? EDI_SPRITE_FRAME.heartFull : EDI_SPRITE_FRAME.heartEmpty);
      if (pulse && i === left) { // the one just lost
        this.tweens.killTweensOf(heart);
        heart.setScale(3.2);
        this.tweens.add({ targets: heart, scale: 2, duration: 260, ease: 'Back.easeOut' });
      }
    });
  }

  // ---------- effects ----------

  // A bump's spark where the car met the obstacle.
  sparkAt(x, y) {
    const spark = this.add.sprite(x, y, 'edi-sprites', EDI_SPRITE_FRAME.spark).setScale(0.8).setDepth(60);
    this.tweens.add({ targets: spark, scale: 1.8, alpha: 0, duration: 320, ease: 'Cubic.easeOut', onComplete: () => spark.destroy() });
  }

  // A small sign that pops up over the car and fades (the green tick of a parked stage, the stop sign of "now hold still").
  popSprite(frame, x, y, scale, ms) {
    const sprite = this.add.sprite(x, y, 'edi-sprites', frame).setScale(scale * 0.5).setDepth(61);
    this.tweens.add({ targets: sprite, scale, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sprite, y: y - 12, alpha: 0, duration: 380, delay: ms - 380, ease: 'Sine.easeIn', onComplete: () => sprite.destroy() });
  }

  // A game-over or win card is about to appear: nothing of the garage's furniture may bleed through the dim backdrop.
  onPanelShown() {
    this.beat = null;
    if (!this.bubblePanel) return;
    this.banner.forEach((part) => part.setVisible(false));
    this.ringGfx.clear();
    this.setEdiHudVisible(false);
    this.bubblePanel.setVisible(false);
    this.bubbleText.setVisible(false);
  }
}
