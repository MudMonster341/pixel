// src/audio.js: the SOUNDS registry (data) and AudioManager (logic), plus the settings that ride
// along in GameState/src/save.js (docs/ROADMAP.md M5). No browser needed -- AudioManager.game stays
// null under this sandbox (tests/helpers/game-data.js never calls .init()), so every method that
// would otherwise touch a real Phaser.Game is exercised here as the safe no-op it has to be.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');

// ---------- SOUNDS: every registered sound's file exists on disk, volumes in range, categories valid ----------

// ---------- audioEnabled(): the ?audio=0 performance switch (src/maplogic.js) ----------

test('audioEnabled() defaults on, ?audio=0 turns it off', () => {
  const { audioEnabled } = loadGameData();
  assert.equal(audioEnabled(''), true);
  assert.equal(audioEnabled(), true); // no `location` in this sandbox, same as titleEnabled()/saveEnabled()
  assert.equal(audioEnabled('?audio=0'), false);
  assert.equal(audioEnabled('?map=campus&audio=0'), false);
  assert.equal(audioEnabled('?audio=1'), true);
});

test('audio: every registered sound points at a file that actually exists on disk', () => {
  const { SOUNDS } = loadGameData();
  const ids = Object.keys(SOUNDS);
  assert.ok(ids.length > 0, 'expected at least one registered sound');
  for (const [id, def] of Object.entries(SOUNDS)) {
    assert.ok(typeof def.file === 'string' && def.file.length > 0, `${id}: file should be a non-empty string`);
    const full = path.join(ROOT, def.file);
    assert.ok(fs.existsSync(full), `${id}: expected ${def.file} to exist (run \`npm run audio\` if it's missing)`);
  }
});

test('audio: every registered sound has a volume in [0, 1] and a valid category', () => {
  const { SOUNDS, AUDIO_CATEGORIES } = loadGameData();
  for (const [id, def] of Object.entries(SOUNDS)) {
    assert.ok(Number.isFinite(def.volume), `${id}: volume should be a finite number`);
    assert.ok(def.volume >= 0 && def.volume <= 1, `${id}: volume ${def.volume} should be within [0, 1]`);
    assert.ok(AUDIO_CATEGORIES.includes(def.category), `${id}: category "${def.category}" should be one of ${AUDIO_CATEGORIES.join(', ')}`);
    assert.equal(typeof def.loop, 'boolean', `${id}: loop should be a boolean`);
  }
});

test('audio: every music-category sound loops (nothing meant to be a bed ever plays once and goes silent)', () => {
  const { SOUNDS } = loadGameData();
  for (const [id, def] of Object.entries(SOUNDS)) {
    if (def.category === 'music') assert.equal(def.loop, true, `${id}: a music track should loop`);
  }
});

test('audio: the story\'s minimum sound list is all registered (docs/ROADMAP.md M5 rule 3)', () => {
  const { SOUNDS } = loadGameData();
  const required = [
    'footstepOutdoor1', 'footstepIndoor1', 'menuMove', 'menuConfirm', 'dialogBlip', 'itemPickup',
    'keyAwarded', 'doorOpen', 'warpStairs', 'lockedDoorThud', 'minigameJump', 'minigameFlap',
    'minigameLineClear', 'minigameLose', 'minigameWin', 'boxOpen', 'cardWhoosh',
    'titleMusic', 'overworldMusic', 'indoorMusic', 'minigameMusic', 'cardMusic',
  ];
  for (const id of required) assert.ok(SOUNDS[id], `expected a registered sound for "${id}"`);
});

// ---------- AudioManager: safe with no real Phaser.Game (unit tests, and any code path that runs
// before init() does) ----------

test('audio: AudioManager methods are silent no-ops with no game attached', () => {
  const { AudioManager } = loadGameData();
  assert.equal(AudioManager.game, null);
  assert.doesNotThrow(() => AudioManager.play('itemPickup'));
  assert.doesNotThrow(() => AudioManager.playMusic('overworldMusic'));
  assert.doesNotThrow(() => AudioManager.stopMusic());
  assert.doesNotThrow(() => AudioManager.playThrottled('itemPickup', 'test', 100, 0));
  assert.equal(AudioManager.loaded('itemPickup'), false);
});

