// "EDI Madness" art (decisions/0025, docs/plans/2026-10-06-edi-madness.md phase E2): the three garage backdrops, the 8-heading car sheet, the
// small sprites, the instructor's portrait and the cover, all made by tools/make-minigame-art.js through tools/lib/edi-art.js. The pictures are
// checked as data (sizes, colours at the places the rules say, the frames being different), because nobody can see them in a unit test.
// Free packs only (FB-0025): the cars are the CC0 Kenney Roguelike Modern City car, recoloured, and turned in code for the in-between headings.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');
const ediArt = require('../../tools/lib/edi-art');

const g = loadGameData();
const c = (name) => g.evaluate(name);
const STAGES = c('EDI_STAGES');
const ART = plain(c('EDI_ART'));
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n');
const png = (rel) => decodePNG(fs.readFileSync(path.join(ROOT, rel)));
const hexOf = (img, x, y) => {
  const i = (y * img.width + x) * 4;
  return `#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join('')}`;
};
const alphaOf = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];
const CELL = 56;

// A frame (or any box) of an image as a comparable string.
function cellKey(img, x0, y0, w, h) {
  const parts = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) parts.push(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4).join(','));
  return parts.join(';');
}
function opaqueCount(img, x0, y0, w, h) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (alphaOf(img, x, y) === 255) n++;
  return n;
}
// How many pixels of a box are exactly `hex`.
function countColour(img, x0, y0, w, h, hex) {
  let n = 0;
  for (let y = Math.max(0, y0); y < Math.min(img.height, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(img.width, x0 + w); x++) if (hexOf(img, x, y) === hex) n++;
  return n;
}

test('EDI art: every picture exists at its documented size, and the generator header documents them', () => {
  const sizes = [
    ...ART.bg.map((file) => [file, 960, 540]),
    [ART.cars, 448, 392],
    [ART.sprites, 256, 32],
    [ART.instructor, 96, 48],
    [ART.cover, 480, 270],
  ];
  assert.equal(ART.bg.length, 3, 'one backdrop per stage');
  for (const [file, w, h] of sizes) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is missing: run node tools/make-minigame-art.js`);
    const img = png(file);
    assert.deepEqual([img.width, img.height], [w, h], file);
  }
  assert.equal(ART.cars.endsWith('edi-cars.png'), true);
  const generator = read('tools', 'make-minigame-art.js');
  for (const name of ['edi-bg-1', 'edi-bg-3', 'edi-cars.png', 'edi-sprites.png', 'edi-instructor.png', 'edi-cover.png']) assert.ok(generator.includes(name), `the generator's header mentions ${name}`);
  for (const call of ['buildEdiBg', 'buildEdiCars', 'buildEdiSprites', 'buildEdiInstructor', 'buildEdiCover']) assert.ok(generator.includes(`ediArt.${call}(`), `the generator writes ${call}`);
});

test('EDI art: every picture is in the preload table (EDI_ART) and in the offline bundle (derived from the literals in src/)', () => {
  const have = new Set(require('../../tools/pack-offline').collectRuntimeAssets().assets.map((a) => a.path));
  const files = [...ART.bg, ART.cars, ART.sprites, ART.instructor, ART.cover];
  assert.equal(files.length, 7);
  for (const file of files) {
    assert.ok(have.has(file), `${file} is not in the offline manifest`);
    assert.match(read('src', 'minigames', 'edi-logic.js'), new RegExp(file.replace(/\./g, '\\.')));
  }
  assert.equal(c('EDI_CAR_CELL'), CELL);
  assert.deepEqual(plain(c('EDI_SPRITE_FRAME')), { heartFull: 0, heartEmpty: 1, spark: 2, stars: 3, tick: 4, stop: 5, dust: 6, sparkle: 7 });
});

test('EDI art: ediCarFrame picks the column of the car sheet for a heading (E SE S SW W NW N NE)', () => {
  const frame = c('ediCarFrame');
  const P = Math.PI;
  assert.deepEqual([0, P / 4, P / 2, (3 * P) / 4, P, (-3 * P) / 4, -P / 2, -P / 4].map(frame), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(frame(-P), 4, 'west either way round');
  assert.equal(frame(2 * P - 0.05), 0, 'a heading just under a full turn is east again');
  assert.equal(frame(0.3), 0);
  assert.equal(frame(0.5), 1);
});

test('EDI art: the car sheet has a row per colour (the logic\'s order) and 8 distinct, non-empty, centred headings in each', () => {
  assert.deepEqual(plain(c('EDI_CAR_ROWS')), ediArt.EDI_CAR_ROWS);
  const sheet = png(ART.cars);
  const rows = ediArt.EDI_CAR_ROWS;
  assert.equal(sheet.height, CELL * rows.length);
  assert.equal(sheet.width, CELL * 8);
  rows.forEach((name, row) => {
    const keys = new Set();
    for (let col = 0; col < 8; col++) {
      const x0 = col * CELL;
      const y0 = row * CELL;
      assert.ok(opaqueCount(sheet, x0, y0, CELL, CELL) > 450, `${name} heading ${col} is drawn`);
      keys.add(cellKey(sheet, x0, y0, CELL, CELL));
      // the car's solid pixels stay inside the cell, with a margin, and are centred on the cell (the scene rotates nothing: it picks a frame)
      let minX = CELL; let maxX = -1; let minY = CELL; let maxY = -1;
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (alphaOf(sheet, x0 + x, y0 + y) === 255) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      assert.ok(minX >= 2 && minY >= 2 && maxX <= CELL - 3 && maxY <= CELL - 3, `${name} heading ${col} fits its cell`);
      assert.ok(Math.abs((minX + maxX) / 2 - CELL / 2) <= 3 && Math.abs((minY + maxY) / 2 - CELL / 2) <= 5, `${name} heading ${col} is centred on the car's centre`);
    }
    assert.equal(keys.size, 8, `${name}: all 8 headings differ (so W differs from E, N from S, and the diagonals from each other)`);
  });
});

test('EDI art: the car is the logic\'s size (44 px long when it points east or west, 44 px tall when north or south) and the diagonals fit its turning circle', () => {
  const sheet = png(ART.cars);
  const extent = (col, row = 1) => {
    let minX = CELL; let maxX = -1; let minY = CELL; let maxY = -1;
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) if (alphaOf(sheet, col * CELL + x, row * CELL + y) === 255) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    return [maxX - minX + 1, maxY - minY + 1];
  };
  const LEN = c('EDI_CAR_LEN');
  assert.equal(LEN, 44);
  for (const col of [0, 4]) assert.ok(Math.abs(extent(col)[0] - LEN) <= 2, `east/west is about ${LEN} wide`);
  for (const col of [2, 6]) assert.ok(Math.abs(extent(col)[1] - LEN) <= 2, `north/south is about ${LEN} tall`);
  for (const col of [1, 3, 5, 7]) { const [w, h] = extent(col); assert.ok(w <= 54 && h <= 54, 'a diagonal stays inside the cell'); }
});

test('EDI art: it is the same car in every colour (identical silhouettes), the colours differ, and the learner car is white with green trim and an L sign', () => {
  const sheet = png(ART.cars);
  const rows = ediArt.EDI_CAR_ROWS;
  const parked = rows.filter((r) => r !== 'learner');
  assert.ok(parked.length >= 4, 'at least four colours of parked car');
  const mask = (row, col) => {
    const parts = [];
    for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) parts.push(alphaOf(sheet, col * CELL + x, row * CELL + y) === 255 ? 1 : 0);
    return parts.join('');
  };
  for (let col = 0; col < 8; col++) {
    const first = mask(rows.indexOf(parked[0]), col);
    for (const name of parked) assert.equal(mask(rows.indexOf(name), col), first, `${name} heading ${col} has the same shape as ${parked[0]}`);
  }
  for (const name of parked) {
    const main = ediArt.EDI_CAR_COLOURS[name].main;
    for (let col = 0; col < 8; col++) assert.ok(countColour(sheet, col * CELL, rows.indexOf(name) * CELL, CELL, CELL, main) > 100, `${name} heading ${col} is mostly ${main}`);
  }
  assert.equal(new Set(parked.map((n) => ediArt.EDI_CAR_COLOURS[n].main)).size, parked.length, 'every colour has its own body tone');
  const learner = rows.indexOf('learner');
  const white = ediArt.EDI_CAR_COLOURS.learner.main;
  for (let col = 0; col < 8; col++) {
    assert.ok(countColour(sheet, col * CELL, learner * CELL, CELL, CELL, white) > 150, `learner heading ${col} is white`);
    assert.ok(countColour(sheet, col * CELL, learner * CELL, CELL, CELL, ediArt.EDI_CAR_COLOURS.learner.dark) > 25, `learner heading ${col} has green trim and the green L`);
    assert.ok(countColour(sheet, col * CELL, learner * CELL, CELL, CELL, '#ffffff') >= 20, `learner heading ${col} has the white L plate`);
  }
});

