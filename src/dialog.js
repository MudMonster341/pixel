// Data-driven NPC dialog (roadmap M1, docs/ARCHITECTURE.md "content is data, the engine is code").
// An NPC's `dialog` (src/maps.js) is a list of entries; interact() (src/scenes/world.js) shows the
// first one whose `when` conditions match GameState, then runs its `actions` -- or, for an entry
// with `choices`, whichever option the player picked. This file is the only code that understands
// the shape of `when`/`actions`/`choices`; the NPC data itself is the only thing that changes per
// character.
//
// Entry shape:
//   { id?, when?, lines: [...], actions?: [...] }
//   { id?, when?, lines?: [...], choices: [{ text, lines?, actions? }, ...] }
// `lines` before a `choices` list are shown first (an intro or a question); `choices` then replace
// the box with a selectable list (src/scenes/ui.js DialogBox). Only the chosen option's own
// `actions` run -- an entry's own top-level `actions` only fire when it has no `choices` at all.

// ---------- conditions ----------

// Every key present in `when` must match (there's no `all`/`any` yet -- one dialog entry only ever
// needs a handful of things ANDed together):
//   { flag: 'x' }                     truthy
//   { flag: 'x', value: 2 }           equals exactly (works for numbers too, e.g. a chat counter)
//   { notFlag: 'x' }                  falsy
//   { stage: 'hunting' }              GameState.quest.stage === 'hunting'
//   { hasItem: 'sword' }              holding at least one (add `count` for more than one)
//   { hasKey: 'physicsLab' }          GameState.quest.keys.physicsLab is true
//   { notHasKey: 'physicsLab' }       GameState.quest.keys.physicsLab is false (a key station's own
//                                      "come take me" entry, before it's been collected)
//   { keysCount: 2 }                  exactly N of the 3 treasure-hunt keys are held (docs/STORY.md:
//                                      the volunteer's hint changes with how many keys she has)
//   { seen: false }                   this exact entry has never been shown before (or `true` for
//                                      "has been", e.g. a different line the second time you visit)
function matchesWhen(when, state, seen) {
  if (!when) return true;
  if (when.flag !== undefined) {
    const value = state.flags[when.flag];
    if (Object.prototype.hasOwnProperty.call(when, 'value')) {
      if (value !== when.value) return false;
    } else if (!value) {
      return false;
    }
  }
  if (when.notFlag !== undefined && state.flags[when.notFlag]) return false;
  if (when.stage !== undefined && state.quest.stage !== when.stage) return false;
  if (when.hasItem !== undefined && countItemHeld(state, when.hasItem) < (when.count || 1)) return false;
  if (when.hasKey !== undefined && !state.quest.keys[when.hasKey]) return false;
  if (when.notHasKey !== undefined && state.quest.keys[when.notHasKey]) return false;
  if (when.keysCount !== undefined && countKeysHeld(state) !== when.keysCount) return false;
  if (when.seen !== undefined && seen !== when.seen) return false;
  return true;
}

function countItemHeld(state, item) {
  return state.inventory.slots.filter((slot) => slot && slot.item === item).reduce((n, slot) => n + slot.count, 0);
}

function countKeysHeld(state) {
  return Object.values(state.quest.keys).filter(Boolean).length;
}

// A stable key for "has this exact entry been shown before" (GameState.seenDialog): an explicit
// `id` if the entry has one, otherwise its position in the list -- fine as long as content doesn't
// reorder its own dialog array, which it never needs to.
function dialogEntryKey(npcId, entry, index) {
  return `${npcId}:${entry.id || index}`;
}

// The entry interact() would show right now, or null if the NPC has no dialog at all. Returns the
// entry plus its lookup key and whether GameState already has it marked as seen -- used both by
// entries that key off `when: { seen }` and by hasNewDialog() below (the "!" bubble).
function pickDialogEntry(npc, state) {
  const dialog = npc.dialog || [];
  for (let i = 0; i < dialog.length; i++) {
    const entry = dialog[i];
    const key = dialogEntryKey(npc.id, entry, i);
    const seen = state.seenDialog ? state.seenDialog.has(key) : false;
    if (matchesWhen(entry.when, state, seen)) return { entry, key, seen };
  }
  return null;
}

