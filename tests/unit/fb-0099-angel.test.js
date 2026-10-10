// FB-0099 (the owner): "after the ICL ... Angel ma'am comes in, who is the professor ... are you training models, good good, but remember that these
// models will not stop you from being a cool person, then she's like I'm getting a call and grows wings and flies away. Professor name is Angel."
// M5, Prof. Angel (src/moments.js, src/scripts.js SCRIPTS.momentAngel): a moment in the ICL lab, once she holds the ICL key and is on her way out.
// Without a browser this covers: the table entry (map, anchor, key, default pacing), the script as data (the owner's lines, who says what, 8-20 s from
// every tile of the trigger, never waits for a key, everyone despawned again), the trigger as a full cut between the core console and the hatch on the
// real map (like M3 and M4), the places Angel stands (open floor, never the console, Alice's pad, the key tile or the hatch), the sheets (a plain one
// she walks in with and the winged one she flies off in, both made by the generator and preloaded) and the docs. The look of it (the camera glide,
// the pop, the rise and fade) is browser-only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const game = loadGameData();
const {
  MOMENTS, SCRIPTS, MAPS, AMBIENT, MOMENT_GAP_S, MOMENT_MIN_MS, MOMENT_MAX_MS, SOUNDS,
  momentDue, momentGapS, momentFitsVisit, momentTriggerRect, momentTimeline, markMomentStarted, markMomentEnded,
  gridFromTiled, tiledObjects, resolveAnchor, isWalkableTile, tileInfo, characterSheets,
} = game;
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const png = (rel) => decodePNG(fs.readFileSync(path.join(ROOT, rel)));

const json = JSON.parse(read('assets', 'maps', 'main-block-1.json'));
const grid = gridFromTiled(json);
const objects = tiledObjects(json);
const anchor = (name) => { const p = resolveAnchor(objects, name); return p ? { x: p.x, y: p.y } : null; };
const walkable = (x, y) => isWalkableTile(grid, tileInfo, x, y);
const m5 = MOMENTS.find((m) => m.id === 'm5');
const rect = momentTriggerRect(m5, anchor);
const keysOf = (physicsLab, icl, room195) => ({ quest: { keys: { physicsLab, icl, room195 } } });
const fresh = (over = {}) => ({ seenMoments: new Set(), lastMomentAt: null, seenCutscenes: new Set(['gate2']), ...keysOf(false, true, false), ...over });
const ctx = (over = {}) => ({ map: 'main-block-1', tileX: rect.x0 + 3, tileY: rect.y0, enabled: true, blocked: false, visitCount: 0, freeSeconds: 5, anchor, ...over });
const stepsOf = (script) => plain(SCRIPTS[script]);
function walk(steps, visit) {
  for (const step of steps) {
    const type = Object.keys(step)[0];
    visit(type, step[type]);
    if (type === 'parallel' || type === 'sequence') walk(step[type], visit);
  }
}
const says = () => { const out = []; walk(stepsOf('momentAngel'), (type, body) => { if (type === 'say') out.push(body); }); return out; };

// ---------- the table ----------

