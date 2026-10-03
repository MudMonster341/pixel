// The world scene: the current map, the player, NPCs and items on the ground.
// Moving to another map restarts this scene with new data; GameState keeps what persists.

const WALK_SPEED = 80; // pixels per second
const RUN_SPEED = 140; // pixels per second, holding Shift outdoors (FB-0017)
const RUN_ANIM_SCALE = RUN_SPEED / WALK_SPEED; // walk animation plays faster while running

// M5 sound: footsteps (docs/ROADMAP.md rule 3 -- "soft, rate-limited, different indoors"). A
// different sample set and a softer volume indoors (src/audio.js SOUNDS), a faster cadence while
// running (running is never possible indoors anyway, FB-0017, so FOOTSTEP_INTERVAL_INDOOR never
// needs its own "running" variant).
const FOOTSTEP_OUTDOOR_SOUNDS = ['footstepOutdoor1', 'footstepOutdoor2', 'footstepOutdoor3', 'footstepOutdoor4'];
const FOOTSTEP_INDOOR_SOUNDS = ['footstepIndoor1', 'footstepIndoor2', 'footstepIndoor3', 'footstepIndoor4'];
const FOOTSTEP_INTERVAL_WALK_MS = 300;
const FOOTSTEP_INTERVAL_RUN_MS = 190;
const FOOTSTEP_INTERVAL_INDOOR_MS = 380;
// Depth for the "overhead" Tiled layer (tree canopies, ADR 0008): always above every character,
// whose depth is set to their own y each frame (a few thousand px at most on the biggest map).
const OVERHEAD_DEPTH = 1_000_000;
const INTERACT_RANGE = 24;
const PICKUP_RANGE = 10;
// ADR 0016: how close she has to walk to a key station's desk for its own "walking in" beat to fire --
// bigger than INTERACT_RANGE, since the point is catching her entering the room, not standing on the
// desk (docs/STORY.md beat 8). Maps each key station id to its own SCRIPTS key (src/scripts.js).
const ROOM_BEAT_RANGE = 90;
const KEY_ROOM_SCRIPT = { physicsLab: 'keyRoomPhysicsLab', icvl: 'keyRoomIcvl', room195: 'keyRoomRoom195' };
const DOOR_ASSIST_RANGE = 12; // how far off-center you can walk at a door and still slide in
// Quality loop, Characters and depth run 1 (2026-09-29): ambient campus/Main Block life
// (src/ambient.js, createAmbient()/updateAmbient() below). A patrol NPC pauses (holds still, doesn't
// "push through") while she's this close, rather than colliding into her -- "if she walks into one,
// they... wait". AMBIENT_CULL_MARGIN is how far outside the camera's own view (in world px) an ambient
// NPC still gets its per-frame waypoint/pause logic; farther than that, it's simply left alone until
// back in view (cheap: no pathfinding, and no drift while unseen either) -- "only update ones near the
// camera". AMBIENT_ARRIVE_RANGE is how close counts as "reached the waypoint" before picking the next
// one; too small and a patrol can overshoot and jitter at low frame rates.
const AMBIENT_PAUSE_RANGE = 20;
const AMBIENT_CULL_MARGIN = 64;
const AMBIENT_ARRIVE_RANGE = 3;
const AMBIENT_CHAT_EMOTE_MIN_MS = 2500;
const AMBIENT_CHAT_EMOTE_MAX_MS = 5500;
// Frame layout (ADR 0013, FB-0043): 4 real rows (down/up/left/right, no mirroring -- was 3 rows with
// "right" drawn as a mirrored "left", which turned out to be mirroring the wrong art entirely, see
// ERR-0007) x 8 columns (idle, 6 walk frames, 1 idle-anim frame) -- see tools/make-assets.js
// CHAR_COLS/CHAR_ROWS/buildCharacter. Frame index = row * 8 + column, so each direction's idle frame
// is a multiple of 8.
const CHAR_COLS = 8;
const PLAYER_IDLE = { down: 0, up: CHAR_COLS, left: 2 * CHAR_COLS, right: 3 * CHAR_COLS };
// Legacy 3-frame sheet (Tomas/Guide's 'npc' texture, unchanged hand-drawn art, no walk cycle): one
// static idle frame per direction, same numbering it always had.
const NPC_FRAME = { down: 0, up: 1, left: 2, right: 2 };
// DIRECTION_OFFSET now lives in src/maplogic.js (doorTileFromSpawn() needs it too, in reverse) --
// spawning one tile further along a door/stairs object's own `facing` lands the player just past the
// threshold, not standing on the trigger tile itself (docs/INTERIORS_PLAN.md "door object format").

