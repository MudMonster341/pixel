// The UI scene runs on top of the world at full resolution (no zoom), so text stays crisp.
// It is never restarted, so the tutorial and HUD persist when the world changes maps.

const COLORS = {
  panel: 0x1a1c2c,
  border: 0xeadbb8,
  gold: 0xffd23f,
  slot: 0x5d6070,
  text: '#f4f4f4',
  dim: '#9aa0b0',
  highlight: '#ffd23f',
  done: '#8fd46a',
};

function uiText(scene, x, y, str, size = 8, color = COLORS.text) {
  return scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    lineSpacing: Math.round(size * 0.6),
  });
}

function drawPanel(g, x, y, w, h) {
  g.fillStyle(0x000000, 0.35).fillRect(x + 4, y + 4, w, h);
  g.fillStyle(COLORS.panel, 0.92).fillRect(x, y, w, h);
  g.lineStyle(4, COLORS.border, 1).strokeRect(x + 2, y + 2, w - 4, h - 4);
}

class UIScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    this.minimap = new Minimap(this, 16, 16);
    this.hotbar = new Hotbar(this, GameState.inventory);
    this.dialog = new DialogBox(this);
    this.toast = new Toast(this);
    this.tutorial = new Tutorial(this);

    this.game.events.on('map-entered', (world) => this.minimap.setMap(world));
    this.game.events.on('toast', (message) => this.toast.show(message));
    const world = this.scene.get('world');
    if (world.tileData) this.minimap.setMap(world);

    this.keys = this.input.keyboard.addKeys('M,H');
  }

  // True while the player shouldn't be able to walk around.
  isBlocking() {
    return this.tutorial.cardOpen || this.dialog.isOpen;
  }

  update(time, delta) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) this.minimap.toggle();
    if (Phaser.Input.Keyboard.JustDown(this.keys.H) && !this.dialog.isOpen) this.tutorial.toggleCard();

    this.dialog.update(time, delta);
    this.tutorial.update(time);
    this.hotbar.setVisible(!this.dialog.isOpen);

    const world = this.scene.get('world');
    if (world.player && world.player.active && world.tileData) this.minimap.update(world, time);
  }
}

// ---------- minimap (top left) ----------

class Minimap {
  constructor(scene, x, y) {
    this.width = 184;
    this.height = 168;
    this.area = { x: x + 12, y: y + 12, w: 160, h: 120 };

    const panel = scene.add.graphics();
    drawPanel(panel, x, y, this.width, this.height);
    this.tiles = scene.add.graphics();
    this.markers = scene.add.graphics();
    this.label = uiText(scene, x + 14, y + this.height - 26, '');
    const hint = uiText(scene, x + this.width - 14, y + this.height - 26, 'M', 8, COLORS.dim).setOrigin(1, 0);
    this.parts = [panel, this.tiles, this.markers, this.label, hint];
    this.visible = true;
  }

  setMap(world) {
    const rows = world.tileData.length;
    const cols = world.tileData[0].length;
    const { area } = this;
    this.cell = Math.max(1, Math.floor(Math.min(area.w / cols, area.h / rows)));
    this.originX = area.x + Math.floor((area.w - cols * this.cell) / 2);
    this.originY = area.y + Math.floor((area.h - rows * this.cell) / 2);

    const colors = world.tileInfo.tiles.map((tile) => parseInt(tile.color.slice(1), 16));
    const g = this.tiles.clear();
    g.fillStyle(0x0b0c12, 1).fillRect(area.x, area.y, area.w, area.h);
    world.tileData.forEach((row, ty) => {
      row.forEach((index, tx) => {
        g.fillStyle(colors[index], 1).fillRect(this.originX + tx * this.cell, this.originY + ty * this.cell, this.cell, this.cell);
      });
    });
    this.label.setText(world.def.name.toUpperCase());
  }

