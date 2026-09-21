// The UI scene runs on top of the world at full resolution (no zoom), so text stays crisp.
// It is never restarted by an ordinary map change, so the tutorial and HUD persist across those --
// but "Quit to Title" (PauseMenu) does stop and later relaunch it, so anything this scene or its
// components subscribe to on a *persistent* emitter (GameState.inventory, `game.events` -- as
// opposed to `this.input.keyboard`/`this.events`, which belong to the scene itself and are cleaned
// up by Phaser automatically on shutdown) must unsubscribe again on shutdown, or the next 'ui'
// instance ends up sharing that emitter with a previous instance's already-destroyed game objects,
// which throws the moment something like inventory.emit('changed') reaches them.

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

// "A little 3D" (docs/GAME_FEEL.md): every panel in the game already went through drawPanel(), so
// giving it a 1px inner bevel here -- a lighter line along the top/left inside the border, a darker
// one along the bottom/right -- lifts every dialog box, minimap, pause menu and panel in one place,
// consistent with docs/STYLE_GUIDE.md's "one light source, top-left" rule for every other asset in
// the game. The outer drop shadow (offset fill behind the panel) is unchanged.
function drawPanel(g, x, y, w, h) {
  g.fillStyle(0x000000, 0.35).fillRect(x + 4, y + 4, w, h);
  g.fillStyle(COLORS.panel, 0.92).fillRect(x, y, w, h);
  g.lineStyle(4, COLORS.border, 1).strokeRect(x + 2, y + 2, w - 4, h - 4);
  g.lineStyle(1, 0xffffff, 0.18).lineBetween(x + 5, y + 5, x + w - 5, y + 5).lineBetween(x + 5, y + 5, x + 5, y + h - 5);
  g.lineStyle(1, 0x000000, 0.25).lineBetween(x + 5, y + h - 5, x + w - 5, y + h - 5).lineBetween(x + w - 5, y + 5, x + w - 5, y + h - 5);
}

// ---------- big drawn button (M3a title screen redesign, docs/GAME_FEEL.md "a little 3D") ----------
// Bevelled, shaded, with its own drop shadow -- the title's Play/Continue/Controls/Credits rows used
// to be plain text; the owner's brief specifically asked for "big buttons... drawn properly". Three
// visual states (normal/hover/pressed) are all drawn up front into one Graphics object and swapped
// by redrawing, the same "measure once, redraw on state change" shape every other panel in this file
// already uses (see Hotbar.refresh(), DialogBox), so it fits this codebase's existing conventions
// rather than introducing a new "component" system just for this screen.
function drawButtonState(g, x, y, w, h, state) {
  g.clear();
  const lift = state === 'pressed' ? 2 : 0; // a pressed button sinks toward its own shadow
  const by = y + lift;
  // Drop shadow, softer/closer when pressed (less "floating").
  g.fillStyle(0x000000, state === 'pressed' ? 0.25 : 0.4).fillRect(x + 3, y + 6, w, h);
  // Base fill: navy panel tone, brighter on hover/selected so keyboard focus is obvious without text
  // changing color alone (docs/GAME_FEEL.md rule 7: keyboard-first).
  const base = state === 'hover' ? 0x24273c : COLORS.panel;
  g.fillStyle(base, 0.96).fillRect(x, by, w, h);
  // Bevel: light top/left, dark bottom/right (STYLE_GUIDE "one light source, top-left"), inverted
  // when pressed so the button reads as pushed in rather than popped out.
  const hiAlpha = state === 'pressed' ? 0.12 : 0.35;
  const loAlpha = state === 'pressed' ? 0.35 : 0.4;
  const hiSide = state === 'pressed' ? 0x000000 : 0xffffff;
  const loSide = state === 'pressed' ? 0xffffff : 0x000000;
  g.lineStyle(2, hiSide, hiAlpha).lineBetween(x + 2, by + 2, x + w - 2, by + 2).lineBetween(x + 2, by + 2, x + 2, by + h - 2);
  g.lineStyle(2, loSide, loAlpha).lineBetween(x + 2, by + h - 2, x + w - 2, by + h - 2).lineBetween(x + w - 2, by + 2, x + w - 2, by + h - 2);
  // Outer border: gold when selected/hovered (matches the rest of the UI's highlight color), cream otherwise.
  g.lineStyle(3, state === 'hover' ? COLORS.gold : COLORS.border, 1).strokeRect(x + 1, by + 1, w - 2, h - 2);
  return by; // callers reposition their label text to track the press-lift
}

// A whole button: its own Graphics (drawButtonState above), a centered label, and a Zone for mouse
// input. Keyboard focus is driven externally (whoever owns a row of these -- title.js's menu, the
// customisation screen's swatches -- moves `focused` with arrow keys, same as every other
// keyboard-driven list in this game); mouse hover/press are handled here directly. Both input paths
// funnel into the same drawButtonState() so a keyboard-selected button and a mouse-hovered one look
// identical (docs/GAME_FEEL.md rule 7: mouse is always an addition, never a different experience).
class Button {
  constructor(scene, x, y, w, h, label, onConfirm) {
    this.scene = scene;
    this.box = { x, y, w, h };
    this.hovered = false;
    this.focused = false;
    this.pressedVisual = false;
    this.graphics = scene.add.graphics();
    this.text = uiText(scene, x + w / 2, y + h / 2, label, 12, COLORS.text).setOrigin(0.5);
    this.zone = scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.zone.on('pointerover', () => { this.hovered = true; this.redraw(); });
    this.zone.on('pointerout', () => { this.hovered = false; this.pressedVisual = false; this.redraw(); });
    this.zone.on('pointerdown', () => { this.pressedVisual = true; this.redraw(); });
    this.zone.on('pointerup', () => {
      const wasPressed = this.pressedVisual;
      this.pressedVisual = false;
      this.redraw();
      if (wasPressed && onConfirm) onConfirm();
    });
    this.redraw();
  }

