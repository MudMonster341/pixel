// The title screen (FB-0023/0024, M3a, docs/GAME_FEEL.md): the game's name over a slowly panning,
// parallaxed campus illustration, and a menu of big drawn buttons (Play / Continue / Controls /
// Credits) -- the same shape as a Gen 3-5 Pokemon title screen without copying any of its art or
// text. `?title=0` skips straight past this scene (and the loading screen after it) to the old
// instant-boot behaviour -- tests/e2e/helpers.js openGame() sets that by default so the other ~65
// specs don't need to know this scene exists at all.
//
// Two stages, never both on screen together (owner feedback, 2026-09-20/21): 'intro' is just the
// logo and a blinking "PRESS ENTER"; pressing it reveals 'menu', which replaces the prompt with the
// actual menu instead of repeating the same instruction next to it.
//
// M3a redesign (owner brief, 2026-09-21 -- "it looks really bad right now... big buttons... a little
// 3D"): the old plain text rows are now Button widgets (src/scenes/ui.js) -- bevelled, shaded, with
// their own drop shadow and a pressed/hover state -- and the backdrop gained a second, faster-moving
// silhouette layer (title-fg.png) under the slow vertical pan of the gate illustration, real
// multi-layer parallax rather than one image panning on its own.

const TITLE_MENU_BASE = [
  { id: 'play', label: 'Play' },
  { id: 'controls', label: 'Controls' },
  { id: 'credits', label: 'Credits' },
];
const BUTTON_W = 320;
const BUTTON_H = 52;
const BUTTON_GAP = 12;
// The menu's buttons are bottom-anchored to this y (not centered on a fixed point): with "Continue"
// present that's 4 buttons, and centering on a fixed spot the way the old text-row menu did would
// have crept down into the parallax foreground strip (buildBackground() below) as items were added --
// found by looking at the first screenshot of this redesign, not by calculation up front.
const MENU_BOTTOM = 470;
const MENU_TOP_MIN = 180; // never crowds the "LUG Treasure Hunt" subtitle above it

class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  preload() {
    if (!this.textures.exists('title-bg')) this.load.image('title-bg', 'assets/cutscenes/gate2.png');
    if (!this.textures.exists('title-fg')) this.load.image('title-fg', 'assets/cutscenes/title-fg.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a');
    this.stage = 'intro'; // 'intro' -> 'menu'

    this.buildBackground();

    this.add.text(GAME_WIDTH / 2, 108, 'BITS DUBAI', {
      fontFamily: FONT, fontSize: '30px', color: COLORS.highlight,
    }).setOrigin(0.5).setStroke('#1a1c2c', 7).setShadow(4, 5, '#000000', 4, true, true);
    uiText(this, GAME_WIDTH / 2, 150, 'The LUG Treasure Hunt', 8, COLORS.dim).setOrigin(0.5).setStroke('#1a1c2c', 4);

    this.pressEnter = uiText(this, GAME_WIDTH / 2, 340, 'PRESS ENTER', 12, COLORS.text).setOrigin(0.5);

    // The menu's buttons stay hidden until the "PRESS ENTER" prompt is actually pressed (showMenu()).
    this.menuIndex = 0;
    this.menuItems = this.buildMenuItems();
    this.buildMenu();

    this.controls = new ControlsPanel(this);
    this.credits = this.buildCredits();

    // Mouse click also reveals the menu from the intro prompt (the owner plays in a browser); once
    // revealed, the menu's own buttons own clicks instead (see buildMenu() above).
    this.input.on('pointerdown', () => { if (this.stage === 'intro') this.showMenu(); });

