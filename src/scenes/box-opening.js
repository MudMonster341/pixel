// The reward box's opening (docs/STORY.md "the box opens...", docs/ROADMAP.md M3): the volunteer's
// 'reward' dialog entry ends with `{ boxOpening: true }` (src/dialog.js, src/story.js) the instant
// she's turned in all 3 keys -- this scene plays that moment, then hands off to the birthday card
// (src/scenes/card.js) and never returns to 'world' (the game is over from here, docs/ROADMAP.md M3
// "ends... returns to the title screen"). Launched by WorldScene.playBoxOpening() exactly like
// src/scenes/cutscene.js is launched for a cutscene: 'world' is paused first, but unlike a cutscene
// this scene doesn't resume it -- it starts the 'card' scene instead.
//
// Two versions, same beats (box appears -> lid creaks open -> golden light and sparkles rise ->
// screen fills with light -> the card begins), per the owner's own brief and
// docs/research/cutscene-video-prompts.md "Prompt 3":
//   - if assets/cutscenes/video/box-opening.mp4 exists, it plays instead of the drawn version
//   - otherwise (the default -- that folder is empty until the owner supplies clips) the drawn
//     sequence below plays, using the pixel art from tools/make-card-art.js
// Either way, Esc is only honored once the box is FULLY open (`this.canSkip`) -- the brief's own
// words, "don't let a stray keypress rob the moment": a player who's been mashing E/Enter/Space to
// get through the volunteer's last line shouldn't accidentally skip straight past the moment the box
// even appears.

const BOX_SKIP_FADE_MS = 300;

class BoxOpeningScene extends Phaser.Scene {
  constructor() {
    super('box-opening');
  }

  init() {
    this.canSkip = false;
    this.finished = false;
  }

  preload() {
    if (!this.textures.exists('card-box-base')) this.load.image('card-box-base', 'assets/cutscenes/card-box-base.png');
    if (!this.textures.exists('card-box-lid')) this.load.image('card-box-lid', 'assets/cutscenes/card-box-lid.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1610');
    this.cameras.main.fadeIn(250, 0, 0, 0);

    this.input.keyboard.on('keydown-ESC', (event) => {
      if (!event.repeat) this.onEsc();
    });

    this.checkVideoThenPlay();
  }

  // The owner-supplied video (see the file header): checked with a plain fetch() first, NOT by
  // queuing it straight into Phaser's own loader and trusting 'loaderror' -- found the hard way
  // (tools/qa-shots.js) that Phaser's video loader can add a broken <video> to cache.video even after
  // the underlying request 404s, so `cache.video.has(key)` alone is not a reliable "did this actually
  // load" check. A fetch that resolves `ok: false` (or rejects/throws, e.g. no network at all) always
  // means "no real video" -- exactly the default, expected case until the owner drops a clip in
  // (that folder is gitignored and empty by default, docs/STORY.md), so this must never hang or throw.
  checkVideoThenPlay() {
    fetch(BOX_VIDEO_URL)
      .then((response) => {
        if (!response.ok) { this.playDrawnSequence(); return; }
        this.load.video('box-video', BOX_VIDEO_URL);
        this.load.once('complete', () => this.playVideoSequence());
        this.load.once('loaderror', () => this.playDrawnSequence());
        this.load.start();
      })
      .catch(() => this.playDrawnSequence());
  }

  // ---------- video version ----------
  playVideoSequence() {
    try {
      const video = this.add.video(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'box-video');
      this.videoObj = video;
      const source = video.video;
      const scale = source && source.videoWidth ? GAME_WIDTH / source.videoWidth : 1;
      video.setScale(scale);
      video.play(false);
      // "Fully open" has no clean video-level marker (unlike the drawn version's own lid-open tween)
      // -- a couple of seconds in is a reasonable stand-in for "past the point where skipping would
      // rob the moment", matching this scene's own skip rule (see the file header).
      this.time.delayedCall(2000, () => { this.canSkip = true; });
      video.once('complete', () => this.finish());
    } catch (error) {
      console.warn('box-opening: video playback failed, falling back to the drawn sequence', error);
      this.playDrawnSequence();
    }
  }

  // ---------- drawn version (tools/make-card-art.js art) ----------
  // Scale 5 (not the art's native size) so the box reads as the hero of a full 960x540 frame instead
  // of a small sprite lost in a dark void -- this is the emotional payoff of the whole game, it has
  // to fill the screen the way a cutscene illustration does (found by looking at the first pass via
  // tools/qa-shots.js: too small, too much empty black).
  playDrawnSequence() {
    const cx = GAME_WIDTH / 2;
    const scale = 5;
    const baseY = 400; // the box's own bottom edge
    const mouthY = baseY - 40 * scale + 4; // just inside the box's own top edge (card-box-base.png is 40 tall)

    this.buildVignette(cx, mouthY);

    // The constructor's alpha arg sets `fillAlpha`, not the GameObject's own `.alpha` (the same
    // gotcha src/minigames/framework-scene.js's own MinigameCard.show() already documents) -- fill
    // alpha is set to its final value (1, fully opaque gold once revealed) here, and it's the
    // object's own `.alpha` that starts at 0 and gets tweened up in riseLight() below. Tweening
    // `alpha` against a 0 fillAlpha (the first version of this code) stayed invisible the whole time.
    this.glowFill = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xfff1a8, 1).setOrigin(0, 0).setDepth(30).setAlpha(0);
    this.glowBloom = this.add.circle(cx, mouthY, 14, 0xfff1a8, 1).setDepth(20).setAlpha(0);

