#!/usr/bin/env node
// P5 QA visual walkthrough (docs/QA_PLAN.md section 3): starts the game's own server on a scratch
// port with a throwaway feedback folder, teleports around every outdoor point of interest, every
// interior floor and named room, and the Gate 2 cutscene, and saves a screenshot of each to
// qa-shots/ (gitignored) for a human (or the main agent) to look at.
//
// Run: npm run qa:shots
//
// Positions come from the generated maps' own Tiled objects (spawn/gate/door/area), never
// hard-coded tile numbers, so this keeps working across campus/interior regenerations.
//
// Quality loop, category 1 run 2 (2026-09-28): every step below used to be one long, ungated
// Playwright chain -- a single stuck `waitForFunction` (no explicit timeout, so Playwright's own
// 30s default) threw and killed the *entire* run, including every shot after it (this is exactly
// how a stuck Gate 2 script step silently ate the title/pause/mini-game/ending shots). Every risky
// action below now goes through `tryStep()`: its own bounded timeout, a warning logged on failure,
// and (where a bad step could leave the page in a broken state) a reload back to that flow's own
// known-good URL before moving on -- one bad shot never takes down the rest. `main()` still wraps
// each of the six flows in its own try/catch too, belt and suspenders. The run always finishes with
// a captured/skipped summary and exits 0 unless the server itself never came up.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'qa-shots');
const PORT = 8097;
const FEEDBACK_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-quest-qa-shots-'));
const BASE_URL = `http://127.0.0.1:${PORT}`;
const VIEWPORT = { width: 960, height: 540 };

const INTERIOR_MAPS = [
  'main-block-g', 'main-block-1', 'main-block-2', 'main-block-3',
  'library-block-g', 'library-block-1',
  'mechanical-block-g', 'mechanical-block-1',
];

function log(msg) {
  console.log(`[qa-shots] ${msg}`);
}

const SUMMARY = { captured: [], skipped: [] };
function warn(label, reason) {
  const line = reason ? `${label} -- ${reason}` : label;
  log(`WARNING: ${line}`);
  SUMMARY.skipped.push(line);
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

// A slug safe to use in a filename, from a Tiled object's own name.
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function shoot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  SUMMARY.captured.push(name);
  log(`saved ${path.relative(ROOT, file)}`);
}

// Runs `fn`; on any rejection (including a `page.waitForFunction` timeout), logs a warning instead
// of throwing, so the caller's loop/sequence keeps going. If `resetUrl` is given, also reloads the
// page back to that known-good URL (and waits for the world to be ready again) so the *next* step
// doesn't inherit whatever broke this one.
async function tryStep(page, label, fn, { resetUrl } = {}) {
  try {
    await fn();
    return true;
  } catch (err) {
    warn(label, err && err.message ? err.message.split('\n')[0] : String(err));
    if (resetUrl) {
      try {
        await page.goto(resetUrl);
        await waitReady(page);
      } catch (resetErr) {
        warn(`${label} (page reset)`, resetErr && resetErr.message ? resetErr.message.split('\n')[0] : String(resetErr));
      }
    }
    return false;
  }
}

// `page.waitForFunction` with an explicit, short-by-default timeout -- every wait in this file used
// to either have no timeout (Playwright's own default of 30s) or one large enough that a single
// stuck wait could stall the run for a long time before finally throwing.
function waitFor(page, fn, { timeout = 8000, arg } = {}) {
  return page.waitForFunction(fn, arg, { timeout });
}

// FB-0023: there's no more blocking "controls card" to dismiss -- the player can move (and be
// teleported around for a screenshot) the instant world/ui are up. Kept as its own function so the
// call sites below don't need to know that changed.
async function waitReady(page) {
  await waitFor(page, () => {
    const world = window.game?.scene.getScene('world');
    const ui = window.game?.scene.getScene('ui');
    return Boolean(world?.player?.active && ui?.tutorial);
  }, { timeout: 15000 });
}

async function mapObjects(page) {
  return page.evaluate(() => game.scene.getScene('world').mapObjects);
}

