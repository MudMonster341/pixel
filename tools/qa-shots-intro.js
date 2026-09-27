#!/usr/bin/env node
// M3a/ADR 0016 visual QA (owner brief 2026-09-21, docs/QA_PLAN.md's "look at it" bar): screenshots of
// the title screen's live campus backdrop, the greeting/name/customize screens over that same
// backdrop, the in-world opening script (bus arrival + Mustafa meeting her), the Main Block entrance
// beat and a key-room beat. Separate from tools/qa-shots.js (which covers the rest of the game and
// deliberately skips this opening with `?intro=0`) so each script stays focused on what it's actually
// walking through.
//
// Run: node tools/qa-shots-intro.js
// Output: docs/research/premium-pass/cutscenes/*.png -- committed (unlike qa-shots/, gitignored),
// since these are the "screenshots of each beat" this task's own report points the owner at.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'research', 'premium-pass', 'cutscenes');
const PORT = 8098;
const FEEDBACK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-quest-qa-shots-intro-'));
const BASE_URL = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 960, height: 540 };

function log(msg) {
  console.log(`[qa-shots-intro] ${msg}`);
}

function waitForServer(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  const tryOnce = () =>
    new Promise((resolve) => {
      const req = require('http').get(url, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  return (async function poll() {
    if (await tryOnce()) return;
    if (Date.now() > deadline) throw new Error(`server did not come up at ${url} in time`);
    await new Promise((r) => setTimeout(r, 200));
    return poll();
  })();
}

let shotCount = 0;
async function shoot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  shotCount++;
  log(`saved ${path.relative(ROOT, file)}`);
}

// page.waitForFunction(fn, arg, options) -- the timeout has to go in the 3rd argument, not the 2nd
// (a 2-arg call's 2nd param is `arg`, passed into `fn`, not options); this wraps that correctly once
// so every call below can just pass a plain ms number.
function waitFor(page, fn, timeout = 15_000) {
  return page.waitForFunction(fn, undefined, { timeout });
}

// Presses Enter until the dialog box now showing has fully closed (whatever its own line/typing
// state), the same "keep pressing like an impatient player would" shape tests/e2e/helpers.js
// pressUntil() uses -- robust to exactly how many lines a `say` step has or how far mid-typewriter
// any single press happens to land.
async function advanceDialogToClose(page, maxPresses = 12) {
  for (let i = 0; i < maxPresses; i++) {
    const open = await page.evaluate(() => game.scene.getScene('ui').dialog.isOpen);
    if (!open) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
}

async function run(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE_URL}/?dev=0&map=campus&intro=1`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('title')?.menuItems));
  await page.waitForTimeout(600); // let the live campus pan settle into a representative frame
  await shoot(page, '01-title-live-campus-pan'); // logo + blinking "PRESS ENTER" over the real map

  await page.keyboard.press('Enter'); // reveals the menu
  await page.waitForFunction(() => game.scene.getScene('title').stage === 'menu');
  await page.waitForTimeout(150);
  await shoot(page, '02-title-menu'); // the big drawn buttons over the same live backdrop

  await page.keyboard.press('Enter'); // Play
  await page.waitForFunction(() => game.scene.isActive('greeting'));
  await page.waitForTimeout(400); // let the crossfade settle
  await shoot(page, '03-greeting-live-backdrop');

  await page.keyboard.press('Escape'); // skip to name entry
  await page.waitForFunction(() => game.scene.isActive('name-entry'));
  await page.waitForTimeout(300);
  await shoot(page, '04-name-entry-live-backdrop');

  await page.keyboard.press('Enter'); // accept default name (OK has keyboard focus)
  await page.waitForFunction(() => game.scene.isActive('customize'));
  await page.waitForTimeout(400);
  await shoot(page, '05-customize-live-backdrop');

  await page.keyboard.press('Enter'); // confirm default clothes -> boot -> world
  await waitFor(page, () => game.scene.isActive('world'), 10_000);
  await waitFor(page, () => Boolean(game.scene.getScene('world').scriptRunner?.isRunning));

  // The bus driving in (SCRIPTS.opening's own BUS_STEPS, src/scripts.js).
  await waitFor(page, () => Boolean(game.scene.getScene('world').scriptRunner.actors.get('bus')));
  await page.waitForTimeout(700);
  await shoot(page, '06-opening-bus-arriving');

  // She's stepped off, visible again, the bus about to pull away.
  await waitFor(page, () => game.scene.getScene('world').player.visible, 8_000);
  await page.waitForTimeout(500);
  await shoot(page, '07-opening-stepped-off-bus');

  // Mustafa has walked up and is talking to her (MUSTAFA_MEETS_HER_CORE's own first `say`).
  await waitFor(page, () => {
    const ui = game.scene.getScene('ui');
    return Boolean(game.scene.getScene('world').scriptRunner.actors.get('mustafa')) && ui.dialog.isOpen;
  }, 8_000);
  await page.waitForTimeout(400);
  await shoot(page, '08-opening-mustafa-meets-her');

  // Advance through this say's own 2 lines (real keypresses, same as a player would) so the script
  // actually moves on to the walk-up-the-avenue + camera-pan-to-Main-Block beat.
  await advanceDialogToClose(page);

  // The camera's own pan up to the Main Block entrance, with Mustafa's line about the LUG stall.
  await waitFor(page, () => {
    const ui = game.scene.getScene('ui');
    return ui.dialog.isOpen && /LUG stall/.test(ui.dialog.fullText || '');
  }, 8_000);
  await page.waitForTimeout(300);
  await shoot(page, '09-opening-camera-pans-to-main-block');

  await advanceDialogToClose(page); // close that last line

  // Control back: the opening script has finished, the destination arrow/objective are live.
  await waitFor(page, () => !game.scene.getScene('world').scriptRunner.isRunning, 10_000);
  await page.waitForTimeout(300);
  await shoot(page, '10-control-returns-objective-set');

  await page.close();
}

async function shootEntranceAndKeyRoomBeats(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE_URL}/?dev=0&map=campus&title=0&intro=0&cutscene=1`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('world')?.player?.active));

  // The Main Block entrance beat (ADR 0016 SCRIPTS.entrance, replacing the old static illustration).
  const entranceTrigger = await page.evaluate(() => game.scene.getScene('world').mapObjects
    .find((o) => o.type === 'cutscene' && o.props.cutscene === 'entrance'));
  await page.evaluate((t) => {
    game.scene.getScene('world').player.body.reset((t.x + t.width / 2) * 16, (t.y + t.height / 2) * 16);
  }, entranceTrigger);
  await waitFor(page, () => game.scene.getScene('world').scriptRunner.isRunning, 8_000);
  await waitFor(page, () => game.scene.getScene('ui').dialog.isOpen, 8_000);
  await page.waitForTimeout(300);
  await shoot(page, '11-main-block-entrance-beat');
  await advanceDialogToClose(page); // close the one line, letting the script finish
  await waitFor(page, () => !game.scene.getScene('world').scriptRunner.isRunning, 8_000);

  // A key-room beat: teleport to the Physics Lab (main-block-3) and walk her within range of the
  // desk -- the same story-gated route this game already requires (quest.stage -> 'hunting'), forced
  // directly here since this is a screenshot tool, not a playthrough.
  await page.evaluate(() => {
    GameState.quest.stage = 'hunting';
    game.scene.getScene('world').scene.restart({ map: 'main-block-3' });
  });
  await waitFor(page, () => game.scene.getScene('world').mapKey === 'main-block-3'
    && game.scene.getScene('world').player.active, 8_000);
  const ks = await page.evaluate(() => {
    const w = game.scene.getScene('world');
    const station = w.keyStations.find((k) => k.def.id === 'physicsLab');
    return { x: station.x, y: station.y };
  });
  await page.evaluate((p) => game.scene.getScene('world').player.body.reset(p.x, p.y + 40), ks);
  await waitFor(page, () => game.scene.getScene('world').scriptRunner.isRunning, 8_000);
  await waitFor(page, () => game.scene.getScene('ui').dialog.isOpen, 8_000);
  await page.waitForTimeout(250);
  await shoot(page, '12-key-room-beat-physics-lab');

  await page.close();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const file of fs.readdirSync(OUT_DIR)) fs.rmSync(path.join(OUT_DIR, file));

  log(`starting server.js on port ${PORT} (feedback dir: ${FEEDBACK_DIR})`);
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), FEEDBACK_DIR },
    stdio: 'ignore',
  });
  let browser;
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch();

    await run(browser);
    await shootEntranceAndKeyRoomBeats(browser);

    log(`done: ${shotCount} screenshots in ${path.relative(ROOT, OUT_DIR)}/`);
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.rmSync(FEEDBACK_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[qa-shots-intro] failed:', error);
  process.exitCode = 1;
});
