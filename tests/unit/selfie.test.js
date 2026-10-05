// W6 selfie mode (src/selfie.js, docs/plans/2026-10-04-day3-feedback-and-wow.md): P frames her and the friends near her, flashes, shows a polaroid
// card and downloads a PNG. Without a browser this covers the pure rules (the crop rectangle, the file name, the caption, the layout, the timeline,
// the "may she take one now" gate), the world scene's key handler on a stand-in `this`, and the controller itself run against a fake renderer / UI scene /
// DOM (the one hidden-HUD frame and its restore, the single-shot guard, the teardown, the download fallbacks, no leaks after 20 selfies). How it looks, the
// snapshot timing on a real WebGL and Canvas renderer and Safari's download behaviour need the running game: see the coordinator's checklist.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadGameData, ROOT } = require('../helpers/game-data');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8').replace(/\r\n/g, '\n'); // checkouts on Windows have CRLF
const g = loadGameData();
g.runScript('src/scenes/world.js');
g.runScript('src/scenes/ui.js');
const ev = (name) => g.evaluate(name);
const plain = (v) => JSON.parse(JSON.stringify(v)); // sandbox objects have another realm's prototype

const SELFIE = plain(ev('SELFIE'));
const selfieCrop = ev('selfieCrop');
const selfieFilename = ev('selfieFilename');
const selfieCaption = ev('selfieCaption');
const polaroidLayout = ev('polaroidLayout');
const selfiePlan = ev('selfiePlan');
const selfieAllowed = ev('selfieAllowed');
const selfieEnabled = ev('selfieEnabled');
const createSelfie = ev('createSelfie');
const WorldScene = ev('WorldScene');
const MAPS = ev('MAPS');

const SCREEN = { width: 960, height: 540 };
const view = (x = 0, y = 0, zoom = 3) => ({ x, y, zoom });
const inside = (c, screen) => c.x >= 0 && c.y >= 0 && c.x + c.w <= screen.width && c.y + c.h <= screen.height;
const contains = (c, p) => p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;

// ---------- crop rectangle ----------

test('W6: the crop is a 480x360 (4:3) rectangle centred on her when she is in the middle of the screen', () => {
  const c = plain(selfieCrop({ x: 160, y: 90 }, view(), SCREEN)); // world (160, 90) at 3x = screen (480, 270)
  assert.deepEqual(c, { x: 240, y: 90, w: 480, h: 360 });
});

test('W6: the crop stays inside the screen and keeps her inside it, in every corner and along every edge', () => {
  const spots = [[2, 2], [158, 2], [2, 178], [158, 178], [320, 90], [0, 90], [160, 0], [160, 180], [319, 179], [1, 179]];
  for (const [wx, wy] of spots) {
    const c = plain(selfieCrop({ x: wx, y: wy }, view(), SCREEN));
    assert.equal(c.w, 480);
    assert.equal(c.h, 360);
    assert.ok(inside(c, SCREEN), `(${wx},${wy}) -> ${JSON.stringify(c)} leaves the screen`);
    assert.ok(contains(c, { x: wx * 3, y: wy * 3 }), `(${wx},${wy}) -> ${JSON.stringify(c)} lost her`);
    assert.ok(Number.isInteger(c.x) && Number.isInteger(c.y), 'integer pixels');
  }
  assert.deepEqual(plain(selfieCrop({ x: 5, y: 5 }, view(), SCREEN)), { x: 0, y: 0, w: 480, h: 360 }, 'top-left corner');
  assert.deepEqual(plain(selfieCrop({ x: 315, y: 175 }, view(), SCREEN)), { x: 480, y: 180, w: 480, h: 360 }, 'bottom-right corner');
});

test('W6: she is framed well inside the crop whenever the screen has room (the keep margin)', () => {
  for (let wx = 20; wx <= 300; wx += 40) {
    for (let wy = 20; wy <= 160; wy += 35) {
      const c = plain(selfieCrop({ x: wx, y: wy }, view(), SCREEN, [{ x: wx + 90, y: wy }, { x: wx - 90, y: wy - 20 }]));
      const sx = wx * 3;
      const sy = wy * 3;
      const roomLeft = sx >= SELFIE.keepMarginPx && sx <= SCREEN.width - SELFIE.keepMarginPx;
      const roomTop = sy >= SELFIE.keepMarginPx && sy <= SCREEN.height - SELFIE.keepMarginPx;
      if (roomLeft) assert.ok(sx - c.x >= SELFIE.keepMarginPx && c.x + c.w - sx >= SELFIE.keepMarginPx, `(${wx},${wy}) x margin ${JSON.stringify(c)}`);
      if (roomTop) assert.ok(sy - c.y >= SELFIE.keepMarginPx && c.y + c.h - sy >= SELFIE.keepMarginPx, `(${wx},${wy}) y margin ${JSON.stringify(c)}`);
    }
  }
});