async function teleport(page, x, y) {
  await page.evaluate(([tx, ty]) => {
    const world = game.scene.getScene('world');
    const p = world.player;
    const px = tx * 16 + 8;
    const py = ty * 16 + 8;
    p.body.reset(px, py);
    p.x = px;
    p.y = py;
    p.setVisible(true);
    p.setAlpha(1);
    if (world.playerShadow) world.playerShadow.setVisible(true).setPosition(px, py + 9);
    // Quality loop, category 1 run 2 (2026-09-28): found by running this tool with a diagnostic
    // dump -- the player was never actually invisible (visible/alpha/active all read true); the
    // *camera* was just still centred on wherever the previous teleport left it, hundreds of world
    // units short of catching up. World.js's own camera follow is a real lerp now (ADR 0015,
    // `startFollow(player, true, 0.18, 0.18)`, "a real lerp, not the instant snap"), which reads
    // fine for ordinary walking but can't close a hundreds-of-tile teleport jump in any reasonable
    // number of frames -- exactly the gap a screenshot tool's instant hops keep making. `centerOn`
    // snaps the camera to her new position directly; the lerp then has nothing left to close.
    world.cameras.main.centerOn(px, py);
    // Hide the location banner for these shots: it's a real per-map/per-area feature (its own
    // dedicated ui-location-banner.png shot below shows it), but here it would just show whatever
    // name was current when the *previous* teleport landed (these are instant hops, not a walk),
    // which reads as a wrong-name bug on this screenshot without being one in the actual game.
    // Its slide in/out is a running tween, which keeps driving `container.y` every frame -- so it
    // has to be killed first, or it fights (and usually wins over) a plain property assignment.
    const ui = game.scene.getScene('ui');
    const banner = ui.locationBanner;
    ui.tweens.killTweensOf(banner.container);
    if (banner.hideTimer) banner.hideTimer.remove();
    banner.visible = false;
    banner.container.y = banner.hiddenY;
  }, [x, y]);
  await page.waitForTimeout(150); // let depth/animation settle for a few frames
}

// ---------- outdoor points of interest, all taken from campus.json's own objects ----------

