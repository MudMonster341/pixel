// A shared "live campus" backdrop for the title screen and the M3a opening's own greeting/name/
// clothes screens (docs/plans/2026-09-26-premium-pass.md stage 6, FB-0032: "instead of the static
// gate picture"). A lightweight top-down render of the *real* generated campus map -- the same
// 1px-per-tile canvas technique src/scenes/ui.js Minimap already uses for its own thumbnail, just
// scaled up and slowly panned/dimmed behind the menu/dialog -- rather than booting a whole WorldScene
// (expensive: physics world, depth groups, NPCs) just to show its backdrop. One canvas texture, built
// once and cached under 'campus-pan' (Phaser's TextureManager persists it across every scene restart
// in this Game instance, same as 'title-bg'/'mustafa-portrait' already do), so only the first of these
// four screens to ever run actually builds it; every one after that just reuses it.

// Call from preload(): queues the two files the texture needs, each guarded so a second/third/fourth
// screen doesn't re-request what's already cached.
function preloadCampusPanBackdrop(scene) {
  if (!scene.cache.tilemap.exists('map-campus')) scene.load.tilemapTiledJSON('map-campus', 'assets/maps/campus.json');
  if (!scene.cache.json.exists('tileinfo')) scene.load.json('tileinfo', 'assets/tiles.json');
}

function ensureCampusPanTexture(scene) {
  if (scene.textures.exists('campus-pan')) return;
  const json = scene.cache.tilemap.get('map-campus').data;
  const tileInfo = scene.cache.json.get('tileinfo');
  const grid = gridFromTiled(json); // src/maplogic.js -- the same grid Minimap/checkWarps etc. use
  const cols = grid[0].length;
  const rows = grid.length;
  const texture = scene.textures.createCanvas('campus-pan', cols, rows);
  const ctx = texture.getContext();
  const pixels = ctx.createImageData(cols, rows);
  const colors = tileInfo.tiles.map((tile) => [1, 3, 5].map((i) => parseInt(tile.color.slice(i, i + 2), 16)));
  const EMPTY = [0x0f, 0x11, 0x1a]; // matches the game's own #12131a background family, for any gap cell
  grid.forEach((row, ty) => {
    row.forEach((index, tx) => {
      const [r, g, b] = (index >= 0 && colors[index]) || EMPTY;
      const p = (ty * cols + tx) * 4;
      pixels.data[p] = r; pixels.data[p + 1] = g; pixels.data[p + 2] = b; pixels.data[p + 3] = 255;
    });
  });
  ctx.putImageData(pixels, 0, 0);
  texture.refresh();
  scene.textures.get('campus-pan').tiles = { cols, rows, mapObjects: tiledObjects(json) };
}

// Adds the pannable Image to `scene`, already positioned/scaled/dimmed, and starts its own slow drift
// -- returns it so a scene can layer its own dim rectangle/UI on top exactly as it did over the old
// static illustration. `scale` (screen px per map tile) defaults to the world's own ZOOM (config.js),
// so this reads as "the real map, the way you'll actually see it in play", not a toy map-screen
// thumbnail. Framed on the Main Block/Gate 2 (the story's own hub) when that object exists on the
// map, rather than an arbitrary map center that could just as easily land on empty desert.
function buildCampusPanBackdrop(scene, { alpha = 0.32, panMs = 30000 } = {}) {
  ensureCampusPanTexture(scene);
  const tex = scene.textures.get('campus-pan');
  const { cols, rows, mapObjects } = tex.tiles;
  const scale = ZOOM;
  const focus = mapObjects.find((o) => o.name === 'Main Block entrance') || mapObjects.find((o) => o.name === 'Gate 2 (Main Entrance)');
  const focusX = focus ? focus.x : cols / 2;
  const focusY = focus ? focus.y : rows / 2;

  const image = scene.add.image(0, 0, 'campus-pan').setOrigin(0, 0).setScale(scale).setAlpha(alpha);
  const baseX = GAME_WIDTH / 2 - focusX * scale;
  const baseY = GAME_HEIGHT / 2 - focusY * scale;
  image.setPosition(baseX, baseY);

  const driftX = Math.min(140, focusX * scale, cols * scale - focusX * scale);
  const driftY = Math.min(110, focusY * scale, rows * scale - focusY * scale);
  scene.tweens.add({
    targets: image, x: baseX - driftX, y: baseY - driftY,
    duration: panMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
  });
  return image;
}
