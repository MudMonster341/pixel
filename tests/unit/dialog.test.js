// Data-driven NPC dialog (src/dialog.js, docs/ARCHITECTURE.md). Covers condition matching, every
// action type, choices, and Tomas (the test-map NPC) end to end so nothing was lost converting him
// from the old hand-written talk() to data.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGameData } = require('../helpers/game-data');

function tomas(MAPS) {
  return MAPS.house.npcs.find((npc) => npc.id === 'tomas');
}

const countItem = (slots, item) => slots.filter((slot) => slot && slot.item === item).reduce((n, slot) => n + slot.count, 0);

// ---------- Tomas end to end (the converted, real content) ----------

test('Tomas gives the Old Sword on the first talk, and only once', () => {
  const { GameState, MAPS, pickDialogEntry, applyDialogActions } = loadGameData();
  const npc = tomas(MAPS);

  const first = pickDialogEntry(npc, GameState);
  assert.equal(first.entry.id, 'give-sword');
  assert.ok(first.entry.lines.length > 0);
  assert.equal(first.seen, false);
  GameState.seenDialog.add(first.key);
  applyDialogActions(first.entry.actions, GameState);
  assert.equal(GameState.flags.tomasGaveSword, true);
  assert.equal(countItem(GameState.inventory.slots, 'sword'), 1);

  const second = pickDialogEntry(npc, GameState);
  assert.notEqual(second.entry.id, 'give-sword');
  applyDialogActions(second.entry.actions, GameState);
  assert.equal(countItem(GameState.inventory.slots, 'sword'), 1, 'the sword is not given twice');
});

test('Tomas keeps the sword if the bag is full, and offers it again later', () => {
  const { GameState, MAPS, pickDialogEntry, applyDialogActions, gameEvents } = loadGameData();
  const npc = tomas(MAPS);
  const { slots } = GameState.inventory;
  for (let i = 0; i < slots.length; i++) slots[i] = { item: 'notebook', count: 3 }; // every slot full

  let toast = null;
  gameEvents.on('toast', (message) => { toast = message; });

  const picked = pickDialogEntry(npc, GameState);
  assert.equal(picked.entry.id, 'give-sword');
  applyDialogActions(picked.entry.actions, GameState);
  assert.equal(toast, 'Your bag is full!');
  assert.equal(GameState.flags.tomasGaveSword, false);

  const again = pickDialogEntry(npc, GameState);
  assert.equal(again.entry.id, 'give-sword', 'the sword should still be on offer');
});

test('after the sword, Tomas cycles through 3 different chats', () => {
  const { GameState, MAPS, pickDialogEntry, applyDialogActions } = loadGameData();
  const npc = tomas(MAPS);
  GameState.flags.tomasGaveSword = true;

  const seen = [];
  for (let i = 0; i < 4; i++) {
    const picked = pickDialogEntry(npc, GameState);
    seen.push(picked.entry.lines.join(' '));
    applyDialogActions(picked.entry.actions, GameState);
  }
  assert.notEqual(seen[0], seen[1]);
  assert.notEqual(seen[1], seen[2]);
  assert.equal(seen[0], seen[3], 'the rotation wraps back to the first chat');
});

// ---------- conditions (matchesWhen / pickDialogEntry) ----------

test('conditions: flag (truthy), notFlag, and flag with an explicit value', () => {
  const { GameState, matchesWhen } = loadGameData();
  GameState.flags.metVolunteer = true;
  GameState.flags.tomasChats = 2;

  assert.equal(matchesWhen({ flag: 'metVolunteer' }, GameState, false), true);
  assert.equal(matchesWhen({ flag: 'neverSet' }, GameState, false), false);
  assert.equal(matchesWhen({ notFlag: 'metVolunteer' }, GameState, false), false);
  assert.equal(matchesWhen({ notFlag: 'neverSet' }, GameState, false), true);
  assert.equal(matchesWhen({ flag: 'tomasChats', value: 2 }, GameState, false), true);
  assert.equal(matchesWhen({ flag: 'tomasChats', value: 0 }, GameState, false), false);
});

test('conditions: quest stage', () => {
  const { GameState, matchesWhen } = loadGameData();
  GameState.quest.stage = 'hunting';
  assert.equal(matchesWhen({ stage: 'hunting' }, GameState, false), true);
  assert.equal(matchesWhen({ stage: 'arrival' }, GameState, false), false);
});

test('conditions: items held, with and without a count', () => {
  const { GameState, matchesWhen } = loadGameData();
  GameState.inventory.add('apple');
  GameState.inventory.add('apple');
  assert.equal(matchesWhen({ hasItem: 'apple' }, GameState, false), true);
  assert.equal(matchesWhen({ hasItem: 'apple', count: 2 }, GameState, false), true);
  assert.equal(matchesWhen({ hasItem: 'apple', count: 3 }, GameState, false), false);
  assert.equal(matchesWhen({ hasItem: 'sword' }, GameState, false), false);
});