// The interaction bubble (docs/STYLE_GUIDE.md): "!" while the entry about to be shown hasn't been
// seen before, "E" once it has been (or there's nothing to say, which shouldn't happen for a real
// NPC -- world.js still shows a plain "E" rather than no bubble at all in that case).
function hasNewDialog(npc, state) {
  const picked = pickDialogEntry(npc, state);
  return Boolean(picked && !picked.seen);
}

// ---------- actions ----------

// Runs one dialog entry's (or one chosen option's) actions against GameState, then calls
// notifyStateChanged() once if anything actually changed the state, so autosave (src/save.js)
// picks it up -- the same rule as every other place in the game that touches flags/quest.
//
//   { give: 'keycard' }         adds an item to the inventory; if the bag is full, the *rest* of
//                                this action list is skipped and a generic toast shows instead
//                                (matches the ground-pickup behaviour in updatePickups(),
//                                src/scenes/world.js) -- so a following setFlag never fires for an
//                                item the player didn't actually receive
//   { setFlag: 'metVolunteer' }                      sets a flag to true
//   { setFlag: { name: 'tomasChats', value: 2 } }    sets a flag to any value (e.g. a chat counter)
//   { stage: 'hunting' }        GameState.quest.stage = 'hunting'
//   { key: 'physicsLab' }       GameState.quest.keys.physicsLab = true
//   { toast: 'The volunteer waves you over.' }   a short on-screen message
//   { cutscene: 'gate2' }       asks to play a cutscene (src/cutscenes.js); src/scenes/ui.js listens
//                                for the event and hands it to the current WorldScene
//   { minigame: 'tetris' }      asks to launch a mini-game -- a no-op stub for now (M4), just the
//                                event, since nothing plays it yet; a key-station action list runs
//                                this *before* `give`/`key` (docs/STORY.md), so dropping the real
//                                mini-game in later needs no rewrite of the story data -- it just
//                                starts blocking on the outcome instead of resolving immediately.
//   { journal: 'text' }        appends a clue/note to GameState.journal (M1's "journal (J)" leftover,
//                                src/scenes/ui.js Journal), oldest first, never removed
function applyDialogActions(actions, state) {
  let changed = false;
  for (const action of actions || []) {
    if ('give' in action) {
      if (state.inventory.add(action.give)) changed = true;
      else { emitDialogEvent('toast', 'Your bag is full!'); break; }
    } else if ('setFlag' in action) {
      if (typeof action.setFlag === 'string') state.flags[action.setFlag] = true;
      else state.flags[action.setFlag.name] = action.setFlag.value;
      changed = true;
    } else if ('stage' in action) {
      state.quest.stage = action.stage;
      changed = true;
    } else if ('key' in action) {
      state.quest.keys[action.key] = true;
      changed = true;
    } else if ('journal' in action) {
      state.journal.push(action.journal);
      changed = true;
    } else if ('toast' in action) {
      emitDialogEvent('toast', action.toast);
    } else if ('cutscene' in action) {
      emitDialogEvent('cutscene:requested', action.cutscene);
    } else if ('minigame' in action) {
      emitDialogEvent('minigame:requested', action.minigame);
    }
  }
  if (changed) notifyStateChanged();
}

// ---------- text templating ----------

// Dialog lines can reference `{name}` for the player's chosen name (src/state.js `playerName`, M3a
// name entry) -- the only piece of runtime data a line needs to interpolate today. world.js's
// interact() runs every line (and every choice's own follow-up lines) through this before handing
// them to DialogBox, so DialogBox itself never needs to know templating exists.
function renderLine(line, state) {
  return line.replace(/\{name\}/g, state.playerName || '');
}

function renderLines(lines, state) {
  return (lines || []).map((line) => renderLine(line, state));
}

// Same guard as notifyStateChanged() (src/state.js): window.game doesn't exist yet the moment this
// script first runs (tests/helpers/game-data.js gives node:test's sandbox a fake one, so unit tests
// can still spy on these events).
function emitDialogEvent(event, payload) {
  if (typeof window !== 'undefined' && window.game) window.game.events.emit(event, payload);
}
