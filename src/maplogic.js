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

// ---------- cutscenes (P4: Gate 2 welcome, etc.) ----------

// `?cutscene=0` turns cutscenes off (used by tests that would otherwise walk through a trigger).
// `search` is injectable so this stays pure/testable; in the browser it defaults to the page's own
// query string, the same pattern as initialMapKey() above.
function cutscenesEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('cutscene') !== '0';
}

// `?title=0` skips the title screen and its loading screen, landing straight on the world/ui scenes
// exactly like every build before FB-0023/0024 did (docs/GAME_FEEL.md). Most e2e specs want this --
// tests/e2e/helpers.js openGame() sets it by default -- only the title-flow specs themselves turn
// the title screen back on. `search` is injectable, same pattern as the helpers above.
function titleEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('title') !== '0';
}

// `?intro=0` skips the M3a opening (Mustafa's greeting, name entry, customisation, the bus arrival)
// straight to the loading screen, the same way `?title=0` skips the title screen itself -- most
// title-flow tests still want the title screen but not a multi-scene opening every time they press
// Play; tests/e2e/helpers.js openTitle() sets this by default, only the opening's own spec turns it
// back on. `search` is injectable, same pattern as the helpers above.
function introEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('intro') !== '0';
}

// The smallest object (by tile area) among a Tiled map's objects whose type is one of `types` and
// whose rectangle contains the point (x, y) — all in tile units, as tiledObjects() returns them.
// Smallest-first so a specific area (e.g. "Athletics Track") wins over a bigger one it sits inside
// (e.g. the whole campus), and so a small cutscene trigger strip isn't shadowed by anything larger.
function objectAt(mapObjects, types, x, y) {
  const hits = mapObjects.filter(
    (o) => types.includes(o.type) && x >= o.x && x < o.x + o.width && y >= o.y && y < o.y + o.height,
  );
  if (!hits.length) return null;
  return hits.reduce((a, b) => (a.width * a.height <= b.width * b.height ? a : b));
}

// Play-once check: a cutscene should start only if it has a key and that key hasn't been seen yet
// (GameState.seenCutscenes, a Set of keys, the same style as GameState.collected).
function notSeenCutscene(key, seen) {
  return Boolean(key) && !seen.has(key);
}

// ---------- locked doors/stairs (roadmap M1 "Blocked doors", docs/STORY.md "Rules for the world") ----------
// A map def's own `doorLocks` (src/maps.js) is a list of `{ match, stages? }` rules: `match` is a
// door/stairs object's exact Tiled `name` (world.js warpPoints() checks it against every door/stairs
// object on the current map, the same objects the warp itself already comes from). The door is open
// once GameState.quest.stage is one of `stages`; omitting `stages` means "never" -- a route the story
// doesn't use at all (e.g. a building it never sends her into), not just one she hasn't unlocked yet.

function doorLockRule(doorLocks, name) {
  return (doorLocks || []).find((rule) => rule.match === name) || null;
}

function isDoorLocked(rule, stage) {
  if (!rule) return false;
  return !(rule.stages && rule.stages.includes(stage));
}

// ---------- quest tracker text (M1 leftover, docs/STORY.md) ----------
// The single line src/scenes/ui.js's QuestTracker shows under "Keys: n / 3" -- pure so it can be
// unit-tested directly against every stage/key combination without booting a scene.
//
// Unlike the volunteer's own spoken hint (src/story.js, keyed to how many keys she's holding, per
// the task brief's literal wording), the tracker checks which *specific* key is still missing, in
// docs/STORY.md's own room order (Physics Lab -> ICVL -> Room 195) -- so it never tells her to go
// find a key she's already carrying just because she happened to collect them out of order.
function questObjectiveText(quest) {
  if (quest.stage === 'arrival') return 'Find the LUG stall behind the Main Block staircase.';
  if (quest.stage === 'hunting') {
    if (!quest.keys.physicsLab) return 'Find the first key: the Physics Lab, 3rd floor.';
    if (!quest.keys.icvl) return 'Find the next key: the ICVL, 1st floor.';
    if (!quest.keys.room195) return 'Find the last key: Room 195.';
    return 'Bring all 3 keys back to the LUG stall.';
  }
  if (quest.stage === 'rewarded') return 'Treasure hunt complete! You got the small box.';
  return '';
}
