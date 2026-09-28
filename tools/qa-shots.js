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

let shotCount = 0;
async function shoot(page, name) {
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file });
  shotCount++;
  log(`saved ${path.relative(ROOT, file)}`);
}

// FB-0023: there's no more blocking "controls card" to dismiss -- the player can move (and be
// teleported around for a screenshot) the instant world/ui are up. Kept as its own function so the
// three call sites below don't need to know that changed.
async function waitReady(page) {
  await page.waitForFunction(() => {
    const world = window.game?.scene.getScene('world');
    const ui = window.game?.scene.getScene('ui');
    return Boolean(world?.player?.active && ui?.tutorial);
  });
}

async function mapObjects(page) {
  return page.evaluate(() => game.scene.getScene('world').mapObjects);
}

async function teleport(page, x, y) {
  await page.evaluate(([tx, ty]) => {
    game.scene.getScene('world').player.body.reset(tx * 16 + 8, ty * 16 + 8);
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
  await page.waitForTimeout(120); // let the camera (snap-follow) and depth settle for one frame
}

// ---------- outdoor points of interest, all taken from campus.json's own objects ----------

async function shootOutdoors(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${BASE_URL}/?dev=0&map=campus&cutscene=0&title=0`);
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
  // Quality loop, category 1 run 1 (2026-09-28): "the Hostel A shot shows no hostel" and "the player
  // isn't visible" in the hostel/parking/track shots -- both had the same cause. `areaCenter()` is the
  // geometric centre of the *whole* Tiled area rectangle; for a hostel that rectangle is the
  // building's own footprint (roof included), so the shot used to teleport both the camera and the
  // player onto the roof itself -- a solid tile, above the depth engine's own "in front of/behind a
  // building" line, so the player's sprite drew *behind* the roof (invisible) and the camera saw
  // nothing but uniform roof texture (unrecognisable as "a building"). Every area-based point below
  // now searches for the nearest real walkable ground tile to its own target first (the same search
  // "just outside a door" already used, generalised to take a plain {x, y} instead of a door object,
  // and a wider search box so a large building/field still finds real ground) -- for a hostel, from a
  // point just south of its own footprint (so the shot reads as "standing in front of the building",
  // the same framing every other BITS building gets), for the sports fields/parking/DIAC park, from
  // their own already-open centre (should already be walkable; this is a safety net against a stray
  // fence/net/stand tile sitting exactly on the centre point).
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
    // neighbouring building's own wall instead of the plaza (QA: this is exactly how the "wrong area
    // name at the Mechanical Block" bug was found and screenshotted).
    mainDoor && { x: mainDoor.x, y: mainDoor.y, oy0: 1, oy1: 6, oxAbs: 4 },
    libraryDoor && { x: libraryDoor.x, y: libraryDoor.y, oy0: 1, oy1: 6, oxAbs: 4 },
    mechDoor && { x: mechDoor.x, y: mechDoor.y, oy0: 1, oy1: 6, oxAbs: 4 },
    // Hostels: search from just south of the building's own footprint (its area rectangle's bottom
    // edge, not its centre -- see the comment above), a wider box since a hostel row can butt up
    // against a neighbour on either side.
    ...hostels.map((h) => ({ x: h.x + h.width / 2, y: h.y + h.height, oy0: 1, oy1: 8, oxAbs: 6 })),
    // Open areas: search outward from their own real centre, small search box (a safety net only).
    track && { ...areaCenter(track), oy0: -3, oy1: 3, oxAbs: 3 },
    tennis && { ...areaCenter(tennis), oy0: -3, oy1: 3, oxAbs: 3 },
    otherCourts && { ...areaCenter(otherCourts), oy0: -3, oy1: 3, oxAbs: 3 },
    parking && { ...areaCenter(parking), oy0: -3, oy1: 3, oxAbs: 3 },
    diacPark && { ...areaCenter(diacPark), oy0: -3, oy1: 3, oxAbs: 3 },
  ]);
  const [mainFront, libraryFront, mechFront, ...rest] = nearestWalkable;
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
  const roadPoints = await page.evaluate(([zone, park]) => {
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
  }, [campusZone, diacPark]);
  if (roadPoints.d54) points.push(['d54', roadPoints.d54]);
  if (roadPoints.ring) points.push(['diac-ring-road', roadPoints.ring]);

  for (const [name, point] of points) {
    if (!point) {
      log(`WARNING: outdoor point "${name}" has no source object/tile on the map, skipped`);
      continue;
    }
    await teleport(page, point.x, point.y);
    await shoot(page, `outdoor-${name}`);
  }

  await page.close();
}

// ---------- indoor: every interior floor, and every named room on it ----------

async function shootIndoors(browser) {
  for (const mapKey of INTERIOR_MAPS) {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`${BASE_URL}/?dev=0&map=${mapKey}&cutscene=0&title=0`);
    await waitReady(page);
    await shoot(page, `indoor-${mapKey}-entrance`);

    const rooms = (await mapObjects(page)).filter((o) => o.type === 'area');
    for (const room of rooms) {
      const x = Math.floor(room.x + room.width / 2);
      const y = Math.floor(room.y + room.height / 2);
      await teleport(page, x, y);
      await shoot(page, `indoor-${mapKey}-${slugify(room.name)}`);
    }
    await page.close();
  }
}

// ---------- the Gate 2 welcome cutscene: image, dialog, control returned; plus the location banner
// and the full-screen map, both P4 UI the QA plan also wants a look at ----------

async function shootCutscene(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  // Cutscenes are on by default; only tests that don't want one pass ?cutscene=0.
  await page.goto(`${BASE_URL}/?dev=0&map=campus&title=0`);
  await waitReady(page);

  // The location banner shows itself on arrival, before the player has moved into the cutscene
  // trigger -- catch that first, separately from the cutscene's own dialog box further down.
  await page.waitForFunction(() => game.scene.getScene('ui').locationBanner.visible);
  await page.waitForTimeout(150); // let its slide-in tween settle
  await shoot(page, 'ui-location-banner');

  // Quality loop, category 1 run 1 (2026-09-28): this used to wait on `game.scene.isActive('cutscene')`
  // -- a separate Phaser scene the old static-illustration cutscene player launched. ADR 0016 replaced
  // that (for the Gate 2 welcome) with an in-world script run by WorldScene's own `scriptRunner`
  // (src/scripts-runtime.js) -- there's no 'cutscene' scene to become active any more, so that wait
  // never resolved and the whole qa-shots run hung/crashed here. Waits on `scriptRunner.isRunning`
  // instead, and every wait below has a timeout and degrades to a warning instead of hanging if
  // something about the new flow's timing doesn't match (already seen this session, ?cutscene=0, a
  // future script rewrite, etc.) -- a missed shot, never a crashed run.
  const trigger = (await mapObjects(page)).find((o) => o.type === 'cutscene');
  if (!trigger) {
    log('WARNING: no cutscene trigger object found on the campus map, skipping the Gate 2 script shots');
  } else {
    await teleport(page, trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
    const started = await page.waitForFunction(() => game.scene.getScene('world').scriptRunner.isRunning, { timeout: 5000 }).then(() => true).catch(() => false);
    if (!started) {
      log('WARNING: the Gate 2 script never started (already seen this session, or ?cutscene=0) -- skipping its shots');
    } else {
      // First frame: letterbox in, Mustafa spawning in and walking up -- give it a moment to settle
      // into a representative frame rather than catching the very first tween tick.
      await page.waitForTimeout(500);
      await shoot(page, 'cutscene-01-script');

      // The message box, mid-typewriter (same dialog box every conversation uses, ADR 0016).
      const gotDialog = await page.waitForFunction(() => game.scene.getScene('ui').dialog.isOpen, { timeout: 8000 }).then(() => true).catch(() => false);
      if (gotDialog) {
        await page.waitForTimeout(300);
        await shoot(page, 'cutscene-02-dialog');
      } else {
        log('WARNING: the Gate 2 script never opened a dialog box in time, skipping cutscene-02-dialog');
      }

      // Advance to the end (Enter both dismisses a dialog line and, per WorldScene's own Esc/Enter
      // handling gated on scriptRunner.isRunning, is safe to press between steps too) and capture
      // control handed back to the world.
      for (let i = 0; i < 30; i++) {
        const running = await page.evaluate(() => game.scene.getScene('world').scriptRunner.isRunning);
        if (!running) break;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }
      const finished = await page.waitForFunction(() => !game.scene.getScene('world').scriptRunner.isRunning, { timeout: 5000 }).then(() => true).catch(() => false);
      if (finished) {
        await page.waitForTimeout(200);
        await shoot(page, 'cutscene-03-control-returned');
      } else {
        log('WARNING: the Gate 2 script never finished in time, skipping cutscene-03-control-returned');
      }
    }
  }

  // The full-screen map (FB-0018, N or the minimap click) while we have a page open on the campus.
  await page.keyboard.press('n');
  await page.waitForFunction(() => game.scene.getScene('ui').fullMap.visible);
  await shoot(page, 'ui-fullscreen-map');

  await page.close();
}

// ---------- title screen, loading screen, pause menu and the controls panel (FB-0023/0024) ----------

async function shootTitleAndPause(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  // Title left on (no ?title=0): this is the one flow that actually wants to see it. The M3a opening
  // (Mustafa's greeting/name entry/customisation/bus arrival, src/scenes/intro-*.js) is its own flow
  // with its own screenshots in tools/qa-shots-intro.js -- skipped here (`intro=0`) so this function's
  // shots (loading screen, pause menu) keep working exactly as before that opening existed.
  await page.goto(`${BASE_URL}/?dev=0&map=campus&intro=0`);
  await page.waitForFunction(() => Boolean(window.game?.scene.getScene('title')?.menuItems));
  await page.waitForTimeout(200); // let the background pan/blink settle into a representative frame
  await shoot(page, 'title-screen'); // intro stage: logo + blinking "PRESS ENTER", no menu yet

  await page.keyboard.press('Enter'); // reveals the menu (never shown together with the prompt)
  await page.waitForFunction(() => game.scene.getScene('title').stage === 'menu');
  await shoot(page, 'title-menu');

  await page.keyboard.press('Enter'); // "Play" is the default highlighted item
  // The branded loading screen (src/main.js BootScene): catch it before the world takes over.
  await page.waitForFunction(() => game.scene.isActive('boot')).catch(() => {});
  await shoot(page, 'loading-screen');
  await waitReady(page);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => game.scene.getScene('ui').pause.visible);
  await shoot(page, 'pause-menu');

  await page.keyboard.press('ArrowDown'); // Resume -> Controls
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => game.scene.getScene('ui').pause.controls.visible);
  await shoot(page, 'pause-controls-panel');

  await page.close();
}

// ---------- mini-games (docs/ROADMAP.md M4): intro, play and game-over/win for each of the 3 ----------
// Launched directly through WorldScene.launchMinigame() (the exact method a key station's dialog
// action reaches in the real game, src/scenes/world.js) rather than walking to a real key station --
// this is a visual pass over the mini-games themselves, not a re-test of the story wiring (that's
// tests/e2e/minigames.spec.js's job). Game-over/win are forced through the scene's own `lose()`/
// `win()` (the same calls real gameplay reaching that outcome would make), the same shortcut that
// spec uses, rather than scripting a full playthrough of each game just for a screenshot.

async function shootMinigames(browser) {
  for (const id of ['platformer', 'flappy', 'tetris']) {
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`${BASE_URL}/?dev=0&map=campus&cutscene=0&title=0&minigames=1`);
    await waitReady(page);

    const sceneKey = await page.evaluate((gameId) => {
      const world = game.scene.getScene('world');
      world.launchMinigame(gameId, () => {});
      return MINIGAMES[gameId].sceneKey;
    }, id);
    await page.waitForFunction((key) => game.scene.isActive(key), sceneKey);
    await page.waitForTimeout(150);
    await shoot(page, `minigame-${id}-01-intro`);

    await page.keyboard.press('Enter'); // START
    await page.waitForFunction((key) => game.scene.getScene(key).mgState === 'playing', sceneKey);
    await page.waitForTimeout(200);
    if (id === 'flappy') {
      // The first server rack spawns just off the right edge and scrolls in at 150px/s -- a couple
      // of steadying flaps and about a second of flight brings it on screen for the shot, instead of
      // catching an empty room a moment after launch.
      for (let i = 0; i < 4; i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(230);
      }
    } else if (id === 'platformer') {
      // Run a step toward the first gap, then jump, so the shot shows her mid-stride/airborne rather
      // than standing still at the spawn point.
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(500);
      await page.keyboard.up('ArrowRight');
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);
    } else {
      await page.keyboard.press('Space');
      await page.waitForTimeout(250);
    }
    await shoot(page, `minigame-${id}-02-play`);

    await page.evaluate((key) => game.scene.getScene(key).lose(), sceneKey);
    await page.waitForFunction((key) => game.scene.getScene(key).mgState === 'gameover', sceneKey);
    await page.waitForTimeout(100);
    await shoot(page, `minigame-${id}-03-gameover`);

    // Force 2 more losses to reach the 3-fail skip offer, its own distinct card.
    for (let i = 0; i < 2; i++) {
      await page.evaluate((key) => {
        const s = game.scene.getScene(key);
        s.beginAttempt();
        s.lose();
      }, sceneKey);
      await page.waitForFunction((key) => game.scene.getScene(key).mgState === 'gameover', sceneKey);
    }
    await page.waitForTimeout(100);
    await shoot(page, `minigame-${id}-04-gameover-skip-offer`);

    await page.evaluate((key) => {
      const s = game.scene.getScene(key);
      s.beginAttempt();
      s.win();
    }, sceneKey);
    await page.waitForFunction((key) => game.scene.getScene(key).mgState === 'win', sceneKey);
    await page.waitForTimeout(100);
    await shoot(page, `minigame-${id}-05-win`);

    await page.close();
  }
}

// ---------- the ending (docs/STORY.md "the box opens...", docs/ROADMAP.md M3): the box-opening
// sequence and the birthday card. Reaches the reward the same shortcut tests/e2e/ending.spec.js
// uses (setting GameState.quest directly and talking to the volunteer) rather than replaying the
// whole 3-key hunt just for a screenshot. ----------

async function shootEnding(browser) {
  const page = await browser.newPage({ viewport: VIEWPORT });
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
  await page.waitForFunction(() => game.scene.getScene('ui').dialog.isOpen);
  for (let i = 0; i < 20 && !(await page.evaluate(() => game.scene.isActive('box-opening'))); i++) {
    await page.keyboard.press('e');
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => game.scene.isActive('box-opening'));

  // Frame 1: the box has just appeared, still closed.
  await page.waitForFunction(() => {
    const s = game.scene.getScene('box-opening');
    return s.box && s.box.alpha >= 1;
  });
  await shoot(page, 'ending-01-box-closed');

  // Frame 2: mid-creak, the lid partway open.
  await page.waitForFunction(() => {
    const s = game.scene.getScene('box-opening');
    return s.lid && s.lid.angle < -8;
  });
  await shoot(page, 'ending-02-box-opening');

  // Frame 3: the light has risen and is filling the screen.
  await page.waitForFunction(() => game.scene.getScene('box-opening').canSkip);
  await page.waitForTimeout(400);
  await shoot(page, 'ending-03-box-light');

  await page.waitForFunction(() => game.scene.isActive('card'), { timeout: 15_000 });
  // Long enough for the cover's own 400ms fade-in (src/scenes/card.js showCover()) to finish, so
  // this shot shows the cover cleanly instead of blended mid-fade with the interior behind it.
  await page.waitForTimeout(500);
  await shoot(page, 'ending-04-card-cover');

  await page.keyboard.press('Enter'); // open the cover
  // Wait for the cover to actually be gone (destroyed by openCover()'s own tween, src/scenes/
  // card.js), not just for the frame to be "visible" -- frameParts are visible from the moment
  // buildInterior() creates them (behind the still-closing cover), so that used to catch this shot
  // mid-transition, with both the cover and the interior on screen at once (a real visual bug the
  // fixes above this comment addressed; this was this script's own timing bug on top of it).
  await page.waitForFunction(() => !game.scene.getScene('card').cover);
  await page.waitForTimeout(200);
  await shoot(page, 'ending-05-card-photo');

  await page.waitForFunction(() => game.scene.getScene('card').dialog.isOpen);
  await page.waitForTimeout(300);
  await shoot(page, 'ending-06-card-message');

  // Skip straight to "THE END" rather than waiting out every message + the (missing, in this
  // checkout) closing video -- this is a visual QA pass, not a timing test.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const s = game.scene.getScene('card');
    return s.ended;
  });
  await page.waitForTimeout(300);
  await shoot(page, 'ending-07-the-end');

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
  try {
    await waitForServer(BASE_URL);
    browser = await chromium.launch();

    await shootOutdoors(browser);
    await shootIndoors(browser);
    await shootCutscene(browser);
    await shootTitleAndPause(browser);
    await shootMinigames(browser);
    await shootEnding(browser);

    log(`done: ${shotCount} screenshots in ${path.relative(ROOT, OUT_DIR)}/`);
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.rmSync(FEEDBACK_DIR, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('[qa-shots] failed:', error);
  process.exitCode = 1;
});
