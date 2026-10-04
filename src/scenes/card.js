// The birthday card (docs/STORY.md "the ending", docs/ROADMAP.md M3): a full-screen, animated pixel
// card -- confetti, a cake with candles, floating hearts, a photo slideshow and the owner's own
// messages, typed out one at a time -- ending by handing off to the credits scene (src/scenes/credits.js:
// wishes, "THE END", back to the title screen). Started by
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
// FB-0076: how long the optional closing video may take to answer / to load before the card gives up on it
// and moves on to the credits (a missing file answers at once; these only matter when something hangs).
const CARD_VIDEO_PROBE_TIMEOUT_MS = 4000;
const CARD_VIDEO_LOAD_TIMEOUT_MS = 8000;

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
    // The temporary slideshow's art (src/card.js TEMP_CARD_SLIDES) -- always queued, unlike the
    // owner's own photos below: these 5 are generated, committed files (tools/make-card-art.js), not
    // gitignored content that might not exist, so there's nothing conditional about loading them.
    for (let i = 1; i <= 5; i++) {
      const key = `card-temp-${i}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/cutscenes/card-temp-${i}.png`);
    }
    // This scene's own message box reuses DialogBox (src/scenes/ui.js), which needs the UI kit's
    // textures -- normally already loaded by boot/title by the time this scene is reached, but
    // guarded/idempotent like every other preload() here, so a direct reach-in can't be caught short.
    preloadUiKit(this);
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
    this.config = buildCardConfig(raw);

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

  // Drives the message box's typewriter and its bouncing arrow (DialogBox.update), exactly like the cutscene
  // player does. Without this the card's messages never type: the box stays blank while it reports typing.
  update(time, delta) {
    if (this.dialog) this.dialog.update(time, delta);
  }

  // ---------- the sequence ----------

  beginSequence() {
    this.cameras.main.setBackgroundColor('#1a1610');
    this.cameras.main.fadeIn(250, 0, 0, 0);
    // M5 sound: a no-op if box-opening.js already started it (the common path); makes sure it's
    // playing regardless when this scene is reached directly (title's "Watch the Card Again").
    AudioManager.playMusic('cardMusic');
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
    this.buildTitleGlow();
    // A deep pink, not the game's usual gold highlight -- gold reads poorly against this card's own
    // cream paper interior (too close in tone); the outline's own player-pink palette pops instead.
    this.title = uiText(this, CARD_CENTER_X, TITLE_Y, `HAPPY BIRTHDAY, ${this.config.recipient.toUpperCase()}!`, 16, '#d94b8f')
      .setOrigin(0.5).setDepth(2);

    this.buildFrame();
    this.buildCake();
    this.buildHearts();

    // A smaller message box than the game's ordinary bottom-of-screen dialog, sized to sit under the
    // caption inside the card itself (docs/GAME_FEEL.md rule 1 still applies: DialogBox measures its
    // own content, this just gives it a different box to measure into -- src/scenes/ui.js). Quality
    // loop, "Card and ending" run 1: the shared DialogBox always draws ui.js's own dark navy panel
    // (makePanel()) -- read as a second, unrelated box sitting under the photo frame's warm paper.
    // Draw this card's own cream note-paper panel first, then hide DialogBox's panel behind it
    // (alpha 0, not setVisible(false) -- open() would just turn visibility back on every time it
    // runs) so the message reads as written on the card itself, one composition with the photo above
    // it, not two different UI languages stacked on top of each other.
    this.messagePanel = this.add.graphics().setDepth(1);
    drawNotePanel(this.messagePanel, MESSAGE_BOX.x, MESSAGE_BOX.y, MESSAGE_BOX.w, MESSAGE_BOX.h);
    this.dialog = new DialogBox(this, MESSAGE_BOX);
    this.dialog.panel.setAlpha(0);
    this.dialog.body.setColor('#4a3520'); // warm dark ink on cream paper, not COLORS.text's near-white
    this.interiorParts = [this.panel, this.titleGlow, this.title, this.cakeParts, this.frameParts, this.heartParts, this.messagePanel].flat();
  }

  // "A soft glow on the title" (owner brief) -- the first attempt (a second, offset copy of the title
  // text, low-alpha and slightly scaled up) was flagged in the quality-loop review as reading like a
  // rendering error ("a ghosted duplicate of the text"), not a glow. Replaced with a texture-free
  // radial halo: three low-alpha ellipses (same faked-gradient technique as
  // src/scenes/box-opening.js's own buildVignette()) sitting behind the title and pulsing gently --
  // no text involved at all, so there is nothing that could look like a duplicated line of letters.
  buildTitleGlow() {
    const g = this.add.graphics().setDepth(1);
    const rings = [
      { rx: 220, ry: 30, hex: 0xffe27a, alpha: 0.08 },
      { rx: 160, ry: 24, hex: 0xffe9a0, alpha: 0.14 },
      { rx: 100, ry: 18, hex: 0xfff3c4, alpha: 0.22 },
    ];
    for (const ring of rings) g.fillStyle(ring.hex, ring.alpha).fillEllipse(CARD_CENTER_X, TITLE_Y, ring.rx, ring.ry);
    this.titleGlow = g;
    // Pulsing the whole graphics object's own alpha dims/brightens all three rings together, still one
    // halo, never a second copy of anything.
    this.tweens.add({
      targets: this.titleGlow, alpha: { from: 0.5, to: 1 }, duration: 1500,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
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
    this.startKenBurns(this.photoA);
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
  // rather than assuming the placeholder's own native 200x140. `baseScale` is remembered so
  // startKenBurns() below has a stable 100% to breathe around, instead of re-deriving it from
  // whatever scale a mid-zoom tween happened to leave the image at.
  fitPhoto(image, windowSize) {
    const src = image.width || 1;
    const srcH = image.height || 1;
    const fit = Math.min((windowSize.w * FRAME_SCALE) / src, (windowSize.h * FRAME_SCALE) / srcH);
    image.baseScale = fit;
    image.setScale(fit);
  }

  // "Photos cross-fade with a slight Ken Burns zoom" (owner brief, this pass): a slow, continuous
  // breathing zoom on whichever photo is currently the front one -- a fixed, generous duration (not
  // tied to PHOTO_HOLD_MS) so it reads the same whether the slideshow has 5 slides or just one, and
  // yoyos forever rather than snapping back, so it never looks like it "resets". Killed and restarted
  // (not just left running) whenever a photo image is reused for a new slide, so the zoom always
  // starts fresh from 100% instead of picking up wherever the previous slide's zoom left off.
  startKenBurns(image) {
    this.tweens.killTweensOf(image);
    const base = image.baseScale || image.scaleX;
    image.setScale(base);
    this.tweens.add({
      targets: image, scaleX: base * 1.06, scaleY: base * 1.06,
      duration: 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  // One slide per configured photo, falling back to the placeholder art (still keeping the owner's
  // own caption, if they wrote one) for any entry whose file 404'd -- "missing photos tolerated"
  // (docs/ROADMAP.md M3's own testing brief), not a broken slideshow. With no configured photos at
  // all (the common case on a fresh checkout), src/card.js's own buildCardSlides() falls back to the
  // temporary slideshow (TEMP_CARD_SLIDES) instead of a single repeated placeholder -- see its own
  // comment for why "real photos always win" lives there, not here.
  buildSlides() {
    return buildCardSlides(this.config.photos, (i) => {
      const key = `card-photo-${i}`;
      const missing = this.missingPhotoKeys.has(key) || !this.textures.exists(key);
      return missing ? 'card-placeholder-photo' : key;
    });
  }

  nextSlide() {
    this.slideIndex = (this.slideIndex + 1) % this.slides.length;
    const slide = this.slides[this.slideIndex];
    const windowSize = { w: FRAME_WINDOW.x1 - FRAME_WINDOW.x0, h: FRAME_WINDOW.y1 - FRAME_WINDOW.y0 };
    this.photoB.setTexture(slide.key).setAlpha(0);
    this.fitPhoto(this.photoB, windowSize);
    this.startKenBurns(this.photoB);
    this.tweens.add({ targets: this.photoB, alpha: 1, duration: PHOTO_FADE_MS });
    this.tweens.add({
      targets: this.photoA, alpha: 0, duration: PHOTO_FADE_MS,
      onComplete: () => {
        // Swap so photoA is always the one currently visible, ready for the next cross-fade -- and
        // stop the now-hidden one's Ken Burns tween rather than leaving it breathing off-screen until
        // it's reused (startKenBurns() restarts it fresh then anyway).
        const tmp = this.photoA; this.photoA = this.photoB; this.photoB = tmp;
        this.tweens.killTweensOf(this.photoB);
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
    AudioManager.play('cardWhoosh'); // M5 sound: one soft cue as the card actually reveals, not per-piece
    this.spawnConfettiBurst();
    // Narration-style box (no speaker name), the same DialogBox class and typewriter feel every
    // other piece of story text in this game uses (src/scenes/cutscene.js reuses it the same way).
    this.dialog.open(null, this.config.messages, () => this.afterMessages());
  }

  // "Confetti bursts at the start then settles" (owner brief, this pass): a dense burst of pieces
  // right as the card reveals, tapering to a handful of trailing pieces and then stopping for good --
  // not the original always-on 220ms timer, which kept raining confetti for the entire message
  // sequence (however long the owner's own messages run) and only ever stopped once they finished.
  // Every piece is scheduled up front via addTimer()'d delayedCall()s, so skipToEnd() -> killTimers()
  // cancels whichever ones haven't fired yet, the same as every other timer this scene owns.
  spawnConfettiBurst() {
    const BURST_COUNT = 26;
    const BURST_SPACING_MS = 45;
    for (let i = 0; i < BURST_COUNT; i++) {
      this.addTimer(this.time.delayedCall(i * BURST_SPACING_MS, () => this.spawnConfettiPiece()));
    }
    const SETTLE_COUNT = 6;
    const SETTLE_SPACING_MS = 550;
    const settleStart = BURST_COUNT * BURST_SPACING_MS + 400; // a beat after the burst mostly lands
    for (let i = 0; i < SETTLE_COUNT; i++) {
      this.addTimer(this.time.delayedCall(settleStart + i * SETTLE_SPACING_MS, () => this.spawnConfettiPiece()));
    }
  }

  afterMessages() {
    this.playEndingVideoOrFinish();
  }

  // ---------- the closing video (optional) and the hand-off to the credits ----------

  // Checked with a plain fetch() first, not by queuing it straight into Phaser's loader and trusting
  // 'loaderror' -- Phaser's video loader can add a broken <video> to cache.video even after the
  // underlying request 404s (found via tools/qa-shots.js, see src/scenes/box-opening.js's own
  // identical comment), so a fetch that resolves `ok: false` (or rejects) is the only check this
  // scene trusts. That's also the default, expected case until the owner drops a clip in
  // (assets/card/ is gitignored and empty by default, docs/STORY.md) -- this must never hang or throw.
  // FB-0076: neither step can stall the ending. The probe is raced against a timeout (a request that never
  // answers counts as "no video"), and the video load itself has a deadline: a clip that has not started
  // loading into the game by then is given up on, and the card goes on to the credits.
  playEndingVideoOrFinish() {
    if (this.ended) return; // a skip (skipToEnd()) may have already ended things while this was pending
    const noAnswer = new Promise((resolve) => { setTimeout(() => resolve(null), CARD_VIDEO_PROBE_TIMEOUT_MS); });
    Promise.race([fetch(CARD_VIDEO_URL), noAnswer])
      .then((response) => {
        if (this.ended) return;
        if (!response || !response.ok) { this.showEnding(); return; }
        this.load.video('card-video', CARD_VIDEO_URL);
        this.load.once('complete', () => this.playEndingVideo());
        this.load.once('loaderror', () => this.showEnding());
        this.load.start();
        this.time.delayedCall(CARD_VIDEO_LOAD_TIMEOUT_MS, () => { if (!this.endingVideo && !this.ended) this.showEnding(); });
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

  // The card is over (last message, the optional closing video, or an Esc skip): fade out and hand
  // off to the credits phase (src/scenes/credits.js, decisions/0019), which plays the birthday wishes,
  // shows "THE END" and returns to the title screen, keeping the save (nothing here touches it -- see
  // src/save.js's own autosave, already triggered when the volunteer set the quest to 'rewarded').
  // The card.json that was just read is passed along so the credits needn't fetch it a second time.
  showEnding() {
    if (this.ended) return;
    this.ended = true;
    this.killTimers();
    if (this.endingVideo) { try { this.endingVideo.stop(); } catch (error) { /* already stopped */ } }
    const raw = this.cache.json.get('card-config') || null;
    // FB-0076: the hand-off to the credits never waits on a fade event alone -- a failsafe timer (the same
    // one the credits' own return to the title has) guarantees it, so the ending cannot stall on the card.
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      this.scene.start('credits', { raw });
    };
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', go);
    this.time.delayedCall(1200, go);
  }

  // Esc: skip the rest of the card, straight on to the credits -- from the cover, mid-message, or during the
  // optional closing video alike (docs/ROADMAP.md M3 "is skippable").
  skipToEnd() {
    if (this.ended) return;
    // Detach the dialog's own onClose first: closing it while it's still mid-message would otherwise
    // cascade into afterMessages() -> the optional closing video, which a skip should bypass, not
    // play out -- a skip goes straight on to the credits.
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
// NOT src/scenes/ui.js's makePanel() (dark navy, this game's usual UI chrome): a birthday card reads
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

// The message box's own panel (quality loop, "Card and ending" run 1: "the photo frame and message
// box read as two unrelated boxes") -- a plainer, smaller cousin of drawCardPanel() above, same
// cream/gold/bevel language (so the two clearly belong to the same object) but lighter-weight (a
// thinner border, a softer shadow, no header band) so it reads as a note tucked inside the card, not
// a second card competing with the outer one's own bold border.
function drawNotePanel(g, x, y, w, h) {
  g.fillStyle(0x000000, 0.18).fillRect(x + 3, y + 4, w, h);
  g.fillStyle(0xfdf6e3, 1).fillRect(x, y, w, h);
  g.lineStyle(3, 0xe8d9a8, 1).strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.lineStyle(1, 0xffffff, 0.6).lineBetween(x + 6, y + 6, x + w - 6, y + 6).lineBetween(x + 6, y + 6, x + 6, y + h - 6);
  g.lineStyle(1, 0x9c845c, 0.4).lineBetween(x + 6, y + h - 6, x + w - 6, y + h - 6).lineBetween(x + w - 6, y + 6, x + w - 6, y + h - 6);
  g.lineStyle(1, 0x1a1c2c, 0.6).strokeRect(x, y, w, h);
}
