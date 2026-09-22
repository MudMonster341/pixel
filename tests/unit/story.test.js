// The LUG treasure hunt's story data (src/story.js, docs/STORY.md, M3): the volunteer's dialog and
// the three key stations' dialog. Checks the *data* directly (no browser, no scene) -- every entry
// is reachable from some real GameState, every action it runs is valid, nothing is a dead end, and
// the hint text actually matches how many keys are held. src/maps.js's own wiring (positions,
// doorLocks) is checked separately, against the real generated interior maps.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const STAGES = ['arrival', 'hunting', 'rewarded'];
const KEY_IDS = ['physicsLab', 'icvl', 'room195'];

// A fresh, valid GameState-shaped quest for a given stage/key combination -- everything matchesWhen
// actually reads (flags/quest/inventory/seenDialog aren't touched by this story's own conditions
// beyond `stage`/`hasKey`/`notHasKey`/`keysCount`, so a bare quest object is enough).
function questFixture(stage, keysHeld = {}) {
  return {
    quest: {
      stage,
      keys: { physicsLab: false, icvl: false, room195: false, ...keysHeld },
    },
    flags: {},
    inventory: { slots: [] },
    seenDialog: new Set(),
    journal: [],
  };
}

// ---------- the volunteer: every entry reachable, no dead ends ----------

test('story: the volunteer has a matching dialog entry for every stage/keys-held combination (no dead ends)', () => {
  const { STORY, pickDialogEntry } = loadGameData();
  const npc = { id: 'lug-volunteer', dialog: STORY.volunteer };
  const seenIds = new Set();

  for (const stage of STAGES) {
    if (stage === 'hunting') {
      for (let n = 0; n <= 3; n++) {
        const keys = { physicsLab: n >= 1, icvl: n >= 2, room195: n >= 3 };
        const state = questFixture(stage, keys);
        const picked = pickDialogEntry(npc, state);
        assert.ok(picked, `no dialog entry matches stage=hunting, ${n} keys held`);
        seenIds.add(picked.entry.id);
      }
    } else {
      const state = questFixture(stage);
      const picked = pickDialogEntry(npc, state);
      assert.ok(picked, `no dialog entry matches stage=${stage}`);
      seenIds.add(picked.entry.id);
    }
  }

  // Every entry in the data is actually reachable by some real combination above -- an entry that
  // never matches anything would be silent, unremovable dead content.
  const allIds = new Set(STORY.volunteer.map((entry) => entry.id));
  assert.deepEqual([...seenIds].sort(), [...allIds].sort());
});

test('story: the volunteer\'s hint matches the number of keys held (docs/STORY.md order: Physics Lab -> ICVL -> Room 195)', () => {
  const { STORY, pickDialogEntry } = loadGameData();
  const npc = { id: 'lug-volunteer', dialog: STORY.volunteer };

  const hint0 = pickDialogEntry(npc, questFixture('hunting', {})).entry;
  assert.match(hint0.lines.join(' '), /Physics Lab/);
  assert.match(hint0.lines.join(' '), /3rd floor/);

  const hint1 = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true })).entry;
  assert.match(hint1.lines.join(' '), /ICVL/);
  assert.match(hint1.lines.join(' '), /1st floor/);

  const hint2 = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true, icvl: true })).entry;
  assert.match(hint2.lines.join(' '), /Room 195/);

  const reward = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true, icvl: true, room195: true })).entry;
  assert.equal(reward.id, 'reward');
});

test('story: the welcome entry only matches while stage is "arrival", and stops matching once she is briefed', () => {
  const { STORY, pickDialogEntry } = loadGameData();
  const npc = { id: 'lug-volunteer', dialog: STORY.volunteer };
  assert.equal(pickDialogEntry(npc, questFixture('arrival')).entry.id, 'welcome');
  assert.notEqual(pickDialogEntry(npc, questFixture('hunting')).entry.id, 'welcome');
  assert.notEqual(pickDialogEntry(npc, questFixture('rewarded')).entry.id, 'welcome');
});

// ---------- the volunteer: every action referenced is valid ----------

