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
{ take: 'keyPhysicsLab' }                 // removes one of that item from the inventory (FB-0041b),
                                           // never blocks the rest of the list even if none is held
{ setFlag: 'metVolunteer' }               // sets a flag to true
{ setFlag: { name: 'tomasChats', value: 2 } }   // sets a flag to any value
{ stage: 'hunting' }                      // GameState.quest.stage = 'hunting'
{ key: 'physicsLab' }                     // GameState.quest.keys.physicsLab = true
{ journal: 'Found a clue.' }              // appends a line to GameState.journal (src/scenes/ui.js
                                           // Journal, opened with J), oldest first, never removed
{ toast: 'The volunteer waves you over.' }
{ cutscene: 'gate2' }                     // plays a cutscene (src/cutscenes.js)
{ minigame: 'tower' }                     // launches a mini-game (M4, see "Mini-games" below) and
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
- **Each game's own file** under `src/minigames/` (`hero.js`, `flappy.js`, `tower.js`) only
  draws the level and forwards input; the actual rules are pure, Phaser-free modules
  (`platformer-physics.js`, `hero-logic.js`, `flappy-logic.js`, `tower-logic.js`) unit-tested without a browser.
  The Physics Lab's game is the hero fight (FB-0066): a masked kitten hero (a generic stand-in) against a bat-eared "shadow bat" who
  shoots at her in telegraphed volleys, plus a roaming minion; `hero-logic.js` holds the whole round as a pure function of the inputs
  (nothing random: the volley plan, the wind-up, hearts and the 1.5 s invulnerability, the shield, the minion and its one heart, the key,
  the 150 s failsafe) on top of `platformer-physics.js`'s feel helpers; the left mouse click shoots (FB-0081; Z works too). Its intro card sits on a cover picture (`def.cover`,
  `hero-cover.png`) that the shell draws behind a card moved to the bottom of the screen.
  Room 195's game is the tower climb (a "reverse Rapunzel", FB-0074): `tower-logic.js` holds the whole
  round as a pure function of a seed and the inputs (ladders, the seeded gargoyle throws, rolling and
  dropping hazards, hearts, the win zone, the 150 s failsafe) on top of `platformer-physics.js`'s feel
  helpers; `tools/make-minigame-art.js` reads its level numbers so the painted beams sit where the rules put them.
  FB-0082: a game can open with a short backstory (`def.story`: `pages` with `{name}`, and a `cover` texture key): the shell shows the pages as
  cards (Enter / E / Space / click turns one, it also turns by itself after `MG_STORY_AUTO_MS`, a SKIP STORY button, Esc quits) once per opening,
  before the intro card and never after a retry; the page logic is pure (`minigameStoryPages` / `storyAdvance` / `storyTick` in `framework-data.js`)
  and a game draws its picture in `drawStoryArt(index)` (the tower: the prince, chameleon, gargoyle and the crowned princess on `tower-bg`).
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

## Depth groups and door entry (ADR 0015)

Every building, tree and piece of tall furniture that should draw in front of the player when she's
behind it, and behind her when she's in front, is a **depth group** -- a rectangle (tiles) the map's
own data declares. The engine (`src/scenes/world.js` `buildDepthGroups()`) bakes each one's tiles into
a single static image at map load and sorts it against every character by feet, never by hand-tuned
per-tile depth.

- **Tiled maps** (the campus, interiors): a `depthGroup`-typed object on any object layer, the usual
  `{ x, y, width, height }` rect in pixels (tiles once read through `tiledObjects()`), plus an
  optional `baseOffset` property (rows above the rect's own bottom edge where the base line sits --
  default 0, the rect's literal bottom row). Baked from every tile layer except `ground` (so ground
  itself never bakes into a group and always stays the flat, always-under-everyone base).
- **Text maps** (meadow/house, `src/maps.js`): a `depthGroups: [{ x, y, width, height, baseOffset? }]`
  array on the map def -- the same shape, since a text map only ever has the one merged tile layer
  (structures already stamped onto ground), the whole rect bakes as a single unit.
- **A tile inside more than one group belongs to the smallest** (`src/maplogic.js` `depthGroupAt()`,
  pure and unit-tested) -- e.g. a lamp post's own tiny rect over the corner of a bigger building's.
  A tile outside every group is left completely alone: not baked, not hidden, no collision change.
