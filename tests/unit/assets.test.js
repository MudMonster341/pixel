// Makes sure the committed art matches tools/make-assets.js, and has the sizes the game expects.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, loadGameData } = require('../helpers/game-data');

const ASSETS = path.join(ROOT, 'assets');

function pngSize(file) {
  const buffer = fs.readFileSync(file);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('assets/ is up to date with tools/make-assets.js (run `npm run assets` if this fails)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-assets-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-assets.js'), '--out', out], { stdio: 'pipe' });
    for (const name of fs.readdirSync(out)) {
      const committed = path.join(ASSETS, name);
      assert.ok(fs.existsSync(committed), `assets/${name} is missing`);
      assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(committed)), `assets/${name} is out of date`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('assets/cutscenes/ is up to date with tools/make-cutscenes.js (run `npm run cutscenes` if this fails)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-cutscenes-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-cutscenes.js'), '--out', out], { stdio: 'pipe' });
    const committedDir = path.join(ASSETS, 'cutscenes');
    for (const name of fs.readdirSync(out)) {
      const committed = path.join(committedDir, name);
      assert.ok(fs.existsSync(committed), `assets/cutscenes/${name} is missing`);
      assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(committed)), `assets/cutscenes/${name} is out of date`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('every CUTSCENES image has a matching PNG sized to fill 960 wide and pan (taller than 540/3)', () => {
  const { CUTSCENES } = loadGameData();
  for (const def of Object.values(CUTSCENES)) {
    const file = def.image.replace(/^cutscene-/, '');
    const png = path.join(ASSETS, 'cutscenes', `${file}.png`);
    assert.ok(fs.existsSync(png), `${png} is missing for CUTSCENES image "${def.image}"`);
    const { width, height } = pngSize(png);
    assert.ok(width > 0 && height >= 540 / 3, `${png} is too short to pan (${width}x${height})`);
  }
});

test('tile names are unique', () => {
  const { tileInfo } = loadGameData();
  const names = tileInfo.tiles.map((tile) => tile.name);
  assert.equal(new Set(names).size, names.length);
});

test('sprite sheets have the sizes the game expects', () => {
  const { ITEMS, TILE, tileInfo } = loadGameData();
  const tiles = pngSize(path.join(ASSETS, 'tiles.png'));
  assert.equal(tiles.width, tileInfo.columns * TILE);
  assert.equal(tiles.height, Math.ceil(tileInfo.tiles.length / tileInfo.columns) * TILE);

  assert.deepEqual(pngSize(path.join(ASSETS, 'player.png')), { width: 3 * TILE, height: 3 * TILE });
  assert.deepEqual(pngSize(path.join(ASSETS, 'npc.png')), { width: 3 * TILE, height: TILE });
  assert.deepEqual(pngSize(path.join(ASSETS, 'prompt.png')), { width: 2 * TILE, height: TILE }); // "E" + "!" frames

  const items = pngSize(path.join(ASSETS, 'items.png'));
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.ok(item.frame >= 0 && item.frame < items.width / TILE, `item "${id}" uses frame ${item.frame}, which isn't in items.png`);
  }
});