test('EDI art: the backdrops are not blank: a floor, lines, walls and shadows give many tones; the three stages differ', () => {
  const keys = [];
  ART.bg.forEach((file, i) => {
    const img = png(file);
    const tones = new Set();
    for (let y = 0; y < img.height; y += 3) for (let x = 0; x < img.width; x += 3) tones.add(hexOf(img, x, y));
    assert.ok(tones.size > 60, `${file} has many tones`);
    assert.ok(countColour(img, 0, 0, 960, 540, '#1a1c2c') > 1500, `${file}: outlined walls`);
    assert.ok(countColour(img, 0, 0, 960, 540, '#f4f1ea') > 400 || countColour(img, 0, 0, 960, 540, '#ffffff') > 400, `${file}: painted lines`);
    keys.push(cellKey(img, 0, 0, 960, 540).length + ':' + hexOf(img, 480, 300));
  });
  assert.equal(new Set(keys).size, 3, 'each stage has its own picture');
});

test('EDI art: the backdrops draw exactly what the rules make solid (every wall and pillar rectangle is outlined at its own edge, the bay is marked)', () => {
  STAGES.forEach((stage, i) => {
    const img = png(ART.bg[i]);
    for (const o of stage.obstacles.filter((q) => q.kind === 'wall' || q.kind === 'pillar')) {
      const cx = Math.floor(o.x + o.w / 2);
      const cy = Math.floor(o.y + o.h / 2);
      assert.equal(hexOf(img, cx, o.y), '#1a1c2c', `stage ${i + 1} ${o.kind} at ${o.x},${o.y}: the top edge is outlined`);
      assert.equal(hexOf(img, cx, o.y + o.h - 1), '#1a1c2c', `stage ${i + 1} ${o.kind}: the bottom edge is outlined`);
      assert.equal(hexOf(img, o.x, cy), '#1a1c2c', `stage ${i + 1} ${o.kind}: the left edge is outlined`);
      assert.equal(hexOf(img, o.x + o.w - 1, cy), '#1a1c2c', `stage ${i + 1} ${o.kind}: the right edge is outlined`);
      // and it is a solid block inside, not floor: its top surface is lighter than the floor 12 px away from it (where there is floor)
      assert.notEqual(hexOf(img, cx, cy), '#1a1c2c');
    }
    // pillars carry the yellow-black warning stripes at their base
    for (const o of stage.obstacles.filter((q) => q.kind === 'pillar')) {
      assert.ok(countColour(img, o.x, o.y, o.w, o.h, '#ffd23f') > 20 && countColour(img, o.x, o.y, o.w, o.h, '#1a1c2c') > 40, `stage ${i + 1} pillar has hazard stripes`);
    }
    // the target bay: a white outline on all four sides and a white P inside
    const bay = stage.bay;
    assert.equal(hexOf(img, bay.x, bay.y + Math.floor(bay.h / 2)), '#ffffff', 'bay outline, left');
    assert.equal(hexOf(img, bay.x + bay.w - 1, bay.y + Math.floor(bay.h / 2)), '#ffffff', 'bay outline, right');
    assert.equal(hexOf(img, bay.x + Math.floor(bay.w / 2), bay.y), '#ffffff', 'bay outline, top');
    assert.equal(hexOf(img, bay.x + Math.floor(bay.w / 2), bay.y + bay.h - 1), '#ffffff', 'bay outline, bottom');
    assert.ok(countColour(img, bay.x + 3, bay.y + 3, bay.w - 6, bay.h - 6, '#ffffff') >= 30, 'the big P is painted in the bay');
    // the start is on bare floor: nothing solid is drawn where the car starts (wall outlines would show as the outline colour)
    assert.equal(countColour(img, Math.round(stage.start.x - 20), Math.round(stage.start.y - 9), 40, 18, '#1a1c2c'), 0, `stage ${i + 1}: the start spot is clear`);
  });
});

