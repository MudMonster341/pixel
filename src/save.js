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
    // Mini-game progress (docs/ROADMAP.md M4): plain per-id records already ({ attempts, bestScore,
    // won, skipped }, src/minigames/framework-data.js), so a shallow copy is enough -- no Sets/class
    // instances inside it, same reasoning as `flags` above.
    minigames: { ...state.minigames },
    journal: [...state.journal],
    collected: [...state.collected],
    seenCutscenes: [...state.seenCutscenes],
    // The small unskippable moments (src/moments.js): which have played (once only, ever), the play clock (seconds) and the
    // play-clock time the last one ran at, so the 90 s spacing survives a reload.
    seenMoments: [...state.seenMoments],
    playSeconds: state.playSeconds,
    lastMomentAt: state.lastMomentAt,
    seenDialog: [...state.seenDialog],
    seenHints: [...state.seenHints],
    // M3a: her chosen name and look (src/scenes/intro-name.js, intro-customize.js). A save from
    // before this existed simply has neither field; applyState() below falls back to the defaults.
    playerName: state.playerName,
    customization: { ...state.customization },
    // M5 sound (src/audio.js): volume/mute, so a player's own level carries across reloads and
    // devices the same way everything else in GameState does.
    settings: { ...state.settings },
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
  // P5c (FB-0071): the ICL's door starts open for any save that predates it and has already got past it -- one holding the ICL key, one past the
  // hunt's key stage, or one that was standing inside the lab -- so nothing a player had earned is ever locked (maplogic.js isGateOpen()).
  const gate = typeof STORY !== 'undefined' ? STORY.iclGate : null;
  if (gate && !state.flags[gate.flag]) {
    const at = saved.position;
    const inside = saved.map === gate.map && at && tileInGateRoom(gate, at.x, at.y);
    if (inside || isGateOpen(gate, state)) state.flags[gate.flag] = true;
  }
  state.journal = Array.isArray(saved.journal) ? [...saved.journal] : state.journal;
  // A save from before M4 simply has no `minigames` field -- falls back to whatever GameState already
  // had (an empty object, fresh from resetGameState()/the initial literal), same as playerName above.
  state.minigames = saved.minigames && typeof saved.minigames === 'object' ? { ...saved.minigames } : state.minigames;
  state.collected = new Set(saved.collected || []);
  state.seenCutscenes = new Set(saved.seenCutscenes || []);
  // FB-0077: the Gate 2 boom barrier opens by itself when she nears it and stays up (flag `gateBarrierOpen`). A save from before that existed which is
  // already past the gate (the Gate 2 welcome has played, the hunt has begun, or she is standing inside a building) loads with it up: it never
  // lowers again and she never has to walk back to watch it open (src/story.js STORY.gateBarrier, maplogic.js isGateBarrierOpen()).
  const barrier = typeof STORY !== 'undefined' ? STORY.gateBarrier : null;
  if (barrier && !state.flags[barrier.flag]) {
    const elsewhere = Boolean(saved.map) && saved.map !== barrier.map;
    if (elsewhere || isGateBarrierOpen(barrier, state)) state.flags[barrier.flag] = true;
  }
  // A save from before the moments existed has none of these: no moment has played, so each may play once (never "already seen").
  state.seenMoments = new Set(Array.isArray(saved.seenMoments) ? saved.seenMoments : []);
  state.playSeconds = Number.isFinite(saved.playSeconds) && saved.playSeconds > 0 ? saved.playSeconds : 0;
  state.lastMomentAt = Number.isFinite(saved.lastMomentAt) ? saved.lastMomentAt : null;
  state.seenDialog = new Set(saved.seenDialog || []);
  state.seenHints = new Set(saved.seenHints || []);
  // M3a: falls back to whatever GameState already had (the just-booted defaults, see src/state.js)
  // for a save written before these fields existed, exactly like `flags`/`quest` above.
  state.playerName = typeof saved.playerName === 'string' && saved.playerName ? saved.playerName : state.playerName;
  state.customization = { ...state.customization, ...(saved.customization || {}) };
  // M5 sound: falls back to whatever GameState already had (the just-booted defaults) for a save
  // written before this field existed, same reasoning as playerName/customization above.
  state.settings = { ...state.settings, ...(saved.settings || {}) };
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
  if (payload.version === SAVE_VERSION) return { ...payload, state: renameLegacyIds(payload.state) };
  return null; // an older version we've never shipped, or a newer one this build predates
}

// FB-0070: the 2nd key room was first called the "ICVL" and is the "ICL" (Intelligent Computing Lab).
// Same save version, so this is a content migration rather than a new ladder step: every id and text
// an old save could hold -- quest.keys.icvl, the 'keyIcvl' inventory item, seen cutscene/dialog/hint
// ids ('keyRoomIcvl', 'key-icvl' ...), mini-game and collected ids, the journal line -- is renamed to
// the new spelling, keys and string values alike, at any depth. The player's own typed name is left
// alone. Safe to run on an already-migrated save (nothing left to rename), and it never mutates the input.
const LEGACY_ICVL = /icvl/gi;
function renameLegacyString(text) {
  return text.replace(LEGACY_ICVL, (m) => (m === 'ICVL' ? 'ICL' : m === 'icvl' ? 'icl' : 'Icl'));
}
function renameLegacyValue(value) {
  if (typeof value === 'string') return renameLegacyString(value);
  if (Array.isArray(value)) return value.map(renameLegacyValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[renameLegacyString(k)] = renameLegacyValue(v);
    return out;
  }
  return value;
}
function renameLegacyIds(state) {
  if (!state || typeof state !== 'object') return state;
  const renamed = renameLegacyValue(state);
  if (typeof state.playerName === 'string') renamed.playerName = state.playerName;
  return renamed;
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
  // FB-M1-save regression (interiors/onboarding round): cancel a pending autosave for this exact
  // profile *first*. Without this, deleting the profile the running game is actually autosaving
  // (e.g. right before navigating away) left the debounced write (AUTOSAVE_DEBOUNCE_MS, still
  // in-flight from a `player-moved`/`state-changed`/etc. burst a moment earlier) armed; a reload's
  // own 'pagehide'/'beforeunload' flush (below) then treated it as "an already-scheduled save this
  // page still owes", wrote it, and silently resurrected the very save this call just removed. The
  // flush's own comment already documented this exact guarantee ("can't resurrect a profile ...
  // just removed a moment ago with nothing left pending") -- it just wasn't true yet, since nothing
  // told the pending timer the profile it was about to write no longer exists.
  cancelPendingAutosave(profile);
  try {
    localStorage.removeItem(saveKey(profile));
  } catch (error) {
    console.warn(`save.js: could not delete profile "${profile}"`, error);
  }
}

// Set by initAutosave() below to the one currently-running autosave loop's own cancel hook (there's
// only ever one live game/page at a time, for `currentProfile()`) -- null before boot and in every
// unit test, which call saveGame()/loadGame()/deleteProfile() directly with no autosave loop running.
let activeAutosave = null;

function cancelPendingAutosave(profile) {
  if (activeAutosave && activeAutosave.profile === profile) activeAutosave.cancel();
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
  activeAutosave = {
    profile,
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
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
