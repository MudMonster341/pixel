// M3a opening, step 4 (docs/STORY.md "Opening", owner brief 2026-09-21): "a bus drives in from
// off-screen with eased motion, stops, its door opens, the lead steps down, the bus pulls away."
// A pure cutscene-style sequence -- no player input beyond Esc to skip (the brief's own words) -- so
// unlike every other intro scene in this chain it doesn't listen for movement keys at all; there is
// simply nothing for them to do while this scene owns the screen.
//
// The existing Gate 2 cutscene (src/scenes/cutscene.js, CUTSCENES.gate2) is deliberately NOT
// re-triggered from here: this scene ends by handing off to 'boot', which starts WorldScene at the
// campus's own default spawn point (unchanged) -- a few tiles short of the gate2 cutscene trigger
// (tools/campus/build-campus.js section 17). She lands "standing outside the gate, facing in"
// exactly as the brief asks, and the very next steps she takes under her own control walk her into
// the existing trigger and play gate2 normally, the same as any other approach to that spot. Two
// separate systems (an animated hand-off cutscene and a walk-up trigger) doing two different jobs,
// not one system re-implementing the other.

const BUS_STOP_X = 560;
const BUS_START_X = 1120;
const BUS_EXIT_X = -160;
const BUS_Y = 400;
const BUS_SCALE = 2.2;
const GROUND_Y = 452;

class BusArrivalScene extends Phaser.Scene {
  constructor() {
    super('bus-arrival');
  }

  preload() {
    if (!this.textures.exists('title-bg')) this.load.image('title-bg', 'assets/cutscenes/gate2.png');
    if (!this.textures.exists('bus')) this.load.image('bus', 'assets/cutscenes/bus.png');
    // Her own chosen look (M3a customisation) -- loaded under a scene-local key so it never collides
    // with src/main.js BootScene's later load of the same file under the shared 'player' key.
    const clothes = (GameState.customization && GameState.customization.clothes) || 'pink';
    if (!this.textures.exists('player-bus')) {
      this.load.spritesheet('player-bus', `assets/player-${clothes}.png`, { frameWidth: TILE, frameHeight: CHAR_HEIGHT });
    }
  }

  create() {
    this.finished = false;
    this.cameras.main.setBackgroundColor('#12131a').fadeIn(250, 0, 0, 0);

    // Reuse the Gate 2 illustration as a static backdrop, cropped to its own lower half (the
    // road/gate/building band) rather than panned -- the bus drives along that same road.
    const tex = this.textures.get('title-bg').getSourceImage();
    const scale = GAME_WIDTH / tex.width;
    this.add.image(GAME_WIDTH / 2, -(tex.height * scale - GAME_HEIGHT), 'title-bg').setOrigin(0.5, 0).setScale(scale);

    if (!this.anims.exists('bus-walk-down')) {
      this.anims.create({ key: 'bus-walk-down', frames: this.anims.generateFrameNumbers('player-bus', { frames: [1, 2, 3, 4, 5, 6] }), frameRate: 10, repeat: -1 });
    }

    this.busShadow = this.add.ellipse(BUS_START_X, BUS_Y + 20, 70, 12, 0x000000, 0.3);
    this.bus = this.add.image(BUS_START_X, BUS_Y, 'bus').setScale(BUS_SCALE);
    // The door's local offset inside bus.png (tools/make-cutscenes.js buildBus(): a 16px-wide panel
    // near the bus's right/rear end, centered around local x=78 of its 96-wide canvas), used to place
    // both the "door opens" gap and where she appears -- px from the bus sprite's own center.
    this.doorLocalX = (78 - 96 / 2) * BUS_SCALE;

    this.doorGap = this.add.rectangle(this.bus.x + this.doorLocalX, BUS_Y + 6, 16 * BUS_SCALE * 0.4, 30 * BUS_SCALE, 0x1a1c2c, 0).setDepth(1);

    this.input.keyboard.on('keydown-ESC', (event) => { if (!event.repeat) this.skip(); });

    this.timers = [];
    this.tweensActive = [];
    this.playSequence();
  }

  delay(ms, fn) {
    this.timers.push(this.time.delayedCall(ms, fn));
  }

  tween(config) {
    const tween = this.tweens.add(config);
    this.tweensActive.push(tween);
    return tween;
  }

  // The whole arrival, one eased step at a time (docs/GAME_FEEL.md "nothing is a flat instant cut" --
  // every motion here uses an easing curve, never a linear move): drive in and decelerate to a stop,
  // pause, open the door, she steps down and the door closes, then the bus accelerates away.
  playSequence() {
    this.tween({
      targets: [this.bus, this.busShadow], x: BUS_STOP_X, duration: 2200, ease: 'Cubic.easeOut',
      onComplete: () => this.openDoor(),
    });
  }

  openDoor() {
    if (this.finished) return;
    this.doorGap.x = this.bus.x + this.doorLocalX;
    this.tween({ targets: this.doorGap, fillAlpha: 1, duration: 250 });
    this.delay(350, () => this.stepDown());
  }

  stepDown() {
    if (this.finished) return;
    const startX = this.bus.x + this.doorLocalX;
    this.lead = this.add.sprite(startX, BUS_Y - 4, 'player-bus', 0).setScale(2.4);
    this.leadShadow = this.add.ellipse(startX, GROUND_Y + 8, 20, 6, 0x000000, 0.3);
    this.lead.play('bus-walk-down');
    this.tween({
      targets: this.lead, x: startX - 46, y: GROUND_Y, duration: 700, ease: 'Sine.easeOut',
      onComplete: () => { this.lead.stop(); this.lead.setFrame(0); },
    });
    this.tween({ targets: this.leadShadow, x: startX - 46, y: GROUND_Y + 10, duration: 700, ease: 'Sine.easeOut' });
    this.delay(900, () => this.closeDoorAndLeave());
  }

  closeDoorAndLeave() {
    if (this.finished) return;
    this.tween({ targets: this.doorGap, fillAlpha: 0, duration: 250 });
    this.delay(500, () => {
      this.tween({
        targets: [this.bus, this.busShadow], x: BUS_EXIT_X, duration: 1600, ease: 'Cubic.easeIn',
        onComplete: () => this.delay(400, () => this.finish()),
      });
    });
  }

  // Esc: stop every tween/timer where it is and jump straight to the same end state playSequence()
  // would have reached on its own (docs/GAME_FEEL.md rule 7, "every screen reachable/skippable"),
  // rather than snapping visuals to a half-finished frame.
  skip() {
    if (this.finished) return;
    this.timers.forEach((timer) => timer.remove());
    this.tweensActive.forEach((tween) => tween.stop());
    this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('boot'));
  }
}
