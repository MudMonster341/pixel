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
// Golden hour (createDaylight() below): the tint sits above EVERYTHING in this scene, the overhead canopies included (the UI is another scene).
const DAYLIGHT_OVERLAY_DEPTH = 2_000_000;
const INTERACT_RANGE = 24;
const PICKUP_RANGE = 10;
// ADR 0016: how close she has to walk to a key station's desk for its own "walking in" beat to fire --
// bigger than INTERACT_RANGE, since the point is catching her entering the room, not standing on the
// desk (docs/STORY.md beat 8). Maps each key station id to its own SCRIPTS key (src/scripts.js).
const ROOM_BEAT_RANGE = 90;
const KEY_ROOM_SCRIPT = { physicsLab: 'keyRoomPhysicsLab', icl: 'keyRoomIcl', room195: 'keyRoomRoom195' };
const DOOR_ASSIST_RANGE = 12; // how far off-center you can walk at a door and still slide in
// P5c (FB-0071): tile animations (blinking rack LEDs, the holo globe, the scanner's pulse) are re-read this often; each one still changes frame
// on its own `ms` (never faster than about 3 times a second).
const TILE_ANIM_TICK_MS = 120;
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
// ADR 0018 (animals): like ambient students, an animal farther than this outside the camera's view is
// simply left alone until it is back in view (a bird that has flown off keeps its "come back" timer
// running regardless: a 'gone' animal costs nothing). How long a student stands still after the
// dialog closes before walking on.
const ANIMAL_CULL_MARGIN = 96;
const AMBIENT_TALK_RESUME_MS = 600;
// The animal's feet sit this many px below its tile centre (a character's feet are 8 below its origin).
const ANIMAL_FEET_OFFSET = 7;
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
// FB-0046: the door walk is at WALKING speed (WALK_SPEED, never the run speed she may have arrived
// at the door with) and always plays the walk animation at its normal rate -- one tile takes
// DOOR_WALK_MS, a longer arrival walk takes proportionally longer (walkThroughDoor()).
const DOOR_WALK_MS = Math.round((16 / WALK_SPEED) * 1000); // one 16px tile at walking speed
const DOOR_WALK_MIN_MS = 120;
const STAIRS_WALK_MS = 150;
const DOOR_RATTLE_MS = 200;
// P4c (FB-0067): every door and lift opens and closes in DOOR_FRAME_MS steps (src/maplogic.js doorFrames(): closed, half, open = 160 ms).
// A lift she arrives at opens, stays open a beat (she is standing right in front of it) and closes again.
const LIFT_ARRIVAL_HOLD_MS = 450;
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
    // The moments (src/moments.js): how many have started on THIS visit of this map. WorldScene restarts for every map change, so a
    // new visit starts at 0; at most MOMENT_PER_VISIT may start per visit.
    this.momentsThisVisit = 0;
    // Seconds of FREE control since a script / cutscene / dialog / door walk / overlay last owned the screen (src/moments.js
    // advanceFreeSeconds()); a moment's `afterFreeS` waits on it. A new map visit (a door walk just happened) starts at 0.
    this.freeSeconds = 0;
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
    // P4c (FB-0067): every door-animation overlay alive right now (showDoorOverlay()), by door, so a second animation on the same door
    // replaces the first and the scene's shutdown (a restart mid-animation) can sweep up whatever is left.
    this.doorAnims = new Map();
    this.tileAnims = []; // P5c: the tile animations of THIS map (createScanners()/createTileAnims()); a restart starts from none
    this.scanners = [];
    this.gates = [];
    this.gateBarrier = null; // FB-0077: this map's Gate 2 boom barrier (createGateBarrier()), if it has one
  }

  // FB-0072 (the one choke point): `transitioning` is the flag every "the player does not have the
  // wheel" moment already sets -- an in-world script (ScriptRunner.run()/lockInput, the Gate 2 welcome, the
  // Main Block entrance, the key-room beats, the opening), a door's walk-in/out, a warp's fade. update()
  // returns at its very top while it is set, so movePlayer() never runs again to zero her velocity or
  // swap her animation: a script or door that began while she was RUNNING left her sliding on at run speed
  // with the run animation playing under the dialog box ("the character is running all the time", FB-0072;
  // the same thing carried her up the Main Block's steps over the door during its entrance beat, FB-0046).
  // Making it an accessor means every one of those writers, present and future, stops her the instant it
  // sets the flag, without each having to remember to. (Overlays that merely block input -- dialog, journal,
  // map, pause menu -- are covered by movePlayer(blocked) on the next frame; mini-games, cutscenes and
  // the box opening call haltPlayer() directly as they pause this scene.)
  get transitioning() {
    return this._transitioning === true;
  }

  set transitioning(value) {
    const next = Boolean(value);
    const was = this._transitioning === true;
    this._transitioning = next;
    if (next && !was) this.haltPlayer();
  }

  // Stops the player dead: zero velocity, the walk/run animation stopped and its faster run rate
  // reset, the idle frame of the direction she is facing showing. Held movement keys do nothing
  // while a screen owns the game (movePlayer's `blocked`/update()'s `transitioning`) and movement
  // resumes normally from whatever keys are still down once it ends.
  haltPlayer() {
    const p = this.player;
    if (!p || !p.active || !p.body) return;
    p.setVelocity(0, 0);
    p.anims.timeScale = 1;
    p.anims.stop();
    p.setFrame(PLAYER_IDLE[this.facing] ?? PLAYER_IDLE.down);
    this.dustAccum = 0;
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
    this.createAnimals();
    this.createPickups();
    this.createKeyStations();
    this.createLifts();
    // P5c (FB-0071): the ICL's locked door, its scanner (the EDI test console), and the lab's blinking lights.
    this.createScanners();
    this.createGates();
    this.createTileAnims();
    this.createGateBarrier(); // FB-0077: the Gate 2 boom raises as she nears it and stays up
    // P4c: a restart mid-animation (a warp's fade ending, the player quitting) must never leave a door overlay or its timers behind.
    this.events.once('shutdown', () => this.destroyDoorAnims());

    const { widthInPixels: width, heightInPixels: height } = this.map;
    this.physics.world.setBounds(0, 0, width, height);
    // Camera feel (ADR 0015): smooth follow (a real lerp, not the instant snap `startFollow`'s own
    // default lerp of 1 was giving it before) with roundPixels (unchanged, also set globally in
    // src/main.js's game config) so tiles/characters never shimmer sub-pixel. `centerOn` right after
    // is the "camera settle" -- without it, a freshly restarted scene's camera starts at its own
    // default scroll and would visibly glide/pan onto the player over the first several frames of
    // the fade-in, reading as its own little cut; centering once, immediately, means the lerp only
    // ever has to catch up to *real* movement from here on, never a warp's own teleport.
    // FB-0059: indoors, everything off the map (and the void inside it) is black, never the page's dark blue-grey.
    if (this.def.indoors) this.cameras.main.setBackgroundColor('#000000');
    this.cameras.main.setZoom(ZOOM).setBounds(0, 0, width, height)
      .startFollow(this.player, true, 0.18, 0.18)
      .centerOn(this.player.x, this.player.y)
      .fadeIn(250, 0, 0, 0);
    // Golden hour: the light for the current phase of the hunt (src/daylight.js); after the camera is zoomed, since it is sized from it.
    this.createDaylight();

    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT');
    // One-shot keys use keydown events; polling JustDown loses taps shorter than a frame (ERR-0001).
    this.input.keyboard.addCapture('SPACE');
    // FB-0045: Enter does exactly what E and Space do (talk, next line, pick a choice) -- ONE handler for
    // all three, so a single key press can never both advance a box and start a new conversation.
    for (const key of ['E', 'SPACE', 'ENTER']) this.input.keyboard.on(`keydown-${key}`, (event) => this.onInteractKey(event));

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

    // W6 (src/selfie.js): P frames her and the friends near her, flashes, shows a polaroid card and downloads the PNG. The controller ends whatever
    // it is doing (the preview, the one hidden HUD frame, the timers) when this scene shuts down, e.g. a door was walked through mid-sequence.
    this.selfie = createSelfie(this);
    this.input.keyboard.on('keydown-P', (event) => this.onSelfieKey(event));
    this.events.once('shutdown', () => this.selfie.destroy());

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
    // P4b: she arrives from a lift ride (warpTo() below) standing in front of its doors, no walk-out: the lift "dings".
    if (this.viaWarpKind === 'lift') AudioManager.play('liftDing');
    else if (this.viaWarpKind) this.playDoorArrival(this.viaWarpKind);
    if (this.viaWarpKind === 'lift') this.playLiftArrival();

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
        this.overheadLayer = this.map.createLayer(overheadDef.name, tileset, 0, 0).setDepth(OVERHEAD_DEPTH).setAlpha(overheadAlpha(this.def)); // D10: see-through indoors
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
      // P5c (FB-0071): a hovering NPC (Alice) bobs gently instead of standing in a still pose: the two idle poses of her sheet's row, 2 fps, yoyo.
      if (def.hover && def.character) this.playHoverAnim(npc, textureKey, def.facing || 'down');
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

  // P5c: the idle bob of a hovering NPC (`hover: true` on its def, src/maps.js): frames 0/7 of its facing's row (the sheet layout every
  // character shares, CHAR_COLS), one animation per sheet and direction, shared by every NPC that uses the sheet.
  playHoverAnim(npc, textureKey, dir) {
    const rows = { down: [0, 7], up: [8, 15], left: [16, 23], right: [24, 31] };
    const key = `${textureKey}-hover-${dir}`;
    if (!this.anims.exists(key)) {
      this.anims.create({ key, frames: this.anims.generateFrameNumbers(textureKey, { frames: rows[dir] || rows.down }), frameRate: 2, yoyo: true, repeat: -1 });
    }
    npc.anims.play(key, true);
  }

  // Ambient campus/Main Block life (quality loop, Characters and depth run 1: "the world is empty").
  // Content is src/ambient.js (docs/ARCHITECTURE.md "content is data"); this only builds the sprites.
  // A much lighter-weight cousin of createNpcs() above -- same texture/body/collider/shadow shape, so
  // interact()'s own "turn to face her" logic and nearestInteractable() work on an ambient
  // NPC exactly like a story one, without needing to know the difference -- but *moving*, updated
  // every frame by updateAmbient() (patrol waypoints, the "pause near her" yield, the chat pairs' own
  // emote), which createNpcs()'s own always-still NPCs never needed.
  createAmbient() {
    // `unlessMoment` (src/ambient.js: Prof. Raja leaves in M3, the chariot): an entry whose moment has already played is never built again.
    this.ambientNpcs = ambientEntriesFor(this.def.ambient, GameState.seenMoments).map((def, i) => this.buildAmbientNpc(def, i));
  }

  // The moment `momentId` is starting: the ambient people it takes away (`unlessMoment`: Prof. Raja, whom the chariot collects) are removed now,
  // sprite, shadow and body, so they are not standing there again when the scene ends (the script plays them itself as an actor).
  retireAmbientFor(momentId) {
    this.ambientNpcs = (this.ambientNpcs || []).filter((ambient) => {
      if (ambient.def.unlessMoment !== momentId) return true;
      ambient.sprite.disableBody(true, true); // off and invisible, but still a valid object for the player's collider
      ambient.shadow.destroy();
      return false;
    });
  }

  buildAmbientNpc(def, index) {
    // FB-0057: a club member draws with her club's outfit sheet (ambientSheetKey(), src/campus-facts.js); the
    // plain sheet is the fallback if a variant was never loaded, so a missing file can't draw as a black box.
    let textureKey = ambientSheetKey(def);
    if (!this.textures.exists(textureKey)) textureKey = `npc-${def.character}`;
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
    // nearestInteractable()/the prompt bubble need no ambient-specific branch. ADR 0018: every ambient
    // student is talkable, but what it says is not dialog data on the sprite -- interact() asks
    // campusTalkLines() (src/campus-facts.js) for the student's role, so `dialog` stays empty (a plain
    // "E" bubble, never "!"). The name tag is the role label ("LUG member") unless the entry is a named
    // character (FB-0050: `def.name`, see the src/ambient.js header).
    sprite.def = {
      id: def.id,
      name: def.name || (CAMPUS_ROLES[def.role] || {}).label || 'Student',
      character: def.character,
      role: def.role,
      dialog: [],
    };
    sprite.idleFrames = PLAYER_IDLE;
    const ambient = {
      def, sprite, shadow, facing,
      waypointIndex: 0, waypointDir: 1, pausedUntil: 0, talking: false,
      emoteAt: this.time.now + AMBIENT_CHAT_EMOTE_MIN_MS + Math.random() * (AMBIENT_CHAT_EMOTE_MAX_MS - AMBIENT_CHAT_EMOTE_MIN_MS),
    };
    sprite.ambient = ambient;
    this.syncAmbientDepth(ambient);
    return ambient;
  }

  // ADR 0018: the student stops, turns toward her, and holds that pose until the dialog closes (a
  // patrol student is held in updateAmbientPatrol(); an idle/chat one never moves, so it is posed here).
  beginAmbientTalk(ambient) {
    const s = ambient.sprite;
    ambient.talking = true;
    s.setVelocity(0, 0);
    ambient.facing = animalFacing(this.player.x - s.x, this.player.y - s.y);
    this.playAmbientAnim(ambient, 'idle');
  }

  endAmbientTalk(ambient) {
    ambient.talking = false;
    ambient.alertShown = false; // the next talk gets its "!" again (src/juice.js talkEmote())
    ambient.pausedUntil = this.time.now + AMBIENT_TALK_RESUME_MS;
    if (ambient.def.kind !== 'patrol') { // back to its authored pose
      ambient.facing = ambient.def.facing || 'down';
      ambient.sprite.anims.stop();
      ambient.sprite.setFrame(PLAYER_IDLE[ambient.facing]);
    }
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
    if (nearPlayer || ambient.talking || time < ambient.pausedUntil) {
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
    if (ambient.talking || time < ambient.emoteAt) return;
    ambient.emoteAt = time + AMBIENT_CHAT_EMOTE_MIN_MS + Math.random() * (AMBIENT_CHAT_EMOTE_MAX_MS - AMBIENT_CHAT_EMOTE_MIN_MS);
    this.spawnAmbientEmote(ambient.sprite.x, ambient.sprite.y - 22);
  }

  // `glyph`/`holdMs`: the "..." of a chatting pair by default; a person who stops and turns to her gets a "!" (src/juice.js talkEmote()).
  spawnAmbientEmote(x, y, glyph = '...', holdMs = 700) {
    const container = this.add.container(x, y).setDepth(200000).setScale(0.4);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1c2c, 0.85).fillRoundedRect(-12, -10, 24, 20, 4);
    const text = this.add.text(0, 0, glyph, { fontFamily: FONT, fontSize: '10px', color: COLORS.text }).setOrigin(0.5);
    container.add([bg, text]);
    this.tweens.add({ targets: container, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.time.delayedCall(holdMs, () => {
      this.tweens.add({ targets: container, alpha: 0, duration: 200, onComplete: () => container.destroy() });
    });
  }

  // The "!" / heart over an ambient person at the start / end of a talk (src/juice.js talkEmote(): never during a script or a moment, once per
  // talk, a heart only for a named friend). Decoration only: it must never get in the way of the conversation, so any failure is swallowed.
  talkEmoteFor(phase, ambient) {
    try {
      if (!juiceEnabled() || this.transitioning) return;
      const emote = talkEmote(phase, ambient.def, { scriptRunning: this.scriptRunner.isRunning, alertShown: ambient.alertShown });
      if (!emote) return;
      const s = ambient.sprite;
      if (emote.kind === '!') {
        ambient.alertShown = true;
        this.spawnAmbientEmote(s.x, s.y - 22, '!', emote.holdMs);
      } else {
        this.spawnHeartEmote(s.x, s.y - 22);
      }
    } catch (error) { /* decoration only */ }
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
    // The campus animals hide for a script too (ADR 0018), and reappear with it.
    this.animalsHidden = !visible;
    for (const animal of this.animals || []) this.syncAnimal(animal);
  }

  // ---------- campus animals (ADR 0018, content + behaviour in src/animals.js) ----------
  // Cats and birds on the outdoor map. They have no collision (never block her path), no depth games
  // beyond the usual sort-by-feet, and are never created indoors. What each one does every frame is the
  // pure stepAnimal(); this only builds the sprites and plays what animalAnim() says.
  createAnimals() {
    this.animals = [];
    this.animalsHidden = false;
    const defs = this.def.indoors ? [] : (ANIMALS[this.mapKey] || []);
    if (!defs.length || !this.tileData) return;
    const objects = this.mapObjects || [];
    this.animalWalkable = (tx, ty) => isWalkableTile(this.tileData, this.tileInfo, tx, ty) && !animalTileBlocked(objects, tx, ty);
    this.animals = defs.slice(0, ANIMAL_CAP_PER_MAP).map((def) => this.buildAnimal(def));
  }

  buildAnimal(def) {
    const info = ANIMAL_SPECIES[def.species];
    const layout = ANIMAL_LAYOUTS[info.layout];
    this.ensureAnimalAnims(def.species);
    const state = makeAnimal(def);
    const sprite = this.add.sprite(state.x * TILE, state.y * TILE + ANIMAL_FEET_OFFSET, info.sheet, 0)
      .setOrigin(0.5, layout.footY / layout.frameH);
    const shadow = this.add.ellipse(sprite.x, sprite.y - 1, info.kind === 'bird' ? 9 : 10, 3, 0x000000, 0.25);
    // The same `{ def }` shape every interactable carries (nearestInteractable()); only a tame, talkable
    // cat is ever offered. "Cat" is a label, not a name; the dialog is the soft meow (interact()).
    sprite.def = { id: def.id, name: 'Cat', dialog: [] };
    const animal = { def, sprite, shadow, state };
    sprite.animalRef = animal;
    this.syncAnimal(animal);
    return animal;
  }

  // One Phaser animation per layout animation, keyed '<species>-<name>', built once per species.
  ensureAnimalAnims(species) {
    const info = ANIMAL_SPECIES[species];
    for (const [name, anim] of Object.entries(ANIMAL_LAYOUTS[info.layout].anims)) {
      const key = `${species}-${name}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key, frames: this.anims.generateFrameNumbers(info.sheet, { frames: anim.frames }),
        frameRate: anim.fps, repeat: -1, yoyo: Boolean(anim.yoyo),
      });
    }
  }

  // Puts the sprite/shadow where the pure state says, with the right animation, flip and depth.
  syncAnimal(animal) {
    const s = animal.state;
    const { anim, flipX, timeScale } = animalAnim(s);
    const visible = s.visible && !this.animalsHidden;
    const footY = s.y * TILE + ANIMAL_FEET_OFFSET;
    const sprite = animal.sprite;
    // In the air (a bird that has taken off) it draws above everything; on the ground it sorts by its feet.
    sprite.setPosition(s.x * TILE, footY - s.alt).setFlipX(flipX).setVisible(visible)
      .setDepth(footY + (s.alt > 2 ? 1000 : 0));
    animal.shadow.setPosition(s.x * TILE, footY - 1).setDepth(footY - 1).setVisible(visible).setAlpha(0.25 * (1 - s.alt / 40));
    const key = `${animal.def.species}-${anim}`;
    if (sprite.anims.currentAnim?.key !== key) sprite.anims.play(key, true);
    sprite.anims.timeScale = timeScale;
  }

  updateAnimals(time, delta) {
    if (!this.animals || !this.animals.length) return;
    const view = this.cameras.main.worldView;
    const left = view.x - ANIMAL_CULL_MARGIN;
    const right = view.x + view.width + ANIMAL_CULL_MARGIN;
    const top = view.y - ANIMAL_CULL_MARGIN;
    const bottom = view.y + view.height + ANIMAL_CULL_MARGIN;
    // Her feet, in tile units (the animals' own coordinate space).
    const player = { x: this.player.x / TILE, y: (this.player.y + PLAYER_FEET_OFFSET) / TILE };
    const ctx = { now: time, dt: Math.min(delta, 100) / 1000, player, rng: Math.random, isWalkable: this.animalWalkable };
    for (const animal of this.animals) {
      const s = animal.state;
      const px = s.x * TILE;
      const py = s.y * TILE;
      const onScreen = px >= left && px <= right && py >= top && py <= bottom;
      // Off-screen animals sleep, except ones mid-flight or out of sight (so a bird that flew off
      // always finishes its trip and its "come back" timer keeps running).
      if (!onScreen && !['gone', 'fly', 'land'].includes(s.state)) continue;
      animal.state = stepAnimal(s, ctx);
      this.syncAnimal(animal);
    }
  }

  // A small floating heart over a talked-to cat (the same bubble shape as spawnAmbientEmote()).
  spawnHeartEmote(x, y) {
    const container = this.add.container(x, y).setDepth(200000).setScale(0.4);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1c2c, 0.85).fillRoundedRect(-12, -10, 24, 20, 4);
    const heart = this.add.graphics();
    const rows = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
    heart.fillStyle(0xff6fb1, 1);
    rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === 'X') heart.fillRect(-7 + rx * 2, -6 + ry * 2, 2, 2); }));
    container.add([bg, heart]);
    this.tweens.add({ targets: container, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: container, y: y - 10, duration: 1200, delay: 100 });
    this.time.delayedCall(1000, () => {
      this.tweens.add({ targets: container, alpha: 0, duration: 250, onComplete: () => container.destroy() });
    });
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
  // P4b (FB-0064 / FB-0069): every Tiled `lift` object of this map (the stainless double doors the generator puts in a wall) is an
  // interactable the way a key station is: E in front of it opens the floor-choice list from the map def's `lift` data
  // (src/maps.js MAIN_BLOCK_LIFT, src/maplogic.js liftDialog()). The interaction point is the middle of its doorway, like a door's.
  createLifts() {
    this.lifts = (this.mapObjects || [])
      .filter((o) => o.type === 'lift')
      .map((o) => {
        const cells = parseDoorCells(o.props.cells);
        const centre = doorCenterPx({ x: Math.floor(o.x), y: Math.floor(o.y), cellsW: cells.w });
        // P4c: `door` is the lift's doorway as the door animation sees any door (showDoorOverlay()): its tile, cells and frames.
        const door = { x: Math.floor(o.x), y: Math.floor(o.y), cellsW: cells.w, cellsH: cells.h, name: o.name, kind: 'lift', frames: doorFrames(o.props) };
        return { x: centre.x, y: centre.y, name: o.name, door, def: { id: `lift:${o.name}`, name: 'Lift', dialog: liftDialog(this.def.lift, this.mapKey) } };
      });
  }

  // P5c (FB-0071): the ICL's locked hatch. Every Tiled `sealedDoor` object (tools/interiors/plans.js: two solid door-leaf tiles in the corridor
  // wall) is a door that stays shut until its flag is set (maps.js `gates`, src/story.js STORY.iclGate): a sealed one rattles and says its locked line when she
  // pushes at it, E at it says it is sealed, and once the flag is set (the scanner's mini-game won or skipped) it plays the P4c opening animation, its tiles
  // become the open frame (walkable) and it stays open. A save that already has the ICL key, is past it, or stands inside the lab starts with it open
  // (maplogic.js isGateOpen(), the soft-lock guard). Pure rules: src/maplogic.js; this is only the scene side.
  createGates() {
    const defs = this.def.gates || [];
    this.gates = (this.mapObjects || []).filter((o) => o.type === 'sealedDoor').map((o) => {
      const def = defs.find((d) => d.door === o.name) || null;
      const cells = parseDoorCells(o.props.cells);
      const gate = {
        name: o.name, def, x: Math.floor(o.x), y: Math.floor(o.y), cellsW: cells.w, cellsH: cells.h, frames: doorFrames(o.props), open: false,
        doorDef: def ? { id: `gate:${o.name}`, name: 'Hatch', dialog: def.doorDialog } : null,
      };
      if (!def) { console.warn(`sealed door "${o.name}" has no gate data in this map's def: leaving it open`); this.setGateOpen(gate, false); return gate; }
      // never shut inside: a spawn already within the room it seals (an old save standing in the lab) opens it for good
      if (!GameState.flags[def.flag] && tileInGateRoom(def, Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE))) {
        GameState.flags[def.flag] = true;
        notifyStateChanged();
      }
      if (isGateOpen(def, GameState)) {
        if (!GameState.flags[def.flag]) { GameState.flags[def.flag] = true; notifyStateChanged(); }
        this.setGateOpen(gate, false);
      }
      return gate;
    });
  }

  // Opens one gate: with `animate` the door's opening plays first (closed -> half -> open, 160 ms, the P4c overlay), then its tiles become the open frame.
  setGateOpen(gate, animate) {
    if (gate.open) return;
    gate.open = true;
    const layer = this.solidLayers.find((l) => l.layer.name === 'structures');
    const openNames = gate.frames && gate.frames[gate.frames.length - 1];
    const apply = () => {
      if (!layer || !openNames) return;
      openNames.forEach((name, i) => {
        const index = this.tileInfo.tiles.findIndex((t) => t.name === name);
        if (index >= 0 && i < gate.cellsW) layer.putTileAt(index + 1, gate.x + i, gate.y); // solid -> walkable: Phaser re-reads collision from the new index
      });
    };
    this.showScannerAccepted(gate.name, animate);
    const overlay = animate && gate.frames ? this.showDoorOverlay({ name: gate.name, x: gate.x, y: gate.y, cellsW: gate.cellsW, cellsH: gate.cellsH, frames: gate.frames }) : null;
    if (overlay && overlay.open) {
      AudioManager.play('doorOpen');
      overlay.open(() => { apply(); overlay.destroy(); });
    } else {
      apply();
    }
  }

  // Door flags set since the scene began (the scanner's mini-game, a key from elsewhere): open whichever gate its rules now say is open.
  syncGates() {
    for (const gate of this.gates || []) {
      if (!gate.open && gate.def && isGateOpen(gate.def, GameState)) this.setGateOpen(gate, true);
    }
  }

  // FB-0077: the Gate 2 boom barrier. Its door-like `gateBarrier` objects (a few parts: the post-and-arm row, the mast above the housing, the elbow
  // beside it) all play the P4c closed -> half -> open animation together when she comes within STORY.gateBarrier.range tiles of it, at the
  // slower pace of its own `frameMs` (about 0.6 s), with the door's sound and the latch click as it locks up. Opening swaps its structure
  // tiles for the open frame (the arm tiles are cleared, the raised boom stands in the two tiles above the housing: none of them solid, so the
  // gate stays passable on foot exactly as before) and records the flag `gateBarrierOpen`, so it never lowers again, not after a reload either:
  // a scene that finds the flag already set (a save, a walk back from a building) builds it open at once, no animation. Pure rules: maplogic.js.
  createGateBarrier() {
    this.gateBarrier = null;
    const def = this.def.gateBarrier;
    const parts = (this.mapObjects || []).filter((o) => o.type === 'gateBarrier').map((o) => {
      const cells = parseDoorCells(o.props.cells);
      return { name: o.name, x: Math.floor(o.x), y: Math.floor(o.y), cellsW: cells.w, cellsH: cells.h, frames: doorFrames(o.props) };
    }).filter((part) => part.frames);
    if (!def || !parts.length) return;
    this.gateBarrier = { def, parts, box: gateBarrierBox(parts), open: false };
    if (GameState.flags[def.flag]) this.setGateBarrierOpen(false);
  }

  // She is within range of the (still lowered) barrier: raise it. Runs every frame, whoever is moving her (she, or a script walking her up the avenue).
  updateGateBarrier() {
    const barrier = this.gateBarrier;
    if (!barrier || barrier.open || !this.player) return;
    if (gateBarrierNear(barrier.box, Math.floor(this.player.x / TILE), Math.floor(this.player.y / TILE), barrier.def.range)) this.setGateBarrierOpen(true);
  }

  // Raises the barrier for good. With `animate` its parts play closed -> half -> open first (over the lowered tiles, which are cleared the moment
  // the animation starts: the overlay's first frame is that very picture), then the open frame goes into the structures layer.
  setGateBarrierOpen(animate) {
    const barrier = this.gateBarrier;
    if (!barrier || barrier.open) return;
    barrier.open = true;
    if (!GameState.flags[barrier.def.flag]) {
      GameState.flags[barrier.def.flag] = true;
      notifyStateChanged();
    }
    const layer = this.solidLayers.find((l) => l.layer.name === 'structures');
    const eachCell = (visit) => barrier.parts.forEach((part) => {
      const names = part.frames[part.frames.length - 1];
      names.forEach((name, i) => visit(part, name, doorCellAt(part, i)));
    });
    const apply = () => {
      if (!layer) return;
      eachCell((part, name, cell) => {
        const index = name === BLANK_TILE_NAME ? -1 : this.tileInfo.tiles.findIndex((t) => t.name === name);
        if (index >= 0) layer.putTileAt(index + 1, cell.x, cell.y);
        else layer.removeTileAt(cell.x, cell.y);
      });
    };
    if (!animate || !layer) { apply(); return; }
    eachCell((part, name, cell) => layer.removeTileAt(cell.x, cell.y));
    AudioManager.play('doorOpen');
    const overlays = barrier.parts.map((part) => this.showDoorOverlay({
      name: part.name, x: part.x, y: part.y, cellsW: part.cellsW, cellsH: part.cellsH, frames: part.frames, frameMs: barrier.def.frameMs, depth: 1,
    }));
    let waiting = overlays.filter(Boolean).length;
    const finished = () => {
      if (--waiting > 0) return;
      apply();
      overlays.forEach((overlay) => overlay && overlay.destroy());
      AudioManager.play('doorClose'); // the latch as it locks up
    };
    if (!waiting) { apply(); return; }
    overlays.forEach((overlay) => overlay && overlay.open(finished));
  }

  // A key station whose key is now held (Alice handed it over, or another station did) fades its floating icon, as taking it from the station does.
  syncKeyStations() {
    for (const ks of this.keyStations || []) {
      if (!ks.taken && GameState.quest.keys[ks.def.id]) this.collectKeyStation(ks);
    }
  }

  // Pushing against a sealed door from the front (heading up, in front of its cells): its locked line, the latch thud and the rattle, once per approach.
  checkGateBump(blocked) {
    if (blocked || !this.gates || !this.gates.length) { this.gateWarned = null; return; }
    const body = this.player.body;
    const tx = Math.floor(body.center.x / TILE);
    const ty = Math.floor((body.bottom - 1) / TILE);
    const up = this.keys.UP.isDown || this.keys.W.isDown;
    const gate = this.gates.find((g) => !g.open && g.def && gateBumped(g, tx, ty, up));
    if (!gate) { this.gateWarned = null; return; }
    if (this.gateWarned === gate.name) return;
    this.gateWarned = gate.name;
    this.game.events.emit('toast', gate.def.lockedLine);
    AudioManager.play('lockedDoorThud');
    this.rattleDoor(gate);
  }

  // The scanners (to the player the EDI test console; Tiled `scanner` objects: a solid pad in the wall, tools/interiors/plans.js scannerPad()). Each is an interactable (E starts the
  // parking game: the gate data's `scannerDialog`) with a glow overlay that pulses blue (a tile animation) until its door is open, then stays green.
  createScanners() {
    const defs = this.def.gates || [];
    const indexOf = (name) => this.tileInfo.tiles.findIndex((t) => t.name === name);
    this.scanners = (this.mapObjects || []).filter((o) => o.type === 'scanner').map((o) => {
      const gateDef = defs.find((d) => d.scanner === o.name) || null;
      const x = Math.floor(o.x);
      const y = Math.floor(o.y);
      const glow = (parseOpenTiles(o.props.glow) || []).map(indexOf).filter((i) => i >= 0);
      const okIndex = indexOf(o.props.ok || 'intScannerOk');
      const scanner = {
        x: toPixel(x), y: toPixel(y), name: o.name, door: o.props.door, accepted: false,
        def: { id: `scanner:${o.name}`, name: 'EDI test console', dialog: gateDef ? gateDef.scannerDialog : [] },
      };
      if (glow.length) {
        const image = this.tileImage(x * TILE, y * TILE, glow[0]).setDepth(this.doorOverlayDepth({ x, y }));
        scanner.anim = { image, indexes: glow, ms: Number(o.props.ms) || 450, phase: 0, frozen: null, shown: null, okIndex };
        this.tileAnims = (this.tileAnims || []).concat(scanner.anim);
      }
      return scanner;
    });
  }

  // The scanner beside a door that has just opened (or was open from the start): a bright flash, then steady green.
  showScannerAccepted(doorName, animate) {
    for (const scanner of this.scanners || []) {
      if (scanner.door !== doorName || scanner.accepted) continue;
      scanner.accepted = true;
      const a = scanner.anim;
      if (!a || a.okIndex < 0) continue;
      a.frozen = a.okIndex;
      a.image.setFrame(a.okIndex);
      if (animate) this.tweens.add({ targets: a.image, alpha: { from: 0.2, to: 1 }, duration: 160, yoyo: true, repeat: 2 });
    }
  }

  // Tile animations (Tiled `tileAnim` objects, tools/interiors/build-interiors.js tileAnim()): an overlay image over a cell cycles the listed tiles on
  // top of the baked furniture (blinking rack LEDs, the holo globe). One timer steps them all.
  createTileAnims() {
    const indexOf = (name) => this.tileInfo.tiles.findIndex((t) => t.name === name);
    const fromMap = (this.mapObjects || []).filter((o) => o.type === 'tileAnim').map((o) => {
      const indexes = (parseOpenTiles(o.props.frames) || []).map(indexOf).filter((i) => i >= 0);
      if (!indexes.length) return null;
      const x = Math.floor(o.x);
      const y = Math.floor(o.y);
      const image = this.tileImage(x * TILE, y * TILE, indexes[0]).setDepth(this.doorOverlayDepth({ x, y }));
      return { image, indexes, ms: Math.max(Number(o.props.ms) || 500, 300), phase: Number(o.props.phase) || 0, frozen: null, shown: null };
    }).filter(Boolean);
    this.tileAnims = (this.tileAnims || []).concat(fromMap);
    if (!this.tileAnims.length) return;
    this.stepTileAnims();
    this.time.addEvent({ delay: TILE_ANIM_TICK_MS, loop: true, callback: () => this.stepTileAnims() });
  }

  stepTileAnims() {
    const now = this.time.now;
    for (const a of this.tileAnims) {
      const i = a.frozen != null ? -1 : tileAnimFrame(now, a.indexes.length, a.ms, a.phase);
      if (a.shown === i) continue;
      a.shown = i;
      if (i >= 0) a.image.setFrame(a.indexes[i]);
    }
  }

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

  // ---------- Golden hour (src/daylight.js, docs/GAME_FEEL.md "Daylight") ----------
  // The light moves from morning to dusk as the keys are found. Drawn in THIS scene, above every world layer (the tree canopies, depth
  // OVERHEAD_DEPTH, included, so the tint is even) and below the whole UI (UIScene is a separate scene, drawn on top of this one). One MULTIPLY
  // rectangle (the tint), one vignette image, a few additive halos on the lamps/chandeliers and a few additive dust motes: nothing is
  // interactive and nothing allocates per frame. `?daylight=0` builds none of it (tests/e2e/helpers.js).
  createDaylight() {
    this.daylight = null;
    if (!daylightEnabled()) return;
    this.ensureDaylightTextures();
    const cam = this.cameras.main;
    const indoors = Boolean(this.def.indoors);
    // Camera-space objects (scrollFactor 0) are zoomed about the camera's centre, so they are placed at the centre of the camera's own
    // 960x540 and sized to the part of that the zoom shows (plus a margin), never to the world.
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const w = cam.width / cam.zoom + 4;
    const h = cam.height / cam.zoom + 4;
    const overlay = this.add.rectangle(cx, cy, w, h, 0xffffff, 1).setScrollFactor(0).setDepth(DAYLIGHT_OVERLAY_DEPTH)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    const vignette = this.add.image(cx, cy, 'daylight-vignette').setScrollFactor(0).setDepth(DAYLIGHT_OVERLAY_DEPTH + 2).setDisplaySize(w, h);
    const halos = this.daylightSpots().map((spot) => this.add.image(spot.x, spot.y, 'daylight-halo').setDepth(DAYLIGHT_OVERLAY_DEPTH + 1)
      .setDisplaySize(spot.size, spot.size).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    const motes = [];
    const moteState = [];
    if (!indoors) {
      for (let i = 0; i < DAYLIGHT_MOTE_MAX; i++) {
        moteState.push(moteInit(i));
        motes.push(this.add.image(cx, cy, 'daylight-mote').setScrollFactor(0).setDepth(DAYLIGHT_OVERLAY_DEPTH + 3)
          .setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
      }
    }
    const phase = dayPhaseFromQuest(GameState.quest);
    const target = daylightParams(phase, indoors);
    this.daylight = {
      overlay, vignette, halos, motes, moteState, indoors, cx, cy, w, h,
      phaseIndex: phase.index, t: 1, startedAt: 0, lastTint: -1, motesShown: false,
      cur: copyParams(target, {}), from: copyParams(target, {}), to: target,
    };
    this.applyDaylight(this.daylight.cur); // the scene starts in the current phase: no transition on a map change or a Continue
    this.daylightListener = () => this.refreshDaylight();
    this.game.events.on('state-changed', this.daylightListener);
    this.events.once('shutdown', () => this.destroyDaylight());
  }

  // The cached glow textures (a canvas each, made once per game: textures outlive a scene restart). Their colours are baked in, so neither
  // renderer has to tint anything; they are set to LINEAR so the pixel-art NEAREST default never turns a gradient into blocks.
  ensureDaylightTextures() {
    const make = (key, size, paint) => {
      if (this.textures.exists(key)) return;
      const texture = this.textures.createCanvas(key, size[0], size[1]);
      paint(texture.getContext());
      texture.refresh();
      texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    };
    const [vr, vg, vb] = DAYLIGHT_VIGNETTE_RGB;
    // The vignette: clear in the middle, deepening toward the corners (an ellipse, so the sides and the top/bottom fall off together).
    make('daylight-vignette', [480, 270], (ctx) => {
      ctx.setTransform(1, 0, 0, 270 / 480, 240, 135);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 340);
      g.addColorStop(0, `rgba(${vr},${vg},${vb},0)`);
      g.addColorStop(0.5, `rgba(${vr},${vg},${vb},0)`);
      g.addColorStop(0.8, `rgba(${vr},${vg},${vb},0.45)`);
      g.addColorStop(1, `rgba(${vr},${vg},${vb},1)`);
      ctx.fillStyle = g;
      ctx.fillRect(-300, -300, 600, 600);
    });
    // A lamp's halo: a warm soft disc (additive).
    make('daylight-halo', [64, 64], (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,226,170,1)');
      g.addColorStop(0.35, 'rgba(255,196,118,0.5)');
      g.addColorStop(1, 'rgba(255,170,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    });
    // A dust mote: a tiny golden speck (additive).
    make('daylight-mote', [8, 8], (ctx) => {
      const g = ctx.createRadialGradient(4, 4, 0, 4, 4, 4);
      g.addColorStop(0, 'rgba(255,232,160,1)');
      g.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 8, 8);
    });
  }

  // Where the glowing tiles are on THIS map (src/daylight.js findLightSpots(): the street lamps' heads, the foyer chandeliers), read straight
  // off the map data so a regenerated campus moves its halos with it.
  daylightSpots() {
    const names = this.tileInfo.tiles.map((tile) => tile.name);
    let layers;
    if (this.def.tiled) {
      const json = this.cache.tilemap.get(`map-${this.def.tiled}`).data;
      layers = json.layers.filter((layer) => layer.type === 'tilelayer').map((layer) => ({ data: layer.data, width: json.width, offset: 1 }));
    } else {
      layers = [{ data: this.tileData.flat(), width: this.tileData[0].length, offset: 0 }];
    }
    return findLightSpots(layers, names, TILE);
  }

  // Draws one parameter set (src/daylight.js: { tint, alpha, vignette, halo, motes }) right now. Only touches what changed.
  applyDaylight(snap) {
    const d = this.daylight;
    if (!d) return;
    if (snap.tint !== d.lastTint) { d.overlay.setFillStyle(snap.tint, 1); d.lastTint = snap.tint; }
    d.overlay.setAlpha(snap.alpha).setVisible(snap.alpha > 0.002); // a neutral phase draws no overlay at all
    d.vignette.setAlpha(snap.vignette).setVisible(snap.vignette > 0.002);
    for (const halo of d.halos) halo.setAlpha(snap.halo).setVisible(snap.halo > 0.002);
  }

  // The day moved on? (a key was found, the box was handed over): ease from the light on screen to the new phase's over DAYLIGHT_FADE_MS.
  // Idempotent and cheap: it runs on every 'state-changed' and does nothing unless the phase itself changed.
  refreshDaylight() {
    const d = this.daylight;
    if (!d) return;
    const phase = dayPhaseFromQuest(GameState.quest);
    if (phase.index === d.phaseIndex) return;
    d.phaseIndex = phase.index;
    copyParams(d.cur, d.from);
    d.to = daylightParams(phase, d.indoors);
    d.t = 0;
    d.startedAt = performance.now();
  }

  // Every frame, before update()'s early return (a key-room beat or a door walk must not freeze the light): advances a transition (a plain
  // 0..1 number on a plain object, eased, and ended for sure by DAYLIGHT_FAILSAFE_MS of wall-clock time), then drifts the dust.
  updateDaylight(delta) {
    const d = this.daylight;
    if (!d) return;
    if (d.t < 1) {
      d.t = performance.now() - d.startedAt > DAYLIGHT_FAILSAFE_MS ? 1 : Math.min(1, d.t + Math.min(delta, 250) / DAYLIGHT_FADE_MS);
      if (d.t >= 1) copyParams(d.to, d.cur);
      else lerpParams(d.from, d.to, daylightEase(d.t), d.cur);
      this.applyDaylight(d.cur);
    }
    if (d.motes.length && (d.cur.motes > 0 || d.motesShown)) this.updateDaylightMotes(delta);
  }

  // The dust motes: drifting speck sprites in camera space (the visible part of the camera's own view), a cheap loop, no physics.
  updateDaylightMotes(delta) {
    const d = this.daylight;
    const left = d.cx - d.w / 2;
    const top = d.cy - d.h / 2;
    let any = false;
    for (let i = 0; i < d.motes.length; i++) {
      const m = moteStep(d.moteState[i], delta);
      const alpha = moteAlpha(m, i, d.cur.motes);
      const sprite = d.motes[i];
      if (alpha <= 0.01) { sprite.setVisible(false); continue; }
      any = true;
      sprite.setPosition(left + m.x * d.w, top + m.y * d.h).setScale(0.25 * m.scale).setAlpha(alpha).setVisible(true);
    }
    d.motesShown = any;
  }

  // Scene shutdown (a restart for a map change, quitting): the listener goes, every effect object is destroyed.
  destroyDaylight() {
    const d = this.daylight;
    if (this.daylightListener) this.game.events.off('state-changed', this.daylightListener);
    this.daylightListener = null;
    this.daylight = null;
    if (!d) return;
    for (const object of [d.overlay, d.vignette, ...d.halos, ...d.motes]) object.destroy();
  }

  update(time, delta) {
    // The play clock the moments' 90 s spacing runs on (GameState.playSeconds): seconds this scene has actually run, so a mini-game, the
    // title screen or a minute with the game closed never counts. Capped per frame so a stalled tab cannot fast-forward it.
    GameState.playSeconds += Math.min(delta, 250) / 1000;
    this.updateDaylight(delta); // before the early return: the light keeps moving through a key-room beat or a door walk
    {
      // ...and the free-control clock: reset by anything that owns the screen (a script or cutscene, a door walk or warp, a dialog, the
      // pause menu, the journal, the map), running only while she is really in control.
      const ui0 = this.scene.get('ui');
      const busy = this.transitioning || this.scriptRunner.isRunning || !ui0 || !ui0.tutorial || ui0.isBlocking();
      this.freeSeconds = advanceFreeSeconds(this.freeSeconds, Math.min(delta, 250) / 1000, busy);
    }
    this.updateGateBarrier(); // before the early return: it rises as she walks up to it even during the Gate 2 welcome script
    if (this.transitioning) return;

    const ui = this.scene.get('ui');
    const blocked = !ui.tutorial || ui.isBlocking();
    this.movePlayer(blocked, time, delta);
    this.updatePickups();
    this.updatePrompt(blocked, time);
    this.checkWarps();
    this.checkGateBump(blocked);
    this.checkAreas();
    this.checkCutscene();
    this.checkKeyRoomBeats();
    this.checkMoment();
    this.updateAmbient(time);
    this.updateAnimals(time, delta);
    this.syncGameState();
  }

  // P: a selfie (src/selfie.js), only while she is in free control: the same "does anything own the screen?" test the moments use (a dialog, any
  // script or moment, a door/warp walk, the pause menu, the journal, the map, a mini-game/cutscene/ending scene that paused or stopped this one)
  // plus a short spell of free control; otherwise a silent no-op. A second P during one is ignored. Typing into the dev feedback panel is not a selfie.
  onSelfieKey(event) {
    if (event.repeat) return;
    const target = event.target;
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || '') || target.isContentEditable)) return;
    const ui = this.scene.get('ui');
    const allowed = selfieAllowed({
      enabled: selfieEnabled(),
      sceneActive: this.sys.isActive(),
      hasPlayer: Boolean(this.player && this.player.active && this.cameras.main),
      uiReady: Boolean(ui && ui.tutorial && ui.dialog),
      transitioning: this.transitioning,
      scriptRunning: this.scriptRunner.isRunning,
      uiBlocking: Boolean(ui && ui.isBlocking()),
      selfieBusy: this.selfie.busy,
      freeSeconds: this.freeSeconds,
    });
    if (allowed) this.selfie.take();
  }

  // Keeps GameState's map/position/facing current every frame, so a save taken at any moment (or
  // the browser just being closed) reflects where she actually is, not just her last warp target
  // (docs/ARCHITECTURE.md: "Anything that must survive a map change or a save goes in GameState").
  syncGameState() {
    GameState.map = this.mapKey;
    GameState.facing = this.facing;
    GameState.position = { x: Math.floor(this.player.x / TILE), y: Math.floor(this.player.y / TILE) };
  }

  // E / Space / Enter: next line of dialog, or talk to whoever is nearby.
  onInteractKey(event) {
    // this.sys.isActive() is false while a cutscene has this scene paused (Phaser still delivers
    // keyboard events to paused scenes, since they're not tied to the update loop).
    if (event.repeat || !this.sys.isActive()) return;
    // FB-0045: the UI scene listens to the very same native key event (the pause menu confirms on
    // Enter/Space). If it already used this press -- say "Resume" just closed the menu -- it marks the
    // event, and this scene must not turn the same press into a conversation a frame later. (Whichever
    // scene hears the event first, one press is only ever used once.)
    if (event.uiConsumed) return;
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
      openTiles: parseOpenTiles(w.openTiles), frames: doorFrames(w),
      cellsW: 1, cellsH: 1,
    }));
    const objectWarps = (this.mapObjects || [])
      // ADR 0020: a Tiled `door` marked `closed` has no `to` -- a door in a wing wall that never opens. It is
      // still a warp trigger so the locked-door machinery speaks for it: its map def's own `doorLocks` rule
      // (no `stages`, so locked for good) carries the line shown as the toast (`reason`).
      .filter((o) => (o.type === 'door' || o.type === 'stairs') && (o.props.to || o.props.closed))
      .map((o) => {
        const rule = doorLockRule(this.def.doorLocks, o.name);
        // FB-0046: a two-tile doorway carries `cells` ("2x1"): every cell of it is the door (see maplogic.js parseDoorCells()).
        // P4b: a staircase's foot can be two tiles wide too (the foyer's, between its columns), so `cells` counts for stairs as well.
        const cells = parseDoorCells(o.props.cells);
        return {
          x: Math.floor(o.x), y: Math.floor(o.y), width: o.width, cellsW: cells.w, cellsH: cells.h, to: o.props.to, spawnAt: o.props.toId,
          closed: Boolean(o.props.closed),
          name: o.name, kind: o.type, openTiles: parseOpenTiles(o.props.openTiles), frames: doorFrames(o.props),
          locked: Boolean(o.props.closed) || isDoorLocked(rule, GameState.quest.stage), _rule: rule,
          lockedReason: (rule && rule.reason) || (o.props.closed ? 'Closed for now.' : 'Locked for the event'),
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
      for (const w of this._warpPointsCache) w.locked = w.closed || isDoorLocked(w._rule, GameState.quest.stage);
    }
    return this._warpPointsCache;
  }

  // Doors are one or two tiles wide, so walking at one slightly off-center would snag on the wall.
  // If a warp tile is just ahead, return a sideways speed that slides the player into line.
  // FB-0046: a two-tile door (every real doorway in the game) is steered towards the MIDDLE of the
  // whole doorway (maplogic.js doorCenterPx()), not the centre of its first tile, and its reach grows by
  // half the extra width -- a one-tile door (cellsW 1) behaves exactly as before.
  doorAssist(dy, speed) {
    const body = this.player.body;
    const aheadY = Math.floor((dy < 0 ? body.top - 2 : body.bottom + 2) / TILE);
    const warp = this.getWarpPoints().find(
      (w) => !w.closed && w.y === aheadY && Math.abs(doorCenterPx(w).x - body.center.x) < DOOR_ASSIST_RANGE + ((w.cellsW || 1) - 1) * (TILE / 2), // ADR 0020: never steer into a closed wall door
    );
    if (!warp) return null;
    return Phaser.Math.Clamp((doorCenterPx(warp).x - body.center.x) * 10, -speed, speed);
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
    for (const lift of this.lifts || []) consider('lift', 'lift', lift, lift.def); // P4b: E at a lift's doors
    // P5c (FB-0071): E at the ICL's scanner / EDI test console (starts the parking game) or at its sealed hatch (says it is sealed); a door that is open is not a thing to use.
    for (const scanner of this.scanners || []) consider('scanner', 'scanner', scanner, scanner.def);
    for (const gate of this.gates || []) if (!gate.open && gate.def) consider('scanner', 'gate', doorCenterPx(gate), gate.doorDef);
    // A tame, talkable cat (ADR 0018; lowest priority like an ambient student). Its tile centre is the
    // target, not its feet-anchored sprite, so the range matches the player's own centre.
    for (const animal of this.animals || []) {
      if (!animal.def.talk || !animal.state.visible) continue;
      consider('animal', 'animal', { x: animal.state.x * TILE, y: animal.state.y * TILE, animalRef: animal }, animal.sprite.def);
    }
    return pickInteractable(candidates);
  }

  interact() {
    const found = this.nearestInteractable();
    if (!found) return;

    // ADR 0018: an ambient student (src/ambient.js) or a talkable cat is not dialog data: the student
    // stops and turns to her and says an opener + a real campus fact for its role, the cat gives a soft
    // meow and a heart. Neither is ever story information, and neither writes to GameState.seenDialog.
    const ambientTalker = found.kind === 'npc' ? found.target.ambient : null;
    const animalTalker = found.kind === 'animal' ? found.target.animalRef : null;
    let talk = null; // { name, lines } for the two kinds above
    if (ambientTalker) {
      GameState.campusTalk = GameState.campusTalk || newCampusTalkState();
      // The entry itself is passed as `named`: its optional `name`/`lines` make a named character (FB-0050).
      talk = campusTalkLines(ambientTalker.def.role, ambientTalker.def.id, GameState.campusTalk, ambientTalker.def);
      this.beginAmbientTalk(ambientTalker);
      this.talkEmoteFor('start', ambientTalker); // a small "!" as she stops and turns
    } else if (animalTalker) {
      talk = { name: 'Cat', lines: ANIMAL_TALK_LINES };
      animalTalker.state = { ...animalTalker.state, talking: true };
      this.syncAnimal(animalTalker);
      this.spawnHeartEmote(found.target.x, found.target.y - 20);
    }

    if (found.kind === 'npc' && !ambientTalker) {
      const npc = found.target;
      // Turn the NPC to face the player. FB-0043: a `character` NPC (the recolored pack sprites,
      // `npc.idleFrames === PLAYER_IDLE`) has its own real left *and* right frames now, so it's shown
      // unflipped either way; the legacy hand-drawn 'npc' texture (Tomas/Guide, NPC_FRAME) still only
      // has one side-facing frame (`left === right`), so it keeps the old mirror-for-the-other-side
      // trick -- that sheet is unchanged on purpose (see tools/make-assets.js's own comment on it).
      const dx = this.player.x - npc.x;
      const dy = this.player.y - npc.y;
      if (npc.def.hover) {
        // P5c: a hovering NPC keeps bobbing and simply swaps to the idle bob of the direction she faces her in.
        this.playHoverAnim(npc, npc.texture.key, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy < 0 ? 'up' : 'down'));
      } else if (Math.abs(dx) > Math.abs(dy)) {
        const facingRight = dx > 0;
        if (npc.idleFrames.left === npc.idleFrames.right) npc.setFrame(npc.idleFrames.left).setFlipX(facingRight);
        else npc.setFrame(facingRight ? npc.idleFrames.right : npc.idleFrames.left).setFlipX(false);
      } else {
        npc.setFrame(dy < 0 ? npc.idleFrames.up : npc.idleFrames.down).setFlipX(false);
      }
    }

    const picked = talk ? { entry: { id: 'talk', lines: talk.lines }, key: null } : pickDialogEntry(found.def, GameState);
    if (!picked) return; // no dialog data at all -- shouldn't happen for a real NPC/key station
    const { entry, key } = picked;
    if (key) {
      GameState.seenDialog.add(key); // "!" becomes "E" as soon as the line is shown, not after it closes
      notifyStateChanged(); // src/save.js autosaves soon after (seenDialog is part of the save)
    }

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
    const keysBefore = Object.values(GameState.quest.keys).filter(Boolean).length;
    this.scene.get('ui').dialog.open(talk ? talk.name : found.label, lines, (choice) => {
      if (ambientTalker) {
        this.endAmbientTalk(ambientTalker); // she walks on
        this.talkEmoteFor('end', ambientTalker); // a heart over a named friend
      }
      if (animalTalker) animalTalker.state = { ...animalTalker.state, talking: false };
      applyDialogActions((choice || entry).actions, GameState, (result) => {
        // A key station's "take" entry starts with a `minigame` action (src/story.js); the key is
        // only actually given once that mini-game resolves 'won' and the rest of the list finishes
        // ('done', src/dialog.js) -- never on 'quit' (she backed out without beating it) or a full
        // bag. Only then does the desk's own icon disappear, the same way a ground pickup does, so it
        // visually matches "you already have it" instead of vanishing before she's actually earned it.
        if (found.kind === 'keyStation' && entry.id === 'take' && result === 'done') {
          this.collectKeyStation(found.target);
        }
        // P5c: whatever just ran may have set a door's flag (the scanner's mini-game) or handed over a key from elsewhere (Alice gives the ICL key
        // too): the door opens, and a key station whose key is now held drops its floating icon.
        this.syncGates();
        this.syncKeyStations();
        // A key handed over by a person rather than taken from a desk (Alice gives the ICL key too) has no floating icon to collect: the sparkle
        // starts at whoever gave it, unless collectKeyStation() already sparkled for this very hand-over.
        if (countKeysHeld(GameState) > keysBefore && this.time.now - (this.keySparkleAt ?? -1e9) > 150) this.emitKeySparkle(found.target.x, found.target.y - 12);
      });
    }, choices);
    // FB-0036: emitted *after* dialog.open() (which sets DialogBox.isOpen synchronously), not before
    // it -- Tutorial.complete('talk') (src/scenes/ui.js) is what this drives, and its own finish()
    // announcement waits for `dialog.isOpen` to go true-then-false before showing "Tutorial
    // complete!"; emitting this before the box opened let that check see `isOpen === false` a beat
    // too early and race the conversation instead of actually waiting for it to close.
    if (found.kind === 'npc') this.game.events.emit('npc-talked', found.target.def.id);
    if (animalTalker) this.game.events.emit('npc-talked', animalTalker.def.id);
  }

  // Launches a mini-game (docs/ROADMAP.md M4): pauses 'world' exactly like playCutscene() above
  // pauses it for a cutscene. The mini-game's own scene (src/minigames/framework-scene.js
  // MinigameBaseScene, registered under MINIGAMES[id].sceneKey in src/main.js) resumes 'world' itself
  // once it's done and calls `onResult('won' | 'quit')` -- src/dialog.js's `minigame` action is what
  // actually cares about that outcome.
  launchMinigame(id, onResult) {
    const def = MINIGAMES[id];
    this.haltPlayer(); // FB-0072: stopped, idle frame in her facing, before the world is paused under the game
    this.prompt.setVisible(false);
    this.scene.pause();
    this.scene.launch(def.sceneKey, { id, onComplete: onResult, returnTo: 'world' });
  }

  // Fades and destroys a key station's floating icon once its key has been given (mirrors
  // updatePickups()'s own take animation below).
  collectKeyStation(ks) {
    if (ks.taken) return;
    ks.taken = true;
    this.refreshDaylight(); // a key found: the day moves on (golden hour, dusk); the same check also runs on every state change
    this.emitKeySparkle(ks.sprite.x, ks.sprite.y);
    ks.shadow.destroy();
    this.tweens.killTweensOf(ks.sprite);
    this.tweens.add({
      targets: ks.sprite, y: ks.sprite.y - 10, alpha: 0, duration: 250,
      onComplete: () => ks.sprite.destroy(),
    });
  }

  // Juice (src/juice.js): a LUG key was just given at world point (x, y). The UI scene draws the burst there and the sparkles that fly to its key
  // counter (UIScene.playKeySparkle(), a separate scene, so this is an event like every other HUD message). Cosmetic: nothing waits for it.
  emitKeySparkle(x, y) {
    this.keySparkleAt = this.time.now;
    if (juiceEnabled()) this.game.events.emit('key-sparkle', { x, y });
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
    // FB-0046: any cell of the doorway counts (maplogic.js doorCoversTile()), not just its first tile.
    const warp = this.getWarpPoints().find((w) => doorCoversTile(w, tileX, tileY));
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
    this.transitioning = true; // (this also stops her dead -- haltPlayer(), see the accessor above)
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
    // FB-0046: she walks straight into the MIDDLE of a two-tile doorway (not along one leaf of it, not
    // over the frame beside it): across the door's width she is lined up on its centre line while she
    // takes the one step in, along the way she was already heading.
    const [dirX, dirY] = DIRECTION_OFFSET[facing] || [0, 0];
    const centre = doorCenterPx(warp);
    const lineUp = (warp.cellsW || 1) > 1 && dirX === 0 && dirY !== 0;
    const to = lineUp ? { x: centre.x, y: this.player.y + dirY * TILE } : undefined;
    // P4c (FB-0067): the door OPENS first (closed -> half -> open, 160 ms), then she walks in, then it CLOSES behind her while the
    // screen fades (the same 160 ms, inside the 250 ms fade). A door with no frames (or an overlay-less stand-in) skips straight to the walk.
    const walk = () => this.walkThroughDoor(facing, warp.kind, () => {
      this.player.anims.stop();
      if (overlay && overlay.close) { AudioManager.play('doorClose'); overlay.close(); }
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        if (overlay) overlay.destroy();
        this.scene.restart({ map: warp.to, spawn: warp.spawn, spawnAt: warp.spawnAt, viaWarpKind: warp.kind });
      });
    }, to);
    if (overlay && overlay.open) overlay.open(walk);
    else walk();
  }

  // P4b (FB-0064 / FB-0069): the lift ride. A dialog `{ warp: { to, spawnAt } }` action (src/dialog.js, the lift's floor choice, relayed
  // by UIScene) lands here: the same fade-out and scene restart a stairs warp ends with, but no walk (she rides): she arrives in
  // front of the doors of the lift named `spawnAt` on map `to`, and create() plays the ding. A missing map or object logs a warning and
  // toasts instead of crashing (the same rule as checkWarps()); a lift's data is tested to never name one (tests/unit/p4b-stairs-lift.test.js).
  warpTo({ to, spawnAt }) {
    if (this.transitioning) return;
    if (!MAPS[to]) {
      console.warn(`warp to an unknown map "${to}"`);
      this.game.events.emit('toast', 'Closed for now.');
      return;
    }
    this.transitioning = true; // (this also stops her dead -- haltPlayer(), see the accessor above)
    this.prompt.setVisible(false);
    // P4c (FB-0067): the lift's doors open (160 ms), then the fade starts and they close again inside it: she rides.
    const overlay = this.showLiftOverlay(this.nearestLift());
    const ride = () => {
      if (overlay && overlay.close) { AudioManager.play('doorClose'); overlay.close(); }
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ map: to, spawnAt, viaWarpKind: 'lift' });
      });
    };
    if (overlay && overlay.open) overlay.open(ride);
    else ride();
  }

  // P4c: the lift she is standing at (the nearest of this map's, there is one a floor), or null.
  nearestLift() {
    const p = this.player;
    let best = null;
    let bestD = Infinity;
    for (const lift of this.lifts || []) {
      const d = Phaser.Math.Distance.Between(p.x, p.y, lift.x, lift.y);
      if (d < bestD) { best = lift; bestD = d; }
    }
    return best;
  }

  showLiftOverlay(lift) {
    return lift && lift.door && lift.door.frames ? this.showDoorOverlay(lift.door) : null;
  }

  // P4c: arriving from a lift ride (create(), right after the ding): the doors of the lift she was sent to (`spawnAt`) open, stay open a
  // beat and close again. She is already standing in front of them with the controls (nothing here blocks input), so it is only a picture.
  playLiftArrival() {
    const lift = (this.lifts || []).find((l) => l.name === this.spawnAt);
    const overlay = this.showLiftOverlay(lift);
    if (!overlay) return;
    overlay.open(() => {
      this.time.delayedCall(LIFT_ARRIVAL_HOLD_MS, () => {
        AudioManager.play('doorClose');
        overlay.close(() => overlay.destroy());
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
    // P4c (FB-0067): the reverse of the departure: she appears behind the CLOSED door, it opens (160 ms), she steps out, and it closes
    // behind her (input is back the moment she has stepped out, the closing is only a picture and removes its own overlay).
    const walk = () => this.walkThroughDoor(facing, kind, () => {
      this.transitioning = false;
      if (overlay && overlay.close) { AudioManager.play('doorClose'); overlay.close(() => overlay.destroy()); }
      else if (overlay) overlay.destroy();
    }, { x: toPixel(this.spawn.x), y: toPixel(this.spawn.y) });
    if (overlay && overlay.open) overlay.open(walk);
    else walk();
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
    // FB-0046: WALKING speed and the plain walk animation, never the run she may have arrived at the door
    // with: a door step is one tile at WALK_SPEED (DOOR_WALK_MS), a longer arrival walk proportionally longer.
    const distance = Math.hypot(targetX - p.x, targetY - p.y);
    const duration = kind === 'stairs' ? STAIRS_WALK_MS : Math.max(DOOR_WALK_MIN_MS, Math.round((distance / TILE) * DOOR_WALK_MS));
    p.anims.timeScale = 1; // the run animation's faster rate must not carry over (movePlayer sets it per frame, but it is not running now)
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

  // ADR 0015 + P4c (FB-0067): the door's animated overlay, shown over the door's own tile(s) while she goes through. A door's frames
  // (src/maplogic.js doorFrames(): closed, half, open, each one tile name per cell of the doorway, left to right) become one Image per
  // cell whose tile is swapped frame by frame: `open(onDone)` plays them forward, `close(onDone)` backward, DOOR_FRAME_MS a frame, and
  // `destroy()` removes it (every overlay is also swept at scene shutdown, and each animation has a failsafe that finishes it a beat
  // late if a tween never reports in: a door can never be left stuck half open). The overlay starts on its first frame, which is the
  // door as drawn at rest, so showing it changes nothing until it plays. null (no overlay, the walk-in/out still happens) when the warp
  // has no frames at all: a closed/locked door, or one with no art. A door with a single frame (data from before P4c) just shows it.
  showDoorOverlay(warp) {
    const frames = warp.frames || (warp.openTiles ? [warp.openTiles] : null);
    if (!frames || !frames.length) return null;
    const key = `${warp.name || warp.to}@${warp.x},${warp.y}`;
    if (!this.doorAnims) this.doorAnims = new Map();
    const previous = this.doorAnims.get(key);
    if (previous) previous.destroy();
    const depth = warp.depth ?? this.doorOverlayDepth(warp); // FB-0077: the gate barrier sits at ground level, right over the tile layers
    const frameMs = warp.frameMs || DOOR_FRAME_MS; // ...and plays slower than a door
    const indexOfTile = (name) => {
      if (name === BLANK_TILE_NAME) return -1; // FB-0077: "nothing there" in this frame (the barrier's arm tiles once it is up)
      const index = this.tileInfo.tiles.findIndex((t) => t.name === name);
      if (index === -1) console.warn(`"${warp.name || warp.to}": unknown door tile "${name}"`);
      return index;
    };
    const frameTiles = frames.map((names) => names.map(indexOfTile));
    const cellCount = frames[frames.length - 1].length;
    const across = (warp.cellsH || 1) > 1 && (warp.cellsW || 1) === 1 ? 1 : Math.max(1, cellCount); // a door in a vertical wall stacks its cells
    const images = [];
    for (let i = 0; i < cellCount; i++) {
      const first = (frameTiles[0][i] ?? -1) >= 0 ? frameTiles[0][i] : frameTiles[frameTiles.length - 1][i];
      if (!(first >= 0)) { images.push(null); continue; }
      // (a cell whose first frame is blank, FB-0077, starts hidden: its image only borrows the last frame's tile until the animation shows it)
      images.push(this.tileImage((warp.x + (i % across)) * TILE, (warp.y + Math.floor(i / across)) * TILE, first).setDepth(depth).setVisible((frameTiles[0][i] ?? -1) >= 0));
    }
    const show = (k) => images.forEach((img, i) => {
      if (!img) return;
      const index = frameTiles[k][i];
      if (index >= 0) img.setFrame(index).setVisible(true);
      else img.setVisible(false);
    });
    let destroyed = false;
    let counter = null;
    let failsafe = null;
    let finishCurrent = null;
    const stop = () => {
      if (counter) { counter.stop(); counter = null; }
      if (failsafe) { failsafe.remove(false); failsafe = null; }
      finishCurrent = null;
    };
    const play = (reverse, onDone) => {
      if (destroyed) return;
      stop();
      const n = frames.length;
      const total = doorAnimDuration(n, frameMs);
      show(reverse ? n - 1 : 0);
      const finish = () => {
        if (destroyed || finishCurrent !== finish) return;
        stop();
        show(reverse ? 0 : n - 1);
        if (onDone) onDone();
      };
      finishCurrent = finish;
      if (total === 0) { finish(); return; }
      counter = this.tweens.addCounter({
        from: 0, to: total, duration: total,
        onUpdate: (tween) => { if (!destroyed && finishCurrent === finish) show(doorFrameAt(tween.getValue(), n, frameMs, reverse)); },
        onComplete: finish,
      });
      failsafe = this.time.delayedCall(total + DOOR_ANIM_FAILSAFE_MS, finish);
    };
    const anim = {
      key,
      open: (onDone) => play(false, onDone),
      close: (onDone) => play(true, onDone),
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        stop();
        images.forEach((img) => img && img.destroy());
        if (this.doorAnims && this.doorAnims.get(key) === anim) this.doorAnims.delete(key);
      },
    };
    this.doorAnims.set(key, anim);
    return anim;
  }

  // P4c: scene shutdown (a restart, the player quitting): no door overlay, tween or timer outlives the scene.
  destroyDoorAnims() {
    if (!this.doorAnims) return;
    for (const anim of [...this.doorAnims.values()]) anim.destroy();
    this.doorAnims.clear();
  }

  // Locked door feedback (ADR 0015): the door itself shakes a couple of px for ~200ms -- using
  // whatever tile is *actually* there right now (read straight off the live layer, not `openTiles`),
  // so this works even for a door with no `openTiles` authored at all, unlike showDoorOverlay() above.
  rattleDoor(warp) {
    const doorWidth = Math.max(1, warp.cellsW || 1, Math.round(warp.width || 1)); // FB-0046: both leaves of a two-tile door shake
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
      this.game.events.emit('hint', 'menu'); // FB-0075: "Esc for the menu" (queued right behind the map hint, shown once)
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

  // The small unskippable moments (src/moments.js, docs/plans/2026-10-04-moments-and-small-touches.md): the unicorn and the prince, Mevin the
  // drummer. momentDue() holds every rule (once only, 90 s of play apart, one per map visit, the order, the trigger rectangle, off with
  // `?moments=0`); this only says whether anything owns the screen right now (any script, a door or warp walk, a dialog, the pause menu,
  // the journal, the map: re-checked every frame, so a moment waits for the next free frame) and starts the one that is due.
  checkMoment() {
    if (!momentsEnabled()) return;
    const ui = this.scene.get('ui');
    const blocked = this.transitioning || this.scriptRunner.isRunning || !this.sys.isActive() || !ui.tutorial || ui.isBlocking();
    const moment = momentDue(GameState, GameState.playSeconds, {
      map: this.mapKey,
      tileX: Math.floor(this.player.body.center.x / TILE),
      tileY: Math.floor((this.player.body.bottom - 1) / TILE),
      enabled: true,
      blocked,
      visitCount: this.momentsThisVisit,
      freeSeconds: this.freeSeconds,
      keys: Object.values(GameState.quest.keys).filter(Boolean).length,
      anchor: (name) => resolveAnchor(this.mapObjects, name),
    });
    if (moment) this.playMoment(moment);
  }

  // Plays a moment's script (SCRIPTS[moment.script]) unskippable. It counts as played the instant it starts (a reload mid-scene never
  // replays it) and the spacing clock is stamped again when it ends. Whatever happens in the script, the end puts the world back:
  // the camera follows her again, the letterbox bars are gone, the ambient crowd is visible and every actor it spawned is removed.
  playMoment(moment) {
    const steps = SCRIPTS[moment.script];
    if (!steps) { console.warn(`moments: "${moment.id}" names an unknown script "${moment.script}"`); return; }
    this.momentsThisVisit++;
    markMomentStarted(GameState, moment.id, GameState.playSeconds);
    notifyStateChanged(); // src/save.js autosaves soon after
    const before = new Set(this.scriptRunner.actors.keys());
    this.retireAmbientFor(moment.id);
    this.setAmbientVisible(false);
    const restore = () => {
      for (const id of [...this.scriptRunner.actors.keys()]) if (!before.has(id)) this.scriptRunner.step_despawnActor(id);
      this.scene.get('ui').letterbox.snap(false);
      this.cameras.main.startFollow(this.player, true, 0.18, 0.18);
      this.setAmbientVisible(true);
      markMomentEnded(GameState, GameState.playSeconds);
      notifyStateChanged();
    };
    this.scriptRunner.run(steps, { unskippable: true }).then(restore, (error) => {
      console.warn(`moments: "${moment.id}" failed, putting the world back`, error);
      restore();
    });
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
    const step = objectiveTarget(this.mapKey, GameState.quest, GameState.flags); // P5c: the ICL's step depends on whether its door is open
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
    this.haltPlayer(); // FB-0072
    this.prompt.setVisible(false);
    this.scene.pause();
    this.scene.launch('cutscene', { key });
  }

  // The ending (docs/STORY.md "the box opens..."): unlike playCutscene()/launchMinigame() above,
  // nothing ever resumes 'world' or 'ui' afterwards -- src/scenes/box-opening.js hands off to
  // src/scenes/finale.js, then src/scenes/card.js, which ends on the title screen (docs/ROADMAP.md M3 "returns to the title
  // screen, keeping the save"), the same way PauseMenu.quitToTitle() (src/scenes/ui.js) stops both
  // scenes on its way there. Stopping 'ui' here (not just pausing 'world') also avoids a real bug a
  // pause would leave behind: 'ui' would keep listening for Esc the whole time box-opening/card own
  // the screen, and -- since its own dialog is closed by this point -- would open the pause menu
  // right underneath them. Triggered by the volunteer's 'reward' dialog entry's last action
  // (src/story.js, `{ boxOpening: true }`).
  playBoxOpening() {
    this.haltPlayer(); // FB-0072
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
