// The branded loading screen (docs/GAME_FEEL.md): loads the assets behind a progress bar driven by
// Phaser's own loader (never a guessed duration), then hands off to the world. Reached either
// straight from index.html (test/`?title=0` fast path) or after Title's Play/Continue (real players).

const LOADING_BAR_W = 300;
const LOADING_BAR_H = 14;
// A real player reaching this scene from the title screen sees it for at least this long, even
// when everything's already cached and loads instantly -- otherwise it can flash by in a single
// frame, which reads as a glitch rather than a loading screen (docs/GAME_FEEL.md). The `?title=0`
// fast path every other test uses skips this (see create() below): it's for the title flow only.
const MIN_LOADING_MS = 400;

class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  preload() {
    this.loadStartedAt = Date.now();
    uiText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, 'PIXEL QUEST', 16, COLORS.highlight).setOrigin(0.5);
    uiText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, 'LOADING...', 8, COLORS.dim).setOrigin(0.5);

    const barX = (GAME_WIDTH - LOADING_BAR_W) / 2;
    const barY = GAME_HEIGHT / 2 + 12;
    const track = this.add.graphics();
    track.fillStyle(0x000000, 0.4).fillRect(barX, barY, LOADING_BAR_W, LOADING_BAR_H);
    track.lineStyle(2, COLORS.border, 1).strokeRect(barX, barY, LOADING_BAR_W, LOADING_BAR_H);
    const fill = this.add.graphics();
    this.load.on('progress', (value) => {
      fill.clear().fillStyle(COLORS.gold, 1).fillRect(barX + 2, barY + 2, (LOADING_BAR_W - 4) * value, LOADING_BAR_H - 4);
    });

    const sheet = { frameWidth: TILE, frameHeight: TILE };
    this.load.image('tiles', 'assets/tiles.png');
    this.load.json('tileinfo', 'assets/tiles.json');
    this.load.spritesheet('player', 'assets/player.png', sheet);
    this.load.spritesheet('npc', 'assets/npc.png', sheet);
    this.load.spritesheet('items', 'assets/items.png', sheet);
    // 2 frames: 0 = "E" (talk), 1 = "!" (something new to say, see src/dialog.js hasNewDialog()).
    this.load.spritesheet('prompt', 'assets/prompt.png', sheet);
    for (const def of Object.values(MAPS)) {
      if (def.tiled) this.load.tilemapTiledJSON(`map-${def.tiled}`, `assets/maps/${def.tiled}.json`);
    }
  }

  create() {
    // No separate fade-out needed here: WorldScene's own create() fades its camera in from black
    // (docs/GAME_FEEL.md "no flash of an empty canvas") -- that black overlay covers the switch
    // between scenes on the very first frame, so this loading screen simply hands off instantly.
    const finish = () => {
      this.scene.launch('ui');
      this.scene.start('world', continueSpawnData());
    };
    if (!titleEnabled()) { finish(); return; } // the fast test/dev path: no manufactured delay
    const remaining = MIN_LOADING_MS - (Date.now() - this.loadStartedAt);
    if (remaining > 0) this.time.delayedCall(remaining, finish);
    else finish();
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

// Only the first scene in Phaser's `scene` array auto-starts (every other scene here is launched
// explicitly: BootScene launches 'ui' and starts 'world', PauseMenu/TitleScene start/stop 'title').
// `?title=0` (tests/e2e/helpers.js openGame() default) skips the title/loading screens entirely and
// boots exactly like every build before FB-0023/0024 did: load the save (if any) up front, then
// start straight on BootScene, which resolves continueSpawnData() itself.
// With the title screen on (the real player's path), loading a save is deferred to whichever menu
// choice the player actually makes (TitleScene startPlay()), so "Play" can start a clean game
// without disturbing an existing save until the new game actually writes over it.
function startGame() {
  const titleOn = titleEnabled();
  if (!titleOn && saveEnabled()) loadGame(currentProfile());

  const first = titleOn ? TitleScene : BootScene;
  const rest = [TitleScene, BootScene].filter((scene) => scene !== first);
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
    scene: [first, ...rest, WorldScene, UIScene, CutsceneScene], // later scenes draw on top
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
