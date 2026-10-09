// The birthday card (docs/STORY.md "the ending", docs/ROADMAP.md M3): a full-screen, animated pixel
// card -- confetti, a cake with candles, floating hearts, an OPTIONAL photo slideshow and the owner's own
// messages, typed out one at a time -- ending by handing off to the credits scene (src/scenes/credits.js:
// wishes, "THE END", back to the title screen). Started by
// src/scenes/finale.js (the cake and fireworks, W3, which box-opening.js starts once the box has finished
// opening; never returns to 'world': the game is over from here, docs/ROADMAP.md M3), and also reachable directly from the title screen's "Watch
// the Card Again" (src/scenes/title.js, once a save with `quest.stage === 'rewarded'` exists).
//
// Content lives in src/card.js (buildCardConfig()) and, for real use, in the owner's own
// assets/card/card.json + assets/card/photos/ + assets/card/video.mp4 -- all gitignored (see
// .gitignore), so a fresh checkout has none of it. Every beat below looks complete and warm even then:
// with no usable real photo there is NO frame, slideshow or placeholder picture -- the birthday cake is the
// card's centrepiece on a soft sunset glow (buildCakeGlow()/buildCake()) above the typed message, and
// DEFAULT_CARD_MESSAGES (src/card.js) are the card's words. With at least one real photo (card.json
// "photos", or the album's once every key is found) the frame + Ken Burns slideshow + caption appear
// instead, with a small cake in the corner.
//
// Photo-slideshow geometry duplicates two small constants tools/make-card-art.js documents in its
// own header comment (the frame's window rect, the cake's candle positions) rather than importing
// that Node build tool into the browser -- see FRAME_WINDOW/CAKE_CANDLE_LOCAL_* below.

const FRAME_WINDOW = { x0: 10, y0: 10, x1: 209, y1: 149 }; // inside card-frame.png, 200x140
const FRAME_SCALE = 1.5;
const CAKE_SCALE = 1.3; // the small corner motif next to a photo slideshow
const CAKE_BIG_SCALE = 5; // the centrepiece when there are no photos: an integer so the pixel art stays crisp (56x40 -> 280x200)
const CAKE_CANDLE_LOCAL_X = [18, 28, 38]; // local px inside card-cake.png's 56-wide canvas
const CAKE_CANDLE_LOCAL_TOP_Y = 4; // just above where the candle sticks start (local y 6)

// ---------- the card's own layout (coordinator review, 2026-09-22): ONE centered card, everything
// else lives inside it -- a photo frame in its upper area, the caption under the frame, the typed
// message under that, and decoration (hearts, a small cake motif) tucked into its own corners rather
// than floating loose in the empty space around a smaller panel (the first version's actual bug: a
// crowded left half, an empty right half, and the photo frame's own left edge crossing the panel's
// border). Every number below is this card's own interior geometry, in scene coordinates, so moving
// the card later (CARD_X/Y/W/H) only means changing those four numbers, not re-deriving the rest. ----------
// FB-0101: narrower (was 860 wide at x 50) so the party backdrop has a ~120 px margin on each side for the cast.
const CARD_X = 120;
const CARD_Y = 35;
const CARD_W = 720;
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
// With the narrower card the old bottom-right spot would sit on the message box, so the small cake moves up beside the photo frame
// (the frame spans x 330..630, y 95..335; the cake is 73 px wide).
const CAKE_SPOT = { x: CARD_RIGHT - 80, y: 235 };
// No photos: the cake is the centrepiece in the area the frame would use (y 100..350), spanning y 132..332 at CAKE_BIG_SCALE.
const CAKE_CENTER = { x: CARD_CENTER_X, y: 232 };

