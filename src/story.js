// Story content for the LUG treasure hunt (docs/STORY.md, M3): the volunteer's dialog and the three
// key stations' dialog, kept in one place per docs/ARCHITECTURE.md ("content is data, the engine is
// code") -- src/maps.js only points at STORY.volunteer / STORY.keyStations[id], it never embeds a
// line of the owner's script itself. Loaded before src/maps.js (index.html, tests/helpers/game-data.js).
//
// Every dialog entry follows src/dialog.js's own shape ({ id, when?, lines, actions? }). `{name}` in
// a line is replaced with GameState.playerName at display time (src/dialog.js renderLines(), called
// from src/scenes/world.js interact()) -- never baked in here, since the name isn't known until the
// M3a opening's name-entry screen has run.

const STORY = {
  // The LUG volunteer (docs/STORY.md beats 5-9): stands at the stall behind the Main Block foyer's
  // staircase (src/maps.js `main-block-g`). The first talk sets the hunt going; while hunting, he
  // names the first key she's still missing, in docs/STORY.md's own room order (Physics Lab -> ICL
  // -> Room 195) -- the same rule src/maplogic.js questObjectiveText() already uses for the always-on
  // tracker panel (FB-0039: a *count*-based hint used to point her at a room she'd already done
  // whenever she found the keys out of order, e.g. physicsLab then room195 left her on "keysCount: 1"
  // -> "hint-0", sending her back to the Physics Lab desk she'd already emptied). `reward` (all 3, a
  // count check since collecting order doesn't matter once she has everyone) is listed first so it
  // always wins once she's actually done, before any per-key hint below it gets a chance to match.
  // With all 3 he calls her the first to finish and hands over the small box; the box itself opening
  // into the birthday card (docs/STORY.md "the box opens...") is the reward entry's own last action,
  // `{ boxOpening: true }`, below.
  volunteer: [
    {
      id: 'welcome',
      when: { stage: 'arrival' },
      lines: [
        "Oh, hey! You must be {name} — you just got here, right?",
        "I'm running the LUG treasure hunt today. Three keys are hidden around campus.",
        'Find all three and bring them back here — you will not regret it.',
      ],
      actions: [
        { stage: 'hunting' },
        { journal: 'The LUG volunteer asked me to find 3 keys hidden around campus.' },
        { toast: 'Quest started: find 3 keys!' },
      ],
    },
    {
      id: 'reward',
      when: { stage: 'hunting', keysCount: 3 },
      lines: [
        'Wait, all three? {name}, you are the first one to finish!',
        'Here — this is yours. Well earned.',
      ],
      actions: [
        // FB-0041b: the volunteer collects the 3 keys back from her here (docs/STORY.md: he's the one
        // who hid them and hands out the reward) -- `take` before `give` also guarantees the reward
        // box is never even attempted while the 3 key items still occupy bag slots.
        { take: 'keyPhysicsLab' },
        { take: 'keyIcl' },
        { take: 'keyRoom195' },
        { give: 'lugBox' },
        { stage: 'rewarded' },
        { journal: 'I found all 3 keys and gave them to the volunteer — I was the first to finish! He gave me a small box.' },
        { toast: 'You got the Small Box!' },
        // The ending (docs/STORY.md "the box opens..."): the box-opening sequence, then the
        // birthday card, then back to the title screen -- src/dialog.js's `boxOpening` action.
        { boxOpening: true },
      ],
    },
    {
      id: 'hint-0',
      when: { stage: 'hunting', notHasKey: 'physicsLab' },
      lines: [
        "Still looking, {name}? The first key's in the Physics Lab, up on the 3rd floor.",
        "Stairs or the lift, your pick. The lift is quicker, the stairs are free!",
      ],
    },
    {
      id: 'hint-1',
      when: { stage: 'hunting', notHasKey: 'icl' },
      lines: ['One down, two to go! Try the ICL — the computing lab on the 1st floor.'],
    },
    {
      id: 'hint-2',
      when: { stage: 'hunting', notHasKey: 'room195' },
      lines: ['Almost there — the last one is in Room 195.'],
    },
    {
      id: 'after-reward',
      when: { stage: 'rewarded' },
      lines: ['Enjoy your prize, {name}. You really earned it.'],
    },
  ],

  // The three key rooms (docs/STORY.md "Key rooms" table): a desk/bench interactable, not a floor
  // pickup -- pressing E starts the room's own moment. `minigame` names the real M4 mini-game this
  // key is won from (hero fight / EDI Madness's door / tower, per the table, src/minigames/) -- the `take` entry
  // below runs it *before* `give`/`key` (src/dialog.js's `minigame` action suspends the rest of the
  // list until the mini-game reports an outcome), so the key/journal/toast lines only fire once she's
  // actually won it (or taken the after-3-losses skip gift, docs/STORY.md "nobody may be locked out").
  keyStations: {
    physicsLab: {
      name: 'Physics Lab',
      minigame: 'hero',
      item: 'keyPhysicsLab',
      takenLine: 'A small brass key sits on the lab bench, tagged "LUG hunt".',
      journal: 'Found a key on a bench in the Physics Lab.',
      doneLine: 'The bench is empty now — you already took this key.',
    },
    // P5c (FB-0071): the ICL is a locked lab. Its mini-game (EDI Madness, ADR 0025; it was the flyer "ICL Fingerprint Hack") opens the DOOR (STORY.iclGate
    // below), so this station has no `minigame` of its own: the key lies in the lab's core console, next to Alice, who hands it over too.
    icl: {
      name: 'ICL',
      item: 'keyIcl',
      takenLine: "The lab's core console holds a small key, tagged \"LUG hunt\".",
      journal: 'Found a key in the core console of the ICL.',
      doneLine: "The console's key slot is empty now.",
    },
    room195: {
      name: 'Room 195',
      minigame: 'tower',
      item: 'keyRoom195',
      takenLine: "A key rests on the teacher's desk at the front of Room 195.",
      journal: "Found a key on the teacher's desk in Room 195.",
      doneLine: 'The desk is bare now — you already have this key.',
    },
  },
};

