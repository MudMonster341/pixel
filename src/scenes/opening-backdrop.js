// A shared "live campus" backdrop for the title screen and the M3a opening's own greeting/name/
// clothes screens (docs/plans/2026-09-26-premium-pass.md stage 6, FB-0032: "instead of the static
// gate picture"). Quality-loop category 4 run 2 (docs/QUALITY_LOOP.md): this used to render the
// campus at 1 pixel per tile (a canvas built from each tile's own *average* color, src/scenes/ui.js
// Minimap's own thumbnail technique) and scale that blurry little image up -- cheap, but it reads as
// a dark, blurry schematic, not the game world. It's now a real, lightweight Phaser Tilemap built the
// same way src/scenes/world.js builds the actual campus map (the same 'tiles' tileset image, the same
// `map-campus` Tiled JSON, `addTilesetImage`/`createLayer`) at the real ZOOM -- the honest game world,
// just with no physics bodies, no NPCs and no collision set on any layer (the one thing that keeps
// this "lightweight": Phaser's own tilemap layers already cull to the camera's view, so an 8000+-tile
// map costs nothing extra just for existing off screen).
//
// Built fresh per scene (title/greeting/name/customize each get their own TilemapLayer objects -- a
// GameObject can't be shared across scene instances) rather than cached like the old canvas texture
// was; `preloadCampusPanBackdrop()` still only queues the underlying map JSON/tileset image once no
// matter how many of the four screens ask for it (Phaser's own loader/texture cache already dedupes).

// Call from preload(): queues the tilemap JSON + the 'tiles' tileset image this needs, each guarded so
// a second/third/fourth screen doesn't re-request what's already cached (and so a screen reached
// *before* src/main.js BootScene's own preload -- every one of these four can be -- doesn't find
// 'tiles' missing).
function preloadCampusPanBackdrop(scene) {
  if (!scene.cache.tilemap.exists('map-campus')) scene.load.tilemapTiledJSON('map-campus', 'assets/maps/campus.json');
  if (!scene.textures.exists('tiles')) scene.load.image('tiles', 'assets/tiles.png');
}

// The tour stops the backdrop slowly pans across, in tile coordinates -- the Main Block entrance and
// Gate 2 (both real, named Tiled objects, the same ones src/scripts.js's own camera pans use) plus the
// avenue between them, where the campus's own palms are actually planted
// (docs/STYLE_GUIDE.md "palms are now only planted at the entrance avenue and flanking the Main
// Block's own steps") -- there's no single named object for "the avenue", so its midpoint stands in
// for it. Falls back to the map's own center if, somehow, neither named object exists.
function backdropTourSpots(mapObjects, cols, rows) {
  const named = (name) => {
    const o = mapObjects.find((m) => m.name === name);
    return o ? { x: o.x + o.width / 2, y: o.y + o.height / 2 } : null;
  };
  const mainBlock = named('Main Block entrance');
  const gate = named('Gate 2 (Main Entrance)');
  const avenue = mainBlock && gate ? { x: (mainBlock.x + gate.x) / 2, y: (mainBlock.y + gate.y) / 2 } : null;
  const spots = [mainBlock, avenue, gate].filter(Boolean);
  return spots.length ? spots : [{ x: cols / 2, y: rows / 2 }];
}

// Adds the real campus tilemap's own layers (ground/structures/overhead -- whatever the Tiled map
// actually has, minus its object layer), already positioned/scaled/dimmed at the first tour stop, and
// starts the slow pan across every stop in turn -- returns the layers so a scene can layer its own dim
// rectangle/UI on top exactly as it did over the old canvas image. `scale` is always the world's own
// ZOOM (config), so this reads as "the real map, the way you'll actually see it in play".
function buildCampusPanBackdrop(scene, { alpha = 0.32, panMs = 9000 } = {}) {
  const key = 'map-campus';
  const json = scene.cache.tilemap.get(key).data;
  const map = scene.make.tilemap({ key });
  const tileset = map.addTilesetImage('tiles', 'tiles');
  const layers = json.layers
    .filter((layer) => layer.type === 'tilelayer')
    .map((layer) => map.createLayer(layer.name, tileset, 0, 0).setAlpha(alpha).setScale(ZOOM));

  const mapObjects = tiledObjects(json);
  const spots = backdropTourSpots(mapObjects, json.width, json.height);
  const toScreen = (spot) => ({
    x: GAME_WIDTH / 2 - spot.x * TILE * ZOOM,
    y: GAME_HEIGHT / 2 - spot.y * TILE * ZOOM,
  });

  const start = toScreen(spots[0]);
  layers.forEach((layer) => layer.setPosition(start.x, start.y));

  if (spots.length > 1) {
    let next = 1 % spots.length;
    const tourToNextSpot = () => {
      const to = toScreen(spots[next]);
      next = (next + 1) % spots.length;
      scene.tweens.add({ targets: layers, x: to.x, y: to.y, duration: panMs, ease: 'Sine.easeInOut', onComplete: tourToNextSpot });
    };
    tourToNextSpot();
  }

  return layers;
}
