// FB-0051 follow-up (docs/plans/2026-10-04-moments-and-small-touches.md, ADR 0021): the first two "moments" -- M1 the unicorn and the prince,
// M2 Mevin the drummer -- and the small pacing system they need (src/moments.js). Without a browser this covers: the pacing rules as the
// pure functions they are (once only, 90 s of play apart, one per map visit, the order, never while anything owns the screen, off with
// `?moments=0`); the saved bookkeeping (seenMoments / playSeconds / lastMomentAt round-trip, an old save has none); the two scripts as data
// (every step type exists in the runner, the owner's exact lines, every line auto-advances, 8-20 s at the runtime's own speeds from every
// tile the trigger can fire on, every spot an actor stands on is walkable on the real campus, every actor is gone again at the end); the new
// runner steps on a fake scene; the new art and sounds (they exist, are the right size, are preloaded and in the offline manifest); and the
// e2e helpers that switch moments off. The Phaser-facing look (timing, the lift-off's depth sorting, the camera, the drum sync) is
// browser-only: see the report in docs/plans/ and tests/e2e/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { ROOT, loadGameData, plain } = require('../helpers/game-data');
const { decodePNG } = require('../../tools/lib/png-decode');

const game = loadGameData();
const {
  MOMENTS, MOMENT_SHEETS, MOMENT_GAP_S, MOMENT_PER_VISIT, MOMENT_MIN_MS, MOMENT_MAX_MS, MOMENT_TIMING, SCRIPTS, SOUNDS, MAPS, AMBIENT,
  momentsEnabled, momentDue, momentGapS, momentFitsVisit, momentTriggerRect, markMomentStarted, markMomentEnded, momentTimeline,
  gridFromTiled, tiledObjects, resolveAnchor, isWalkableTile, tileInfo, characterSheets,
} = game;
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

// ---------- the real campus ----------
const campusJson = JSON.parse(read('assets', 'maps', 'campus.json'));
const campusGrid = gridFromTiled(campusJson);
const campusObjects = tiledObjects(campusJson);
const anchor = (name) => { const p = resolveAnchor(campusObjects, name); return p ? { x: p.x, y: p.y } : null; };
const walkable = (x, y) => isWalkableTile(campusGrid, tileInfo, x, y);
// Any map a moment can be on (M1 and M2 are on the campus, M3 in the Main Block foyer): its anchors and its walkable tiles.
const mapCache = new Map();
function mapOf(key) {
  if (!mapCache.has(key)) {
    const json = JSON.parse(read('assets', 'maps', `${key}.json`));
    const grid = gridFromTiled(json);
    const objects = tiledObjects(json);
    mapCache.set(key, {
      key, json, grid, objects,
      anchor: (name) => { const p = resolveAnchor(objects, name); return p ? { x: p.x, y: p.y } : null; },
      walkable: (x, y) => isWalkableTile(grid, tileInfo, x, y),
    });
  }
  return mapCache.get(key);
}
const momentOf = (id) => MOMENTS.find((m) => m.id === id);
const rectOf = (id) => momentTriggerRect(momentOf(id), mapOf(momentOf(id).map).anchor);

// A GameState-shaped object for the pure rules (no keys held: `quest` has the real shape, { keys: { physicsLab, icl, room195 } }).
const fresh = (over = {}) => ({ seenMoments: new Set(), lastMomentAt: null, seenCutscenes: new Set(['gate2']), quest: { keys: { physicsLab: false, icl: false, room195: false } }, ...over });
const inside = (id) => { const r = rectOf(id); return { tileX: r.x0 + 1, tileY: r.y0 + 1 }; };
const ctxFor = (id, over = {}) => ({ map: momentOf(id).map, ...inside(id), enabled: true, blocked: false, visitCount: 0, anchor: mapOf(momentOf(id).map).anchor, ...over });

// ---------- the table ----------

test('FB-0051: MOMENTS lists M1, M2, M3 then M4, each with a real script, a trigger rectangle that exists on its own map, and the right order', () => {
  assert.deepEqual(plain(MOMENTS.map((m) => m.id)), ['m1', 'm2', 'm3', 'm4']);
  for (const m of MOMENTS) {
    assert.ok(MAPS[m.map], `${m.id}: a real map`);
    assert.ok(Array.isArray(SCRIPTS[m.script]) && SCRIPTS[m.script].length > 0, `${m.id}: script "${m.script}" is in SCRIPTS`);
    const here = mapOf(m.map);
    const rect = momentTriggerRect(m, here.anchor);
    assert.ok(rect, `${m.id}: the anchor "${m.trigger.anchor}" resolves on ${m.map}`);
    assert.ok(rect.x1 >= rect.x0 && rect.y1 >= rect.y0);
    let open = 0;
    for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) if (here.walkable(x, y)) open++;
    assert.ok(open >= 20, `${m.id}: she can actually stand on most of the trigger (${open} walkable tiles)`);
  }
  assert.deepEqual(plain(MOMENTS[0].after), { cutscene: 'gate2' }, 'M1 waits for the Gate 2 welcome / the opening');
  assert.deepEqual(plain(MOMENTS[1].after), { moments: ['m1'] }, 'M2 comes after M1');
  assert.deepEqual(plain(MOMENTS[2].after), { keys: 1 }, 'M3 waits for the first key');
  assert.equal(MOMENT_GAP_S, 90);
  assert.equal(MOMENT_PER_VISIT, 1);
  // The entrance pair chains: M2 overrides the global gap (a few seconds after M1 ENDS) and may share M1's map visit; M1 uses the defaults.
  assert.equal(MOMENTS[1].minGapS, 6, 'M2 follows M1 about 6 s after it ends');
  assert.equal(MOMENTS[1].sameVisitOk, true);
  assert.equal(momentGapS(MOMENTS[1]), 6);
  assert.equal(momentGapS(MOMENTS[0]), MOMENT_GAP_S, 'M1 has no override');
  assert.equal(MOMENTS[0].sameVisitOk, undefined);
  assert.equal(momentGapS(MOMENTS[2]), MOMENT_GAP_S, 'M3 uses the default 90 s gap');
  assert.equal(momentFitsVisit(MOMENTS[2], 1), false, 'and one moment per map visit');
  assert.equal(MOMENTS[2].sameVisitOk, undefined);
  assert.equal(MOMENTS[2].afterFreeS, undefined);
  // M1 is on the avenue just inside Gate 2 (before the forecourt); M2 is on the forecourt in front of the Main Block door
  const gate = anchor('Gate 2 (Main Entrance)');
  const door = anchor('Main Block entrance');
  const r1 = rectOf('m1');
  const r2 = rectOf('m2');
  assert.ok(r1.y1 < gate.y && gate.y - r1.y0 <= 22, 'M1 is the gate avenue, north of the gate');
  assert.ok(r1.x0 <= gate.x && gate.x <= r1.x1, 'M1 spans the avenue');
  assert.ok(r2.y0 > door.y && r2.y0 - door.y <= 8, 'M2 is on the forecourt south of the door');
  assert.ok(r1.y0 > r2.y1, 'M1 is further from the Main Block than M2: she meets M1 first');
});

// ---------- the pacing rules (pure) ----------

test('FB-0051: M1 starts on the avenue only after the Gate 2 welcome, only inside its trigger, and only on the campus', () => {
  const rect = rectOf('m1');
  assert.equal(momentDue(fresh(), 100, ctxFor('m1'))?.id, 'm1');
  assert.equal(momentDue(fresh({ seenCutscenes: new Set() }), 100, ctxFor('m1')), null, 'not before the opening / Mustafa greeting has happened');
  for (const [tileX, tileY] of [[rect.x0 - 1, rect.y0 + 1], [rect.x1 + 1, rect.y0 + 1], [rect.x0 + 2, rect.y0 - 1], [rect.x0 + 2, rect.y1 + 1]]) {
    assert.equal(momentDue(fresh(), 100, ctxFor('m1', { tileX, tileY })), null, `outside the trigger at ${tileX},${tileY}`);
  }
  assert.equal(momentDue(fresh(), 100, ctxFor('m1', { map: 'main-block-g' })), null, 'never on another map');
});

test('FB-0051: a moment plays once only, ever (seenMoments), whatever happens afterwards', () => {
  const state = fresh({ seenMoments: new Set(['m1']) });
  assert.equal(momentDue(state, 1e6, ctxFor('m1')), null);
  const both = fresh({ seenMoments: new Set(['m1', 'm2']) });
  for (const id of ['m1', 'm2']) assert.equal(momentDue(both, 1e9, ctxFor(id)), null);
  // an array (a state restored by something other than save.js) works too
  assert.equal(momentDue({ ...fresh(), seenMoments: ['m1'] }, 1e6, ctxFor('m1')), null);
});

test('FB-0051: M1 then M2 chain on one visit: M2 waits for about 6 s of play after M1 ENDS, then plays', () => {
  const state = fresh();
  markMomentStarted(state, 'm1', 100);
  markMomentEnded(state, 116);
  assert.equal(state.lastMomentAt, 116, 'the gap is measured from the end of the scene');
  assert.deepEqual([...state.seenMoments], ['m1']);
  const onVisit = (over) => ctxFor('m2', { visitCount: 1, ...over }); // M1 already started on this visit
  assert.equal(momentDue(state, 116, onVisit()), null, 'the instant M1 ends: too soon (they never bunch up)');
  assert.equal(momentDue(state, 116 + 5.9, onVisit()), null, 'just under 6 s after M1 ended: still waiting');
  assert.equal(momentDue(state, 116 + 6, onVisit())?.id, 'm2', '6 s after M1 ended, on the same visit: M2 plays');
  assert.equal(momentDue(state, 5000, onVisit())?.id, 'm2', 'it was not lost: it waits as long as it takes');
});

test('FB-0051: if she reaches the forecourt during the 6 s gap, or while the entrance beat holds the screen, M2 starts on the first free frame while she is still there', () => {
  const state = fresh();
  markMomentStarted(state, 'm1', 100);
  markMomentEnded(state, 116);
  const r = rectOf('m2');
  const stand = { tileX: r.x0 + 6, tileY: r.y0 + 2 }; // on the steps, in front of the door
  assert.equal(momentDue(state, 120, ctxFor('m2', { ...stand, visitCount: 1 })), null, 'she arrives 4 s after M1: waits');
  // the first-time Main Block entrance beat (a script) takes the screen for ~6 s, then control returns on the very next frame
  assert.equal(momentDue(state, 124, ctxFor('m2', { ...stand, visitCount: 1, blocked: true })), null, 'blocked while the beat runs');
  assert.equal(momentDue(state, 126.016, ctxFor('m2', { ...stand, visitCount: 1, blocked: false }))?.id, 'm2', 'first free frame: M2');
  // and it never fires if she is not standing in its area
  assert.equal(momentDue(state, 126.016, ctxFor('m2', { tileX: r.x0 - 3, tileY: r.y0, visitCount: 1 })), null);
});

test('FB-0051: M2\'s trigger covers every way to the Main Block door: on the real campus she cannot reach a tile next to the door without crossing it', () => {
  const rect = rectOf('m2');
  const door = campusObjects.find((o) => o.name === 'Main Block entrance');
  const cells = [Math.floor(door.x), Math.floor(door.x) + 1].map((x) => [x, Math.floor(door.y)]); // the doorway is two tiles wide (cells 2x1)
  const inRect = (x, y) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
  // flood the whole walkable campus from the spawn, never stepping into the trigger rectangle
  const spawn = campusObjects.find((o) => o.type === 'spawn');
  const seen = new Set([`${Math.floor(spawn.x)},${Math.floor(spawn.y)}`]);
  const stack = [[Math.floor(spawn.x), Math.floor(spawn.y)]];
  assert.ok(!inRect(...stack[0]));
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !walkable(nx, ny) || inRect(nx, ny)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  assert.ok(seen.size > 5000, `sanity: the flood covered the campus (${seen.size} tiles)`);
  // every tile (including diagonals) beside a doorway cell is either blocked or inside the rectangle: unreachable without crossing it
  for (const [cx, cy] of cells) {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (!walkable(x, y)) continue;
      assert.ok(inRect(x, y) || !seen.has(`${x},${y}`), `tile ${x},${y} beside the door is reachable without crossing M2's trigger`);
    }
  }
  assert.ok(!seen.has(`${cells[0][0]},${cells[0][1] + 1}`) && !seen.has(`${cells[1][0]},${cells[1][1] + 1}`), 'the steps in front of the doorway are only reachable through the trigger');
  // the arrival tile of someone coming OUT of the Main Block (in front of the door) is inside it too: she meets M2 on the way back out as well
  assert.ok(inRect(cells[0][0], cells[0][1] + 1));
  // the trigger is a modest area (the steps, the forecourt and the pavement beside it), not half the campus
  assert.ok((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1) <= 150);
});

test('FB-0051: later moments (no override) still obey the 90 s gap and one-per-visit; only the entrance pair is exempt', () => {
  const later = [{ id: 'm3', map: 'campus', script: 'x', trigger: MOMENTS[1].trigger, after: { moments: ['m2'] } }, { id: 'm4', map: 'campus', script: 'y', trigger: MOMENTS[1].trigger, after: { moments: ['m3'] } }];
  const base = { seenMoments: new Set(['m1', 'm2']), lastMomentAt: 200, seenCutscenes: new Set(['gate2']) };
  const at = (now, over, state = base) => momentDue(state, now, ctxFor('m2', { moments: later, ...over }));
  assert.equal(momentGapS(later[0]), MOMENT_GAP_S);
  assert.equal(momentFitsVisit(later[0], 1), false);
  assert.equal(momentFitsVisit(MOMENTS[1], 1), true);
  assert.equal(at(206, {}), null, '6 s is not enough for a later moment');
  assert.equal(at(289.9, {}), null, 'just under 90 s');
  assert.equal(at(290, {})?.id, 'm3', '90 s after the last one: due');
  assert.equal(at(1000, { visitCount: 1 }), null, 'never two on the same map visit');
  assert.equal(at(1000, { visitCount: 0 })?.id, 'm3');
  assert.equal(at(1000, {}, { ...base, seenMoments: new Set(['m1', 'm2', 'm3']) })?.id, 'm4', 'in order');
  assert.equal(at(1000, {}, { ...base, seenMoments: new Set(['m1', 'm2', 'm3']), lastMomentAt: 990 }), null, 'and 90 s apart');
});

