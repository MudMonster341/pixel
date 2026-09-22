// The Physics Lab key's mini-game (docs/STORY.md): a small side-view run-and-jump level. "Real
// platforming feel" (docs/ROADMAP.md M4) comes from Arcade Physics' own gravity/collision plus the
// coyote-time/jump-buffer/variable-height rules in src/minigames/platformer-physics.js -- this file
// only wires those together and draws the level. Art pass (coordinator brief, 2026-09-22): a themed
// lab backdrop (tools/make-minigame-art.js), platforms built to read as lab furniture rather than
// green bars, and the lead's own real sprite as the hero instead of a stand-in shape.

const PF_GROUND_Y = 420;
const PF_KILL_Y = 560; // falling past this = an instant loss (an attempt, not the whole session)
const PF_LEVEL_WIDTH = 1500;

// Platforms: { x, y, w } rectangles (world pixels, y = top surface). Gaps between them are pits --
// missing a jump costs the attempt, not a permanent setback (docs/STORY.md "retry as often as you
// like"). Charge cells float just above a platform; the exit door sits at the very end.
const PF_PLATFORMS = [
  { x: 0, y: PF_GROUND_Y, w: 260 },
  { x: 340, y: PF_GROUND_Y, w: 160 },
  { x: 560, y: PF_GROUND_Y - 70, w: 140 },
  { x: 760, y: PF_GROUND_Y, w: 180 },
  { x: 1020, y: PF_GROUND_Y - 100, w: 120 },
  { x: 1220, y: PF_GROUND_Y, w: 280 },
];
const PF_COINS = [
  { x: 180, y: PF_GROUND_Y - 30 },
  { x: 400, y: PF_GROUND_Y - 30 },
  { x: 620, y: PF_GROUND_Y - 100 },
  { x: 820, y: PF_GROUND_Y - 30 },
  { x: 1070, y: PF_GROUND_Y - 130 },
  { x: 1320, y: PF_GROUND_Y - 30 },
];

class PlatformerScene extends MinigameBaseScene {
  constructor() {
    super('minigame-platformer');
  }

  preload() {
    if (!this.textures.exists('platformer-bg')) this.load.image('platformer-bg', 'assets/minigames/platformer-bg.png');
  }

  buildScene() {
    this.physics.world.gravity.y = PLATFORMER_GRAVITY;
    this.physics.world.setBounds(0, 0, PF_LEVEL_WIDTH, GAME_HEIGHT + 200);
    this.cameras.main.setBounds(0, 0, PF_LEVEL_WIDTH, GAME_HEIGHT);

    // The Physics Lab backdrop (tools/make-minigame-art.js): pinned to the camera (scrollFactor 0)
    // so it always fills the view without needing to tile across the scrolling 1500px level --
    // benches/shelves/a specimen tank read as the room she's actually in, not a black void.
    this.add.image(0, 0, 'platformer-bg').setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setScrollFactor(0).setDepth(-10);

    this.platformGroup = this.physics.add.staticGroup();
    for (const p of PF_PLATFORMS) this.drawPlatform(p);

    // The player's physics body is a plain, invisible rectangle (no texture needed for a hitbox);
    // her real sprite (ensurePlayerAnims(), framework-scene.js) is kept glued to it every frame in
    // playUpdate() instead of being the physics object itself.
    this.player = this.add.rectangle(60, PF_GROUND_Y - 40, 14, 22, 0xff6fb1, 0);
    this.physics.add.existing(this.player);
    this.player.body.setSize(14, 22);
    this.player.body.setCollideWorldBounds(true);
    ensurePlayerAnims(this);
    this.hero = this.add.sprite(60, PF_GROUND_Y - 40, 'player', 16).setDepth(20);
    this.physics.add.collider(this.player, this.platformGroup);

    this.coinSprites = PF_COINS.map((coin) => this.makeCoin(coin));
    this.buildDoor();

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.wasGrounded = true;
    this.jumpQueuedAt = null;
    const queueJump = (event) => { if (!event.repeat) this.jumpQueuedAt = this.time.now; };
    const releaseJump = () => {
      if (this.mgState === 'playing' && this.player.body.velocity.y < 0) {
        this.player.body.velocity.y = clipJumpRelease(this.player.body.velocity.y);
      }
    };
    for (const key of ['SPACE', 'UP', 'W']) {
      this.input.keyboard.on(`keydown-${key}`, queueJump);
      this.input.keyboard.on(`keyup-${key}`, releaseJump);
    }
  }