- **A map with no `depthGroup` data renders exactly as it did before this ADR** -- the campus has none
  yet (a parallel art branch adds them); nothing here is required for a map to keep working.
- **Depth is feet, not sprite anchor**: the player's and every NPC's depth is the bottom of their
  physics body (`PLAYER_FEET_OFFSET`/`npc.body.bottom`, `src/scenes/world.js`), so a group's own depth
  (its base line in pixels) sorts against her the same way any other object with feet would.

**Door entry.** A `door`/`stairs` warp (Tiled object, or a text map's own `warps` entry -- both
resolved into one shape by `world.js` `getWarpPoints()`) may carry an `openTiles` property: a
comma-separated list of tile names (`assets/tiles.json`), one per door tile, left to right starting
at the door's own tile. Missing/empty is fine -- the walk-in/out still happens, just with no overlay
to show (the campus art branch adds real tile names later; nothing here requires them yet). Stepping
onto an unlocked door: input locks, the door's own sound plays and its `openTiles` overlay shows (if
any), she walks one tile further in (still animating) so her feet cross the group's own base line and
she's hidden behind it, *then* the screen fades and the map changes. Arriving through a door plays the
same shape in reverse -- `src/maplogic.js` `doorTileFromSpawn()` (spawn point + facing, inverted) finds
which door tile she's arriving through without any extra per-map data. A locked door never opens: it
rattles in place and the usual toast shows, same throttle as everywhere else (once per approach).
Stairs get the same walk-in/out shape, just shorter, with no overlay.

## In-world cutscene scripts (ADR 0016)

Cutscenes play *inside* WorldScene, never a cut to a differently-styled illustration or a separate
Phaser scene (owner feedback FB-0032). Content (`src/scripts.js` `SCRIPTS`) is a list of **steps**,
each a single-key object naming which one it is -- the exact shape `src/dialog.js`'s own action
vocabulary already uses (`{ give: 'sword' }`, `{ stage: 'hunting' }`), applied to cutscenes. The engine
(`src/scripts-runtime.js` `ScriptRunner`, one instance per `WorldScene`, `this.scriptRunner`) is the
only code that knows how to run a step; scripts themselves are pure data.

```js
[
  { lockInput: true },                       // sets scene.transitioning (below)
  { unlockInput: true },
  { letterbox: 'in' | 'out' },                // thin top/bottom bars (src/scenes/ui.js Letterbox)
  { fade: { dir: 'in' | 'out', ms } },        // the world camera's own fade
  { cameraPan: { to, ms, ease } },            // stops following, pans to a point
  { cameraFollow: actorId },                  // resumes following an actor ('player' or a spawned one)
  { spawnActor: { id, sprite, at, facing, kind } },  // kind: 'character' (idle/walk anims) | 'image'
  { despawnActor: actorId },
  { placeActor: { actor, at, facing } },      // teleports, no animation (e.g. "at the bus door")
  { setActorVisible: { actor, visible } },
  { move: { actor, path: [point, ...], speed, ease } },  // speed in tiles/sec; plays walk/idle anims
  { face: { actor, dir } },
  { emote: { actor, kind: '!' | '?' | '...' | 'sparkle' } },  // a small bubble above the actor's head
  { say: { speaker, lines } },                // opens the same DialogBox every conversation uses
  { wait: ms },
  { sound: id },                              // src/audio.js AudioManager.play()
  { setFlag: 'name' | { name, value } },
  { parallel: [step, ...] },                  // runs several steps at once, awaits all of them
]
```

A **point** (`cameraPan.to`, `spawnActor.at`, a `move` path entry) is one of:
- a tile `{ x, y }`;
- a **named anchor** (a plain string), resolved at runtime against the current map's own Tiled objects
  by `src/maplogic.js` `resolveAnchor()` -- "spawn", "gate", a door/stairs object's own name, an
  area/zone's own name -- so a later map regeneration that moves a building doesn't silently break a
  script that walks up to its door;
- `{ anchor, offset: [dx, dy] }` or `{ actor: id, offset: [dx, dy] }` -- a point *relative* to a named
  anchor or another actor's current position, in tiles (e.g. "a few tiles north of wherever she is
  right now", `MUSTAFA_MEETS_HER_CORE`'s own shape, `src/scripts.js`);
