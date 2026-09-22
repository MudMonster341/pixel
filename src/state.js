// Shared constants, plus the game state that survives moving between maps.

const TILE = 16;
// Characters (player + NPCs) are 16 wide x CHAR_HEIGHT tall (ADR 0013) -- taller than a map tile
// because the vendor character pack's figures need more vertical room than this game's tiles do.
// Tiles themselves stay TILE x TILE.
const CHAR_HEIGHT = 24;
const ZOOM = 3; // world pixels are drawn 3x; the UI draws at full resolution for crisp text
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const FONT = '"Press Start 2P", monospace';

class Inventory extends Phaser.Events.EventEmitter {
  constructor(size) {
    super();
    this.slots = Array.from({ length: size }, () => null); // each slot: { item, count } or null
    this.selected = 0;
  }

  // Stacks onto a matching slot first, otherwise uses the first empty one.
  add(itemId) {
    const { maxStack } = ITEMS[itemId];
    let index = this.slots.findIndex((slot) => slot && slot.item === itemId && slot.count < maxStack);
    if (index === -1) index = this.slots.indexOf(null);
    if (index === -1) return false;

    if (this.slots[index]) this.slots[index].count++;
    else this.slots[index] = { item: itemId, count: 1 };
    this.emit('added', itemId, index);
    this.emit('changed');
    return true;
  }

  select(index) {
    if (index < 0 || index >= this.slots.length) return;
    this.selected = index;
    this.emit('selected', index);
  }

  get selectedSlot() {
    return this.slots[this.selected];
  }
}

// Fresh-game defaults, kept in one place so both the initial GameState literal below and
// resetGameState() (Title screen "Play", GAME_FEEL.md) agree on what "brand new" means.
const DEFAULT_FLAGS = { tomasGaveSword: false, tomasChats: 0 };
// docs/STORY.md (M3, the LUG treasure hunt): 'arrival' (hasn't met the volunteer yet) -> 'hunting'
// (given the quest, out looking for the 3 keys) -> 'rewarded' (all 3 keys turned in, small box
// received -- the box opening and the birthday card itself are a later milestone). Set by the
// volunteer's own dialog actions (src/maps.js `main-block-g` npcs, `{ stage: ... }`, src/dialog.js).
const defaultQuest = () => ({
  stage: 'arrival',
  keys: { physicsLab: false, icvl: false, room195: false },
});

// M3a opening (docs/STORY.md "Opening", src/scenes/intro-*.js): the lead's chosen name and look,
// picked once at the start of a new game (name entry + customisation) and used everywhere the game
// refers to her from then on -- Mustafa's own follow-up line, the title screen's "Continue" label,
// and (once M1's tracker exists) the quest tracker. A sensible default so both screens can be
// skipped outright: "Aisha" reads as a real name for a new student, well inside the 10-char cap.
const DEFAULT_PLAYER_NAME = 'Aisha';
// `clothes` is one of the swatch ids tools/make-assets.js generates a `player-<id>.png` sheet for
// (CLOTHES_SWATCHES there): 'pink' is the original 2026-09-13 look, kept as the default so a game
// that never sees the customisation screen (an old save, `?intro=0` in tests) looks exactly as it
// always has.
const defaultCustomization = () => ({ clothes: 'pink' });

const GameState = {
  // Where the player is, kept current every frame by WorldScene (src/scenes/world.js) so a save
  // taken at any moment reflects the real position, not just the spot she last warped through.
  map: null, // current/last map key, or null until the world scene has run at least one frame
  position: null, // { x, y } in tiles
  facing: 'down',
  inventory: new Inventory(5),
  collected: new Set(), // ids of pickups already taken, so they don't respawn
  seenCutscenes: new Set(), // keys of CUTSCENES already played this session, so they don't replay (P4)
  // Dialog entries already shown at least once, keyed "npcId:entryId" (src/dialog.js
  // dialogEntryKey()). Drives the "!" vs "E" interaction bubble and any `when: { seen }` condition.
  seenDialog: new Set(),
  // In-fiction hint ids already shown once ("move", "talk", "run", "map" -- see src/scenes/ui.js
  // HintBanner and docs/GAME_FEEL.md). Replaces the old blocking controls card (FB-0023/0024).
  seenHints: new Set(),
  flags: { ...DEFAULT_FLAGS },
  // The treasure hunt (docs/STORY.md): what part of it she's reached, and which of the 3 keys are
  // found. Set by dialog actions (`{ stage: ... }`/`{ key: ... }`, src/dialog.js), saved and
  // restored like everything else.
  quest: defaultQuest(),
  // The clues/notes the LUG volunteer and the key rooms have given her so far (docs/STORY.md, M1's
  // "journal (J)" leftover): a plain array of short strings, oldest first, appended by dialog
  // actions (`{ journal: '...' }`, src/dialog.js) and shown by src/scenes/ui.js's Journal panel.
  journal: [],
  // M3a opening: her chosen name and look (see the defaults above). Set by src/scenes/intro-name.js
  // and src/scenes/intro-customize.js, saved and restored like everything else.
  playerName: DEFAULT_PLAYER_NAME,
  customization: defaultCustomization(),
};

// Call after changing GameState.flags or GameState.quest so autosave (src/save.js) saves soon.
// `window.game` doesn't exist yet the moment this script first runs (main.js creates it later, and
// unit tests never create it at all), so this is a no-op until the game has actually booted.
function notifyStateChanged() {
  if (typeof window !== 'undefined' && window.game) window.game.events.emit('state-changed');
}

// Title screen "Play" (new game, docs/GAME_FEEL.md): puts every persisted field back to its
// just-booted default. Keeps the existing Inventory instance (and everything already listening to
// it -- the hotbar, the tutorial checklist) instead of replacing it, the same reasoning src/save.js
// applyState() uses for the same reason. Doesn't touch localStorage: an old save is only overwritten
// once the new game actually autosaves, same as "New Game" in most save-file games.
function resetGameState(state = GameState) {
  state.map = null;
  state.position = null;
  state.facing = 'down';
  state.inventory.slots = state.inventory.slots.map(() => null);
  state.inventory.selected = 0;
  state.inventory.emit('changed');
  state.collected = new Set();
  state.seenCutscenes = new Set();
  state.seenDialog = new Set();
  state.seenHints = new Set();
  state.flags = { ...DEFAULT_FLAGS };
  state.quest = defaultQuest();
  state.journal = [];
  // Play (new game) also replays the whole opening (title.js startPlay()), which sets these fresh
  // itself -- reset here too so a game that skips the opening entirely (?intro=0) still starts from
  // the documented defaults rather than whatever the previous game happened to leave behind.
  state.playerName = DEFAULT_PLAYER_NAME;
  state.customization = defaultCustomization();
}