test('conditions: keys found', () => {
  const { GameState, matchesWhen } = loadGameData();
  GameState.quest.keys.physicsLab = true;
  assert.equal(matchesWhen({ hasKey: 'physicsLab' }, GameState, false), true);
  assert.equal(matchesWhen({ hasKey: 'icvl' }, GameState, false), false);
});

test('conditions: seen before', () => {
  const { GameState, matchesWhen } = loadGameData();
  assert.equal(matchesWhen({ seen: false }, GameState, false), true);
  assert.equal(matchesWhen({ seen: true }, GameState, false), false);
  assert.equal(matchesWhen({ seen: false }, GameState, true), false);
  assert.equal(matchesWhen({ seen: true }, GameState, true), true);
});

test('conditions: several keys in one `when` are ANDed together', () => {
  const { GameState, matchesWhen } = loadGameData();
  GameState.flags.metVolunteer = true;
  GameState.quest.stage = 'briefed';
  assert.equal(matchesWhen({ flag: 'metVolunteer', stage: 'briefed' }, GameState, false), true);
  assert.equal(matchesWhen({ flag: 'metVolunteer', stage: 'hunting' }, GameState, false), false);
});

test('pickDialogEntry: the first entry whose `when` matches wins, including a fallback with no `when`', () => {
  const { GameState, pickDialogEntry } = loadGameData();
  const npc = {
    id: 'guide',
    dialog: [
      { id: 'has-key', when: { hasKey: 'physicsLab' }, lines: ['You found it!'] },
      { id: 'hunting', when: { stage: 'hunting' }, lines: ['Off you go.'] },
      { id: 'fallback', lines: ['Hello.'] }, // no `when`: always matches, used when nothing else did
    ],
  };

  assert.equal(pickDialogEntry(npc, GameState).entry.id, 'fallback');
  GameState.quest.stage = 'hunting';
  assert.equal(pickDialogEntry(npc, GameState).entry.id, 'hunting');
  GameState.quest.keys.physicsLab = true;
  assert.equal(pickDialogEntry(npc, GameState).entry.id, 'has-key', 'earlier entries win over later ones');
});

test('pickDialogEntry returns null for an NPC with no dialog at all', () => {
  const { GameState, pickDialogEntry } = loadGameData();
  assert.equal(pickDialogEntry({ id: 'silent', dialog: [] }, GameState), null);
  assert.equal(pickDialogEntry({ id: 'silent' }, GameState), null);
});

// ---------- the "!" bubble (hasNewDialog) ----------

test('hasNewDialog: true until the matching entry has been marked seen', () => {
  const { GameState, hasNewDialog, dialogEntryKey } = loadGameData();
  const npc = { id: 'guide', dialog: [{ id: 'hello', lines: ['Hi!'] }] };
  assert.equal(hasNewDialog(npc, GameState), true);
  GameState.seenDialog.add(dialogEntryKey('guide', npc.dialog[0], 0));
  assert.equal(hasNewDialog(npc, GameState), false);
});

test('hasNewDialog: a later, not-yet-seen entry counts as new again once its `when` matches', () => {
  const { GameState, hasNewDialog, dialogEntryKey } = loadGameData();
  const npc = {
    id: 'guide',
    dialog: [
      { id: 'first-meeting', when: { notFlag: 'met' }, lines: ['Hello there!'] },
      { id: 'has-clue', when: { flag: 'gotClue' }, lines: ['Here is a clue!'] },
      { id: 'idle', lines: ['...'] },
    ],
  };
  GameState.seenDialog.add(dialogEntryKey('guide', npc.dialog[0], 0));
  GameState.seenDialog.add(dialogEntryKey('guide', npc.dialog[2], 2)); // the idle fallback, already heard
  GameState.flags.met = true;
  assert.equal(hasNewDialog(npc, GameState), false, 'nothing new yet: falls through to the seen idle chat');

  GameState.flags.gotClue = true;
  assert.equal(hasNewDialog(npc, GameState), true, 'the clue entry has never been shown');
});

// ---------- actions (applyDialogActions) ----------

test('actions: give adds an item and calls notifyStateChanged', () => {
  const { GameState, applyDialogActions, gameEvents } = loadGameData();
  let changed = 0;
  gameEvents.on('state-changed', () => changed++);
  applyDialogActions([{ give: 'apple' }], GameState);
  assert.equal(countItem(GameState.inventory.slots, 'apple'), 1);
  assert.equal(changed, 1);
});

