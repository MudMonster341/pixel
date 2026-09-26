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

test('FB-M5-audio: changing music/sfx volume and mute in the pause menu applies immediately and persists across a reload', async ({ page }) => {
  const profile = 'e2e-audio-settings';
  await openGame(page, { map: null, save: true, profile });
  await startGame(page);

  await page.keyboard.press('Escape');
  await expect.poll(async () => (await state(page)).pause.visible).toBe(true);
  await page.keyboard.press('ArrowDown'); // Resume -> Controls
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await state(page)).pause.controlsVisible).toBe(true);

  const before = await settings(page);

  // Row 0 (music): raise it.
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await settings(page)).musicVolume).toBeCloseTo(Math.min(1, before.musicVolume + 0.1), 5);
  // Row 1 (sfx): move down, then lower it.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => (await settings(page)).sfxVolume).toBeCloseTo(Math.max(0, before.sfxVolume - 0.1), 5);
  // Row 2 (mute): move down, then toggle it on.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await settings(page)).muted).toBe(true);

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

  const before = await settings(page);
  await page.keyboard.press('ArrowRight'); // row 0: music, up
  await expect.poll(async () => (await settings(page)).musicVolume).toBeCloseTo(Math.min(1, before.musicVolume + 0.1), 5);
  await page.keyboard.press('ArrowDown'); // row 1: sfx
  await page.keyboard.press('ArrowDown'); // row 2: mute
  await page.keyboard.press('ArrowRight'); // toggle mute on
  await expect.poll(async () => (await settings(page)).muted).toBe(true);
});
