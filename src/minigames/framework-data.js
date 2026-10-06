// Mini-game registry and pure outcome/attempt/score bookkeeping (docs/ROADMAP.md M4,
// docs/ARCHITECTURE.md "content is data, the engine is code"). The three mini-games (docs/STORY.md)
// are DATA here -- id, display name, how-to-play lines and the score target, plus which Phaser scene
// key actually plays it -- so adding a fourth one later means one more table row and one new scene
// file, not touching the dialog/story/save code that already knows how to run a `minigame` dialog
// action end to end (src/dialog.js, src/scenes/world.js launchMinigame(), src/scenes/ui.js).
//
// No Phaser anywhere in this file on purpose: tests/helpers/game-data.js loads it straight into the
// same plain node:test sandbox as state.js/dialog.js, so the attempt/skip/score rules below are unit
// tested without a browser. The actual on-screen shell (the intro/game-over/win cards, the HUD) is
// src/minigames/framework-scene.js's `MinigameBaseScene`, a real `Phaser.Scene` that only a browser
// can load -- it calls the pure functions here, never duplicates their logic.

// docs/STORY.md "you can retry as often as you like... a skip after 3 tries so the gift can never be
// blocked by a hard game": once an attempt has failed this many times (and she still hasn't won), the
// mini-game's own game-over card offers "skip and take the key anyway".
const MAX_ATTEMPTS_BEFORE_SKIP = 3;

// FB-0073: an intro card is a title, a controls line and a goal line -- nothing else (the owner: "instructions look
// messy, too much text"). At the card's 12 px monospace font this many characters fit the card without wrapping.
const MG_INSTRUCTION_LINES = 2;
const MG_INSTRUCTION_MAX_CHARS = 42;