test('FB-0099: M5 is in the table: the ICL lab on main-block-1, anchored on the sealed hatch, after the ICL key, default pacing (no gap, no visit cap), last in the order', () => {
  assert.equal(MOMENTS.at(-1).id, 'm5');
  assert.equal(m5.map, 'main-block-1');
  assert.equal(m5.script, 'momentAngel');
  assert.deepEqual(plain(m5.after), { keyIds: ['icl'] }, 'her ICL key, not just any key');
  assert.equal(m5.minGapS, undefined);
  assert.equal(m5.sameVisitOk, undefined);
  assert.equal(MOMENT_GAP_S, 0);
  assert.equal(momentGapS(m5), 0, 'no gap: an earlier moment (M4) never holds her back');
  assert.equal(momentFitsVisit(m5, 1), true, 'nor one that already played on this map visit');
  assert.equal(m5.afterFreeS, 0.6);
  assert.ok(Array.isArray(SCRIPTS.momentAngel) && SCRIPTS.momentAngel.length > 5);
  assert.ok(MAPS['main-block-1'], 'a real map');
  const hatch = anchor('ICL door');
  assert.ok(hatch, 'the anchor is a real object of the generated map');
  assert.equal(m5.trigger.anchor, 'ICL door');
  // inside the lab (room x 4..15, y 4..13), in the two rows in front of the hatch
  assert.deepEqual(plain(rect), { x0: 4, y0: 11, x1: 15, y1: 12 });
  const room = game.STORY.iclGate.room;
  assert.ok(rect.x0 >= room.x0 && rect.x1 <= room.x1 && rect.y0 >= room.y0 && rect.y1 <= room.y1, 'the whole trigger is inside the ICL lab');
  let open = 0;
  for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) if (walkable(x, y)) open++;
  assert.ok(open >= 20, `she can stand on ${open} tiles of it`);
  // the tile where she takes the key (below the core console) is inside it: the moment starts on the first free frame after the key dialog
  const station = MAPS['main-block-1'].keyStations.find((k) => k.id === 'icl');
  assert.deepEqual([station.x, station.y + 1], [6, 11]);
  assert.ok(walkable(6, 11) && 6 >= rect.x0 && 6 <= rect.x1 && 11 >= rect.y0 && 11 <= rect.y1, 'the pickup tile (6,11) is in the rectangle');
});

test('FB-0099: M5 needs the ICL key (exactly that one), plays once, only inside its rectangle on main-block-1, never while anything is up, and is never held back by a gap or a per-visit cap', () => {
  const due = (quest, over = {}, state = fresh(quest)) => momentDue(state, 1000, ctx(over));
  assert.equal(due(keysOf(false, false, false)), null, 'no key');
  assert.equal(due(keysOf(true, false, true)), null, 'two other keys');
  assert.equal(due(keysOf(false, true, false))?.id, 'm5', 'the ICL key');
  assert.equal(due(keysOf(true, true, true))?.id, 'm5');
  assert.equal(due(keysOf(false, true, false), {}, fresh({ seenMoments: new Set(['m5']) })), null, 'once only');
  assert.equal(due(keysOf(false, true, false), { keys: 3, tileX: 8, tileY: 9 }), null, 'outside the rectangle (row 9, the lab above the console)');
  for (const [tileX, tileY] of [[rect.x0 - 1, rect.y0], [rect.x1 + 1, rect.y0], [8, rect.y0 - 1], [9, rect.y1 + 1], [9, 15]]) {
    assert.equal(due(keysOf(false, true, false), { tileX, tileY }), null, `outside the trigger at ${tileX},${tileY} (row 13 and the corridor do not start it)`);
  }
  assert.equal(due(keysOf(false, true, false), { tileX: rect.x0, tileY: rect.y0 })?.id, 'm5', 'a corner of the rectangle');
  assert.equal(due(keysOf(false, true, false), { tileX: rect.x1, tileY: rect.y1 })?.id, 'm5', 'the opposite corner');
  for (const map of ['campus', 'main-block-g', 'main-block-2', 'main-block-3']) assert.equal(due(keysOf(false, true, false), { map }), null, `never on ${map}`);
  assert.equal(due(keysOf(false, true, false), { blocked: true }), null, 'a dialog, mini-game or overlay is up');
  assert.equal(due(keysOf(false, true, false), { enabled: false }), null, '?moments=0');
  assert.equal(game.momentsEnabled('?moments=0', { momentsDisabled: false }), false, 'the existing switch');
  assert.equal(due(keysOf(false, true, false), { freeSeconds: 0.2 }), null, 'not the frame the key dialog closes');
  // spacing: none. Due the second the last moment ended, and a moment already played on this visit does not matter
  const after = (now, over) => momentDue(fresh({ seenMoments: new Set(['m1', 'm2', 'm3', 'm4']), lastMomentAt: 300 }), now, ctx(over));
  assert.equal(after(300, {})?.id, 'm5', 'right after M4 ended (the same play-clock second)');
  assert.equal(after(316, {})?.id, 'm5', 'and 16 s after the previous moment');
  assert.equal(after(316, { visitCount: 1 })?.id, 'm5', 'even though another moment already played on this visit');
  assert.equal(after(5000, { blocked: true }), null, 'but never while a script, a dialog (Alice) or a mini-game is up');
  assert.equal(after(5000, { blocked: false })?.id, 'm5', 'and on the very next free frame it starts, even if she is standing still in the rectangle');
  // right after taking the key at the console tile (6,11): not before the key, due once she holds it and 0.6 s of free control are over
  const atConsole = (state, free) => momentDue(state, 1000, ctx({ tileX: 6, tileY: 11, freeSeconds: free }));
  assert.equal(atConsole(fresh(keysOf(false, false, false)), 5), null, 'not before the key');
  assert.equal(atConsole(fresh(keysOf(false, true, false)), 0.3), null, 'the key dialog and its toast have only just ended');
  assert.equal(atConsole(fresh(keysOf(false, true, false)), 0.6)?.id, 'm5', 'after the key, at the pickup tile');
  // it does not need the earlier ones (an old save, or she took another order)
  assert.equal(due(keysOf(false, true, false), {}, fresh({ seenMoments: new Set() }))?.id, 'm5');
  // M4 (Physics Lab key) is untouched by the ICL key and the other way round
  assert.equal(momentDue(fresh(), 1000, ctx({ map: 'main-block-3', tileX: 12, tileY: 19 })), null);
  // bookkeeping: it counts as played when it starts, and the clock is stamped again at its end
  const state = fresh();
  markMomentStarted(state, 'm5', 700);
  markMomentEnded(state, 716);
  assert.ok(state.seenMoments.has('m5') && state.lastMomentAt === 716);
  assert.equal(momentDue(state, 5000, ctx()), null);
});

