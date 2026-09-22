// The world scene: the current map, the player, NPCs and items on the ground.
// Moving to another map restarts this scene with new data; GameState keeps what persists.

const WALK_SPEED = 80; // pixels per second
const RUN_SPEED = 140; // pixels per second, holding Shift outdoors (FB-0017)
const RUN_ANIM_SCALE = RUN_SPEED / WALK_SPEED; // walk animation plays faster while running
// Depth for the "overhead" Tiled layer (tree canopies, ADR 0008): always above every character,
// whose depth is set to their own y each frame (a few thousand px at most on the biggest map).
const OVERHEAD_DEPTH = 1_000_000;
const INTERACT_RANGE = 24;
const PICKUP_RANGE = 10;
const DOOR_ASSIST_RANGE = 12; // how far off-center you can walk at a door and still slide in
// Frame layout (ADR 0013): 3 rows (down/up/left; right = mirrored left) x 8 columns (idle, 6 walk
// frames, 1 idle-anim frame) -- see tools/make-assets.js CHAR_COLS/buildCharacter. Frame index =
// row * 8 + column, so each direction's idle frame is a multiple of 8.
const CHAR_COLS = 8;
const PLAYER_IDLE = { down: 0, up: CHAR_COLS, left: 2 * CHAR_COLS, right: 2 * CHAR_COLS };
// Legacy 3-frame sheet (Tomas/Guide's 'npc' texture, unchanged hand-drawn art, no walk cycle): one
// static idle frame per direction, same numbering it always had.
const NPC_FRAME = { down: 0, up: 1, left: 2, right: 2 };
// A door/stairs object's `facing` property is the direction the player faces once they arrive AT
// that object (see docs/INTERIORS_PLAN.md "door object format"). Spawning one tile further along
// that direction lands the player just past the threshold, not standing on the trigger tile itself.
const DIRECTION_OFFSET = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// Where the held item sits relative to the player's center, per facing (FB-0002). Y values carry a
// +4 shift from their old 16x16-frame numbers (ADR 0013): the sprite's origin moved from (8,8) to
// (8,12) when the frame grew to 16x24, and the art itself just got taller underneath it, so a point
// at the same *visual* spot on the body sits 4px further from the new, lower-down center.
// `front: true` draws it over the player; `front: false` draws it behind (partly hidden).
const HELD_OFFSET = {
  down: { x: 5, y: 7, front: true },
  up: { x: 6, y: 2, front: false },
  left: { x: -5, y: 6, front: true },
  right: { x: 5, y: 6, front: true },
};

class WorldScene extends Phaser.Scene {
  constructor() {
    super('world');
  }

  init(data) {
    this.mapKey = data.map || initialMapKey();
    this.def = MAPS[this.mapKey];
    this.spawn = data.spawn || this.def.spawn;
    // Set when a Tiled door/stairs object sent the player here (instead of a concrete `spawn`):
    // the name of the object to land in front of, resolved once `this.mapObjects` exists (buildMap).
    this.spawnAt = data.spawnAt || null;
    this.transitioning = false;
    this.currentAreaName = null; // last area/zone/building name the location banner announced (P4)
  }

  preload() {
    // Held-item sprites (FB-0002): loaded here (not in the boot scene) so this file alone owns
    // them. Already-cached textures are skipped, which matters since the scene restarts per map.
    if (!this.textures.exists('held-items')) {
      this.load.spritesheet('held-items', 'assets/held-items.png', { frameWidth: 8, frameHeight: 8 });
    }
  }

