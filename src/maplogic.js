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

// Quality loop, category 1 run 3 (2026-09-29): "every named building/area should resolve to its own
// name... or fall back to the nearest named building within a few tiles" -- the location banner used
// to show whatever objectAt() found and nothing else, so standing just past a building's own 'zone'
// (which only reaches a few tiles past its real footprint -- extended from the door, or from the
// footprint's own southmost row for a building with no door yet, like a hostel; see
// tools/campus/build-campus.js's own comment on why) fell all the way through to the one thing that
// always contains every point inside the fence: the whole-campus outline itself (`kind: 'campus'`).
// If objectAt() found that (or nothing), this looks for the nearest real 'zone'/'building' object
// within `nearTiles` tiles -- measuring to the closest point on its own rectangle, so standing
// anywhere inside it still counts as distance 0 -- and uses that name instead.
function nearestNamedArea(mapObjects, x, y, nearTiles = 8) {
  const hit = objectAt(mapObjects, ['area', 'zone'], x, y);
  if (hit && hit.props.kind !== 'campus') return hit;
  let best = null;
  let bestDist = Infinity;
  for (const o of mapObjects) {
    if (o.type !== 'zone' && o.type !== 'building') continue;
    const cx = Math.max(o.x, Math.min(x, o.x + o.width));
    const cy = Math.max(o.y, Math.min(y, o.y + o.height));
    const dist = Math.hypot(x - cx, y - cy);
    if (dist <= nearTiles && dist < bestDist) {
      bestDist = dist;
      best = o;
    }
  }
  return best || hit;
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

// ---------- title menu layout (FB-0075) ----------
// The title screen's buttons are bottom-anchored to `bottom` (never centred: a taller menu must not creep down into the
// parallax foreground strip) and never reach above `topMin` (the "LUG Treasure Hunt" subtitle). Adding "Quit" made the
// worst case six buttons (Play, Continue, Watch the Card Again, Controls, Credits, Quit), which at the usual 52 px + 12 px
// would run off the 540 px screen -- so from five buttons up the gap tightens and the buttons shrink just enough to fit.
const TITLE_MENU = { buttonH: 52, gap: 12, tightGap: 8, bottom: 470, topMin: 180 };
function titleMenuLayout(count) {
  const n = Math.max(1, count);
  const available = TITLE_MENU.bottom - TITLE_MENU.topMin;
  const gap = n <= 4 ? TITLE_MENU.gap : TITLE_MENU.tightGap;
  const buttonH = Math.min(TITLE_MENU.buttonH, Math.floor((available - (n - 1) * gap) / n));
  const h = n * buttonH + (n - 1) * gap;
  return { buttonH, gap, h, y: Math.max(TITLE_MENU.topMin, TITLE_MENU.bottom - h) };
}

// ---------- doorway size (FB-0046) ----------
// A real doorway is two tiles wide (the Main Block's glass double door, every interior exterior-door), but its
// Tiled `door` object is a single point on the first tile, so only that one tile ever walked her through: she could stand
// on the other leaf without entering -- "walk over the door". The map generators now write a `cells` property
// ("2x1" = two wide and one deep, "1x2" for a door in a vertical wall) and EVERY cell of it triggers the door
// (world.js checkWarps()). Missing or garbled -> one tile, exactly as before (text-map warps, closed doors, stairs).
function parseDoorCells(value) {
  const match = /^\s*(\d+)\s*x\s*(\d+)\s*$/.exec(String(value == null ? '' : value));
  const w = match ? Number(match[1]) : 1;
  const h = match ? Number(match[2]) : 1;
  return { w: w >= 1 ? w : 1, h: h >= 1 ? h : 1 };
}

// True if tile (tx, ty) is one of the cells of `warp` (`{ x, y, cellsW?, cellsH? }`, x/y = its first tile).
function doorCoversTile(warp, tx, ty) {
  const w = warp.cellsW || 1;
  const h = warp.cellsH || 1;
  return tx >= warp.x && tx < warp.x + w && ty >= warp.y && ty < warp.y + h;
}

// The pixel centre of a doorway (x across its cells, y of its first row): what door assist steers a player towards,
// so she walks in through the middle of a two-tile door instead of along one leaf of it.
function doorCenterPx(warp) {
  const w = warp.cellsW || 1;
  return { x: (warp.x + w / 2) * TILE, y: warp.y * TILE + TILE / 2 };
}

// How opaque a map's `overhead` tile layer is drawn (src/scenes/world.js). Outdoors it is the tree canopies (ADR 0008) and
// stays solid. Indoors it is the foyer's gold chandelier, which hid the player's head as she crossed the hall (defect D10,
// 2026-10-04), so it is drawn see-through: she stays visible and the ceiling piece still reads. Pure, so it is unit-tested.
const INDOOR_OVERHEAD_ALPHA = 0.45;
function overheadAlpha(def) {
  return def && def.indoors ? INDOOR_OVERHEAD_ALPHA : 1;
}

// ---------- full-screen map labels (defect D01, 2026-10-04) ----------
// The M-key map used to drop a label at the centre of every named area, spaced only by a 26 px "centres are far enough"
// test. Wide names overprinted each other ("Side Gate / Hostel D / Courts / Main Block ..."), a name near the edge
// ("Mechanical Block", "Manipal University Boys Hostel...") ran off the frame, and which of two clashing labels survived
// was decided by area, not by what a player needs. These pure helpers decide it properly and are unit-tested:
//   fullMapLabelCandidates(): which named things get a label at all (the filters the old inline code had), each tagged with
//                             a priority (story-relevant names first: Main Block, gates, Library, Mechanical, then hostels and courts).
//   placeMapLabels():         lays labels out in priority order, clamps each one inside the map frame, truncates a name that
//                             is wider than the frame allows, and SKIPS a label whose box would overlap one already placed.
// The HUD font is monospace ("Press Start 2P"), so a label's box is known from its character count without a browser.
const MAP_LABEL = { charW: 8, height: 12, pad: 3, gap: 2, maxChars: 24 };
// Label priority, lower is placed first: the story landmarks, then hostels and courts, then everything else.
function mapLabelPriority(name) {
  if (/main block|gate|library|mechanical/i.test(name)) return 0;
  if (/hostel|court/i.test(name)) return 1;
  return 2;
}

function fullMapLabelCandidates(objects, cols, rows) {
  const totalArea = cols * rows;
  // Skips the generator's own "no real name" placeholder (`Building <osm id>`), road/roundabout infrastructure areas and the
  // "Gate Parking (West/East)" lots (FB-0026: they sat close enough to Gate 2 and the Main Block to eat their label's slot),
  // and anything covering over ~30% of the map (the whole-campus outline).
  const isPlaceholderName = (name) => /^Building \d+$/.test(name);
  const isInfrastructureArea = (o) => o.type === 'area' && (o.props?.kind === 'road' || o.props?.kind === 'roundabout' || /^Gate Parking \(/.test(o.name));
  return (objects || [])
    .filter((o) => ['area', 'building'].includes(o.type) && o.name && !isPlaceholderName(o.name) && !isInfrastructureArea(o) && o.width * o.height < totalArea * 0.3)
    .map((o) => ({ name: o.name, x: o.x + o.width / 2, y: o.y + o.height / 2, area: o.width * o.height, priority: mapLabelPriority(o.name) }));
}

// `candidates`: [{ name, px, py, area, priority }] with px/py the wanted label centre in SCREEN pixels. `bounds`: { x0, y0, x1, y1 }
// the frame the labels must stay inside. Returns [{ name, text, x, y, w, h }] (centre x/y), in placement order.
function placeMapLabels(candidates, bounds, opts = {}) {
  const { charW, height, pad, gap, maxChars } = { ...MAP_LABEL, ...opts };
  const order = [...candidates].sort((a, b) => (a.priority - b.priority) || (b.area - a.area));
  const placed = [];
  for (const c of order) {
    if (placed.some((p) => p.name === c.name)) continue; // the same name can come twice (an area and a building): label it once
    const text = c.name.length > maxChars ? `${c.name.slice(0, maxChars - 1)}…` : c.name;
    const w = text.length * charW + pad * 2;
    if (w > bounds.x1 - bounds.x0 || height > bounds.y1 - bounds.y0) continue;
    const x = Math.min(Math.max(c.px, bounds.x0 + w / 2), bounds.x1 - w / 2);
    const y = Math.min(Math.max(c.py, bounds.y0 + height / 2), bounds.y1 - height / 2);
    const clash = placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 + gap && Math.abs(p.y - y) < (p.h + height) / 2 + gap);
    if (clash) continue;
    placed.push({ name: c.name, text, x, y, w, h: height });
  }
  return placed;
}

// Whether the always-on hotbar is drawn this frame (src/scenes/ui.js UIScene.update()): the dialog box replaces it, and
// the pause menu with its Controls page covers the middle of the screen (defect D16). Pure so it is unit-tested.
function hotbarShouldShow({ dialogOpen = false, pauseOpen = false } = {}) {
  return !dialogOpen && !pauseOpen;
}

// Greedy word wrap for a monospace font (the HUD uses "Press Start 2P": one glyph is exactly `fontSize` px wide), so the
// quest pill's line breaks are decided here, in pure code, and can be tested without a browser. A word longer than a
// line is split rather than lost.
function wrapWords(text, maxChars) {
  const lines = [];
  let line = '';
  for (let word of String(text).split(/\s+/).filter(Boolean)) {
    while (word.length > maxChars) {
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, maxChars));
      word = word.slice(maxChars);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= maxChars) line += ` ${word}`;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

// What the top-right quest pill says: a keys line and the whole objective, wrapped to the pill's inner width. Pure.
function trackerPillText(quest) {
  const keysHeld = Object.values(quest.keys).filter(Boolean).length;
  const maxChars = Math.floor((HUD_TRACKER.w - 2 * TRACKER_PILL.pad) / TRACKER_PILL.fontSize);
  return { keys: `Keys ${keysHeld}/3`, lines: wrapWords(questObjectiveText(quest), maxChars), maxChars };
}

// ---------- quest tracker text (M1 leftover, docs/STORY.md) ----------
// The single line src/scenes/ui.js's QuestTracker shows under "Keys: n / 3" -- pure so it can be
// unit-tested directly against every stage/key combination without booting a scene.
//
// Unlike the volunteer's own spoken hint (src/story.js, keyed to how many keys she's holding, per
// the task brief's literal wording), the tracker checks which *specific* key is still missing, in
// docs/STORY.md's own room order (Physics Lab -> ICL -> Room 195) -- so it never tells her to go
// find a key she's already carrying just because she happened to collect them out of order.
function questObjectiveText(quest) {
  if (quest.stage === 'arrival') return 'Find the LUG stall behind the Main Block staircase.';
  if (quest.stage === 'hunting') {
    if (!quest.keys.physicsLab) return 'Find the first key: the Physics Lab, 3rd floor.';
    if (!quest.keys.icl) return 'Find the next key: the ICL, 1st floor.';
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
    if (!quest.keys.icl) return 'key-icl';
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

// ---------- Character sheet registry (FB-0044) ----------
// Every character spritesheet the game can draw, derived from the content that references it -- a map
// NPC's `character` (src/maps.js), an ambient entry's `character` (src/ambient.js) and a script actor's
// `sprite` (src/scripts.js spawnActor, `kind` 'character'; `kind: 'image'` actors like the bus are plain
// images, not character sheets) -- so BootScene's preload (src/main.js) can never forget a new
// character: `npc-ambient-a..f` used to be generated but never loaded, so some students drew as
// Phaser's black-and-green __MISSING box. An NPC def with no `character` uses the legacy hand-drawn
// 'npc' sheet (Tomas/Guide, src/scenes/world.js createNpcs()). Returns [{ key, file }] sorted by key,
// `file` relative to the web root ('assets/<key>.png', the name tools/make-assets.js writes).
function characterSheets(maps, ambient, scripts) {
  const keys = new Set();
  for (const def of Object.values(maps || {})) {
    for (const npc of def.npcs || []) keys.add(npc.character ? `npc-${npc.character}` : 'npc');
  }
  for (const list of Object.values(ambient || {})) {
    for (const entry of list) keys.add(ambientSheetKey(entry)); // club outfit variant (FB-0057), src/campus-facts.js
  }
  const visit = (node) => {
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!node || typeof node !== 'object') return;
    const spawn = node.spawnActor;
    if (spawn && spawn.sprite && (spawn.kind || 'character') === 'character') keys.add(spawn.sprite);
    Object.values(node).forEach(visit);
  };
  visit(Object.values(scripts || {}));
  return [...keys].sort().map((key) => ({ key, file: `assets/${key}.png` }));
}

// ---------- Animal sheet registry (decisions/0018) ----------
// Every animal spritesheet the content can draw, derived from src/animals.js the same way characterSheets()
// derives the character ones, so BootScene's preload (src/main.js) can never forget a new species.
// `animals`: ANIMALS ({ mapKey: [{ species, ... }] }), `species`: ANIMAL_SPECIES, `layouts`: ANIMAL_LAYOUTS.
// Returns [{ key, file, frameWidth, frameHeight }] sorted by key (`file` relative to the web root).
function animalSheets(animals, species, layouts) {
  const sheets = new Map();
  for (const list of Object.values(animals || {})) {
    for (const entry of list) {
      const info = species[entry.species];
      if (!info) throw new Error(`animal "${entry.id}": unknown species "${entry.species}"`);
      const layout = layouts[info.layout];
      sheets.set(info.sheet, { key: info.sheet, file: `assets/${info.sheet}.png`, frameWidth: layout.frameW, frameHeight: layout.frameH });
    }
  }
  return [...sheets.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

// ---------- Interaction priority (bug: an exact distance tie went to an ambient NPC over a key station) ----------
// What E talks to is chosen by pickInteractable(): the nearest candidate wins *unless* a higher-priority
// kind is within INTERACT_TIE_MARGIN px of it, in which case the story object wins. Data, not a
// one-off: every interactable kind gets a priority here (higher wins), so adding one -- every ambient
// student becoming talkable, say -- is a new row, not a new branch. Quest givers and key stations are
// story objects; ambient students are atmosphere and must never shadow them. (Doors/stairs aren't
// E-interactables -- walking onto one warps -- so they don't take part.)
const INTERACT_PRIORITY = {
  keyStation: 3, // a key room's desk: the treasure hunt's own objective
  questNpc: 2, // a story NPC with dialog data (the volunteer, ...)
  ambientNpc: 1, // campus atmosphere (src/ambient.js)
  animal: 1, // a talkable cat (src/animals.js): atmosphere too, never shadows a story object
};
const INTERACT_TIE_MARGIN = 4; // px: a story object this much (or less) farther away still wins

// `candidates`: [{ role, distance, ... }] already filtered to the interact range; `role` is a key of
// INTERACT_PRIORITY. Returns the candidate E should act on, or null if there are none. Among every
// candidate within `margin` of the nearest one, the highest priority wins; equal priority -> nearer
// wins (the first listed on an exact tie). An unknown role ranks below every known one.
function pickInteractable(candidates, margin = INTERACT_TIE_MARGIN, priorities = INTERACT_PRIORITY) {
  if (!candidates || candidates.length === 0) return null;
  const rank = (c) => priorities[c.role] ?? 0;
  const nearest = Math.min(...candidates.map((c) => c.distance));
  let best = null;
  for (const c of candidates) {
    if (c.distance > nearest + margin) continue;
    if (!best || rank(c) > rank(best) || (rank(c) === rank(best) && c.distance < best.distance)) best = c;
  }
  return best;
}

// ---------- HUD layout (docs/GAME_FEEL.md rule 2, docs/QUALITY_LOOP.md category 4 "UI and menus") ----------
// Pure layout math for every top-level HUD box (src/scenes/ui.js's Minimap/LocationBanner/HintBanner/
// QuestTracker/Hotbar all read their own box from this, rather than each computing its own position),
// extracted so a unit test can prove the game's own claim -- "the internal UI coordinate space is
// always exactly 960x540 (Scale.FIT)... a panel that fits at 960x540 fits at every size, by
// construction" (GAME_FEEL.md rule 2) -- instead of just asserting it. Every box is `{x, y, w, h}`,
// top-left origin, in UI-canvas pixels (STYLE_GUIDE.md "UI canvas": screen-fixed, never the world
// camera's zoom). Each box is a fixed size anchored to a corner/edge/center with a constant margin
// (never scaled by `width`/`height`), the same "anchored, not stretched" shape every real Pokemon-style
// HUD uses -- which is also what makes "no overlap, stays on screen" true at every size *by
// construction*: corner-anchored boxes (minimap, tracker) only move further apart as the screen grows,
// and center-anchored ones (banner, hint, hotbar) move together, never towards a corner box.
const HUD_MARGIN = 16;
const HUD_MINIMAP = { areaW: 120, areaH: 90, pad: 8 }; // ~120x90 map area, declutter pass (was 160x120)
// D15 (defect sweep 2026-10-04): the pill used to be one line, so the objective was shrunk to 6 px and then cut off with an
// ellipsis ("Keys 0/3 . Find the LUG stall behind the ..."). It is now a "Keys n/3" line plus the WHOLE objective wrapped to
// at most TRACKER_PILL.maxLines lines at the normal 8 px size, so `collapsedH` is the pill's tallest case.
const HUD_TRACKER = { w: 280, collapsedH: 56, expandedH: 84 }; // a compact pill, expandable on change
const TRACKER_PILL = { fontSize: 8, pad: 14, maxLines: 2 };
// Quality-loop category 4 run 2: moved from top-center (where it sat directly over the Main Block's
// own entrance sign in the campus backdrop) to a small top-left plate, Pokemon-style -- the same
// corner the minimap occupies, since the two are never shown at once (the minimap hides for as long
// as the banner is sliding in/held/sliding out, src/scenes/ui.js LocationBanner/Minimap).
const HUD_BANNER = { w: 220, h: 32 };
const HUD_HINT = { w: 320, h: 36 };
const HUD_HOTBAR_SLOT = 48;
const HUD_HOTBAR_GAP = 8;
const HUD_HOTBAR_PAD = 10;
// src/scenes/ui.js's DialogBox default box and Letterbox bar height -- the single source of truth for
// both (DialogBox reads hudLayout()'s own `dialogBox` for its default, rather than a second hard-coded
// copy of these same 4 numbers) so the two can never drift apart the way they did for quality-loop
// category 4 run 1 (the hint banner drawing over the dialog box, the dialog box itself clipped by the
// bottom letterbox bar -- both were the dialog box's position/size never having been reserved anywhere
// else HUD math was computed).
const DIALOG_BOX = { x: 100, y: 382, w: 760, h: 138 };
const SCRIPT_LETTERBOX_HEIGHT = 70;

// `slotCount`: the hotbar's own slot count (GameState.inventory.slots.length in the real game).
// `dialogOpen`/`letterboxed` (quality-loop category 4 run 1): while a `say` step or an ordinary
// conversation has the dialog box on screen, the hint banner must never land on top of it (bug 1) --
// its box is computed relative to `dialogBox` instead of the hotbar whenever `dialogOpen` is true, the
// same "anchored, never overlapping" guarantee every other HUD box already has. While an in-world
// script has the letterbox bars up, `dialogBox` itself lifts clear of the bottom bar instead of
// sitting where the bar would clip it (bug 3) -- every `say` step is always preceded by its own
// `letterbox: 'in'` step (src/scripts.js), so this is the box every real in-script line actually opens
// in, not a hypothetical.
function hudLayout(width, height, slotCount = 5, { dialogOpen = false, letterboxed = false } = {}) {
  const minimap = {
    x: HUD_MARGIN,
    y: HUD_MARGIN,
    w: HUD_MINIMAP.areaW + HUD_MINIMAP.pad * 2,
    h: HUD_MINIMAP.areaH + HUD_MINIMAP.pad * 2,
  };
  // The actual map-image window inside the minimap panel -- the caption is drawn as a strip tucked
  // inside the bottom of this area (not a separate reserved row below it, the old "extra ~50px of
  // panel just for one line of text" layout this declutter pass replaces).
  const minimapArea = { x: minimap.x + HUD_MINIMAP.pad, y: minimap.y + HUD_MINIMAP.pad, w: HUD_MINIMAP.areaW, h: HUD_MINIMAP.areaH };
  const trackerX = width - HUD_MARGIN - HUD_TRACKER.w;
  const tracker = { x: trackerX, y: HUD_MARGIN, w: HUD_TRACKER.w, h: HUD_TRACKER.collapsedH };
  const trackerExpanded = { x: trackerX, y: HUD_MARGIN, w: HUD_TRACKER.w, h: HUD_TRACKER.expandedH };
  const banner = { x: HUD_MARGIN, y: HUD_MARGIN, w: HUD_BANNER.w, h: HUD_BANNER.h };

  const hotbarInnerW = slotCount * HUD_HOTBAR_SLOT + (slotCount - 1) * HUD_HOTBAR_GAP;
  const hotbarW = hotbarInnerW + HUD_HOTBAR_PAD * 2;
  const hotbarH = HUD_HOTBAR_SLOT + HUD_HOTBAR_PAD * 2;
  const hotbar = { x: Math.round((width - hotbarW) / 2), y: height - HUD_MARGIN - hotbarH, w: hotbarW, h: hotbarH };

  // Bug 3: letterboxed lifts the dialog box clear of the bottom bar (with a small margin) instead of
  // leaving it at its ordinary y, which the bar would otherwise clip through.
  const dialogBox = letterboxed
    ? { ...DIALOG_BOX, y: height - SCRIPT_LETTERBOX_HEIGHT - HUD_MARGIN / 2 - DIALOG_BOX.h }
    : { ...DIALOG_BOX };

  // Bug 1: while the dialog box is on screen (or could appear any moment -- a letterboxed script is
  // always about to run a `say` step, see the function comment above) the hint sits above *it*, never
  // the hotbar spot the dialog box itself occupies/replaces -- guaranteed clear by construction, not
  // just by the temporal gating HintBanner also does (src/scenes/ui.js), the same "by construction,
  // still tested" rule GAME_FEEL.md rule 2 already uses for every other box here.
  const reserveForDialog = dialogOpen || letterboxed;
  const hintY = reserveForDialog ? dialogBox.y - HUD_MARGIN - HUD_HINT.h : hotbar.y - HUD_MARGIN - HUD_HINT.h;
  const hint = { x: Math.round((width - HUD_HINT.w) / 2), y: hintY, w: HUD_HINT.w, h: HUD_HINT.h };

  return { minimap, minimapArea, tracker, trackerExpanded, banner, hotbar, hint, dialogBox };
}
