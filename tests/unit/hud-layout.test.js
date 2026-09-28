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

// Pairs that are deliberately allowed to overlap because the two are never actually shown at the same
// time (the same "share a corner on purpose" shape as trackerExpanded/tracker): the dialog box visually
// replaces the hotbar the instant it opens (src/scenes/ui.js UIScene.update() -- `hotbar.setVisible
// (!dialog.isOpen)`), so their *boxes* overlapping in the pure math is expected, not a bug. Quality-loop
// category 4 run 2: the location banner moved to the same top-left corner the minimap occupies
// (Pokemon-style, a small plate rather than a top-center bar) -- the minimap hides for as long as the
// banner is on screen (src/scenes/ui.js LocationBanner/Minimap), the same "never shown together" shape.
const EXEMPT_PAIRS = [
  ['trackerExpanded', 'tracker'],
  ['hotbar', 'dialogBox'],
  ['minimap', 'banner'],
];
function isExempt(a, b) {
  return EXEMPT_PAIRS.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
}

// `dialogBox` is only a box actually on screen while the dialog is open or a script has the bars up
// (real dialog always opens under a `letterbox: 'in'`, src/scripts.js) -- checking it for overlaps
// otherwise would be testing a box that was never drawn in the first place (same idea as
// trackerExpanded only mattering while actually expanded).
function assertNoOverlaps(layout, label, { dialogActive = false } = {}) {
  // minimapArea is deliberately nested inside minimap (the map image sits inside its own panel), not
  // a sibling box -- excluded from the pairwise check the same way trackerExpanded/tracker are.
  const names = Object.keys(layout).filter((n) => n !== 'minimapArea' && (dialogActive || n !== 'dialogBox'));
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (isExempt(names[i], names[j])) continue;
      const a = layout[names[i]];
      const b = layout[names[j]];
      assert.ok(!overlaps(a, b), `${names[i]} ${JSON.stringify(a)} overlaps ${names[j]} ${JSON.stringify(b)} ${label}`);
    }
  }
}

for (const [width, height] of SIZES) {
  test(`hudLayout(${width}, ${height}): every box stays on screen`, () => {
    const layout = hudLayout(width, height);
    for (const [name, box] of Object.entries(layout)) {
      assert.ok(within(box, width, height), `${name} ${JSON.stringify(box)} is off-screen at ${width}x${height}`);
    }
  });

  test(`hudLayout(${width}, ${height}): no two boxes overlap`, () => {
    assertNoOverlaps(hudLayout(width, height), `at ${width}x${height}`);
  });

  // Quality-loop category 4 run 1, bugs 1/3: the hint banner used to sit inside the dialog box's own
  // territory (it was positioned relative to the hotbar, which the dialog box replaces when open), and
  // the dialog box itself used to sit where a letterboxed script's bottom bar would clip straight
  // through it. Every combination of dialogOpen/letterboxed must still produce a fully non-overlapping,
  // on-screen layout -- every real `say` step is preceded by its own `letterbox: 'in'` (src/scripts.js),
  // so `{ dialogOpen: true, letterboxed: true }` is the box real in-script dialog actually opens in,
  // not a hypothetical combination.
  for (const dialogOpen of [false, true]) {
    for (const letterboxed of [false, true]) {
      test(`hudLayout(${width}, ${height}, 5, { dialogOpen: ${dialogOpen}, letterboxed: ${letterboxed} }): no overlaps, all on screen`, () => {
        const layout = hudLayout(width, height, 5, { dialogOpen, letterboxed });
        for (const [name, box] of Object.entries(layout)) {
          assert.ok(within(box, width, height), `${name} ${JSON.stringify(box)} is off-screen`);
        }
        assertNoOverlaps(layout, `(dialogOpen=${dialogOpen}, letterboxed=${letterboxed}) at ${width}x${height}`, {
          dialogActive: dialogOpen || letterboxed,
        });
      });
    }
  }

  test(`hudLayout(${width}, ${height}): letterboxed lifts the dialog box clear of the bottom bar`, () => {
    const SCRIPT_LETTERBOX_HEIGHT = 70; // src/scenes/ui.js's own bar height
    const { dialogBox } = hudLayout(width, height, 5, { letterboxed: true });
    assert.ok(
      dialogBox.y + dialogBox.h <= height - SCRIPT_LETTERBOX_HEIGHT,
      `dialogBox ${JSON.stringify(dialogBox)} dips into the bottom letterbox bar at ${width}x${height}`,
    );
  });
}

test('hudLayout: the minimap is the ~120x90 declutter size, not the old 160x120', () => {
  const { minimap } = hudLayout(960, 540);
  assert.ok(minimap.w <= 160 && minimap.h <= 130, 'minimap should be smaller than the old panel');
});

test('hudLayout: the location banner is a top-left plate now, not a top-center bar (quality-loop category 4 run 2)', () => {
  const { banner, minimap } = hudLayout(960, 540);
  assert.equal(banner.x, 16, 'the banner should be anchored to the top-left corner, same margin as the minimap');
  assert.equal(banner.y, 16);
  assert.equal(banner.x, minimap.x, 'the banner and minimap share the same corner (never shown together)');
});

test('hudLayout: the hotbar box grows with slot count but stays centered', () => {
  const wide = hudLayout(960, 540, 8);
  const narrow = hudLayout(960, 540, 3);
  assert.ok(wide.hotbar.w > narrow.hotbar.w);
  const wideCenter = wide.hotbar.x + wide.hotbar.w / 2;
  const narrowCenter = narrow.hotbar.x + narrow.hotbar.w / 2;
  assert.ok(Math.abs(wideCenter - narrowCenter) < 1, 'the hotbar should stay horizontally centered regardless of slot count');
});
