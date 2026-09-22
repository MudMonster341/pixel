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

test('assets/minigames/ is up to date with tools/make-minigame-art.js (run `npm run minigame-art` if this fails)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-minigame-art-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-minigame-art.js'), '--out', out], { stdio: 'pipe' });
    const committedDir = path.join(ASSETS, 'minigames');
    for (const name of fs.readdirSync(out)) {
      const committed = path.join(committedDir, name);
      assert.ok(fs.existsSync(committed), `assets/minigames/${name} is missing`);
      assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(committed)), `assets/minigames/${name} is out of date`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('every mini-game backdrop is a full 960x540 image', () => {
  const names = ['platformer-bg.png', 'flappy-bg.png', 'tetris-bg.png'];
  for (const name of names) {
    const png = path.join(ASSETS, 'minigames', name);
    assert.ok(fs.existsSync(png), `assets/minigames/${name} is missing`);
    const { width, height } = pngSize(png);
    assert.equal(width, 960, `${png} is ${width} wide, expected 960`);
    assert.equal(height, 540, `${png} is ${height} tall, expected 540`);
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
  const { ITEMS, TILE, CHAR_HEIGHT, tileInfo } = loadGameData();
  const tiles = pngSize(path.join(ASSETS, 'tiles.png'));
  assert.equal(tiles.width, tileInfo.columns * TILE);
  assert.equal(tiles.height, Math.ceil(tileInfo.tiles.length / tileInfo.columns) * TILE);

  // ADR 0013: characters are 16x24, 3 rows (down/up/left) x 8 columns (idle, 6 walk frames,
  // idle-anim). The player and every recolored-pack NPC share this layout.
  const CHAR_COLS = 8;
  const CHAR_ROWS = 3;
  for (const name of ['player.png', 'npc-volunteer.png', 'npc-student-a.png', 'npc-student-b.png']) {
    assert.deepEqual(pngSize(path.join(ASSETS, name)), { width: CHAR_COLS * TILE, height: CHAR_ROWS * CHAR_HEIGHT }, name);
  }
  // Tomas (unchanged hand-drawn art): 3 static frames (down/up/left), no walk cycle, same height.
  assert.deepEqual(pngSize(path.join(ASSETS, 'npc.png')), { width: 3 * TILE, height: CHAR_HEIGHT });
  assert.deepEqual(pngSize(path.join(ASSETS, 'prompt.png')), { width: 2 * TILE, height: TILE }); // "E" + "!" frames

  const items = pngSize(path.join(ASSETS, 'items.png'));
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.ok(item.frame >= 0 && item.frame < items.width / TILE, `item "${id}" uses frame ${item.frame}, which isn't in items.png`);
  }
});

// FB-0025 ("the character drawings need to be improved... no detail"): the lead is now a recolored
// LimeZu Amelia (ADR 0013), not the old hand-drawn sprite. These read the committed PNG's raw pixels
// (decodePNG, the same decoder tools/make-assets.js uses to read the vendor pack) rather than
// trusting the generator's own code, so a future edit that quietly breaks the recolor still fails.
test('FB-0025: the lead\'s sprite sheet is 16x24 with 4-direction walks', () => {
  const { decodePNG } = require('../../tools/lib/png-decode');
  const { TILE, CHAR_HEIGHT } = loadGameData();
  const img = decodePNG(fs.readFileSync(path.join(ASSETS, 'player.png')));
  assert.equal(img.width, 8 * TILE);
  assert.equal(img.height, 3 * CHAR_HEIGHT);

  // "4-direction walks": down/up/left each animate (right is left, mirrored, same as every other
  // character in this game -- docs/STYLE_GUIDE.md), so the 6 walk-frame columns (1-6) in each row
  // must actually differ from each other, not repeat the same pixels 6 times.
  function frameBytes(col, row) {
    const x0 = col * TILE;
    const y0 = row * CHAR_HEIGHT;
    const bytes = [];
    for (let y = 0; y < CHAR_HEIGHT; y++) {
      for (let x = 0; x < TILE; x++) {
        const i = ((y0 + y) * img.width + (x0 + x)) * 4;
        bytes.push(img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]);
      }
    }
    return bytes.join(',');
  }
  for (let row = 0; row < 3; row++) {
    const walkFrames = new Set([1, 2, 3, 4, 5, 6].map((col) => frameBytes(col, row)));
    assert.ok(walkFrames.size > 1, `row ${row}'s 6 walk frames should have real motion, not be identical`);
  }
});

test('FB-0025: the lead\'s palette matches the owner\'s brief (black hair, fair skin, pink top)', () => {
  const { decodePNG } = require('../../tools/lib/png-decode');
  const img = decodePNG(fs.readFileSync(path.join(ASSETS, 'player.png')));
  const present = new Set();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    present.add(`#${[img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
  }
  // Brief colors (docs/STYLE_GUIDE.md "Characters"), already in PALETTE as q/S/s/M/c/P.
  for (const hex of ['#2a1c14', '#f4c9a0', '#d49a6a', '#ff6fb1', '#d94b8f', '#ff7eb6']) {
    assert.ok(present.has(hex), `expected brief color ${hex} in player.png`);
  }
  // None of the vendor pack's own untouched hair/skin/top tones should leak through unconverted.
  for (const hex of ['#957350', '#ba8d5e', '#8a6552', '#bf8b78', '#a85377', '#b95d72']) {
    assert.ok(!present.has(hex), `unrecolored pack color ${hex} leaked into player.png`);
  }
});

test('FB-0025: the campus NPCs are recolored distinctly from the lead', () => {
  const { decodePNG } = require('../../tools/lib/png-decode');
  function colors(name) {
    const img = decodePNG(fs.readFileSync(path.join(ASSETS, name)));
    const set = new Set();
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i + 3] === 0) continue;
      set.add(`#${[img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
    return set;
  }
  for (const name of ['npc-volunteer.png', 'npc-student-a.png', 'npc-student-b.png']) {
    const npc = colors(name);
    // The lead's signature pink top never appears on an NPC.
    assert.ok(!npc.has('#ff6fb1') && !npc.has('#d94b8f'), `${name} should not use the lead's pink`);
  }
});