  setLabel(label) {
    this.text.setText(label);
  }

  setFocused(focused) {
    if (focused === this.focused) return;
    this.focused = focused;
    this.redraw();
  }

  // A keyboard confirm (Enter/Space) gets the same pressed-then-release visual a click does, just on
  // a short timer instead of a real pointerup, so it's clear something was activated either way.
  flashPress(onDone) {
    this.pressedVisual = true;
    this.redraw();
    this.scene.time.delayedCall(90, () => {
      this.pressedVisual = false;
      this.redraw();
      if (onDone) onDone();
    });
  }

  redraw() {
    const state = this.pressedVisual ? 'pressed' : this.hovered || this.focused ? 'hover' : 'normal';
    const by = drawButtonState(this.graphics, this.box.x, this.box.y, this.box.w, this.box.h, state);
    this.text.setY(by + this.box.h / 2).setColor(state === 'hover' ? COLORS.highlight : COLORS.text);
  }

  setVisible(visible) {
    this.graphics.setVisible(visible);
    this.text.setVisible(visible);
    if (visible) this.zone.setInteractive();
    else this.zone.disableInteractive();
  }

  destroy() {
    this.graphics.destroy();
    this.text.destroy();
    this.zone.destroy();
  }
}

class UIScene extends Phaser.Scene {
  constructor() {
    super('ui');
  }

  create() {
    this.minimap = new Minimap(this, 16, 16);
    this.fullMap = new FullMap(this);
    this.minimap.onClick = () => this.toggleFullMap();
    this.locationBanner = new LocationBanner(this);
    this.hotbar = new Hotbar(this, GameState.inventory);
    this.dialog = new DialogBox(this);
    this.toast = new Toast(this);
    this.tutorial = new Tutorial(this);
    this.hints = new HintBanner(this);
    this.pause = new PauseMenu(this);

    // Named so they can be un-subscribed again in shutdown() below -- see the file-header comment.
    this.onMapEntered = (world) => {
      this.minimap.setMap(world);
      this.locationBanner.show(world.def.name);
    };
    this.onAreaEntered = (name) => this.locationBanner.show(name);
    this.onToast = (message) => this.toast.show(message);
    // In-fiction hints (FB-0023/0024, docs/GAME_FEEL.md): world.js emits these the first moment
    // each one is relevant ("hint:move" as soon as she can walk, "hint:talk" the first time an NPC
    // is in range, ...). HintBanner itself is what actually remembers "already shown" (GameState.
    // seenHints), so emitting one more than once is harmless.
    this.onHint = (id) => this.hints.trigger(id);
    // A dialog `{ cutscene: 'key' }` action (src/dialog.js) fires this; handled here (a persistent
    // scene, at least across ordinary map changes) rather than in world.js itself, so it always
    // reaches whichever WorldScene instance is current even if a map change happened in between.
    this.onCutsceneRequested = (key) => {
      const world = this.scene.get('world');
      if (!CUTSCENES[key]) { console.warn(`dialog action requested unknown cutscene "${key}"`); return; }
      if (world.sys.isActive() && !world.transitioning) world.playCutscene(key);
    };
    this.game.events.on('map-entered', this.onMapEntered);
    this.game.events.on('area-entered', this.onAreaEntered);
    this.game.events.on('toast', this.onToast);
    this.game.events.on('hint', this.onHint);
    this.game.events.on('cutscene:requested', this.onCutsceneRequested);
    this.events.once('shutdown', () => this.teardown());

    const world = this.scene.get('world');
    if (world.tileData) this.minimap.setMap(world);

    // One-shot keys use keydown events; polling JustDown loses taps shorter than a frame (ERR-0001).
    this.input.keyboard.on('keydown-M', (event) => {
      if (!event.repeat) this.minimap.toggle();
    });
    this.input.keyboard.on('keydown-N', (event) => {
      if (!event.repeat) this.toggleFullMap();
    });
    // Esc: closing the full-screen map always wins (it has its own long-standing meaning), then the
    // pause menu owns Esc the rest of the time -- opening it, or backing out of its Controls page,
    // or closing it again (docs/GAME_FEEL.md). Not while a conversation owns the screen.
    this.input.keyboard.on('keydown-ESC', (event) => {
      if (event.repeat) return;
      if (this.fullMap.visible) this.fullMap.close();
      else if (!this.dialog.isOpen) this.pause.onEscape();
    });
  }

  // Undoes every subscription create() made on a *persistent* emitter (GameState.inventory,
  // `game.events`), run once when "Quit to Title" stops this scene (see the file-header comment).
  // Scene-local subscriptions (this.input.keyboard, this.events) don't need this: Phaser tears
  // those down on its own as part of the same shutdown.
  teardown() {
    this.game.events.off('map-entered', this.onMapEntered);
    this.game.events.off('area-entered', this.onAreaEntered);
    this.game.events.off('toast', this.onToast);
    this.game.events.off('hint', this.onHint);
    this.game.events.off('cutscene:requested', this.onCutsceneRequested);
    this.hotbar.teardown();
    this.tutorial.teardown();
  }

  // FB-0018: click the minimap or press N to see the whole current map, full screen. Blocked while
  // dialog/pause own the screen, or while the world is paused for a cutscene (P4).
  toggleFullMap() {
    const world = this.scene.get('world');
    if (this.fullMap.visible) {
      this.fullMap.close();
      return;
    }
    if (this.dialog.isOpen || this.pause.visible || !world.sys.isActive()) return;
    this.fullMap.open(world);
  }

