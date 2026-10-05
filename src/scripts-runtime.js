// The cutscene script runner (ADR 0016, decisions/0016-cutscenes-play-in-the-game-world.md): a small
// command interpreter that plays a list of steps (src/scripts.js SCRIPTS) *inside* WorldScene -- the
// camera pans across the real map, real characters walk it, the same DialogBox every conversation
// already uses opens over the real backdrop, and control comes back exactly where the scene ends. No
// separate Phaser scene, no cut to a different-looking picture (owner feedback FB-0032).
//
// One instance lives on WorldScene (`this.scriptRunner`, see createPlayer()-adjacent setup in
// world.js). `run(steps)` sets `scene.transitioning = true` for the whole sequence -- the exact same
// flag a door walk-through already uses (world.js update(), ui.js UIScene.worldHasControl()), since a
// script and a door sequence are the same kind of moment: the world keeps rendering and animating, she
// just doesn't have the wheel. `skip()` (WorldScene's own Esc handler, gated on `scriptRunner.isRunning`)
// fast-forwards every currently-*and*-still-to-run step straight to its end state -- actors land where
// they'd have finished walking, the camera lands where it was panning to, a dialog box closes -- never
// a half-finished tween or a cut-off line (docs/plans/2026-09-26-premium-pass.md's own "never soft-lock").
//
// Step shape mirrors src/dialog.js's own action vocabulary (`{ actionName: payload }`, one key per
// step): `{ lockInput: true }`, `{ unlockInput: true }`, `{ letterbox: 'in' | 'out' }`,
// `{ fade: { dir: 'in' | 'out', ms } }`, `{ cameraPan: { to, ms, ease } }`, `{ cameraFollow: actorId }`,
// `{ spawnActor: { id, sprite, at, facing, kind, frame, shadow, feet } }`, `{ despawnActor: actorId }`,
// `{ frame: { actor, frame } }`, `{ anim: { actor, frames, frameMs } }` (the sheet-frame steps, below),
// `{ move: { actor, path, speed, ease } }`, `{ face: { actor, dir } }`, `{ emote: { actor, kind } }`,
// `{ say: { speaker, lines, autoMs? } }`, `{ wait: ms }`, `{ sound: id }`, `{ setFlag: 'name' | { name, value } }`,
// `{ parallel: [step, ...] }`, `{ sequence: [step, ...] }` (several steps as ONE branch of a `parallel`), and the moments' extras
// (src/moments.js, docs/plans/2026-10-04-moments-and-small-touches.md): `{ lift: { actor, to, ms, ease?, fadeOut? } }` (altitude in
// px: the sprite rises, its shadow and depth stay on the ground), `{ sparkles: { actor, ms, every?, kind?: 'dust' } }` (a trail of stars behind an
// actor, or dust puffs at its feet), `{ loop: { actor, frames, frameMs } }` (a frame loop that keeps running in the background until a `frame`/`anim`/
// `despawnActor` stops it), `{ face: { actor, toward } }` (turn toward another actor or point), `autoMs` on a `say` (every line
// advances by itself that many ms after it finished typing, so a moment always ends without a key press). `to`/`at`/a `move` path's points are each either a tile `{ x, y }`, a
// named map-object anchor (a plain string, resolved at runtime by src/maplogic.js resolveAnchor() --
// "spawn", "gate", a door object's own name, an area/zone's own name), or `{ anchor, offset: [dx, dy] }`
// / `{ actor: id, offset: [dx, dy] }` for "a few tiles from X" without hard-coding an absolute campus
// coordinate a later map regeneration could move out from under the script (ADR 0016's own concern).

const ACTOR_FEET_OFFSET = 8; // matches world.js PLAYER_FEET_OFFSET (ADR 0015): actors are the same
// 16x24 character sheets as the player, so the same "body bottom sits 8px below the sprite origin"
// invariant applies to any script actor, not just her.

class ScriptRunner {
  constructor(scene) {
    this.scene = scene;
    this.actors = new Map(); // id -> { sprite, shadow, kind: 'character'|'image', textureKey, facing }
    this.running = false;
    this.skipping = false;
    this.unskippable = false;
    this._skipHooks = new Set();
  }

  get isRunning() {
    return this.running;
  }

