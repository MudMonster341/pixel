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
// Quality loop (Cutscenes run 2): "Mustafa should face her while talking, and she should face him" --
// explicit `face` steps right before every `say`, rather than relying on incidental leftover facing
// from whichever `move` happened to run last (fragile: the first `say` already happened to work this
// way purely because he walked toward her, but the second one didn't -- both walked the same
// direction together and were left facing forward, side by side, not at each other).
const MUSTAFA_MEETS_HER_CORE = [
  { spawnActor: { id: 'mustafa', sprite: 'npc-mustafa', at: { actor: 'player', offset: [0, -5] }, facing: 'down' } },
  { move: { actor: 'mustafa', path: [{ actor: 'player', offset: [0, -2] }], speed: 4 } },
  { face: { actor: 'mustafa', dir: 'down' } }, // he's now north of her -- face her
  { face: { actor: 'player', dir: 'up' } }, // she faces him back
  { emote: { actor: 'mustafa', kind: '!' } },
  // Line 1 reused verbatim from the old gate2 cutscene (src/cutscenes.js); line 2 is NEW (short,
  // functional -- "get moving" -- per this task's own brief for onboarding lines).
  { say: { speaker: 'Mustafa', lines: ['Welcome to BITS Pilani, Dubai Campus!', "Right this way — let's get you started."] } },
  { parallel: [
    { move: { actor: 'mustafa', path: [{ actor: 'mustafa', offset: [-1, -5] }], speed: 3.5 } },
    { move: { actor: 'player', path: [{ actor: 'player', offset: [1, -5] }], speed: 3.5 } },
  ] },
  // They're side by side now, mustafa 2 tiles to her left -- face each other again before he speaks.
  { face: { actor: 'mustafa', dir: 'right' } },
  { face: { actor: 'player', dir: 'left' } },
  { cameraPan: { to: 'Main Block entrance', ms: 1600 } },
  { wait: 250 },
  // NEW line (the brief's own suggested wording for this exact beat).
  { say: { speaker: 'Mustafa', lines: ['The LUG stall is inside the Main Block — behind the staircase.'] } },
  { cameraPan: { to: { actor: 'player' }, ms: 1200 } },
  { cameraFollow: 'player' },
];

// The RTA (Dubai) bus's spritesheet (docs/STORY.md "Amendments from the birthday sprint"): one row of
// 104x48 frames drawn by tools/make-cutscenes.js (buildBusSheet(), assets/cutscenes/rta-bus-sheet.png),
// loaded by BootScene as a spritesheet under `key` (src/main.js). Content, not engine: a script plays
// frames by these names/indexes through its `frame` and `anim` steps (src/scripts-runtime.js).
// tests/unit/rta-bus.test.js keeps these numbers equal to what the generator draws.
const RTA_BUS_SHEET = {
  key: 'rta-bus',
  file: 'assets/cutscenes/rta-bus-sheet.png',
  frameWidth: 104,
  frameHeight: 48,
  frames: { closed: 0, halfOpen: 1, open: 2, closing: 3, driving: 4 },
};
const BUS_FRAME = RTA_BUS_SHEET.frames;