  // True while the player shouldn't be able to walk around.
  isBlocking() {
    return this.dialog.isOpen || this.fullMap.visible || this.pause.visible;
  }

  update(time, delta) {
    this.dialog.update(time, delta);
    this.hotbar.setVisible(!this.dialog.isOpen);
    if (this.fullMap.visible) this.fullMap.update(time);

    const world = this.scene.get('world');
    if (world.player && world.player.active && world.tileData) this.minimap.update(world, time);
    if (world.player && world.player.active) this.hotbar.updateOverlap(world);
  }
}

// ---------- minimap (top left) ----------

class Minimap {
  constructor(scene, x, y) {
    this.width = 184;
    this.height = 168;
    this.area = { x: x + 12, y: y + 12, w: 160, h: 120 };

    this.scene = scene;
    const panel = scene.add.graphics();
    drawPanel(panel, x, y, this.width, this.height);
    const backdrop = scene.add.rectangle(this.area.x, this.area.y, this.area.w, this.area.h, 0x0b0c12).setOrigin(0, 0);
    this.image = scene.add.image(this.area.x, this.area.y, '__DEFAULT').setOrigin(0, 0).setVisible(false);
    this.markers = scene.add.graphics();
    this.label = uiText(scene, x + 14, y + this.height - 26, '');
    const hint = uiText(scene, x + this.width - 14, y + this.height - 26, 'M', 8, COLORS.dim).setOrigin(1, 0);
    this.parts = [panel, backdrop, this.image, this.markers, this.label, hint];
    this.visible = true;
    this.onClick = null; // FB-0018: set by UIScene to open the full-screen map

    scene.add.zone(this.area.x, this.area.y, this.area.w, this.area.h).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.visible && this.onClick && this.onClick());
  }

  // The map is drawn once into a texture, 1 pixel per tile. Small maps are shown whole and scaled up;
  // big maps (the campus) show a window around the player at 1 pixel per tile.
  setMap(world) {
    const rows = world.tileData.length;
    const cols = world.tileData[0].length;
    const key = `minimap-${world.mapKey}`;
    if (!this.scene.textures.exists(key)) {
      const texture = this.scene.textures.createCanvas(key, cols, rows);
      const ctx = texture.getContext();
      const pixels = ctx.createImageData(cols, rows);
      const colors = world.tileInfo.tiles.map((tile) => [1, 3, 5].map((i) => parseInt(tile.color.slice(i, i + 2), 16)));
      world.tileData.forEach((row, ty) => {
        row.forEach((index, tx) => {
          const [r, g, b] = colors[index] || [0, 0, 0];
          const p = (ty * cols + tx) * 4;
          pixels.data[p] = r;
          pixels.data[p + 1] = g;
          pixels.data[p + 2] = b;
          pixels.data[p + 3] = 255;
        });
      });
      ctx.putImageData(pixels, 0, 0);
      texture.refresh();
    }

    const { area } = this;
    this.cols = cols;
    this.rows = rows;
    this.cell = Math.max(1, Math.floor(Math.min(area.w / cols, area.h / rows)));
    this.windowCols = Math.min(cols, Math.floor(area.w / this.cell));
    this.windowRows = Math.min(rows, Math.floor(area.h / this.cell));
    this.offsetX = area.x + Math.floor((area.w - this.windowCols * this.cell) / 2);
    this.offsetY = area.y + Math.floor((area.h - this.windowRows * this.cell) / 2);
    this.scrollX = 0;
    this.scrollY = 0;
    this.image.setTexture(key).setScale(this.cell).setVisible(this.visible);
    this.applyWindow();
    this.setLabel(world.def.name.toUpperCase());
  }

  // The caption (e.g. "MECHANICAL BLOCK - GROUND FLOOR") must never run past the panel's right edge
  // (QA P5): shrink the font first (works for every real map name), then, only if some future name
  // is still too wide even at the smallest readable size, truncate with an ellipsis as a last resort
  // so the bound is guaranteed regardless of what a map is named.
  setLabel(text) {
    const maxWidth = this.width - 28; // 14px inset each side, clear of the panel border
    const minSize = 5;
    let size = 8;
    this.label.setFontSize(size).setText(text);
    while (this.label.width > maxWidth && size > minSize) {
      size -= 1;
      this.label.setFontSize(size);
    }
    let shown = text;
    while (this.label.width > maxWidth && shown.length > 1) {
      shown = shown.slice(0, -1);
      this.label.setText(`${shown}…`);
    }
  }

  applyWindow() {
    this.image.setCrop(this.scrollX, this.scrollY, this.windowCols, this.windowRows);
    this.image.setPosition(this.offsetX - this.scrollX * this.cell, this.offsetY - this.scrollY * this.cell);
  }

  update(world, time) {
    const g = this.markers.clear();
    if (!this.visible || !this.cols) return;

    const scrollX = Phaser.Math.Clamp(Math.round(world.player.x / TILE - this.windowCols / 2), 0, this.cols - this.windowCols);
    const scrollY = Phaser.Math.Clamp(Math.round(world.player.y / TILE - this.windowRows / 2), 0, this.rows - this.windowRows);
    if (scrollX !== this.scrollX || scrollY !== this.scrollY) {
      this.scrollX = scrollX;
      this.scrollY = scrollY;
      this.applyWindow();
    }

    const mx = (worldX) => this.offsetX + (worldX / TILE - this.scrollX) * this.cell;
    const my = (worldY) => this.offsetY + (worldY / TILE - this.scrollY) * this.cell;
    const right = this.offsetX + this.windowCols * this.cell;
    const bottom = this.offsetY + this.windowRows * this.cell;
    const dot = (x, y, size) => {
      if (x >= this.offsetX && y >= this.offsetY && x < right && y < bottom) g.fillRect(Math.round(x) - size / 2, Math.round(y) - size / 2, size, size);
    };

    const view = world.cameras.main.worldView;
    g.lineStyle(1, 0xffffff, 0.6).strokeRect(mx(view.x), my(view.y), (view.width / TILE) * this.cell, (view.height / TILE) * this.cell);

    g.fillStyle(COLORS.gold, 1);
    for (const pickup of world.pickups) if (!pickup.taken) dot(mx(pickup.x), my(pickup.y), 3);
    g.fillStyle(0x7fe0ff, 1);
    for (const npc of world.npcs) dot(mx(npc.x), my(npc.y), 4);

    g.fillStyle(0x000000, 1);
    dot(mx(world.player.x), my(world.player.y), 6);
    g.fillStyle(Math.floor(time / 300) % 2 ? 0xffffff : 0xff5a5a, 1);
    dot(mx(world.player.x), my(world.player.y), 4);
  }

  toggle() {
    this.visible = !this.visible;
    this.parts.forEach((part) => part.setVisible(this.visible));
  }
}

