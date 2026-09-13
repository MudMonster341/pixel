// Loads the game's browser scripts (data + pure logic) into a sandbox so unit tests can use them
// without a browser. Each call gives a fresh copy, so tests can't leak state into each other.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPTS = ['src/items.js', 'src/maps.js', 'src/maplogic.js', 'src/state.js'];

// Just enough of Phaser's EventEmitter for state.js
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

function loadGameData() {
  const context = vm.createContext({ Phaser: { Events: { EventEmitter: TinyEmitter } }, console });
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  }
  const get = (name) => vm.runInContext(name, context);
  return {
    ITEMS: get('ITEMS'),
    MAPS: get('MAPS'),
    STRUCTURES: get('STRUCTURES'),
    START_MAP: get('START_MAP'),
    TILE: get('TILE'),
    Inventory: get('Inventory'),
    GameState: get('GameState'),
    buildTileGrid: get('buildTileGrid'),
    isWalkableTile: get('isWalkableTile'),
    tileInfo: JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8')),
  };
}

// Objects from the sandbox have different prototypes; this makes them comparable with deepEqual.
const plain = (value) => JSON.parse(JSON.stringify(value));

module.exports = { ROOT, loadGameData, plain };
