// The owner's completeness checklist, as one GENERATED test over the real committed data (2026-10-04):
//   "nothing empty; no missing textures; every door that opens leads somewhere; every locked door says
//   something." Every assertion below is built by looping over MAPS (and the campus map) and the shared
//   registries, so a new map, door, NPC or room is covered the moment it exists -- nothing is listed by hand
//   except the two explicit ALLOWLISTs further down, and each entry there needs a one-line reason.
//
// What this file does NOT repeat: tests/unit/interiors.test.js already checks interior wall geometry,
// reachability and that a door's *target object* exists; tests/unit/foyer-tour.test.js pins the Main Block
// ground floor; tests/unit/characters.test.js pins the characterSheets() derivation; and
// tests/e2e/missing-texture.spec.js (browser, not run here) checks the live texture manager. This file adds the
// cross-cutting, every-map versions: tile/PNG completeness, door round trips including the actual landing tile,
// door-lock lines, and the "is this room empty?" / "is anyone here?" measures.
//
// Failing items are real gaps in the current content. Do not weaken a check to make it pass: fix the content, or
// (for a deliberate exception) add a reasoned entry to an ALLOWLIST.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const {
  MAPS, AMBIENT, ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS, SCRIPTS, STRUCTURES, START_MAP, tileInfo,
  characterSheets, ambientSheetKey, animalSheets, buildTileGrid, gridFromTiled, tiledObjects, isWalkableTile,
  parseOpenTiles, DIRECTION_OFFSET,
} = loadGameData();

const TILE = 16;
const TILE_NAMES = tileInfo.tiles.map((t) => t.name);
const TILE_NAME_SET = new Set(TILE_NAMES);

// ---------- load every map once ----------

const maps = {};
for (const [key, def] of Object.entries(MAPS)) {
  if (def.tiled) {
    const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${def.tiled}.json`), 'utf8'));
    maps[key] = { key, def, tiled: true, json, width: json.width, height: json.height, grid: gridFromTiled(json), objects: tiledObjects(json) };
  } else {
    // text-grid maps (the meadow/house test pair): buildTileGrid throws a clear error on an unknown tile/structure
    const grid = buildTileGrid(def, tileInfo);
    maps[key] = { key, def, tiled: false, json: null, width: grid[0].length, height: grid.length, grid, objects: [] };
  }
}
const MAP_KEYS = Object.keys(maps);
const walkable = (m, x, y) => isWalkableTile(m.grid, tileInfo, x, y);

// ======================================================================================================
// 1. No missing tile, no missing character sheet
// ======================================================================================================

// The tile PNG's cell for tile `index` is not fully transparent (an invisible tile would read as a hole).
const tilesPng = decodePNG(fs.readFileSync(path.join(ROOT, 'assets', 'tiles.png')));
function tileCellVisible(index) {
  const sx = (index % tileInfo.columns) * TILE;
  const sy = Math.floor(index / tileInfo.columns) * TILE;
  if (sy + TILE > tilesPng.height) return false;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if (tilesPng.data[((sy + y) * tilesPng.width + sx + x) * 4 + 3] > 0) return true;
  return false;
}

for (const key of MAP_KEYS) {
  const m = maps[key];
  test(`${key}: every tile/structure name its layers, structures and openTiles reference exists in assets/tiles.json, and draws something in tiles.png`, () => {
    const used = new Set();
    if (m.tiled) {
      const tilecount = m.json.tilesets[0].tilecount;
      assert.equal(tilecount, tileInfo.tiles.length, `${key}: the Tiled tileset says ${tilecount} tiles, tiles.json has ${tileInfo.tiles.length}`);
      for (const layer of m.json.layers.filter((l) => l.type === 'tilelayer')) {
        assert.equal(layer.data.length, m.width * m.height, `${key}/${layer.name}: layer data is the wrong length`);
        for (const gid of layer.data) {
          assert.ok(Number.isInteger(gid) && gid >= 0 && gid <= tileInfo.tiles.length, `${key}/${layer.name}: tile gid ${gid} is not in assets/tiles.json (${tileInfo.tiles.length} tiles)`);
          if (gid) used.add(gid - 1);
        }
      }
    } else {
      // legend values + stamped structures (buildTileGrid already threw above if any name was unknown)
      for (const name of Object.values(m.def.legend)) assert.ok(TILE_NAME_SET.has(name), `${key}: legend tile "${name}" is not in assets/tiles.json`);
      for (const { type } of m.def.structures || []) {
        assert.ok(STRUCTURES[type], `${key}: unknown structure "${type}"`);
        for (const name of STRUCTURES[type].flat()) assert.ok(TILE_NAME_SET.has(name), `${key}: structure "${type}" uses tile "${name}", which is not in assets/tiles.json`);
      }
      for (const row of m.grid) for (const index of row) used.add(index);
    }
    for (const index of used) assert.ok(tileCellVisible(index), `${key}: tile "${TILE_NAMES[index]}" (#${index}) is fully transparent in assets/tiles.png`);
    // openTiles: a door's "open" overlay names tiles; each must exist
    const warpLike = [...m.objects.map((o) => o.props.openTiles), ...(m.def.warps || []).map((w) => w.openTiles)];
    for (const value of warpLike) for (const name of parseOpenTiles(value) || []) assert.ok(TILE_NAME_SET.has(name), `${key}: openTiles names "${name}", which is not in assets/tiles.json`);
  });
}