// ---------- FB-0101: the party behind the card, all code-drawn (or the game's existing character sheets). Every depth is below the card
// panel's (1); the confetti (90) and the cover (200) stay above. ----------
const BACKDROP_VEIL_DEPTH = 0.95; // a screen-sized dark layer over the backdrop until the cover opens, so none of it peeks out around the cover
const SKY_HEIGHT = 480; // the sky is drawn in bands down to the ground
const SKY_BAND_H = 8;
const SKY_STOPS = [[0, 0x6f63c4], [0.3, 0xb48ae0], [0.55, 0xff9fc0], [0.78, 0xffc79a], [1, 0xffe39a]]; // lavender -> pink -> peach -> warm gold at the horizon
const GROUND_TOP = 470;
const STAR_SPOTS = [[30, 60], [75, 112], [102, 48], [20, 190], [60, 245], [110, 172], [850, 60], [900, 105], [932, 50], [872, 190], [925, 245], [846, 150]];
const SPARKLE_SPOTS = [[60, 135], [900, 150], [38, 300], [922, 330], [86, 420], [880, 265]];
const BULB_COUNT = 12; // string lights along the top edge, one bulb per swag
const BULB_COLORS = [0xff6fb1, 0xffd23f, 0x7fd6c2, 0x8ec5ff, 0xc79bff, 0xff9f7a];
const BALLOON_COLORS = [0xff6fb1, 0xffd23f, 0x7fd6c2, 0x8ec5ff, 0xc79bff, 0xff9f7a];
const BALLOON_COUNT = 10;
const CANNON_COLORS = [0xff6fb1, 0xffd23f, 0x3b7dd8, 0xc79bff, 0x8fd46a, 0xff9f7a];
const CANNON_EVERY_MS = 3400;
const CANNON_PIECES = 10;
const CAST_SCALE = 3;
const CAST_SHEET_COLS = 8; // a character sheet's frame row length (tools/make-assets.js CHAR_COLS); rows: down, up, left, right
const CAST_FRIENDS = ['npc-friend-sid', 'npc-friend-akshit', 'npc-friend-satvik'];

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
    this.slidePhotos = []; // the card's photos, then (all keys found) the album's: src/album.js cardSlidePhotos()
    this.slides = []; // the usable ones, built in buildInterior(); [] (and no photoA/photoB/caption) when there is no real photo
    this.slideIndex = 0;
    this.hasPhotos = false;
    this.frameParts = [];
    this.cakeParts = [];
    this.backdropParts = []; // FB-0101: the sky, lights, ground, cast, balloons and sparkles behind the card
    this.veil = null;
    this.cannonTimer = null;
    this.cannonLeft = true;
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
    // This scene's own message box reuses DialogBox (src/scenes/ui.js), which needs the UI kit's
    // textures -- normally already loaded by boot/title by the time this scene is reached, but
    // guarded/idempotent like every other preload() here, so a direct reach-in can't be caught short.
    preloadUiKit(this);
    this.preloadCast();
    this.load.json('card-config', CARD_CONFIG_URL);
    // The closing video is NOT queued here -- see playEndingVideoOrFinish()'s own comment for why
    // (Phaser's video loader can't be trusted to report a 404 as a real error).
  }

  // FB-0101: the characters dancing behind the card. Mustafa and the friends are the game's own NPC sheets; Taru is the 'player' sheet when the
  // world has loaded it, else her chosen-clothes sheet loaded under its own key (the "Watch the Card Again" route skips the world). Every load
  // is guarded; a sheet that fails to load is simply left out of the cast (buildCast() checks textures.exists()).
  preloadCast() {
    const sheet = { frameWidth: TILE, frameHeight: CHAR_HEIGHT };
    const clothes = (typeof GameState !== 'undefined' && GameState.customization && GameState.customization.clothes) || 'pink';
    this.taruKey = this.textures.exists('player') ? 'player' : `card-taru-${clothes}`;
    const sheets = [['npc-mustafa', 'assets/npc-mustafa.png'], [this.taruKey, `assets/player-${clothes}.png`]];
    for (const key of CAST_FRIENDS) sheets.push([key, `assets/${key}.png`]);
    for (const [key, file] of sheets) {
      if (!this.textures.exists(key)) this.load.spritesheet(key, file, sheet);
    }
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

    // W2: once every key is found the memory album's photos (src/album.js) follow the card's own in the slideshow; with no album entries
    // (the common case) this is exactly config.photos.
    this.slidePhotos = cardSlidePhotos(this.config, GameState.quest.keys);
    if (this.slidePhotos.length === 0) {
      this.beginSequence();
      return;
    }
    this.slidePhotos.forEach((photo, i) => this.load.image(`card-photo-${i}`, `${CARD_PHOTOS_DIR}${photo.file}`));
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
    this.buildBackdrop(); // FB-0101: the party behind the card, under a dark veil until the cover has opened
    this.panel = this.add.graphics().setDepth(1);
    drawCardPanel(this.panel, CARD_X, CARD_Y, CARD_W, CARD_H);
    this.buildTitleGlow();
    // A deep pink, not the game's usual gold highlight -- gold reads poorly against this card's own
    // cream paper interior (too close in tone); the outline's own player-pink palette pops instead.
    this.title = uiText(this, CARD_CENTER_X, TITLE_Y, `HAPPY BIRTHDAY, ${this.config.recipient.toUpperCase()}!`, 16, '#d94b8f')
      .setOrigin(0.5).setDepth(2);

    // With at least one usable real photo: the picture frame + slideshow + caption, and the small cake motif in the corner. With none (the
    // fresh-checkout case, nothing is ever drawn as a stand-in photo): the cake is the card's centrepiece on a soft sunset glow instead.
    this.slides = this.buildSlides();
    this.hasPhotos = this.slides.length > 0;
    if (this.hasPhotos) {
      this.buildFrame();
      this.buildCake(CAKE_SPOT, CAKE_SCALE, { w: 4, h: 5 });
    } else {
      this.buildCakeGlow();
      this.buildCake(CAKE_CENTER, CAKE_BIG_SCALE, { w: 2 * CAKE_BIG_SCALE, h: 2.6 * CAKE_BIG_SCALE });
    }
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
    this.interiorParts = [this.backdropParts, this.panel, this.titleGlow, this.cakeGlow, this.title, this.cakeParts, this.frameParts, this.heartParts, this.messagePanel].flat().filter(Boolean);
  }

  // ---------- FB-0101: the party behind the card. Built up front (behind the cover) like the rest; everything is registered in
  // this.backdropParts (hidden with the rest during the optional closing video) and every tween/timer dies in killTimers(). ----------

  buildBackdrop() {
    const keep = (...objects) => { this.backdropParts.push(...objects); return objects[0]; };
    const tex = ensureBackdropTextures(this);
    this.balloonKeys = tex.balloons;

    // the dusk sky: stacked bands from lavender down to warm gold at the horizon
    const sky = this.add.graphics().setDepth(0.1);
    for (let y = 0; y < SKY_HEIGHT; y += SKY_BAND_H) sky.fillStyle(skyColorAt((y + SKY_BAND_H / 2) / SKY_HEIGHT), 1).fillRect(0, y, GAME_WIDTH, SKY_BAND_H);
    keep(sky);

    // twinkling stars (the little plus-shaped texture, tinted pale gold) in the upper sky of both margins
    STAR_SPOTS.forEach(([x, y], i) => {
      const star = this.add.image(x, y, tex.sparkle).setTint(0xfff3c4).setDepth(0.2).setAlpha(0.3);
      this.tweens.add({ targets: star, alpha: { from: 0.25, to: 1 }, duration: 600 + (i % 5) * 220, yoyo: true, repeat: -1, delay: i * 130, ease: 'Sine.easeInOut' });
      keep(star);
    });

    // slow pastel clouds drifting across
    [[130, 90, 0.5, 26], [520, 150, 0.4, 20], [820, 60, 0.45, 34]].forEach(([x, y, alpha, speed]) => {
      const cloud = this.add.graphics({ x, y }).setDepth(0.15);
      cloud.fillStyle(0xffffff, alpha).fillEllipse(0, 0, 86, 24).fillEllipse(-26, 6, 54, 20).fillEllipse(28, 5, 60, 20).fillEllipse(4, -9, 46, 22);
      this.driftCloud(cloud, speed);
      keep(cloud);
    });

    // hills and a grassy ground strip along the bottom
    const ground = this.add.graphics().setDepth(0.3);
    ground.fillStyle(0xa87fcf, 1);
    [[70, 420, 130], [330, 360, 100], [620, 480, 120], [880, 440, 140]].forEach(([x, w, h]) => ground.fillEllipse(x, GROUND_TOP + 8, w, h));
    ground.fillStyle(0xcf86b8, 1);
    [[190, 400, 80], [520, 460, 70], [790, 380, 84]].forEach(([x, w, h]) => ground.fillEllipse(x, GROUND_TOP + 14, w, h));
    ground.fillStyle(0x6fbf8a, 1).fillRect(0, GROUND_TOP, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP);
    ground.fillStyle(0x9be0a0, 1).fillRect(0, GROUND_TOP, GAME_WIDTH, 4);
    ground.fillStyle(0x4f9c78, 1).fillRect(0, GROUND_TOP + 46, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP - 46);
    for (let i = 0; i < 16; i++) { // little flowers dotted along the margins
      const fx = i < 8 ? 10 + i * 14 : GAME_WIDTH - 118 + (i - 8) * 14;
      ground.fillStyle(BULB_COLORS[i % BULB_COLORS.length], 1).fillRect(fx, GROUND_TOP + 22 + (i % 3) * 9, 4, 4);
    }
    keep(ground);

    // string lights along the top edge: a sagging wire and a softly pulsing coloured bulb under each swag
    const wire = this.add.graphics().setDepth(0.6);
    wire.lineStyle(2, 0x3b2a4a, 1);
    const swag = GAME_WIDTH / BULB_COUNT;
    for (let i = 0; i < BULB_COUNT; i++) {
      wire.beginPath().moveTo(i * swag, 6);
      for (let u = 0.1; u <= 1.001; u += 0.1) wire.lineTo(i * swag + u * swag, 6 + 12 * 4 * u * (1 - u));
      wire.strokePath();
    }
    keep(wire);
    for (let i = 0; i < BULB_COUNT; i++) {
      const color = BULB_COLORS[i % BULB_COLORS.length];
      const bx = i * swag + swag / 2;
      const halo = this.add.ellipse(bx, 24, 22, 22, color, 0.3).setDepth(0.6);
      const bulb = this.add.ellipse(bx, 23, 7, 10, color).setDepth(0.6);
      this.tweens.add({ targets: [bulb, halo], scale: { from: 0.8, to: 1.25 }, duration: 650 + (i % 4) * 160, yoyo: true, repeat: -1, delay: i * 90, ease: 'Sine.easeInOut' });
      keep(halo, bulb);
    }

    // the cast, standing on the ground in the side margins, facing the card
    this.buildCast(keep);

    // balloons drifting up (a small pool that is recycled, never grown)
    for (let i = 0; i < BALLOON_COUNT; i++) {
      const balloon = this.add.image(-100, GAME_HEIGHT + 80, tex.balloons[i % tex.balloons.length]).setScale(2).setDepth(0.55);
      this.launchBalloon(balloon, i * 650);
      keep(balloon);
    }

    // twinkling sparkles, bigger and slower than the stars
    SPARKLE_SPOTS.forEach(([x, y], i) => {
      const sparkle = this.add.image(x, y, tex.sparkle).setTint(i % 2 ? 0xffe27a : 0xffffff).setDepth(0.55).setScale(0.3).setAlpha(0.2);
      this.tweens.add({ targets: sparkle, scale: { from: 0.3, to: 2 }, alpha: { from: 0.2, to: 1 }, duration: 800 + i * 90, yoyo: true, repeat: -1, repeatDelay: 500 + i * 140, delay: i * 400, ease: 'Sine.easeInOut' });
      keep(sparkle);
    });

    // until the cover opens the whole backdrop sits under this dark veil (runInterior() fades it away)
    this.veil = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x1a1610).setOrigin(0, 0).setDepth(BACKDROP_VEIL_DEPTH);
  }

  // One cloud sliding right, then wrapping round to the far left for good.
  driftCloud(cloud, speed) {
    const target = GAME_WIDTH + 140;
    this.tweens.add({
      targets: cloud, x: target, duration: ((target - cloud.x) / speed) * 1000, ease: 'Linear',
      onComplete: () => { cloud.x = -140; this.driftCloud(cloud, speed); },
    });
  }

  // One balloon floating from below the screen to above it with a gentle sway, then re-launched from the bottom in a new colour and place.
  launchBalloon(balloon, delay) {
    const x = Phaser.Math.Between(0, 1) ? Phaser.Math.Between(16, 104) : Phaser.Math.Between(856, 944); // the side margins, behind the card's edges
    balloon.baseX = x;
    balloon.setTexture(Phaser.Utils.Array.GetRandom(this.balloonKeys)).setPosition(x, GAME_HEIGHT + 80);
    this.tweens.add({
      targets: balloon, y: -90, duration: Phaser.Math.Between(8000, 12000), delay, ease: 'Linear',
      onUpdate: (tween, target) => { target.x = target.baseX + Math.sin(tween.progress * Math.PI * 5) * 9; },
      onComplete: () => this.launchBalloon(balloon, Phaser.Math.Between(0, 1800)),
    });
  }

  // Mustafa and Taru on the left, three friends on the right (one in a slightly raised back row), each bobbing on the spot.
  buildCast(keep) {
    const FRONT_Y = 462; // sprite centre; the feet are CHAR_HEIGHT * CAST_SCALE / 2 below
    const BACK_Y = 448;
    const cast = [
      { key: 'npc-mustafa', x: 38, y: FRONT_Y, right: true, hop: 6 },
      { key: this.taruKey, x: 94, y: FRONT_Y, right: true, hop: 11 },
      { key: CAST_FRIENDS[0], x: 866, y: FRONT_Y, right: false, hop: 7 },
      { key: CAST_FRIENDS[2], x: 896, y: BACK_Y, right: false, hop: 8, back: true },
      { key: CAST_FRIENDS[1], x: 924, y: FRONT_Y, right: false, hop: 6 },
    ];
    cast.forEach((member, i) => {
      if (!member.key || !this.textures.exists(member.key)) return; // a sheet that did not load is skipped, never an error
      const texture = this.textures.get(member.key);
      const row = (member.right ? 3 : 2) * CAST_SHEET_COLS; // facing the card: right-facing row on the left, left-facing on the right
      const frames = [row, row + CAST_SHEET_COLS - 1].filter((f) => texture.has(f));
      if (!frames.length) return;
      const depth = member.back ? 0.45 : 0.5;
      const shadow = this.add.ellipse(member.x, member.y + 27, 42, 12, 0x000000, 0.3).setDepth(depth - 0.05);
      const sprite = this.add.sprite(member.x, member.y, member.key, frames[0]).setScale(CAST_SCALE).setDepth(depth);
      if (frames.length === 2) {
        const animKey = `card-cast-${member.key}-${member.right ? 'r' : 'l'}`;
        if (this.anims.exists(animKey)) this.anims.remove(animKey); // rebuilt each time: a re-loaded sheet must not leave a stale frame reference
        this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(member.key, { frames }), frameRate: 3, yoyo: true, repeat: -1 });
        sprite.play(animKey);
      }
      this.tweens.add({ targets: sprite, y: member.y - member.hop, duration: 300 + (i % 3) * 70, yoyo: true, repeat: -1, delay: i * 110, ease: 'Sine.easeOut' });
      keep(shadow, sprite);
    });
  }

  // Every few seconds a party popper goes off at one of the bottom corners, alternating sides: a flash and a small spray of confetti
  // that arcs up and falls back (a handful of rectangles, destroyed as they land). One looping timer, cancelled by killTimers().
  fireCannon() {
    if (this.ended) return;
    const dir = this.cannonLeft ? 1 : -1;
    this.cannonLeft = !this.cannonLeft;
    const x0 = dir === 1 ? 14 : GAME_WIDTH - 14;
    const y0 = GAME_HEIGHT - 70;
    const flash = this.add.ellipse(x0, y0, 30, 30, 0xfff3c4, 0.9).setDepth(90);
    this.tweens.add({ targets: flash, scale: 2.2, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    for (let i = 0; i < CANNON_PIECES; i++) {
      const peakX = x0 + dir * Phaser.Math.Between(40, 150);
      const piece = this.add.rectangle(x0, y0, 5, 9, Phaser.Utils.Array.GetRandom(CANNON_COLORS)).setDepth(90);
      this.tweens.add({
        targets: piece, x: peakX, y: y0 - Phaser.Math.Between(180, 340), angle: Phaser.Math.Between(180, 540),
        duration: Phaser.Math.Between(520, 760), ease: 'Quad.easeOut',
        onComplete: () => this.tweens.add({
          targets: piece, x: peakX + dir * Phaser.Math.Between(10, 50), y: GAME_HEIGHT + 10, angle: piece.angle + 360,
          duration: Phaser.Math.Between(1400, 2000), ease: 'Quad.easeIn', onComplete: () => piece.destroy(),
        }),
      });
    }
  }

  // The no-photo card's warm backdrop: a few low-alpha peach/gold ellipses behind the cake, like a low sun (the same faked-gradient technique
  // as buildTitleGlow(), no text and no texture), pulsing gently as one halo.
  buildCakeGlow() {
    const g = this.add.graphics().setDepth(1);
    const rings = [
      { w: 600, h: 270, hex: 0xff9f7a, alpha: 0.10 },
      { w: 470, h: 220, hex: 0xffb98a, alpha: 0.14 },
      { w: 350, h: 170, hex: 0xffd08a, alpha: 0.18 },
      { w: 250, h: 124, hex: 0xffe6a0, alpha: 0.24 },
    ];
    for (const ring of rings) g.fillStyle(ring.hex, ring.alpha).fillEllipse(CAKE_CENTER.x, CAKE_CENTER.y, ring.w, ring.h);
    this.cakeGlow = g;
    this.tweens.add({
      targets: g, alpha: { from: 0.6, to: 1 }, duration: 2200,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
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

  // The cake, with its three flickering flames. With real photos it is a small corner motif (coordinator review: was a large, lone
  // centerpiece with nothing balancing it on the card's other side) tucked into the card's bottom-right corner, clear of the message
  // box (MESSAGE_BOX's own right edge, 780) and the card's own border; with no photos it is the big centrepiece (CAKE_CENTER, an integer
  // scale so the pixel art stays crisp). `flameSize` is the flame ellipse's size in screen px.
  buildCake(spot, scale, flameSize) {
    const cake = this.add.image(spot.x, spot.y, 'card-cake').setScale(scale).setDepth(2);
    const flames = CAKE_CANDLE_LOCAL_X.map((localX) => {
      const p = imageLocalPoint(cake, localX, CAKE_CANDLE_LOCAL_TOP_Y);
      const flame = this.add.ellipse(p.x, p.y, flameSize.w, flameSize.h, 0xffd23f).setDepth(3);
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

    this.slideIndex = 0; // this.slides was built by buildInterior(): buildFrame() only runs when there is at least one usable real photo
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
  // rather than assuming any particular native size (200x140 or otherwise). `baseScale` is remembered so
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

  // One slide per usable real photo (a card.json photo or, once every key is found, an album photo). A photo whose file failed to load is
  // simply left out -- "missing photos tolerated" (docs/ROADMAP.md M3's own testing brief) -- and never replaced by a placeholder slide.
  // With no usable photo at all (the common case on a fresh checkout) this is [] and the interior shows the cake instead of a frame.
  buildSlides() {
    const isMissing = (i) => this.missingPhotoKeys.has(`card-photo-${i}`) || !this.textures.exists(`card-photo-${i}`);
    const usable = this.slidePhotos.map((photo, i) => ({ photo, i })).filter(({ i }) => !isMissing(i));
    return buildCardSlides(usable.map((u) => u.photo), (n) => `card-photo-${usable[n].i}`);
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

  // Three of the card's four corners (with real photos the fourth holds the cake motif, CAKE_SPOT; with none the cake is the centrepiece and
  // the fourth corner gets a heart too) -- accents, not the empty-space filler the first version's scattered five ended up as.
  buildHearts() {
    const spots = this.hasPhotos ? HEART_SPOTS : [...HEART_SPOTS, [CARD_RIGHT - 40, CARD_BOTTOM - 40]];
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
    if (this.veil) { // FB-0101: the party behind the card fades in
      const veil = this.veil;
      this.veil = null;
      this.tweens.add({ targets: veil, alpha: 0, duration: 600, onComplete: () => veil.destroy() });
    }
    this.cannonTimer = this.time.addEvent({ delay: CANNON_EVERY_MS, loop: true, startAt: CANNON_EVERY_MS - 600, callback: () => this.fireCannon() });
    this.addTimer(this.cannonTimer);
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
      if (this.cannonTimer) this.cannonTimer.remove(); // the party stops with the card while the closing video plays
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

// FB-0101: the dusk sky's colour at `t` (0 top .. 1 horizon), blended channel by channel between SKY_STOPS.
function skyColorAt(t) {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [t1, c1] = SKY_STOPS[i];
    if (clamped > t1) continue;
    const [t0, c0] = SKY_STOPS[i - 1];
    const f = (clamped - t0) / (t1 - t0);
    const mix = (shift) => Math.round(((c0 >> shift) & 0xff) * (1 - f) + ((c1 >> shift) & 0xff) * f);
    return (mix(16) << 16) | (mix(8) << 8) | mix(0);
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

// FB-0101: the backdrop's two tiny textures, drawn once with Graphics.generateTexture() (no PNG files): a plus-shaped sparkle (the stars and
// sparkles, tinted per use) and one balloon per colour (body, shine, knot, string). Idempotent: a later visit to the scene reuses them.
function ensureBackdropTextures(scene) {
  const sparkle = 'card-sparkle';
  const balloons = BALLOON_COLORS.map((color) => `card-balloon-${color.toString(16)}`);
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  if (!scene.textures.exists(sparkle)) {
    g.clear().fillStyle(0xffffff, 1).fillRect(3, 0, 1, 7).fillRect(0, 3, 7, 1).fillRect(2, 2, 3, 3);
    g.generateTexture(sparkle, 7, 7);
  }
  balloons.forEach((key, i) => {
    if (scene.textures.exists(key)) return;
    g.clear().fillStyle(BALLOON_COLORS[i], 1).fillEllipse(8, 10, 14, 18);
    g.fillStyle(0xffffff, 0.55).fillRect(4, 5, 2, 4);
    g.fillStyle(BALLOON_COLORS[i], 1).fillTriangle(8, 18, 5, 22, 11, 22);
    g.lineStyle(1, 0xffffff, 0.7).lineBetween(8, 22, 7, 28).lineBetween(7, 28, 9, 34).lineBetween(9, 34, 8, 40);
    g.generateTexture(key, 16, 40);
  });
  g.destroy();
  return { sparkle, balloons };
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
