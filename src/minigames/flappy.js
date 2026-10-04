// The ICL key's mini-game (docs/STORY.md): a flappy-bird-style flyer through gaps in a row of
// "server racks" (the ICL's own computing-lab flavor). Physics/collision are the pure functions in
// src/minigames/flappy-logic.js; this file only draws the room and forwards the flap key.
//
// Quality loop pass (Mini-games category, rated 4/10 -- "the hero is a speck"): she now draws at
// HERO_SCALE (framework-scene.js, 3x, matching the main game's own pixel scale) via a plain
// `sprite.setScale()`. FL_* below and flappy-logic.js's own gravity/flap constants were authored at a
// smaller "compact" scale first and then uniformly multiplied by 3 (see platformer.js's own file
// header for why that preserves every fairness ratio) -- including FLAPPY_BIRD_RADIUS, which now
// scales with HERO_SCALE too (the platformer keeps its own hitbox roughly matching HERO_SCALE the
// same way). The backdrop is one richer, brighter, more layered image now (tools/make-minigame-art.js,
// generated at the compact scale and stretched 3x here, crisp under pixelArt:true); racks/LEDs/
// ambient particles are all rescaled to fit.

const FL_BIRD_X = 210;
const FL_GAP_HEIGHT = 240;
const FL_PIPE_WIDTH = 54;
const FL_PIPE_SPACING = 270; // px between successive rack centers
const FL_SCROLL_SPEED = 168; // px/s
const FL_GROUND_Y = GAME_HEIGHT - 60;
const FL_GAP_MARGIN = 60; // keeps a gap's own edges away from the very top/ground
const FL_LED_COLORS = [0xff5a5a, 0x8fd46a, 0xffd23f, 0x7fe0ff];
const FL_BLINK_MS = 450; // well under "nothing flashes faster than 3 times a second" (STYLE_GUIDE.md)

class FlappyScene extends MinigameBaseScene {
  constructor() {
    super('minigame-flappy');
  }

  preload() {
    if (!this.textures.exists('flappy-bg')) this.load.image('flappy-bg', 'assets/minigames/flappy-bg.png');
  }

  buildScene() {
    this.add.image(0, 0, 'flappy-bg').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-10);

    // A cold, raised server-room floor (not the old wood-brown ground) -- a tile strip with a grid,
    // matching the backdrop's own floor band right above it.
    this.add.rectangle(GAME_WIDTH / 2, FL_GROUND_Y + 12, GAME_WIDTH, 24, 0x26313f).setDepth(5);
    const grid = this.add.graphics().setDepth(6);
    grid.lineStyle(1, 0x3a4a5c, 0.6);
    for (let x = 0; x < GAME_WIDTH; x += 30) grid.lineBetween(x, FL_GROUND_Y, x, GAME_HEIGHT);
    grid.lineBetween(0, FL_GROUND_Y, GAME_WIDTH, FL_GROUND_Y);
    this.buildAmbientSparks();

    ensurePlayerAnims(this);
    // Facing right (the direction she's travelling through the room): FB-0043's own real right-facing
    // art now, not a mirrored left frame (world.js/framework-scene.js no longer mirror anything).
    this.bird = this.add.sprite(FL_BIRD_X, GAME_HEIGHT / 2, 'player', HERO_IDLE_FRAME.right).setScale(HERO_SCALE).setDepth(10);
    this.pipes = [];

    // FB-0042: a "get ready" beat -- she hovers with a gentle bob and a prompt instead of immediately
    // falling under gravity through a level that's already scrolling before the player has done
    // anything. `flying` (set on the very first real flap, in flap() below) gates every bit of that:
    // playUpdate() below returns before gravity, pipe-scrolling or collision run at all while it's
    // false, and startAttempt() resets it fresh for every attempt including a retry.
    this.flying = false;
    this.hoverPrompt = uiText(this, FL_BIRD_X, GAME_HEIGHT / 2 - 60, 'PRESS SPACE TO FLAP', 10, COLORS.highlight)
      .setOrigin(0.5).setDepth(11).setStroke('#1a1c2c', 4);

    this.blinkOn = true;
    this.time.addEvent({ delay: FL_BLINK_MS, loop: true, callback: () => { this.blinkOn = !this.blinkOn; this.applyBlink(); } });

