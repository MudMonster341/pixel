# Architecture rules

**Status:** v1, approved by the owner on 2026-09-13. This describes the target structure; the
"Today" notes say where the code still differs. Every change follows these rules, and changing a
rule needs an ADR in `decisions/`.

## The one big rule

**Content is data. The engine is code. They never mix.**

Adding a map, NPC, item, clue, chest or secret door should mean *editing data files only*. If new
content needs new engine code, the engine is missing a general feature. Add that feature once, in
a reusable way, then use it from data.

## Folder layout (target)

```
src/
  main.js              boot, Phaser config, dev-mode switch
  config.js            constants: tile size, zoom, speeds, colors, font
  core/
    events.js          the event bus + the list of every event name
    registry.js        loads + validates all content data at boot (fails loudly)
  systems/             game rules, no drawing
    state.js           GameState: the single source of truth, plain data
    inventory.js       items the player carries (shown in the backpack)
    flags.js           story flags (true/false/number)
    script.js          runs conditions and actions from data (see below)
    save.js            versioned saves through a storage adapter (see below)
  scenes/
    boot.js  world.js  ui.js
  world/               things that live in the map
    entities.js        builds entities from map data (npc, sign, chest, door, ...)
    player.js
    bubbles.js         speech bubbles and emotes above heads
  ui/                  things drawn on the screen
    minimap.js  backpack.js  hotbar.js (kept, hidden)  dialog.js  choices.js
    toast.js  tutorial.js  journal.js  questTracker.js
  data/                CONTENT, no engine logic
    items.js
    tiles.json         (generated)
    maps/meadow.js     maps/house.js  ...one file per map
    npcs/tomas.js      ...dialog scripts per NPC
    quests/main.js     the treasure hunt steps
  dev/                 dev-mode-only tools (feedback overlay). Never loaded for players
tests/
  unit/                node:test, no browser
  e2e/                 Playwright, plays the real game
tools/                 asset generator, feedback store + CLI
```

*Today:* plain `<script>` tags with shared globals. [ADR 0004](../decisions/0004-es-modules-and-data-driven-content.md)
(accepted) moves this to native ES modules, which is the first step of phase 1.

## Who talks to whom

```
 data/ ──read by──▶ systems/ ◀──calls── scenes/world ──emits events──▶ scenes/ui
                       ▲                                                   │
                       └───────────────calls (e.g. use item)───────────────┘
```

- **World** owns the map, player and entities. It never draws UI.
- **UI** draws the screen. It never moves the player or changes the map.
- **Systems** own the rules and state. They never draw anything.
- Scenes communicate through **events** on `game.events`. Every event name is declared in
  `core/events.js` and nowhere else.
- Anything that must survive a map change or a save goes in **GameState**. Nothing else stores
  progress.

## State, saving and (future) profiles

- **GameState (`src/state.js`) is plain data**, with no Phaser objects or functions except the
  `Inventory` instance (itself just an emitter over a plain `slots` array), so it turns into JSON
  almost as-is: `map`, `position` (`{x, y}` in tiles), `facing`, `inventory`, `flags`, `quest`
  (`{ stage, keys }`, the treasure hunt's progress), `collected` and `seenCutscenes` (kept live as
  `Set`s for fast lookups, turned into arrays only for saving). `WorldScene` keeps `map`/`position`/
  `facing` current every frame (`syncGameState()`), so a save always reflects where she actually is.
- **`src/save.js` is today's storage adapter**, going straight to `localStorage` under the key
  `pixelquest.save.v1.<profile>`. A save is `{ version, savedAt, profile, state }`, where `state` is
  GameState's plain-data snapshot (`snapshotState()`/`applyState()`). Game code never touches
  `localStorage` directly -- only `saveGame()`/`loadGame()`/`listProfiles()`/`deleteProfile()` do.
  A server adapter later would keep this same four-function shape.
- **Every save carries a `version`** (`SAVE_VERSION`). `loadGame()` runs it through `migrate()`;
  a version this build can't understand (older than any migration step covers, or newer than the
  build knows) makes it start fresh with a console warning instead of crashing or half-applying data.
- **One profile is one `localStorage` key.** `DEFAULT_PROFILE = 'default'`; `?profile=<name>` in the
  URL picks another. Adding a picker (or, much later, login swapping the adapter for a server one)
  means calling these same functions with a different profile string, not rewriting saves.
