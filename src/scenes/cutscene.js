// A Pokemon-style story beat: letterbox bars slide in, an illustration fades in with a slow pan,
// a dialog box types a couple of lines, then it all fades out and control returns to the world.
// Data lives in src/cutscenes.js (CUTSCENES); this file only knows how to play it. Launched by
// src/scenes/world.js (which pauses itself first, so the player can't move meanwhile) and stops
// itself when done, resuming the world. Esc skips straight to the end from any point.

const LETTERBOX_HEIGHT = 70;
const BAR_SLIDE_MS = 350;
const IMAGE_FADE_MS = 600;
const PAN_MS = 6000;
const FADE_OUT_MS = 300;

class CutsceneScene extends Phaser.Scene {
  constructor() {
    super('cutscene');
  }

  init(data) {
    this.cutsceneKey = data.key;
    this.def = CUTSCENES[this.cutsceneKey];
    this.returnTo = data.returnTo || 'world';
    this.finished = false;
  }

  preload() {
    if (!this.textures.exists(this.def.image)) {
      const file = this.def.image.replace(/^cutscene-/, '');
      this.load.image(this.def.image, `assets/cutscenes/${file}.png`);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    const tex = this.textures.get(this.def.image).getSourceImage();
    const scale = GAME_WIDTH / tex.width; // fill the width; the art is taller so it can pan (see cutscenes.js)
    this.image = this.add.image(GAME_WIDTH / 2, 0, this.def.image).setOrigin(0.5, 0).setScale(scale).setAlpha(0);
    this.panTo = Math.min(0, -(tex.height * scale - GAME_HEIGHT));

    this.topBar = this.add.rectangle(GAME_WIDTH / 2, -LETTERBOX_HEIGHT / 2, GAME_WIDTH, LETTERBOX_HEIGHT, 0x000000).setDepth(20);
    this.bottomBar = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT + LETTERBOX_HEIGHT / 2, GAME_WIDTH, LETTERBOX_HEIGHT, 0x000000).setDepth(20);

    // Reuses the exact dialog box look from ui.js (DialogBox supports a null speaker for a plain
    // narration box, added for this scene).
    this.dialog = new DialogBox(this);

    this.input.keyboard.on('keydown-ESC', (event) => {
      if (!event.repeat) this.skip();
    });
    for (const key of ['ENTER', 'SPACE', 'E']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => {
        if (!event.repeat) this.onAdvance();
      });
    }

    this.playIntro();
  }

  playIntro() {
    this.tweens.add({ targets: this.topBar, y: LETTERBOX_HEIGHT / 2, duration: BAR_SLIDE_MS, ease: 'Cubic.easeOut' });
    this.tweens.add({
      targets: this.bottomBar, y: GAME_HEIGHT - LETTERBOX_HEIGHT / 2, duration: BAR_SLIDE_MS, ease: 'Cubic.easeOut',
      onComplete: () => this.showImage(),
    });
  }

  showImage() {
    if (this.finished) return;
    this.tweens.add({ targets: this.image, alpha: 1, duration: IMAGE_FADE_MS, onComplete: () => this.startDialog() });
    this.tweens.add({ targets: this.image, y: this.panTo, duration: PAN_MS, ease: 'Sine.easeInOut' });
  }

  startDialog() {
    if (this.finished) return;
    this.dialog.open(this.def.speaker, this.def.lines, () => this.outro());
  }

  // E/Space/Enter: finish the line being typed, or move to the next one (same feel as the game's
  // own dialog, ERR-0001: keydown events, never JustDown).
  onAdvance() {
    if (this.finished || !this.dialog.isOpen) return;
    this.dialog.advance();
  }

  // Esc: skip straight to the fade-out, from any point in the sequence.
  skip() {
    if (this.finished) return;
    this.dialog.close(); // no-op if it isn't open; if it is, its onClose (outro) fires and wins
    this.outro();
  }

  update(time, delta) {
    this.dialog.update(time, delta); // drives the typewriter effect and the blinking arrow
  }

  outro() {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.fadeOut(FADE_OUT_MS, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const world = this.scene.get(this.returnTo);
      this.scene.stop();
      this.scene.resume(this.returnTo);
      if (world.cameras && world.cameras.main) world.cameras.main.fadeIn(FADE_OUT_MS, 0, 0, 0);
    });
  }
}
