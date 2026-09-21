// M3a opening, step 3 (docs/STORY.md "Opening", owner brief 2026-09-21): clothes-color
// customisation, previewed live and animated on her actual sprite. Chains to 'bus-arrival' next.
//
// How the recolor works, and why (owner brief asked for this to be explained): tools/make-assets.js
// bakes one full character sheet per clothes swatch at build time (`player-<id>.png`,
// CLOTHES_SWATCHES/ameliaClothesRecolor()) -- the same exact-RGB recolor buildCharacter() already
// uses for the campus NPCs, just with a small table of swatches instead of one fixed table. This
// scene preloads every swatch's sheet (they're tiny -- a few KB each) so switching the preview is
// instant; src/main.js's BootScene later loads only the one she actually picked as the game's real
// 'player' texture. The alternative -- a Phaser render-texture/pipeline that recolors the sprite live
// in the browser -- was not chosen: this project has no build step and already treats all art as
// data baked by tools/make-assets.js (docs/ARCHITECTURE.md "content is data"), so adding a second,
// runtime recolor path just for this one screen would be new machinery for a problem the existing
// per-swatch-sheet approach already solves for free.

const CLOTHES_OPTIONS = [
  { id: 'pink', label: 'Pink', swatch: 0xff6fb1 },
  { id: 'sky', label: 'Sky', swatch: 0x3b7dd8 },
  { id: 'mint', label: 'Mint', swatch: 0x3d8a3f },
  { id: 'lavender', label: 'Lavender', swatch: 0x7a5ad9 },
  { id: 'sunset', label: 'Sunset', swatch: 0xe0803a },
];
const PREVIEW_SCALE = 5;

class CustomizeScene extends Phaser.Scene {
  constructor() {
    super('customize');
  }

  preload() {
    const sheet = { frameWidth: TILE, frameHeight: CHAR_HEIGHT };
    for (const option of CLOTHES_OPTIONS) {
      const key = `preview-${option.id}`;
      if (!this.textures.exists(key)) this.load.spritesheet(key, `assets/player-${option.id}.png`, sheet);
    }
    if (!this.textures.exists('title-bg')) this.load.image('title-bg', 'assets/cutscenes/gate2.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a').fadeIn(250, 0, 0, 0);
    this.finished = false;
    const startId = (GameState.customization && GameState.customization.clothes) || 'pink';
    this.index = Math.max(0, CLOTHES_OPTIONS.findIndex((o) => o.id === startId));

    // Same dimmed gate backdrop as the rest of the opening chain (docs/GAME_FEEL.md).
    const tex = this.textures.get('title-bg').getSourceImage();
    const bgScale = GAME_WIDTH / tex.width;
    this.add.image(GAME_WIDTH / 2, -(tex.height * bgScale - GAME_HEIGHT) * 0.4, 'title-bg').setOrigin(0.5, 0).setScale(bgScale).setAlpha(0.18);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12131a, 0.7).setOrigin(0, 0);

    uiText(this, GAME_WIDTH / 2, 48, `Nice to meet you, ${(GameState.playerName || '').toUpperCase()}!`, 16, COLORS.highlight).setOrigin(0.5);
    uiText(this, GAME_WIDTH / 2, 78, 'Pick your look:', 12, COLORS.text).setOrigin(0.5);

    // A soft panel behind the preview, plus a ground shadow ellipse under her feet -- the same
    // "a little 3D" touch world.js gives every character (docs/GAME_FEEL.md).
    const panelW = 240;
    const panelH = 260;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = 108;
    const panel = this.add.graphics();
    drawPanel(panel, panelX, panelY, panelW, panelH);
    const previewX = GAME_WIDTH / 2;
    const previewY = panelY + panelH / 2 + 10;
    this.add.ellipse(previewX, previewY + CHAR_HEIGHT * PREVIEW_SCALE * 0.34, 46, 14, 0x000000, 0.3);
    this.preview = this.add.sprite(previewX, previewY, `preview-${CLOTHES_OPTIONS[this.index].id}`, 0).setScale(PREVIEW_SCALE);

    this.buildSwatches(panelY + panelH + 46);
    this.buildContinueButton(panelY + panelH + 120);
    this.refreshPreview();

    for (const key of ['LEFT', 'A']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.cycle(-1); });
    for (const key of ['RIGHT', 'D']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.cycle(1); });
    for (const key of ['ENTER', 'SPACE']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.confirm(); });
    this.input.keyboard.on('keydown-ESC', (e) => { if (!e.repeat) this.confirm(); });
  }

  buildSwatches(y) {
    const size = 44;
    const gap = 14;
    const total = CLOTHES_OPTIONS.length * size + (CLOTHES_OPTIONS.length - 1) * gap;
    const x0 = (GAME_WIDTH - total) / 2;
    this.swatchParts = CLOTHES_OPTIONS.map((option, i) => {
      const x = x0 + i * (size + gap);
      const shadow = this.add.rectangle(x + size / 2 + 3, y + size / 2 + 4, size, size, 0x000000, 0.35);
      const swatch = this.add.rectangle(x + size / 2, y + size / 2, size, size, option.swatch);
      const ring = this.add.graphics();
      const zone = this.add.zone(x, y, size, size).setOrigin(0, 0).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => { this.index = i; this.refreshPreview(); });
      return { shadow, swatch, ring, zone, x, y, size };
    });
    this.swatchLabel = uiText(this, GAME_WIDTH / 2, y + size + 20, '', 8, COLORS.dim).setOrigin(0.5);
  }

  buildContinueButton(y) {
    const w = 220;
    const h = 48;
    this.continueButton = new Button(this, (GAME_WIDTH - w) / 2, y, w, h, 'Continue', () => this.confirm());
    this.continueButton.setFocused(true);
    uiText(this, GAME_WIDTH / 2, y + h + 18, 'LEFT/RIGHT TO CHOOSE · ENTER/CLICK TO CONTINUE', 8, COLORS.dim).setOrigin(0.5);
  }

  cycle(direction) {
    this.index = (this.index + direction + CLOTHES_OPTIONS.length) % CLOTHES_OPTIONS.length;
    this.refreshPreview();
  }

  refreshPreview() {
    const option = CLOTHES_OPTIONS[this.index];
    this.preview.setTexture(`preview-${option.id}`, 0);
    const animKey = `preview-idle-${option.id}`;
    if (!this.anims.exists(animKey)) {
      this.anims.create({ key: animKey, frames: this.anims.generateFrameNumbers(`preview-${option.id}`, { frames: [0, 7] }), frameRate: 2, yoyo: true, repeat: -1 });
    }
    this.preview.play(animKey);
    this.swatchLabel.setText(option.label.toUpperCase());
    this.swatchParts.forEach((part, i) => {
      part.ring.clear();
      if (i === this.index) part.ring.lineStyle(3, COLORS.gold, 1).strokeRect(part.x - 2, part.y - 2, part.size + 4, part.size + 4);
    });
    GameState.customization.clothes = option.id;
  }

  confirm() {
    if (this.finished) return;
    this.finished = true;
    notifyStateChanged();
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('bus-arrival'));
  }
}