test('story: every action in the volunteer\'s dialog is valid (real item, real quest key, known stage)', () => {
  const { STORY, ITEMS } = loadGameData();
  for (const entry of STORY.volunteer) {
    for (const action of entry.actions || []) {
      if ('give' in action) assert.ok(ITEMS[action.give], `${entry.id}: gives unknown item "${action.give}"`);
      if ('key' in action) assert.ok(KEY_IDS.includes(action.key), `${entry.id}: awards unknown key "${action.key}"`);
      if ('stage' in action) assert.ok(STAGES.includes(action.stage), `${entry.id}: sets unknown stage "${action.stage}"`);
      if ('journal' in action) assert.ok(typeof action.journal === 'string' && action.journal.length > 0, `${entry.id}: empty/invalid journal text`);
      if ('toast' in action) assert.ok(typeof action.toast === 'string' && action.toast.length > 0, `${entry.id}: empty/invalid toast text`);
    }
  }
});

test('story: the volunteer awards the box and reaches "rewarded" only once all 3 keys are held', () => {
  const { STORY, applyDialogActions } = loadGameData();
  const reward = STORY.volunteer.find((entry) => entry.id === 'reward');
  const state = questFixture('hunting', { physicsLab: true, icvl: true, room195: true });
  state.inventory.add = () => true; // a real GameState.inventory would be an Inventory instance
  applyDialogActions(reward.actions, state);
  assert.equal(state.quest.stage, 'rewarded');
});

// ---------- key stations: reachable both ways, valid actions, keyed correctly ----------

for (const keyId of KEY_IDS) {
  test(`story: the ${keyId} key station has a "take" entry before the key is held and a "done" entry after`, () => {
    const { keyStationDialog, pickDialogEntry } = loadGameData();
    const dialog = keyStationDialog(keyId);
    const stationDef = { id: keyId, dialog };

    const before = questFixture('hunting');
    const takePicked = pickDialogEntry(stationDef, before);
    assert.equal(takePicked.entry.id, 'take');

    const after = questFixture('hunting', { [keyId]: true });
    const donePicked = pickDialogEntry(stationDef, after);
    assert.equal(donePicked.entry.id, 'done');
  });

  test(`story: the ${keyId} key station's "take" entry gives the right item and sets the right key`, () => {
    const { STORY, keyStationDialog, ITEMS } = loadGameData();
    const take = keyStationDialog(keyId).find((entry) => entry.id === 'take');
    const giveAction = take.actions.find((a) => 'give' in a);
    const keyAction = take.actions.find((a) => 'key' in a);
    assert.ok(giveAction, `${keyId}: "take" never gives an item`);
    assert.equal(giveAction.give, STORY.keyStations[keyId].item);
    assert.ok(ITEMS[giveAction.give], `${keyId}: gives unknown item "${giveAction.give}"`);
    assert.ok(keyAction, `${keyId}: "take" never sets the quest key`);
    assert.equal(keyAction.key, keyId);
    // The mini-game action (M4 stub) runs *before* the key is actually given (docs/STORY.md: dropping
    // in the real mini-game later must not need a rewrite of this ordering).
    const minigameIndex = take.actions.findIndex((a) => 'minigame' in a);
    const giveIndex = take.actions.indexOf(giveAction);
    assert.ok(minigameIndex !== -1 && minigameIndex < giveIndex, `${keyId}: minigame action should come before give`);
  });
}

test('story: every key station in STORY.keyStations has a matching entry in GameState\'s default quest.keys', () => {
  const { STORY, GameState } = loadGameData();
  assert.deepEqual(Object.keys(STORY.keyStations).sort(), Object.keys(GameState.quest.keys).sort());
});

// ---------- {name} templating ----------

test('story: {name} in a dialog line is replaced with the player\'s chosen name', () => {
  const { renderLine, renderLines, GameState } = loadGameData();
  GameState.playerName = 'Zara';
  assert.equal(renderLine('Hi {name}!', GameState), 'Hi Zara!');
  assert.deepEqual(renderLines(['Hello {name}.', 'No name here.'], GameState), ['Hello Zara.', 'No name here.']);
});

