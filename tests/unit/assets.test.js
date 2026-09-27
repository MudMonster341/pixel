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

// M5 sound: assets/audio/ is nested (music/, sfx/, generated/), unlike the flat folders above, so
// this walks it recursively (Node's own fs.readdirSync(..., { recursive: true }), same as
// tests/unit/vendor-assets.test.js already uses for the same reason).
test('assets/audio/ is up to date with tools/make-audio.js (run `npm run audio` if this fails)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-audio-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-audio.js'), '--out', out], { stdio: 'pipe' });
    const committedDir = path.join(ASSETS, 'audio');
    const entries = fs.readdirSync(out, { recursive: true }).filter((name) => fs.statSync(path.join(out, name)).isFile());
    assert.ok(entries.length > 0, 'expected tools/make-audio.js to write at least one file');
    for (const name of entries) {
      const committed = path.join(committedDir, name);
      assert.ok(fs.existsSync(committed), `assets/audio/${name} is missing`);
      assert.ok(fs.readFileSync(path.join(out, name)).equals(fs.readFileSync(committed)), `assets/audio/${name} is out of date`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('assets/cutscenes/ (card art) is up to date with tools/make-card-art.js (run `npm run card-art` if this fails)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-card-art-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-card-art.js'), '--out', out], { stdio: 'pipe' });
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

  // ADR 0013/FB-0043: characters are 16x24, 4 rows (down/up/left/right, no mirroring) x 8 columns
  // (idle, 6 walk frames, idle-anim). The player and every recolored-pack NPC share this layout.
  const CHAR_COLS = 8;
  const CHAR_ROWS = 4;
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
test('FB-0025/FB-0043: the lead\'s sprite sheet is 16x24 with 4 real direction rows, each with real walk motion', () => {
  const { decodePNG } = require('../../tools/lib/png-decode');
  const { TILE, CHAR_HEIGHT } = loadGameData();
  const img = decodePNG(fs.readFileSync(path.join(ASSETS, 'player.png')));
  assert.equal(img.width, 8 * TILE);
  // FB-0043: 4 rows now (down/up/left/right), not 3 with "right" mirrored from "left" -- see
  // tools/make-assets.js CHAR_ROWS and ERR-0007.
  assert.equal(img.height, 4 * CHAR_HEIGHT);

  // "4-direction walks": down/up/left/right each genuinely animate on their own now (no mirroring),
  // so the 6 walk-frame columns (1-6) in each row must actually differ from each other, not repeat
  // the same pixels 6 times.
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
  for (let row = 0; row < 4; row++) {
    const walkFrames = new Set([1, 2, 3, 4, 5, 6].map((col) => frameBytes(col, row)));
    assert.ok(walkFrames.size > 1, `row ${row}'s 6 walk frames should have real motion, not be identical`);
  }

  // FB-0043's actual bug: the left (row 2) and right (row 3) rows used to be the *same* art, one of
  // them just flipped at draw time -- now they must be genuinely different pixels (real, separately
  // authored left- and right-facing frames), not a mirror of each other.
  const leftIdle = frameBytes(0, 2);
  const rightIdle = frameBytes(0, 3);
  assert.notEqual(leftIdle, rightIdle, 'left and right idle frames should be real, different art, not the same frame twice');
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

// FB-0043 ("she moonwalks both ways"): the actual bug was a *mislabeled* source block, not just "the
// frames happen to differ" (the previous test above). The real, verifiable claim is about which half
// of the frame the character leans/faces into: in a genuine right-facing pose the face/skin pixels
// sit in the right half of the 16px-wide frame, and in a genuine left-facing pose they sit in the left
// half. A frame that was actually just the other one mirrored would fail this the same way the bug did
// (world.js used to flip the mislabeled "left" row for right, which is exactly this shape of error).
test('FB-0043: the right-facing idle frame leans skin-right, the left-facing idle frame leans skin-left', () => {
  const { decodePNG } = require('../../tools/lib/png-decode');
  const { TILE, CHAR_HEIGHT } = loadGameData();
  const img = decodePNG(fs.readFileSync(path.join(ASSETS, 'player.png')));
  const SKIN = new Set(['#f4c9a0', '#d49a6a']); // the brief's skin highlight/mid tones (PALETTE.S/.s)

  // Average x (in-frame, 0-15) of every skin-colored pixel in one frame -- its "lean".
  function skinLean(col, row) {
    const x0 = col * TILE;
    const y0 = row * CHAR_HEIGHT;
    let sum = 0;
    let n = 0;
    for (let y = 0; y < CHAR_HEIGHT; y++) {
      for (let x = 0; x < TILE; x++) {
        const i = ((y0 + y) * img.width + (x0 + x)) * 4;
        if (img.data[i + 3] === 0) continue;
        const hex = `#${[img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        if (SKIN.has(hex)) { sum += x; n++; }
      }
    }
    assert.ok(n > 0, `frame (col ${col}, row ${row}) has no skin-colored pixels at all`);
    return sum / n;
  }

  // Rows, per tools/make-assets.js CHAR_ROWS: 0 down, 1 up, 2 left, 3 right. Column 0 is the idle pose.
  const leftLean = skinLean(0, 2);
  const rightLean = skinLean(0, 3);
  assert.ok(leftLean < TILE / 2, `left-facing idle frame should lean into the left half of the frame (got x=${leftLean})`);
  assert.ok(rightLean > TILE / 2, `right-facing idle frame should lean into the right half of the frame (got x=${rightLean})`);
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
  for (const name of ['npc-volunteer.png', 'npc-student-a.png', 'npc-student-b.png', 'npc-mustafa.png']) {
    const npc = colors(name);
    // The lead's signature pink top never appears on an NPC.
    assert.ok(!npc.has('#ff6fb1') && !npc.has('#d94b8f'), `${name} should not use the lead's pink`);
  }
});

// ADR 0016: Mustafa reuses Adam's body (the same base as the LUG volunteer, the only sensible choice
// among this pack's 4 named characters, all otherwise spoken for) but must not be recolored identically
// to him -- otherwise they'd read as the same character, not two different people.
test('FB-0032/ADR 0016: Mustafa is recolored distinctly from the LUG volunteer (both are Adam)', () => {
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
  const mustafa = colors('npc-mustafa.png');
  const volunteer = colors('npc-volunteer.png');
  assert.ok(!mustafa.has('#2f9e8f') && !mustafa.has('#4fc2ae'), "Mustafa should not use the volunteer's teal");
  assert.ok(!volunteer.has('#a33b4a') && !volunteer.has('#c8637a'), "the volunteer should not use Mustafa's maroon");
});