  update(world, time) {
    const g = this.markers.clear();
    if (!this.visible) return;
    const scale = this.cell / TILE;
    const mx = (worldX) => this.originX + worldX * scale;
    const my = (worldY) => this.originY + worldY * scale;

    const view = world.cameras.main.worldView;
    g.lineStyle(1, 0xffffff, 0.6).strokeRect(mx(view.x), my(view.y), view.width * scale, view.height * scale);

    g.fillStyle(COLORS.gold, 1);
    for (const pickup of world.pickups) {
      if (!pickup.taken) g.fillRect(Math.round(mx(pickup.x)) - 1, Math.round(my(pickup.y)) - 1, 3, 3);
    }

    g.fillStyle(0x7fe0ff, 1);
    for (const npc of world.npcs) g.fillRect(Math.round(mx(npc.x)) - 2, Math.round(my(npc.y)) - 2, 4, 4);

    const px = Math.round(mx(world.player.x));
    const py = Math.round(my(world.player.y));
    g.fillStyle(0x000000, 1).fillRect(px - 3, py - 3, 6, 6);
    g.fillStyle(Math.floor(time / 300) % 2 ? 0xffffff : 0xff5a5a, 1).fillRect(px - 2, py - 2, 4, 4);
  }

  toggle() {
    this.visible = !this.visible;
    this.parts.forEach((part) => part.setVisible(this.visible));
  }
}

// ---------- inventory bar (bottom) ----------

class Hotbar {
  constructor(scene, inventory) {
    this.scene = scene;
    this.inventory = inventory;
    const size = 64;
    const gap = 10;
    const count = inventory.slots.length;
    const total = count * size + (count - 1) * gap;
    const x0 = Math.round((GAME_WIDTH - total) / 2);
    const y0 = GAME_HEIGHT - size - 20;

    this.panel = scene.add.graphics();
    drawPanel(this.panel, x0 - 12, y0 - 12, total + 24, size + 24);
    this.frames = scene.add.graphics();

    this.slots = inventory.slots.map((_, i) => {
      const x = x0 + i * (size + gap);
      const icon = scene.add.image(x + size / 2, y0 + size / 2, 'items', 0).setScale(3).setVisible(false);
      const number = uiText(scene, x + 6, y0 + 6, String(i + 1), 8, COLORS.dim);
      const amount = uiText(scene, x + size - 4, y0 + size - 4, '', 8).setOrigin(1, 1).setStroke('#000000', 4);
      scene.add.zone(x + size / 2, y0 + size / 2, size, size).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => inventory.select(i));
      return { x, y: y0, size, icon, number, amount };
    });

    this.itemName = uiText(scene, GAME_WIDTH / 2, y0 - 22, '', 8).setOrigin(0.5, 1).setStroke('#000000', 4).setAlpha(0);

    scene.input.keyboard.on('keydown', (event) => {
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) inventory.select(n - 1);
    });
    scene.input.on('wheel', (pointer, over, dx, dy) => {
      if (dy !== 0) inventory.select((inventory.selected + Math.sign(dy) + count) % count);
    });

    inventory.on('changed', () => this.refresh());
    inventory.on('selected', () => {
      this.refresh();
      this.flashName();
    });
    this.visible = true;
    this.refresh();
  }

  refresh() {
    const g = this.frames.clear();
    this.slots.forEach((slot, i) => {
      const selected = i === this.inventory.selected;
      const content = this.inventory.slots[i];
      g.fillStyle(0x000000, 0.5).fillRect(slot.x, slot.y, slot.size, slot.size);
      g.lineStyle(selected ? 4 : 2, selected ? COLORS.gold : COLORS.slot, 1).strokeRect(slot.x, slot.y, slot.size, slot.size);
      slot.icon.setVisible(this.visible && Boolean(content));
      if (content) slot.icon.setFrame(ITEMS[content.item].frame);
      slot.amount.setText(content && content.count > 1 ? `x${content.count}` : '');
      slot.number.setColor(selected ? COLORS.highlight : COLORS.dim);
    });
  }

  flashName() {
    const content = this.inventory.selectedSlot;
    this.itemName.setText(content ? ITEMS[content.item].name : 'Empty').setAlpha(1);
    this.scene.tweens.killTweensOf(this.itemName);
    this.scene.tweens.add({ targets: this.itemName, alpha: 0, delay: 1200, duration: 400 });
  }

  setVisible(visible) {
    if (visible === this.visible) return;
    this.visible = visible;
    [this.panel, this.frames, this.itemName].forEach((part) => part.setVisible(visible));
    this.slots.forEach((slot) => [slot.number, slot.amount].forEach((part) => part.setVisible(visible)));
    this.refresh();
  }
}

// ---------- dialog box (bottom, replaces the inventory bar while open) ----------

const CHARS_PER_SECOND = 45;

class DialogBox {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.box = { x: 100, y: 382, w: 760, h: 138 };
    const { x, y, w, h } = this.box;

