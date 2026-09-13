// Pure map helpers (no Phaser here), shared by the game and the automated tests.

// Turns a map definition into rows of tile indices, with buildings stamped on top.
// Throws a clear error for anything that doesn't resolve, so a typo in a map fails loudly.
function buildTileGrid(def, tileInfo) {
  const indexOf = new Map(tileInfo.tiles.map((tile, i) => [tile.name, i]));
  const lookup = (name, where) => {
    if (!indexOf.has(name)) throw new Error(`${def.name}: unknown tile "${name}" at ${where}`);
    return indexOf.get(name);
  };

  const grid = def.rows.map((row, y) =>
    [...row].map((ch, x) => {
      if (!Object.hasOwn(def.legend, ch)) throw new Error(`${def.name}: no legend entry for "${ch}" at ${x},${y}`);
      return lookup(def.legend[ch], `${x},${y}`);
    }),
  );

  for (const { type, x, y } of def.structures || []) {
    const structure = STRUCTURES[type];
    if (!structure) throw new Error(`${def.name}: unknown structure "${type}"`);
    structure.forEach((names, dy) =>
      names.forEach((name, dx) => {
        if (grid[y + dy]?.[x + dx] === undefined) {
          throw new Error(`${def.name}: structure "${type}" at ${x},${y} goes off the map`);
        }
        grid[y + dy][x + dx] = lookup(name, `${type} ${x + dx},${y + dy}`);
      }),
    );
  }
  return grid;
}

function isWalkableTile(grid, tileInfo, x, y) {
  const index = grid[y]?.[x];
  return index !== undefined && index >= 0 && !tileInfo.tiles[index].solid;
}

// ---------- Tiled maps (e.g. the campus, ADR 0007) ----------

// Rows of tile indices for a Tiled map: the topmost non-empty tile of each cell (gid = index + 1).
// A layer named "overhead" (drawn above the player, e.g. tree canopies, ADR 0008) is skipped: it's
// decoration over whatever is on the ground/structures layers, not the tile a cell's walkability
// or minimap colour should come from.
function gridFromTiled(json) {
  const layers = json.layers.filter((layer) => layer.type === 'tilelayer' && layer.name !== 'overhead');
  const grid = [];
  for (let y = 0; y < json.height; y++) {
    const row = new Array(json.width).fill(-1);
    for (const layer of layers) {
      for (let x = 0; x < json.width; x++) {
        const gid = layer.data[y * json.width + x];
        if (gid) row[x] = gid - 1;
      }
    }
    grid.push(row);
  }
  return grid;
}

// Objects from a Tiled map, with positions and sizes in tiles and properties as a plain object.
function tiledObjects(json) {
  const size = json.tilewidth;
  return json.layers
    .filter((layer) => layer.type === 'objectgroup')
    .flatMap((layer) => layer.objects)
    .map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type || o.class,
      x: o.x / size,
      y: o.y / size,
      width: o.width / size,
      height: o.height / size,
      props: Object.fromEntries((o.properties || []).map((p) => [p.name, p.value])),
    }));
}

// The map to start on: `?map=<key>` (dev and tests), otherwise START_MAP.
function initialMapKey() {
  const key = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('map');
  return key && MAPS[key] ? key : START_MAP;
}
