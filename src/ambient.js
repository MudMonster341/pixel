// Ambient life (quality loop, Characters and depth run 1, 2026-09-29: "the world is empty... no
// students walking, sitting or chatting; no idle life"). Content, not engine (docs/ARCHITECTURE.md) --
// src/scenes/world.js createAmbient()/updateAmbient() is the only code that knows how to run one of
// these; this file only describes who stands/walks/sits where. Loaded before src/maps.js (index.html,
// tests/helpers/game-data.js), which points each map's own `ambient` field at one of the lists below.
//
// Every coordinate here was checked against the *real* committed map (assets/maps/<key>.json) --
// decoded with the same gridFromTiled()/isWalkableTile() pair src/maplogic.js already exports, not
// eyeballed from a screenshot -- so every waypoint and stand/sit spot is a genuinely walkable tile,
// reachable from the spawn, and none of them sit on a door, stairs, key station or the volunteer's own
// nook (checked the same way; also covered by tests/unit/ambient.test.js so a future map regen can't
// silently break this).
//
// Shape, one entry per ambient character:
//   { id, character, role, kind: 'patrol' | 'idle' | 'chat' }
//   role: a key of CAMPUS_ROLES (src/campus-facts.js) -- every ambient student is talkable (ADR 0018):
//         E makes the student stop and turn to her, and says an opener plus a real campus fact from the
//         role's pool (campusTalkLines()), then the student walks on. Nothing story-related lives here.
//   kind: 'patrol'  -- { waypoints: [{x,y}, ...], loop?, speed, pauseMs, facing? }
//                       `loop: true` cycles through the waypoints in order, wrapping to the first
//                       (the jogger's own closed lap around the track); otherwise ping-pongs back and
//                       forth between the first and last, pausing `pauseMs` at each end (a "walking a
//                       fixed route" pedestrian, not a lap). The straight line between two
//                       neighbouring waypoints must be walkable (no pathfinding, tests check it).
//   kind: 'idle'    -- { x, y, facing } -- stationary (a bench, a reception desk, a lab bench --
//                       there's no seated pose in this pack's own frame data, ADR 0013, so "sitting"
//                       and "standing/waiting/working" all render the same way: an idle character).
//   kind: 'chat'    -- { x, y, facing, pairId } -- stationary like 'idle', but paired by `pairId`
//                       (exactly two entries share one) so world.js can show an occasional '...'
//                       bubble on whichever one's "turn" it is.
// `character` picks the texture the same way a story NPC's own `character` field already does
// (src/scenes/world.js createNpcs()): 'npc-<character>'.
//
// Coverage (tests/unit/ambient.test.js): every outdoor area she can roam has at least 2-3 people --
// Gate 2, the avenue, the Main Block forecourt, the Library and Mechanical fronts, the hostels, parking,
// the courts/track/tennis, the Side Gate and DIAC Park -- and every Main Block floor on the story route
// has at least 2. Only the ones near the camera are updated each frame (world.js updateAmbient()).