// Independent walk of the content (not characterSheets() itself): every character a map NPC, ambient student or
// script actor names must be in the preload registry, whose file must exist and be a real PNG.
function referencedCharacterKeys() {
  const keys = new Map(); // key -> where it came from
  for (const [mapKey, def] of Object.entries(MAPS)) for (const npc of def.npcs || []) keys.set(npc.character ? `npc-${npc.character}` : 'npc', `${mapKey} npc "${npc.id}"`);
  for (const [mapKey, list] of Object.entries(AMBIENT)) for (const e of list) keys.set(ambientSheetKey(e), `${mapKey} ambient "${e.id}"`);
  const visit = (node, where) => {
    if (Array.isArray(node)) { node.forEach((n) => visit(n, where)); return; }
    if (!node || typeof node !== 'object') return;
    const spawn = node.spawnActor;
    if (spawn && spawn.sprite && (spawn.kind || 'character') === 'character') keys.set(spawn.sprite, `script "${where}" actor`);
    for (const [k, v] of Object.entries(node)) visit(v, where);
  };
  for (const [name, script] of Object.entries(SCRIPTS)) visit(script, name);
  return keys;
}

test('every NPC / ambient student / script-actor character sheet is registered for preload and its PNG exists and decodes', () => {
  const registry = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  for (const [key, where] of referencedCharacterKeys()) {
    assert.ok(registry.has(key), `${where} uses sheet "${key}", which characterSheets() does not register for preload`);
  }
  for (const [key, file] of registry) {
    const full = path.join(ROOT, file);
    assert.ok(fs.existsSync(full), `sheet "${key}": ${file} does not exist (run \`npm run assets\`)`);
    const png = decodePNG(fs.readFileSync(full));
    assert.ok(png.width >= TILE && png.height >= TILE, `sheet "${key}": ${file} is smaller than one frame`);
    assert.equal(png.width % TILE, 0, `sheet "${key}": ${file} is ${png.width}px wide, not a whole number of ${TILE}px frames`);
  }
  // and the preload really iterates the registry rather than a hand-kept list
  const main = fs.readFileSync(path.join(ROOT, 'src', 'main.js'), 'utf8');
  assert.match(main, /characterSheets\(MAPS, AMBIENT, SCRIPTS\)/, 'src/main.js preload must iterate characterSheets()');
  assert.match(main, /animalSheets\(ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS\)/, 'src/main.js preload must iterate animalSheets()');
});

test('every animal species sheet that an ANIMALS entry uses is registered for preload and its PNG exists and decodes', () => {
  const registry = new Map(animalSheets(ANIMALS, ANIMAL_SPECIES, ANIMAL_LAYOUTS).map((s) => [s.key, s]));
  for (const [mapKey, list] of Object.entries(ANIMALS)) {
    assert.ok(MAPS[mapKey], `ANIMALS has entries for unknown map "${mapKey}"`);
    for (const a of list) {
      const species = ANIMAL_SPECIES[a.species];
      assert.ok(species, `${mapKey}/${a.id}: unknown species "${a.species}"`);
      assert.ok(registry.has(species.sheet), `${mapKey}/${a.id}: species "${a.species}" sheet "${species.sheet}" is not registered by animalSheets()`);
    }
  }
  for (const s of registry.values()) {
    const full = path.join(ROOT, s.file);
    assert.ok(fs.existsSync(full), `animal sheet "${s.key}": ${s.file} does not exist`);
    const png = decodePNG(fs.readFileSync(full));
    assert.ok(png.width >= s.frameWidth && png.height >= s.frameHeight, `animal sheet "${s.key}": ${s.file} is smaller than one frame`);
  }
});