- `{ keyStation: id }` -- a key station's own desk (`src/maps.js` `keyStations`).

**Running a script.** `WorldScene.playScript(key, steps)` (walk-into-a-trigger cutscenes, the same
`cutscene`-typed Tiled objects and `GameState.seenCutscenes` play-once bookkeeping as before this ADR
-- `checkCutscene()` prefers `SCRIPTS[key]` over the older `CUTSCENES[key]`/`CutsceneScene`, which stay
only as a fallback for anything never migrated) or `WorldScene.playOpeningSequence()` (the M3a opening,
started once from `create()` when `this.playOpening` is set) both call `this.scriptRunner.run(steps)`,
which sets `scene.transitioning = true` for the whole run -- the exact same flag a door walk-through
already used, so every existing gate (`update()`'s own early return, `UIScene.worldHasControl()`) keeps
working unchanged. **Esc** (`WorldScene`'s own keydown-ESC handler, gated on `scriptRunner.isRunning`)
calls `scriptRunner.skip()`: every step still pending jumps straight to its own end state and resolves;
every step not yet reached checks the same flag and does the same, with no delay at all -- "the whole
script fast-forwards to its end state (actors where they'd end, flags set), never a half state."
**E/Space** still advances a `say` step's dialog mid-script (`WorldScene.onInteractKey()` lets an
already-open dialog advance even while `transitioning` is set, the one deliberate hole in that gate).

The 3 key-room beats (`SCRIPTS.keyRoomPhysicsLab`/`Icl`/`Room195`, docs/STORY.md beat 8) have no Tiled
trigger of their own -- `WorldScene.checkKeyRoomBeats()` fires the matching script the first time she
comes within `ROOM_BEAT_RANGE` of that key's own (not-yet-taken) desk, keyed the same way as any other
cutscene (`GameState.seenCutscenes`, `` `keyRoom:${id}` ``).

**Onboarding (FB-0033).** `src/objective-routes.js` `OBJECTIVE_ROUTES` maps each objective
(`src/maplogic.js` `objectiveId(quest)`, the same branching `questObjectiveText()` uses) to an ordered
list of `{ map, anchor }` / `{ map, npc }` / `{ map, keyStation }` stops, one per map that objective's
own route actually passes through. `WorldScene.currentObjectiveAnchor()` picks the stop matching the
current map (or `null` if she's off-route) and resolves it to real tile coordinates; `src/scenes/ui.js`
`Onboarding` draws a bouncing arrow over it when it's on screen, `Minimap`/`FullMap` draw the same
pulsing marker regardless, and a gentle toast repeats the quest tracker's own objective text if she
hasn't gotten meaningfully closer to it in `WANDER_HINT_MS`.

## Talkable campus life and animals (ADR 0018)

Two more data files, loaded before `src/maps.js` (`index.html`, `tests/helpers/game-data.js`):

- **`src/campus-facts.js`**: `CAMPUS_ROLES` (a label + 1-2 openers per role) and `CAMPUS_FACTS`
  (`{ id, role, text, source }`, every `source` an F-id of `docs/research/campus-facts.md`). The pure
  `campusTalkLines(role, studentId, state)` picks what a student says (least-heard fact first; `state` is
  `GameState.campusTalk`, session-only, never saved). Every `src/ambient.js` entry has a `role`; the engine
  (`world.js` `interact()`) makes the student stop, turn and talk, with no per-entry dialog. The full list for
  the owner is `docs/research/campus-lines-review.md`.
- **`src/animals.js`**: `ANIMALS` (per outdoor map: `{ id, species, x, y, behaviour, talk? }`, cap 8 per map),
  `ANIMAL_SPECIES`/`ANIMAL_LAYOUTS` (sheets and frame layouts) and the pure behaviour functions
  (`stepAnimal`, `animalReaction`, `animalFleePoint`, `animalAnim`...). `world.js` `createAnimals()` /
  `updateAnimals()` only build sprites and play what those say. Animals have no collision and never
  appear indoors; sheets are preloaded from the data by `animalSheets()` (`src/maplogic.js`).
- Art: `tools/make-animals.js` (part of `npm run assets`) bakes `assets/animal-*.png` from the git-ignored
  packs in `assets/External Tilesets/`.
- Story objects always win E: `INTERACT_PRIORITY` ranks `ambientNpc` and `animal` lowest.

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