test('FB-0051: M2 needs M1 first: the order is kept even if the 90 s are long over', () => {
  assert.equal(momentDue(fresh(), 1e6, ctxFor('m2')), null);
  const state = fresh({ seenMoments: new Set(['m1']), lastMomentAt: 0 });
  assert.equal(momentDue(state, 1e6, ctxFor('m2'))?.id, 'm2');
  // standing in M2's trigger with nothing played does not start M2, and standing in M1's starts M1
  assert.equal(momentDue(fresh(), 1e6, ctxFor('m1'))?.id, 'm1');
});

test('FB-0051: the per-visit cap: the default is one moment per map visit; only a moment marked sameVisitOk (M2) may be the second', () => {
  assert.equal(MOMENT_PER_VISIT, 1);
  const state = fresh({ seenMoments: new Set(['m1']), lastMomentAt: 0 });
  assert.equal(momentDue(state, 1000, ctxFor('m2', { visitCount: 0 }))?.id, 'm2');
  assert.equal(momentDue(state, 1000, ctxFor('m2', { visitCount: MOMENT_PER_VISIT }))?.id, 'm2', 'the entrance pair chains on one visit');
  assert.equal(momentDue(fresh(), 1000, ctxFor('m1', { visitCount: 1 })), null, 'M1 has no override: not on a visit that already had a moment');
});

test('FB-0051: ?moments=0 (and ?cutscene=0, and the GameState dev flag) turn every moment off', () => {
  assert.equal(momentsEnabled(''), true);
  assert.equal(momentsEnabled('?moments=1'), true);
  assert.equal(momentsEnabled('?map=campus&moments=0'), false);
  assert.equal(momentsEnabled('?cutscene=0'), false, 'a moment is a cutscene to every spec that skips them');
  assert.equal(momentsEnabled('', { momentsDisabled: true }), false);
  assert.equal(momentsEnabled('', { momentsDisabled: false }), true);
  assert.equal(momentDue(fresh(), 100, ctxFor('m1', { enabled: momentsEnabled('?moments=0') })), null);
  assert.equal(game.GameState.momentsDisabled, false, 'on by default');
  assert.doesNotMatch(read('src', 'save.js'), /momentsDisabled/, 'a dev switch is never saved');
});

test('FB-0051: nothing starts while a dialog, mini-game, script, door walk, pause menu or overlay owns the screen, and it starts on the next free frame', () => {
  const state = fresh();
  assert.equal(momentDue(state, 100, ctxFor('m1', { blocked: true })), null);
  assert.equal(momentDue(state, 100.016, ctxFor('m1', { blocked: false }))?.id, 'm1', 'unplayed, so the very next free frame starts it');
  assert.equal(state.seenMoments.size, 0, 'momentDue only asks; it records nothing');
  // what makes the engine say "blocked" is written in world.js checkMoment()
  const world = read('src', 'scenes', 'world.js');
  const body = world.slice(world.indexOf('  checkMoment() {'), world.indexOf('  playMoment(moment) {'));
  for (const piece of ['this.transitioning', 'this.scriptRunner.isRunning', '!this.sys.isActive()', 'ui.isBlocking()', '!ui.tutorial']) assert.ok(body.includes(piece), `checkMoment() must treat ${piece} as blocked`);
  assert.match(body, /if \(!momentsEnabled\(\)\) return;/);
});

