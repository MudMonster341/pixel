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
    for (const def of Object.values(MAPS)) {
      if (def.tiled) this.load.tilemapTiledJSON(`map-${def.tiled}`, `assets/maps/${def.tiled}.json`);
    }
  }

  create() {
    this.scene.launch('ui');
    this.scene.start('world', continueSpawnData());
  }
}

// If a save was loaded (see startGame() below) and no `?map=` explicitly picked a different map for
// dev/tests, resume on GameState's own map/position/facing instead of the map's normal spawn point
// (docs/ARCHITECTURE.md: "Autosave runs on map change and after story events" implies the reverse
// too -- continuing should land you back where that autosave left you).
function continueSpawnData() {
  const explicitMap = typeof location !== 'undefined' && new URLSearchParams(location.search).has('map');
  if (explicitMap || !GameState.map || !MAPS[GameState.map] || !GameState.position) return undefined;
  return { map: GameState.map, spawn: { x: GameState.position.x, y: GameState.position.y, facing: GameState.facing } };
}

function startGame() {
  if (saveEnabled()) loadGame(currentProfile()); // ?save=0 boots fresh without touching the stored save
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
    scene: [BootScene, WorldScene, UIScene, CutsceneScene], // later scenes draw on top
  });
  if (saveEnabled()) initAutosave(window.game, currentProfile());
}

// Dev mode loads developer tools (the feedback overlay). It's on by default when running locally.
// Add ?dev=0 to the URL to play exactly as players will, or ?dev=1 to force it on.
const DEV_MODE = (() => {
  const params = new URLSearchParams(location.search);
  if (params.has('dev')) return params.get('dev') !== '0';
  return ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
})();

function loadDevTools() {
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: 'src/dev/feedback.css' }));
  document.head.append(Object.assign(document.createElement('script'), { src: 'src/dev/feedback.js' }));
}

// Wait (briefly) for the pixel font, otherwise the first text renders in the fallback font.
Promise.race([document.fonts.load(`16px ${FONT}`), new Promise((resolve) => setTimeout(resolve, 1500))])
  .catch(() => {})
  .finally(() => {
    startGame();
    if (DEV_MODE) loadDevTools();
  });