// ======================================================================================================
// 2. Every door / stairs that opens leads somewhere, and you can get back out
// ======================================================================================================

// What world.js resolveSpawnAt() does: the arrival tile is one step past the destination object, in its own `facing`.
function arrivalTile(destMap, dest) {
  const [dx, dy] = DIRECTION_OFFSET[dest.props.facing || 'down'] || [0, 0];
  return { x: Math.floor(dest.x) + dx, y: Math.floor(dest.y) + dy };
}

for (const key of MAP_KEYS) {
  const m = maps[key];
  const warps = m.objects.filter((o) => o.type === 'door' || o.type === 'stairs');
  test(`${key}: every door/stairs with a \`to\` leads to a real map + named object, lands on walkable floor, and has a way back to here; every other door is flagged closed`, () => {
    const problems = [];
    for (const o of warps) {
      if (!o.props.to) {
        // a door that opens nowhere must say so (flagged `closed`; its line is checked in the door-lock test below)
        if (o.props.closed !== true) problems.push(`${o.type} "${o.name}" has no \`to\` and is not marked closed: it would be a silent dead end`);
        continue;
      }
      const target = maps[o.props.to];
      if (!target) { problems.push(`"${o.name}" points at unknown map "${o.props.to}"`); continue; }
      if (!o.props.toId) { problems.push(`"${o.name}" -> ${o.props.to} has no toId (no named arrival object)`); continue; }
      const dest = target.objects.find((t) => t.name === o.props.toId);
      if (!dest) { problems.push(`"${o.name}" -> ${o.props.to} has no object named "${o.props.toId}"`); continue; }
      const land = arrivalTile(target, dest);
      if (!(land.x >= 0 && land.y >= 0 && land.x < target.width && land.y < target.height && walkable(target, land.x, land.y))) {
        const tileName = TILE_NAMES[target.grid[land.y]?.[land.x]] || 'off the map';
        problems.push(`"${o.name}" -> ${o.props.to} "${dest.name}" (facing ${dest.props.facing || 'down'}): you arrive at (${land.x},${land.y}), which is solid (${tileName})`);
      }
      // the way back: the arrival object is a door/stairs on that map that leads here, to a named object that exists,
      // and that object is the one we came through or standing right next to it
      if (!dest.props.to) { problems.push(`"${o.name}" -> "${dest.name}" in ${o.props.to}: you can enter but there is no way back out`); continue; }
      if (dest.props.to !== key) { problems.push(`"${o.name}" -> "${dest.name}" in ${o.props.to} leads on to "${dest.props.to}", not back here`); continue; }
      const back = m.objects.find((t) => t.name === dest.props.toId);
      if (!back) { problems.push(`${o.props.to}: "${dest.name}" returns to "${dest.props.toId}", which is not on ${key}`); continue; }
      const gap = Math.hypot(back.x - o.x, back.y - o.y);
      if (gap > 4) problems.push(`going through "${o.name}" and straight back puts you at "${back.name}", ${gap.toFixed(1)} tiles from where you left`);
    }
    assert.deepEqual(problems, [], `${key}: ${problems.length} door problem(s):\n  ${problems.join('\n  ')}`);
  });
}

test('text-grid maps: every warp points at a real map and lands on walkable floor, and that map has a warp back', () => {
  for (const m of Object.values(maps).filter((x) => !x.tiled)) {
    for (const w of m.def.warps || []) {
      const target = maps[w.to];
      assert.ok(target, `${m.key}: warp (${w.x},${w.y}) points at unknown map "${w.to}"`);
      assert.ok(walkable(target, Math.floor(w.spawn.x), Math.floor(w.spawn.y)), `${m.key}: warp (${w.x},${w.y}) lands on a solid tile in ${w.to}`);
      assert.ok((target.def.warps || []).some((b) => b.to === m.key), `${m.key} -> ${w.to}: no way back`);
    }
  }
});

// ======================================================================================================
// 3. Every locked / closed door says something
// ======================================================================================================