  create() {
    this.buildMap();
    this.createAnimations();
    this.createPlayer();
    this.createNpcs();
    this.createPickups();
    this.createKeyStations();

    const { widthInPixels: width, heightInPixels: height } = this.map;
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setZoom(ZOOM).setBounds(0, 0, width, height).startFollow(this.player, true).fadeIn(250, 0, 0, 0);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT');
    // One-shot keys use keydown events; polling JustDown loses taps shorter than a frame (ERR-0001).
    this.input.keyboard.addCapture('SPACE');
    for (const key of ['E', 'SPACE']) this.input.keyboard.on(`keydown-${key}`, (event) => this.onInteractKey(event));

    // Silently note whichever area/zone/building the spawn point is already inside (P4's location
    // banner), so arriving there doesn't fire a second, redundant banner right after the map's own
    // "map-entered" one below announces the map by name.
    this.currentAreaName = this.areaHere()?.name || null;
    this.game.events.emit('map-entered', this);

    // In-fiction hints (FB-0023/0024, docs/GAME_FEEL.md): "WASD to move" the moment she's placed
    // into a controllable world, "Shift to run" the moment she's somewhere running is even possible.
    // ui.js's HintBanner is what actually remembers "already shown" (GameState.seenHints), so firing
    // these on every map load (not just the very first) is harmless -- they only ever display once.
    this.game.events.emit('hint', 'move');
    if (!this.def.indoors) this.game.events.emit('hint', 'run');
  }

  buildMap() {
    this.tileInfo = this.cache.json.get('tileinfo');
    const solid = this.tileInfo.tiles.flatMap((tile, i) => (tile.solid ? [i] : []));

    if (this.def.tiled) {
      // Tiled map (the campus): several layers, tile gid = tile index + 1
      const key = `map-${this.def.tiled}`;
      const json = this.cache.tilemap.get(key).data;
      this.map = this.make.tilemap({ key });
      const tileset = this.map.addTilesetImage('tiles', 'tiles');
      const solidGids = solid.map((index) => index + 1);
      const tileLayers = json.layers.filter((layer) => layer.type === 'tilelayer');
      // The "overhead" layer (tree canopies, ADR 0008) draws above every character and never
      // collides: it's decoration over whatever is on the ground/structures layers below it.
      this.solidLayers = tileLayers
        .filter((layer) => layer.name !== 'overhead')
        .map((layer) => this.map.createLayer(layer.name, tileset, 0, 0).setCollision(solidGids));
      const overheadDef = tileLayers.find((layer) => layer.name === 'overhead');
      if (overheadDef) {
        this.overheadLayer = this.map.createLayer(overheadDef.name, tileset, 0, 0).setDepth(OVERHEAD_DEPTH);
      }
      this.tileData = gridFromTiled(json);
      this.mapObjects = tiledObjects(json);
      if (!this.spawn && this.spawnAt) this.spawn = this.resolveSpawnAt(this.spawnAt);
      if (!this.spawn) {
        const spawn = this.mapObjects.find((o) => o.type === 'spawn');
        this.spawn = { x: Math.floor(spawn.x), y: Math.floor(spawn.y), facing: spawn.props.facing };
      }
      return;
    }

    this.tileData = buildTileGrid(this.def, this.tileInfo);
    this.map = this.make.tilemap({ data: this.tileData, tileWidth: TILE, tileHeight: TILE });
    this.solidLayers = [this.map.createLayer(0, this.map.addTilesetImage('tiles'), 0, 0).setCollision(solid)];
    this.mapObjects = [];
  }

  createAnimations() {
    // Walk cycle (ADR 0013): 6 real motion frames straight from the vendor pack's run sheet, not
    // the old 3-pose idle/step1/step2/idle bounce -- columns 1-6 of each row (column 0 is the
    // static idle pose, column 7 the idle-anim pose, see tools/make-assets.js CHAR_COLS).
    const walks = { down: [1, 2, 3, 4, 5, 6], up: [9, 10, 11, 12, 13, 14], side: [17, 18, 19, 20, 21, 22] };
    for (const [dir, frames] of Object.entries(walks)) {
      if (this.anims.exists(`walk-${dir}`)) continue;
      this.anims.create({ key: `walk-${dir}`, frames: this.anims.generateFrameNumbers('player', { frames }), frameRate: 12, repeat: -1 });
    }
    // Idle animation (ADR 0013, the pack's idle_anim sheet): a slow alternation between the static
    // idle pose and its idle-anim variant -- STYLE_GUIDE's "gentle life" rule (blink/bob when idle).
    const idles = { down: [0, 7], up: [8, 15], side: [16, 23] };
    for (const [dir, frames] of Object.entries(idles)) {
      if (this.anims.exists(`idle-${dir}`)) continue;
      this.anims.create({ key: `idle-${dir}`, frames: this.anims.generateFrameNumbers('player', { frames }), frameRate: 2, yoyo: true, repeat: -1 });
    }
  }