// The full M3a opening's own bus arrival (docs/STORY.md "Opening" step 4, amended by the birthday sprint:
// the bus is an RTA bus): it drives in along the road outside Gate 2, stops at the kerb, opens its doors,
// she steps out (revealed for the first time -- world.js hides the real player sprite until this exact
// moment, see playOpeningSequence()), the doors close, the bus pulls away off-screen.
// Every point is relative to the 'gate' anchor (the real Gate 2 object, tools/campus/build-campus.js),
// offsets in tiles, "+y" being further out (south, away from campus) per that generator's own coordinate
// sense. Real geometry (assets/maps/campus.json, tests/unit/rta-bus.test.js re-checks it): Gate 2's avenue
// runs north-south and meets an east-west road 18-22 tiles south of the gate (asphalt rows y+18..y+22, the
// road running east and west of the avenue's mouth), with open sand south of it. FB-0044/FB-0049: the Dubai RTA bus
// stop is a lay-by on that road's south side (layout.gate2.busStop): two rows of carriageway added south of the
// road, with a shelter, a stop sign and a bin on the pavement behind it. Dubai drives on the right, so an eastbound
// bus is in the south lane with its right (door) side towards the camera, and the sprite is drawn that way (front
// to the right). It enters from off-screen left along the south lane (BUS_LANE_Y), glides into the bay (BUS_STOP_Y,
// its wheels on the bay's second row) and, when the doors have closed, glides back out into the lane and away off-
// screen right.
// The bus's centre door sits on the sprite's centre column, so BUS_STOP_X is also where she steps out.
// Her step-out is kept clear of the bus on purpose (Quality loop, Cutscenes run 2: "she is invisible after
// stepping off the bus" was a depth-sort bug plus a walk back behind the bus): she appears at the sill with
// her feet just below the bus's own ground line (`feet` below), so she always sorts in front of it, then
// walks south onto the pavement beside the shelter and never back across the bus.
const BUS_LANE_Y = 20.55; // tiles south of the gate: the bus's centre row in the road's south lane (wheels on the lane)
const BUS_STOP_Y = 23.0; // ...and in the bay (wheels on the bay's second row)
const BUS_STOP_X = 4.75; // tiles east of the gate: the stop (its centre door is at the sprite's centre)
const BUS_STEPS = [
  { setActorVisible: { actor: 'player', visible: false } },
  // Frame the stop: the road's west end at the left edge, the pavement below the bus in view.
  { cameraPan: { to: { anchor: 'Gate 2 (Main Entrance)', offset: [6, 22.4] }, ms: 10 } },
  { spawnActor: { id: 'bus', sprite: RTA_BUS_SHEET.key, kind: 'image', frame: BUS_FRAME.driving, shadow: false, feet: 19, at: { anchor: 'Gate 2 (Main Entrance)', offset: [-8, BUS_LANE_Y] }, facing: 'right' } },
  { move: { actor: 'bus', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [BUS_STOP_X - 6.5, BUS_LANE_Y] }], speed: 4.5 } }, // along the lane...
  { move: { actor: 'bus', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [BUS_STOP_X, BUS_STOP_Y] }], speed: 3, ease: 'Sine.easeOut' } }, // ...and into the bay
  { frame: { actor: 'bus', frame: BUS_FRAME.closed } }, // stopped: the brake lights come on
  { wait: 500 },
  { sound: 'doorOpen' },
  { anim: { actor: 'bus', frames: [BUS_FRAME.halfOpen, BUS_FRAME.open], frameMs: 130 } },
  { wait: 450 },
  // She steps out of the centre door and walks onto the pavement behind the bay, beside the shelter.
  { placeActor: { actor: 'player', at: { anchor: 'Gate 2 (Main Entrance)', offset: [BUS_STOP_X, BUS_STOP_Y + 1] }, facing: 'down' } },
  { setActorVisible: { actor: 'player', visible: true } },
  { wait: 150 },
  { move: { actor: 'player', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [BUS_STOP_X, BUS_STOP_Y + 2.6] }], speed: 2.5 } },
  { face: { actor: 'player', dir: 'right' } }, // turns to watch the bus go
  { wait: 400 },
  { sound: 'doorOpen' },
  { anim: { actor: 'bus', frames: [BUS_FRAME.closing, BUS_FRAME.closed], frameMs: 130 } },
  { wait: 350 },
  { frame: { actor: 'bus', frame: BUS_FRAME.driving } },
  { move: { actor: 'bus', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [BUS_STOP_X + 5, BUS_LANE_Y] }], speed: 3, ease: 'Sine.easeIn' } }, // out of the bay into the lane...
  { move: { actor: 'bus', path: [{ anchor: 'Gate 2 (Main Entrance)', offset: [20, BUS_LANE_Y] }], speed: 6, ease: 'Sine.easeIn' } }, // ...and away
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