test('EDI art: every parked car is in the backdrop, at its position, in its own colour (a different colour from its neighbours), drawn from the right frame', () => {
  const sheet = png(ART.cars);
  STAGES.forEach((stage, i) => {
    const img = png(ART.bg[i]);
    const cars = stage.obstacles.filter((o) => o.kind === 'car');
    assert.ok(cars.length >= 1);
    const names = cars.map((_, n) => ediArt.ediParkedColour(i, n));
    cars.forEach((o, n) => {
      const colour = ediArt.EDI_CAR_COLOURS[names[n]];
      const inside = countColour(img, Math.round(o.x), Math.round(o.y), o.w, o.h, colour.main);
      assert.ok(inside >= 60, `stage ${i + 1} car ${n} (${names[n]}) has its body colour at its place: ${inside}`);
      for (const other of Object.keys(ediArt.EDI_CAR_COLOURS).filter((k) => k !== names[n] && k !== 'learner')) {
        assert.ok(countColour(img, Math.round(o.x), Math.round(o.y), o.w, o.h, ediArt.EDI_CAR_COLOURS[other].main) < inside, `stage ${i + 1} car ${n} is ${names[n]}, not ${other}`);
      }
      // the very pixels of the sheet's frame for its angle are in the picture at the car's centre (the frame is blitted, not repainted)
      const col = c('ediCarFrame')(o.angle || 0);
      const row = ediArt.EDI_CAR_ROWS.indexOf(names[n]);
      let same = 0;
      let opaque = 0;
      for (let y = 0; y < CELL; y++) {
        for (let x = 0; x < CELL; x++) {
          if (alphaOf(sheet, col * CELL + x, row * CELL + y) !== 255) continue;
          opaque++;
          if (hexOf(sheet, col * CELL + x, row * CELL + y) === hexOf(img, Math.round(o.x + o.w / 2 - CELL / 2) + x, Math.round(o.y + o.h / 2 - CELL / 2) + y)) same++;
        }
      }
      assert.ok(same / opaque > 0.95, `stage ${i + 1} car ${n} is the ${names[n]} frame ${col}: ${same}/${opaque}`);
    });
    // neighbours (cars within 90 px of each other) never share a colour
    cars.forEach((a, p) => cars.forEach((b, q) => {
      if (p < q && Math.hypot(a.x - b.x, a.y - b.y) < 90) assert.notEqual(names[p], names[q], `stage ${i + 1}: cars ${p} and ${q} are neighbours`);
    }));
  });
  const all = new Set();
  STAGES.forEach((stage, i) => stage.obstacles.filter((o) => o.kind === 'car').forEach((_, n) => all.add(ediArt.ediParkedColour(i, n))));
  assert.ok(all.size >= 4, 'at least four colours in use');
});

