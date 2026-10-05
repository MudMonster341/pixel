// Selfie mode (wow idea W6): P frames her and the friends standing near her, flashes, and saves a polaroid-style PNG keepsake (a download, so it
// works from the offline file:// bundle). Plain script, no build step. The first half is PURE (the crop rectangle, the filename, the caption, the
// polaroid layout, the timeline and the "may she take one right now?" rule, all unit-tested in tests/unit/selfie.test.js); the second half draws and
// saves it and touches Phaser / the DOM only when it is CALLED, so loading this file needs nothing. Everything is cosmetic and self-ending: it never
// freezes her, a second P while one is running is ignored, it destroys everything it made (tweens first, the preview texture, the canvases, the blob
// URL) and has a wall-clock failsafe next to the scene-clock one, so a map change mid-sequence can't leave a card or a hidden HUD behind.
// `?selfie=0` (dev and tests: tests/e2e/helpers.js sets it for every spec) turns the key off.
//
// How the picture is taken: the renderer's snapshot (`game.renderer.snapshotArea`, Canvas and WebGL alike) is queued and answered at the end of the
// NEXT rendered frame, after every scene has drawn, so the UI scene's HUD would be in it. The UI scene is therefore hidden (sys.setVisible(false)) for
// exactly that one frame and shown again on the game's `postrender` event, which fires right after the snapshot was taken; the flash starts then.
// The renderer hands back an <img> (async, a PNG data URL) of just the cropped area; it is composed onto a polaroid canvas, 2x, nearest-neighbour.

const SELFIE = {
  cropW: 480, // the photo's source area on the 960x540 screen: 4:3, half the screen wide (a world area of 160x120 px at the camera's 3x zoom)
  cropH: 360,
  photoScale: 2, // the saved photo is the crop magnified this much (nearest-neighbour, so the pixels stay crisp)
  frameSide: 32, // the polaroid's white border, in saved-image pixels
  frameTop: 32,
  frameBottom: 112, // the wide strip the caption sits in
  captionBasePx: 30,
  captionMax: 40, // longest caption text kept (a long map name gets an ellipsis)
  previewW: 200, // the card in the corner, on screen
  previewTexW: 400, // the (smoothed) texture it is drawn from: twice the on-screen width
  previewTilt: -4, // degrees
  previewMargin: 16, // from the screen's left and bottom edge
  friendRangePx: 100, // a friend this close to her (world px) is pulled into the frame
  friendPull: 0.5, // how far the frame's centre moves from her towards the friends' middle (0 = centred on her, 1 = on the friends)
  keepMarginPx: 48, // she is always at least this far inside the crop's edges
  minFreeS: 0.3, // seconds of free control before a selfie is allowed (a scene's 250 ms fade-in is not a moment for one)
  flashMs: 220,
  flashAlpha: 0.85,
  flashAlphaReduced: 0.35, // with the OS asking for reduced motion
  cardDelayMs: 150, // the flash starts, this long after it the card begins to slide up
  cardInMs: 340,
  cardHoldMs: 850,
  cardOutMs: 260,
  totalMaxMs: 1600, // the whole sequence, key to the card's last fade, is never longer than this
  failsafeSlackMs: 800, // on top of that: if anything is still alive by then it is destroyed (scene clock), and 400 ms later again (wall clock)
  flashDepth: 1200, // UI-scene depths: above the HUD (the sparkle is 1000), the card just under the flash
  cardDepth: 1190,
  textureKey: 'selfie-preview',
  saveGiveUpMs: 3000, // canvas.toBlob never answering counts as "couldn't save"
  revokeMs: 12000, // how long the blob URL lives after the click (Safari needs it a while)
};

const SELFIE_TOAST_SAVED = 'Selfie saved';
const SELFIE_TOAST_NOT_SAVED = "Selfie taken (couldn't save a file here)";

// ---------- pure ----------

// `?selfie=0` turns the key off. `search` is injectable, the same pattern as juiceEnabled() in src/juice.js.
function selfieEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('selfie') !== '0';
}

