// Checks the generated campus map (tools/campus/build-campus.js, ADR 0007) is up to date and playable.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, loadGameData } = require('../helpers/game-data');

const { tileInfo, gridFromTiled, tiledObjects, isWalkableTile } = loadGameData();
const MAP_FILE = path.join(ROOT, 'assets', 'maps', 'campus.json');
const json = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));
const grid = gridFromTiled(json);
const objects = tiledObjects(json);
const walkable = (x, y) => isWalkableTile(grid, tileInfo, x, y);

function reachableFrom(start) {
  const seen = new Uint8Array(json.width * json.height);
  const queue = [start];
  seen[start.y * json.width + start.x] = 1;
  for (let i = 0; i < queue.length; i++) {
    const { x, y } = queue[i];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= json.width || ny >= json.height) continue;
      if (seen[ny * json.width + nx] || !walkable(nx, ny)) continue;
      seen[ny * json.width + nx] = 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return (x, y) => seen[y * json.width + x] === 1;
}

test('assets/maps/campus.json is up to date (run `npm run campus` if this fails)', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-campus-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'campus', 'build-campus.js'), '--out', out], { stdio: 'pipe' });
    assert.ok(fs.readFileSync(path.join(out, 'campus.json')).equals(fs.readFileSync(MAP_FILE)), 'campus.json is out of date');
    assert.ok(
      fs.readFileSync(path.join(out, 'campus-greybox.png')).equals(fs.readFileSync(path.join(ROOT, 'docs', 'research', 'campus-greybox.png'))),
      'docs/research/campus-greybox.png is out of date',
    );
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('uses the shared tileset, 2 m per tile, and a sensible size', () => {
  assert.equal(json.tilewidth, 16);
  assert.equal(json.tilesets.length, 1);
  assert.equal(json.tilesets[0].tilecount, tileInfo.tiles.length);
  const props = Object.fromEntries(json.properties.map((p) => [p.name, p.value]));
  assert.equal(props.metersPerTile, 2);
  assert.match(props.attribution, /OpenStreetMap/);
  assert.ok(json.width <= 600 && json.height <= 600, `map is ${json.width}x${json.height} tiles`);
  for (const layer of json.layers.filter((l) => l.type === 'tilelayer')) {
    assert.equal(layer.data.length, json.width * json.height);
    assert.ok(layer.data.every((gid) => gid >= 0 && gid <= tileInfo.tiles.length), `${layer.name} has an unknown tile`);
  }
});

test('the spawn point is on walkable ground', () => {
  const spawn = objects.find((o) => o.type === 'spawn');
  assert.ok(spawn, 'no spawn object');
  assert.ok(walkable(Math.floor(spawn.x), Math.floor(spawn.y)), 'spawn is on a solid tile');
});

test('the Main Block entrance can be reached from the spawn', () => {
  const spawn = objects.find((o) => o.type === 'spawn');
  const reachable = reachableFrom({ x: Math.floor(spawn.x), y: Math.floor(spawn.y) });
  const doors = objects.filter((o) => o.type === 'door');
  assert.ok(doors.some((d) => d.props.building === 'Main Block'), 'no Main Block door');
  for (const door of doors) {
    assert.ok(reachable(Math.floor(door.x), Math.floor(door.y)), `${door.name} can't be reached from the spawn`);
  }
});

// P4: the Gate 2 welcome cutscene trigger sits on walkable ground, inside the fence, between the
// spawn (outside Gate 2) and the Main Block, so a player walking in from the gate steps through it.
test('the Gate 2 welcome cutscene trigger is walkable and between the spawn and the Main Block', () => {
  const trigger = objects.find((o) => o.type === 'cutscene');
  assert.ok(trigger, 'no cutscene trigger object');
  assert.equal(trigger.props.cutscene, 'gate2');
  const cx = Math.floor(trigger.x + trigger.width / 2);
  const cy = Math.floor(trigger.y + trigger.height / 2);
  assert.ok(walkable(cx, cy), 'cutscene trigger is not on walkable ground');

  const spawn = objects.find((o) => o.type === 'spawn');
  const mainBlock = objects.find((o) => o.type === 'building' && o.name === 'Main Block');
  assert.ok(cy < spawn.y, 'trigger should be north of (inside from) the spawn');
  assert.ok(cy > mainBlock.y + mainBlock.height, 'trigger should be south of the Main Block');

  const reachable = reachableFrom({ x: Math.floor(spawn.x), y: Math.floor(spawn.y) });
  assert.ok(reachable(cx, cy), "the cutscene trigger can't be reached from the spawn");
});

test('all the named BITS buildings are on the map', () => {
  const names = new Set(objects.filter((o) => o.type === 'building').map((o) => o.name));
  for (const name of ['Main Block', 'Library Block', 'Mechanical Block', 'Hostel A', 'Hostel D', 'Hostel G (Girls)', 'Hostel H (Girls)']) {
    assert.ok(names.has(name), `missing ${name}`);
  }
});