test('FB-0051: the engine hook: checked every frame next to checkCutscene(), a new visit starts at 0, the play clock runs, the scene is unskippable and always puts the world back', () => {
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /this\.checkCutscene\(\);\s*this\.checkKeyRoomBeats\(\);\s*this\.checkMoment\(\);/);
  assert.match(world, /this\.momentsThisVisit = 0;/);
  assert.match(world, /GameState\.playSeconds \+= Math\.min\(delta, 250\) \/ 1000;/);
  const play = world.slice(world.indexOf('  playMoment(moment) {'), world.indexOf('  // The 3 key-room beats'));
  assert.match(play, /markMomentStarted\(GameState, moment\.id, GameState\.playSeconds\)/, 'counted as played the instant it starts');
  assert.match(play, /markMomentEnded\(/);
  assert.match(play, /run\(steps, \{ unskippable: true \}\)/);
  assert.match(play, /startFollow\(this\.player/, 'the camera follows her again whatever happened');
  assert.match(play, /letterbox\.snap\(false\)/, 'the bars are gone whatever happened');
  assert.match(play, /\(error\) =>/, 'a failing script still restores the world');
  assert.match(play, /setAmbientVisible\(true\)/);
});

// ---------- saving ----------

test('FB-0051: seenMoments, the play clock and the last-moment time round-trip through a save; an old save has none and every moment may play once', () => {
  const { GameState, snapshotState, applyState, saveGame, loadGame, resetGameState } = game;
  GameState.seenMoments = new Set(['m1']);
  GameState.playSeconds = 123.5;
  GameState.lastMomentAt = 118.25;
  const snap = plain(snapshotState(GameState));
  assert.deepEqual(snap.seenMoments, ['m1']);
  assert.equal(snap.playSeconds, 123.5);
  assert.equal(snap.lastMomentAt, 118.25);
  assert.ok(saveGame('moments-test'));
  resetGameState();
  assert.equal(GameState.seenMoments.size, 0);
  assert.equal(GameState.playSeconds, 0);
  assert.equal(GameState.lastMomentAt, null);
  assert.ok(loadGame('moments-test'));
  assert.deepEqual([...GameState.seenMoments], ['m1']);
  assert.equal(GameState.playSeconds, 123.5);
  assert.equal(GameState.lastMomentAt, 118.25);
  // an old save: none of the three fields exist
  const old = { ...snap };
  delete old.seenMoments; delete old.playSeconds; delete old.lastMomentAt;
  applyState(GameState, old);
  assert.equal(typeof GameState.seenMoments.has, 'function');
  assert.equal(GameState.seenMoments.size, 0, 'migrated to an empty list: nothing has "already happened"');
  assert.equal(GameState.playSeconds, 0);
  assert.equal(GameState.lastMomentAt, null);
  assert.equal(momentDue(GameState, 1000, ctxFor('m1', {}))?.id, undefined, 'sanity: GameState here has no gate2 seen, so nothing yet');
  GameState.seenCutscenes.add('gate2');
  assert.equal(momentDue(GameState, 1000, ctxFor('m1'))?.id, 'm1', 'a moment from an old save may simply play once');
  // junk in a save never breaks the load
  applyState(GameState, { ...snap, seenMoments: 'x', playSeconds: 'soon', lastMomentAt: 'never' });
  assert.equal(GameState.seenMoments.size, 0);
  assert.equal(GameState.playSeconds, 0);
  assert.equal(GameState.lastMomentAt, null);
  // a brand-new game plays them all again
  GameState.seenMoments = new Set(['m1', 'm2']);
  GameState.playSeconds = 500;
  resetGameState();
  assert.equal(GameState.seenMoments.size, 0);
  assert.equal(GameState.playSeconds, 0);
});

// ---------- the scripts as data ----------

const runnerSource = read('src', 'scripts-runtime.js');
const implemented = new Set([...runnerSource.matchAll(/^\s+(?:async )?step_(\w+)\(/gm)].map((m) => m[1]));
const soundIds = new Set(Object.keys(SOUNDS));

function walkSteps(steps, visit, where) {
  steps.forEach((step, i) => {
    const type = Object.keys(step)[0];
    visit(type, step[type], `${where}[${i}]`);
    if (type === 'parallel' || type === 'sequence') walkSteps(step[type], visit, `${where}[${i}].${type}`);
  });
}

for (const m of MOMENTS) {
  test(`FB-0051: SCRIPTS.${m.script}: single-key steps, every type exists in the runner, every sound/sheet/frame it names is real`, () => {
    const spawned = new Map(); // actor id -> sprite key
    walkSteps(SCRIPTS[m.script], (type, body, where) => {
      assert.ok(implemented.has(type), `${where}: no step_${type} in src/scripts-runtime.js`);
      if (type === 'sound') assert.ok(soundIds.has(body), `${where}: unknown sound "${body}"`);
      if (type === 'spawnActor') {
        spawned.set(body.id, body.sprite);
        if (body.kind === 'image') {
          const sheet = Object.values(MOMENT_SHEETS).find((s) => s.key === body.sprite);
          assert.ok(sheet, `${where}: an image actor that is not a moment sheet`);
          assert.ok(body.frame >= 0 && body.frame < Object.keys(sheet.frames).length, `${where}: spawn frame outside the sheet`);
        }
      }
      if (type === 'frame' || type === 'loop' || type === 'anim') {
        const sheet = Object.values(MOMENT_SHEETS).find((s) => s.key === spawned.get(body.actor));
        assert.ok(sheet, `${where}: ${type} on an actor that is not a spawned moment sheet`);
        for (const f of type === 'frame' ? [body.frame] : body.frames) assert.ok(Number.isInteger(f) && f >= 0 && f < Object.keys(sheet.frames).length, `${where}: frame ${f} outside the sheet`);
      }
      if (['move', 'face', 'emote', 'lift', 'sparkles', 'setActorVisible'].includes(type) && body.actor !== 'player') {
        assert.ok(spawned.has(body.actor), `${where}: ${type} on "${body.actor}" before it is spawned`);
      }
      if (type === 'say') {
        assert.equal(typeof body.autoMs, 'number', `${where}: every moment line advances by itself (autoMs), so the scene always ends`);
        assert.ok(body.autoMs >= 1000 && body.autoMs <= 3000, `${where}: reading time ${body.autoMs} ms`);
        for (const line of body.lines) assert.ok(line.replace(/\{name\}/g, 'MMMMMMMMMM').length <= 120, `${where}: a long line`);
      }
      if (type === 'emote' && body.kind) assert.ok(['!', 'heart', 'note', 'sparkle', '?', '...'].includes(body.kind), `${where}: emote kind ${body.kind}`);
    }, m.script);
    // framed like every trigger-played script: input locked and letterbox in first, out and unlocked last
    const steps = plain(SCRIPTS[m.script]);
    assert.deepEqual(steps[0], { lockInput: true });
    assert.deepEqual(steps[1], { letterbox: 'in' });
    assert.deepEqual(steps.at(-2), { letterbox: 'out' });
    assert.deepEqual(steps.at(-1), { unlockInput: true });
    assert.ok(steps.some((s) => s.cameraFollow === 'player'), 'the camera follows her again');
  });
}

test('FB-0051: M1 says the owner\'s exact line, then the prince\'s, then hers; the speaker is the player (the {name} token)', () => {
  const says = SCRIPTS.momentUnicorn.filter((s) => s.say).map((s) => plain(s.say));
  assert.equal(says.length, 3);
  assert.deepEqual(says[0].lines, ["WOAH, WHAT? I'm not drunk yet, so why is a unicorn here?"], 'the owner\'s inside joke, exactly as written');
  assert.equal(says[0].speaker, '{name}');
  assert.deepEqual(says[1], { speaker: 'Prince', lines: ["Don't mind me. I'm always watching."], autoMs: says[1].autoMs });
  assert.deepEqual(says[2].lines, ['Huh... is this the actual BITS?']);
  assert.equal(says[2].speaker, '{name}');
  assert.ok(game.renderLine('{name}', { playerName: 'Zara' }) === 'Zara' && game.renderLine('{name}', game.GameState) === 'Taru');
});

test('FB-0051: M1 plays in the owner\'s order: a unicorn grazes (2-frame loop), "!", her line, the prince walks in from the right, he mounts, it lifts off with sparkles and a shadow on the ground, she closes', () => {
  const steps = plain(SCRIPTS.momentUnicorn);
  const at = (pred, from = 0) => steps.findIndex((s, i) => i >= from && pred(s));
  const spawnUnicorn = at((s) => s.spawnActor && s.spawnActor.id === 'unicorn');
  const loop = at((s) => s.loop && s.loop.actor === 'unicorn');
  const bang = at((s) => s.parallel && s.parallel.some((p) => p.emote && p.emote.kind === '!' && p.emote.actor === 'player'));
  const line1 = at((s) => s.say && s.say.lines[0].startsWith('WOAH'));
  const spawnPrince = at((s) => s.spawnActor && s.spawnActor.id === 'prince');
  const princeIn = at((s) => s.move && s.move.actor === 'prince');
  const princeLine = at((s) => s.say && s.say.speaker === 'Prince');
  const mount = at((s) => s.despawnActor === 'prince');
  const rideFrame = at((s) => s.frame && s.frame.frame === MOMENT_SHEETS.unicorn.frames.ridden);
  const liftOff = at((s) => s.parallel && s.parallel.some((p) => p.lift) && s.parallel.some((p) => p.sparkles) && s.parallel.some((p) => p.move));
  const gone = at((s) => s.despawnActor === 'unicorn');
  const closing = at((s) => s.say && s.say.lines[0].startsWith('Huh'));
  const order = [spawnUnicorn, loop, bang, line1, spawnPrince, princeIn, princeLine, mount, rideFrame, liftOff, gone, closing];
  assert.ok(order.every((i) => i >= 0), `a beat is missing: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'beats out of order');
  assert.deepEqual(steps[loop].loop.frames, [MOMENT_SHEETS.unicorn.frames.grazeA, MOMENT_SHEETS.unicorn.frames.grazeB], 'the 2-frame graze loop');
  const lift = steps[liftOff].parallel.find((p) => p.lift).lift;
  assert.ok(lift.to >= 100, 'it climbs far enough to leave the top of the screen (a screen is ~180 px tall)');
  assert.equal(lift.fadeOut, true);
  assert.equal(steps[spawnUnicorn].spawnActor.shadow, undefined, 'it keeps the ground shadow (the lift step leaves it behind)');
  // the prince walks in from the right: his start is east of the unicorn, and his name tag is "Prince"
  const tl = momentTimeline(SCRIPTS.momentUnicorn, { anchor, player: { x: 244 * 16 + 8, y: 152 * 16 + 8 } });
  const princeStart = tl.actors.prince.waypoints[0];
  const unicorn = tl.actors.unicorn.waypoints[0];
  assert.ok(princeStart.x > unicorn.x + 8 * 16, 'he starts well to the right of the unicorn (off screen)');
  assert.equal(steps[spawnPrince].spawnActor.sprite, 'npc-prince');
});

test('FB-0051: M2 plays in order: a snare roll as Mevin runs in with a kit, a crash and a jump, his two lines, a bar of drums with a note and a heart, a rimshot, he runs off', () => {
  const steps = plain(SCRIPTS.momentMevin);
  const flat = [];
  walkSteps(steps, (type, body) => flat.push({ type, body }), 'm2');
  const idx = (pred, from = 0) => flat.findIndex((s, i) => i >= from && pred(s));
  const roll = idx((s) => s.type === 'sound' && s.body === 'drumRoll');
  const run = idx((s) => s.type === 'move' && s.body.actor === 'mevin');
  const crash = idx((s) => s.type === 'sound' && s.body === 'drumCrash', run);
  const jumpUp = idx((s) => s.type === 'lift' && s.body.actor === 'mevin' && s.body.to > 0, run);
  const say = idx((s) => s.type === 'say');
  const note = idx((s) => s.type === 'emote' && s.body.kind === 'note', say);
  const heart = idx((s) => s.type === 'emote' && s.body.kind === 'heart', note);
  const kick = idx((s) => s.type === 'sound' && s.body === 'drumKick', say);
  const rim = idx((s) => s.type === 'sound' && s.body === 'drumRimshot', kick);
  const off = idx((s) => s.type === 'move' && s.body.actor === 'mevin', rim);
  const order = [roll, run, crash, jumpUp, say, kick, note, heart, rim, off];
  assert.ok(order.every((i) => i >= 0), `a beat is missing: ${order}`);
  assert.ok(roll < run && run < crash && crash < say && say < rim && rim < off, 'beats out of order');
  const s = flat[say].body;
  assert.equal(s.speaker, 'Mevin (Treble)', 'the name tag names the club');
  assert.deepEqual(s.lines, ['WOAHHH, {name}! You da goat!', 'Come watch me perform at Jashn some day!']);
  // every hit of the bar pairs a kit sound with a kit frame, and the sounds are the drum set
  const hits = flat.filter((x) => x.type === 'sound' && /^drum(Kick|Snare|Crash)$/.test(x.body));
  assert.ok(hits.length >= 8, 'a bar of at least 8 hits');
  const kitFrames = flat.filter((x) => x.type === 'frame' && x.body.actor === 'kit').map((x) => x.body.frame);
  for (const f of [MOMENT_SHEETS.drums.frames.kick, MOMENT_SHEETS.drums.frames.snare, MOMENT_SHEETS.drums.frames.crash]) assert.ok(kitFrames.includes(f), `the kit shows frame ${f}`);
  // he stays only as long as the scene: no ambient entry for him (and nobody on a map is called Mevin)
  for (const list of Object.values(AMBIENT)) assert.ok(!list.some((e) => /mevin/i.test(e.name || '')), 'Mevin is a script actor, not a student on a map');
  for (const def of Object.values(MAPS)) assert.ok(!(def.npcs || []).some((n) => /mevin/i.test(n.name || '')), 'Mevin is not in the Main Block (or anywhere on a map)');
});

test('FB-0051: the drum bar and the rimshot line up: the bar is 8 hits of 280 ms and the roll runs until Mevin arrives', () => {
  const steps = plain(SCRIPTS.momentMevin);
  const bar = steps.find((s) => s.parallel && s.parallel.some((p) => p.sequence && p.sequence.some((q) => q.sound === 'drumKick'))).parallel;
  const drumSeq = bar.find((p) => p.sequence && p.sequence.some((q) => q.sound)).sequence;
  const ms = drumSeq.reduce((n, q) => n + (q.wait || 0), 0);
  assert.equal(ms, 8 * 280);
  const emotes = bar.find((p) => p.sequence && p.sequence.some((q) => q.emote)).sequence.length * MOMENT_TIMING.emoteMs;
  assert.ok(Math.abs(emotes - ms) <= 100, `the note and the heart (${emotes} ms) fill the bar (${ms} ms)`);
  // the snare roll sound is as long as the run-in takes at its fastest (it never ends long before he arrives, and not far after)
  const wav = fs.readFileSync(path.join(ROOT, SOUNDS.drumRoll.file));
  const rollMs = ((wav.length - 44) / 2 / wav.readUInt32LE(24)) * 1000;
  assert.ok(rollMs >= 1200 && rollMs <= 2000, `the roll lasts ${Math.round(rollMs)} ms`);
});

// ---------- the real map: durations and places ----------

test('FB-0051: measured at the runtime\'s own speeds, each moment lasts 8-20 s from every tile its trigger can fire on, and never waits for a key', () => {
  for (const m of MOMENTS) {
    const here = mapOf(m.map);
    const rect = momentTriggerRect(m, here.anchor);
    let min = Infinity;
    let max = 0;
    let tiles = 0;
    for (let ty = rect.y0; ty <= rect.y1; ty++) {
      for (let tx = rect.x0; tx <= rect.x1; tx++) {
        if (!here.walkable(tx, ty)) continue;
        const tl = momentTimeline(SCRIPTS[m.script], { anchor: here.anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
        assert.deepEqual(plain(tl.unknownSteps), [], `${m.id} at ${tx},${ty}: a step the measurer does not know, or a point that does not resolve`);
        assert.equal(tl.needsInput, false, `${m.id}: a line without autoMs would wait for a key press`);
        min = Math.min(min, tl.durationMs);
        max = Math.max(max, tl.durationMs);
        tiles++;
      }
    }
    assert.ok(tiles >= 20);
    assert.ok(min >= MOMENT_MIN_MS, `${m.id}: ${Math.round(min)} ms is under ${MOMENT_MIN_MS}`);
    assert.ok(max <= MOMENT_MAX_MS, `${m.id}: ${Math.round(max)} ms is over ${MOMENT_MAX_MS}`);
  }
  assert.equal(MOMENT_MIN_MS, 8000);
  assert.equal(MOMENT_MAX_MS, 20000);
});

test('FB-0051: the measurer\'s speeds are the runtime\'s own (letterbox slide, typewriter rate, emote hold, default move speed)', () => {
  const ui = read('src', 'scenes', 'ui.js');
  assert.equal(Number(ui.match(/const SCRIPT_LETTERBOX_SLIDE_MS = (\d+)/)[1]), MOMENT_TIMING.letterboxMs);
  assert.equal(Number(ui.match(/const CHARS_PER_SECOND = (\d+)/)[1]), MOMENT_TIMING.charsPerSecond);
  assert.match(runnerSource, /kind === 'sparkle' \? 700 : 900/);
  assert.match(runnerSource, /alpha: 0, duration: 200/);
  assert.equal(MOMENT_TIMING.emoteMs, 900 + 200);
  assert.match(runnerSource, /step_move\(\{ actor: actorId, path, speed = 5,/);
  assert.equal(MOMENT_TIMING.defaultSpeed, 5);
  assert.match(runnerSource, /Math\.max\(60, \(distanceTiles \/ Math\.max\(0\.1, speedTiles\)\) \* 1000\)/);
});

test('FB-0051: every place an actor stands or walks on the ground is open, walkable campus (no wall, tree trunk, building or water), from every tile she can be on, and the camera targets are on the map', () => {
  for (const m of MOMENTS) {
    const here = mapOf(m.map);
    const rect = momentTriggerRect(m, here.anchor);
    const feet = { character: 7 };
    for (let ty = rect.y0; ty <= rect.y1; ty++) {
      for (let tx = rect.x0; tx <= rect.x1; tx++) {
        if (!here.walkable(tx, ty)) continue;
        const tl = momentTimeline(SCRIPTS[m.script], { anchor: here.anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
        for (const [id, a] of Object.entries(tl.actors)) {
          // the unicorn and the kit are image actors: their hooves are `feet` px below their centre (MOMENT_SHEETS)
          const sheet = Object.values(MOMENT_SHEETS).find((s) => a.kind === 'image' && s.key === a.sheet);
          const below = sheet ? sheet.feet : feet.character;
          for (const w of a.waypoints) {
            if (w.alt > 0) continue; // in the air: it flies over everything
            const x = Math.floor(w.x / 16);
            const y = Math.floor((w.y + below) / 16);
            assert.ok(here.walkable(x, y), `${m.id}: ${id} stands on tile ${x},${y} (blocked), with her at ${tx},${ty}`);
          }
        }
        // the player is never moved by a moment: nothing can leave her in a collider
        assert.equal(tl.player.waypoints.length, 1, `${m.id}: a moment never walks or places her`);
        // nothing she can stand beside is overlapped by a figure at her own spot
        for (const [id, a] of Object.entries(tl.actors)) {
          const last = a.waypoints.at(-1);
          assert.ok(Math.hypot(last.x - tl.player.x, last.y - tl.player.y) > 12 || a.despawned, `${m.id}: ${id} ends on top of her`);
        }
      }
    }
  }
  for (const m of MOMENTS) {
    for (const name of new Set(JSON.stringify(SCRIPTS[m.script]).match(/"anchor":"[^"]+"/g))) {
      assert.ok(mapOf(m.map).anchor(JSON.parse(`{${name}}`).anchor), `${m.id}: ${name} resolves on ${m.map}`);
    }
  }
});

test('FB-0051: every actor a moment spawns is gone again at the end, hidden actors are shown again, and she ends exactly where she started, free', () => {
  for (const m of MOMENTS) {
    const here = mapOf(m.map);
    const rect = momentTriggerRect(m, here.anchor);
    const tl = momentTimeline(SCRIPTS[m.script], { anchor: here.anchor, player: { x: (rect.x0 + 2) * 16 + 8, y: (rect.y0 + 1) * 16 + 8 } });
    for (const [id, a] of Object.entries(tl.actors)) assert.equal(a.despawned, true, `${m.id}: ${id} is still standing there when the scene ends`);
    assert.deepEqual([tl.player.x, tl.player.y], [(rect.x0 + 2) * 16 + 8, (rect.y0 + 1) * 16 + 8]);
    // the runner puts input back on its own whatever the script says (run()'s finally), and the script itself unlocks last
    assert.deepEqual(plain(SCRIPTS[m.script].at(-1)), { unlockInput: true });
  }
  assert.match(runnerSource, /finally \{\s*this\.scene\.transitioning = false;/);
});

test('FB-0051: the M1 lawn: the unicorn grazes on open grass with room on every side, and the prince\'s way in is grass or pavement', () => {
  const tl = momentTimeline(SCRIPTS.momentUnicorn, { anchor, player: { x: 244 * 16 + 8, y: 152 * 16 + 8 } });
  const home = tl.actors.unicorn.waypoints[0];
  const tx = Math.floor(home.x / 16);
  const ty = Math.floor((home.y + MOMENT_SHEETS.unicorn.feet) / 16);
  const names = (x, y) => tileInfo.tiles[campusGrid[y][x]].name;
  assert.match(names(tx, ty), /grass|lawn/i, `the unicorn stands on ${names(tx, ty)}`);
  for (let y = ty - 1; y <= ty + 1; y++) for (let x = tx - 1; x <= tx + 1; x++) assert.ok(walkable(x, y), `the lawn around the unicorn is open at ${x},${y}`);
  for (const w of tl.actors.prince.waypoints) assert.ok(walkable(Math.floor(w.x / 16), Math.floor((w.y + 7) / 16)));
});

// ---------- the new runner steps (a fake scene) ----------

function makeRunner() {
  const context = vm.createContext({
    console,
    Phaser: { Events: { EventEmitter: class { on() { return this; } emit() { return true; } } } },
    URLSearchParams,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    window: { game: { events: { on() {}, emit() {} } } },
    toPixel: (tiles) => tiles * 16 + 8,
    TILE: 16,
    COLORS: { gold: 0xffd23f, text: '#fff' },
    FONT: 'x',
  });
  for (const file of ['src/state.js', 'src/audio.js', 'src/dialog.js', 'src/scripts-runtime.js']) vm.runInContext(read(file), context, { filename: file });
  const ScriptRunner = vm.runInContext('ScriptRunner', context);
  const made = [];
  const sprite = (props) => {
    const s = {
      depth: 0, originX: 0.5, originY: 0.5, height: 32, displayHeight: 32, displayWidth: 32, active: true, frames: [], alpha: 1, ...props,
      setDepth(d) { this.depth = d; return this; },
      setFrame(f) { this.frames.push(f); this.frame = f; return this; },
      setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
      setAlpha(a) { this.alpha = a; return this; },
      setScale(k) { this.scale = k; return this; },
      setVisible(v) { this.visible = v; return this; },
      destroy() { this.active = false; },
    };
    made.push(s);
    return s;
  };
  const events = [];
  const scene = {
    transitioning: false,
    mapObjects: [],
    time: {
      delayedCall(ms, cb) { const h = setTimeout(cb, ms); return { remove: () => clearTimeout(h) }; },
      addEvent({ delay, callback }) { const h = setInterval(callback, delay); h.unref(); const e = { remove: () => clearInterval(h) }; events.push(e); return e; },
    },
    tweens: {
      // finishes after 5 ms with the final values written, like a very fast tween
      add({ targets, onUpdate, onComplete, ...props }) {
        const { duration, ease, ...to } = props;
        setTimeout(() => { for (const t of [].concat(targets)) Object.assign(t, to); if (onUpdate) onUpdate({ progress: 1 }); if (onComplete) onComplete(); }, 5);
      },
      killTweensOf() {},
    },
    add: {
      image(x, y, key, frame) { return sprite({ x, y, key, frame }); },
      ellipse(x, y, w, h) { return sprite({ x, y, w, h, alpha: 0.22, ellipse: true }); },
      star(x, y) { return sprite({ x, y, star: true }); },
    },
    cameras: { main: {} },
  };
  const dialogState = { isOpen: false, typing: false, choices: null, advanced: 0, closed: 0 };
  const dialog = Object.assign(dialogState, {
    open(speaker, lines, cb) { dialogState.speaker = speaker; dialogState.lines = lines; dialogState.cb = cb; dialogState.isOpen = true; },
    advance() { dialogState.advanced++; if (dialogState.advanced >= dialogState.lines.length) { dialogState.isOpen = false; dialogState.cb(); } },
    close() { dialogState.isOpen = false; dialogState.closed++; if (dialogState.cb) dialogState.cb(); }, // the real DialogBox calls onClose when it closes
  });
  scene.scene = { get: () => ({ dialog }) };
  return { runner: new ScriptRunner(scene), made, scene, dialog, events, context };
}

test('FB-0051: runner: `lift` raises the DRAWN sprite (its origin) and shrinks the shadow, but its ground position and depth never change', async () => {
  const { runner, made } = makeRunner();
  await runner.run([{ spawnActor: { id: 'u', sprite: 'moment-unicorn', kind: 'image', frame: 0, feet: 15, shadowSize: [22, 6], at: { x: 10, y: 10 } } }]);
  const u = made.find((m) => m.key === 'moment-unicorn');
  const shadow = made.find((m) => m.ellipse);
  assert.deepEqual([shadow.w, shadow.h], [22, 6], 'shadowSize sizes the ellipse');
  const y0 = u.y;
  const depth0 = u.depth;
  await runner.run([{ lift: { actor: 'u', to: 64, ms: 10 } }]);
  assert.equal(u.y, y0, 'the ground y (depth sorting) is untouched');
  assert.equal(u.depth, depth0);
  assert.equal(u.originY, 0.5 + 64 / 32, 'drawn 64 px higher');
  assert.ok(shadow.scale < 1 && shadow.alpha < 0.22, 'the shadow stays on the ground, smaller and fainter');
  await runner.run([{ lift: { actor: 'u', to: 0, ms: 10 } }]);
  assert.equal(u.originY, 0.5);
  assert.equal(shadow.scale, 1);
  assert.equal(shadow.alpha, 0.22);
  await runner.run([{ lift: { actor: 'u', to: 100, ms: 10, fadeOut: true } }]);
  assert.equal(u.alpha, 0, 'fadeOut ends invisible');
  await runner.run([{ lift: { actor: 'nobody', to: 5 } }]); // an unknown actor is a quiet no-op
});

test('FB-0051: runner: `loop` flips frames in the background until a `frame` or `despawnActor` stops it, and `sequence` is one branch of a `parallel`', async () => {
  const { runner, made, events } = makeRunner();
  await runner.run([
    { spawnActor: { id: 'u', sprite: 'moment-unicorn', kind: 'image', frame: 0, at: { x: 1, y: 1 } } },
    { loop: { actor: 'u', frames: [0, 1], frameMs: 10 } },
  ]);
  const u = made.find((m) => m.key === 'moment-unicorn');
  await new Promise((resolve) => setTimeout(resolve, 55));
  assert.ok(u.frames.includes(1) && u.frames.filter((f) => f === 0).length >= 2, 'the head-bob keeps going while nothing else is running');
  await runner.run([{ frame: { actor: 'u', frame: 2 } }]);
  const count = u.frames.length;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(u.frames.length, count, 'a frame step stops the loop');
  await runner.run([{ loop: { actor: 'u', frames: [3, 4], frameMs: 10 } }]);
  await runner.run([{ despawnActor: 'u' }]);
  const n = u.frames.length;
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(u.frames.length, n, 'despawning stops it too');
  assert.ok(events.length >= 2);
  // sequence: its steps run in order, inside a parallel next to a longer step
  const order = [];
  const t0 = Date.now();
  await runner.run([{ parallel: [
    { sequence: [{ wait: 20 }, { setFlag: 'a' }, { wait: 20 }, { setFlag: 'b' }] },
    { wait: 60 },
  ] }]);
  assert.ok(Date.now() - t0 >= 55);
  assert.equal(runner.scene.transitioning, false);
  void order;
});

test('FB-0051: runner: a moment run is unskippable (Esc does nothing), a normal one still skips', async () => {
  const { runner } = makeRunner();
  const start = Date.now();
  const running = runner.run([{ wait: 60 }, { wait: 60 }], { unskippable: true });
  await new Promise((resolve) => setTimeout(resolve, 10));
  runner.skip();
  assert.equal(runner.skipping, false, 'skip() is refused');
  await running;
  assert.ok(Date.now() - start >= 100, 'the whole scene played out');
  assert.equal(runner.unskippable, false, 'the next, ordinary script is skippable again');
  const again = runner.run([{ wait: 5000 }]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  runner.skip();
  const t = Date.now();
  await again;
  assert.ok(Date.now() - t < 1000);
});

test('FB-0051: runner: a `say` with autoMs advances every line by itself once it has finished typing, renders {name}, and waits while it is still typing', async () => {
  const { runner, dialog, context } = makeRunner();
  vm.runInContext("GameState.playerName = 'Zara';", context);
  const running = runner.run([{ say: { speaker: '{name}', lines: ['Hi {name}!', 'Second.'], autoMs: 400 } }]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(dialog.speaker, 'Zara');
  assert.deepEqual(plain(dialog.lines), ['Hi Zara!', 'Second.']);
  dialog.typing = true;
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.equal(dialog.advanced, 0, 'still typing: the reading time has not started');
  dialog.typing = false;
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(dialog.advanced, 0, 'not yet: 400 ms of reading first');
  await running;
  assert.equal(dialog.advanced, 2, 'both lines advanced by themselves');
  assert.equal(dialog.isOpen, false);
  // without autoMs nothing advances by itself (the ordinary scripts are unchanged)
  const other = makeRunner();
  const wait = other.runner.run([{ say: { speaker: null, lines: ['Hello'] } }]);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(other.dialog.advanced, 0);
  assert.equal(other.dialog.isOpen, true);
  other.runner.skip();
  await wait;
});

test('FB-0051: runner: `face` can turn toward another actor, `sparkles` leaves a trail of short-lived stars at the lifted position, and the new emotes are drawn, not typed', async () => {
  const { runner, made } = makeRunner();
  await runner.run([{ spawnActor: { id: 'a', sprite: 'x', kind: 'image', frame: 0, at: { x: 10, y: 10 } } }]);
  // face needs a real sprite with anims for character actors; the image path is covered by the e2e specs, so check the direction maths
  assert.equal(runner.directionOf(50, 0), 'right');
  assert.equal(runner.directionOf(-50, 3), 'left');
  assert.equal(runner.directionOf(2, -40), 'up');
  assert.match(runnerSource, /step_face\(\{ actor: actorId, dir, toward \} = \{\}\)/);
  const a = runner.actors.get('a');
  a.alt = 30;
  await runner.run([{ sparkles: { actor: 'a', ms: 80, every: 10 } }]);
  const stars = made.filter((m) => m.star);
  assert.ok(stars.length >= 3, `${stars.length} sparkles`);
  assert.ok(stars.every((s) => s.y < a.sprite.y), 'drawn at the lifted height, above the ground position');
  assert.match(runnerSource, /kind === 'heart'/);
  assert.match(runnerSource, /kind === 'note'/);
});

// ---------- art and sound ----------

const png = (rel) => decodePNG(fs.readFileSync(path.join(ROOT, rel)));
const opaqueCount = (img, x0, x1) => {
  let n = 0;
  for (let y = 0; y < img.height; y++) for (let x = x0; x < x1; x++) if (img.data[(y * img.width + x) * 4 + 3]) n++;
  return n;
};

test('FB-0051: the unicorn and drum sheets exist at the size MOMENT_SHEETS says, every frame is drawn and different, and the generator is wired in', () => {
  for (const sheet of Object.values(MOMENT_SHEETS)) {
    const img = png(sheet.file);
    const frames = Object.keys(sheet.frames).length;
    assert.equal(img.width, sheet.frameWidth * frames, `${sheet.file}: width`);
    assert.equal(img.height, sheet.frameHeight, `${sheet.file}: height`);
    Object.values(sheet.frames).forEach((index, i) => assert.equal(index, i, 'frame indexes are 0..n-1 in sheet order'));
    const seen = new Set();
    for (let f = 0; f < frames; f++) {
      assert.ok(opaqueCount(img, f * sheet.frameWidth, (f + 1) * sheet.frameWidth) > 60, `${sheet.file}: frame ${f} is empty`);
      const rows = [];
      for (let y = 0; y < img.height; y++) rows.push(Buffer.from(img.data.subarray((y * img.width + f * sheet.frameWidth) * 4, (y * img.width + (f + 1) * sheet.frameWidth) * 4)).toString('base64'));
      assert.ok(!seen.has(rows.join('|')), `${sheet.file}: frame ${f} duplicates another`);
      seen.add(rows.join('|'));
    }
  }
  assert.equal(MOMENT_SHEETS.unicorn.frames.grazeA, 0);
  assert.equal(MOMENT_SHEETS.unicorn.frames.grazeB, 1, 'the 2-frame graze/head-bob');
  const tool = read('tools', 'make-moments.js');
  assert.match(tool, /const FRAME = 32;/);
  assert.match(tool, /const KIT_W = 28;/);
  assert.match(tool, /const KIT_H = 22;/);
  assert.equal(Number(tool.match(/const UNICORN_FRAMES = (\d+);/)[1]), Object.keys(MOMENT_SHEETS.unicorn.frames).length);
  assert.equal(Number(tool.match(/const KIT_FRAMES = (\d+);/)[1]), Object.keys(MOMENT_SHEETS.drums.frames).length);
  assert.match(read('package.json'), /make-animals\.js && node tools\/make-moments\.js/, 'npm run assets runs the moments generator');
  // the horn is gold and the mane pink: the sheet really has them (a unicorn, not a plain white horse)
  const colors = new Set();
  const img = png(MOMENT_SHEETS.unicorn.file);
  for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) colors.add(`#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join('')}`);
  for (const c of ['#f0c648', '#ff8fc7', '#f6f2fa']) assert.ok(colors.has(c), `the unicorn sheet lacks ${c}`);
});

test('FB-0051: the generated moment sheets match tools/make-moments.js (needs the git-ignored horse in assets/External Tilesets/)', (t) => {
  if (!fs.existsSync(path.join(ROOT, 'assets', 'External Tilesets', 'Ninja-Adventure-Horse', 'SpriteSheetBrownSide.png'))) { t.skip('the Ninja Adventure horse is not in this checkout'); return; }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pixel-moments-'));
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'make-moments.js'), '--out', out], { stdio: 'pipe' });
    for (const sheet of Object.values(MOMENT_SHEETS)) {
      assert.ok(fs.readFileSync(path.join(out, path.basename(sheet.file))).equals(fs.readFileSync(path.join(ROOT, sheet.file))), `${sheet.file} is out of date (npm run assets)`);
    }
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('FB-0051: the prince and Mevin have their own character sheets (16x24, 4 rows), distinct from everyone else, preloaded, and made by the generator', () => {
  const preload = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  const sig = (key) => Buffer.from(png(`assets/${key}.png`).data).toString('base64');
  const others = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^npc-(friend|prof)-.*\.png$|^npc-mustafa\.png$/.test(f) && !/mevin/.test(f)).map((f) => f.replace('.png', ''));
  for (const key of ['npc-prince', 'npc-friend-mevin']) {
    assert.ok(preload.has(key), `${key} is not in the preload list (a script spawns it)`);
    const img = png(`assets/${key}.png`);
    assert.equal(img.height, 4 * 24);
    assert.equal(img.width % 16, 0);
    for (const other of others) assert.notEqual(sig(key), sig(other), `${key} looks exactly like ${other}`);
  }
  const colorsOf = (key) => { const img = png(`assets/${key}.png`); const set = new Set(); for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) set.add(`#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join('')}`); return set; };
  const prince = colorsOf('npc-prince');
  for (const c of ['#e0b84f', '#c0392b']) assert.ok(prince.has(c), `the prince has the gold crown and the red cape (${c})`);
  assert.ok(colorsOf('npc-friend-mevin').has('#4b4b5e') && colorsOf('npc-friend-mevin').has('#6fc3ff'), 'Mevin\'s headphones');
  const tool = read('tools', 'make-assets.js');
  assert.match(tool, /write\('npc-prince\.png', buildFriendCharacter\(PRINCE_LOOK\)\)/);
  assert.match(tool, /'friend-mevin': \{ body: 'Bob'/);
  // only the prince and Mevin are new people: nobody else was added to the scripts
  const sprites = new Set(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => s.key));
  assert.ok(sprites.has('npc-mustafa'));
});

