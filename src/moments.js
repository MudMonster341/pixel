// The small unskippable "moments" (docs/plans/2026-10-04-moments-and-small-touches.md, ADR 0021): short scenes tied to a person or a
// joke Taru will recognise (the unicorn and the prince, Mevin the drummer, ...) that play while she walks around. They are in-world
// scripts (src/scripts.js SCRIPTS, run by src/scripts-runtime.js like the Gate 2 welcome and the RTA bus); what lives HERE is only the
// pacing: data (MOMENTS) and pure logic (momentDue), so the rules are unit-tested without a browser (tests/unit/moments.test.js).
//
// The owner's rules (decided 2026-10-04, final):
//  - Every moment plays ONCE only, ever (never after Continue or a replay; a brand-new save plays them again).
//  - Unskippable, but never a trap: input is locked while it runs, it always ends by itself in 8-20 s (every line auto-advances).
//  - Spaced: at most one moment per MOMENT_GAP_S seconds of play and never two on the same map visit; a moment that is not
//    due yet is not lost, it simply waits for its next trigger. EXCEPTION, the entrance pair: M1 (the gate avenue) and M2 (the
//    forecourt) are meant to chain as she first walks in, a few seconds apart, so M2 carries per-moment overrides (`minGapS`: its own
//    short gap after M1 ENDS, and `sameVisitOk`) instead of the defaults. Every later moment (the chariot, the three friends ...)
//    uses the defaults: 90 s apart, one per map visit.
//  - Never while a dialog, mini-game, key-room script, the pause menu or any overlay is up (re-checked every frame), and never
//    during the opening / the bus sequence (a script is running then).
//  - The name on screen is the player's (`{name}`, default "Taru").
//
// Time is the PLAY clock (GameState.playSeconds, seconds the world scene has actually run), not wall-clock time, so a reload, a
// mini-game or a minute away from the keyboard does not count as spacing. `state` is GameState (or anything with the same fields):
//   seenMoments: Set of moment ids, lastMomentAt: play-clock seconds of the last moment (null = none yet), seenCutscenes: Set.

const MOMENT_GAP_S = 90; // at most one moment per this many seconds of play (start to start, every moment)
const MOMENT_PER_VISIT = 1; // ...and at most this many on one visit of a map (one WorldScene instance: a warp starts a new visit)
const MOMENT_MIN_MS = 8000; // every moment lasts between these (tests/unit/moments.test.js measures the real scripts)
const MOMENT_MAX_MS = 20000;