  // A platform built to read as lab furniture (coordinator brief: "not green bars") -- a metal-cased
  // bench/shelf: a light top surface catching the overhead lamps, a darker case body with a panel
  // seam, and legs at each end so it reads as furniture standing on the floor, not a floating slab.
  drawPlatform(p) {
    const height = 20;
    const top = p.y;
    const caseTop = top + 6;
    const bottom = top + height;
    this.add.rectangle(p.x + p.w / 2, top, p.w, 6, 0xcfd8cf).setDepth(5); // steel top surface
    this.add.rectangle(p.x + p.w / 2, top + 1, p.w - 4, 2, 0xeef3ee).setDepth(6); // highlight catching the lamps
    this.add.rectangle(p.x + p.w / 2, (caseTop + bottom) / 2, p.w, bottom - caseTop, 0x3a4048).setDepth(5); // case body
    this.add.rectangle(p.x + p.w / 2, caseTop + 2, p.w - 6, 2, 0x4a5560).setDepth(6); // panel seam
    for (const legX of [p.x + 6, p.x + p.w - 6]) {
      this.add.rectangle(legX, bottom + 3, 6, 8, 0x232830).setDepth(4); // short support legs
    }
    this.add.rectangle(p.x + p.w / 2, top - 0.5, p.w, height + 1, 0x1a1c2c, 0).setStrokeStyle(1, 0x14171c).setDepth(7);

    const rect = this.add.rectangle(p.x + p.w / 2, top + height / 2, p.w, height, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.platformGroup.add(rect);
  }

  // A "charge cell": a small glowing energy orb (matches the intro card's own "charge cells" flavor
  // text) rather than an adventure-game gold coin -- a soft outer glow, a bright core and a white
  // highlight, cyan to read as lab equipment against the warm backdrop.
  makeCoin(coin) {
    const glow = this.add.circle(coin.x, coin.y, 9, 0x7fe0ff, 0.25).setDepth(9);
    const core = this.add.circle(coin.x, coin.y, 5, 0x7fe0ff).setStrokeStyle(1, 0x1a1c2c).setDepth(10);
    const hi = this.add.circle(coin.x - 1.5, coin.y - 1.5, 1.5, 0xffffff, 0.9).setDepth(11);
    this.tweens.add({ targets: [glow, core, hi], y: '-=4', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const body = this.add.circle(coin.x, coin.y, 6, 0x000000, 0);
    this.physics.add.existing(body, true);
    body.taken = false;
    body.visualParts = [glow, core, hi];
    this.physics.add.overlap(this.player, body, () => this.collectCoin(body));
    return body;
  }

  collectCoin(coin) {
    if (coin.taken || this.mgState !== 'playing') return;
    coin.taken = true;
    coin.visualParts.forEach((part) => part.setVisible(false));
    coin.body.enable = false;
    this.setScore(this.score + 1);
  }

  // The exit door (coordinator brief flavor: the intro card already says "reach the door"): a frame,
  // a panel with a small window, and a glowing "EXIT"-style lamp above it -- a lab door, not a flag.
  buildDoor() {
    const dx = PF_LEVEL_WIDTH - 60;
    const topY = PF_GROUND_Y - 62;
    this.add.rectangle(dx, PF_GROUND_Y - 31, 34, 62, 0x2a2118).setDepth(5); // frame
    this.add.rectangle(dx, PF_GROUND_Y - 31, 28, 56, 0x463a28).setDepth(6); // panel
    this.add.rectangle(dx, PF_GROUND_Y - 48, 16, 12, 0x7fe0ff, 0.7).setDepth(7); // small window
    const lamp = this.add.ellipse(dx, topY - 10, 26, 14, 0x8fd46a, 0.85).setDepth(7);
    this.tweens.add({ targets: lamp, alpha: 0.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.flag = this.add.rectangle(dx, PF_GROUND_Y - 30, 30, 62, 0x000000, 0);
    this.physics.add.existing(this.flag, true);
    this.physics.add.overlap(this.player, this.flag, () => this.tryFinish());
  }

  tryFinish() {
    if (this.mgState !== 'playing') return;
    if (this.score >= this.def.scoreTarget) this.win();
  }

  startAttempt() {
    this.player.setPosition(60, PF_GROUND_Y - 40);
    this.player.body.reset(60, PF_GROUND_Y - 40);
    this.groundedTimer = 0;
    this.wasGrounded = true;
    this.jumpQueuedAt = null;
    this.cameras.main.scrollX = 0;
    this.coinSprites.forEach((coin, i) => {
      coin.taken = false;
      coin.visualParts.forEach((part) => part.setVisible(true));
      const { x, y } = PF_COINS[i];
      coin.visualParts.forEach((part) => part.setPosition(x, y));
      coin.body.reset(x, y);
      coin.body.enable = true;
    });
  }

  playUpdate(time, delta) {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    this.groundedTimer = grounded ? 0 : this.groundedTimer + delta;

    // A small landing puff the instant she touches down after being airborne (coordinator brief,
    // "juice") -- framework-scene.js's spawnDustPuff(), shared so every mini-game can use the same
    // cheap effect.
    if (grounded && !this.wasGrounded) spawnDustPuff(this, this.player.x, this.player.y + 11);
    this.wasGrounded = grounded;

    const k = this.mgKeys;
    const dx = ((k.RIGHT.isDown || k.D.isDown) ? 1 : 0) - ((k.LEFT.isDown || k.A.isDown) ? 1 : 0);
    body.setVelocityX(dx * PLATFORMER_RUN_SPEED);

    if (this.jumpQueuedAt !== null) {
      const bufferedOk = shouldBufferedJumpFire(time - this.jumpQueuedAt);
      if (bufferedOk && canCoyoteJump(this.groundedTimer)) {
        body.setVelocityY(PLATFORMER_JUMP_VELOCITY);
        this.jumpQueuedAt = null;
        this.groundedTimer = PLATFORMER_COYOTE_MS + 1; // spend the coyote window: no double jump off nothing
      } else if (!bufferedOk) {
        this.jumpQueuedAt = null;
      }
    }

    this.hero.setPosition(this.player.x, this.player.y + 1);
    if (dx !== 0) {
      this.hero.setFlipX(dx < 0);
      this.hero.anims.play('walk-side', true);
    } else {
      this.hero.anims.play('idle-side', true);
    }

    if (this.player.y > PF_KILL_Y) this.lose();
  }
}