// ADR 0015 (depth groups and door entry): the player's depth sorts by her feet, not her sprite's own
// anchor -- the body's bottom edge sits this many px below the sprite origin (see createPlayer()'s
// own comment on the (origin + 8) invariant every spawn point/door/warp trigger is authored against).
const PLAYER_FEET_OFFSET = 8;
// Timings (docs/GAME_FEEL.md "nothing is a flat instant cut", ADR 0015's own "Pokemon style" brief):
// a door's walk-in/out is a full, readable step; stairs get a shorter one since there's no doorway to
// clear. The door itself (if it has `openTiles`) opens just before she starts walking, at roughly
// half the walk's own duration -- and the fade that follows a departure is the existing 250ms
// (unchanged, docs/STYLE_GUIDE.md).
const DOOR_WALK_MS = 250;
const STAIRS_WALK_MS = 150;
const DOOR_RATTLE_MS = 200;
// Footstep dust (ADR 0015): a puff roughly every couple of steps while running outdoors, not every
// frame -- 220ms is a little faster than one full run-animation cycle (12fps, 6 frames ~ 500ms) so it
// reads as "every other step", not a fixed clock unrelated to her stride.
const DUST_INTERVAL_MS = 220;

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
    // Set when a warp (not the initial boot/continue/`?map=` debug entry) sent the player here (ADR
    // 0015): 'door' or 'stairs', matching the warp's own `kind` (see getWarpPoints()) -- create()
    // plays the matching arrival animation when this is set, and leaves her exactly at `this.spawn`
    // with no animation at all when it's null, unchanged from every build before this one.
    this.viaWarpKind = data.viaWarpKind || null;
    // ADR 0016 (the M3a opening rework, FB-0032): set only by BootScene's own hand-off from
    // CustomizeScene's "Continue" -- see src/main.js continueSpawnData()/BootScene -- when the full
    // opening chain (not `?intro=0`, not "Continue" a save) actually ran. Consumed once, in create().
    this.playOpening = Boolean(data.playOpening);
    this.transitioning = false;
    this.currentAreaName = null; // last area/zone/building name the location banner announced (P4)
    // buildMap() only ever *assigns* this.overheadLayer when the new map's own Tiled data actually
    // has an 'overhead' layer (tree canopies, ADR 0008) -- it never clears it otherwise. Since
    // WorldScene restarts in place (`this.scene.restart()`, not a fresh instance), a stale reference
    // to the OLD map's now-destroyed overhead TilemapLayer survived into the new map's own
    // buildDepthGroups() bake list whenever the new map had no overhead layer of its own (every
    // interior, e.g. the campus -> Main Block door): calling .getTileAt() on that destroyed layer
    // threw ("Cannot read properties of undefined (reading 'width')"), which aborted create() before
    // the player/camera/input setup below it ever ran -- the scene was left permanently inactive,
    // looking like a soft-lock on any door/stairs into a map without tree canopies.
    this.overheadLayer = null;
    // Cached warpPoints() (perf: this used to be rebuilt twice a frame, doorAssist() and checkWarps()
    // both calling it) -- only the `locked` flags ever change after map load, and only when the quest
    // stage does, so getWarpPoints() below recomputes just those instead of the whole array.
    this._warpPointsCache = null;
    this._warpStage = null;
    this.dustAccum = 0; // footstep dust puff timer (outdoors, while running)
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
    this.createAmbient();
    this.createPickups();
    this.createKeyStations();

    const { widthInPixels: width, heightInPixels: height } = this.map;
    this.physics.world.setBounds(0, 0, width, height);
    // Camera feel (ADR 0015): smooth follow (a real lerp, not the instant snap `startFollow`'s own
    // default lerp of 1 was giving it before) with roundPixels (unchanged, also set globally in
    // src/main.js's game config) so tiles/characters never shimmer sub-pixel. `centerOn` right after
    // is the "camera settle" -- without it, a freshly restarted scene's camera starts at its own
    // default scroll and would visibly glide/pan onto the player over the first several frames of
    // the fade-in, reading as its own little cut; centering once, immediately, means the lerp only
    // ever has to catch up to *real* movement from here on, never a warp's own teleport.
    this.cameras.main.setZoom(ZOOM).setBounds(0, 0, width, height)
      .startFollow(this.player, true, 0.18, 0.18)
      .centerOn(this.player.x, this.player.y)
      .fadeIn(250, 0, 0, 0);

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT');
    // One-shot keys use keydown events; polling JustDown loses taps shorter than a frame (ERR-0001).
    this.input.keyboard.addCapture('SPACE');
    for (const key of ['E', 'SPACE']) this.input.keyboard.on(`keydown-${key}`, (event) => this.onInteractKey(event));

    // ADR 0016: the in-world cutscene script runner (src/scripts-runtime.js). Esc fast-forwards
    // whatever's currently playing straight to its end state -- registered here (not left to
    // UIScene's own Esc handler) because UIScene.worldHasControl() already refuses to act at all while
    // a script has `this.transitioning` set, the same as it does mid-door-walk; a script's own skip
    // has to be reachable by Esc regardless of that gate, the same way onInteractKey() above already
    // reaches past it for dialog.
    this.scriptRunner = new ScriptRunner(this);
    this.input.keyboard.on('keydown-ESC', (event) => {
      if (!event.repeat && this.scriptRunner.isRunning) this.scriptRunner.skip();
    });

    // Silently note whichever area/zone/building the spawn point is already inside (P4's location
    // banner), so arriving there doesn't fire a second, redundant banner right after the map's own
    // "map-entered" one below announces the map by name.
    this.currentAreaName = this.areaHere()?.name || null;
    this.game.events.emit('map-entered', this);
    // M5 sound: crossfades (never cuts) to the outdoor/indoor bed for whichever map this is -- a
    // no-op if the same one's already playing (AudioManager.playMusic()), so moving between two
    // outdoor maps (or reloading the same map) never restarts or glitches the music.
    AudioManager.playMusic(this.def.indoors ? 'indoorMusic' : 'overworldMusic');

    // In-fiction hints (FB-0023/0024, docs/GAME_FEEL.md): "WASD to move" the moment she's placed
    // into a controllable world, "Shift to run" the moment she's somewhere running is even possible.
    // ui.js's HintBanner is what actually remembers "already shown" (GameState.seenHints), so firing
    // these on every map load (not just the very first) is harmless -- they only ever display once.
    this.game.events.emit('hint', 'move');
    if (!this.def.indoors) this.game.events.emit('hint', 'run');

    // ADR 0015 arrival: plays *after* everything above (so map-entered/hints fire immediately, the
    // same instant they always have) but sets `this.transitioning = true` itself, so the very first
    // update() tick after this still skips movement/warps/etc. -- exactly like a departure's own fade
    // already does, just for the walk-out instead of the walk-in.
    if (this.viaWarpKind) this.playDoorArrival(this.viaWarpKind);

    // ADR 0016 / docs/STORY.md "Opening": the full M3a chain's own bus-arrival-then-Mustafa-meets-her
    // beat, only on a genuinely fresh arrival at the campus's own default spawn (never on a debug
    // `?map=`/mid-game reload -- see the guards below, and playOpeningSequence()'s own comment).
    if (this.playOpening && this.mapKey === 'campus' && !this.viaWarpKind) this.playOpeningSequence();
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
      // ADR 0015: `depthGroup` objects (a Tiled object layer, rect in tiles as tiledObjects() always
      // gives them). Baked from the non-ground layers only -- 'ground' itself is never part of a
      // group, it stays a static, always-under-everything base the same way it always has.
      this.buildDepthGroups(
        this.mapObjects
          .filter((o) => o.type === 'depthGroup')
          .map((o) => ({ x: o.x, y: o.y, width: o.width, height: o.height, baseOffset: Number(o.props.baseOffset) || 0 })),
        this.solidLayers.filter((l) => l.layer.name !== 'ground').concat(this.overheadLayer ? [this.overheadLayer] : []),
      );
      return;
    }

    this.tileData = buildTileGrid(this.def, this.tileInfo);
    this.map = this.make.tilemap({ data: this.tileData, tileWidth: TILE, tileHeight: TILE });
    this.solidLayers = [this.map.createLayer(0, this.map.addTilesetImage('tiles'), 0, 0).setCollision(solid)];
    this.mapObjects = [];
    // ADR 0015: text maps (meadow/house) get the same thing as a plain `depthGroups` array on the
    // map def (src/maps.js) -- there's only ever the one merged layer here (ground and structures
    // stamped together, buildTileGrid()), so the whole rect bakes as a unit; a tile outside every
    // group is untouched, same as the Tiled path above.
    this.buildDepthGroups(
      (this.def.depthGroups || []).map((g) => ({ x: g.x, y: g.y, width: g.width, height: g.height, baseOffset: g.baseOffset || 0 })),
      this.solidLayers,
    );
  }

  // Bakes each group's visible tiles (from `bakeLayers`) into one static image (a RenderTexture,
  // ADR 0015), positioned and sized to the group's own rect, at a depth matching its base line in
  // pixels -- then hides (never removes, never touches collision) the original tiles it just copied,
  // smallest-group-wins (src/maplogic.js depthGroupAt()), so a tile inside more than one group is
  // only ever baked/hidden once, by the smallest. A map with no groups at all does nothing here,
  // rendering exactly as before this ADR.
  buildDepthGroups(groupDefs, bakeLayers) {
    this.depthGroups = [];
    if (!groupDefs.length) return;
    this.ensureTileFrames();

    // Bounded by "tiles actually inside a group" x "groups" x "layers baked" -- never by the whole
    // map, which is what keeps this cheap even at the 250-synthetic-group performance budget
    // (tests/e2e/performance.spec.js): a RenderTexture per group, each tile blitted in by its own
    // registered frame (ensureTileFrames()) at its position local to the group's own rect.
    //
    // Perf fix (campus art rebuild, FB-0027/0029): the real campus map ships 244 real depthGroup
    // objects (buildings, trees, palms, signboards, ...) totalling ~28k baked cells across 2 layers,
    // ~56k individual blits. `RenderTexture.drawFrame()` is a convenience wrapper that does its own
    // `beginDraw()`/`batchDrawFrame()`/`endDraw()` (a full render-target bind/flush/unbind) *per
    // call* -- fine for a handful of calls (the old 0-real-group campus, or a single group), ruinous
    // at this volume: measured at 5+ real seconds of synchronous main-thread work building the
    // campus's depth groups alone, on every load *and* every door/stairs transition that lands back
    // on campus (`this.scene.restart()` re-runs buildMap() -> buildDepthGroups() from scratch) --
    // easily blowing past tests/e2e/helpers.js's 5s `waitForMap()` poll (interiors.spec.js's Main
    // Block round trip, scripts.spec.js/story.spec.js's fuller playthroughs) and, for a real player,
    // a multi-second freeze on every single door in and out of a building. `beginDraw()` once per
    // group's RenderTexture and `batchDrawFrame()` (identical signature to `drawFrame()`, just
    // deferred) for every tile, `endDraw()` once at the end, batches the whole group into one real
    // draw instead of one per tile -- same pixels, same tile-frame API, no visible behaviour change.
    for (const group of groupDefs) {
      const px = group.x * TILE;
      const py = group.y * TILE;
      const rt = this.add.renderTexture(px, py, group.width * TILE, group.height * TILE).setOrigin(0, 0);
      rt.beginDraw();
      for (let ty = group.y; ty < group.y + group.height; ty++) {
        for (let tx = group.x; tx < group.x + group.width; tx++) {
          for (const layer of bakeLayers) {
            const tile = layer.getTileAt(tx, ty);
            if (tile) rt.batchDrawFrame('tiles', tile.index - 1, (tx - group.x) * TILE, (ty - group.y) * TILE);
          }
        }
      }
      rt.endDraw();
      const depth = (group.y + group.height - group.baseOffset) * TILE;
      rt.setDepth(depth);
      this.depthGroups.push({ ...group, rt, depth });
    }

    // Hide the tiles just baked, smallest-group-wins (src/maplogic.js depthGroupAt()) -- a tile
    // inside more than one group is only ever baked/hidden by the smallest; Tile.visible, never the
    // tile's index, so collision (already set up via setCollision() in buildMap()) is untouched.
    for (const group of this.depthGroups) {
      for (let ty = group.y; ty < group.y + group.height; ty++) {
        for (let tx = group.x; tx < group.x + group.width; tx++) {
          if (depthGroupAt(this.depthGroups, tx, ty) !== group) continue; // a smaller group owns it
          for (const layer of bakeLayers) {
            const tile = layer.getTileAt(tx, ty);
            if (tile) tile.visible = false;
          }
        }
      }
    }
  }

  // Registers one Phaser texture frame per tile (assets/tiles.json order, tileInfo.columns per row)
  // on the 'tiles' texture -- loaded as a single plain image (BootScene), not a spritesheet, since a
  // Tiled tileset doesn't need Phaser's own frame slicing to work as a tilemap. Depth groups (and the
  // door overlay/rattle below) need individual tile frames to blit/display standalone, so this adds
  // them once, lazily, the first time any map actually needs one -- a no-op on every later map load
  // (the TextureManager, and the frames on it, persist across a scene restart).
  ensureTileFrames() {
    const tex = this.textures.get('tiles');
    if (tex.has(0)) return;
    const cols = this.tileInfo.columns;
    this.tileInfo.tiles.forEach((_, i) => tex.add(i, 0, (i % cols) * TILE, Math.floor(i / cols) * TILE, TILE, TILE));
  }

  createAnimations() {
    // Walk cycle (ADR 0013): 6 real motion frames straight from the vendor pack's run sheet, not
    // the old 3-pose idle/step1/step2/idle bounce -- columns 1-6 of each row (column 0 is the
    // static idle pose, column 7 the idle-anim pose, see tools/make-assets.js CHAR_COLS). FB-0043:
    // 4 real rows now (down/up/left/right), no more shared "side" row played with flipX mirroring --
    // left and right are each their own genuine art, never a mirror of the other.
    const walks = { down: [1, 2, 3, 4, 5, 6], up: [9, 10, 11, 12, 13, 14], left: [17, 18, 19, 20, 21, 22], right: [25, 26, 27, 28, 29, 30] };
    for (const [dir, frames] of Object.entries(walks)) {
      if (this.anims.exists(`walk-${dir}`)) continue;
      this.anims.create({ key: `walk-${dir}`, frames: this.anims.generateFrameNumbers('player', { frames }), frameRate: 12, repeat: -1 });
    }
    // Idle animation (ADR 0013, the pack's idle_anim sheet): a slow alternation between the static
    // idle pose and its idle-anim variant -- STYLE_GUIDE's "gentle life" rule (blink/bob when idle).
    const idles = { down: [0, 7], up: [8, 15], left: [16, 23], right: [24, 31] };
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
    // FB-0043: never flips the player sprite -- right is now its own real, unmirrored row (see
    // PLAYER_IDLE/createAnimations above), not "left" drawn backwards.
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.solidLayers);
    this.lastPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);
    // The currently-selected hotbar item, shown in the character's hand (FB-0002).
    this.heldItem = this.add.image(this.player.x, this.player.y, 'held-items', 0).setVisible(false);
    // "A little 3D" (docs/GAME_FEEL.md): a soft ground shadow under her feet, the same ellipse-under-
    // the-object rule pickups already follow (STYLE_GUIDE.md "Drop shadows"), just repositioned every
    // frame in movePlayer() instead of being static. Depth sits one below the player's own so it
    // never draws over her feet.
    this.playerShadow = this.add.ellipse(this.player.x, this.player.y + 9, 12, 4, 0x000000, 0.28)
      .setDepth(this.player.y + PLAYER_FEET_OFFSET - 1);
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
      // ADR 0015: depth by feet (body.bottom), not sprite anchor -- computed once here since NPCs
      // never move, unlike the player's own per-frame p.y + PLAYER_FEET_OFFSET (movePlayer()).
      npc.setDepth(npc.body.bottom);
      npc.def = def;
      npc.idleFrames = idleFrames;
      this.physics.add.collider(this.player, npc);
      // Same ground shadow as the player (see createPlayer()); NPCs don't move yet, so a static
      // shadow needs no per-frame update.
      this.add.ellipse(npc.x, npc.y + 9, 12, 4, 0x000000, 0.28).setDepth(npc.body.bottom - 1);
      return npc;
    });
    // Interaction bubble (docs/STYLE_GUIDE.md "Speech bubbles"): frame 0 = "E" (something to say),
    // frame 1 = "!" (something *new* to say, see dialog.js hasNewDialog()). Only the nearest NPC in
    // range gets one, same as before (updatePrompt()).
    this.prompt = this.add.image(0, 0, 'prompt', 0).setVisible(false).setDepth(100000);
  }

  // Ambient campus/Main Block life (quality loop, Characters and depth run 1: "the world is empty").
  // Content is src/ambient.js (docs/ARCHITECTURE.md "content is data"); this only builds the sprites.
  // A much lighter-weight cousin of createNpcs() above -- same texture/body/collider/shadow shape, so
  // interact()'s own "turn to face her" logic and nearestInteractable() work on an ambient
  // NPC exactly like a story one, without needing to know the difference -- but *moving*, updated
  // every frame by updateAmbient() (patrol waypoints, the "pause near her" yield, the chat pairs' own
  // emote), which createNpcs()'s own always-still NPCs never needed.
  createAmbient() {
    this.ambientNpcs = (this.def.ambient || []).map((def, i) => this.buildAmbientNpc(def, i));
  }

  buildAmbientNpc(def, index) {
    const textureKey = `npc-${def.character}`;
    this.ensureAmbientAnims(textureKey);
    const start = def.kind === 'patrol' ? def.waypoints[0] : def;
    const facing = def.facing || 'down';
    const sprite = this.physics.add.sprite(toPixel(start.x), toPixel(start.y), textureKey, PLAYER_IDLE[facing]);
    // Same feet-only body/bottom-edge invariant as any other recolored-pack character (createNpcs()'s
    // own comment on this has the full story).
    sprite.body.setSize(10, 6).setOffset(3, 14);
    sprite.setImmovable(true); // she's stopped by them; they're never shoved around by her or each other
    this.physics.add.collider(this.player, sprite);
    const shadow = this.add.ellipse(sprite.x, sprite.y + 9, 12, 4, 0x000000, 0.28);
    // The same `{ def, idleFrames }` shape a real story NPC carries (createNpcs() above), so
    // interact()/pickDialogEntry() need no ambient-specific branch at all. A short, neutral one-liner,
    // never story information (this task's own brief) -- `def.dialog`, if given, overrides the shared
    // pool (src/ambient.js AMBIENT_DEFAULT_LINES), cycled by index so nearby NPCs don't usually repeat.
    sprite.def = {
      id: def.id,
      name: 'Student',
      character: def.character,
      dialog: def.dialog || [{ id: 'chat', lines: [AMBIENT_DEFAULT_LINES[index % AMBIENT_DEFAULT_LINES.length]] }],
    };
    sprite.idleFrames = PLAYER_IDLE;
    const ambient = {
      def, sprite, shadow, facing,
      waypointIndex: 0, waypointDir: 1, pausedUntil: 0,
      emoteAt: this.time.now + AMBIENT_CHAT_EMOTE_MIN_MS + Math.random() * (AMBIENT_CHAT_EMOTE_MAX_MS - AMBIENT_CHAT_EMOTE_MIN_MS),
    };
    this.syncAmbientDepth(ambient);
    return ambient;
  }

  // Global anim keys are baked to a specific texture's own frames (Phaser AnimationFrame, not
  // re-resolved per sprite -- see src/scripts-runtime.js ensureActorAnims()'s own comment on this,
  // the exact same reasoning applies here), so every distinct ambient texture needs its own
  // '<kind>-<dir>-<textureKey>' set, built once the first time any ambient NPC actually needs it.
  ensureAmbientAnims(textureKey) {
    if (this.anims.exists(`walk-down-${textureKey}`)) return;
    const walks = { down: [1, 2, 3, 4, 5, 6], up: [9, 10, 11, 12, 13, 14], left: [17, 18, 19, 20, 21, 22], right: [25, 26, 27, 28, 29, 30] };
    const idles = { down: [0, 7], up: [8, 15], left: [16, 23], right: [24, 31] };
    for (const [dir, frames] of Object.entries(walks)) {
      this.anims.create({ key: `walk-${dir}-${textureKey}`, frames: this.anims.generateFrameNumbers(textureKey, { frames }), frameRate: 12, repeat: -1 });
    }
    for (const [dir, frames] of Object.entries(idles)) {
      this.anims.create({ key: `idle-${dir}-${textureKey}`, frames: this.anims.generateFrameNumbers(textureKey, { frames }), frameRate: 2, yoyo: true, repeat: -1 });
    }
  }

  syncAmbientDepth(ambient) {
    const s = ambient.sprite;
    const depth = s.y + PLAYER_FEET_OFFSET;
    s.setDepth(depth);
    ambient.shadow.setPosition(s.x, s.y + 9).setDepth(depth - 1);
  }

  playAmbientAnim(ambient, kind) {
    const s = ambient.sprite;
    const key = `${kind}-${ambient.facing}-${s.texture.key}`;
    if (s.anims.currentAnim?.key !== key) s.anims.play(key, true);
  }

  // Cheap on purpose: velocity straight at the current waypoint, no pathfinding (this task's own
  // brief) -- fine for a handful of fixed, hand-picked, always-walkable routes (src/ambient.js,
  // tests/unit/ambient.test.js). "Only update ones near the camera" is enforced by the caller
  // (updateAmbient()), not here.
  updateAmbientPatrol(ambient, time) {
    const s = ambient.sprite;
    const def = ambient.def;
    // "If she walks into one, they... wait" -- holds still (never shoves through her) while she's
    // this close, and for `pauseMs` after reaching each end of its own route.
    const nearPlayer = Phaser.Math.Distance.Between(s.x, s.y, this.player.x, this.player.y) < AMBIENT_PAUSE_RANGE;
    if (nearPlayer || time < ambient.pausedUntil) {
      s.setVelocity(0, 0);
      this.playAmbientAnim(ambient, 'idle');
      this.syncAmbientDepth(ambient);
      return;
    }

    const target = def.waypoints[ambient.waypointIndex];
    const tx = toPixel(target.x);
    const ty = toPixel(target.y);
    const dx = tx - s.x;
    const dy = ty - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < AMBIENT_ARRIVE_RANGE) {
      s.setVelocity(0, 0);
      if (def.loop) {
        ambient.waypointIndex = (ambient.waypointIndex + 1) % def.waypoints.length;
      } else if (def.waypoints.length > 1) {
        if (ambient.waypointIndex === 0) ambient.waypointDir = 1;
        else if (ambient.waypointIndex === def.waypoints.length - 1) ambient.waypointDir = -1;
        ambient.waypointIndex = Phaser.Math.Clamp(ambient.waypointIndex + ambient.waypointDir, 0, def.waypoints.length - 1);
      }
      ambient.pausedUntil = time + (def.pauseMs || 0);
      this.playAmbientAnim(ambient, 'idle');
      this.syncAmbientDepth(ambient);
      return;
    }

    const speed = def.speed || WALK_SPEED * 0.75;
    s.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    ambient.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    this.playAmbientAnim(ambient, 'walk');
    this.syncAmbientDepth(ambient);
  }

  // A pair (src/ambient.js `pairId`, matched up front so this never needs to search every frame) taking
  // turns showing a small "..." bubble every few seconds -- reuses the same small-bubble-above-the-head
  // shape src/scripts-runtime.js's own `emote` step uses for a script actor, standalone here since an
  // ambient chat pair isn't a script actor at all.
  updateAmbientChat(ambient, time) {
    if (time < ambient.emoteAt) return;
    ambient.emoteAt = time + AMBIENT_CHAT_EMOTE_MIN_MS + Math.random() * (AMBIENT_CHAT_EMOTE_MAX_MS - AMBIENT_CHAT_EMOTE_MIN_MS);
    this.spawnAmbientEmote(ambient.sprite.x, ambient.sprite.y - 22);
  }

  spawnAmbientEmote(x, y) {
    const container = this.add.container(x, y).setDepth(200000).setScale(0.4);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1c2c, 0.85).fillRoundedRect(-12, -10, 24, 20, 4);
    const glyph = this.add.text(0, 0, '...', { fontFamily: FONT, fontSize: '10px', color: COLORS.text }).setOrigin(0.5);
    container.add([bg, glyph]);
    this.tweens.add({ targets: container, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.time.delayedCall(700, () => {
      this.tweens.add({ targets: container, alpha: 0, duration: 200, onComplete: () => container.destroy() });
    });
  }

  // "Only update ones near the camera" (this task's own brief, performance): an ambient NPC outside
  // the camera's own view (+ a small margin) is simply left exactly where it is -- no waypoint
  // advance, no pause-timer countdown -- so it neither drifts off its authored route nor "catches up"
  // all at once the moment it's back on screen; it just quietly waits, the same as a real pedestrian
  // would if the world weren't looking. 'idle'/'chat' NPCs never move at all, so only 'patrol'/'chat'
  // need any per-frame work in the first place.
  updateAmbient(time) {
    if (!this.ambientNpcs || !this.ambientNpcs.length) return;
    const view = this.cameras.main.worldView;
    const left = view.x - AMBIENT_CULL_MARGIN;
    const right = view.x + view.width + AMBIENT_CULL_MARGIN;
    const top = view.y - AMBIENT_CULL_MARGIN;
    const bottom = view.y + view.height + AMBIENT_CULL_MARGIN;
    for (const ambient of this.ambientNpcs) {
      const s = ambient.sprite;
      const onScreen = s.x >= left && s.x <= right && s.y >= top && s.y <= bottom;
      if (!onScreen) { if (ambient.def.kind === 'patrol') s.setVelocity(0, 0); continue; }
      if (ambient.def.kind === 'patrol') this.updateAmbientPatrol(ambient, time);
      else if (ambient.def.kind === 'chat') this.updateAmbientChat(ambient, time);
    }
  }

  // ADR 0016: hidden for the whole time a script owns the screen (the bus/Mustafa opening, the Gate 2/
  // entrance/key-room beats) -- "freeze/hide during scripted cutscenes if they'd be in the way" (this
  // task's own brief). Freezing is already free (updateAmbient() is only ever called from update(),
  // which bails out for the whole script via `this.transitioning`); this just also keeps a patrolling
  // student from wandering through a shot she was never blocked from reaching mid-script.
  setAmbientVisible(visible) {
    for (const ambient of this.ambientNpcs || []) {
      ambient.sprite.setVisible(visible);
      ambient.shadow.setVisible(visible);
    }
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
    this.movePlayer(blocked, time, delta);
    this.updatePickups();
    this.updatePrompt(blocked, time);
    this.checkWarps();
    this.checkAreas();
    this.checkCutscene();
    this.checkKeyRoomBeats();
    this.updateAmbient(time);
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
    if (event.repeat || !this.sys.isActive()) return;
    const ui = this.scene.get('ui');
    if (!ui.tutorial) return;
    // ADR 0016: a script's own `say` step (src/scripts-runtime.js) reuses this exact dialog box, so
    // advancing it has to work even while `this.transitioning` is set for the whole script -- the same
    // reasoning Esc's own skip already follows (see the keydown-ESC handler right above create()'s own
    // door-departure comment on this flag). Starting a *new* conversation (interact()) still isn't
    // allowed mid-script/mid-door-walk, only reading the lines already on screen.
    if (ui.dialog.isOpen) { ui.dialog.advance(); return; }
    if (this.transitioning || ui.isBlocking()) return;
    this.interact();
  }

  movePlayer(blocked, time, delta) {
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
    // ADR 0015: depth by feet, not the sprite's own anchor -- see PLAYER_FEET_OFFSET's own comment.
    p.setDepth(p.y + PLAYER_FEET_OFFSET);
    this.playerShadow.setPosition(p.x, p.y + 9).setDepth(p.y + PLAYER_FEET_OFFSET - 1);
    p.anims.timeScale = running ? RUN_ANIM_SCALE : 1;

    const moved = Phaser.Math.Distance.Between(this.lastPosition.x, this.lastPosition.y, p.x, p.y);
    this.lastPosition.set(p.x, p.y);
    if (moved > 0) this.game.events.emit('player-moved', moved);

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const interval = this.def.indoors ? FOOTSTEP_INTERVAL_INDOOR_MS : (running ? FOOTSTEP_INTERVAL_RUN_MS : FOOTSTEP_INTERVAL_WALK_MS);
      AudioManager.playThrottled(this.nextFootstepSound(), 'footstep', interval, time);
    }
    if (!moving) {
      // Idle animation (ADR 0013), not a hard stop-on-a-frame: a slow blink/bob, STYLE_GUIDE's
      // "gentle life" rule for a character that's just standing there.
      p.anims.play(`idle-${this.facing}`, true);
    } else if (dx !== 0) {
      // FB-0043: real left/right art, never a mirrored "side" row -- see createAnimations().
      this.facing = dx < 0 ? 'left' : 'right';
      p.anims.play(`walk-${this.facing}`, true);
    } else {
      this.facing = dy < 0 ? 'up' : 'down';
      p.anims.play(`walk-${this.facing}`, true);
    }

    // Footstep dust (ADR 0015): a small puff at her feet every so often while actually running
    // outdoors -- never indoors (running itself is already off indoors, FB-0017, so this piggybacks
    // on that same `running` flag), never while merely idling with Shift held (guarded by `moving`).
    if (running && moving) {
      this.dustAccum = (this.dustAccum || 0) + delta;
      if (this.dustAccum >= DUST_INTERVAL_MS) {
        this.dustAccum = 0;
        spawnDustPuff(this, p.x, p.y + 9);
      }
    } else {
      this.dustAccum = 0;
    }

    this.updateHeldItem(time, moving);
  }

  // Every warp trigger point on this map, in one shape: text-map `warps` entries (already
  // {x,y,to,spawn}, ADR 0015 `kind: 'door'` -- nothing in this game uses a text-map stairs) plus
  // Tiled `door`/`stairs` objects with a `to` property (campus buildings, interior stairs). Used by
  // both doorAssist (below) and checkWarps, through the cached getWarpPoints() below -- call this
  // directly only to rebuild the cache from scratch (map load, or a stage change).
  // `locked`/`lockedReason` (roadmap M1 "Blocked doors", docs/STORY.md "Rules for the world") come
  // from the map def's own `doorLocks` (src/maps.js), matched by the object's exact Tiled name --
  // see src/maplogic.js doorLockRule()/isDoorLocked(). A text-map `warps` entry is never locked
  // (nothing in this game gates the meadow/house test maps). `openTiles` (ADR 0015) is parsed once
  // here too (src/maplogic.js parseOpenTiles()) -- null when the property's missing, so every caller
  // downstream already gets the "no property -> no overlay, walk-in still happens" fallback for free.
  computeWarpPoints() {
    const textWarps = (this.def.warps || []).map((w) => ({
      ...w, kind: w.kind || 'door', locked: false, lockedReason: null, _rule: null,
      openTiles: parseOpenTiles(w.openTiles),
    }));
    const objectWarps = (this.mapObjects || [])
      .filter((o) => (o.type === 'door' || o.type === 'stairs') && o.props.to)
      .map((o) => {
        const rule = doorLockRule(this.def.doorLocks, o.name);
        return {
          x: Math.floor(o.x), y: Math.floor(o.y), width: o.width, to: o.props.to, spawnAt: o.props.toId,
          name: o.name, kind: o.type, openTiles: parseOpenTiles(o.props.openTiles),
          locked: isDoorLocked(rule, GameState.quest.stage), _rule: rule,
          lockedReason: (rule && rule.reason) || 'Locked for the event',
          // M5 sound (checkWarps() below): a Tiled 'stairs' object gets the warp/stairs sfx, a 'door'
          // (or a plain text-map warp, which has no `type` at all) gets the door-open sfx.
          type: o.type,
        };
      });
    return [...textWarps, ...objectWarps];
  }

  // Cached per docs/plans/2026-09-26-premium-pass.md's own performance note: this used to be rebuilt
  // (a fresh array, fresh objects) twice a frame -- doorAssist() and checkWarps() both calling
  // warpPoints() directly. The only thing that can change after map load is which doors are locked,
  // and only when the quest stage changes, so that's the only recompute this does on a cache hit.
  getWarpPoints() {
    if (!this._warpPointsCache) {
      this._warpPointsCache = this.computeWarpPoints();
      this._warpStage = GameState.quest.stage;
    } else if (this._warpStage !== GameState.quest.stage) {
      this._warpStage = GameState.quest.stage;
      for (const w of this._warpPointsCache) w.locked = isDoorLocked(w._rule, GameState.quest.stage);
    }
    return this._warpPointsCache;
  }

  // Doors are one or two tiles wide, so walking at one slightly off-center would snag on the wall.
  // If a warp tile is just ahead, return a sideways speed that slides the player into line.
  doorAssist(dy, speed) {
    const body = this.player.body;
    const aheadY = Math.floor((dy < 0 ? body.top - 2 : body.bottom + 2) / TILE);
    const warp = this.getWarpPoints().find(
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
    // HELD_OFFSET has its own separate left/right entry, in screen space, so the offset itself
    // decides which side it sits on -- the player sprite is never flipped at all now (FB-0043: real
    // left/right art), so the held item never needs to be either.
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
      .setPosition(x + offset.x, y + offset.y + bob)
      .setDepth(p.depth + (offset.front ? 1 : -1))
      .setVisible(true);
  }

  // Cycles through the 4 outdoor/indoor footstep samples (src/audio.js SOUNDS) so it's never the
  // exact same one twice in a row -- called every moving frame regardless of whether the throttle in
  // AudioManager.playThrottled() actually lets this particular one play, which is harmless (just a
  // counter) and keeps the cycle from bunching up around whichever sample happened to play last.
  nextFootstepSound() {
    const set = this.def.indoors ? FOOTSTEP_INDOOR_SOUNDS : FOOTSTEP_OUTDOOR_SOUNDS;
    this.footstepCycle = ((this.footstepCycle ?? -1) + 1) % set.length;
    return set[this.footstepCycle];
  }

  // Whatever E would interact with right now, or null if nothing is in INTERACT_RANGE: a story NPC, an
  // ambient student or a key station (all share the same INTERACT_RANGE and the same underlying dialog
  // data, docs/ARCHITECTURE.md "content is data"). Which one wins is src/maplogic.js
  // pickInteractable(): the nearest, except a story object (INTERACT_PRIORITY: key station > quest
  // giver > ambient student) within INTERACT_TIE_MARGIN of it wins -- an exact tie never goes to an
  // ambient student any more. Ambient students/staff (createAmbient()) carry the same { def,
  // idleFrames } shape as a real story NPC, so they need no separate branch anywhere else E-interaction
  // touches (pickDialogEntry(), the "face her" turn, the prompt bubble): `kind` is 'npc' for both, only
  // `role` (the priority key) tells them apart. `def` is what pickDialogEntry()/hasNewDialog() need
  // ({ id, dialog }); `label` is what the dialog box's name tag shows.
  nearestInteractable() {
    const candidates = [];
    const consider = (role, kind, target, def) => {
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y);
      if (distance < INTERACT_RANGE) candidates.push({ role, kind, target, def, label: def.name, distance });
    };
    for (const npc of this.npcs) consider('questNpc', 'npc', npc, npc.def);
    for (const ambient of this.ambientNpcs || []) consider('ambientNpc', 'npc', ambient.sprite, ambient.sprite.def);
    for (const ks of this.keyStations || []) consider('keyStation', 'keyStation', ks, ks.def);
    return pickInteractable(candidates);
  }

  interact() {
    const found = this.nearestInteractable();
    if (!found) return;

    if (found.kind === 'npc') {
      const npc = found.target;
      // Turn the NPC to face the player. FB-0043: a `character` NPC (the recolored pack sprites,
      // `npc.idleFrames === PLAYER_IDLE`) has its own real left *and* right frames now, so it's shown
      // unflipped either way; the legacy hand-drawn 'npc' texture (Tomas/Guide, NPC_FRAME) still only
      // has one side-facing frame (`left === right`), so it keeps the old mirror-for-the-other-side
      // trick -- that sheet is unchanged on purpose (see tools/make-assets.js's own comment on it).
      const dx = this.player.x - npc.x;
      const dy = this.player.y - npc.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        const facingRight = dx > 0;
        if (npc.idleFrames.left === npc.idleFrames.right) npc.setFrame(npc.idleFrames.left).setFlipX(facingRight);
        else npc.setFrame(facingRight ? npc.idleFrames.right : npc.idleFrames.left).setFlipX(false);
      } else {
        npc.setFrame(dy < 0 ? npc.idleFrames.up : npc.idleFrames.down).setFlipX(false);
      }
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
    // FB-0036: emitted *after* dialog.open() (which sets DialogBox.isOpen synchronously), not before
    // it -- Tutorial.complete('talk') (src/scenes/ui.js) is what this drives, and its own finish()
    // announcement waits for `dialog.isOpen` to go true-then-false before showing "Tutorial
    // complete!"; emitting this before the box opened let that check see `isOpen === false` a beat
    // too early and race the conversation instead of actually waiting for it to close.
    if (found.kind === 'npc') this.game.events.emit('npc-talked', found.target.def.id);
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
        AudioManager.play('itemPickup');
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
    const warp = this.getWarpPoints().find((w) => w.x === tileX && w.y === tileY);
    if (!warp) {
      this.lockedWarned = null;
      return;
    }

    // Locked (roadmap M1 "Blocked doors", docs/STORY.md): a toast, not a silent wall -- thrown once
    // per approach (the same "warned" throttle updatePickups() uses for a full bag), not every frame
    // she stands on the tile. ADR 0015: a locked *door* also rattles (never opens); stairs never had
    // an overlay/rattle to begin with, so they're unaffected -- just the toast, same as before.
    if (warp.locked) {
      if (this.lockedWarned !== warp.name) {
        this.lockedWarned = warp.name;
        this.game.events.emit('toast', warp.lockedReason);
        AudioManager.play('lockedDoorThud');
        if (warp.kind === 'door') this.rattleDoor(warp);
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

    // ADR 0015: `transitioning = true` here (not just once the fade actually starts) is what keeps
    // mashing Esc/any other key from ever double-warping or soft-locking -- update() (and every
    // one-shot keydown handler, onInteractKey()) bails out immediately while this is true, for the
    // whole walk-in + fade, exactly as it already did for the plain fade before this ADR.
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.prompt.setVisible(false);
    this.playDoorDeparture(warp);
  }

  // ADR 0015 "Pokemon style" door entry, departure half: she keeps walking (the walk animation stays
  // on, one tile further in the direction she was already heading), *then* the screen fades and the
  // map actually changes -- never an instant cut the moment her feet cross the trigger tile. Stairs
  // get the same shape, just shorter and with no door overlay (there's nothing to open/close).
  playDoorDeparture(warp) {
    const facing = this.facing;
    // The door/stairs sound plays right here, at the moment the door actually opens (audio merge,
    // src/audio.js) -- not at the old fadeOut point, since that's now a full walk-in later.
    AudioManager.play(warp.kind === 'stairs' ? 'warpStairs' : 'doorOpen');
    const overlay = warp.kind === 'door' ? this.showDoorOverlay(warp) : null;
    this.walkThroughDoor(facing, warp.kind, () => {
      this.player.anims.stop();
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        if (overlay) overlay.destroy();
        this.scene.restart({ map: warp.to, spawn: warp.spawn, spawnAt: warp.spawnAt, viaWarpKind: warp.kind });
      });
    });
  }

  // ADR 0015 door entry, arrival half (the reverse of playDoorDeparture): she appears hidden in the
  // doorway (the tile the departing warp was triggered from, derived from her own spawn point +
  // facing -- src/maplogic.js doorTileFromSpawn(), the exact inverse of resolveSpawnAt()'s forward
  // math) and walks out to her real spawn point, door overlay open then closed behind her. Called
  // from create() only when `viaWarpKind` was actually set (a real warp sent her here, not the
  // initial boot/continue/`?map=` debug entry) -- `this.transitioning` blocks input for exactly as
  // long as this takes, the same way a departure's own fade does.
  playDoorArrival(kind) {
    this.transitioning = true;
    const facing = this.spawn.facing || this.facing;
    const doorTile = doorTileFromSpawn(this.spawn, facing);
    this.player.setPosition(toPixel(doorTile.x), toPixel(doorTile.y));
    this.player.body.reset(this.player.x, this.player.y);
    this.syncDoorVisuals();

    // The SAME warp data the departure side would have used, just read from this (the arrival) map's
    // own getWarpPoints() -- a door's `openTiles` is authored per side, so this is deliberately not
    // just "whatever the departing scene passed along".
    const warp = this.getWarpPoints().find((w) => w.x === doorTile.x && w.y === doorTile.y) || null;
    const overlay = kind === 'door' && warp ? this.showDoorOverlay(warp) : null;
    // The same door/stairs sound as the departure side (src/audio.js), played again here since this
    // is a second, real "the door opens" moment -- she appears behind a closed door and it opens for
    // her to walk out, the reverse of playDoorDeparture()'s own opening beat above.
    AudioManager.play(kind === 'stairs' ? 'warpStairs' : 'doorOpen');
    this.walkThroughDoor(facing, kind, () => {
      if (overlay) overlay.destroy();
      this.transitioning = false;
    }, { x: toPixel(this.spawn.x), y: toPixel(this.spawn.y) });
  }

  // Shared walk animation for both halves above: plays the walk cycle in `facing` while tweening the
  // player exactly one tile further that way (or straight to `to`, for the arrival side, which walks
  // from the doorway back to her real spawn point -- not always exactly one tile, e.g. the house's
  // own half-tile-centered doorway). Keeps depth/shadow/held-item in sync every tick via
  // syncDoorVisuals(), since `this.transitioning` skips the normal movePlayer() path entirely for
  // this whole sequence.
  walkThroughDoor(facing, kind, onComplete, to) {
    const p = this.player;
    const [dx, dy] = DIRECTION_OFFSET[facing] || [0, 0];
    const targetX = to ? to.x : p.x + dx * TILE;
    const targetY = to ? to.y : p.y + dy * TILE;
    const duration = kind === 'stairs' ? STAIRS_WALK_MS : DOOR_WALK_MS;
    p.anims.play(`walk-${facing}`, true);
    this.tweens.add({
      targets: p,
      x: targetX,
      y: targetY,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        p.body.reset(p.x, p.y);
        this.syncDoorVisuals();
      },
      onComplete,
    });
  }

  // Keeps the player's depth/shadow/held-item current during a scripted door-sequence tween, the
  // same bookkeeping movePlayer() does every frame normally -- needed here because `this.transitioning`
  // makes update() skip movePlayer() entirely for the whole sequence.
  syncDoorVisuals() {
    const p = this.player;
    p.setDepth(p.y + PLAYER_FEET_OFFSET);
    this.playerShadow.setPosition(p.x, p.y + 9).setDepth(p.y + PLAYER_FEET_OFFSET - 1);
    this.updateHeldItem(this.time.now, true);
  }

  // The depth an open-door overlay (or a rattle) should draw at: just above whichever depth group
  // covers the door's own tile (src/maplogic.js depthGroupAt(), the exact same "smallest wins" rule
  // buildDepthGroups() baked the group images with) -- falling back to the door row's own base line
  // if it isn't inside any group at all (a text map door with no depth group declared, say).
  doorOverlayDepth(warp) {
    const group = depthGroupAt(this.depthGroups || [], warp.x, warp.y);
    return (group ? group.depth : (warp.y + 1) * TILE) + 1;
  }

  // A single door tile's art as a floating Image, using its own registered frame on the 'tiles'
  // texture (ensureTileFrames(), called here defensively since a map with a door but no depth group
  // at all would otherwise never have registered them) -- shared by showDoorOverlay() (the
  // `openTiles` art) and rattleDoor() (whatever's already there).
  tileImage(px, py, tileIndex) {
    this.ensureTileFrames();
    return this.add.image(px, py, 'tiles', tileIndex).setOrigin(0, 0);
  }

  // ADR 0015: the open-doorway overlay, shown over a door's own tile(s) while she walks through --
  // null (no overlay at all) when the warp has no `openTiles` (the graceful fallback: the walk-in/out
  // still happens regardless, docs/plans/2026-09-26-premium-pass.md "your code must work with [real
  // openTiles] data when it lands"). Tiles are laid out left to right starting at the warp's own tile.
  showDoorOverlay(warp) {
    if (!warp.openTiles) return null;
    const depth = this.doorOverlayDepth(warp);
    const images = warp.openTiles
      .map((name, i) => {
        const index = this.tileInfo.tiles.findIndex((t) => t.name === name);
        if (index === -1) {
          console.warn(`"${warp.name || warp.to}": unknown openTiles tile "${name}"`);
          return null;
        }
        return this.tileImage((warp.x + i) * TILE, warp.y * TILE, index).setDepth(depth);
      })
      .filter(Boolean);
    return { destroy: () => images.forEach((img) => img.destroy()) };
  }

  // Locked door feedback (ADR 0015): the door itself shakes a couple of px for ~200ms -- using
  // whatever tile is *actually* there right now (read straight off the live layer, not `openTiles`),
  // so this works even for a door with no `openTiles` authored at all, unlike showDoorOverlay() above.
  rattleDoor(warp) {
    const doorWidth = Math.max(1, Math.round(warp.width || 1));
    const depth = this.doorOverlayDepth(warp);
    // Reversed: prefer a non-ground layer (e.g. 'structures', where a door's own art actually lives)
    // over 'ground' happening to also have a tile painted at the same spot underneath it.
    const layer = [...this.solidLayers].reverse().find((l) => l.getTileAt(warp.x, warp.y));
    if (!layer) return;
    const images = [];
    for (let i = 0; i < doorWidth; i++) {
      const tile = layer.getTileAt(warp.x + i, warp.y);
      if (!tile) continue;
      images.push(this.tileImage((warp.x + i) * TILE, warp.y * TILE, tile.index - 1).setDepth(depth));
    }
    if (!images.length) return;
    this.tweens.add({
      targets: images, x: '+=2', duration: Math.round(DOOR_RATTLE_MS / 5), yoyo: true, repeat: 4,
      onComplete: () => images.forEach((img) => img.destroy()),
    });
  }

  // The named area/zone object (if any) the player's feet are currently inside, smallest match wins
  // (objectAt in maplogic.js), e.g. "Athletics Track" over the whole campus outline. Building names
  // come from 'zone' objects (one per real footprint rectangle, generated alongside the coarser
  // 'building' bbox used only for labels -- QA: the bbox of an L-shaped building can spill into a
  // neighbouring building's plaza and win there, which 'zone's precise footprint rectangles don't).
  areaHere() {
    // Quality loop, category 1 run 3 (2026-09-29): the fallback-to-nearest-named-building logic lives
    // in maplogic.js (nearestNamedArea) as a plain, unit-testable function -- see its comment there
    // for why a building's own 'zone' isn't always enough and the campus-wide fallback needs help.
    return nearestNamedArea(this.mapObjects, this.player.x / TILE, this.player.y / TILE);
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

  // Gate 2 / Main Block entrance cutscene triggers (P4, ADR 0016): a Tiled rectangle object,
  // `type: 'cutscene'` with a `cutscene` property naming a key -- SCRIPTS (src/scripts.js, the
  // in-world script runner) if one exists there, else CUTSCENES (src/cutscenes.js, the retired
  // static-illustration player) as a fallback for anything never migrated. Plays once per session
  // (GameState.seenCutscenes) and can be turned off with ?cutscene=0 (tests that would otherwise walk
  // through it).
  checkCutscene() {
    if (!cutscenesEnabled()) return;
    const feetX = this.player.body.center.x / TILE;
    const feetY = (this.player.body.bottom - 1) / TILE;
    const trigger = objectAt(this.mapObjects, ['cutscene'], feetX, feetY);
    const key = trigger && trigger.props.cutscene;
    if (!notSeenCutscene(key, GameState.seenCutscenes)) return;
    if (SCRIPTS[key]) this.playScript(key, SCRIPTS[key]);
    else this.playCutscene(key);
  }

  // ADR 0016: runs an in-world script (src/scripts-runtime.js ScriptRunner), the same play-once
  // bookkeeping playCutscene() below already does for the old static-illustration player -- a script
  // never pauses/launches another scene, so there's nothing else to hand off to or resume here.
  playScript(key, steps) {
    GameState.seenCutscenes.add(key);
    this.game.events.emit('cutscene-seen', key); // src/save.js autosaves soon after
    // Ambient students/staff never appear in a script's own blocking/staging (they're not script
    // actors, src/scripts-runtime.js) -- hidden for the run so a patrolling one can't wander through
    // the shot, back once it ends (this task's own brief: "freeze/hide during scripted cutscenes").
    this.setAmbientVisible(false);
    this.scriptRunner.run(steps).then(() => this.setAmbientVisible(true));
  }

  // The full M3a opening's own bus-arrival-then-Mustafa-meets-her beat (docs/STORY.md "Opening",
  // src/scripts.js SCRIPTS.opening) -- started once, right here, instead of waiting for her to walk
  // into the Gate 2 trigger the way the fast path does, since she has no control to walk anywhere with
  // yet. Marks 'gate2' seen up front (not after the script finishes) so the Gate 2 trigger she's about
  // to be walked past by that same script -- her first real steps land a few tiles beyond it, same as
  // before this ADR -- can never fire a second, redundant copy of the same beat right behind it.
  playOpeningSequence() {
    GameState.seenCutscenes.add('gate2');
    this.game.events.emit('cutscene-seen', 'gate2');
    this.setAmbientVisible(false);
    this.scriptRunner.run(SCRIPTS.opening).then(() => this.setAmbientVisible(true));
  }

  // The 3 key-room beats (docs/STORY.md beat 8, ADR 0016): unlike the Gate 2/entrance triggers, no
  // Tiled trigger object names these -- a key station's own desk (already map data, src/maps.js
  // `keyStations`) doubles as the trigger, firing once she's within ROOM_BEAT_RANGE of it (wider than
  // INTERACT_RANGE: "walking in" reads as approaching the desk from across the room, not standing right
  // on top of it) and hasn't taken that key yet. Keyed the same way as any other cutscene
  // (`GameState.seenCutscenes`, `keyRoom:<id>`) so a reload never replays it.
  checkKeyRoomBeats() {
    if (!cutscenesEnabled()) return;
    for (const ks of this.keyStations || []) {
      if (ks.taken) continue;
      const key = `keyRoom:${ks.def.id}`;
      if (GameState.seenCutscenes.has(key)) continue;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, ks.x, ks.y);
      if (distance > ROOM_BEAT_RANGE) continue;
      const scriptKey = KEY_ROOM_SCRIPT[ks.def.id];
      if (!scriptKey || !SCRIPTS[scriptKey]) continue;
      this.playScript(key, SCRIPTS[scriptKey]);
    }
  }

  // FB-0033 (onboarding): where the always-on destination arrow/minimap marker should point right now,
  // in tile coordinates on THIS map -- null if the current objective's route (src/objective-routes.js)
  // doesn't name a stop here (she's off-route) or the named anchor/npc/key station can't be resolved.
  // src/scenes/ui.js Minimap/FullMap/Onboarding all call this directly rather than recomputing the
  // routing themselves.
  currentObjectiveAnchor() {
    const step = objectiveTarget(this.mapKey, GameState.quest);
    if (!step) return null;
    if (step.anchor) return resolveAnchor(this.mapObjects, step.anchor);
    if (step.npc) {
      const npc = (this.npcs || []).find((n) => n.def.id === step.npc);
      return npc ? { x: npc.x / TILE, y: npc.y / TILE } : null;
    }
    if (step.keyStation) {
      const ks = (this.keyStations || []).find((k) => k.def.id === step.keyStation);
      return ks ? { x: ks.x / TILE, y: ks.y / TILE } : null;
    }
    return null;
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

  // The ending (docs/STORY.md "the box opens..."): unlike playCutscene()/launchMinigame() above,
  // nothing ever resumes 'world' or 'ui' afterwards -- src/scenes/box-opening.js hands off straight
  // to src/scenes/card.js, which ends on the title screen (docs/ROADMAP.md M3 "returns to the title
  // screen, keeping the save"), the same way PauseMenu.quitToTitle() (src/scenes/ui.js) stops both
  // scenes on its way there. Stopping 'ui' here (not just pausing 'world') also avoids a real bug a
  // pause would leave behind: 'ui' would keep listening for Esc the whole time box-opening/card own
  // the screen, and -- since its own dialog is closed by this point -- would open the pause menu
  // right underneath them. Triggered by the volunteer's 'reward' dialog entry's last action
  // (src/story.js, `{ boxOpening: true }`).
  playBoxOpening() {
    this.player.setVelocity(0, 0);
    this.player.anims.stop();
    this.prompt.setVisible(false);
    this.scene.stop('ui');
    this.scene.pause();
    this.scene.launch('box-opening');
  }
}

// Tile coordinate -> pixel at the center of that tile
function toPixel(tile) {
  return tile * TILE + TILE / 2;
}