const AMBIENT = {
  campus: [
    // ---- Gate 2 and the entrance avenue ----
    // Two pedestrians walking a fixed stretch of the entrance avenue, back and forth.
    { id: 'campus-amb-walk-1', character: 'ambient-a', role: 'first-year', kind: 'patrol', speed: 60, pauseMs: 1000,
      waypoints: [{ x: 246, y: 165 }, { x: 241, y: 152 }, { x: 233, y: 140 }] },
    { id: 'campus-amb-walk-2', character: 'ambient-b', role: 'campus-regular', kind: 'patrol', speed: 60, pauseMs: 1000,
      waypoints: [{ x: 240, y: 150 }, { x: 226, y: 132 }] },
    { id: 'campus-amb-walk-3', character: 'student-a', role: 'cs-student', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 232, y: 160 }, { x: 248, y: 165 }] },
    // A closed lap around the Athletics Track (`loop: true`), faster than a walk -- "jogging".
    { id: 'campus-amb-jog', character: 'ambient-c', role: 'sports-player', kind: 'patrol', speed: 110, pauseMs: 0, loop: true,
      waypoints: [{ x: 120, y: 90 }, { x: 165, y: 90 }, { x: 165, y: 108 }, { x: 120, y: 108 }] },
    // 3 sitting on benches along the avenue.
    // x: 229, not 225 -- quality loop, Mini-games/Characters fix round (2026-09-29): 225 sat directly
    // in the Main Block door's own straight-line approach column (the door itself is at x 225.5), so
    // a player walking north into it collided with this NPC's body a few tiles out and never reached
    // the door at all (tests/e2e/campus.spec.js "walk from the Gate 2 spawn up to the Main Block
    // entrance"). Shifted clear of that column, still along the same forecourt.
    { id: 'campus-amb-sit-1', character: 'ambient-d', role: 'library-regular', kind: 'idle', x: 229, y: 135, facing: 'down' },
    { id: 'campus-amb-sit-2', character: 'ambient-e', role: 'hostel-resident', kind: 'idle', x: 243, y: 162, facing: 'left' },
    { id: 'campus-amb-sit-3', character: 'student-b', role: 'ai-student', kind: 'idle', x: 221, y: 137, facing: 'right' },
    // A pair chatting, facing each other.
    { id: 'campus-amb-chat-1', character: 'ambient-f', role: 'quiz-club-member', kind: 'chat', x: 222, y: 141, facing: 'right', pairId: 'campus-chat' },
    { id: 'campus-amb-chat-2', character: 'ambient-b', role: 'cultural-club-member', kind: 'chat', x: 223, y: 141, facing: 'left', pairId: 'campus-chat' },
    // By the bus stop, just outside Gate 2.
    { id: 'campus-amb-busstop', character: 'ambient-c', role: 'senior', kind: 'idle', x: 232, y: 160, facing: 'up' },
    // Gate parking, east side.
    { id: 'campus-amb-gatepark', character: 'student-a', role: 'first-year', kind: 'patrol', speed: 50, pauseMs: 1200,
      waypoints: [{ x: 252, y: 145 }, { x: 264, y: 145 }] },

    // ---- Main Block forecourt ----
    { id: 'campus-amb-forecourt-1', character: 'ambient-a', role: 'volunteer', kind: 'idle', x: 215, y: 134, facing: 'right' },
    { id: 'campus-amb-forecourt-2', character: 'student-b', role: 'campus-regular', kind: 'idle', x: 238, y: 136, facing: 'left' },

    // ---- Library front: the courtyard behind the Library Block entrance ----
    { id: 'campus-amb-lib-1', character: 'ambient-e', role: 'library-regular', kind: 'idle', x: 236, y: 102, facing: 'down' },
    { id: 'campus-amb-lib-chat-1', character: 'ambient-d', role: 'acm-member', kind: 'chat', x: 227, y: 105, facing: 'right', pairId: 'campus-lib-chat' },
    { id: 'campus-amb-lib-chat-2', character: 'ambient-f', role: 'first-year', kind: 'chat', x: 228, y: 105, facing: 'left', pairId: 'campus-lib-chat' },

    // ---- Mechanical front: the lawn corridor below the Mechanical Block entrance ----
    { id: 'campus-amb-mech-1', character: 'ambient-b', role: 'tech-club-member', kind: 'idle', x: 242, y: 78, facing: 'up' },
    { id: 'campus-amb-mech-2', character: 'student-a', role: 'cs-student', kind: 'patrol', speed: 50, pauseMs: 1000,
      waypoints: [{ x: 241, y: 80 }, { x: 246, y: 92 }] },
    { id: 'campus-amb-mech-3', character: 'ambient-c', role: 'lug-member', kind: 'idle', x: 246, y: 84, facing: 'left' },

    // ---- Hostels ----
    // Boys' hostels (A-D): the long path between the two rows of blocks, the lower path, the gap.
    { id: 'campus-amb-hostel-1', character: 'ambient-d', role: 'hostel-resident', kind: 'idle', x: 101, y: 61, facing: 'down' },
    { id: 'campus-amb-hostel-2', character: 'ambient-a', role: 'senior', kind: 'patrol', speed: 55, pauseMs: 1000,
      waypoints: [{ x: 84, y: 61 }, { x: 112, y: 61 }] },
    { id: 'campus-amb-hostel-3', character: 'ambient-e', role: 'hostel-resident', kind: 'idle', x: 140, y: 66, facing: 'up' },
    { id: 'campus-amb-hostel-4', character: 'student-b', role: 'acm-member', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 99, y: 74 }, { x: 125, y: 74 }] },
    // Girls' hostels (G, H).
    { id: 'campus-amb-girls-1', character: 'ambient-f', role: 'hostel-resident', kind: 'idle', x: 238, y: 66, facing: 'down' },
    { id: 'campus-amb-girls-2', character: 'ambient-b', role: 'cultural-club-member', kind: 'patrol', speed: 50, pauseMs: 1000,
      waypoints: [{ x: 226, y: 68 }, { x: 226, y: 72 }] },
    // The Side Gate.
    { id: 'campus-amb-sidegate', character: 'ambient-c', role: 'campus-regular', kind: 'idle', x: 80, y: 68, facing: 'right' },

    // ---- Sports: the courts, tennis courts and the track's infield ----
    { id: 'campus-amb-court-1', character: 'ambient-a', role: 'sports-player', kind: 'idle', x: 190, y: 63, facing: 'down' },
    { id: 'campus-amb-court-2', character: 'ambient-d', role: 'sports-player', kind: 'idle', x: 211, y: 64, facing: 'left' },
    { id: 'campus-amb-court-3', character: 'student-a', role: 'quiz-club-member', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 178, y: 61 }, { x: 205, y: 61 }] },
    { id: 'campus-amb-tennis-1', character: 'ambient-e', role: 'sports-player', kind: 'idle', x: 94, y: 97, facing: 'right' },
    { id: 'campus-amb-tennis-2', character: 'ambient-f', role: 'tech-club-member', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 89, y: 94 }, { x: 100, y: 94 }] },
    { id: 'campus-amb-track-1', character: 'ambient-b', role: 'sports-player', kind: 'idle', x: 145, y: 98, facing: 'up' },

    // ---- Student parking ----
    { id: 'campus-amb-park-1', character: 'student-b', role: 'cs-student', kind: 'idle', x: 150, y: 115, facing: 'down' },
    { id: 'campus-amb-park-2', character: 'ambient-c', role: 'lug-member', kind: 'patrol', speed: 55, pauseMs: 1000,
      waypoints: [{ x: 130, y: 116 }, { x: 168, y: 116 }] },

    // ---- DIAC Park (east of the campus wall) ----
    { id: 'campus-amb-park-diac-1', character: 'ambient-d', role: 'volunteer', kind: 'idle', x: 300, y: 128, facing: 'down' },
    { id: 'campus-amb-diac-jog', character: 'ambient-a', role: 'sports-player', kind: 'patrol', speed: 90, pauseMs: 0, loop: true,
      waypoints: [{ x: 305, y: 120 }, { x: 330, y: 120 }, { x: 330, y: 131 }, { x: 305, y: 131 }] },
    { id: 'campus-amb-diac-chat-1', character: 'ambient-e', role: 'quiz-club-member', kind: 'chat', x: 318, y: 125, facing: 'right', pairId: 'campus-diac-chat' },
    { id: 'campus-amb-diac-chat-2', character: 'student-a', role: 'lug-member', kind: 'chat', x: 319, y: 125, facing: 'left', pairId: 'campus-diac-chat' },
  ],

  'main-block-g': [
    // The reception foyer and the two wings, rebuilt for ADR 0020 (docs/INTERIORS_PLAN.md "Ground floor"). Every
    // spot is open floor of the NEW layout (checked by tests/unit/foyer-tour.test.js against the real map): at
    // least 3 tiles from the LUG volunteer (14,16) behind the left staircase, the stairs object (15,25), and every
    // door, and never in a one-tile lane (the ramp's rail lanes, the staircase's west lane) or a doorway.
    // By the right-back sofas, and in the open hall west of the terrarium.
    { id: 'mbg-amb-sit-1', character: 'ambient-a', role: 'first-year', kind: 'idle', x: 26, y: 19, facing: 'left' },
    { id: 'mbg-amb-sit-2', character: 'ambient-b', role: 'campus-regular', kind: 'idle', x: 14, y: 31, facing: 'right' },
    // A pair chatting in the front of the hall, between the reception desks.
    { id: 'mbg-amb-chat-1', character: 'ambient-d', role: 'quiz-club-member', kind: 'chat', x: 22, y: 33, facing: 'right', pairId: 'mbg-chat' },
    { id: 'mbg-amb-chat-2', character: 'ambient-e', role: 'cultural-club-member', kind: 'chat', x: 23, y: 33, facing: 'left', pairId: 'mbg-chat' },
    // Walking across the hall past the sofas, and back and forth in front of the reception desks.
    { id: 'mbg-amb-walk-1', character: 'student-a', role: 'cs-student', kind: 'patrol', speed: 50, pauseMs: 700,
      waypoints: [{ x: 22, y: 24 }, { x: 27, y: 24 }] },
    { id: 'mbg-amb-walk-2', character: 'ambient-c', role: 'acm-member', kind: 'patrol', speed: 50, pauseMs: 700,
      waypoints: [{ x: 13, y: 33 }, { x: 24, y: 33 }] },
    // The wings: one in each wing-end lobby, one waiting in the right-hand office corridor.
    { id: 'mbg-amb-wing-1', character: 'student-b', role: 'ai-student', kind: 'patrol', speed: 45, pauseMs: 900,
      waypoints: [{ x: 6, y: 12 }, { x: 6, y: 9 }] },
    { id: 'mbg-amb-wing-2', character: 'ambient-f', role: 'senior', kind: 'patrol', speed: 45, pauseMs: 900,
      waypoints: [{ x: 33, y: 12 }, { x: 33, y: 9 }] },
    { id: 'mbg-amb-wing-3', character: 'ambient-a', role: 'tech-club-member', kind: 'idle', x: 34, y: 27, facing: 'up' },
  ],

  'main-block-1': [
    // Working at the ICVL's neighbouring classroom row (docs/STORY.md beat 7), NOT at the ICVL room's
    // own door. First full browser run (2026-10-03, tests/unit/story-clearance.test.js): the ICVL is a
    // closet reached only through the one-tile corridor tile (4,7), and a student standing there (an
    // immovable collider) sealed the key station off; earlier fixes had only nudged this student around
    // the station to settle an E-tie. The rule now is geometric: idle/chat students keep at least two
    // interact ranges (3 tiles) from every key station and story NPC, and never stand in a one-tile
    // corridor or a room's only doorway.
    { id: 'mb1-amb-icvl-1', character: 'ambient-d', role: 'tech-club-member', kind: 'idle', x: 6, y: 11, facing: 'left' },
    { id: 'mb1-amb-icvl-2', character: 'ambient-e', role: 'lug-member', kind: 'idle', x: 5, y: 9, facing: 'right' },
    // 2 in the corridor.
    { id: 'mb1-amb-corridor-1', character: 'student-b', role: 'ai-student', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 13, y: 17 }, { x: 25, y: 17 }] },
    { id: 'mb1-amb-corridor-2', character: 'ambient-f', role: 'senior', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 8, y: 20 }, { x: 20, y: 20 }] },
  ],

  // The 2nd floor is a through-route to the 3rd (docs/INTERIORS_PLAN.md): the landing corridor.
  'main-block-2': [
    { id: 'mb2-amb-landing-1', character: 'ambient-a', role: 'quiz-club-member', kind: 'idle', x: 10, y: 14, facing: 'down' },
    { id: 'mb2-amb-landing-2', character: 'student-a', role: 'cultural-club-member', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 7, y: 19 }, { x: 24, y: 19 }] },
    { id: 'mb2-amb-landing-3', character: 'ambient-e', role: 'volunteer', kind: 'idle', x: 24, y: 14, facing: 'left' },
  ],

  'main-block-3': [
    // Waiting in the wide hall below, well clear of the Physics Lab key station and of the one-tile
    // corridor (x 4, rows 10-12) she climbs to reach it. Was (4,9), 2.2 tiles from the desk and standing in
    // that corridor (tests/unit/story-clearance.test.js, 2026-10-03).
    { id: 'mb3-amb-bench', character: 'ambient-a', role: 'cs-student', kind: 'idle', x: 9, y: 20, facing: 'up' },
    // The corridor below the lab and the stairwell landing.
    { id: 'mb3-amb-corridor-1', character: 'student-b', role: 'ai-student', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 14, y: 19 }, { x: 27, y: 19 }] },
    { id: 'mb3-amb-landing-1', character: 'ambient-d', role: 'senior', kind: 'idle', x: 33, y: 14, facing: 'down' },
  ],
};
