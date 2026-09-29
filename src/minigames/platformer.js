// The Physics Lab key's mini-game (docs/STORY.md): a small side-view run-and-jump level. "Real
// platforming feel" (docs/ROADMAP.md M4) comes from Arcade Physics' own gravity/collision plus the
// coyote-time/jump-buffer/variable-height rules in src/minigames/platformer-physics.js -- this file
// only wires those together and draws the level.
//
// Quality loop pass (Mini-games category, rated 4/10 -- "the hero is a speck"): she now draws at
// HERO_SCALE (framework-scene.js, 3x, matching the main game's own pixel scale) via a plain
// `sprite.setScale()` instead of a camera zoom (camera zoom turned out to be unreliable for this
// scene setup -- see framework-scene.js's own comment on HERO_SCALE). The level geometry and physics
// constants below were authored at a smaller "compact" scale first (a 320x180-equivalent viewport)
// and then *uniformly* multiplied by 3 for the real numbers here, the same factor as HERO_SCALE --
// multiplying every spatial constant (position, size, gap, gravity, velocity, run speed) by one
// factor preserves every ratio (jump-height-to-platform-rise, gap-to-max-jump-distance) exactly, so
// the compact design's own reachability margins carry over unchanged; only the *hero's own* size
// doesn't scale with the rest of the level, which is exactly what makes her read as chunky now. Time
// constants (coyote/jump-buffer ms) are never scaled -- see platformer-physics.js's own comment. A
// two-layer parallax backdrop (a static far wall behind a scrolling mid shelving/tank layer,
// tools/make-minigame-art.js) plus a real code-drawn floor replace the old single flat image;
// platforms read as lab benches with a lit top edge; a landing/jump squash-stretch and ambient dust
// motes round out the juice pass.

const PF_GROUND_Y = 420; // top surface of every ground-level platform, world px
const PF_KILL_Y = 600; // falling past this = an instant loss (an attempt, not the whole session)
const PF_LEVEL_WIDTH = 1602; // = 534 * 3 (the compact design's own width), matches the backdrop art's own scale
const PF_MID_SCROLL_FACTOR = 0.4; // the mid shelving/tank layer's own parallax speed

// Platforms: { x, y, w } rectangles (world px, y = top surface). Gaps between them are pits -- missing
// a jump costs the attempt, not a permanent setback (docs/STORY.md "retry as often as you like").
// Elevations (420 -> 366 -> 342) stay well under the retuned jump's own apex height (~109 world px,
// see platformer-physics.js's own comment) with margin for imperfect timing; gaps (72-90 world px)
// stay well under the max horizontal distance a full jump covers (~120 world px) -- both margins are
// asserted directly by tests/unit/platformer-physics.test.js so a future edit here that breaks
// reachability fails a unit test, not a playtest.
const PF_PLATFORMS = [
  { x: 0, y: PF_GROUND_Y, w: 270 },
  { x: 354, y: PF_GROUND_Y, w: 165 },
  { x: 603, y: PF_GROUND_Y - 54, w: 144 },
  { x: 819, y: PF_GROUND_Y, w: 192 },
  { x: 1101, y: PF_GROUND_Y - 78, w: 126 },
  { x: 1317, y: PF_GROUND_Y, w: 285 },
];
const PF_COINS = [
  { x: 135, y: 378 },
  { x: 435, y: 378 },
  { x: 675, y: 324 },
  { x: 915, y: 378 },
  { x: 1164, y: 300 },
  { x: 1440, y: 378 },
];
const PF_DOOR_X = PF_LEVEL_WIDTH - 72;

class PlatformerScene extends MinigameBaseScene {
  constructor() {
    super('minigame-platformer');
  }

  preload() {
    if (!this.textures.exists('platformer-bg-far')) this.load.image('platformer-bg-far', 'assets/minigames/platformer-bg-far.png');
    if (!this.textures.exists('platformer-bg-mid')) this.load.image('platformer-bg-mid', 'assets/minigames/platformer-bg-mid.png');
  }