// ---------- location banner (top-center): Pokemon-style name plate ----------
// Shown on map start and when the player walks into a differently-named area/zone/building object
// (world.js emits 'map-entered' and 'area-entered'). Top-center, clear of the minimap's top-left box.

const BANNER_HOLD_MS = 2000;
const BANNER_SLIDE_MS = 300;

class LocationBanner {
  constructor(scene) {
    this.scene = scene;
    const w = 340;
    const h = 40;
    this.hiddenY = -h - 8;
    this.shownY = 12;

    const panel = scene.add.graphics();
    drawPanel(panel, 0, 0, w, h);
    this.text = uiText(scene, w / 2, h / 2, '', 12, COLORS.text).setOrigin(0.5);
    this.container = scene.add.container((GAME_WIDTH - w) / 2, this.hiddenY, [panel, this.text]).setDepth(80);
    this.hideTimer = null;
    this.visible = false; // true from show() until the slide-out finishes (tests read this directly)
  }

  show(name) {
    this.text.setText(name.toUpperCase());
    this.visible = true;
    this.scene.tweens.killTweensOf(this.container);
    if (this.hideTimer) this.hideTimer.remove();
    this.scene.tweens.add({ targets: this.container, y: this.shownY, duration: BANNER_SLIDE_MS, ease: 'Cubic.easeOut' });
    this.hideTimer = this.scene.time.delayedCall(BANNER_SLIDE_MS + BANNER_HOLD_MS, () => {
      this.scene.tweens.add({
        targets: this.container, y: this.hiddenY, duration: BANNER_SLIDE_MS, ease: 'Cubic.easeIn',
        onComplete: () => { this.visible = false; },
      });
    });
  }
}

// ---------- full-screen map (FB-0018): click the minimap, or press N ----------

class FullMap {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.world = null;

    this.dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0b0c12, 0.96).setOrigin(0, 0)
      .setInteractive().on('pointerdown', () => this.close());
    this.image = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, '__DEFAULT');
    this.markers = scene.add.graphics();
    this.labels = scene.add.container(0, 0);
    this.title = uiText(scene, GAME_WIDTH / 2, 14, '', 12, COLORS.highlight).setOrigin(0.5, 0);
    this.hint = uiText(scene, GAME_WIDTH / 2, GAME_HEIGHT - 26, 'ESC / N / CLICK TO CLOSE', 8, COLORS.dim).setOrigin(0.5, 0);
    this.parts = [this.dim, this.image, this.markers, this.labels, this.title, this.hint];
    this.parts.forEach((part) => part.setDepth(120).setVisible(false));
    this.markers.setDepth(121); // the "you are here" marker always shows over the labels below it
  }

  open(world) {
    this.visible = true;
    this.world = world;
    const cols = world.tileData[0].length;
    const rows = world.tileData.length;
    const areaW = GAME_WIDTH - 64;
    const areaH = GAME_HEIGHT - 96;
    this.scale = Math.min(areaW / cols, areaH / rows);
    this.offsetX = (GAME_WIDTH - cols * this.scale) / 2;
    this.offsetY = 48 + (areaH - rows * this.scale) / 2;
    this.image.setTexture(`minimap-${world.mapKey}`)
      .setDisplaySize(cols * this.scale, rows * this.scale)
      .setPosition(this.offsetX + (cols * this.scale) / 2, this.offsetY + (rows * this.scale) / 2);
    this.title.setText(world.def.name.toUpperCase());

    // Labels for named buildings/areas, skipping anything covering more than ~30% of the map (the
    // whole-campus outline, say) since a label for that isn't useful and would swamp the others.
    // Also skips the generator's own "no real name for this OSM building" placeholder
    // (`Building <osm id>`, tools/campus/build-campus.js): dozens of small neighbouring structures
    // get one of these each, and unlike a real name it's not useful to a player -- labelling them
    // anyway used to bury Main Block/Gate 2/etc. under a wall of "Building 519043987"-style text.
    // Also skips road/roundabout infrastructure areas (the loop road around the academic core, the
    // roundabout just inside Gate 2, and its own flanking "Gate Parking (West/East)" lots -- FB-0026,
    // tools/campus/build-campus.js): they're large enough, and centred close enough to Gate 2/the Main
    // Block, that labelling them ate the declutter slot the real landmark needed -- a player doesn't
    // need "Academic Core Loop Road" or "Gate Parking (West)" pointed out the way they need "Main
    // Block" or "Gate 2" itself. The older, standalone "Student Parking" lot (near the track) keeps
    // its label; it isn't fighting any other name for the same spot on the map.
    // Biggest/most important first, then a simple greedy declutter: skip a label whose position
    // would land right on top of one already placed (real buildings can sit close together).
    this.labels.removeAll(true);
    const totalArea = cols * rows;
    const isPlaceholderName = (name) => /^Building \d+$/.test(name);
    const isInfrastructureArea = (o) => o.type === 'area' && (o.props?.kind === 'road' || o.props?.kind === 'roundabout' || /^Gate Parking \(/.test(o.name));
    const named = (world.mapObjects || [])
      .filter((o) => ['area', 'building'].includes(o.type) && o.name && !isPlaceholderName(o.name) && !isInfrastructureArea(o) && o.width * o.height < totalArea * 0.3)
      .sort((a, b) => b.width * b.height - a.width * a.height);
    const placed = [];
    const MIN_GAP = 26; // px: bigger than one label's height, so crowded clusters thin out to a few names
    for (const o of named) {
      const lx = this.offsetX + (o.x + o.width / 2) * this.scale;
      const ly = this.offsetY + (o.y + o.height / 2) * this.scale;
      if (placed.some((p) => Math.abs(p.x - lx) < MIN_GAP && Math.abs(p.y - ly) < MIN_GAP)) continue;
      placed.push({ x: lx, y: ly });
      this.labels.add(uiText(this.scene, lx, ly, o.name, 8, COLORS.text).setOrigin(0.5).setStroke('#1a1c2c', 3));
    }

    this.parts.forEach((part) => part.setVisible(true));
  }

  close() {
    this.visible = false;
    this.world = null;
    this.parts.forEach((part) => part.setVisible(false));
  }

  update(time) {
    if (!this.visible || !this.world) return;
    const g = this.markers.clear();
    const px = this.offsetX + (this.world.player.x / TILE) * this.scale;
    const py = this.offsetY + (this.world.player.y / TILE) * this.scale;
    g.fillStyle(0x000000, 1).fillCircle(px, py, 6); // dark ring so the blinking dot reads on any background
    g.fillStyle(Math.floor(time / 300) % 2 ? 0xffffff : 0xff5a5a, 1);
    g.fillCircle(px, py, 4);
  }
}

