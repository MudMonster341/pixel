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
const FRAME_SCALE = 1.5;
const CAKE_SCALE = 1.3;
const CAKE_CANDLE_LOCAL_X = [18, 28, 38]; // local px inside card-cake.png's 56-wide canvas
const CAKE_CANDLE_LOCAL_TOP_Y = 4; // just above where the candle sticks start (local y 6)

// ---------- the card's own layout (coordinator review, 2026-09-22): ONE centered card, everything
// else lives inside it -- a photo frame in its upper area, the caption under the frame, the typed
// message under that, and decoration (hearts, a small cake motif) tucked into its own corners rather
// than floating loose in the empty space around a smaller panel (the first version's actual bug: a
// crowded left half, an empty right half, and the photo frame's own left edge crossing the panel's
// border). Every number below is this card's own interior geometry, in scene coordinates, so moving
// the card later (CARD_X/Y/W/H) only means changing those four numbers, not re-deriving the rest. ----------
const CARD_X = 50;
const CARD_Y = 35;
const CARD_W = 860;
const CARD_H = 470;
const CARD_CENTER_X = CARD_X + CARD_W / 2; // 480, screen-center too -- the card is centered on screen
const CARD_RIGHT = CARD_X + CARD_W;
const CARD_BOTTOM = CARD_Y + CARD_H;

