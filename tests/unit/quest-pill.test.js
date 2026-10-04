// D15 (defect sweep 2026-10-04): the top-right quest pill cut the objective mid-sentence with an ellipsis ("Keys 0/3 .
// Find the LUG stall behind the ..."). The pill now shows "Keys n/3" plus the WHOLE objective wrapped to the pill's inner
// width (src/maplogic.js trackerPillText). The HUD font is monospace, so the wrap can be proven here without a browser.
// The panel's real pixel height and the screenshot are for the coordinator to look at in the running game.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

const { trackerPillText, wrapWords, questObjectiveText, TRACKER_PILL, HUD_TRACKER, hudLayout } = loadGameData();

const KEY_IDS = ['physicsLab', 'icl', 'room195'];
const everyQuestState = () => {
  const states = [];
  for (const stage of ['arrival', 'hunting', 'rewarded']) {
    for (let mask = 0; mask < 8; mask++) {
      states.push({ stage, keys: Object.fromEntries(KEY_IDS.map((k, i) => [k, Boolean(mask & (1 << i))])) });
    }
  }
  return states;
};

const plain = (list) => Array.from(list); // arrays built inside the game's vm sandbox have another realm's prototype

test('D15: wrapWords wraps on word boundaries, never loses a word and splits an over-long one', () => {
  assert.deepEqual(plain(wrapWords('aaa bbb ccc', 7)), ['aaa bbb', 'ccc']);
  assert.deepEqual(plain(wrapWords('aaa bbb ccc', 11)), ['aaa bbb ccc']);
  assert.deepEqual(plain(wrapWords('abcdefghij kl', 4)), ['abcd', 'efgh', 'ij', 'kl']);
  assert.deepEqual(plain(wrapWords('', 10)), []);
});

test('D15: for every stage and key combination the whole objective fits the pill in at most two lines at full size', () => {
  const maxChars = Math.floor((HUD_TRACKER.w - 2 * TRACKER_PILL.pad) / TRACKER_PILL.fontSize);
  for (const quest of everyQuestState()) {
    const pill = trackerPillText(quest);
    const label = `${quest.stage} ${JSON.stringify(quest.keys)}`;
    const objective = questObjectiveText(quest);
    assert.equal(pill.maxChars, maxChars);
    assert.ok(pill.lines.length <= TRACKER_PILL.maxLines, `${label}: ${pill.lines.length} lines: ${JSON.stringify(pill.lines)}`);
    for (const line of pill.lines) assert.ok(line.length <= maxChars, `${label}: "${line}" is wider than ${maxChars} characters`);
    assert.equal(pill.lines.join(' '), objective, `${label}: the wrapped lines must be the whole objective, unchanged`);
    assert.ok(!pill.lines.join('').includes('…') && !pill.lines.join('').includes('...'), `${label}: no ellipsis`);
    const held = KEY_IDS.filter((k) => quest.keys[k]).length;
    assert.equal(pill.keys, `Keys ${held}/3`);
  }
});

test('D15: the reported case ("Find the LUG stall behind the Main Block staircase.") is shown in full', () => {
  const pill = trackerPillText({ stage: 'arrival', keys: { physicsLab: false, icl: false, room195: false } });
  assert.equal(pill.keys, 'Keys 0/3');
  assert.equal(pill.lines.join(' '), 'Find the LUG stall behind the Main Block staircase.');
});

test('D15: the layout reserves room for the tallest pill (a keys line plus two objective lines) and still avoids every other box', () => {
  // 10 px padding above and below, a keys line, 4 px gap, two objective lines of 8 px glyphs with 5 px line spacing between
  const tallest = 10 + TRACKER_PILL.fontSize + 4 + (TRACKER_PILL.maxLines * TRACKER_PILL.fontSize + (TRACKER_PILL.maxLines - 1) * 5) + 10;
  assert.ok(HUD_TRACKER.collapsedH >= tallest, `collapsedH ${HUD_TRACKER.collapsedH} is below the tallest pill (${tallest})`);
  const l = hudLayout(960, 540);
  for (const other of ['minimap', 'banner', 'hotbar', 'hint']) {
    const a = l.tracker;
    const b = l[other];
    assert.ok(!(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h), `tracker overlaps ${other}`);
  }
});
