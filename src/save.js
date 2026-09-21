// Save/load: turns GameState into plain JSON and back, through localStorage, versioned so an
// older or unknown save format never crashes the game (docs/ARCHITECTURE.md "State, saving and
// profiles"). One storage key per profile, so multiple players (and, much later, login) can each
// keep their own save without any of this code changing -- adding a profile picker later means
// picking a name, not rewriting saves.

const SAVE_VERSION = 1;
const SAVE_KEY_PREFIX = 'pixelquest.save.v1.';
const DEFAULT_PROFILE = 'default';
const AUTOSAVE_DEBOUNCE_MS = 600; // several events can fire in the same instant; write once they settle

function saveKey(profile) {
  return `${SAVE_KEY_PREFIX}${profile}`;
}

// `?profile=<name>` picks a save slot. `search` is injectable so this stays pure/testable, the same
// pattern as maplogic.js's initialMapKey()/cutscenesEnabled().
function currentProfile(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('profile') || DEFAULT_PROFILE;
}

// `?save=0` turns off both loading and autosaving, so automated tests stay deterministic and never
// touch a real save (tests/e2e/helpers.js defaults to this; save.spec.js opts back in).
function saveEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('save') !== '0';
}

// GameState -> plain JSON-safe data: Sets become arrays, the Inventory instance becomes its plain
// slots/selected. No class instances, functions or Phaser objects survive into this shape.
function snapshotState(state) {
  return {
    map: state.map,
    position: state.position,
    facing: state.facing,
    inventory: { slots: state.inventory.slots, selected: state.inventory.selected },
    flags: { ...state.flags },
    quest: { stage: state.quest.stage, keys: { ...state.quest.keys } },
    collected: [...state.collected],
    seenCutscenes: [...state.seenCutscenes],
    seenDialog: [...state.seenDialog],
    seenHints: [...state.seenHints],
    // M3a: her chosen name and look (src/scenes/intro-name.js, intro-customize.js). A save from
    // before this existed simply has neither field; applyState() below falls back to the defaults.
    playerName: state.playerName,
    customization: { ...state.customization },
  };
}

// The reverse: plain saved data applied onto the live GameState. Keeps the existing Inventory
// instance (and anything already listening to it) instead of replacing it, and quietly ignores
// anything the save doesn't have -- so a save from an older build, or one missing/renaming a field,
// starts the player as close to where they were as it can, never crashes, and never leaves
// GameState half-written if something in `saved` is missing.
function applyState(state, saved) {
  state.map = saved.map ?? null;
  state.position = saved.position ?? null;
  state.facing = saved.facing || 'down';

  const slots = Array.isArray(saved.inventory?.slots) ? saved.inventory.slots : [];
  state.inventory.slots = state.inventory.slots.map((_, i) => {
    const slot = slots[i];
    return slot && ITEMS[slot.item] ? { item: slot.item, count: slot.count } : null;
  });
  state.inventory.selected = Number.isInteger(saved.inventory?.selected) ? saved.inventory.selected : 0;
  state.inventory.emit('changed');

  state.flags = { ...state.flags, ...(saved.flags || {}) };
  state.quest = {
    stage: saved.quest?.stage || state.quest.stage,
    keys: { ...state.quest.keys, ...(saved.quest?.keys || {}) },
  };
  state.collected = new Set(saved.collected || []);
  state.seenCutscenes = new Set(saved.seenCutscenes || []);
  state.seenDialog = new Set(saved.seenDialog || []);
  state.seenHints = new Set(saved.seenHints || []);
  // M3a: falls back to whatever GameState already had (the just-booted defaults, see src/state.js)
  // for a save written before these fields existed, exactly like `flags`/`quest` above.
  state.playerName = typeof saved.playerName === 'string' && saved.playerName ? saved.playerName : state.playerName;
  state.customization = { ...state.customization, ...(saved.customization || {}) };
}

function saveGame(profile = currentProfile(), state = GameState) {
  const payload = { version: SAVE_VERSION, savedAt: Date.now(), profile, state: snapshotState(state) };
  try {
    localStorage.setItem(saveKey(profile), JSON.stringify(payload));
    return true;
  } catch (error) {
    console.warn(`save.js: could not save profile "${profile}"`, error);
    return false;
  }
}