test('story: the volunteer\'s welcome and reward lines actually use {name}', () => {
  const { STORY } = loadGameData();
  const welcome = STORY.volunteer.find((e) => e.id === 'welcome');
  const reward = STORY.volunteer.find((e) => e.id === 'reward');
  assert.ok(welcome.lines.some((l) => l.includes('{name}')));
  assert.ok(reward.lines.some((l) => l.includes('{name}')));
});

// ---------- a full playthrough of the data, start to finish, never getting stuck ----------

test('story: a full playthrough (talk, find all 3 keys in any order, return) always reaches "rewarded"', () => {
  const { STORY, keyStationDialog, pickDialogEntry, applyDialogActions } = loadGameData();
  const volunteer = { id: 'lug-volunteer', dialog: STORY.volunteer };
  const state = questFixture('arrival');
  state.inventory = { slots: [], add: () => true };

  // Talk before being briefed.
  let picked = pickDialogEntry(volunteer, state);
  assert.equal(picked.entry.id, 'welcome');
  applyDialogActions(picked.entry.actions, state);
  assert.equal(state.quest.stage, 'hunting');

  // Collect the 3 keys in a deliberately different order than the hint text lists them, since
  // docs/STORY.md's hints are keyed to *count*, not to which key is still missing.
  for (const keyId of ['room195', 'physicsLab', 'icvl']) {
    const stationDef = { id: keyId, dialog: keyStationDialog(keyId) };
    const stationPicked = pickDialogEntry(stationDef, state);
    assert.equal(stationPicked.entry.id, 'take', `${keyId} should still be offered before it's taken`);
    applyDialogActions(stationPicked.entry.actions, state);
    assert.equal(state.quest.keys[keyId], true);

    // Talking to the volunteer at every point in between never dead-ends.
    const check = pickDialogEntry(volunteer, state);
    assert.ok(check, `volunteer has nothing to say after collecting ${keyId}`);
  }

  const finalTalk = pickDialogEntry(volunteer, state);
  assert.equal(finalTalk.entry.id, 'reward');
  applyDialogActions(finalTalk.entry.actions, state);
  assert.equal(state.quest.stage, 'rewarded');

  const afterReward = pickDialogEntry(volunteer, state);
  assert.equal(afterReward.entry.id, 'after-reward');
});

// ---------- src/maps.js wiring matches the real generated interior maps ----------

const tileInfo = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.json'), 'utf8'));
const tileNames = tileInfo.tiles.map((t) => t.name);

function loadInteriorMap(key) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${key}.json`), 'utf8'));
}

function structureNameAt(json, x, y) {
  const layer = json.layers.find((l) => l.name === 'structures').data;
  const gid = layer[y * json.width + x];
  return gid ? tileNames[gid - 1] : null;
}

function areaContaining(json, x, y) {
  const objs = json.layers.find((l) => l.type === 'objectgroup').objects;
  return objs.find((o) => {
    const x0 = Math.round(o.x / 16), y0 = Math.round(o.y / 16);
    const x1 = x0 + Math.round(o.width / 16) - 1, y1 = y0 + Math.round(o.height / 16) - 1;
    return o.type === 'area' && x >= x0 && x <= x1 && y >= y0 && y <= y1;
  });
}

const KEY_STATION_ROOMS = {
  'main-block-1': ['icvl', 'room195'],
  'main-block-3': ['physicsLab'],
};

for (const [mapKey, ids] of Object.entries(KEY_STATION_ROOMS)) {
  test(`story: ${mapKey}'s key station(s) sit on real furniture, inside their own named room`, () => {
    const { MAPS } = loadGameData();
    const json = loadInteriorMap(mapKey);
    for (const id of ids) {
      const def = MAPS[mapKey].keyStations.find((ks) => ks.id === id);
      assert.ok(def, `${mapKey} has no key station "${id}"`);
      const structure = structureNameAt(json, def.x, def.y);
      assert.ok(structure, `${mapKey}: key station "${id}" at (${def.x},${def.y}) sits on empty floor, not furniture`);
      const area = areaContaining(json, def.x, def.y);
      assert.ok(area, `${mapKey}: key station "${id}" isn't inside any named room`);
    }
  });
}