// May she take a selfie right now? Every field is a boolean/number world.js already has: `enabled` (?selfie), `sceneActive` (the world scene is
// running, i.e. no mini-game / cutscene / box opening / finale has it paused or stopped), `hasPlayer`, `uiReady` (the UI scene and its tutorial
// exist), `transitioning` (a door walk, warp, script's input lock), `scriptRunning` (any in-world script: a moment, a key-room beat, the opening),
// `uiBlocking` (a dialog, the full map, the pause menu or the journal is open: UIScene.isBlocking()), `selfieBusy` (one is already running) and
// `freeSeconds` (WorldScene.freeSeconds). The same "something owns the screen" test the moments use; anything missing counts as "no".
function selfieAllowed(state) {
  const s = state || {};
  return Boolean(
    s.enabled && s.sceneActive && s.hasPlayer && s.uiReady
    && !s.transitioning && !s.scriptRunning && !s.uiBlocking && !s.selfieBusy
    && Number.isFinite(s.freeSeconds) && s.freeSeconds >= SELFIE.minFreeS,
  );
}

// The photo's source rectangle on the screen, in canvas pixels: { x, y, w, h } (integers, always inside the screen). `player` and each of `people`
// (the friends and other characters on the map) are WORLD points, `view` is the camera's world view `{ x, y, zoom }` (x, y = camera.worldView's
// top-left), `screen` is `{ width, height }`. The frame is 4:3 (SELFIE.cropW x cropH, or the largest 4:3 rectangle a smaller screen holds), centred
// on her and pulled halfway towards the middle of whoever stands within friendRangePx of her; she stays at least keepMarginPx inside its edges, and
// it is clamped to the screen (a selfie at the edge of the map is framed as far in as the screen allows).
function selfieCrop(player, view, screen, people = []) {
  const sw = Math.max(1, Math.floor(Number(screen && screen.width) || SELFIE.cropW));
  const sh = Math.max(1, Math.floor(Number(screen && screen.height) || SELFIE.cropH));
  let w = Math.min(SELFIE.cropW, sw);
  let h = Math.round((w * SELFIE.cropH) / SELFIE.cropW);
  if (h > sh) { h = sh; w = Math.min(sw, Math.round((h * SELFIE.cropW) / SELFIE.cropH)); }
  const zoom = view && Number.isFinite(view.zoom) && view.zoom > 0 ? view.zoom : 1;
  const vx = view && Number.isFinite(view.x) ? view.x : 0;
  const vy = view && Number.isFinite(view.y) ? view.y : 0;
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const toScreen = (p) => ({ x: (p.x - vx) * zoom, y: (p.y - vy) * zoom });
  const me = finite(player) ? toScreen(player) : { x: sw / 2, y: sh / 2 };
  let cx = me.x;
  let cy = me.y;
  const near = finite(player)
    ? (people || []).filter((p) => finite(p) && Math.hypot(p.x - player.x, p.y - player.y) <= SELFIE.friendRangePx).map(toScreen)
    : [];
  if (near.length) {
    const mx = near.reduce((sum, p) => sum + p.x, 0) / near.length;
    const my = near.reduce((sum, p) => sum + p.y, 0) / near.length;
    cx += (mx - cx) * SELFIE.friendPull;
    cy += (my - cy) * SELFIE.friendPull;
  }
  const keep = Math.min(SELFIE.keepMarginPx, Math.floor(w / 2), Math.floor(h / 2));
  let left = cx - w / 2;
  let top = cy - h / 2;
  left = Math.max(me.x + keep - w, Math.min(me.x - keep, left)); // she stays inside, with a margin
  top = Math.max(me.y + keep - h, Math.min(me.y - keep, top));
  const x = Math.max(0, Math.min(sw - w, Math.round(left)));
  const y = Math.max(0, Math.min(sh - h, Math.round(top)));
  return { x, y, w, h };
}

