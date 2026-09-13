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
  return index !== undefined && !tileInfo.tiles[index].solid;
}