test('FB-0099: the moment id m5 is saved like the others (seenMoments round-trips through a save and a brand-new game clears it)', () => {
  const { GameState, snapshotState, saveGame, loadGame, resetGameState } = game;
  GameState.seenMoments = new Set(['m1', 'm5']);
  assert.deepEqual(plain(snapshotState(GameState)).seenMoments, ['m1', 'm5']);
  assert.ok(saveGame('fb-0099-test'));
  resetGameState();
  assert.equal(GameState.seenMoments.has('m5'), false);
  assert.ok(loadGame('fb-0099-test'));
  assert.equal(GameState.seenMoments.has('m5'), true, 'a Continue never replays Prof. Angel');
  resetGameState();
  assert.equal(GameState.seenMoments.size, 0);
});

// ---------- the script ----------

test('FB-0099: Prof. Angel says the owner\'s lines (tidied) in order: training models, a cool person, the call; the name tag is "Prof. Angel"; every line advances by itself', () => {
  const list = says();
  assert.equal(list.length, 3);
  assert.deepEqual(list.map((s) => s.speaker), ['Prof. Angel', 'Prof. Angel', 'Prof. Angel']);
  assert.deepEqual(list.map((s) => s.lines), [
    ['Oh, hi {name}! Are you training models? Good, good.'],
    ['But remember: these models will never stop you from being a cool person.'],
    ['Oh, I am getting a call...'],
  ]);
  assert.match(list[0].lines[0], /training models/);
  assert.match(list[1].lines[0], /cool person/);
  for (const s of list) {
    assert.equal(typeof s.autoMs, 'number', 'the moment ends without a key press');
    assert.ok(s.autoMs >= 1000 && s.autoMs <= 3000);
    assert.doesNotMatch(s.lines.join(' ').toLowerCase(), /birthday|bday|b-day/);
  }
  // the lines are in the review doc for the owner to edit
  const doc = read('docs', 'research', 'campus-lines-review.md');
  for (const s of list) assert.ok(doc.includes(s.lines[0]), `campus-lines-review.md lacks "${s.lines[0]}"`);
  assert.match(doc, /M5 Prof\. Angel/);
  assert.match(doc, /FB-0099/);
  const plan = read('docs', 'plans', '2026-10-04-moments-and-small-touches.md');
  assert.match(plan, /Prof\. Angel \(BUILT 2026-10-10, owner FB-0099[^\n]*`m5`/);
});

test('FB-0099: the script is framed like every moment, uses only steps and sounds that exist, and the phone rings (an "!" and two dings) before her third line', () => {
  const steps = stepsOf('momentAngel');
  assert.deepEqual(steps[0], { lockInput: true });
  assert.deepEqual(steps[1], { letterbox: 'in' });
  assert.deepEqual(steps.at(-2), { letterbox: 'out' });
  assert.deepEqual(steps.at(-1), { unlockInput: true });
  assert.ok(steps.some((s) => s.cameraFollow === 'player'), 'the camera follows her again');
  const runner = read('src', 'scripts-runtime.js');
  const implemented = new Set([...runner.matchAll(/^\s+(?:async )?step_(\w+)\(/gm)].map((m) => m[1]));
  const order = [];
  walk(steps, (type, body) => {
    assert.ok(implemented.has(type), `no step_${type} in the runner`);
    if (type === 'sound') assert.ok(SOUNDS[body], `unknown sound ${body}`);
    order.push(type === 'sound' ? `sound:${body}` : type === 'emote' ? `emote:${body.kind}` : type);
  });
  const ring = order.indexOf('emote:!');
  assert.ok(ring > 0, 'a "!" over her head');
  assert.equal(order.filter((t) => t === 'sound:liftDing').length, 2, 'two dings');
  assert.ok(order.indexOf('sound:liftDing') < ring + 2 && ring < order.lastIndexOf('say'), 'the phone rings before the third line');
  assert.ok(order.indexOf('sound:minigameLineClear') > order.lastIndexOf('say'), 'the wings pop after the call line');
  // the order of the whole scene
  const idx = (what) => order.indexOf(what);
  assert.ok(idx('spawnActor') < idx('move') && idx('move') < idx('say'), 'she walks in, then speaks');
  assert.ok(idx('lift') > order.lastIndexOf('say'), 'she rises after the last line');
  assert.ok(order.indexOf('despawnActor') < order.lastIndexOf('despawnActor'), 'the plain sheet is replaced, the winged one is removed at the end');
});

test('FB-0099: she walks in plain, the wings come with a pop (the winged sheet takes her tile), and she flies away (a lift that fades her out, with stars), then is removed', () => {
  const spawns = [];
  walk(stepsOf('momentAngel'), (type, body) => { if (type === 'spawnActor') spawns.push([body.id, body.sprite]); });
  assert.deepEqual(spawns, [['angel', 'npc-prof-angel-plain'], ['angelw', 'npc-prof-angel']]);
  const lifts = [];
  walk(stepsOf('momentAngel'), (type, body) => { if (type === 'lift') lifts.push(body); });
  assert.ok(lifts.length >= 2 && lifts.every((l) => l.actor === 'angelw'), 'only the winged Angel leaves the ground');
  assert.ok(lifts.some((l) => l.fadeOut === true && l.to >= 120), 'she rises high and fades out');
  const sparks = [];
  walk(stepsOf('momentAngel'), (type, body) => { if (type === 'sparkles') sparks.push(body.actor); });
  assert.ok(sparks.includes('angel') && sparks.includes('angelw'), 'a pop of stars at the swap and a trail as she rises');
  const spawnStep = JSON.stringify(stepsOf('momentAngel'));
  // the winged Angel appears on the very tile the plain one stood on (she stops at iclTile(1,-1); both name it)
  assert.equal((spawnStep.match(/"offset":\[0\.5,-1\.5\]/g) || []).length >= 2, true);
  const tl = momentTimeline(SCRIPTS.momentAngel, { anchor, player: { x: 9 * 16 + 8, y: 11 * 16 + 8 } });
  assert.equal(tl.actors.angel.despawned, true);
  assert.equal(tl.actors.angelw.despawned, true);
  assert.equal(tl.actors.angel.x, tl.actors.angelw.x);
  assert.equal(tl.actors.angel.y, tl.actors.angelw.y);
  assert.equal(tl.actors.angelw.alt, 170, 'it ends high in the air before it is removed');
});

test('FB-0099: measured at the runtime\'s own speeds, M5 lasts 8-20 s from every tile of its trigger, never waits for a key, and leaves nobody behind', () => {
  let tiles = 0;
  let min = Infinity;
  let max = 0;
  for (let ty = rect.y0; ty <= rect.y1; ty++) {
    for (let tx = rect.x0; tx <= rect.x1; tx++) {
      if (!walkable(tx, ty)) continue;
      const tl = momentTimeline(SCRIPTS.momentAngel, { anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
      assert.deepEqual(plain(tl.unknownSteps), [], `at ${tx},${ty}: a step the measurer does not know, or a point that does not resolve`);
      assert.equal(tl.needsInput, false);
      assert.equal(tl.player.waypoints.length, 1, 'a moment never walks or places her');
      for (const [id, a] of Object.entries(tl.actors)) assert.equal(a.despawned, true, `${id} is still standing there when the scene ends`);
      min = Math.min(min, tl.durationMs);
      max = Math.max(max, tl.durationMs);
      tiles++;
    }
  }
  assert.ok(tiles >= 20);
  assert.ok(min >= MOMENT_MIN_MS, `${Math.round(min)} ms is under ${MOMENT_MIN_MS}`);
  assert.ok(max <= MOMENT_MAX_MS, `${Math.round(max)} ms is over ${MOMENT_MAX_MS}`);
  assert.ok(max >= 12000 && max <= 19000, `about 16 s (${Math.round(max)} ms)`);
});

// ---------- the real lab: where she stands, where Angel stands ----------

test('FB-0099: the trigger is a full cut between the core console and the hatch: every walk from the console (or Alice) to the door crosses it, and it never contains the console, the key tile or Alice\'s pad', () => {
  const inRect = (x, y) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
  const flood = (start) => {
    assert.ok(walkable(...start), `start ${start} is open`);
    const seen = new Set([start.join(',')]);
    const stack = [start];
    while (stack.length) {
      const [x, y] = stack.pop();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { // diagonals too: the most generous walk
        const nx = x + dx;
        const ny = y + dy;
        if (seen.has(`${nx},${ny}`) || !walkable(nx, ny) || inRect(nx, ny)) continue;
        seen.add(`${nx},${ny}`);
        stack.push([nx, ny]);
      }
    }
    return seen;
  };
  const station = MAPS['main-block-1'].keyStations.find((k) => k.id === 'icl');
  const alice = MAPS['main-block-1'].npcs.find((n) => n.id === 'alice');
  assert.deepEqual([station.x, station.y, alice.x, alice.y], [6, 10, 7, 10]);
  assert.ok(!inRect(station.x, station.y) && !inRect(alice.x, alice.y), 'the console and Alice\'s pad are not in the rectangle');
  // where she can stand to use the console: the open tiles around it that are not in the rectangle (the lab above it) can never reach the hatch lane
  const doorLane = [[8, 13], [9, 13], [10, 13], [11, 13]];
  for (const tile of doorLane) assert.ok(walkable(...tile) && !inRect(...tile), `the lane tile ${tile} is open and outside the rectangle`);
  assert.ok(walkable(10, 15) && walkable(10, 16) && walkable(10, 17), 'the corridor in front of the hatch is open');
  const fromConsole = flood([6, 9]); // (6,9): the lab above the console, the way the key hand-over faces it
  assert.ok(fromConsole.size > 20, `sanity: the north half of the lab (${fromConsole.size} tiles)`);
  for (const [x, y] of doorLane) assert.ok(!fromConsole.has(`${x},${y}`), `${x},${y} (in front of the hatch) is reachable from the console area without crossing the trigger`);
  // and from the lane the way back up into the lab is only through it
  const fromDoor = flood([10, 13]);
  assert.ok(fromDoor.size >= 4 && fromDoor.size <= 8, `the lane in front of the hatch is a small pocket (${fromDoor.size} tiles)`);
  for (let y = 4; y <= 10; y++) for (let x = 4; x <= 15; x++) assert.ok(!fromDoor.has(`${x},${y}`), `${x},${y} is reachable from the hatch without crossing the trigger`);
  // row 12 is the only way down: every open tile of row 13 touches only row 12 (inside the rectangle) above it
  for (let x = 4; x <= 15; x++) if (walkable(x, 13)) for (const dx of [-1, 0, 1]) if (walkable(x + dx, 12)) assert.ok(inRect(x + dx, 12));
});

test('FB-0099: every place Angel stands or walks is open floor (corridor, the hatch lane), never the console, Alice, the key tile or the hatch itself; the hatch leaves are the only blocked tiles on her way in', () => {
  const door = anchor('ICL door');
  const hatchTiles = [[Math.floor(door.x), Math.floor(door.y)], [Math.floor(door.x) + 1, Math.floor(door.y)]];
  assert.deepEqual(hatchTiles, [[9, 14], [10, 14]]);
  const station = MAPS['main-block-1'].keyStations.find((k) => k.id === 'icl');
  const alice = MAPS['main-block-1'].npcs.find((n) => n.id === 'alice');
  const taken = new Set([`${station.x},${station.y}`, `${alice.x},${alice.y}`, '9,14', '10,14']);
  for (let ty = rect.y0; ty <= rect.y1; ty++) {
    for (let tx = rect.x0; tx <= rect.x1; tx++) {
      if (!walkable(tx, ty)) continue;
      const tl = momentTimeline(SCRIPTS.momentAngel, { anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
      for (const [id, a] of Object.entries(tl.actors)) {
        for (const w of a.waypoints) {
          if (w.alt > 0) continue; // in the air
          const x = Math.floor(w.x / 16);
          const y = Math.floor((w.y + 7) / 16);
          assert.ok(walkable(x, y), `${id} stands on tile ${x},${y} (blocked), with her at ${tx},${ty}`);
          assert.ok(!taken.has(`${x},${y}`), `${id} stands on ${x},${y}: the console, Alice or the hatch`);
          assert.ok(x === 10, `${id} keeps to the hatch lane (x ${x})`);
          assert.ok(y >= 13, `${id} never walks up into the lab (row ${y})`);
        }
        // the straight walk between two spots only crosses the hatch's own two tiles (open once she holds the key) and open floor
        for (let i = 1; i < a.waypoints.length; i++) {
          const p = a.waypoints[i - 1];
          const q = a.waypoints[i];
          if (p.alt > 0 || q.alt > 0) continue;
          for (let t = 0; t <= 8; t++) {
            const x = Math.floor((p.x + (q.x - p.x) * t / 8) / 16);
            const y = Math.floor((p.y + 7 + (q.y - p.y) * t / 8) / 16);
            assert.ok(walkable(x, y) || (x === 10 && y === 14), `${id}'s walk crosses blocked tile ${x},${y}`);
          }
        }
      }
      // she stops in front of the hatch, on the lane, never on top of her
      const angel = tl.actors.angel;
      const last = angel.waypoints.at(-1);
      assert.deepEqual([Math.floor(last.x / 16), Math.floor(last.y / 16)], [10, 13]);
      assert.ok(Math.hypot(last.x - tl.player.x, last.y - tl.player.y) >= 16, `Angel's stop is on top of her at ${tx},${ty}`);
    }
  }
  // the hatch is a sealedDoor that is open by the time this can start (she holds the ICL key: src/maplogic.js isGateOpen), so the lane is passable
  const gate = game.STORY.iclGate;
  assert.equal(gate.openIfKey, 'icl');
  assert.equal(game.isGateOpen(gate, { flags: {}, quest: { stage: 'hunting', keys: { physicsLab: false, icl: true, room195: false } } }), true);
});

test('FB-0099: during every line Angel stands above the dialog box and well inside the picture (the camera is centred one row below her), whichever trigger tile she is on', () => {
  const ZOOM = 3;
  const boxTopBelowCentre = (game.hudLayout(960, 540, undefined, { letterboxed: true }).dialogBox.y - 270) / ZOOM; // 18 world px
  let checked = 0;
  for (let ty = rect.y0; ty <= rect.y1; ty++) {
    for (let tx = rect.x0; tx <= rect.x1; tx++) {
      if (!walkable(tx, ty)) continue;
      const tl = momentTimeline(SCRIPTS.momentAngel, { anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
      assert.equal(tl.says.length, 3);
      for (const say of tl.says) {
        assert.deepEqual(plain(say.actors.map((a) => a.id)), ['angel'], 'only Angel is on screen during a line');
        const a = say.actors[0];
        assert.ok(a.y + 8 <= say.camY + boxTopBelowCentre - 4, `Angel's feet are behind the dialog box (${a.y + 8 - say.camY} px below the centre)`);
        assert.ok(Math.abs(a.x - say.camX) <= 160 - 16);
        assert.equal(say.camX, 10 * 16 + 8, 'the camera is panned to the hatch lane (x)');
        assert.equal(say.camY, 14 * 16 + 8, 'and centred one row below her');
        checked++;
      }
    }
  }
  assert.ok(checked >= 60);
});

// ---------- the art ----------

test('FB-0099: Angel has two generated 16x24 sheets, npc-prof-angel-plain (no wings) and npc-prof-angel (wings), same colours otherwise; both are preloaded and in the offline bundle; the generator makes them', () => {
  const plainKey = 'npc-prof-angel-plain';
  const wingedKey = 'npc-prof-angel';
  const preload = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  const have = new Set(require('../../tools/pack-offline').collectRuntimeAssets().assets.map((a) => a.path));
  for (const key of [plainKey, wingedKey]) {
    assert.ok(preload.has(key), `${key} is not in the preload list`);
    assert.ok(have.has(`assets/${key}.png`), `${key} is not in the offline manifest`);
    const img = png(`assets/${key}.png`);
    assert.equal(img.width, 8 * 16);
    assert.equal(img.height, 4 * 24);
  }
  const opaque = (img) => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };
  const a = png(`assets/${plainKey}.png`);
  const b = png(`assets/${wingedKey}.png`);
  assert.ok(opaque(b) > opaque(a) + 100, `the winged sheet has more pixels (${opaque(b)} vs ${opaque(a)}): the wings`);
  // front view, frame 0 (down): the wings poke out above the ears at row 0 in the winged sheet, nothing there in the plain one
  const px = (img, x, y) => { const i = (y * img.width + x) * 4; return img.data[i + 3] ? 1 : 0; };
  const wingRow = (img) => { let n = 0; for (let x = 0; x < 16; x++) n += px(img, x, 0); return n; };
  assert.equal(wingRow(a), 0, 'no wings on the plain sheet');
  assert.ok(wingRow(b) > 0, 'wing tips on the winged sheet');
  // everything the plain sheet draws, the winged one draws too (the wings go BEHIND the body): the same top colour
  const colours = (img) => { const set = new Set(); for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) set.add(`#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join('')}`); return set; };
  assert.ok(colours(a).has('#8fb0dc') && colours(b).has('#8fb0dc'), 'the soft blue top on both');
  // not the same look as anyone else's sheet
  const sig = (img) => Buffer.from(img.data).toString('base64');
  const everyoneElse = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^npc-.*\.png$/.test(f) && f !== `${plainKey}.png`);
  for (const f of everyoneElse) assert.notEqual(sig(a), sig(png(`assets/${f}`)), `the plain Angel looks exactly like ${f}`);
  const tool = read('tools', 'make-assets.js');
  assert.match(tool, /'prof-angel-plain': \{ hair: 'black', skin: 'fair', top: '#8fb0dc', topHi: '#d6e4f7', skirt: '#5a6a8a' \}/);
  assert.match(tool, /for \(const \[id, look\] of Object\.entries\(PROF_WOMEN\)\) write\(`npc-\$\{id\}\.png`, buildProfWoman\(look\)\)/);
  // the ambient Prof. Angel on the 2nd floor is untouched (still the winged sheet, her own lines)
  const ambient = AMBIENT['main-block-2'].find((e) => e.name === 'Prof. Angel');
  assert.equal(ambient.sheet, 'npc-prof-angel');
});

test('FB-0099: the other moments and the ICL door guard are untouched (M1-M4 keep their maps and triggers; the hatch still opens on the flag or the key)', () => {
  assert.deepEqual(plain(MOMENTS.slice(0, 4).map((m) => [m.id, m.map])), [['m1', 'campus'], ['m2', 'campus'], ['m3', 'main-block-g'], ['m4', 'main-block-3']]);
  assert.deepEqual(plain(MOMENTS[3].after), { keyIds: ['physicsLab'] });
  const gate = game.STORY.iclGate;
  assert.equal(gate.door, 'ICL door');
  assert.deepEqual(plain(gate.room), { x0: 4, y0: 4, x1: 15, y1: 13 });
  assert.equal(game.isGateOpen(gate, { flags: { [gate.flag]: true }, quest: { stage: 'hunting', keys: {} } }), true);
});
