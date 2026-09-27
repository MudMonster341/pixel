const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const ROOT = __dirname;
const PORT = 8097;
const FEEDBACK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'debug-'));

async function main() {
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT, env: { ...process.env, PORT: String(PORT), FEEDBACK_DIR }, stdio: 'ignore',
  });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('console', (m) => console.log('[console]', m.type(), m.text()));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/?dev=0&map=campus&intro=1`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('title')?.menuItems));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => game.scene.getScene('title').stage === 'menu');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => game.scene.isActive('greeting'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => game.scene.isActive('name-entry'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => game.scene.isActive('customize'));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  const active = await page.evaluate(() => game.scene.scenes.filter((s) => s.sys.isActive()).map((s) => s.sys.settings.key));
  console.log('active scenes:', active);
  const worldInfo = await page.evaluate(() => {
    const w = game.scene.getScene('world');
    if (!w) return null;
    return { exists: true, playOpening: w.playOpening, mapKey: w.mapKey, transitioning: w.transitioning, scriptRunning: w.scriptRunner && w.scriptRunner.isRunning };
  });
  console.log('world:', worldInfo);
  await browser.close();
  server.kill();
}
main().catch((e) => { console.error(e); process.exit(1); });