test('W6: friends near her pull the frame towards them; friends too far away or not finite are ignored', () => {
  const alone = plain(selfieCrop({ x: 160, y: 90 }, view(), SCREEN));
  const withFriend = plain(selfieCrop({ x: 160, y: 90 }, view(), SCREEN, [{ x: 220, y: 90 }])); // 60 world px right = 180 screen px
  assert.equal(withFriend.x, alone.x + 90, 'moves half of the way to the friend');
  assert.equal(withFriend.y, alone.y);
  assert.deepEqual(plain(selfieCrop({ x: 160, y: 90 }, view(), SCREEN, [{ x: 160 + SELFIE.friendRangePx + 1, y: 90 }])), alone, 'out of range');
  assert.deepEqual(plain(selfieCrop({ x: 160, y: 90 }, view(), SCREEN, [{ x: NaN, y: 3 }, null, {}])), alone, 'garbage entries are skipped');
  const two = plain(selfieCrop({ x: 160, y: 90 }, view(), SCREEN, [{ x: 220, y: 90 }, { x: 160, y: 130 }]));
  assert.ok(two.x > alone.x && two.y > alone.y, 'the middle of two friends');
});

test('W6: a small screen gets the largest 4:3 rectangle it holds; a tall, narrow one too', () => {
  const small = plain(selfieCrop({ x: 50, y: 50 }, view(0, 0, 3), { width: 320, height: 200 }));
  assert.deepEqual([small.w, small.h], [267, 200]);
  assert.ok(inside(small, { width: 320, height: 200 }));
  const narrow = plain(selfieCrop({ x: 10, y: 10 }, view(), { width: 300, height: 900 }));
  assert.deepEqual([narrow.w, narrow.h], [300, 225]);
  assert.ok(inside(narrow, { width: 300, height: 900 }));
  const tiny = plain(selfieCrop({ x: 1, y: 1 }, view(), { width: 1, height: 1 }));
  assert.ok(tiny.w >= 1 && tiny.h >= 1 && inside(tiny, { width: 1, height: 1 }));
});

test('W6: the crop survives missing or broken input (no player, no view, a zero zoom)', () => {
  for (const args of [[null, view(), SCREEN], [{ x: NaN, y: 1 }, view(), SCREEN], [{ x: 10, y: 10 }, null, SCREEN], [{ x: 10, y: 10 }, view(0, 0, 0), SCREEN], [{ x: 10, y: 10 }, view(), null]]) {
    const c = plain(selfieCrop(...args));
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(c[k]), `${JSON.stringify(args)} -> ${JSON.stringify(c)}`);
    assert.ok(c.w > 0 && c.h > 0 && c.x >= 0 && c.y >= 0);
  }
});

test('W6: the crop follows the camera: the same world spot with a scrolled view lands in the right place', () => {
  const c = plain(selfieCrop({ x: 400, y: 300 }, view(300, 220), SCREEN)); // screen (300, 240)
  assert.deepEqual(c, { x: 60, y: 60, w: 480, h: 360 });
});

// ---------- file name, caption, layout, timeline ----------

test('W6: the file name is selfie-<map>-<n>.png with a safe map slug and a positive whole n', () => {
  assert.equal(selfieFilename('campus', 1), 'selfie-campus-1.png');
  assert.equal(selfieFilename('main-block_1', 3), 'selfie-main-block-1-3.png');
  assert.equal(selfieFilename('  ../Weird Map!! ', 2), 'selfie-weird-map-2.png');
  assert.equal(selfieFilename('', 1), 'selfie-map-1.png');
  assert.equal(selfieFilename(undefined, 1), 'selfie-map-1.png');
  for (const bad of [0, -2, NaN, undefined, 'x']) assert.equal(selfieFilename('campus', bad), 'selfie-campus-1.png');
  assert.equal(selfieFilename('campus', 2.7), 'selfie-campus-2.png');
  for (const key of Object.keys(MAPS)) assert.match(selfieFilename(key, 12), /^selfie-[a-z0-9-]+-12\.png$/, key);
});

test('W6: the caption is "Selfie, <map name>", plain ASCII for the pixel font, and never too long', () => {
  assert.equal(selfieCaption('BITS Dubai Campus'), 'Selfie, BITS Dubai Campus');
  assert.equal(selfieCaption('Main Block · Ground Floor'), 'Selfie, Main Block, Ground Floor');
  assert.equal(selfieCaption('Café'), 'Selfie, Cafe');
  for (const empty of ['', '   ', '·', null, undefined]) assert.equal(selfieCaption(empty), 'Selfie');
  const long = selfieCaption('A very very very long building name that goes on and on');
  assert.ok(long.length <= SELFIE.captionMax && long.endsWith('...'), long);
  for (const def of Object.values(MAPS)) {
    const caption = selfieCaption(def.name);
    assert.match(caption, /^Selfie(, [\x20-\x7E]+)?$/, def.name);
    assert.ok(caption.length <= SELFIE.captionMax, caption);
  }
});

