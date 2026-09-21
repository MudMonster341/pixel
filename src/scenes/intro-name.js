// M3a opening, step 2 (docs/STORY.md "Opening", owner brief 2026-09-21): Mustafa asks her name.
// Two input paths, both live at once (owner brief: "on-screen keyboard plus real typing"):
//   - Real typing: letter/space/backspace keys are read directly off the keyboard.
//   - An on-screen keyboard grid, navigated with the arrow keys and activated with Enter, or clicked
//     with the mouse -- the same "keyboard and mouse, arrows + Enter" shape docs/GAME_FEEL.md already
//     uses for every other menu in this game.
// A sensible default (GameState.playerName's own default, src/state.js) is pre-filled and focus
// starts on the on-screen OK key, so a single Enter press (or Esc) accepts it and skips the whole
// screen -- letters and spaces only, max 10 characters. Chains to 'customize' next.

const NAME_MAX = 10;

// Each row is a list of keys; letters default to `type: 'letter'` and a 44px cell, the bottom row's
// wider special keys spell that out themselves. Ragged row lengths are fine -- moveFocus() below
// clamps the column when moving between rows of different widths.
const KEY_ROWS = [
  [...'QWERTYUIOP'].map((label) => ({ label, type: 'letter' })),
  [...'ASDFGHJKL'].map((label) => ({ label, type: 'letter' })),
  [...'ZXCVBNM'].map((label) => ({ label, type: 'letter' })),
  [{ label: 'SPACE', type: 'space', w: 140 }, { label: 'DEL', type: 'del', w: 90 }, { label: 'OK', type: 'ok', w: 90 }],
];
const KEY_H = 44;
const KEY_W = 44;
const KEY_GAP = 6;

class NameEntryScene extends Phaser.Scene {
  constructor() {
    super('name-entry');
  }

  preload() {
    if (!this.textures.exists('mustafa-portrait')) this.load.image('mustafa-portrait', 'assets/cutscenes/mustafa.png');
    if (!this.textures.exists('title-bg')) this.load.image('title-bg', 'assets/cutscenes/gate2.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a').fadeIn(250, 0, 0, 0);
    this.finished = false;
    this.name = (GameState.playerName || '').toUpperCase();
    this.touched = false; // clears the pre-filled default on the first keypress -- see typeChar()

    // Same dimmed gate backdrop as the greeting screen (docs/GAME_FEEL.md), for visual continuity
    // across the whole opening chain rather than a flat navy void behind the keyboard.
    const tex = this.textures.get('title-bg').getSourceImage();
    const bgScale = GAME_WIDTH / tex.width;
    this.add.image(GAME_WIDTH / 2, -(tex.height * bgScale - GAME_HEIGHT) * 0.4, 'title-bg').setOrigin(0.5, 0).setScale(bgScale).setAlpha(0.18);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12131a, 0.7).setOrigin(0, 0);

    this.add.image(96, 90, 'mustafa-portrait').setScale(0.9);
    uiText(this, 170, 60, 'Mustafa', 12, COLORS.highlight);
    uiText(this, 170, 90, "What's your name?", 12, COLORS.text).setWordWrapWidth(600);

    // The name field: a panel with the typed name, big and centered, and a blinking text cursor.
    const fieldW = 360;
    const fieldH = 52;
    const fieldX = (GAME_WIDTH - fieldW) / 2;
    const fieldY = 140;
    const fieldPanel = this.add.graphics();
    drawPanel(fieldPanel, fieldX, fieldY, fieldW, fieldH);
    this.nameText = uiText(this, GAME_WIDTH / 2, fieldY + fieldH / 2, this.name, 16, COLORS.highlight).setOrigin(0.5);
    this.cursor = uiText(this, GAME_WIDTH / 2, fieldY + fieldH / 2, '_', 16, COLORS.highlight).setOrigin(0, 0.5);
    this.hint = uiText(this, GAME_WIDTH / 2, fieldY + fieldH + 18, `LETTERS AND SPACES, UP TO ${NAME_MAX}`, 8, COLORS.dim).setOrigin(0.5);

    this.buildKeyboard(fieldY + fieldH + 44);

    // Focus starts on OK (see the file header): the whole screen is skippable with one Enter/Esc.
    this.focus = { row: KEY_ROWS.length - 1, col: KEY_ROWS[KEY_ROWS.length - 1].length - 1 };
    this.refreshFocus();
    this.refreshNameText();