  buildScene() {
    this.physics.world.gravity.y = PLATFORMER_GRAVITY;
    this.physics.world.setBounds(0, 0, PF_LEVEL_WIDTH, GAME_HEIGHT + 200);
    this.cameras.main.setBounds(0, 0, PF_LEVEL_WIDTH, GAME_HEIGHT);

    // The far wall (pinned, canvas-sized -- never needs to be wider since it never scrolls) behind the
    // mid shelving/tank layer (level-width sized, scrolled at a fraction of camera speed for real
    // parallax depth -- STYLE_GUIDE "Layering"). Both source images are generated at the compact
    // scale (320x180 / 534x180) and stretched 3x here -- pixelArt:true (src/main.js) keeps that a
    // crisp nearest-neighbor upscale, not a blur.
    this.add.image(0, 0, 'platformer-bg-far').setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setScrollFactor(0).setDepth(-30);
    this.add.image(0, 0, 'platformer-bg-mid').setOrigin(0, 0)
      .setDisplaySize(PF_LEVEL_WIDTH, GAME_HEIGHT).setScrollFactor(PF_MID_SCROLL_FACTOR).setDepth(-20);

    this.buildFloor();
    this.buildAmbientDust();

    this.platformGroup = this.physics.add.staticGroup();
    for (const p of PF_PLATFORMS) this.drawPlatform(p);

    // The player's physics body is a plain, invisible rectangle (no texture needed for a hitbox);
    // her real sprite (ensurePlayerAnims(), framework-scene.js) is kept glued to it every frame in
    // playUpdate() instead of being the physics object itself. The body is sized to roughly match her
    // now-larger HERO_SCALE silhouette (42x66 -- 3x the original 14x22), not the old tiny hitbox.
    this.player = this.add.rectangle(60, PF_GROUND_Y - 40, 42, 66, 0xff6fb1, 0);
    this.physics.add.existing(this.player);
    this.player.body.setSize(42, 66);
    this.player.body.setCollideWorldBounds(true);
    ensurePlayerAnims(this);
    this.heroFacing = 'right'; // she runs into the level, left to right
    this.hero = this.add.sprite(60, PF_GROUND_Y - 40, 'player', HERO_IDLE_FRAME.right).setScale(HERO_SCALE).setDepth(20);
    this.physics.add.collider(this.player, this.platformGroup);

    this.coinSprites = PF_COINS.map((coin) => this.makeCoin(coin));
    this.buildDoor();

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.wasGrounded = true;
    this.jumpQueuedAt = null;
    // FB-0042: gated on `mgState === 'playing'` -- Space is also how you confirm the intro/game-over
    // card's default item ("START"/"RETRY"), and this listener is scene-wide (registered once, here,
    // not torn down between attempts), so the very same Space press that confirmed Retry used to also
    // queue a jump for the instant play resumed, making her hop on frame one of every single retry.
    const queueJump = (event) => { if (!event.repeat && this.mgState === 'playing') this.jumpQueuedAt = this.time.now; };
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

  // A real, code-drawn near-foreground floor (was baked into the old backdrop image) -- tied to true
  // world position (default scrollFactor 1), so it scrolls in perfect lockstep with the platforms
  // standing on it, spanning the whole level so it's never visibly missing under her feet.
  buildFloor() {
    const y = PF_GROUND_Y + 120;
    this.add.rectangle(PF_LEVEL_WIDTH / 2, y, PF_LEVEL_WIDTH, 90, 0x2a2118).setDepth(-5);
    const grout = this.add.graphics().setDepth(-4);
    grout.lineStyle(2, 0x1a140e, 0.6);
    for (let x = 0; x < PF_LEVEL_WIDTH; x += 48) grout.lineBetween(x, y - 45, x, y + 45);
  }

  // Ambient dust motes (coordinator brief "juice": "ambient particles") -- a handful of warm, faint
  // specks drifting slowly up and sideways on a loop, scattered across the whole level so the room
  // feels alive rather than static, well under the "nothing flashes faster than 3Hz" rule (these don't
  // flash at all, just drift).
  buildAmbientDust() {
    for (let i = 0; i < 14; i++) {
      const x = 60 + ((i * 291) % (PF_LEVEL_WIDTH - 120));
      const y = 90 + ((i * 159) % 270);
      const mote = this.add.circle(x, y, 3 + (i % 2) * 2, 0xffdf9e, 0.22 + (i % 3) * 0.06).setDepth(-1);
      this.tweens.add({
        targets: mote, y: y - 42 - (i % 3) * 12, x: x + (i % 2 === 0 ? 18 : -18),
        duration: 3200 + (i % 5) * 400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  // A lab bench built to have a clear, lit top edge (rubric: "readable platforms") -- a bright steel
  // surface catching the ceiling lamps, a darker case body with a panel seam, and short legs so it
  // reads as furniture standing on the floor, not a floating slab.
  drawPlatform(p) {
    const height = 27;
    const top = p.y;
    const caseTop = top + 9;
    const bottom = top + height;
    this.add.rectangle(p.x + p.w / 2, top, p.w, 6, 0xd8e0d8).setDepth(5); // steel top surface
    this.add.rectangle(p.x + p.w / 2, top + 1.5, p.w - 6, 3, 0xf4f8f2).setDepth(6); // highlight catching the lamps
    this.add.rectangle(p.x + p.w / 2, (caseTop + bottom) / 2, p.w, bottom - caseTop, 0x3a4048).setDepth(5); // case body
    this.add.rectangle(p.x + p.w / 2, caseTop + 3, p.w - 9, 3, 0x4a5560).setDepth(6); // panel seam
    this.add.rectangle(p.x + p.w / 2, top - 1.5, p.w, height + 3, 0x1a1c2c, 0).setStrokeStyle(2, 0x14171c).setDepth(7);
    for (const legX of [p.x + 9, p.x + p.w - 9]) {
      this.add.rectangle(legX, bottom + 6, 6, 9, 0x232830).setDepth(4); // short support legs
    }

    const rect = this.add.rectangle(p.x + p.w / 2, top + height / 2, p.w, height, 0x000000, 0);
    this.physics.add.existing(rect, true);
    this.platformGroup.add(rect);
  }

  // A "charge cell": a small glowing energy orb (matches the intro card's own "charge cells" flavor
  // text) rather than an adventure-game gold coin -- a soft outer glow, a bright core and a white
  // highlight, cyan to read as lab equipment against the warm backdrop.
  makeCoin(coin) {
    const glow = this.add.circle(coin.x, coin.y, 15, 0x7fe0ff, 0.28).setDepth(9);
    const core = this.add.circle(coin.x, coin.y, 9, 0x7fe0ff).setStrokeStyle(2, 0x1a1c2c).setDepth(10);
    const hi = this.add.circle(coin.x - 3, coin.y - 3, 3, 0xffffff, 0.9).setDepth(11);
    this.tweens.add({ targets: [glow, core, hi], y: '-=6', duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const body = this.add.circle(coin.x, coin.y, 12, 0x000000, 0);
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
  // a panel with a small window, and a glowing lamp above it -- a lab door, not a flag.
  buildDoor() {
    const dx = PF_DOOR_X;
    const topY = PF_GROUND_Y - 96;
    this.add.rectangle(dx, PF_GROUND_Y - 48, 54, 96, 0x2a2118).setDepth(5); // frame
    this.add.rectangle(dx, PF_GROUND_Y - 48, 45, 84, 0x463a28).setDepth(6); // panel
    this.add.rectangle(dx, PF_GROUND_Y - 72, 24, 18, 0x7fe0ff, 0.7).setDepth(7); // small window
    const lamp = this.add.ellipse(dx, topY - 18, 42, 24, 0x8fd46a, 0.85).setDepth(7);
    this.tweens.add({ targets: lamp, alpha: 0.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.flag = this.add.rectangle(dx, PF_GROUND_Y - 48, 54, 96, 0x000000, 0);
    this.physics.add.existing(this.flag, true);
    this.physics.add.overlap(this.player, this.flag, () => this.tryFinish());
  }

  tryFinish() {
    if (this.mgState !== 'playing') return;
    if (this.score >= this.def.scoreTarget) this.win();
    // FB-0042: reaching the door without enough cells used to do nothing at all -- no feedback that
    // she was even close, just a wall that quietly refuses to open. A short on-screen message (this
    // scene's own, see framework-scene.js showMessage()) instead of silence.
    else this.showMessage('Collect all the charge cells first!');
  }

  startAttempt() {
    this.player.setPosition(60, PF_GROUND_Y - 40);
    this.player.body.reset(60, PF_GROUND_Y - 40);
    this.heroFacing = 'right';
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

    // A landing squash (coordinator brief "juice": "a squash and stretch on jump and land") plus the
    // existing dust puff, both only the instant she touches down after being airborne.
    if (grounded && !this.wasGrounded) {
      spawnDustPuff(this, this.player.x, this.player.y + 33);
      squashStretch(this, this.hero, 'squash');
    }
    this.wasGrounded = grounded;

    const k = this.mgKeys;
    const dx = ((k.RIGHT.isDown || k.D.isDown) ? 1 : 0) - ((k.LEFT.isDown || k.A.isDown) ? 1 : 0);
    body.setVelocityX(dx * PLATFORMER_RUN_SPEED);

    if (this.jumpQueuedAt !== null) {
      const bufferedOk = shouldBufferedJumpFire(time - this.jumpQueuedAt);
      if (bufferedOk && canCoyoteJump(this.groundedTimer)) {
        body.setVelocityY(PLATFORMER_JUMP_VELOCITY);
        AudioManager.play('minigameJump');
        squashStretch(this, this.hero, 'stretch'); // the takeoff half of the same juice
        this.jumpQueuedAt = null;
        this.groundedTimer = PLATFORMER_COYOTE_MS + 1; // spend the coyote window: no double jump off nothing
      } else if (!bufferedOk) {
        this.jumpQueuedAt = null;
      }
    }

    this.hero.setPosition(this.player.x, this.player.y + 3);
    // FB-0043: real left/right art, never a mirrored "side" row (see framework-scene.js
    // ensurePlayerAnims()) -- `heroFacing` remembers the last real direction so idle keeps facing
    // the way she was last actually moving, the same way world.js's own idle animation does.
    if (dx !== 0) {
      this.heroFacing = dx < 0 ? 'left' : 'right';
      this.hero.anims.play(`walk-${this.heroFacing}`, true);
    } else {
      this.hero.anims.play(`idle-${this.heroFacing}`, true);
    }

    if (this.player.y > PF_KILL_Y) this.lose();
  }
}
