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

// Shrinks a text object's own font size (then, only as a last resort, truncates with an ellipsis)
// until it fits `maxWidth` -- for a label that lives in a *fixed*-size box, where GAME_FEEL.md rule 1
// ("size the box to its content") doesn't apply because the box's whole point is staying a constant
// size (the minimap's own tucked-in caption, the quest tracker's collapsed pill below) rather than
// growing with whatever text a map/story ends up needing.
function fitTextInWidth(text, str, maxWidth, minSize = 5, startSize = 8) {
  let size = startSize;
  text.setFontSize(size).setText(str);
  while (text.width > maxWidth && size > minSize) {
    size -= 1;
    text.setFontSize(size);
  }
  let shown = str;
  while (text.width > maxWidth && shown.length > 1) {
    shown = shown.slice(0, -1);
    text.setText(`${shown}…`);
  }
}

// ---------- the one UI kit (docs/GAME_FEEL.md "one UI kit"): a real 9-slice frame ----------
// tools/make-assets.js generates assets/ui-panel.png: 4 96x96 frames stacked vertically (the shared
// panel look, then the button's own normal/hover/pressed states), recolored from the Kenney Pixel UI
// Pack's own 9-slice frame onto this game's navy/cream/gold palette -- see that file's own "UI kit"
// section for exactly which pack pixels map to which color, and why. UI_FRAME_SIZE and UI_FRAME_BORDER
// have to match the same constants there: the frame size is the whole 48-pixel pack frame at 2x (FB-0073:
// it used to be a 45-pixel crop that dropped the right border and the bottom edge of every panel), and the
// border is the fixed corner/edge inset every NineSlice below is built with, so the border reads as a
// crisp, constant width on ALL FOUR sides no matter how big a particular panel/button is
// (tests/unit/ui-frame.test.js pins both numbers against the generated PNG).
const UI_FRAME_TEXTURE = 'ui-panel';
const UI_FRAME_SIZE = 96;
const UI_FRAME_BORDER = 4;
const UI_FRAME = { panel: 0, buttonNormal: 1, buttonHover: 2, buttonPressed: 3 };
const UI_ICON_TEXTURE = 'ui-icons';
const UI_ICON = { cursor: 0, nextArrow: 1 };

// Registers the UI kit's own two textures with `scene`'s loader -- call this from the preload() of
// any scene that could possibly be the *first* one this session to build a panel/button/DialogBox
// (the title screen, every scene in the M3a opening chain, the card-only "watch again" path that
// bypasses boot entirely); every scene only ever reached *after* one of those (world/ui, mini-games,
// the box opening) can rely on the texture already being loaded, the same guarded/idempotent "load it
// again anywhere it might be needed first" pattern this codebase's other preload() calls already use
// for `mustafa-portrait`/`title-fg`/etc. (`this.textures.exists` first, so a second load is a no-op).
function preloadUiKit(scene) {
  if (!scene.textures.exists(UI_FRAME_TEXTURE)) {
    scene.load.spritesheet(UI_FRAME_TEXTURE, 'assets/ui-panel.png', { frameWidth: UI_FRAME_SIZE, frameHeight: UI_FRAME_SIZE });
  }
  if (!scene.textures.exists(UI_ICON_TEXTURE)) {
    scene.load.spritesheet(UI_ICON_TEXTURE, 'assets/ui-icons.png', { frameWidth: TILE, frameHeight: TILE });
  }
}

// One panel: this game's own long-standing soft offset drop shadow (a plain rect, STYLE_GUIDE "Drop
// shadows" -- black, offset down-right, unchanged from before this pass) behind a real 9-slice frame
// (the recolored Kenney pack border above) instead of a hand-drawn rectangle. Returned as a Container
// so every existing caller's "one GameObject in my `parts` array" pattern (`setVisible()`,
// `setDepth()`, `setAlpha()`, `destroy()` -- all cascading to both children automatically, standard
// Container behavior) keeps working without any layout code changing, per the brief. Callers that
// need to resize a panel in place (its content changed, e.g. QuestTracker/JournalPanel below) use the
// returned container's own `setPanelSize(w, h)` instead of clearing and redrawing.
function makePanel(scene, x, y, w, h, frame = UI_FRAME.panel) {
  const shadow = scene.add.graphics();
  shadow.fillStyle(0x000000, 0.35).fillRect(4, 4, w, h);
  const nine = scene.add.nineslice(0, 0, UI_FRAME_TEXTURE, frame, w, h, UI_FRAME_BORDER, UI_FRAME_BORDER, UI_FRAME_BORDER, UI_FRAME_BORDER).setOrigin(0, 0);
  const container = scene.add.container(x, y, [shadow, nine]);
  container.setPanelSize = (nw, nh) => {
    shadow.clear().fillStyle(0x000000, 0.35).fillRect(4, 4, nw, nh);
    nine.setSize(nw, nh);
  };
  return container;
}

// A cursor/selection arrow -- the small gold triangle every keyboard-driven list in the game now uses
// instead of a plain "> " text prefix (the pause menu, the shared Controls/Sound panel's rows, dialog
// choices, the journal's own scrollable list doesn't need one). `setOrigin(0, 0.5)` so callers place
// it by its own left-center point, the same spot a "> " prefix used to start from.
function makeCursor(scene, x, y) {
  return scene.add.image(x, y, UI_ICON_TEXTURE, UI_ICON.cursor).setOrigin(0, 0.5);
}

// ---------- big drawn button (M3a title screen redesign, docs/GAME_FEEL.md "a little 3D") ----------
// A whole button: the UI kit's own 9-slice frame (normal/hover/pressed, swapped by frame index instead
// of redrawn -- see UI_FRAME above), a centered label, its own small drop shadow, and a Zone for mouse
// input. Keyboard focus is driven externally (whoever owns a row of these -- title.js's menu, the
// customisation screen's swatches -- moves `focused` with arrow keys, same as every other
// keyboard-driven list in this game); mouse hover/press are handled here directly. Both input paths
// funnel into the same redraw() so a keyboard-selected button and a mouse-hovered one look identical
// (docs/GAME_FEEL.md rule 7: mouse is always an addition, never a different experience).
class Button {
  constructor(scene, x, y, w, h, label, onConfirm) {
    this.scene = scene;
    this.box = { x, y, w, h };
    this.hovered = false;
    this.focused = false;
    this.pressedVisual = false;
    this.shadow = scene.add.graphics();
    this.nine = scene.add.nineslice(x, y, UI_FRAME_TEXTURE, UI_FRAME.buttonNormal, w, h, UI_FRAME_BORDER, UI_FRAME_BORDER, UI_FRAME_BORDER, UI_FRAME_BORDER).setOrigin(0, 0);
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
    const lift = state === 'pressed' ? 2 : 0; // a pressed button sinks toward its own shadow
    const frame = state === 'pressed' ? UI_FRAME.buttonPressed : state === 'hover' ? UI_FRAME.buttonHover : UI_FRAME.buttonNormal;
    const { x, y, w, h } = this.box;
    this.shadow.clear().fillStyle(0x000000, state === 'pressed' ? 0.25 : 0.4).fillRect(x + 3, y + 6, w, h);
    this.nine.setFrame(frame).setPosition(x, y + lift);
    this.text.setPosition(x + w / 2, y + lift + h / 2).setColor(state === 'hover' ? COLORS.highlight : COLORS.text);
  }

  setVisible(visible) {
    this.shadow.setVisible(visible);
    this.nine.setVisible(visible);
    this.text.setVisible(visible);
    if (visible) this.zone.setInteractive();
    else this.zone.disableInteractive();
  }

