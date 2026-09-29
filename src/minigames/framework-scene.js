// The shared shell every mini-game scene is built on (docs/ROADMAP.md M4): an intro card (name, how
// to play, the score target), a HUD while playing, a game-over card (score, Retry/Quit, and "skip
// and take the key anyway" once 3 attempts have failed) and a win card that hands the key over -- the
// same four states for all three games, so src/minigames/platformer.js / flappy.js / tetris.js only
// implement the actual gameplay (buildScene()/startAttempt()/playUpdate(), see the bottom of this
// file) and never redraw a card or re-invent the pause/attempt/skip bookkeeping
// (src/minigames/framework-data.js).
//
// Launched by WorldScene.launchMinigame() (src/scenes/world.js) exactly like src/scenes/cutscene.js
// launches a cutscene: 'world' is paused first, and this scene resumes it and calls back with an
// outcome once it's done. The outcome the *story* ever sees (src/dialog.js's `minigame` action) is
// only 'won' (a real win, or the 3-fail skip -- both a gift, docs/STORY.md "nobody may be locked
// out") or 'quit' (Esc, or "Quit" from a card, before winning). 'lost' never leaves this shell: it's
// this scene's own internal retry state, since retrying is unlimited (docs/STORY.md "retry as often
// as you like") until one of those two terminal outcomes.

const MG_FADE_MS = 250;

class MinigameBaseScene extends Phaser.Scene {
  init(data) {
    this.gameId = data.id;
    this.def = MINIGAMES[this.gameId];
    this.onComplete = data.onComplete || (() => {});
    this.returnTo = data.returnTo || 'world';
    this.mgState = 'intro'; // 'intro' | 'playing' | 'gameover' | 'win'
    this.score = 0;
    this.finished = false;
    this.builtScene = false;
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a');
    this.mgKeys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER');
    this.input.keyboard.addCapture('SPACE');
    // Esc always quits back to the game (this task's own brief) -- from the intro, mid-play, or a
    // game-over card alike; from the win card it just finishes with the win already earned (ERR-0001:
    // a one-shot action is a keydown event, never JustDown-polled).
    this.input.keyboard.on('keydown-ESC', (event) => { if (!event.repeat) this.onEsc(); });

    this.hud = this.buildHud();
    this.card = new MinigameCard(this);
    this.showIntro();
    // M5 sound: a tense-but-light bed while she's playing, crossfaded in like every other scene
    // change -- finish() below crossfades back to whichever world music was playing before this.
    AudioManager.playMusic('minigameMusic');
  }

  buildHud() {
    const w = 220;
    const h = 34;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = 12;
    const panel = makePanel(this, x, y, w, h).setDepth(90);
    const text = uiText(this, GAME_WIDTH / 2, y + h / 2, '', 12, COLORS.highlight).setOrigin(0.5).setDepth(91);
    const parts = [panel, text];
    parts.forEach((part) => part.setVisible(false));
    return { parts, text };
  }

  setHudVisible(visible) {
    this.hud.parts.forEach((part) => part.setVisible(visible));
  }

  refreshHud() {
    const label = this.def.scoreLabel || 'SCORE';
    this.hud.text.setText(`${label}: ${this.score} / ${this.def.scoreTarget}`);
  }

  // FB-0042: a short, self-fading message shown inside the mini-game itself (e.g. the platformer's
  // "collect all the charge cells first!" when she reaches the door too early) -- the game's own
  // global 'toast' event goes to UIScene's Toast, which would be hidden behind this scene's own
  // opaque backdrop while a mini-game is on top (world.js launchMinigame() only pauses 'world', not
  // 'ui', but every mini-game scene renders above both), so a mini-game that needs a quick message
  // shows it here instead, built once and reused, same makePanel()/uiText() look as everywhere else.
  showMessage(text) {
    if (!this.message) {
      const w = 380;
      const h = 34;
      const x = Math.round((GAME_WIDTH - w) / 2);
      const y = GAME_HEIGHT - 74;
      const panel = makePanel(this, x, y, w, h).setDepth(95).setAlpha(0);
      const label = uiText(this, GAME_WIDTH / 2, y + h / 2, '', 10, COLORS.text).setOrigin(0.5).setDepth(96).setAlpha(0);
      this.message = { panel, label };
    }
    const m = this.message;
    m.label.setText(text);
    this.tweens.killTweensOf([m.panel, m.label]);
    m.panel.setAlpha(1);
    m.label.setAlpha(1);
    this.tweens.add({ targets: [m.panel, m.label], alpha: 0, delay: 1400, duration: 400 });
  }

