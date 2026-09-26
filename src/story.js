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
  // names the first key she's still missing, in docs/STORY.md's own room order (Physics Lab -> ICVL
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
        { take: 'keyIcvl' },
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
        "The lift's just for show — take the stairs!",
      ],
    },
    {
      id: 'hint-1',
      when: { stage: 'hunting', notHasKey: 'icvl' },
      lines: ['One down, two to go! Try the ICVL — the computing lab on the 1st floor.'],
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
  // key is won from (platformer / flappy / tetris, per the table, src/minigames/) -- the `take` entry
  // below runs it *before* `give`/`key` (src/dialog.js's `minigame` action suspends the rest of the
  // list until the mini-game reports an outcome), so the key/journal/toast lines only fire once she's
  // actually won it (or taken the after-3-losses skip gift, docs/STORY.md "nobody may be locked out").
  keyStations: {
    physicsLab: {
      name: 'Physics Lab',
      minigame: 'platformer',
      item: 'keyPhysicsLab',
      takenLine: 'A small brass key sits on the lab bench, tagged "LUG hunt".',
      journal: 'Found a key on a bench in the Physics Lab.',
      doneLine: 'The bench is empty now — you already took this key.',
    },
    icvl: {
      name: 'ICVL',
      minigame: 'flappy',
      item: 'keyIcvl',
      takenLine: 'A key is taped under one of the computer benches, next to a sticky note: "LUG hunt".',
      journal: 'Found a key taped under a bench in the ICVL.',
      doneLine: 'Just the empty sticky note is left here now.',
    },
    room195: {
      name: 'Room 195',
      minigame: 'tetris',
      item: 'keyRoom195',
      takenLine: "A key rests on the teacher's desk at the front of Room 195.",
      journal: "Found a key on the teacher's desk in Room 195.",
      doneLine: 'The desk is bare now — you already have this key.',
    },
  },
};

// Turns a STORY.keyStations[keyId] entry into the same { id, when, lines, actions } dialog-entry
// shape src/dialog.js already knows how to run -- a key station is interacted with through the exact
// same pickDialogEntry()/applyDialogActions() code path an NPC uses (docs/ARCHITECTURE.md "content
// is data"), not a second, parallel mechanism. `keyId` is one of GameState.quest.keys' own property
// names ('physicsLab'/'icvl'/'room195', src/state.js), reused directly as both the `hasKey`/
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
        { minigame: def.minigame },
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