  destroy() {
    this.shadow.destroy();
    this.nine.destroy();
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
    // The LUG treasure hunt (docs/STORY.md, M3 / M1's "quest tracker" + "journal (J)" leftovers):
    // a small always-on objective panel, top-right (the same corner the tutorial checklist uses --
    // never shown together in practice, since the checklist only exists on the meadow test map, see
    // Tutorial's own `stage` above), and a J-toggled journal of the clues she's collected so far.
    this.questTracker = new QuestTracker(this);
    this.journal = new JournalPanel(this);
    // ADR 0016 / FB-0033: the letterbox bars a script's own `letterbox` step slides in/out, and the
    // always-on destination arrow (Minimap/FullMap get the same marker in their own update() below).
    this.letterbox = new Letterbox(this);
    this.onboarding = new Onboarding(this);

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
    // Quest/journal data lives on GameState.quest/GameState.journal (src/dialog.js actions), so the
    // tracker just re-reads it whenever anything changes -- the same event save.js's autosave uses.
    this.onQuestStateChanged = () => this.questTracker.refresh();
    // A dialog `{ cutscene: 'key' }` action (src/dialog.js) fires this; handled here (a persistent
    // scene, at least across ordinary map changes) rather than in world.js itself, so it always
    // reaches whichever WorldScene instance is current even if a map change happened in between.
    this.onCutsceneRequested = (key) => {
      const world = this.scene.get('world');
      if (!world.sys.isActive() || world.transitioning) return;
      // ADR 0016: new content plays as an in-world script; CUTSCENES (the old letterboxed-illustration
      // player, src/scenes/cutscene.js) is only reached by a key that predates this ADR and was never
      // migrated -- none ships with this game anymore, but the fallback costs nothing to keep.
      if (SCRIPTS[key]) { world.playScript(key, SCRIPTS[key]); return; }
      if (!CUTSCENES[key]) { console.warn(`dialog action requested unknown cutscene "${key}"`); return; }
      world.playCutscene(key);
    };
    // A dialog `{ minigame: 'id' }` action (src/dialog.js) fires this; handled here for the same
    // reason as cutscenes above (a persistent scene, always reaching whichever WorldScene instance is
    // current). `?minigames=0` (tests/e2e/helpers.js, src/maplogic.js minigamesEnabled()) bypasses the
    // real mini-game scene entirely and resolves straight to 'won', so most specs (the quest, saves,
    // dialog...) don't need to actually play one headlessly just to see a key change hands.
    this.onMinigameRequested = (payload) => {
      if (!minigamesEnabled()) { payload.onResult('won'); return; }
      const def = MINIGAMES[payload.id];
      const world = this.scene.get('world');
      if (!def) { console.warn(`dialog action requested unknown mini-game "${payload.id}"`); payload.onResult('quit'); return; }
      if (!world.sys.isActive() || world.transitioning) { payload.onResult('quit'); return; }
      world.launchMinigame(payload.id, payload.onResult);
    };
    // A dialog `{ boxOpening: true }` action (src/dialog.js) fires this; handled here for the same
    // reason as cutscenes/mini-games above (docs/STORY.md "the box opens...").
    this.onBoxOpeningRequested = () => {
      const world = this.scene.get('world');
      if (world.sys.isActive() && !world.transitioning) world.playBoxOpening();
    };
    // A dialog `{ warp: { to, spawnAt } }` action (src/dialog.js) fires this: the lift's floor choice (P4b). Handled here for the same
    // reason as the three above (a persistent scene, always reaching whichever WorldScene instance is current).
    this.onWarpRequested = (payload) => {
      const world = this.scene.get('world');
      if (world.sys.isActive() && !world.transitioning) world.warpTo(payload);
    };
    this.game.events.on('map-entered', this.onMapEntered);
    this.game.events.on('area-entered', this.onAreaEntered);
    this.game.events.on('toast', this.onToast);
    this.game.events.on('hint', this.onHint);
    this.game.events.on('state-changed', this.onQuestStateChanged);
    this.game.events.on('cutscene:requested', this.onCutsceneRequested);
    this.game.events.on('minigame:requested', this.onMinigameRequested);
    this.game.events.on('box-opening:requested', this.onBoxOpeningRequested);
    this.game.events.on('warp:requested', this.onWarpRequested);
    this.events.once('shutdown', () => this.teardown());

    const world = this.scene.get('world');
    if (world.tileData) this.minimap.setMap(world);

    // One-shot keys use keydown events; polling JustDown loses taps shorter than a frame (ERR-0001).
    // FB-0035: every one of these is also gated on worldHasControl() (below) -- while a cutscene, a
    // mini-game or a warp's black-screen fade owns the screen, this scene must not react to a key it
    // would otherwise handle. Without this, Esc skipping a cutscene (or quitting a mini-game) also
    // opened the pause menu underneath it, and J could open the journal behind a running mini-game --
    // both scenes hear the same native keydown, and 'world' being paused/mid-fade is exactly the
    // signal that this scene shouldn't act on it right now.
    this.input.keyboard.on('keydown-M', (event) => {
      if (!event.repeat && this.worldHasControl()) this.minimap.toggle();
    });
    this.input.keyboard.on('keydown-N', (event) => {
      if (!event.repeat && this.worldHasControl()) this.toggleFullMap();
    });
    // J: the journal (M1 leftover, docs/STORY.md). Like the full-screen map, it only *opens* from a
    // clean state (not mid-dialog/pause/fullmap -- GAME_FEEL.md rule 6, a modal never opens over
    // another modal), but always closes, so J can't get "stuck".
    this.input.keyboard.on('keydown-J', (event) => {
      if (event.repeat || !this.worldHasControl()) return;
      if (this.journal.visible) this.journal.close();
      else if (!this.dialog.isOpen && !this.pause.visible && !this.fullMap.visible) this.journal.open();
    });
    // Esc: closing the full-screen map always wins (it has its own long-standing meaning), then the
    // journal, then the pause menu owns Esc the rest of the time -- opening it, or backing out of its
    // Controls page, or closing it again (docs/GAME_FEEL.md). Not while a conversation owns the screen.
    this.input.keyboard.on('keydown-ESC', (event) => {
      if (event.repeat || !this.worldHasControl()) return;
      if (this.fullMap.visible) this.fullMap.close();
      else if (this.journal.visible) this.journal.close();
      else if (!this.dialog.isOpen) this.pause.onEscape();
    });
  }

  // FB-0035: true only while the 'world' scene actually owns the screen -- running (not paused for a
  // cutscene/mini-game, see src/scenes/world.js launchMinigame()/playCutscene()/playBoxOpening(), all
  // of which pause 'world' the same way) and not mid-warp-fade (`world.transitioning`, set the instant
  // a door/stairs trigger fires and cleared only once the new map has finished loading). Every
  // UIScene key/wheel handler that shouldn't fire while something else owns the screen (Esc, M, N, J,
  // the hotbar's number keys/wheel) checks this first. Read fresh on every keypress (never cached),
  // so a handler in this same scene never sees a stale answer -- including the moment a cutscene/
  // mini-game's *own* Esc handler already resolved in this exact keydown (ERR-0001-adjacent: both
  // scenes hear the same native event, but resuming 'world' is always deferred behind that scene's own
  // fade-out, so it can't already be active again within the same synchronous dispatch).
  worldHasControl() {
    const world = this.scene.get('world');
    return Boolean(world && world.sys.isActive() && !world.transitioning);
  }

  // Quality-loop category 4 run 1, bug 2: called by Letterbox (playIn/playOut/snap) so the always-on
  // HUD (minimap, quest tracker, hotbar) gets out of the way of an in-world script and comes back once
  // it ends -- `instant` (the Esc-skip path) lands in the right state with no animation.
  setHudScriptHidden(hidden, instant = false) {
    this.minimap.setScriptHidden(hidden, instant);
    this.questTracker.setScriptHidden(hidden, instant);
    this.hotbar.setScriptHidden(hidden, instant);
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
    this.game.events.off('state-changed', this.onQuestStateChanged);
    this.game.events.off('cutscene:requested', this.onCutsceneRequested);
    this.game.events.off('minigame:requested', this.onMinigameRequested);
    this.game.events.off('box-opening:requested', this.onBoxOpeningRequested);
    this.game.events.off('warp:requested', this.onWarpRequested);
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
    return this.dialog.isOpen || this.fullMap.visible || this.pause.visible || this.journal.visible;
  }

  update(time, delta) {
    this.dialog.update(time, delta);
    // D16 (defect sweep 2026-10-04): the hotbar also hides while the pause menu / Controls panel is open (their panel is
    // translucent and the slots used to show through and over its bottom edge); it comes back when the pause menu closes.
    this.hotbar.setVisible(hotbarShouldShow({ dialogOpen: this.dialog.isOpen, pauseOpen: this.pause.visible }));
    if (this.fullMap.visible) this.fullMap.update(time);
    // Quality-loop category 4 run 1, bug 1: a hint queued (or already showing) while a dialog opens or
    // a script starts holds/hides itself here every frame -- see HintBanner.tick() below.
    this.hints.tick();

    const world = this.scene.get('world');
    if (world.player && world.player.active && world.tileData) this.minimap.update(world, time);
    if (world.player && world.player.active) this.hotbar.updateOverlap(world);
    // FB-0033: the destination arrow only while she actually has control (not mid-dialog/pause/map,
    // and not mid-script -- a script's own camera pan already shows her where things are).
    if (world.player && world.player.active && !this.isBlocking() && !world.transitioning) {
      this.onboarding.update(world, time);
    } else {
      this.onboarding.arrow.setVisible(false);
    }
  }
}

// ---------- minimap (top left) ----------