    for (const key of ['UP', 'W']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.moveMenu(-1); });
    for (const key of ['DOWN', 'S']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.moveMenu(1); });
    for (const key of ['ENTER', 'SPACE']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.onConfirm(); });
    this.input.keyboard.on('keydown-ESC', (e) => { if (!e.repeat) this.onCancel(); });
  }

  // "A little 3D" (docs/GAME_FEEL.md): two backdrop layers moving at different speeds is what makes
  // parallax read as depth rather than one flat picture -- the gate illustration pans slowly
  // (unchanged from before this pass), and a silhouette strip of palms/fence scrolls sideways in
  // front of it, faster, wrapping seamlessly (two copies side by side, reset once the first is fully
  // off-screen). The far layer sits under the dim overlay (so the menu stays legible over it); the
  // near silhouette sits ON TOP of that same overlay instead, at full contrast -- the way a genuinely
  // nearer layer would actually look darker/crisper than the hazy backdrop behind it, and (found by
  // looking at the first screenshot of this) the only way the strip doesn't just vanish into the
  // overlay's own near-black tint.
  buildBackground() {
    const tex = this.textures.get('title-bg').getSourceImage();
    const scale = GAME_WIDTH / tex.width;
    this.bg = this.add.image(GAME_WIDTH / 2, 0, 'title-bg').setOrigin(0.5, 0).setScale(scale).setAlpha(0.3);
    const panTo = Math.min(0, -(tex.height * scale - GAME_HEIGHT));
    this.tweens.add({ targets: this.bg, y: panTo, duration: 22000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12131a, 0.6).setOrigin(0, 0);

    const fgTex = this.textures.get('title-fg').getSourceImage();
    const fgScale = 1;
    const fgW = fgTex.width * fgScale;
    // Bottom-aligned, clear of MENU_BOTTOM (above) with a small gap regardless of how many menu
    // buttons are showing -- this is the "near" layer, so it stays put at the very edge of frame.
    const fgY = GAME_HEIGHT - fgTex.height * fgScale;
    this.fgA = this.add.image(0, fgY, 'title-fg').setOrigin(0, 0).setScale(fgScale);
    this.fgB = this.add.image(fgW, fgY, 'title-fg').setOrigin(0, 0).setScale(fgScale);
    this.fgTiles = [this.fgA, this.fgB];
    this.fgTileWidth = fgW;
    this.fgSpeed = 12; // px/sec, deliberately faster than the ~40s round trip of the vertical pan above
  }

  buildMenu() {
    const h = this.menuItems.length * BUTTON_H + (this.menuItems.length - 1) * BUTTON_GAP;
    const x = (GAME_WIDTH - BUTTON_W) / 2;
    const y = Math.max(MENU_TOP_MIN, MENU_BOTTOM - h); // bottom-anchored -- see the constant's comment
    this.menuBox = { x, y, w: BUTTON_W, h };

    this.menuButtons = this.menuItems.map((item, i) => {
      const by = y + i * (BUTTON_H + BUTTON_GAP);
      const button = new Button(this, x, by, BUTTON_W, BUTTON_H, item.label, () => {
        this.menuIndex = i;
        this.refreshMenu();
        this.confirmMenu();
      });
      button.setVisible(false);
      return button;
    });
    this.refreshMenu();
  }

  // "PRESS ENTER" and the menu are never both on screen (owner feedback: showing both said the same
  // thing twice) -- this is the one-way switch between them.
  showMenu() {
    this.stage = 'menu';
    this.pressEnter.setVisible(false);
    this.menuButtons.forEach((button) => button.setVisible(true));
  }

  // Continue only shows up when a save actually exists (docs/GAME_FEEL.md); its own label says
  // roughly where it left off and who's playing (M3a: her chosen name, src/state.js playerName),
  // the same idea as a Pokemon save slot showing play time and location.
  // "Watch the Card Again" (docs/ROADMAP.md M3, the ending) only shows up once a save has actually
  // reached it (`quest.stage === 'rewarded'`, set the instant the volunteer hands over the box,
  // src/story.js) -- so it can't appear as a confusing option before there's a card to watch.
  buildMenuItems() {
    const items = [...TITLE_MENU_BASE];
    if (saveEnabled() && hasSaveFile(currentProfile())) {
      const saved = peekSave(currentProfile());
      const place = saved && saved.map && MAPS[saved.map] ? MAPS[saved.map].name : 'your last spot';
      const name = saved && saved.playerName ? saved.playerName : null;
      items.splice(1, 0, { id: 'continue', label: name ? `Continue (${name} · ${place})` : `Continue (${place})` });
      if (saved && saved.quest && saved.quest.stage === 'rewarded') {
        items.splice(2, 0, { id: 'watch-card', label: 'Watch the Card Again' });
      }
    }
    return items;
  }

  buildCredits() {
    const w = 560;
    const h = 260;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0);
    const panel = this.add.graphics();
    drawPanel(panel, x, y, w, h);
    const lines = [
      'BITS DUBAI: THE LUG TREASURE HUNT',
      '',
      'Built with Phaser 3, free and open source.',
      'Campus layout from OpenStreetMap contributors,',
      'under the Open Database License (ODbL).',
      'All art and code original, made for this game.',
      '',
      'A gift, not a product.',
    ];
    const body = uiText(this, GAME_WIDTH / 2, y + 36, lines.join('\n'), 8, COLORS.text)
      .setOrigin(0.5, 0).setAlign('center').setLineSpacing(10);
    const footer = uiText(this, GAME_WIDTH / 2, y + h - 24, 'ESC / ENTER TO CLOSE', 8, COLORS.dim).setOrigin(0.5);
    const parts = [dim, panel, body, footer];
    parts.forEach((part) => part.setDepth(115).setVisible(false));
    return { parts, visible: false };
  }

  openCredits() {
    this.credits.visible = true;
    this.credits.parts.forEach((part) => part.setVisible(true));
  }

  closeCredits() {
    this.credits.visible = false;
    this.credits.parts.forEach((part) => part.setVisible(false));
  }

  moveMenu(direction) {
    if (this.stage !== 'menu' || this.controls.visible || this.credits.visible) return;
    this.menuIndex = (this.menuIndex + direction + this.menuItems.length) % this.menuItems.length;
    this.refreshMenu();
  }

  refreshMenu() {
    this.menuButtons.forEach((button, i) => button.setFocused(i === this.menuIndex));
  }

  // Enter/Space: reveals the menu from the intro prompt the first time, confirms the highlighted
  // button every time after (docs/GAME_FEEL.md -- one prompt at a time, never both on screen).
  onConfirm() {
    if (this.controls.visible) { this.controls.close(); return; }
    if (this.credits.visible) { this.closeCredits(); return; }
    if (this.stage === 'intro') { this.showMenu(); return; }
    // A keyboard confirm gets the same press-then-release visual a click does (Button.flashPress),
    // so Enter and a mouse click feel identical (docs/GAME_FEEL.md rule 7).
    this.menuButtons[this.menuIndex].flashPress(() => this.confirmMenu());
  }

  onCancel() {
    if (this.controls.visible) this.controls.close();
    else if (this.credits.visible) this.closeCredits();
  }

  confirmMenu() {
    const item = this.menuItems[this.menuIndex];
    if (item.id === 'play') this.startPlay(false);
    else if (item.id === 'continue') this.startPlay(true);
    else if (item.id === 'watch-card') this.watchCardAgain();
    else if (item.id === 'controls') this.controls.open();
    else if (item.id === 'credits') this.openCredits();
  }

  // Loads the save (for her name/customisation/the config's own recipient fallback, src/card.js)
  // then jumps straight to the card scene -- skipping the box-opening sequence and the world
  // entirely, since she's not replaying the hunt, just watching the card again (docs/ROADMAP.md M3).
  watchCardAgain() {
    loadGame(currentProfile());
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('card'));
  }

  // Play = new game: state reset, then the M3a opening (Mustafa's greeting -> name entry ->
  // customisation -> the bus arrival, src/scenes/intro-*.js) before ever reaching the loading screen
  // -- unless `?intro=0` (tests/e2e/helpers.js openTitle() default), which goes straight to 'boot'
  // exactly like before this pass existed.
  // Continue = load the existing save, then boot straight into it (src/main.js continueSpawnData()),
  // skipping the opening entirely -- she's already named and dressed.
  startPlay(continueSave) {
    let nextScene;
    if (continueSave) {
      loadGame(currentProfile());
      nextScene = 'boot';
    } else {
      resetGameState();
      nextScene = introEnabled() ? 'greeting' : 'boot';
    }
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(nextScene));
  }

  update(time, delta) {
    if (this.stage === 'intro') this.pressEnter.setAlpha(Math.floor(time / 500) % 2 ? 0.35 : 1);
    // Parallax foreground: scroll both tiles left, recycling whichever one has fully left the screen
    // to the far right of the other -- an endless, seamless strip at its own speed (see buildBackground()).
    const dx = (this.fgSpeed * delta) / 1000;
    for (const tile of this.fgTiles) tile.x -= dx;
    for (const tile of this.fgTiles) {
      if (tile.x <= -this.fgTileWidth) tile.x += this.fgTileWidth * this.fgTiles.length;
    }
  }
}