async function shootOutdoors(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  const baseUrl = `${BASE_URL}/?dev=0&map=campus&cutscene=0&title=0`;
  await page.goto(baseUrl);
  await waitReady(page);
  const objects = await mapObjects(page);

  const find = (type, matcher) => objects.find((o) => o.type === type && matcher(o));
  const area = (name) => find('area', (o) => o.name === name);
  const areaCenter = (o) => ({ x: Math.floor(o.x + o.width / 2), y: Math.floor(o.y + o.height / 2) });

  const spawn = objects.find((o) => o.type === 'spawn');
  const gate2 = find('gate', (o) => /Gate 2/.test(o.name));
  const sideGate = find('gate', (o) => o.name === 'Side Gate');
  const mainDoor = find('door', (o) => o.props.building === 'Main Block');
  const libraryDoor = find('door', (o) => o.props.building === 'Library Block');
  const mechDoor = find('door', (o) => o.props.building === 'Mechanical Block');
  const track = area('Athletics Track');
  const tennis = area('Tennis Courts');
  const otherCourts = area('Courts');
  const parking = area('Student Parking');
  const diacPark = area('DIAC Park');
  const hostels = objects.filter((o) => o.type === 'area' && o.props.kind === 'hostel');
  const campusZone = area('BITS Pilani, Dubai Campus');
  // Every area-based point below searches for the nearest real walkable ground tile to its own
  // target first (never the raw Tiled-object centre, which for a hostel is the building's own roof
  // footprint -- see the hostel-facade unit test in tests/unit/campus-layout.test.js for why that
  // matters and what it checks).
  const nearestWalkable = await page.evaluate((targets) => {
    const world = game.scene.getScene('world');
    return targets.map((t) => {
      if (!t) return null;
      const dx = Math.floor(t.x);
      const dy = Math.floor(t.y);
      let best = null;
      let bestDist = Infinity;
      for (let oy = t.oy0; oy <= t.oy1; oy++) {
        for (let ox = -t.oxAbs; ox <= t.oxAbs; ox++) {
          const x = dx + ox;
          const y = dy + oy;
          if (!isWalkableTile(world.tileData, world.tileInfo, x, y)) continue;
          // Quality loop, category 1 run 2 (2026-09-28): found by running this tool -- a walkable
          // tile can still have an overhead tile directly over it (a tree canopy, a lamp's own
          // top-of-pole piece), which always draws above the player *unconditionally* (the overhead
          // layer's own fixed depth, src/maplogic.js gridFromTiled's comment) regardless of her real
          // y -- so a shot that lands her exactly there hides her completely, not just "behind" in a
          // 3/4-view sense. Skip those candidates entirely rather than just preferring against them.
          if (world.overheadLayer && world.overheadLayer.getTileAt(x, y)) continue;
          const dist = ox * ox + oy * oy;
          if (dist < bestDist) {
            bestDist = dist;
            best = { x, y };
          }
        }
      }
      return best || { x: dx, y: dy + t.oy0 };
    });
  }, [
    // "Just outside the door": south of it, never the door's own tile (landing exactly there
    // re-triggers the door's own warp, sending the shot straight back inside) -- a few real BITS
    // buildings sit only a tile or two apart (ADR 0009), so a fixed offset can land inside a
    // neighbouring building's own wall instead of the plaza.
    libraryDoor && { x: libraryDoor.x, y: libraryDoor.y, oy0: 1, oy1: 6, oxAbs: 4 },
    mechDoor && { x: mechDoor.x, y: mechDoor.y, oy0: 1, oy1: 6, oxAbs: 4 },
    // Quality loop, category 1 run 2 (2026-09-28): "the Main Block front QA shot should frame the
    // whole entrance -- teleport her onto the forecourt a few tiles south of the steps", not just
    // outside the door. Checked the real generated ground directly for this: in this campus, the
    // loop road's own kerb starts immediately at doorY+4 -- the "forecourt" the brief assumes is
    // ~0 tiles deep here (the same documented gate-to-core corridor trade-off MEMORY.md already
    // covers for the Main Block's own steps/forecourt sizing), so "a few tiles south of the steps"
    // isn't reachable without standing in the road. Landing on the steps' own bottom tread (oy 2-3,
    // still walkable, still clearly "in front of the door") is the closest available compromise --
    // centres the shot low enough to show the steps and door, trading a sliver of roofline.
    mainDoor && { x: mainDoor.x, y: mainDoor.y, oy0: 2, oy1: 3, oxAbs: 5 },
    // Hostels: search from just south of the building's own footprint (its area rectangle's bottom
    // edge, not its centre), a wider box since a hostel row can butt up against a neighbour either
    // side.
    // Quality loop, category 1 run 2 (2026-09-28): "the Hostel A shot is a striped sports field
    // with no hostel and no visible player" -- investigated directly against the generated
    // campus.json (not a guess): the hostel building itself IS drawn (confirmed by the new unit
    // test below), and the old oy0:1 search found a real walkable tile, but the nearest one is
    // typically a narrow walkway spur wedged between two closely-packed hostels (FB-0021: hostels
    // sit in a tight row) -- right at that seam, both the building-cluster framing and the player's
    // own visibility broke down. Searching further out (oy0:6) instead lands on the open lawn south
    // of the row, comfortably clear of any building edge, with the hostel still visible in frame to
    // the north.
    ...hostels.map((h) => ({ x: h.x + h.width / 2, y: h.y + h.height, oy0: 6, oy1: 11, oxAbs: 6 })),
    // Open areas: search outward from their own real centre, small search box (a safety net only).
    track && { ...areaCenter(track), oy0: -3, oy1: 3, oxAbs: 3 },
    tennis && { ...areaCenter(tennis), oy0: -3, oy1: 3, oxAbs: 3 },
    otherCourts && { ...areaCenter(otherCourts), oy0: -3, oy1: 3, oxAbs: 3 },
    parking && { ...areaCenter(parking), oy0: -3, oy1: 3, oxAbs: 3 },
    diacPark && { ...areaCenter(diacPark), oy0: -3, oy1: 3, oxAbs: 3 },
  ]);
  const [libraryFront, mechFront, mainFront, ...rest] = nearestWalkable;
  const hostelPoints = rest.slice(0, hostels.length);
  const [trackPoint, tennisPoint, courtsPoint, parkingPoint, diacParkPoint] = rest.slice(hostels.length);

  const points = [
    ['spawn', spawn],
    ['gate-2', gate2],
    ['avenue', gate2 && mainDoor && { x: gate2.x, y: (gate2.y + mainDoor.y) / 2 }],
    ['main-block-front', mainFront],
    ['library-block-front', libraryFront],
    ['mechanical-block-front', mechFront],
    ['athletics-track', trackPoint],
    ['tennis-courts', tennisPoint],
    ['courts', courtsPoint],
    ['student-parking', parkingPoint],
    ['side-gate', sideGate],
    ['diac-park', diacParkPoint],
    ...hostels.map((h, i) => [`hostel-${slugify(h.name)}`, hostelPoints[i]]),
  ];

  // D54 and the DIAC ring have no named Tiled object (they're drawn tiles only, ADR 0009) --
  // located from the map's own generated ground layer instead of a hand-picked constant: the
  // northernmost asphalt found above the campus fence (D54) and an asphalt tile just outside DIAC
  // Park's own area object (the ring/roundabout that wraps around it).
  const roadPoints = await tryStep(page, 'd54/diac-ring-road lookup', async () =>
    page.evaluate(([zone, park]) => {
      const world = game.scene.getScene('world');
      const W = world.map.width;
      const H = world.map.height;
      const groundLayer = world.map.getLayer('ground').data;
      const nameAt = (x, y) => {
        const tile = groundLayer[y]?.[x];
        return tile && tile.index > 0 ? world.tileInfo.tiles[tile.index - 1].name : null;
      };
      const isAsphalt = (x, y) => x >= 0 && y >= 0 && x < W && y < H && nameAt(x, y) === 'asphalt';
      const result = {};
      if (zone) {
        let best = null;
        for (let y = 0; y < Math.floor(zone.y); y++) {
          for (let x = 0; x < W; x++) {
            if (isAsphalt(x, y) && (!best || y < best.y)) best = { x, y };
          }
        }
        result.d54 = best;
      }
      if (park) {
        const x0 = Math.floor(park.x);
        const y0 = Math.floor(park.y);
        const x1 = Math.ceil(park.x + park.width);
        const y1 = Math.ceil(park.y + park.height);
        let best = null;
        for (let y = y0 - 15; y <= y1 + 15; y++) {
          for (let x = x0 - 15; x <= x1 + 15; x++) {
            const outsidePark = x < x0 || x >= x1 || y < y0 || y >= y1;
            if (outsidePark && isAsphalt(x, y)) { best = { x, y }; break; }
          }
          if (best) break;
        }
        result.ring = best;
      }
      return result;
    }, [campusZone, diacPark]),
  ) || {};
  if (roadPoints.d54) points.push(['d54', roadPoints.d54]);
  if (roadPoints.ring) points.push(['diac-ring-road', roadPoints.ring]);

  for (const [name, point] of points) {
    if (!point) {
      warn(`outdoor point "${name}"`, 'no source object/tile on the map');
      continue;
    }
    await tryStep(page, `outdoor-${name}`, async () => {
      await teleport(page, point.x, point.y);
      await shoot(page, `outdoor-${name}`);
    }, { resetUrl: baseUrl });
  }

  await page.close();
}