- **Autosave** (`initAutosave()`, called from `main.js` once the game boots) debounces a `saveGame()`
  a short moment after any of: a map change (`map-entered`), a quest/flag change
  (`state-changed`, emitted by `GameState.notifyStateChanged()`), a cutscene seen (`cutscene-seen`),
  walking (`player-moved`), or the inventory changing -- and flushes immediately on `pagehide`/
  `beforeunload` if a save is still pending, so closing the tab mid-debounce doesn't lose it.
- **At boot**, `main.js` calls `loadGame()` before creating the Phaser game (unless `?save=0`); if it
  restores a map, `BootScene` starts `WorldScene` on that map at that position/facing instead of the
  map's own spawn point. `?save=0` skips both loading and autosaving entirely, so it can't touch a
  real save -- used by default in `tests/e2e/helpers.js` so tests stay deterministic.

## Scripts: conditions and actions

All story logic is data made of **conditions** ("is this true?") and **actions** ("do this"), so
adding a line of dialog, a flag or a quest step never means touching engine code.

*Today:* built for **NPC dialog** only (`src/dialog.js`; roadmap M1). An entity-wide version of the
same idea (chests, triggers, locked doors reacting to conditions) is still to come -- when it's
built it should reuse this vocabulary rather than invent a second one.

An NPC's `dialog` (`src/maps.js`, one array per NPC) is a list of entries. `interact()`
(`src/scenes/world.js`) shows the lines of the *first* entry whose `when` matches, then runs that
entry's `actions` -- or, if the entry has `choices` instead of running its own actions right away,
shows a selectable list and runs whichever option's own `actions` the player picked.