test('W6: the polaroid layout puts the photo in the frame with the caption strip under it', () => {
  const l = plain(polaroidLayout(480, 360));
  assert.deepEqual(l.photo, { x: SELFIE.frameSide, y: SELFIE.frameTop, w: 960, h: 720 });
  assert.equal(l.width, 960 + 2 * SELFIE.frameSide);
  assert.equal(l.height, SELFIE.frameTop + 720 + SELFIE.frameBottom);
  assert.equal(l.captionX, l.width / 2);
  assert.ok(l.captionY > l.photo.y + l.photo.h && l.captionY < l.height, 'the caption sits in the bottom strip');
  const tiny = plain(polaroidLayout(0, 0));
  assert.ok(tiny.photo.w >= 1 && tiny.photo.h >= 1);
});

test('W6: the sequence is never longer than 1.6 s and its failsafe outlives it', () => {
  for (const reduced of [false, true]) {
    const p = plain(selfiePlan(reduced));
    assert.ok(p.totalMs <= 1600 && p.totalMs >= 1200, `${p.totalMs} ms`);
    assert.equal(p.totalMs, p.cardDelayMs + p.cardInMs + p.cardHoldMs + p.cardOutMs);
    assert.ok(p.failsafeMs > p.totalMs);
    assert.ok(p.flashMs <= p.totalMs && p.flashAlpha > 0 && p.flashAlpha <= 1);
  }
  assert.ok(selfiePlan(true).flashAlpha < selfiePlan(false).flashAlpha, 'a gentler flash with reduced motion');
  assert.ok(SELFIE.totalMaxMs <= 1600);
});

// ---------- the gate ----------

const FREE = { enabled: true, sceneActive: true, hasPlayer: true, uiReady: true, transitioning: false, scriptRunning: false, uiBlocking: false, selfieBusy: false, freeSeconds: 5 };

test('W6: selfieAllowed is true only in free control, and silent "no" for everything that owns the screen', () => {
  assert.equal(selfieAllowed(FREE), true);
  for (const [field, value] of [
    ['enabled', false], ['sceneActive', false], ['hasPlayer', false], ['uiReady', false], ['transitioning', true], ['scriptRunning', true],
    ['uiBlocking', true], ['selfieBusy', true], ['freeSeconds', 0], ['freeSeconds', SELFIE.minFreeS - 0.01], ['freeSeconds', NaN], ['freeSeconds', undefined],
  ]) {
    assert.equal(selfieAllowed({ ...FREE, [field]: value }), false, `${field}=${value}`);
  }
  assert.equal(selfieAllowed({ ...FREE, freeSeconds: SELFIE.minFreeS }), true);
  assert.equal(selfieAllowed(null), false);
  assert.equal(selfieAllowed(undefined), false);
  assert.equal(selfieAllowed({}), false);
});