    this.panel = scene.add.graphics();
    drawPanel(this.panel, x, y, w, h);
    this.nameTag = scene.add.graphics();
    this.name = uiText(scene, x + 34, y - 4, '', 16, COLORS.highlight).setOrigin(0, 0.5);
    this.body = uiText(scene, x + 30, y + 34, '', 16).setWordWrapWidth(w - 60);
    this.arrow = scene.add.triangle(x + w - 34, y + h - 26, 0, 0, 16, 0, 8, 10, COLORS.gold).setOrigin(0, 0);
    this.parts = [this.panel, this.nameTag, this.name, this.body, this.arrow];
    this.parts.forEach((part) => part.setDepth(50).setVisible(false));
  }

  open(speaker, lines, onClose) {
    const { x, y } = this.box;
    this.lines = lines;
    this.index = 0;
    this.onClose = onClose;
    this.isOpen = true;

    this.name.setText(speaker);
    this.nameTag.clear();
    drawPanel(this.nameTag, x + 16, y - 24, speaker.length * 16 + 36, 40);
    this.parts.forEach((part) => part.setVisible(true));
    this.startLine();
  }

  startLine() {
    // Wrap up front so words don't jump to the next line halfway through typing.
    this.fullText = this.body.getWrappedText(this.lines[this.index]).join('\n');
    this.shown = 0;
    this.typing = true;
    this.body.setText('');
  }

  // Called when the player presses E/Space: finish the line, or go to the next one.
  advance() {
    if (this.typing) {
      this.shown = this.fullText.length;
      return;
    }
    this.index++;
    if (this.index < this.lines.length) this.startLine();
    else this.close();
  }

  close() {
    this.isOpen = false;
    this.parts.forEach((part) => part.setVisible(false));
    const callback = this.onClose;
    this.onClose = null;
    if (callback) callback();
  }

  update(time, delta) {
    if (!this.isOpen) return;
    if (this.typing) {
      this.shown = Math.min(this.fullText.length, this.shown + (delta / 1000) * CHARS_PER_SECOND);
      this.body.setText(this.fullText.slice(0, Math.floor(this.shown)));
      if (this.shown >= this.fullText.length) this.typing = false;
    }
    this.arrow.setVisible(!this.typing && Math.floor(time / 400) % 2 === 0);
  }
}

// ---------- toast: short messages like "+1 Apple" ----------

class Toast {
  constructor(scene) {
    this.scene = scene;
    this.y = 360;
    this.text = uiText(scene, GAME_WIDTH / 2, this.y, '', 16).setOrigin(0.5).setStroke('#1a1c2c', 8).setAlpha(0).setDepth(60);
  }

  show(message) {
    this.scene.tweens.killTweensOf(this.text);
    this.text.setText(message).setAlpha(1).setY(this.y);
    this.scene.tweens.add({ targets: this.text, alpha: 0, y: this.y - 16, delay: 1400, duration: 500 });
  }
}

// ---------- tutorial: controls card, then an objectives checklist ----------

const TUTORIAL_STEPS = [
  { id: 'move', text: 'Walk around' },
  { id: 'pickup', text: 'Pick up an item' },
  { id: 'select', text: 'Pick a slot (1-5)' },
  { id: 'enter', text: 'Go inside the house' },
  { id: 'talk', text: 'Talk to Tomas (E)' },
];

const CONTROLS = [
  ['WASD / ARROWS', 'Move'],
  ['E / SPACE', 'Talk, next line'],
  ['1-5 / WHEEL', 'Choose item slot'],
  ['M', 'Show/hide minimap'],
  ['H', 'Show these controls'],
];

class Tutorial {
  constructor(scene) {
    this.scene = scene;
    this.stage = 'intro'; // intro -> steps -> done
    this.completed = new Set();
    this.walked = 0;
    this.buildCard();
    this.buildChecklist();
    this.keys = scene.input.keyboard.addKeys('ENTER,SPACE,ESC');

    const events = scene.game.events;
    events.on('player-moved', (distance) => {
      this.walked += distance;
      if (this.walked > 64) this.complete('move');
    });
    events.on('map-entered', (world) => world.mapKey === 'house' && this.complete('enter'));
    events.on('npc-talked', (id) => id === 'tomas' && this.complete('talk'));
    GameState.inventory.on('added', () => this.complete('pickup'));
    GameState.inventory.on('selected', () => this.complete('select'));
  }

