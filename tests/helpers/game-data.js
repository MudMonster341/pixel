// Loads the game's browser scripts (data + pure logic) into a sandbox so unit tests can use them
// without a browser. Each call gives a fresh copy, so tests can't leak state into each other.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPTS = [
  'src/items.js', 'src/story.js', 'src/maps.js', 'src/cutscenes.js', 'src/maplogic.js', 'src/state.js', 'src/save.js',
  // Mini-game pure data/logic (docs/ROADMAP.md M4): no Phaser scenes here, so these load fine into
  // this same sandbox -- src/minigames/framework-scene.js and the 3 game scenes need a real browser
  // and are never loaded by unit tests.
  'src/minigames/framework-data.js', 'src/minigames/tetris-logic.js', 'src/minigames/flappy-logic.js',
  'src/minigames/platformer-physics.js',
  'src/dialog.js',
  // The ending's card content (docs/STORY.md "the ending"): pure data/validation, no Phaser -- see
  // src/card.js's own header comment for why this needs to tolerate a missing/malformed card.json.
  'src/card.js',
];

// Just enough of Phaser's EventEmitter for state.js and for a fake `game.events` in save tests.
class TinyEmitter {
  constructor() {
    this.listeners = {};
  }
  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
    return this;
  }
  emit(event, ...args) {
    (this.listeners[event] || []).forEach((fn) => fn(...args));
    return true;
  }
}

// Just enough of window.localStorage for save.js: an in-memory Map behind the same string-keyed
// get/set/remove/key/length interface. Fresh per loadGameData() call, like everything else here.
class FakeStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  key(index) {
    return [...this.store.keys()][index] ?? null;
  }
  get length() {
    return this.store.size;
  }
}

function loadGameData() {
  const localStorage = new FakeStorage();
  // A bare-bones `window.game.events` (state.js's notifyStateChanged() and dialog.js's
  // emitDialogEvent() both no-op without it): lets dialog tests spy on toast/cutscene/minigame
  // action events the same way the real game's event bus would carry them, without a browser.
  const gameEvents = new TinyEmitter();
  const context = vm.createContext({
    Phaser: { Events: { EventEmitter: TinyEmitter } },
    console,
    URLSearchParams,
    localStorage,
    window: { game: { events: gameEvents } },
  });
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  const get = (name) => vm.runInContext(name, context);
  return {
    gameEvents,
    ITEMS: get('ITEMS'),
    MAPS: get('MAPS'),
    STRUCTURES: get('STRUCTURES'),
    START_MAP: get('START_MAP'),
    TILE: get('TILE'),
    CHAR_HEIGHT: get('CHAR_HEIGHT'),
    CUTSCENES: get('CUTSCENES'),
    Inventory: get('Inventory'),
    GameState: get('GameState'),
    buildTileGrid: get('buildTileGrid'),
    isWalkableTile: get('isWalkableTile'),
    gridFromTiled: get('gridFromTiled'),
    tiledObjects: get('tiledObjects'),
    cutscenesEnabled: get('cutscenesEnabled'),
    titleEnabled: get('titleEnabled'),
    introEnabled: get('introEnabled'),
    objectAt: get('objectAt'),
    notSeenCutscene: get('notSeenCutscene'),
    doorLockRule: get('doorLockRule'),
    isDoorLocked: get('isDoorLocked'),
    questObjectiveText: get('questObjectiveText'),
    minigamesEnabled: get('minigamesEnabled'),
    MINIGAMES: get('MINIGAMES'),
    recordAttempt: get('recordAttempt'),
    minigameProgress: get('minigameProgress'),
    resetMinigameProgress: get('resetMinigameProgress'),
    freshMinigameProgress: get('freshMinigameProgress'),
    // Tetris pure logic
    TETRIS_COLS: get('TETRIS_COLS'),
    TETRIS_ROWS: get('TETRIS_ROWS'),
    TETRIS_ORDER: get('TETRIS_ORDER'),
    createTetrisBoard: get('createTetrisBoard'),
    randomBag: get('randomBag'),
    spawnPiece: get('spawnPiece'),
    absoluteCells: get('absoluteCells'),
    fitsBoard: get('fitsBoard'),
    movePiece: get('movePiece'),
    rotatePiece: get('rotatePiece'),
    lockPiece: get('lockPiece'),
    fallIntervalMs: get('fallIntervalMs'),
    // Flappy pure logic
    flappyStep: get('flappyStep'),
    flappyFlap: get('flappyFlap'),
    flappyHitsPipe: get('flappyHitsPipe'),
    flappyHitsGround: get('flappyHitsGround'),
    flappyHitsCeiling: get('flappyHitsCeiling'),
    flappyPassedPipe: get('flappyPassedPipe'),
    // Platformer pure physics helpers
    integrateGravity: get('integrateGravity'),
    canCoyoteJump: get('canCoyoteJump'),
    shouldBufferedJumpFire: get('shouldBufferedJumpFire'),
    clipJumpRelease: get('clipJumpRelease'),
    notifyStateChanged: get('notifyStateChanged'),
    resetGameState: get('resetGameState'),
    matchesWhen: get('matchesWhen'),
    pickDialogEntry: get('pickDialogEntry'),
    hasNewDialog: get('hasNewDialog'),
    applyDialogActions: get('applyDialogActions'),
    dialogEntryKey: get('dialogEntryKey'),
    renderLine: get('renderLine'),
    renderLines: get('renderLines'),
    STORY: get('STORY'),
    keyStationDialog: get('keyStationDialog'),
    saveGame: get('saveGame'),
    loadGame: get('loadGame'),
    peekSave: get('peekSave'),
    hasSaveFile: get('hasSaveFile'),
    listProfiles: get('listProfiles'),
    deleteProfile: get('deleteProfile'),
    initAutosave: get('initAutosave'),
    currentProfile: get('currentProfile'),
    saveEnabled: get('saveEnabled'),
    buildCardConfig: get('buildCardConfig'),
    renderCardText: get('renderCardText'),
    DEFAULT_CARD_MESSAGES: get('DEFAULT_CARD_MESSAGES'),
    localStorage,
    tileInfo: JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8')),
  };
}

// Objects from the sandbox have different prototypes; this makes them comparable with deepEqual.
const plain = (value) => JSON.parse(JSON.stringify(value));

module.exports = { ROOT, loadGameData, plain };