// P5c (FB-0071, reworded for EDI Madness, ADR 0025): the ICL's locked door, all content. src/maps.js points the `main-block-1` map def at it (`gates`), the generated map
// (tools/interiors/plans.js mainBlock1) carries the `sealedDoor` and `scanner` objects it names. E at the scanner asks the mini-game to open the
// door (a win, or the framework's skip after 3 losses, both report 'won'); Esc leaves it sealed, and she can come back any time. The flag it sets,
// `iclDoorOpen`, is saved with everything else and keeps the door open for good. `openIfKey`/`openIfStage`/`room` are the soft-lock guards: a save
// that already holds the ICL key, is past it, or was standing inside the lab never starts with the door shut (src/save.js, src/scenes/world.js).
const STORY_ICL_FLAG = 'iclDoorOpen';
STORY.iclGate = {
  map: 'main-block-1',
  door: 'ICL door',
  scanner: 'ICL scanner',
  flag: STORY_ICL_FLAG,
  minigame: 'edi', // ADR 0025: EDI Madness (parking). ROLLBACK to the flyer = change this and the scannerDialog's `{ minigame: 'edi' }` below back to 'flappy' (flappy.js stays, unreachable).
  openIfKey: 'icl',
  openIfStage: ['rewarded'],
  room: { x0: 4, y0: 4, x1: 15, y1: 13 },
  lockedLine: 'Sealed. Parking test required.',
  // E at the hatch itself (never starts the game; the scanner is the thing to use).
  doorDialog: [
    { id: 'sealed', when: { notFlag: STORY_ICL_FLAG }, lines: ['Sealed. Parking test required.', 'The EDI test console beside the door is the way in.'] },
    { id: 'open', lines: ['The hatch is open. The lab hums quietly beyond it.'] },
  ],
  // E at the scanner (still the `scanner` object; to the player it is the EDI test console): the parking test, then the door opens.
  scannerDialog: [
    {
      id: 'scan',
      when: { notFlag: STORY_ICL_FLAG },
      lines: ['The console beeps. The door only opens for someone who can park.'],
      actions: [
        { minigame: 'edi' }, // ADR 0025 rollback: 'flappy' (see `minigame` above)
        { setFlag: STORY_ICL_FLAG },
        { journal: 'Passed the EDI parking test: the ICL door is open.' },
        { toast: 'Test passed. The ICL door opens.' },
      ],
    },
    { id: 'done', lines: ['Test passed. The door is open.'] },
  ],
};