test('W6: ?selfie=0 turns it off, anything else leaves it on', () => {
  assert.equal(selfieEnabled('?selfie=0'), false);
  assert.equal(selfieEnabled('?map=campus&selfie=0&juice=0'), false);
  assert.equal(selfieEnabled('?selfie=1'), true);
  assert.equal(selfieEnabled('?juice=0'), true);
  assert.equal(selfieEnabled(''), true);
  const helpers = read('tests', 'e2e', 'helpers.js');
  assert.equal((helpers.match(/if \(!selfie\) params\.set\('selfie', '0'\)/g) || []).length, 2, 'openGame() and openTitle() both set ?selfie=0 unless a spec opts in');
  assert.match(helpers, /openGame\(page, \{[^}]*selfie = false/);
  assert.match(helpers, /openTitle\(page, \{[^}]*selfie = false/);
});

// The world scene's P handler evaluated for real on a stand-in `this`, with a spy where the selfie would start.
function worldHarness(over = {}) {
  const spy = { takes: 0 };
  const ui = { tutorial: {}, dialog: { isOpen: false }, isBlocking: () => Boolean(over.blocking) };
  const world = {
    sys: { isActive: () => over.active !== false },
    scene: { get: () => ui },
    player: over.noPlayer ? null : { active: true },
    cameras: { main: {} },
    transitioning: Boolean(over.transitioning),
    scriptRunner: { isRunning: Boolean(over.script) },
    freeSeconds: over.freeSeconds ?? 5,
    selfie: { get busy() { return Boolean(over.busy); }, take() { spy.takes += 1; return true; } },
  };
  if (over.noUi) ui.tutorial = null;
  const press = (event = {}) => WorldScene.prototype.onSelfieKey.call(world, { repeat: false, target: null, ...event });
  return { spy, press, world, ui };
}

test('W6: the world scene takes a selfie on P in free control, once per press', () => {
  const h = worldHarness();
  h.press();
  assert.equal(h.spy.takes, 1);
  h.press({ repeat: true });
  assert.equal(h.spy.takes, 1, 'a held key is not a second selfie');
});

test('W6: P is a silent no-op during a dialog/menu, a script or moment, a door walk, a paused scene, a running selfie and just after a screen closed', () => {
  for (const over of [{ blocking: true }, { script: true }, { transitioning: true }, { active: false }, { busy: true }, { freeSeconds: 0.1 }, { noPlayer: true }, { noUi: true }]) {
    const h = worldHarness(over);
    h.press();
    assert.equal(h.spy.takes, 0, JSON.stringify(over));
  }
});

test('W6: typing a "p" into a text field (the dev feedback panel) is not a selfie', () => {
  for (const target of [{ tagName: 'TEXTAREA' }, { tagName: 'INPUT' }, { tagName: 'DIV', isContentEditable: true }]) {
    const h = worldHarness();
    h.press({ target });
    assert.equal(h.spy.takes, 0, JSON.stringify(target));
  }
  const h = worldHarness();
  h.press({ target: { tagName: 'CANVAS' } });
  assert.equal(h.spy.takes, 1, 'the game canvas is fine');
});

// ---------- the controller, run against a fake renderer / UI scene / DOM ----------

function fakeEvents() {
  const listeners = {};
  return {
    on(name, fn) { (listeners[name] ||= []).push({ fn, once: false }); },
    once(name, fn) { (listeners[name] ||= []).push({ fn, once: true }); },
    off(name, fn) { listeners[name] = (listeners[name] || []).filter((l) => l.fn !== fn); },
    emit(name, ...args) {
      for (const l of [...(listeners[name] || [])]) {
        if (l.once) this.off(name, l.fn);
        l.fn(...args);
      }
    },
    count(name) { return (listeners[name] || []).length; },
  };
}

// Everything the controller touches, with counters. `opts.blockClick` makes the download click throw, `opts.noToBlob` removes canvas.toBlob, `opts.silentBlob` makes it never call back.
function rig(opts = {}) {
  const r = { objects: [], destroyed: 0, tweens: [], stoppedTweens: 0, delayed: [], timers: [], clicks: [], toasts: [], snapshots: [], textures: new Set(), canvases: [], added: 0, removed: 0 };
  const chain = (extra) => {
    const o = {
      destroyed: false,
      setOrigin() { return o; }, setDepth() { return o; }, setScrollFactor() { return o; }, setAngle() { return o; }, setScale() { return o; },
      setAlpha() { return o; }, setPosition() { return o; },
      destroy() { if (!o.destroyed) { o.destroyed = true; r.destroyed += 1; } },
      ...extra,
    };
    r.objects.push(o);
    return o;
  };
  const events = fakeEvents();
  const ui = {
    sys: { settings: { visible: true }, setVisible(v) { ui.sys.settings.visible = v; } },
    scale: { width: 960, height: 540 },
    events: fakeEvents(),
    add: { rectangle: (x, y, w, h, color) => chain({ kind: 'rect', color, w, h }), image: (x, y, key) => chain({ kind: 'image', key }) },
    tweens: { add(config) { const t = { config, stopped: false, stop() { if (!t.stopped) { t.stopped = true; r.stoppedTweens += 1; } } }; r.tweens.push(t); return t; } },
    time: { delayedCall(ms, fn) { const d = { ms, fn, removed: false, remove() { d.removed = true; } }; r.delayed.push(d); return d; } },
    textures: {
      exists: (key) => r.textures.has(key),
      addCanvas(key, canvas) { r.textures.add(key); r.added += 1; return { canvas }; },
      remove(key) { r.textures.delete(key); r.removed += 1; },
    },
  };
  const world = {
    scene: { get: () => ui },
    game: { events, renderer: { snapshotArea(x, y, w, h, cb, type) { r.snapshots.push({ x, y, w, h, cb, type }); } } },
    cameras: { main: { worldView: { x: 0, y: 0 }, zoom: 3 } },
    scale: { width: 960, height: 540 },
    player: { x: 160, y: 90, active: true },
    npcs: [{ x: 200, y: 90, active: true }],
    ambientNpcs: [{ sprite: { x: 160, y: 120, active: true, visible: true } }, { sprite: { x: 900, y: 900, active: true, visible: true } }, { sprite: { x: 170, y: 90, active: true, visible: false } }],
    mapKey: 'campus',
    def: { name: 'BITS Dubai Campus' },
  };
  events.on('toast', (message) => r.toasts.push(message));
  // browser globals the drawing half reads
  const makeCanvas = () => {
    const c = {
      width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {}, strokeRect() {}, fillText() {}, measureText: () => ({ width: 100 }) }),
      toDataURL: () => 'data:image/png;base64,AAAA',
    };
    if (!opts.noToBlob) c.toBlob = opts.silentBlob ? () => {} : (cb) => cb({ size: 1 });
    r.canvases.push(c);
    return c;
  };
  const document = {
    createElement(tag) {
      if (tag === 'canvas') return makeCanvas();
      return { tag, style: {}, click() { if (opts.blockClick) throw new Error('downloads are blocked'); r.clicks.push({ href: this.href, download: this.download }); } };
    },
    body: { appendChild() {}, removeChild() {} },
  };
  const set = ev('(function (k, v) { globalThis[k] = v; })');
  set('document', document);
  set('URL', { createObjectURL: () => 'blob:fake', revokeObjectURL: () => { r.revoked = (r.revoked || 0) + 1; } });
  let timerId = 0;
  set('setTimeout', (fn, ms) => { const id = ++timerId; r.timers.push({ id, fn, ms, cleared: false }); return id; });
  set('clearTimeout', (id) => { const t = r.timers.find((x) => x.id === id); if (t) t.cleared = true; });
  r.ui = ui;
  r.world = world;
  r.events = events;
  r.image = { naturalWidth: 480, naturalHeight: 360, width: 480, height: 360 };
  r.pendingTimers = () => r.timers.filter((t) => !t.cleared && t.ms !== SELFIE.revokeMs && t.ms !== SELFIE.saveGiveUpMs);
  // run the sequence's tweens to their ends (the way Phaser would): in-card, then (created by its onComplete) the out tween
  r.finishTweens = () => {
    for (let guard = 0; guard < 20; guard++) {
      const t = r.tweens.find((x) => !x.stopped && !x.done && x.config.onComplete);
      if (!t) return;
      t.done = true;
      t.config.onComplete();
    }
  };
  return r;
}