// ---------- indoor: every interior floor, and every named room on it ----------

async function shootIndoors(browser) {
  for (const mapKey of INTERIOR_MAPS) {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const baseUrl = `${BASE_URL}/?dev=0&map=${mapKey}&cutscene=0&title=0`;
    const loaded = await tryStep(page, `indoor-${mapKey}-entrance`, async () => {
      await page.goto(baseUrl);
      await waitReady(page);
      await shoot(page, `indoor-${mapKey}-entrance`);
    });

    if (loaded) {
      const rooms = (await mapObjects(page)).filter((o) => o.type === 'area');
      for (const room of rooms) {
        const x = Math.floor(room.x + room.width / 2);
        const y = Math.floor(room.y + room.height / 2);
        await tryStep(page, `indoor-${mapKey}-${slugify(room.name)}`, async () => {
          await teleport(page, x, y);
          await shoot(page, `indoor-${mapKey}-${slugify(room.name)}`);
        }, { resetUrl: baseUrl });
      }
    }
    await page.close();
  }
}

// ---------- the Gate 2 welcome script: image, dialog, control returned; plus the location banner
// and the full-screen map, both P4 UI the QA plan also wants a look at ----------

async function shootCutscene(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  // Scripts are on by default; only tests that don't want one pass ?cutscene=0.
  const baseUrl = `${BASE_URL}/?dev=0&map=campus&title=0`;
  await page.goto(baseUrl);
  await waitReady(page);

  // The location banner shows itself on arrival, before the player has moved into the script
  // trigger -- catch that first, separately from the script's own dialog box further down.
  await tryStep(page, 'ui-location-banner', async () => {
    await waitFor(page, () => game.scene.getScene('ui').locationBanner.visible, { timeout: 8000 });
    await page.waitForTimeout(150); // let its slide-in tween settle
    await shoot(page, 'ui-location-banner');
  }, { resetUrl: baseUrl });

  // ADR 0016: the Gate 2 welcome is an in-world script run by WorldScene's own `scriptRunner`
  // (src/scripts-runtime.js), not a separate Phaser scene -- every wait below is on
  // `scriptRunner.isRunning`, each with its own bounded timeout.
  const trigger = (await mapObjects(page)).find((o) => o.type === 'cutscene');
  if (!trigger) {
    warn('Gate 2 script shots', 'no cutscene trigger object found on the campus map');
  } else {
    const started = await tryStep(page, 'cutscene-01-script', async () => {
      await teleport(page, trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
      await waitFor(page, () => game.scene.getScene('world').scriptRunner.isRunning, { timeout: 5000 });
      // Letterbox in, Mustafa spawning in and walking up -- give it a moment to settle into a
      // representative frame rather than catching the very first tween tick.
      await page.waitForTimeout(500);
      await shoot(page, 'cutscene-01-script');
    }, { resetUrl: baseUrl });

    if (started) {
      await tryStep(page, 'cutscene-02-dialog', async () => {
        await waitFor(page, () => game.scene.getScene('ui').dialog.isOpen, { timeout: 8000 });
        await page.waitForTimeout(300);
        await shoot(page, 'cutscene-02-dialog');
      });

      // Quality loop, category 1 run 2 (2026-09-28): "make the Gate 2 step reliable -- skip the
      // script with Esc (the runner's fast-forward) or wait on scriptRunner.isRunning === false with
      // a longer timeout". Tries advancing normally first (Enter, up to 30 short taps); if the
      // script is still running after that, Escape triggers WorldScene's own skip()
      // (scriptRunner.skip(), gated on scriptRunner.isRunning, src/scenes/world.js), which lands
      // every remaining step at its own end state synchronously instead of needing more waiting.
      await tryStep(page, 'cutscene-03-control-returned', async () => {
        for (let i = 0; i < 30; i++) {
          const running = await page.evaluate(() => game.scene.getScene('world').scriptRunner.isRunning);
          if (!running) break;
          await page.keyboard.press('Enter');
          await page.waitForTimeout(150);
        }
        const stillRunning = await page.evaluate(() => game.scene.getScene('world').scriptRunner.isRunning);
        if (stillRunning) await page.keyboard.press('Escape');
        await waitFor(page, () => !game.scene.getScene('world').scriptRunner.isRunning, { timeout: 10000 });
        await page.waitForTimeout(200);
        await shoot(page, 'cutscene-03-control-returned');
      }, { resetUrl: baseUrl });
    }
  }

  // The full-screen map (FB-0018, N or the minimap click) while we have a page open on the campus.
  await tryStep(page, 'ui-fullscreen-map', async () => {
    await page.keyboard.press('n');
    await waitFor(page, () => game.scene.getScene('ui').fullMap.visible, { timeout: 5000 });
    await shoot(page, 'ui-fullscreen-map');
  }, { resetUrl: baseUrl });

  await page.close();
}

// ---------- title screen, loading screen, pause menu and the controls panel (FB-0023/0024) ----------

async function shootTitleAndPause(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  // Title left on (no ?title=0): this is the one flow that actually wants to see it. The M3a opening
  // (Mustafa's greeting/name entry/customisation/bus arrival, src/scenes/intro-*.js) is its own flow
  // with its own screenshots in tools/qa-shots-intro.js -- skipped here (`intro=0`) so this function's
  // shots (loading screen, pause menu) keep working exactly as before that opening existed.
  const baseUrl = `${BASE_URL}/?dev=0&map=campus&intro=0`;
  await page.goto(baseUrl);

  const gotTitle = await tryStep(page, 'title-screen', async () => {
    await waitFor(page, () => Boolean(window.game?.scene.getScene('title')?.menuItems), { timeout: 10000 });
    await page.waitForTimeout(200); // let the background pan/blink settle into a representative frame
    await shoot(page, 'title-screen'); // intro stage: logo + blinking "PRESS ENTER", no menu yet
  }, { resetUrl: baseUrl });
  if (!gotTitle) { await page.close(); return; }

  const gotMenu = await tryStep(page, 'title-menu', async () => {
    await page.keyboard.press('Enter'); // reveals the menu (never shown together with the prompt)
    await waitFor(page, () => game.scene.getScene('title').stage === 'menu', { timeout: 5000 });
    await shoot(page, 'title-menu');
  }, { resetUrl: baseUrl });
  if (!gotMenu) { await page.close(); return; }

  const gotWorld = await tryStep(page, 'loading-screen', async () => {
    await page.keyboard.press('Enter'); // "Play" is the default highlighted item
    // The branded loading screen (src/main.js BootScene): catch it before the world takes over.
    await waitFor(page, () => game.scene.isActive('boot'), { timeout: 3000 }).catch(() => {});
    await shoot(page, 'loading-screen');
    await waitReady(page);
  }, { resetUrl: baseUrl });
  if (!gotWorld) { await page.close(); return; }

  const gotPause = await tryStep(page, 'pause-menu', async () => {
    await page.keyboard.press('Escape');
    await waitFor(page, () => game.scene.getScene('ui').pause.visible, { timeout: 5000 });
    await shoot(page, 'pause-menu');
  });
  if (gotPause) {
    await tryStep(page, 'pause-controls-panel', async () => {
      await page.keyboard.press('ArrowDown'); // Resume -> Controls
      await page.keyboard.press('Enter');
      await waitFor(page, () => game.scene.getScene('ui').pause.controls.visible, { timeout: 5000 });
      await shoot(page, 'pause-controls-panel');
    });
  }

  await page.close();
}

// ---------- mini-games (docs/ROADMAP.md M4): intro, play and game-over/win for each of the 3 ----------
// Launched directly through WorldScene.launchMinigame() (the exact method a key station's dialog
// action reaches in the real game, src/scenes/world.js) rather than walking to a real key station --
// this is a visual pass over the mini-games themselves, not a re-test of the story wiring (that's
// tests/e2e/minigames.spec.js's job). Game-over/win are forced through the scene's own `lose()`/
// `win()` (the same calls real gameplay reaching that outcome would make), the same shortcut that
// spec uses, rather than scripting a full playthrough of each game just for a screenshot.

// Quality loop, category 7 run 1: this used to lose all 5 shots for every one of the 3 games, every
// run -- FB-0042 (src/minigames/framework-scene.js) added a 350ms guard (CARD_INPUT_DELAY_MS) where
// a card silently drops ENTER/SPACE (MinigameCard.confirm() no-ops while `acceptInput` is false), and
// this flow used to fire a bare `page.keyboard.press('Enter')` only 150ms after the intro card
// appeared -- comfortably inside that guard, so START was lost for good (a keydown, never re-sent,
// unlike a real player who'd just press it again) and the very next wait (for mgState to reach
// 'playing') burned its full 5s timeout and took the other 4 shots down with it (tryStep's own
// per-game try/catch). Waiting on `card.acceptInput` itself (real state, the same flag the game's
// own confirm() gates on) instead of guessing past it with a fixed sleep removes the race entirely.
async function waitCardAcceptsInput(page, sceneKey) {
  await waitFor(page, (key) => Boolean(game.scene.getScene(key).card && game.scene.getScene(key).card.acceptInput),
    { arg: sceneKey, timeout: 3000 });
}

async function shootMinigames(browser) {
  for (const id of ['platformer', 'flappy', 'tetris']) {
    const page = await browser.newPage({ viewport: VIEWPORT });
    // One tryStep per game: the 5 shots inside are a tight dependent chain (each depends on the
    // scene state the previous one left behind), so a failure partway skips the rest of *this*
    // game's shots but still moves on to the next game.
    await tryStep(page, `minigame-${id}`, async () => {
      await page.goto(`${BASE_URL}/?dev=0&map=campus&cutscene=0&title=0&minigames=1`);
      await waitReady(page);

      const sceneKey = await page.evaluate((gameId) => {
        const world = game.scene.getScene('world');
        world.launchMinigame(gameId, () => {});
        return MINIGAMES[gameId].sceneKey;
      }, id);
      await waitFor(page, (key) => game.scene.isActive(key), { arg: sceneKey, timeout: 5000 });
      // FB-0042's card ignores ENTER/SPACE for CARD_INPUT_DELAY_MS (350ms) after it appears (mashing
      // Space to launch the mini-game used to carry straight through into an instant "START") -- wait
      // for the intro card's own `acceptInput` flag instead of a guessed fixed delay, so this doesn't
      // race that gate (a fixed 150ms here used to lose the Enter press below more often than not,
      // leaving mgState stuck on 'intro' and every later shot in this game skipped).
      await waitFor(page, (key) => game.scene.getScene(key).card && game.scene.getScene(key).card.acceptInput, { arg: sceneKey, timeout: 5000 });
      await shoot(page, `minigame-${id}-01-intro`);

      await waitCardAcceptsInput(page, sceneKey);
      await page.keyboard.press('Enter'); // START
      await waitFor(page, (key) => game.scene.getScene(key).mgState === 'playing', { arg: sceneKey, timeout: 5000 });
      await page.waitForTimeout(200);
      if (id === 'flappy') {
        // FB-0042: she now hovers (no gravity/scrolling/collision, framework "get ready" beat) until
        // the first real flap -- `flying` flips true synchronously inside flap(), so waiting on it
        // confirms the very first Space actually registered before spending real time on the rest of
        // the steadying flaps, rather than assuming it landed. The first server rack spawns just off
        // the right edge and scrolls in at 150px/s -- a few more flaps and about a second of flight
        // brings it on screen for the shot, instead of catching an empty room right after liftoff.
        await page.keyboard.press('Space');
        await waitFor(page, (key) => game.scene.getScene(key).flying === true, { arg: sceneKey, timeout: 2000 });
        for (let i = 0; i < 3; i++) {
          await page.waitForTimeout(230);
          await page.keyboard.press('Space');
        }
      } else if (id === 'platformer') {
        // The level is 3x-scaled (PF_LEVEL_WIDTH 1602, PF_PLATFORMS in src/minigames/platformer.js; the
        // hero draws at HERO_SCALE 3x too), so running from the spawn point for a fraction of a second
        // only ever reached the first platform (x 0-270), nowhere near "mid-level" -- and scripting
        // real jumps timed against the actual gaps (platformer-physics.js coyote-time/jump-buffer
        // rules) risks dropping her into a pit and losing the attempt before the shot, for no visual
        // benefit over the same shortcut this file already uses for game-over/win: real engine state
        // (the same reset() her own startAttempt() uses), not a scripted playthrough. Places her
        // standing on the middle of the 4th platform (PF_PLATFORMS[3], x 819-1011 -- 3x-scale
        // coordinates; the old x:820 put her on this platform's very left edge, half over the pit),
        // one pixel above its top surface so she settles without a landing squash, and puts the
        // camera on her (clamped to the level) with ArrowRight held through it so she reads as
        // running along the bench -- ~21px in the 150ms below, well inside the platform's own
        // 819-1011 span (hero body 42px wide, so x stays in 936 +/- 21). The platform's own coin
        // (PF_COINS[3], x 915) is in her path, so the score HUD shows a real pickup too.
        await page.keyboard.down('ArrowRight');
        await page.evaluate((key) => {
          const s = game.scene.getScene(key);
          const platform = PF_PLATFORMS[3];
          const x = platform.x + platform.w / 2;
          const y = platform.y - 34; // body is 66px tall: centre 33px above the surface, +1px to settle
          s.player.setPosition(x, y);
          s.player.body.reset(x, y);
          s.cameras.main.scrollX = Math.max(0, Math.min(x - GAME_WIDTH / 2, PF_LEVEL_WIDTH - GAME_WIDTH));
        }, sceneKey);
        await page.waitForTimeout(150); // let playUpdate() apply this frame's anim/hero-sprite sync
        await page.keyboard.up('ArrowRight');
      } else {
        // Tetris never bound SPACE to anything (rotate is UP/W, drop is DOWN/S) -- the old
        // `keyboard.press('Space')` here did nothing at all, leaving the shot barely different from
        // the empty board just after launch. Drop a few pieces for real, through the same engine
        // functions playUpdate() itself calls every tick (movePiece/lockAndContinue), the same
        // shortcut already used below to force game-over/win, instead of holding Down and waiting out
        // the real fall timer (700ms/row at level 1) just for a screenshot.
        await page.evaluate((key) => {
          const s = game.scene.getScene(key);
          for (let n = 0; n < 3; n++) {
            let moved = movePiece(s.board, s.piece, 0, 1);
            while (moved !== s.piece) { s.piece = moved; moved = movePiece(s.board, s.piece, 0, 1); }
            s.lockAndContinue();
          }
        }, sceneKey);
        await page.waitForTimeout(150); // let the lock-flash/redraw settle before the shot
      }
      await shoot(page, `minigame-${id}-02-play`);

      await page.evaluate((key) => game.scene.getScene(key).lose(), sceneKey);
      await waitFor(page, (key) => game.scene.getScene(key).mgState === 'gameover', { arg: sceneKey, timeout: 5000 });
      await page.waitForTimeout(100);
      await shoot(page, `minigame-${id}-03-gameover`);

      // Force 2 more losses to reach the 3-fail skip offer, its own distinct card. Driven straight
      // through beginAttempt()/lose() (not a real Retry keypress), so the card's own acceptInput guard
      // never enters into it here.
      for (let i = 0; i < 2; i++) {
        await page.evaluate((key) => {
          const s = game.scene.getScene(key);
          s.beginAttempt();
          s.lose();
        }, sceneKey);
        await waitFor(page, (key) => game.scene.getScene(key).mgState === 'gameover', { arg: sceneKey, timeout: 5000 });
      }
      await page.waitForTimeout(100);
      await shoot(page, `minigame-${id}-04-gameover-skip-offer`);

      await page.evaluate((key) => {
        const s = game.scene.getScene(key);
        s.beginAttempt();
        s.win();
      }, sceneKey);
      await waitFor(page, (key) => game.scene.getScene(key).mgState === 'win', { arg: sceneKey, timeout: 5000 });
      await page.waitForTimeout(100);
      await shoot(page, `minigame-${id}-05-win`);
    });
    await page.close();
  }
}

// ---------- the ending (docs/STORY.md "the box opens...", docs/ROADMAP.md M3): the box-opening
// sequence and the birthday card. Reaches the reward the same shortcut tests/e2e/ending.spec.js
// uses (setting GameState.quest directly and talking to the volunteer) rather than replaying the
// whole 3-key hunt just for a screenshot. ----------

async function shootEnding(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  // One tryStep for the whole sequence: it's a single tight dependent chain end to end (box -> card
  // cover -> card photo -> card message -> the end), so there's little to salvage from a partial
  // run, but a failure here still can't take down any *other* flow (main()'s own per-flow catch).
  await tryStep(page, 'ending sequence', async () => {
    await page.goto(`${BASE_URL}/?dev=0&map=main-block-g&cutscene=0&title=0`);
    await waitReady(page);
    await page.evaluate(() => {
      GameState.playerName = 'Zara';
      GameState.quest.stage = 'hunting';
      GameState.quest.keys = { physicsLab: true, icvl: true, room195: true };
    });

    const volunteer = await page.evaluate(() => {
      const npc = game.scene.getScene('world').npcs.find((n) => n.def.id === 'lug-volunteer');
      return { x: Math.floor(npc.x / 16), y: Math.floor(npc.y / 16) };
    });
    await teleport(page, volunteer.x, volunteer.y + 1);
    await page.keyboard.press('e');
    await waitFor(page, () => game.scene.getScene('ui').dialog.isOpen, { timeout: 5000 });
    for (let i = 0; i < 20 && !(await page.evaluate(() => game.scene.isActive('box-opening'))); i++) {
      await page.keyboard.press('e');
      await page.waitForTimeout(120);
    }
    await waitFor(page, () => game.scene.isActive('box-opening'), { timeout: 5000 });

    // Frame 1: the box has just appeared, still closed.
    await waitFor(page, () => {
      const s = game.scene.getScene('box-opening');
      return s.box && s.box.alpha >= 1;
    }, { timeout: 5000 });
    await shoot(page, 'ending-01-box-closed');

    // Frame 2: mid-creak, the lid partway open.
    await waitFor(page, () => {
      const s = game.scene.getScene('box-opening');
      return s.lid && s.lid.angle < -8;
    }, { timeout: 5000 });
    await shoot(page, 'ending-02-box-opening');

    // Frame 3: the light has risen and is filling the screen.
    await waitFor(page, () => game.scene.getScene('box-opening').canSkip, { timeout: 5000 });
    await page.waitForTimeout(400);
    await shoot(page, 'ending-03-box-light');

    await waitFor(page, () => game.scene.isActive('card'), { timeout: 15000 });
    // Long enough for the cover's own 400ms fade-in (src/scenes/card.js showCover()) to finish, so
    // this shot shows the cover cleanly instead of blended mid-fade with the interior behind it.
    await page.waitForTimeout(500);
    await shoot(page, 'ending-04-card-cover');

    await page.keyboard.press('Enter'); // open the cover
    // Wait for the cover to actually be gone (destroyed by openCover()'s own tween, src/scenes/
    // card.js), not just for the frame to be "visible" -- frameParts are visible from the moment
    // buildInterior() creates them (behind the still-closing cover).
    await waitFor(page, () => !game.scene.getScene('card').cover, { timeout: 5000 });
    await page.waitForTimeout(200);
    await shoot(page, 'ending-05-card-photo');

    await waitFor(page, () => game.scene.getScene('card').dialog.isOpen, { timeout: 5000 });
    await page.waitForTimeout(300);
    await shoot(page, 'ending-06-card-message');

    // Skip straight to "THE END" rather than waiting out every message + the (missing, in this
    // checkout) closing video -- this is a visual QA pass, not a timing test.
    await page.keyboard.press('Escape');
    await waitFor(page, () => {
      const s = game.scene.getScene('card');
      return s.ended;
    }, { timeout: 5000 });
    await page.waitForTimeout(300);
    await shoot(page, 'ending-07-the-end');
  });
  await page.close();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // { recursive: true } so a leftover qa-shots/intro/ (tools/qa-shots-intro.js's own output
  // directory, nested inside this same gitignored qa-shots/ folder) doesn't crash this cleanup --
  // this script never writes there itself, but doesn't need to preserve it across a run either.
  for (const file of fs.readdirSync(OUT_DIR)) fs.rmSync(path.join(OUT_DIR, file), { recursive: true, force: true });

  log(`starting server.js on port ${PORT} (feedback dir: ${FEEDBACK_DIR})`);
  const server = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), FEEDBACK_DIR },
    stdio: 'ignore',
  });
  let browser;
  let serverFailed = false;
  try {
    try {
      await waitForServer(BASE_URL);
    } catch (err) {
      serverFailed = true;
      throw err;
    }
    browser = await chromium.launch();

    // Each flow owns its own page(s) and (via tryStep, throughout) shouldn't let one bad
    // wait/teleport/screenshot take the rest of itself down -- this outer try/catch is belt and
    // suspenders for a failure tryStep didn't anticipate (e.g. browser.newPage() itself throwing),
    // so the flows after it still run either way.
    const flows = [
      ['outdoor points', shootOutdoors],
      ['indoor floors/rooms', shootIndoors],
      ['Gate 2 script + UI', shootCutscene],
      ['title/pause/menus', shootTitleAndPause],
      ['mini-games', shootMinigames],
      ['ending sequence', shootEnding],
    ];
    for (const [label, fn] of flows) {
      try {
        await fn(browser);
      } catch (err) {
        warn(`${label} (whole flow)`, err && err.message ? err.message.split('\n')[0] : String(err));
      }
    }
  } catch (err) {
    if (!serverFailed) warn('run', err && err.message ? err.message.split('\n')[0] : String(err));
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.rmSync(FEEDBACK_DIR, { recursive: true, force: true });
  }

  log(`done: ${SUMMARY.captured.length} captured, ${SUMMARY.skipped.length} skipped`);
  if (SUMMARY.skipped.length) {
    log('skipped:');
    for (const s of SUMMARY.skipped) log(`  - ${s}`);
  }
  if (serverFailed) {
    log('FATAL: the server itself never came up -- see the warning above.');
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[qa-shots] failed:', error);
  process.exitCode = 1;
});
