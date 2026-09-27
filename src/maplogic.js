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

// `?minigames=0` bypasses the real mini-game scenes (src/minigames/): a `minigame` dialog action
// resolves straight to 'won', the same way `?cutscene=0` skips a cutscene trigger -- most specs (the
// full LUG-hunt playthrough, dialog/save tests, ...) care about the *quest* reacting correctly to a
// key being won, not about actually playing a platformer/flyer/Tetris session headlessly every time.
// tests/e2e/helpers.js defaults this off; tests/e2e/minigames.spec.js turns it back on to test the
// mini-games themselves. `search` is injectable, same pattern as the helpers above.
function minigamesEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('minigames') !== '0';
}

// `?audio=0` skips preloading every registered sound (src/audio.js AudioManager.preload(), called
// from src/main.js BootScene and src/scenes/title.js) -- every AudioManager method already no-ops
// safely when a sound was never loaded (its own `loaded()` check), so this is purely a *performance*
// switch, not a correctness one: the 5 full-length music beds alone are several MB of real audio,
// and decoding them fresh on every single e2e test's page load (Playwright: docs/TESTING.md, a fresh
// browser context per test) measurably slows the whole suite down for no benefit most specs actually
// need. tests/e2e/helpers.js defaults this off; tests/e2e/audio.spec.js turns it back on for the
// handful of tests that actually care whether real files load and play without error.
function audioEnabled(search) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  return qs.get('audio') !== '0';
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

// ---------- depth groups and door entry (ADR 0015) ----------

// A door/stairs object's `facing` property is the direction the player faces once they arrive AT
// that object (docs/INTERIORS_PLAN.md "door object format"). world.js resolveSpawnAt() uses this
// going forward (`target + DIRECTION_OFFSET[facing]`); doorTileFromSpawn() below uses it in reverse.
const DIRECTION_OFFSET = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// The door/stairs tile a given arrival spawn point came from -- the exact inverse of world.js's own
// resolveSpawnAt() (`target + DIRECTION_OFFSET[facing]`). ADR 0015's arrival animation ("she appears
// in the doorway, hidden behind the group... walks out") needs to know which door she's arriving
// through from nothing but the spawn point + facing a map def already carries -- this is how, for
// both a Tiled door/stairs object and a text map's own `warps` entry. Rounded (Math.round, not
// Math.floor) because a spawn can sit on a half-tile (e.g. centered between a 2-tile-wide doorway,
// src/maps.js house's own warps): the door tile itself is always a whole tile.
function doorTileFromSpawn(spawn, facing) {
  const [dx, dy] = DIRECTION_OFFSET[facing] || [0, 0];
  return { x: Math.round(spawn.x - dx), y: Math.round(spawn.y - dy) };
}

// The group (smallest by tile area) that owns a tile at (x, y), among `groups` (plain {x, y, width,
// height, ...} rects in TILE units -- Tiled `depthGroup` objects via tiledObjects(), or a text map's
// own `depthGroups` array, src/maps.js). A tile inside more than one group belongs to the smallest
// one (say, a lamp post's own tiny rect over the corner of a bigger building's rect); a tile outside
// every group returns null and is left completely untouched: not baked, not hidden, not collided
// with any differently (world.js's own tile-visibility loop skips a null owner entirely).
function depthGroupAt(groups, x, y) {
  const hits = groups.filter((g) => x >= g.x && x < g.x + g.width && y >= g.y && y < g.y + g.height);
  if (!hits.length) return null;
  return hits.reduce((a, b) => (a.width * a.height <= b.width * b.height ? a : b));
}

// A door/stairs object's `openTiles` property (Tiled) or a text map's own `warps`/door entry
// (src/maps.js): a comma-separated list of tile names (assets/tiles.json), one per door tile, left
// to right, shown as a static overlay while the door is open (ADR 0015). Missing/empty -> null, so
// callers can degrade gracefully (the walk-in/out still happens, just with no overlay to show) --
// the campus art branch adds real tile names for this later; nothing here requires them yet.
function parseOpenTiles(value) {
  if (!value) return null;
  const names = value.split(',').map((s) => s.trim()).filter(Boolean);
  return names.length ? names : null;
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

// ---------- ADR 0016: in-world cutscene scripts, resolveAnchor() and the onboarding destination ----------

// A script's `move`/`cameraPan`/etc. steps can name a point on the CURRENT map instead of a raw tile
// coordinate (docs/plans/2026-09-26-premium-pass.md stage 6, decisions/0016): "spawn, gate, the Main
// Block door object, area/zone objects by name" -- any Tiled object (or a text map's own `mapObjects`,
// which is always `[]` today, ADR 0015's own note that a map without extra data just renders as
// before) whose `name` matches exactly. Resolved at *runtime*, not baked into the script, so a later
// map regeneration that moves a building doesn't silently break every script that walks up to its
// door -- only a renamed/removed object does, and that's a loud `null` a caller can check for, not a
// wrong position nobody notices. Returns the object's center in tile units (a point object's own
// width/height are 0, so `x + width/2` is just `x`), or null if nothing on this map has that name.
function resolveAnchor(mapObjects, name) {
  const found = (mapObjects || []).find((o) => o.name === name);
  if (!found) return null;
  return { x: found.x + found.width / 2, y: found.y + found.height / 2 };
}

// The treasure hunt's current objective, as one of OBJECTIVE_ROUTES' own keys (src/objective-routes.js)
// -- the same branching questObjectiveText() above already uses, just returning an id instead of the
// sentence a player reads, so FB-0033's destination arrow/minimap marker can look up *where* that
// objective is without re-deriving "which key is she missing" a second, differently-shaped way. `null`
// means "no on-screen destination right now" (the reward's already been handed over).
function objectiveId(quest) {
  if (quest.stage === 'arrival') return 'find-stall';
  if (quest.stage === 'hunting') {
    if (!quest.keys.physicsLab) return 'key-physicsLab';
    if (!quest.keys.icvl) return 'key-icvl';
    if (!quest.keys.room195) return 'key-room195';
    return 'return-stall';
  }
  return null;
}

// The current objective's route step for `mapKey` (src/objective-routes.js OBJECTIVE_ROUTES), or null
// if either there's no active objective at all (objectiveId() returned null) or the route simply
// doesn't name a stop on this particular map (she's off the story's route -- exploring campus while
// the objective is three floors up a building she isn't in, say). world.js turns the returned
// `{ map, anchor }`/`{ map, npc }`/`{ map, keyStation }` step into actual on-screen tile coordinates
// (it alone has the live mapObjects/npcs/keyStations to resolve an id/anchor name against); this
// function only picks *which* step applies, which needs no live scene at all.
function objectiveTarget(mapKey, quest) {
  const id = objectiveId(quest);
  if (!id) return null;
  const route = OBJECTIVE_ROUTES[id] || [];
  return route.find((step) => step.map === mapKey) || null;
}
