// The world: maps, buildings, items lying around, NPCs, and doors between maps.
// Each map row is text, 1 character = 1 tile (16x16 px). `legend` turns characters into tile
// names (all tile names are listed in assets/tiles.json). All positions are in tiles.

const START_MAP = 'meadow';

// Multi-tile buildings, stamped onto a map at a position (rows of tile names).
const STRUCTURES = {
  house: [
    ['roofTL', 'roofT', 'roofT', 'roofT', 'roofTR'],
    ['eaveL', 'eave', 'eave', 'eave', 'eaveR'],
    ['wallL', 'houseWindow', 'wall', 'houseWindow', 'wallR'],
    ['wallL', 'wall', 'door', 'wall', 'wallR'],
  ],
};

const MAPS = {
  meadow: {
    name: 'Meadow',
    legend: {
      '.': 'grass', ',': 'grass2', '*': 'flowers', '"': 'tallgrass',
      '=': 'path', '~': 'water', T: 'tree', o: 'rock',
    },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T.,....,.,.....,==.....................T',
      'T.TTT.,,...,..,.==....,.,,....~~~~~.,.,T',
      'T.TTT......T,.*.==,."""""""..~~~~~~~...T',
      'T..T,......,.,..==.,"""""""..~~~~~~~..,T',
      'T....,....,,,,,,==*,"""""""..~~~~~~~.,.T',
      'T,.....,..,,.,..==.."""""""..~~~~~~~...T',
      'T,......TT.,....==.."""""""...~~~~~.,,.T',
      'T.,.o.,,TT...,..==.....,,..........,...T',
      'T,......TT.,.,,.==,.....,,..,...,,,....T',
      'T........,,.....==,,..T.,,,..,*...TTTT.T',
      'T,....o.........==.......,......,.TTTT.T',
      'T.........*.....==.*.....,*,.......,,,.T',
      'T...,...,..=....==.,.......,,........,.T',
      'T..==================================..T',
      'T.,==================================,,T',
      'T......,,..,.....,....,.,...==...,,,*..T',
      'T..,.*..,..,.o.........,,o,.==........,T',
      'T..................,......,.==,..,.....T',
      'T...,.,~~~~~~~~.,...,,.,..,.==,.""""",,T',
      'T.,.,,~~~~~~~~~~.,,..,..,...==,."""""..T',
      'T.,...~~~~~~~~~~..,.,.,,....==..""""",,T',
      'T.,,..~~~~~~~~~~....TTT,,...==,."""""..T',
      'T..,..~~~~~~~~~~....TTT..,..==..""""",.T',
      'T...,.~~~~~~~~~~..,.....,,..==.."""""..T',
      'T,....,~~~~~~~~.,..,,.....,.==,....,...T',
      'TTTTTT......,.,....o...*....==......,..T',
      'TTTTTT.,.,,,*...,.,......,..==.,...,.o.T',
      'TTTTTT....,......,........,...,.,......T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
    spawn: { x: 17, y: 12, facing: 'down' },
    structures: [{ type: 'house', x: 9, y: 9 }],
    // Step on a warp tile to go to another map. The house door is at (11, 12).
    warps: [{ x: 11, y: 12, to: 'house', spawn: { x: 9.5, y: 10, facing: 'up' } }],
    pickups: [
      { id: 'meadow-apple-1', item: 'apple', x: 20, y: 12 },
      { id: 'meadow-apple-2', item: 'apple', x: 6, y: 17 },
      { id: 'meadow-potion', item: 'potion', x: 24, y: 8 },
      { id: 'meadow-gem', item: 'gem', x: 34, y: 21 },
    ],
    npcs: [],
  },

  house: {
    name: "Tomas's House",
    legend: {
      '^': 'wallUpper', '|': 'wallLower', W: 'wallWindow', B: 'bookshelf', E: 'edge',
      '.': 'floor', r: 'rug', t: 'table', h: 'bedHead', f: 'bedFoot', p: 'plant',
      m: 'doormat', d: 'doorway',
    },
    rows: [
      'E^^^^^^^^^^^^^^^^^^E',
      'E||W||BB||||W|||B||E',
      'Eh.................E',
      'Ef...........p.....E',
      'E..................E',
      'E.....rrrrrr.......E',
      'E.....rrrrrr...t...E',
      'E.....rrrrrr.......E',
      'Ep.................E',
      'E..................E',
      'E........mm.......pE',
      'EEEEEEEEEddEEEEEEEEE',
    ],
    spawn: { x: 9.5, y: 10, facing: 'up' },
    warps: [
      { x: 9, y: 11, to: 'meadow', spawn: { x: 11, y: 13, facing: 'down' } },
      { x: 10, y: 11, to: 'meadow', spawn: { x: 11, y: 13, facing: 'down' } },
    ],
    pickups: [{ id: 'house-potion', item: 'potion', x: 3, y: 5 }],
    npcs: [{ id: 'tomas', name: 'Tomas', x: 8, y: 4, facing: 'down', talk: talkToTomas }],
  },
};

// An NPC's `talk` returns the lines to show, plus an optional `onEnd` that runs when the
// conversation closes and may return a message to pop up on screen.
function talkToTomas(state) {
  if (!state.flags.tomasGaveSword) {
    return {
      lines: [
        'Oh! A visitor! Nobody has knocked on my door in a long time.',
        "I'm Tomas. I've looked after this meadow for sixty years.",
        'You look like an adventurer. Here, take my old sword.',
        'My back is too stiff to swing it these days. Look after it!',
      ],
      onEnd: () => {
        if (!state.inventory.add('sword')) return 'Your bag is full!';
        state.flags.tomasGaveSword = true;
        return 'You got the Old Sword!';
      },
    };
  }

  const chats = [
    ['I hear strange noises past the trees at night...', 'Keep that sword close.'],
    ["I've dropped a few things around the meadow over the years.", 'Try the tall grass. Things love to hide in there.'],
    ['The lake to the south is lovely at sunset.', 'Far too cold for swimming, mind you.'],
  ];
  const lines = chats[state.flags.tomasChats % chats.length];
  state.flags.tomasChats++;
  return { lines };
}
