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
  }

  buildHud() {
    const w = 220;
    const h = 34;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = 12;
    const panel = this.add.graphics().setDepth(90);
    drawPanel(panel, x, y, w, h);
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
  setScore(score) {
    this.score = score;
    this.refreshHud();
  }

  // `skipped`: true when this win came from the game-over card's "skip and take the key anyway"
  // gift (docs/STORY.md), not from actually reaching the score target. A real win is only ever
  // called by a subclass while 'playing'; a skip is chosen from the game-over card itself, i.e.
  // while 'gameover' -- both are accepted here, everything else (already mid-intro/win) is ignored.
  win(skipped = false) {
    if (this.mgState !== 'playing' && this.mgState !== 'gameover') return;
    this.mgState = 'win';
    this.setHudVisible(false);
    recordAttempt(GameState, this.gameId, skipped ? 'skipped' : 'won', this.score);
    this.card.showWin(this.def, skipped, () => this.finish('won'));
  }

  lose() {
    if (this.mgState !== 'playing') return;
    this.mgState = 'gameover';
    this.setHudVisible(false);
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
// Reuses this game's own drawPanel()/uiText()/COLORS (src/scenes/ui.js) so a mini-game's cards read
// as the same game's UI, not a different one bolted on. Sized from its own content every time
// (docs/GAME_FEEL.md rule 1: "a panel's box is sized from its content, never the other way around"),
// since an intro's instructions and a game-over's score/skip line are different lengths.
class MinigameCard {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.items = [];
    this.itemTexts = [];
    this.index = 0;
    this.handlers = [];
  }

  hide() {
    this.parts.forEach((part) => part.destroy());
    this.parts = [];
    this.itemTexts = [];
    this.handlers.forEach(({ event, fn }) => this.scene.input.keyboard.off(event, fn));
    this.handlers = [];
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
    const w = 560;
    const lineH = 22;
    const headerH = 56;
    const paraH = paragraphs.length * lineH + (paragraphs.length ? 14 : 0);
    const itemH = items.length * 30;
    const footerH = 30;
    const h = headerH + paraH + itemH + footerH;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0).setDepth(200);
    const panel = scene.add.graphics().setDepth(201);
    drawPanel(panel, x, y, w, h);
    const titleText = uiText(scene, x + w / 2, y + 30, title, 16, COLORS.highlight).setOrigin(0.5).setDepth(202);
    const paraTexts = paragraphs.map((line, i) =>
      uiText(scene, x + w / 2, y + headerH + i * lineH, line, 12, COLORS.text).setOrigin(0.5).setDepth(202));

    this.items = items;
    this.index = 0;
    const itemY0 = y + headerH + paraH;
    this.itemTexts = items.map((item, i) => {
      const text = uiText(scene, x + w / 2, itemY0 + i * 30, item.label, 12, COLORS.text).setOrigin(0.5).setDepth(202);
      text.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { this.index = i; this.refresh(); })
        .on('pointerdown', () => { this.index = i; this.confirm(); });
      return text;
    });
    const footer = uiText(scene, x + w / 2, y + h - footerH / 2, 'ENTER TO CHOOSE -- ESC TO QUIT', 8, COLORS.dim)
      .setOrigin(0.5).setDepth(202);

    this.parts = [dim, panel, titleText, ...paraTexts, ...this.itemTexts, footer];
    this.refresh();

    for (const key of ['UP', 'W']) this.on(`keydown-${key}`, (e) => { if (!e.repeat) this.move(-1); });
    for (const key of ['DOWN', 'S']) this.on(`keydown-${key}`, (e) => { if (!e.repeat) this.move(1); });
    for (const key of ['ENTER', 'SPACE']) this.on(`keydown-${key}`, (e) => { if (!e.repeat) this.confirm(); });
  }

  move(direction) {
    this.index = (this.index + direction + this.items.length) % this.items.length;
    this.refresh();
  }

  refresh() {
    this.itemTexts.forEach((text, i) => {
      const current = i === this.index;
      text.setColor(current ? COLORS.highlight : COLORS.text).setText(`${current ? '> ' : '  '}${this.items[i].label}`);
    });
  }

  confirm() {
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
      paragraphs: [skipped ? `Here's the ${def.name} key anyway -- nice try.` : `You beat the ${def.name} trial!`],
      items: [{ label: 'CONTINUE (ENTER)', onSelect: onContinue }],
    });
  }
}

// A tiny stand-in for the real player sprite (STYLE_GUIDE.md palette: pink outfit, fair skin --
// matching the lead's own colors) since a full walk-cycle sheet isn't worth building for a one-off
// mini-game avatar (docs/ROADMAP.md M4 "simple shapes with the game's palette... look deliberate").
// Returns a Container so a caller can position/destroy it as one unit; it has no physics body of its
// own (src/minigames/platformer.js attaches physics to a separate invisible body and follows it with
// one of these instead, since Arcade containers are more trouble than they're worth for a one-off).
function drawMiniHero(scene) {
  const body = scene.add.rectangle(0, 3, 12, 16, 0xff6fb1).setStrokeStyle(1, 0x1a1c2c);
  const head = scene.add.circle(0, -9, 6, 0xf4c9a0).setStrokeStyle(1, 0x1a1c2c);
  const hair = scene.add.arc(0, -12, 6, 200, 340, false, 0x2a1c14);
  return scene.add.container(0, 0, [body, hair, head]);
}