  // ---------- intro ----------
  showIntro() {
    this.mgState = 'intro';
    this.setHudVisible(false);
    this.card.showIntro(this.def, () => this.beginAttempt());
  }

  // Runs once ever (the first time the intro is dismissed) to build the persistent game objects,
  // then every time on top of that (including every retry) to reset them to a fresh start.
  beginAttempt() {
    this.card.hide();
    if (!this.builtScene) {
      this.buildScene();
      this.builtScene = true;
    }
    this.score = 0;
    this.mgState = 'playing';
    this.setHudVisible(true);
    this.refreshHud();
    this.startAttempt();
  }

  // ---------- called by a subclass while playing ----------
  // Coordinator brief (2026-09-22, "juice"): a small score pop every time it goes up -- a quick
  // scale pulse on the shared HUD text, so collecting a coin/clearing a gap/clearing a line all get
  // the same little celebration for free, without any of the 3 games drawing their own "+1" popup.
  setScore(score) {
    const increased = score > this.score;
    this.score = score;
    this.refreshHud();
    if (increased) {
      this.tweens.killTweensOf(this.hud.text);
      this.hud.text.setScale(1);
      this.tweens.add({ targets: this.hud.text, scale: 1.4, duration: 100, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  // `skipped`: true when this win came from the game-over card's "skip and take the key anyway"
  // gift (docs/STORY.md), not from actually reaching the score target. A real win is only ever
  // called by a subclass while 'playing'; a skip is chosen from the game-over card itself, i.e.
  // while 'gameover' -- both are accepted here, everything else (already mid-intro/win) is ignored.
  win(skipped = false) {
    if (this.mgState !== 'playing' && this.mgState !== 'gameover') return;
    this.mgState = 'win';
    this.setHudVisible(false);
    AudioManager.play('minigameWin');
    this.flashScreen(); // juice: a brief, subtle win flash, right before the win card eases in
    recordAttempt(GameState, this.gameId, skipped ? 'skipped' : 'won', this.score);
    this.card.showWin(this.def, skipped, () => this.finish('won'));
  }

  // A quick, subtle full-canvas white flash (coordinator brief "juice": "a win flash; keep it
  // subtle") -- one plain rect, alpha down to 0 over 220ms, well under GAME_FEEL.md's "nothing flashes
  // faster than 3 times a second" (this is a single one-shot pulse, not a repeating flash at all).
  flashScreen() {
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.45).setOrigin(0, 0).setDepth(300);
    this.tweens.add({ targets: flash, alpha: 0, duration: 220, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
  }

  lose() {
    if (this.mgState !== 'playing') return;
    this.mgState = 'gameover';
    this.setHudVisible(false);
    AudioManager.play('minigameLose');
    // A small screen shake (coordinator brief: "small") -- felt, not jarring; the card fades in right
    // on top of it a moment later.
    this.cameras.main.shake(160, 0.006);
    const { canSkip } = recordAttempt(GameState, this.gameId, 'lost', this.score);
    this.card.showGameOver(this.def, this.score, canSkip, {
      onRetry: () => this.beginAttempt(),
      onSkip: () => this.win(true),
      onQuit: () => this.finish('quit'),
    });
  }

  onEsc() {
    // The win card already recorded the win (win() above ran the moment she actually won or chose
    // to skip) -- Esc from there is just a faster "Continue", not a way to back out of a win.
    this.finish(this.mgState === 'win' ? 'won' : 'quit');
  }

  finish(outcome) {
    if (this.finished) return;
    this.finished = true;
    this.card.hide();
    this.cameras.main.fadeOut(MG_FADE_MS, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const world = this.scene.get(this.returnTo);
      this.scene.stop();
      this.scene.resume(this.returnTo);
      if (world.cameras && world.cameras.main) world.cameras.main.fadeIn(MG_FADE_MS, 0, 0, 0);
      // M5 sound: crossfade back to whichever world music fits where she actually is (world.js's own
      // create() won't re-run here -- scene.resume(), not restart() -- so this scene has to put the
      // right bed back itself).
      AudioManager.playMusic(world && world.def && world.def.indoors ? 'indoorMusic' : 'overworldMusic');
      this.onComplete(outcome);
    });
  }

  update(time, delta) {
    if (this.mgState === 'playing') this.playUpdate(time, delta);
  }

  // ---------- subclass contract (src/minigames/platformer.js, flappy.js, tetris.js) ----------
  // buildScene(): build the persistent game objects, once, the first time the intro is dismissed.
  // startAttempt(): (re)set the game to its starting position -- called at the start of every
  //   attempt, including every retry, so it must fully reset anything buildScene() doesn't recreate.
  // playUpdate(time, delta): per-frame gameplay; only ever called while mgState === 'playing'.
  buildScene() {}
  startAttempt() {}
  playUpdate() {}
}

// ---------- the shared card: intro / game-over / win, all one small keyboard-driven menu ----------
// Reuses this game's own makePanel()/uiText()/COLORS (src/scenes/ui.js) so a mini-game's cards read
// as the same game's UI, not a different one bolted on. Sized from its own content every time
// (docs/GAME_FEEL.md rule 1: "a panel's box is sized from its content, never the other way around"),
// since an intro's instructions and a game-over's score/skip line are different lengths.
// FB-0042: a card ignores ENTER/SPACE for this long after it appears -- mashing Space to play (it's
// also the jump/flap key) or Enter to clear a line of dialog beforehand used to carry straight through
// into an instant Retry/Continue on whatever card popped up next, including the "SKIP" offer sharing
// the same list. Comfortably above human reaction time to an unexpected screen change, comfortably
// below "feels laggy" for a deliberate keypress once the card's actually up.
const CARD_INPUT_DELAY_MS = 350;

class MinigameCard {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.items = [];
    this.itemTexts = [];
    this.itemCursors = [];
    this.index = 0;
    this.handlers = [];
    this.acceptInput = false;
  }

  hide() {
    this.parts.forEach((part) => part.destroy());
    this.parts = [];
    this.itemTexts = [];
    this.itemCursors = [];
    this.handlers.forEach(({ event, fn }) => this.scene.input.keyboard.off(event, fn));
    this.handlers = [];
    this.acceptInput = false;
  }

  on(event, fn) {
    this.scene.input.keyboard.on(event, fn);
    this.handlers.push({ event, fn });
  }

  // paragraphs: centered body lines. items: [{ label, onSelect }], navigable with UP/DOWN or W/S and
  // confirmed with ENTER/SPACE -- item 0 starts highlighted, so the card's own default action
  // (Start/Retry/Continue) is always exactly one keypress away, never a menu to first navigate into
  // (docs/ROADMAP.md M4 "retrying must be one keypress").
  show({ title, paragraphs = [], items }) {
    this.hide();
    const scene = this.scene;
    const w = 640;
    const lineH = 22;
    const headerH = 56;
    const wrapWidth = w - 100;

    // Wrap each paragraph to the panel's own width *before* measuring the panel's height (the same
    // "measure once, redraw on state change" order docs/GAME_FEEL.md rule 1 requires: "a panel's box
    // is sized from its content, never the other way around") -- a mini-game's own instructions can
    // run longer than this card's fixed width, and without this a long line just draws straight past
    // the panel's own edges instead of wrapping (a real bug this fix replaces, not a hypothetical
    // one). A throwaway text object gives the exact same wrap Phaser will use for the real one, the
    // same trick src/scenes/ui.js's DialogBox already uses for its own wrapped typewriter text.
    const measurer = uiText(scene, 0, 0, '', 12).setWordWrapWidth(wrapWidth).setVisible(false);
    const lines = [];
    for (const para of paragraphs) {
      if (para === '') { lines.push(''); continue; }
      lines.push(...measurer.getWrappedText(para));
    }
    measurer.destroy();

    const paraH = lines.length * lineH + (lines.length ? 14 : 0);
    const itemH = items.length * 30;
    const footerH = 30;
    const h = headerH + paraH + itemH + footerH;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);
    this.box = { x, y, w, h };

    // fillAlpha stays 1 here on purpose: the fade-in below tweens the *GameObject's* alpha (0 -> 0.6)
    // instead, since Rectangle's constructor alpha argument sets fillAlpha, not the object's own
    // alpha -- tweening `alpha` on top of a 0.6 fillAlpha would have multiplied down to 0.36.
    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1).setOrigin(0, 0).setDepth(200);
    const panel = makePanel(scene, x, y, w, h).setDepth(201);
    const titleText = uiText(scene, x + w / 2, y + 30, title, 16, COLORS.highlight).setOrigin(0.5).setDepth(202);
    const paraTexts = lines.map((line, i) =>
      uiText(scene, x + w / 2, y + headerH + i * lineH, line, 12, COLORS.text).setOrigin(0.5).setDepth(202));

    this.items = items;
    this.index = 0;
    const itemY0 = y + headerH + paraH;
    // A cursor sprite to the left of the highlighted option, centered text otherwise unchanged (this
    // card's own rows are centered, not left-aligned like every other list, so the cursor sits just
    // outside the text's own measured width rather than at a fixed column).
    this.itemCursors = items.map((item, i) => makeCursor(scene, 0, itemY0 + i * 30).setDepth(202).setVisible(false));
    this.itemTexts = items.map((item, i) => {
      const text = uiText(scene, x + w / 2, itemY0 + i * 30, item.label, 12, COLORS.text).setOrigin(0.5).setDepth(202);
      text.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { this.index = i; this.refresh(); })
        .on('pointerdown', () => { this.index = i; this.confirm(); });
      return text;
    });
    const footer = uiText(scene, x + w / 2, y + h - footerH / 2, 'ENTER TO CHOOSE -- ESC TO QUIT', 8, COLORS.dim)
      .setOrigin(0.5).setDepth(202);

    this.parts = [dim, panel, titleText, ...paraTexts, ...this.itemCursors, ...this.itemTexts, footer];
    this.refresh();

    // Eased card transition (docs/GAME_FEEL.md "nothing is a flat instant cut"): everything fades in
    // together and the content eases up 10px into its resting position -- the dim backdrop fades to
    // its own, lower, target alpha separately so it doesn't flash to full strength instantly either.
    const content = [panel, titleText, ...paraTexts, ...this.itemCursors, ...this.itemTexts, footer];
    dim.setAlpha(0);
    content.forEach((part) => { part.setAlpha(0); part.y += 10; });
    scene.tweens.add({ targets: dim, alpha: 0.6, duration: 160 });
    scene.tweens.add({ targets: content, alpha: 1, y: '-=10', duration: 200, ease: 'Cubic.easeOut' });

    for (const key of ['UP', 'W']) this.on(`keydown-${key}`, (e) => { if (!e.repeat) this.move(-1); });
    for (const key of ['DOWN', 'S']) this.on(`keydown-${key}`, (e) => { if (!e.repeat) this.move(1); });
    for (const key of ['ENTER', 'SPACE']) this.on(`keydown-${key}`, (e) => { if (!e.repeat) this.confirm(); });

    // FB-0042: confirm keys are ignored for a short beat after the card appears (see
    // CARD_INPUT_DELAY_MS above) -- mashing Space (also the jump/flap key) or Enter (also how you
    // clear a line of dialog) could otherwise carry straight through into an instant Retry/Continue
    // the instant a new card popped up, skipping past it (and past the "skip" offer) unread.
    this.acceptInput = false;
    scene.time.delayedCall(CARD_INPUT_DELAY_MS, () => { this.acceptInput = true; });
  }

