// Loads the game's browser scripts (data + pure logic) into a sandbox so unit tests can use them
// without a browser. Each call gives a fresh copy, so tests can't leak state into each other.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPTS = [
  'src/items.js', 'src/story.js', 'src/ambient.js', 'src/campus-facts.js', 'src/animals.js', 'src/maps.js', 'src/cutscenes.js',
  // ADR 0016 (in-world cutscene scripts): pure data, no Phaser -- src/objective-routes.js (FB-0033
  // onboarding routing) and src/scripts.js (SCRIPTS, the new cutscene content) load fine here, unlike
  // src/scripts-runtime.js (the engine that runs them), which needs a real Phaser scene and is only
  // exercised by the e2e specs.
  'src/objective-routes.js', 'src/scripts.js',
  'src/maplogic.js', 'src/state.js',
  // The moments' pacing table and pure rules (src/moments.js): data + logic, no Phaser.
  'src/moments.js', 'src/save.js',
  // M5 sound (docs/ROADMAP.md): the SOUNDS registry + AudioManager (src/audio.js) are pure data/logic
  // -- AudioManager.game stays null under this sandbox (nothing ever calls .init()), so every method
  // that touches Phaser is a guarded no-op, safe to load here the same as everything else in this list.
  'src/audio.js',
  // Mini-game pure data/logic (docs/ROADMAP.md M4): no Phaser scenes here, so these load fine into
  // this same sandbox -- src/minigames/framework-scene.js and the 3 game scenes need a real browser
  // and are never loaded by unit tests.
  'src/minigames/framework-data.js', 'src/minigames/flappy-logic.js',
  'src/minigames/platformer-physics.js', 'src/minigames/tower-logic.js', 'src/minigames/hero-logic.js',
  'src/dialog.js',
  // The ending's card content (docs/STORY.md "the ending"): pure data/validation, no Phaser -- see
  // src/card.js's own header comment for why this needs to tolerate a missing/malformed card.json.
  'src/card.js',
  // The credits phase after the card (decisions/0019): pure data + the timeline, loaded right after card.js.
  'src/credits.js',
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
    // `Scene` is only here so a scene file (src/scenes/*.js) can be evaluated by a test that wants to call one of its
    // methods on a stand-in `this` (runScript() below) -- its class bodies only need a base class to extend.
    Phaser: {
      Events: { EventEmitter: TinyEmitter },
      Scene: class Scene {},
      // The two Phaser.Math helpers the scene methods under test call (world.js doorAssist()).
      Math: { Clamp: (v, min, max) => Math.min(Math.max(v, min), max), Distance: { Between: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1) } },
    },
    console,
    URLSearchParams,
    localStorage,
    window: { game: { events: gameEvents } },
  });
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  const get = (name) => vm.runInContext(name, context);
  // Evaluates one more game script (say a src/scenes/*.js file) into this same sandbox, after the data files above, so a
  // test can read its classes and call their methods on a hand-made `this` (the scenes need a browser to RUN, but their
  // key handling, door logic and hand-over rules are plain methods). Returns `get`, so `evaluate('WorldScene')` reads a name.
  const runScript = (file) => {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
    return get;
  };
  return {
    runScript,
    evaluate: get,
    gameEvents,
    ITEMS: get('ITEMS'),
    MAPS: get('MAPS'),
    AMBIENT: get('AMBIENT'),
    // ADR 0018 (talkable campus students): roles, facts and the pure 'what does she say' picker
    CAMPUS_ROLES: get('CAMPUS_ROLES'),
    CAMPUS_FACTS: get('CAMPUS_FACTS'),
    campusFactsFor: get('campusFactsFor'),
    newCampusTalkState: get('newCampusTalkState'),
    campusTalkLines: get('campusTalkLines'),
    ambientSheetKey: get('ambientSheetKey'),
    // ADR 0018 (animals): content, sheet layouts and the pure behaviour functions (src/animals.js)
    ANIMALS: get('ANIMALS'),
    ANIMAL_SPECIES: get('ANIMAL_SPECIES'),
    ANIMAL_LAYOUTS: get('ANIMAL_LAYOUTS'),
    ANIMAL_RULES: get('ANIMAL_RULES'),
    ANIMAL_CAP_PER_MAP: get('ANIMAL_CAP_PER_MAP'),
    ANIMAL_TALK_LINES: get('ANIMAL_TALK_LINES'),
    animalReaction: get('animalReaction'),
    animalFleePoint: get('animalFleePoint'),
    animalWanderPoint: get('animalWanderPoint'),
    animalLineWalkable: get('animalLineWalkable'),
    animalTileBlocked: get('animalTileBlocked'),
    animalFacing: get('animalFacing'),
    makeAnimal: get('makeAnimal'),
    stepAnimal: get('stepAnimal'),
    animalAnim: get('animalAnim'),
    animalSheets: get('animalSheets'),
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
    // FB-0044 (character sheet registry) and the interaction tie-break (src/maplogic.js)
    characterSheets: get('characterSheets'),
    pickInteractable: get('pickInteractable'),
    INTERACT_PRIORITY: get('INTERACT_PRIORITY'),
    INTERACT_TIE_MARGIN: get('INTERACT_TIE_MARGIN'),
    nearestNamedArea: get('nearestNamedArea'),
    notSeenCutscene: get('notSeenCutscene'),
    doorLockRule: get('doorLockRule'),
    isDoorLocked: get('isDoorLocked'),
    DIRECTION_OFFSET: get('DIRECTION_OFFSET'),
    doorTileFromSpawn: get('doorTileFromSpawn'),
    depthGroupAt: get('depthGroupAt'),
    parseOpenTiles: get('parseOpenTiles'),
    // P5c (FB-0071): the ICL's sealed door, its tile animations and the objective route's flag condition (src/maplogic.js)
    isGateOpen: get('isGateOpen'),
    tileInGateRoom: get('tileInGateRoom'),
    gateBumped: get('gateBumped'),
    tileAnimFrame: get('tileAnimFrame'),
    // P4c (FB-0067): the door animation's pure parts (src/maplogic.js)
    doorFrames: get('doorFrames'),
    doorFrameAt: get('doorFrameAt'),
    doorAnimDuration: get('doorAnimDuration'),
    DOOR_FRAME_MS: get('DOOR_FRAME_MS'),
    DOOR_ANIM_FAILSAFE_MS: get('DOOR_ANIM_FAILSAFE_MS'),
    questObjectiveText: get('questObjectiveText'),
    hudLayout: get('hudLayout'),
    wrapWords: get('wrapWords'),
    hotbarShouldShow: get('hotbarShouldShow'),
    // FB-0075 (title menu layout) and FB-0046 (doorway size)
    TITLE_MENU: get('TITLE_MENU'),
    titleMenuLayout: get('titleMenuLayout'),
    parseDoorCells: get('parseDoorCells'),
    doorCoversTile: get('doorCoversTile'),
    doorCenterPx: get('doorCenterPx'),
    fullMapLabelCandidates: get('fullMapLabelCandidates'),
    placeMapLabels: get('placeMapLabels'),
    mapLabelPriority: get('mapLabelPriority'),
    MAP_LABEL: get('MAP_LABEL'),
    overheadAlpha: get('overheadAlpha'),
    INDOOR_OVERHEAD_ALPHA: get('INDOOR_OVERHEAD_ALPHA'),
    trackerPillText: get('trackerPillText'),
    TRACKER_PILL: get('TRACKER_PILL'),
    HUD_TRACKER: get('HUD_TRACKER'),
    // ADR 0016 / FB-0033 (in-world scripts + onboarding destination routing)
    resolveAnchor: get('resolveAnchor'),
    objectiveId: get('objectiveId'),
    objectiveTarget: get('objectiveTarget'),
    OBJECTIVE_ROUTES: get('OBJECTIVE_ROUTES'),
    SCRIPTS: get('SCRIPTS'),
    // The small unskippable moments (src/moments.js): the table, the pure rules and the script measurer; the prop sheets are in src/scripts.js
    MOMENTS: get('MOMENTS'),
    MOMENT_SHEETS: get('MOMENT_SHEETS'),
    MOMENT_GAP_S: get('MOMENT_GAP_S'),
    MOMENT_PER_VISIT: get('MOMENT_PER_VISIT'),
    MOMENT_MIN_MS: get('MOMENT_MIN_MS'),
    MOMENT_MAX_MS: get('MOMENT_MAX_MS'),
    MOMENT_TIMING: get('MOMENT_TIMING'),
    momentsEnabled: get('momentsEnabled'),
    momentFitsVisit: get('momentFitsVisit'),
    momentDue: get('momentDue'),
    momentGapS: get('momentGapS'),
    momentTriggerRect: get('momentTriggerRect'),
    markMomentStarted: get('markMomentStarted'),
    markMomentEnded: get('markMomentEnded'),
    momentTimeline: get('momentTimeline'),
    minigamesEnabled: get('minigamesEnabled'),
    audioEnabled: get('audioEnabled'),
    MINIGAMES: get('MINIGAMES'),
    winCardLayout: get('winCardLayout'),
    MG_CARD_LINE_H: get('MG_CARD_LINE_H'),
    MG_CARD_HEADER_H: get('MG_CARD_HEADER_H'),
    MG_WIN_BLANK_LINES: get('MG_WIN_BLANK_LINES'),
    // FB-0073: the intro card's own size rules (src/minigames/framework-data.js)
    MG_INSTRUCTION_LINES: get('MG_INSTRUCTION_LINES'),
    MG_INSTRUCTION_MAX_CHARS: get('MG_INSTRUCTION_MAX_CHARS'),
    MG_CARD_MAX_W: get('MG_CARD_MAX_W'),
    MG_CARD_MIN_W: get('MG_CARD_MIN_W'),
    MG_CARD_SIDE_PAD: get('MG_CARD_SIDE_PAD'),
    recordAttempt: get('recordAttempt'),
    minigameProgress: get('minigameProgress'),
    resetMinigameProgress: get('resetMinigameProgress'),
    freshMinigameProgress: get('freshMinigameProgress'),
    // Flappy pure logic
    flappyStep: get('flappyStep'),
    flappyFlap: get('flappyFlap'),
    flappyHitsPipe: get('flappyHitsPipe'),
    flappyHitsGround: get('flappyHitsGround'),
    flappyHitsCeiling: get('flappyHitsCeiling'),
    flappyPassedPipe: get('flappyPassedPipe'),
    // Flappy's own tuned constants (Mini-games quality pass) -- exposed so a test can check the real
    // numbers the game plays with, not a hand-typed copy that could silently drift from them.
    FLAPPY_GRAVITY: get('FLAPPY_GRAVITY'),
    FLAPPY_FLAP_VELOCITY: get('FLAPPY_FLAP_VELOCITY'),
    FLAPPY_BIRD_RADIUS: get('FLAPPY_BIRD_RADIUS'),
    // Platformer pure physics helpers
    integrateGravity: get('integrateGravity'),
    canCoyoteJump: get('canCoyoteJump'),
    shouldBufferedJumpFire: get('shouldBufferedJumpFire'),
    clipJumpRelease: get('clipJumpRelease'),
    // The platformer's own tuned constants (Mini-games quality pass), same reasoning as Flappy's above.
    PLATFORMER_GRAVITY: get('PLATFORMER_GRAVITY'),
    PLATFORMER_JUMP_VELOCITY: get('PLATFORMER_JUMP_VELOCITY'),
    PLATFORMER_MIN_JUMP_VELOCITY: get('PLATFORMER_MIN_JUMP_VELOCITY'),
    PLATFORMER_RUN_SPEED: get('PLATFORMER_RUN_SPEED'),
    PLATFORMER_COYOTE_MS: get('PLATFORMER_COYOTE_MS'),
    PLATFORMER_JUMP_BUFFER_MS: get('PLATFORMER_JUMP_BUFFER_MS'),
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
    snapshotState: get('snapshotState'),
    applyState: get('applyState'),
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
    buildCardSlides: get('buildCardSlides'),
    TEMP_CARD_SLIDES: get('TEMP_CARD_SLIDES'),
    DEFAULT_RECIPIENT: get('DEFAULT_RECIPIENT'),
    DEFAULT_PLAYER_NAME: get('DEFAULT_PLAYER_NAME'),
    DEFAULT_CREDITS: get('DEFAULT_CREDITS'),
    buildCreditsConfig: get('buildCreditsConfig'),
    creditsTimeline: get('creditsTimeline'),
    CREDITS_DEFAULT_TIMING: get('CREDITS_DEFAULT_TIMING'),
    // M5 sound
    SOUNDS: get('SOUNDS'),
    AUDIO_CATEGORIES: get('AUDIO_CATEGORIES'),
    AudioManager: get('AudioManager'),
    clampVolume: get('clampVolume'),
    localStorage,
    tileInfo: JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8')),
  };
}

// P5c (FB-0071): the ICL's hatch is a `sealedDoor` object over two SOLID door-leaf tiles until the scanner's mini-game opens it. A reachability test that
// asks "can she get to the room, the key, Alice" means "once the door is open", so it walks a copy of the grid in which every sealed door's cells are
// its open frame (a walkable tile). Pass the grid from gridFromTiled(), the map's tiledObjects() and the map's own tile table; the input is not changed.
function openSealedDoors(grid, objects, tileInfo) {
  const copy = grid.map((row) => row.slice());
  const indexOf = new Map(tileInfo.tiles.map((t, i) => [t.name, i]));
  for (const o of objects.filter((obj) => obj.type === 'sealedDoor')) {
    const open = String(o.props.openTiles || '').split(',').map((n) => n.trim()).filter(Boolean);
    open.forEach((name, i) => { copy[Math.floor(o.y)][Math.floor(o.x) + i] = indexOf.get(name); });
  }
  return copy;
}

// Objects from the sandbox have different prototypes; this makes them comparable with deepEqual.
const plain = (value) => JSON.parse(JSON.stringify(value));

module.exports = { ROOT, loadGameData, plain, openSealedDoors };