// The saved file's name: `selfie-<map>-<n>.png`, the map key reduced to lower-case letters, digits and dashes, n a positive whole number.
function selfieFilename(mapKey, n) {
  const slug = String(mapKey ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map';
  const count = Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  return `selfie-${slug}-${count}.png`;
}

// The polaroid's caption: "Selfie, <the map's display name>". The pixel font has no middle dot or accents, so those are folded away
// ("Main Block · Ground Floor" -> "Main Block, Ground Floor"); a name that is missing or empty is just "Selfie"; long names get an ellipsis.
function selfieCaption(mapName) {
  const name = String(mapName ?? '')
    .replace(/\s*[·•|]\s*/g, ', ')
    .normalize('NFKD').replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ').replace(/(,\s*)+/g, ', ').replace(/^[,\s]+|[,\s]+$/g, '');
  if (!name) return 'Selfie';
  const text = `Selfie, ${name}`;
  return text.length > SELFIE.captionMax ? `${text.slice(0, SELFIE.captionMax - 3).replace(/[,\s]+$/, '')}...` : text;
}

// The polaroid canvas for a photo of photoW x photoH source pixels: { width, height, photo: { x, y, w, h }, captionX, captionY, fontPx }.
function polaroidLayout(photoW, photoH) {
  const w = Math.max(1, Math.round(photoW * SELFIE.photoScale));
  const h = Math.max(1, Math.round(photoH * SELFIE.photoScale));
  return {
    width: w + SELFIE.frameSide * 2,
    height: SELFIE.frameTop + h + SELFIE.frameBottom,
    photo: { x: SELFIE.frameSide, y: SELFIE.frameTop, w, h },
    captionX: Math.round((w + SELFIE.frameSide * 2) / 2),
    captionY: SELFIE.frameTop + h + Math.round(SELFIE.frameBottom / 2),
    fontPx: SELFIE.captionBasePx,
  };
}

// The sequence as numbers: the flash, when the card slides up / holds / fades, the total (never above totalMaxMs) and the failsafe lifetime.
function selfiePlan(reducedMotion = false) {
  const hold = Math.max(0, Math.min(SELFIE.cardHoldMs, SELFIE.totalMaxMs - SELFIE.cardDelayMs - SELFIE.cardInMs - SELFIE.cardOutMs));
  const totalMs = Math.min(SELFIE.totalMaxMs, SELFIE.cardDelayMs + SELFIE.cardInMs + hold + SELFIE.cardOutMs);
  return {
    flashMs: SELFIE.flashMs,
    flashAlpha: reducedMotion ? SELFIE.flashAlphaReduced : SELFIE.flashAlpha,
    cardDelayMs: SELFIE.cardDelayMs,
    cardInMs: SELFIE.cardInMs,
    cardHoldMs: hold,
    cardOutMs: SELFIE.cardOutMs,
    totalMs,
    failsafeMs: totalMs + SELFIE.failsafeSlackMs,
  };
}

// ---------- drawing and saving (Phaser and the DOM are read when called) ----------

let selfieCounter = 0; // selfies taken this session: the n of the file name (the browser numbers duplicates itself anyway)

function selfieReducedMotion() {
  try { return typeof window !== 'undefined' && Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (error) { return false; }
}

// Frees a canvas's pixel memory right away (setting its size to 0 drops the backing store; the object itself is then ordinary garbage).
function releaseSelfieCanvas(canvas) {
  try { if (canvas) { canvas.width = 0; canvas.height = 0; } } catch (error) { /* gone */ }
}

// The snapshot <img> on a white polaroid: the photo magnified (nearest-neighbour), the caption in the game's pixel font under it. Returns the canvas.
function composePolaroid(image, caption) {
  const layout = polaroidLayout(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = document.createElement('canvas');
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, image.naturalWidth || image.width, image.naturalHeight || image.height, layout.photo.x, layout.photo.y, layout.photo.w, layout.photo.h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'; // a hairline round the photo, like the inner edge of real film
  ctx.lineWidth = 2;
  ctx.strokeRect(layout.photo.x - 1, layout.photo.y - 1, layout.photo.w + 2, layout.photo.h + 2);
  let px = layout.fontPx;
  const font = (size) => `${size}px "Press Start 2P", monospace`;
  ctx.font = font(px);
  while (px > 12 && ctx.measureText(caption).width > layout.photo.w) { px -= 2; ctx.font = font(px); } // shrinks to fit, never overflows
  ctx.fillStyle = '#2b2d42';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(caption, layout.captionX, layout.captionY);
  return canvas;
}

// Downloads the canvas as a PNG through a hidden <a download> (works from file://, no server). done(true) once the click went through, done(false)
// if anything threw or the blob never came: whether the browser then really writes a file is up to it (Safari may open the image instead).
function saveCanvasPng(canvas, filename, done) {
  let finished = false;
  let giveUp = null;
  const end = (ok) => {
    if (finished) return;
    finished = true;
    if (giveUp) clearTimeout(giveUp);
    try { done(ok); } catch (error) { /* the caller's problem */ }
  };
  const click = (url, revoke) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (revoke) setTimeout(() => { try { URL.revokeObjectURL(url); } catch (error) { /* gone */ } }, SELFIE.revokeMs);
  };
  try {
    giveUp = setTimeout(() => end(false), SELFIE.saveGiveUpMs);
    const viaDataUrl = () => { try { click(canvas.toDataURL('image/png'), false); end(true); } catch (error) { end(false); } };
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (!blob) { viaDataUrl(); return; }
        try { click(URL.createObjectURL(blob), true); end(true); } catch (error) { viaDataUrl(); }
      }, 'image/png');
    } else {
      viaDataUrl();
    }
  } catch (error) {
    end(false);
  }
}