  // Runs `steps` to completion (or to skip()'s fast-forwarded end state). Deliberately does NOT tear
  // down leftover actors itself: whether an actor should still be standing there once control returns
  // is content's own call (Mustafa, ADR 0016's own SCRIPTS.opening/gate2, stays -- a decorative presence
  // near the gate; the bus despawns itself, its own last step) -- "run to the end" and "skip straight
  // to the end" have to agree on that same end state either way (never a half state), so the engine
  // can't unilaterally clean up after either path without breaking whichever script meant to keep one.
  // `unskippable` (the moments, src/moments.js): Esc does nothing -- the scene is short and always ends by itself, never a trap.
  async run(steps, { unskippable = false } = {}) {
    this.running = true;
    this.skipping = false;
    this.unskippable = unskippable;
    this.scene.transitioning = true;
    this.hidePrompt(); // no "E" bubble over her head for the whole script (WorldScene.updatePrompt() brings it back on the first free frame)
    try {
      await this.runSteps(steps);
    } finally {
      this.scene.transitioning = false;
      this.running = false;
      this.skipping = false;
      this.unskippable = false;
    }
  }

  // The interact prompt ("E" / "!") belongs to the free-roaming game: WorldScene.update() stops running while a script owns the screen, so a
  // bubble that was showing when the script started would hang over her head for its whole length. Hidden at the start (and again if a
  // script hands control back mid-way, `unlockInput`); there is nothing to restore by hand: updatePrompt() sets its visibility again on
  // every frame she is in control, so it reappears right after the script if something is in reach.
  hidePrompt() {
    const prompt = this.scene.prompt;
    if (prompt && typeof prompt.setVisible === 'function') prompt.setVisible(false);
  }

