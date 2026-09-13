# Game plan

**Status:** v1 proposal (2026-09-13). The owner is writing the real story and new map. This file
holds the structure the story plugs into, plus the build order for the base components.

## The game in one sentence

A cosy treasure hunt: talk to villagers, collect clues, explore to find **3 hidden items**, and use
them to open **the secret door**.

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
  Hidden where:     (map + rough spot)
  How it's found:   chest / dig spot / hidden until clue / reward for a task / puzzle
  Needs first:      (anything required before it can be found, or "nothing")

(repeat for ITEM 2 and ITEM 3)

SECRET DOOR
  Where:            (map + spot)
  What happens:     (text, animation, where it leads)
  Ending:           (what the player sees last)
```

## Base components: what exists and what's needed

✅ = done · 🔲 = to build

### Foundation (build first, before new content)
- ✅ Tile maps from text, walls/water/etc. that block, camera, map-to-map doors with fade
- ✅ Inventory (5 slots, stacking), hotbar UI
- ✅ Dialog box with typewriter text, NPC talk prompt
- ✅ Minimap, toasts, tutorial card + checklist
- 🔲 Move to ES modules + the folder layout in [ARCHITECTURE.md](ARCHITECTURE.md)
- 🔲 Event bus with declared event names
- 🔲 Flags + the conditions/actions script runner
- 🔲 Content registry that validates all data at boot
- 🔲 `?debug` mode: map select, teleport, flag editor, hitboxes

### Interaction (the treasure-hunt toolkit)
- 🔲 Entity system: `npc`, `sign`, `pickup`, `chest`, `door`, `lockedDoor`, `trigger`, `hidden`
- 🔲 Data-driven NPC dialog (first matching entry wins)
- 🔲 Speech bubbles above heads: E prompt, **!** new info, **?** waiting, **…** chatter
- 🔲 Journal (J): list of clues received, ticked when solved
- 🔲 Quest tracker (top right, takes over from the tutorial panel): "Shards found: 1 / 3"
- 🔲 Key items: story items kept separate from the hotbar so they can't be lost or crowd out slots
- 🔲 Secret door sequence: camera pans to the door, shake, door-opening animation, new path
- 🔲 Dialog choices (yes/no) *(only if the story needs it)*

### Look and feel (style guide)
- 🔲 Characters at 16×24 with 4-frame walks and idle animation
- 🔲 Drop shadows under characters, items and props
- 🔲 Overhead layer: walk behind tree tops and roof edges
- 🔲 Animated tiles (water, flowers), rustling tall grass
- 🔲 Ledges/cliffs for height, and transition tiles (grass↔path, shoreline)
- 🔲 Sparkle particles on hidden spots once a clue is known
- 🔲 Sound effects (made free with jsfxr) and background music (CC0 tracks)
- 🔲 Title screen, pause menu (ESC), volume settings

### Persistence and polish
- 🔲 Save/load to the browser (autosave on map change and after story events)
- 🔲 Ending screen + credits (`CREDITS.md` for any third-party assets)
- 🔲 Maps made in **Tiled** (free map editor) once they grow past what's comfortable as text,
  with entities placed on an object layer

## Build order (each phase ends playable, tested, pushed)

| Phase | Contents | Why this order |
|---|---|---|
| **1. Foundation** | ES modules, events, flags + scripts, content registry, debug mode | Everything after this is data; doing it later means rewriting content |
| **2. Interaction toolkit** | Entities, data-driven dialog, bubbles, journal, quest tracker, key items, locked door | The treasure hunt can be built from data alone |
| **3. Story slice** | The owner's new map + items 1–3 + secret door | Proves the toolkit on real content |
| **4. Look and feel** | 16×24 characters, shadows, overhead layer, animation, sound | Art polish once gameplay is stable |
| **5. Persistence and polish** | Save/load, title, pause, ending | Finishing touches |

## Open questions for the owner

1. **Story and map:** being prepared. Use the template above.
2. **Where do the 3 items live:** in the hotbar, or in a separate key-item pouch? (Recommended: a
   pouch, shown in the quest tracker.)
3. **Character size:** move to 16×24 for more expressive characters? (Recommended: yes, in phase 4.)
4. **Dialog choices:** does any NPC need yes/no answers?
5. **Saving:** should progress survive closing the browser? (Recommended: yes, in phase 5.)
6. **Maps:** keep text maps, or switch to Tiled when the new map arrives? (Recommended: Tiled if
   the new map is bigger than about 40×30.)

## Free tools and open-source worth using

| Tool | For | License |
|---|---|---|
| [Tiled](https://www.mapeditor.org) | Visual map editor, object layers for entities; Phaser loads its JSON directly | Free, GPL (maps you make are yours) |
| [LibreSprite](https://libresprite.github.io) / [Piskel](https://www.piskelapp.com) | Hand-drawn pixel art when text sprites get limiting | Free, GPL / Apache |
| [jsfxr](https://sfxr.me) | Retro sound effects | Free, sounds are yours |
| [OpenGameArt](https://opengameart.org) (CC0 filter) | Music and extra art | Check each asset |
| [phaser3-rex-plugins](https://github.com/rexrainbow/phaser3-rex-plugins) | Ready-made UI widgets, if our own UI gets too complex | MIT, to evaluate |
