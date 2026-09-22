// The ICVL key's mini-game (docs/STORY.md): a flappy-bird-style flyer through gaps in a row of
// "server racks" (the ICVL's own computing-lab flavor). Physics/collision are the pure functions in
// src/minigames/flappy-logic.js; this file only draws the room and forwards the flap key. Art pass
// (coordinator brief, 2026-09-22): a themed server-room backdrop (tools/make-minigame-art.js), racks
// that read as server hardware with blinking LEDs, a cold raised-floor strip, and the lead's own real
// sprite as the flyer instead of a plain yellow rectangle.

const FL_BIRD_X = 220;
const FL_GAP_HEIGHT = 130;
const FL_PIPE_WIDTH = 50;
const FL_PIPE_SPACING = 260; // px between successive rack centers
const FL_SCROLL_SPEED = 150; // px/s
const FL_GROUND_Y = GAME_HEIGHT - 24;
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

    ensurePlayerAnims(this);
    // Facing right (the direction she's travelling through the room): the sheet's own left-row art
    // mirrored, same convention world.js uses for `right`.
    this.bird = this.add.sprite(FL_BIRD_X, GAME_HEIGHT / 2, 'player', 16).setFlipX(true).setDepth(10);
    this.pipes = [];

    this.blinkOn = true;
    this.time.addEvent({ delay: FL_BLINK_MS, loop: true, callback: () => { this.blinkOn = !this.blinkOn; this.applyBlink(); } });

    for (const key of ['SPACE', 'UP', 'W']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => {
        if (!event.repeat && this.mgState === 'playing') this.flap();
      });
    }
  }

  startAttempt() {
    this.vy = 0;
    this.bird.setPosition(FL_BIRD_X, GAME_HEIGHT / 2).setRotation(0);
    for (const pipe of this.pipes) this.destroyRack(pipe);
    this.pipes = [];
    this.nextPipeX = GAME_WIDTH + 80;
    this.spawnPipesUpTo(GAME_WIDTH + 700);
  }

  flap() {
    this.vy = flappyFlap();
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
  // edge instead), with a row of small LED lights (`leds`, toggled by applyBlink()) rather than the
  // old flat grey column with plain dark slot lines. `gfx` is drawn at local x = 0 and positioned via
  // its own transform, same trick as before, so scrolling is one property set, not a redraw; each LED
  // is its own tiny rect so it can blink independently without redrawing the case around it.
  drawRack(x, top, height) {
    const g = this.add.graphics().setPosition(x, 0).setDepth(8);
    g.fillStyle(0x1c2430, 1).fillRect(0, top, FL_PIPE_WIDTH, height);
    g.fillStyle(0x2a3648, 1).fillRect(0, top, FL_PIPE_WIDTH, 4); // cold highlight, top edge
    g.lineStyle(2, 0x0d1219, 1).strokeRect(0, top, FL_PIPE_WIDTH, height);
    for (let y = top + 10; y < top + height - 6; y += 14) {
      g.fillStyle(0x111820, 1).fillRect(4, y, FL_PIPE_WIDTH - 8, 8); // a unit seam
    }

    const leds = [];
    let ci = 0;
    for (let y = top + 13; y < top + height - 7; y += 14) {
      const color = FL_LED_COLORS[ci % FL_LED_COLORS.length];
      const led = this.add.rectangle(x + 8, y, 3, 3, color).setDepth(9);
      led.invert = Math.random() < 0.5; // so racks don't all blink in lockstep -- see applyBlink()
      leds.push({ obj: led, offsetX: 8 });
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
    const dt = delta / 1000;
    const step = flappyStep(this.vy, this.bird.y, dt);
    this.vy = step.vy;
    this.bird.y = step.y;
    this.bird.setRotation(Phaser.Math.Clamp(this.vy / 500, -0.5, 1.0));
    this.bird.anims.play('idle-side', true);

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
      if (flappyHitsPipe(FL_BIRD_X, this.bird.y, 8, pipe)) { this.lose(); return; }
    }

    while (this.pipes.length && this.pipes[0].x < -FL_PIPE_WIDTH) this.destroyRack(this.pipes.shift());
    if (this.pipes.length) this.spawnPipesUpTo(this.pipes[this.pipes.length - 1].x + FL_PIPE_SPACING * 3);

    if (flappyHitsGround(this.bird.y, 8, FL_GROUND_Y) || flappyHitsCeiling(this.bird.y, 8)) this.lose();
  }
}
