# 0025: "EDI Madness" (garage parking with an instructor) replaces the ICL flyer

Date: 2026-10-06 (owner request on the night of 2026-10-05). Status: **accepted, built E1-E4, E5 feel after the owner drives it** (plan: [docs/plans/2026-10-06-edi-madness.md](../docs/plans/2026-10-06-edi-madness.md)).

## Context
The mini-game line-up ([ADR 0024](0024-mini-game-lineup-and-moments-system.md)) is: Physics Lab = hero fight, ICL = fingerprint-door "Server Dash" flyer then the lab with Alice, Room 195 = tower climb. The owner asked to change "the second game" into **EDI Madness**: Taru and a driving instructor doing garage parking. Asked which game that is, the owner chose the ICL lab's game.

## Decision
1. The ICL scanner starts a new top-down parking game (`minigame-edi`, MINIGAMES id `edi`) instead of the flyer. Winning, or the skip after 3 losses, sets the same saved flag `iclDoorOpen`; the door animation, Alice and the core console (the key) are unchanged.
2. Three stages (easy bay, reverse between cars, tight garage), gentle difficulty, an instructor with short funny lines, a story page intro. "EDI" is a nod to a Dubai driving school: generic lettering and an "L" plate, **no real logo**.
3. Free art packs only (FB-0025): the CC0 Kenney Pixel Vehicle Pack for cars; garage drawing and lettering are generator code.
4. The flyer (`src/minigames/flappy.js`, `flappy-logic.js`, `flappy-sprites.png`) stays in the repo, unreachable, as a **one-line rollback** if EDI Madness is not good enough by 2026-10-08.

## Consequences
- Texts about the fingerprint scanner / "ICL Fingerprint Hack" are reworded to parking; the FB-0071 tests are ported, not deleted (soft-lock guards stay).
- New risk: driving feel cannot be judged without hands; the owner tunes it in the second round.
- Cut order if time runs short: stage 3, stage 2, the instructor's portrait, the story pages.