    // Arrow keys only here (not the usual WASD alias every other menu in this game accepts):
    // W/A/S/D are also letters she needs to be able to type into her own name, so aliasing them to
    // navigation would silently steal focus away from OK mid-word -- exactly the bug this comment
    // used to not warn about (found by tests/e2e/intro.spec.js typing "Nadia": the 'a' and 'd' in her
    // own name kept bouncing the on-screen keyboard's focus off OK and onto DEL). Matches the brief's
    // own wording for this screen anyway: "on-screen keyboard (arrow keys + Enter, and mouse)".
    this.input.keyboard.on('keydown-UP', (e) => { if (!e.repeat) this.moveFocus(0, -1); });
    this.input.keyboard.on('keydown-DOWN', (e) => { if (!e.repeat) this.moveFocus(0, 1); });
    this.input.keyboard.on('keydown-LEFT', (e) => { if (!e.repeat) this.moveFocus(-1, 0); });
    this.input.keyboard.on('keydown-RIGHT', (e) => { if (!e.repeat) this.moveFocus(1, 0); });
    this.input.keyboard.on('keydown-ENTER', (e) => { if (!e.repeat) this.activateFocused(); });
    this.input.keyboard.on('keydown-BACKSPACE', (e) => { if (!e.repeat) this.backspace(); });
    this.input.keyboard.on('keydown-SPACE', (e) => { if (!e.repeat) this.typeChar(' '); });
    this.input.keyboard.on('keydown-ESC', (e) => { if (!e.repeat) this.confirm(); });
    // Real typing: any single printable letter key, independent of the on-screen keyboard's focus.
    this.input.keyboard.on('keydown', (event) => {
      if (event.repeat) return;
      if (event.key && event.key.length === 1 && /[a-zA-Z]/.test(event.key)) this.typeChar(event.key.toUpperCase());
    });
  }

  buildKeyboard(topY) {
    this.keyButtons = [];
    KEY_ROWS.forEach((row, rowIndex) => {
      const totalW = row.reduce((sum, k) => sum + (k.w || KEY_W), 0) + (row.length - 1) * KEY_GAP;
      let x = (GAME_WIDTH - totalW) / 2;
      const y = topY + rowIndex * (KEY_H + KEY_GAP);
      const rowButtons = row.map((keyDef) => {
        const w = keyDef.w || KEY_W;
        const button = new Button(this, x, y, w, KEY_H, keyDef.label, () => this.activateKey(keyDef));
        x += w + KEY_GAP;
        return button;
      });
      this.keyButtons.push(rowButtons);
    });
    this.footer = uiText(
      this, GAME_WIDTH / 2, topY + KEY_ROWS.length * (KEY_H + KEY_GAP) + 6,
      'ARROWS + ENTER OR CLICK · ESC TO SKIP', 8, COLORS.dim,
    ).setOrigin(0.5);
  }

  moveFocus(dx, dy) {
    let { row, col } = this.focus;
    row = Phaser.Math.Clamp(row + dy, 0, KEY_ROWS.length - 1);
    col = Phaser.Math.Clamp(col + dx, 0, KEY_ROWS[row].length - 1);
    if (dy !== 0) col = Phaser.Math.Clamp(this.focus.col, 0, KEY_ROWS[row].length - 1);
    this.focus = { row, col };
    this.refreshFocus();
  }

  refreshFocus() {
    this.keyButtons.forEach((row, r) => row.forEach((button, c) => button.setFocused(r === this.focus.row && c === this.focus.col)));
  }

  activateFocused() {
    this.activateKey(KEY_ROWS[this.focus.row][this.focus.col]);
  }

  activateKey(keyDef) {
    if (keyDef.type === 'letter') this.typeChar(keyDef.label);
    else if (keyDef.type === 'space') this.typeChar(' ');
    else if (keyDef.type === 'del') this.backspace();
    else if (keyDef.type === 'ok') this.confirm();
  }

  // Letters and spaces only, up to NAME_MAX -- no leading space, no doubled spaces (both would be an
  // odd-looking saved name with nothing gained from allowing them). The pre-filled default clears
  // itself on the very first keypress (`this.touched`), like a form field's placeholder text --
  // otherwise a player who starts typing straight over it (a very natural thing to do, and exactly
  // how `tools/qa-shots-intro.js` first caught this) ends up with the default and their own typing
  // mashed together (e.g. "AISHANADIA"), not the name they meant to type.
  typeChar(char) {
    if (!this.touched) { this.name = ''; this.touched = true; }
    if (this.name.length >= NAME_MAX) return;
    if (char === ' ' && (this.name.length === 0 || this.name.endsWith(' '))) return;
    this.name += char;
    this.refreshNameText();
  }

  backspace() {
    if (!this.touched) { this.name = ''; this.touched = true; this.refreshNameText(); return; }
    this.name = this.name.slice(0, -1);
    this.refreshNameText();
  }

  refreshNameText() {
    this.nameText.setText(this.name);
    this.cursor.setX(this.nameText.x + this.nameText.width / 2 + 2);
  }

  // Whatever's typed, trimmed; an empty field falls back to the default rather than saving a blank
  // name (the whole point of "a sensible default so it can be skipped").
  confirm() {
    if (this.finished) return;
    const trimmed = this.name.trim();
    GameState.playerName = trimmed.length ? trimmed : GameState.playerName;
    notifyStateChanged();
    this.finished = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('customize'));
  }

  update(time) {
    this.cursor.setAlpha(Math.floor(time / 400) % 2 ? 1 : 0);
  }
}