  move(direction) {
    if (!this.acceptInput) return;
    this.index = (this.index + direction + this.items.length) % this.items.length;
    this.refresh();
  }

  refresh() {
    this.itemTexts.forEach((text, i) => {
      const current = i === this.index;
      text.setColor(current ? COLORS.highlight : COLORS.text).setText(this.items[i].label);
      // Centered text, so the cursor sits just to the left of this row's own measured width rather
      // than a fixed column (every other list in the game is left-aligned, where a fixed column works).
      this.itemCursors[i].setPosition(text.x - text.width / 2 - 18, text.y).setVisible(current);
    });
  }

  confirm() {
    if (!this.acceptInput) return;
    const item = this.items[this.index];
    if (item && item.onSelect) item.onSelect();
  }

  showIntro(def, onStart) {
    this.show({
      title: def.name.toUpperCase(),
      paragraphs: [...def.instructions, '', `TARGET: ${def.scoreTarget} ${def.scoreLabel || ''}`.trim()],
      items: [{ label: 'START (ENTER)', onSelect: onStart }],
    });
  }

  showGameOver(def, score, canSkip, { onRetry, onSkip, onQuit }) {
    const items = [{ label: 'RETRY (ENTER)', onSelect: onRetry }];
    if (canSkip) items.push({ label: 'SKIP -- TAKE THE KEY ANYWAY', onSelect: onSkip });
    items.push({ label: 'QUIT', onSelect: onQuit });
    this.show({
      title: 'TRY AGAIN?',
      paragraphs: [
        `SCORE: ${score} / ${def.scoreTarget}`,
        canSkip ? "You've tried 3 times -- take the key anyway if you'd rather move on." : '',
      ].filter(Boolean),
      items,
    });
  }

