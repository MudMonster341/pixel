// FB-0073 ("why is the text box cut off on the right") and FB-0068 ("close the item bar on the right as well"): every
// bordered panel in the game (dialog box, mini-game cards, pause menu, journal, toast/quest pill, hotbar, buttons) is one
// 9-slice frame from assets/ui-panel.png (src/scenes/ui.js makePanel()/Button). The frame used to be a 45x45 crop of the
// pack's 48x48 art that dropped its whole right border and the bottom bevel, so every panel had NO right edge. These tests
// read the generated PNG (the same file the game loads) and the layout numbers, so a regression to a lopsided frame, or a
// panel whose slices no longer line up with it, fails here instead of in front of the owner.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { decodePNG } = require('../../tools/lib/png-decode');
const { ROOT, loadGameData } = require('../helpers/game-data');

const png = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'ui-panel.png')));
const uiSource = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'ui.js'), 'utf8').replace(/\r\n/g, '\n');
const generator = fs.readFileSync(path.join(ROOT, 'tools', 'make-assets.js'), 'utf8').replace(/\r\n/g, '\n');

const numberIn = (source, re) => {
  const m = re.exec(source);
  assert.ok(m, `no match for ${re}`);
  return Number(m[1]);
};
const FRAME = numberIn(uiSource, /const UI_FRAME_SIZE = (\d+);/);
const BORDER = numberIn(uiSource, /const UI_FRAME_BORDER = (\d+);/);
const FRAMES = 4; // panel, then the button's normal / hover / pressed states

// One pixel of frame `f` of the sheet.
function pixel(f, x, y) {
  const i = ((f * FRAME + y) * png.width + x) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}
const same = (a, b) => a.every((v, i) => v === b[i]);

// What Phaser's NineSlice draws at pixel (x, y) of a w x h panel built with BORDER on every side: the four corners and four
// edges are copied (the edges stretched along their own length), the centre is stretched. Returns the frame pixel it samples.
function nineSliceSource(w, h, x, y) {
  const axis = (v, len) => {
    if (v < BORDER) return v;
    if (v >= len - BORDER) return FRAME - (len - v);
    return BORDER + Math.floor(((v - BORDER) * (FRAME - 2 * BORDER)) / (len - 2 * BORDER));
  };
  return [axis(x, w), axis(y, h)];
}

test('FB-0073: ui.js\'s frame size and border match the generated ui-panel.png (four square frames stacked)', () => {
  assert.equal(png.width, FRAME, 'the sheet is as wide as one frame');
  assert.equal(png.height, FRAME * FRAMES, 'the sheet holds exactly four frames');
  const scale = numberIn(generator, /const UI_FRAME_SCALE = (\d+);/);
  const px = numberIn(generator, /const UI_FRAME_PX = (\d+);/);
  assert.equal(FRAME, px * scale, 'UI_FRAME_SIZE is the whole pack frame at its upscale, in both files');
  assert.equal(BORDER, 2 * scale, 'the border is the pack frame\'s 2-px ring at the same upscale');
  // The old crop that dropped the right edge must not come back.
  assert.doesNotMatch(generator, /const UI_FRAME_CROP = 45/);
});

test('FB-0073: every frame has the same complete border on all four sides, mirrored left/right and top/bottom', () => {
  const mid = FRAME / 2;
  for (let f = 0; f < FRAMES; f++) {
    for (let i = 0; i < BORDER; i++) {
      const left = pixel(f, i, mid);
      const right = pixel(f, FRAME - 1 - i, mid);
      const top = pixel(f, mid, i);
      const bottom = pixel(f, mid, FRAME - 1 - i);
      for (const [side, p] of [['left', left], ['right', right], ['top', top], ['bottom', bottom]]) {
        // The outer bevel line of the button's pressed frame is a translucent dark line by design (a sunken look); every
        // other border pixel is fully opaque. A missing edge would draw as the panel fill (alpha 235 / 255 navy) instead.
        assert.ok(p[3] > 0, `frame ${f}: the ${side} border is transparent at depth ${i}`);
        if (i >= BORDER / 2) assert.equal(p[3], 255, `frame ${f}: the ${side} border line is not opaque at depth ${i}`);
        if (f !== 3) assert.equal(p[3], 255, `frame ${f}: the ${side} border is not opaque at depth ${i} (a missing edge draws as the panel fill)`);
      }
      assert.deepEqual(right, left, `frame ${f}: the right border at depth ${i} differs from the left one`);
      assert.deepEqual(bottom, top, `frame ${f}: the bottom border at depth ${i} differs from the top one`);
    }
    // And the inside is the panel fill, not more border: the pixel just past the ring is not the ring's own colour.
    assert.ok(!same(pixel(f, BORDER, mid), pixel(f, BORDER - 1, mid)), `frame ${f}: the border is wider than the inset the NineSlice uses`);
  }
  // The four corners are a clean notch, the same on all of them (no leftover shadow pixel on the bottom ones).
  for (let f = 0; f < FRAMES; f++) {
    for (const [x, y] of [[0, 0], [FRAME - 1, 0], [0, FRAME - 1], [FRAME - 1, FRAME - 1]]) {
      assert.equal(pixel(f, x, y)[3], 0, `frame ${f}: corner ${x},${y} should be transparent`);
    }
  }
});

