// D10 (defect sweep 2026-10-04): the foyer's gold chandelier (the `overhead` tile layer, drawn above every character) hid
// the player's head as she crossed the hall. Indoors the overhead layer is now drawn see-through; outdoors (tree canopies,
// ADR 0008) it stays solid. The choice is pure (src/maplogic.js overheadAlpha) and tested for every real map that has an
// overhead layer; how it looks is for the coordinator to check in the running game.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { MAPS, overheadAlpha, INDOOR_OVERHEAD_ALPHA } = loadGameData();

test('D10: indoor maps draw the overhead layer see-through, outdoor maps keep it solid', () => {
  assert.ok(INDOOR_OVERHEAD_ALPHA > 0.2 && INDOOR_OVERHEAD_ALPHA < 0.7, 'visible ceiling piece, but the player must show through it');
  assert.equal(overheadAlpha({ indoors: true }), INDOOR_OVERHEAD_ALPHA);
  assert.equal(overheadAlpha({}), 1);
  assert.equal(overheadAlpha(undefined), 1);
});

test('D10: every real map that has an overhead layer gets the right alpha (the foyer see-through, the campus canopies solid)', () => {
  const withOverhead = [];
  for (const [key, def] of Object.entries(MAPS)) {
    if (!def.tiled) continue;
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.tiled}.json`), 'utf8'));
    if (json.layers.some((l) => l.name === 'overhead')) withOverhead.push(key);
    if (json.layers.some((l) => l.name === 'overhead')) assert.equal(overheadAlpha(def), def.indoors ? INDOOR_OVERHEAD_ALPHA : 1, key);
  }
  assert.ok(withOverhead.includes('main-block-g'), 'the foyer has the chandelier overhead layer');
  assert.ok(withOverhead.includes('campus'), 'the campus has tree canopies');
  assert.equal(overheadAlpha(MAPS['main-block-g']), INDOOR_OVERHEAD_ALPHA);
  assert.equal(overheadAlpha(MAPS.campus), 1);
});

test('D10: world.js applies overheadAlpha() to the overhead layer it creates', () => {
  const world = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  assert.match(world, /createLayer\(overheadDef\.name, tileset, 0, 0\)\.setDepth\(OVERHEAD_DEPTH\)\.setAlpha\(overheadAlpha\(this\.def\)\)/);
});