// In the order she meets them. `trigger` is a rectangle of tiles on `map`, written as offsets from the tile of a named map object
// (so a regenerated campus that moves the gate or the door moves the trigger with it, ADR 0016): tile (anchor + [dx, dy]), the
// rectangle spans dx0..dx1 x dy0..dy1 inclusive. `after`: { moments: ['m1'] } must have played; { cutscene: 'gate2' } must have been
// seen (the Gate 2 welcome / opening, src/scenes/world.js); { keys: N } she must hold at least N of the three keys (M3, the chariot, N = 1);
// { keyIds: ['physicsLab'] } she must hold THESE keys (ids as in state.quest.keys: physicsLab, icl, room195; she may play the games in any
// order, so a moment tied to one key's place names that key, M4, the three friends, the Physics Lab key; M5, Prof. Angel, the ICL key). The trigger rectangle may be on any map: it is resolved with that map's own anchors. Overrides of the global rules, for a moment that is meant to chain right
// after another: `minGapS` REPLACES MOMENT_GAP_S (seconds of play since the last moment ENDED), `sameVisitOk: true` lets it start on a
// map visit that already had a moment (MOMENT_PER_VISIT). `afterFreeS`: she must have had that many seconds of FREE control (not inside
// a script, cutscene, dialog, door walk or any overlay: ctx.freeSeconds) since the last of those ended, so a moment never starts the
// instant control comes back (M1 waits 2.5 s after the opening/Mustafa welcome: she gets control and takes a few steps first). Leave all of them
// out and the defaults apply.
const MOMENTS = [
  {
    id: 'm1',
    name: 'The unicorn and the prince',
    map: 'campus',
    script: 'momentUnicorn', // SCRIPTS key (src/scripts.js)
    // The whole gate avenue from just inside Gate 2 up to the road in front of the forecourt, across the avenue and the lawn edges
    // (x 232..250, y 138..153 on the real campus): she meets it walking from the bus stop up toward the Main Block, wherever she is
    // once her 2.5 s of free control are up (she is still south of the gate then, so it starts as she walks in through the gate and
    // up the avenue; the camera pans to the unicorn from wherever she stands). It ends 1 row short of M2's area (y 129..137), so the
    // two never overlap.
    trigger: { anchor: 'Gate 2 (Main Entrance)', dx0: -13, dx1: 5, dy0: -19, dy1: -4 },
    after: { cutscene: 'gate2' },
    afterFreeS: 2.5, // not the instant the opening / Mustafa's welcome hands control back
  },
  {
    id: 'm2',
    name: 'Mevin the drummer',
    map: 'campus',
    script: 'momentMevin',
    // Everything in front of the Main Block door (x 219..230, y 129..137 on the real campus): the steps, the brick forecourt and the
    // pavement beside it. Every walkable tile next to the door lies inside it, so she cannot reach the door without crossing it
    // (tests/unit/moments.test.js floods the real map to prove it). If she crosses it before the gap is over she is still standing in
    // it when it is (the first-time entrance beat at the steps holds her there for several seconds), and it starts on the first free frame.
    trigger: { anchor: 'Main Block entrance', dx0: -6, dx1: 5, dy0: 1, dy1: 9 }, // dx1 5: Mevin stands 3 tiles to her right, and the palm at x234 must stay clear
    after: { moments: ['m1'] },
    minGapS: 6, // chains after M1: about 6 s after M1 ENDS (the walk from the gate takes a few seconds more)
    sameVisitOk: true, // the owner wants both as she first enters the campus: one visit, M1 then M2
  },
  {
    id: 'm3',
    name: "Prof. Raja's chariot",
    map: 'main-block-g',
    script: 'momentChariot',
    // The central hall in front of the staircase and along its right side (x 12..28, y 22..29 on the real ground floor): every way to the
    // stairs and to the LUG stall behind them crosses it, and so does the arrival from the stairs when she comes back down
    // (tests/unit/moments.test.js floods the real map). Prof. Raja himself stands a few tiles north-east of it, at (26,19).
    trigger: { anchor: 'Main Block Stairs G (up)', dx0: -3, dx1: 13, dy0: -3, dy1: 4 },
    after: { keys: 1 }, // once she holds the first key; default pacing (90 s gap, one per map visit)
    // (the ambient Prof. Raja entry in src/ambient.js carries `unlessMoment: 'm3'`: once this has played he is gone for good)
  },
  {
    id: 'm4',
    name: 'Sana, Shraddha and Palak',
    map: 'main-block-3',
    script: 'momentFriends',
    // The 3rd-floor corridor just outside the Physics Lab (x 5..20, y 19..20 on the real map; the owner, 2026-10-05: "the friends can
    // meet Taru after the Physics Lab on the third floor"). The anchor is the lab's own area object (its tile is 12,10). The corridor is
    // three rows tall (y 18..20) but row 18 is a row of benches and plants with a blocked tile at x 5, 8, 11, 14, 17, 20 ..., so every walk
    // along the corridor, from the stairs to the lab door and back, crosses rows 19..20 at one of those columns: the rectangle is a full
    // cut across the corridor (tests/unit/moments.test.js floods the real map). She steps out of the door onto (12,18) and into the
    // rectangle on her next step. The friends stand level with her on rows 19..20, never on the cluttered row 18.
    trigger: { anchor: 'Physics Lab', dx0: -7, dx1: 8, dy0: 9, dy1: 10 },
    after: { keyIds: ['physicsLab'] }, // once she holds the Physics Lab key (not just any key); default pacing (90 s gap, one per map visit)
  },
  {
    id: 'm5',
    name: 'Prof. Angel',
    map: 'main-block-1',
    script: 'momentAngel',
    // FB-0099: the ICL lab, on her way out with the key. The anchor is the sealed hatch (tile 9,14); the rectangle is x 4..15, y 11..12: the two rows
    // in front of the hatch, between the core console (6,10) and the door. Row 11 is open across the whole lab and row 12 is the only way down to the
    // lane in front of the hatch (row 13, x 8..11), so every walk from the console to the door crosses it (tests/unit/fb-0099-angel.test.js floods the
    // real map). Angel comes in through the hatch and stops in that lane (row 13), so she never stands on the console, Alice's pad or the hatch.
    trigger: { anchor: 'ICL door', dx0: -5, dx1: 6, dy0: -3, dy1: -2 },
    after: { keyIds: ['icl'] }, // once she holds the ICL key (she took it from the console, or Alice handed it over): as she is about to leave the lab
    // FB-0099 follow-up (2026-10-10, the owner played the packaged game and never saw her): the 90 s gap and the one-per-visit cap could hold it back
    // (an earlier moment, M4, started less than 90 s of play before), and she may never cross the rectangle again. So a short gap and no visit cap.
    // The console's own pickup tile (6,11) is inside the rectangle, so it starts on the first free frame after the key dialog and its toast.
    minGapS: 15,
    sameVisitOk: true,
    afterFreeS: 0.6, // not the very frame the key dialog closes (the toast is still sliding in): she takes a step or two first, still inside the rectangle
  },
];

