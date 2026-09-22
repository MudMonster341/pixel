// The Physics Lab key's mini-game (docs/STORY.md): a small side-view run-and-jump level. "Real
// platforming feel" (docs/ROADMAP.md M4) comes from Arcade Physics' own gravity/collision plus the
// coyote-time/jump-buffer/variable-height rules in src/minigames/platformer-physics.js -- this file
// only wires those together and draws the level.

const PF_GROUND_Y = 420;
const PF_KILL_Y = 560; // falling past this = an instant loss (an attempt, not the whole session)
const PF_LEVEL_WIDTH = 1500;

// Platforms: { x, y, w } rectangles (world pixels, y = top surface). Gaps between them are pits --
// missing a jump costs the attempt, not a permanent setback (docs/STORY.md "retry as often as you
// like"). Coins float just above a platform; the flag sits at the very end.
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

  buildScene() {
    this.physics.world.gravity.y = PLATFORMER_GRAVITY;
    this.physics.world.setBounds(0, 0, PF_LEVEL_WIDTH, GAME_HEIGHT + 200);
    this.cameras.main.setBounds(0, 0, PF_LEVEL_WIDTH, GAME_HEIGHT);

    // Platform/ground art: flat shaded blocks in the game's own grass ramp (STYLE_GUIDE.md), a
    // lighter strip along the top edge for the "one light source, top-left" rule.
    this.platformGroup = this.physics.add.staticGroup();
    for (const p of PF_PLATFORMS) this.drawPlatform(p);

    // The player's physics body is a plain rectangle (no texture needed for a hitbox); a small
    // decorative "hero" container (framework-scene.js drawMiniHero()) is kept glued to it every
    // frame in playUpdate() instead of being the physics object itself.
    this.player = this.add.rectangle(60, PF_GROUND_Y - 40, 14, 22, 0xff6fb1, 0).setStrokeStyle(0);
    this.physics.add.existing(this.player);
    this.player.body.setSize(14, 22);
    this.player.body.setCollideWorldBounds(true);
    this.hero = drawMiniHero(this);
    this.physics.add.collider(this.player, this.platformGroup);

    this.coinSprites = PF_COINS.map((coin) => this.makeCoin(coin));

    const flagX = PF_LEVEL_WIDTH - 60;
    this.add.rectangle(flagX, PF_GROUND_Y - 30, 4, 60, 0xeadbb8);
    this.add.triangle(flagX, PF_GROUND_Y - 56, 0, 0, 22, 7, 0, 14, 0xffd23f).setOrigin(0, 0.5);
    this.flag = this.add.rectangle(flagX, PF_GROUND_Y - 30, 20, 60, 0x000000, 0);
    this.physics.add.existing(this.flag, true);
    this.physics.add.overlap(this.player, this.flag, () => this.tryFinish());

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

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

  drawPlatform(p) {
    const height = 20;
    const rect = this.add.rectangle(p.x + p.w / 2, p.y + height / 2, p.w, height, 0x5ab552).setStrokeStyle(2, 0x1a1c2c);
    this.add.rectangle(p.x + p.w / 2, p.y + 3, p.w - 4, 4, 0x8fd46a);
    this.physics.add.existing(rect, true);
    this.platformGroup.add(rect);
  }

  makeCoin(coin) {
    const gfx = this.add.circle(coin.x, coin.y, 6, 0xffd23f).setStrokeStyle(2, 0x1a1c2c);
    this.tweens.add({ targets: gfx, y: coin.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.physics.add.existing(gfx, true);
    gfx.taken = false;
    this.physics.add.overlap(this.player, gfx, () => this.collectCoin(gfx));
    return gfx;
  }

  collectCoin(coin) {
    if (coin.taken || this.mgState !== 'playing') return;
    coin.taken = true;
    coin.setVisible(false);
    coin.body.enable = false;
    this.setScore(this.score + 1);
  }

  tryFinish() {
    if (this.mgState !== 'playing') return;
    if (this.score >= this.def.scoreTarget) this.win();
  }

  startAttempt() {
    this.player.setPosition(60, PF_GROUND_Y - 40);
    this.player.body.reset(60, PF_GROUND_Y - 40);
    this.groundedTimer = 0;
    this.jumpQueuedAt = null;
    this.cameras.main.scrollX = 0;
    this.coinSprites.forEach((coin, i) => {
      coin.taken = false;
      coin.setVisible(true).setPosition(PF_COINS[i].x, PF_COINS[i].y);
      coin.body.enable = true;
    });
  }

  playUpdate(time, delta) {
    const body = this.player.body;
    const grounded = body.blocked.down || body.touching.down;
    this.groundedTimer = grounded ? 0 : this.groundedTimer + delta;

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

    this.hero.setPosition(this.player.x, this.player.y + 11);
    if (dx !== 0) this.hero.setScale(dx < 0 ? -1 : 1, 1);

    if (this.player.y > PF_KILL_Y) this.lose();
  }
}
