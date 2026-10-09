// M3a opening, step 1 (docs/STORY.md "Opening", owner brief 2026-09-21): Mustafa, a friendly
// student organiser, greets her with the game's own dialog box (reusing DialogBox from
// src/scenes/ui.js exactly the way the in-world script runner does -- no new dialog UI). A
// handful of short, skippable lines: who she is, what today is, and that she's about to be asked her
// name. Reached from the title screen's "Play" (src/scenes/title.js startPlay()); chains to
// 'name-entry' next. Esc skips straight through, same as every other intro scene in this chain.
//
// Quality loop (Cutscenes run 1, 2026-09-29): "the portrait is a crude round blob... play the
// greeting in-world like the rest." Dropped the portrait card entirely -- Mustafa now stands on the
// same live campus backdrop as a real, idle-animated sprite (the exact 'npc-mustafa' texture the
// in-world script (src/scripts.js SCRIPTS.opening/gate2) spawns him as, maroon polo and all), the
// same character she'll actually meet a few screens later, not a mismatched separate portrait asset.

const GREETING_LINES = [
  // FB-0083: the owner's own opening, excited and cute (overrides the old "no birthday mention" rule for Mustafa's opening).
  'Yo pookie, how are you?! Welcome to my lil concoction!',
  'First of all, very very very very happy birthdayyyyy!!!!',
  'Hope you are alone and can play this game for a while. No interruptions, just vibes.',
  "Okay okay, let's get your name sorted before we head in. Shouldn't take a minute!",
];
const MUSTAFA_SCALE = 4;

class GreetingScene extends Phaser.Scene {
  constructor() {
    super('greeting');
  }

  preload() {
    if (!this.textures.exists('npc-mustafa')) {
      this.load.spritesheet('npc-mustafa', 'assets/npc-mustafa.png', { frameWidth: TILE, frameHeight: CHAR_HEIGHT });
    }
    preloadCampusPanBackdrop(this);
    preloadUiKit(this);
  }

  create() {
    this.cameras.main.setBackgroundColor('#12131a');
    this.finished = false;

    // FB-0032: the same live campus pan the title screen sits on (opening-backdrop.js), not a cut to a
    // different, static picture -- she's still standing at the gate for this whole conversation.
    // No cameras.main.fadeIn() here (dim.setAlpha() below is this scene's own crossfade-in instead,
    // "not a black flash" -- see this.dim's own comment). Quality loop (Cutscenes run 1): brighter
    // resting dim so the campus actually reads (was 0.22/0.55, effectively ~10% visible).
    buildCampusPanBackdrop(this, { alpha: 0.3 });
    this.dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x12131a, 0.9).setOrigin(0, 0);
    this.tweens.add({ targets: this.dim, fillAlpha: 0.35, duration: 200 });

    // Mustafa, standing on the backdrop -- same idle-animation technique intro-customize.js already
    // uses for her own live preview sprite (a slow blink/bob between the idle and idle-anim frames,
    // STYLE_GUIDE's "gentle life"), plus the same soft ground shadow every character in this game casts
    // (docs/GAME_FEEL.md "a little 3D").
    const mx = 230;
    const my = 260;
    this.add.ellipse(mx, my + CHAR_HEIGHT * MUSTAFA_SCALE * 0.32, 40, 12, 0x000000, 0.3);
    this.mustafa = this.add.sprite(mx, my, 'npc-mustafa', 0).setScale(MUSTAFA_SCALE);
    if (!this.anims.exists('greeting-mustafa-idle')) {
      this.anims.create({
        key: 'greeting-mustafa-idle',
        frames: this.anims.generateFrameNumbers('npc-mustafa', { frames: [0, 7] }),
        frameRate: 2,
        yoyo: true,
        repeat: -1,
      });
    }
    this.mustafa.play('greeting-mustafa-idle');

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
    // FB-0032: a crossfade (this scene's own foreground dims out over the same live campus backdrop
    // the next scene will also be showing), not a cut to black -- "no cut to a different picture".
    this.tweens.add({
      targets: this.dim, fillAlpha: 0.9, duration: 200,
      onComplete: () => this.scene.start('name-entry'),
    });
  }

  update(time, delta) {
    this.dialog.update(time, delta);
  }
}