    this.box = this.add.image(cx, baseY, 'card-box-base').setOrigin(0.5, 1).setScale(scale).setAlpha(0).setDepth(10);
    this.lid = this.add.image(cx, mouthY, 'card-box-lid').setOrigin(0.5, 1).setScale(scale).setAlpha(0).setAngle(0).setDepth(11);

    // Beat 1: "the box appears in front of her" -- a little bounce-in, not an instant pop.
    this.tweens.add({
      targets: [this.box, this.lid], alpha: 1, scale: { from: scale * 0.75, to: scale }, duration: 420, ease: 'Back.easeOut',
      onComplete: () => this.time.delayedCall(260, () => this.openLid()),
    });
  }

  // A warm pool of light already sitting around the box before it even opens (a few concentric,
  // low-alpha ellipses, cheapest possible stand-in for a radial gradient) -- so the scene reads as a
  // cozy, lit moment from the very first frame instead of a sprite floating in flat black.
  buildVignette(cx, cy) {
    const g = this.add.graphics().setDepth(1);
    const rings = [
      { rx: 480, ry: 300, hex: 0x3a2418, alpha: 0.5 },
      { rx: 340, ry: 220, hex: 0x5a3a22, alpha: 0.45 },
      { rx: 220, ry: 150, hex: 0x8a5a30, alpha: 0.35 },
      { rx: 130, ry: 95, hex: 0xc88a44, alpha: 0.22 },
    ];
    for (const ring of rings) {
      g.fillStyle(ring.hex, ring.alpha);
      g.fillEllipse(cx, cy + 40, ring.rx, ring.ry);
    }
  }

  // Beat 2: "the lid creaks open" -- a small resistant wobble, then it actually lifts up and off to
  // the side (not just rotated in place around the box's own top edge). A pure hinge-rotation was
  // tried first and looked wrong at any angle wide enough to read as "open": with the pivot sitting
  // on the box's own top edge, swinging the lid past ~45 degrees always drags its far end back down
  // across the box's own front face, rendering on top of it -- it read as the lid slicing into the
  // box, not lifting off it (found via tools/qa-shots.js's box-opening frames, a real visual bug, not
  // a guess). Lifting it clear of the box entirely, with only a modest tilt, sidesteps the geometry
  // problem outright and reads as "the lid comes off" rather than "the lid folds back".
  openLid() {
    this.tweens.add({
      targets: this.lid, angle: -8, duration: 140, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.lid, y: '-=110', x: '-=34', angle: -34, alpha: 0.3, duration: 560, ease: 'Back.easeOut',
          onComplete: () => this.riseLight(),
        });
      },
    });
  }

  // Beat 3 + 4: "golden light and pixel sparkles rise, the screen fills with light" -- from here on
  // Esc is allowed (the box has fully, visibly opened).
  riseLight() {
    this.canSkip = true;
    this.tweens.add({ targets: this.glowBloom, alpha: 0.9, radius: 46, duration: 300, ease: 'Sine.easeOut' });

    const cx = this.glowBloom.x;
    const cy = this.glowBloom.y;
    this.sparkleTimer = this.time.addEvent({
      delay: 70, repeat: 13,
      callback: () => spawnSparkle(this, cx + Phaser.Math.Between(-14, 14), cy),
    });

    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: this.glowFill, alpha: 1, duration: 700, ease: 'Sine.easeIn',
        onComplete: () => this.finish(),
      });
    });
  }

  // Esc, before the box is open: ignored outright (the brief's own words -- see the file header).
  // Esc, once it's open: jumps straight to the same white-out finish() the sequence ends on anyway,
  // never a different/cruder skip -- so skipping never looks worse than watching it play out. Killing
  // every tween mid-flight could otherwise leave glowFill still at alpha 0 (canSkip flips true right
  // as riseLight() starts, before its own fade has actually run) -- snapping it straight to its own
  // end state keeps that promise true regardless of exactly when Esc landed.
  onEsc() {
    if (!this.canSkip || this.finished) return;
    if (this.sparkleTimer) this.sparkleTimer.remove();
    this.tweens.killAll();
    if (this.glowFill) this.glowFill.setAlpha(1);
    if (this.videoObj) { try { this.videoObj.stop(); } catch (error) { /* already stopped */ } }
    this.finish();
  }

  // The scene's own end state is already full light (the drawn version fades a full-screen rect to
  // opaque; the video's last frame is whatever the clip ends on) -- src/scenes/card.js starts on the
  // same warm-light background color, so this hands off without a hard cut (docs/GAME_FEEL.md).
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.time.delayedCall(BOX_SKIP_FADE_MS, () => this.scene.start('card'));
  }
}

// A small gold spark that pops up and out from the box's mouth and fades -- the same cheap
// texture-free "juice" technique as spawnDustPuff() in src/minigames/framework-scene.js (a landing
// puff there, a birthday spark here), reused rather than reinvented.
function spawnSparkle(scene, x, y) {
  const dx = Phaser.Math.Between(-18, 18);
  const rise = Phaser.Math.Between(50, 90);
  const size = Phaser.Math.Between(2, 4);
  const hex = Phaser.Math.Between(0, 1) ? 0xffd23f : 0xfff1a8;
  const mote = scene.add.circle(x, y, size, hex, 0.95).setDepth(21);
  scene.tweens.add({
    targets: mote, x: x + dx, y: y - rise, alpha: 0, scale: 0.3, duration: 700, ease: 'Cubic.easeOut',
    onComplete: () => mote.destroy(),
  });
}
