// The title screen (FB-0023/0024, docs/GAME_FEEL.md): the game's name, a slowly panning campus
// illustration, and a small keyboard-or-mouse menu (Play / Continue / Controls / Credits), the same
// shape as a Gen 3-5 Pokemon title screen without copying any of its art or text. `?title=0` skips
// straight past this scene (and the loading screen after it) to the old instant-boot behaviour --
// tests/e2e/helpers.js openGame() sets that by default so the other ~65 specs don't need to know
// this scene exists at all.

const TITLE_MENU_BASE = [
  { id: 'play', label: 'Play' },
  { id: 'controls', label: 'Controls' },
  { id: 'credits', label: 'Credits' },
];

class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  preload() {
    if (!this.textures.exists('title-bg')) this.load.image('title-bg', 'assets/cutscenes/gate2.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a');

    // A slow, gentle pan of the Gate 2 illustration, the same "fill the width, pan the taller image"
    // technique src/scenes/cutscene.js uses -- reusing an asset that already exists rather than
    // inventing new art (CLAUDE.md: art stays generated in tools/make-assets.js; this is a straight
    // texture reuse, no new art at all).
    const tex = this.textures.get('title-bg').getSourceImage();
    const scale = GAME_WIDTH / tex.width;
    // Dim enough that the illustration reads as a moody backdrop, not competing content -- the gate
    // art has its own bright signboard text, which would otherwise fight the menu for attention
    // wherever the slow pan happens to place it (docs/GAME_FEEL.md "nothing overflows or fights the
    // frame it's in" -- the same "measure, don't guess" spirit as the panel-sizing rules).
    this.bg = this.add.image(GAME_WIDTH / 2, 0, 'title-bg').setOrigin(0.5, 0).setScale(scale).setAlpha(0.3);
    const panTo = Math.min(0, -(tex.height * scale - GAME_HEIGHT));
    this.tweens.add({ targets: this.bg, y: panTo, duration: 22000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12131a, 0.6).setOrigin(0, 0);

    this.add.text(GAME_WIDTH / 2, 128, 'PIXEL QUEST', {
      fontFamily: FONT, fontSize: '24px', color: COLORS.highlight,
    }).setOrigin(0.5).setStroke('#1a1c2c', 6).setShadow(3, 3, '#000000', 0, true, true);
    uiText(this, GAME_WIDTH / 2, 168, 'A BITS Pilani Dubai treasure hunt', 8, COLORS.dim).setOrigin(0.5).setStroke('#1a1c2c', 4);

    this.menuIndex = 0;
    this.menuItems = this.buildMenuItems();
    const startY = 268;
    this.menuTexts = this.menuItems.map((item, i) => {
      const text = uiText(this, GAME_WIDTH / 2, startY + i * 34, item.label, 12, COLORS.text).setOrigin(0.5).setStroke('#1a1c2c', 5);
      text.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { this.menuIndex = i; this.refreshMenu(); })
        .on('pointerdown', () => { this.menuIndex = i; this.confirmMenu(); });
      return text;
    });
    this.refreshMenu();

    this.pressEnter = uiText(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, 'PRESS ENTER', 12, COLORS.text)
      .setOrigin(0.5).setStroke('#1a1c2c', 5);

    this.controls = new ControlsPanel(this);
    this.credits = this.buildCredits();

    for (const key of ['UP', 'W']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.moveMenu(-1); });
    for (const key of ['DOWN', 'S']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.moveMenu(1); });
    for (const key of ['ENTER', 'SPACE']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.onConfirm(); });
    this.input.keyboard.on('keydown-ESC', (e) => { if (!e.repeat) this.onCancel(); });
  }

  // Continue only shows up when a save actually exists (docs/GAME_FEEL.md); its own label says
  // roughly where it left off, the same idea as a Pokemon save slot showing play time and location.
  buildMenuItems() {
    const items = [...TITLE_MENU_BASE];
    if (saveEnabled() && hasSaveFile(currentProfile())) {
      const saved = peekSave(currentProfile());
      const place = saved && saved.map && MAPS[saved.map] ? MAPS[saved.map].name : 'your last spot';
      items.splice(1, 0, { id: 'continue', label: `Continue (${place})` });
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
      'PIXEL QUEST',
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
    if (this.controls.visible || this.credits.visible) return;
    this.menuIndex = (this.menuIndex + direction + this.menuItems.length) % this.menuItems.length;
    this.refreshMenu();
  }

  refreshMenu() {
    this.menuTexts.forEach((text, i) => {
      const current = i === this.menuIndex;
      text.setText(`${current ? '> ' : '  '}${this.menuItems[i].label}`).setColor(current ? COLORS.highlight : COLORS.text);
    });
  }

  onConfirm() {
    if (this.controls.visible) { this.controls.close(); return; }
    if (this.credits.visible) { this.closeCredits(); return; }
    this.confirmMenu();
  }

  onCancel() {
    if (this.controls.visible) this.controls.close();
    else if (this.credits.visible) this.closeCredits();
  }

  confirmMenu() {
    const item = this.menuItems[this.menuIndex];
    if (item.id === 'play') this.startPlay(false);
    else if (item.id === 'continue') this.startPlay(true);
    else if (item.id === 'controls') this.controls.open();
    else if (item.id === 'credits') this.openCredits();
  }

  // Play = new game (state reset, save left alone until it's overwritten by playing);
  // Continue = load the existing save, then boot straight into it (src/main.js continueSpawnData()).
  startPlay(continueSave) {
    if (continueSave) loadGame(currentProfile());
    else resetGameState();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('boot'));
  }

  update(time) {
    this.pressEnter.setAlpha(Math.floor(time / 500) % 2 ? 0.35 : 1);
  }
}