test('audio: clampVolume() clamps to [0, 1] and treats non-numbers as 0', () => {
  const { clampVolume } = loadGameData();
  assert.equal(clampVolume(0.5), 0.5);
  assert.equal(clampVolume(-1), 0);
  assert.equal(clampVolume(2), 1);
  assert.equal(clampVolume(NaN), 0);
  assert.equal(clampVolume(undefined), 0);
});

test('audio: effectiveVolume() multiplies a sound\'s own mix level by its category slider, and mute zeroes everything', () => {
  const { AudioManager, GameState } = loadGameData();
  GameState.settings = { musicVolume: 0.5, sfxVolume: 1, muted: false };
  assert.equal(AudioManager.effectiveVolume('overworldMusic'), 0.42 * 0.5);
  assert.equal(AudioManager.effectiveVolume('itemPickup'), 0.5 * 1);

  GameState.settings.muted = true;
  assert.equal(AudioManager.effectiveVolume('overworldMusic'), 0);
  assert.equal(AudioManager.effectiveVolume('itemPickup'), 0);
});

test('audio: sfx and ui categories share one slider, music has its own', () => {
  const { AudioManager, GameState } = loadGameData();
  GameState.settings = { musicVolume: 1, sfxVolume: 0.25, muted: false };
  assert.equal(AudioManager.categoryVolume('sfx'), 0.25);
  assert.equal(AudioManager.categoryVolume('ui'), 0.25);
  assert.equal(AudioManager.categoryVolume('music'), 1);
});

// ---------- settings: saved, restored, applied (docs/ROADMAP.md M5 rule 4) ----------

test('audio settings: GameState starts with sane defaults', () => {
  const { GameState } = loadGameData();
  assert.deepEqual(plain(GameState.settings), { musicVolume: 0.6, sfxVolume: 0.7, muted: false });
});

test('audio settings: AudioManager.setVolume()/setMuted() write straight into GameState.settings, clamped', () => {
  const { AudioManager, GameState } = loadGameData();
  AudioManager.setVolume('music', 0.9);
  assert.equal(GameState.settings.musicVolume, 0.9);
  AudioManager.setVolume('sfx', 5); // out of range -- clamped, not rejected
  assert.equal(GameState.settings.sfxVolume, 1);
  AudioManager.setVolume('sfx', -5);
  assert.equal(GameState.settings.sfxVolume, 0);
  AudioManager.setMuted(true);
  assert.equal(GameState.settings.muted, true);
  assert.equal(AudioManager.isMuted(), true);
  AudioManager.setMuted(false);
  assert.equal(AudioManager.isMuted(), false);
});

test('audio settings: a changed volume survives a save/load round trip', () => {
  const { AudioManager, GameState, saveGame, loadGame } = loadGameData();
  AudioManager.setVolume('music', 0.2);
  AudioManager.setVolume('sfx', 0.9);
  AudioManager.setMuted(true);
  assert.ok(saveGame('audio-test-profile', GameState));

  // Simulate a fresh boot: reset to the just-booted defaults, then load the save back on top.
  GameState.settings = { musicVolume: 0.6, sfxVolume: 0.7, muted: false };
  assert.ok(loadGame('audio-test-profile', GameState));
  assert.deepEqual(plain(GameState.settings), { musicVolume: 0.2, sfxVolume: 0.9, muted: true });
});

test('audio settings: a save written before `settings` existed falls back to whatever GameState already had', () => {
  const { GameState, applyState } = loadGameData();
  GameState.settings = { musicVolume: 0.33, sfxVolume: 0.44, muted: false };
  applyState(GameState, { map: null }); // no `settings` key at all, like a pre-M5 save
  assert.deepEqual(plain(GameState.settings), { musicVolume: 0.33, sfxVolume: 0.44, muted: false });
});

test('audio settings: resetGameState() (Title "Play", a new game) never resets volume/mute -- it\'s a device preference, not progress', () => {
  const { GameState, resetGameState } = loadGameData();
  AudioManagerSetSettings(GameState, { musicVolume: 0.1, sfxVolume: 0.2, muted: true });
  resetGameState(GameState);
  assert.deepEqual(plain(GameState.settings), { musicVolume: 0.1, sfxVolume: 0.2, muted: true });
});

function AudioManagerSetSettings(state, settings) {
  state.settings = { ...settings };
}