// A door "can be locked" when it has no `to` (a closed wall door) or a doorLocks rule names it. The line the player
// sees is the rule's `reason`; world.js falls back to a generic string when there is none ('Locked for the event' /
// 'Closed for now.'), which this test deliberately does NOT accept: each lockable door should have its own line.
const lockables = (m) => m.objects
  .filter((o) => o.type === 'door' || o.type === 'stairs')
  .map((o) => ({ o, rule: (m.def.doorLocks || []).find((r) => r.match === o.name) || null }))
  .filter(({ o, rule }) => !o.props.to || rule);

test('every door/stairs that has no `to`, or that a doorLocks rule can lock, has its own non-empty player-facing `reason` line (every map)', () => {
  const missing = [];
  for (const m of Object.values(maps)) {
    for (const { o, rule } of lockables(m)) {
      const reason = rule && typeof rule.reason === 'string' ? rule.reason.trim() : '';
      if (reason.length < 8) missing.push(`${m.key}: ${o.type} "${o.name}" (${!o.props.to ? 'closed' : 'locked by rule'}) has ${rule ? 'a doorLocks rule with no `reason`' : 'no doorLocks rule'}`);
    }
  }
  assert.deepEqual(missing, [], `${missing.length} lockable door(s) say nothing of their own:\n  ${missing.join('\n  ')}`);
});

test('every doorLocks rule names a door/stairs object that exists on its own map', () => {
  for (const m of Object.values(maps)) {
    for (const rule of m.def.doorLocks || []) {
      assert.ok(m.objects.some((o) => (o.type === 'door' || o.type === 'stairs') && o.name === rule.match), `${m.key}: doorLocks names "${rule.match}", which is not a door/stairs object on that map`);
    }
  }
});

test('no two different closed doors (no `to`) in one map share the exact same line more than twice', () => {
  for (const m of Object.values(maps)) {
    const byLine = new Map();
    for (const o of m.objects.filter((x) => (x.type === 'door' || x.type === 'stairs') && !x.props.to)) {
      const rule = (m.def.doorLocks || []).find((r) => r.match === o.name);
      const line = (rule && rule.reason) || '(no line)';
      byLine.set(line, [...(byLine.get(line) || []), o.name]);
    }
    for (const [line, doors] of byLine) assert.ok(doors.length <= 2, `${m.key}: ${doors.length} closed doors share the line "${line}": ${doors.join('; ')}`);
  }
});

// ======================================================================================================
// 4. Nothing empty: furniture in every room, and someone to meet on every walkable interior map
// ======================================================================================================

// "Interior map" = a Tiled map with `indoors: true`. "Room" = one of its named `area` objects. A "prop" is a tile on the
// structures layer that is not wall, door, stairs, column or glass (so furniture, plants, benches, counters, signs...).
// "Bare floor" = a walkable cell with no prop on it.
const NOT_A_PROP = /^(intWall|wall|edge$|intDoor|doorway|intGlassDoor|intGlassPanel|intStairs|intAtrium|intFoyerStairs|intFoyerLanding|intFoyerTread|intColumn|intTerrarium|intTotem)/;
const interiorMaps = Object.values(maps).filter((m) => m.tiled && m.def.indoors);

function propAt(m, structures, x, y) {
  const gid = structures[y * m.width + x];
  return Boolean(gid) && !NOT_A_PROP.test(TILE_NAMES[gid - 1]);
}

// Largest axis-aligned rectangle of bare floor inside [x0,x1) x [y0,y1), in tiles (classic histogram scan).
function largestBareRect(m, structures, x0, y0, x1, y1) {
  const w = x1 - x0;
  const heights = new Array(w).fill(0);
  let best = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) heights[x] = walkable(m, x0 + x, y) && !propAt(m, structures, x0 + x, y) ? heights[x] + 1 : 0;
    const stack = [];
    for (let x = 0; x <= w; x++) {
      const cur = x === w ? 0 : heights[x];
      let start = x;
      while (stack.length && stack[stack.length - 1][1] >= cur) {
        const [sx, sh] = stack.pop();
        best = Math.max(best, sh * (x - sx));
        start = sx;
      }
      stack.push([start, cur]);
    }
  }
  return best;
}

