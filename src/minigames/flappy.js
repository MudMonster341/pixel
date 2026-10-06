// UNREACHABLE since ADR 0025 (EDI Madness opens the ICL door now); kept as the one-line rollback (STORY.iclGate `minigame` + the scanner dialog's action back to 'flappy').
// The ICL's fingerprint hack (docs/STORY.md key 2, FB-0071): a flappy-bird-style flyer that opens the lab's fingerprint-locked DOOR (the game used to
// hand over the key itself as "ICL Server Dash": a bird through gaps in server racks). You fly a glowing data packet through gaps in neon "firewalls"
// to crack the scan; the big fingerprint scanner ring behind the play field FILLS as the score rises, and at the target the scan is cracked.
// Physics/collision are the pure functions in src/minigames/flappy-logic.js (unchanged); this file only draws the room and forwards the flap key.
//
// Quality loop pass (Mini-games category, rated 4/10 -- "the hero is a speck"): the flyer draws at a plain `sprite.setScale()` (framework-scene.js,
// camera zoom proved unreliable for this scene setup). FL_* below and flappy-logic.js's own gravity/flap constants were authored at a smaller "compact"
// scale first and then uniformly multiplied by 3, including FLAPPY_BIRD_RADIUS (24): the packet is drawn at FL_PACKET_SCALE so its diamond fills that
// hitbox honestly. The backdrop is one generated image (tools/make-minigame-art.js, authored at the compact scale and stretched 3x here, crisp under
// pixelArt:true); the packet is `flappy-sprites.png` (4 glow-pulse frames). The firewalls and the scanner ring are drawn here in code.

const FL_BIRD_X = 210;
const FL_GAP_HEIGHT = 240;
const FL_PIPE_WIDTH = 54;
const FL_PIPE_SPACING = 270; // px between successive firewall centres
const FL_SCROLL_SPEED = 168; // px/s
const FL_GROUND_Y = GAME_HEIGHT - 60;
const FL_GAP_MARGIN = 60; // keeps a gap's own edges away from the very top/ground
const FL_PACKET_SCALE = 4; // the 16 px packet frame drawn 4x: its diamond (about 5.5 px radius) fills the 24 px hitbox
const FL_BLINK_MS = 450; // well under "nothing flashes faster than 3 times a second" (STYLE_GUIDE.md)
// The scanner ring behind the play field: the backdrop's own dim ring (tools/make-minigame-art.js, radius 78 at the compact scale) is at this centre and
// radius once stretched 3x; the fingerprint arcs inside it are drawn here (a dim set always, then lit up to the score).
const FL_RING = { x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2 - 12, r: 234 };
const FL_PRINT_ARCS = 9; // concentric fingerprint arcs inside the ring
const FL_NEON = { edge: 0xff8a3c, brick: 0x4a1830, seam: 0x7a2a3e, body: 0x2a0f1c, warn: 0xffb13d };

class FlappyScene extends MinigameBaseScene {
  constructor() {
    super('minigame-flappy');
  }

  preload() {
    if (!this.textures.exists('flappy-bg')) this.load.image('flappy-bg', 'assets/minigames/flappy-bg.png');
    if (!this.textures.exists('flappy-sprites')) this.load.spritesheet('flappy-sprites', 'assets/minigames/flappy-sprites.png', { frameWidth: 16, frameHeight: 16 });
  }