    for (const key of ['SPACE', 'UP', 'W']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => {
        if (!event.repeat && this.mgState === 'playing') this.flap();
      });
    }
  }

  // Ambient "data spark" particles (coordinator brief "juice": "ambient particles") -- cool, tiny
  // specks drifting slowly through the room, the flyer's own equivalent of the platformer's dust
  // motes. Purely decorative, well under the "nothing flashes faster than 3Hz" rule (no flashing).
  buildAmbientSparks() {
    for (let i = 0; i < 10; i++) {
      const x = 30 + ((i * 213) % (GAME_WIDTH - 60));
      const y = 45 + ((i * 111) % (FL_GROUND_Y - 75));
      const spark = this.add.circle(x, y, 3, 0x9fe0ff, 0.3 + (i % 3) * 0.08).setDepth(4);
      this.tweens.add({
        targets: spark, x: x - 36 - (i % 3) * 12, alpha: 0.05,
        duration: 4200 + (i % 4) * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  startAttempt() {
    this.vy = 0;
    this.flying = false;
    this.hoverPrompt.setVisible(true);
    this.bird.setVisible(true).setPosition(FL_BIRD_X, GAME_HEIGHT / 2).setRotation(0).setScale(HERO_SCALE, HERO_SCALE);
    for (const pipe of this.pipes) this.destroyRack(pipe);
    this.pipes = [];
    this.nextPipeX = GAME_WIDTH + 80;
    this.spawnPipesUpTo(GAME_WIDTH + 700);
  }

  // D08 (2026-10-04): the in-play "PRESS SPACE TO FLAP" hint and the bird used to stay visible behind the game-over and
  // win cards and bleed through their dim backdrop. Both are hidden while a card is up; startAttempt() shows them again.
  onPanelShown() {
    this.hoverPrompt.setVisible(false);
    this.bird.setVisible(false);
  }

  flap() {
    if (!this.flying) {
      this.flying = true;
      this.hoverPrompt.setVisible(false);
    }
    this.vy = flappyFlap();
    AudioManager.play('minigameFlap');
    squashStretch(this, this.bird, 'stretch'); // juice: a small squash/stretch, shared with the platformer
  }

  spawnPipesUpTo(limitX) {
    while (this.nextPipeX < limitX) {
      const gapY = Phaser.Math.Between(FL_GAP_MARGIN, FL_GROUND_Y - FL_GAP_MARGIN - FL_GAP_HEIGHT);
      const pipe = { x: this.nextPipeX, width: FL_PIPE_WIDTH, gapY, gapHeight: FL_GAP_HEIGHT, scored: false };
      pipe.top = this.drawRack(pipe.x, 0, gapY);
      pipe.bottom = this.drawRack(pipe.x, gapY + pipe.gapHeight, FL_GROUND_Y - (gapY + pipe.gapHeight));
      this.pipes.push(pipe);
      this.nextPipeX += FL_PIPE_SPACING;
    }
  }

  // A server rack (STYLE_GUIDE.md "one light source, top-left" -- a cold highlight along the top
  // edge instead), with a row of small LED lights (`leds`, toggled by applyBlink()) rather than a
  // flat grey column. `gfx` is drawn at local x = 0 and positioned via its own transform, same trick
  // as before, so scrolling is one property set, not a redraw; each LED is its own tiny rect so it can
  // blink independently without redrawing the case around it.
  drawRack(x, top, height) {
    const g = this.add.graphics().setPosition(x, 0).setDepth(8);
    g.fillStyle(0x1c2430, 1).fillRect(0, top, FL_PIPE_WIDTH, height);
    g.fillStyle(0x2a3648, 1).fillRect(0, top, FL_PIPE_WIDTH, 6); // cold highlight, top edge
    g.lineStyle(3, 0x0d1219, 1).strokeRect(0, top, FL_PIPE_WIDTH, height);
    for (let y = top + 12; y < top + height - 6; y += 15) {
      g.fillStyle(0x111820, 1).fillRect(6, y, FL_PIPE_WIDTH - 12, 9); // a unit seam
    }

    const leds = [];
    let ci = 0;
    for (let y = top + 15; y < top + height - 9; y += 15) {
      const color = FL_LED_COLORS[ci % FL_LED_COLORS.length];
      const led = this.add.rectangle(x + 12, y, 6, 6, color).setDepth(9);
      led.invert = Math.random() < 0.5; // so racks don't all blink in lockstep -- see applyBlink()
      leds.push({ obj: led, offsetX: 12 });
      ci++;
    }
    return { gfx: g, leds };
  }

  destroyRack(pipe) {
    pipe.top.gfx.destroy();
    pipe.top.leds.forEach((led) => led.obj.destroy());
    pipe.bottom.gfx.destroy();
    pipe.bottom.leds.forEach((led) => led.obj.destroy());
  }

  applyBlink() {
    for (const pipe of this.pipes) {
      for (const rack of [pipe.top, pipe.bottom]) {
        for (const led of rack.leds) led.obj.setAlpha((this.blinkOn !== led.obj.invert) ? 1 : 0.35);
      }
    }
  }

  playUpdate(time, delta) {
    // FB-0042: the "get ready" hover -- gentle bob, no gravity, no pipe scrolling, no collision --
    // until she actually flaps for the first time (flap() above).
    if (!this.flying) {
      this.bird.y = GAME_HEIGHT / 2 + Math.sin(time / 300) * 6;
      this.bird.setRotation(0);
      this.bird.anims.play('idle-right', true);
      return;
    }

    const dt = delta / 1000;
    const step = flappyStep(this.vy, this.bird.y, dt);
    this.vy = step.vy;
    this.bird.y = step.y;
    this.bird.setRotation(Phaser.Math.Clamp(this.vy / 500, -0.5, 1.0));
    this.bird.anims.play('idle-right', true);

    for (const pipe of this.pipes) {
      pipe.x -= FL_SCROLL_SPEED * dt;
      pipe.top.gfx.x = pipe.x;
      pipe.bottom.gfx.x = pipe.x;
      for (const rack of [pipe.top, pipe.bottom]) {
        for (const led of rack.leds) led.obj.x = pipe.x + led.offsetX;
      }
      if (flappyPassedPipe(pipe, FL_BIRD_X)) {
        pipe.scored = true;
        this.setScore(this.score + 1);
        if (this.score >= this.def.scoreTarget) { this.win(); return; }
      }
      if (flappyHitsPipe(FL_BIRD_X, this.bird.y, FLAPPY_BIRD_RADIUS, pipe)) { this.lose(); return; }
    }

    while (this.pipes.length && this.pipes[0].x < -FL_PIPE_WIDTH) this.destroyRack(this.pipes.shift());
    if (this.pipes.length) this.spawnPipesUpTo(this.pipes[this.pipes.length - 1].x + FL_PIPE_SPACING * 3);

    if (flappyHitsGround(this.bird.y, FLAPPY_BIRD_RADIUS, FL_GROUND_Y) || flappyHitsCeiling(this.bird.y, FLAPPY_BIRD_RADIUS)) this.lose();
  }
}
