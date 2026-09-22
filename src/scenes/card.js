// The birthday card (docs/STORY.md "the ending", docs/ROADMAP.md M3): a full-screen, animated pixel
// card -- confetti, a cake with candles, floating hearts, a photo slideshow and the owner's own
// messages, typed out one at a time -- ending on "THE END" and back to the title screen. Started by
// src/scenes/box-opening.js once the box has finished opening (never returns to 'world': the game is
// over from here, docs/ROADMAP.md M3), and also reachable directly from the title screen's "Watch
// the Card Again" (src/scenes/title.js, once a save with `quest.stage === 'rewarded'` exists).
//
// Content lives in src/card.js (buildCardConfig()) and, for real use, in the owner's own
// assets/card/card.json + assets/card/photos/ + assets/card/video.mp4 -- all gitignored (see
// .gitignore), so a fresh checkout has none of it. Every beat below is written to look complete and
// warm even then: DEFAULT_CARD_MESSAGES (src/card.js) and card-placeholder-photo.png
// (tools/make-card-art.js) are exactly that placeholder content, not an error state.
//
// Photo-slideshow geometry duplicates two small constants tools/make-card-art.js documents in its
// own header comment (the frame's window rect, the cake's candle positions) rather than importing
// that Node build tool into the browser -- see FRAME_WINDOW/CAKE_CANDLE_LOCAL_* below.

const FRAME_WINDOW = { x0: 10, y0: 10, x1: 209, y1: 149 }; // inside card-frame.png, 200x140
const FRAME_SCALE = 1.3;
const CAKE_SCALE = 2.6;
// The cake and photo frame's shared vertical center. Chosen so the frame's own display height
// (card-frame.png is 160 tall, so 160*FRAME_SCALE/2 = 104px above and below this line) plus its
// caption both stay clear of the dialog box's fixed top edge (DialogBox's own `box.y`, src/scenes/
// ui.js: y=382) -- a lower value here used to let the frame's bottom border visibly overlap the
// dialog box (found via tools/qa-shots.js's "card-message" shot: the frame's cream border was
// drawing right through the dialog panel's own top edge).
const INTERIOR_ROW_Y = 225;
const CAKE_CANDLE_LOCAL_X = [18, 28, 38]; // local px inside card-cake.png's 56-wide canvas
const CAKE_CANDLE_LOCAL_TOP_Y = 4; // just above where the candle sticks start (local y 6)

const PHOTO_HOLD_MS = 2600;
const PHOTO_FADE_MS = 500;
const CONFETTI_INTERVAL_MS = 220;
const END_HOLD_MS = 2200;

class CardScene extends Phaser.Scene {
  constructor() {
    super('card');
  }

  init() {
    this.ended = false;
    this.missingPhotoKeys = new Set();
    this.timers = []; // every looping/delayed timer this scene starts, so skipToEnd() can kill them all at once
  }

  preload() {
    this.load.on('loaderror', (file) => {
      if (file.key.startsWith('card-photo-')) this.missingPhotoKeys.add(file.key);
    });

    if (!this.textures.exists('card-cover')) this.load.image('card-cover', 'assets/cutscenes/card-cover.png');
    if (!this.textures.exists('card-frame')) this.load.image('card-frame', 'assets/cutscenes/card-frame.png');
    if (!this.textures.exists('card-cake')) this.load.image('card-cake', 'assets/cutscenes/card-cake.png');
    if (!this.textures.exists('card-heart')) this.load.image('card-heart', 'assets/cutscenes/card-heart.png');
    if (!this.textures.exists('card-placeholder-photo')) this.load.image('card-placeholder-photo', 'assets/cutscenes/card-placeholder-photo.png');
    this.load.json('card-config', CARD_CONFIG_URL);
    // The closing video is NOT queued here -- see playEndingVideoOrFinish()'s own comment for why
    // (Phaser's video loader can't be trusted to report a 404 as a real error).
  }