// ---------- inventory bar (bottom) ----------

// Slots are small (48px, was 64px) and the bar turns translucent when the player is behind it
// (FB-0001): the owner's choice B, over hiding it (A) or growing the camera to avoid it (C).
const HOTBAR_TRANSLUCENT_ALPHA = 0.35;

class Hotbar {
  constructor(scene, inventory) {
    this.scene = scene;
    this.inventory = inventory;
    const size = 48;
    const gap = 8;
    const count = inventory.slots.length;
    const total = count * size + (count - 1) * gap;
    const x0 = Math.round((GAME_WIDTH - total) / 2);
    const y0 = GAME_HEIGHT - size - 20;
    const pad = 10;
    // On-screen box the bar occupies, used to test overlap with the player (see updateOverlap).
    this.bounds = { x: x0 - pad, y: y0 - pad, w: total + pad * 2, h: size + pad * 2 };
    this.alpha = 1;

    this.panel = scene.add.graphics();
    drawPanel(this.panel, this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
    this.frames = scene.add.graphics();

    this.slots = inventory.slots.map((_, i) => {
      const x = x0 + i * (size + gap);
      const icon = scene.add.image(x + size / 2, y0 + size / 2, 'items', 0).setScale(2.5).setVisible(false);
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

    // Named so teardown() can undo them -- `inventory` is GameState.inventory, a persistent
    // singleton that outlives this scene, see the file-header comment on why that matters.
    this.onChanged = () => this.refresh();
    this.onSelected = () => {
      this.refresh();
      this.flashName();
    };
    inventory.on('changed', this.onChanged);
    inventory.on('selected', this.onSelected);
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

  // FB-0001: fade the bar out when the player's on-screen position is behind or under it, so it
  // doesn't hide the character (owner's choice B: shrink + turn translucent, not hide it or grow
  // the camera). The player's world position is converted to screen space using the world camera
  // (zoom 3, see docs/STYLE_GUIDE.md), then tested against the bar's own screen-space box.
  updateOverlap(world) {
    // worldView is the camera's visible region in world space, already accounting for zoom and
    // bounds clamping (the same property the minimap uses to draw the view rectangle).
    const view = world.cameras.main.worldView;
    const p = world.player;
    const screenX = (p.x - view.x) * ZOOM;
    const screenY = (p.y - view.y) * ZOOM;
    // Half the player's on-screen footprint (a 16px sprite at zoom 3).
    const half = (TILE * ZOOM) / 2;
    const { x, y, w, h } = this.bounds;
    const overlaps = screenX + half > x && screenX - half < x + w && screenY + half > y && screenY - half < y + h;
    this.setTranslucent(overlaps);
  }

  setTranslucent(translucent) {
    const alpha = translucent ? HOTBAR_TRANSLUCENT_ALPHA : 1;
    if (alpha === this.alpha) return;
    this.alpha = alpha;
    [this.panel, this.frames, this.itemName].forEach((part) => part.setAlpha(alpha));
    this.slots.forEach((slot) => [slot.icon, slot.number, slot.amount].forEach((part) => part.setAlpha(alpha)));
  }

  teardown() {
    this.inventory.off('changed', this.onChanged);
    this.inventory.off('selected', this.onSelected);
  }
}

// ---------- dialog box (bottom, replaces the inventory bar while open) ----------

const CHARS_PER_SECOND = 45;

// A dialog entry can offer choices (roadmap M1, docs/ARCHITECTURE.md): after its `lines` finish
// typing, instead of closing, the box shows a selectable list (up/down or W/S move the highlight,
// Enter/E/Space picks). Keyboard only, same box, no new art.
class DialogBox {
  constructor(scene) {
    this.scene = scene;
    this.isOpen = false;
    this.choices = null; // the list currently shown, or null while plain lines are typing/showing
    this.pendingChoices = null; // set by open(); shown once `lines` run out
    this.choiceTexts = null;
    this.choiceIndex = 0;
    this.selectedChoice = null; // the choice the player picked, passed to onClose() at the very end
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

    // One-shot keys use keydown events, never JustDown (ERR-0001). These are no-ops whenever
    // `this.choices` is null, so they're harmless in scenes/moments without a choice on screen
    // (e.g. the cutscene player, which never passes `choices` to open()).
    for (const key of ['UP', 'W']) scene.input.keyboard.on(`keydown-${key}`, (event) => !event.repeat && this.moveChoice(-1));
    for (const key of ['DOWN', 'S']) scene.input.keyboard.on(`keydown-${key}`, (event) => !event.repeat && this.moveChoice(1));
    scene.input.keyboard.on('keydown-ENTER', (event) => {
      if (!event.repeat && this.choices) this.confirmChoice();
    });
  }

  // `speaker` may be null/empty for a narration-style box with no name tag (the cutscene player,
  // src/scenes/cutscene.js, reuses this exact class for its message box). `choices`, if given, is
  // shown once `lines` are done; `onClose(choice)` fires when the whole thing closes -- `choice` is
  // the picked option, or undefined for a plain (choice-less) conversation.
  open(speaker, lines, onClose, choices = null) {
    const { x, y } = this.box;
    this.lines = lines;
    this.index = 0;
    this.onClose = onClose;
    this.pendingChoices = choices;
    this.choices = null;
    this.selectedChoice = null;
    this.isOpen = true;

    this.nameTag.clear();
    if (speaker) {
      this.name.setText(speaker);
      drawPanel(this.nameTag, x + 16, y - 24, speaker.length * 16 + 36, 40);
    }
    this.parts.forEach((part) => part.setVisible(true));
    this.name.setVisible(Boolean(speaker));

    // A choices-only entry (a question with no lead-in line) skips straight to the list.
    if (this.lines.length === 0 && this.pendingChoices) this.showChoices();
    else this.startLine();
  }

  startLine() {
    // Wrap up front so words don't jump to the next line halfway through typing.
    this.fullText = this.body.getWrappedText(this.lines[this.index]).join('\n');
    this.shown = 0;
    this.typing = true;
    this.body.setText('');
  }

  // Called when the player presses E/Space: pick the highlighted choice, finish the line being
  // typed, or go to the next one (or the choice list, if this was the last line).
  advance() {
    if (this.choices) {
      this.confirmChoice();
      return;
    }
    if (this.typing) {
      this.shown = this.fullText.length;
      return;
    }
    this.index++;
    if (this.index < this.lines.length) this.startLine();
    else if (this.pendingChoices) this.showChoices();
    else this.close();
  }

  // Replaces the body text with a selectable list. `this.choices` being non-null is what tells
  // advance()/moveChoice() we're in "picking" mode instead of "reading" mode.
  showChoices() {
    this.choices = this.pendingChoices;
    this.pendingChoices = null;
    this.choiceIndex = 0;
    this.typing = false;
    this.body.setText('');
    this.buildChoiceTexts();
  }

  buildChoiceTexts() {
    this.destroyChoiceTexts();
    const { x, y } = this.box;
    this.choiceTexts = this.choices.map((choice, i) => uiText(this.scene, x + 30, y + 30 + i * 26, choice.text, 16).setDepth(51));
    this.refreshChoiceHighlight();
  }

  refreshChoiceHighlight() {
    this.choiceTexts.forEach((text, i) => {
      const current = i === this.choiceIndex;
      text.setText(`${current ? '>' : ' '} ${this.choices[i].text}`).setColor(current ? COLORS.highlight : COLORS.text);
    });
  }

  destroyChoiceTexts() {
    (this.choiceTexts || []).forEach((text) => text.destroy());
    this.choiceTexts = null;
  }

  moveChoice(direction) {
    if (!this.isOpen || !this.choices) return;
    this.choiceIndex = (this.choiceIndex + direction + this.choices.length) % this.choices.length;
    this.refreshChoiceHighlight();
  }

  // The chosen option's own `lines` (if any) play out like a normal line sequence; once they finish,
  // advance() finds no more lines and no pending choices left, so it closes as usual.
  confirmChoice() {
    const choice = this.choices[this.choiceIndex];
    this.choices = null;
    this.destroyChoiceTexts();
    this.selectedChoice = choice;
    if (choice.lines && choice.lines.length) {
      this.lines = choice.lines;
      this.index = 0;
      this.startLine();
    } else {
      this.close();
    }
  }

  close() {
    this.isOpen = false;
    this.destroyChoiceTexts();
    this.choices = null;
    this.pendingChoices = null;
    this.parts.forEach((part) => part.setVisible(false));
    const callback = this.onClose;
    const choice = this.selectedChoice;
    this.onClose = null;
    this.selectedChoice = null;
    if (callback) callback(choice);
  }

  update(time, delta) {
    if (!this.isOpen) return;
    if (this.choices) {
      this.arrow.setVisible(false); // no "next line" arrow while picking
      return;
    }
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

// ---------- controls panel: reused by the pause menu here and by the title screen ----------
// FB-0023: replaces the old full-screen "controls card" that blocked the game at boot and
// overflowed its own box (feedback/screenshots/FB-0023.jpg). Nothing about this panel is
// hard-coded to a fixed height: it measures its own row count and sizes the box to fit, so it
// cannot overflow regardless of how many rows DEV_MODE adds (docs/GAME_FEEL.md "no fixed sleeps for
// outcomes" sibling rule for layout: never guess a size, measure it).

const CONTROLS = [
  ['WASD / ARROWS', 'Move'],
  ['SHIFT', 'Run'],
  ['E / SPACE', 'Talk, next line'],
  ['1-5 / WHEEL', 'Choose item slot'],
  ['M', 'Show/hide minimap'],
  ['N / CLICK MAP', 'Full-screen map'],
  ['ESC', 'Pause'],
];

class ControlsPanel {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    const rows = typeof DEV_MODE !== 'undefined' && DEV_MODE ? [...CONTROLS, ['O', 'Give feedback (dev)']] : CONTROLS;
    this.rows = rows;

    const w = 480;
    const rowH = 26;
    const headerH = 74; // title + top margin
    const footerH = 36; // "ESC / ENTER TO CLOSE" + bottom margin
    const h = headerH + rows.length * rowH + footerH;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);
    this.box = { x, y, w, h };

    this.dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0);
    this.panel = scene.add.graphics();
    drawPanel(this.panel, x, y, w, h);
    this.title = uiText(scene, x + w / 2, y + 30, 'CONTROLS', 16, COLORS.highlight).setOrigin(0.5);
    this.rowTexts = rows.flatMap(([key, action], i) => {
      const rowY = y + headerH + i * rowH;
      return [
        uiText(scene, x + 32, rowY, key, 8, COLORS.highlight),
        uiText(scene, x + 232, rowY, action, 8, COLORS.text),
      ];
    });
    this.footer = uiText(scene, x + w / 2, y + h - 22, 'ESC / ENTER TO CLOSE', 8, COLORS.dim).setOrigin(0.5);
    this.parts = [this.dim, this.panel, this.title, ...this.rowTexts, this.footer];
    this.parts.forEach((part) => part.setDepth(115).setVisible(false));
  }

  open() {
    this.visible = true;
    this.parts.forEach((part) => part.setVisible(true));
  }

  close() {
    this.visible = false;
    this.parts.forEach((part) => part.setVisible(false));
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }
}

// ---------- pause menu (Esc): Resume / Controls / Save / Quit to title ----------

const PAUSE_ITEMS = [
  { id: 'resume', label: 'Resume' },
  { id: 'controls', label: 'Controls' },
  { id: 'save', label: 'Save' },
  { id: 'quit', label: 'Quit to Title' },
];

class PauseMenu {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.view = 'menu'; // 'menu' | 'controls'
    this.index = 0;

    const w = 300;
    const rowH = 32;
    const h = 70 + PAUSE_ITEMS.length * rowH + 20;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);
    this.box = { x, y, w, h };

    this.dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0);
    this.panel = scene.add.graphics();
    drawPanel(this.panel, x, y, w, h);
    this.title = uiText(scene, x + w / 2, y + 32, 'PAUSED', 16, COLORS.highlight).setOrigin(0.5);
    this.itemTexts = PAUSE_ITEMS.map((item, i) => {
      const text = uiText(scene, x + 40, y + 66 + i * rowH, item.label, 12, COLORS.text);
      text.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { this.index = i; this.refresh(); })
        .on('pointerdown', () => { this.index = i; this.confirm(); });
      return text;
    });
    this.parts = [this.dim, this.panel, this.title, ...this.itemTexts];
    this.parts.forEach((part) => part.setDepth(110).setVisible(false));

