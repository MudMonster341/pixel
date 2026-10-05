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
const KEY_IDS = ['physicsLab', 'icl', 'room195'];
const countItem = (slots, item) => slots.filter((slot) => slot && slot.item === item).reduce((n, slot) => n + slot.count, 0);

// A fresh, valid GameState-shaped quest for a given stage/key combination -- everything matchesWhen
// actually reads (flags/quest/inventory/seenDialog aren't touched by this story's own conditions
// beyond `stage`/`hasKey`/`notHasKey`/`keysCount`, so a bare quest object is enough).
function questFixture(stage, keysHeld = {}) {
  return {
    quest: {
      stage,
      keys: { physicsLab: false, icl: false, room195: false, ...keysHeld },
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
        const keys = { physicsLab: n >= 1, icl: n >= 2, room195: n >= 3 };
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

test('story: the volunteer\'s hint matches the number of keys held (docs/STORY.md order: Physics Lab -> ICL -> Room 195)', () => {
  const { STORY, pickDialogEntry } = loadGameData();
  const npc = { id: 'lug-volunteer', dialog: STORY.volunteer };

  const hint0 = pickDialogEntry(npc, questFixture('hunting', {})).entry;
  assert.match(hint0.lines.join(' '), /Physics Lab/);
  assert.match(hint0.lines.join(' '), /3rd floor/);

  const hint1 = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true })).entry;
  assert.match(hint1.lines.join(' '), /ICL/);
  assert.match(hint1.lines.join(' '), /1st floor/);

  const hint2 = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true, icl: true })).entry;
  assert.match(hint2.lines.join(' '), /Room 195/);

  const reward = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true, icl: true, room195: true })).entry;
  assert.equal(reward.id, 'reward');
});

// FB-0039: the fixtures right above happen to collect keys in docs/STORY.md's own canonical order
// (Physics Lab, then ICL, then Room 195), which can't tell a count-based rule apart from a
// missing-key-based one -- this test collects them out of order instead, the case that was actually
// broken (a *count*-based hint pointed her back at a room she'd already emptied whenever she found
// the keys in a different order than the one the volunteer's lines assume).
test('FB-0039: the volunteer names the first missing key in docs/STORY.md order, even when keys are collected out of order', () => {
  const { STORY, pickDialogEntry } = loadGameData();
  const npc = { id: 'lug-volunteer', dialog: STORY.volunteer };

  // Room 195 found first: the hint must still point at the Physics Lab (the first key actually still
  // missing), not at whatever a *count* of 1 used to mean ("hint-1", the ICL).
  const afterRoom195 = pickDialogEntry(npc, questFixture('hunting', { room195: true })).entry;
  assert.equal(afterRoom195.id, 'hint-0');
  assert.match(afterRoom195.lines.join(' '), /Physics Lab/);

  // ICL found first: still the Physics Lab.
  const afterIcl = pickDialogEntry(npc, questFixture('hunting', { icl: true })).entry;
  assert.equal(afterIcl.id, 'hint-0');
  assert.match(afterIcl.lines.join(' '), /Physics Lab/);

  // Physics Lab + Room 195 held (only ICL missing): points at the ICL, not back at Room 195 (which
  // a count of 2 used to mean under the old "hint-2" rule).
  const missingIcl = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true, room195: true })).entry;
  assert.equal(missingIcl.id, 'hint-1');
  assert.match(missingIcl.lines.join(' '), /ICL/);

  // Physics Lab + ICL held (only Room 195 missing): points at Room 195.
  const missingRoom195 = pickDialogEntry(npc, questFixture('hunting', { physicsLab: true, icl: true })).entry;
  assert.equal(missingRoom195.id, 'hint-2');
  assert.match(missingRoom195.lines.join(' '), /Room 195/);

  // All 3, collected out of order: still reaches the reward.
  const allThree = pickDialogEntry(npc, questFixture('hunting', { room195: true, physicsLab: true, icl: true })).entry;
  assert.equal(allThree.id, 'reward');
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
      if ('take' in action) assert.ok(ITEMS[action.take], `${entry.id}: takes unknown item "${action.take}"`);
      if ('key' in action) assert.ok(KEY_IDS.includes(action.key), `${entry.id}: awards unknown key "${action.key}"`);
      if ('stage' in action) assert.ok(STAGES.includes(action.stage), `${entry.id}: sets unknown stage "${action.stage}"`);
      if ('journal' in action) assert.ok(typeof action.journal === 'string' && action.journal.length > 0, `${entry.id}: empty/invalid journal text`);
      if ('toast' in action) assert.ok(typeof action.toast === 'string' && action.toast.length > 0, `${entry.id}: empty/invalid toast text`);
    }
  }
});

