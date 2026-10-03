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

// FB-0037: the in-game Credits used to say "All art and code original, made for this game" -- false,
// and several of the third-party packs actually in use require exactly this kind of on-screen credit
// (LimeZu/Sprout Lands non-commercial "credit required" clauses, Kyrise/Land of Pixels/Pixel Seating's
// CC BY licences, OpenStreetMap's ODbL). Built from CREDITS.md's own wording -- every pack and licence
// named there for something actually wired into the game (`grep` the packs list below against that
// file's own headings before editing either one) -- not restated from memory. Sprout Lands' free-tier
// licence spells out an exact required line ("credit required... Assets - From: Sprout Lands - By:
// Cup Nooble"), kept verbatim rather than paraphrased. The "Audio:" section (merged in with
// feature/audio, docs/ROADMAP.md M5) follows the same rule for CREDITS.md's own "Character, icon,
// and audio survey" section: Kenney's CC0 packs don't strictly require credit, but this game already
// credits Kenney's other CC0 art above for consistency, so the audio ones get the same treatment.
// Kept as short, individually pre-wrapped lines (each comfortably under this panel's own wrap width)
// rather than long paragraphs left for Phaser's word-wrap to break up on its own -- the exact
// required phrases (the Sprout Lands credit line especially) must never be split mid-sentence across
// a wrap boundary, and a short line can't wrap wrong.
const CREDITS_LINES = [
  'BITS DUBAI: THE LUG TREASURE HUNT',
  '',
  'Built with Phaser 3 (phaser.io), free and open source.',
  'Font: Press Start 2P by Cody "CodeMan38" Boisclair.',
  'SIL Open Font License.',
  '',
  'Campus layout from OpenStreetMap contributors,',
  'used under the Open Database License (ODbL).',
  '',
  'Art:',
  'Kenney (kenney.nl) -- Roguelike Modern City and',
  'Pixel Vehicle Pack, CC0.',
  'Modern Interiors (Free) by LimeZu -- interiors,',
  'floors, doors and characters.',
  'Assets - From: Sprout Lands - By: Cup Nooble',
  '(outdoor greenery).',
  "Kyrise's 16x16 RPG Icon Pack by Kyrise -- item",
  'icons, CC BY 4.0.',
  'Cool School Tileset by NettySvit -- classroom',
  'furniture, CC0.',
  'Laboratory Tileset by marceles ("Land of Pixels")',
  '-- lab furniture, CC BY 4.0.',
  'Pixel Seating by Molly "Cougarmint" Willits --',
  'auditorium seats, CC-BY 3.0.',
  '',
  'Animals:',
  'Animals Asset Pack (free licence: no resale, no',
  'NFTs; author not named in the pack) -- the cats.',
  'Free Pixel Animation: Cat by Zeenaz, CC0.',
  '[LPC] Birds by bluecarrot16, commissioned by',
  'castelonia (opengameart.org/content/lpc-birds),',
  'CC BY 4.0.',
  '',
  'Audio:',
  'RPG/UI Audio & Jingles by Kenney Vleugels --',
  'footsteps, menu sfx, jingles (kenney.nl). CC0.',
  '15 Melodic RPG Chiptunes by Aureolus_Omicron --',
  'title, overworld, mini-game and card music. CC0.',
  '',
  'A gift, never sold.',
];