test('actions: give stops the rest of the list and toasts when the bag is full', () => {
  const { GameState, applyDialogActions, gameEvents } = loadGameData();
  const { slots } = GameState.inventory;
  for (let i = 0; i < slots.length; i++) slots[i] = { item: 'notebook', count: 3 };
  let toast = null;
  gameEvents.on('toast', (message) => { toast = message; });

  applyDialogActions([{ give: 'apple' }, { setFlag: 'shouldNotRun' }], GameState);
  assert.equal(toast, 'Your bag is full!');
  assert.equal(GameState.flags.shouldNotRun, undefined);
});

test('actions: setFlag (bare and with an explicit value)', () => {
  const { GameState, applyDialogActions } = loadGameData();
  applyDialogActions([{ setFlag: 'metVolunteer' }], GameState);
  assert.equal(GameState.flags.metVolunteer, true);
  applyDialogActions([{ setFlag: { name: 'tomasChats', value: 2 } }], GameState);
  assert.equal(GameState.flags.tomasChats, 2);
});

test('actions: stage and key', () => {
  const { GameState, applyDialogActions } = loadGameData();
  applyDialogActions([{ stage: 'hunting' }, { key: 'physicsLab' }], GameState);
  assert.equal(GameState.quest.stage, 'hunting');
  assert.equal(GameState.quest.keys.physicsLab, true);
});

test('actions: toast, cutscene and minigame go out as events and never touch GameState', () => {
  const { GameState, applyDialogActions, gameEvents } = loadGameData();
  const events = [];
  gameEvents.on('toast', (payload) => events.push(['toast', payload]));
  gameEvents.on('cutscene:requested', (payload) => events.push(['cutscene:requested', payload]));
  gameEvents.on('minigame:requested', (payload) => events.push(['minigame:requested', payload]));
  let changed = 0;
  gameEvents.on('state-changed', () => changed++);

  applyDialogActions([{ toast: 'Hi!' }, { cutscene: 'gate2' }, { minigame: 'tetris' }], GameState);
  assert.deepEqual(events, [['toast', 'Hi!'], ['cutscene:requested', 'gate2'], ['minigame:requested', 'tetris']]);
  assert.equal(changed, 0, 'none of these change GameState');
});

test('actions: an empty or missing action list is a no-op', () => {
  const { GameState, applyDialogActions } = loadGameData();
  const before = JSON.stringify({ flags: GameState.flags, quest: GameState.quest });
  applyDialogActions([], GameState);
  applyDialogActions(undefined, GameState);
  assert.equal(JSON.stringify({ flags: GameState.flags, quest: GameState.quest }), before);
});

// ---------- choices (data validity) ----------

test('choices: each option has text, and lines/actions are valid when present', () => {
  const { MAPS } = loadGameData();
  const walkEntries = (npc) => npc.dialog || [];
  for (const map of Object.values(MAPS)) {
    for (const npc of map.npcs || []) {
      for (const entry of walkEntries(npc)) {
        if (!entry.choices) continue;
        assert.ok(entry.choices.length > 0, `${npc.id}'s entry "${entry.id}" has an empty choices list`);
        for (const choice of entry.choices) {
          assert.equal(typeof choice.text, 'string', `${npc.id}: a choice is missing its text`);
          if (choice.lines) assert.ok(Array.isArray(choice.lines));
          if (choice.actions) assert.ok(Array.isArray(choice.actions));
        }
      }
    }
  }
});

test('choices: applying a chosen option\'s actions works the same as a plain entry\'s', () => {
  const { GameState, applyDialogActions } = loadGameData();
  const entry = {
    id: 'ask-help',
    lines: ['Will you help me carry this?'],
    choices: [
      { text: 'Of course!', lines: ['Thank you!'], actions: [{ setFlag: 'helping' }] },
      { text: 'Not now.', lines: ['Oh... okay.'], actions: [] },
    ],
  };
  const chosen = entry.choices[0];
  applyDialogActions(chosen.actions, GameState);
  assert.equal(GameState.flags.helping, true);
});

// ---------- save/load round trip with dialog-driven state ----------

test('save/load round trip keeps flags, stage, keys and seenDialog set by dialog actions', () => {
  const { GameState, MAPS, pickDialogEntry, applyDialogActions, saveGame, loadGame } = loadGameData();
  const npc = tomas(MAPS);
  const picked = pickDialogEntry(npc, GameState);
  GameState.seenDialog.add(picked.key);
  applyDialogActions(picked.entry.actions, GameState);
  applyDialogActions([{ stage: 'hunting' }, { key: 'icvl' }], GameState);

  assert.equal(saveGame('default', GameState), true);
  GameState.flags.tomasGaveSword = false;
  GameState.quest.stage = 'arrival';
  GameState.quest.keys.icvl = false;
  GameState.seenDialog.clear();

  assert.equal(loadGame('default', GameState), true);
  assert.equal(GameState.flags.tomasGaveSword, true);
  assert.equal(GameState.quest.stage, 'hunting');
  assert.equal(GameState.quest.keys.icvl, true);
  assert.ok(GameState.seenDialog.has(picked.key));
});