// `?moments=0` (dev and tests, tests/e2e/helpers.js sets it for every spec) turns every moment off, and so does `?cutscene=0` (a moment
// is a cutscene to the tests that skip them), and so does `GameState.momentsDisabled` (a dev switch, never saved). `search` is
// injectable, the same pattern as cutscenesEnabled() in src/maplogic.js.
function momentsEnabled(search, state) {
  const qs = new URLSearchParams(search ?? (typeof location === 'undefined' ? '' : location.search));
  if (qs.get('moments') === '0' || qs.get('cutscene') === '0') return false;
  const gameState = state ?? (typeof GameState === 'undefined' ? null : GameState);
  return !(gameState && gameState.momentsDisabled);
}

// The effective minimum play-clock gap before this moment may start, in seconds: its own `minGapS` if it has one (an override for a
// moment that chains after another), otherwise the global MOMENT_GAP_S.
function momentGapS(moment) {
  return typeof moment.minGapS === 'number' ? moment.minGapS : MOMENT_GAP_S;
}

// Whether `visitCount` moments already started on this visit leave room for this one (`sameVisitOk` ignores the per-visit cap).
function momentFitsVisit(moment, visitCount) {
  return Boolean(moment.sameVisitOk) || (visitCount || 0) < MOMENT_PER_VISIT;
}

// A moment's trigger rectangle as inclusive tile bounds { x0, y0, x1, y1 }, or null if its anchor is not on the map.
// `anchor(name)` -> { x, y } | null is the map object's own centre in tile units (src/maplogic.js resolveAnchor()).
function momentTriggerRect(moment, anchor) {
  const point = anchor(moment.trigger.anchor);
  if (!point) return null;
  const tx = Math.floor(point.x);
  const ty = Math.floor(point.y);
  const t = moment.trigger;
  return { x0: tx + t.dx0, y0: ty + t.dy0, x1: tx + t.dx1, y1: ty + t.dy1 };
}

// How many of the three keys she holds: ctx.keys (a caller that already counted, tests) or counted from state.quest.keys
// ({ physicsLab, icl, room195 }: booleans); none when the state has no quest (a bare test state).
function momentKeysHeld(state, ctx) {
  if (ctx && typeof ctx.keys === 'number') return ctx.keys;
  return state.quest && state.quest.keys ? Object.values(state.quest.keys).filter(Boolean).length : 0;
}

// Whether she holds every key in `ids` (state.quest.keys: { physicsLab, icl, room195 } booleans); false for a bare test state with no quest.
function momentKeyIdsHeld(state, ids) {
  const keys = state.quest && state.quest.keys;
  return Boolean(keys) && ids.every((id) => Boolean(keys[id]));
}

// Which moment, if any, should start right now. Pure: everything it needs is passed in.
//   state: see the header. now: the play clock, in seconds.
//   ctx: { map, tileX, tileY (the player's feet tile), enabled (momentsEnabled()), blocked (a dialog, mini-game, key-room script, any
//          script, a door/warp walk, the pause menu, the journal or the map is up: anything that owns the screen), visitCount (moments
//          already started on this map visit), freeSeconds (seconds of free control since the last script / cutscene / dialog / door walk /
//          overlay ended or started: src/scenes/world.js; left out = not tracked, so no `afterFreeS` holds anything back),
//          keys? (how many of the three keys she holds; left out = counted from state.quest.keys), anchor(name) -> { x, y } | null,
//          moments? (a table to use instead of MOMENTS: tests) }
function momentDue(state, now, ctx) {
  if (!ctx.enabled || ctx.blocked) return null;
  const seen = state.seenMoments && typeof state.seenMoments.has === 'function' ? state.seenMoments : new Set(state.seenMoments || []);
  for (const moment of ctx.moments || MOMENTS) {
    if (seen.has(moment.id) || moment.map !== ctx.map) continue;
    if (!momentFitsVisit(moment, ctx.visitCount)) continue;
    if (moment.afterFreeS && ctx.freeSeconds !== undefined && ctx.freeSeconds < moment.afterFreeS) continue;
    if (state.lastMomentAt != null && now - state.lastMomentAt < momentGapS(moment)) continue;
    const after = moment.after || {};
    if ((after.moments || []).some((id) => !seen.has(id))) continue;
    if (after.cutscene && !(state.seenCutscenes && state.seenCutscenes.has(after.cutscene))) continue;
    if (after.keys && momentKeysHeld(state, ctx) < after.keys) continue;
    if (after.keyIds && !momentKeyIdsHeld(state, after.keyIds)) continue;
    const rect = momentTriggerRect(moment, ctx.anchor);
    if (!rect) continue;
    if (ctx.tileX < rect.x0 || ctx.tileX > rect.x1 || ctx.tileY < rect.y0 || ctx.tileY > rect.y1) continue;
    return moment;
  }
  return null;
}