// ---------- the moments (src/moments.js: the pacing; docs/plans/2026-10-04-moments-and-small-touches.md: the design) ----------
// Three small unskippable scenes. They play through the same in-world runner as everything above, started by src/scenes/world.js
// checkMoment() with `unskippable`, and every line has `autoMs` so they always end by themselves (8-20 s, measured by
// tests/unit/moments.test.js). Nobody is moved except the actors a moment spawns: she is never walked anywhere, so a moment can never
// leave her in a wall. Every actor a moment spawns is despawned again before it ends.
//
// The three prop sheets (drawn by tools/make-moments.js; layouts mirrored here and checked against the committed PNGs):
const MOMENT_SHEETS = {
  // 32x32 frames. The unicorn: a generic white horse with a horn and a pastel mane. 0 and 1 are the grazing head-bob.
  unicorn: {
    key: 'moment-unicorn',
    file: 'assets/moment-unicorn.png',
    frameWidth: 32,
    frameHeight: 32,
    frames: { grazeA: 0, grazeB: 1, headUp: 2, ridden: 3, flyRidden: 4, flyEmpty: 5 },
    feet: 15, // px below the frame's centre where the hooves stand
  },
  // 28x22 frames. Mevin's drum kit: which part was just hit.
  drums: {
    key: 'moment-drums',
    file: 'assets/moment-drums.png',
    frameWidth: 28,
    frameHeight: 22,
    frames: { idle: 0, snare: 1, kick: 2, crash: 3, snareCrash: 4 },
    feet: 11,
  },
  // 40x44 frames. Prof. Raja's chariot, seen from the FRONT (it rolls down the hall toward the camera and away again): two gilded horses, a
  // maroon-and-gold cart with a royal parasol and two pennants. 0 and 1 are the two trot beats (the horses bob, the wheels turn, the
  // pennants flap); 2 and 3 are the same with Prof. Raja seated in the cart.
  chariot: {
    key: 'moment-chariot',
    file: 'assets/moment-chariot.png',
    frameWidth: 40,
    frameHeight: 44,
    frames: { trotA: 0, trotB: 1, ridedA: 2, ridedB: 3 },
    feet: 21, // px below the frame's centre where the hooves stand
  },
};
const UNICORN = MOMENT_SHEETS.unicorn.frames;
const DRUMS = MOMENT_SHEETS.drums.frames;
const CHARIOT = MOMENT_SHEETS.chariot.frames;

// Points. A named anchor's centre is tile + 0.5 and spawn/move add another half tile when they turn a point into pixels
// (scripts-runtime.js toPixel), so these helpers take WHOLE-TILE offsets and compensate: gateTile(9, -6) is exactly the centre of the
// tile 9 east and 6 north of Gate 2's own tile, and playerTile(-2, 0) the centre of the tile two to the left of the tile she stands on.
const gateTile = (dx, dy) => ({ anchor: 'Gate 2 (Main Entrance)', offset: [dx - 0.5, dy - 0.5] });
const doorTile = (dx, dy) => ({ anchor: 'Main Block entrance', offset: [dx - 0.5, dy - 0.5] });
const stairsTile = (dx, dy) => ({ anchor: 'Main Block Stairs G (up)', offset: [dx - 0.5, dy - 0.5] }); // the Main Block foyer's staircase (tile 15,25)
const playerTile = (dx, dy) => ({ actor: 'player', offset: [dx - 0.5, dy - 0.5] });