  showWin(def, skipped, onContinue) {
    this.show({
      title: skipped ? 'KEY GIFTED!' : 'YOU GOT IT!',
      // Two blank lines reserve a clear gap under the title for the key icon flourish this.show()
      // leaves room for (added after show() below, once the panel's real box (x/y/w) is known) --
      // tall enough (2 * lineH = 44px) that the bounced-in icon (48px, a 16px frame at 3x scale)
      // never overlaps the message line under it.
      // `def.name` already reads as a challenge ("Physics Lab Trial", "ICVL Server Dash", "Room 195
      // Stack-Off") -- no trailing "trial!" appended, or the Physics Lab's own name would double up
      // ("You beat the Physics Lab Trial trial!").
      paragraphs: ['', '', skipped ? `Here's the ${def.name} key anyway -- nice try.` : `You beat the ${def.name}!`],
      items: [{ label: 'CONTINUE (ENTER)', onSelect: onContinue }],
    });
    this.addWinKeyIcon(def);
  }

  // The win flourish (coordinator brief, "a win flourish with the key icon"): the real key art
  // already in the pack (ITEMS[def.item], src/items.js -- Kyrise icons, the same ones a key station's
  // own floating pickup and the hotbar use), bounced in with a little overshoot so it reads as a
  // reward, not just another line of text.
  addWinKeyIcon(def) {
    if (!def.item || !ITEMS[def.item]) return;
    const scene = this.scene;
    const cx = GAME_WIDTH / 2;
    const cy = this.box.y + 78; // centered in the two-blank-line gap show() reserved, above the message
    const shadow = scene.add.ellipse(cx, cy + 14, 26, 8, 0x000000, 0.3).setDepth(202).setAlpha(0);
    const icon = scene.add.image(cx, cy, 'items', ITEMS[def.item].frame).setScale(3).setDepth(203).setAlpha(0);
    this.parts.push(shadow, icon);
    scene.tweens.add({ targets: shadow, alpha: 1, duration: 200, delay: 120 });
    scene.tweens.add({
      targets: icon, alpha: 1, scale: { from: 0.4, to: 3 }, y: { from: cy - 18, to: cy },
      duration: 380, delay: 120, ease: 'Back.easeOut',
    });
  }
}