test('W6: a selfie hides the HUD for exactly one frame, queues one snapshot of the crop, and shows the HUD again on postrender', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  assert.equal(selfie.busy, false);
  assert.equal(selfie.take(), true);
  assert.equal(selfie.busy, true);
  assert.equal(r.ui.sys.settings.visible, false, 'the UI scene is hidden so the HUD is not in the picture');
  assert.equal(r.snapshots.length, 1);
  const s = r.snapshots[0];
  assert.equal(s.type, 'image/png');
  assert.ok(inside({ x: s.x, y: s.y, w: s.w, h: s.h }, SCREEN), JSON.stringify(s));
  assert.equal(s.w * 3, s.h * 4, '4:3');
  assert.equal(r.events.count('postrender'), 1);
  assert.equal(r.objects.length, 0, 'no flash yet: it would be in the picture');
  r.events.emit('postrender');
  assert.equal(r.ui.sys.settings.visible, true, 'the HUD is back');
  assert.equal(r.events.count('postrender'), 0, 'single shot: the listener is gone');
  assert.equal(r.objects.filter((o) => o.kind === 'rect').length, 1, 'the flash starts now');
  selfie.destroy();
});

test('W6: the crop is framed around her and the visible friends near her (not the far one, not the hidden one)', () => {
  const r = rig();
  createSelfie(r.world).take();
  const s = r.snapshots[0];
  const expected = plain(selfieCrop({ x: 160, y: 90 }, view(), SCREEN, [{ x: 200, y: 90 }, { x: 160, y: 120 }]));
  assert.deepEqual({ x: s.x, y: s.y, w: s.w, h: s.h }, expected);
});

test('W6: a second P while one is running is ignored (one snapshot, one listener)', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  assert.equal(selfie.take(), true);
  assert.equal(selfie.take(), false);
  assert.equal(selfie.take(), false);
  assert.equal(r.snapshots.length, 1);
  assert.equal(r.events.count('postrender'), 1);
  r.events.emit('postrender');
  assert.equal(selfie.take(), false, 'still busy during the flash');
  selfie.destroy();
  assert.equal(selfie.busy, false);
  assert.equal(selfie.take(), true, 'free again once it ended');
  selfie.destroy();
});

test('W6: the whole happy path: flash, shutter, preview card, a download named selfie-<map>-<n>.png, "Selfie saved", then everything is gone', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  selfie.take();
  r.events.emit('postrender');
  r.snapshots[0].cb(r.image);
  assert.equal(r.clicks.length, 1, 'one download');
  assert.match(r.clicks[0].download, /^selfie-campus-\d+\.png$/);
  assert.equal(r.clicks[0].href, 'blob:fake');
  assert.deepEqual(r.toasts, ['Selfie saved']);
  assert.ok(r.textures.has(SELFIE.textureKey), 'the preview texture exists while the card is up');
  assert.equal(r.objects.filter((o) => o.kind === 'image').length, 1, 'one card');
  r.finishTweens();
  assert.equal(selfie.busy, false, 'it ended by itself');
  assert.equal(r.textures.size, 0, 'the preview texture is removed');
  assert.ok(r.objects.every((o) => o.destroyed), 'every object it made is destroyed');
  assert.equal(r.ui.sys.settings.visible, true);
  assert.ok(r.canvases.every((c) => c.width === 0 && c.height === 0), 'both canvases released');
  assert.equal(r.pendingTimers().length, 0, 'the wall-clock failsafe timer was cleared');
  assert.equal(r.events.count('postrender'), 0);
});