// M1, the unicorn and the prince (the owner's own inside joke, her line EXACTLY as written). Just inside Gate 2: a unicorn grazes on the
// east lawn (tile 9 east of the gate, hooves on the row 5 north of it); she stops and reacts; a crowned prince walks in from the right,
// says his line, mounts, and the unicorn lifts off in a trail of sparkles (its shadow stays on the lawn) and leaves over the top of the
// screen. She says her closing line and is free, exactly where she stood. About 16 s.
const MOMENT_UNICORN_STEPS = [
  { lockInput: true },
  { letterbox: 'in' },
  { spawnActor: { id: 'unicorn', sprite: MOMENT_SHEETS.unicorn.key, kind: 'image', frame: UNICORN.grazeA, feet: MOMENT_SHEETS.unicorn.feet, shadowSize: [22, 6], at: gateTile(9, -6), facing: 'right' } },
  { loop: { actor: 'unicorn', frames: [UNICORN.grazeA, UNICORN.grazeB], frameMs: 450 } },
  // She stops, turns to it, "!", and the camera glides over to the lawn (wherever along the avenue she was).
  { parallel: [
    { face: { actor: 'player', toward: 'unicorn' } },
    { emote: { actor: 'player', kind: '!' } },
    { cameraPan: { to: gateTile(11, -5), ms: 1000 } },
  ] },
  { say: { speaker: '{name}', lines: ["WOAH, WHAT? I'm not drunk yet, so why is a unicorn here?"], autoMs: 1600 } },
  // The prince comes in from the right (off screen), the unicorn lifts its head to watch him.
  { spawnActor: { id: 'prince', sprite: 'npc-prince', at: gateTile(23, -5), facing: 'left' } },
  { frame: { actor: 'unicorn', frame: UNICORN.headUp } },
  { move: { actor: 'prince', path: [gateTile(13, -5)], speed: 5.5 } },
  { say: { speaker: 'Prince', lines: ["Don't mind me. I'm always watching."], autoMs: 1400 } },
  { move: { actor: 'prince', path: [gateTile(10, -5)], speed: 3 } },
  // He mounts: he is gone from the lawn and sits on its back.
  { despawnActor: 'prince' },
  { sound: 'minigameLineClear' }, // the rising chime (the same one the tower climb uses for a new floor): magic
  { frame: { actor: 'unicorn', frame: UNICORN.ridden } },
  { wait: 450 },
  { frame: { actor: 'unicorn', frame: UNICORN.flyRidden } },
  { parallel: [
    { lift: { actor: 'unicorn', to: 150, ms: 2400, ease: 'Quad.easeIn', fadeOut: true } },
    { sparkles: { actor: 'unicorn', ms: 2400 } },
    { move: { actor: 'unicorn', path: [gateTile(17, -12)], speed: 4.2, ease: 'Quad.easeIn' } },
  ] },
  { despawnActor: 'unicorn' },
  { cameraPan: { to: { actor: 'player' }, ms: 900 } },
  { say: { speaker: '{name}', lines: ['Huh... is this the actual BITS?'], autoMs: 1500 } },
  { cameraFollow: 'player' },
  { letterbox: 'out' },
  { unlockInput: true },
];

// One hit of the kit: the sound and the matching frame, held a beat, then back to rest (280 ms a hit, so a bar of eight is 2.24 s).
const drumHit = (sound, frame) => [
  { sound },
  { frame: { actor: 'kit', frame } },
  { wait: 130 },
  { frame: { actor: 'kit', frame: DRUMS.idle } },
  { wait: 150 },
];
const DRUM_BAR = [
  ...drumHit('drumKick', DRUMS.kick), ...drumHit('drumSnare', DRUMS.snare), ...drumHit('drumKick', DRUMS.kick), ...drumHit('drumKick', DRUMS.kick),
  ...drumHit('drumSnare', DRUMS.snare), ...drumHit('drumKick', DRUMS.kick), ...drumHit('drumSnare', DRUMS.snare), ...drumHit('drumCrash', DRUMS.crash),
];
// A jump: up and back down (two altitude steps).
const jump = (actor, px = 14) => [{ lift: { actor, to: px, ms: 180, ease: 'Quad.easeOut' } }, { lift: { actor, to: 0, ms: 180, ease: 'Quad.easeIn' } }];

