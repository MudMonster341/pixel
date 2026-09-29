// In-world cutscene scripts (ADR 0016, decisions/0016-cutscenes-play-in-the-game-world.md): content,
// not engine (docs/ARCHITECTURE.md) -- src/scripts-runtime.js ScriptRunner is the only code that knows
// how to run a step; this file only describes *what happens*. Replaces the old letterboxed-static-
// illustration cutscenes (src/cutscenes.js CUTSCENES, still around for anything not yet migrated, see
// that file's own header) for the two the owner actually complained about (FB-0032): the Gate 2
// welcome and the Main Block entrance. Both are still triggered exactly the way they always were (the
// same Tiled `cutscene` trigger objects, play-once via GameState.seenCutscenes, src/scenes/world.js
// checkCutscene()) -- src/scenes/ui.js's onCutsceneRequested just prefers SCRIPTS over CUTSCENES when
// a key exists in both, so nothing about *when* these fire changed, only what they look like.
//
// Every line below is either reused verbatim from the old static cutscenes (flagged inline) or a new,
// short, functional line written for this task (also flagged, per CLAUDE.md "don't invent the story" --
// listed in the task's own report for the owner to approve/edit) -- nothing here invents plot beyond
// docs/STORY.md.

// ---------- the Gate 2 welcome, "Mustafa meets her" (docs/plans/2026-09-26-premium-pass.md stage 6) ----------
// Content only, no lockInput/letterbox/unlockInput of its own: SCRIPTS.gate2 (the walk-up-to-the-
// trigger path, `?intro=0`/an old save) and SCRIPTS.opening (the full M3a chain, bus included) each
// wrap this core in their own single letterboxed shot, so the two paths that can reach it -- meeting
// him fresh off the bus, or just walking up to the same spot under her own steam -- both read as one
// continuous scene, never two back-to-back cuts.
//
// Mustafa stays (never despawns): a friendly, decorative presence standing near the gate once control
// returns -- he isn't wired up as a real, talk-to-again map NPC yet (no dialog data, ADR 0016 scope),
// just a script actor left idling where the scene put him, so the world doesn't feel like he vanished
// the instant she's on her own.
//
// Every point below is relative to wherever the player actually is *right now* (`{ actor: 'player',
// offset }`), not a fixed map coordinate: this plays after a scripted bus stop (which already placed
// her at the 'spawn' anchor) just as readily as it plays from a live walk-in a few tiles further along
// the same approach (the fast path) -- ADR 0016's own "a later map change doesn't break the script"
// concern, taken one step further (a few tiles of *player* variance doesn't break it either).
const MUSTAFA_MEETS_HER_CORE = [
  { spawnActor: { id: 'mustafa', sprite: 'npc-mustafa', at: { actor: 'player', offset: [0, -5] }, facing: 'down' } },
  { move: { actor: 'mustafa', path: [{ actor: 'player', offset: [0, -2] }], speed: 4 } },
  { face: { actor: 'player', dir: 'up' } },
  { emote: { actor: 'mustafa', kind: '!' } },
  // Line 1 reused verbatim from the old gate2 cutscene (src/cutscenes.js); line 2 is NEW (short,
  // functional -- "get moving" -- per this task's own brief for onboarding lines).
  { say: { speaker: 'Mustafa', lines: ['Welcome to BITS Pilani, Dubai Campus!', "Right this way — let's get you started."] } },
  { parallel: [
    { move: { actor: 'mustafa', path: [{ actor: 'mustafa', offset: [-1, -5] }], speed: 3.5 } },
    { move: { actor: 'player', path: [{ actor: 'player', offset: [1, -5] }], speed: 3.5 } },
  ] },
  { face: { actor: 'mustafa', dir: 'up' } },
  { face: { actor: 'player', dir: 'up' } },
  { cameraPan: { to: 'Main Block entrance', ms: 1600 } },
  { wait: 250 },
  // NEW line (the brief's own suggested wording for this exact beat).
  { say: { speaker: 'Mustafa', lines: ['The LUG stall is inside the Main Block — behind the staircase.'] } },
  { face: { actor: 'mustafa', dir: 'down' } },
  { cameraPan: { to: { actor: 'player' }, ms: 1200 } },
  { cameraFollow: 'player' },
];