  buildScene() {
    this.add.image(0, 0, 'flappy-bg').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(-10);
    // the scanner: the fingerprint and the progress ring, redrawn whenever the score changes (drawScan())
    this.scan = this.add.graphics().setDepth(-5);
    this.drawScan();

    // A dark data-floor band: a tile strip with a cyan grid, matching the backdrop's own grid right above it.
    this.add.rectangle(GAME_WIDTH / 2, FL_GROUND_Y + 12, GAME_WIDTH, 24, 0x07202e).setDepth(5);
    const grid = this.add.graphics().setDepth(6);
    grid.lineStyle(1, 0x1f7a99, 0.6);
    for (let x = 0; x < GAME_WIDTH; x += 30) grid.lineBetween(x, FL_GROUND_Y, x, GAME_HEIGHT);
    grid.lineBetween(0, FL_GROUND_Y, GAME_WIDTH, FL_GROUND_Y);
    grid.lineStyle(2, 0x4de3ff, 0.5);
    grid.lineBetween(0, FL_GROUND_Y + 1, GAME_WIDTH, FL_GROUND_Y + 1);
    this.buildAmbientSparks();

    if (!this.anims.exists('flappy-packet')) {
      this.anims.create({ key: 'flappy-packet', frames: this.anims.generateFrameNumbers('flappy-sprites', { frames: [0, 1, 2, 1] }), frameRate: 8, repeat: -1 });
    }
    // The player is the data packet, a glowing diamond flying right through the firewalls (the direction she is travelling through the room).
    this.bird = this.add.sprite(FL_BIRD_X, GAME_HEIGHT / 2, 'flappy-sprites', 0).setScale(FL_PACKET_SCALE).setDepth(10);
    this.bird.anims.play('flappy-packet', true);
    this.pipes = [];

    // FB-0042: a "get ready" beat -- the packet hovers with a gentle bob and a prompt instead of immediately
    // falling under gravity through a level that's already scrolling before the player has done
    // anything. `flying` (set on the very first real flap, in flap() below) gates every bit of that:
    // playUpdate() below returns before gravity, firewall-scrolling or collision run at all while it's
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

  // The fingerprint scan, drawn behind the play field: a dim fingerprint (concentric broken arcs) always, the lit part growing with the score (each of
  // the arcs lights in turn, the next one sweeping on), and the outer ring filling clockwise from the top like a progress dial. All at the ring's own
  // centre and radius, so it sits exactly inside the backdrop's dim ring. At the target the whole print and the ring are lit.
  drawScan() {
    if (!this.scan) return;
    const p = Phaser.Math.Clamp((this.score || 0) / this.def.scoreTarget, 0, 1);
    const g = this.scan;
    g.clear();
    const { x, y, r } = FL_RING;
    const lit = p * FL_PRINT_ARCS;
    for (let i = 0; i < FL_PRINT_ARCS; i++) {
      const radius = 38 + i * ((r - 64) / (FL_PRINT_ARCS - 1)) * 0.82;
      // every arc is a broken loop: it starts at its own angle and leaves a gap, so the rings read as a fingerprint's ridges
      const start = Phaser.Math.DegToRad(-110 + i * 41);
      const sweep = Phaser.Math.DegToRad(i % 3 === 2 ? 230 : 290);
      const k = Phaser.Math.Clamp(lit - i, 0, 1);
      g.lineStyle(5, 0x1e7a9e, 0.3);
      g.beginPath(); g.arc(x, y, radius, start, start + sweep, false); g.strokePath();
      if (k > 0) {
        g.lineStyle(5, i % 2 ? 0x4de3ff : 0x7ff0ff, 0.9);
        g.beginPath(); g.arc(x, y, radius, start, start + sweep * k, false); g.strokePath();
      }
    }
    // the outer progress ring
    g.lineStyle(7, 0x4de3ff, 0.18);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2, false); g.strokePath();
    if (p > 0) {
      g.lineStyle(7, p >= 1 ? 0xb9f6ff : 0x4de3ff, 0.95);
      g.beginPath(); g.arc(x, y, r, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(-90 + 360 * p), false); g.strokePath();
    }
  }

  setScore(score) {
    super.setScore(score);
    this.drawScan();
  }