// `instructions` (FB-0073): exactly the intro card's two body lines under its title -- a controls line and a goal
// line, short enough to read at a glance, never a paragraph (MG_INSTRUCTION_MAX_CHARS, tests/unit/minigame-
// framework.test.js). The score target the HUD counts to is `scoreTarget`; the goal line may name it.
// `cards` (optional): the win/skip/game-over card wording for a game that does not hand over a key (flappy opens a door): winTitle, winLine, skipTitle,
// skipLine, skipLabel, skipHint. A game without it (hero, tower) says the key lines. `opens` (optional): the GameState flag its story entry sets.
// `story` (optional, FB-0082): a short backstory shown before the intro card, once per opening of the game (never again after a retry): `pages` are
// 3-4 short beats (`{name}` = the player's name), `cover` the picture behind them (a texture key the game's own preload() loads). See minigameStoryPages() below.
// `item` names the real key item this mini-game's win hands over (src/items.js), the same id
// src/story.js's own keyStations table gives that key station -- duplicated here (rather than one
// file importing the other) because a mini-game is meant to be playable/testable on its own, without
// pulling in the whole story, but the two are kept in sync deliberately: tests/unit/minigame-
// framework.test.js asserts every `item` here matches STORY.keyStations' own `item` for the same id,
// so the two data files drifting apart is a caught regression, not a silent bug. Used only for the
// win card's key-icon flourish (src/minigames/framework-scene.js `addWinKeyIcon()`) -- awarding the
// key for real is still entirely src/dialog.js's `minigame` action's job, this is decoration.
const MINIGAMES = {
  // FB-0066: the Physics Lab's game is the hero fight (src/minigames/hero.js + hero-logic.js): a masked kitten hero (a generic stand-in) against a
  // dark bat-eared "shadow bat" who shoots at her, with a roaming minion; it replaced the old run-and-collect platformer. The score is the hits she
  // has landed on him (he takes scoreTarget = HV_VILLAIN_HP of them); the win is beating him and taking the key he drops. `cover` is the picture
  // behind the intro card (tools/make-minigame-art.js hero-cover.png): the card sits at the bottom of the screen so the cover shows above it.
  hero: {
    id: 'hero',
    name: 'Physics Lab Showdown',
    sceneKey: 'minigame-hero',
    item: 'keyPhysicsLab',
    cover: { key: 'hero-cover', file: 'assets/minigames/hero-cover.png' },
    instructions: [
      'ARROWS: MOVE  SPACE: JUMP  CLICK/Z: SHOOT', // FB-0081: the left mouse click shoots, Z still works
      'BEAT THE SHADOW BAT: 9 HITS',
    ],
    scoreTarget: 9,
    scoreLabel: 'HITS',
  },
  // ROLLBACK ONLY (ADR 0025): unreachable from the story now (STORY.iclGate starts 'edi'); point it back at 'flappy' to ship the flyer again.
  // P5c (FB-0071): the ICL is a locked lab, and this flyer was the hack that opened its DOOR (src/story.js STORY.iclGate: the scanner's `minigame`
  // action, then the `iclDoorOpen` flag). It no longer awards a key, so it has no `item` (no key icon on its win card); `opens` names the flag it sets, and
  // `cards` words its win, skip and game-over cards for a door instead of a key (framework-scene.js MinigameCard). It was "ICL Server Dash".
  flappy: {
    id: 'flappy',
    name: 'ICL Fingerprint Hack',
    sceneKey: 'minigame-flappy',
    opens: 'iclDoorOpen',
    instructions: [
      'SPACE: FLAP',
      'SLIP THROUGH 8 FIREWALLS TO CRACK THE SCAN',
    ],
    scoreTarget: 8,
    scoreLabel: 'HACK',
    cards: {
      winTitle: 'SCAN CRACKED!',
      winLine: 'Scan cracked. Access granted!',
      skipTitle: 'DOOR UNLOCKED!',
      skipLine: 'The lab door opens anyway -- nice try.',
      skipLabel: 'SKIP -- OPEN THE DOOR ANYWAY',
      skipHint: "You've tried 3 times -- open the door anyway if you'd rather move on.",
    },
  },
  // FB-0074: Room 195's game is the tower climb (a "reverse Rapunzel", src/minigames/tower.js + tower-logic.js); it replaced the
  // old falling-blocks game.
  // The score is the floor she has reached (the tower has scoreTarget floors); the win is reaching the prince at the top.
  tower: {
    id: 'tower',
    name: 'Room 195 Tower Rescue',
    sceneKey: 'minigame-tower',
    item: 'keyRoom195',
    instructions: [
      'ARROWS: RUN / CLIMB   SPACE: JUMP',
      'CLIMB TO FLOOR 5 AND SAVE THE PRINCE',
    ],
    scoreTarget: 5,
    scoreLabel: 'FLOOR',
    // FB-0082: the prince is stuck in Rapunzel's tower; she is the one who rescues him. Drawn over the tower's own backdrop (tower.js drawStoryArt()).
    story: {
      cover: { key: 'tower-bg' },
      pages: [
        "Once upon a time, a prince got stuck at the top of Rapunzel's very tall tower.",
        'His pet chameleon could not open the door, and the grumpy gargoyle guarding it throws barrels and flower pots at visitors.',
        'So the princess ({name}) decided to do the rescuing, for once. Climb the ladders, dodge the barrels and pots, and reach the window!',
        'Ready? The tower is waiting.',
      ],
    },
  },
  // ADR 0025 (EDI Madness, phase E3): garage parking with a driving instructor (src/minigames/edi.js + edi-logic.js). It is built to replace the flyer at the
  // ICL scanner, so like the flyer it opens the lab's DOOR (`opens: 'iclDoorOpen'`, no key `item`, `cards` for the door wording); since phase E4 the
  // scanner starts it (STORY.iclGate), and the flyer above is the unreachable rollback. The score is the stages parked (scoreTarget 3). The intro
  // card has no subtitle slot, so "Garage parking with your instructor" is not shown (the cover picture says GARAGE PARKING under the title).
  edi: {
    id: 'edi',
    name: 'EDI MADNESS',
    sceneKey: 'minigame-edi',
    opens: 'iclDoorOpen',
    cover: { key: 'edi-cover', file: 'assets/minigames/edi-cover.png' },
    instructions: [
      'ARROWS/WASD: DRIVE  SPACE: HANDBRAKE',
      'PARK 3 TIMES WITHOUT HITTING A PILLAR',
    ],
    scoreTarget: 3,
    scoreLabel: 'PARKED',
    cards: {
      winTitle: 'PERFECT PARKING!',
      winLine: 'Your instructor would pass you. The ICL door opens!',
      skipTitle: 'DOOR UNLOCKED!',
      skipLine: 'The lab door opens anyway -- nice try.',
      skipLabel: 'SKIP -- OPEN THE DOOR ANYWAY',
      skipHint: "You've tried 3 times -- open the door anyway if you'd rather move on.",
    },
    // FB-0082 mechanism: a short backstory over the intro cover before the intro card (once per opening, never after a retry).
    story: {
      cover: { key: 'edi-cover' },
      pages: [
        "The ICL's sealed door wants proof of EDI-level parking skills.",
        'Your instructor has strapped himself in. He looks nervous.',
        'Park three times without crushing a pillar. Ready?',
      ],
    },
  },
};

// A fresh per-game progress record (docs/ARCHITECTURE.md "State, saving"): saved as
// GameState.minigames[id] (src/state.js, src/save.js), the same way quest/flags are.
function freshMinigameProgress() {
  return { attempts: 0, bestScore: 0, won: false, skipped: false };
}

// Lazily creates GameState.minigames[id] the first time it's touched, so an older save (from before
// M4 shipped) never needs its own migration step -- same reasoning as src/save.js applyState()
// falling back to defaults for any field an old save doesn't have.
function minigameProgress(state, id) {
  if (!state.minigames) state.minigames = {};
  if (!state.minigames[id]) state.minigames[id] = freshMinigameProgress();
  return state.minigames[id];
}

