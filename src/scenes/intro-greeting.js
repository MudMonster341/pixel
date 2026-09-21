// M3a opening, step 1 (docs/STORY.md "Opening", owner brief 2026-09-21): Mustafa, a friendly
// student organiser, greets her with a portrait + the game's own dialog box (reusing DialogBox from
// src/scenes/ui.js exactly the way src/scenes/cutscene.js already does -- no new dialog UI). A
// handful of short, skippable lines: who she is, what today is, and that she's about to be asked her
// name. Reached from the title screen's "Play" (src/scenes/title.js startPlay()); chains to
// 'name-entry' next. Esc skips straight through, same as every other intro scene in this chain.

const GREETING_LINES = [
  'Hello there!',
  "I'm Mustafa, one of the LUG organisers here at BITS Pilani, Dubai.",
  "You're a new student, and today's the day: the LUG treasure hunt kicks off right here on campus.",
  "Let's get you sorted before we head in -- shouldn't take a minute.",
];

class GreetingScene extends Phaser.Scene {
  constructor() {
    super('greeting');
  }

  preload() {
    if (!this.textures.exists('mustafa-portrait')) this.load.image('mustafa-portrait', 'assets/cutscenes/mustafa.png');
    if (!this.textures.exists('title-bg')) this.load.image('title-bg', 'assets/cutscenes/gate2.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a').fadeIn(250, 0, 0, 0);
    this.finished = false;

    // The same dimmed gate illustration the title screen sits on (docs/GAME_FEEL.md), reused rather
    // than left as bare navy -- she's still standing at the gate for this whole conversation, and a
    // flat black backdrop behind the portrait read as unfinished, not "a little 3D".
    const tex = this.textures.get('title-bg').getSourceImage();
    const scale = GAME_WIDTH / tex.width;
    this.add.image(GAME_WIDTH / 2, -(tex.height * scale - GAME_HEIGHT) * 0.4, 'title-bg').setOrigin(0.5, 0).setScale(scale).setAlpha(0.25);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12131a, 0.55).setOrigin(0, 0);

    // A soft vignette panel behind the portrait so it doesn't float on bare navy (STYLE_GUIDE.md
    // "Panels"), plus a drop shadow under the portrait itself (docs/GAME_FEEL.md "a little 3D").
    const px = 210;
    const py = 210;
    const pw = 220;
    const ph = 300;
    const panel = this.add.graphics();
    drawPanel(panel, px - pw / 2, py - ph / 2, pw, ph);
    this.add.image(px + 6, py + 10, 'mustafa-portrait').setScale(1.6).setAlpha(0.35).setTint(0x000000);
    this.add.image(px, py, 'mustafa-portrait').setScale(1.6);

    this.dialog = new DialogBox(this);
    this.input.keyboard.on('keydown-ESC', (event) => { if (!event.repeat) this.skip(); });
    for (const key of ['ENTER', 'SPACE', 'E']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => { if (!event.repeat) this.onAdvance(); });
    }
    this.input.on('pointerdown', () => this.onAdvance());

    this.dialog.open('Mustafa', GREETING_LINES, () => this.finish());
  }

  onAdvance() {
    if (this.finished || !this.dialog.isOpen) return;
    this.dialog.advance();
  }

  skip() {
    if (this.finished) return;
    this.dialog.close(); // no-op if already closed; otherwise its onClose (finish()) fires and wins
    this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('name-entry'));
  }

  update(time, delta) {
    this.dialog.update(time, delta);
  }
}
