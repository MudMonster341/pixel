// src/audio.js (docs/ROADMAP.md M5): the game boots muted-but-working with no audio errors even
// though Playwright's headless Chromium has no real audio device (docs/TESTING.md rule 4: behaviour
// and state, never real playback -- these tests never assert anything was actually heard), the
// pause menu's volume/mute controls apply immediately and survive a reload, and starting music from
// a user gesture (the title screen's "PRESS ENTER") never throws or leaves an unhandled rejection.
//
// Most tests below use the default `?audio=0` (tests/e2e/helpers.js, src/maplogic.js
// audioEnabled()): AudioManager's settings/UI logic doesn't depend on a real file ever having
// loaded (every play()/playMusic() call already no-ops safely against nothing loaded), and decoding
// several MB of real music on every single test's fresh page load meaningfully slows the whole suite
// down. The 2 tests explicitly marked "real files" pass `audio: true` to cover the thing `?audio=0`
// intentionally skips: that the real files actually load and play without error.
const { test, expect } = require('@playwright/test');
const {
  openGame, waitForBoot, state, startGame, openTitle, titleState, pressUntil, chooseTitleMenu,
} = require('./helpers');

const settings = (page) => page.evaluate(() => GameState.settings);

test('FB-M5-audio: the game boots muted-but-working, with no console/page errors from audio', async ({ page }) => {
  const { errors } = await openGame(page, { map: null });
  await startGame(page);
  // Walk a little (triggers footsteps) and open/close the pause menu's sound panel (triggers menu
  // move/confirm sfx) -- the exact paths most likely to throw if AudioManager ever mishandled a
  // headless/no-audio-device environment.
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).pause.controlsVisible).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test('FB-M5-audio (real files): every registered sound actually loads, footsteps/menu sfx/music all play without error', async ({ page }) => {
  const { errors } = await openGame(page, { map: null, audio: true });
  await startGame(page);
  await page.keyboard.down('w'); // footsteps
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await page.keyboard.press('Escape'); // pause menu open/close (menu move/confirm sfx)
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  await page.keyboard.press('Escape');
  const loaded = await page.evaluate(() => Object.keys(SOUNDS).every((id) => AudioManager.loaded(id)));
  expect(loaded).toBe(true);
  const musicPlaying = await page.evaluate(() => Boolean(AudioManager.music && AudioManager.musicId === 'overworldMusic'));
  expect(musicPlaying).toBe(true);
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test('FB-M5-audio: GameState.settings has sane defaults and AudioManager is wired up', async ({ page }) => {
  await openGame(page, { map: null });
  await startGame(page);
  const s = await settings(page);
  expect(s).toEqual({ musicVolume: 0.6, sfxVolume: 0.7, muted: false });
  const wired = await page.evaluate(() => Boolean(typeof AudioManager !== 'undefined' && AudioManager.game === game));
  expect(wired).toBe(true);
});

// The highlighted row inside the shared Controls/Sound panel (src/scenes/ui.js ControlsPanel), read
// straight off the scene the same way title.spec.js reads `newGameConfirm.index` -- there's no
// equivalent field on state()'s own `pause` summary.
const controlsSettingIndex = (page) => page.evaluate(() => game.scene.getScene('ui').pause.controls.settingIndex);

test('FB-M5-audio: changing music/sfx volume and mute in the pause menu applies immediately and persists across a reload', async ({ page }) => {
  const profile = 'e2e-audio-settings';
  await openGame(page, { map: null, save: true, profile });
  await startGame(page);

  // Every step below is a one-shot keydown toggle (Esc/Up/Down/Left/Right/Enter) -- pressUntil
  // (tests/e2e/helpers.js, ERR-0003) retries the keypress itself if the browser/Phaser drops one
  // under load, rather than a bare press() that can leave the rest of the sequence acting on a state
  // one step behind (silently adjusting the wrong row, say) and only failing much later on the final
  // read, which is what an earlier flaky run of this exact test did.
  await pressUntil(page, 'Escape', async () => (await state(page)).pause.visible);
  await pressUntil(page, 'ArrowDown', async () => (await state(page)).pause.view === 'menu'); // Resume -> Controls stays highlighted
  await pressUntil(page, 'Enter', async () => (await state(page)).pause.controlsVisible);

  const before = await settings(page);

  // Row 0 (music): raise it.
  await pressUntil(page, 'ArrowRight', async () => (await settings(page)).musicVolume > before.musicVolume);
  await expect.poll(async () => (await settings(page)).musicVolume).toBeCloseTo(Math.min(1, before.musicVolume + 0.1), 5);
  // Row 1 (sfx): move down, then lower it.
  await pressUntil(page, 'ArrowDown', async () => (await controlsSettingIndex(page)) === 1);
  await pressUntil(page, 'ArrowLeft', async () => (await settings(page)).sfxVolume < before.sfxVolume);
  await expect.poll(async () => (await settings(page)).sfxVolume).toBeCloseTo(Math.max(0, before.sfxVolume - 0.1), 5);
  // Row 2 (mute): move down, then toggle it on.
  await pressUntil(page, 'ArrowDown', async () => (await controlsSettingIndex(page)) === 2);
  await pressUntil(page, 'ArrowRight', async () => (await settings(page)).muted === true);

  const changed = await settings(page);

  // Applied immediately: AudioManager reflects the same numbers right now, without needing to close
  // anything first.
  const live = await page.evaluate(() => ({
    music: AudioManager.getVolume('music'), sfx: AudioManager.getVolume('sfx'), muted: AudioManager.isMuted(),
  }));
  expect(live).toEqual({ music: changed.musicVolume, sfx: changed.sfxVolume, muted: changed.muted });

  // Saved with the rest of GameState (src/save.js) -- autosave is debounced, so poll the write.
  const saved = () => page.evaluate((p) => {
    const raw = localStorage.getItem(`pixelquest.save.v1.${p}`);
    return raw ? JSON.parse(raw).state.settings : null;
  }, profile);
  await expect.poll(saved).toEqual(changed);

  await page.reload();
  await waitForBoot(page);
  expect(await settings(page)).toEqual(changed);
});

test('FB-M5-audio: a fresh "Play" (resetGameState) never resets the volume/mute a player already set -- it is a device preference, not progress', async ({ page }) => {
  await openTitle(page);
  await page.evaluate(() => AudioManager.setVolume('music', 0.15));
  const before = await settings(page);
  expect(before.musicVolume).toBeCloseTo(0.15, 5);

  // "Play" resets game progress (src/state.js resetGameState()) -- go through the real menu flow.
  await chooseTitleMenu(page, 'play');
  await waitForBoot(page);
  expect((await settings(page)).musicVolume).toBeCloseTo(0.15, 5);
});

test('FB-M5-audio (real files): starting title music from the "PRESS ENTER" gesture never throws or leaves an unhandled rejection', async ({ page }) => {
  const { errors } = await openTitle(page, { audio: true });
  expect((await titleState(page)).stage).toBe('intro');
  await pressUntil(page, 'Enter', async () => (await titleState(page)).stage === 'menu');
  await expect.poll(async () => page.evaluate(() => Boolean(AudioManager.music && AudioManager.musicId === 'titleMusic'))).toBe(true);
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});

test('FB-M5-audio: the title screen\'s own Controls panel adjusts the same settings (music/sfx/mute), reachable before ever starting a game', async ({ page }) => {
  await openTitle(page);
  await pressUntil(page, 'Enter', async () => (await titleState(page)).stage === 'menu');
  await chooseTitleMenu(page, 'controls');
  await expect.poll(async () => (await titleState(page)).controlsVisible).toBe(true);

  const titleSettingIndex = () => page.evaluate(() => game.scene.getScene('title').controls.settingIndex);
  const before = await settings(page);
  // pressUntil (ERR-0003) retries a dropped one-shot keydown instead of a bare press() -- see the
  // matching pause-menu test above for why a bare sequence here can fail much later, mid-sequence.
  await pressUntil(page, 'ArrowRight', async () => (await settings(page)).musicVolume > before.musicVolume); // row 0: music, up
  await expect.poll(async () => (await settings(page)).musicVolume).toBeCloseTo(Math.min(1, before.musicVolume + 0.1), 5);
  await pressUntil(page, 'ArrowDown', async () => (await titleSettingIndex()) === 1); // row 1: sfx
  await pressUntil(page, 'ArrowDown', async () => (await titleSettingIndex()) === 2); // row 2: mute
  await pressUntil(page, 'ArrowRight', async () => (await settings(page)).muted === true); // toggle mute on
  await expect.poll(async () => (await settings(page)).muted).toBe(true);
});

// Merged in with the FB-0035..FB-0043 bug batch (main): the audio branch never saw the scrolling
// Credits panel (FB-0037) or the "start a new game?" overwrite confirm (FB-0040), both of which now
// get the same menuMove/menuConfirm sfx every other keyboard-driven highlight in this game plays
// (src/scenes/title.js scrollCredits()/moveNewGameConfirm()/resolveNewGameConfirm()). These two tests
// use real audio files (`audio: true`) specifically to catch what `?audio=0` would hide: an
// AudioManager.play() call throwing partway through one of these new panels.
test('FB-0037/M5 sound: scrolling the Credits panel plays the menu-move tick and never throws', async ({ page }) => {
  const { errors } = await openTitle(page, { audio: true });
  await pressUntil(page, 'Enter', async () => (await titleState(page)).stage === 'menu');
  await chooseTitleMenu(page, 'credits');
  await expect.poll(async () => (await titleState(page)).creditsVisible).toBe(true);
  // scrollCredits() is a no-op past either end of the content -- the point here is that the keydown
  // path (and the AudioManager.play() call it makes when it does move) never throws.
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowDown');
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Escape');
  await expect.poll(async () => (await titleState(page)).creditsVisible).toBe(false);
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});

test('FB-0040/M5 sound: the "start a new game?" confirm panel plays menu move/confirm sfx and never throws', async ({ page }) => {
  const profile = `e2e-audio-newgame-confirm-${Date.now()}`;
  await openGame(page, { map: 'meadow', save: true, profile, audio: true });
  await startGame(page);
  await page.evaluate((p) => saveGame(p), profile); // a save now exists -- Play will ask first

  const { errors } = await openTitle(page, { save: true, profile, audio: true });
  await pressUntil(page, 'Enter', async () => (await titleState(page)).stage === 'menu');
  for (let i = 0; i < 10; i++) {
    const t = await titleState(page);
    if (t.menuItems[t.menuIndex] === 'play') break;
    await pressUntil(page, 'ArrowDown', async () => (await titleState(page)).menuIndex !== t.menuIndex);
  }
  await page.keyboard.press('Enter');
  const confirmVisible = () => page.evaluate(() => game.scene.getScene('title').newGameConfirm.visible);
  await expect.poll(confirmVisible).toBe(true);
  await page.keyboard.press('ArrowDown'); // 'No' -> 'Yes': menuMove
  await page.keyboard.press('ArrowUp'); // back to 'No': menuMove
  await page.keyboard.press('Enter'); // resolves 'No': menuConfirm
  await expect.poll(confirmVisible).toBe(false);
  await page.waitForTimeout(200);
  expect(errors).toEqual([]);
});
