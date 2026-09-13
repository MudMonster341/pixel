# Architecture rules

**Status:** v1 proposal (2026-09-13). Waiting for the owner's review. It describes the target
structure. The "Today" notes say where the code still differs. Once approved, every change follows
these rules. Changing a rule needs an ADR in `decisions/`.

## The one big rule

**Content is data. The engine is code. They never mix.**

Adding a map, NPC, item, clue, chest or secret door should mean *editing data files only*. If new
content needs new engine code, the engine is missing a general feature: add that feature once, in
a reusable way, then use it from data.

## Folder layout (target)

```
src/
  main.js              boot, Phaser config
  config.js            constants: tile size, zoom, speeds, colors, font
  core/
    events.js          the event bus + list of every event name
    registry.js        loads + validates all content data at boot (fails loudly)
  systems/             game rules, no drawing
    state.js           GameState: the single source of truth, serialisable to JSON
    inventory.js
    flags.js           story flags (true/false/number)
    script.js          runs conditions and actions from data (see below)
    save.js            save/load GameState to localStorage
  scenes/
    boot.js  world.js  ui.js
  world/               things that live in the map
    entities.js        builds entities from map data (npc, sign, chest, door, ...)
    player.js
    bubbles.js         speech bubbles and emotes above heads
  ui/                  things drawn on the screen
    minimap.js  hotbar.js  dialog.js  toast.js  tutorial.js  journal.js  questTracker.js
  data/                CONTENT, no engine logic
    items.js
    tiles.json         (generated)
    maps/meadow.js     maps/house.js  ...one file per map
    npcs/tomas.js      ...dialog scripts per NPC
    quests/main.js     the treasure hunt steps
```

*Today:* plain `<script>` tags with shared globals in 6 files. The move to native ES modules is
proposed in [ADR 0004](../decisions/0004-es-modules-and-data-driven-content.md).

## Who talks to whom

```
 data/ ──read by──▶ systems/ ◀──calls── scenes/world ──emits events──▶ scenes/ui
                       ▲                                                   │
                       └───────────────calls (e.g. select slot)────────────┘
```

- **World** owns the map, player and entities. It never draws UI.
- **UI** draws the screen. It never moves the player or changes the map.
- **Systems** own the rules and state. They never draw anything.
- Scenes communicate through **events** on `game.events`. Every event name is declared in
  `core/events.js` and nowhere else.
- Anything that must survive a map change or a save goes in **GameState**. Nothing else keeps
  progress.

## Scripts: conditions and actions

All story logic is data made of **conditions** ("is this true?") and **actions** ("do this").
`systems/script.js` is the only code that runs them.

**Conditions**
```js
{ flag: 'tomas.gaveClue' }            // flag is set
{ notFlag: 'door.opened' }
{ hasItem: 'starShard', count: 3 }
{ all: [ ...conditions ] }            // AND
{ any: [ ...conditions ] }            // OR
```

**Actions**
```js
{ say: ['line one', 'line two'] }     // open dialog with the current speaker
{ giveItem: 'sword' }
{ takeItem: 'starShard', count: 3 }
{ setFlag: 'tomas.gaveClue' }
{ addClue: 'shard-1' }                // adds a clue to the journal
{ toast: 'The ground rumbles...' }
{ reveal: 'meadow-hidden-chest' }     // make a hidden entity appear
{ openDoor: 'secret-door' }
{ warp: { map: 'cave', x: 5, y: 9, facing: 'up' } }
{ cameraShake: 300 }
```

**NPC dialog** is a list of entries. The *first* entry whose `when` matches is used:
```js
export default {
  id: 'tomas',
  name: 'Tomas',
  sprite: 'npc-tomas',
  dialog: [
    { when: { hasItem: 'starShard', count: 3 }, do: [{ say: ['You found them all! Try the old door.'] }] },
    { when: { notFlag: 'tomas.metPlayer' }, bubble: '!', do: [
      { say: ['Oh! A visitor!', 'They say a shard lies where the lake meets the rocks.'] },
      { addClue: 'shard-lake' },
      { setFlag: 'tomas.metPlayer' },
    ] },
    { do: [{ say: ['Good luck out there.'] }] },   // fallback, no `when`
  ],
};
```

## Entities (things placed on a map)

Every map object has the same basic shape: `{ id, type, x, y, when?, ... }`. `x` and `y` are in
**tiles**. `when` is a condition: the entity only exists while it's true.

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

Opened chests, taken pickups and triggered one-offs are recorded in GameState by `id`, so they
stay done after a map change or a reload.

## Naming

- **ids:** kebab-case, globally unique, prefixed by map: `meadow-chest-1`, `house-sign`.
- **flags:** dot namespaces, `who.what`: `tomas.metPlayer`, `secretDoor.opened`.
- **tile names:** camelCase: `roofTL`, `wallWindow`.
- **events:** `noun:verb`: `map:entered`, `item:added`, `dialog:closed`.
- **Coordinates:** tiles in data, pixels only inside the engine (`toPixel()`).

## Rules that keep it stable

1. **Validate at boot.** The content registry checks every map and script: unknown tile names,
   duplicate ids, missing items/NPCs, doors to missing maps. Fail with a clear message on screen,
   not with a mysterious crash later.
2. **One source of truth.** A fact is stored once, in GameState or in data, never copied.
3. **Scenes are rebuildable.** The world scene can be restarted at any time from GameState + data.
   If restarting changes anything, that's a bug.
4. **No magic numbers in scenes.** Sizes, speeds and colors come from `config.js` (art colors come
   from the style guide).
5. **Small steps.** One feature per work chunk, playable at the end of each chunk, browser-tested,
   checkpointed.
6. **Debug hooks stay.** `window.game` exists. A `?debug` URL flag (planned) adds map select,
   teleport, a flag editor and hitbox view.

## How to add things (checklists)

**A new item:** add it to `data/items.js` → draw its icon in `tools/make-assets.js` →
`npm run assets` → place it as a `pickup`/`chest` entity or give it with `giveItem`.

**A new map:** create `data/maps/<name>.js` with the standard shape (`name`, `legend`, `rows`,
`spawn`, `entities`) → register it → add a `door` entity on another map that leads to it.

**A new NPC:** draw the sprite (style guide: distinct colors) → create `data/npcs/<name>.js` with
dialog entries → place an `npc` entity on a map.

**A new story step:** add flags and clues via NPC dialog actions → place the `hidden`/`chest`
entity with a `when` that uses those flags → test the step from a fresh save and from `?debug`.