class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  preload() {
    // FB-0032: a live pan over the real campus map (src/scenes/opening-backdrop.js), not the static
    // Gate 2 illustration this screen used to sit on.
    preloadCampusPanBackdrop(this);
    if (!this.textures.exists('title-fg')) this.load.image('title-fg', 'assets/cutscenes/title-fg.png');
    // The UI kit (src/scenes/ui.js): the title screen is reachable before BootScene's own preload()
    // ever runs (Play/Continue is what starts it), and its own menu/Controls/Credits panels already
    // need the 9-slice frame the instant this scene's create() runs.
    preloadUiKit(this);
    // M5 sound: the title screen is reachable before BootScene's own preload() ever runs (Play/
    // Continue is what starts it), so titleMusic needs loading here too -- AudioManager.preload()
    // skips anything already cached, so this and BootScene's later call never double-load a file.
    // `?audio=0` skips it (src/maplogic.js audioEnabled()), same as BootScene.
    if (audioEnabled()) AudioManager.preload(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a');
    this.stage = 'intro'; // 'intro' -> 'menu'

    this.buildBackground();

    this.buildLogo();
    uiText(this, GAME_WIDTH / 2, 150, 'The LUG Treasure Hunt', 8, COLORS.dim).setOrigin(0.5).setStroke('#1a1c2c', 4);

    this.pressEnter = uiText(this, GAME_WIDTH / 2, 340, 'PRESS ENTER', 12, COLORS.text).setOrigin(0.5);

    // The menu's buttons stay hidden until the "PRESS ENTER" prompt is actually pressed (showMenu()).
    this.menuIndex = 0;
    this.menuItems = this.buildMenuItems();
    this.buildMenu();

    this.controls = new ControlsPanel(this);
    this.credits = this.buildCredits();
    this.newGameConfirm = this.buildNewGameConfirm();

    // Mouse click also reveals the menu from the intro prompt (the owner plays in a browser); once
    // revealed, the menu's own buttons own clicks instead (see buildMenu() above).
    this.input.on('pointerdown', () => { if (this.stage === 'intro') this.showMenu(); });

    // FB-0037/FB-0040/M5 sound: while the "start a new game?" confirm is open, Up/Down move its
    // No/Yes highlight; while the (shared) Controls/Sound panel is open, they move its highlighted
    // settings row; while Credits is open, they scroll its (possibly-clipped) content. All three
    // checks come before moveMenu() so the title menu's own highlight never moves underneath an open
    // overlay -- and the three overlays are never open at once (each only opens from the plain menu),
    // so this priority order never actually has to arbitrate between two of them at the same time.
    for (const key of ['UP', 'W']) {
      this.input.keyboard.on(`keydown-${key}`, (e) => {
        if (e.repeat) return;
        if (this.newGameConfirm.visible) this.moveNewGameConfirm(-1);
        else if (this.controls.visible) this.controls.moveSetting(-1);
        else if (this.credits.visible) this.scrollCredits(-1);
        else this.moveMenu(-1);
      });
    }
    for (const key of ['DOWN', 'S']) {
      this.input.keyboard.on(`keydown-${key}`, (e) => {
        if (e.repeat) return;
        if (this.newGameConfirm.visible) this.moveNewGameConfirm(1);
        else if (this.controls.visible) this.controls.moveSetting(1);
        else if (this.credits.visible) this.scrollCredits(1);
        else this.moveMenu(1);
      });
    }
    // M5 sound: Left/Right adjust the highlighted setting row while the Controls panel's open --
    // otherwise unused by the title menu itself (it's Up/Down + Enter only), so no collision.
    for (const key of ['LEFT', 'A']) {
      this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.controls.visible) this.controls.adjustSetting(-1); });
    }
    for (const key of ['RIGHT', 'D']) {
      this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat && this.controls.visible) this.controls.adjustSetting(1); });
    }
    for (const key of ['ENTER', 'SPACE']) this.input.keyboard.on(`keydown-${key}`, (e) => { if (!e.repeat) this.onConfirm(); });
    this.input.keyboard.on('keydown-ESC', (e) => { if (!e.repeat) this.onCancel(); });
  }

  // "A little 3D" (docs/GAME_FEEL.md): two backdrop layers moving at different speeds is what makes
  // parallax read as depth rather than one flat picture -- FB-0032 replaced the far layer's own
  // content (it used to be the static Gate 2 illustration) with a live, slowly panning render of the
  // real campus map (buildCampusPanBackdrop(), src/scenes/opening-backdrop.js), but the *shape* of
  // this parallax (a slow far layer dimmed under the overlay, a faster near silhouette strip on top of
  // it at full contrast) is unchanged from before this pass. The near silhouette sits ON TOP of that
  // overlay, at full contrast -- the way a genuinely nearer layer would actually look darker/crisper
  // than the hazy backdrop behind it, and (found by looking at the first screenshot of this) the only
  // way the strip doesn't just vanish into the overlay's own near-black tint.
  buildBackground() {
    this.bg = buildCampusPanBackdrop(this, { alpha: 0.3 });

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

  // Quality-loop category 4 run 2: a crisp drop shadow + outline, no ghosting. The old version used a
  // canvas `setShadow(blur: 4)` alongside a thick 7px stroke -- at this size the blur softened the
  // shadow into a second, blurry silhouette sitting behind the sharp stroke, reading as a duplicate
  // rather than a shadow (the same failure mode flagged on the card's own title glow). This is a
  // second, unblurred, solid text object offset down-right (STYLE_GUIDE "one light source, top-left"
  // -- shadows fall bottom-right) instead: genuinely crisp because there's no blur anywhere.
  // The shine (GAME_FEEL.md "gentle life... subtle"): a slow, periodic brighten-toward-white-and-back
  // tint pulse, not a masked sweeping highlight bar -- Bitmap masking (the usual way to sweep a
  // highlight clipped to text/letter shapes) isn't supported at all under the Canvas renderer, and
  // this game's `Phaser.AUTO` config can fall back to it, so a tint pulse is the renderer-safe choice.
  buildLogo() {
    const style = { fontFamily: FONT, fontSize: '30px', color: COLORS.highlight };
    this.add.text(GAME_WIDTH / 2 + 3, 112, 'BITS DUBAI', { ...style, color: '#000000' }).setOrigin(0.5).setAlpha(0.45);
    const logo = this.add.text(GAME_WIDTH / 2, 108, 'BITS DUBAI', style).setOrigin(0.5).setStroke('#1a1c2c', 5);

    const shine = { t: 0 };
    const base = Phaser.Display.Color.ValueToColor(0xffd23f);
    const bright = Phaser.Display.Color.ValueToColor(0xffffff);
    this.tweens.add({
      targets: shine, t: 1, duration: 1000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, repeatDelay: 3400,
      onUpdate: () => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(base, bright, 100, Math.round(shine.t * 100));
        logo.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });
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
  // M5 sound (docs/ROADMAP.md rule 5): this keypress/click is the natural first real gesture almost
  // every player makes, so it's where the title music actually starts -- Phaser's own SoundManager
  // queues the play() call if the browser's autoplay lock hasn't lifted yet at this exact instant and
  // flushes it the moment it does, so this never needs to check "am I unlocked yet" itself.
  showMenu() {
    this.stage = 'menu';
    this.pressEnter.setVisible(false);
    this.menuButtons.forEach((button) => button.setVisible(true));
    AudioManager.playMusic('titleMusic');
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

  // FB-0037: the old text here ("All art and code original, made for this game") was simply false --
  // this game leans on a stack of third-party art/data packs and a font, every one of them under a
  // licence that (per CREDITS.md, the source of truth this is built from) requires exactly this kind
  // of on-screen credit. Rebuilt from CREDITS.md's own wording rather than restating it from memory,
  // and sized from its own wrapped content (docs/GAME_FEEL.md rule 1) with a scrollable viewport for
  // the (unlikely, but not impossible) case a future addition makes the list taller than the screen
  // has room for -- "must size to its content or scroll/page", never overflow at 960x540 either way.
  buildCredits() {
    const w = 680;
    const maxH = GAME_HEIGHT - 40; // leaves a margin top/bottom even if the content is this tall
    const headerH = 48;
    const footerH = 30;
    const lineH = 13;
    const wrapWidth = w - 80;

    // A throwaway text object gives the exact wrap Phaser will use for the real one (the same trick
    // src/scenes/ui.js's DialogBox/JournalPanel already use for their own wrapped text), so the
    // panel's height is measured from the *wrapped* line count, not the raw paragraph count.
    const measurer = uiText(this, 0, 0, '', 8).setWordWrapWidth(wrapWidth).setLineSpacing(5).setVisible(false);
    const wrapped = [];
    for (const para of CREDITS_LINES) {
      if (para === '') { wrapped.push(''); continue; }
      wrapped.push(...measurer.getWrappedText(para));
    }
    measurer.destroy();

    const contentH = wrapped.length * lineH;
    const h = Math.min(maxH, headerH + contentH + footerH);
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);
    const viewportH = h - headerH - footerH;
    const scrollable = contentH > viewportH;
    const maxScroll = Math.max(0, contentH - viewportH);

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0);
    const panel = makePanel(this, x, y, w, h);
    const title = uiText(this, GAME_WIDTH / 2, y + 22, 'CREDITS', 12, COLORS.highlight).setOrigin(0.5);

    const viewX = x + 20;
    const viewY = y + headerH;
    const body = uiText(this, x + 40, viewY, wrapped.join('\n'), 8, COLORS.text).setLineSpacing(5);
    // Clips the body text to the panel's own content area -- without this, scrolled-past lines would
    // just draw over the header/footer instead of being hidden (the whole point of a viewport).
    const maskShape = this.make.graphics({}, false);
    maskShape.fillStyle(0xffffff).fillRect(viewX, viewY, w - 40, viewportH);
    body.setMask(maskShape.createGeometryMask());

    const footerText = scrollable ? 'UP/DOWN TO SCROLL -- ESC/ENTER TO CLOSE' : 'ESC / ENTER TO CLOSE';
    const footer = uiText(this, GAME_WIDTH / 2, y + h - 20, footerText, 8, COLORS.dim).setOrigin(0.5);
    const parts = [dim, panel, title, body, footer];
    parts.forEach((part) => part.setDepth(115).setVisible(false));
    return { parts, maskShape, body, viewY, viewportH, contentH, maxScroll, scroll: 0, visible: false, box: { x, y, w, h } };
  }

  openCredits() {
    this.credits.visible = true;
    this.credits.scroll = 0;
    this.credits.body.setY(this.credits.viewY);
    this.credits.parts.forEach((part) => part.setVisible(true));
  }

  // Up/Down while Credits is open scroll it instead of moving the title menu's own highlight (see the
  // UP/DOWN keydown handlers in create()); a no-op once every line already fits (maxScroll === 0).
  scrollCredits(direction) {
    const c = this.credits;
    if (!c.maxScroll) return;
    const next = Phaser.Math.Clamp(c.scroll + direction * 3 * 13, 0, c.maxScroll);
    if (next === c.scroll) return; // already at the top/bottom -- nothing moved, so no sound either
    c.scroll = next;
    c.body.setY(c.viewY - c.scroll);
    // M5 sound: the same menuMove tick every other keyboard-driven highlight/scroll in this game
    // plays (moveMenu(), ControlsPanel.moveSetting(), moveNewGameConfirm() below) -- a scrolling
    // panel is still "moving the highlight" in spirit, just over content instead of a menu row.
    AudioManager.play('menuMove');
  }

  closeCredits() {
    this.credits.visible = false;
    this.credits.parts.forEach((part) => part.setVisible(false));
  }

  moveMenu(direction) {
    if (this.stage !== 'menu' || this.controls.visible || this.credits.visible || this.newGameConfirm.visible) return;
    this.menuIndex = (this.menuIndex + direction + this.menuItems.length) % this.menuItems.length;
    this.refreshMenu();
    AudioManager.play('menuMove');
  }

  refreshMenu() {
    this.menuButtons.forEach((button, i) => button.setFocused(i === this.menuIndex));
  }

  // Enter/Space: reveals the menu from the intro prompt the first time, confirms the highlighted
  // button every time after (docs/GAME_FEEL.md -- one prompt at a time, never both on screen).
  onConfirm() {
    if (this.newGameConfirm.visible) { this.confirmNewGameConfirm(); return; }
    if (this.controls.visible) { this.controls.close(); return; }
    if (this.credits.visible) { this.closeCredits(); return; }
    if (this.stage === 'intro') { this.showMenu(); return; }
    // A keyboard confirm gets the same press-then-release visual a click does (Button.flashPress),
    // so Enter and a mouse click feel identical (docs/GAME_FEEL.md rule 7).
    this.menuButtons[this.menuIndex].flashPress(() => this.confirmMenu());
  }

  onCancel() {
    // FB-0040: Esc always means "No" here -- it never starts a new game, same spirit as every other
    // modal in this game where Esc is the safe/no-op way out (docs/GAME_FEEL.md).
    if (this.newGameConfirm.visible) { this.resolveNewGameConfirm(false); return; }
    if (this.controls.visible) this.controls.close();
    else if (this.credits.visible) this.closeCredits();
  }

  confirmMenu() {
    AudioManager.play('menuConfirm');
    const item = this.menuItems[this.menuIndex];
    // FB-0040: "Play" used to silently reset the game state (and, the moment autosave next fired,
    // overwrite whatever save already existed) with no way to back out. Continue/Watch the Card Again
    // never touch the save, so they're unaffected.
    if (item.id === 'play') {
      if (saveEnabled() && hasSaveFile(currentProfile())) this.openNewGameConfirm();
      else this.startPlay(false);
    } else if (item.id === 'continue') this.startPlay(true);
    else if (item.id === 'watch-card') this.watchCardAgain();
    else if (item.id === 'controls') this.controls.open();
    else if (item.id === 'credits') this.openCredits();
  }

  // ---------- FB-0040: "start a new game? your save will be replaced" ----------
  // Shown only when "Play" (new game) is chosen and a save already exists -- Continue/Watch the Card
  // Again never touch the save, so they skip this entirely (confirmMenu() above). Built once in
  // create(), the same "measure once, redraw on state change" shape every other panel in this file
  // already uses, reusing makePanel()/Button exactly as the brief asks.
  buildNewGameConfirm() {
    const w = 460;
    const h = 190;
    const x = Math.round((GAME_WIDTH - w) / 2);
    const y = Math.round((GAME_HEIGHT - h) / 2);

    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6).setOrigin(0, 0);
    const panel = makePanel(this, x, y, w, h);
    const title = uiText(this, GAME_WIDTH / 2, y + 40, 'Start a new game?', 12, COLORS.highlight).setOrigin(0.5);
    const sub = uiText(this, GAME_WIDTH / 2, y + 68, 'Your saved game will be replaced.', 8, COLORS.text).setOrigin(0.5);

    const items = [{ id: 'no', label: 'No' }, { id: 'yes', label: 'Yes' }]; // 'No' is index 0: the safe default
    const btnW = 160;
    const btnH = 44;
    const gap = 20;
    const bx = x + (w - (btnW * 2 + gap)) / 2;
    const by = y + h - btnH - 30;
    const buttons = items.map((it, i) => new Button(this, bx + i * (btnW + gap), by, btnW, btnH, it.label, () => {
      this.newGameConfirm.index = i;
      this.refreshNewGameConfirm();
      this.resolveNewGameConfirm(it.id === 'yes');
    }));

    const parts = [dim, panel, title, sub];
    parts.forEach((part) => part.setDepth(118).setVisible(false));
    buttons.forEach((button) => button.setVisible(false));
    return { parts, buttons, items, index: 0, visible: false };
  }

  openNewGameConfirm() {
    const c = this.newGameConfirm;
    c.visible = true;
    c.index = 0; // 'No', highlighted by default (FB-0040 brief)
    c.parts.forEach((part) => part.setVisible(true));
    c.buttons.forEach((button) => button.setVisible(true));
    this.refreshNewGameConfirm();
  }

  closeNewGameConfirm() {
    const c = this.newGameConfirm;
    c.visible = false;
    c.parts.forEach((part) => part.setVisible(false));
    c.buttons.forEach((button) => button.setVisible(false));
  }

  moveNewGameConfirm(direction) {
    const c = this.newGameConfirm;
    c.index = (c.index + direction + c.items.length) % c.items.length;
    this.refreshNewGameConfirm();
    AudioManager.play('menuMove'); // M5 sound: the same tick moveMenu()/ControlsPanel.moveSetting() use
  }

  refreshNewGameConfirm() {
    const c = this.newGameConfirm;
    c.buttons.forEach((button, i) => button.setFocused(i === c.index));
  }

  // Enter/Space confirms whichever of No/Yes is currently highlighted.
  confirmNewGameConfirm() {
    const c = this.newGameConfirm;
    this.resolveNewGameConfirm(c.items[c.index].id === 'yes');
  }

  resolveNewGameConfirm(startNewGame) {
    // M5 sound: every way this panel resolves (Yes, No, or Esc-as-No) is a real, deliberate choice
    // the player just made -- the same menuConfirm DialogBox.confirmChoice() plays regardless of
    // which choice was picked, not just a "successful" one.
    AudioManager.play('menuConfirm');
    this.closeNewGameConfirm();
    if (startNewGame) this.startPlay(false);
    // 'No': just closes, back to the menu exactly as it was -- no game state touched.
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
