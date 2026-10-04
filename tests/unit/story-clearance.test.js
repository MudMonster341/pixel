// Story objects always win E: no ambient student or animal may ever stand (or walk through, or wander
// into) a spot where it could share the interact range with a story NPC or a key station, or stand
// in/next to a door, stairs or gate on the story route. Found by the first full browser run
// (2026-10-03): 38 talkable students and 8 animals arrived in one day, and pickInteractable() only
// protects a story object from a thing that is at most INTERACT_TIE_MARGIN px nearer -- so the real
// guarantee has to be geometric, and it is checked here for every map, from the real committed data.
//
// The geometry: she can interact with X while within INTERACT_RANGE of it. If a story object S and
// another thing A are at least 2 * INTERACT_RANGE apart, no spot of the map is in range of both, so A can
// never take the E press (or the prompt) away from S, whatever the tie margin (INTERACT_TIE_MARGIN). Same bound for animals,
// measured from every spot they can reach (home plus the wander radius).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData } = require('../helpers/game-data');

const {
  AMBIENT, ANIMALS, ANIMAL_RULES, ANIMAL_SPECIES, MAPS, OBJECTIVE_ROUTES,
  tiledObjects,
} = loadGameData();

const TILE = 16;
// world.js keeps INTERACT_RANGE as a local constant (Phaser-facing file, not loadable here): read the
// number from the source so this test follows it if it ever changes.
const worldSource = fs.readFileSync(path.join(ROOT, 'src', 'scenes', 'world.js'), 'utf8');
const INTERACT_RANGE = Number(/const INTERACT_RANGE = (\d+);/.exec(worldSource)?.[1]);
assert.ok(INTERACT_RANGE > 0, 'could not read INTERACT_RANGE from src/scenes/world.js');

const CLEAR_TILES = (2 * INTERACT_RANGE) / TILE;

