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
//   name?, lines?: OPTIONAL, make this ONE entry a NAMED character (FB-0050, ADR 0021: the owner's friends and
//         professors; P2b adds more). `name` is the name tag shown instead of the role label ("Deanne", not
//         "Hostel mate"); `lines` (an array of short strings, each <= 160 chars) is what she says the first time she
//         talks to that student, instead of the role's opener and fact. Later talks carry on with the role's
//         facts, so a named character still shares campus facts in her own voice (a role with no facts repeats
//         her lines). Both are plain data read by campusTalkLines() (src/campus-facts.js) and world.js
//         buildAmbientNpc(); an entry with neither behaves exactly as before. Lines are the owner's to approve
//         (docs/research/campus-lines-review.md, "Named characters"); never invent personal facts about a real person.
//   sheet?, factIds?: OPTIONAL, also for named characters (FB-0051, P2b: the owner's friends, Mustafa and three professors).
//         `sheet` is the entry's own texture key (e.g. 'npc-friend-sid'; tools/make-assets.js FRIEND_LOOKS / PROF_WOMEN draw it, wings
//         and camera included), which wins over the role's outfit in ambientSheetKey(); `character` stays the plain body used as the
//         fallback if that sheet never loaded. `factIds` (e.g. ['CF23']) limits which of the role's facts the character says after
//         her fixed lines; `[]` means only the fixed lines, said again every time (Mustafa). A line may use `{name}`: the player's name.
//   unlessMoment?: OPTIONAL, a moment id (src/moments.js): once that moment has played (GameState.seenMoments) the entry is never built again,
//         and the moment itself removes the standing one when it starts (world.js createAmbient()/retireAmbientFor()). Prof. Raja carries
//         'm3': the chariot takes him away for good. Until then he is an ordinary named character with his own lines.
//   The student's clothes come from her ROLE, not from the entry (unless it has a `sheet`): a club role (CAMPUS_ROLES[role].outfit) draws with
//         the club's colours, `npc-<character>-<outfit>` (FB-0057, src/campus-facts.js ambientSheetKey()).
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
    { id: 'campus-amb-walk-3', character: 'ambient-c', role: 'cs-student', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 232, y: 160 }, { x: 248, y: 165 }],
      name: "Sid", sheet: 'npc-friend-sid',
      // FB-0084: the owner's own line.
      lines: [
        "Muahaha, let me help you act as the victim. Be careful so you don't hurt your neck!",
      ] },
    // A closed lap around the Athletics Track (`loop: true`), faster than a walk -- "jogging".
    { id: 'campus-amb-jog', character: 'ambient-c', role: 'sports-player', kind: 'patrol', speed: 110, pauseMs: 0, loop: true,
      waypoints: [{ x: 120, y: 90 }, { x: 165, y: 90 }, { x: 165, y: 108 }, { x: 120, y: 108 }] },
    // 3 sitting on benches along the avenue.
    // x: 229, not 225 -- quality loop, Mini-games/Characters fix round (2026-09-29): 225 sat directly
    // in the Main Block door's own straight-line approach column (the door itself is at x 225.5), so
    // a player walking north into it collided with this NPC's body a few tiles out and never reached
    // the door at all (tests/e2e/campus.spec.js "walk from the Gate 2 spawn up to the Main Block
    // entrance"). Shifted clear of that column, still along the same forecourt.
    // FB-0086: Akshay, the owner's own line.
    { id: 'campus-amb-sit-1', character: 'ambient-d', role: 'library-regular', kind: 'idle', x: 229, y: 135, facing: 'down',
      name: 'Akshay',
      lines: ["I'm trying to sneak into campus, don't tell anyone."] },
    // FB-0050: the first NAMED ambient character (the owner asked for "Deanne" instead of "Hostel resident").
    // Placeholder lines, light and friendly, no personal facts: the owner edits them (campus-lines-review.md).
    { id: 'campus-amb-sit-2', character: 'ambient-e', role: 'hostel-resident', kind: 'idle', x: 243, y: 162, facing: 'left',
      name: 'Deanne',
      lines: ["Hi, I'm Deanne! I live in the hostel.", 'Hostel dinner is the best part of my day, honestly. That and my chai.', 'I know every quiet corner on this campus. Ask me anything.'] },
    { id: 'campus-amb-sit-3', character: 'ambient-a', role: 'ai-student', kind: 'idle', x: 221, y: 137, facing: 'right',
      name: "Akshit", sheet: 'npc-friend-akshit',
      // FB-0087: the owner's own line.
      lines: [
        "Yooooo, what's good bro! You seen Mustafa around?",
      ] },
    // A pair chatting, facing each other.
    // FB-0088: names only (the owner didn't say which is which: Nishit left, Shryk right); they keep their role's facts.
    { id: 'campus-amb-chat-1', character: 'ambient-f', role: 'quiz-club-member', kind: 'chat', x: 222, y: 141, facing: 'right', pairId: 'campus-chat',
      name: 'Nishit' },
    { id: 'campus-amb-chat-2', character: 'ambient-b', role: 'cultural-club-member', kind: 'chat', x: 223, y: 141, facing: 'left', pairId: 'campus-chat',
      name: 'Shryk' },
    // By the bus stop, just outside Gate 2.
    // FB-0085: Vedant, the wise old man of the bus stop (the owner asked for "some philosophical stuff"; the lines are Claude's, in that spirit).
    { id: 'campus-amb-busstop', character: 'ambient-c', role: 'senior', kind: 'idle', x: 232, y: 160, facing: 'up',
      name: 'Vedant',
      lines: [
        "I'm Vedant. I've waited at this bus stop so long that I've started to understand time.",
        'The bus always comes when you stop looking for it. Same with deadlines. Look away, they sneak up.',
        'Wise words: a full battery is a blessing, a full inbox is a lesson. Now go, young one.',
      ] },
    // Gate parking, east side.
    { id: 'campus-amb-gatepark', character: 'student-a', role: 'first-year', kind: 'patrol', speed: 50, pauseMs: 1200,
      waypoints: [{ x: 252, y: 145 }, { x: 264, y: 145 }] },

    // ---- Main Block forecourt ----
    // FB-0051 (P2b): Satvik with his camera at the foot of the Main Block, and Varun on the other side of the forecourt.
    { id: 'campus-amb-forecourt-1', character: 'ambient-c', role: 'cultural-club-member', kind: 'idle', x: 215, y: 134, facing: 'right',
      name: "Satvik", sheet: 'npc-friend-satvik',
      lines: [
        "Hold still, {name}! The light is perfect. Say cheese... or say semicolon, it works for us too.",
        "I photograph everything here: sunsets, lunch, bugs on the screen. Mostly lunch.",
        "My camera's one rule: if it's a good moment, it's a good shot. Strike a pose!",
      ] },
    { id: 'campus-amb-forecourt-2', character: 'ambient-e', role: 'campus-regular', kind: 'idle', x: 238, y: 136, facing: 'left',
      name: "Varun", sheet: 'npc-friend-varun',
      lines: [
        "I'm Varun. I came for a quick chat and stayed for a long one.",
        "My code has two states: it works, and nobody touch it.",
        "Is the canteen open? Asking for my stomach. It has no Wi-Fi and no patience.",
      ] },

    // ---- Library front: the courtyard behind the Library Block entrance ----
    { id: 'campus-amb-lib-1', character: 'ambient-e', role: 'library-regular', kind: 'idle', x: 236, y: 102, facing: 'down' },
    { id: 'campus-amb-lib-chat-1', character: 'ambient-d', role: 'acm-member', kind: 'chat', x: 227, y: 105, facing: 'right', pairId: 'campus-lib-chat' },
    { id: 'campus-amb-lib-chat-2', character: 'ambient-f', role: 'first-year', kind: 'chat', x: 228, y: 105, facing: 'left', pairId: 'campus-lib-chat' },

    // ---- Mechanical front: the lawn corridor below the Mechanical Block entrance ----
    { id: 'campus-amb-mech-1', character: 'ambient-b', role: 'mtc-member', kind: 'idle', x: 242, y: 78, facing: 'up' },
    { id: 'campus-amb-mech-2', character: 'student-a', role: 'cs-student', kind: 'patrol', speed: 50, pauseMs: 1000,
      waypoints: [{ x: 241, y: 80 }, { x: 246, y: 92 }] },
    { id: 'campus-amb-mech-3', character: 'ambient-c', role: 'lug-member', kind: 'idle', x: 246, y: 84, facing: 'left' },

    // ---- Hostels ----
    // Boys' hostels (A-D): the long path between the two rows of blocks, the lower path, the gap.
    // (D11, 2026-10-04: row 61 used to be a walkway cut through the hostel's front wall; the wall is back, so the
    // 'long path' is now the plaza strip along the foot of the facade, row 64.)
    { id: 'campus-amb-hostel-1', character: 'ambient-d', role: 'hostel-resident', kind: 'idle', x: 101, y: 64, facing: 'down' },
    { id: 'campus-amb-hostel-2', character: 'ambient-a', role: 'senior', kind: 'patrol', speed: 55, pauseMs: 1000,
      waypoints: [{ x: 84, y: 64 }, { x: 112, y: 64 }] },
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
    { id: 'campus-amb-court-1', character: 'ambient-c', role: 'sports-player', kind: 'idle', x: 190, y: 63, facing: 'down',
      name: "Mitul", sheet: 'npc-friend-mitul',
      lines: [
        "Mitul reporting! Fun fact: it's always a missing semicolon. Always.",
        "I counted my deadlines. Then I stopped counting, for my own health.",
        "Hydration check, {name}! Water first. Then energy drink number seven.",
      ] },
    // FB-0080: Mahin, the badminton player (red jersey, white sweatband); only one of the two court players is named.
    { id: 'campus-amb-court-2', character: 'ambient-d', role: 'sports-player', kind: 'idle', x: 211, y: 64, facing: 'left',
      name: "Mahin", sheet: 'npc-friend-mahin',
      lines: [
        "Mahin here! Badminton is my sport. The shuttlecock is my rival. Smash!",
        "It is all about the footwork. Mine mostly goes: one step forward, two steps to the canteen.",
        "I am not sweating, my racket is just leaking.",
      ] },
    { id: 'campus-amb-court-3', character: 'student-a', role: 'quiz-club-member', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 178, y: 61 }, { x: 205, y: 61 }] },
    { id: 'campus-amb-tennis-1', character: 'ambient-e', role: 'sports-player', kind: 'idle', x: 94, y: 97, facing: 'right' },
    { id: 'campus-amb-tennis-2', character: 'ambient-f', role: 'tech-club-member', kind: 'patrol', speed: 55, pauseMs: 900,
      waypoints: [{ x: 89, y: 94 }, { x: 100, y: 94 }] },
    { id: 'campus-amb-track-1', character: 'ambient-b', role: 'sports-player', kind: 'idle', x: 145, y: 98, facing: 'up' },

    // ---- Student parking ----
    { id: 'campus-amb-park-1', character: 'ambient-e', role: 'cs-student', kind: 'idle', x: 150, y: 115, facing: 'down',
      name: "Siva", sheet: 'npc-friend-siva',
      lines: [
        "Siva here! I use dark mode for everything. Even this conversation.",
        "Why do programmers prefer dark mode? Because light attracts bugs.",
        "If it works, don't touch it. If it doesn't, also don't touch it. Go get chai.",
      ] },
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
    // FB-0051 (P2b): Prof. Raja waits in the hall until the chariot (M3, src/moments.js) comes for him once she holds the first key; Shamsuddin crosses it.
    { id: 'mbg-amb-sit-1', character: 'ambient-e', role: 'tech-club-member', kind: 'idle', x: 26, y: 19, facing: 'left', factIds: ['CF12'],
      name: "Prof. Raja", sheet: 'npc-prof-raja', unlessMoment: 'm3',
      lines: [
        "Greetings, {name}. I am Prof. Raja. A proper entrance is half of any lecture.",
        "I carry myself like royalty because my timetable demands it. Mostly the Monday ones.",
        "I have a ride coming. Quite soon, actually.",
      ] },
    // FB-0089: Utkarsh, the startup freak who throws parties (the owner's idea; the wording is Claude's).
    { id: 'mbg-amb-sit-2', character: 'ambient-b', role: 'campus-regular', kind: 'idle', x: 14, y: 31, facing: 'right',
      name: 'Utkarsh',
      lines: [
        "Yo {name}! I'm Utkarsh. Startups, pitch decks, parties: that's my whole personality.",
        "I'm throwing a party this weekend and you're on the guest list. Come through, bring good vibes!",
      ] },
    // A pair chatting in the front of the hall, between the reception desks.
    // FB-0090: Venn (they/them, SLAYYY) and Cijo (stuck on operating systems).
    { id: 'mbg-amb-chat-1', character: 'ambient-d', role: 'quiz-club-member', kind: 'chat', x: 22, y: 33, facing: 'right', pairId: 'mbg-chat',
      name: 'Venn',
      lines: [
        "I'm Venn, and it's they, not her, thank you! SLAYYY!",
        'Say it with me: they, them, iconic. Okay, bye!',
      ] },
    { id: 'mbg-amb-chat-2', character: 'ambient-e', role: 'cultural-club-member', kind: 'chat', x: 23, y: 33, facing: 'left', pairId: 'mbg-chat',
      name: 'Cijo',
      lines: ["I'm Cijo. I'm trying to understand OS (operating systems) and I just can't. Please send help."] },
    // Walking across the hall past the sofas, and back and forth in front of the reception desks.
    { id: 'mbg-amb-walk-1', character: 'ambient-c', role: 'cs-student', kind: 'patrol', speed: 50, pauseMs: 700,
      waypoints: [{ x: 22, y: 24 }, { x: 27, y: 24 }],
      name: "Shamsuddin", sheet: 'npc-friend-shamsuddin',
      // FB-0091: the owner's idea (he is the vice president; face-scan attendance is coming); the wording is Claude's.
      lines: [
        "Shamsuddin, vice president. Breaking news: face-scan attendance is coming!",
        'Evacuate, I mean bunk, now, before it gets implemented. You did not hear it from me.',
      ] },
    // FB-0079: the ACM member the owner talked to in the foyer (tile 18,34, he patrols row 33) is Aakar: sky-blue hoodie, a Dr. Evil style sci-fi villain about tech.
    // No `factIds`: after his lines he shares the ACM facts (CF41-CF43) like any ACM member.
    { id: 'mbg-amb-walk-2', character: 'ambient-c', role: 'acm-member', kind: 'patrol', speed: 50, pauseMs: 700,
      waypoints: [{ x: 13, y: 33 }, { x: 24, y: 33 }],
      name: "Aakar", sheet: 'npc-friend-aakar',
      lines: [
        "Ah, {name}... I have been expecting you. Join ACM. Resistance is... deprecated.",
        "My evil plan? Total world domination... of the merge queue. Muahaha.",
        "One MILLION lines of code! ...or so. Come to our meeting. There is pizza. That is not a trap.",
      ] },
    // The wings: one in each wing-end lobby, one waiting in the right-hand office corridor.
    { id: 'mbg-amb-wing-1', character: 'student-b', role: 'ai-student', kind: 'patrol', speed: 45, pauseMs: 900,
      waypoints: [{ x: 6, y: 12 }, { x: 6, y: 9 }] },
    { id: 'mbg-amb-wing-2', character: 'ambient-f', role: 'senior', kind: 'patrol', speed: 45, pauseMs: 900,
      waypoints: [{ x: 33, y: 12 }, { x: 33, y: 9 }] },
    { id: 'mbg-amb-wing-3', character: 'ambient-a', role: 'mtc-member', kind: 'idle', x: 34, y: 27, facing: 'up' },
  ],

  'main-block-1': [
    // P5c (FB-0071): the ICL is a sealed, spaceship-like lab now (its door is a locked hatch at (9..10,14) with the scanner/EDI test console at (11,14); inside it
    // are only Alice (7,10) and the core console's key (6,10), reachable only through that door). So nobody stands in the lab, and the students who wait
    // for it stand in the CORRIDOR in front of it, clear of the hatch/scanner lane: at least 3 tiles from the hatch, the scanner and the stairwell door, and
    // never in front of them (tests/unit/story-clearance.test.js geometry, plus the sealed-door cases in tests/unit/fb-0071-icl.test.js). History: the old closet's
    // first full browser run (2026-10-03) had a student sealing its one-tile door; the rule since is geometric: idle/chat students keep at least two interact
    // ranges (3 tiles) from every key station and story NPC, and never stand in a one-tile corridor or a room's only doorway.
    // FB-0097: Niel, the owner's own line.
    { id: 'mb1-amb-icl-1', character: 'ambient-d', role: 'mtc-member', kind: 'idle', x: 15, y: 16, facing: 'left',
      name: 'Niel',
      lines: ["Yo {name}, are you coming to volunteer this weekend? I'll come pick you up in my Dodge."] },
    // FB-0051 (P2b): Mustafa, in his black and orange LUG hoodie, stands near each of the three mini-game key stations with his own
    // FIXED line (`factIds: []`: he says only these, every time). Here: the ICL (6 tiles from its key station, in the corridor outside the lab).
    { id: 'mb1-amb-icl-2', character: 'ambient-a', role: 'lug-member', kind: 'idle', x: 6, y: 17, facing: 'up', factIds: [],
      name: "Mustafa", sheet: 'npc-mustafa',
      lines: [
        "That door wants a parking test. Gently on the pedal, don't mash.",
        "My record on that parking test is embarrassing. I'm not telling.",
      ] },
    // Room 195: at the far end of the two-row room, 3.2 tiles from the teacher's desk, so the desk stays clear.
    { id: 'mb1-amb-mustafa-195', character: 'ambient-a', role: 'lug-member', kind: 'idle', x: 27, y: 4, facing: 'left', factIds: [],
      name: "Mustafa", sheet: 'npc-mustafa',
      lines: [
        "Room 195 is a climb. Bring good shoes. And a bit of patience.",
        "Look up before you go up. Things come down faster than deadlines do.",
      ] },
    // 2 in the corridor.
    // FB-0098: Krishna Nagpal (the owner's "CS student" on the first floor; both corridor walkers are the ai-student role labelled "CS student",
    // one is Prof. Elakkiya, so this is the unnamed one). The owner's own line.
    { id: 'mb1-amb-corridor-1', character: 'student-b', role: 'ai-student', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 13, y: 17 }, { x: 25, y: 17 }],
      name: 'Krishna Nagpal',
      lines: ["I'm trying to build a rocket and go to the moon."] },
    { id: 'mb1-amb-corridor-2', character: 'ambient-a', role: 'ai-student', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 8, y: 20 }, { x: 20, y: 20 }], factIds: ['CF23'],
      name: "Prof. Elakkiya", sheet: 'npc-prof-elakkiya',
      lines: [
        "Ah, {name}! Ready for a pop quiz? They say my quizzes are hard. I say they build character.",
        "Some students call me goated. I just call it a fair quiz with no mercy.",
        "Remember: no panic, and read the question twice. Maybe three times. Good luck!",
      ] },
  ],

  // The 2nd floor is a through-route to the 3rd (docs/INTERIORS_PLAN.md): the landing corridor.
  'main-block-2': [
    { id: 'mb2-amb-landing-1', character: 'ambient-a', role: 'quiz-club-member', kind: 'idle', x: 10, y: 14, facing: 'down',
      name: "Najam", sheet: 'npc-friend-najam',
      lines: [
        "Najam here. I only open my laptop when it's charged and I'm brave.",
        "I made a to-do list. Item one: stop making to-do lists.",
        "Sleep is a feature I turned off this semester. Not recommended.",
      ] },
    { id: 'mb2-amb-landing-2', character: 'student-a', role: 'cultural-club-member', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 7, y: 19 }, { x: 24, y: 19 }] },
    { id: 'mb2-amb-landing-3', character: 'ambient-a', role: 'ai-student', kind: 'idle', x: 24, y: 14, facing: 'left', factIds: ['CF22'],
      name: "Prof. Angel", sheet: 'npc-prof-angel',
      lines: [
        "Hello {name}! Yes, I'm Prof. Angel. And yes, the wings are real. Mostly.",
        "Angel is my name and patience is my superpower. Don't worry, I'll go easy. I'm an angel, not a miracle worker.",
        "If your grades are heavenly, thank the wings. If not, bless you, there's always the next exam.",
      ] },
    // 2026-10-04 (defect sweep D06): the landing is now a furnished lounge, so a chatting pair by the upper seating
    // sets and one student at the vending machine make it feel lived in. Row 14 and the lower right are open floor.
    { id: 'mb2-amb-landing-chat-1', character: 'ambient-b', role: 'quiz-club-member', kind: 'chat', x: 15, y: 14, facing: 'right', pairId: 'mb2-landing-chat' },
    { id: 'mb2-amb-landing-chat-2', character: 'ambient-f', role: 'cultural-club-member', kind: 'chat', x: 16, y: 14, facing: 'left', pairId: 'mb2-landing-chat' },
    { id: 'mb2-amb-landing-vending', character: 'ambient-d', role: 'first-year', kind: 'idle', x: 26, y: 18, facing: 'left' },
  ],

  'main-block-3': [
    // Waiting in the wide hall below, well clear of the Physics Lab key station and of the one-tile
    // corridor (x 4, rows 10-12) she climbs to reach it. Was (4,9), 2.2 tiles from the desk and standing in
    // that corridor (tests/unit/story-clearance.test.js, 2026-10-03).
    // FB-0094: Krishna Maloo, the owner's own line.
    { id: 'mb3-amb-bench', character: 'ambient-a', role: 'cs-student', kind: 'idle', x: 9, y: 20, facing: 'up',
      name: 'Krishna Maloo',
      lines: ["Did you watch the weekend's new show? It's goated."] },
    // The corridor below the lab and the stairwell landing.
    { id: 'mb3-amb-corridor-1', character: 'ambient-a', role: 'ai-student', kind: 'patrol', speed: 50, pauseMs: 800,
      waypoints: [{ x: 14, y: 19 }, { x: 27, y: 19 }],
      name: "Karthik", sheet: 'npc-friend-karthik',
      // FB-0093: the owner's own line, said in a scared way.
      lines: [
        "I'm trying to get a job right now, man... I'm scared. Help me out if you know anyone!",
      ] },
    // FB-0051 (P2b): Mustafa at the Physics Lab: 4.2 tiles from the lab bench (the key station), in the room's own top row.
    { id: 'mb3-amb-mustafa-lab', character: 'ambient-a', role: 'lug-member', kind: 'idle', x: 9, y: 4, facing: 'down', factIds: [],
      name: "Mustafa", sheet: 'npc-mustafa',
      lines: [
        "Welcome to the Physics Lab! Fair warning: gravity here is taken very seriously.",
        "Mind the jumps. I fell off three times. Okay, more.",
      ] },
    // FB-0066: students working in the lab (so it is not empty while Taru fights the shadow bat for the key). Checked against the real map
    // (tests/unit/fb-0066-hero.test.js, story-clearance.test.js): every spot is at least 3 tiles from the key bench (5,7), never on a door
    // or a one-tile lane (the desk aisles at odd x in rows 9-15 are lanes, so everyone is in the open: the two-row strip along the top wall
    // and the little three-wide nook on the right), and nobody seals anything (the top strip is also reachable by the x 4 aisle).
    // One at the bench by the pillar at the top (11,5: not (12,4), the one-tile gap beside the pillar, where she would seal the strip), a pair
    // chatting in the right-hand nook, one walking the top strip.
    // FB-0096: Roop Kumar, the lab assistant (the name tag is just his name; the line says what he is).
    { id: 'mb3-amb-lab-bench', character: 'ambient-d', role: 'cs-student', kind: 'idle', x: 11, y: 5, facing: 'right',
      name: 'Roop Kumar',
      lines: ['Hohoho, Mustafa and {name}! Lab assistant Roop here. How is the experiment coming along? I hope it is going well.'] },
    // FB-0095: Stephen (left) and Aimy (right) argue about ACM-W.
    { id: 'mb3-amb-lab-chat-1', character: 'ambient-b', role: 'quiz-club-member', kind: 'chat', x: 17, y: 13, facing: 'right', pairId: 'mb3-lab-chat',
      name: 'Stephen',
      lines: ["No! I hate ACM-W, it's not better for anyone. Don't listen to Aimy!"] },
    { id: 'mb3-amb-lab-chat-2', character: 'ambient-f', role: 'cultural-club-member', kind: 'chat', x: 18, y: 13, facing: 'left', pairId: 'mb3-lab-chat',
      name: 'Aimy',
      lines: ["Hey {name}, settle this: is ACM-W better for me? Stephen won't stop arguing."] },
    { id: 'mb3-amb-lab-walk', character: 'student-b', role: 'ai-student', kind: 'patrol', speed: 45, pauseMs: 900,
      waypoints: [{ x: 14, y: 5 }, { x: 19, y: 5 }] },
    // P4b: moved from (33,14), which is the lift's front tile (the lift doors are on x 33..34 of the stairwell's top wall), to the open floor below.
    // FB-0092: Laya, the owner's own line.
    { id: 'mb3-amb-landing-1', character: 'ambient-d', role: 'senior', kind: 'idle', x: 34, y: 19, facing: 'down',
      name: 'Laya',
      lines: ['Hi {name}, let me know if you need a ride back home. I can drop you off!'] },
  ],
};

// The entries of one map's ambient list that exist for this save: an entry with `unlessMoment` is dropped once that moment has played
// (`seenMoments`: a Set or an array of moment ids). Pure; src/scenes/world.js createAmbient() builds its sprites from the result.
function ambientEntriesFor(list, seenMoments) {
  const seen = seenMoments && typeof seenMoments.has === 'function' ? seenMoments : new Set(seenMoments || []);
  return (list || []).filter((def) => !(def.unlessMoment && seen.has(def.unlessMoment)));
}
