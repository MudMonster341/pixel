// Shared constants, plus the game state that survives moving between maps.

const TILE = 16;
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
  flags: { tomasGaveSword: false, tomasChats: 0 },
  // The treasure hunt (docs/STORY.md): what part of it she's reached, and which of the 3 keys are
  // found. Set by dialog actions (`{ stage: ... }`/`{ key: ... }`, src/dialog.js), saved and
  // restored like everything else.
  quest: {
    stage: 'arrival', // 'arrival' -> 'briefed' -> 'hunting' -> 'done'
    keys: { physicsLab: false, icvl: false, room195: false },
  },
};

// Call after changing GameState.flags or GameState.quest so autosave (src/save.js) saves soon.
// `window.game` doesn't exist yet the moment this script first runs (main.js creates it later, and
// unit tests never create it at all), so this is a no-op until the game has actually booted.
function notifyStateChanged() {
  if (typeof window !== 'undefined' && window.game) window.game.events.emit('state-changed');
}