// FB-0041b: the reward entry now `take`s the 3 key items back before `give`ing the box (docs/STORY.md:
// the volunteer collects the keys) -- every `take` must come before the `give`, so the box is never
// even attempted while the key items still occupy bag slots.
test('story: the reward entry takes all 3 key items back before giving the box', () => {
  const { STORY } = loadGameData();
  const reward = STORY.volunteer.find((entry) => entry.id === 'reward');
  const takeIndexes = reward.actions.flatMap((action, i) => ('take' in action ? [i] : []));
  const giveIndex = reward.actions.findIndex((action) => 'give' in action);
  assert.equal(takeIndexes.length, 3, 'reward should take back all 3 key items');
  // Spread into a plain array first: STORY.volunteer is built inside game-data.js's sandbox (a
  // separate vm realm), so .filter()/.map()/.sort() on it return sandboxed-realm arrays -- comparing
  // one of those directly against a literal array here (this file's own realm) fails deepStrictEqual
  // on cross-realm identity even when every element matches value-for-value.
  assert.deepEqual([...reward.actions.filter((a) => 'take' in a).map((a) => a.take)].sort(), ['keyIcl', 'keyPhysicsLab', 'keyRoom195']);
  for (const i of takeIndexes) assert.ok(i < giveIndex, 'every take must run before the give');
});

