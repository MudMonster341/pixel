// The ICVL key's mini-game (docs/STORY.md): a flappy-bird-style flyer through gaps in a row of
// "server racks" (the ICVL's own computing-lab flavor). Physics/collision are the pure functions in
// src/minigames/flappy-logic.js; this file only draws the racks and forwards the flap key.

const FL_BIRD_X = 220;
const FL_GAP_HEIGHT = 130;
const FL_PIPE_WIDTH = 50;
const FL_PIPE_SPACING = 260; // px between successive rack centers
const FL_SCROLL_SPEED = 150; // px/s
const FL_GROUND_Y = GAME_HEIGHT - 24;
const FL_GAP_MARGIN = 60; // keeps a gap's own edges away from the very top/ground

class FlappyScene extends MinigameBaseScene {
  constructor() {
    super('minigame-flappy');
  }

  buildScene() {
    this.add.rectangle(GAME_WIDTH / 2, FL_GROUND_Y + 12, GAME_WIDTH, 24, 0x7a5a33).setDepth(5);
    this.bird = this.add.rectangle(FL_BIRD_X, GAME_HEIGHT / 2, 16, 16, 0xffd23f).setStrokeStyle(2, 0x1a1c2c).setDepth(10);
    this.eye = this.add.circle(FL_BIRD_X + 4, GAME_HEIGHT / 2 - 3, 2, 0x1a1c2c).setDepth(11);
    this.pipes = [];
    this.pipesLayer = this.add.container(0, 0);

    for (const key of ['SPACE', 'UP', 'W']) {
      this.input.keyboard.on(`keydown-${key}`, (event) => {
        if (!event.repeat && this.mgState === 'playing') this.flap();
      });
    }
  }

  startAttempt() {
    this.vy = 0;
    this.bird.setPosition(FL_BIRD_X, GAME_HEIGHT / 2).setRotation(0);
    for (const pipe of this.pipes) { pipe.top.destroy(); pipe.bottom.destroy(); }
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

  // A "server rack": a grey column with a few darker slot lines, the ICVL's own flavor on the
  // classic flappy pipe (STYLE_GUIDE.md palette: stone ramp). Drawn at local x = 0 and positioned
  // through the Graphics object's own transform (`g.x`) instead of baking `x` into the fill calls,
  // so scrolling it each frame is a single property set, not a redraw.
  drawRack(x, top, height) {
    const g = this.add.graphics().setPosition(x, 0).setDepth(8);
    g.fillStyle(0x9a9a9a, 1).fillRect(0, top, FL_PIPE_WIDTH, height);
    g.lineStyle(2, 0x1a1c2c, 1).strokeRect(0, top, FL_PIPE_WIDTH, height);
    g.fillStyle(0x6b6b6b, 1);
    for (let y = top + 8; y < top + height - 4; y += 16) g.fillRect(6, y, FL_PIPE_WIDTH - 12, 4);
    return g;
  }

  playUpdate(time, delta) {
    const dt = delta / 1000;
    const step = flappyStep(this.vy, this.bird.y, dt);
    this.vy = step.vy;
    this.bird.y = step.y;
    this.bird.setRotation(Phaser.Math.Clamp(this.vy / 500, -0.5, 1.0));
    this.eye.setPosition(FL_BIRD_X + 4, this.bird.y - 3);

    for (const pipe of this.pipes) {
      pipe.x -= FL_SCROLL_SPEED * dt;
      pipe.top.x = pipe.x;
      pipe.bottom.x = pipe.x;
      if (flappyPassedPipe(pipe, FL_BIRD_X)) {
        pipe.scored = true;
        this.setScore(this.score + 1);
        if (this.score >= this.def.scoreTarget) { this.win(); return; }
      }
      if (flappyHitsPipe(FL_BIRD_X, this.bird.y, 8, pipe)) { this.lose(); return; }
    }

    while (this.pipes.length && this.pipes[0].x < -FL_PIPE_WIDTH) {
      const gone = this.pipes.shift();
      gone.top.destroy();
      gone.bottom.destroy();
    }
    if (this.pipes.length) this.spawnPipesUpTo(this.pipes[this.pipes.length - 1].x + FL_PIPE_SPACING * 3);

    if (flappyHitsGround(this.bird.y, 8, FL_GROUND_Y) || flappyHitsCeiling(this.bird.y, 8)) this.lose();
  }
}
