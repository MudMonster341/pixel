// D01 (defect sweep 2026-10-04): the full-screen map (M / N) overprinted its place labels and let some run off the frame
// ("chanical Block", "Manipal University Boys..." at the screen edge). The layout is now pure (src/maplogic.js
// fullMapLabelCandidates + placeMapLabels), tested here on small cases and on every real map: every label stays inside the
// frame, no two labels overlap, and story-relevant names win a clash. The look of the result is for the coordinator to judge.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { MAPS, tiledObjects, fullMapLabelCandidates, placeMapLabels, mapLabelPriority, MAP_LABEL } = loadGameData();

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const box = (l) => ({ x0: l.x - l.w / 2, x1: l.x + l.w / 2, y0: l.y - l.h / 2, y1: l.y + l.h / 2 });
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const cand = (name, px, py, extra = {}) => ({ name, px, py, area: 100, priority: 1, ...extra });
const FRAME = { x0: 100, y0: 50, x1: 500, y1: 300 };

test('D01: a label near or beyond an edge is pulled back inside the frame', () => {
  const [a, b, c, d] = placeMapLabels([cand('Edge', 0, 0), cand('Right', 9999, 150), cand('Low', 300, 9999), cand('Mid', 300, 150)], FRAME);
  for (const l of [a, b, c, d]) {
    const r = box(l);
    assert.ok(r.x0 >= FRAME.x0 && r.x1 <= FRAME.x1 && r.y0 >= FRAME.y0 && r.y1 <= FRAME.y1, `${l.name} ${JSON.stringify(r)} outside ${JSON.stringify(FRAME)}`);
  }
});

test('D01: a label that would overlap one already placed is skipped, and the story-relevant one wins the clash', () => {
  const placed = placeMapLabels([
    cand('Some Big Office', 300, 150, { area: 9999 }),
    cand('Main Block', 305, 152, { area: 10, priority: 0 }),
    cand('Far Away Shed', 120, 280),
  ], FRAME);
  assert.deepEqual(Array.from(placed, (l) => l.name), ['Main Block', 'Far Away Shed']);
});

test('D01: a name longer than the allowed width is shortened with an ellipsis; one wider than the frame is dropped', () => {
  const [long] = placeMapLabels([cand('Manipal University Boys Hostel Block Number Seven', 300, 150)], FRAME);
  assert.ok(long.text.endsWith('…') && long.text.length === MAP_LABEL.maxChars, long.text);
  assert.equal(placeMapLabels([cand('X'.repeat(20), 300, 150)], { x0: 0, y0: 0, x1: 50, y1: 50 }).length, 0);
});

test('D01: labels are placed in priority order (story names first), then biggest area first', () => {
  const names = Array.from(placeMapLabels([cand('B', 110, 60, { area: 1 }), cand('A', 200, 60, { area: 5 }), cand('S', 300, 60, { area: 1, priority: 0 })], FRAME), (l) => l.name);
  assert.deepEqual(names, ['S', 'A', 'B']);
});

test('D01: the same name from an area and a building is labelled once', () => {
  const placed = placeMapLabels([cand('Hostel C', 150, 100), cand('Hostel C', 400, 250)], FRAME);
  assert.equal(placed.length, 1);
});

test('D01: the candidate filter skips placeholders, roads, gate parking lots and map-sized outlines, and tags story names', () => {
  const objs = [
    { type: 'area', name: 'Main Block', x: 1, y: 1, width: 4, height: 4, props: {} },
    { type: 'building', name: 'Building 519043987', x: 1, y: 1, width: 2, height: 2, props: {} },
    { type: 'area', name: 'Academic Core Loop Road', x: 1, y: 1, width: 2, height: 2, props: { kind: 'road' } },
    { type: 'area', name: 'Gate Parking (West)', x: 1, y: 1, width: 2, height: 2, props: {} },
    { type: 'area', name: 'Campus outline', x: 0, y: 0, width: 90, height: 90, props: {} },
    { type: 'door', name: 'A door', x: 1, y: 1, width: 0, height: 0, props: {} },
    { type: 'area', name: 'Cafe', x: 1, y: 1, width: 3, height: 3, props: {} },
  ];
  const c = fullMapLabelCandidates(objs, 100, 100);
  assert.deepEqual(Array.from(c, (x) => x.name), ['Main Block', 'Cafe']);
  assert.deepEqual(Array.from(c, (x) => x.priority), [0, 2]);
  assert.deepEqual(Array.from(['Hostel D', 'Tennis Courts', 'Side Gate', 'Library Block', 'Mechanical Block', 'DIAC Park'], (n) => mapLabelPriority(n)), [1, 1, 0, 0, 0, 2]);
});

// ---- every real map, laid out exactly as FullMap.open() does (src/scenes/ui.js) ----
for (const [key, def] of Object.entries(MAPS)) {
  if (!def.tiled) continue;
  test(`D01: ${key}: every full-map label is inside the frame and none overlap`, () => {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.tiled}.json`), 'utf8'));
    const objects = tiledObjects(json);
    const cols = json.width;
    const rows = json.height;
    const scale = Math.min((GAME_WIDTH - 64) / cols, (GAME_HEIGHT - 96) / rows);
    const offsetX = (GAME_WIDTH - cols * scale) / 2;
    const offsetY = 48 + ((GAME_HEIGHT - 96) - rows * scale) / 2;
    const frame = {
      x0: Math.max(8, offsetX), y0: Math.max(40, offsetY),
      x1: Math.min(GAME_WIDTH - 8, offsetX + cols * scale), y1: Math.min(GAME_HEIGHT - 34, offsetY + rows * scale),
    };
    const candidates = fullMapLabelCandidates(objects, cols, rows).map((c) => ({ ...c, px: offsetX + c.x * scale, py: offsetY + c.y * scale }));
    const labels = placeMapLabels(candidates, frame);
    for (const l of labels) {
      const r = box(l);
      assert.ok(r.x0 >= frame.x0 - 1e-6 && r.x1 <= frame.x1 + 1e-6 && r.y0 >= frame.y0 - 1e-6 && r.y1 <= frame.y1 + 1e-6, `${key}: "${l.text}" ${JSON.stringify(r)} leaves the frame ${JSON.stringify(frame)}`);
      assert.ok(r.x0 >= 0 && r.x1 <= GAME_WIDTH && r.y0 >= 0 && r.y1 <= GAME_HEIGHT, `${key}: "${l.text}" leaves the screen`);
    }
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) assert.ok(!overlap(box(labels[i]), box(labels[j])), `${key}: "${labels[i].text}" overlaps "${labels[j].text}"`);
    }
    if (key === 'campus') {
      const shown = labels.map((l) => l.name);
      for (const must of ['Main Block']) assert.ok(shown.includes(must), `the campus map must label ${must}; it shows ${shown.join(', ')}`);
      // nothing the owner reported cut off any more: every shown label's text is fully inside the screen (checked above)
      assert.ok(labels.length >= 8, `only ${labels.length} campus labels survive`);
    }
  });
}