// M2, Mevin the drummer (a friend; he plays the drums for Treble, the music club; he is not in the Main Block). In front of the Main Block
// (the trigger is x 219..230, y 129..137: the steps, the forecourt and the pavement): he runs in from the east along the road verge with a
// little drum kit and a snare roll, jumps beside her, shouts, drums a bar while she grins (a note, a heart), ends on a rimshot and runs
// off with the kit. Everything is placed relative to the tile she stands on: he stands 3 tiles to her RIGHT, half a tile above her row,
// with the kit just in front of him (so he drums behind it), never lower than her own feet -- the dialog box covers the bottom ~40% of the
// screen while she is centred, so anything below her row would be hidden behind it while he speaks (tests/unit/moments.test.js checks
// every `say`). He runs in along the road verge (the one row of tiles open from the east, off screen), then up onto her row. About 14-17 s.
const MOMENT_MEVIN_STEPS = [
  { lockInput: true },
  { letterbox: 'in' },
  { spawnActor: { id: 'mevin', sprite: 'npc-friend-mevin', at: doorTile(20, 9), facing: 'left' } },
  { spawnActor: { id: 'kit', sprite: MOMENT_SHEETS.drums.key, kind: 'image', frame: DRUMS.idle, feet: MOMENT_SHEETS.drums.feet, shadowSize: [24, 6], at: doorTile(22, 9), facing: 'left' } },
  { sound: 'drumRoll' },
  { parallel: [
    { move: { actor: 'mevin', path: [doorTile(14, 9), playerTile(3, -0.5)], speed: 7 } },
    { move: { actor: 'kit', path: [doorTile(16, 9), playerTile(3, -0.25)], speed: 7 } },
  ] },
  // He lands the roll on a crash and jumps.
  { face: { actor: 'mevin', dir: 'left' } }, // toward her
  { face: { actor: 'player', toward: 'mevin' } },
  { parallel: [
    { sound: 'drumCrash' },
    { frame: { actor: 'kit', frame: DRUMS.crash } },
    { sequence: jump('mevin') },
  ] },
  { frame: { actor: 'kit', frame: DRUMS.idle } },
  { say: { speaker: 'Mevin (Treble)', lines: ['WOAHHH, {name}! You da goat!', 'Come watch me perform at Jashn some day!'], autoMs: 1500 } },
  // A bar of drums while she stands there, delighted.
  { parallel: [
    { sequence: DRUM_BAR },
    { sequence: [{ emote: { actor: 'player', kind: 'note' } }, { emote: { actor: 'player', kind: 'heart' } }] },
  ] },
  // Ba-dum-tss.
  { parallel: [
    { sound: 'drumRimshot' },
    { sequence: [
      { frame: { actor: 'kit', frame: DRUMS.kick } }, { wait: 170 },
      { frame: { actor: 'kit', frame: DRUMS.snare } }, { wait: 230 },
      { frame: { actor: 'kit', frame: DRUMS.snareCrash } },
      ...jump('mevin'), { wait: 120 },
      { frame: { actor: 'kit', frame: DRUMS.idle } },
    ] },
  ] },
  { wait: 300 },
  // He grabs the kit and runs off the way he came.
  { face: { actor: 'mevin', dir: 'right' } },
  { parallel: [
    { move: { actor: 'mevin', path: [doorTile(14, 9), doorTile(20, 9)], speed: 8 } },
    { move: { actor: 'kit', path: [doorTile(16, 9), doorTile(22, 9)], speed: 8 } },
  ] },
  { despawnActor: 'mevin' },
  { despawnActor: 'kit' },
  { cameraFollow: 'player' },
  { letterbox: 'out' },
  { unlockInput: true },
];