function roomStats(m) {
  const structures = m.json.layers.find((l) => l.name === 'structures').data;
  return m.objects.filter((o) => o.type === 'area').map((o) => {
    const x0 = Math.floor(o.x);
    const y0 = Math.floor(o.y);
    const x1 = Math.ceil(o.x + o.width);
    const y1 = Math.ceil(o.y + o.height);
    let floor = 0;
    let props = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { if (walkable(m, x, y)) floor++; if (propAt(m, structures, x, y)) props++; }
    return { name: o.name, kind: o.props.kind, floor, props, density: props / Math.max(1, floor + props), emptiest: largestBareRect(m, structures, x0, y0, x1, y1) };
  });
}

// The four Library Block and Mechanical Block floors cannot be entered on the story route: their campus entrances
// are locked for the whole game (MAPS.campus.doorLocks, no `stages`) and the upper floor is only reached through the
// ground floor. They stay under the texture, door and lock-reason checks above; only the density, bare-floor and life
// rules below skip them. The test right after this block FAILS if any of them ever becomes reachable, so the exemption
// cannot outlive the lock.
const UNREACHABLE_INTERIORS = {
  'library-block-g': 'the Library Block entrance is locked for the whole game (campus doorLocks, no stages)',
  'library-block-1': 'only reached through library-block-g, which is unreachable',
  'mechanical-block-g': 'the Mechanical Block entrance is locked for the whole game (campus doorLocks, no stages)',
  'mechanical-block-1': 'only reached through mechanical-block-g, which is unreachable',
};

// Maps a player can actually reach from the start map: follow every door/stairs that has a `to`, unless it is closed or
// a doorLocks rule with no `stages` shuts it for the whole game (a rule WITH `stages` opens at some point of the story).
function reachableMapKeys() {
  const seen = new Set([START_MAP]);
  const queue = [START_MAP];
  while (queue.length) {
    const m = maps[queue.shift()];
    for (const o of m.objects.filter((x) => (x.type === 'door' || x.type === 'stairs') && x.props.to)) {
      const rule = (m.def.doorLocks || []).find((r) => r.match === o.name);
      if (o.props.closed === true || (rule && !rule.stages)) continue;
      if (maps[o.props.to] && !seen.has(o.props.to)) { seen.add(o.props.to); queue.push(o.props.to); }
    }
  }
  return seen;
}

test('UNREACHABLE_INTERIORS: each exempt map is an interior map with a reason, and is still unreachable on the story route', () => {
  const reachable = reachableMapKeys();
  assert.ok(reachable.has('main-block-3'), 'sanity: the Main Block top floor must be reachable from the campus');
  for (const [key, reason] of Object.entries(UNREACHABLE_INTERIORS)) {
    assert.ok(maps[key] && maps[key].def.indoors, `UNREACHABLE_INTERIORS names "${key}", which is not an interior map`);
    assert.ok(typeof reason === 'string' && reason.length >= 10, `UNREACHABLE_INTERIORS["${key}"] needs a one-line reason`);
    assert.ok(!reachable.has(key), `${key} is reachable now (its entrance is no longer locked for good): remove it from UNREACHABLE_INTERIORS so the density, bare-floor and life rules apply to it`);
  }
  // the two lock rules the exemption rests on, stated directly
  for (const door of ['Library Block entrance', 'Mechanical Block entrance']) {
    const rule = (MAPS.campus.doorLocks || []).find((r) => r.match === door);
    assert.ok(rule && !rule.stages, `campus doorLocks for "${door}" must exist and have no \`stages\``);
  }
});

const reachableInteriorMaps = interiorMaps.filter((m) => !UNREACHABLE_INTERIORS[m.key]);

// (Rules below apply to REACHABLE interiors only; see UNREACHABLE_INTERIORS above.)
// Calibrated on the rooms the owner has accepted so far (Main Block ground floor ADR 0020, ICL, Room 195, Physics
// Lab, the Library reading rooms and canteen), then set just under the weakest of them:
//   density: weakest accepted = "Sports Complex Lobby" (4 props on 56 cells = 0.0714)  -> floor of 0.07
//   bare-floor block: weakest accepted = "Library 1st Floor" (a 3 x 29 aisle = 87 tiles) -> ceiling of 90 tiles
// 90 tiles is a little over a third of what one screen shows at the game's 3x zoom (20 x 11 tiles), the owner's
// "plain empty floor for more than about a third of the screen" rule.
const MIN_PROP_DENSITY = 0.07;
const MAX_BARE_FLOOR_TILES = 90;
// Pure through-routes are exempt from the density rule only (they need no furniture), never from the bare-floor ceiling.
const DENSITY_EXEMPT_KINDS = { stairwell: 'a stair landing is a through-route, not a room' };