// The hero in the platformer/flyer is the lead herself (coordinator brief, 2026-09-22: "the hero is
// the lead, not a pink rectangle"), not a stand-in shape -- both src/minigames/platformer.js and
// flappy.js draw a real `this.add.sprite(x, y, 'player', frame)` using the exact same 'player'
// texture src/scenes/world.js does. That texture is already the *right* one for whichever clothes
// colour she picked on the customisation screen (src/main.js BootScene loads it as
// `assets/player-${GameState.customization.clothes}.png`, always under the texture key 'player') --
// nothing here needs to know the colour at all, it just uses the texture the game already loaded.
//
// The walk/idle animations are global to the whole Phaser game (`scene.anims` is a reference to one
// shared AnimationManager, not a per-scene one), so WorldScene has always already created 'walk-left'/
// 'walk-right'/'idle-left'/'idle-right' by the time a mini-game can possibly launch (it's only
// reachable from inside a real game session) -- this guard (`anims.exists`) is just defensive, the
// same pattern world.js's own createAnimations() already uses for itself. FB-0043: real left/right
// rows now, no more a single shared "side" row played with flipX -- see world.js's own comment on why
// (ERR-0007, "she moonwalks both ways").
const HERO_WALK_FRAMES = { left: [17, 18, 19, 20, 21, 22], right: [25, 26, 27, 28, 29, 30] };
const HERO_IDLE_FRAMES = { left: [16, 23], right: [24, 31] };
// A sensible still frame per direction for a subclass that wants to place its hero sprite before its
// first anims.play() call (platformer.js/flappy.js).
const HERO_IDLE_FRAME = { left: 16, right: 24 };