// The free-control counter (WorldScene keeps one, `freeSeconds`, advanced every frame with this): seconds she has been in control
// without anything owning the screen. Anything owning it (`busy`: a script, cutscene, dialog, door walk, pause menu, journal, map) resets it.
function advanceFreeSeconds(previous, dtSeconds, busy) {
  return busy ? 0 : previous + dtSeconds;
}

// Bookkeeping: a moment counts as played the instant it STARTS (a reload mid-scene never replays it), and the spacing clock is
// stamped when it starts and again when it ends (so the gap is measured from the end of the scene).
function markMomentStarted(state, id, now) {
  if (!state.seenMoments || typeof state.seenMoments.add !== 'function') state.seenMoments = new Set(state.seenMoments || []);
  state.seenMoments.add(id);
  state.lastMomentAt = now;
}

function markMomentEnded(state, now) {
  state.lastMomentAt = now;
}

// ---------- measuring a moment's script (unit tests and anyone tuning one: no Phaser) ----------
// What each step costs at the runtime's own speeds (src/scripts-runtime.js). The constants below mirror the runtime and
// src/scenes/ui.js; tests/unit/moments.test.js keeps them equal to the sources.
const MOMENT_TIMING = {
  letterboxMs: 350, // ui.js SCRIPT_LETTERBOX_SLIDE_MS
  charsPerSecond: 45, // ui.js CHARS_PER_SECOND (the dialog's typewriter)
  emoteMs: 900 + 200, // scripts-runtime.js step_emote: holds 900 ms (700 for 'sparkle'), then fades for 200
  sparkleEmoteMs: 700 + 200,
  defaultPanMs: 1200,
  defaultSpeed: 5, // tiles per second for a `move` without `speed`
  minMoveMs: 60,
  tile: 16,
};