test('story: the LUG volunteer stands inside the "LUG Stall" nook on main-block-g', () => {
  const { MAPS } = loadGameData();
  const json = loadInteriorMap('main-block-g');
  const volunteer = MAPS['main-block-g'].npcs.find((npc) => npc.id === 'lug-volunteer');
  assert.ok(volunteer, 'main-block-g has no "lug-volunteer" npc');
  const area = areaContaining(json, volunteer.x, volunteer.y);
  assert.ok(area, `the volunteer at (${volunteer.x},${volunteer.y}) isn't inside any named room`);
  assert.equal(area.name, 'LUG Stall');
});

// ---------- doorLocks: the data itself is well-formed and names a real object ----------

const DOOR_LOCK_MAPS = {
  campus: 'campus',
  'main-block-g': 'main-block-g',
  'main-block-1': 'main-block-1',
  'main-block-2': 'main-block-2',
};

for (const [mapKey, file] of Object.entries(DOOR_LOCK_MAPS)) {
  test(`story: ${mapKey}'s doorLocks each name a real door/stairs object on that map`, () => {
    const { MAPS } = loadGameData();
    const json = loadInteriorMap(file);
    const objs = json.layers.find((l) => l.type === 'objectgroup').objects;
    for (const rule of MAPS[mapKey].doorLocks || []) {
      const target = objs.find((o) => (o.type === 'door' || o.type === 'stairs') && o.name === rule.match);
      assert.ok(target, `${mapKey}: doorLocks names "${rule.match}", which isn't a door/stairs object on this map`);
      if (rule.stages) for (const stage of rule.stages) assert.ok(STAGES.includes(stage), `${mapKey}: unknown stage "${stage}" in doorLocks`);
    }
  });
}

test('story: isDoorLocked/doorLockRule (src/maplogic.js)', () => {
  const { doorLockRule, isDoorLocked } = loadGameData();
  const rules = [{ match: 'Library Block entrance' }, { match: 'Main Block Stairs G (up)', stages: ['hunting', 'rewarded'] }];
  assert.equal(isDoorLocked(doorLockRule(rules, 'Library Block entrance'), 'rewarded'), true, 'no `stages` means never open');
  assert.equal(isDoorLocked(doorLockRule(rules, 'Main Block Stairs G (up)'), 'arrival'), true);
  assert.equal(isDoorLocked(doorLockRule(rules, 'Main Block Stairs G (up)'), 'hunting'), false);
  assert.equal(isDoorLocked(doorLockRule(rules, 'Main Block entrance'), 'arrival'), false, 'no rule at all means open');
});

// ---------- quest tracker text (src/maplogic.js questObjectiveText) ----------

test('story: questObjectiveText matches every stage/keys-held combination', () => {
  const { questObjectiveText } = loadGameData();
  const at = (stage, keys) => questObjectiveText({ stage, keys: { physicsLab: false, icvl: false, room195: false, ...keys } });
  assert.match(at('arrival', {}), /LUG stall/);
  assert.match(at('hunting', {}), /Physics Lab/);
  assert.match(at('hunting', { physicsLab: true }), /ICVL/);
  assert.match(at('hunting', { physicsLab: true, icvl: true }), /Room 195/);
  assert.match(at('hunting', { physicsLab: true, icvl: true, room195: true }), /Bring all 3 keys/);
  assert.match(at('rewarded', { physicsLab: true, icvl: true, room195: true }), /complete/i);
});

test('story: questObjectiveText points at whichever key is actually still missing, even collected out of order', () => {
  const { questObjectiveText } = loadGameData();
  const at = (keys) => questObjectiveText({ stage: 'hunting', keys: { physicsLab: false, icvl: false, room195: false, ...keys } });
  // Room 195 first: the objective still asks for the Physics Lab (docs/STORY.md's own order), not
  // "the next key" by count -- unlike the volunteer's own spoken hint, which *is* keyed to count.
  assert.match(at({ room195: true }), /Physics Lab/);
  assert.match(at({ icvl: true }), /Physics Lab/);
  assert.match(at({ physicsLab: true, room195: true }), /ICVL/);
});