test('story: the volunteer awards the box and reaches "rewarded" only once all 3 keys are held', () => {
  const { STORY, applyDialogActions } = loadGameData();
  const reward = STORY.volunteer.find((entry) => entry.id === 'reward');
  const state = questFixture('hunting', { physicsLab: true, icl: true, room195: true });
  // A real GameState.inventory would be an Inventory instance (src/state.js) with real add()/remove().
  state.inventory.add = () => true;
  state.inventory.remove = () => 1;
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
    if (STORY.keyStations[keyId].minigame) {
      assert.ok(minigameIndex !== -1 && minigameIndex < giveIndex, `${keyId}: minigame action should come before give`);
    } else {
      // P5c (FB-0071): the ICL's mini-game opens its DOOR (STORY.iclGate), so its key station just hands the key over
      assert.equal(minigameIndex, -1, `${keyId}: a station with no minigame must not run one`);
    }
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
  const { STORY, keyStationDialog, pickDialogEntry, applyDialogActions, gameEvents } = loadGameData();
  const volunteer = { id: 'lug-volunteer', dialog: STORY.volunteer };
  const state = questFixture('arrival');
  state.inventory = { slots: [], add: () => true, remove: () => 1 };
  // A key station's "take" entry starts with a `minigame` action (src/story.js) that now really
  // suspends the rest of the list until it resolves (src/dialog.js) -- this test is about the quest
  // *data* reaching every state correctly, not about playing a mini-game, so it auto-resolves every
  // one as an immediate win, the same way `?minigames=0` does for most e2e specs (src/scenes/ui.js).
  gameEvents.on('minigame:requested', (payload) => payload.onResult('won'));

  // Talk before being briefed.
  let picked = pickDialogEntry(volunteer, state);
  assert.equal(picked.entry.id, 'welcome');
  applyDialogActions(picked.entry.actions, state);
  assert.equal(state.quest.stage, 'hunting');

  // Collect the 3 keys in a deliberately different order than the hint text lists them (FB-0039: the
  // volunteer's hint is keyed to the first key still *missing*, so this must never dead-end or point
  // her back at a room she's already done, regardless of collection order).
  for (const keyId of ['room195', 'physicsLab', 'icl']) {
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

// FB-0041b: with a real Inventory (not the plain-object stub `questFixture` uses elsewhere in this
// file), fill the bag so exactly 3 slots are free -- just enough room for the 3 distinct key items,
// none spare. Before this fix, the reward's `give: 'lugBox'` ran while those 3 key items still
// occupied every one of those slots, so a bag filled this way made the reward silently fail (no key,
// toast "Your bag is full!", stage stuck on "hunting" forever, quietly re-served every time she
// hasn't already been given the reward text). `take`-ing the keys back first frees the room.
test('FB-0041b: the reward\'s give never fails even when the bag is otherwise full of the 3 key items', () => {
  const { STORY, keyStationDialog, pickDialogEntry, applyDialogActions, Inventory, gameEvents } = loadGameData();
  const volunteer = { id: 'lug-volunteer', dialog: STORY.volunteer };
  const inventory = new Inventory(5);
  inventory.add('sword'); // maxStack 1: guaranteed its own slot
  inventory.add('keycard'); // maxStack 1: guaranteed its own slot -- 2 junk slots, 3 free
  const state = {
    quest: { stage: 'arrival', keys: { physicsLab: false, icl: false, room195: false } },
    flags: {},
    inventory,
    seenDialog: new Set(),
    journal: [],
  };

  gameEvents.on('minigame:requested', (payload) => payload.onResult('won'));
  let toast = null;
  gameEvents.on('toast', (message) => { toast = message; });

  applyDialogActions(pickDialogEntry(volunteer, state).entry.actions, state); // welcome -> hunting
  for (const keyId of ['physicsLab', 'icl', 'room195']) {
    const stationDef = { id: keyId, dialog: keyStationDialog(keyId) };
    applyDialogActions(pickDialogEntry(stationDef, state).entry.actions, state);
  }
  assert.equal(inventory.slots.filter(Boolean).length, 5, 'the bag should now be completely full: 2 junk + 3 keys');

  toast = null; // clear whatever the key-taking steps above last set, before the reward itself
  const reward = pickDialogEntry(volunteer, state).entry;
  assert.equal(reward.id, 'reward');
  applyDialogActions(reward.actions, state);

  // "Your bag is full!" is exactly what `give` toasts (and the *only* thing it toasts) on failure,
  // stopping the rest of the list right there -- so stage staying 'hunting' or this exact toast
  // string would both mean the give silently failed.
  assert.notEqual(toast, 'Your bag is full!', 'the reward box must never fail to give, even with an otherwise-full bag');
  assert.equal(state.quest.stage, 'rewarded');
  assert.equal(countItem(inventory.slots, 'lugBox'), 1);
  // The 3 key items are gone -- taken back by the volunteer (docs/STORY.md), freeing their slots.
  assert.equal(countItem(inventory.slots, 'keyPhysicsLab'), 0);
  assert.equal(countItem(inventory.slots, 'keyIcl'), 0);
  assert.equal(countItem(inventory.slots, 'keyRoom195'), 0);
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
  'main-block-1': ['icl', 'room195'],
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
  const at = (stage, keys) => questObjectiveText({ stage, keys: { physicsLab: false, icl: false, room195: false, ...keys } });
  assert.match(at('arrival', {}), /LUG stall/);
  assert.match(at('hunting', {}), /Physics Lab/);
  assert.match(at('hunting', { physicsLab: true }), /ICL/);
  assert.match(at('hunting', { physicsLab: true, icl: true }), /Room 195/);
  assert.match(at('hunting', { physicsLab: true, icl: true, room195: true }), /Bring all 3 keys/);
  assert.match(at('rewarded', { physicsLab: true, icl: true, room195: true }), /complete/i);
});

test('story: questObjectiveText points at whichever key is actually still missing, even collected out of order', () => {
  const { questObjectiveText } = loadGameData();
  const at = (keys) => questObjectiveText({ stage: 'hunting', keys: { physicsLab: false, icl: false, room195: false, ...keys } });
  // Room 195 first: the objective still asks for the Physics Lab (docs/STORY.md's own order), not
  // "the next key" by count -- unlike the volunteer's own spoken hint, which *is* keyed to count.
  assert.match(at({ room195: true }), /Physics Lab/);
  assert.match(at({ icl: true }), /Physics Lab/);
  assert.match(at({ physicsLab: true, room195: true }), /ICL/);
});
