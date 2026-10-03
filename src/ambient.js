// Ambient life (quality loop, Characters and depth run 1, 2026-09-29: "the world is empty... no
// students walking, sitting or chatting; no idle life"). Content, not engine (docs/ARCHITECTURE.md) --
// src/scenes/world.js createAmbient()/updateAmbient() is the only code that knows how to run one of
// these; this file only describes who stands/walks/sits where. Loaded before src/maps.js (index.html,
// tests/helpers/game-data.js), which points each map's own `ambient` field at one of the lists below.
//
// Every coordinate here was checked against the *real* committed map (assets/maps/<key>.json) --
// decoded with the same gridFromTiled()/isWalkableTile() pair src/maplogic.js already exports, not
// eyeballed from a screenshot -- so every waypoint and stand/sit spot is a genuinely walkable tile,
// and none of them sit on a door, stairs, key station or the volunteer's own nook (checked the same
// way; also covered by tests/unit/ambient.test.js so a future map regen can't silently break this).
//
// Shape, one entry per ambient character:
//   { id, character, kind: 'patrol' | 'idle' | 'chat', dialog? }
//   kind: 'patrol'  -- { waypoints: [{x,y}, ...], loop?, speed, pauseMs, facing? }
//                       `loop: true` cycles through the waypoints in order, wrapping to the first
//                       (the jogger's own closed lap around the track); otherwise ping-pongs back and
//                       forth between the first and last, pausing `pauseMs` at each end (a "walking a
//                       fixed route" pedestrian, not a lap).
//   kind: 'idle'    -- { x, y, facing } -- stationary (a bench, a reception desk, a lab bench --
//                       there's no seated pose in this pack's own frame data, ADR 0013, so "sitting"
//                       and "standing/waiting/working" all render the same way: an idle character).
//   kind: 'chat'    -- { x, y, facing, pairId } -- stationary like 'idle', but paired by `pairId`
//                       (exactly two entries share one) so world.js can show an occasional '...'
//                       bubble on whichever one's "turn" it is.
// `character` picks the texture the same way a story NPC's own `character` field already does
// (src/scenes/world.js createNpcs()): 'npc-<character>'. `dialog`, if given, overrides
// AMBIENT_DEFAULT_LINES below (src/scenes/world.js createAmbient()) with this entry's own lines --
// every one of them is short, neutral small talk, never story information (CLAUDE.md "don't invent
// the story" -- these aren't from docs/STORY.md, they're just campus atmosphere, flagged in this
// task's own report for the owner same as any other new line).

// The shared fallback pool most ambient NPCs use unless they have their own `dialog` above --
// deliberately generic ("no story info"), cycled by `AMBIENT[id.hash % pool.length]`-style index in
// world.js so two NPCs standing near each other don't usually say the exact same thing.
const AMBIENT_DEFAULT_LINES = [
  'Busy day on campus!',
  "Ugh, I'm going to be late for class.",
  'This heat is no joke today.',
  "I love it here, honestly.",
  'Anyone know where the LUG stall is?',
  'Three more assignments this week...',
  "Nice weather for once, isn't it?",
];

