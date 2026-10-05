---
status: accepted
date: 2026-10-05
authored_by: agent
derived_from: ["owner grilling rounds 1-2 (2026-10-04): tower climb, hero fight, moments play once", "FB-0066, FB-0071, FB-0074, FB-0051"]
supersedes: null
superseded_by: null
---

# 0024 - The mini-game line-up and the "moments" system

## Context
After the first playtest the owner replaced Tetris (FB-0074 asked for a candy-crush match-3, then preferred a Donkey-Kong-style tower climb), asked for a harder Physics Lab hero fight
(FB-0066), a fingerprint-locked ICL (FB-0071), and a set of small unskippable personal scenes (unicorn and prince, Mevin the drummer, Prof. Raja's chariot, the three friends).

## Decision
- **Key games:** Physics Lab = hero fight (generic stand-ins: a white kitten hero with a pink bow vs a dark bat-eared "shadow bat"; the owner's Hello Kitty/Batman are protected characters, ADR 0021);
  ICL = the flyer re-skinned as "ICL Fingerprint Hack" that opens a sealed door, the key is then handed over inside by Alice; Room 195 = **tower climb** (written by us on `platformer-physics.js`;
  the open Donkey-Kong-style projects found have no licence file, so none was copied). **Match-3 is dropped; Tetris is removed.** Sumo vs Narda is a parked bonus (TP room, not a priority).
- **Moments** (`src/moments.js`): in-world scripts, unskippable, play **once per save**, 8-20 s, never during dialogs/mini-games/scripts/door walks/pause; default pacing 90 s apart and one per map visit;
  the entrance pair is exempt (M2 follows M1 by about 6 s) so Mevin is not starved; M1 waits 2.5 s of free control after the welcome; `?moments=0` disables them for tests.
- Every new game keeps the framework's soft-lock guards: skip after 3 losses, Esc quits, a round failsafe at 150 s counts as a win.

## Consequences
- Old saves migrate (ICL ids, Tetris progress, `seenMoments`); the ICL door opens at once for a save that already has the key.
- Mini-game feel is unverified until a human plays (tests pin rules, not fun).