  // Ambient "data spark" particles (coordinator brief "juice": "ambient particles") -- cool, tiny
  // specks drifting slowly through the room, the flyer's own equivalent of the platformer's dust
  // motes. Purely decorative, well under the "nothing flashes faster than 3Hz" rule (no flashing).
  buildAmbientSparks() {
    for (let i = 0; i < 10; i++) {
      const x = 30 + ((i * 213) % (GAME_WIDTH - 60));
      const y = 45 + ((i * 111) % (FL_GROUND_Y - 75));
      const spark = this.add.circle(x, y, 3, 0x4de3ff, 0.3 + (i % 3) * 0.08).setDepth(4);
      this.tweens.add({
        targets: spark, x: x - 36 - (i % 3) * 12, alpha: 0.05,
        duration: 4200 + (i % 4) * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  startAttempt() {
    this.vy = 0;
    this.flying = false;
    this.drawScan(); // a fresh attempt: the scan starts empty again (beginAttempt() zeroed the score before calling this)
    this.hoverPrompt.setVisible(true);
    this.bird.setVisible(true).setPosition(FL_BIRD_X, GAME_HEIGHT / 2).setRotation(0).setScale(FL_PACKET_SCALE, FL_PACKET_SCALE);
    for (const pipe of this.pipes) this.destroyWall(pipe);
    this.pipes = [];
    this.nextPipeX = GAME_WIDTH + 80;
    this.spawnPipesUpTo(GAME_WIDTH + 700);
  }

  // D08 (2026-10-04): the in-play "PRESS SPACE TO FLAP" hint and the packet used to stay visible behind the game-over and
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
    squashStretch(this, this.bird, 'stretch', FL_PACKET_SCALE); // juice: a small squash/stretch, shared with the platformer
  }

  spawnPipesUpTo(limitX) {
    while (this.nextPipeX < limitX) {
      const gapY = Phaser.Math.Between(FL_GAP_MARGIN, FL_GROUND_Y - FL_GAP_MARGIN - FL_GAP_HEIGHT);
      const pipe = { x: this.nextPipeX, width: FL_PIPE_WIDTH, gapY, gapHeight: FL_GAP_HEIGHT, scored: false };
      pipe.top = this.drawWall(pipe.x, 0, gapY, 'down');
      pipe.bottom = this.drawWall(pipe.x, gapY + pipe.gapHeight, FL_GROUND_Y - (gapY + pipe.gapHeight), 'up');
      this.pipes.push(pipe);
      this.nextPipeX += FL_PIPE_SPACING;
    }
  }

  // A firewall: a wall of dark red bricks with a glowing neon edge on the side that faces the gap (`edge`: 'down' = the segment hangs from the ceiling and
  // its glowing edge is its bottom, 'up' = it rises from the floor and the edge is its top), and a column of warning lights (`leds`, toggled by
  // applyBlink()) down the middle. `gfx` is drawn at local x = 0 and positioned via its own transform, so scrolling is one property set, not a redraw; each
  // light is its own tiny rect so it can blink independently without redrawing the wall around it.
  drawWall(x, top, height, edge) {
    const g = this.add.graphics().setPosition(x, 0).setDepth(8);
    g.fillStyle(FL_NEON.body, 1).fillRect(0, top, FL_PIPE_WIDTH, height);
    // brick courses: a seam line every 15 px, the vertical joints staggered course by course
    g.lineStyle(2, FL_NEON.seam, 1);
    let course = 0;
    for (let y = top; y < top + height; y += 15, course++) {
      g.lineBetween(0, y, FL_PIPE_WIDTH, y);
      const off = course % 2 ? 13 : 33;
      g.lineBetween(off, y, off, Math.min(y + 15, top + height));
      g.fillStyle(FL_NEON.brick, 1).fillRect(off % 27 + 2, y + 3, 4, 2);
    }
    // the outline and the glowing edge facing the gap
    g.lineStyle(3, 0x1a0710, 1).strokeRect(0, top, FL_PIPE_WIDTH, height);
    const edgeY = edge === 'down' ? top + height - 6 : top;
    g.fillStyle(FL_NEON.edge, 0.35).fillRect(-3, edge === 'down' ? edgeY - 6 : edgeY - 2, FL_PIPE_WIDTH + 6, 14);
    g.fillStyle(FL_NEON.edge, 1).fillRect(0, edgeY, FL_PIPE_WIDTH, 6);
    g.fillStyle(0xfff1c4, 1).fillRect(0, edge === 'down' ? edgeY + 4 : edgeY, FL_PIPE_WIDTH, 2);

    const leds = [];
    let i = 0;
    for (let y = top + 15; y < top + height - 9; y += 30) {
      const led = this.add.rectangle(x + FL_PIPE_WIDTH / 2 - 3, y, 6, 6, FL_NEON.warn).setDepth(9);
      led.invert = i % 2 === 0; // so the lights don't all blink in lockstep -- see applyBlink()
      leds.push({ obj: led, offsetX: FL_PIPE_WIDTH / 2 - 3 });
      i++;
    }
    return { gfx: g, leds };
  }

  destroyWall(pipe) {
    pipe.top.gfx.destroy();
    pipe.top.leds.forEach((led) => led.obj.destroy());
    pipe.bottom.gfx.destroy();
    pipe.bottom.leds.forEach((led) => led.obj.destroy());
  }

  applyBlink() {
    for (const pipe of this.pipes) {
      for (const wall of [pipe.top, pipe.bottom]) {
        for (const led of wall.leds) led.obj.setAlpha((this.blinkOn !== led.obj.invert) ? 1 : 0.35);
      }
    }
  }

  playUpdate(time, delta) {
    // FB-0042: the "get ready" hover -- gentle bob, no gravity, no firewall scrolling, no collision --
    // until she actually flaps for the first time (flap() above).
    if (!this.flying) {
      this.bird.y = GAME_HEIGHT / 2 + Math.sin(time / 300) * 6;
      this.bird.setRotation(0);
      this.bird.anims.play('flappy-packet', true);
      return;
    }

    const dt = delta / 1000;
    const step = flappyStep(this.vy, this.bird.y, dt);
    this.vy = step.vy;
    this.bird.y = step.y;
    this.bird.setRotation(Phaser.Math.Clamp(this.vy / 500, -0.5, 1.0));
    this.bird.anims.play('flappy-packet', true);

    for (const pipe of this.pipes) {
      pipe.x -= FL_SCROLL_SPEED * dt;
      pipe.top.gfx.x = pipe.x;
      pipe.bottom.gfx.x = pipe.x;
      for (const wall of [pipe.top, pipe.bottom]) {
        for (const led of wall.leds) led.obj.x = pipe.x + led.offsetX;
      }
      if (flappyPassedPipe(pipe, FL_BIRD_X)) {
        pipe.scored = true;
        this.setScore(this.score + 1);
        if (this.score >= this.def.scoreTarget) { this.win(); return; }
      }
      if (flappyHitsPipe(FL_BIRD_X, this.bird.y, FLAPPY_BIRD_RADIUS, pipe)) { this.lose(); return; }
    }

    while (this.pipes.length && this.pipes[0].x < -FL_PIPE_WIDTH) this.destroyWall(this.pipes.shift());
    if (this.pipes.length) this.spawnPipesUpTo(this.pipes[this.pipes.length - 1].x + FL_PIPE_SPACING * 3);

    if (flappyHitsGround(this.bird.y, FLAPPY_BIRD_RADIUS, FL_GROUND_Y) || flappyHitsCeiling(this.bird.y, FLAPPY_BIRD_RADIUS)) this.lose();
  }
}