test('W6: leaving the scene mid-sequence tears everything down: tweens stopped, objects and texture gone, HUD visible, listener off', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  selfie.take();
  r.events.emit('postrender');
  r.snapshots[0].cb(r.image);
  assert.ok(r.tweens.length >= 2 && r.textures.size === 1);
  selfie.destroy(); // WorldScene's shutdown listener
  assert.equal(selfie.busy, false);
  assert.ok(r.tweens.every((t) => t.stopped), 'every tween stopped before its target is destroyed');
  assert.ok(r.objects.every((o) => o.destroyed));
  assert.equal(r.textures.size, 0);
  assert.equal(r.ui.sys.settings.visible, true);
  assert.equal(r.pendingTimers().length, 0);
  selfie.destroy(); // twice is harmless
});

test('W6: leaving the scene in the one frame the HUD is hidden still brings the HUD back, and the late snapshot does nothing', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  selfie.take();
  assert.equal(r.ui.sys.settings.visible, false);
  selfie.destroy();
  assert.equal(r.ui.sys.settings.visible, true, 'restored by the teardown, not only by postrender');
  assert.equal(r.events.count('postrender'), 0, 'the listener is removed');
  r.snapshots[0].cb(r.image); // the renderer answers after the scene was torn down
  assert.equal(r.clicks.length, 0, 'nothing is saved for a selfie that was cancelled');
  assert.deepEqual(r.toasts, []);
  assert.equal(r.textures.size, 0);
});

test('W6: a UI scene that was already hidden stays hidden afterwards (the HUD visibility found is the one restored)', () => {
  const r = rig();
  r.ui.sys.settings.visible = false;
  const selfie = createSelfie(r.world);
  selfie.take();
  r.events.emit('postrender');
  assert.equal(r.ui.sys.settings.visible, false);
  selfie.destroy();
});

test('W6: the scene-clock failsafe and the wall-clock failsafe both end a selfie that never finishes', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  selfie.take(); // the renderer never answers and postrender never comes (a stalled game)
  const plan = plain(selfiePlan());
  assert.ok(r.delayed.some((d) => d.ms === plan.failsafeMs), 'the juiceBag failsafe on the scene clock');
  const wall = r.timers.find((t) => t.ms === plan.failsafeMs + 400);
  assert.ok(wall, 'a wall-clock timer a little after it');
  wall.fn();
  assert.equal(selfie.busy, false);
  assert.equal(r.ui.sys.settings.visible, true);
  assert.equal(r.events.count('postrender'), 0);

  const r2 = rig();
  const s2 = createSelfie(r2.world);
  s2.take();
  r2.delayed.find((d) => d.ms === plain(selfiePlan()).failsafeMs).fn();
  assert.equal(s2.busy, false);
  assert.equal(r2.ui.sys.settings.visible, true);
});

test('W6: a snapshot that comes back empty ends quietly (no card, no toast, HUD back)', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  selfie.take();
  r.events.emit('postrender');
  r.snapshots[0].cb(undefined);
  assert.equal(selfie.busy, false);
  assert.deepEqual(r.toasts, []);
  assert.equal(r.clicks.length, 0);
  assert.equal(r.ui.sys.settings.visible, true);
});

test('W6: blocked downloads do not throw: the preview still shows and the toast says the file could not be saved', () => {
  const r = rig({ blockClick: true });
  const selfie = createSelfie(r.world);
  selfie.take();
  r.events.emit('postrender');
  assert.doesNotThrow(() => r.snapshots[0].cb(r.image));
  assert.deepEqual(r.toasts, ["Selfie taken (couldn't save a file here)"]);
  assert.ok(r.textures.has(SELFIE.textureKey), 'the card is still shown');
  r.finishTweens();
  assert.equal(selfie.busy, false);
});

test('W6: without canvas.toBlob the PNG goes out as a data URL; if the browser refuses everything the fallback toast is used', () => {
  const r = rig({ noToBlob: true });
  const selfie = createSelfie(r.world);
  selfie.take();
  r.events.emit('postrender');
  r.snapshots[0].cb(r.image);
  assert.equal(r.clicks.length, 1);
  assert.match(r.clicks[0].href, /^data:image\/png/);
  assert.deepEqual(r.toasts, ['Selfie saved']);
  selfie.destroy();
});

test('W6: a toBlob that never answers gives up after a few seconds with the fallback toast', () => {
  const r = rig({ silentBlob: true });
  const selfie = createSelfie(r.world);
  selfie.take();
  r.events.emit('postrender');
  r.snapshots[0].cb(r.image);
  assert.deepEqual(r.toasts, [], 'still waiting for the blob');
  const giveUp = r.timers.find((t) => t.ms === SELFIE.saveGiveUpMs && !t.cleared);
  assert.ok(giveUp, 'a give-up timer is running');
  giveUp.fn();
  assert.deepEqual(r.toasts, ["Selfie taken (couldn't save a file here)"]);
  assert.equal(r.clicks.length, 0);
  selfie.destroy();
});