  buildCard() {
    const { scene } = this;
    const w = 600;
    const h = 380;
    const x = (GAME_WIDTH - w) / 2;
    const y = (GAME_HEIGHT - h) / 2;

    const dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0);
    const panel = scene.add.graphics();
    drawPanel(panel, x, y, w, h);
    const parts = [
      dim,
      panel,
      uiText(scene, GAME_WIDTH / 2, y + 44, 'PIXEL QUEST', 24, COLORS.highlight).setOrigin(0.5),
      uiText(scene, GAME_WIDTH / 2, y + 86, 'Explore the meadow, collect items\nand meet the locals.', 8, COLORS.dim)
        .setOrigin(0.5).setAlign('center'),
      uiText(scene, x + 48, y + 124, 'CONTROLS', 12, COLORS.text),
    ];
    CONTROLS.forEach(([key, action], i) => {
      const rowY = y + 160 + i * 30;
      parts.push(uiText(scene, x + 48, rowY, key, 12, COLORS.highlight));
      parts.push(uiText(scene, x + 290, rowY, action, 12, COLORS.text));
    });
    this.cardPrompt = uiText(scene, GAME_WIDTH / 2, y + h - 36, '', 12, COLORS.text).setOrigin(0.5);
    parts.push(this.cardPrompt);

    this.cardParts = parts;
    parts.forEach((part) => part.setDepth(90));
    this.setCardOpen(true);
  }

  buildChecklist() {
    const { scene } = this;
    const w = 300;
    const h = 64 + TUTORIAL_STEPS.length * 24 + 26;
    const x = GAME_WIDTH - w - 16;
    const y = 16;

    const panel = scene.add.graphics();
    drawPanel(panel, x, y, w, h);
    const title = uiText(scene, x + 18, y + 20, 'TUTORIAL', 12, COLORS.highlight);
    this.stepTexts = TUTORIAL_STEPS.map((step, i) => uiText(scene, x + 18, y + 52 + i * 24, '', 8));
    const footer = uiText(scene, x + 18, y + h - 26, 'ESC: skip   H: controls', 8, COLORS.dim);

    this.checklistParts = [panel, title, footer, ...this.stepTexts];
    this.checklist = scene.add.container(0, 0, this.checklistParts).setVisible(false);
    this.refreshChecklist();
  }

  setCardOpen(open) {
    this.cardOpen = open;
    this.cardParts.forEach((part) => part.setVisible(open));
    this.cardPrompt.setText(this.stage === 'intro' ? 'PRESS ENTER TO START' : 'PRESS ENTER TO CLOSE');
  }

  toggleCard() {
    if (this.cardOpen) this.closeCard();
    else this.setCardOpen(true);
  }

  closeCard() {
    this.setCardOpen(false);
    if (this.stage === 'intro') {
      this.stage = 'steps';
      this.checklist.setVisible(true);
    }
  }

  complete(id) {
    if (this.stage !== 'steps' || this.completed.has(id)) return;
    this.completed.add(id);
    this.refreshChecklist();
    if (this.completed.size === TUTORIAL_STEPS.length) this.finish('Tutorial complete!');
  }

  refreshChecklist() {
    const current = TUTORIAL_STEPS.find((step) => !this.completed.has(step.id));
    TUTORIAL_STEPS.forEach((step, i) => {
      const done = this.completed.has(step.id);
      const color = done ? COLORS.done : step === current ? COLORS.highlight : COLORS.dim;
      this.stepTexts[i].setText(`${done ? '[x]' : step === current ? '[>]' : '[ ]'} ${step.text}`).setColor(color);
    });
  }

  finish(message) {
    this.stage = 'done';
    // Wait for any open conversation to end so the message isn't hidden behind it.
    const announce = () => {
      if (this.scene.dialog.isOpen) {
        this.scene.time.delayedCall(300, announce);
        return;
      }
      this.scene.time.delayedCall(1800, () => this.scene.toast.show(message));
      this.scene.tweens.add({
        targets: this.checklist, alpha: 0, delay: 1800, duration: 600,
        onComplete: () => this.checklist.setVisible(false),
      });
    };
    announce();
  }

  update(time) {
    const { JustDown } = Phaser.Input.Keyboard;
    const enter = JustDown(this.keys.ENTER);
    const space = JustDown(this.keys.SPACE);
    const escape = JustDown(this.keys.ESC);

    if (this.cardOpen) {
      if (enter || space || escape) this.closeCard();
      this.cardPrompt.setAlpha(Math.floor(time / 500) % 2 ? 0.4 : 1);
    } else if (escape && this.stage === 'steps') {
      this.finish('Tutorial skipped');
    }
  }
}