// The full M3a opening's own bus arrival (docs/STORY.md "Opening" step 4): a real bus sprite drives in
// along the real Gate 2 approach, stops, she steps off (revealed for the first time -- world.js hides
// the real player sprite until this exact moment, see playOpeningSequence()), the bus pulls away. Every
// point is relative to the 'gate' anchor (the real Gate 2 object, tools/campus/build-campus.js),
// offsets in tiles, "+y" being further out along the approach (away from campus) per that generator's
// own coordinate sense.
const BUS_STEPS = [
  { setActorVisible: { actor: 'player', visible: false } },
  { cameraPan: { to: { anchor: 'Gate 2 (Main Entrance)', offset: [0, 2] }, ms: 10 } }, // settle on the gate before she'd otherwise be framed
  { spawnActor: { id: 'bus', sprite: 'bus', kind: 'image', at: { anchor: 'Gate 2 (Main Entrance)', offset: [0, 9] }, facing: 'up' } },
  { move: { actor: 'bus', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [0, 3] }], speed: 6, ease: 'Cubic.easeOut' } },
  { wait: 400 },
  { placeActor: { actor: 'player', at: { anchor: 'Gate 2 (Main Entrance)', offset: [1, 3] }, facing: 'down' } },
  { setActorVisible: { actor: 'player', visible: true } },
  { move: { actor: 'player', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [0, 2] }], speed: 3 } },
  { wait: 250 },
  // Quality loop (Cutscenes run 1): the bus is drawn nose-up (tools/make-cutscenes.js buildBus());
  // turning to 'down' before pulling away flips it vertically so it still reads nose-first while
  // driving back out, not backwards (src/scripts-runtime.js step_face()).
  { face: { actor: 'bus', dir: 'down' } },
  { move: { actor: 'bus', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [0, 10] }], speed: 7, ease: 'Cubic.easeIn' } },
  { despawnActor: 'bus' },
];

// The Main Block entrance beat (docs/STORY.md beat 3), replacing the static illustration
// (src/cutscenes.js CUTSCENES.entrance): its one line is reused verbatim -- no new dialogue.
const ENTRANCE_STEPS = [
  { lockInput: true },
  { letterbox: 'in' },
  { cameraPan: { to: 'Main Block entrance', ms: 1400 } },
  { wait: 300 },
  { say: { speaker: null, lines: ['The Main Block: steps, pillars, and a glass front under a red arch.'] } },
  { cameraPan: { to: { actor: 'player' }, ms: 1000 } },
  { cameraFollow: 'player' },
  { letterbox: 'out' },
  { unlockInput: true },
];

// The three key-room beats (docs/STORY.md beat 8, "each room gets its own small cutscene when she
// walks in"): the camera pans from wherever she is (the door, since world.js only fires this the
// moment she comes within range of the desk, i.e. just past the door) to the key station itself, which
// glints, then one short, functional line names the room -- kept deliberately plain (CLAUDE.md "don't
// invent the story"), listed for the owner in this task's own report.
function keyRoomSteps(keyStationId, line) {
  return [
    { lockInput: true },
    { letterbox: 'in' },
    { cameraPan: { to: { keyStation: keyStationId }, ms: 1000 } },
    { emote: { actor: keyStationId, kind: 'sparkle' } },
    { wait: 200 },
    { say: { speaker: null, lines: [line] } },
    { cameraFollow: 'player' },
    { letterbox: 'out' },
    { unlockInput: true },
  ];
}

const SCRIPTS = {
  // The fast path: `?intro=0`, an old save, or simply walking up to the same spot -- the existing
  // 'Gate 2 entrance' Tiled trigger (unchanged) fires this exactly like it always fired the old gate2
  // cutscene (src/scenes/world.js checkCutscene()).
  gate2: [
    { lockInput: true },
    { letterbox: 'in' },
    ...MUSTAFA_MEETS_HER_CORE,
    { letterbox: 'out' },
    { unlockInput: true },
  ],
  // The full M3a opening (src/scenes/world.js playOpeningSequence(), started right after CustomizeScene
  // hands off to 'boot' with `{ playOpening: true }`): one continuous letterboxed shot, bus through to
  // Mustafa walking her up the avenue -- never two separate cuts for what's really one scene.
  opening: [
    { lockInput: true },
    { letterbox: 'in' },
    ...BUS_STEPS,
    ...MUSTAFA_MEETS_HER_CORE,
    { letterbox: 'out' },
    { unlockInput: true },
  ],
  entrance: ENTRANCE_STEPS,
  keyRoomPhysicsLab: keyRoomSteps('physicsLab', 'The Physics Lab.'),
  keyRoomIcvl: keyRoomSteps('icvl', 'The ICVL — the computing lab.'),
  keyRoomRoom195: keyRoomSteps('room195', 'Room 195.'),
};