class Minimap {
  // HUD declutter pass (docs/GAME_FEEL.md rule 2): box/area come from hudLayout(), the same numbers a
  // unit test checks for overlap -- `x`/`y` are still accepted so UIScene's own call site doesn't need
  // to change, but they're expected to match hudLayout's own top-left-anchored minimap box.
  constructor(scene, x, y) {
    const layout = hudLayout(GAME_WIDTH, GAME_HEIGHT);
    this.width = layout.minimap.w;
    this.height = layout.minimap.h;
    this.area = layout.minimapArea;

    this.scene = scene;
    const panel = makePanel(scene, x, y, this.width, this.height);
    const backdrop = scene.add.rectangle(this.area.x, this.area.y, this.area.w, this.area.h, 0x0b0c12).setOrigin(0, 0);
    this.image = scene.add.image(this.area.x, this.area.y, '__DEFAULT').setOrigin(0, 0).setVisible(false);
    this.markers = scene.add.graphics();
    // The caption is tucked inside the bottom of the map area itself (a thin translucent strip), not
    // a separate row reserved below it -- see maplogic.js hudLayout()'s own comment on minimapArea.
    const captionH = 14;
    const captionY = this.area.y + this.area.h - captionH;
    this.captionStrip = scene.add.rectangle(this.area.x, captionY, this.area.w, captionH, 0x000000, 0.55).setOrigin(0, 0);
    this.label = uiText(scene, this.area.x + 4, captionY + captionH / 2, '', 6).setOrigin(0, 0.5);
    const hint = uiText(scene, this.area.x + this.area.w - 4, captionY + captionH / 2, 'M', 6, COLORS.dim).setOrigin(1, 0.5);
    this.parts = [panel, backdrop, this.image, this.markers, this.captionStrip, this.label, hint];
    this.visible = true;
    this.scriptHidden = false; // quality-loop category 4 run 1, bug 2: faded out while a script runs
    this.bannerShowing = false; // quality-loop category 4 run 2: faded out while the banner slides in/holds/out
    this.onClick = null; // FB-0018: set by UIScene to open the full-screen map

    scene.add.zone(this.area.x, this.area.y, this.area.w, this.area.h).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.visible && this.onClick && this.onClick());
  }

  // Called by UIScene.setHudScriptHidden() (Letterbox playIn/playOut/snap) -- alpha only, independent
  // of the M-key `visible` toggle above (both apply; either one hides it).
  setScriptHidden(hidden, instant = false) {
    this.scriptHidden = hidden;
    this.applyHiddenState(instant);
  }

  // Called by LocationBanner.show() -- the banner now shares this same top-left corner (Pokemon-style,
  // quality-loop category 4 run 2), so the minimap gets out of its way for as long as it's on screen
  // instead of the two competing for the same spot. Always tweened (never instant): unlike a script
  // interrupt, there's no skip path to land in mid-transition.
  setBannerShowing(showing) {
    this.bannerShowing = showing;
    this.applyHiddenState(false);
  }

  // Combines both alpha-hiding reasons above (either one hides it) -- `this.visible`'s own hard
  // setVisible() toggle (the M key) is independent of both and stacks on top the same way it already
  // did with scriptHidden.
  applyHiddenState(instant) {
    fadeParts(this.scene, this.parts, !(this.scriptHidden || this.bannerShowing), instant);
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

  // The caption (e.g. "MECHANICAL BLOCK - GROUND FLOOR") must never run past its own tucked-in strip
  // (QA P5) -- now a much tighter fit than the old wider panel, so fitTextInWidth() (shared with
  // QuestTracker's own pill below) does the same "shrink, then truncate" job at a smaller max size.
  setLabel(text) {
    const maxWidth = this.area.w - 8 - 12; // clear of the strip's own left inset and the "M" hint
    fitTextInWidth(this.label, text, maxWidth, 4, 6);
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
    for (const ks of world.keyStations || []) if (!ks.taken) dot(mx(ks.x), my(ks.y), 3);
    g.fillStyle(0x7fe0ff, 1);
    for (const npc of world.npcs) dot(mx(npc.x), my(npc.y), 4);

    // FB-0033: the same destination the on-screen arrow points to (world.js currentObjectiveAnchor()),
    // a pulsing gold ring so it reads as "go here" rather than just another dot.
    const target = world.currentObjectiveAnchor ? world.currentObjectiveAnchor() : null;
    if (target) {
      const tx = mx(target.x * TILE + TILE / 2);
      const ty = my(target.y * TILE + TILE / 2);
      if (tx >= this.offsetX && ty >= this.offsetY && tx < right && ty < bottom) {
        g.lineStyle(2, COLORS.gold, 1).strokeCircle(tx, ty, 4 + Math.abs(Math.sin(time / 200)) * 3);
      }
    }

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
  // Quality-loop category 4 run 2: moved from a top-center bar (which sat directly over the Main
  // Block's own entrance sign in the campus backdrop) to a small top-left plate, Pokemon-style --
  // sliding in from the *left* edge now, not down from the top, into the same corner the minimap
  // occupies (hudLayout()'s own `banner`/`minimap` share an x/y on purpose -- see hud-layout.test.js).
  // The minimap hides for as long as this is on screen (setBannerShowing() below) rather than the two
  // fighting for the same corner.
  constructor(scene) {
    this.scene = scene;
    const layout = hudLayout(GAME_WIDTH, GAME_HEIGHT);
    const { w, h } = layout.banner;
    this.w = w;
    this.hiddenX = -w - 8;
    this.shownX = layout.banner.x;

    const panel = makePanel(scene, 0, 0, w, h);
    this.text = uiText(scene, w / 2, h / 2, '', 10, COLORS.text).setOrigin(0.5);
    this.container = scene.add.container(this.hiddenX, layout.banner.y, [panel, this.text]).setDepth(80);
    this.hideTimer = null;
    this.visible = false; // true from show() until the slide-out finishes (tests read this directly)
  }

  show(name) {
    // A narrower box (declutter pass) means a long map name needs the same "shrink, then truncate"
    // guarantee the minimap's own caption uses, instead of assuming every real name already fits.
    fitTextInWidth(this.text, name.toUpperCase(), this.w - 24, 6, 10);
    this.visible = true;
    this.scene.minimap.setBannerShowing(true);
    this.scene.tweens.killTweensOf(this.container);
    if (this.hideTimer) this.hideTimer.remove();
    this.scene.tweens.add({ targets: this.container, x: this.shownX, duration: BANNER_SLIDE_MS, ease: 'Cubic.easeOut' });
    this.hideTimer = this.scene.time.delayedCall(BANNER_SLIDE_MS + BANNER_HOLD_MS, () => {
      this.scene.tweens.add({
        targets: this.container, x: this.hiddenX, duration: BANNER_SLIDE_MS, ease: 'Cubic.easeIn',
        onComplete: () => { this.visible = false; this.scene.minimap.setBannerShowing(false); },
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
    // D01 (2026-10-04): the candidates and the layout come from maplogic.js (fullMapLabelCandidates / placeMapLabels, unit
    // tested): story-relevant names first, every label clamped inside the map image (and clear of the title and the close
    // hint), and a label that would overprint one already placed is skipped.
    const frame = {
      x0: Math.max(8, this.offsetX),
      y0: Math.max(40, this.offsetY),
      x1: Math.min(GAME_WIDTH - 8, this.offsetX + cols * this.scale),
      y1: Math.min(GAME_HEIGHT - 34, this.offsetY + rows * this.scale),
    };
    const candidates = fullMapLabelCandidates(world.mapObjects, cols, rows).map((c) => ({
      ...c, px: this.offsetX + c.x * this.scale, py: this.offsetY + c.y * this.scale,
    }));
    for (const label of placeMapLabels(candidates, frame)) {
      this.labels.add(uiText(this.scene, label.x, label.y, label.text, 8, COLORS.text).setOrigin(0.5).setStroke('#1a1c2c', 3));
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

    // FB-0033: the same destination the minimap/on-screen arrow point to.
    const target = this.world.currentObjectiveAnchor ? this.world.currentObjectiveAnchor() : null;
    if (target) {
      const tx = this.offsetX + target.x * this.scale;
      const ty = this.offsetY + target.y * this.scale;
      g.lineStyle(2, COLORS.gold, 1).strokeCircle(tx, ty, 6 + Math.abs(Math.sin(time / 200)) * 4);
    }

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
// HUD declutter pass: an empty bar (nothing collected yet) is one more box competing for attention
// over an otherwise clear play area, so it fades out after this long without any reason to look at it
// (no item added/selected, no number key/wheel touched) and fades back in the instant any of those
// happens -- never while it actually holds something, so a real inventory never disappears mid-play.
const HOTBAR_IDLE_MS = 3000;

class Hotbar {
  constructor(scene, inventory) {
    this.scene = scene;
    this.inventory = inventory;
    const size = 48;
    const gap = 8;
    const count = inventory.slots.length;
    // hudLayout()'s own hotbar box (unit-tested for overlap/on-screen at 3 sizes) -- x0/y0 below are
    // the individual slots' own top-left, derived from that same box's inner content area.
    const layout = hudLayout(GAME_WIDTH, GAME_HEIGHT, count);
    const pad = (layout.hotbar.h - size) / 2;
    const x0 = layout.hotbar.x + pad;
    const y0 = layout.hotbar.y + pad;
    // On-screen box the bar occupies, used to test overlap with the player (see updateOverlap).
    this.bounds = layout.hotbar;
    this.alpha = 1; // overlap-translucency only (FB-0001) -- unchanged meaning, tests read this directly
    this.autoHidden = false; // idle-while-empty (see HOTBAR_IDLE_MS above) -- a separate, new concern
    this.scriptHidden = false; // faded out while a script runs (quality-loop category 4 run 1, bug 2)
    this.idleTimer = null;

    this.panel = makePanel(scene, this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
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

    // FB-0035: gated the same way UIScene's own key handlers are (worldHasControl()) plus one more
    // check that's specific to the hotbar -- a number key or the wheel must not change the selected
    // slot while dialog/pause/journal/the full-screen map is open (`scene.isBlocking()`), even though
    // `worldHasControl()` alone would still say yes (none of those pause the 'world' scene itself,
    // see UIScene.isBlocking()).
    scene.input.keyboard.on('keydown', (event) => {
      if (!scene.worldHasControl() || scene.isBlocking()) return;
      const n = Number(event.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) inventory.select(n - 1);
    });
    scene.input.on('wheel', (pointer, over, dx, dy) => {
      if (!scene.worldHasControl() || scene.isBlocking()) return;
      if (dy !== 0) inventory.select((inventory.selected + Math.sign(dy) + count) % count);
    });

    // Named so teardown() can undo them -- `inventory` is GameState.inventory, a persistent
    // singleton that outlives this scene, see the file-header comment on why that matters. Both
    // also count as "activity" for the idle auto-hide above -- an item added/removed, or a different
    // slot picked (including by a number key/the wheel, which both call inventory.select()).
    this.onChanged = () => { this.refresh(); this.markActivity(); };
    this.onSelected = () => {
      this.refresh();
      this.flashName();
      this.markActivity();
    };
    inventory.on('changed', this.onChanged);
    inventory.on('selected', this.onSelected);
    this.visible = true;
    this.refresh();
    this.markActivity(); // starts the idle clock from boot if she begins with an empty bar
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

  // `this.alpha` keeps its exact original meaning (overlap-translucency only, FB-0001) since existing
  // tests read it directly -- the idle auto-hide below is tracked as a separate `autoHidden` flag, and
  // applyVisualAlpha() is what actually combines the two into what's drawn on screen.
  setTranslucent(translucent) {
    const alpha = translucent ? HOTBAR_TRANSLUCENT_ALPHA : 1;
    if (alpha === this.alpha) return;
    this.alpha = alpha;
    this.applyVisualAlpha();
  }

  isEmpty() {
    return this.inventory.slots.every((slot) => !slot);
  }

  // Called on boot and on every 'changed'/'selected' event (an item picked up, or a slot chosen by
  // click/number key/wheel): cancels any pending auto-hide, un-hides immediately if it had already
  // fired, and -- only while the bar is genuinely empty -- (re)starts the idle clock.
  markActivity() {
    if (this.idleTimer) { this.idleTimer.remove(); this.idleTimer = null; }
    if (this.autoHidden) { this.autoHidden = false; this.applyVisualAlpha(); }
    if (this.isEmpty()) {
      this.idleTimer = this.scene.time.delayedCall(HOTBAR_IDLE_MS, () => {
        this.autoHidden = true;
        this.applyVisualAlpha();
      });
    }
  }

  applyVisualAlpha() {
    const alpha = this.targetAlpha();
    [this.panel, this.frames, this.itemName].forEach((part) => part.setAlpha(alpha));
    this.slots.forEach((slot) => [slot.icon, slot.number, slot.amount].forEach((part) => part.setAlpha(alpha)));
  }

  targetAlpha() {
    if (this.scriptHidden) return 0;
    return this.autoHidden ? 0 : this.alpha;
  }

  // Called by UIScene.setHudScriptHidden() (Letterbox playIn/playOut/snap) -- quality-loop category 4
  // run 1, bug 2. A third, independent alpha source on top of the two above (overlap-translucency,
  // idle auto-hide): whichever of those wins, `scriptHidden` overrides both to fully hidden. Tweened
  // (~200ms, HUD_SCRIPT_FADE_MS) unlike the other two, which stay instant snaps (unchanged behavior).
  setScriptHidden(hidden, instant = false) {
    if (hidden === this.scriptHidden) return;
    this.scriptHidden = hidden;
    const parts = [this.panel, this.frames, this.itemName, ...this.slots.flatMap((slot) => [slot.icon, slot.number, slot.amount])];
    if (instant) { this.applyVisualAlpha(); return; }
    this.scene.tweens.killTweensOf(parts);
    this.scene.tweens.add({ targets: parts, alpha: this.targetAlpha(), duration: HUD_SCRIPT_FADE_MS });
  }

  teardown() {
    this.inventory.off('changed', this.onChanged);
    this.inventory.off('selected', this.onSelected);
    if (this.idleTimer) this.idleTimer.remove();
  }
}

// ---------- dialog box (bottom, replaces the inventory bar while open) ----------

const CHARS_PER_SECOND = 45;

// A dialog entry can offer choices (roadmap M1, docs/ARCHITECTURE.md): after its `lines` finish
// typing, instead of closing, the box shows a selectable list (up/down or W/S move the highlight,
// Enter/E/Space picks). Keyboard only, same box, no new art.
// FB-0045: E, Space and Enter all advance a box (or pick a choice) the same way. The box itself owns no
// confirm key: whichever scene shows it routes the three keys to advance() from ONE handler (world.js
// onInteractKey() for the game's own dialogs, the card/cutscene/greeting scenes for theirs), so one key
// press can never advance a box AND start something else, whatever order the scenes hear it in.
class DialogBox {
  // `box`, if given, overrides the default bottom-of-screen position/size -- src/scenes/card.js uses
  // this to fit a smaller message box inside its own card panel, under the photo frame, instead of
  // the ordinary full-width box every other conversation in the game uses. Every existing caller
  // (UIScene's own dialog, src/scenes/cutscene.js) passes nothing and gets the original box.
  constructor(scene, box) {
    this.scene = scene;
    this.isOpen = false;
    this.choices = null; // the list currently shown, or null while plain lines are typing/showing
    this.pendingChoices = null; // set by open(); shown once `lines` run out
    this.choiceTexts = null;
    this.choiceIndex = 0;
    this.selectedChoice = null; // the choice the player picked, passed to onClose() at the very end
    // A caller-supplied `box` (src/scenes/card.js's smaller in-card message box) opts this instance
    // out of the letterboxed-script repositioning below entirely -- only UIScene's own dialog (the
    // default box) is ever paired with a Letterbox, so a custom box just never calls setLetterboxed().
    this.usesDefaultBox = !box;
    this.baseBox = box || { ...DIALOG_BOX };
    this.letterboxed = false;
    this.box = { ...this.baseBox };

    const { x, y, w, h } = this.box;
    this.panel = makePanel(scene, x, y, w, h);
    // The name plate is its own small panel, resized (never redrawn) each time open() runs, since its
    // width depends on the speaker's own name -- built at a throwaway 1x1 here so it always has a real
    // NineSlice to resize later (see open() below and makePanel()'s own setPanelSize()).
    this.nameTag = makePanel(scene, x + 16, y - 24, 1, 1);
    this.name = uiText(scene, x + 34, y - 4, '', 16, COLORS.highlight).setOrigin(0, 0.5);
    this.body = uiText(scene, x + 30, y + 34, '', 16).setWordWrapWidth(w - 60);
    this.arrow = scene.add.image(x + w - 26, y + h - 22, UI_ICON_TEXTURE, UI_ICON.nextArrow).setOrigin(0.5);
    this.arrowBaseY = this.arrow.y;
    this.parts = [this.panel, this.nameTag, this.name, this.body, this.arrow];
    this.parts.forEach((part) => part.setDepth(50).setVisible(false));

    // One-shot keys use keydown events, never JustDown (ERR-0001). These are no-ops whenever
    // `this.choices` is null, so they're harmless in scenes/moments without a choice on screen
    // (e.g. the cutscene player, which never passes `choices` to open()).
    for (const key of ['UP', 'W']) scene.input.keyboard.on(`keydown-${key}`, (event) => !event.repeat && this.moveChoice(-1));
    for (const key of ['DOWN', 'S']) scene.input.keyboard.on(`keydown-${key}`, (event) => !event.repeat && this.moveChoice(1));
  }

  // Called by Letterbox (playIn/playOut/snap, src/scripts-runtime.js `letterbox` step) -- quality-loop
  // category 4 run 1, bug 3: while the bars are up, the box lifts clear of the bottom one (hudLayout's
  // own `dialogBox`, src/maplogic.js) instead of sitting where the bar would clip straight through it.
  // A no-op for a custom-box instance (card.js), which is never paired with a Letterbox anyway.
  setLetterboxed(active) {
    if (!this.usesDefaultBox || active === this.letterboxed) return;
    this.letterboxed = active;
    const layout = hudLayout(GAME_WIDTH, GAME_HEIGHT, undefined, { letterboxed: active });
    this.applyBox(active ? layout.dialogBox : this.baseBox);
  }

  // Repositions every child from a new box -- the constructor's own layout, run again. In real script
  // usage the box only ever moves while the dialog is closed (every `say` step is preceded by its own
  // `letterbox: 'in'`, src/scripts.js), but this still re-lays-out a currently-open box/choice list
  // correctly too, rather than assuming that ordering.
  applyBox(box) {
    this.box = box;
    const { x, y, w, h } = box;
    this.panel.setPosition(x, y);
    this.panel.setPanelSize(w, h);
    this.name.setPosition(x + 34, y - 4);
    this.body.setPosition(x + 30, y + 34).setWordWrapWidth(w - 60);
    this.arrow.setPosition(x + w - 26, y + h - 22);
    this.arrowBaseY = this.arrow.y;
    if (this.name.visible) {
      this.nameTag.setPosition(x + 16, y - 24);
      this.nameTag.setPanelSize(this.name.text.length * 16 + 36, 40);
    }
    if (this.choices) this.buildChoiceTexts();
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

    if (speaker) {
      this.name.setText(speaker);
      this.nameTag.setPosition(x + 16, y - 24);
      this.nameTag.setPanelSize(speaker.length * 16 + 36, 40);
    }
    this.parts.forEach((part) => part.setVisible(true));
    this.nameTag.setVisible(Boolean(speaker));
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

  // Called when the player presses E/Space/Enter: pick the highlighted choice, finish the line being
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
    // The UI kit's own cursor sprite (one per row, shown/hidden on highlight) instead of a "> " text
    // prefix -- every keyboard-driven list in the game now uses the same marker.
    this.choiceCursors = this.choices.map((choice, i) => makeCursor(this.scene, x + 14, y + 30 + i * 26 + 8).setDepth(51));
    this.choiceTexts = this.choices.map((choice, i) => uiText(this.scene, x + 30, y + 30 + i * 26, choice.text, 16).setDepth(51));
    this.refreshChoiceHighlight();
  }

  refreshChoiceHighlight() {
    this.choiceTexts.forEach((text, i) => {
      const current = i === this.choiceIndex;
      text.setText(this.choices[i].text).setColor(current ? COLORS.highlight : COLORS.text);
      this.choiceCursors[i].setVisible(current);
    });
  }

  destroyChoiceTexts() {
    (this.choiceTexts || []).forEach((text) => text.destroy());
    (this.choiceCursors || []).forEach((cursor) => cursor.destroy());
    this.choiceTexts = null;
    this.choiceCursors = null;
  }

  moveChoice(direction) {
    if (!this.isOpen || !this.choices) return;
    this.choiceIndex = (this.choiceIndex + direction + this.choices.length) % this.choices.length;
    this.refreshChoiceHighlight();
    AudioManager.play('menuMove');
  }

  // The chosen option's own `lines` (if any) play out like a normal line sequence; once they finish,
  // advance() finds no more lines and no pending choices left, so it closes as usual.
  confirmChoice() {
    AudioManager.play('menuConfirm');
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
      const prevShown = Math.floor(this.shown);
      this.shown = Math.min(this.fullText.length, this.shown + (delta / 1000) * CHARS_PER_SECOND);
      const shownChars = Math.floor(this.shown);
      this.body.setText(this.fullText.slice(0, shownChars));
      // M5 sound: a blip every couple of characters, not every single one -- at CHARS_PER_SECOND=45
      // that's still ~22 blips/sec at 1 char each, which reads as a buzz rather than a voice; every
      // 2nd character is closer to a real Pokemon-style textbox's cadence.
      if (shownChars > prevShown && shownChars % 2 === 0) AudioManager.play('dialogBlip');
      if (this.shown >= this.fullText.length) this.typing = false;
    }
    // Dialog box polish: a real bouncing arrow sprite (UI kit) once the line has finished typing,
    // never before -- replaces the old blink with a small continuous y-bob (GAME_FEEL.md "nothing is
    // a flat instant cut"), still never appearing mid-typewriter.
    const done = !this.typing;
    this.arrow.setVisible(done);
    if (done) this.arrow.setY(this.arrowBaseY + Math.abs(Math.sin(time / 200)) * 4);
  }
}

// ---------- toast: short messages like "+1 Apple" ----------
// FB-0036: a queue, not a single overwrite-in-place slot -- two messages landing close together
// (e.g. a key station's own "You got the X key!" immediately followed by the tutorial's "Tutorial
// complete!" a moment later) used to just clobber each other, so whichever came second silently ate
// the first one before the player could read it. Now each shows in turn (a hold then a fade, same
// timing as before), identical *consecutive* messages collapse into one (so a spammed action doesn't
// re-queue the same line over and over), and the queue is capped so it can never grow unbounded.

const TOAST_HOLD_MS = 1400;
const TOAST_FADE_MS = 500;
const TOAST_QUEUE_CAP = 4; // messages waiting, not counting whichever one is on screen right now

const TOAST_Y = 360; // sits just above the ordinary (non-letterboxed) dialog box, y=382

class Toast {
  constructor(scene) {
    this.scene = scene;
    this.y = TOAST_Y;
    this.queue = [];
    this.showing = null; // the message currently on screen (or fading out), or null between messages
    this.text = uiText(scene, GAME_WIDTH / 2, this.y, '', 16).setOrigin(0.5).setStroke('#1a1c2c', 8).setAlpha(0).setDepth(60);
  }

  // Called by Letterbox (playIn/playOut/snap) -- quality-loop category 4 run 1, item 4: a toast fired
  // mid-script (not itself gated the way hints now are -- an item pickup can still legitimately toast
  // during one) must not land on top of the dialog box once it lifts clear of the bottom bar.
  setLetterboxed(active) {
    const layout = hudLayout(GAME_WIDTH, GAME_HEIGHT, undefined, { letterboxed: active });
    this.y = active ? layout.dialogBox.y - 20 : TOAST_Y;
  }

  show(message) {
    // Collapse identical consecutive messages: don't pile up 5 copies of the same line just because
    // something fired the same toast repeatedly in a short span.
    if (this.showing === message) return;
    if (this.queue.length && this.queue[this.queue.length - 1] === message) return;
    this.queue.push(message);
    while (this.queue.length > TOAST_QUEUE_CAP) this.queue.shift(); // never grows unbounded
    this.pump();
  }

  pump() {
    if (this.showing !== null || !this.queue.length) return;
    this.showing = this.queue.shift();
    this.scene.tweens.killTweensOf(this.text);
    this.text.setText(this.showing).setAlpha(1).setY(this.y);
    this.scene.tweens.add({
      targets: this.text, alpha: 0, y: this.y - 16, delay: TOAST_HOLD_MS, duration: TOAST_FADE_MS,
      onComplete: () => { this.showing = null; this.pump(); },
    });
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
  ['E / ENTER / SPACE', 'Talk, next line'], // FB-0045: all three work
  ['1-5 / WHEEL', 'Choose item slot'],
  ['M', 'Show/hide minimap'],
  ['N / CLICK MAP', 'Full-screen map'],
  ['J', 'Journal'],
  ['ESC', 'Pause'],
];

// M5 sound (docs/ROADMAP.md): music/sfx volume + mute, reachable "in the pause menu and the title's
// Controls/Options screen" -- rather than build a second panel, these 3 rows are prepended to this
// one shared ControlsPanel (used by both PauseMenu.showControls() and TitleScene), so both places
// get the same widget for free and rule 1 (docs/GAME_FEEL.md, "a panel's box is sized from its
// content") keeps holding without any extra work. Up/Down move the highlighted row, Left/Right
// change it -- wired by whichever scene owns the panel (PauseMenu / TitleScene keydown handlers), the
// same split every other keyboard-driven menu in this game already uses.
const SETTINGS_ROWS = ['music', 'sfx', 'mute'];
function settingLabel(id) {
  return id === 'music' ? 'MUSIC VOLUME' : id === 'sfx' ? 'SFX VOLUME' : 'MUTE ALL';
}
function settingValueText(id) {
  if (id === 'mute') return AudioManager.isMuted() ? 'ON' : 'OFF';
  return `${Math.round(AudioManager.getVolume(id) * 100)}%`;
}

class ControlsPanel {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    const baseRows = typeof DEV_MODE !== 'undefined' && DEV_MODE ? [...CONTROLS, ['O', 'Give feedback (dev)']] : CONTROLS;
    // Settings rows first (interactive), then the plain key/action rows (display only) -- same
    // two-column shape for both, so one loop below builds every row's text objects.
    const rows = [...SETTINGS_ROWS.map((id) => [settingLabel(id), '']), ...baseRows];
    this.rows = rows;
    this.settingIndex = 0;

    const w = 480;
    const rowH = 26;
    const headerH = 74; // title + top margin
    const footerH = 36; // "ESC / ENTER TO CLOSE" + bottom margin
    const h = headerH + rows.length * rowH + footerH;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);
    this.box = { x, y, w, h };

    this.dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0);
    this.panel = makePanel(scene, x, y, w, h);
    this.title = uiText(scene, x + w / 2, y + 30, 'CONTROLS', 16, COLORS.highlight).setOrigin(0.5);
    // A cursor sprite marks the highlighted *settings* row only (the plain key/action rows below are
    // display-only, never selectable) -- the same cursor every other keyboard-driven list uses.
    this.settingCursors = SETTINGS_ROWS.map((id, i) => makeCursor(scene, x + 14, y + headerH + i * rowH + 8).setDepth(115));
    this.rowTexts = rows.flatMap(([key, action], i) => {
      const rowY = y + headerH + i * rowH;
      return [
        uiText(scene, x + 32, rowY, key, 8, COLORS.highlight),
        uiText(scene, x + 232, rowY, action, 8, COLORS.text),
      ];
    });
    this.footer = uiText(scene, x + w / 2, y + h - 22, 'ESC / ENTER TO CLOSE', 8, COLORS.dim).setOrigin(0.5);
    this.parts = [this.dim, this.panel, this.title, ...this.settingCursors, ...this.rowTexts, this.footer];
    this.parts.forEach((part) => part.setDepth(115).setVisible(false));
  }

  open() {
    this.visible = true;
    this.settingIndex = 0;
    this.parts.forEach((part) => part.setVisible(true));
    this.refreshSettings();
  }

  close() {
    this.visible = false;
    this.parts.forEach((part) => part.setVisible(false));
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  moveSetting(direction) {
    this.settingIndex = (this.settingIndex + direction + SETTINGS_ROWS.length) % SETTINGS_ROWS.length;
    this.refreshSettings();
    AudioManager.play('menuMove');
  }

  adjustSetting(direction) {
    const id = SETTINGS_ROWS[this.settingIndex];
    if (id === 'mute') AudioManager.setMuted(!AudioManager.isMuted());
    else AudioManager.setVolume(id, AudioManager.getVolume(id) + direction * 0.1);
    this.refreshSettings();
    AudioManager.play('menuConfirm');
  }

  refreshSettings() {
    SETTINGS_ROWS.forEach((id, i) => {
      const selected = i === this.settingIndex;
      this.settingCursors[i].setVisible(selected);
      this.rowTexts[i * 2].setText(settingLabel(id)).setColor(selected ? COLORS.highlight : COLORS.text);
      this.rowTexts[i * 2 + 1].setText(settingValueText(id)).setColor(selected ? COLORS.highlight : COLORS.text);
    });
  }
}

// ---------- leaving the game: back to the title, or out of it (FB-0075, FB-0076) ----------
// Every scene a play session can have alive underneath the one on screen: the world and its HUD, a
// cutscene or mini-game that paused the world, the ending's own chain (box opening, card, credits).
// Starting the title (or the goodbye screen) from ANY of them must leave none of these behind -- the
// ending used to hand over to the title with the world still sitting paused under it (the player,
// her foyer position and all), which is what the feedback overlay and a later "Continue" then saw.
const GAMEPLAY_SCENES = ['world', 'ui', 'cutscene', 'box-opening', 'card', 'credits', 'minigame-platformer', 'minigame-flappy', 'minigame-tower'];

// Stops every gameplay scene except `scene` itself (a scene's own start() below stops it), so what is
// left running is exactly the one scene about to be started. Safe to call when nothing is alive.
function stopGameplayScenes(scene) {
  const manager = scene.scene;
  for (const key of GAMEPLAY_SCENES) {
    if (key === scene.sys.settings.key) continue;
    if (manager.isActive(key) || manager.isPaused(key) || manager.isSleeping(key)) manager.stop(key);
  }
}

// Hands over to `nextKey` ('title' or 'goodbye') with no gameplay scene left alive behind it.
function leaveGameTo(scene, nextKey) {
  stopGameplayScenes(scene);
  scene.scene.start(nextKey);
}

// ---------- pause menu (Esc): Resume / Controls / Save / Quit to title / Quit game ----------

const PAUSE_ITEMS = [
  { id: 'resume', label: 'Resume' },
  { id: 'controls', label: 'Controls' },
  { id: 'save', label: 'Save' },
  { id: 'quit', label: 'Quit to Title' },
  { id: 'quitGame', label: 'Quit Game' }, // FB-0075: out of the game altogether (the goodbye screen)
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
    this.panel = makePanel(scene, x, y, w, h);
    this.title = uiText(scene, x + w / 2, y + 32, 'PAUSED', 16, COLORS.highlight).setOrigin(0.5);
    this.itemCursors = PAUSE_ITEMS.map((item, i) => makeCursor(scene, x + 22, y + 66 + i * rowH + 8).setDepth(110));
    this.itemTexts = PAUSE_ITEMS.map((item, i) => {
      const text = uiText(scene, x + 40, y + 66 + i * rowH, item.label, 12, COLORS.text);
      text.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { this.index = i; this.refresh(); })
        .on('pointerdown', () => { this.index = i; this.confirm(); });
      return text;
    });
    this.parts = [this.dim, this.panel, this.title, ...this.itemCursors, ...this.itemTexts];
    this.parts.forEach((part) => part.setDepth(110).setVisible(false));

    this.controls = new ControlsPanel(scene);

    for (const key of ['UP', 'W']) {
      scene.input.keyboard.on(`keydown-${key}`, (e) => {
        if (e.repeat || !this.visible) return;
        if (this.view === 'menu') this.move(-1);
        else if (this.view === 'controls') this.controls.moveSetting(-1);
      });
    }
    for (const key of ['DOWN', 'S']) {
      scene.input.keyboard.on(`keydown-${key}`, (e) => {
        if (e.repeat || !this.visible) return;
        if (this.view === 'menu') this.move(1);
        else if (this.view === 'controls') this.controls.moveSetting(1);
      });
    }
    // M5 sound: Left/Right adjust the highlighted setting row while the (shared) Controls/Sound
    // panel is open -- these keys are otherwise unused by the pause menu itself, so this can't
    // collide with anything (world movement is already blocked while paused).
    for (const key of ['LEFT', 'A']) {
      scene.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.visible && this.view === 'controls') this.controls.adjustSetting(-1); });
    }
    for (const key of ['RIGHT', 'D']) {
      scene.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.visible && this.view === 'controls') this.controls.adjustSetting(1); });
    }
    for (const key of ['ENTER', 'SPACE']) {
      scene.input.keyboard.on(`keydown-${key}`, (e) => {
        if (e.repeat || !this.visible) return;
        // FB-0045: world.js onInteractKey() hears this same key (Enter/Space start a conversation); this press
        // belongs to the menu, so mark it used -- "Resume" closing the menu must not also talk to whoever stands nearby.
        e.uiConsumed = true;
        this.confirm();
      });
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
    AudioManager.play('menuMove');
  }

  refresh() {
    this.itemTexts.forEach((text, i) => {
      const current = i === this.index;
      text.setText(PAUSE_ITEMS[i].label).setColor(current ? COLORS.highlight : COLORS.text);
      this.itemCursors[i].setVisible(current);
    });
  }

  confirm() {
    AudioManager.play('menuConfirm');
    if (this.view === 'controls') {
      this.backToMenu();
      return;
    }
    const item = PAUSE_ITEMS[this.index];
    if (item.id === 'resume') this.close();
    else if (item.id === 'controls') this.showControls();
    else if (item.id === 'save') this.doSave();
    else if (item.id === 'quit') this.quitToTitle();
    else if (item.id === 'quitGame') this.quitGame();
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
    leaveGameTo(this.scene, 'title');
  }

  // FB-0075: out of the game. A browser only lets a script close a window a script opened, so the close
  // is a best effort (it does work in the desktop build); the goodbye screen is what the player sees when
  // it doesn't (src/scenes/goodbye.js).
  quitGame() {
    this.close();
    quitGameToGoodbye(this.scene);
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
  menu: 'ESC FOR THE MENU', // FB-0075: the pause menu is where Save / Quit to Title / Quit Game live
};
const HINT_FADE_MS = 300;
const HINT_HOLD_MS = 2600;

class HintBanner {
  // HUD declutter pass: bottom-center, just above the hotbar (hudLayout's own `hint` box) -- was
  // stacked under the location banner near the top of the screen; moved so a first-time hint never
  // competes with the banner/tracker up top, and instead sits right where the thing it's teaching
  // (WASD, E, Shift, M) is about to be used, next to the hotbar.
  //
  // Quality-loop category 4 run 1, bug 1: a hint used to show the instant it was triggered, with no
  // regard for a dialog box or an in-world script already owning the screen -- a live capture of the
  // Gate 2 beat caught the "move" hint drawing directly on top of Mustafa's own dialog box. Hints now
  // never *start* showing while blocked() (queued instead, same "queued, not stacked" rule as before,
  // GAME_FEEL.md), and one already showing when blocking begins is hidden immediately and put back at
  // the front of the queue to try again once control returns -- see tick(), called every frame from
  // UIScene.update().
  constructor(scene) {
    this.scene = scene;
    this.queue = [];
    this.showing = null;
    this.holdTimer = null;
    const { x, y, w, h } = hudLayout(GAME_WIDTH, GAME_HEIGHT).hint;
    this.panel = makePanel(scene, x, y, w, h).setDepth(70);
    this.text = uiText(scene, x + w / 2, y + h / 2, '', 12, COLORS.highlight).setOrigin(0.5).setDepth(71);
    this.parts = [this.panel, this.text];
    this.parts.forEach((part) => part.setAlpha(0));
  }

  // Dialog box on screen, or a script/warp-fade holding input -- the same two conditions the bug
  // report named ("never while a dialog is open or a script is running").
  blocked() {
    // D16: also while the pause menu (and its Controls page) is up -- a hint drawn then showed through the translucent
    // panel ("WASD / ARROWS TO MOVE" under the ESC row). tick() hides it at once and puts it back in the queue.
    const pauseOpen = Boolean(this.scene.pause && this.scene.pause.visible);
    return this.scene.dialog.isOpen || !this.scene.worldHasControl() || pauseOpen;
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

  // Every frame (UIScene.update()): interrupts a hint that started showing before blocking began, and
  // otherwise tries to pump the queue -- covers both directions of the transition (blocked mid-show,
  // or unblocked with something still waiting) without either side needing to know about the other.
  tick() {
    if (this.showing && this.blocked()) { this.interrupt(); return; }
    this.pump();
  }

  pump() {
    if (this.showing || !this.queue.length || this.blocked()) return;
    this.showing = this.queue.shift();
    this.text.setText(HINTS[this.showing]);
    this.scene.tweens.killTweensOf(this.parts);
    this.scene.tweens.add({ targets: this.parts, alpha: 1, duration: HINT_FADE_MS });
    this.holdTimer = this.scene.time.delayedCall(HINT_FADE_MS + HINT_HOLD_MS, () => {
      this.holdTimer = null;
      this.scene.tweens.add({
        targets: this.parts, alpha: 0, duration: HINT_FADE_MS,
        onComplete: () => { this.showing = null; this.pump(); },
      });
    });
  }

  // Hides whatever's currently showing right away (no fade -- this is an emergency interrupt, not the
  // hint's own natural end) and re-queues its id at the front, so it's the very next one pump() tries
  // once control returns.
  interrupt() {
    if (this.holdTimer) { this.holdTimer.remove(); this.holdTimer = null; }
    this.scene.tweens.killTweensOf(this.parts);
    this.parts.forEach((part) => part.setAlpha(0));
    this.queue.unshift(this.showing);
    this.showing = null;
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

    const panel = makePanel(scene, x, y, w, h);
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

// ---------- quest tracker (top-right): a compact pill, expanding briefly on change ----------
// HUD declutter pass: used to always show as a multi-line panel ("LUG TREASURE HUNT" title + the full
// objective sentence + "Keys: n / 3", one of the biggest boxes permanently on screen). Now a single-
// line pill ("Keys 1/3 · Find the ICL, 1st floor") the rest of the time, and only expands to the full
// objective for TRACKER_EXPAND_MS whenever the objective text itself actually changes (a key found, a
// stage advanced) -- still always on (never a modal, never blocks input), just quieter when nothing
// changed since the last time she looked. Same top-right corner the tutorial checklist uses
// (docs/STYLE_GUIDE.md's own "[quest / tutorial]" layout sketch) -- they never actually appear
// together, since the checklist only exists on the meadow test map (Tutorial's `stage` is 'done'
// everywhere else, see above).

const TRACKER_EXPAND_MS = 3000;

class QuestTracker {
  constructor(scene) {
    this.scene = scene;
    const layout = hudLayout(GAME_WIDTH, GAME_HEIGHT);
    this.pillBox = layout.tracker;
    this.expandedBox = layout.trackerExpanded;
    this.expanded = false;
    this.collapseTimer = null;
    this.lastObjectiveText = null;

    const { x, y, w, h } = this.pillBox;
    this.panel = makePanel(scene, x, y, w, h);
    // D15: a "Keys n/3" line over the whole objective, wrapped (maplogic.js trackerPillText()); the pill's height follows it.
    this.pillKeys = uiText(scene, x + TRACKER_PILL.pad, y + 10, '', TRACKER_PILL.fontSize, COLORS.done).setOrigin(0, 0);
    this.pillText = uiText(scene, x + TRACKER_PILL.pad, y + 10, '', TRACKER_PILL.fontSize, COLORS.text).setOrigin(0, 0);
    this.title = uiText(scene, x + 14, y + 16, 'LUG TREASURE HUNT', 8, COLORS.highlight).setVisible(false);
    this.objective = uiText(scene, x + 14, y + 34, '', 8).setWordWrapWidth(this.expandedBox.w - 28, true).setVisible(false);
    this.keysText = uiText(scene, x + 14, y + 34, '', 8, COLORS.done).setVisible(false);
    this.parts = [this.panel, this.pillKeys, this.pillText, this.title, this.objective, this.keysText];
    this.refresh();
  }

  refresh() {
    const text = questObjectiveText(GameState.quest);
    const keysHeld = Object.values(GameState.quest.keys).filter(Boolean).length;

    // The pill: "Keys n/3", then the whole objective on up to two lines (maplogic.js trackerPillText(); the line breaks are
    // computed for the monospace HUD font, so nothing is shrunk or cut with an ellipsis any more -- defect D15). The panel
    // is as tall as that text needs, never more than HUD_TRACKER.collapsedH's worst case.
    const pill = trackerPillText(GameState.quest);
    const box = this.pillBox;
    this.pillKeys.setText(pill.keys).setPosition(box.x + TRACKER_PILL.pad, box.y + 10);
    this.pillText.setText(pill.lines.join('\n'));
    // Safety net only (a font that is not exactly monospace): shrink, never truncate, if a line still overflows.
    fitTextInWidth(this.pillText, pill.lines.join('\n'), box.w - 2 * TRACKER_PILL.pad, 5, TRACKER_PILL.fontSize);
    this.pillText.setPosition(box.x + TRACKER_PILL.pad, box.y + 10 + this.pillKeys.height + 4);
    box.h = Math.ceil(10 + this.pillKeys.height + 4 + this.pillText.height + 10);
    if (!this.expanded) this.panel.setPanelSize(box.w, box.h);

    this.objective.setText(text);
    const keysY = this.expandedBox.y + 34 + this.objective.height + 8;
    this.keysText.setPosition(this.expandedBox.x + 14, keysY);
    this.keysText.setText(`Keys: ${keysHeld} / 3`);

    if (text !== this.lastObjectiveText) {
      this.lastObjectiveText = text;
      this.expand();
    }
  }

  // Widens/heightens to the full objective (title + wrapped sentence + keys line) for a few seconds
  // whenever refresh() finds the objective actually changed, then collapse() puts the pill back.
  expand() {
    this.expanded = true;
    this.panel.setPosition(this.expandedBox.x, this.expandedBox.y);
    this.panel.setPanelSize(this.expandedBox.w, this.expandedBox.h);
    this.pillKeys.setVisible(false);
    this.pillText.setVisible(false);
    this.title.setVisible(true);
    this.objective.setVisible(true);
    this.keysText.setVisible(true);
    if (this.collapseTimer) this.collapseTimer.remove();
    this.collapseTimer = this.scene.time.delayedCall(TRACKER_EXPAND_MS, () => this.collapse());
  }

  collapse() {
    this.expanded = false;
    this.collapseTimer = null;
    this.panel.setPosition(this.pillBox.x, this.pillBox.y);
    this.panel.setPanelSize(this.pillBox.w, this.pillBox.h);
    this.pillKeys.setVisible(true);
    this.pillText.setVisible(true);
    this.title.setVisible(false);
    this.objective.setVisible(false);
    this.keysText.setVisible(false);
  }

  // Called by UIScene.setHudScriptHidden() (Letterbox playIn/playOut/snap) -- quality-loop category 4
  // run 1, bug 2: an in-world script fades this out of the way (whichever of pill/expanded it's
  // currently showing), same as the minimap and hotbar.
  setScriptHidden(hidden, instant = false) {
    fadeParts(this.scene, this.parts, !hidden, instant);
  }
}

// ---------- letterbox bars (ADR 0016): a Pokemon-style story beat's own thin top/bottom bars ----------
// Lives in UIScene (not WorldScene, which is zoomed 3x -- a screen-fixed bar has to be drawn where the
// UI's own 960x540, zoom-1 camera is, docs/GAME_FEEL.md "UI canvas"), driven by src/scripts-runtime.js
// ScriptRunner's `{ letterbox: 'in' | 'out' }` step. `snap()` is the Esc-fast-forward path: no slide,
// just land on whichever state ('in' fully shown, 'out' fully hidden) the skip is heading towards.
//
// Quality-loop category 4 run 1 (docs/QUALITY_LOOP.md, bugs 2/3 from a live capture of the Gate 2
// beat): the same transition every real script already drives (every `say` step is preceded by its
// own `letterbox: 'in'`, src/scripts.js) is now also what fades the always-on HUD (minimap/tracker/
// hotbar) out of the way and lifts the dialog box clear of the bottom bar -- see
// UIScene.setHudScriptHidden()/DialogBox.setLetterboxed() below. `snap()` (the Esc-skip path) applies
// both instantly, so skipping a script restores the HUD/dialog exactly like letting it finish would.
// SCRIPT_LETTERBOX_HEIGHT itself now lives in src/maplogic.js (hudLayout()'s own dialogBox math needs
// the same number, see that file's comment) -- this file just reads the one shared constant.

const SCRIPT_LETTERBOX_SLIDE_MS = 350;
const HUD_SCRIPT_FADE_MS = 200;

class Letterbox {
  constructor(scene) {
    this.scene = scene;
    this.h = SCRIPT_LETTERBOX_HEIGHT;
    this.topBar = scene.add.rectangle(GAME_WIDTH / 2, -this.h / 2, GAME_WIDTH, this.h, 0x000000).setDepth(90);
    this.bottomBar = scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + this.h / 2, GAME_WIDTH, this.h, 0x000000).setDepth(90);
  }

  playIn(onDone) {
    this.scene.tweens.killTweensOf([this.topBar, this.bottomBar]);
    this.scene.tweens.add({ targets: this.topBar, y: this.h / 2, duration: SCRIPT_LETTERBOX_SLIDE_MS, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({ targets: this.bottomBar, y: GAME_HEIGHT - this.h / 2, duration: SCRIPT_LETTERBOX_SLIDE_MS, ease: 'Cubic.easeOut', onComplete: onDone });
    this.scene.setHudScriptHidden(true);
    this.scene.dialog.setLetterboxed(true);
    this.scene.toast.setLetterboxed(true);
  }

  playOut(onDone) {
    this.scene.tweens.killTweensOf([this.topBar, this.bottomBar]);
    this.scene.tweens.add({ targets: this.topBar, y: -this.h / 2, duration: SCRIPT_LETTERBOX_SLIDE_MS, ease: 'Cubic.easeIn' });
    this.scene.tweens.add({ targets: this.bottomBar, y: GAME_HEIGHT + this.h / 2, duration: SCRIPT_LETTERBOX_SLIDE_MS, ease: 'Cubic.easeIn', onComplete: onDone });
    this.scene.setHudScriptHidden(false);
    this.scene.dialog.setLetterboxed(false);
    this.scene.toast.setLetterboxed(false);
  }

  snap(shown) {
    this.scene.tweens.killTweensOf([this.topBar, this.bottomBar]);
    this.topBar.y = shown ? this.h / 2 : -this.h / 2;
    this.bottomBar.y = shown ? GAME_HEIGHT - this.h / 2 : GAME_HEIGHT + this.h / 2;
    this.scene.setHudScriptHidden(shown, true);
    this.scene.dialog.setLetterboxed(shown);
    this.scene.toast.setLetterboxed(shown);
  }
}

// Fades a flat list of GameObjects to fully shown/hidden together -- shared by every always-on HUD
// element that needs to get out of a script's way (Minimap/QuestTracker below; Hotbar has its own
// richer alpha-combining logic already, see its own setScriptHidden()). `instant` is for the Esc-skip
// path (Letterbox.snap()), which must land in the right state with no animation at all.
function fadeParts(scene, parts, show, instant = false) {
  const alpha = show ? 1 : 0;
  scene.tweens.killTweensOf(parts);
  if (instant) { parts.forEach((part) => part.setAlpha(alpha)); return; }
  scene.tweens.add({ targets: parts, alpha, duration: HUD_SCRIPT_FADE_MS });
}

// ---------- onboarding (FB-0033): a bouncing destination arrow + a "still stuck?" hint toast ----------
// The quest tracker's own text (src/maplogic.js questObjectiveText()) already says *what* to do; this
// is the always-visible *where* -- a bouncing arrow over the current objective's door/desk when it's
// on screen (world.js currentObjectiveAnchor(), src/objective-routes.js), plus the same marker on the
// minimap/full map (added to Minimap.update()/FullMap.update() below) so she can always see it even
// off screen. If she hasn't gotten meaningfully closer to it in WANDER_HINT_MS, a gentle toast repeats
// the objective -- never more than once per that same window, so it can't nag.

const WANDER_HINT_MS = 20_000;
const WANDER_IMPROVE_PX = 24; // must close the gap by at least this much to count as "making progress"

class Onboarding {
  constructor(scene) {
    this.scene = scene;
    this.arrow = scene.add.graphics().setDepth(90).setVisible(false);
    this.bestDistance = Infinity;
    this.stuckSince = null;
    this.lastKey = null;
  }

  update(world, time) {
    const target = world.currentObjectiveAnchor ? world.currentObjectiveAnchor() : null;
    if (!target) {
      this.arrow.setVisible(false);
      this.lastKey = null;
      return;
    }

    const px = target.x * TILE + TILE / 2;
    const py = target.y * TILE + TILE / 2;
    const cam = world.cameras.main;
    const view = cam.worldView;
    const onScreen = px > view.x + 8 && px < view.x + view.width - 8 && py > view.y + 8 && py < view.y + view.height;
    this.arrow.setVisible(onScreen);
    if (onScreen) this.drawArrow(cam, px, py, time);

    this.updateWander(world, px, py, time);
  }

  drawArrow(cam, px, py, time) {
    // World pixels -> screen pixels: UIScene's own camera is zoom 1 (docs/GAME_FEEL.md "UI canvas"),
    // so a world-space point has to go through the WORLD camera's own scroll/zoom to land in the right
    // screen spot, the same conversion the minimap's own `mx`/`my` do in tile-window space.
    const sx = (px - cam.scrollX) * cam.zoom;
    const sy = (py - cam.scrollY) * cam.zoom - 34 - Math.abs(Math.sin(time / 220)) * 8;
    const g = this.arrow.clear();
    g.fillStyle(0x000000, 0.35).fillTriangle(sx - 7, sy + 2, sx + 7, sy + 2, sx, sy + 14);
    g.fillStyle(COLORS.gold, 1).fillTriangle(sx - 7, sy, sx + 7, sy, sx, sy + 12);
  }

  // "If she wanders for ~20s without getting closer, a gentle hint toast repeats the objective"
  // (docs/plans/2026-09-26-premium-pass.md stage 6): tracks the closest she's been to the current
  // target since it last changed (a new key/room/map counts as a fresh start, not "already stuck").
  updateWander(world, px, py, time) {
    const key = `${world.mapKey}:${Math.round(px)},${Math.round(py)}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.bestDistance = Phaser.Math.Distance.Between(world.player.x, world.player.y, px, py);
      this.stuckSince = time;
      return;
    }
    const distance = Phaser.Math.Distance.Between(world.player.x, world.player.y, px, py);
    if (this.bestDistance - distance > WANDER_IMPROVE_PX) {
      this.bestDistance = distance;
      this.stuckSince = time;
      return;
    }
    if (this.stuckSince == null) this.stuckSince = time;
    if (time - this.stuckSince > WANDER_HINT_MS) {
      this.stuckSince = time; // one nudge per stagnant window, never a nag every frame after
      this.scene.game.events.emit('toast', questObjectiveText(GameState.quest));
    }
  }
}

// ---------- journal (J): the clues she's been given so far (M1 leftover) ----------
// A modal overlay, same family as ControlsPanel/PauseMenu (dim background + a centered panel that
// measures its own height from its content -- GAME_FEEL.md rule 1), listing GameState.journal
// (src/dialog.js `{ journal: '...' }` actions) oldest first. Rebuilt every time it opens, so it
// always reflects whatever's been added since it was last shown.

class JournalPanel {
  constructor(scene) {
    this.scene = scene;
    this.visible = false;
    this.w = 560;
    this.x = Math.round((GAME_WIDTH - this.w) / 2);
    this.headerH = 56;
    this.footerH = 34;
    this.rowGap = 10;
    this.scroll = 0;
    this.maxScroll = 0;

    this.dim = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55).setOrigin(0, 0);
    this.panel = makePanel(scene, this.x, 0, this.w, 1); // resized in build() once the real height is known
    this.title = uiText(scene, GAME_WIDTH / 2, 0, 'JOURNAL', 16, COLORS.highlight).setOrigin(0.5);
    this.footer = uiText(scene, GAME_WIDTH / 2, 0, 'J / ESC TO CLOSE', 8, COLORS.dim).setOrigin(0.5);
    this.rowTexts = [];
    // FB-0041a: the mask shape that clips rows to the panel's own scrollable viewport (below) --
    // never added to the display list itself, just used to build a GeometryMask.
    this.maskShape = scene.make.graphics({}, false);
    this.parts = [this.dim, this.panel, this.title, this.footer];
    this.parts.forEach((part) => part.setDepth(115).setVisible(false));

    // FB-0041a: Up/Down scroll the journal while it's open -- a no-op once every entry already fits
    // (maxScroll === 0), so this is harmless whenever there's nothing to scroll.
    for (const key of ['UP', 'W']) scene.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.visible) this.scrollBy(-1); });
    for (const key of ['DOWN', 'S']) scene.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.visible) this.scrollBy(1); });
  }

  open() {
    this.visible = true;
    this.scroll = 0;
    this.build();
    this.parts.forEach((part) => part.setVisible(true));
    this.rowTexts.forEach((text) => text.setVisible(true));
  }

  close() {
    this.visible = false;
    this.parts.forEach((part) => part.setVisible(false));
    this.rowTexts.forEach((text) => text.setVisible(false));
  }

  toggle() {
    if (this.visible) this.close();
    else this.open();
  }

  // FB-0041a: build() used to draw a fresh copy of the panel onto the same Graphics object every time
  // it opened, without clearing it first -- each open piled another panel rectangle/border on top of
  // every earlier one (invisible at first, since they're identical rectangles in the same place, but
  // real extra draw calls that would eventually show as a visibly thicker border/shadow, and pure
  // waste regardless). `this.panel.clear()` below fixes that; the rest of this method also now caps
  // the panel's own height to the screen (GAME_HEIGHT - 40, a top/bottom margin) and scrolls its rows
  // in a masked viewport instead of just growing forever when there are many/long entries.
  build() {
    this.rowTexts.forEach((text) => text.destroy());
    const entries = GameState.journal.length ? GameState.journal : ['No clues yet -- go talk to someone.'];
    const bodyW = this.w - 64;
    this.rowTexts = entries.map((line) => uiText(this.scene, this.x + 32, 0, `• ${line}`, 8, COLORS.text).setWordWrapWidth(bodyW).setDepth(116));

    this.rowRelY = [];
    let rowsH = 0;
    for (const text of this.rowTexts) {
      this.rowRelY.push(rowsH);
      rowsH += text.height + this.rowGap;
    }

    const maxH = GAME_HEIGHT - 40;
    const h = Math.min(maxH, this.headerH + rowsH + this.footerH);
    const y = Math.round((GAME_HEIGHT - h) / 2);
    this.box = { x: this.x, y, w: this.w, h }; // read by tests, same shape every other panel exposes
    this.viewportH = h - this.headerH - this.footerH;
    this.viewY = y + this.headerH;
    this.maxScroll = Math.max(0, rowsH - this.viewportH);
    this.scroll = Phaser.Math.Clamp(this.scroll, 0, this.maxScroll);

    this.panel.setPosition(this.x, y);
    this.panel.setPanelSize(this.w, h);
    this.title.setPosition(GAME_WIDTH / 2, y + 26);
    this.footer.setText(this.maxScroll > 0 ? 'UP/DOWN TO SCROLL -- J / ESC TO CLOSE' : 'J / ESC TO CLOSE');
    this.footer.setPosition(GAME_WIDTH / 2, y + h - 18);

    this.maskShape.clear().fillStyle(0xffffff).fillRect(this.x + 16, this.viewY, this.w - 32, this.viewportH);
    const mask = this.maskShape.createGeometryMask();
    for (const text of this.rowTexts) text.setMask(mask);
    this.layoutRows();
  }

  layoutRows() {
    this.rowTexts.forEach((text, i) => text.setPosition(this.x + 32, this.viewY - this.scroll + this.rowRelY[i]));
  }

  scrollBy(direction) {
    if (!this.maxScroll) return;
    this.scroll = Phaser.Math.Clamp(this.scroll + direction * 3 * 13, 0, this.maxScroll);
    this.layoutRows();
  }
}