    this.controls = new ControlsPanel(scene);

    for (const key of ['UP', 'W']) scene.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.visible && this.view === 'menu') this.move(-1); });
    for (const key of ['DOWN', 'S']) scene.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.visible && this.view === 'menu') this.move(1); });
    for (const key of ['ENTER', 'SPACE']) {
      scene.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.visible) this.confirm(); });
    }
  }

  open() {
    this.visible = true;
    this.view = 'menu';
    this.index = 0;
    this.parts.forEach((part) => part.setVisible(true));
    this.refresh();
  }

  close() {
    this.visible = false;
    this.view = 'menu';
    this.controls.close();
    this.parts.forEach((part) => part.setVisible(false));
  }

  move(direction) {
    this.index = (this.index + direction + PAUSE_ITEMS.length) % PAUSE_ITEMS.length;
    this.refresh();
  }

  refresh() {
    this.itemTexts.forEach((text, i) => {
      const current = i === this.index;
      text.setText(`${current ? '> ' : '  '}${PAUSE_ITEMS[i].label}`).setColor(current ? COLORS.highlight : COLORS.text);
    });
  }

  confirm() {
    if (this.view === 'controls') {
      this.backToMenu();
      return;
    }
    const item = PAUSE_ITEMS[this.index];
    if (item.id === 'resume') this.close();
    else if (item.id === 'controls') this.showControls();
    else if (item.id === 'save') this.doSave();
    else if (item.id === 'quit') this.quitToTitle();
  }

  showControls() {
    this.view = 'controls';
    this.parts.forEach((part) => part.setVisible(false));
    this.controls.open();
  }

  backToMenu() {
    this.view = 'menu';
    this.controls.close();
    this.parts.forEach((part) => part.setVisible(true));
  }

  doSave() {
    if (typeof saveEnabled === 'function' && !saveEnabled()) {
      this.scene.toast.show('Saving is off (?save=0)');
      return;
    }
    saveGame(currentProfile());
    this.scene.toast.show('Game saved!');
  }

  quitToTitle() {
    this.close();
    const sceneManager = this.scene.scene;
    sceneManager.stop('world');
    sceneManager.stop('ui');
    if (sceneManager.isActive('cutscene')) sceneManager.stop('cutscene');
    sceneManager.start('title');
  }

  // Delegated from UIScene's own Esc handler (fullMap already took priority there).
  onEscape() {
    if (!this.visible) this.open();
    else if (this.view === 'controls') this.backToMenu();
    else this.close();
  }
}

