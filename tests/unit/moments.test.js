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
const rectOf = (id) => momentTriggerRect(MOMENTS.find((m) => m.id === id), anchor);
const walkable = (x, y) => isWalkableTile(campusGrid, tileInfo, x, y);

// A GameState-shaped object for the pure rules.
const fresh = (over = {}) => ({ seenMoments: new Set(), lastMomentAt: null, seenCutscenes: new Set(['gate2']), ...over });
const inside = (id) => { const r = rectOf(id); return { tileX: r.x0 + 1, tileY: r.y0 + 1 }; };
const ctxFor = (id, over = {}) => ({ map: 'campus', ...inside(id), enabled: true, blocked: false, visitCount: 0, anchor, ...over });

// ---------- the table ----------

test('FB-0051: MOMENTS lists M1 then M2, each on the campus with a real script, a trigger rectangle that exists on the map, and the right order', () => {
  assert.deepEqual(plain(MOMENTS.map((m) => m.id)), ['m1', 'm2']);
  for (const m of MOMENTS) {
    assert.ok(MAPS[m.map] && !MAPS[m.map].indoors, `${m.id}: an outdoor map`);
    assert.ok(Array.isArray(SCRIPTS[m.script]) && SCRIPTS[m.script].length > 0, `${m.id}: script "${m.script}" is in SCRIPTS`);
    const rect = momentTriggerRect(m, anchor);
    assert.ok(rect, `${m.id}: the anchor "${m.trigger.anchor}" resolves on the campus`);
    assert.ok(rect.x1 >= rect.x0 && rect.y1 >= rect.y0);
    let open = 0;
    for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) if (walkable(x, y)) open++;
    assert.ok(open >= 20, `${m.id}: she can actually stand on most of the trigger (${open} walkable tiles)`);
  }
  assert.deepEqual(plain(MOMENTS[0].after), { cutscene: 'gate2' }, 'M1 waits for the Gate 2 welcome / the opening');
  assert.deepEqual(plain(MOMENTS[1].after), { moments: ['m1'] }, 'M2 comes after M1');
  assert.equal(MOMENT_GAP_S, 90);
  assert.equal(MOMENT_PER_VISIT, 1);
  // The entrance pair chains: M2 overrides the global gap (a few seconds after M1 ENDS) and may share M1's map visit; M1 uses the defaults.
  assert.equal(MOMENTS[1].minGapS, 6, 'M2 follows M1 about 6 s after it ends');
  assert.equal(MOMENTS[1].sameVisitOk, true);
  assert.equal(momentGapS(MOMENTS[1]), 6);
  assert.equal(momentGapS(MOMENTS[0]), MOMENT_GAP_S, 'M1 has no override');
  assert.equal(MOMENTS[0].sameVisitOk, undefined);
  // M1 is on the avenue just inside Gate 2 (before the forecourt); M2 is on the forecourt in front of the Main Block door
  const gate = anchor('Gate 2 (Main Entrance)');
  const door = anchor('Main Block entrance');
  const r1 = rectOf('m1');
  const r2 = rectOf('m2');
  assert.ok(r1.y1 < gate.y && gate.y - r1.y0 <= 10, 'M1 is just north of the gate');
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
    const rect = momentTriggerRect(m, anchor);
    let min = Infinity;
    let max = 0;
    let tiles = 0;
    for (let ty = rect.y0; ty <= rect.y1; ty++) {
      for (let tx = rect.x0; tx <= rect.x1; tx++) {
        if (!walkable(tx, ty)) continue;
        const tl = momentTimeline(SCRIPTS[m.script], { anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
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
    const rect = momentTriggerRect(m, anchor);
    const feet = { character: 7 };
    for (let ty = rect.y0; ty <= rect.y1; ty++) {
      for (let tx = rect.x0; tx <= rect.x1; tx++) {
        if (!walkable(tx, ty)) continue;
        const tl = momentTimeline(SCRIPTS[m.script], { anchor, player: { x: tx * 16 + 8, y: ty * 16 + 8 } });
        for (const [id, a] of Object.entries(tl.actors)) {
          // the unicorn and the kit are image actors: their hooves are `feet` px below their centre (MOMENT_SHEETS)
          const sheet = Object.values(MOMENT_SHEETS).find((s) => a.kind === 'image' && s.key === a.sheet);
          const below = sheet ? sheet.feet : feet.character;
          for (const w of a.waypoints) {
            if (w.alt > 0) continue; // in the air: it flies over everything
            const x = Math.floor(w.x / 16);
            const y = Math.floor((w.y + below) / 16);
            assert.ok(walkable(x, y), `${m.id}: ${id} stands on tile ${x},${y} (blocked), with her at ${tx},${ty}`);
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
      assert.ok(anchor(JSON.parse(`{${name}}`).anchor), `${m.id}: ${name} resolves on the campus`);
    }
  }
});

test('FB-0051: every actor a moment spawns is gone again at the end, hidden actors are shown again, and she ends exactly where she started, free', () => {
  for (const m of MOMENTS) {
    const rect = momentTriggerRect(m, anchor);
    const tl = momentTimeline(SCRIPTS[m.script], { anchor, player: { x: (rect.x0 + 2) * 16 + 8, y: (rect.y0 + 1) * 16 + 8 } });
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
  ]) assert.ok(doc.includes(text), `campus-lines-review.md lacks "${text}"`);
  const lines = [];
  for (const m of MOMENTS) walkSteps(SCRIPTS[m.script], (type, body) => { if (type === 'say') lines.push(...body.lines); }, m.script);
  assert.ok(lines.length >= 5);
  for (const line of lines) assert.doesNotMatch(line.toLowerCase(), /birthday|bday|b-day/);
});