// A small landing puff (coordinator brief, "juice": "a small landing puff in the platformer") --
// three little dust motes that pop out sideways and fade, cheap enough to spawn on every landing
// without a texture/particle-emitter setup (STYLE_GUIDE.md palette: a dusty, dry tone, not grey).
function spawnDustPuff(scene, x, y) {
  for (const dx of [-5, 0, 5]) {
    const mote = scene.add.circle(x, y, 2.5, 0xe0c290, 0.8).setDepth(50);
    scene.tweens.add({
      targets: mote, x: x + dx * 2.2, y: y - 3, alpha: 0, scale: 0.4,
      duration: 260, ease: 'Cubic.easeOut', onComplete: () => mote.destroy(),
    });
  }
}

// Quality loop fix (Mini-games, rated 4/10 -- "the hero is a speck"): platformer.js and flappy.js
// draw the hero/bird at HERO_SCALE (3x, matching the main game's own `ZOOM`, src/state.js) via a
// plain `sprite.setScale(HERO_SCALE)` -- camera zoom turned out to be unreliable for this scene setup
// (traced through many qa:shots screenshots: the camera's own zoom/scroll properties always read back
// correct, but world content kept rendering at 1x regardless -- a real, unresolved oddity in this
// environment, not worth blocking the fix on), so the fix is a plain sprite scale instead: proven,
// simple, and exactly how the win card's own key icon (addWinKeyIcon() above) already gets its size.
const HERO_SCALE = 3;

// Juice (coordinator brief: "a squash and stretch on jump and land... keep it subtle") -- a quick,
// shared tween shape for the hero's own sprite so platformer.js's jump/land and flappy.js's flap can
// all reuse it instead of hand-rolling their own. `mode: 'stretch'` (a takeoff -- taller, thinner,
// leaving the ground) or `'squash'` (an impact -- shorter, wider, landing/settling); both spring back
// to `baseScale` (not bare 1 -- the hero draws at HERO_SCALE, so resetting to 1 would suddenly shrink
// her back to a speck for the rest of the tween's hold) over a beat via Back.easeOut so it reads as a
// little bounce, not a snap.
function squashStretch(scene, sprite, mode = 'stretch', baseScale = HERO_SCALE) {
  scene.tweens.killTweensOf(sprite);
  const [fx, fy] = mode === 'squash' ? [1.22, 0.82] : [0.85, 1.18];
  sprite.setScale(baseScale * fx, baseScale * fy);
  scene.tweens.add({ targets: sprite, scaleX: baseScale, scaleY: baseScale, duration: 150, ease: 'Back.easeOut' });
}

function ensurePlayerAnims(scene) {
  for (const dir of ['left', 'right']) {
    if (!scene.anims.exists(`walk-${dir}`)) {
      scene.anims.create({
        key: `walk-${dir}`,
        frames: scene.anims.generateFrameNumbers('player', { frames: HERO_WALK_FRAMES[dir] }),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!scene.anims.exists(`idle-${dir}`)) {
      scene.anims.create({
        key: `idle-${dir}`,
        frames: scene.anims.generateFrameNumbers('player', { frames: HERO_IDLE_FRAMES[dir] }),
        frameRate: 2,
        yoyo: true,
        repeat: -1,
      });
    }
  }
}
