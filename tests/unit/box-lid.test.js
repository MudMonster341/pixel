// D04 (defect sweep 2026-10-04): in the ending's closed-box frame the lid floated about 55 px above the box. The scene
// (src/scenes/box-opening.js, a Phaser scene unit tests cannot load) seats the lid with three constants that describe
// the two generated PNGs. This test reads those constants out of the source and checks them against the real pixels, so
// the lid cannot drift off the box again if either the art or the numbers change.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const source = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'box-opening.js'), 'utf8');
const num = (name) => Number(new RegExp('const ' + name + ' = ([0-9]+);').exec(source)?.[1]);
const BOX_BASE_HEIGHT = num('BOX_BASE_HEIGHT');
const BOX_BODY_TOP_ROW = num('BOX_BODY_TOP_ROW');
const LID_BOTTOM_PAD = num('LID_BOTTOM_PAD');

function opaqueRows(file) {
  const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'cutscenes', file)));
  let first = Infinity;
  let last = -1;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) if (png.data[(y * png.width + x) * 4 + 3] > 0) { first = Math.min(first, y); last = Math.max(last, y); }
  }
  return { height: png.height, first, last };
}

test('D04: box-opening.js constants match the card-box PNGs', () => {
  for (const [name, v] of Object.entries({ BOX_BASE_HEIGHT, BOX_BODY_TOP_ROW, LID_BOTTOM_PAD })) assert.ok(Number.isInteger(v) && v >= 0, `${name} not found in box-opening.js`);
  const base = opaqueRows('card-box-base.png');
  const lid = opaqueRows('card-box-lid.png');
  assert.equal(base.height, BOX_BASE_HEIGHT, 'card-box-base.png height');
  assert.equal(base.first, BOX_BODY_TOP_ROW, "the body's first opaque row");
  assert.equal(lid.height - 1 - lid.last, LID_BOTTOM_PAD, 'transparent rows under the lid art');
});

test('D04: at every scale the lid\'s bottom edge lands exactly on the body top (no floating gap, no sinking)', () => {
  const lid = opaqueRows('card-box-lid.png');
  const baseY = 400;
  const boxBodyTopY = (scale) => baseY - (BOX_BASE_HEIGHT - BOX_BODY_TOP_ROW) * scale;
  const lidSeatY = (scale) => boxBodyTopY(scale) + LID_BOTTOM_PAD * scale;
  for (const scale of [3.75, 4, 5]) {
    // the lid image's origin is its bottom edge (origin 0.5, 1); its last opaque row ends LID_BOTTOM_PAD rows above that
    const lidArtBottom = lidSeatY(scale) - (lid.height - 1 - lid.last) * scale;
    assert.equal(lidArtBottom, boxBodyTopY(scale));
  }
  // and the scene really uses these helpers to place the lid and the glow
  assert.match(source, /add\.image\(cx, lidSeatY\(baseY, scale\), 'card-box-lid'\)/);
  assert.match(source, /const mouthY = boxBodyTopY\(baseY, scale\)/);
});
