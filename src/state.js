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
  inventory: new Inventory(5),
  collected: new Set(), // ids of pickups already taken, so they don't respawn
  seenCutscenes: new Set(), // keys of CUTSCENES already played this session, so they don't replay (P4)
  flags: { tomasGaveSword: false, tomasChats: 0 },
};