test('W6: 20 selfies in a row leave nothing behind: textures, canvases, objects, tweens, timers and listeners are all released', () => {
  const r = rig();
  const selfie = createSelfie(r.world);
  for (let i = 0; i < 20; i++) {
    assert.equal(selfie.take(), true, `selfie ${i + 1}`);
    r.events.emit('postrender');
    r.snapshots[r.snapshots.length - 1].cb(r.image);
    r.finishTweens();
    assert.equal(selfie.busy, false, `selfie ${i + 1} ended`);
  }
  assert.equal(r.snapshots.length, 20);
  assert.equal(r.clicks.length, 20);
  assert.equal(r.added, 20);
  assert.equal(r.removed, 20, 'every preview texture removed');
  assert.equal(r.textures.size, 0);
  assert.ok(r.objects.every((o) => o.destroyed), `${r.objects.filter((o) => !o.destroyed).length} objects left`);
  assert.ok(r.canvases.every((c) => c.width === 0 && c.height === 0), 'every canvas released');
  assert.equal(r.pendingTimers().length, 0, 'no failsafe timer left running');
  assert.equal(r.events.count('postrender'), 0);
  assert.equal(r.ui.events.count('shutdown'), 0, 'the juiceBag shutdown listeners are all removed');
  const names = r.clicks.map((c) => c.download);
  assert.equal(new Set(names).size, 20, 'twenty different file names');
  r.timers.filter((t) => t.ms === SELFIE.revokeMs).forEach((t) => t.fn());
  assert.equal(r.revoked, 20, 'every blob URL is revoked once its delay has passed');
});

test('W6: a renderer without snapshotArea, or a thrown error, makes take() return false and leaves the HUD on', () => {
  const r = rig();
  delete r.world.game.renderer.snapshotArea;
  assert.equal(createSelfie(r.world).take(), false);
  assert.equal(r.ui.sys.settings.visible, true);
  const r2 = rig();
  r2.world.game.renderer.snapshotArea = () => { throw new Error('webgl context lost'); };
  const s2 = createSelfie(r2.world);
  assert.equal(s2.take(), false);
  assert.equal(s2.busy, false);
  assert.equal(r2.ui.sys.settings.visible, true, 'a failure after the HUD was hidden still restores it');
  assert.equal(r2.events.count('postrender'), 0);
});

// ---------- wiring (source assertions) ----------

