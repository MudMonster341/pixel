// Plays the offline bundle from file:// (title -> name -> bus -> Mustafa -> stall -> 3 keys -> box -> card -> credits -> title).
// usage: npm run pack:offline && node tools/qa-offline-play.js [chromium|webkit]
// Build-phase-after check (docs/QUALITY_LOOP.md): runs a real browser, never leave it running. Mini-games are
// won through scene.win(true) (they are covered by tests/e2e/minigames.spec.js); screenshots go to the OS temp dir.
// Playwright's Windows WebKit has no Web Audio (AudioContext undefined), so audio is only verified in Chromium.
const path = require('path');
const { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const OUT = require('os').tmpdir();
const pw = require(path.join(ROOT, 'node_modules', 'playwright-core'));
const engine = process.argv[2] || 'chromium';
const INDEX = process.env.PLAY_URL || pathToFileURL(path.join(ROOT, 'dist', 'offline', 'index.html')).href; // PLAY_URL: play a hosted copy instead

const log = (...a) => console.log(`[${engine}]`, ...a);
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(page, fn, label, timeout = 20000, arg) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); } catch (e) { throw new Error(`timeout waiting for: ${label}`); }
}
const active = (page, k) => page.evaluate((s) => game.scene.isActive(s), k);

(async () => {
  const browser = await pw[engine].launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url().slice(0, 120)));
  const external = [];
  page.on('request', (r) => { if (/^https?:/.test(r.url())) external.push(r.url()); });

  await page.goto(INDEX);
  await until(page, () => window.game && game.scene.isActive('title'), 'title scene');
  log('title up; bundle flag', await page.evaluate(() => window.__OFFLINE_BUNDLE));

  // first click, then check audio can run
  await page.mouse.click(640, 360);
  await sleep(1200);
  const audio = await page.evaluate(() => {
    const sm = game.sound; const ctx = sm && sm.context;
    return { type: sm && sm.constructor.name, ctxState: ctx ? ctx.state : null, locked: sm ? sm.locked : null, playing: sm && sm.sounds ? sm.sounds.filter((s) => s.isPlaying).length : null };
  });
  log('audio after first click', JSON.stringify(audio));

  // title menu -> Play
  await page.keyboard.press('Enter'); await sleep(400);
  for (let i = 0; i < 6; i++) {
    const t = await page.evaluate(() => { const s = game.scene.getScene('title'); return { id: s.menuItems && s.menuItems[s.menuIndex] && s.menuItems[s.menuIndex].id, ids: s.menuItems && s.menuItems.map((m) => m.id) }; });
    if (t.id === 'play') break;
    await page.keyboard.press('ArrowDown'); await sleep(200);
  }
  await page.keyboard.press('Enter');
  await until(page, () => game.scene.isActive('greeting'), 'greeting');
  await sleep(500);
  await page.keyboard.press('Escape');
  await until(page, () => game.scene.isActive('name-entry'), 'name entry');
  const prefill = await page.evaluate(() => game.scene.getScene('name-entry').name);
  log('name prefilled:', prefill);
  await page.keyboard.press('Enter');
  await until(page, () => game.scene.isActive('customize'), 'customize');
  await page.keyboard.press('Enter');
  await until(page, () => game.scene.isActive('world') && game.scene.getScene('world').player, 'world boot', 30000);
  log('world booted');
  // let the opening bus script play a few seconds (real playback), then skip
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, `${engine}-bus.png`) });
  const scriptOn = () => page.evaluate(() => Boolean(game.scene.getScene('world').scriptRunner && game.scene.getScene('world').scriptRunner.isRunning));
  await until(page, () => { const w = game.scene.getScene('world'); return w.scriptRunner && w.scriptRunner.isRunning; }, 'opening script running', 15000);
  for (let i = 0; i < 20 && (await scriptOn()); i++) { await page.keyboard.press('Escape'); await sleep(400); }
  if (await scriptOn()) throw new Error('opening script never finished');
  log('opening done; map', await page.evaluate(() => game.scene.getScene('world').mapKey));

  const tp = (x, y) => page.evaluate(([a, b]) => game.scene.getScene('world').player.body.reset(a * 16 + 8, b * 16 + 8), [x, y]);
  const waitMap = (k) => until(page, (key) => { const w = game.scene.getScene('world'); return w && (w.mapKey === key || (w.def && w.def.tiled === key)) && w.player; }, `map ${k}`, 20000, k);
  const stateMap = () => page.evaluate(() => { const w = game.scene.getScene('world'); return w.mapKey || (w.def && w.def.name); });

  // walk into the Main Block
  const door = await page.evaluate(() => { const o = game.scene.getScene('world').mapObjects.find((x) => x.type === 'door' && x.props.building === 'Main Block'); return { x: Math.floor(o.x), y: Math.floor(o.y) }; });
  const scriptOn2 = () => page.evaluate(() => { const w = game.scene.getScene('world'); return !!(w.scriptRunner && w.scriptRunner.isRunning); });
  for (let attempt = 0; attempt < 6; attempt++) {
    if ((await page.evaluate(() => game.scene.getScene('world').mapKey)) === 'main-block-g') break;
    for (let i = 0; i < 12 && (await scriptOn2()); i++) { await page.keyboard.press('Escape'); await sleep(400); }
    await tp(door.x, door.y + 2); await sleep(300);
    await page.keyboard.down('w'); await sleep(900); await page.keyboard.up('w'); await sleep(900);
  }
  await until(page, () => game.scene.getScene('world').mapKey === 'main-block-g', 'ground floor');
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, `${engine}-foyer.png`) });
  log('in the foyer');

  const interact = async (maxLines = 30) => {
    await page.keyboard.press('e');
    await until(page, () => game.scene.getScene('ui').dialog.isOpen || game.scene.isActive('box-opening'), 'dialog opens', 6000).catch(() => {});
    for (let i = 0; i < maxLines; i++) {
      if (await active(page, 'box-opening')) return;
      const open = await page.evaluate(() => game.scene.getScene('ui').dialog.isOpen);
      if (!open) return;
      await page.keyboard.press('e'); await sleep(90);
    }
  };
  const npcTile = (id) => page.evaluate((i) => { const n = game.scene.getScene('world').npcs.find((x) => x.def.id === i); return { x: Math.floor(n.x / 16), y: Math.floor(n.y / 16) }; }, id);
  const ksTile = (id) => page.evaluate((i) => { const k = game.scene.getScene('world').keyStations.find((x) => x.def.id === i); return k ? { x: Math.floor(k.x / 16), y: Math.floor(k.y / 16) } : null; }, id);
  const stairs = (name) => page.evaluate((n) => { const o = game.scene.getScene('world').mapObjects.find((x) => x.type === 'stairs' && x.name === n); return o ? { x: Math.floor(o.x), y: Math.floor(o.y) } : null; }, name);
  const stairsGo = async (name, mapName) => {
    const s = await stairs(name); if (!s) throw new Error('no stairs ' + name);
    await tp(s.x, s.y); await sleep(500);
    await until(page, (m) => game.scene.getScene('world').mapKey === m, 'arrive ' + mapName, 15000, mapName);
    await sleep(300);
  };

  // is the foyer reachable by walking? press real keys toward the volunteer a bit (smoke): skip, teleport
  const vol = await npcTile('lug-volunteer');
  await tp(vol.x, vol.y + 1); await sleep(300);
  await interact();
  log('quest stage after volunteer:', await page.evaluate(() => GameState.quest.stage));

  const getKey = async (id) => {
    const t = await ksTile(id);
    await tp(t.x, t.y + 1); await sleep(500);
    for (let i = 0; i < 15 && (await scriptOn2()); i++) { await page.keyboard.press('Escape'); await sleep(400); }
    await tp(t.x, t.y + 1); await sleep(400);
    log('  prompt visible:', await page.evaluate(() => game.scene.getScene('world').prompt.visible));
    await page.keyboard.press('e'); await sleep(700);
    log('  after E at', id, await page.evaluate(() => JSON.stringify({ scenes: game.scene.getScenes(true).map((s) => s.scene.key), dlg: game.scene.getScene('ui').dialog.isOpen, tile: [Math.floor(game.scene.getScene('world').player.x/16), Math.floor(game.scene.getScene('world').player.y/16)], map: game.scene.getScene('world').mapKey })));
    // a mini-game may open: take the skip/win path (the games themselves are covered by minigames.spec)
    for (let i = 0; i < 60; i++) {
      const mg = await page.evaluate(() => { const sc = game.scene.getScenes(true).find((s) => typeof s.win === 'function' && s.scene.key !== 'world'); return sc ? sc.scene.key : null; });
      if (mg) {
        const st = await page.evaluate((k) => game.scene.getScene(k).mgState, mg);
        if (i % 8 === 0) log('  mini-game', mg, 'state', st);
        if (st === 'playing') { await sleep(1200); await page.evaluate((k) => game.scene.getScene(k).win(true), mg); }
        else await page.keyboard.press('Enter');
        await sleep(700); continue;
      }
      const open = await page.evaluate(() => game.scene.getScene('ui').dialog.isOpen);
      if (open) await page.keyboard.press('e');
      const got = await page.evaluate((k) => GameState.quest.keys[k], id === 'icl' ? 'icl' : id);
      if (got) break;
      await sleep(250);
    }
    log('key', id, await page.evaluate((k) => GameState.quest.keys[k], id));
  };
  await stairsGo('Main Block Stairs G (up)', 'main-block-1');
  await getKey('icl'); await getKey('room195');
  await stairsGo('Main Block Stairs 1 (up)', 'main-block-2');
  await stairsGo('Main Block Stairs 2 (up)', 'main-block-3');
  await getKey('physicsLab');
  await stairsGo('Main Block Stairs 3 (down)', 'main-block-2');
  await stairsGo('Main Block Stairs 2 (down)', 'main-block-1');
  await stairsGo('Main Block Stairs 1 (down)', 'main-block-g');
  const v2 = await npcTile('lug-volunteer');
  await tp(v2.x, v2.y + 1); await sleep(300);
  await page.keyboard.press('e');
  await until(page, () => game.scene.isActive('box-opening'), 'box opening', 20000).catch(async () => { for (let i = 0; i < 25 && !(await active(page, 'box-opening')); i++) { await page.keyboard.press('e'); await sleep(120); } });
  await until(page, () => game.scene.isActive('box-opening'), 'box opening (2)', 10000);
  log('box opening; stage', await page.evaluate(() => GameState.quest.stage));
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, `${engine}-box.png`) });
  await until(page, () => game.scene.getScene('box-opening').canSkip, 'box canSkip', 15000);
  await page.keyboard.press('Escape');
  await until(page, () => game.scene.isActive('card'), 'card', 15000);
  log('card up; recipient', await page.evaluate(() => game.scene.getScene('card').config.recipient));
  await sleep(1500);
  await page.keyboard.press('Enter'); await sleep(1500);
  await page.screenshot({ path: path.join(OUT, `${engine}-card.png`) });
  await page.keyboard.press('Escape');
  await until(page, () => game.scene.isActive('credits'), 'credits', 15000);
  await sleep(6000);
  await page.screenshot({ path: path.join(OUT, `${engine}-credits.png`) });
  log('credits phase', await page.evaluate(() => game.scene.getScene('credits').phase));
  await sleep(1500); await page.keyboard.press('Escape');
  await until(page, () => game.scene.getScene('credits').phase === 'end', 'credits end', 8000);
  await sleep(1800); await page.keyboard.press('Escape');
  await until(page, () => game.scene.isActive('title'), 'back to title', 15000);
  log('back at title');

  // saves: the state persists across a reload
  const saved = await page.evaluate(() => { try { return Object.keys(localStorage).filter((k) => /save|quest|pixel/i.test(k)); } catch (e) { return 'localStorage threw ' + e.message; } });
  log('localStorage keys:', JSON.stringify(saved));
  await page.reload();
  await until(page, () => window.game && game.scene.isActive('title'), 'title after reload');
  await page.keyboard.press('Enter'); await sleep(500);
  const ids = await page.evaluate(() => game.scene.getScene('title').menuItems.map((m) => m.id));
  log('menu after reload:', ids.join(','));
  log('external requests:', external.length);
  log('ERRORS:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
  await browser.close();
})().catch((e) => { console.error(`[${engine}] FAILED:`, e.message); console.error('errors so far:', errors); process.exit(1); });
