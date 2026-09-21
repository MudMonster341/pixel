#!/usr/bin/env node
// M3a visual QA (owner brief 2026-09-21, docs/QA_PLAN.md's "look at it" bar): screenshots of the
// title screen's new buttons and the whole opening chain (Mustafa's greeting, name entry,
// customisation, the bus arrival at three moments, and the Main Block entrance cutscene). Separate
// from tools/qa-shots.js (which covers the rest of the game and deliberately skips this opening with
// `?intro=0`) so each script stays focused on what it's actually walking through.
//
// Run: node tools/qa-shots-intro.js
// Output: qa-shots/intro/*.png (gitignored, same as qa-shots/ itself)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'qa-shots', 'intro');
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

async function run(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE_URL}/?dev=0&map=campus&intro=1`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('title')?.menuItems));
  await page.waitForTimeout(300); // let the parallax background settle into a representative frame
  await shoot(page, '01-title-intro'); // logo + blinking "PRESS ENTER", no menu yet

  await page.keyboard.press('Enter'); // reveals the menu
  await page.waitForFunction(() => game.scene.getScene('title').stage === 'menu');
  await page.waitForTimeout(150);
  await shoot(page, '02-title-menu'); // the new big drawn buttons

  // Hover the second button (Controls, since no save exists yet) to show the hover/bevel state.
  const controlsBox = await page.evaluate(() => {
    const b = game.scene.getScene('title').menuButtons[1].box;
    return b;
  });
  await page.mouse.move(controlsBox.x + controlsBox.w / 2, controlsBox.y + controlsBox.h / 2);
  await page.waitForTimeout(100);
  await shoot(page, '03-title-menu-button-hover');
  await page.mouse.move(10, 10);

  await page.keyboard.press('Enter'); // Play (index 0, still highlighted -- hover didn't move the keyboard focus)
  await page.waitForFunction(() => game.scene.isActive('greeting'));
  await page.waitForTimeout(400); // let the fade-in and dialog box open
  await shoot(page, '04-greeting');

  // Advance one line so the typewriter/portrait combination is visible mid-conversation too.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  await shoot(page, '05-greeting-line-2');

  await page.keyboard.press('Escape'); // skip to name entry
  await page.waitForFunction(() => game.scene.isActive('name-entry'));
  await page.waitForTimeout(300);
  await shoot(page, '06-name-entry-default');

  // Type a name so the field and the keyboard's highlighted keys both show real content.
  for (const key of ['n', 'a', 'd', 'i', 'a']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(120);
  }
  await shoot(page, '07-name-entry-typed');

  await page.keyboard.press('Enter'); // confirm (OK still has keyboard focus)
  await page.waitForFunction(() => game.scene.isActive('customize'));
  await page.waitForTimeout(400);
  await shoot(page, '08-customize-default');

  await page.keyboard.press('ArrowRight'); // cycle to the 'sky' swatch
  await page.waitForTimeout(300);
  await shoot(page, '09-customize-sky-swatch');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => game.scene.isActive('bus-arrival'));
  await page.waitForTimeout(200);
  await shoot(page, '10-bus-arrival-driving-in');

  await page.waitForTimeout(2200); // roughly when the bus reaches its stop and the door opens
  await shoot(page, '11-bus-arrival-door-open');

  await page.waitForTimeout(1000); // she's stepped down, door about to close
  await shoot(page, '12-bus-arrival-stepped-down');

  await page.waitForFunction(() => game.scene.isActive('world'), { timeout: 10_000 });
  await page.waitForTimeout(300);
  await shoot(page, '13-outside-gate-after-bus');

  await page.close();
}

async function shootEntranceCutscene(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE_URL}/?dev=0&map=campus&title=0&intro=0&cutscene=1`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('world')?.player?.active));

  const trigger = await page.evaluate(() => game.scene.getScene('world').mapObjects
    .find((o) => o.type === 'cutscene' && o.props.cutscene === 'entrance'));
  await page.evaluate((t) => {
    game.scene.getScene('world').player.body.reset(
      (t.x + t.width / 2) * 16, (t.y + t.height / 2) * 16,
    );
  }, trigger);
  await page.waitForFunction(() => game.scene.isActive('cutscene'));
  await page.waitForFunction(() => game.scene.getScene('cutscene').image.alpha >= 1);
  await shoot(page, '14-entrance-cutscene-image');

  await page.waitForFunction(() => game.scene.getScene('cutscene').dialog.isOpen);
  await page.waitForTimeout(400);
  await shoot(page, '15-entrance-cutscene-dialog');

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
    await shootEntranceCutscene(browser);

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