// M3, Prof. Raja's chariot (the owner: "make him a sort of Indian raja ... a sudden random appearance of a chariot that comes and takes him
// away, all in a fun interesting way"). In the Main Block foyer, once she holds the first key (src/moments.js). Raja is a named ambient
// character standing at tile (26,19) in the hall (the ambient crowd is hidden for a moment and the standing one is retired when it starts,
// src/scenes/world.js retireAmbientFor(); here he is a script actor on his own tile, so nothing jumps). The camera glides to him, he says
// his line, a gallop swells, he looks up, and a gilded chariot comes down the hall from the north (out of the library lobby, front view,
// horn, dust puffs), pulling up beside him. He steps aboard ("My ride"), it thunders off down the hall in a trail of sparkles and dust, and
// she is left with her closing line and the camera back on her. Everything is placed from the staircase's tile (stairsTile), not from her:
// the camera is centred two rows BELOW the figures, so Raja and the chariot stand above the dialog box during every line (checked in
// tests/unit/moments.test.js), wherever in the hall she stands. About 16-17 s.
const MOMENT_CHARIOT_STEPS = [
  { lockInput: true },
  { letterbox: 'in' },
  { spawnActor: { id: 'raja', sprite: 'npc-prof-raja', at: stairsTile(11, -6), facing: 'left' } },
  { parallel: [
    { cameraPan: { to: stairsTile(7, -4), ms: 1000 } },
    { face: { actor: 'raja', toward: 'player' } },
  ] },
  { say: { speaker: 'Prof. Raja', lines: ['Ah, {name}! Class is dismissed. A king never walks.'], autoMs: 1700 } },
  // A gallop swells in the distance; he turns to look up the hall, and the chariot comes down it out of the library lobby.
  { sound: 'chariotRumble' },
  { parallel: [
    { sequence: [{ wait: 700 }, { face: { actor: 'raja', dir: 'up' } }, { emote: { actor: 'raja', kind: '!' } }] },
    { sequence: [
      { wait: 600 },
      { spawnActor: { id: 'chariot', sprite: MOMENT_SHEETS.chariot.key, kind: 'image', frame: CHARIOT.trotA, feet: MOMENT_SHEETS.chariot.feet, shadowSize: [34, 7], at: stairsTile(5, -13), facing: 'down' } },
      { loop: { actor: 'chariot', frames: [CHARIOT.trotA, CHARIOT.trotB], frameMs: 140 } },
      { parallel: [
        { sequence: [
          { move: { actor: 'chariot', path: [stairsTile(5, -9), stairsTile(6, -7)], speed: 6 } },
          { move: { actor: 'chariot', path: [stairsTile(6, -5)], speed: 3 } },
        ] },
        { sparkles: { actor: 'chariot', ms: 1700, every: 90, kind: 'dust' } },
      ] },
    ] },
  ] },
  // It pulls up: the horses stop, the horn blares, Raja turns to it.
  { frame: { actor: 'chariot', frame: CHARIOT.trotA } },
  { parallel: [
    { sound: 'chariotHorn' },
    { face: { actor: 'raja', toward: 'chariot' } },
  ] },
  { wait: 300 },
  { say: { speaker: 'Prof. Raja', lines: ['My ride. Kindly mind the marks, {name}.'], autoMs: 1700 } },
  // He steps up beside the horses and disappears into the cart; the parasol is already up.
  { move: { actor: 'raja', path: [stairsTile(7, -6), stairsTile(6, -6)], speed: 3.5 } },
  { despawnActor: 'raja' },
  { sound: 'chariotHorn' },
  { loop: { actor: 'chariot', frames: [CHARIOT.ridedA, CHARIOT.ridedB], frameMs: 140 } },
  { wait: 250 },
  // Off down the hall, accelerating, in a cloud of dust and a trail of gold sparkles; it is out of the picture before the dust settles.
  { parallel: [
    { move: { actor: 'chariot', path: [stairsTile(6, 4)], speed: 5, ease: 'Quad.easeIn' } },
    { sparkles: { actor: 'chariot', ms: 1600, every: 70, kind: 'dust' } },
    { sparkles: { actor: 'chariot', ms: 1600, every: 90 } },
  ] },
  { despawnActor: 'chariot' },
  { cameraPan: { to: { actor: 'player' }, ms: 900 } },
  { say: { speaker: '{name}', lines: ['Okay. Never mind. This is definitely BITS.'], autoMs: 1600 } },
  { cameraFollow: 'player' },
  { letterbox: 'out' },
  { unlockInput: true },
];

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
  keyRoomIcl: keyRoomSteps('icl', 'The ICL — the computing lab.'),
  keyRoomRoom195: keyRoomSteps('room195', 'Room 195.'),
  // The moments (src/moments.js MOMENTS names these keys; run unskippable by world.js checkMoment()).
  momentUnicorn: MOMENT_UNICORN_STEPS,
  momentMevin: MOMENT_MEVIN_STEPS,
  momentChariot: MOMENT_CHARIOT_STEPS,
};