// Returns true if a save was found, understood and applied; false if the game should start fresh
// (nothing saved yet, corrupt JSON, or a version this build can't migrate). Never throws.
function loadGame(profile = currentProfile(), state = GameState) {
  let raw;
  try {
    raw = localStorage.getItem(saveKey(profile));
  } catch (error) {
    console.warn('save.js: localStorage is unavailable, starting fresh', error);
    return false;
  }
  if (!raw) return false;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    console.warn(`save.js: save for profile "${profile}" is corrupt, starting fresh`, error);
    return false;
  }

  const migrated = migrate(payload);
  if (!migrated) {
    console.warn(`save.js: save for profile "${profile}" is version ${payload && payload.version}, ` +
      `which this build (v${SAVE_VERSION}) can't read; starting fresh instead of crashing`);
    return false;
  }
  applyState(state, migrated.state || {});
  return true;
}

// Migration ladder: each step knows how to bring one version up to the next. There's only ever
// been v1 so far, so this is a straight pass-through for it and a documented refusal for anything
// else (docs/ARCHITECTURE.md: "loading an older version runs migration steps; it never crashes").
// When a v2 exists, add `if (payload.version === 1) return migrate({ ...payload, version: 2, state: upgradeV1ToV2(payload.state) });`.
function migrate(payload) {
  if (!payload || typeof payload !== 'object' || !payload.state) return null;
  if (payload.version === SAVE_VERSION) return payload;
  return null; // an older version we've never shipped, or a newer one this build predates
}

// Read-only peek at a profile's saved state, without applying it to any GameState (the title
// screen's "Continue" needs to know a save exists, and roughly where it left off, before the
// player has chosen to load it -- see src/scenes/title.js). Never throws; returns null for
// anything missing, corrupt, or a version this build can't read, same as loadGame().
function peekSave(profile = currentProfile()) {
  let raw;
  try {
    raw = localStorage.getItem(saveKey(profile));
  } catch (error) {
    return null;
  }
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw);
    const migrated = migrate(payload);
    return migrated ? migrated.state || null : null;
  } catch (error) {
    return null;
  }
}

function hasSaveFile(profile = currentProfile()) {
  return Boolean(peekSave(profile));
}

function listProfiles() {
  const profiles = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(SAVE_KEY_PREFIX)) profiles.push(key.slice(SAVE_KEY_PREFIX.length));
    }
  } catch (error) {
    console.warn('save.js: could not list profiles', error);
  }
  return profiles;
}

function deleteProfile(profile) {
  try {
    localStorage.removeItem(saveKey(profile));
  } catch (error) {
    console.warn(`save.js: could not delete profile "${profile}"`, error);
  }
}

// Autosave: listens for the events that mean progress happened, and writes at most once per short
// burst of them (map changes, quest/flag changes, a cutscene seen, walking, and the inventory
// changing can all land in the same instant -- one debounced write covers all of them). Walking is
// included (`player-moved`, emitted every moving frame by WorldScene) so that just wandering around
// -- with no item, flag or map change -- still autosaves; that's the only way "continue where she
// was standing" (docs/ARCHITECTURE.md) can be true after simply walking somewhere and closing the tab.
function initAutosave(game, profile = currentProfile()) {
  let timer = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      saveGame(profile);
    }, AUTOSAVE_DEBOUNCE_MS);
  };
  game.events.on('map-entered', schedule);
  game.events.on('state-changed', schedule); // GameState.notifyStateChanged(): flags/quest
  game.events.on('cutscene-seen', schedule);
  game.events.on('player-moved', schedule);
  GameState.inventory.on('changed', schedule);

  // Belt and braces: closing the tab or reloading mid-debounce (within AUTOSAVE_DEBOUNCE_MS of the
  // last event) would otherwise lose whatever happened in that last stretch. This only *flushes* an
  // already-scheduled save -- it never starts a fresh one from scratch -- so it can't resurrect a
  // profile something else (e.g. deleteProfile(), right before navigating away) just removed a
  // moment ago with nothing left pending. `window` doesn't exist under node:test's sandbox, hence
  // the guard -- unit tests call saveGame()/loadGame() directly.
  if (typeof window !== 'undefined') {
    const flush = () => {
      if (!timer) return;
      clearTimeout(timer);
      timer = null;
      saveGame(profile);
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
  }
  return schedule;
}
