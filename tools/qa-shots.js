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

// Presses Enter on the intro controls card, which shows once per fresh page load on every map.
async function dismissCard(page) {
  await page.waitForFunction(() => {
    const world = window.game?.scene.getScene('world');
    const ui = window.game?.scene.getScene('ui');
    return Boolean(world?.player?.active && ui?.tutorial);
  });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !game.scene.getScene('ui').tutorial.cardOpen);
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
  await page.goto(`${BASE_URL}/?dev=0&map=campus&cutscene=0`);
  await dismissCard(page);
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
  // "Just outside the door": the nearest walkable tile south of it (never the door's own tile --
  // landing exactly there re-triggers the door's own warp, sending the shot straight back inside),
  // not a fixed offset -- a few real BITS buildings sit only a tile or two apart (ADR 0009), so a
  // fixed +2 can land inside a neighbouring building's own wall instead of the plaza (QA: this is
  // exactly how the "wrong area name at the Mechanical Block" bug was found and screenshotted).
  const front = await page.evaluate((doors) => {
    const world = game.scene.getScene('world');
    const nearestWalkable = (door) => {
      if (!door) return null;
      const dx = Math.floor(door.x);
      const dy = Math.floor(door.y);
      let best = null;
      let bestDist = Infinity;
      for (let oy = 0; oy <= 6; oy++) {
        for (let ox = -4; ox <= 4; ox++) {
          if (ox === 0 && oy === 0) continue; // the door tile itself: skip, it would re-trigger the warp
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
      return best || { x: dx, y: dy + 1 };
    };
    return doors.map(nearestWalkable);
  }, [mainDoor, libraryDoor, mechDoor]);
  const [mainFront, libraryFront, mechFront] = front;
  const track = area('Athletics Track');
  const tennis = area('Tennis Courts');
  const otherCourts = area('Courts');
  const parking = area('Student Parking');
  const diacPark = area('DIAC Park');
  const hostels = objects.filter((o) => o.type === 'area' && o.props.kind === 'hostel');
  const campusZone = area('BITS Pilani, Dubai Campus');

  const points = [
    ['spawn', spawn],
    ['gate-2', gate2],
    ['avenue', gate2 && mainDoor && { x: gate2.x, y: (gate2.y + mainDoor.y) / 2 }],
    ['main-block-front', mainFront],
    ['library-block-front', libraryFront],
    ['mechanical-block-front', mechFront],
    ['athletics-track', track && areaCenter(track)],
    ['tennis-courts', tennis && areaCenter(tennis)],
    ['courts', otherCourts && areaCenter(otherCourts)],
    ['student-parking', parking && areaCenter(parking)],
    ['side-gate', sideGate],
    ['diac-park', diacPark && areaCenter(diacPark)],
    ...hostels.map((h) => [`hostel-${slugify(h.name)}`, areaCenter(h)]),
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
    await page.goto(`${BASE_URL}/?dev=0&map=${mapKey}&cutscene=0`);
    await dismissCard(page);
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
  await page.goto(`${BASE_URL}/?dev=0&map=campus`);
  await dismissCard(page);

  // The location banner shows itself on arrival, before the player has moved into the cutscene
  // trigger -- catch that first, separately from the cutscene's own dialog box further down.
  await page.waitForFunction(() => game.scene.getScene('ui').locationBanner.visible);
  await page.waitForTimeout(150); // let its slide-in tween settle
  await shoot(page, 'ui-location-banner');

  const trigger = (await mapObjects(page)).find((o) => o.type === 'cutscene');
  await teleport(page, trigger.x + trigger.width / 2, trigger.y + trigger.height / 2);
  await page.waitForFunction(() => game.scene.isActive('cutscene'));

  // First frame: the letterbox bars and the gate illustration, before the dialog box appears.
  await page.waitForFunction(() => {
    const cs = game.scene.getScene('cutscene');
    return cs.image.alpha >= 1;
  });
  await shoot(page, 'cutscene-01-image');

  // The message box, mid-typewriter.
  await page.waitForFunction(() => {
    const cs = game.scene.getScene('cutscene');
    return cs.dialog && cs.dialog.isOpen;
  });
  await page.waitForTimeout(300);
  await shoot(page, 'cutscene-02-dialog');

  // Advance to the end and capture control handed back to the world.
  for (let i = 0; i < 20; i++) {
    const active = await page.evaluate(() => game.scene.isActive('cutscene'));
    if (!active) break;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => !game.scene.isActive('cutscene'));
  await page.waitForTimeout(200);
  await shoot(page, 'cutscene-03-control-returned');

  // The full-screen map (FB-0018, N or the minimap click) while we have a page open on the campus.
  await page.keyboard.press('n');
  await page.waitForFunction(() => game.scene.getScene('ui').fullMap.visible);
  await shoot(page, 'ui-fullscreen-map');

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

    await shootOutdoors(browser);
    await shootIndoors(browser);
    await shootCutscene(browser);

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