  createPlayer() {
    this.facing = this.spawn.facing || 'down';
    this.player = this.physics.add.sprite(toPixel(this.spawn.x), toPixel(this.spawn.y), 'player', PLAYER_IDLE[this.facing]);
    // Only the feet collide, so the head can overlap things a little (feels nicer). ADR 0013: the
    // body's bottom edge stays at (origin + 8) regardless of frame height -- that's what every
    // spawn point, door and warp trigger in every map was authored against (they place the sprite's
    // *origin* at a tile center via toPixel(), and expect the feet to land on that tile's bottom
    // edge, exactly 8px below). The frame grew from 16 to 24 tall, which moved the origin from the
    // middle of a 16px frame to the middle of a 24px one -- offsetY has to grow to compensate
    // (8 + newHalf - height = 8 + 12 - 6 = 14) or the feet end up 4px further down the map than the
    // spawn point intended, which is enough to land inside the next tile row (this broke the house
    // door: arriving at its spawn point re-triggered the exit warp immediately -- caught by
    // tests/e2e/house.spec.js, not by eye).
    this.player.body.setSize(10, 6).setOffset(3, 14);
    this.player.setCollideWorldBounds(true).setFlipX(this.facing === 'right');
    this.physics.add.collider(this.player, this.solidLayers);
    this.lastPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);
    // The currently-selected hotbar item, shown in the character's hand (FB-0002).
    this.heldItem = this.add.image(this.player.x, this.player.y, 'held-items', 0).setVisible(false);
    // "A little 3D" (docs/GAME_FEEL.md): a soft ground shadow under her feet, the same ellipse-under-
    // the-object rule pickups already follow (STYLE_GUIDE.md "Drop shadows"), just repositioned every
    // frame in movePlayer() instead of being static. Depth sits one below the player's own so it
    // never draws over her feet.
    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 9, 12, 4, 0x000000, 0.28).setDepth(this.player.y - 1);
  }

  createNpcs() {
    this.npcs = (this.def.npcs || []).map((def) => {
      // `character` (FB-0025, ADR 0013) picks one of the recolored pack NPCs (texture
      // 'npc-<character>', same 8-column layout as the player); no `character` keeps the legacy
      // 'npc' texture (Tomas/Guide's unchanged hand-drawn art, 3 static frames, no walk cycle).
      const textureKey = def.character ? `npc-${def.character}` : 'npc';
      const idleFrames = def.character ? PLAYER_IDLE : NPC_FRAME;
      const npc = this.physics.add.sprite(toPixel(def.x), toPixel(def.y), textureKey, idleFrames[def.facing || 'down']);
      // Same feet-only body as the player for the new-style sheets, and the same (origin + 8)
      // bottom-edge invariant (see createPlayer's comment) for the legacy sheet, just recomputed for
      // its own body height: 8 + 12 - 8 = 12.
      if (def.character) npc.body.setSize(10, 6).setOffset(3, 14);
      else npc.body.setSize(12, 8).setOffset(2, 12);
      npc.setImmovable(true);
      npc.setDepth(npc.y);
      npc.def = def;
      npc.idleFrames = idleFrames;
      this.physics.add.collider(this.player, npc);
      // Same ground shadow as the player (see createPlayer()); NPCs don't move yet, so a static
      // shadow needs no per-frame update.
      this.add.ellipse(npc.x, npc.y + 9, 12, 4, 0x000000, 0.28).setDepth(npc.y - 1);
      return npc;
    });
    // Interaction bubble (docs/STYLE_GUIDE.md "Speech bubbles"): frame 0 = "E" (something to say),
    // frame 1 = "!" (something *new* to say, see dialog.js hasNewDialog()). Only the nearest NPC in
    // range gets one, same as before (updatePrompt()).
    this.prompt = this.add.image(0, 0, 'prompt', 0).setVisible(false).setDepth(100000);
  }

  createPickups() {
    this.pickups = (this.def.pickups || [])
      .filter((def) => !GameState.collected.has(def.id))
      .map((def) => {
        const x = toPixel(def.x);
        const y = toPixel(def.y);
        const shadow = this.add.ellipse(x, y + 7, 10, 3, 0x000000, 0.25).setDepth(y - 1);
        const sprite = this.add.image(x, y - 1, 'items', ITEMS[def.item].frame).setDepth(y);
        this.tweens.add({ targets: sprite, y: y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return { def, x, y, sprite, shadow, taken: false, warned: false };
      });
  }

  // The 3 LUG treasure hunt keys (docs/STORY.md, M3): a desk/bench interactable, not a floor pickup
  // (updatePickups() never touches this list) -- pressing E runs its own dialog (src/story.js
  // keyStationDialog()), through the exact same pickDialogEntry()/applyDialogActions() code path an
  // NPC uses (docs/ARCHITECTURE.md "content is data"). Already-collected stations (GameState.quest.
  // keys, restored from a save) are skipped entirely, the same way createPickups() skips an
  // already-taken pickup.
  createKeyStations() {
    this.keyStations = (this.def.keyStations || [])
      .filter((def) => !GameState.quest.keys[def.id])
      .map((def) => {
        const x = toPixel(def.x);
        const y = toPixel(def.y);
        const shadow = this.add.ellipse(x, y + 7, 10, 3, 0x000000, 0.25).setDepth(y - 1);
        const sprite = this.add.image(x, y - 1, 'items', ITEMS[def.item].frame).setDepth(y);
        this.tweens.add({ targets: sprite, y: y - 4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        return { def, x, y, sprite, shadow, taken: false };
      });
  }

  update(time, delta) {
    if (this.transitioning) return;

    const ui = this.scene.get('ui');
    const blocked = !ui.tutorial || ui.isBlocking();
    this.movePlayer(blocked, time);
    this.updatePickups();
    this.updatePrompt(blocked, time);
    this.checkWarps();
    this.checkAreas();
    this.checkCutscene();
    this.syncGameState();
  }

  // Keeps GameState's map/position/facing current every frame, so a save taken at any moment (or
  // the browser just being closed) reflects where she actually is, not just her last warp target
  // (docs/ARCHITECTURE.md: "Anything that must survive a map change or a save goes in GameState").
  syncGameState() {
    GameState.map = this.mapKey;
    GameState.facing = this.facing;
    GameState.position = { x: Math.floor(this.player.x / TILE), y: Math.floor(this.player.y / TILE) };
  }

  // E / Space: next line of dialog, or talk to whoever is nearby.
  onInteractKey(event) {
    // this.sys.isActive() is false while a cutscene has this scene paused (Phaser still delivers
    // keyboard events to paused scenes, since they're not tied to the update loop).
    if (event.repeat || this.transitioning || !this.sys.isActive()) return;
    const ui = this.scene.get('ui');
    if (!ui.tutorial) return;
    if (ui.dialog.isOpen) ui.dialog.advance();
    else if (!ui.isBlocking()) this.interact();
  }

  movePlayer(blocked, time) {
    const k = this.keys;
    const p = this.player;
    let dx = 0;
    let dy = 0;
    if (!blocked) {
      dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
      dy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    }

    // Hold Shift to run, but not indoors (FB-0017). Held key -> isDown, never JustDown (ERR-0001).
    const running = !blocked && !this.def.indoors && k.SHIFT.isDown;
    const speed = running ? RUN_SPEED : WALK_SPEED;

    // Normalize so diagonal movement isn't faster than straight movement.
    const velocity = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
    if (dx === 0 && dy !== 0) {
      const steer = this.doorAssist(dy, speed);
      if (steer !== null) velocity.x = steer;
    }
    p.setVelocity(velocity.x, velocity.y);
    p.setDepth(p.y);
    this.playerShadow.setPosition(p.x, p.y + 9).setDepth(p.y - 1);
    p.anims.timeScale = running ? RUN_ANIM_SCALE : 1;

    const moved = Phaser.Math.Distance.Between(this.lastPosition.x, this.lastPosition.y, p.x, p.y);
    this.lastPosition.set(p.x, p.y);
    if (moved > 0) this.game.events.emit('player-moved', moved);

    const moving = dx !== 0 || dy !== 0;
    if (!moving) {
      // Idle animation (ADR 0013), not a hard stop-on-a-frame: a slow blink/bob, STYLE_GUIDE's
      // "gentle life" rule for a character that's just standing there.
      const idleDir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
      p.anims.play(`idle-${idleDir}`, true);
    } else if (dx !== 0) {
      this.facing = dx < 0 ? 'left' : 'right';
      p.setFlipX(dx > 0); // side art faces left; mirror it for right
      p.anims.play('walk-side', true);
    } else {
      this.facing = dy < 0 ? 'up' : 'down';
      p.setFlipX(false);
      p.anims.play(`walk-${this.facing}`, true);
    }

    this.updateHeldItem(time, moving);
  }

  // Every warp trigger point on this map, in one shape: text-map `warps` entries (already
  // {x,y,to,spawn}) plus Tiled `door`/`stairs` objects with a `to` property (campus buildings,
  // interior stairs). Used by both doorAssist (below) and checkWarps.
  // `locked`/`lockedReason` (roadmap M1 "Blocked doors", docs/STORY.md "Rules for the world") come
  // from the map def's own `doorLocks` (src/maps.js), matched by the object's exact Tiled name --
  // see src/maplogic.js doorLockRule()/isDoorLocked(). A text-map `warps` entry is never locked
  // (nothing in this game gates the meadow/house test maps).
  warpPoints() {
    const objectWarps = (this.mapObjects || [])
      .filter((o) => (o.type === 'door' || o.type === 'stairs') && o.props.to)
      .map((o) => {
        const rule = doorLockRule(this.def.doorLocks, o.name);
        return {
          x: Math.floor(o.x), y: Math.floor(o.y), to: o.props.to, spawnAt: o.props.toId, name: o.name,
          locked: isDoorLocked(rule, GameState.quest.stage),
          lockedReason: (rule && rule.reason) || 'Locked for the event',
        };
      });
    return [...(this.def.warps || []), ...objectWarps];
  }

  // Doors are one or two tiles wide, so walking at one slightly off-center would snag on the wall.
  // If a warp tile is just ahead, return a sideways speed that slides the player into line.
  doorAssist(dy, speed) {
    const body = this.player.body;
    const aheadY = Math.floor((dy < 0 ? body.top - 2 : body.bottom + 2) / TILE);
    const warp = this.warpPoints().find(
      (w) => w.y === aheadY && Math.abs(toPixel(w.x) - body.center.x) < DOOR_ASSIST_RANGE,
    );
    if (!warp) return null;
    return Phaser.Math.Clamp((toPixel(warp.x) - body.center.x) * 10, -speed, speed);
  }

  // Resolves a door/stairs object's name into a spawn point: one tile past it, in the direction
  // its own `facing` property says an arriving player should face (docs/INTERIORS_PLAN.md).
  resolveSpawnAt(name) {
    const target = (this.mapObjects || []).find((o) => o.name === name);
    if (!target) return null;
    const facing = target.props.facing || 'down';
    const [dx, dy] = DIRECTION_OFFSET[facing] || [0, 0];
    return { x: Math.floor(target.x) + dx, y: Math.floor(target.y) + dy, facing };
  }

  // Shows the selected hotbar item in the character's hand, in front of or behind the body
  // depending on facing, with a small bob while walking (FB-0002).
  updateHeldItem(time, moving) {
    const slot = GameState.inventory.selectedSlot;
    if (!slot) {
      this.heldItem.setVisible(false);
      return;
    }

    const p = this.player;
    // HELD_OFFSET already has a separate left/right entry, in screen space, so the offset itself
    // (not player.flipX, which only mirrors the body's own art) decides which side it sits on.
    const offset = HELD_OFFSET[this.facing];
    const bob = moving ? Math.round(Math.sin(time / 100)) : 0;
    // p.x/p.y here are last frame's position: this runs from movePlayer, which sets this frame's
    // velocity, but Arcade Physics doesn't copy its already-stepped body back onto p.x/p.y until
    // *after* this whole update() returns (Body.postUpdate(), fired on the scene's POST_UPDATE
    // event -- see ERR-0006). An earlier version of this guessed the pending movement as
    // `velocity * delta`, assuming physics would integrate this frame's velocity for the whole of
    // this frame's wall-clock delta -- but Arcade's World steps on a *fixed* 1/60s clock with its
    // own accumulator (`body.preUpdate` only calls `body.update()`, which is what actually moves
    // `body.position`, when enough real time has accumulated to cross that boundary), so a step can
    // land 0 or 2+ times in a single rendered frame whenever frame timing is uneven -- common under
    // load, and not actually rare. The guess and the real step size would then disagree by up to a
    // full 1/60s of travel (~1.3px at walk speed), which is exactly what tests/e2e/held-item.spec.js's
    // "FB-0025" test caught (2.3-2.7px combined with the 1px bob above, over its own 2px tolerance).
    // Fix: don't guess. `body.position` has *already* been advanced by this frame's real step (it
    // runs on the UPDATE event, before this function), so `position - prevFrame` (also already
    // computed, by Body.preUpdate at the very top of this same frame) is the *exact* delta
    // Phaser is about to add to p.x/p.y in postUpdate -- not a prediction, the literal number.
    const body = p.body;
    const x = p.x + (body.position.x - body.prevFrame.x);
    const y = p.y + (body.position.y - body.prevFrame.y);
    this.heldItem
      .setFrame(ITEMS[slot.item].frame)
      .setFlipX(p.flipX)
      .setPosition(x + offset.x, y + offset.y + bob)
      .setDepth(p.depth + (offset.front ? 1 : -1))
      .setVisible(true);
  }

  nearestNpc() {
    let nearest = null;
    let nearestDistance = INTERACT_RANGE;
    for (const npc of this.npcs) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y);
      if (distance < nearestDistance) {
        nearest = npc;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  // The nearest key station (docs/STORY.md, M3), within the same INTERACT_RANGE an NPC uses.
  nearestKeyStation() {
    let nearest = null;
    let nearestDistance = INTERACT_RANGE;
    for (const ks of this.keyStations || []) {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, ks.x, ks.y);
      if (distance < nearestDistance) {
        nearest = ks;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  // Whatever E would interact with right now: an NPC or a key station, whichever is nearer (both use
  // the same INTERACT_RANGE and the same underlying dialog data, docs/ARCHITECTURE.md "content is
  // data") -- null if nothing is in range. `def` is what pickDialogEntry()/hasNewDialog() need
  // ({ id, dialog }); `label` is what the dialog box's name tag shows.
  nearestInteractable() {
    const npc = this.nearestNpc();
    const npcDistance = npc ? Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) : Infinity;
    const ks = this.nearestKeyStation();
    const ksDistance = ks ? Phaser.Math.Distance.Between(this.player.x, this.player.y, ks.x, ks.y) : Infinity;
    if (!npc && !ks) return null;
    if (ksDistance < npcDistance) return { kind: 'keyStation', target: ks, def: ks.def, label: ks.def.name };
    return { kind: 'npc', target: npc, def: npc.def, label: npc.def.name };
  }

  interact() {
    const found = this.nearestInteractable();
    if (!found) return;

    if (found.kind === 'npc') {
      const npc = found.target;
      // Turn the NPC to face the player.
      const dx = this.player.x - npc.x;
      const dy = this.player.y - npc.y;
      if (Math.abs(dx) > Math.abs(dy)) npc.setFrame(npc.idleFrames.left).setFlipX(dx > 0);
      else npc.setFrame(dy < 0 ? npc.idleFrames.up : npc.idleFrames.down).setFlipX(false);
      this.game.events.emit('npc-talked', npc.def.id);
    }

    const picked = pickDialogEntry(found.def, GameState);
    if (!picked) return; // no dialog data at all -- shouldn't happen for a real NPC/key station
    const { entry, key } = picked;
    GameState.seenDialog.add(key); // "!" becomes "E" as soon as the line is shown, not after it closes
    notifyStateChanged(); // src/save.js autosaves soon after (seenDialog is part of the save)

    // `{name}` in a line is the player's chosen name (src/dialog.js renderLines()) -- both the
    // intro lines and every choice's own follow-up lines, since DialogBox itself doesn't template.
    const lines = renderLines(entry.lines, GameState);
    const choices = entry.choices
      ? entry.choices.map((choice) => ({ ...choice, lines: renderLines(choice.lines, GameState) }))
      : null;

    // DialogBox (src/scenes/ui.js) shows `lines`, then either closes (calling back with no choice)
    // or, if `choices` is set, shows the picked list and calls back with whichever option the player
    // chose. Either way, only one actions list ever runs: the choice's own, or the entry's own when
    // there was no choice to make.
    this.scene.get('ui').dialog.open(found.label, lines, (choice) => {
      applyDialogActions((choice || entry).actions, GameState, (result) => {
        // A key station's "take" entry starts with a `minigame` action (src/story.js); the key is
        // only actually given once that mini-game resolves 'won' and the rest of the list finishes
        // ('done', src/dialog.js) -- never on 'quit' (she backed out without beating it) or a full
        // bag. Only then does the desk's own icon disappear, the same way a ground pickup does, so it
        // visually matches "you already have it" instead of vanishing before she's actually earned it.
        if (found.kind === 'keyStation' && entry.id === 'take' && result === 'done') {
          this.collectKeyStation(found.target);
        }
      });
    }, choices);
  }

  // Launches a mini-game (docs/ROADMAP.md M4): pauses 'world' exactly like playCutscene() above
  // pauses it for a cutscene. The mini-game's own scene (src/minigames/framework-scene.js
  // MinigameBaseScene, registered under MINIGAMES[id].sceneKey in src/main.js) resumes 'world' itself
  // once it's done and calls `onResult('won' | 'quit')` -- src/dialog.js's `minigame` action is what
  // actually cares about that outcome.
  launchMinigame(id, onResult) {
    const def = MINIGAMES[id];
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.prompt.setVisible(false);
    this.scene.pause();
    this.scene.launch(def.sceneKey, { id, onComplete: onResult, returnTo: 'world' });
  }

  // Fades and destroys a key station's floating icon once its key has been given (mirrors
  // updatePickups()'s own take animation below).
  collectKeyStation(ks) {
    if (ks.taken) return;
    ks.taken = true;
    ks.shadow.destroy();
    this.tweens.killTweensOf(ks.sprite);
    this.tweens.add({
      targets: ks.sprite, y: ks.sprite.y - 10, alpha: 0, duration: 250,
      onComplete: () => ks.sprite.destroy(),
    });
  }

  updatePickups() {
    const p = this.player;
    for (const pickup of this.pickups) {
      if (pickup.taken) continue;
      const distance = Phaser.Math.Distance.Between(p.x, p.y + 4, pickup.x, pickup.y);
      if (distance > PICKUP_RANGE) {
        if (distance > PICKUP_RANGE * 2) pickup.warned = false;
        continue;
      }

      if (GameState.inventory.add(pickup.def.item)) {
        pickup.taken = true;
        GameState.collected.add(pickup.def.id);
        pickup.shadow.destroy();
        this.tweens.killTweensOf(pickup.sprite);
        this.tweens.add({
          targets: pickup.sprite, y: pickup.sprite.y - 10, alpha: 0, duration: 250,
          onComplete: () => pickup.sprite.destroy(),
        });
        this.game.events.emit('toast', `+1 ${ITEMS[pickup.def.item].name}`);
      } else if (!pickup.warned) {
        pickup.warned = true;
        this.game.events.emit('toast', 'Your bag is full!');
      }
    }
  }

  // The bubble is hidden while blocked (dialog/tutorial/fullmap open) and, since this only runs
  // while the scene itself is active, automatically hidden for the whole time a cutscene has this
  // scene paused too. It bobs gently either way; the "!" state also gets a soft scale pulse so a
  // player scanning the screen notices new content (docs/STYLE_GUIDE.md).
  updatePrompt(blocked, time) {
    const found = blocked ? null : this.nearestInteractable();
    this.prompt.setVisible(Boolean(found));
    if (!found) return;
    this.game.events.emit('hint', 'talk'); // "E to talk", the first time anyone is ever in range
    const isNew = hasNewDialog(found.def, GameState);
    this.prompt.setFrame(isNew ? 1 : 0);
    const bob = Math.round(Math.sin(time / 200));
    this.prompt.setPosition(found.target.x, found.target.y - 18 + bob);
    this.prompt.setScale(isNew ? 1 + 0.08 * Math.sin(time / 150) : 1);
  }

  checkWarps() {
    const body = this.player.body;
    const tileX = Math.floor(body.center.x / TILE);
    const tileY = Math.floor((body.bottom - 1) / TILE);
    const warp = this.warpPoints().find((w) => w.x === tileX && w.y === tileY);
    if (!warp) {
      this.lockedWarned = null;
      return;
    }

    // Locked (roadmap M1 "Blocked doors", docs/STORY.md): a toast, not a silent wall -- thrown once
    // per approach (the same "warned" throttle updatePickups() uses for a full bag), not every frame
    // she stands on the tile.
    if (warp.locked) {
      if (this.lockedWarned !== warp.name) {
        this.lockedWarned = warp.name;
        this.game.events.emit('toast', warp.lockedReason);
      }
      return;
    }
    this.lockedWarned = null;

    // A door/stairs object can point at a map that doesn't exist yet (a building not linked up,
    // or built by a parallel worktree not yet merged): warn and toast instead of crashing
    // (docs/ARCHITECTURE.md rule 1, "validate and fail loudly", extended here to "fail softly for
    // the player, loudly in the console").
    if (!MAPS[warp.to]) {
      if (!this.warnedUnknownMaps) this.warnedUnknownMaps = new Set();
      if (!this.warnedUnknownMaps.has(warp.to)) {
        console.warn(`${warp.name || 'a door'} leads to an unknown map "${warp.to}"`);
        this.game.events.emit('toast', 'Closed for now.');
        this.warnedUnknownMaps.add(warp.to);
      }
      return;
    }

    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.prompt.setVisible(false);
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ map: warp.to, spawn: warp.spawn, spawnAt: warp.spawnAt }));
  }

  // The named area/zone object (if any) the player's feet are currently inside, smallest match wins
  // (objectAt in maplogic.js), e.g. "Athletics Track" over the whole campus outline. Building names
  // come from 'zone' objects (one per real footprint rectangle, generated alongside the coarser
  // 'building' bbox used only for labels -- QA: the bbox of an L-shaped building can spill into a
  // neighbouring building's plaza and win there, which 'zone's precise footprint rectangles don't).
  areaHere() {
    return objectAt(this.mapObjects, ['area', 'zone'], this.player.x / TILE, this.player.y / TILE);
  }

  // Location banner (Pokemon-style name plate, P4): tells the UI scene when the player enters a
  // differently-named area, so it doesn't re-show the same name while still inside it.
  checkAreas() {
    const name = this.areaHere()?.name || null;
    if (name === this.currentAreaName) return;
    this.currentAreaName = name;
    if (name) {
      this.game.events.emit('area-entered', name);
      this.game.events.emit('hint', 'map'); // "M for the map", the first time she leaves her start area
    }
  }

  // Gate 2 welcome cutscene (P4): a Tiled rectangle object, `type: 'cutscene'` with a `cutscene`
  // property naming a key in CUTSCENES (src/cutscenes.js). Plays once per session (GameState.
  // seenCutscenes) and can be turned off with ?cutscene=0 (tests that would otherwise walk through it).
  checkCutscene() {
    if (!cutscenesEnabled()) return;
    const feetX = this.player.body.center.x / TILE;
    const feetY = (this.player.body.bottom - 1) / TILE;
    const trigger = objectAt(this.mapObjects, ['cutscene'], feetX, feetY);
    const key = trigger && trigger.props.cutscene;
    if (!notSeenCutscene(key, GameState.seenCutscenes)) return;
    this.playCutscene(key);
  }

  // Pauses the world (so the player can't move or re-trigger anything) and hands off to the
  // cutscene scene, which resumes 'world' itself when it's done (src/scenes/cutscene.js).
  playCutscene(key) {
    GameState.seenCutscenes.add(key);
    this.game.events.emit('cutscene-seen', key); // src/save.js autosaves soon after
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.prompt.setVisible(false);
    this.scene.pause();
    this.scene.launch('cutscene', { key });
  }
}

// Tile coordinate -> pixel at the center of that tile
function toPixel(tile) {
  return tile * TILE + TILE / 2;
}
