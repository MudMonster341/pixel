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

// `item` names the real key item this mini-game's win hands over (src/items.js), the same id
// src/story.js's own keyStations table gives that key station -- duplicated here (rather than one
// file importing the other) because a mini-game is meant to be playable/testable on its own, without
// pulling in the whole story, but the two are kept in sync deliberately: tests/unit/minigame-
// framework.test.js asserts every `item` here matches STORY.keyStations' own `item` for the same id,
// so the two data files drifting apart is a caught regression, not a silent bug. Used only for the
// win card's key-icon flourish (src/minigames/framework-scene.js `addWinKeyIcon()`) -- awarding the
// key for real is still entirely src/dialog.js's `minigame` action's job, this is decoration.
const MINIGAMES = {
  platformer: {
    id: 'platformer',
    name: 'Physics Lab Trial',
    sceneKey: 'minigame-platformer',
    item: 'keyPhysicsLab',
    instructions: [
      'ARROWS / A-D to run, SPACE / UP / W to jump.',
      'Collect all the charge cells, then reach the door.',
      'Hold the jump key a little longer for a higher jump.',
    ],
    scoreTarget: 6,
    scoreLabel: 'CELLS',
  },
  flappy: {
    id: 'flappy',
    name: 'ICVL Server Dash',
    sceneKey: 'minigame-flappy',
    item: 'keyIcvl',
    instructions: [
      'SPACE / UP / W: flap. Fly through the gaps in the server racks.',
      'One tap at a time -- timing beats mashing.',
    ],
    scoreTarget: 8,
    scoreLabel: 'GAPS',
  },
  tetris: {
    id: 'tetris',
    name: 'Room 195 Stack-Off',
    sceneKey: 'minigame-tetris',
    item: 'keyRoom195',
    instructions: [
      'ARROWS / A-D to move, UP / W to rotate, DOWN / S to drop faster.',
      'Clear lines before the stack reaches the top.',
      'It speeds up the longer you last.',
    ],
    scoreTarget: 10,
    scoreLabel: 'LINES',
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