test('FB-0073: at every panel size, the drawn right and bottom edges are the border, exactly like the left and top ones', () => {
  // The sizes the game really builds: hotbar, dialog box, mini-game cards, pause menu, name tag, hint pill, a tiny one.
  const sizes = [[292, 68], [760, 138], [640, 258], [420, 164], [300, 250], [212, 40], [320, 36], [40, 40], [2 * BORDER, 2 * BORDER]];
  for (const [w, h] of sizes) {
    for (const f of [0, 1]) {
      for (const y of [Math.floor(h / 2)]) {
        for (let i = 0; i < BORDER; i++) {
          const [lx, ly] = nineSliceSource(w, h, i, y);
          const [rx, ry] = nineSliceSource(w, h, w - 1 - i, y);
          assert.deepEqual(pixel(f, rx, ry), pixel(f, lx, ly), `${w}x${h} frame ${f}: right border pixel ${i} differs from the left one`);
          assert.equal(pixel(f, rx, ry)[3], 255, `${w}x${h} frame ${f}: right border pixel ${i} is not opaque`);
        }
      }
      const x = Math.floor(w / 2);
      for (let i = 0; i < BORDER; i++) {
        const [tx, ty] = nineSliceSource(w, h, x, i);
        const [bx, by] = nineSliceSource(w, h, x, h - 1 - i);
        assert.deepEqual(pixel(f, bx, by), pixel(f, tx, ty), `${w}x${h} frame ${f}: bottom border pixel ${i} differs from the top one`);
        assert.equal(pixel(f, bx, by)[3], 255, `${w}x${h} frame ${f}: bottom border pixel ${i} is not opaque`);
      }
    }
  }
});

test('FB-0073: every NineSlice in ui.js is built with the same inset on all four sides, and panels all go through makePanel()', () => {
  const calls = uiSource.match(/add\.nineslice\([^;]*;/g) || [];
  assert.ok(calls.length >= 2, 'makePanel() and Button each build a nineslice');
  for (const call of calls) {
    assert.match(call, /UI_FRAME_BORDER, UI_FRAME_BORDER, UI_FRAME_BORDER, UI_FRAME_BORDER\)/, `a nineslice with an uneven inset: ${call}`);
  }
  // No panel is drawn by hand any more: a fillRect + strokeRect "box" would bring a missing edge back at some size.
  assert.doesNotMatch(uiSource, /function drawPanel\(/);
  // The shared panel code resizes in place (the dialog's name tag, the quest pill, the journal), so a resized panel is the
  // same frame at the new size, not a redraw that could leave an edge out.
  assert.match(uiSource, /container\.setPanelSize = \(nw, nh\) => \{[\s\S]*?nine\.setSize\(nw, nh\);/);
});

// ---------- FB-0068: the item bar ----------

test('FB-0068: the hotbar frame is symmetric around its five slots, centred, and fully inside the canvas at every size', () => {
  const { hudLayout } = loadGameData();
  const SLOT = 48;
  const GAP = 8;
  for (const [width, height] of [[960, 540], [1280, 720], [800, 450]]) {
    const { hotbar } = hudLayout(width, height, 5);
    const pad = (hotbar.h - SLOT) / 2; // ui.js Hotbar derives its slots from this very pad
    const firstLeft = hotbar.x + pad;
    const lastRight = firstLeft + 4 * (SLOT + GAP) + SLOT;
    assert.equal(hotbar.x + hotbar.w - lastRight, pad, `${width}x${height}: the space right of slot 5 equals the space left of slot 1 and above/below the slots`);
    assert.ok(Math.abs(hotbar.x + hotbar.w / 2 - width / 2) <= 1, `${width}x${height}: the bar is centred`);
    assert.ok(hotbar.x >= 0 && hotbar.x + hotbar.w <= width, `${width}x${height}: the bar is inside the canvas horizontally`);
    assert.ok(hotbar.y >= 0 && hotbar.y + hotbar.h <= height, `${width}x${height}: the bar is inside the canvas vertically`);
    // The selected slot's gold outline (4 px, centred on the slot's edge) reaches 2 px outside the slot: it must stay
    // clear of the panel's own border, including on slot 5's right side.
    assert.ok(pad - 2 >= BORDER, `${width}x${height}: the selected-slot outline would touch the panel border`);
  }
});

test('FB-0068: the hotbar draws its panel and slots from the same layout box (no hand-placed right edge)', () => {
  assert.match(uiSource, /const layout = hudLayout\(GAME_WIDTH, GAME_HEIGHT, count\);/);
  assert.match(uiSource, /const x0 = layout\.hotbar\.x \+ pad;/);
  assert.match(uiSource, /this\.panel = makePanel\(scene, this\.bounds\.x, this\.bounds\.y, this\.bounds\.w, this\.bounds\.h\);/);
  assert.match(uiSource, /const x = x0 \+ i \* \(size \+ gap\);/);
});