// FB-0077: the Gate 2 boom barrier opens by itself when she comes near it and then stays up for good. All data: src/maps.js points the campus def at
// it (`gateBarrier`), the generated campus carries the `gateBarrier` objects (tools/campus/build-campus.js, frames from tools/lib/door-kinds.js).
// `range`: tiles from the barrier at which it starts to rise; `frameMs`: how long each of its frames (lowered, half, up) lasts, so about 0.6 s in
// all; `flag` is saved with everything else. `openIfCutscene`/`openIfStage`/`map`: a save that has already played the Gate 2 welcome, begun the hunt or
// stands inside a building loads with the barrier up (src/save.js, maplogic.js isGateBarrierOpen()).
STORY.gateBarrier = {
  map: 'campus',
  flag: 'gateBarrierOpen',
  range: 4,
  frameMs: 300,
  openIfCutscene: 'gate2',
  openIfStage: ['hunting', 'rewarded'],
};

// P5c (FB-0071): Alice, the ICL's robot. Greets her the first time (explains the lab in two short lines and hands over the key, on the same
// actions the core console uses, so whichever of the two she talks to first gives it), then a few light lines in order, then a last one on repeat.
STORY.alice = [
  {
    id: 'welcome',
    when: { notHasKey: 'icl' },
    lines: [
      "Welcome to the ICL, {name}! I'm Alice. I run 4,096 threads and still lose to the coffee machine.",
      'Those racks crunch the numbers, the holo table draws them, and I try to look useful.',
      'You parked your way through my front door, so this is yours: the LUG key from my core console. Take it!',
    ],
    actions: [
      { key: 'icl' },
      { give: 'keyIcl' },
      { journal: 'Alice, the ICL robot, gave me the key after I parked my way through her door.' },
      { toast: 'You got the ICL key!' },
    ],
  },
  { id: 'chat-1', when: { hasKey: 'icl', seen: false }, lines: ['The key found a good home, I hope. Keys are my second favourite thing. Coffee is first, sadly.'] },
  { id: 'chat-2', when: { hasKey: 'icl', seen: false }, lines: ["Fun fact: the globe over the table is just the lab's Wi-Fi, drawn dramatically."] },
  { id: 'chat-3', when: { hasKey: 'icl', seen: false }, lines: ["My battery says I'm at 100 percent. My mood says snack break."] },
  { id: 'chat-end', when: { hasKey: 'icl' }, lines: ['Good luck with the other keys, {name}. Come back whenever the Wi-Fi gets lonely.'] },
];

// Turns a STORY.keyStations[keyId] entry into the same { id, when, lines, actions } dialog-entry
// shape src/dialog.js already knows how to run -- a key station is interacted with through the exact
// same pickDialogEntry()/applyDialogActions() code path an NPC uses (docs/ARCHITECTURE.md "content
// is data"), not a second, parallel mechanism. `keyId` is one of GameState.quest.keys' own property
// names ('physicsLab'/'icl'/'room195', src/state.js), reused directly as both the `hasKey`/
// `notHasKey` condition and (in src/maps.js) the key station entity's own `id`.
function keyStationDialog(keyId) {
  const def = STORY.keyStations[keyId];
  return [
    {
      id: 'take',
      when: { notHasKey: keyId },
      lines: [def.takenLine],
      // FB-0041b: `key` (quest progress) now runs *before* `give` (the physical item) -- so the
      // treasure hunt itself always advances the instant the mini-game is won, even in the
      // unreachable-today-but-still-worth-guarding-against case the bag were somehow full right at
      // that moment (a full bag only ever stops the *rest* of this list, src/dialog.js `give`).
      actions: [
        // P5c: a station with no `minigame` (the ICL's, whose game opens the lab's door instead) just hands the key over.
        ...(def.minigame ? [{ minigame: def.minigame }] : []),
        { key: keyId },
        { give: def.item },
        { journal: def.journal },
        { toast: `You got the ${def.name} key!` },
      ],
    },
    {
      id: 'done',
      when: { hasKey: keyId },
      lines: [def.doneLine],
    },
  ];
}