const AMBIENT = {
  campus: [
    // Two pedestrians walking a fixed stretch of the entrance avenue, back and forth.
    { id: 'campus-amb-walk-1', character: 'ambient-a', kind: 'patrol', speed: 60, pauseMs: 1000,
      waypoints: [{ x: 246, y: 165 }, { x: 233, y: 140 }] },
    { id: 'campus-amb-walk-2', character: 'ambient-b', kind: 'patrol', speed: 60, pauseMs: 1000,
      waypoints: [{ x: 240, y: 150 }, { x: 226, y: 132 }] },
    { id: 'campus-amb-walk-3', character: 'student-a', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 232, y: 160 }, { x: 248, y: 165 }] },
    // A closed lap around the Athletics Track (`loop: true`), faster than a walk -- "jogging".
    { id: 'campus-amb-jog', character: 'ambient-c', kind: 'patrol', speed: 110, pauseMs: 0, loop: true,
      waypoints: [{ x: 120, y: 90 }, { x: 165, y: 90 }, { x: 165, y: 108 }, { x: 120, y: 108 }] },
    // 3 sitting on benches along the avenue.
    // x: 229, not 225 -- quality loop, Mini-games/Characters fix round (2026-09-29): 225 sat directly
    // in the Main Block door's own straight-line approach column (the door itself is at x 225.5), so
    // a player walking north into it collided with this NPC's body a few tiles out and never reached
    // the door at all (tests/e2e/campus.spec.js "walk from the Gate 2 spawn up to the Main Block
    // entrance"). Shifted clear of that column, still along the same forecourt.
    { id: 'campus-amb-sit-1', character: 'ambient-d', kind: 'idle', x: 229, y: 135, facing: 'down' },
    { id: 'campus-amb-sit-2', character: 'ambient-e', kind: 'idle', x: 243, y: 162, facing: 'left' },
    { id: 'campus-amb-sit-3', character: 'student-b', kind: 'idle', x: 221, y: 137, facing: 'right' },
    // A pair chatting, facing each other.
    { id: 'campus-amb-chat-1', character: 'ambient-f', kind: 'chat', x: 222, y: 141, facing: 'right', pairId: 'campus-chat' },
    { id: 'campus-amb-chat-2', character: 'ambient-b', kind: 'chat', x: 223, y: 141, facing: 'left', pairId: 'campus-chat' },
    // By the bus stop, just outside Gate 2.
    { id: 'campus-amb-busstop', character: 'ambient-c', kind: 'idle', x: 232, y: 160, facing: 'up' },
  ],

  'main-block-g': [
    // On the foyer's sofas / waiting near reception (docs/STORY.md "the foyer"): kept well clear of
    // the "LUG Stall" nook (x4-24, y8-10) where the volunteer stands, per this task's own brief.
    { id: 'mbg-amb-sit-1', character: 'ambient-a', kind: 'idle', x: 6, y: 14, facing: 'down' },
    { id: 'mbg-amb-sit-2', character: 'ambient-b', kind: 'idle', x: 20, y: 14, facing: 'left' },
    // Walking between the staircase and the door.
    { id: 'mbg-amb-walk-1', character: 'student-a', kind: 'patrol', speed: 50, pauseMs: 700,
      waypoints: [{ x: 8, y: 14 }, { x: 8, y: 19 }] },
    { id: 'mbg-amb-walk-2', character: 'ambient-c', kind: 'patrol', speed: 50, pauseMs: 700,
      waypoints: [{ x: 20, y: 19 }, { x: 14, y: 20 }] },
  ],

  'main-block-1': [
    // Working at ICVL desks, facing into the room (docs/STORY.md beat 7) -- a tile clear of the desk
    // block itself, the same "she interacts from nearby, not standing on the furniture" shape the
    // real key station already uses.
    // x: 4, not 5 -- quality loop, Mini-games/Characters fix round (2026-09-29): the icvl key station
    // (src/maps.js, x:6 y:6) is approached from (6,7); (5,7) sat exactly as far from that approach
    // tile (16px, one tile) as the key station itself, and nearestInteractable() (src/scenes/world.js)
    // breaks that exact tie in the NPC's favor -- talking there gave this student's own small-talk
    // line instead of ever reaching the ICVL key (tests/e2e/story.spec.js, minigames.spec.js). Shifted
    // one more tile off so the key station is unambiguously nearer.
    { id: 'mb1-amb-icvl-1', character: 'ambient-d', kind: 'idle', x: 4, y: 7, facing: 'right' },
    { id: 'mb1-amb-icvl-2', character: 'ambient-e', kind: 'idle', x: 5, y: 9, facing: 'right' },
    // 2 in the corridor.
    { id: 'mb1-amb-corridor-1', character: 'student-b', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 13, y: 17 }, { x: 25, y: 17 }] },
    { id: 'mb1-amb-corridor-2', character: 'ambient-f', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 8, y: 20 }, { x: 20, y: 20 }] },
  ],

  'main-block-3': [
    // At a Physics Lab bench, facing the key station's own desk (docs/STORY.md beat 6).
    // x: 4, not 5 -- quality loop, Mini-games/Characters fix round (2026-09-29): the physicsLab key
    // station (src/maps.js, x:5 y:7) is approached from (5,8); (5,9) sat exactly as far from that
    // approach tile (16px, one tile) as the key station itself, and nearestInteractable()
    // (src/scenes/world.js) breaks that exact tie in the NPC's favor -- talking there gave this
    // student's own small-talk line instead of ever launching the platformer (tests/e2e/story.spec.js,
    // minigames.spec.js). Shifted diagonally off so the key station is unambiguously nearer.
    { id: 'mb3-amb-bench', character: 'ambient-a', kind: 'idle', x: 4, y: 9, facing: 'up' },
  ],
};