test('EDI art: the stage 3 one-way arrow is painted (a white arrow on the floor at the arrow\'s own place), and every stage arrow is on the floor', () => {
  STAGES.forEach((stage, i) => {
    const img = png(ART.bg[i]);
    for (const a of stage.arrows) {
      let light = 0;
      for (let y = a.y - 16; y <= a.y + 16; y++) for (let x = a.x - 16; x <= a.x + 16; x++) if (Math.min(...[0, 1, 2].map((k) => img.data[(y * img.width + x) * 4 + k])) > 0xe0) light++;
      assert.ok(light >= 40, `stage ${i + 1}: a painted arrow at ${a.x},${a.y}`);
    }
  });
  assert.ok(STAGES[2].arrows.some((a) => Math.abs(a.angle - Math.PI) < 1e-9), 'stage 3 has the one-way arrow (pointing west)');
});

test('EDI art: the sprites are 8 drawn, different 32x32 cells; the instructor has two different frames, each with the green cap', () => {
  const sprites = png(ART.sprites);
  const keys = new Set();
  for (let i = 0; i < 8; i++) {
    assert.ok(opaqueCount(sprites, i * 32, 0, 32, 32) >= 15, `sprite ${i} is drawn`);
    keys.add(cellKey(sprites, i * 32, 0, 32, 32));
  }
  assert.equal(keys.size, 8);
  // the hearts are the hero game's hearts: a full one is red, an empty one grey
  assert.ok(countColour(sprites, 0, 0, 32, 32, '#e8465a') > 20);
  assert.equal(countColour(sprites, 32, 0, 32, 32, '#e8465a'), 0);
  assert.ok(countColour(sprites, 5 * 32, 0, 32, 32, '#e8465a') > 100, 'the STOP tag is red');
  const face = png(ART.instructor);
  assert.notEqual(cellKey(face, 0, 0, 48, 48), cellKey(face, 48, 0, 48, 48), 'neutral and wincing differ');
  for (const f of [0, 1]) {
    assert.ok(opaqueCount(face, f * 48, 0, 48, 48) > 900, `portrait ${f} is drawn`);
    assert.ok(countColour(face, f * 48, 0, 48, 48, '#2f9d62') > 100, `portrait ${f} has the green cap`);
    assert.ok(countColour(face, f * 48, 0, 48, 48, '#2d2a3e') > 20, `portrait ${f} has dark hair and the moustache`);
  }
  assert.ok(countColour(face, 48, 0, 48, 48, '#7fd0f0') > 6, 'the wincing frame has the sweat drop');
  assert.equal(countColour(face, 0, 0, 48, 48, '#7fd0f0'), 0);
});