test('W6: the key, the controls list and the pause panel know about it', () => {
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /this\.input\.keyboard\.on\('keydown-P', \(event\) => this\.onSelfieKey\(event\)\);/);
  assert.match(world, /this\.events\.once\('shutdown', \(\) => this\.selfie\.destroy\(\)\);/, 'leaving the scene tears the selfie down');
  assert.match(world, /this\.selfie = createSelfie\(this\);/);
  for (const field of ['enabled: selfieEnabled()', 'sceneActive: this.sys.isActive()', 'transitioning: this.transitioning', 'scriptRunning: this.scriptRunner.isRunning', 'uiBlocking:', 'selfieBusy: this.selfie.busy', 'freeSeconds: this.freeSeconds']) {
    assert.ok(world.includes(field), `onSelfieKey passes ${field}`);
  }
  const ui = read('src', 'scenes', 'ui.js');
  assert.match(ui, /\['P', 'Take a selfie'\]/, 'the shared CONTROLS list (the pause menu\'s Controls panel and the title\'s) has the row');
  const CONTROLS = ev('CONTROLS').map((row) => [...row]);
  assert.ok(CONTROLS.some(([key, action]) => key === 'P' && /selfie/i.test(action)));
  assert.equal(new Set(CONTROLS.map(([key]) => key)).size, CONTROLS.length, 'no key listed twice');
  // P conflicts: no other scene file binds the P key
  for (const file of fs.readdirSync(path.join(ROOT, 'src', 'scenes'))) {
    const text = read('src', 'scenes', file);
    if (file === 'world.js') continue;
    assert.ok(!/keydown-P['`]/.test(text) && !/'P'\s*[,\]]/.test(text.replace(/\['P', 'Take a selfie'\]/g, '')), `${file} must not use P`);
  }
  assert.match(read('README.md'), /\| P \| Take a selfie/, 'the README controls table');
});

test('W6: source: the HUD is hidden for one frame and restored in all three places (postrender, teardown, a thrown error path)', () => {
  const src = read('src', 'selfie.js');
  assert.match(src, /ui\.sys\.setVisible\(false\);/);
  assert.match(src, /game\.events\.once\('postrender', postHandler\);/, 'single shot');
  assert.match(src, /postHandler = \(\) => \{ postHandler = null; restoreHud\(\); playFlash\(\); \};/);
  assert.match(src, /const restoreHud = \(\) => \{[\s\S]*?ui\.sys\.setVisible\(hudWas\)/, 'restores the visibility it found, not a hard-coded true');
  assert.match(src, /myBag\.object\(\{\s*destroy: \(\) => \{\s*restoreHud\(\);/, 'the bag teardown restores it too');
  assert.match(src, /catch \(error\) \{\s*api\.destroy\(\);\s*return false;/, 'a throw inside start() tears down');
  assert.ok(src.indexOf('myBag.object({') < src.indexOf('ui.sys.setVisible(false)'), 'the restore is registered before the HUD is hidden');
});

test('W6: source: single-shot guard, try/catch around the download, the wall-clock failsafe and the 20-selfie cleanup', () => {
  const src = read('src', 'selfie.js');
  assert.match(src, /if \(api\.busy\) return false;/, 'a second P is ignored');
  assert.match(src, /get busy\(\) \{ return Boolean\(bag\) && !bag\.done; \}/);
  // download fallback
  assert.match(src, /function saveCanvasPng[\s\S]*?try \{[\s\S]*?\} catch \(error\) \{\s*end\(false\);/);
  assert.match(src, /link\.download = filename;/);
  assert.match(src, /canvas\.toBlob\(/);
  assert.match(src, /URL\.revokeObjectURL\(url\)/, 'the blob URL is released');
  assert.match(src, /Selfie taken \(couldn't save a file here\)/);
  assert.match(src, /'Selfie saved'/);
  assert.match(src, /game\.events\.emit\('toast', saved \? SELFIE_TOAST_SAVED : SELFIE_TOAST_NOT_SAVED\)/, 'the existing toast event');
  // failsafes
  assert.match(src, /juiceBag\(ui, plan\.failsafeMs\)/, 'the scene-clock failsafe');
  assert.match(src, /wallTimer = setTimeout\(\(\) => api\.destroy\(\), plan\.failsafeMs \+ 400\)/, 'the wall-clock failsafe');
  assert.match(src, /clearTimeout\(wallTimer\)/);
  // cleanup
  assert.match(src, /ui\.textures\.remove\(SELFIE\.textureKey\)/);
  assert.match(src, /releaseSelfieCanvas\(small\)/);
  assert.match(src, /releaseSelfieCanvas\(canvas\)/);
  // the picture: the renderer's snapshot, cropped, PNG
  assert.match(src, /renderer\.snapshotArea\(crop\.x, crop\.y, crop\.w, crop\.h, onSnapshot, 'image\/png'\)/);
  assert.match(src, /imageSmoothingEnabled = false/, 'the photo is magnified nearest-neighbour');
});

test('W6: it never freezes her and never reaches for the file system, a server or an ES module (file:// safe)', () => {
  const src = read('src', 'selfie.js');
  for (const bad of [/\bfetch\(/, /XMLHttpRequest/, /\bimport\s+[\w{*]/, /\brequire\(/, /transitioning\s*=/, /haltPlayer/, /input\.enabled/]) assert.ok(!bad.test(src), String(bad));
});

test('W6: index.html loads src/selfie.js after juice.js and audio-independent pure files, before the scenes that call it', () => {
  const html = read('index.html');
  const at = (file) => html.indexOf(`<script src="${file}"></script>`);
  assert.ok(at('src/selfie.js') > at('src/juice.js') && at('src/juice.js') > 0, 'after juice.js (juiceBag)');
  assert.ok(at('src/selfie.js') < at('src/scenes/world.js'), 'before world.js');
  assert.ok(at('src/selfie.js') < at('src/scenes/ui.js'));
  assert.equal((html.match(/src\/selfie\.js/g) || []).length, 1);
  const data = fs.readFileSync(path.join(ROOT, 'tests', 'helpers', 'game-data.js'), 'utf8');
  assert.ok(/'src\/selfie\.js'/.test(data), 'the unit-test sandbox loads it');
});

test('W6: the shutter sound is registered, generated and exists on disk', () => {
  const SOUNDS = ev('SOUNDS');
  assert.ok(SOUNDS.shutter, 'SOUNDS.shutter');
  assert.equal(SOUNDS.shutter.category, 'sfx');
  assert.equal(SOUNDS.shutter.loop, false);
  assert.ok(fs.existsSync(path.join(ROOT, SOUNDS.shutter.file)), SOUNDS.shutter.file);
  assert.match(read('tools', 'make-audio.js'), /to: 'generated\/shutter\.wav', build: synthShutter/);
  assert.ok(fs.statSync(path.join(ROOT, SOUNDS.shutter.file)).size < 100 * 1024, 'small enough for the offline bundle');
  assert.match(read('src', 'selfie.js'), /AudioManager\.play\('shutter'\)/);
});
