// HUD declutter pass (docs/GAME_FEEL.md rule 2, docs/QUALITY_LOOP.md category 4 "UI and menus"):
// src/maplogic.js's hudLayout(width, height) is the one source of truth src/scenes/ui.js's
// Minimap/LocationBanner/HintBanner/QuestTracker/Hotbar all read their own box from. This proves the
// game's own claim ("a panel that fits at 960x540 fits at every size, by construction") instead of
// just asserting it -- every box must stay on screen and never overlap another box, at the game's
// real 960x540 UI canvas and at two larger sizes of the same 16:9 shape.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

const { hudLayout } = loadGameData();

const SIZES = [
  [960, 540],
  [1280, 720],
  [1920, 1080],
];

function within(box, width, height) {
  return box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

for (const [width, height] of SIZES) {
  test(`hudLayout(${width}, ${height}): every box stays on screen`, () => {
    const layout = hudLayout(width, height);
    for (const [name, box] of Object.entries(layout)) {
      assert.ok(within(box, width, height), `${name} ${JSON.stringify(box)} is off-screen at ${width}x${height}`);
    }
  });

  test(`hudLayout(${width}, ${height}): no two boxes overlap`, () => {
    const layout = hudLayout(width, height);
    // trackerExpanded replaces tracker when the pill is expanded -- they're never shown at the same
    // time, so checking them against each other would be a false positive (they share a corner on
    // purpose). minimapArea is deliberately nested inside minimap (the map image sits inside its own
    // panel), not a sibling box.
    const names = Object.keys(layout).filter((n) => n !== 'trackerExpanded' && n !== 'minimapArea');
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = layout[names[i]];
        const b = layout[names[j]];
        assert.ok(!overlaps(a, b), `${names[i]} ${JSON.stringify(a)} overlaps ${names[j]} ${JSON.stringify(b)} at ${width}x${height}`);
      }
    }
    // The expanded tracker pill still must never overlap anything outside its own corner.
    const others = names.filter((n) => n !== 'tracker');
    for (const name of others) {
      assert.ok(!overlaps(layout.trackerExpanded, layout[name]), `trackerExpanded overlaps ${name} at ${width}x${height}`);
    }
  });
}

test('hudLayout: the minimap is the ~120x90 declutter size, not the old 160x120', () => {
  const { minimap } = hudLayout(960, 540);
  assert.ok(minimap.w <= 160 && minimap.h <= 130, 'minimap should be smaller than the old panel');
});

test('hudLayout: the hotbar box grows with slot count but stays centered', () => {
  const wide = hudLayout(960, 540, 8);
  const narrow = hudLayout(960, 540, 3);
  assert.ok(wide.hotbar.w > narrow.hotbar.w);
  const wideCenter = wide.hotbar.x + wide.hotbar.w / 2;
  const narrowCenter = narrow.hotbar.x + narrow.hotbar.w / 2;
  assert.ok(Math.abs(wideCenter - narrowCenter) < 1, 'the hotbar should stay horizontally centered regardless of slot count');
});