const TITLE_Y = CARD_Y + 34;
const FRAME_CENTER_Y = 215; // frame spans FRAME_CENTER_Y +/- (160*FRAME_SCALE/2) = 95..335
const CAPTION_Y = FRAME_CENTER_Y + (160 * FRAME_SCALE) / 2 + 16; // just under the frame's own border
// The typed message: centered under the caption, sized for 2 lines at DialogBox's own font/wrap
// rules (src/scenes/ui.js) -- narrower than the game's ordinary full-width dialog box on purpose, so
// it reads as "inside this card", not as the game's usual bottom-of-screen textbox transplanted here.
const MESSAGE_BOX = { x: CARD_CENTER_X - 300, y: 368, w: 600, h: 104 };
// Corner decoration -- three hearts and a small cake motif, one per corner, so both halves of the
// card balance each other instead of one side crowded and the other bare (the original bug this
// redesign fixes). Hearts sit just inside the card's own border; the cake sits in the bottom-right,
// clear of MESSAGE_BOX's own right edge (780) and the card's bottom border.
const HEART_SPOTS = [
  [CARD_X + 40, CARD_Y + 60],
  [CARD_RIGHT - 40, CARD_Y + 60],
  [CARD_X + 40, CARD_BOTTOM - 40],
];
const CAKE_SPOT = { x: CARD_RIGHT - 75, y: CARD_BOTTOM - 55 };

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
    // Scaled to fully cover the interior card (CARD_W x CARD_H) that sits behind it, not just fill
    // most of the screen -- a smaller cover left the redesigned interior's own corner hearts/cake
    // motif visibly peeking out around its edges before it had even opened (found via tools/
    // qa-shots.js's "card-cover" shot). One uniform scale factor (not stretched to match width and
    // height separately, which would distort card-cover.png's own art), picked so both dimensions
    // cover the card -- whichever axis needs the bigger factor wins, and the other axis simply
    // overscans a little, same idea as a CSS `background-size: cover`.
    const coverScale = Math.max(CARD_W / 400, CARD_H / 260);
    this.cover = this.add.image(CARD_CENTER_X, GAME_HEIGHT / 2, 'card-cover').setOrigin(0.5)
      .setScale(coverScale).setDepth(200).setAlpha(0);
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
        this.cover = null; // tools/qa-shots.js's own "is the cover really gone" check relies on this
        this.runInterior();
      },
    });
  }

  // ---------- the interior scene: ONE centered card (coordinator review, see the layout comment up
  // top) holding the title, the photo frame + caption, the typed message, and corner decoration --
  // built once, up front, behind the cover, then revealed by openCover() ----------

  buildInterior() {
    this.panel = this.add.graphics().setDepth(1);
    drawCardPanel(this.panel, CARD_X, CARD_Y, CARD_W, CARD_H);
    // A deep pink, not the game's usual gold highlight -- gold reads poorly against this card's own
    // cream paper interior (too close in tone); the outline's own player-pink palette pops instead.
    this.title = uiText(this, CARD_CENTER_X, TITLE_Y, `HAPPY BIRTHDAY, ${this.config.recipient.toUpperCase()}!`, 16, '#d94b8f')
      .setOrigin(0.5).setDepth(2);

    this.buildFrame();
    this.buildCake();
    this.buildHearts();

    // A smaller message box than the game's ordinary bottom-of-screen dialog, sized to sit under the
    // caption inside the card itself (docs/GAME_FEEL.md rule 1 still applies: DialogBox measures its
    // own content, this just gives it a different box to measure into -- src/scenes/ui.js).
    this.dialog = new DialogBox(this, MESSAGE_BOX);
    this.interiorParts = [this.panel, this.title, this.cakeParts, this.frameParts, this.heartParts].flat();
  }

  // A small corner motif (coordinator review: was a large, lone centerpiece with nothing balancing
  // it on the card's other side) -- tucked into the card's bottom-right corner, clear of the message
  // box (MESSAGE_BOX's own right edge, 780) and the card's own border.
  buildCake() {
    const cake = this.add.image(CAKE_SPOT.x, CAKE_SPOT.y, 'card-cake').setScale(CAKE_SCALE).setDepth(2);
    const flames = CAKE_CANDLE_LOCAL_X.map((localX) => {
      const p = imageLocalPoint(cake, localX, CAKE_CANDLE_LOCAL_TOP_Y);
      const flame = this.add.ellipse(p.x, p.y, 4, 5, 0xffd23f).setDepth(3);
      this.tweens.add({
        targets: flame, scaleX: { from: 0.75, to: 1.2 }, scaleY: { from: 0.85, to: 1.25 },
        duration: Phaser.Math.Between(180, 260), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      return flame;
    });
    this.cakeParts = [cake, ...flames];
  }

  // Centred in the card's own upper area (coordinator review: was off-center, its own left edge
  // crossing the card's border) -- the caption sits directly under it, nothing overlapping either.
  buildFrame() {
    const cx = CARD_CENTER_X, cy = FRAME_CENTER_Y;
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
    // A warm brown, not COLORS.dim's cool gray -- COLORS.dim is tuned for the game's own dark navy
    // panels and reads washed-out against this card's cream paper interior.
    this.caption = uiText(this, cx, CAPTION_Y, this.slides[0].caption, 8, '#7a5a33')
      .setOrigin(0.5).setWordWrapWidth(320).setAlign('center').setDepth(2);

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

  // Three of the card's four corners (the fourth holds the cake motif, CAKE_SPOT) -- accents, not
  // the empty-space filler the first version's scattered five ended up as.
  buildHearts() {
    this.heartParts = HEART_SPOTS.map(([x, y], i) => {
      const heart = this.add.image(x, y, 'card-heart').setScale(2).setDepth(2).setAlpha(0.9);
      this.tweens.add({
        targets: heart, y: y - 8, duration: 1300 + i * 120, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      return heart;
    });
  }

  spawnConfettiPiece() {
    const x = Phaser.Math.Between(20, GAME_WIDTH - 20);
    // No white: confetti drifts over both the dark background and the card's own cream interior
    // (coordinator review, "confetti drifting over the whole screen"), and white nearly vanishes
    // against cream paper.
    const colors = [0xff6fb1, 0xffd23f, 0x3b7dd8, 0xd94b8f, 0x8fd46a];
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

// The card's own panel -- a warm paper interior with a gold border and a soft drop shadow, deliberately
// NOT src/scenes/ui.js's drawPanel() (dark navy, this game's usual UI chrome): a birthday card reads
// as paper, not as another dark menu box, and the redesign this function is part of (coordinator
// review, 2026-09-22) is specifically about the card reading as one warm, deliberate object rather
// than UI furniture with decoration scattered around it. Same bevel/shadow technique as drawPanel
// (src/scenes/ui.js) -- a lighter tone along the top/left inside edge, a darker one bottom/right --
// so it still reads as "a little 3D" (docs/STYLE_GUIDE.md), just in this card's own palette.
function drawCardPanel(g, x, y, w, h) {
  g.fillStyle(0x000000, 0.35).fillRect(x + 6, y + 8, w, h);
  g.fillStyle(0xf5ead0, 1).fillRect(x, y, w, h);
  g.fillStyle(0xeadbb8, 1).fillRect(x, y, w, 10); // a faint header band, echoes card-cover.png's own
  g.lineStyle(6, 0xffd23f, 1).strokeRect(x + 3, y + 3, w - 6, h - 6);
  g.lineStyle(1, 0xffffff, 0.5).lineBetween(x + 9, y + 9, x + w - 9, y + 9).lineBetween(x + 9, y + 9, x + 9, y + h - 9);
  g.lineStyle(1, 0x9c845c, 0.5).lineBetween(x + 9, y + h - 9, x + w - 9, y + h - 9).lineBetween(x + w - 9, y + 9, x + w - 9, y + h - 9);
  g.lineStyle(2, 0x1a1c2c, 1).strokeRect(x, y, w, h);
}
