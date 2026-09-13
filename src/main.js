const TILE = 16;
const SPEED = 80; // pixels per second

// Frame numbers in assets/player.png (see tools/make-assets.js)
const IDLE_FRAME = { down: 0, up: 3, left: 6, right: 6 };

class WorldScene extends Phaser.Scene {
  constructor() {
    super('world');
  }

  preload() {
    this.load.image('tiles', 'assets/tiles.png');
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: TILE, frameHeight: TILE });
  }

  create() {
    // --- map ---
    const data = MAP_ROWS.map((row) => [...row].map((ch) => TILE_LEGEND[ch] ?? 0));
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles');
    const ground = map.createLayer(0, tileset, 0, 0);
    ground.setCollision(SOLID_TILES);

    // --- player ---
    this.player = this.physics.add.sprite(PLAYER_START.x * TILE + TILE / 2, PLAYER_START.y * TILE + TILE / 2, 'player', 0);
    // Only the feet collide, so the head can overlap things a little (feels nicer).
    this.player.body.setSize(10, 6).setOffset(3, 10);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, ground);
    this.facing = 'down';

    this.anims.create({ key: 'walk-down', frames: this.anims.generateFrameNumbers('player', { frames: [1, 0, 2, 0] }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'walk-up', frames: this.anims.generateFrameNumbers('player', { frames: [4, 3, 5, 3] }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'walk-side', frames: this.anims.generateFrameNumbers('player', { frames: [7, 6, 8, 6] }), frameRate: 8, repeat: -1 });

    // --- camera & world bounds ---
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.startFollow(this.player, true);

    // --- input ---
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
  }

  update() {
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);

    // Normalize so diagonal movement isn't faster than straight movement.
    const velocity = new Phaser.Math.Vector2(dx, dy).normalize().scale(SPEED);
    this.player.setVelocity(velocity.x, velocity.y);

    if (dx === 0 && dy === 0) {
      this.player.anims.stop();
      this.player.setFrame(IDLE_FRAME[this.facing]);
      return;
    }

    if (dx !== 0) {
      this.facing = dx < 0 ? 'left' : 'right';
      this.player.setFlipX(dx > 0); // side art faces left; mirror it for right
      this.player.anims.play('walk-side', true);
    } else {
      this.facing = dy < 0 ? 'up' : 'down';
      this.player.setFlipX(false);
      this.player.anims.play(`walk-${this.facing}`, true);
    }
  }
}

// Exposed on window so you can poke at it from the browser console (e.g. game.scene.scenes[0].player).
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 320, // low-res "virtual screen", scaled up to fit the window
  height: 180,
  backgroundColor: '#12131a',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [WorldScene],
});