test('FB-0051: the drum sounds are registered, exist on disk, are generated by tools/make-audio.js, and are preloaded like every sound', () => {
  for (const id of ['drumRoll', 'drumKick', 'drumSnare', 'drumCrash', 'drumRimshot']) {
    assert.ok(SOUNDS[id], `SOUNDS.${id}`);
    assert.equal(SOUNDS[id].category, 'sfx');
    assert.equal(SOUNDS[id].loop, false);
    assert.ok(fs.existsSync(path.join(ROOT, SOUNDS[id].file)), `${SOUNDS[id].file} is missing (npm run audio)`);
    assert.match(read('tools', 'make-audio.js'), new RegExp(SOUNDS[id].file.replace('assets/audio/', '').replace(/\./g, '\\.')));
  }
  assert.match(read('src', 'audio.js'), /for \(const \[id, def\] of Object\.entries\(SOUNDS\)\)/, 'AudioManager.preload() loads every registered sound');
  // the offline bundle converts them (and picks up the sheets) from the same tables
  const pack = require('../../tools/pack-offline');
  const have = new Set(pack.collectRuntimeAssets().assets.map((a) => a.path));
  for (const id of ['drumRoll', 'drumKick', 'drumSnare', 'drumCrash', 'drumRimshot']) assert.ok(have.has(SOUNDS[id].file), `${SOUNDS[id].file} is not in the offline manifest`);
  for (const sheet of Object.values(MOMENT_SHEETS)) assert.ok(have.has(sheet.file), `${sheet.file} is not in the offline manifest`);
  for (const key of ['npc-prince', 'npc-friend-mevin']) assert.ok(have.has(`assets/${key}.png`), `${key} is not in the offline manifest`);
});

test('FB-0051: the moment sheets are preloaded by BootScene from MOMENT_SHEETS, and moments.js is loaded by index.html, the test helper and the offline bundler', () => {
  assert.match(read('src', 'main.js'), /for \(const sheet of Object\.values\(MOMENT_SHEETS\)\) this\.load\.spritesheet\(sheet\.key, sheet\.file, \{ frameWidth: sheet\.frameWidth, frameHeight: sheet\.frameHeight \}\);/);
  const html = read('index.html');
  assert.ok(html.includes('src/moments.js'), 'index.html loads src/moments.js');
  assert.ok(html.indexOf('src/state.js') < html.indexOf('src/moments.js') && html.indexOf('src/moments.js') < html.indexOf('src/scenes/world.js'), 'after state.js, before world.js');
  assert.ok(read('tests', 'helpers', 'game-data.js').includes("'src/moments.js'"));
  assert.ok(require('../../tools/pack-offline').DATA_SCRIPTS.includes('src/moments.js'));
});