function loadObjects(mapKey) {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${MAPS[mapKey].tiled}.json`), 'utf8'));
  return tiledObjects(json);
}

// Story objects: quest NPCs and key stations, in the same tile units as ambient/animal data.
function storyPoints(mapKey) {
  const def = MAPS[mapKey];
  return [
    ...(def.npcs || []).map((n) => ({ id: `npc ${n.id}`, x: n.x, y: n.y })),
    ...(def.keyStations || []).map((k) => ({ id: `key station ${k.id}`, x: k.x, y: k.y })),
  ];
}

// Every spot an ambient entry can occupy: idle/chat tile, or points sampled along each patrol leg.
function ambientSpots(entry) {
  if (entry.kind !== 'patrol') return [{ x: entry.x, y: entry.y }];
  const spots = [];
  for (let i = 0; i < entry.waypoints.length; i++) {
    const a = entry.waypoints[i];
    const b = entry.waypoints[(i + 1) % entry.waypoints.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2));
    for (let s = 0; s <= steps; s++) spots.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
  }
  return spots;
}

// How far from its home an animal can get: cats wander and flee, birds hop (and fly off, but a bird in
// the air is never interactable and animals only talk when tame cats).
function animalReach(animal) {
  const kind = ANIMAL_SPECIES[animal.species].kind;
  return kind === 'cat' ? Math.max(ANIMAL_RULES.cat.wanderTiles, ANIMAL_RULES.cat.fleeRunTiles) : ANIMAL_RULES.bird.hopTiles;
}

test(`story clearance: no ambient student stands or patrols within ${CLEAR_TILES} tiles of a story NPC or key station`, () => {
  for (const mapKey of Object.keys(AMBIENT)) {
    const story = storyPoints(mapKey);
    for (const entry of AMBIENT[mapKey]) {
      for (const spot of ambientSpots(entry)) {
        for (const s of story) {
          const d = Math.hypot(spot.x - s.x, spot.y - s.y);
          assert.ok(d >= CLEAR_TILES, `${mapKey}/${entry.id} at (${spot.x},${spot.y}) is ${d.toFixed(2)} tiles from ${s.id}; needs ${CLEAR_TILES}`);
        }
      }
    }
  }
});

test('story clearance: no talkable cat can get within reach of a story NPC or key station; no animal at all', () => {
  for (const mapKey of Object.keys(ANIMALS)) {
    const story = storyPoints(mapKey);
    for (const animal of ANIMALS[mapKey]) {
      const talkable = Boolean(animal.talk);
      for (const s of story) {
        const d = Math.hypot(animal.x - s.x, animal.y - s.y);
        const need = CLEAR_TILES + (talkable ? animalReach(animal) : 0);
        assert.ok(d >= need, `${mapKey}/${animal.id} is ${d.toFixed(2)} tiles from ${s.id}; needs ${need}`);
      }
    }
  }
});

// A tile is "on the route" if it is within a tile of a door, stairs or gate object, or of any object a
// story route (OBJECTIVE_ROUTES) names on that map. Ambient students and animals keep off those so
// they never stand in a doorway or on a stair landing she has to use.
function routeRects(mapKey) {
  const objects = loadObjects(mapKey);
  const named = new Set(Object.values(OBJECTIVE_ROUTES).flat().filter((stop) => stop.map === mapKey && stop.anchor).map((stop) => stop.anchor));
  return objects.filter((o) => ['door', 'stairs', 'gate', 'lift'].includes(o.type) || named.has(o.name)); // P4b: a lift's doors count like a door
}

function nearRect(rect, spot, margin) {
  const w = Math.max(rect.width, 1);
  const h = Math.max(rect.height, 1);
  return spot.x > rect.x - margin && spot.x < rect.x + w + margin - 1 + 1e-9 && spot.y > rect.y - margin && spot.y < rect.y + h + margin - 1 + 1e-9;
}

test('story clearance: ambient students never stand on or next to a door, stairs, gate or named route stop', () => {
  for (const mapKey of Object.keys(AMBIENT)) {
    const rects = routeRects(mapKey);
    for (const entry of AMBIENT[mapKey]) {
      // standing points (idle/chat, a patrol's endpoints where it lingers); a patrol may pass through
      const standing = entry.kind === 'patrol' ? [entry.waypoints[0], entry.waypoints[entry.waypoints.length - 1]] : [{ x: entry.x, y: entry.y }];
      for (const spot of standing) {
        for (const r of rects) {
          assert.ok(!nearRect(r, spot, 1), `${mapKey}/${entry.id} stands at (${spot.x},${spot.y}), next to ${r.type} "${r.name}" (${r.x},${r.y})`);
        }
      }
    }
  }
});

test('story clearance: animal homes keep a tile off every door, stairs, gate and named route stop', () => {
  for (const mapKey of Object.keys(ANIMALS)) {
    const rects = routeRects(mapKey);
    for (const animal of ANIMALS[mapKey]) {
      for (const r of rects) {
        assert.ok(!nearRect(r, { x: animal.x, y: animal.y }, 1), `${mapKey}/${animal.id} home (${animal.x},${animal.y}) is next to ${r.type} "${r.name}"`);
      }
    }
  }
});

// ---------- ambient students must never wall off the story ----------
// Idle and chatting students stand still and are immovable colliders (src/scenes/world.js
// buildAmbientNpc()), so one parked in a one-tile corridor or a room's only doorway seals it off. With
// every idle/chat tile blocked, each key station and story NPC must still be reachable from the spawn
// (4-neighbour steps, so a student in a 1-wide corridor counts as a wall, never "squeezed past"), and so
// must every door, stairs and gate. (Patrolling students stop and yield when she walks up, so they don't count.)
const { gridFromTiled, isWalkableTile, tileInfo } = loadGameData();

function reachableWith(mapKey, blocked) {
  const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'maps', `${MAPS[mapKey].tiled}.json`), 'utf8'));
  const grid = gridFromTiled(json);
  const objects = tiledObjects(json);
  const spawn = objects.find((o) => o.type === 'spawn');
  const seen = new Uint8Array(json.width * json.height);
  const isBlocked = (x, y) => blocked.some((b) => b.x === x && b.y === y);
  const stack = [[Math.floor(spawn.x), Math.floor(spawn.y)]];
  seen[stack[0][1] * json.width + stack[0][0]] = 1;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= json.width || ny >= json.height || seen[ny * json.width + nx]) continue;
      if (!isWalkableTile(grid, tileInfo, nx, ny) || isBlocked(nx, ny)) continue;
      seen[ny * json.width + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  const at = (x, y) => x >= 0 && y >= 0 && x < json.width && y < json.height && Boolean(seen[y * json.width + x]);
  // Can she stand somewhere reachable that is within interact range of (px, py), tile units?
  const canInteractWith = (px, py) => {
    const r = INTERACT_RANGE / TILE;
    for (let y = Math.floor(py - r) - 1; y <= Math.ceil(py + r); y++) {
      for (let x = Math.floor(px - r) - 1; x <= Math.ceil(px + r); x++) {
        if (at(x, y) && Math.hypot(x + 0.5 - (px + 0.5), y + 0.5 - (py + 0.5)) < r) return true;
      }
    }
    return false;
  };
  return { at, objects, canInteractWith };
}

test('story clearance: with every idle/chat student in place, each key station, story NPC, door, stairs and gate is still reachable', () => {
  for (const mapKey of Object.keys(AMBIENT)) {
    const standing = AMBIENT[mapKey].filter((e) => e.kind !== 'patrol').map((e) => ({ x: e.x, y: e.y }));
    const { at, objects, canInteractWith } = reachableWith(mapKey, standing);
    for (const s of storyPoints(mapKey)) {
      assert.ok(canInteractWith(s.x, s.y), `${mapKey}: ${s.id} cannot be reached once the idle/chat students stand where they are`);
    }
    for (const o of objects.filter((obj) => ['door', 'stairs', 'gate', 'lift'].includes(obj.type))) {
      let ok = false;
      for (let y = Math.floor(o.y); y < Math.floor(o.y) + Math.max(1, Math.ceil(o.height)); y++) {
        for (let x = Math.floor(o.x); x < Math.floor(o.x) + Math.max(1, Math.ceil(o.width)); x++) if (at(x, y)) ok = true;
      }
      // Doors/stairs are warps: the tile in front of them also counts.
      // P4b: a lift's doors are solid wall tiles you press E in front of, so its front tile (one row down, both cells of the doorway) counts.
      const frontRows = o.type === 'lift' ? 1 : 0;
      for (let dy = -1; dy <= Math.ceil(o.height) + frontRows; dy++) for (let dx = -1; dx <= Math.ceil(o.width) + frontRows; dx++) if (at(Math.floor(o.x) + dx, Math.floor(o.y) + dy)) ok = true;
      assert.ok(ok, `${mapKey}: ${o.type} "${o.name}" at (${o.x},${o.y}) is sealed off by a standing student`);
    }
  }
});
