# Game plan

**Status:** v1. The owner approved it on 2026-09-13 and their decisions are recorded below. The owner
is writing the real story and the new map. This file holds the structure the story plugs into, and
the build order for the base components.

## The game in one sentence

A cosy treasure hunt: talk to villagers, collect clues, explore to find **3 hidden items**, and use
them to open **the secret door**.

**Setting (decided 2026-09-13):** the real **BITS Pilani Dubai campus**. A new student arrives and
takes part in the **LUG treasure hunt** event. How the campus map is built is in
[CAMPUS_MAP_PLAN.md](CAMPUS_MAP_PLAN.md). The meadow and house are test maps.

## Core loop

```
talk to an NPC ──▶ get a clue (saved in the journal)
      ▲                    │
      │                    ▼
 new NPCs / areas     explore the map
 open up                   │
      ▲                    ▼
      └──── find the item (chest, hidden spot, reward, puzzle)
                           │
                  3 items collected?
                           │ yes
                           ▼
              the secret door opens ──▶ ending
```

## Story template (for the owner to fill in)

Filling in one block per item gives the agent everything needed to build it.

```
ITEM 1
  Name:             (e.g. Sun Shard)
  Clue giver:       (who, and where they stand)
  Clue text:        (what they say; can be a riddle)
  Answers:          (optional: choices the player can pick, and what each one leads to)
  Hidden where:     (map + rough spot)
  How it's found:   chest / dig spot / hidden until clue / reward for a task / puzzle
  Needs first:      (anything required before it can be found, or "nothing")

(repeat for ITEM 2 and ITEM 3)

SECRET DOOR
  Where:            (map + spot)
  What happens:     (text, animation, where it leads)
  Ending:           (what the player sees last)
```

## Owner decisions (2026-09-13)

| Question | Decision |
|---|---|
| Style guide and architecture rules | Approved for now |
| Where story items live | **Backpack.** No hotbar on screen, because it blocks the view. Keep the hotbar code and art for later. Items can be used from the backpack |
| Combat | None for now |
| Character size | Stay 16×16 for now |
| Conversation choices | **Yes.** Answers can branch the conversation into different flows |
| Saving | **Yes.** Progress survives closing the browser. Build it so **multiple player profiles** (and later login) can each have their own save, without a rewrite. Profiles and login themselves come much later |

## Base components: what exists and what's needed

✅ = done · 🔲 = to build

### Dev tooling
- ✅ Automated tests: unit + browser, before every push and on GitHub ([TESTING.md](TESTING.md))
- ✅ In-game dev feedback overlay with inbox, questions and fix confirmation ([FEEDBACK.md](FEEDBACK.md))
- 🔲 `?debug` mode: map select, teleport, flag editor, hitboxes

### Foundation
- ✅ Tile maps from text, collisions, camera, doors between maps with fade
- ✅ Inventory data model (stacking), hotbar UI (to be hidden in favour of the backpack)
- ✅ Dialog box with typewriter text, NPC talk prompt
- ✅ Minimap, toasts, tutorial card + checklist
- 🔲 Move to ES modules + the folder layout in [ARCHITECTURE.md](ARCHITECTURE.md) ([ADR 0004](../decisions/0004-es-modules-and-data-driven-content.md))
- 🔲 Event bus with declared event names
- 🔲 Flags + the conditions/actions script runner
- 🔲 Content registry that validates all data at boot
- 🔲 Save/load: plain-data GameState, versioned saves, profile-ready storage

### Interaction (the treasure-hunt toolkit)
- 🔲 Entity system: `npc`, `sign`, `pickup`, `chest`, `door`, `lockedDoor`, `trigger`, `hidden`
- 🔲 Data-driven NPC dialog (the first matching entry wins)
- 🔲 **Dialog choices and branching conversations**
- 🔲 Speech bubbles above heads: E prompt, **!** new info, **?** waiting, **…** chatter
- 🔲 **Backpack** (B): a grid of items with names/descriptions, "use" an item; the hotbar is hidden
- 🔲 Journal (J): list of clues received, ticked off when solved
- 🔲 Quest tracker (top right, taking over from the tutorial panel): "Shards found: 1 / 3"
- 🔲 Secret door sequence: camera pans to the door, shake, door-opening animation, new path

### Look and feel (style guide)
- 🔲 4-frame walks and idle animation (characters stay 16×16)
- 🔲 Drop shadows under characters, items and props
- 🔲 Overhead layer: walk behind treetops and roof edges
- 🔲 Animated tiles (water, flowers), tall grass that rustles
- 🔲 Ledges/cliffs for height, transition tiles (grass↔path, shoreline)
- 🔲 Sparkle particles on hidden spots once a clue is known
- 🔲 Sound effects (made free with jsfxr) and background music (CC0 tracks)
- 🔲 Title screen, pause menu (ESC), volume settings

### Later
- 🔲 Player profiles, then login, with each profile keeping its own saves
- 🔲 Ending screen + credits (`CREDITS.md` for any third-party assets)
- 🔲 Maps made in **Tiled** (free map editor) once they outgrow text, with entities on an object layer

## Build order (each phase ends playable, tested and pushed)

| Phase | Contents | Why this order |
|---|---|---|
| **1. Foundation** | ES modules, events, flags + scripts, content registry, save/load, debug mode | Everything after this is data. Doing it later means rewriting content |
| **2. Interaction toolkit** | Entities, data-driven dialog with choices, bubbles, backpack, journal, quest tracker, locked door | The treasure hunt can be built from data alone |
| **3. Story slice** | The owner's new map + items 1–3 + secret door | Proves the toolkit on real content |
| **4. Look and feel** | Shadows, overhead layer, animation, sound, title/pause | Art polish once gameplay is stable |
| **5. Later** | Profiles/login, ending, Tiled maps | Finishing touches |

## Free tools and open source worth using

| Tool | For | License |
|---|---|---|
| [Tiled](https://www.mapeditor.org) | Visual map editor with object layers for entities. Phaser loads its JSON directly | Free, GPL (maps you make are yours) |
| [LibreSprite](https://libresprite.github.io) / [Piskel](https://www.piskelapp.com) | Hand-drawn pixel art when text sprites get limiting | Free, GPL / Apache |
| [jsfxr](https://sfxr.me) | Retro sound effects | Free, the sounds are yours |
| [OpenGameArt](https://opengameart.org) (CC0 filter) | Music and extra art | Check each asset |
| [phaser3-rex-plugins](https://github.com/rexrainbow/phaser3-rex-plugins) | Ready-made UI widgets, if our own UI gets too complex | MIT, to evaluate |
| [Playwright](https://playwright.dev) | Browser tests (in use) | Apache 2.0 |
