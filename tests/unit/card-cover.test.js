// D17 (defect sweep 2026-10-04): a balloon string ran through "HAPPY BIRTHDAY," on the card cover. The title is real game
// text drawn over the middle of assets/cutscenes/card-cover.png (src/scenes/card.js showCover()), so the art must keep that
// band empty. This maps the title's on-screen box back into the cover PNG's own pixels (same scale and centring card.js
// uses) and checks that nothing but paper is there. The art itself is judged by eye.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const card = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'card.js'), 'utf8');
const num = (name) => Number(new RegExp('const ' + name + ' = ([0-9]+);').exec(card)?.[1]);
const CARD_W = num('CARD_W');
const CARD_H = num('CARD_H');
const CARD_X = num('CARD_X');
const SCREEN_W = 960;
const SCREEN_H = 540;

const cover = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'cutscenes', 'card-cover.png')));

// the title: centred at (SCREEN_W / 2, SCREEN_H / 2 - 10), 16 px glyphs, two lines with 10 px spacing (card.js showCover)
const coverScale = Math.max(CARD_W / 400, CARD_H / 260);
const toLocal = (sx, sy) => ({
  x: (sx - (CARD_X + CARD_W / 2 - (400 * coverScale) / 2)) / coverScale,
  y: (sy - (SCREEN_H / 2 - (260 * coverScale) / 2)) / coverScale,
});

function titleRectLocal(charsOnWidestLine) {
  const halfW = (charsOnWidestLine * 16) / 2 + 6; // + the 5 px stroke and a little air
  const cy = SCREEN_H / 2 - 10;
  const a = toLocal(SCREEN_W / 2 - halfW, cy - 21 - 6);
  const b = toLocal(SCREEN_W / 2 + halfW, cy + 21 + 6);
  return { x0: Math.floor(a.x), y0: Math.floor(a.y), x1: Math.ceil(b.x), y1: Math.ceil(b.y) };
}

test('D17: the constants this test reads exist in card.js', () => {
  assert.ok(CARD_W > 0 && CARD_H > 0 && CARD_X >= 0);
  assert.ok(card.includes('HAPPY BIRTHDAY,' + String.fromCharCode(92) + 'n'), 'the cover title text changed: update this test');
});

for (const [label, chars] of [['"HAPPY BIRTHDAY," (15 characters)', 15], ['a longer second line (20 characters)', 20]]) {
  test(`D17: the cover art is plain paper behind ${label}`, () => {
    const r = titleRectLocal(chars);
    assert.ok(r.x0 > 0 && r.x1 < cover.width && r.y0 > 0 && r.y1 < cover.height, `title box ${JSON.stringify(r)} is outside the cover`);
    const dark = [];
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const i = (y * cover.width + x) * 4;
        const [R, G, B] = [cover.data[i], cover.data[i + 1], cover.data[i + 2]];
        // paper is a light cream (and its faint texture lines are nearly as light); strings, balloons and hearts are not
        if (R < 225 || G < 205 || B < 170) dark.push(`(${x},${y}) rgb(${R},${G},${B})`);
      }
    }
    assert.deepEqual(dark, [], `${dark.length} non-paper pixel(s) inside the title box ${JSON.stringify(r)}, e.g. ${dark.slice(0, 3).join(' ')}`);
  });
}