// The controller WorldScene owns (`world.selfie`): take() runs one selfie, destroy() ends whatever is running (scene shutdown), busy says whether one is.
function createSelfie(world) {
  let bag = null;
  let wallTimer = null;
  const api = {
    get busy() { return Boolean(bag) && !bag.done; },
    destroy() {
      const b = bag;
      bag = null;
      if (b) b.destroy();
    },
    take() {
      if (api.busy) return false;
      try {
        return start();
      } catch (error) {
        api.destroy();
        return false;
      }
    },
  };

  function start() {
    const ui = world.scene.get('ui');
    const game = world.game;
    const renderer = game && game.renderer;
    if (!ui || !ui.add || !renderer || typeof renderer.snapshotArea !== 'function') return false;
    const plan = selfiePlan(selfieReducedMotion());
    const cam = world.cameras.main;
    const people = [];
    for (const npc of world.npcs || []) if (npc && npc.active) people.push({ x: npc.x, y: npc.y });
    for (const ambient of world.ambientNpcs || []) if (ambient && ambient.sprite && ambient.sprite.active && ambient.sprite.visible) people.push({ x: ambient.sprite.x, y: ambient.sprite.y });
    const crop = selfieCrop({ x: world.player.x, y: world.player.y }, { x: cam.worldView.x, y: cam.worldView.y, zoom: cam.zoom }, { width: world.scale.width, height: world.scale.height }, people);

    const myBag = juiceBag(ui, plan.failsafeMs);
    bag = myBag;
    const hudWas = ui.sys.settings.visible;
    let hudHidden = false;
    let postHandler = null;
    const restoreHud = () => {
      if (!hudHidden) return;
      hudHidden = false;
      try { ui.sys.setVisible(hudWas); } catch (error) { /* the scene is gone */ }
    };
    wallTimer = setTimeout(() => api.destroy(), plan.failsafeMs + 400); // wall clock: runs even if the scene clock stopped
    // The first thing the bag destroys (on the normal end, on shutdown, on the failsafe): the HUD comes back, the listener and the timer go.
    myBag.object({
      destroy: () => {
        restoreHud();
        if (postHandler) { try { game.events.off('postrender', postHandler); } catch (error) { /* gone */ } postHandler = null; }
        if (wallTimer) { clearTimeout(wallTimer); wallTimer = null; }
      },
    });

    const playFlash = () => {
      if (myBag.done) return;
      const flash = myBag.object(ui.add.rectangle(0, 0, ui.scale.width, ui.scale.height, 0xffffff, plan.flashAlpha).setOrigin(0, 0).setDepth(SELFIE.flashDepth).setScrollFactor(0));
      myBag.tween({ targets: flash, alpha: 0, duration: plan.flashMs, ease: 'Cubic.easeOut', onComplete: () => flash.destroy() });
      AudioManager.play('shutter');
    };

    const showCard = (big) => {
      const tw = SELFIE.previewTexW;
      const th = Math.max(1, Math.round((tw * big.height) / big.width));
      const small = document.createElement('canvas');
      small.width = tw;
      small.height = th;
      const sctx = small.getContext('2d');
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = 'high';
      sctx.drawImage(big, 0, 0, tw, th);
      if (ui.textures.exists(SELFIE.textureKey)) ui.textures.remove(SELFIE.textureKey);
      ui.textures.addCanvas(SELFIE.textureKey, small);
      const scale = SELFIE.previewW / tw;
      const dispH = th * scale;
      const restX = SELFIE.previewMargin + SELFIE.previewW / 2;
      const restY = ui.scale.height - SELFIE.previewMargin - dispH / 2;
      const offY = ui.scale.height + dispH; // below the screen
      const shadow = myBag.object(ui.add.rectangle(restX + 4, offY + 5, SELFIE.previewW, dispH, 0x000000, 0.3).setAngle(SELFIE.previewTilt).setDepth(SELFIE.cardDepth - 1));
      const card = myBag.object(ui.add.image(restX, offY, SELFIE.textureKey).setScale(scale).setAngle(SELFIE.previewTilt).setDepth(SELFIE.cardDepth));
      myBag.object({ destroy: () => { releaseSelfieCanvas(small); if (ui.textures.exists(SELFIE.textureKey)) ui.textures.remove(SELFIE.textureKey); } }); // after the image that uses it
      const proxy = { t: 0 };
      const place = (y, alpha) => { card.setPosition(restX, y).setAlpha(alpha); shadow.setPosition(restX + 4, y + 5).setAlpha(0.3 * alpha); };
      myBag.tween({
        targets: proxy, t: 1, delay: plan.cardDelayMs, duration: plan.cardInMs, ease: 'Back.easeOut',
        onUpdate: () => place(offY + (restY - offY) * proxy.t, 1),
        onComplete: () => {
          if (myBag.done) return;
          const out = { t: 0 };
          myBag.tween({
            targets: out, t: 1, delay: plan.cardHoldMs, duration: plan.cardOutMs, ease: 'Quad.easeIn',
            onUpdate: () => place(restY + 18 * out.t, 1 - out.t),
            onComplete: () => api.destroy(),
          });
        },
      });
    };

    const onSnapshot = (image) => {
      if (myBag.done) return; // the scene ended while the picture was being made: nothing to show, nothing to save
      if (!image) { api.destroy(); return; }
      const n = ++selfieCounter;
      let big = null;
      try {
        big = composePolaroid(image, selfieCaption(world.def && world.def.name));
        showCard(big);
      } catch (error) {
        if (!big) { api.destroy(); return; } // couldn't even draw it: end quietly (the card is decoration, the file is the keepsake)
      }
      const canvas = big;
      saveCanvasPng(canvas, selfieFilename(world.mapKey, n), (saved) => {
        releaseSelfieCanvas(canvas);
        try { game.events.emit('toast', saved ? SELFIE_TOAST_SAVED : SELFIE_TOAST_NOT_SAVED); } catch (error) { /* decoration */ }
      });
    };

    // The one frame without the HUD: queue the snapshot (answered at the end of the next render, every scene drawn), hide the UI scene, and show it
    // again on `postrender` (emitted right after that snapshot was read). The flash starts then, so it is never in the picture either.
    hudHidden = true;
    ui.sys.setVisible(false);
    postHandler = () => { postHandler = null; restoreHud(); playFlash(); };
    game.events.once('postrender', postHandler);
    renderer.snapshotArea(crop.x, crop.y, crop.w, crop.h, onSnapshot, 'image/png');
    return true;
  }

  return api;
}