  async runSteps(steps) {
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop -- steps are meant to run in sequence, not parallel
      await this.runStep(step);
    }
  }

  runStep(step) {
    const type = Object.keys(step)[0];
    const handler = this[`step_${type}`];
    if (!handler) {
      console.warn(`ScriptRunner: unknown step "${type}"`);
      return undefined;
    }
    return handler.call(this, step[type]);
  }

  // Esc, from WorldScene: every step still pending (a single one, or several under a `parallel`)
  // snaps straight to its own end state and resolves; every step still to come (runSteps()'s loop
  // hasn't reached it yet) checks `this.skipping` itself and does the same, with no delay at all.
  skip() {
    if (!this.running || this.skipping || this.unskippable) return;
    this.skipping = true;
    const hooks = [...this._skipHooks];
    this._skipHooks.clear();
    hooks.forEach((fn) => fn());
  }

  // Registers a callback for skip() to fire early; returns an unsubscribe, which a step's own natural
  // completion calls too (so a step that already finished on its own never fires twice).
  onSkip(fn) {
    this._skipHooks.add(fn);
    return () => this._skipHooks.delete(fn);
  }

  // ---------- points: tile coords, a named anchor, or an offset from either (see file header) ----------

  resolvePoint(point) {
    if (point == null) return null;
    if (typeof point === 'string') return resolveAnchor(this.scene.mapObjects, point);
    if (typeof point.x === 'number' && typeof point.y === 'number') return { x: point.x, y: point.y };
    let base = null;
    if (point.anchor) base = resolveAnchor(this.scene.mapObjects, point.anchor);
    else if (point.actor) {
      const actor = this.getActor(point.actor);
      if (actor) base = { x: actor.sprite.x / TILE, y: actor.sprite.y / TILE };
    } else if (point.keyStation) {
      const ks = (this.scene.keyStations || []).find((k) => k.def.id === point.keyStation);
      if (ks) base = { x: ks.x / TILE, y: ks.y / TILE };
    }
    if (!base) return null;
    if (!point.offset) return base;
    return { x: base.x + point.offset[0], y: base.y + point.offset[1] };
  }

  // ---------- actors ----------

  getActor(id) {
    if (id === 'player') return { sprite: this.scene.player, kind: 'player', facing: this.scene.facing };
    return this.actors.get(id) || null;
  }

  // Every real direction a script actor might need to animate, built once per texture the first time
  // any script actually spawns one -- global anim keys are baked to a specific texture's own frames
  // (Phaser AnimationFrame, not re-resolved per sprite), so a second character sheet can't reuse the
  // player's own 'walk-down' etc (see world.js createAnimations()); each texture gets its own
  // '<kind>-<dir>-<textureKey>' set instead. Same frame layout as the player (ADR 0013/FB-0043: 4 rows
  // x 8 columns, tools/make-assets.js buildCharacter()), since every script actor is one of the same
  // recolored character sheets.
  ensureActorAnims(textureKey) {
    if (this.scene.anims.exists(`walk-down-${textureKey}`)) return;
    const walks = { down: [1, 2, 3, 4, 5, 6], up: [9, 10, 11, 12, 13, 14], left: [17, 18, 19, 20, 21, 22], right: [25, 26, 27, 28, 29, 30] };
    const idles = { down: [0, 7], up: [8, 15], left: [16, 23], right: [24, 31] };
    for (const [dir, frames] of Object.entries(walks)) {
      this.scene.anims.create({ key: `walk-${dir}-${textureKey}`, frames: this.scene.anims.generateFrameNumbers(textureKey, { frames }), frameRate: 12, repeat: -1 });
    }
    for (const [dir, frames] of Object.entries(idles)) {
      this.scene.anims.create({ key: `idle-${dir}-${textureKey}`, frames: this.scene.anims.generateFrameNumbers(textureKey, { frames }), frameRate: 2, yoyo: true, repeat: -1 });
    }
  }

  playActorAnim(actorEntry, kind, dir) {
    if (actorEntry.kind === 'image') return; // the bus etc: no walk cycle, nothing to play
    const key = actorEntry.kind === 'player' ? `${kind}-${dir}` : `${kind}-${dir}-${actorEntry.textureKey}`;
    actorEntry.sprite.anims.play(key, true);
  }

  // How far an actor's own "feet" (the ADR 0015 depth-sort line) sit below its sprite's own y --
  // ACTOR_FEET_OFFSET for a 16x24 character sheet (player/NPC-shaped actors), but a plain `image`
  // actor (the bus) can be any size at all, so its real bottom edge (half its own display height)
  // is what has to sort against everything else, not the character constant. Quality loop (Cutscenes
  // run 2, 2026-09-29): using ACTOR_FEET_OFFSET for the bus too was the root cause of "she's invisible
  // after stepping off" -- an 88px-tall image was claiming its feet sat only 8px below its center, so
  // depth-sorted as if it were a normal-sized character standing there, when its own drawn pixels
  // actually reached ~44px in every direction -- comfortably covering anything standing at a depth the
  // formula thought was safely "in front".
  // An image actor may carry its own `feet` (px below its centre where its ground line really is): the
  // RTA bus sprite has a transparent margin under its wheels, so a person stepping out beside its sill
  // has to sort against the wheel line, not the bottom of that margin.
  actorFeetOffset(actorEntry) {
    if (actorEntry.kind !== 'image') return ACTOR_FEET_OFFSET;
    return typeof actorEntry.feet === 'number' ? actorEntry.feet : actorEntry.sprite.displayHeight / 2;
  }

  // Depth-by-feet (ADR 0015) and the ground shadow, kept current every tick a script actor moves --
  // the player's own real shadow (world.js `playerShadow`) is reused for her; every other actor gets
  // its own, created in step_spawnActor.
  syncActorVisuals(actorEntry) {
    const sprite = actorEntry.sprite;
    const feet = this.actorFeetOffset(actorEntry);
    const depth = sprite.y + feet;
    sprite.setDepth(depth);
    if (actorEntry.kind === 'player') {
      this.scene.playerShadow.setPosition(sprite.x, sprite.y + 9).setDepth(depth - 1);
      this.scene.updateHeldItem(this.scene.time.now, true);
    } else if (actorEntry.shadow) {
      actorEntry.shadow.setPosition(sprite.x, sprite.y + feet).setDepth(depth - 1);
    }
  }


  // ---------- step handlers ----------

  step_lockInput() {
    this.scene.transitioning = true;
  }

  // Rare (no script this game ships uses it, but ADR 0016 lists it): temporarily hands control back
  // mid-script. `run()` sets `transitioning` back to true itself once the script actually ends, so a
  // script that never calls this back off is still safe.
  step_unlockInput() {
    this.scene.transitioning = false;
    this.hidePrompt();
  }

  step_letterbox(mode) {
    const letterbox = this.scene.scene.get('ui').letterbox;
    if (this.skipping) { letterbox.snap(mode === 'in'); return undefined; }
    return new Promise((resolve) => {
      const off = this.onSkip(() => { letterbox.snap(mode === 'in'); resolve(); });
      const finish = () => { off(); resolve(); };
      if (mode === 'in') letterbox.playIn(finish);
      else letterbox.playOut(finish);
    });
  }

  step_fade({ dir, ms = 250 } = {}) {
    const cam = this.scene.cameras.main;
    if (this.skipping) { dir === 'in' ? cam.fadeIn(1, 0, 0, 0) : cam.fadeOut(1, 0, 0, 0); return undefined; }
    return new Promise((resolve) => {
      const event = dir === 'in' ? 'camerafadeincomplete' : 'camerafadeoutcomplete';
      // Re-triggering the same fade at ~0ms is the only *public* way to snap it to its end state
      // (Phaser's fade effect has no documented "jump to done" call) -- safe to call again mid-fade,
      // since fadeIn()/fadeOut() just (re)start the same effect.
      const off = this.onSkip(() => { if (dir === 'in') cam.fadeIn(1, 0, 0, 0); else cam.fadeOut(1, 0, 0, 0); resolve(); });
      cam.once(event, () => { off(); resolve(); });
      if (dir === 'in') cam.fadeIn(ms, 0, 0, 0); else cam.fadeOut(ms, 0, 0, 0);
    });
  }

  step_cameraPan({ to, ms = 1200, ease = 'Sine.easeInOut' } = {}) {
    const point = this.resolvePoint(to);
    if (!point) return undefined;
    const cam = this.scene.cameras.main;
    const px = toPixel(point.x);
    const py = toPixel(point.y);
    cam.stopFollow();
    if (this.skipping) { cam.centerOn(px, py); return undefined; }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; cam.centerOn(px, py); off(); resolve(); };
      const off = this.onSkip(finish);
      cam.pan(px, py, ms, ease, false, (camera, progress) => { if (progress >= 1) finish(); });
    });
  }

  step_cameraFollow(actorId) {
    const actor = this.getActor(actorId);
    if (!actor) return;
    this.scene.cameras.main.startFollow(actor.sprite, true, 0.18, 0.18);
  }

  // `kind: 'image'` (the bus): a plain image, no walk cycle -- or one frame of a spritesheet (`frame`, an
  // index; the RTA bus, src/scripts.js RTA_BUS_SHEET), changed later by the `frame` / `anim` steps.
  // `shadow: false` skips the generated ground ellipse (art with its own shadow baked in); `feet` is the
  // px below its centre where its ground line is (default: its bottom edge); `shadowSize: [w, h]` sizes that ellipse.
  // `kind: 'character'` (default): a 16x24 sheet with the usual idle/walk anims (ensureActorAnims()),
  // the same art shape as any NPC.
  step_spawnActor({ id, sprite, at, facing = 'down', kind = 'character', frame, shadow: wantShadow = true, feet, shadowSize } = {}) {
    const point = this.resolvePoint(at);
    if (!point) { console.warn(`ScriptRunner: spawnActor "${id}" -- anchor/point for "at" not found`); return; }
    const px = toPixel(point.x);
    const py = toPixel(point.y);
    if (kind === 'image') {
      const image = this.scene.add.image(px, py, sprite, frame);
      // Quality loop (Cutscenes run 2): the shadow used to be a fixed 60x12 regardless of the actual
      // image's own size -- far wider than the bus itself. Sized to the sprite's own footprint now
      // (+2px, docs/plans own brief), soft and low-alpha like every other ground shadow in this game
      // (world.js playerShadow/createNpcs()), positioned at its own feet (bottom edge), not a guessed
      // offset.
      const feetOffset = typeof feet === 'number' ? feet : image.displayHeight / 2;
      let shadow = null;
      if (wantShadow) {
        // `shadowSize: [w, h]` for a sprite whose body is narrower than its frame (the unicorn's frame has room above it for a rider).
        const shadowW = shadowSize ? shadowSize[0] : image.displayWidth + 2;
        const shadowH = shadowSize ? shadowSize[1] : Math.max(6, image.displayWidth * 0.32);
        shadow = this.scene.add.ellipse(px, py + feetOffset, shadowW, shadowH, 0x000000, 0.22).setDepth(py + feetOffset - 1);
      }
      image.setDepth(py + feetOffset);
      this.actors.set(id, { sprite: image, shadow, kind: 'image', textureKey: sprite, facing, feet });
      return;
    }
    this.ensureActorAnims(sprite);
    const idleFrames = { down: 0, up: 8, left: 16, right: 24 };
    const actorSprite = this.scene.add.sprite(px, py, sprite, idleFrames[facing] ?? 0).setDepth(py + ACTOR_FEET_OFFSET);
    const shadow = this.scene.add.ellipse(px, py + 9, 12, 4, 0x000000, 0.28).setDepth(py + ACTOR_FEET_OFFSET - 1);
    this.actors.set(id, { sprite: actorSprite, shadow, kind: 'character', textureKey: sprite, facing });
  }

  // Stops an actor's background frame loop (`loop` step), if it has one.
  stopLoop(actorEntry) {
    if (actorEntry && actorEntry.loopTimer) { actorEntry.loopTimer.remove(); actorEntry.loopTimer = null; }
  }

  // Shows one frame of a spritesheet actor at once (the bus's brake lights coming on, its driving frame).
  step_frame({ actor: actorId, frame } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry || !actorEntry.sprite.setFrame) return;
    this.stopLoop(actorEntry);
    if (actorEntry.sprite.anims) actorEntry.sprite.anims.stop();
    actorEntry.sprite.setFrame(frame);
  }

  // Loops sheet frames on an actor in the background (a unicorn's grazing head-bob): the step returns at once and the loop runs until
  // a `frame`, `anim` or `despawnActor` step stops it. Starts on the first frame.
  step_loop({ actor: actorId, frames, frameMs = 300 } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry || !actorEntry.sprite.setFrame || !Array.isArray(frames) || frames.length === 0) return;
    this.stopLoop(actorEntry);
    let i = 0;
    actorEntry.sprite.setFrame(frames[0]);
    actorEntry.loopTimer = this.scene.time.addEvent({
      delay: frameMs,
      loop: true,
      callback: () => { i = (i + 1) % frames.length; actorEntry.sprite.setFrame(frames[i]); },
    });
  }

  // Plays a sequence of sheet frames on an actor (the bus's doors): each frame in `frames` is shown for
  // `frameMs`, in order, and the last one stays up when the step ends (so the step lasts frames.length *
  // frameMs). Esc snaps straight to that last frame; a step that starts while skipping does the same.
  step_anim({ actor: actorId, frames, frameMs = 120 } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry || !actorEntry.sprite.setFrame || !Array.isArray(frames) || frames.length === 0) return undefined;
    const sprite = actorEntry.sprite;
    this.stopLoop(actorEntry);
    if (sprite.anims) sprite.anims.stop();
    const last = frames[frames.length - 1];
    if (this.skipping) { sprite.setFrame(last); return undefined; }
    return new Promise((resolve) => {
      let timer = null;
      const off = this.onSkip(() => { if (timer) timer.remove(); sprite.setFrame(last); resolve(); });
      const showFrom = (i) => {
        if (i >= frames.length) { off(); resolve(); return; }
        sprite.setFrame(frames[i]);
        timer = this.scene.time.delayedCall(frameMs, () => showFrom(i + 1));
      };
      showFrom(0);
    });
  }

  step_despawnActor(id) {
    const actor = this.actors.get(id);
    if (!actor) return;
    this.stopLoop(actor);
    actor.sprite.destroy();
    if (actor.shadow) actor.shadow.destroy();
    this.actors.delete(id);
  }

  directionOf(dx, dy) {
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return null; // no real movement -- keep facing
    return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
  }

  tweenActorTo(actorEntry, point, speedTiles, ease) {
    const scene = this.scene;
    const sprite = actorEntry.sprite;
    const isPlayer = actorEntry.kind === 'player';
    const toX = toPixel(point.x);
    const toY = toPixel(point.y);
    const dx = toX - sprite.x;
    const dy = toY - sprite.y;
    const dir = this.directionOf(dx, dy) || actorEntry.facing || 'down';
    actorEntry.facing = dir;
    // The player's own `facing` is tracked on WorldScene itself (movePlayer() sets it every real
    // frame, syncGameState() saves it) -- a script move has to keep that in sync too, or her facing
    // reverts to whatever it was before the script ran the instant a save/reload reads GameState.facing.
    if (isPlayer) scene.facing = dir;
    const distanceTiles = Math.hypot(dx, dy) / TILE;
    const duration = Math.max(60, (distanceTiles / Math.max(0.1, speedTiles)) * 1000);

    if (this.skipping) {
      sprite.x = toX; sprite.y = toY;
      if (isPlayer) scene.player.body.reset(toX, toY);
      this.syncActorVisuals(actorEntry);
      return Promise.resolve();
    }

    this.playActorAnim(actorEntry, 'walk', dir);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        sprite.x = toX; sprite.y = toY;
        if (isPlayer) scene.player.body.reset(toX, toY);
        this.syncActorVisuals(actorEntry);
        this.playActorAnim(actorEntry, 'idle', dir);
        off();
        resolve();
      };
      const off = this.onSkip(() => { scene.tweens.killTweensOf(sprite); finish(); });
      scene.tweens.add({
        targets: sprite,
        x: toX,
        y: toY,
        duration,
        ease,
        onUpdate: () => {
          if (isPlayer) scene.player.body.reset(sprite.x, sprite.y);
          this.syncActorVisuals(actorEntry);
        },
        onComplete: finish,
      });
    });
  }

  async step_move({ actor: actorId, path, speed = 5, ease = 'Linear' } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry) return;
    const points = (path || []).map((p) => this.resolvePoint(p)).filter(Boolean);
    if (!points.length) return;
    for (const point of points) {
      // eslint-disable-next-line no-await-in-loop -- a path's segments are sequential by definition
      await this.tweenActorTo(actorEntry, point, speed, ease);
    }
  }

  step_face({ actor: actorId, dir, toward } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry) return;
    // `toward` (an actor id, or a point): face whichever way that lies from here (a moment cannot know where she is standing).
    if (toward !== undefined) {
      const other = typeof toward === 'string' ? this.getActor(toward) : null;
      const point = other ? null : this.resolvePoint(toward);
      const tx = other ? other.sprite.x : (point ? toPixel(point.x) : null);
      const ty = other ? other.sprite.y : (point ? toPixel(point.y) : null);
      if (tx !== null) dir = this.directionOf(tx - actorEntry.sprite.x, ty - actorEntry.sprite.y) || dir || actorEntry.facing;
    }
    actorEntry.facing = dir;
    if (actorEntry.kind === 'player') this.scene.facing = dir; // see tweenActorTo()'s own comment
    if (actorEntry.kind === 'image') {
      // A top-down `image` actor (the bus, src/scripts.js BUS_STEPS) is drawn nose-up
      // (tools/make-cutscenes.js buildBus()) and deliberately near-symmetric front/back, so facing
      // 'down' (turned around, driving back out) is just a vertical flip -- 'up' (its own drawn
      // orientation) clears it. No rotation for 'left'/'right': nothing in this game drives a script
      // actor sideways today.
      actorEntry.sprite.setFlipY(dir === 'down');
      return;
    }
    const idleFrames = { down: 0, up: 8, left: 16, right: 24 };
    actorEntry.sprite.anims.stop();
    actorEntry.sprite.setFrame(idleFrames[dir] ?? 0);
  }

  // Teleports an actor (including the player) with no animation at all -- used to place her at the
  // bus's own door before "stepping down" is played as a short, real walk (see src/scripts.js
  // BUS_STEPS): unlike `move`, this never tweens, so it's safe to call even while hidden
  // (`setActorVisible`) without a visible jump-cut the instant she's revealed.
  step_placeActor({ actor: actorId, at, facing } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry) return;
    const point = this.resolvePoint(at);
    if (!point) return;
    const px = toPixel(point.x);
    const py = toPixel(point.y);
    actorEntry.sprite.x = px;
    actorEntry.sprite.y = py;
    if (actorEntry.kind === 'player') this.scene.player.body.reset(px, py);
    if (facing) {
      actorEntry.facing = facing;
      if (actorEntry.kind === 'player') this.scene.facing = facing;
      this.playActorAnim(actorEntry, 'idle', facing);
    }
    this.syncActorVisuals(actorEntry);
  }

  // Hides/reveals an actor outright (the player, before she's "stepped off the bus" -- src/scripts.js
  // BUS_STEPS) without despawning it: physics/position bookkeeping keeps happening underneath, only
  // the sprite (and its shadow) stop drawing.
  step_setActorVisible({ actor: actorId, visible } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry) return;
    actorEntry.sprite.setVisible(visible);
    if (actorEntry.kind === 'player') this.scene.playerShadow.setVisible(visible);
    else if (actorEntry.shadow) actorEntry.shadow.setVisible(visible);
  }

  // A small bobbing bubble above the actor's (or key station's) head -- "reuse the prompt sprite
  // style" (docs/plans/2026-09-26-premium-pass.md): a bobbing bubble is that style; the literal prompt
  // texture only has "E"/"!" frames (src/scenes/world.js updatePrompt()), so anything else ('?', '...',
  // and the key-room beat's own 'sparkle') is drawn procedurally here instead of needing a new PNG.
  step_emote({ actor: actorId, kind = '!' } = {}) {
    const actorEntry = this.getActor(actorId) || this.keyStationActor(actorId);
    if (!actorEntry) return undefined;
    const sprite = actorEntry.sprite;
    const scene = this.scene;
    const x = sprite.x;
    const y = sprite.y - (actorEntry.kind === 'keyStation' ? 14 : 22);
    const container = scene.add.container(x, y).setDepth(200000).setScale(0.4);
    if (kind === 'sparkle') {
      const star = scene.add.star(0, 0, 4, 3, 7, COLORS.gold);
      container.add(star);
    } else if (kind === 'heart') {
      // Drawn, not typed: the pixel font has no heart glyph. Two lobes and a point, in the game's pink.
      const heart = scene.add.graphics();
      heart.fillStyle(0xff5f8f, 1).fillCircle(-4, -3, 5).fillCircle(4, -3, 5).fillTriangle(-8.6, 0, 8.6, 0, 0, 10);
      heart.fillStyle(0xffffff, 0.7).fillCircle(-5.5, -4.5, 1.4);
      container.add(heart);
    } else if (kind === 'note') {
      // A music note (the pixel font has no glyph for it): a head, a stem and a flag.
      const note = scene.add.graphics();
      note.fillStyle(0xffffff, 1).fillCircle(-3, 6, 4).fillRect(0, -9, 2.5, 15).fillTriangle(2.5, -9, 9, -4, 2.5, -3);
      note.lineStyle(1, 0x1a1c2c, 1).strokeCircle(-3, 6, 4);
      container.add(note);
    } else {
      const bg = scene.add.graphics();
      bg.fillStyle(0x1a1c2c, 0.85).fillRoundedRect(-12, -10, 24, 20, 4);
      const glyph = scene.add.text(0, 0, kind, { fontFamily: FONT, fontSize: '10px', color: COLORS.text }).setOrigin(0.5);
      container.add([bg, glyph]);
    }
    scene.tweens.add({ targets: container, scale: 1, duration: 180, ease: 'Back.easeOut' });
    const destroy = () => container.destroy();
    if (this.skipping) { destroy(); return undefined; }
    return new Promise((resolve) => {
      const off = this.onSkip(() => { destroy(); resolve(); });
      scene.time.delayedCall(kind === 'sparkle' ? 700 : 900, () => {
        scene.tweens.add({ targets: container, alpha: 0, duration: 200, onComplete: () => { off(); destroy(); resolve(); } });
      });
    });
  }

  // Lets `emote` target a key station (the "the station glints" beat) the same way it targets a real
  // actor, without key stations needing to be actors themselves.
  keyStationActor(id) {
    const ks = (this.scene.keyStations || []).find((k) => k.def.id === id);
    return ks ? { sprite: ks.sprite, kind: 'keyStation' } : null;
  }

  // `{name}` in the speaker or a line becomes the player's name (src/dialog.js renderLine(), "Taru" by default), the same as
  // every other conversation. `autoMs` (the moments, src/moments.js): each line advances by itself that many ms after it
  // finished typing, so the scene always ends without a key press (E/Space/Enter still move it along faster).
  step_say({ speaker, lines, autoMs } = {}) {
    const dialog = this.scene.scene.get('ui').dialog;
    if (this.skipping) { if (dialog.isOpen) dialog.close(); return undefined; }
    const shownSpeaker = speaker ? renderLine(speaker, GameState) : speaker;
    const shownLines = renderLines(lines, GameState);
    return new Promise((resolve) => {
      let timer = null;
      const stopTimer = () => { if (timer) { timer.remove(); timer = null; } };
      const off = this.onSkip(() => { stopTimer(); dialog.close(); });
      dialog.open(shownSpeaker, shownLines, () => { stopTimer(); off(); resolve(); });
      if (typeof autoMs === 'number') {
        const POLL_MS = 100;
        let waited = 0;
        timer = this.scene.time.addEvent({
          delay: POLL_MS,
          loop: true,
          callback: () => {
            if (!dialog.isOpen) return;
            if (dialog.typing || dialog.choices) { waited = 0; return; } // still typing: the reading time starts when it is done
            waited += POLL_MS;
            if (waited >= autoMs) { waited = 0; dialog.advance(); }
          },
        });
      }
    });
  }

  step_wait(ms) {
    if (this.skipping) return undefined;
    return new Promise((resolve) => {
      const timer = this.scene.time.delayedCall(ms, () => { off(); resolve(); });
      const off = this.onSkip(() => { timer.remove(); resolve(); });
    });
  }

  step_sound(id) {
    AudioManager.play(id);
  }

  step_setFlag(value) {
    if (typeof value === 'string') GameState.flags[value] = true;
    else GameState.flags[value.name] = value.value;
    notifyStateChanged();
  }

  step_parallel(steps) {
    return Promise.all((steps || []).map((step) => this.runStep(step)));
  }

  // Several steps run one after another as a single branch (so a `parallel` can hold a short sequence next to a longer step).
  step_sequence(steps) {
    return this.runSteps(steps || []);
  }

  // Altitude: the actor rises to `to` px over `ms` (0 = back on the ground; a jump is two of these). Its `y` -- which depth sorting and
  // the ground shadow are tied to -- never changes: only where the sprite is DRAWN does (its origin moves down, so it is drawn higher),
  // and the shadow stays on the ground, shrinking and fading the higher it goes. `fadeOut` also fades the actor itself over the last
  // part of the climb (it leaves the picture instead of ending hanging in the sky).
  step_lift({ actor: actorId, to = 0, ms = 400, ease = 'Sine.easeInOut', fadeOut = false } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry) return undefined;
    const sprite = actorEntry.sprite;
    if (actorEntry.baseOriginY === undefined) actorEntry.baseOriginY = sprite.originY;
    const shadow = actorEntry.shadow || null;
    if (shadow && actorEntry.shadowAlpha === undefined) actorEntry.shadowAlpha = shadow.alpha;
    const apply = (alt, progress) => {
      actorEntry.alt = alt;
      sprite.setOrigin(sprite.originX, actorEntry.baseOriginY + alt / sprite.height);
      if (shadow) {
        const k = Math.max(0.3, 1 - alt / 140);
        shadow.setScale(k);
        shadow.setAlpha(actorEntry.shadowAlpha * k);
      }
      if (fadeOut) sprite.setAlpha(progress >= 1 ? 0 : 1 - Math.min(1, Math.max(0, (progress - 0.55) / 0.45)));
    };
    if (this.skipping) { apply(to, 1); return undefined; }
    const proxy = { alt: actorEntry.alt || 0 };
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (done) return; done = true; apply(to, 1); off(); resolve(); };
      const off = this.onSkip(() => { this.scene.tweens.killTweensOf(proxy); finish(); });
      this.scene.tweens.add({
        targets: proxy,
        alt: to,
        duration: ms,
        ease,
        onUpdate: (tween) => apply(proxy.alt, tween.progress),
        onComplete: finish,
      });
    });
  }

  // A trail of little stars behind an actor for `ms` (the unicorn's lift-off): one every `every` ms, drawn where the actor is drawn
  // (altitude included), each drifting down and fading out. Purely decoration: nothing waits on them.
  // `kind: 'dust'` (the chariot's wheels): instead a few soft beige puffs at the actor's FEET (its ground line), swelling as they fade.
  step_sparkles({ actor: actorId, ms = 1000, every = 70, kind = 'stars' } = {}) {
    const actorEntry = this.getActor(actorId);
    if (!actorEntry || this.skipping) return undefined;
    const scene = this.scene;
    const colors = [0xffffff, 0xffd23f, 0xff9ccc, 0x9fd3ff, 0xc9a6ff];
    const emit = () => {
      const sprite = actorEntry.sprite;
      if (!sprite.active) return;
      if (kind === 'dust') {
        const feetY = sprite.y + this.actorFeetOffset(actorEntry);
        const shades = [0xe8dcc0, 0xd9c9a8, 0xf3ead6];
        for (let i = 0; i < 2; i++) {
          const x = sprite.x + (Math.random() - 0.5) * 30;
          const y = feetY - 1 - Math.random() * 3;
          const puff = scene.add.ellipse(x, y, 5, 4, shades[Math.floor(Math.random() * shades.length)], 0.7).setDepth(sprite.depth + 2);
          scene.tweens.add({ targets: puff, y: y - 6, alpha: 0, scale: 2.2, duration: 560, onComplete: () => puff.destroy() });
        }
        return;
      }
      const x = sprite.x + (Math.random() - 0.5) * 14;
      const y = sprite.y - (actorEntry.alt || 0) + (Math.random() - 0.5) * 10;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const star = scene.add.star(x, y, 4, 1, 3 + Math.random() * 2, color).setDepth(100000);
      scene.tweens.add({ targets: star, y: y + 12, alpha: 0, scale: 0.3, duration: 520, onComplete: () => star.destroy() });
    };
    return new Promise((resolve) => {
      const timer = scene.time.addEvent({ delay: every, loop: true, callback: emit });
      const end = () => { timer.remove(); off(); resolve(); };
      const off = this.onSkip(end);
      scene.time.delayedCall(ms, end);
    });
  }
}