// Called once per finished attempt (a real win, a loss, or the after-3-losses skip), *before* the
// outcome reaches the story (src/dialog.js's `minigame` action only ever sees 'won' or 'quit' --
// see src/minigames/framework-scene.js's file header for why 'lost' never leaves this shell).
// `outcome` is 'won' | 'lost' | 'skipped'. Returns the updated record plus `canSkip`: whether the
// mini-game's own game-over card should now offer "skip and take the key anyway" (docs/STORY.md
// "nobody may be locked out") -- true once she's lost MAX_ATTEMPTS_BEFORE_SKIP times and still
// hasn't won.
function recordAttempt(state, id, outcome, score) {
  const progress = minigameProgress(state, id);
  progress.bestScore = Math.max(progress.bestScore, score || 0);
  if (outcome === 'won' || outcome === 'skipped') {
    progress.won = true;
    progress.skipped = outcome === 'skipped';
  } else {
    progress.attempts += 1;
  }
  notifyStateChanged(); // src/save.js autosaves soon after, same as every other GameState change
  return { progress, canSkip: !progress.won && progress.attempts >= MAX_ATTEMPTS_BEFORE_SKIP };
}

// Not used by the shipped game (a key station is only ever played until it's won), but kept for
// symmetry and for tests that want to start a scenario from a clean slate without touching the rest
// of GameState.
function resetMinigameProgress(state, id) {
  if (!state.minigames) state.minigames = {};
  state.minigames[id] = freshMinigameProgress();
}

// ---------- the backstory before a game's intro card (FB-0082, pure so a unit test can drive it) ----------
// Each page advances with Enter / E / Space / a click (the card's own keys), and also by itself after MG_STORY_AUTO_MS so nobody is ever stuck on one.
// Esc quits as everywhere else; "SKIP STORY" is the second button on every page.
const MG_STORY_AUTO_MS = 6000;

// The pages of a game's backstory with `{name}` filled in ([] for a game without one). With no name the "({name})" aside is dropped.
function minigameStoryPages(def, playerName) {
  const pages = def && def.story && Array.isArray(def.story.pages) ? def.story.pages : [];
  const name = typeof playerName === 'string' ? playerName.trim() : '';
  return pages.map((page) => (name
    ? page.replace(/\{name\}/g, name)
    : page.replace(/ \(\{name\}\)/g, '').replace(/\{name\}/g, '')));
}

// { index, ms, count, done }: which page is up and for how long. done is true once the last page has been left (or there were none).
function createStoryState(pageCount) {
  return { index: 0, ms: 0, count: pageCount, done: pageCount <= 0 };
}

// A key or click: on to the next page (and done after the last one).
function storyAdvance(story) {
  if (story.done) return story;
  story.index += 1;
  story.ms = 0;
  if (story.index >= story.count) story.done = true;
  return story;
}

// Time passing on a page: after MG_STORY_AUTO_MS it turns by itself.
function storyTick(story, dtMs) {
  if (story.done) return story;
  story.ms += Math.max(0, dtMs);
  if (story.ms >= MG_STORY_AUTO_MS) storyAdvance(story);
  return story;
}

// ---------- the win card's layout numbers (pure, so a unit test can check the spacing) ----------
// src/minigames/framework-scene.js MinigameCard.show() lays a card out in rows: a title header, then one text row per
// paragraph line, `MG_CARD_LINE_H` apart, the first one `MG_CARD_HEADER_H` below the panel's top (each row's CENTRE).
// The win card puts the key icon in the blank rows above its message. Defect D09 (2026-10-04): with only two blank rows
// the 48 px icon (a 16 px frame at 3x) reached 24 px below its centre and covered the first line of the message
// ("IC.L" for the ICL key). Three blank rows leave a clear gap, for all three mini-games.
const MG_CARD_LINE_H = 22;
const MG_CARD_HEADER_H = 56;
// FB-0073: the card is as wide as its longest line plus MG_CARD_SIDE_PAD (50 px of margin either side), never narrower than
// MG_CARD_MIN_W nor wider than MG_CARD_MAX_W (a longer paragraph wraps at MAX - PAD instead).
const MG_CARD_MAX_W = 640;
const MG_CARD_MIN_W = 420;
const MG_CARD_SIDE_PAD = 100;
const MG_WIN_BLANK_LINES = 3;
const MG_WIN_ICON_SIZE = 48;
const MG_CARD_TEXT_HALF_HEIGHT = 8; // a 12 px line of text reaches about this far above/below its row centre

// Where the key icon sits and where the message row is, relative to the panel's top edge `boxY`.
function winCardLayout(boxY) {
  const iconCenterY = boxY + MG_CARD_HEADER_H + MG_CARD_LINE_H;
  const messageCenterY = boxY + MG_CARD_HEADER_H + MG_WIN_BLANK_LINES * MG_CARD_LINE_H;
  return {
    iconCenterY,
    iconTop: iconCenterY - MG_WIN_ICON_SIZE / 2,
    iconBottom: iconCenterY + MG_WIN_ICON_SIZE / 2,
    messageCenterY,
    messageTop: messageCenterY - MG_CARD_TEXT_HALF_HEIGHT,
  };
}