**Conditions** (`when`; every key present must match -- there's no `all`/`any` yet):
```js
{ flag: 'tomasGaveSword' }                // truthy
{ flag: 'tomasChats', value: 2 }          // equals exactly (numbers too, e.g. a chat-cycle counter)
{ notFlag: 'tomasGaveSword' }             // falsy
{ stage: 'hunting' }                      // GameState.quest.stage === 'hunting'
{ hasItem: 'sword' }                      // holding at least one (add `count` for more)
{ hasKey: 'physicsLab' }                  // GameState.quest.keys.physicsLab is true
{ notHasKey: 'physicsLab' }               // GameState.quest.keys.physicsLab is false
{ keysCount: 2 }                          // exactly N of the treasure hunt's keys are held
{ seen: false }                           // this exact entry has never been shown before
```

**Actions** (run against GameState by `applyDialogActions()`, which calls
`GameState.notifyStateChanged()` once at the end if anything changed, so autosave picks it up):
```js
{ give: 'keycard' }                       // adds an item; if the bag is full, the rest of this
                                           // action list is skipped and a generic toast shows instead
{ setFlag: 'metVolunteer' }               // sets a flag to true
{ setFlag: { name: 'tomasChats', value: 2 } }   // sets a flag to any value
{ stage: 'hunting' }                      // GameState.quest.stage = 'hunting'
{ key: 'physicsLab' }                     // GameState.quest.keys.physicsLab = true
{ journal: 'Found a clue.' }              // appends a line to GameState.journal (src/scenes/ui.js
                                           // Journal, opened with J), oldest first, never removed
{ toast: 'The volunteer waves you over.' }
{ cutscene: 'gate2' }                     // plays a cutscene (src/cutscenes.js)
{ minigame: 'tetris' }                    // launches a mini-game (M4, see "Mini-games" below) and
                                           // *suspends* the rest of this action list until it's over
```

Locked doors/stairs (roadmap M1, `src/maplogic.js` `doorLockRule()`/`isDoorLocked()`) use a smaller,
separate condition of their own rather than the `when` vocabulary above: a map def's `doorLocks`
(`src/maps.js`) is a list of `{ match, stages? }`, matched against a door/stairs object's own Tiled
`name`. The door is open once `GameState.quest.stage` is one of `stages`; no `stages` at all means
never -- a route this game's current story doesn't use, not one merely not yet unlocked. `world.js`
`warpPoints()` resolves this and `checkWarps()` shows `lockedReason` ("Locked for the event" by
default) as a toast instead of transitioning.

A key station (docs/STORY.md, M3 -- a desk/bench interactable for one of the treasure hunt's 3 keys)
is plain `keyStations` data on a map def, the same shape idea as `npcs`: `{ id, name, item, x, y,
dialog }`. `world.js` `createKeyStations()`/`nearestInteractable()` run it through the *exact same*
`pickDialogEntry()`/`applyDialogActions()` an NPC uses -- it isn't a second dialog system, just
another kind of thing E can interact with, rendered as a bobbing item icon instead of a character.

**Examples** (`src/maps.js`, the two test-map NPCs and the real LUG volunteer/key stations, M3):
```js
// Tomas (house): a plain entry, first match wins.
dialog: [
  {
    id: 'give-sword',
    when: { notFlag: 'tomasGaveSword' },
    lines: ['Oh! A visitor!', 'Here, take my old sword.'],
    actions: [{ give: 'sword' }, { setFlag: 'tomasGaveSword' }, { toast: 'You got the Old Sword!' }],
  },
  // ...more entries, e.g. `{ when: { flag: 'tomasChats', value: 0 }, lines: [...], actions: [...] }`
],

// Guide (meadow): an entry with no `when` (always matches) that asks a `choices` question instead
// of running its own top-level `actions` -- only the picked option's own `actions` run.
dialog: [{
  id: 'ask-hint',
  lines: ['Want a hint about the meadow?'],
  choices: [
    { text: 'Yes, please!', lines: ['Try the tall grass.'], actions: [{ setFlag: 'guideHintYes' }] },
    { text: 'No thanks.', lines: ['Suit yourself.'], actions: [{ setFlag: 'guideHintNo' }] },
  ],
}],
```

The interaction bubble above an NPC (`src/scenes/world.js` `updatePrompt()`, art in
`tools/make-assets.js` `PROMPT_E`/`PROMPT_BANG`) shows **"!"** while the entry that would be shown
next has never been seen before (`hasNewDialog()`), and **"E"** once it has -- `GameState.seenDialog`
(a set of `"npcId:entryId"` keys, saved like everything else) is what remembers that across a reload.

## Mini-games (roadmap M4)

Each of the treasure hunt's 3 keys (docs/STORY.md) is guarded by a small, self-contained mini-game
instead of a plain pickup. Following this file's own top rule, the mini-games are **data** (a
registry) plus a **shared engine shell**, and each game's own play logic is pure functions the shell
never needs to know about:

- **The registry** (`src/minigames/framework-data.js`, `MINIGAMES`): `{ id, name, sceneKey,
  instructions, scoreTarget, scoreLabel }` per game -- the id a `{ minigame: 'id' }` dialog action
  names, the display name and how-to-play lines the intro card shows, the score target the HUD/win
  condition check against, and the Phaser scene key `src/main.js` registers the game's scene class
  under. Adding a 4th mini-game later means one more row here plus one new scene file, never touching
  the dialog/story/save/world code below.
- **The shell** (`src/minigames/framework-scene.js`, `MinigameBaseScene`): every mini-game scene
  extends this. It owns the parts all 3 games share -- the intro card (name, instructions, target),
  the score/target HUD, the game-over card (score, Retry, and "skip and take the key anyway" once 3
  attempts have failed), the win card, and the pause-the-world handoff (launched by
  `WorldScene.launchMinigame()` exactly the way `src/scenes/cutscene.js` is launched for a cutscene:
  `world` is paused first and resumed by this scene when it's done). A subclass only implements
  `buildScene()` (build the persistent game objects once), `startAttempt()` (reset to a fresh start,
  called on every attempt including retries) and `playUpdate(time, delta)` (per-frame gameplay), and
  calls `this.setScore(n)` / `this.win()` / `this.lose()` as the game dictates.
- **Attempts, skip and score bookkeeping** (`src/minigames/framework-data.js` `recordAttempt()`):
  pure, no Phaser -- `GameState.minigames[id]` (`{ attempts, bestScore, won, skipped }`, saved and
  restored like everything else, `src/save.js`) is updated once per finished attempt.
- **Outcome routing**: a key station's "take" dialog entry (`src/story.js`) runs `{ minigame: id }`
  *before* `{ give }`/`{ key }` -- and, unlike every other dialog action, `minigame` **suspends** the
  rest of that entry's action list (`src/dialog.js` `runDialogActionsFrom()`) until the mini-game
  framework calls back with an outcome. The story only ever sees two outcomes: `'won'` (a real win, or
  the after-3-losses skip -- both a gift, docs/STORY.md "nobody may be locked out") resumes the list,
  so the key/journal/toast actions after it finally run; `'quit'` (Esc, or "Quit" from a card, before
  winning) stops the list right there, the same as a full bag already did -- no key is ever handed
  over. `'lost'` never reaches the story at all: it's the shell's own internal retry state, since
  retrying is unlimited until one of those two terminal outcomes.
- **Each game's own file** under `src/minigames/` (`platformer.js`, `flappy.js`, `tetris.js`) only
  draws the level and forwards input; the actual rules are pure, Phaser-free modules
  (`platformer-physics.js`, `flappy-logic.js`, `tetris-logic.js`) unit-tested without a browser.
- **`?minigames=0`** (`src/maplogic.js` `minigamesEnabled()`) bypasses the real mini-game scene
  entirely and resolves a `minigame` action straight to `'won'` -- the same idea as `?cutscene=0` for
  a cutscene trigger. `tests/e2e/helpers.js` defaults every spec to this except
  `tests/e2e/minigames.spec.js`, which turns the real thing back on to test the framework itself.

## Entities (things placed on a map)

Every map object has the same basic shape: `{ id, type, x, y, when?, ... }`. `x` and `y` are in
**tiles**. `when` is a condition, and the entity only exists while it's true.

| type | What it does | Extra fields |
|---|---|---|
| `npc` | Talks, using dialog entries | `npc: 'tomas'`, `facing` |
| `sign` | Shows text when read | `text` |
| `pickup` | Item on the ground, taken on touch | `item` |
| `chest` | Opens once and gives items | `items`, `do?` |
| `door` | Walk in to change map | `to: { map, x, y, facing }` |
| `lockedDoor` | Solid until its condition is met | `opensWhen`, `lockedText`, `do?` |
| `trigger` | Invisible zone that runs actions when entered | `w`, `h`, `once`, `do` |
| `hidden` | Nothing visible until `when` becomes true (e.g. after a clue) | `item` or `do` |

Opened chests, taken pickups and one-off triggers are recorded in GameState by `id`, so they stay
done after a map change or a reload.

## Naming

- **ids:** kebab-case, globally unique, prefixed by map: `meadow-chest-1`, `house-sign`.
- **flags:** dot namespaces, `who.what`: `tomas.metPlayer`, `secretDoor.opened`.
- **tile names:** camelCase: `roofTL`, `wallWindow`.
- **events:** `noun:verb`: `map:entered`, `item:added`, `dialog:closed`.
- **feedback tests:** `FB-0007: what it guarantees`.
- **Coordinates:** tiles in data, pixels only inside the engine (`toPixel()`).

## Rules that keep it stable

1. **Validate at boot.** The content registry checks every map and script: unknown tile names,
   duplicate ids, missing items or NPCs, doors to missing maps. Show a clear message on screen,
   not a mysterious crash later.
2. **One source of truth.** A fact is stored once, in GameState or in data, never copied.
3. **Scenes are rebuildable.** The world scene can be restarted at any time from GameState + data.
   If restarting changes anything, that's a bug.
4. **No magic numbers in scenes.** Sizes, speeds and colors come from `config.js` (art colors come
   from the style guide).
5. **Small steps.** One feature per work chunk, playable at the end of each chunk, tested,
   checkpointed.
6. **Input:** one-shot actions (talk, toggle, open a menu) listen for **keydown events** and ignore
   `event.repeat`. Only held actions (movement) read `isDown`. Never poll `JustDown`: it loses taps
   shorter than one frame ([ERR-0001](../ERRORS.md)).
7. **Dev-only code lives in `src/dev/`** and is loaded only when `DEV_MODE` is on.
8. **Done means tested.** A change isn't done until `npm test` passes ([TESTING.md](TESTING.md)).
   Debug hooks stay: `window.game` exists in every build.

## How to add things (checklists)

**A new item:** add it to `data/items.js` → draw its icon in `tools/make-assets.js` →
`npm run assets` → place it as a `pickup`/`chest` entity or give it with `giveItem`.

**A new map:** create `data/maps/<name>.js` with the standard shape (`name`, `legend`, `rows`,
`spawn`, `entities`) → register it → add a `door` entity on another map that leads to it →
`npm test` (maps are checked automatically) → add a browser test that walks in.

**A new NPC:** draw the sprite (style guide: distinct colors) → create `data/npcs/<name>.js` with
dialog entries → place an `npc` entity on a map → browser test for the conversation's outcome.

**A new story step:** add flags and clues through NPC dialog actions → place the `hidden`/`chest`
entity with a `when` that uses those flags → test the step from a fresh save and from `?debug`.