// Plays a script on paper. env: { anchor(name) -> { x, y } | null (tile units, as resolveAnchor), player: { x, y } (her sprite centre in
// pixels), isWalkable?(tx, ty) }. Returns { durationMs, needsInput (a `say` without autoMs waits for a key), actors: { id: { sheet,
// visible, despawned, x, y (pixels), alt (px), waypoints: [{ x, y, alt, tMs }] } }, player: { x, y, waypoints }, unknownSteps,
// says: [{ tMs, camX, camY (pixels: where the camera is centred: on her unless a cameraPan moved it), actors: [{ id, sheet, kind, x, y, alt }]
// (everyone on screen and visible at that moment) }] -- one per `say` step, so a test can check what is visible above the dialog box }.
// Positions follow the runtime exactly: a point is tile units, spawn/move turn it into pixels with toPixel() (tile * 16 + 8), and a point
// relative to an actor starts from the actor's pixel position divided by 16.
function momentTimeline(steps, env) {
  const T = MOMENT_TIMING.tile;
  const toPixel = (tile) => tile * T + T / 2;
  const actors = {};
  const player = { x: env.player.x, y: env.player.y, alt: 0, waypoints: [{ x: env.player.x, y: env.player.y, alt: 0, tMs: 0 }] };
  const unknown = [];
  const says = [];
  let needsInput = false;
  let camPan = null; // null = the camera follows her; else the { x, y } pixel it was panned to (and stays at until cameraFollow)
  const get = (id) => (id === 'player' ? player : actors[id]);

  const resolve = (point) => {
    if (point == null) return null;
    if (typeof point === 'string') return env.anchor(point);
    if (typeof point.x === 'number' && typeof point.y === 'number') return { x: point.x, y: point.y };
    let base = null;
    if (point.anchor) base = env.anchor(point.anchor);
    else if (point.actor) { const a = get(point.actor); if (a) base = { x: a.x / T, y: a.y / T }; }
    if (!base) return null;
    return point.offset ? { x: base.x + point.offset[0], y: base.y + point.offset[1] } : base;
  };

  const sayMs = (body) => {
    let ms = 0;
    for (const line of body.lines || []) {
      ms += (line.length / MOMENT_TIMING.charsPerSecond) * 1000;
      if (typeof body.autoMs === 'number') ms += body.autoMs; else needsInput = true;
    }
    return ms;
  };

  // Runs one step starting at `t`; returns how long it takes.
  const run = (step, t) => {
    const type = Object.keys(step)[0];
    const body = step[type];
    switch (type) {
      case 'lockInput': case 'unlockInput': case 'sound': case 'setFlag': case 'frame': case 'loop':
      case 'setActorVisible': case 'face':
        if (type === 'setActorVisible' && get(body.actor)) get(body.actor).visible = body.visible;
        return 0;
      case 'cameraFollow': camPan = null; return 0;
      case 'letterbox': return MOMENT_TIMING.letterboxMs;
      case 'fade': return body.ms ?? 250;
      case 'cameraPan': {
        const p = resolve(body.to);
        if (p) camPan = { x: toPixel(p.x), y: toPixel(p.y) };
        return body.ms ?? MOMENT_TIMING.defaultPanMs;
      }
      case 'wait': return body;
      case 'anim': return (body.frames || []).length * (body.frameMs ?? 120);
      case 'emote': return body.kind === 'sparkle' ? MOMENT_TIMING.sparkleEmoteMs : MOMENT_TIMING.emoteMs;
      case 'say': {
        says.push({
          tMs: t,
          camX: camPan ? camPan.x : player.x,
          camY: camPan ? camPan.y : player.y,
          actors: Object.entries(actors).filter(([, a]) => !a.despawned && a.visible).map(([id, a]) => ({ id, sheet: a.sheet, kind: a.kind, x: a.x, y: a.y, alt: a.alt })),
        });
        return sayMs(body);
      }
      case 'sparkles': return body.ms;
      case 'lift': {
        const a = get(body.actor);
        if (a) { a.alt = body.to; a.waypoints.push({ x: a.x, y: a.y, alt: a.alt, tMs: t + body.ms }); }
        return body.ms;
      }
      case 'spawnActor': {
        const p = resolve(body.at);
        if (!p) { unknown.push(`spawnActor ${body.id}: unresolved point`); return 0; }
        const x = toPixel(p.x);
        const y = toPixel(p.y);
        actors[body.id] = { sheet: body.sprite, kind: body.kind || 'character', visible: true, despawned: false, x, y, alt: 0, waypoints: [{ x, y, alt: 0, tMs: t }] };
        return 0;
      }
      case 'despawnActor': if (actors[body]) actors[body].despawned = true; return 0;
      case 'placeActor': {
        const a = get(body.actor);
        const p = resolve(body.at);
        if (a && p) { a.x = toPixel(p.x); a.y = toPixel(p.y); a.waypoints.push({ x: a.x, y: a.y, alt: a.alt, tMs: t }); }
        return 0;
      }
      case 'move': {
        const a = get(body.actor);
        if (!a) { unknown.push(`move: no actor ${body.actor}`); return 0; }
        const speed = Math.max(0.1, body.speed ?? MOMENT_TIMING.defaultSpeed);
        let ms = 0;
        for (const raw of body.path || []) {
          const p = resolve(raw);
          if (!p) { unknown.push(`move ${body.actor}: unresolved point`); continue; }
          const x = toPixel(p.x);
          const y = toPixel(p.y);
          ms += Math.max(MOMENT_TIMING.minMoveMs, (Math.hypot(x - a.x, y - a.y) / T / speed) * 1000);
          a.x = x; a.y = y;
          a.waypoints.push({ x, y, alt: a.alt, tMs: t + ms });
        }
        return ms;
      }
      case 'sequence': {
        let ms = 0;
        for (const s of body) ms += run(s, t + ms);
        return ms;
      }
      case 'parallel': {
        // Every branch starts from the same place at the same time; a position change in one branch is visible to the next
        // (the runtime resolves relative points when each branch starts, which is the same instant), so run them in order.
        let ms = 0;
        for (const s of body) ms = Math.max(ms, run(s, t));
        return ms;
      }
      default: unknown.push(type); return 0;
    }
  };

  let total = 0;
  for (const step of steps) total += run(step, total);
  return { durationMs: total, needsInput, actors, player, unknownSteps: unknown, says };
}