test(`every named room of every interior map has enough furniture: props / (walkable + props) >= ${MIN_PROP_DENSITY} (stair landings exempt)`, () => {
  const bad = [];
  for (const m of reachableInteriorMaps) {
    for (const r of roomStats(m)) {
      if (DENSITY_EXEMPT_KINDS[r.kind]) continue;
      if (r.density < MIN_PROP_DENSITY) bad.push(`${m.key} / "${r.name}" (${r.kind}): ${r.props} props on ${r.floor} floor tiles = ${r.density.toFixed(3)}`);
    }
  }
  assert.deepEqual(bad, [], `${bad.length} room(s) are too bare:\n  ${bad.join('\n  ')}`);
});

test(`no named room of any interior map has a block of bare floor larger than ${MAX_BARE_FLOOR_TILES} tiles (about a third of one screen)`, () => {
  const bad = [];
  for (const m of reachableInteriorMaps) {
    for (const r of roomStats(m)) {
      if (r.emptiest > MAX_BARE_FLOOR_TILES) bad.push(`${m.key} / "${r.name}" (${r.kind}): the largest bare-floor block is ${r.emptiest} tiles`);
    }
  }
  assert.deepEqual(bad, [], `${bad.length} room(s) have too much empty floor:\n  ${bad.join('\n  ')}`);
});

// A map is "alive" when something on it can be talked to or used: a story NPC, a key station, an ambient student or an
// animal. Add a map here only with a one-line reason; none is needed today.
const LIFE_ALLOWLIST = {
  // 'some-map-key': 'pure stair landing, nobody would stand here',
};

function lifeOn(key) {
  const def = MAPS[key];
  return (def.npcs || []).length + (def.keyStations || []).length + (AMBIENT[key] || []).length + (ANIMALS[key] || []).length;
}

test('every walkable interior map has at least one piece of life (NPC, key station, ambient student or animal), unless allowlisted with a reason', () => {
  for (const [key, reason] of Object.entries(LIFE_ALLOWLIST)) {
    assert.ok(maps[key] && maps[key].def.indoors, `LIFE_ALLOWLIST names "${key}", which is not an interior map`);
    assert.ok(typeof reason === 'string' && reason.length >= 10, `LIFE_ALLOWLIST["${key}"] needs a one-line reason`);
  }
  const lonely = reachableInteriorMaps.filter((m) => !LIFE_ALLOWLIST[m.key] && lifeOn(m.key) === 0).map((m) => `${m.key} (${m.def.name})`);
  assert.deepEqual(lonely, [], `${lonely.length} interior map(s) have nobody and nothing to interact with:\n  ${lonely.join('\n  ')}`);
});

// FB-0057: an ambient student now draws with her role's club-outfit sheet. An earlier bug (FB-0044) drew ambient
// students as Phaser's black-and-green missing-texture box because their sheets were not preloaded; the resolved key
// of EVERY ambient student must be in the preload list and exist on disk (and so must the plain fallback world.js uses).
test('FB-0057: every ambient student\'s resolved texture is in the preload list and on disk, and so is the plain fallback', () => {
  const preload = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  for (const [mapKey, list] of Object.entries(AMBIENT)) {
    for (const e of list) {
      const key = ambientSheetKey(e);
      assert.ok(preload.has(key), `${mapKey} ambient "${e.id}" draws "${key}", which is not in the preload list`);
      assert.ok(fs.existsSync(path.join(ROOT, preload.get(key))), `${preload.get(key)} is missing on disk (run \`npm run assets\`)`);
      assert.ok(fs.existsSync(path.join(ROOT, 'assets', `npc-${e.character}.png`)), `the plain fallback for "${e.id}" is missing on disk`);
    }
  }
  // world.js asks ambientSheetKey() and falls back to the plain sheet only when a variant never loaded.
  const world = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
  assert.match(world, /let textureKey = ambientSheetKey\(def\);/);
  assert.match(world, /if \(!this\.textures\.exists\(textureKey\)\) textureKey = `npc-\$\{def\.character\}`;/);
});