test('EDI art: the cover is not blank: the title ribbon, the learner car with its L, the instructor\'s speech bubble and the P sign', () => {
  const cover = png(ART.cover);
  const tones = new Set();
  for (let y = 0; y < cover.height; y += 2) for (let x = 0; x < cover.width; x += 2) tones.add(hexOf(cover, x, y));
  assert.ok(tones.size > 40);
  assert.ok(countColour(cover, 56, 6, 369, 67, '#1f6b45') > 6000, 'the green title ribbon');
  assert.ok(countColour(cover, 56, 6, 369, 45, '#ffffff') > 1200, 'the big white title letters');
  assert.ok(countColour(cover, 60, 60, 190, 120, '#f7f6f1') > 2000, 'the white learner car, big');
  assert.ok(countColour(cover, 60, 60, 190, 120, '#2f9d62') > 100, 'its green trim and L');
  assert.ok(countColour(cover, 262, 90, 150, 70, '#ffffff') > 1500, 'the speech bubble');
  assert.ok(countColour(cover, 415, 85, 50, 45, '#2f64b8') > 500, 'the blue P sign');
  assert.ok(countColour(cover, 0, 76, 480, 8, '#ffffff') > 150 && countColour(cover, 0, 76, 480, 8, '#1a1c2c') > 150, 'the checkered stripe');
  // the title text is spelled with the project's pixel font, which has the letters now (M and G were added for it)
  const generator = read('tools', 'make-minigame-art.js');
  assert.match(generator, /M: \['#\.\.\.#', '##\.##'/);
  assert.match(generator, /G: \['\.####'/);
  assert.match(read('tools', 'lib', 'edi-art.js'), /'EDI MADNESS'/);
});

test('EDI art: the generator READS the stage data from src/minigames/edi-logic.js (no hard-coded copy of walls, cars, bays or arrows)', () => {
  const src = read('tools', 'lib', 'edi-art.js');
  assert.match(src, /readFileSync\(path\.join\(ROOT, 'src', 'minigames', 'edi-logic\.js'\)/);
  assert.match(src, /vm\.runInContext/);
  assert.match(src, /EDI_STAGES\[stageIndex\]/);
  for (const field of ['stage.obstacles', 'stage.bay', 'stage.arrows']) assert.ok(src.includes(field), `the art uses ${field}`);
  assert.ok(!/EDI_STAGES\s*=/.test(src), 'no second copy of the stages');
  assert.ok(!/ediParkedCar\(|ediTopBay\(|ediWall\(/.test(src), 'the helpers that build the stage data are not re-implemented in the art');
  // what it reads is the real thing: the data it evaluates equals the game's
  assert.deepEqual(plain(ediArt.loadEdiData().EDI_STAGES), plain(STAGES));
  assert.equal(ediArt.loadEdiData().EDI_CAR_LEN, c('EDI_CAR_LEN'));
  // and a coordinator who moves a wall in the data gets a different picture: the up-to-date test in assets.test.js regenerates every file
  assert.match(read('tests', 'unit', 'assets.test.js'), /make-minigame-art\.js/);
});

test('EDI art: the cars come from the CC0 Kenney Roguelike Modern City sheet (a pack with a licence on disk, credited), and no external artwork is pulled in', () => {
  const src = read('tools', 'lib', 'edi-art.js');
  assert.match(src, /kenney-roguelike-modern-city/);
  assert.ok(fs.existsSync(path.join(ROOT, 'assets', 'vendor', 'kenney-roguelike-modern-city', 'LICENSE.txt')));
  assert.match(read('CREDITS.md'), /Roguelike Modern City pack/);
  assert.ok(!/\.svg|loadImage|https?:/.test(src), 'no external or brand artwork is pulled in by the generator');
});