// ---------- in-fiction hints: shown once each, when they first matter (FB-0023/0024) ----------
// Replaces the old "read a card of every control before you can move" onboarding. Each hint is
// queued by an event from world.js the moment it becomes relevant and shown at most once ever
// (GameState.seenHints, saved like everything else) -- see docs/GAME_FEEL.md.

const HINTS = {
  move: 'WASD / ARROWS TO MOVE',
  talk: 'PRESS E TO TALK',
  run: 'HOLD SHIFT TO RUN',
  map: 'PRESS M FOR THE MAP',
};
const HINT_Y = 64; // below the location banner (y 12-52), clear of the tutorial checklist (x >= 644)
const HINT_W = 320; // 320..640 horizontally: stays clear of the checklist panel at x >= 644
const HINT_H = 36;
const HINT_FADE_MS = 300;
const HINT_HOLD_MS = 2600;

class HintBanner {
  constructor(scene) {
    this.scene = scene;
    this.queue = [];
    this.showing = null;
    const x = Math.round((GAME_WIDTH - HINT_W) / 2);
    this.panel = scene.add.graphics().setDepth(70);
    drawPanel(this.panel, x, HINT_Y, HINT_W, HINT_H);
    this.text = uiText(scene, GAME_WIDTH / 2, HINT_Y + HINT_H / 2, '', 12, COLORS.highlight).setOrigin(0.5).setDepth(71);
    this.parts = [this.panel, this.text];
    this.parts.forEach((part) => part.setAlpha(0));
  }

