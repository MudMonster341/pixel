// Onboarding data (FB-0033: "as soon as I walk in, I don't understand what's going on"), content
// only -- src/maplogic.js objectiveId()/objectiveTarget() pick which row applies and which step (if
// any) names a stop on the current map; src/scenes/world.js currentObjectiveAnchor() turns that step
// into real tile coordinates using the current map's own mapObjects/npcs/keyStations, and
// src/scenes/ui.js draws it as a pulsing minimap/full-map marker and, when it's on screen, a bouncing
// arrow over the door/desk itself (docs/GAME_FEEL.md's own "never dumps information she can't use" --
// this is the always-visible version of the quest tracker's text, docs/ARCHITECTURE.md).
//
// Each key is one of objectiveId()'s return values; each row is an ORDERED list of stops along the
// real route to that objective, one `{ map, ... }` entry per map that route actually passes through.
// world.js picks the entry whose `map` matches wherever she is right now:
//   { map, anchor: 'name' }     a Tiled object on that map, resolved by name (resolveAnchor())
//   { map, npc: 'id' }          an NPC def's own `id` on that map (src/maps.js `npcs`)
//   { map, keyStation: 'id' }   a key station def's own `id` on that map (src/maps.js `keyStations`)
// A map with no entry in the route at all just means "no on-screen destination here" -- she's off the
// story's route (out exploring campus while the goal is three floors up a building she isn't in, say);
// the quest tracker's own sentence (src/maplogic.js questObjectiveText()) still guides her regardless.
const OBJECTIVE_ROUTES = {
  // docs/STORY.md beat 4: "the LUG event stall behind the stairs" -- she hasn't met the volunteer yet.
  'find-stall': [
    { map: 'campus', anchor: 'Main Block entrance' },
    { map: 'main-block-g', npc: 'lug-volunteer' },
  ],
  // docs/STORY.md beat 6: Physics Lab, 3rd floor -- up through every Main Block stairwell in turn.
  'key-physicsLab': [
    { map: 'campus', anchor: 'Main Block entrance' },
    { map: 'main-block-g', anchor: 'Main Block Stairs G (up)' },
    { map: 'main-block-1', anchor: 'Main Block Stairs 1 (up)' },
    { map: 'main-block-2', anchor: 'Main Block Stairs 2 (up)' },
    { map: 'main-block-3', keyStation: 'physicsLab' },
  ],
  // docs/STORY.md beat 7: the ICVL, 1st floor -- one flight up from the foyer, then straight to it.
  'key-icvl': [
    { map: 'campus', anchor: 'Main Block entrance' },
    { map: 'main-block-g', anchor: 'Main Block Stairs G (up)' },
    { map: 'main-block-1', keyStation: 'icvl' },
  ],
  // docs/STORY.md beat 8: Room 195, also the 1st floor.
  'key-room195': [
    { map: 'campus', anchor: 'Main Block entrance' },
    { map: 'main-block-g', anchor: 'Main Block Stairs G (up)' },
    { map: 'main-block-1', keyStation: 'room195' },
  ],
  // docs/STORY.md beat 9: all 3 keys found, head back down to the stall -- the reverse of the
  // Physics Lab route (the deepest a key can leave her), since any floor she might still be on when
  // the last key lands is somewhere along it.
  'return-stall': [
    { map: 'main-block-3', anchor: 'Main Block Stairs 3 (down)' },
    { map: 'main-block-2', anchor: 'Main Block Stairs 2 (down)' },
    { map: 'main-block-1', anchor: 'Main Block Stairs 1 (down)' },
    { map: 'main-block-g', npc: 'lug-volunteer' },
    { map: 'campus', anchor: 'Main Block entrance' },
  ],
};
