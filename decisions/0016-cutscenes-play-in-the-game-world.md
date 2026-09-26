---
status: accepted
date: 2026-09-26
authored_by: agent
derived_from: ["owner feedback FB-0032 (cutscenes choppy and disconnected)", "owner feedback FB-0033 (don't understand what's going on after arriving)", "docs/plans/2026-09-26-premium-pass.md"]
supersedes: null
superseded_by: null
---

# 0016 — Cutscenes play in the game world, from data scripts

## Context

Today a cutscene cuts from the map to a separate illustration (drawn in a different, flatter style),
pans it under letterbox bars, shows a text box, then cuts back. The opening is five separate scenes
(greeting, name, clothes, bus, loading) each with its own backdrop. The owner: "the cutscenes and
start scenes are pretty choppy, the animation is done separately, it's not connected so it looks
really weird", and "as soon as I walk in, I don't understand what's going on".

Pokémon never cuts away: the camera pans across the real map, characters walk and turn, a text box
opens, and control comes back exactly where the scene ends.

## Options considered
1. **Redraw the illustrations better.** Still a cut to a different picture; still disconnected.
2. **Video clips.** Owner-supplied clips remain an optional extra, but they can't be the base.
3. **In-world scripted cutscenes (chosen).** A small command runner on top of WorldScene.

## Decision
We play cutscenes inside WorldScene from data scripts (content is data, docs/ARCHITECTURE.md):
a list of steps such as `lockInput`, `letterbox in/out`, `fade`, `cameraPan {to, ms, ease}`,
`cameraFollow`, `spawnActor {id, sprite, at}`, `move {actor, path, speed}`, `face`, `emote`,
`say {speaker, lines}`, `wait {ms}`, `sound`, `setFlag`, `parallel [...]`. Steps are awaited in
order; Esc fast-forwards to the end state. Scripts live next to the story data and are triggered by
map objects (as today) or by story actions.

- The bus arrival, the gate welcome, the Main Block entrance and each key room become in-world
  scripts. The title screen shows a slow live camera pan over the real campus.
- Mustafa meets her at the gate after the bus leaves and walks her onto the path, so the goal is
  clear from the first moment she has control.
- The static illustrations stay only where the world can't show it (the reward box close-up and
  the card).

## Consequences
- One art style everywhere; no hard cuts; every scene ends where the player actually is.
- New scenes are data, not new Phaser scenes.
- Scripts depend on map coordinates, so map changes must keep their anchor objects (named
  `cutsceneAnchor` points) stable; tests walk each script end to end.

## Links
- Related: [ADR 0015](0015-depth-groups-and-door-entry.md)