// ---------- the e2e helpers ----------

test('FB-0051: the e2e helpers switch moments off by default (openGame and openTitle), and every spec that builds its own URL does too', async () => {
  const helpers = require('../e2e/helpers');
  const urls = [];
  const fakePage = () => ({ on() {}, goto: async (url) => { urls.push(url); }, waitForFunction: async () => {} });
  await helpers.openGame(fakePage());
  await helpers.openTitle(fakePage());
  assert.equal(urls.length, 2);
  for (const url of urls) assert.equal(new URL(url, 'http://x').searchParams.get('moments'), '0', `${url} does not switch moments off`);
  // a spec that wants them passes `moments: true`
  const on = [];
  await helpers.openGame({ on() {}, goto: async (u) => on.push(u), waitForFunction: async () => {} }, { moments: true, cutscene: true });
  assert.equal(new URL(on[0], 'http://x').searchParams.get('moments'), null);
  // every e2e spec that builds a URL itself (rather than through the helpers) sets moments=0 as well
  for (const file of fs.readdirSync(path.join(ROOT, 'tests', 'e2e')).filter((f) => f.endsWith('.spec.js'))) {
    const src = read('tests', 'e2e', file);
    if (!/new URLSearchParams\(\{/.test(src) && !/page\.goto\(`\/\?/.test(src)) continue;
    assert.match(src, /moments: '0'|moments=0/, `${file} builds its own URL without moments=0`);
  }
  assert.match(read('tests', 'e2e', 'helpers.js'), /params\.set\('moments', '0'\)/);
});

// ---------- the lines the owner edits ----------

test('FB-0051: the review doc lists the moment lines (so the owner can edit them), and no line says anything about a birthday', () => {
  const doc = read('docs', 'research', 'campus-lines-review.md');
  for (const text of [
    "WOAH, WHAT? I'm not drunk yet, so why is a unicorn here?", "Don't mind me. I'm always watching.", 'Huh... is this the actual BITS?',
    'WOAHHH, {name}! You da goat!', 'Come watch me perform at Jashn some day!', 'Mevin (Treble)',
    'Ah, {name}! Class is dismissed. A king never walks.', 'My ride. Kindly mind the marks, {name}.', 'Okay. Never mind. This is definitely BITS.',
    '{name}!', 'There you are! We have been looking everywhere.', 'Come to the canteen with us. We saved you a seat!', 'Give me a few minutes, I still have a hunt to finish.', 'Fine. But the chai will not wait forever.',
  ]) assert.ok(doc.includes(text), `campus-lines-review.md lacks "${text}"`);
  const lines = [];
  for (const m of MOMENTS) walkSteps(SCRIPTS[m.script], (type, body) => { if (type === 'say') lines.push(...body.lines); }, m.script);
  assert.ok(lines.length >= 5);
  for (const line of lines) assert.doesNotMatch(line.toLowerCase(), /birthday|bday|b-day/);
});

// ---------- not the instant control returns (afterFreeS) ----------

test('FB-0051: M1 needs 2.5 s of FREE control before it starts (not the instant the opening hands control back); M2 has no such wait', () => {
  assert.equal(MOMENTS[0].afterFreeS, 2.5);
  assert.equal(MOMENTS[1].afterFreeS, undefined, 'M2 simply follows M1 by its own ~6 s gap');
  const at = (freeSeconds, over = {}) => momentDue(fresh(), 100, ctxFor('m1', { freeSeconds, ...over }));
  assert.equal(at(0), null, 'control has only just come back');
  assert.equal(at(2.4), null, 'just under 2.5 s of free control');
  assert.equal(at(2.5)?.id, 'm1', '2.5 s of free control: due');
  assert.equal(at(30)?.id, 'm1');
  assert.equal(at(undefined)?.id, 'm1', 'a caller that does not track free time is not held back (and nothing saved holds it back either)');
  assert.equal(momentDue(fresh({ seenMoments: new Set(['m1']), lastMomentAt: 0 }), 100, ctxFor('m2', { freeSeconds: 0, visitCount: 1 }))?.id, 'm2', 'M2 ignores the free-time rule');
  assert.doesNotMatch(read('src', 'save.js'), /freeSeconds/, 'a runtime counter: never saved, so an old save changes nothing');
});

test('FB-0051: the free-control clock runs only while she is really in control and resets whenever anything owns the screen', () => {
  const { advanceFreeSeconds } = game;
  assert.equal(advanceFreeSeconds(0, 0.016, false), 0.016);
  assert.equal(advanceFreeSeconds(5, 0.5, false), 5.5);
  assert.equal(advanceFreeSeconds(5, 0.5, true), 0, 'a script, cutscene, dialog, door walk or overlay resets it');
  // a walk frame by frame: 2.5 s of walking, then a Mustafa-style script, then it has to be earned again
  let free = 0;
  let started = null;
  const frame = (busy, t) => { free = advanceFreeSeconds(free, 1 / 60, busy); if (started === null && momentDue(fresh(), 100, ctxFor('m1', { freeSeconds: free, blocked: busy }))) started = t; };
  for (let i = 0; i < 60 * 12; i++) frame(i < 60 * 2, i / 60); // 2 s of opening (busy), then free
  assert.ok(started >= 2 + 2.5 - 0.05 && started <= 2 + 2.5 + 0.1, `started ${started}s in: 2.5 s after control returned`);
  started = null;
  for (let i = 0; i < 60 * 5; i++) frame(false, i / 60); // already 10 s free: a fresh check starts at once
  assert.equal(started, 0);
  free = advanceFreeSeconds(free, 1 / 60, true); // a dialog opens
  assert.equal(free, 0);
  assert.equal(momentDue(fresh(), 100, ctxFor('m1', { freeSeconds: free })), null, 'reset: waits another 2.5 s');
  // the engine feeds it: reset by anything that owns the screen, on every new visit, passed to momentDue
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /this\.freeSeconds = 0;/);
  assert.match(world, /const busy = this\.transitioning \|\| this\.scriptRunner\.isRunning \|\| !ui0 \|\| !ui0\.tutorial \|\| ui0\.isBlocking\(\);\s*this\.freeSeconds = advanceFreeSeconds\(this\.freeSeconds, Math\.min\(delta, 250\) \/ 1000, busy\);/);
  assert.match(world, /freeSeconds: this\.freeSeconds,/);
});

test('FB-0051: from where the opening leaves her, the 2.5 s of free control are over before she even reaches M1\'s trigger (walking or running), so M1 starts as she enters it', () => {
  const rect = rectOf('m1');
  const gate = anchor('Gate 2 (Main Entrance)');
  const WALK = 5; // tiles per second (src/scenes/world.js WALK_SPEED 80 px/s)
  assert.match(read('src', 'scenes', 'world.js'), /const WALK_SPEED = 80;/);
  // where SCRIPTS.opening leaves her: the bus stop (4.75 tiles east, ~25 south of the gate) plus Mustafa's walk
  const start = { x: gate.x + 5.75, y: gate.y + 20.6 };
  const pathPoints = [start, { x: gate.x - 0.5, y: gate.y }, { x: gate.x - 0.5, y: gate.y - 25 }]; // through the gate, then straight up the avenue
  const at = (tiles) => {
    let left = tiles;
    for (let i = 0; i + 1 < pathPoints.length; i++) {
      const a = pathPoints[i];
      const b = pathPoints[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (left <= len) return { x: a.x + ((b.x - a.x) * left) / len, y: a.y + ((b.y - a.y) * left) / len };
      left -= len;
    }
    return pathPoints.at(-1);
  };
  // the time until her feet first enter the trigger (its southern edge), walking and running
  const southEdge = rect.y1 + 1; // tiles at y >= this are still outside
  let lo = 0;
  let hi = 200;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (at(m).y > southEdge) lo = m; else hi = m; }
  const entryTiles = hi;
  const inside = (q) => Math.floor(q.x) >= rect.x0 && Math.floor(q.x) <= rect.x1 && Math.floor(q.y) >= rect.y0 && Math.floor(q.y) <= rect.y1;
  assert.ok(inside(at(entryTiles + 0.01)), 'sanity: that point is inside the trigger');
  assert.ok(entryTiles / WALK >= MOMENTS[0].afterFreeS, `walking she enters it after ${(entryTiles / WALK).toFixed(1)} s, before the ${MOMENTS[0].afterFreeS} s are up`);
  assert.ok(entryTiles / 8.75 >= MOMENTS[0].afterFreeS, `running she enters it after ${(entryTiles / 8.75).toFixed(1)} s, before the ${MOMENTS[0].afterFreeS} s are up`);
  // the free clock at that moment is >= 2.5 s, so momentDue starts M1 on the very first frame inside
  const first = at(entryTiles + 0.01);
  assert.equal(momentDue(fresh(), 100, ctxFor('m1', { tileX: Math.floor(first.x), tileY: Math.floor(first.y), freeSeconds: entryTiles / 8.75 }))?.id, 'm1');
  // and while she is still south of the gate with only 2.5 s of control it is outside the trigger: it starts when she walks in
  const p = at(MOMENTS[0].afterFreeS * WALK);
  assert.ok(!inside(p) && p.y > gate.y, 'after 2.5 s at a walk she is still south of the gate');
  // and it never overlaps M2's area, so the two entrance moments cannot start from one spot
  const r2 = rectOf('m2');
  assert.ok(rect.y0 > r2.y1 || rect.x1 < r2.x0 || rect.x0 > r2.x1, 'the two triggers do not overlap');
});

test('FB-0051: the QA tools load every non-moment shot with moments off, and qa-shots has two flows that play the moments (moment-01-unicorn, moment-02-mevin)', () => {
  const shots = read('tools', 'qa-shots.js');
  const urls = [...shots.matchAll(/\$\{BASE_URL\}\/\?dev=0[^`]*/g)].map((m) => m[0]);
  assert.ok(urls.length >= 6, `found ${urls.length} URLs`);
  const withMoments = urls.filter((u) => !u.includes('moments=0'));
  assert.equal(withMoments.length, 1, `only the moments flow loads with moments on: ${withMoments}`);
  assert.match(withMoments[0], /map=campus&title=0&intro=0&save=0/);
  assert.match(shots, /async function shootMoments\(browser\)/);
  assert.match(shots, /\['moments \(unicorn, Mevin\)', shootMoments\]/);
  assert.match(shots, /shoot\(page, 'moment-01-unicorn'\)/);
  assert.match(shots, /shoot\(page, 'moment-02-mevin'\)/);
  assert.match(shots, /tryStep\(page, 'moment-01-unicorn'/);
  assert.match(shots, /tryStep\(page, 'moment-02-mevin'/);
  for (const m of shots.slice(shots.indexOf('async function shootMoments')).matchAll(/waitFor\(page, \w+, \{ timeout: (\d+) \}\)/g)) assert.ok(Number(m[1]) <= 25000, 'bounded waits');
  const intro = read('tools', 'qa-shots-intro.js');
  for (const url of intro.match(/\$\{BASE_URL\}\/\?dev=0[^`]*/g)) assert.ok(url.includes('moments=0'), url);
  assert.match(read('tools', 'qa-offline-play.js'), /moments=0/);
});

// ---------- always visible above the dialog box; no "E" prompt ----------

test('FB-0051: during every `say` of a moment, every actor and prop is at or above the camera\'s centre row and inside the picture (the dialog box covers the lower ~40% of the screen)', () => {
  // While a moment runs the letterbox bars are in, so the dialog box sits at hudLayout()'s letterboxed position (y 324 of the 540 px screen); the
  // camera centres on the player (or its pan target) at the screen's middle, so the box begins (324 - 270) / ZOOM px below the camera centre.
  const ZOOM = 3;
  const boxY = game.hudLayout(960, 540, undefined, { letterboxed: true }).dialogBox.y;
  assert.equal(boxY, 324);
  const boxTopBelowCentre = (boxY - 270) / ZOOM; // 18 world px
  const margin = 4; // keep a few px clear of the box
  const halfWidth = 960 / ZOOM / 2; // 160 world px
  for (const m of MOMENTS) {
    const here = mapOf(m.map);
    const rect = momentTriggerRect(m, here.anchor);
    let checked = 0;
    for (let ty = rect.y0; ty <= rect.y1; ty++) {
      for (let tx = rect.x0; tx <= rect.x1; tx++) {
        if (!here.walkable(tx, ty)) continue;
        const tl = momentTimeline(SCRIPTS[m.script], { anchor: here.anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
        assert.ok(tl.says.length >= 3 || m.id === 'm2', `${m.id}: the timeline records its lines`);
        for (const say of tl.says) {
          for (const a of say.actors) {
            const sheet = Object.values(MOMENT_SHEETS).find((s) => a.kind === 'image' && s.key === a.sheet);
            const feet = a.y + (sheet ? sheet.feet : 8); // the ground line: a character's feet are 8 px below its centre
            assert.ok(feet <= say.camY + boxTopBelowCentre - margin, `${m.id} with her at ${tx},${ty}: ${a.id}'s feet are ${Math.round(feet - say.camY)} px below the camera centre: behind the dialog box (limit ${boxTopBelowCentre - margin})`);
            assert.ok(Math.abs(a.x - say.camX) <= halfWidth - 16, `${m.id} with her at ${tx},${ty}: ${a.id} is off the side of the screen during a line`);
            assert.ok(a.y - say.camY >= -(270 / ZOOM) + 70 / ZOOM + 12, `${m.id}: ${a.id} is up under the letterbox bar`);
          }
          checked += say.actors.length;
        }
      }
    }
    assert.ok(checked > 0, `${m.id}: someone is on screen during a line`);
  }
  // sanity: the measurer sees Mevin and the kit standing to her right during his lines, and the unicorn and the prince during theirs
  const tl = momentTimeline(SCRIPTS.momentMevin, { anchor, player: { x: 225 * 16 + 8, y: 134 * 16 + 8 } });
  assert.deepEqual(plain(tl.says.map((s) => s.actors.map((a) => a.id).sort())), [['kit', 'mevin']]);
  assert.ok(tl.says[0].actors.every((a) => a.x > tl.player.x + 24 && a.x < tl.player.x + 72), 'Mevin and the kit are a few tiles to her right');
  const tu = momentTimeline(SCRIPTS.momentUnicorn, { anchor, player: { x: 244 * 16 + 8, y: 153 * 16 + 8 } });
  assert.deepEqual(plain(tu.says.map((s) => s.actors.map((a) => a.id).sort())), [['unicorn'], ['prince', 'unicorn'], []]);
});

test('FB-0051: the "E" interact prompt is hidden for the whole of any script (moments included) and WorldScene brings it back by itself afterwards', async () => {
  const { runner, scene } = makeRunner();
  const shown = [];
  scene.prompt = { visible: true, setVisible(v) { this.visible = v; shown.push(v); return this; } };
  const during = [];
  const running = runner.run([{ wait: 30 }, { unlockInput: true }, { wait: 30 }], { unskippable: true });
  assert.equal(scene.prompt.visible, false, 'hidden the moment the script starts');
  await new Promise((resolve) => setTimeout(resolve, 15));
  during.push(scene.prompt.visible);
  scene.prompt.visible = true; // something re-showed it mid-script (the script handed control back)
  await new Promise((resolve) => setTimeout(resolve, 30));
  during.push(scene.prompt.visible);
  await running;
  assert.deepEqual(during, [false, false], 'hidden while the script runs, and again when a script hands control back mid-way');
  // nothing forces it back on by hand: updatePrompt() sets its visibility every frame she is in control, so it returns right after
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /updatePrompt\(blocked, time\) \{\s*const found = blocked \? null : this\.nearestInteractable\(\);\s*this\.prompt\.setVisible\(Boolean\(found\)\);/);
  assert.match(read('src', 'scripts-runtime.js'), /this\.hidePrompt\(\); \/\/ no "E" bubble/);
  // a scene without a prompt (the unit fakes) is fine
  const other = makeRunner();
  await other.runner.run([{ wait: 1 }]);
});

// ---------- M3, Prof. Raja's chariot ----------

const foyer = () => mapOf('main-block-g');
const RAJA_TILE = { x: 26, y: 19 }; // his ambient entry's tile in the Main Block foyer

test('FB-0051: `after: { keys: N }` holds a moment back until she has N keys (counted from GameState.quest.keys, or ctx.keys); N = 1 for M3, so M2 and M3 are independent of each other', () => {
  const { momentKeysHeld } = game;
  const keys = (physicsLab, icl, room195) => ({ quest: { keys: { physicsLab, icl, room195 } } });
  assert.equal(momentKeysHeld(fresh(), {}), 0);
  assert.equal(momentKeysHeld({ seenMoments: new Set() }, {}), 0, 'a bare state has no quest: no keys');
  assert.equal(momentKeysHeld(fresh(keys(true, false, true)), {}), 2);
  assert.equal(momentKeysHeld(fresh(), { keys: 3 }), 3, 'ctx.keys wins');
  const m3 = (over = {}, state = fresh()) => momentDue(state, 1000, ctxFor('m3', over));
  assert.equal(m3({}), null, 'no key yet');
  assert.equal(m3({ keys: 0 }), null);
  assert.equal(m3({}, fresh(keys(false, false, false))), null);
  assert.equal(m3({ keys: 1 })?.id, 'm3', 'one key (ctx)');
  assert.equal(m3({}, fresh(keys(true, false, false)))?.id, 'm3', 'the first key (state)');
  assert.equal(m3({}, fresh(keys(false, true, false)))?.id, 'm3', 'any one key counts');
  assert.equal(m3({}, fresh(keys(true, true, true)))?.id, 'm3', 'all three keys: still due the first time');
  // a generic condition: N = 2 holds back one key, passes two (the three friends, M4, use this)
  const two = [{ id: 'mx', map: 'main-block-g', script: 'x', trigger: MOMENTS[2].trigger, after: { keys: 2 } }];
  assert.equal(momentDue(fresh(), 1000, ctxFor('m3', { moments: two, keys: 1 })), null);
  assert.equal(momentDue(fresh(), 1000, ctxFor('m3', { moments: two, keys: 2 }))?.id, 'mx');
  // it needs neither M1 nor M2 to have played (they are on the campus; she may reach the foyer first on an old save)
  assert.equal(m3({ keys: 1 }, fresh({ seenCutscenes: new Set() }))?.id, 'm3');
  // and the world feeds it the real count
  assert.match(read('src', 'scenes', 'world.js'), /keys: Object\.values\(GameState\.quest\.keys\)\.filter\(Boolean\)\.length,/);
});

test('FB-0051: M3 plays once only, only on the Main Block ground floor, only inside its hall trigger, never while anything is up, and keeps the default pacing (90 s, one per visit)', () => {
  const r = rectOf('m3');
  const keyed = (over = {}) => fresh({ quest: { keys: { physicsLab: true, icl: false, room195: false } }, ...over });
  assert.equal(momentDue(keyed(), 500, ctxFor('m3'))?.id, 'm3');
  assert.equal(momentDue(keyed(), 500, ctxFor('m3', { map: 'campus' })), null, 'never on another map');
  assert.equal(momentDue(keyed(), 500, ctxFor('m3', { map: 'main-block-1' })), null);
  for (const [tileX, tileY] of [[r.x0 - 1, r.y0 + 1], [r.x1 + 1, r.y0 + 1], [r.x0 + 2, r.y0 - 1], [r.x0 + 2, r.y1 + 1]]) {
    assert.equal(momentDue(keyed(), 500, ctxFor('m3', { tileX, tileY })), null, `outside the trigger at ${tileX},${tileY}`);
  }
  assert.equal(momentDue(keyed(), 500, ctxFor('m3', { blocked: true })), null, 'a dialog or script is up');
  assert.equal(momentDue(keyed(), 500, ctxFor('m3', { enabled: false })), null, '?moments=0');
  // once only, ever
  const played = keyed({ seenMoments: new Set(['m3']) });
  assert.equal(momentDue(played, 1e9, ctxFor('m3', { keys: 3 })), null);
  // the default gap and the per-visit cap
  const after = (now, over) => momentDue(keyed({ seenMoments: new Set(['m1', 'm2']), lastMomentAt: 200 }), now, ctxFor('m3', over));
  assert.equal(after(206, {}), null, 'not the 6 s of the entrance pair');
  assert.equal(after(289.9, {}), null);
  assert.equal(after(290, {})?.id, 'm3', '90 s after the last moment');
  assert.equal(after(5000, { visitCount: 1 }), null, 'never two on one map visit');
});

test('FB-0051: M3 plays in order: Raja\'s line, a gallop, the chariot arrives (a horn, dust), "My ride", he steps aboard, it leaves, her closing line; no line mentions a birthday', () => {
  const steps = plain(SCRIPTS.momentChariot);
  const flat = [];
  walkSteps(steps, (type, body) => flat.push({ type, body }), 'm3');
  const idx = (pred, from = 0) => flat.findIndex((s, i) => i >= from && pred(s));
  const spawnRaja = idx((s) => s.type === 'spawnActor' && s.body.id === 'raja');
  const line1 = idx((s) => s.type === 'say' && s.body.lines[0].startsWith('Ah, {name}!'));
  const rumble = idx((s) => s.type === 'sound' && s.body === 'chariotRumble');
  const spawnChariot = idx((s) => s.type === 'spawnActor' && s.body.id === 'chariot');
  const dustIn = idx((s) => s.type === 'sparkles' && s.body.kind === 'dust' && s.body.actor === 'chariot', spawnChariot);
  const horn = idx((s) => s.type === 'sound' && s.body === 'chariotHorn');
  const line2 = idx((s) => s.type === 'say' && s.body.lines[0].startsWith('My ride.'));
  const board = idx((s) => s.type === 'despawnActor' && s.body === 'raja');
  const ridden = idx((s) => s.type === 'loop' && s.body.frames.includes(MOMENT_SHEETS.chariot.frames.ridedA));
  const leave = idx((s) => s.type === 'move' && s.body.actor === 'chariot', ridden);
  const gone = idx((s) => s.type === 'despawnActor' && s.body === 'chariot');
  const closing = idx((s) => s.type === 'say' && s.body.speaker === '{name}');
  const order = [spawnRaja, line1, rumble, spawnChariot, dustIn, horn, line2, board, ridden, leave, gone, closing];
  assert.ok(order.every((i) => i >= 0), `a beat is missing: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'beats out of order');
  const says = flat.filter((s) => s.type === 'say').map((s) => s.body);
  assert.equal(says.length, 3);
  assert.deepEqual(says.map((s) => s.speaker), ['Prof. Raja', 'Prof. Raja', '{name}'], 'Raja keeps his ambient name tag');
  assert.deepEqual(says.map((s) => s.lines), [['Ah, {name}! Class is dismissed. A king never walks.'], ['My ride. Kindly mind the marks, {name}.'], ['Okay. Never mind. This is definitely BITS.']]);
  // the same sheet and look as the ambient Raja standing in the hall
  assert.equal(flat[spawnRaja].body.sprite, 'npc-prof-raja');
  assert.equal(AMBIENT['main-block-g'].find((e) => e.name === 'Prof. Raja').sheet, 'npc-prof-raja');
  // the chariot's two frame loops (empty cart, then Raja aboard) and its exit with dust AND sparkles
  const loops = flat.filter((s) => s.type === 'loop').map((s) => s.body.frames);
  assert.deepEqual(loops, [[0, 1], [2, 3]]);
  const exit = steps.find((s) => s.parallel && s.parallel.some((p) => p.move && p.move.actor === 'chariot') && s.parallel.some((p) => p.sparkles && p.sparkles.kind === 'dust') && s.parallel.some((p) => p.sparkles && !p.sparkles.kind));
  assert.ok(exit, 'it leaves in a cloud of dust and a trail of sparkles');
  for (const s of says) for (const line of s.lines) assert.doesNotMatch(line.toLowerCase(), /birthday|bday|b-day/);
});

test('FB-0051: M3 on the real foyer: it lasts 8-20 s, ends without a key press, Raja starts on his own ambient tile, and every ground spot of the arrival, the stop and the exit lane is open floor', () => {
  const here = foyer();
  const rect = rectOf('m3');
  const tl = momentTimeline(SCRIPTS.momentChariot, { anchor: here.anchor, player: { x: (rect.x0 + 2) * 16 + 8, y: (rect.y0 + 1) * 16 + 8 } });
  assert.deepEqual(plain(tl.unknownSteps), []);
  assert.equal(tl.needsInput, false);
  assert.ok(tl.durationMs >= MOMENT_MIN_MS && tl.durationMs <= MOMENT_MAX_MS, `${Math.round(tl.durationMs)} ms`);
  assert.ok(tl.durationMs >= 14000 && tl.durationMs <= 19000, `about 16 s (${Math.round(tl.durationMs)} ms)`);
  // Raja begins exactly where his ambient entry stands
  const ambientRaja = AMBIENT['main-block-g'].find((e) => e.name === 'Prof. Raja');
  assert.deepEqual([ambientRaja.x, ambientRaja.y], [RAJA_TILE.x, RAJA_TILE.y]);
  const rajaStart = tl.actors.raja.waypoints[0];
  assert.deepEqual([Math.floor(rajaStart.x / 16), Math.floor(rajaStart.y / 16)], [RAJA_TILE.x, RAJA_TILE.y]);
  // every straight stretch of the ground path (sampled every 4 px, the feet of whoever walks it) is open floor; the chariot's feet are 21 px below its centre
  const feet = { raja: 7, chariot: MOMENT_SHEETS.chariot.feet };
  for (const [id, a] of Object.entries(tl.actors)) {
    for (let i = 1; i < a.waypoints.length; i++) {
      const p = a.waypoints[i - 1];
      const q = a.waypoints[i];
      const n = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 4));
      for (let k = 0; k <= n; k++) {
        const x = Math.floor((p.x + ((q.x - p.x) * k) / n) / 16);
        const y = Math.floor((p.y + ((q.y - p.y) * k) / n + feet[id]) / 16);
        assert.ok(here.walkable(x, y), `${id}: its feet cross tile ${x},${y} (blocked) on the way to waypoint ${i}`);
      }
    }
  }
  // it comes from the north (the library lobby side) and leaves south: front view all the way
  const chariot = tl.actors.chariot.waypoints;
  assert.ok(chariot[0].y < chariot[1].y && chariot.at(-1).y > chariot[0].y + 8 * 16, 'it comes down the hall and leaves down it');
  assert.ok(chariot[0].y + 22 < tl.says[1].camY - 90, 'it starts above the top edge of the picture (off screen), so it really arrives');
  assert.ok(chariot.at(-1).y - 22 > tl.says[1].camY + 90, 'and ends below the bottom edge: out of the picture');
  // it stops beside Raja and clear of the stairs' block (x 13..18) and of the sofas (x 23..25)
  const stop = chariot[3];
  assert.ok(stop.x - 20 > 19 * 16 && stop.x + 20 < 23 * 16, `the stopped chariot spans ${stop.x - 20}..${stop.x + 20} px`);
  // she is never moved
  assert.equal(tl.player.waypoints.length, 1);
});

test('FB-0051: M3\'s trigger covers every way to the staircase, the LUG volunteer behind it, Raja\'s corner and the library door: she cannot get past the central hall without crossing it, and the stairs\' own arrival tile is inside it', () => {
  const here = foyer();
  const rect = rectOf('m3');
  const inRect = (x, y) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
  const spawn = here.objects.find((o) => o.type === 'spawn');
  const start = [Math.floor(spawn.x), Math.floor(spawn.y)];
  assert.ok(!inRect(...start), 'she arrives from the front doors, outside the trigger');
  const seen = new Set([start.join(',')]);
  const stack = [start];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !here.walkable(nx, ny) || inRect(nx, ny)) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  assert.ok(seen.size > 100, `sanity: the flood covers the lobby, the corridor and the wings (${seen.size} tiles)`);
  const stairs = here.anchor('Main Block Stairs G (up)');
  const places = {
    'the stairs': [[Math.floor(stairs.x), Math.floor(stairs.y)], [Math.floor(stairs.x) + 1, Math.floor(stairs.y)]],
    'the LUG volunteer': [[14, 16], [14, 17]],
    'Raja': [[RAJA_TILE.x, RAJA_TILE.y]],
    'the library door': [[19, 10], [20, 10]],
  };
  for (const [what, tiles] of Object.entries(places)) {
    for (const [x, y] of tiles) {
      if (!here.walkable(x, y)) continue; // a tile that is not floor is not a way anywhere
      assert.ok(!seen.has(`${x},${y}`), `${what}: tile ${x},${y} is reachable without crossing M3's trigger`);
    }
  }
  assert.ok(places['the stairs'].every(([x, y]) => inRect(x, y)));
  assert.ok(inRect(Math.floor(stairs.x), Math.floor(stairs.y) + 1), 'the tile in front of the stairs (where she steps off them) is inside');
  assert.ok(here.walkable(RAJA_TILE.x, RAJA_TILE.y) && !seen.has(`${RAJA_TILE.x},${RAJA_TILE.y}`), 'Raja\'s corner is only reachable through the trigger');
  // a modest area: the hall in front of the staircase, not the whole floor
  assert.ok((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1) <= 160);
});

test('FB-0051: during every line of M3 Raja and the chariot stand at or above the camera\'s centre row, well inside the picture; the camera is centred 2 rows below the figures', () => {
  const here = foyer();
  const rect = rectOf('m3');
  const tl = momentTimeline(SCRIPTS.momentChariot, { anchor: here.anchor, player: { x: (rect.x0 + 5) * 16 + 8, y: (rect.y0 + 3) * 16 + 8 } });
  assert.deepEqual(plain(tl.says.map((s) => s.actors.map((a) => a.id).sort())), [['raja'], ['chariot', 'raja'], []]);
  const pan = tl.says[0];
  assert.equal(pan.camY, 21 * 16 + 8, 'the camera is centred on tile row 21 (Raja stands on row 19)');
  assert.equal(pan.camX, 22 * 16 + 8);
  for (const say of tl.says.slice(0, 2)) {
    for (const a of say.actors) {
      const sheet = Object.values(MOMENT_SHEETS).find((s) => a.kind === 'image' && s.key === a.sheet);
      assert.ok(a.y + (sheet ? sheet.feet : 8) <= say.camY + 14, `${a.id} is behind the dialog box`);
    }
  }
  // the camera never needs to go past the map's edge: centred at least half a screen from every side
  assert.ok(pan.camX >= 160 && pan.camX <= here.json.width * 16 - 160 && pan.camY >= 90 && pan.camY <= here.json.height * 16 - 90);
});

test('FB-0051: Prof. Raja is an ordinary named ambient character until M3 (his lines still work), then gone for good: the entry carries unlessMoment "m3" and the ambient builder drops it once m3 is in seenMoments', () => {
  const { ambientEntriesFor } = game;
  const list = AMBIENT['main-block-g'];
  const raja = list.find((e) => e.id === 'mbg-amb-sit-1');
  assert.equal(raja.name, 'Prof. Raja');
  assert.equal(raja.unlessMoment, 'm3');
  assert.ok(MOMENTS.some((m) => m.id === raja.unlessMoment), 'the moment he leaves with exists');
  assert.match(raja.lines.join(' '), /ride coming/i, 'his ambient lines are unchanged and still hint at the ride');
  assert.ok(raja.lines.every((l) => l.length <= 160));
  // before: present; after: gone, everyone else stays; works for a Set or an array
  assert.ok(ambientEntriesFor(list, new Set()).some((e) => e.id === raja.id));
  assert.ok(ambientEntriesFor(list, new Set(['m1', 'm2'])).some((e) => e.id === raja.id), 'other moments do not take him');
  assert.ok(ambientEntriesFor(list, undefined).some((e) => e.id === raja.id));
  for (const seen of [new Set(['m3']), ['m1', 'm3']]) {
    const left = ambientEntriesFor(list, seen);
    assert.ok(!left.some((e) => e.id === raja.id), 'gone once m3 has played');
    assert.equal(left.length, list.length - 1, 'and nobody else is touched');
  }
  // only Raja carries the field
  const holders = Object.values(AMBIENT).flat().filter((e) => e.unlessMoment).map((e) => e.id);
  assert.deepEqual(holders, ['mbg-amb-sit-1']);
  // the engine: createAmbient() builds from ambientEntriesFor(), and a moment that starts retires its own people BEFORE the crowd is hidden
  const world = read('src', 'scenes', 'world.js');
  assert.match(world, /this\.ambientNpcs = ambientEntriesFor\(this\.def\.ambient, GameState\.seenMoments\)\.map\(/);
  const play = world.slice(world.indexOf('  playMoment(moment) {'), world.indexOf('  // The 3 key-room beats'));
  assert.ok(play.indexOf('this.retireAmbientFor(moment.id);') > 0 && play.indexOf('this.retireAmbientFor(moment.id);') < play.indexOf('this.setAmbientVisible(false);'));
  assert.match(world, /if \(ambient\.def\.unlessMoment !== momentId\) return true;/);
  assert.match(world, /ambient\.sprite\.disableBody\(true, true\)/);
  // a saved game that has m3 never builds him (seenMoments is saved), and a brand-new game gets him back
  const { GameState, snapshotState, applyState, resetGameState } = game;
  GameState.seenMoments = new Set(['m3']);
  const snap = plain(snapshotState(GameState));
  resetGameState();
  assert.equal(ambientEntriesFor(list, GameState.seenMoments).some((e) => e.id === raja.id), true, 'a brand-new game: he is back');
  applyState(GameState, snap);
  assert.equal(ambientEntriesFor(list, GameState.seenMoments).some((e) => e.id === raja.id), false, 'Continue: still gone');
  resetGameState();
});

test('FB-0051: the chariot sheet is 4 frames of 40x44, drawn (gold, maroon, saffron, the palomino horses), made by tools/make-moments.js and preloaded like the other moment sheets; Raja appears in the last two frames only', () => {
  const sheet = MOMENT_SHEETS.chariot;
  assert.equal(sheet.key, 'moment-chariot');
  assert.equal(sheet.file, 'assets/moment-chariot.png');
  assert.deepEqual([sheet.frameWidth, sheet.frameHeight, Object.keys(sheet.frames).length], [40, 44, 4]);
  assert.deepEqual(plain(sheet.frames), { trotA: 0, trotB: 1, ridedA: 2, ridedB: 3 });
  assert.equal(sheet.feet, 21, 'the hooves are on the frame\'s bottom row (centre 22, bottom pixel 43)');
  const img = png(sheet.file);
  assert.deepEqual([img.width, img.height], [160, 44]);
  const colorsIn = (f) => {
    const set = new Set();
    for (let y = 0; y < img.height; y++) {
      for (let x = f * 40; x < (f + 1) * 40; x++) {
        const i = (y * img.width + x) * 4;
        if (img.data[i + 3]) set.add(`#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join('')}`);
      }
    }
    return set;
  };
  for (const c of ['#e0b84f', '#8e1f3a', '#ff9933', '#e7b04a', '#fff4cf']) assert.ok(colorsIn(0).has(c), `the chariot lacks ${c}`);
  assert.ok(!colorsIn(0).has('#c9cbd6') && !colorsIn(1).has('#c9cbd6'), 'no rider in the empty-cart frames');
  assert.ok(colorsIn(2).has('#c9cbd6') && colorsIn(3).has('#c9cbd6'), 'Raja\'s grey hair is in the ridden frames');
  // everything stays inside the frame and the hooves reach the bottom row
  for (let f = 0; f < 4; f++) {
    let bottom = -1;
    for (let y = 0; y < 44; y++) for (let x = f * 40; x < (f + 1) * 40; x++) if (img.data[(y * img.width + x) * 4 + 3]) bottom = y;
    assert.ok(bottom === 43 || (f % 2 === 1 && bottom === 42), `frame ${f}: the hooves are on the bottom row (the B beat bobs one pixel up): ${bottom}`);
  }
  const tool = read('tools', 'make-moments.js');
  assert.match(tool, /const CHARIOT_W = 40;/);
  assert.match(tool, /const CHARIOT_H = 44;/);
  assert.equal(Number(tool.match(/const CHARIOT_FRAMES = (\d+);/)[1]), 4);
  assert.match(tool, /'moment-chariot\.png': buildChariotSheet\(\)/);
  assert.match(tool, /SpriteSheetBrown\.png/, 'the CC0 Ninja Adventure front-view horse');
  assert.match(read('CREDITS.md'), /moment-chariot\.png/, 'credited');
  // it is in the offline bundle (the generic sheet loop above already checks every MOMENT_SHEETS file) and preloaded by main.js through that table
  assert.ok(new Set(require('../../tools/pack-offline').collectRuntimeAssets().assets.map((a) => a.path)).has('assets/moment-chariot.png'));
});

test('FB-0051: the chariot sounds (a swelling gallop and a two-note horn) are registered, exist, are generated by tools/make-audio.js, are not clipped, and are in the offline bundle', () => {
  for (const id of ['chariotRumble', 'chariotHorn']) {
    assert.ok(SOUNDS[id], `SOUNDS.${id}`);
    assert.equal(SOUNDS[id].category, 'sfx');
    assert.equal(SOUNDS[id].loop, false);
    assert.ok(fs.existsSync(path.join(ROOT, SOUNDS[id].file)), `${SOUNDS[id].file} is missing (npm run audio)`);
    assert.match(read('tools', 'make-audio.js'), new RegExp(SOUNDS[id].file.replace('assets/audio/', '').replace(/\./g, '\\.')));
    const wav = fs.readFileSync(path.join(ROOT, SOUNDS[id].file));
    const n = (wav.length - 44) / 2;
    let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(wav.readInt16LE(44 + i * 2)) / 32767);
    assert.ok(peak > 0.2 && peak < 0.98, `${id}: peak ${peak.toFixed(2)}`);
    const seconds = n / wav.readUInt32LE(24);
    if (id === 'chariotRumble') assert.ok(seconds >= 2 && seconds <= 3, `the gallop runs ${seconds.toFixed(2)} s`);
    else assert.ok(seconds >= 0.5 && seconds <= 1.5, `the horn lasts ${seconds.toFixed(2)} s`);
  }
  const have = new Set(require('../../tools/pack-offline').collectRuntimeAssets().assets.map((a) => a.path));
  for (const id of ['chariotRumble', 'chariotHorn']) assert.ok(have.has(SOUNDS[id].file), `${SOUNDS[id].file} is not in the offline manifest`);
  // the script uses both
  const used = new Set(JSON.stringify(SCRIPTS.momentChariot).match(/"sound":"[A-Za-z]+"/g));
  assert.ok(used.has('"sound":"chariotRumble"') && used.has('"sound":"chariotHorn"'));
});

test('FB-0051: runner: `sparkles` with kind "dust" puffs soft beige ellipses at the actor\'s FEET (its ground line, not the lifted height), in front of it, and never stars', async () => {
  const { runner, made } = makeRunner();
  await runner.run([{ spawnActor: { id: 'c', sprite: 'moment-chariot', kind: 'image', frame: 0, feet: 21, shadow: false, at: { x: 10, y: 10 } } }]);
  const a = runner.actors.get('c');
  a.alt = 30; // lifted: dust still stays on the ground
  const before = made.filter((m) => m.ellipse).length;
  await runner.run([{ sparkles: { actor: 'c', ms: 80, every: 10, kind: 'dust' } }]);
  const puffs = made.filter((m) => m.ellipse).slice(before);
  assert.ok(puffs.length >= 6, `${puffs.length} puffs`);
  assert.equal(made.filter((m) => m.star).length, 0, 'no stars');
  const ground = a.sprite.y + 21;
  assert.ok(puffs.every((p) => p.y <= ground && p.y >= ground - 12), 'drawn at the hooves (and drifting up a few px as they fade)');
  assert.ok(puffs.every((p) => p.depth > a.sprite.depth), 'in front of the chariot');
  assert.match(runnerSource, /kind = 'stars'/);
});


// ---------- M4: Sana, Shraddha and Palak ----------

const keyed = (n, over = {}) => fresh({ quest: { keys: { physicsLab: n >= 1, icl: n >= 2, room195: n >= 3 } }, ...over });

test('FB-0051: M4 is in the table: the campus, the Main Block door, after the second key, default pacing, last in the order', () => {
  const m = momentOf('m4');
  assert.equal(MOMENTS.at(-1).id, 'm4');
  assert.equal(m.map, 'campus');
  assert.equal(m.script, 'momentFriends');
  assert.deepEqual(plain(m.after), { keys: 2 });
  assert.equal(m.minGapS, undefined);
  assert.equal(m.sameVisitOk, undefined);
  assert.equal(m.afterFreeS, undefined);
  assert.equal(momentGapS(m), MOMENT_GAP_S, 'the default 90 s gap');
  assert.equal(momentFitsVisit(m, 1), false, 'and one moment per map visit');
  assert.equal(m.trigger.anchor, 'Main Block entrance');
  assert.ok(Array.isArray(SCRIPTS.momentFriends));
});

test('FB-0051: M4 waits for the second key: no key or one key holds it back, two (any two) or three start it, once only, only inside its trigger on the campus, never while anything is up', () => {
  const due = (n, over = {}, state = keyed(n)) => momentDue(state, 1000, ctxFor('m4', over));
  assert.equal(due(0), null, 'no key');
  assert.equal(due(1), null, 'one key is not enough');
  assert.equal(due(2)?.id, 'm4', 'the second key');
  assert.equal(due(3)?.id, 'm4', 'all three: still due the first time');
  for (const quest of [{ physicsLab: false, icl: true, room195: true }, { physicsLab: true, icl: false, room195: true }]) {
    assert.equal(momentDue(fresh({ quest: { keys: quest } }), 1000, ctxFor('m4'))?.id, 'm4', 'any two keys count');
  }
  assert.equal(due(1, { keys: 2 })?.id, 'm4', 'ctx.keys wins');
  // once only, ever
  assert.equal(momentDue(keyed(3, { seenMoments: new Set(['m4']) }), 1e9, ctxFor('m4')), null);
  assert.equal(momentDue({ ...keyed(2), seenMoments: ['m4'] }, 1e9, ctxFor('m4')), null, 'an array works too');
  // where and when
  const r = rectOf('m4');
  for (const [tileX, tileY] of [[r.x0 - 1, r.y0 + 1], [r.x1 + 1, r.y0 + 1], [r.x0 + 2, r.y0 - 1], [r.x0 + 2, r.y1 + 1]]) {
    assert.equal(due(2, { tileX, tileY }), null, `outside the trigger at ${tileX},${tileY}`);
  }
  assert.equal(due(2, { map: 'main-block-g' }), null, 'never on another map');
  assert.equal(due(2, { blocked: true }), null);
  assert.equal(due(2, { enabled: false }), null, '?moments=0');
  // the default pacing: 90 s after the last moment (any moment), and never two on one map visit
  const after = (now, over) => momentDue(keyed(2, { seenMoments: new Set(['m1', 'm2', 'm3']), lastMomentAt: 300 }), now, ctxFor('m4', over));
  assert.equal(after(306, {}), null, 'not the 6 s of the entrance pair');
  assert.equal(after(389.9, {}), null);
  assert.equal(after(390, {})?.id, 'm4', '90 s after the last moment');
  assert.equal(after(5000, { visitCount: 1 }), null, 'never two on one map visit');
  // it needs neither M2 nor M3 to have played (an old save, or she skipped past them)
  assert.equal(momentDue(keyed(2, { seenMoments: new Set() }), 1000, ctxFor('m4'))?.id, 'm4');
});

test('FB-0051: M4 and M2 share the Main Block forecourt but cannot block each other: with both due, M2 goes first (table order), M4 comes on a later visit after the 90 s', () => {
  const state = keyed(2, { seenMoments: new Set(['m1']) });
  const r2 = rectOf('m2');
  const r4 = rectOf('m4');
  assert.ok(r4.x0 >= r2.x0 && r4.x1 <= r2.x1 && r4.y0 === r2.y0 && r4.y1 === r2.y1, 'M4 is a part of the M2 forecourt');
  const tile = { tileX: r4.x0 + 2, tileY: r4.y0 + 2 };
  assert.equal(momentDue(state, 1000, ctxFor('m2', tile))?.id, 'm2');
  markMomentStarted(state, 'm2', 1000);
  markMomentEnded(state, 1015);
  assert.equal(momentDue(state, 1020, ctxFor('m4', { ...tile, visitCount: 1 })), null, 'not on the same visit, not 5 s later');
  assert.equal(momentDue(state, 1090, ctxFor('m4', { ...tile, visitCount: 0 })), null, 'under 90 s after M2 ended');
  assert.equal(momentDue(state, 1105, ctxFor('m4', { ...tile, visitCount: 0 }))?.id, 'm4', 'a later visit, 90 s after M2 ended');
});

test('FB-0051: M4 plays in order: three friends walk in together, Sana, Shraddha, Palak, the canteen invitation, her answer, a kind tease, a wave, they leave; no line mentions a birthday', () => {
  const steps = plain(SCRIPTS.momentFriends);
  const flat = [];
  walkSteps(steps, (type, body) => flat.push({ type, body }), 'm4');
  const idx = (pred, from = 0) => flat.findIndex((s, i) => i >= from && pred(s));
  const spawns = flat.filter((s) => s.type === 'spawnActor').map((s) => [s.body.id, s.body.sprite]);
  assert.deepEqual(spawns, [['sana', 'npc-friend-sana'], ['shraddha', 'npc-friend-shraddha'], ['palak', 'npc-friend-palak']]);
  const arrive = idx((s) => s.type === 'move' && s.body.actor === 'sana');
  const first = idx((s) => s.type === 'say');
  const wave = idx((s) => s.type === 'emote' && s.body.actor === 'sana' && s.body.kind === 'heart');
  const leave = idx((s) => s.type === 'move' && s.body.actor === 'sana', wave);
  const gone = idx((s) => s.type === 'despawnActor');
  assert.ok(arrive >= 0 && arrive < first && first < wave && wave < leave && leave < gone, 'the beats are out of order');
  const says = flat.filter((s) => s.type === 'say').map((s) => s.body);
  assert.deepEqual(says.map((s) => s.speaker), ['Sana', 'Shraddha', 'Palak', '{name}', 'Sana']);
  assert.deepEqual(says.map((s) => s.lines), [
    ['{name}!'], ['There you are! We have been looking everywhere.'], ['Come to the canteen with us. We saved you a seat!'],
    ['Give me a few minutes, I still have a hunt to finish.'], ['Fine. But the chai will not wait forever.'],
  ]);
  for (const s of says) for (const line of s.lines) assert.doesNotMatch(line.toLowerCase(), /birthday|bday|b-day|party|surprise|cake/);
  // they wave: heart, heart, note
  assert.deepEqual(flat.filter((s) => s.type === 'emote' && s.body.actor !== 'player').map((s) => [s.body.actor, s.body.kind]), [['sana', 'heart'], ['shraddha', 'heart'], ['palak', 'note']]);
  // the three arrive together (one parallel step) and leave together, and every one is despawned
  assert.equal(steps.filter((s) => s.parallel && s.parallel.filter((p) => p.move).length === 3).length, 1, 'they walk in together');
  assert.equal(steps.filter((s) => s.parallel && s.parallel.filter((p) => p.sequence && JSON.stringify(p.sequence).includes('"move"')).length === 3).length, 1, 'and leave together');
  assert.deepEqual(flat.filter((s) => s.type === 'despawnActor').map((s) => s.body).sort(), ['palak', 'sana', 'shraddha']);
  // she is never moved
  assert.ok(!flat.some((s) => s.type === 'move' && s.body.actor === 'player'));
});

test('FB-0051: M4 on the real campus: 8-20 s (about 15 s) from every trigger tile, ends without a key press, every actor ends despawned, and every spot they walk on is open ground', () => {
  const here = mapOf('campus');
  const rect = rectOf('m4');
  let tiles = 0;
  let min = Infinity;
  let max = 0;
  for (let ty = rect.y0; ty <= rect.y1; ty++) {
    for (let tx = rect.x0; tx <= rect.x1; tx++) {
      if (!here.walkable(tx, ty)) continue;
      const tl = momentTimeline(SCRIPTS.momentFriends, { anchor: here.anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
      assert.deepEqual(plain(tl.unknownSteps), []);
      assert.equal(tl.needsInput, false);
      min = Math.min(min, tl.durationMs);
      max = Math.max(max, tl.durationMs);
      tiles++;
      assert.deepEqual(Object.keys(tl.actors).sort(), ['palak', 'sana', 'shraddha']);
      for (const [id, a] of Object.entries(tl.actors)) {
        assert.equal(a.despawned, true, `${id} is gone at the end`);
        for (const w of a.waypoints) assert.ok(here.walkable(Math.floor(w.x / 16), Math.floor((w.y + 7) / 16)), `${id} stands on a blocked tile (${w.x / 16},${w.y / 16}) with her at ${tx},${ty}`);
      }
      assert.equal(tl.player.waypoints.length, 1, 'she is never walked anywhere');
    }
  }
  assert.ok(tiles >= 40, `${tiles} walkable trigger tiles`);
  assert.ok(min >= 11000 && max <= 19500, `M4 lasts ${Math.round(min)}-${Math.round(max)} ms`);
  assert.ok(min >= MOMENT_MIN_MS && max <= MOMENT_MAX_MS);
});

test('FB-0051: M4: during every line the three stand in a row to her right, level with her or above, never behind the dialog box, never on top of her or each other, never off the screen', () => {
  const here = mapOf('campus');
  const rect = rectOf('m4');
  for (let ty = rect.y0; ty <= rect.y1; ty++) {
    for (let tx = rect.x0; tx <= rect.x1; tx++) {
      if (!here.walkable(tx, ty)) continue;
      const tl = momentTimeline(SCRIPTS.momentFriends, { anchor: here.anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
      assert.equal(tl.says.length, 5);
      for (const say of tl.says) {
        assert.deepEqual(plain(say.actors.map((a) => a.id).sort()), ['palak', 'sana', 'shraddha'], 'all three are on screen for every line');
        const xs = say.actors.map((a) => a.x).sort((a, b) => a - b);
        for (const a of say.actors) {
          assert.ok(a.y + 8 <= say.camY + 14, `${a.id} is behind the dialog box with her at ${tx},${ty}`);
          assert.ok(a.x > tl.player.x + 16 && a.x - tl.player.x <= 4 * 16 + 1, `${a.id} is not 2-4 tiles to her right`);
          assert.ok(Math.abs(a.x - say.camX) <= 160 - 16, `${a.id} is off the side of the screen`);
        }
        assert.ok(xs[1] - xs[0] >= 16 && xs[2] - xs[1] >= 16, 'a tile apart: nobody stands on anybody');
      }
    }
  }
  // Sana is the one beside her, then Shraddha, then Palak
  const tl = momentTimeline(SCRIPTS.momentFriends, { anchor, player: { x: 225 * 16 + 8, y: 133 * 16 + 8 } });
  const x = Object.fromEntries(tl.says[0].actors.map((a) => [a.id, a.x]));
  assert.ok(x.sana < x.shraddha && x.shraddha < x.palak);
});

test('FB-0051: M4\'s trigger: everyone coming out of the Main Block door arrives inside it (the tile in front of each doorway cell), and the forecourt is only reachable from the campus through it', () => {
  const rect = rectOf('m4');
  const door = campusObjects.find((o) => o.name === 'Main Block entrance');
  const cells = [Math.floor(door.x), Math.floor(door.x) + 1].map((x) => [x, Math.floor(door.y)]);
  const inRect = (x, y) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
  for (const [cx, cy] of cells) assert.ok(inRect(cx, cy + 1), `the arrival tile ${cx},${cy + 1} in front of the door is inside the trigger`);
  // flood from the spawn, never entering the trigger: the tile in front of the doorway is unreachable that way
  const spawn = campusObjects.find((o) => o.type === 'spawn');
  const start = [Math.floor(spawn.x), Math.floor(spawn.y)];
  const seen = new Set([start.join(',')]);
  const stack = [start];
  let touched = false;
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !walkable(nx, ny)) continue;
      if (inRect(nx, ny)) { touched = true; continue; } // stop at the trigger
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  assert.ok(touched, 'the walk from the spawn reaches the trigger');
  for (const [cx, cy] of cells) assert.ok(!seen.has(`${cx},${cy + 1}`), `the tile in front of the door (${cx},${cy + 1}) is not reachable without entering the trigger`);
  assert.ok((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1) <= 150, 'a modest area');
});

test('FB-0051: the three friends\' sheets (Sana, Shraddha, Palak) exist as 16x24 4-row character sheets, are preloaded and in the offline bundle, differ from everyone else in hair, skin and top, and are made by the generator', () => {
  const keys = ['npc-friend-sana', 'npc-friend-shraddha', 'npc-friend-palak'];
  const preload = new Map(characterSheets(MAPS, AMBIENT, SCRIPTS).map((s) => [s.key, s.file]));
  const have = new Set(require('../../tools/pack-offline').collectRuntimeAssets().assets.map((a) => a.path));
  const colorsOf = (key) => { const img = png(`assets/${key}.png`); const set = new Set(); for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) set.add(`#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join('')}`); return set; };
  const sig = (key) => Buffer.from(png(`assets/${key}.png`).data).toString('base64');
  const everyoneElse = fs.readdirSync(path.join(ROOT, 'assets')).filter((f) => /^npc-.*\.png$/.test(f) && !keys.includes(f.replace('.png', ''))).map((f) => f.replace('.png', ''));
  for (const key of keys) {
    assert.ok(preload.has(key), `${key} is not in the preload list`);
    assert.ok(have.has(`assets/${key}.png`), `${key} is not in the offline manifest`);
    const img = png(`assets/${key}.png`);
    assert.equal(img.height, 4 * 24);
    assert.equal(img.width, 8 * 16, 'idle, six walk frames, one idle-anim frame');
    for (const other of everyoneElse) assert.notEqual(sig(key), sig(other), `${key} looks exactly like ${other}`);
  }
  // hair, top, skirt and accessory colours: each has its own and the others lack them
  const own = {
    'npc-friend-sana': { top: '#f2b92c', skirt: '#4f7fc0', hair: '#7a4a2a', clip: '#ff9ccf' },
    'npc-friend-shraddha': { top: '#7a5ad9', skirt: '#2a2f4a', hair: '#2a2530', glasses: '#d9569a' },
    'npc-friend-palak': { top: '#e8604c', skirt: '#3a4a6a', hair: '#9a3f22', tote: '#2fb3a6' },
  };
  for (const [key, want] of Object.entries(own)) {
    const mine = colorsOf(key);
    for (const [what, hex] of Object.entries(want)) {
      assert.ok(mine.has(hex), `${key} lacks its ${what} (${hex})`);
      for (const other of keys.filter((k) => k !== key)) assert.ok(!colorsOf(other).has(hex), `${other} shares ${key}'s ${what}`);
    }
  }
  // distinct from the lead (a pink top) and from the women professors
  for (const other of ['npc-prof-angel', 'npc-prof-elakkiya']) {
    for (const key of keys) assert.ok(!colorsOf(other).has(own[key].top), `${key}'s top is also ${other}'s`);
  }
  // skin: Shraddha's is deeper than Sana's, which is deeper than Palak's pack default
  assert.ok(colorsOf('npc-friend-shraddha').has('#c4885c') && colorsOf('npc-friend-sana').has('#dc9b78') && !colorsOf('npc-friend-palak').has('#dc9b78'));
  // the accessories: the flower clip and the glasses facing us, the tote bag in her hand
  const px = (key, x, y) => { const img = png(`assets/${key}.png`); const i = (y * img.width + x) * 4; return img.data[i + 3] ? `#${[0, 1, 2].map((k) => img.data[i + k].toString(16).padStart(2, '0')).join('')}` : null; };
  assert.equal(px('npc-friend-sana', 3, 3), '#ff9ccf', 'the clip, facing us');
  assert.equal(px('npc-friend-shraddha', 4, 11), '#d9569a', 'the glasses, facing us');
  assert.equal(px('npc-friend-palak', 13, 20), '#2fb3a6', 'the tote bag in her hand, facing us');
  const tool = read('tools', 'make-assets.js');
  assert.match(tool, /for \(const \[id, look\] of Object\.entries\(FRIEND_WOMEN\)\) write\(`npc-\$\{id\}\.png`, buildProfWoman\(look\)\)/);
  for (const name of ['sana', 'shraddha', 'palak']) assert.match(tool, new RegExp(`'friend-${name}': \\{ hair:`));
  // they are script actors only: nobody stands on a map (the ambient roster still has no Sana, Shraddha or Palak)
  for (const list of Object.values(AMBIENT)) for (const e of list) assert.ok(!/^(Sana|Shraddha|Palak)$/.test(e.name || ''), `${e.name} is an ambient NPC`);
});