  // Called for every hint id, every time it could apply (world.js doesn't bother checking "have I
  // shown this before" itself); a no-op once GameState.seenHints already has it.
  trigger(id) {
    if (!HINTS[id] || GameState.seenHints.has(id)) return;
    GameState.seenHints.add(id);
    notifyStateChanged(); // src/save.js autosaves soon after, so a reload never re-shows it
    this.queue.push(id);
    this.pump();
  }

  pump() {
    if (this.showing || !this.queue.length) return;
    this.showing = this.queue.shift();
    this.text.setText(HINTS[this.showing]);
    this.scene.tweens.add({ targets: this.parts, alpha: 1, duration: HINT_FADE_MS });
    this.scene.time.delayedCall(HINT_FADE_MS + HINT_HOLD_MS, () => {
      this.scene.tweens.add({
        targets: this.parts, alpha: 0, duration: HINT_FADE_MS,
        onComplete: () => { this.showing = null; this.pump(); },
      });
    });
  }
}

// ---------- tutorial: an objectives checklist for maps that define one (the meadow test map) ----------
// FB-0023: used to also gate movement behind a blocking "press enter to start" card; that's gone
// (see ControlsPanel/HintBanner above and docs/GAME_FEEL.md) -- this class is just the checklist now.

const TUTORIAL_STEPS = [
  { id: 'move', text: 'Walk around' },
  { id: 'pickup', text: 'Pick up an item' },
  { id: 'select', text: 'Pick a slot (1-5)' },
  { id: 'enter', text: 'Go inside the house' },
  { id: 'talk', text: 'Talk to Tomas (E)' },
];

class Tutorial {
  constructor(scene) {
    this.scene = scene;
    // No blocking intro anymore: a map that defines one starts straight in its checklist, anything
    // else is simply "done" (nothing to track) from the very first frame.
    this.stage = MAPS[initialMapKey()].tutorial ? 'steps' : 'done';
    this.completed = new Set();
    this.walked = 0;
    this.buildChecklist();
    if (this.stage === 'steps') this.checklist.setVisible(true);

    // Named so teardown() can undo them -- `scene.game.events` and GameState.inventory are both
    // persistent singletons that outlive this scene, see ui.js's file-header comment.
    this.events = scene.game.events;
    this.onPlayerMoved = (distance) => {
      this.walked += distance;
      if (this.walked > 64) this.complete('move');
    };
    this.onMapEntered = (world) => world.mapKey === 'house' && this.complete('enter');
    this.onNpcTalked = (id) => id === 'tomas' && this.complete('talk');
    this.onAdded = () => this.complete('pickup');
    this.onSelected = () => this.complete('select');
    this.events.on('player-moved', this.onPlayerMoved);
    this.events.on('map-entered', this.onMapEntered);
    this.events.on('npc-talked', this.onNpcTalked);
    GameState.inventory.on('added', this.onAdded);
    GameState.inventory.on('selected', this.onSelected);
  }

  teardown() {
    this.events.off('player-moved', this.onPlayerMoved);
    this.events.off('map-entered', this.onMapEntered);
    this.events.off('npc-talked', this.onNpcTalked);
    GameState.inventory.off('added', this.onAdded);
    GameState.inventory.off('selected', this.onSelected);
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
    const footer = uiText(scene, x + 18, y + h - 26, 'ESC: pause', 8, COLORS.dim);

    this.checklistParts = [panel, title, footer, ...this.stepTexts];
    this.checklist = scene.add.container(0, 0, this.checklistParts).setVisible(false);
    this.refreshChecklist();
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
}