  // The photo list isn't known until card-config.json (just loaded above) is parsed, so the photo
  // files themselves are queued in a second pass here, and create()'s own logic waits for that
  // second load to finish too (standard Phaser "queue more files once you know what you need").
  create() {
    this.input.keyboard.on('keydown-ESC', (event) => { if (!event.repeat) this.skipToEnd(); });
    for (const key of ['ENTER', 'SPACE', 'E']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => { if (!event.repeat) this.onAdvanceKey(); });
    }

    const raw = this.cache.json.get('card-config');
    this.config = buildCardConfig(raw, GameState.playerName);

    if (this.config.photos.length === 0) {
      this.beginSequence();
      return;
    }
    this.config.photos.forEach((photo, i) => this.load.image(`card-photo-${i}`, `${CARD_PHOTOS_DIR}${photo.file}`));
    this.load.once('complete', () => this.beginSequence());
    this.load.start();
  }

  // E/Space/Enter: while the cover is still showing, skip straight to opening it (same "don't make
  // the player wait on nothing" rule as everywhere else in this game); while the messages are
  // playing, forward to the dialog box exactly like the cutscene player does.
  onAdvanceKey() {
    if (this.dialog && this.dialog.isOpen) { this.dialog.advance(); return; }
    if (this.coverOpening === false) this.openCover();
  }

  // ---------- the sequence ----------

  beginSequence() {
    this.cameras.main.setBackgroundColor('#1a1610');
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.buildInterior(); // built up front, hidden behind the cover until openCover() runs
    this.showCover();
  }

  showCover() {
    this.coverOpening = false;
    const scale = 1.7;
    this.cover = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'card-cover').setOrigin(0.5).setScale(scale).setDepth(200).setAlpha(0);
    this.coverTitle = uiText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, `HAPPY BIRTHDAY,\n${this.config.recipient.toUpperCase()}!`, 16, COLORS.highlight)
      .setOrigin(0.5).setAlign('center').setStroke('#1a1c2c', 5).setLineSpacing(10).setDepth(201).setAlpha(0);
    this.coverHint = uiText(this, GAME_WIDTH / 2, GAME_HEIGHT - 46, 'PRESS ENTER TO OPEN', 8, COLORS.dim).setOrigin(0.5).setDepth(201).setAlpha(0);
    this.tweens.add({ targets: [this.cover, this.coverTitle], alpha: 1, duration: 400 });
    // Named (not just addTimer()'d) so openCover() can cancel this specific one below -- a plain
    // killTimers()-on-skip wouldn't fire here (this isn't a skip), and without cancelling it, this
    // timer firing *after* an early Enter press would fade coverHint back in on top of the interior
    // scene it has no business appearing over (found via tools/qa-shots.js "card-message" shot).
    this.coverHintTimer = this.time.delayedCall(700, () => this.tweens.add({ targets: this.coverHint, alpha: 1, duration: 300 }));
    this.addTimer(this.coverHintTimer);
    // Auto-opens on its own after a beat too (docs/GAME_FEEL.md: never make the player wait on an
    // empty prompt) -- Enter just gets there sooner. Guarded by `coverOpening` in openCover() itself,
    // so this one is harmless left pending; not cancelled for symmetry with the line above regardless.
    this.addTimer(this.time.delayedCall(2600, () => this.openCover()));
  }

  // "A pixel card that opens": the cover shrinks flat like a page swinging shut on its own spine
  // (pivoted at its own left edge), revealing the interior scene built underneath it.
  openCover() {
    if (this.coverOpening) return;
    this.coverOpening = true;
    if (this.coverHintTimer) this.coverHintTimer.remove();
    this.tweens.killTweensOf([this.cover, this.coverTitle, this.coverHint]);
    this.tweens.add({ targets: [this.coverTitle, this.coverHint], alpha: 0, duration: 150 });
    this.cover.setOrigin(0, 0.5).setX(this.cover.x - this.cover.displayWidth / 2);
    this.tweens.add({
      targets: this.cover, scaleX: 0.02, duration: 480, ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cover.destroy();
        this.coverTitle.destroy();
        this.coverHint.destroy();
        this.runInterior();
      },
    });
  }

  // ---------- the interior scene: confetti, cake, hearts, the photo slideshow and the panel that
  // holds them all -- built once, up front, behind the cover, then revealed by openCover() ----------

  buildInterior() {
    const x = 20, y = 20, w = GAME_WIDTH - 40, h = GAME_HEIGHT - 40;
    this.panel = this.add.graphics().setDepth(1);
    drawPanel(this.panel, x, y, w, h);
    this.title = uiText(this, GAME_WIDTH / 2, y + 32, `HAPPY BIRTHDAY, ${this.config.recipient.toUpperCase()}!`, 16, COLORS.highlight)
      .setOrigin(0.5).setStroke('#1a1c2c', 4).setDepth(2);

    this.buildCake();
    this.buildFrame();
    this.buildHearts();

    this.dialog = new DialogBox(this);
    this.interiorParts = [this.panel, this.title, this.cakeParts, this.frameParts, this.heartParts].flat();
  }

  buildCake() {
    const cx = 700, cy = INTERIOR_ROW_Y;
    const cake = this.add.image(cx, cy, 'card-cake').setScale(CAKE_SCALE).setDepth(2);
    const flames = CAKE_CANDLE_LOCAL_X.map((localX) => {
      const p = imageLocalPoint(cake, localX, CAKE_CANDLE_LOCAL_TOP_Y);
      const flame = this.add.ellipse(p.x, p.y, 5, 7, 0xffd23f).setDepth(3);
      this.tweens.add({
        targets: flame, scaleX: { from: 0.75, to: 1.2 }, scaleY: { from: 0.85, to: 1.25 },
        duration: Phaser.Math.Between(180, 260), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      return flame;
    });
    this.cakeParts = [cake, ...flames];
  }

  buildFrame() {
    const cx = 250, cy = INTERIOR_ROW_Y;
    const windowCenter = { x: (FRAME_WINDOW.x0 + FRAME_WINDOW.x1) / 2, y: (FRAME_WINDOW.y0 + FRAME_WINDOW.y1) / 2 };
    const windowSize = { w: FRAME_WINDOW.x1 - FRAME_WINDOW.x0, h: FRAME_WINDOW.y1 - FRAME_WINDOW.y0 };

    this.slides = this.buildSlides();
    this.slideIndex = 0;
    const frameAnchor = this.add.image(cx, cy, 'card-frame').setScale(FRAME_SCALE).setVisible(false); // geometry only
    const firstPoint = imageLocalPoint(frameAnchor, windowCenter.x, windowCenter.y);
    frameAnchor.destroy();

    this.photoA = this.add.image(firstPoint.x, firstPoint.y, this.slides[0].key).setDepth(2);
    this.photoB = this.add.image(firstPoint.x, firstPoint.y, this.slides[0].key).setDepth(2).setAlpha(0);
    this.fitPhoto(this.photoA, windowSize);
    this.fitPhoto(this.photoB, windowSize);
    const frame = this.add.image(cx, cy, 'card-frame').setScale(FRAME_SCALE).setDepth(3);
    // Below the FRAME's own full display height (card-frame.png is 160 tall -- taller than just its
    // window), not the window alone, or the caption starts inside the frame's own bottom border.
    const frameBottom = cy + (160 * FRAME_SCALE) / 2;
    this.caption = uiText(this, cx, frameBottom + 18, this.slides[0].caption, 8, COLORS.dim)
      .setOrigin(0.5).setWordWrapWidth(280).setAlign('center').setDepth(2);

    this.frameParts = [this.photoA, this.photoB, frame, this.caption];

    if (this.slides.length > 1) {
      this.addTimer(this.time.addEvent({ delay: PHOTO_HOLD_MS, loop: true, callback: () => this.nextSlide() }));
    }
  }

  // Real owner photos can be any resolution/aspect ratio; scale-to-fit inside the frame's window
  // rather than assuming the placeholder's own native 200x140.
  fitPhoto(image, windowSize) {
    const src = image.width || 1;
    const srcH = image.height || 1;
    const fit = Math.min((windowSize.w * FRAME_SCALE) / src, (windowSize.h * FRAME_SCALE) / srcH);
    image.setScale(fit);
  }

  // One slide per configured photo, falling back to the placeholder art (still keeping the owner's
  // own caption, if they wrote one) for any entry whose file 404'd -- "missing photos tolerated"
  // (docs/ROADMAP.md M3's own testing brief), not a broken slideshow.
  buildSlides() {
    if (this.config.photos.length === 0) return [{ key: 'card-placeholder-photo', caption: '' }];
    return this.config.photos.map((photo, i) => {
      const key = `card-photo-${i}`;
      const missing = this.missingPhotoKeys.has(key) || !this.textures.exists(key);
      return { key: missing ? 'card-placeholder-photo' : key, caption: photo.caption };
    });
  }

  nextSlide() {
    this.slideIndex = (this.slideIndex + 1) % this.slides.length;
    const slide = this.slides[this.slideIndex];
    const windowSize = { w: FRAME_WINDOW.x1 - FRAME_WINDOW.x0, h: FRAME_WINDOW.y1 - FRAME_WINDOW.y0 };
    this.photoB.setTexture(slide.key).setAlpha(0);
    this.fitPhoto(this.photoB, windowSize);
    this.tweens.add({ targets: this.photoB, alpha: 1, duration: PHOTO_FADE_MS });
    this.tweens.add({
      targets: this.photoA, alpha: 0, duration: PHOTO_FADE_MS,
      onComplete: () => {
        // Swap so photoA is always the one currently visible, ready for the next cross-fade.
        const tmp = this.photoA; this.photoA = this.photoB; this.photoB = tmp;
      },
    });
    this.caption.setText(slide.caption);
  }

  buildHearts() {
    const spots = [[80, 90], [880, 90], [80, 460], [880, 460], [480, 60]];
    this.heartParts = spots.map(([x, y], i) => {
      const heart = this.add.image(x, y, 'card-heart').setScale(2).setDepth(2).setAlpha(0.9);
      this.tweens.add({
        targets: heart, y: y - 8, duration: 1300 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      return heart;
    });
  }

  spawnConfettiPiece() {
    const x = Phaser.Math.Between(20, GAME_WIDTH - 20);
    const colors = [0xff6fb1, 0xffd23f, 0x3b7dd8, 0xffffff, 0x8fd46a];
    const piece = this.add.rectangle(x, -10, 5, 9, Phaser.Utils.Array.GetRandom(colors)).setDepth(90);
    const drift = Phaser.Math.Between(-40, 40);
    const duration = Phaser.Math.Between(2200, 3200);
    this.tweens.add({
      targets: piece, y: GAME_HEIGHT + 10, x: x + drift, angle: Phaser.Math.Between(180, 720),
      duration, ease: 'Sine.easeIn', onComplete: () => piece.destroy(),
    });
  }

  // ---------- the interior actually running: confetti + the messages, typed one at a time ----------

  runInterior() {
    this.interiorParts.forEach((part) => part.setVisible(true));
    this.confettiTimer = this.time.addEvent({ delay: CONFETTI_INTERVAL_MS, loop: true, callback: () => this.spawnConfettiPiece() });
    this.addTimer(this.confettiTimer);
    // Narration-style box (no speaker name), the same DialogBox class and typewriter feel every
    // other piece of story text in this game uses (src/scenes/cutscene.js reuses it the same way).
    this.dialog.open(null, this.config.messages, () => this.afterMessages());
  }

  afterMessages() {
    if (this.confettiTimer) this.confettiTimer.remove();
    this.playEndingVideoOrFinish();
  }

  // ---------- the closing video (optional) and "THE END" ----------

  // Checked with a plain fetch() first, not by queuing it straight into Phaser's loader and trusting
  // 'loaderror' -- Phaser's video loader can add a broken <video> to cache.video even after the
  // underlying request 404s (found via tools/qa-shots.js, see src/scenes/box-opening.js's own
  // identical comment), so a fetch that resolves `ok: false` (or rejects) is the only check this
  // scene trusts. That's also the default, expected case until the owner drops a clip in
  // (assets/card/ is gitignored and empty by default, docs/STORY.md) -- this must never hang or throw.
  playEndingVideoOrFinish() {
    if (this.ended) return; // a skip (skipToEnd()) may have already ended things while this was pending
    fetch(CARD_VIDEO_URL)
      .then((response) => {
        if (this.ended) return;
        if (!response.ok) { this.showEnding(); return; }
        this.load.video('card-video', CARD_VIDEO_URL);
        this.load.once('complete', () => this.playEndingVideo());
        this.load.once('loaderror', () => this.showEnding());
        this.load.start();
      })
      .catch(() => { if (!this.ended) this.showEnding(); });
  }

  playEndingVideo() {
    if (this.ended) return;
    try {
      this.interiorParts.forEach((part) => part.setVisible(false));
      const video = this.add.video(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'card-video').setDepth(210);
      this.endingVideo = video;
      const source = video.video;
      video.setScale(source && source.videoWidth ? GAME_WIDTH / source.videoWidth : 1);
      video.play(false);
      video.once('complete', () => this.showEnding());
    } catch (error) {
      console.warn('card: closing video playback failed, finishing on the message instead', error);
      this.showEnding();
    }
  }

  // "the card finishes on a final message" when there's no video -- and, video or not, a gentle
  // "THE END" either way, then back to the title screen (docs/ROADMAP.md M3), keeping the save
  // (nothing here touches it -- see src/save.js's own autosave, already triggered when the volunteer
  // set `quest.stage = 'rewarded'`).
  showEnding() {
    if (this.ended) return;
    this.ended = true;
    this.killTimers();
    if (this.endingVideo) { try { this.endingVideo.stop(); } catch (error) { /* already stopped */ } }
    this.children.removeAll(true);
    this.cameras.main.setBackgroundColor('#1a1610');
    const end = uiText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 'THE END', 24, COLORS.highlight).setOrigin(0.5).setAlpha(0);
    this.tweens.add({
      targets: end, alpha: 1, duration: 500,
      onComplete: () => this.time.delayedCall(END_HOLD_MS, () => this.returnToTitle()),
    });
  }

  returnToTitle() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('title'));
  }

  // Esc: skip everything straight to "THE END" -- from the cover, mid-message, or during the
  // optional closing video alike (docs/ROADMAP.md M3 "is skippable").
  skipToEnd() {
    if (this.ended) return;
    // Detach the dialog's own onClose first: closing it while it's still mid-message would otherwise
    // cascade into afterMessages() -> the optional closing video, which a skip should bypass, not
    // play out -- see the file header, "Esc: skip everything straight to THE END".
    if (this.dialog && this.dialog.isOpen) {
      this.dialog.onClose = null;
      this.dialog.close();
    }
    this.showEnding();
  }

  addTimer(timer) {
    this.timers.push(timer);
  }

  killTimers() {
    this.timers.forEach((timer) => { if (timer && typeof timer.remove === 'function') timer.remove(); });
    this.timers = [];
    if (this.confettiTimer) { this.confettiTimer.remove(); this.confettiTimer = null; }
    this.tweens.killAll();
  }
}

// Converts a point in a (possibly scaled, possibly re-origined) image's own local pixel space into
// this scene's coordinate space -- used to place the cake's candle flames and the photo/frame
// exactly on top of art authored in tools/make-card-art.js without hand-tuning scene coordinates
// whenever that art's scale changes.
function imageLocalPoint(image, localX, localY) {
  return {
    x: image.x + (localX - image.originX * image.width) * image.scaleX,
    y: image.y + (localY - image.originY * image.height) * image.scaleY,
  };
}
