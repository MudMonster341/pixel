// Loads the assets, then starts the world and the UI on top of it.

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'LOADING...', { fontFamily: FONT, fontSize: '16px', color: '#f4f4f4' }).setOrigin(0.5);
    const sheet = { frameWidth: TILE, frameHeight: TILE };
    this.load.image('tiles', 'assets/tiles.png');
    this.load.json('tileinfo', 'assets/tiles.json');
    this.load.spritesheet('player', 'assets/player.png', sheet);
    this.load.spritesheet('npc', 'assets/npc.png', sheet);
    this.load.spritesheet('items', 'assets/items.png', sheet);
    this.load.image('prompt', 'assets/prompt.png');
  }

  create() {
    this.scene.launch('ui');
    this.scene.start('world');
  }
}

function startGame() {
  // Exposed on window so you can poke at it from the browser console (e.g. game.scene.getScene('world').player).
  window.game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#12131a',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [BootScene, WorldScene, UIScene], // later scenes draw on top
  });
}

// Wait (briefly) for the pixel font, otherwise the first text renders in the fallback font.
Promise.race([document.fonts.load(`16px ${FONT}`), new Promise((resolve) => setTimeout(resolve, 1500))])
  .catch(() => {})
  .finally(startGame);
